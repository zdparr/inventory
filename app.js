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
  collectionGroup,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const TROY_OUNCE_G = 31.1034768;
const APP_VERSION = "v1.2.7";
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

const BULLION_PRESETS = {
  "1 oz": 31.1035,
  "1/2 oz": 15.5517,
  "1/4 oz": 7.77587,
  "1/10 oz": 3.11035,
  "2 oz": 62.207,
  "5 oz": 155.517,
  "10 oz": 311.035,
  "Custom": 0
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
  householdSelect: document.getElementById("householdSelect"),
  sharingSection: document.getElementById("sharingSection"),
  householdRoleBadge: document.getElementById("householdRoleBadge"),
  shareForm: document.getElementById("shareForm"),
  inviteEmail: document.getElementById("inviteEmail"),
  sendInviteBtn: document.getElementById("sendInviteBtn"),
  shareStatus: document.getElementById("shareStatus"),
  householdMembers: document.getElementById("householdMembers"),
  pendingInvites: document.getElementById("pendingInvites"),
  versionNumber: document.getElementById("versionNumber"),
  inventorySection: document.getElementById("inventorySection"),
  refreshPricesBtn: document.getElementById("refreshPricesBtn"),
  pricesUpdatedAt: document.getElementById("pricesUpdatedAt"),
  goldPrice: document.getElementById("goldPrice"),
  silverPrice: document.getElementById("silverPrice"),
  platinumPrice: document.getElementById("platinumPrice"),
  totalValue: document.getElementById("totalValue"),
  summaryBullionOz: document.getElementById("summaryBullionOz"),
  summaryBullionGoldOz: document.getElementById("summaryBullionGoldOz"),
  summaryBullionSilverOz: document.getElementById("summaryBullionSilverOz"),
  summaryBullionPlatinumOz: document.getElementById("summaryBullionPlatinumOz"),
  summaryCoinList: document.getElementById("summaryCoinList"),
  goldValue: document.getElementById("goldValue"),
  silverValue: document.getElementById("silverValue"),
  platinumValue: document.getElementById("platinumValue"),
  itemCount: document.getElementById("itemCount"),
  itemsContainer: document.getElementById("itemsAccordion"),
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
  bullionPreset: document.getElementById("bullionPreset"),
  bullionName: document.getElementById("bullionName"),
  grams: document.getElementById("grams"),
  quantity: document.getElementById("quantity"),
  notes: document.getElementById("notes")
};

const state = {
  user: null,
  items: [],
  filteredItems: [],
  editingId: null,
  useLegacyMode: false,
  activeHouseholdId: null,
  activeHouseholdRole: null,
  memberships: [],
  prices: {
    gold: null,
    silver: null,
    platinum: null
  },
  updatedAt: null
};

let unsubscribeItems = null;
let unsubscribeMembers = null;
let unsubscribeInvites = null;

function normalizeEmail(email) {
  return (email ?? "").trim().toLowerCase();
}

