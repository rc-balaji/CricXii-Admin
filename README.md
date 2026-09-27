# CricXii Admin Console

The console reads player records from the `crixx-59eca` Firestore project
through authenticated Next.js server APIs. The Firebase Web SDK is used only
for administrator sign-in; browser code never reads or writes Firestore.

## Run locally

1. Copy `.env.example` to `.env.local`. The local `.env.local` is ignored by
   git and contains the Firebase Web App config already provided for this
   project.
2. Configure Firebase Admin credentials locally. Either use Google
   Application Default Credentials:

   ```bash
   gcloud auth application-default login
   ```

   or fill `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` in `.env.local`
   using a Firebase service account from the `crixx-59eca` project. Never
   commit or share that private key.
3. Enable Google as a Firebase Authentication provider, enable TOTP MFA, and
   add the local development domain to Authorized domains.
4. Create the administrator identity in Firebase Authentication, then grant
   its custom claims out of band:

   ```bash
   npm run admin:grant -- rcbalaji2003@gmail.com operator
   ```

   This script uses the local Firebase Admin credentials and grants the
   specified account the requested role. Start with `operator`; grant `owner`
   only if audit-log access or owner-only operations are explicitly needed.
   The sign-in page prompts the authorized admin to enroll an authenticator
   before issuing an admin session. Set the same email in
   `ADMIN_ALLOWED_EMAILS`.
5. Start the app:

   ```bash
   npm install
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000) and sign in with the
separately provisioned administrator Google account. Player app credentials
are not administrator credentials.

## Connected features

- Search Firestore profiles by name prefix or player ID; exact email lookup is
  available to operator/owner roles only.
- View allowlisted profile fields and read-only Singles/team career stats.
- Edit only approved public fields and archive/restore with a reason and an
  optimistic `updatedAt` precondition.
- Record profile reads and mutations in `adminAuditLogs`; audit history is
  owner-only and read-only in the UI.
- The browser communicates only with `/api/admin/*`; server routes verify
  Firebase session cookies, administrator claims, role and MFA.

Permanent deletion and private contact reveal are intentionally not enabled.
The account email lookup never returns credential salt or verifier data.

## Environment settings

- `NEXT_PUBLIC_FIREBASE_*` are Firebase Web App settings and are exposed in the
  browser by design. Restrict the Firebase API key to the intended APIs and
  domains in Google Cloud Console.
- `FIREBASE_PROJECT_ID`, service-account email/private key, cookie settings,
  and administrator allowlist are server-only settings.
- `ADMIN_REQUIRE_MFA` defaults to `true`; set it to `false` only for isolated,
  non-production testing. Do not disable MFA in production.
- Configure the same server variables in Vercel Preview/Production; use a
  staging Firebase project for Preview.
- Never add the service-account private key to git, browser code, or a
  `NEXT_PUBLIC_` variable. The app cannot query live Firestore until valid
  server credentials and an administrator claim are configured.

## Firestore indexes and authorization setup

The Firestore service account must have least-privileged access to the
`players`, `loginCredentials` (exact document lookup only), and
`adminAuditLogs` collections. Firebase Admin SDK bypasses Firestore rules, so
all authorization is enforced by the API. Grant admin claims only through a
trusted administrative script or Firebase Admin SDK, never from this UI.

Name-prefix searches combined with archived status and filtered audit queries
may require Firestore composite indexes. If Firebase returns a missing-index
error, create the index suggested by the Firebase error for the queried fields.
