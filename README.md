# Frido Store Audit — QC Visit Report

Unified Frido QC portal with:
- Audit form
- Dashboard analytics
- Response copies with photos

All views are served from `public/index.html`.

## Storage

The app supports two storage modes:

1. **Vercel KV (recommended for production)**
   - Uses `@vercel/kv`
   - Persists data across deployments and serverless instances
2. **Local file fallback (development)**
   - Uses `data/audits.json` automatically when KV env vars are not set

## Local Development

```bash
npm install
npm run dev
```

Open: `http://localhost:3000/index.html`  
(or the next available port if 3000 is in use)

## Environment Variables

Create `.env.local` from `.env.example`.

### For production on Vercel (KV)
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`

If these are missing, local file storage is used.

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
- `lib/audit-store.js` — storage abstraction (KV + file fallback)
