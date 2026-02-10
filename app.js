import firebaseConfig from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const TROY_OUNCE_G = 31.1034768;
const APP_VERSION = "v1.1.1";
const COIN_GRAMS_DEFAULT = {
  "Dollar": 24.05,
  "Half Dollar": 12.5,
  "Quarter": 6.25,
  "Dime": 2.5,
  "Custom": 0
};

const COIN_GRAMS_SILVER = {
  "Dollar": 24.05,
  "Half Dollar": 11.25,
  "Quarter": 6.25,
  "Dime": 2.5,
  "Custom": 0
};

const COIN_GRAMS_GOLDBACK = {
  "1/2 Goldback (1/2000 oz)": 0.016,
  "1 Goldback (1/1000 oz)": 0.031,
  "5 Goldback (1/200 oz)": 0.156,
  "10 Goldback (1/100 oz)": 0.311,
  "25 Goldback (1/40 oz)": 0.778,
  "50 Goldback (1/20 oz)": 1.555
};

const priceEndpoints = {
  gold: "https://api.gold-api.com/price/XAU",
  silver: "https://api.gold-api.com/price/XAG",
  platinum: "https://api.gold-api.com/price/XPT"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const elements = {
  signInBtn: document.getElementById("signInBtn"),
  signOutBtn: document.getElementById("signOutBtn"),
  userEmail: document.getElementById("userEmail"),
  signedOutView: document.getElementById("signedOutView"),
  authedView: document.getElementById("authedView"),
  versionNumber: document.getElementById("versionNumber"),
  inventorySection: document.getElementById("inventorySection"),
  refreshPricesBtn: document.getElementById("refreshPricesBtn"),
  pricesUpdatedAt: document.getElementById("pricesUpdatedAt"),
  goldPrice: document.getElementById("goldPrice"),
  silverPrice: document.getElementById("silverPrice"),
  platinumPrice: document.getElementById("platinumPrice"),
  totalValue: document.getElementById("totalValue"),
  goldValue: document.getElementById("goldValue"),
  silverValue: document.getElementById("silverValue"),
  platinumValue: document.getElementById("platinumValue"),
  itemCount: document.getElementById("itemCount"),
  itemsBody: document.getElementById("itemsBody"),
  itemForm: document.getElementById("itemForm"),
  searchInput: document.getElementById("searchInput"),
  metalFilter: document.getElementById("metalFilter"),
  clearFiltersBtn: document.getElementById("clearFiltersBtn"),
  metal: document.getElementById("metal"),
  category: document.getElementById("category"),
  coinCategoryOption: document.getElementById("coinCategoryOption"),
  coinFields: document.getElementById("coinFields"),
  coinTypeLabel: document.getElementById("coinTypeLabel"),
  coinType: document.getElementById("coinType"),
  yearField: document.getElementById("yearField"),
  year: document.getElementById("year"),
  bullionFields: document.getElementById("bullionFields"),
  bullionName: document.getElementById("bullionName"),
  grams: document.getElementById("grams"),
  quantity: document.getElementById("quantity"),
  notes: document.getElementById("notes")
};

const state = {
  user: null,
  items: [],
  filteredItems: [],
  prices: {
    gold: null,
    silver: null,
    platinum: null
  },
  updatedAt: null
};

let unsubscribeItems = null;

function formatCurrency(value) {
  if (value === null || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function formatNumber(value, decimals = 4) {
  if (value === null || Number.isNaN(value)) return "-";
  return Number(value).toFixed(decimals);
}

function getCoinConfigForMetal(metal) {
  if (metal === "gold") {
    return { label: "Goldback", gramsMap: COIN_GRAMS_GOLDBACK };
  }
  if (metal === "silver") {
    return { label: "Coin Type", gramsMap: COIN_GRAMS_SILVER };
  }
  return { label: "Coin Type", gramsMap: COIN_GRAMS_DEFAULT };
}

function populateCoinOptions() {
  if (!elements.coinType || !elements.metal) return;
  const { label, gramsMap } = getCoinConfigForMetal(elements.metal.value);
  if (elements.coinTypeLabel) {
    elements.coinTypeLabel.textContent = label;
  }
  const options = Object.keys(gramsMap).map((name) => `<option value="${name}">${name}</option>`);
  elements.coinType.innerHTML = options.join("");
}

function updateCategoryLabel() {
  if (!elements.coinCategoryOption || !elements.metal) return;
  const isGold = elements.metal.value === "gold";
  elements.coinCategoryOption.textContent = isGold ? "Goldback" : "Coin";
}

function setFormDefaults() {
  const { gramsMap } = getCoinConfigForMetal(elements.metal.value);
  const grams = gramsMap[elements.coinType.value] ?? 0;
  elements.grams.value = grams;
}

function toggleCategoryFields() {
  const isCoin = elements.category.value === "coin";
  elements.coinFields.classList.toggle("d-none", !isCoin);
  elements.bullionFields.classList.toggle("d-none", isCoin);
  elements.bullionName.required = !isCoin;

  const isSilverCoin = isCoin && elements.metal.value === "silver";
  elements.yearField.classList.toggle("d-none", !isSilverCoin);
  elements.year.required = isSilverCoin;
}

function getPricePerGram(metal) {
  const pricePerOz = state.prices[metal];
  if (!pricePerOz) return null;
  return pricePerOz / TROY_OUNCE_G;
}

function calculateTotals() {
  const totals = {
    gold: 0,
    silver: 0,
    platinum: 0
  };

  state.items.forEach((item) => {
    totals[item.metal] += item.gramsPerItem * item.quantity;
  });

  const goldValue = totals.gold * (getPricePerGram("gold") ?? 0);
  const silverValue = totals.silver * (getPricePerGram("silver") ?? 0);
  const platinumValue = totals.platinum * (getPricePerGram("platinum") ?? 0);

  elements.goldValue.textContent = `Total: ${formatCurrency(goldValue)}`;
  elements.silverValue.textContent = `Total: ${formatCurrency(silverValue)}`;
  elements.platinumValue.textContent = `Total: ${formatCurrency(platinumValue)}`;

  const totalValue = goldValue + silverValue + platinumValue;
  elements.totalValue.textContent = formatCurrency(totalValue);
}

function renderPrices() {
  if (state.prices.gold) {
    elements.goldPrice.textContent = `${formatCurrency(state.prices.gold)} / oz`;
  } else {
    elements.goldPrice.textContent = "Unavailable";
  }

  if (state.prices.silver) {
    elements.silverPrice.textContent = `${formatCurrency(state.prices.silver)} / oz`;
  } else {
    elements.silverPrice.textContent = "Unavailable";
  }

  if (state.prices.platinum) {
    elements.platinumPrice.textContent = `${formatCurrency(state.prices.platinum)} / oz`;
  } else {
    elements.platinumPrice.textContent = "Unavailable";
  }

  elements.pricesUpdatedAt.textContent = state.updatedAt
    ? `Last updated ${state.updatedAt}`
    : "Prices not loaded";
}

async function fetchSpotPrices() {
  const results = await Promise.allSettled(
    Object.entries(priceEndpoints).map(async ([metal, url]) => {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`Price fetch failed for ${metal}`);
      const data = await response.json();
      return { metal, price: data.price, updatedAtReadable: data.updatedAtReadable || data.updatedAt };
    })
  );

  let latestUpdate = null;

  results.forEach((result) => {
    if (result.status === "fulfilled") {
      state.prices[result.value.metal] = result.value.price;
      if (result.value.updatedAtReadable) {
        latestUpdate = result.value.updatedAtReadable;
      }
    }
  });

  state.updatedAt = latestUpdate;
  renderPrices();
  calculateTotals();
}

function renderItems() {
  const visibleItems = state.filteredItems.length ? state.filteredItems : state.items;
  elements.itemCount.textContent = `${visibleItems.length} items`;

  if (!visibleItems.length) {
    elements.itemsBody.innerHTML = '<tr><td colspan="8" class="text-muted">No items yet.</td></tr>';
    calculateTotals();
    return;
  }

  const rows = visibleItems.map((item) => {
    const totalGrams = item.gramsPerItem * item.quantity;
    const pricePerGram = getPricePerGram(item.metal);
    const value = pricePerGram ? totalGrams * pricePerGram : null;

    return `
      <tr>
        <td class="text-capitalize">${item.metal}</td>
        <td>${item.itemType}</td>
        <td>${item.year ?? "-"}</td>
        <td>${formatNumber(item.gramsPerItem)}</td>
        <td>${item.quantity}</td>
        <td>${formatNumber(totalGrams)}</td>
        <td>${formatCurrency(value)}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-danger" data-id="${item.id}">Delete</button>
        </td>
      </tr>
    `;
  });

  elements.itemsBody.innerHTML = rows.join("");

  elements.itemsBody.querySelectorAll("button[data-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = button.getAttribute("data-id");
      if (!state.user) return;
      await deleteDoc(doc(db, "users", state.user.uid, "items", id));
    });
  });

  calculateTotals();
}