function isPermissionDenied(error) {
  return error?.code === "permission-denied" || String(error?.message ?? "").toLowerCase().includes("permission");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isIosInAppBrowser() {
  const ua = navigator.userAgent || "";
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  if (!isIOS) return false;
  return /FBAN|FBAV|Instagram|Line|Twitter|LinkedInApp|GSA|Snapchat|Pinterest|wv|WebView/i.test(ua);
}
function getItemsCollectionRef() {
  if (!state.user) return null;
  if (state.useLegacyMode) {
    return collection(db, "users", state.user.uid, "items");
  }
  if (!state.activeHouseholdId) return null;
  return collection(db, "households", state.activeHouseholdId, "items");
}

function getItemDocRef(itemId) {
  if (!state.user) return null;
  if (state.useLegacyMode) {
    return doc(db, "users", state.user.uid, "items", itemId);
  }
  if (!state.activeHouseholdId) return null;
  return doc(db, "households", state.activeHouseholdId, "items", itemId);
}

async function fetchMemberships(uid) {
  const membershipsQuery = query(collectionGroup(db, "members"), where("uid", "==", uid));
  const snapshot = await getDocs(membershipsQuery);
  const memberships = await Promise.all(snapshot.docs.map(async (docSnap) => {
    const householdRef = docSnap.ref.parent.parent;
    const householdId = householdRef?.id;
    if (!householdId) return null;
    const householdSnap = await getDoc(householdRef);
    const householdData = householdSnap.data() ?? {};
    return {
      householdId,
      role: docSnap.data().role ?? "member",
      name: householdData.name ?? `Inventory ${householdId.slice(0, 6)}`
    };
  }));
  return memberships.filter(Boolean);
}

async function acceptPendingInvites(user) {
  const emailLower = normalizeEmail(user?.email);
  if (!emailLower) return 0;
  const invitesQuery = query(
    collectionGroup(db, "invites"),
    where("invitedEmailLower", "==", emailLower)
  );
  const snapshot = await getDocs(invitesQuery);
  const pending = snapshot.docs.filter((docSnap) => docSnap.data()?.status === "pending");
  await Promise.all(pending.map(async (inviteSnap) => {
    const householdRef = inviteSnap.ref.parent.parent;
    const householdId = householdRef?.id;
    if (!householdId) return;
    await setDoc(
      doc(db, "households", householdId, "members", user.uid),
      {
        uid: user.uid,
        email: user.email ?? "",
        displayName: user.displayName ?? "",
        role: "member",
        createdAt: serverTimestamp()
      },
      { merge: true }
    );
    await updateDoc(inviteSnap.ref, {
      status: "accepted",
      acceptedByUid: user.uid,
      acceptedByEmail: user.email ?? "",
      acceptedAt: serverTimestamp()
    });
  }));
  return pending.length;
}

async function createPersonalHousehold(user) {
  const householdRef = doc(collection(db, "households"));
  const householdName = user?.displayName
    ? `${user.displayName}'s Inventory`
    : `${user?.email ?? "My"} Inventory`;

  await setDoc(householdRef, {
    name: householdName,
    ownerUid: user.uid,
    ownerEmail: user.email ?? "",
    createdAt: serverTimestamp()
  });

  await setDoc(doc(db, "households", householdRef.id, "members", user.uid), {
    uid: user.uid,
    email: user.email ?? "",
    displayName: user.displayName ?? "",
    role: "owner",
    createdAt: serverTimestamp()
  });

  const legacyItems = await getDocs(collection(db, "users", user.uid, "items"));
  await Promise.all(legacyItems.docs.map((legacyDoc) => setDoc(
    doc(db, "households", householdRef.id, "items", legacyDoc.id),
    legacyDoc.data(),
    { merge: true }
  )));

  await setDoc(doc(db, "users", user.uid), {
    email: user.email ?? "",
    displayName: user.displayName ?? "",
    activeHouseholdId: householdRef.id,
    migratedLegacyItemsAt: serverTimestamp()
  }, { merge: true });

  return householdRef.id;
}

function renderHouseholdSwitcher() {
  if (!elements.householdSelect) return;
  if (state.useLegacyMode) {
    elements.householdSelect.classList.add("d-none");
    elements.householdSelect.innerHTML = "";
    return;
  }
  if (!state.user || state.memberships.length <= 1) {
    elements.householdSelect.classList.add("d-none");
    elements.householdSelect.innerHTML = "";
    return;
  }
  elements.householdSelect.classList.remove("d-none");
  elements.householdSelect.innerHTML = state.memberships
    .map((membership) => {
      const selected = membership.householdId === state.activeHouseholdId ? " selected" : "";
      return `<option value="${membership.householdId}"${selected}>${escapeHtml(membership.name)}</option>`;
    })
    .join("");
}

function renderSharingSection() {
  const authed = Boolean(state.user);
  if (state.useLegacyMode) {
    elements.sharingSection?.classList.toggle("d-none", !authed);
    if (!authed) return;
    elements.householdRoleBadge.textContent = "Legacy Mode";
    elements.householdRoleBadge.className = "badge text-bg-warning";
    elements.sendInviteBtn.disabled = true;
    elements.inviteEmail.disabled = true;
    elements.householdMembers.textContent = "Unavailable until shared Firestore rules are enabled.";
    elements.pendingInvites.textContent = "Unavailable in legacy mode.";
    elements.shareStatus.textContent =
      "Household sharing is disabled because Firestore permissions for shared collections are not active yet.";
    return;
  }
  elements.sharingSection?.classList.toggle("d-none", !authed || !state.activeHouseholdId);
  if (!authed || !state.activeHouseholdId) return;

  const isOwner = state.activeHouseholdRole === "owner";
  elements.householdRoleBadge.textContent = isOwner ? "Owner" : "Member";
  elements.householdRoleBadge.className = `badge ${isOwner ? "text-bg-dark" : "text-bg-secondary"}`;
  elements.sendInviteBtn.disabled = !isOwner;
  elements.inviteEmail.disabled = !isOwner;
  if (!isOwner) {
    elements.shareStatus.textContent = "Only the household owner can send invites.";
  } else if (!elements.shareStatus.textContent) {
    elements.shareStatus.textContent = "";
  }
}

function subscribeToHouseholdMeta() {
  if (unsubscribeMembers) {
    unsubscribeMembers();
    unsubscribeMembers = null;
  }
  if (unsubscribeInvites) {
    unsubscribeInvites();
    unsubscribeInvites = null;
  }
  if (state.useLegacyMode || !state.activeHouseholdId) return;

  unsubscribeMembers = onSnapshot(
    collection(db, "households", state.activeHouseholdId, "members"),
    (snapshot) => {
      const rows = snapshot.docs
        .map((docSnap) => docSnap.data())
        .sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""))
        .map((member) => {
          const role = member.role === "owner" ? "owner" : "member";
          const label = member.displayName || member.email || member.uid;
          return `<div>${escapeHtml(label)} <span class="text-muted">(${role})</span></div>`;
        });
      elements.householdMembers.innerHTML = rows.join("") || "No members yet.";
    }
  );

  unsubscribeInvites = onSnapshot(
    collection(db, "households", state.activeHouseholdId, "invites"),
    (snapshot) => {
      const rows = snapshot.docs
        .map((docSnap) => docSnap.data())
        .filter((invite) => invite.status === "pending")
        .sort((a, b) => (a.invitedEmailLower ?? "").localeCompare(b.invitedEmailLower ?? ""))
        .map((invite) => `<div>${escapeHtml(invite.invitedEmail)}</div>`);
      elements.pendingInvites.innerHTML = rows.join("") || "No pending invites.";
    }
  );
}

