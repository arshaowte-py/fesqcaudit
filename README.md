# Frido Store Audit — QC Visit Report

Unified Frido QC portal with:
- Audit form
- Dashboard analytics
- Response copies with photos

All views are served from `public/index.html`.

## Storage

The app supports two storage modes:

1. **Supabase Postgres (recommended for production)**
   - Uses `@supabase/supabase-js` with the service role key (server-only)
   - Run `supabase/schema.sql` once in the Supabase SQL Editor
2. **Local file fallback (development)**
   - Uses `data/audits.json` automatically when Supabase env vars are not set

## Local Development

```bash
npm install
npm run dev
```

Open: `http://localhost:3000/index.html`  
(or the next available port if 3000 is in use)

## Environment Variables

Create `.env.local` from `.env.example`.

### For production on Vercel (Supabase)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SERVICE_SECRET_ROLE_KEY`)

If these are missing, local file storage is used.

### Audit notification email (Microsoft Graph)

After each audit is saved, the app can email a **full response copy** plus a **NO & SKIP** summary to the QC distribution list.

Set in `.env.local` / Vercel:

- `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` — from the **Frido Invite** app registration
- `GRAPH_SENDER_UPN` — sending mailbox (e.g. `yourstruly@myfrido.com`)
- Azure: Microsoft Graph **Application** permission `Mail.Send` with **admin consent**

Default recipients:

- **To:** `yogesh.t@myfrido.com`, `mehak.g@myfrido.com`, `nishrit.p@myfrido.com`, `Siddhant.n@myfrido.com`, `Vaibhav.j@myfrido.com`, `Mayur.k@myfrido.com`, `arsh.a@myfrido.com`
- **CC:** `saiyed.a@myfrido.com`

Override with `QC_AUDIT_EMAIL_TO` and `QC_AUDIT_EMAIL_CC` (comma-separated).

## Build

```bash
npm run build
```

## Public production URL (share with your team)

**Use this link for everyone** (no Vercel account required):

**https://frido-qc-audit.vercel.app**

Do **not** share long preview URLs like `frido-qc-audit-xxxxx-ritwiks-projects.vercel.app` — those often require Vercel login when **Deployment Protection** is enabled.

### If features look old (no collapsible dashboard / no email)

1. **Undo rollback** — Vercel → **Deployments** → find the rolled-back entry → **Undo Rollback**,  
   **or** open the latest deployment (commit `Add section-level collapsible groups…`) → **⋯** → **Promote to Production**.
2. Confirm **Production** domain `frido-qc-audit.vercel.app` points at that deployment (Domains tab on the deployment).
3. Hard-refresh the browser (`Cmd+Shift+R`) or test in an incognito window.

### Let anyone open the app (no Vercel login)

Vercel → **Project** → **Settings** → **Deployment Protection**:

- Set **Production** to **not** require Vercel Authentication (or “Standard Protection” only for previews).
- Keep protection on **Preview** deployments if you want; only **Production** needs to be public.

### Email on audit submit

Production must have Graph + Supabase env vars under **Settings → Environment Variables** (Production). Redeploy after changing env vars.

## CI/CD

GitHub Actions workflows included:

- `ci.yml`  
  - Runs on PRs and pushes to `main`
  - Installs dependencies and runs `npm run build`

- `cd-vercel.yml`  
  - Runs on push to `main`
  - Builds and deploys to Vercel production

Required GitHub secrets for CD:
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

## Main paths

- `public/index.html` — unified app shell
- `public/assets/audit-form.js` — form logic
- `public/assets/dashboard.js` — dashboard logic
- `public/assets/responses.js` — response copies logic
- `lib/audit-store.js` — storage abstraction (Supabase + file fallback)
# fesqcaudit
