# inventory
Personal inventory tracking for precious metals

## Setup (Firebase)
1. Create a Firebase project.
2. Enable Google sign-in in Firebase Authentication.
3. Create a Firestore database in production or test mode.
4. Add a Web App in the Firebase console and paste its config into `firebase-config.js`.
5. Deploy with Firebase Hosting or use the GitHub integration for Firebase Hosting.

## Firestore Security Rules (recommended)
Use rules that restrict access to each user's data:

```txt
rules_version = "2";
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/items/{itemId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Spot Price API
Configured endpoints:
- Gold: https://api.gold-api.com/price/XAU
- Silver: https://api.gold-api.com/price/XAG
- Platinum: https://api.gold-api.com/price/XPT