async function initializeUserContext(user) {
  try {
    await acceptPendingInvites(user);
  } catch (error) {
    if (!isPermissionDenied(error)) {
      throw error;
    }
  }

  let memberships = [];
  try {
    memberships = await fetchMemberships(user.uid);
  } catch (error) {
    if (!isPermissionDenied(error)) {
      throw error;
    }
  }

  if (!memberships.length) {
    const userDocRef = doc(db, "users", user.uid);
    const userDocSnap = await getDoc(userDocRef);
    const existingActiveHouseholdId = userDocSnap.data()?.activeHouseholdId ?? null;

    if (existingActiveHouseholdId) {
      const membershipRef = doc(db, "households", existingActiveHouseholdId, "members", user.uid);
      const membershipSnap = await getDoc(membershipRef);
      if (membershipSnap.exists()) {
        const householdSnap = await getDoc(doc(db, "households", existingActiveHouseholdId));
        const householdData = householdSnap.data() ?? {};
        memberships = [{
          householdId: existingActiveHouseholdId,
          role: membershipSnap.data().role ?? "member",
          name: householdData.name ?? `Inventory ${existingActiveHouseholdId.slice(0, 6)}`
        }];
      }
    }

    if (!memberships.length) {
      const householdId = await createPersonalHousehold(user);
      memberships = [{
        householdId,
        role: "owner",
        name: user?.displayName ? `${user.displayName}'s Inventory` : `${user?.email ?? "My"} Inventory`
      }];
    }
  }

  const userDocRef = doc(db, "users", user.uid);
  const userDocSnap = await getDoc(userDocRef);
  const userData = userDocSnap.data() ?? {};
  const membershipIds = new Set(memberships.map((entry) => entry.householdId));
  let activeHouseholdId = userData.activeHouseholdId;
  if (!activeHouseholdId || !membershipIds.has(activeHouseholdId)) {
    activeHouseholdId = memberships[0].householdId;
  }

  await setDoc(userDocRef, {
    email: user.email ?? "",
    displayName: user.displayName ?? "",
    activeHouseholdId
  }, { merge: true });

  state.memberships = memberships.sort((a, b) => a.name.localeCompare(b.name));
  state.activeHouseholdId = activeHouseholdId;
  state.activeHouseholdRole =
    state.memberships.find((entry) => entry.householdId === activeHouseholdId)?.role ?? "member";
  renderHouseholdSwitcher();
  renderSharingSection();
  subscribeToHouseholdMeta();
}

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
  if (elements.category.value !== "coin") {
    return;
  }
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

  if (isCoin) {
    setFormDefaults();
  } else {
    setBullionDefaults();
  }
}

