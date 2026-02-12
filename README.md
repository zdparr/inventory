# inventory
Personal inventory tracking for precious metals

## Setup (Firebase)
1. Create a Firebase project.
2. Enable Google sign-in in Firebase Authentication.
3. Create a Firestore database in production or test mode.
4. Add a Web App in the Firebase console and paste its config into `firebase-config.js`.
5. Deploy with Firebase Hosting or use the GitHub integration for Firebase Hosting.

## Firestore Security Rules (recommended)
Use rules that support shared households with invitations:

```txt
rules_version = "2";
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() {
      return request.auth != null;
    }

    function isHouseholdMember(householdId) {
      return isSignedIn()
        && exists(/databases/$(database)/documents/households/$(householdId)/members/$(request.auth.uid));
    }

    function isHouseholdOwner(householdId) {
      return isHouseholdMember(householdId)
        && get(/databases/$(database)/documents/households/$(householdId)/members/$(request.auth.uid)).data.role == "owner";
    }

    match /users/{userId} {
      allow read, write: if isSignedIn() && request.auth.uid == userId;
    }

    match /users/{userId}/items/{itemId} {
      allow read, write: if isSignedIn() && request.auth.uid == userId;
    }

    match /households/{householdId} {
      allow read: if isHouseholdMember(householdId);
      allow create: if isSignedIn();
      allow update, delete: if isHouseholdOwner(householdId);
    }

    match /households/{householdId}/items/{itemId} {
      allow read, write: if isHouseholdMember(householdId);
    }

    match /households/{householdId}/members/{memberId} {
      allow read: if isHouseholdMember(householdId);
      allow create, update: if isHouseholdOwner(householdId) || (isSignedIn() && request.auth.uid == memberId);
      allow delete: if isHouseholdOwner(householdId);
    }

    match /households/{householdId}/invites/{inviteId} {
      allow read: if isHouseholdMember(householdId) || (
        isSignedIn()
        && request.auth.token.email != null
        && lower(request.auth.token.email) == resource.data.invitedEmailLower
      );
      allow create: if isHouseholdOwner(householdId);
      allow update: if isHouseholdOwner(householdId) || (
        isSignedIn()
        && request.auth.token.email != null
        && lower(request.auth.token.email) == resource.data.invitedEmailLower
      );
      allow delete: if isHouseholdOwner(householdId);
    }
  }
}
```

## Spot Price API
Configured endpoints:
- Gold: https://api.gold-api.com/price/XAU
- Silver: https://api.gold-api.com/price/XAG
- Platinum: https://api.gold-api.com/price/XPT
