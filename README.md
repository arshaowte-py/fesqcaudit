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

- **To:** `saiyed.a@myfrido.com`
- **CC:** `yogesh.t@myfrido.com`, `mehak.g@myfrido.com`, `nishrit.p@myfrido.com`, `Siddhant.n@myfrido.com`

Override with `QC_AUDIT_EMAIL_TO` and `QC_AUDIT_EMAIL_CC` (comma-separated).

## Build

```bash
npm run build
```

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