function setBullionDefaults() {
  if (!elements.bullionPreset) return;
  const preset = elements.bullionPreset.value;
  const grams = BULLION_PRESETS[preset] ?? 0;
  if (preset === "Custom") {
    return;
  }
  elements.grams.value = grams;
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

  const bullionTotals = {
    gold: 0,
    silver: 0,
    platinum: 0
  };
  const coinCounts = new Map();

  state.items.forEach((item) => {
    const totalGrams = item.gramsPerItem * item.quantity;
    if (item.category === "bullion") {
      bullionTotals[item.metal] += totalGrams;
    } else if (item.category === "coin") {
      const itemTypeLabel =
        item.metal === "gold"
          ? item.itemType.replace(/\s*\([^)]*\)\s*$/, "")
          : item.itemType;
      const label = `${item.metal} ${itemTypeLabel}`;
      const current = coinCounts.get(label) ?? 0;
      coinCounts.set(label, current + item.quantity);
    }
  });

  const bullionOzTotal =
    (bullionTotals.gold + bullionTotals.silver + bullionTotals.platinum) / TROY_OUNCE_G;
  if (elements.summaryBullionOz) {
    elements.summaryBullionOz.textContent = formatNumber(bullionOzTotal);
  }
  if (elements.summaryBullionGoldOz) {
    elements.summaryBullionGoldOz.textContent = formatNumber(bullionTotals.gold / TROY_OUNCE_G);
  }
  if (elements.summaryBullionSilverOz) {
    elements.summaryBullionSilverOz.textContent = formatNumber(bullionTotals.silver / TROY_OUNCE_G);
  }
  if (elements.summaryBullionPlatinumOz) {
    elements.summaryBullionPlatinumOz.textContent = formatNumber(bullionTotals.platinum / TROY_OUNCE_G);
  }

  if (elements.summaryCoinList) {
    if (!coinCounts.size) {
      elements.summaryCoinList.textContent = "No coins yet.";
    } else {
      const items = Array.from(coinCounts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
      elements.summaryCoinList.innerHTML = items
        .map(([label, count]) => `<div>${label}: <strong>${count}</strong></div>`)
        .join("");
    }
  }
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
  renderItems();
  calculateTotals();
}

