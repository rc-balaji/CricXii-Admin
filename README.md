# CricXii Admin Console

A responsive player-management preview for the CricXii admin experience.
The Firebase client app and Authentication SDK are initialized for the
`crixx-59eca` Firebase project. The dashboard still uses fictional sample data:
Firebase admin sign-in and production player APIs are not connected.

## Run locally

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and provide the Firebase Web App settings
from Firebase Console > Project settings > Your apps. The local `.env.local`
for the supplied project is already configured and ignored by git. Restart the
dev server after changing environment values.

Open [http://localhost:3000](http://localhost:3000).

## Preview features

- Search sample players by name, email, player ID or gang, and filter by active
  or archived status.
- Browse player profile details and read-only career stats.
- Edit allowlisted sample profile fields with a required reason.
- Archive and restore sample profiles with a required reason.
- Review the local sample audit log and export sample player data as CSV.
- Toggle **Save this preview on this device** to keep sample edits in this
  browser. **Reset sample data** restores the original examples.

Local save writes only fictional demo profiles and demo audit entries to
browser `localStorage`. It does not save credentials, tokens, or production
player data. The login details for CricXii player accounts are not admin
credentials and are not used by this console.

## Production integration required

Before connecting real player data, configure an independent Firebase
administrator identity and custom-claim role, exchange sign-in for a secure
server session, and implement authenticated same-origin admin APIs using the
Firebase Admin SDK. Enforce per-operation roles, audited reads and writes,
CSRF/origin checks, input validation, pagination, and optimistic concurrency
on the server. Keep service credentials server-only. Do not enable real profile
mutations or deletion from the browser-only preview.

`NEXT_PUBLIC_FIREBASE_*` values configure the Firebase Web SDK and are
intentionally available in the browser; they are not service-account
credentials. Never put a Firebase Admin private key or player password in a
`NEXT_PUBLIC_` variable or client code. A Firebase API key should still be
restricted to the intended project and APIs in Google Cloud Console.