function applyFilters() {
  const searchValue = elements.searchInput?.value.trim().toLowerCase() ?? "";
  const metalValue = elements.metalFilter?.value ?? "all";

  if (!searchValue && metalValue === "all") {
    state.filteredItems = [];
    renderItems();
    return;
  }

  state.filteredItems = state.items.filter((item) => {
    const matchesMetal = metalValue === "all" || item.metal === metalValue;
    if (!matchesMetal) return false;

    if (!searchValue) return true;

    const haystack = [
      item.metal,
      item.itemType,
      item.category,
      item.year,
      item.notes
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(searchValue);
  });

  renderItems();
}

function subscribeToItems() {
  if (!state.user) return;
  const itemsQuery = query(
    collection(db, "users", state.user.uid, "items"),
    orderBy("createdAt", "desc")
  );

  unsubscribeItems = onSnapshot(itemsQuery, (snapshot) => {
    state.items = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
    applyFilters();
  });
}

async function handleFormSubmit(event) {
  event.preventDefault();
  if (!state.user) return;

  const category = elements.category.value;
  const itemType = category === "coin" ? elements.coinType.value : elements.bullionName.value.trim();
  const gramsPerItem = Number(elements.grams.value);
  const quantity = Number(elements.quantity.value);
  const yearValue = elements.year.value ? Number(elements.year.value) : null;

  if (!itemType || gramsPerItem <= 0 || quantity <= 0) {
    return;
  }

  await addDoc(collection(db, "users", state.user.uid, "items"), {
    metal: elements.metal.value,
    category,
    itemType,
    gramsPerItem,
    quantity,
    year: yearValue,
    notes: elements.notes.value.trim(),
    createdAt: serverTimestamp()
  });

  elements.itemForm.reset();
  elements.category.value = "coin";
  toggleCategoryFields();
  setFormDefaults();
}

function bindEvents() {
  const doSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      if (error?.code === "auth/popup-blocked" || error?.code === "auth/popup-closed-by-user") {
        await signInWithRedirect(auth, provider);
        return;
      }
      throw error;
    }
  };

  elements.signInBtn.addEventListener("click", doSignIn);

  elements.signOutBtn.addEventListener("click", async () => {
    await signOut(auth);
  });

  elements.refreshPricesBtn.addEventListener("click", fetchSpotPrices);
  elements.category.addEventListener("change", toggleCategoryFields);
  elements.coinType.addEventListener("change", setFormDefaults);
  elements.metal.addEventListener("change", () => {
    updateCategoryLabel();
    populateCoinOptions();
    setFormDefaults();
    toggleCategoryFields();
  });
  elements.itemForm.addEventListener("submit", handleFormSubmit);
  elements.searchInput.addEventListener("input", applyFilters);
  elements.metalFilter.addEventListener("change", applyFilters);
  elements.clearFiltersBtn.addEventListener("click", () => {
    elements.searchInput.value = "";
    elements.metalFilter.value = "all";
    applyFilters();
  });
}

onAuthStateChanged(auth, (user) => {
  if (unsubscribeItems) {
    unsubscribeItems();
    unsubscribeItems = null;
  }
  state.user = user;
  const isAuthed = Boolean(user);

  elements.signInBtn.classList.toggle("d-none", isAuthed);
  elements.signOutBtn.classList.toggle("d-none", !isAuthed);
  elements.userEmail.textContent = user?.email ?? "";
  document.body.classList.toggle("authed", isAuthed);
  if (elements.signedOutView) {
    elements.signedOutView.style.display = isAuthed ? "none" : "";
  }
  if (elements.authedView) {
    elements.authedView.style.display = isAuthed ? "" : "none";
  }

  if (isAuthed) {
    subscribeToItems();
  } else {
    state.items = [];
    state.filteredItems = [];
    renderItems();
  }
});

populateCoinOptions();
updateCategoryLabel();
setFormDefaults();
toggleCategoryFields();
bindEvents();
fetchSpotPrices();

if (elements.versionNumber) {
  elements.versionNumber.textContent = APP_VERSION;
}