function renderItems() {
  const visibleItems = state.filteredItems.length ? state.filteredItems : state.items;
  elements.itemCount.textContent = `${visibleItems.length} items`;

  if (!visibleItems.length) {
    elements.itemsContainer.innerHTML = '<div class="text-muted">No items yet.</div>';
    calculateTotals();
    return;
  }

  const groups = new Map();
  visibleItems.forEach((item) => {
    const labelCategory = item.category === "bullion" ? "Bullion" : "Coin";
    if (!groups.has(labelCategory)) {
      groups.set(labelCategory, []);
    }
    groups.get(labelCategory).push(item);
  });

  const accordionItems = Array.from(groups.entries()).map(([categoryLabel, categoryItems], idx) => {
    const totalQty = categoryItems.reduce((sum, item) => sum + item.quantity, 0);
    const totalGrams = categoryItems.reduce((sum, item) => sum + item.gramsPerItem * item.quantity, 0);
    const totalValue = categoryItems.reduce((sum, item) => {
      const itemPricePerGram = getPricePerGram(item.metal);
      if (!itemPricePerGram) return sum;
      return sum + item.gramsPerItem * item.quantity * itemPricePerGram;
    }, 0);

    const metals = new Map();
    categoryItems.forEach((item) => {
      if (!metals.has(item.metal)) {
        metals.set(item.metal, []);
      }
      metals.get(item.metal).push(item);
    });

    const metalSections = Array.from(metals.entries()).map(([metal, items], metalIdx) => {
      const metalQty = items.reduce((sum, item) => sum + item.quantity, 0);
      const metalGrams = items.reduce((sum, item) => sum + item.gramsPerItem * item.quantity, 0);
      const metalValue = items.reduce((sum, item) => {
        const itemPricePerGram = getPricePerGram(item.metal);
        if (!itemPricePerGram) return sum;
        return sum + item.gramsPerItem * item.quantity * itemPricePerGram;
      }, 0);

      const rows = items.map((item) => {
        const rowTotalGrams = item.gramsPerItem * item.quantity;
        const rowPricePerGram = getPricePerGram(item.metal);
        const rowValue = rowPricePerGram ? rowTotalGrams * rowPricePerGram : null;
        const isEditing = state.editingId === item.id;

      if (isEditing) {
        let itemTypeField = `<input class="form-control form-control-sm" data-field="itemType" value="${item.itemType ?? ""}">`;
        if (item.category === "coin") {
          const { gramsMap } = getCoinConfigForMetal(item.metal);
          const options = Object.keys(gramsMap)
            .map((name) => {
              const selected = name === item.itemType ? " selected" : "";
              return `<option value="${name}"${selected}>${name}</option>`;
            })
            .join("");
          itemTypeField = `<select class="form-select form-select-sm" data-field="itemType">${options}</select>`;
        }

        return `
          <tr>
            <td class="text-capitalize">${item.metal}</td>
            <td>${itemTypeField}</td>
            <td><input class="form-control form-control-sm" data-field="year" type="number" min="1700" max="2100" value="${item.year ?? ""}"></td>
            <td><input class="form-control form-control-sm" data-field="gramsPerItem" type="number" step="0.0001" min="0" value="${item.gramsPerItem}"></td>
            <td><input class="form-control form-control-sm" data-field="quantity" type="number" step="1" min="1" value="${item.quantity}"></td>
            <td>${formatNumber(rowTotalGrams)}</td>
            <td>${formatCurrency(rowValue)}</td>
            <td class="text-end">
              <button class="btn btn-sm btn-primary" data-action="save" data-id="${item.id}">Save</button>
              <button class="btn btn-sm btn-outline-secondary ms-1" data-action="cancel" data-id="${item.id}">Cancel</button>
            </td>
          </tr>
        `;
      }

      return `
        <tr>
          <td class="text-capitalize">${item.metal}</td>
          <td>${item.itemType}</td>
          <td>${item.year ?? "-"}</td>
          <td>${formatNumber(item.gramsPerItem)}</td>
          <td>${item.quantity}</td>
          <td>${formatNumber(rowTotalGrams)}</td>
          <td>${formatCurrency(rowValue)}</td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-primary" data-action="edit" data-id="${item.id}">Edit</button>
            <button class="btn btn-sm btn-outline-danger ms-1" data-action="delete" data-id="${item.id}">Delete</button>
          </td>
        </tr>
      `;
    });

      return `
        <div class="accordion-item">
          <h2 class="accordion-header" id="heading-${idx}-${metalIdx}">
            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-${idx}-${metalIdx}" aria-expanded="false" aria-controls="collapse-${idx}-${metalIdx}">
              <div class="w-100 d-flex flex-wrap justify-content-between align-items-center gap-2">
                <span class="fw-semibold text-capitalize">${metal}</span>
                <span class="small text-muted">Qty: ${metalQty} • Grams: ${formatNumber(metalGrams)} • Value: ${formatCurrency(metalValue)}</span>
              </div>
            </button>
          </h2>
          <div id="collapse-${idx}-${metalIdx}" class="accordion-collapse collapse" aria-labelledby="heading-${idx}-${metalIdx}">
            <div class="accordion-body p-0">
              <div class="table-responsive">
                <table class="table table-sm align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Metal</th>
                      <th>Type</th>
                      <th>Year</th>
                      <th>Grams</th>
                      <th>Qty</th>
                      <th>Total Grams</th>
                      <th>Value</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    ${rows.join("")}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      `;
    });

    return `
      <div class="accordion-item">
        <h2 class="accordion-header" id="heading-${idx}">
          <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-${idx}" aria-expanded="false" aria-controls="collapse-${idx}">
            <div class="w-100 d-flex flex-wrap justify-content-between align-items-center gap-2">
              <span class="fw-semibold text-capitalize">${categoryLabel}</span>
              <span class="small text-muted">Qty: ${totalQty} • Grams: ${formatNumber(totalGrams)} • Value: ${formatCurrency(totalValue)}</span>
            </div>
          </button>
        </h2>
        <div id="collapse-${idx}" class="accordion-collapse collapse" aria-labelledby="heading-${idx}">
          <div class="accordion-body p-0">
            <div class="accordion border-0">
              ${metalSections.join("")}
            </div>
          </div>
        </div>
      </div>
    `;
  });

  elements.itemsContainer.innerHTML = accordionItems.join("");

  elements.itemsContainer.querySelectorAll("button[data-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = button.getAttribute("data-id");
      if (!state.user) return;
      const action = button.getAttribute("data-action");
      if (action === "edit") {
        state.editingId = id;
        renderItems();
        return;
      }
      if (action === "cancel") {
        state.editingId = null;
        renderItems();
        return;
      }
      if (action === "save") {
        const row = button.closest("tr");
        if (!row) return;
        const existing = state.items.find((entry) => entry.id === id);
        if (!existing) return;
        const fields = row.querySelectorAll("[data-field]");
        const updates = {};
        fields.forEach((field) => {
          const key = field.getAttribute("data-field");
          let value = field.value;
          if (key === "year") {
            value = value ? Number(value) : existing.year ?? null;
          }
          if (key === "gramsPerItem" || key === "quantity") {
            value = value ? Number(value) : existing[key];
          }
          if (key === "itemType") {
            value = value ? value.trim() : existing.itemType;
          }
          updates[key] = value;
        });
        if (existing.category === "coin") {
          const { gramsMap } = getCoinConfigForMetal(existing.metal);
          if (updates.itemType in gramsMap) {
            updates.gramsPerItem = gramsMap[updates.itemType];
          }
        }
        if (!updates.itemType || updates.gramsPerItem <= 0 || updates.quantity <= 0) {
          return;
        }
        try {
          const itemDocRef = getItemDocRef(id);
          if (!itemDocRef) return;
          await updateDoc(itemDocRef, updates);
        } catch (error) {
          console.error("Failed to save item", error);
          alert("Save failed. Please try again.");
        } finally {
          state.editingId = null;
          renderItems();
        }
        return;
      }
      if (action === "delete") {
        const itemDocRef = getItemDocRef(id);
        if (!itemDocRef) return;
        await deleteDoc(itemDocRef);
      }
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
  if (!state.useLegacyMode && !state.activeHouseholdId) return;
  const itemsRef = getItemsCollectionRef();
  if (!itemsRef) return;
  const itemsQuery = query(
    itemsRef,
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

  const currentMetal = elements.metal.value;
  const currentCategory = elements.category.value;
  const currentCoinType = elements.coinType.value;
  const currentBullionPreset = elements.bullionPreset?.value ?? "";

  const category = elements.category.value;
  let itemType = category === "coin" ? elements.coinType.value : elements.bullionName.value.trim();
  const gramsPerItem = Number(elements.grams.value);
  const quantity = Number(elements.quantity.value);
  const yearValue = elements.year.value ? Number(elements.year.value) : null;

  if (category === "bullion" && elements.bullionPreset?.value && !itemType) {
    itemType = elements.bullionPreset.value;
  }

  if (!itemType || gramsPerItem <= 0 || quantity <= 0) {
    return;
  }

  const itemsRef = getItemsCollectionRef();
  if (!itemsRef) return;
  await addDoc(itemsRef, {
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
  elements.metal.value = currentMetal;
  elements.category.value = currentCategory;
  if (elements.bullionPreset && currentBullionPreset) {
    elements.bullionPreset.value = currentBullionPreset;
  }
  if (currentCategory === "coin") {
    populateCoinOptions();
    elements.coinType.value = currentCoinType;
  }
  toggleCategoryFields();
  if (currentCategory === "coin") {
    setFormDefaults();
  } else {
    setBullionDefaults();
  }
  updateCategoryLabel();
}

function bindEvents() {
  const doSignIn = async () => {
    const provider = new GoogleAuthProvider();

    if (isIosInAppBrowser()) {
      alert("Google sign-in is blocked in this in-app browser. Open this link in Safari or Chrome, then sign in.");
      return;
    }

    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      if (error?.code === "auth/popup-blocked" || error?.code === "auth/popup-closed-by-user") {
        await signInWithRedirect(auth, provider);
        return;
      }
      if (error?.code === "auth/operation-not-supported-in-this-environment") {
        alert("Google sign-in is not supported in this browser. Open this link in Safari or Chrome and try again.");
        return;
      }
      throw error;
    }
  };

  elements.signInBtn.addEventListener("click", doSignIn);

  elements.signOutBtn.addEventListener("click", async () => {
    await signOut(auth);
  });

  elements.householdSelect?.addEventListener("change", async () => {
    if (!state.user) return;
    const nextHouseholdId = elements.householdSelect.value;
    if (!nextHouseholdId || nextHouseholdId === state.activeHouseholdId) return;
    state.activeHouseholdId = nextHouseholdId;
    state.activeHouseholdRole =
      state.memberships.find((entry) => entry.householdId === nextHouseholdId)?.role ?? "member";
    await setDoc(doc(db, "users", state.user.uid), { activeHouseholdId: nextHouseholdId }, { merge: true });
    renderHouseholdSwitcher();
    renderSharingSection();
    subscribeToHouseholdMeta();
    if (unsubscribeItems) unsubscribeItems();
    subscribeToItems();
  });

  elements.shareForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.user || !state.activeHouseholdId) return;
    if (state.activeHouseholdRole !== "owner") return;

    const invitedEmail = elements.inviteEmail.value.trim();
    const invitedEmailLower = normalizeEmail(invitedEmail);
    const myEmailLower = normalizeEmail(state.user.email);

    if (!invitedEmailLower || !invitedEmail.includes("@")) {
      elements.shareStatus.textContent = "Enter a valid email address.";
      return;
    }
    if (invitedEmailLower === myEmailLower) {
      elements.shareStatus.textContent = "You are already a member.";
      return;
    }

    const existingInviteQuery = query(
      collection(db, "households", state.activeHouseholdId, "invites"),
      where("invitedEmailLower", "==", invitedEmailLower)
    );
    const existingInvites = await getDocs(existingInviteQuery);
    const hasPendingInvite = existingInvites.docs.some((docSnap) => docSnap.data().status === "pending");
    if (hasPendingInvite) {
      elements.shareStatus.textContent = "That invite is already pending.";
      return;
    }

    await addDoc(collection(db, "households", state.activeHouseholdId, "invites"), {
      invitedEmail,
      invitedEmailLower,
      invitedByUid: state.user.uid,
      invitedByEmail: state.user.email ?? "",
      status: "pending",
      createdAt: serverTimestamp()
    });

    elements.inviteEmail.value = "";
    elements.shareStatus.textContent = `Invite sent to ${invitedEmail}. They can sign in with Google to join.`;
  });

  elements.refreshPricesBtn.addEventListener("click", fetchSpotPrices);
  elements.category.addEventListener("change", toggleCategoryFields);
  elements.coinType.addEventListener("change", setFormDefaults);
  elements.bullionPreset.addEventListener("change", setBullionDefaults);
  elements.bullionPreset.addEventListener("input", setBullionDefaults);
  elements.metal.addEventListener("change", () => {
    updateCategoryLabel();
    populateCoinOptions();
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
  if (unsubscribeMembers) {
    unsubscribeMembers();
    unsubscribeMembers = null;
  }
  if (unsubscribeInvites) {
    unsubscribeInvites();
    unsubscribeInvites = null;
  }
  state.user = user;
  const isAuthed = Boolean(user);

  elements.signInBtn.classList.toggle("d-none", isAuthed);
  elements.signOutBtn.classList.toggle("d-none", !isAuthed);
  elements.userEmail.textContent = user?.email ?? "";
  document.body.classList.toggle("authed", isAuthed);
  elements.inventorySection.classList.toggle("d-none", !isAuthed);

  if (isAuthed) {
    state.useLegacyMode = false;
    initializeUserContext(user)
      .then(() => {
        subscribeToItems();
      })
      .catch((error) => {
        console.error("Failed to initialize user context", error);
        // Never block login on shared-init problems; fall back to legacy items mode.
        state.useLegacyMode = true;
        state.activeHouseholdId = null;
        state.activeHouseholdRole = null;
        state.memberships = [];
        renderHouseholdSwitcher();
        renderSharingSection();
        subscribeToItems();
      });
  } else {
    state.items = [];
    state.filteredItems = [];
    state.useLegacyMode = false;
    state.activeHouseholdId = null;
    state.activeHouseholdRole = null;
    state.memberships = [];
    if (elements.householdSelect) {
      elements.householdSelect.classList.add("d-none");
      elements.householdSelect.innerHTML = "";
    }
    if (elements.sharingSection) {
      elements.sharingSection.classList.add("d-none");
    }
    renderItems();
  }
});

populateCoinOptions();
updateCategoryLabel();
setFormDefaults();
toggleCategoryFields();
setBullionDefaults();
bindEvents();
fetchSpotPrices();

if (elements.versionNumber) {
  elements.versionNumber.textContent = APP_VERSION;
}
