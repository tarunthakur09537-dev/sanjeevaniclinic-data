# Sanjeevani Data Entry

This workspace is configured for:
- local development on Windows, macOS, and Linux
- Vercel deployment with a static frontend and a serverless API

## Environment variables

Create a local `.env` file from `.env.example` and set:

- `AIRTABLE_API_KEY`
- `AIRTABLE_BASE_ID`

`AIRTABLE_BASE_ID` should look like `appXXXXXXXXXXXXXX`.

## Run locally

Install dependencies:

```bash
pnpm install
```

Start the frontend and API together:

```bash
pnpm dev
```

Local URLs:

- frontend: `http://localhost:5173`
- API health check: `http://localhost:5173/api/healthz`

The Vite dev server proxies `/api/*` requests to the local API server on port `3000`, so the app works locally without changing frontend API URLs.

## Build locally

```bash
pnpm build
```

You can also run only one side when needed:

```bash
pnpm dev:web
pnpm dev:api
```

## Deploy to Vercel

1. Push the repo to GitHub.
2. Import the repository into Vercel.
3. Keep the project root at the repository root.
4. Add `AIRTABLE_API_KEY` and `AIRTABLE_BASE_ID` in Vercel Project Settings.
5. Deploy. `vercel.json` already configures:
   - `pnpm install --frozen-lockfile`
   - `pnpm --filter @workspace/sanjeevani-clinic run build`
   - `apps/sanjeevani-clinic/dist` as the static output directory
   - `/api/*` rewrites to `api/index.ts`

## Post-deploy checks

- Open `/` and verify the login/dashboard loads.
- Open `/api/healthz` and confirm it returns `{ "status": "ok" }`.
- Add a patient and confirm the Airtable record is created.
