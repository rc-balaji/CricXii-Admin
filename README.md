# CricXii Admin Console

The dashboard opens without a sign-in screen. Player profiles are publicly
readable through the dashboard API, while profile edits and archive/restore
actions require a server-only confirmation key on every request. The API only
returns allowlisted profile data; account emails, contact details, password
credentials, and audit logs are not exposed to public readers.

## Run locally

1. Copy `.env.example` to `.env.local`. The local `.env.local` is ignored by
   git.
2. Configure Firebase Admin credentials for the `crixx-59eca` project. Either
   use Google Application Default Credentials:

   ```bash
   gcloud auth application-default login
   ```

   or set `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and
   `FIREBASE_PRIVATE_KEY` using a Firebase service account. Never commit or
   share the service-account private key.
3. Set `SECRET_KEY` in `.env.local` (or set `ADMIN_WRITE_CONFIRMATION_KEY` as
   an override) to the server-side update key. The value must be at least
   8 characters; use a strong random value of at least 32 bytes. Do not put
   this key in `NEXT_PUBLIC_*`, browser code, or source control.
4. Install dependencies and start the app:

   ```bash
   npm install
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000). Reads work once Firebase
Admin credentials are configured; writes remain disabled until the server
confirmation key is configured.

## Features and data access

- Search Firestore profiles by name prefix or player ID, and filter by active
  or archived status.
- View allowlisted public profile fields and read-only career statistics.
- Edit approved profile fields and archive/restore profiles with a reason and
  an optimistic `updatedAt` precondition.
- Require the confirmation key on each write; compare it on the server using
  a timing-safe comparison and enforce same-origin requests.
- Record profile mutations in the private `adminAuditLogs` collection. There
  is no public audit-log endpoint.

The browser never connects to Firestore directly. Firebase Admin SDK
credentials must be configured on the server for live data. Permanent deletion
and private contact reveal are intentionally unavailable.

## Environment settings

- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY`
  are server-only Firebase Admin settings. Application Default Credentials
  may be used instead of the service-account email and private key.
- `ADMIN_WRITE_CONFIRMATION_KEY` overrides `SECRET_KEY` for write
  confirmation. Otherwise, `SECRET_KEY` is used. Configure the selected
  server-only variable locally and in the Vercel Preview/Production
  environment; use a strong random value of at least 32 bytes.
- Never put service-account credentials or the write key in a
  `NEXT_PUBLIC_*` variable. Use a staging Firebase project for Preview.

The service account should have least-privileged access to `players` and
`adminAuditLogs`. Firebase Admin SDK bypasses Firestore security rules, so the
server API projections and field validation define what the dashboard can
read or change.
