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
npm run smoke -- https://<site>.web.app   # post-deploy checks against the live site
```

## Deploying

**Merge to `main` deploys to production automatically.** There is no staging
environment — this is an internal tool and that trade-off is deliberate.

| Trigger | Workflow | What happens |
|---|---|---|
| Pull request | `ci.yml` | tests + build. No deploy. |
| Merge / push to `main` | `deploy.yml` | tests → deploy → **smoke check the live site** |
| Actions tab → "Deploy to Firebase" → Run workflow | `deploy.yml` | redeploy without a code change |

The smoke check is the important part. A Firebase deploy can report complete
success while the site is broken — that has already happened twice here (a
cleanup-policy failure that silently skipped the hosting release, and a CSP
that left the login page rendering perfectly but completely inert). `npm run
smoke` asserts against the **live URL** that the app hydrates and that every
API still rejects anonymous callers, and it fails the run if not.

### If a deploy goes red

The final step prints what to do. In short:

- **Tests failed** — nothing was deployed. Fix and merge again.
- **Deploy failed** — production is likely still on the previous version.
  Re-run the workflow from the Actions tab.
- **Smoke failed** — the deploy worked but the live site is unhealthy. The
  failing check names the problem. **Revert the merge on `main`**; the revert
  is itself a push to main, so it redeploys the last good version.

There is no automatic rollback. Reverting the merge is the rollback, and for a
tool this size that is simpler to reason about than machinery that tries to
undo a half-finished deploy on its own.

### Running it by hand

`npm run deploy` still works from a laptop and does the same thing, minus the
smoke check — run `npm run smoke` after.

### One-time setup

CI authenticates with **Workload Identity Federation**, so there is no
long-lived service account key stored in GitHub. GitHub mints a short-lived
OIDC token and Google exchanges it, and only this repository is allowed to make
that exchange.

Two GitHub Actions **variables** (Settings → Secrets and variables → Actions →
Variables) point at it. They are variables rather than secrets because neither
value is sensitive — and keeping them out of the committed workflow is what
stops a project id from landing in the repo:

- `WIF_PROVIDER` — `projects/<PROJECT_NUMBER>/locations/global/workloadIdentityPools/github/providers/github-oidc`
- `DEPLOY_SA` — `github-deployer@<PROJECT_ID>.iam.gserviceaccount.com`

The deployer service account holds only what a deploy needs:
`firebase.admin`, `cloudfunctions.admin`, `run.admin`, `iam.serviceAccountUser`,
`cloudbuild.builds.editor`, `artifactregistry.writer`, `storage.objectAdmin`,
`serviceusage.serviceUsageAdmin`, plus `secretmanager.admin` scoped to the two
OTPless secrets only.

`serviceUsageAdmin` is there because firebase-tools enables the APIs it needs
on every deploy — the first CI run failed on `Permissions denied enabling
cloudbilling.googleapis.com`. It is not a meaningful escalation: the account
already has `cloudfunctions.admin` and `run.admin`, so it can deploy arbitrary
code regardless. Without it, any future API requirement dead-ends the
pipeline with an error nobody but a GCP admin can clear.

To tighten deploys to the `main` branch alone, change the provider's attribute
condition to also require
`assertion.ref == 'refs/heads/main'`.

### Recommended: protect `main`

Not configured, because it needs repo admin. Settings → Branches → add a rule
for `main` requiring the **CI** check to pass before merging. Without it a
direct push to `main` deploys straight to production with no review.

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

**Any `@myfrido.com` address can sign in. There is no approval step and no
pre-registration** — proving you receive mail at the address *is* the
authorisation.

The account document is created on **first successful sign-in**, not when a
code is requested. That ordering is deliberate: creating on request would let
anyone spray invented addresses and fill the collection with accounts nobody
controls. Creating on verification means a document only appears for a mailbox
someone has demonstrated access to.

`scripts/seed-user.mjs` is still how you grant privileges or revoke access:

```bash
npm run seed:user -- someone@myfrido.com --can-delete # allow deleting audits
npm run seed:user -- someone@myfrido.com --disable    # revoke access (offboarding)
npm run seed:user -- someone@myfrido.com --enable     # restore
npm run seed:user -- --list
```

`disabled: true` is the one remaining gate — use it when someone leaves but
their mailbox still exists. Deletion stays opt-in (`canDelete`), so a
self-provisioned account can read and submit audits but not delete them.

## Auth design notes

- **Cookie must be named `__session`.** Firebase Hosting strips every other
  cookie, and this is not configurable. Any other name works locally and
  against Cloud Run directly, then fails only through Hosting.
- Sessions store the **SHA-256 of the token** as the document id; the token
  itself is never persisted. `HttpOnly`, `Secure`, `SameSite=Strict`, 12h.
- Access is domain-based, so there is no membership secret to protect and no
  identical-response or timing-equalisation machinery. Anyone who controls an
  `@myfrido.com` mailbox is authorised by definition.
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
| Login page renders but the button never enables | A static `script-src 'self'` blocks Next's inline hydration scripts, so React never attaches any handler | CSP is built per request in `middleware.js` with a nonce Next stamps onto its own scripts |
| Requests hang to 60s then 502 | Runtime SA lacks Firestore/Storage access | `roles/datastore.user` + `roles/storage.objectAdmin` |
| Second route throws "already been initialized" | Next bundles routes separately, so a module-level cache is per-bundle | Admin SDK handles cached on `globalThis` |
| Images bill forever | No Artifact Registry cleanup policy | Policy set to delete images older than 3 days |
| Deploy rejected for a reserved env var | `FIREBASE_` is a reserved prefix | The bucket var is `STORAGE_BUCKET` |

The hydration one deserves emphasis: it is invisible to HTTP-level checks.
`/login` returns 200, the HTML is valid and the security headers are all
correct — the page is simply inert. `npm run smoke` catches it by asserting
every inline `<script>` carries a nonce. Do not use `'strict-dynamic'`: it
makes browsers ignore `'self'`, and the shell at `/` loads `/assets/*.js` with
plain `<script src>` tags that no nonced script pulls in.

Note: a failure to set the cleanup policy **aborts the Hosting release** even
though functions deployed fine — the site then serves "Site Not Found" while
the deploy log looks almost successful.

## Audit notification emails

The app sends no email itself. `notifyAuditSubmitted` / `notifyAuditDeleted`
append a document to the **`mail`** collection and the Firebase **Trigger Email
from Firestore** extension delivers it, writing the result back onto the same
document under `delivery`.

No mail vendor appears anywhere in application code, so switching provider is
an extension config change rather than a code change. Delivery is also off the
request path — the old Microsoft Graph call ran inside the submit request, so a
slow mail API delayed the auditor's response.

This replaced Microsoft Graph, which needed an Azure app registration,
`Mail.Send` application permission, admin consent, and four environment
variables. None of that exists any more.

### Setting up delivery (one time)

1. Create a **Resend** account and add **`notifications.myfrido.com`** (or
   another subdomain) as a sending domain.

   Use a **subdomain, never the root**. The root `myfrido.com` SPF record
   points at Microsoft 365 for all company email; editing it incorrectly breaks
   company-wide mail delivery. A subdomain is a separate namespace and cannot
   affect existing mail flow.

2. Add the DNS records Resend shows you (an SPF TXT and a DKIM TXT).

   These are not optional. SMTP carries no proof of sender identity, so without
   them a receiving server cannot tell authorised mail from spoofed mail. It
   matters more here than usual: sender and recipients are both `@myfrido.com`,
   and unauthenticated same-domain mail is the classic phishing pattern —
   Microsoft 365 will quarantine or reject it rather than merely junk it. Graph
   needed no DNS because it sent from inside the tenant, where mail is
   authenticated by definition. These records are that trust, re-established
   outside Microsoft.

3. Install the extension:

   ```bash
   firebase ext:install firebase/firestore-send-email \
     --project "$(node scripts/firebase-project.mjs)"
   ```

   Configure it with: collection `mail`, region `asia-south1`, SMTP URI from
   Resend (`smtps://resend:<API_KEY>@smtp.resend.com:465`), and a default FROM
   on the subdomain you verified.

### If mail was queued before the extension existed

The extension triggers on document **creation**. Anything queued beforehand
sits in `mail` unsent and will not flush on its own. Re-writing a document
re-fires the trigger, so to send a backlog, touch the pending documents:

```js
// for each doc in `mail` with no `delivery` field
await doc.ref.update({ queuedAt: new Date().toISOString() });
```

### Checking on delivery

Each document carries `kind` (`audit-submitted` / `audit-deleted`), `context`
(store, visit date), and once processed a `delivery.state` of `SUCCESS` or
`ERROR` with the reason. A queue with no `delivery` fields at all means the
extension is not installed or not watching the `mail` collection.

