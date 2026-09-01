# Frido Store Audit — QC Portal

Next.js app on Firebase, in `asia-south1` (Mumbai) so compute, database and
photo storage all stay in India.

## Architecture

| Piece | What runs there |
|---|---|
| **Firebase Hosting** | Static assets from `public/` (CDN, `immutable`) |
| **`server` (gen-2 Cloud Function)** | The entire Next.js app. Hosting rewrites `**` to it |
| **Firestore** | Audits, users, sessions, OTP requests, throttle counters |
| **Cloud Storage** | Audit photos (`<project>-audit-photos`) |
| **Secret Manager** | OTPless credentials |

Sign-in is a 6-digit code emailed via OTPless. There are no passwords.

## Commands

```bash
npm run dev            # local dev server
npm test               # auth rules + route-guard coverage
npm run build          # production build
npm run deploy         # hosting + functions
npm run deploy:rules   # Firestore rules + indexes
npm run logs           # tail the server function
```

## The project id is never hardcoded

Several Firebase projects live under `~/work`, and the Firebase CLI resolves
its target from a machine-wide directory→project map in
`~/.config/configstore/firebase-tools.json` where **a parent-directory entry
beats this repo's `.firebaserc`**. On this machine `~/work` maps to a different
project, so a bare `firebase deploy` from here targets the wrong one.

Every script therefore passes the target explicitly:

```json
"deploy": "firebase --project \"$(node scripts/firebase-project.mjs)\" deploy --only hosting,functions"
```

`scripts/firebase-project.mjs` reads `.firebaserc` and prints the id.
`.firebaserc` is the **only** file that contains it — not `.env.example`, not
any template. At runtime the function derives the bucket name from the project
id the environment reports.

## Accounts

Requesting a code can never create an account: the sign-in path only ever reads
the `users` collection. Accounts are made out of band.

```bash
npm run seed:user -- someone@myfrido.com              # create
npm run seed:user -- someone@myfrido.com --can-delete # allow deleting audits
npm run seed:user -- someone@myfrido.com --disable    # revoke access
npm run seed:user -- --list
```

Sign-in requires **both** an `@myfrido.com` address and a `users` document.

## Auth design notes

- **Cookie must be named `__session`.** Firebase Hosting strips every other
  cookie, and this is not configurable. Any other name works locally and
  against Cloud Run directly, then fails only through Hosting.
- Sessions store the **SHA-256 of the token** as the document id; the token
  itself is never persisted. `HttpOnly`, `Secure`, `SameSite=Strict`, 12h.
- An unknown address gets a byte-identical response to a real one, padded to
  the same duration, or the endpoint becomes a staff directory.
- Only the OTPless `requestId` is stored, keyed by email as the **document
  id**, which makes "one live code per person" a property of the database.
  The code itself is never stored. 5 attempts, incremented transactionally.
- Throttling lives in Firestore, not memory — the function scales to many
  instances and a per-instance counter would cap nothing.
- Missing OTPless credentials **fail closed**. The dev console-code fallback
  refuses to run under `NODE_ENV=production` or on Cloud Functions, in both
  directions: it can neither issue nor redeem a `dev:` code there.
- Firestore rules **deny everything**. All access is server-side through the
  Admin SDK, which bypasses rules.
- The photo bucket has uniform bucket-level access and public access
  prevention enforced, with no `allUsers` binding. Clients never touch it;
  bytes are proxied through `/api/get-photos`.

## Why the shell lives in `shell/`, not `public/`

Hosting serves files from `public/` **before** it applies rewrites. An
`index.html` in `public/` would be handed to signed-out visitors straight off
the CDN and the session check would never run. Keeping it in `shell/` forces
every hit on `/` through the function. `test/route-guards.test.mjs` asserts
this stays true.

## Deployment gotchas

These all produce misleading status codes. Each is already handled in the repo;
listed so the next person recognises the symptom.

| Symptom | Cause | Fix (already applied) |
|---|---|---|
| Build fails at step 0, `gcs-fetcher` exit 3 | Build SA has no IAM roles | `roles/cloudbuild.builds.builder` on `<PROJECT_NUMBER>-compute@` |
| **403 on every URL** | No Cloud Run invoker binding | `invoker: 'public'` in `server.js` |
| **404 on every route** but `/_next/image` is 200 | The buildpack installs deps but does **not** run `npm run build` | `functions.predeploy` runs the build; `.next` ships, only `**/.next/cache/**` is ignored |
| ~30s cold start | `next.config.ts` makes Next `npm install typescript` on every cold start | Config is `next.config.js` |
| Every GET fine, **every POST a silent 504 at exactly 60s** | `onRequest` runs Express, whose body parser drains the stream into `req.rawBody`; Next then reads an exhausted stream | `withReplayedBody()` in `server.js` replays `rawBody` through a fresh `Readable` |
| Sign-in succeeds, then bounces to `/login` | Hosting strips every cookie except `__session` | Session cookie is named `__session` |
| Redirect sends the browser to `localhost:3000` | Behind Hosting, `request.url` is the function's internal listener | Redirects use a **relative** `Location` |
| Requests hang to 60s then 502 | Runtime SA lacks Firestore/Storage access | `roles/datastore.user` + `roles/storage.objectAdmin` |
| Second route throws "already been initialized" | Next bundles routes separately, so a module-level cache is per-bundle | Admin SDK handles cached on `globalThis` |
| Images bill forever | No Artifact Registry cleanup policy | Policy set to delete images older than 3 days |
| Deploy rejected for a reserved env var | `FIREBASE_` is a reserved prefix | The bucket var is `STORAGE_BUCKET` |

Note: a failure to set the cleanup policy **aborts the Hosting release** even
though functions deployed fine — the site then serves "Site Not Found" while
the deploy log looks almost successful.

## Not configured

Audit notification emails (Microsoft Graph) have no credentials in this
project, so `notifyAuditSubmitted` / `notifyAuditDeleted` log a warning and
skip. To enable, add the secrets and declare them in `server.js`:

```bash
firebase --project "$(node scripts/firebase-project.mjs)" functions:secrets:set AZURE_CLIENT_SECRET
```
