# BareBones Invoice


> Quickstart (10 lines max):
> 1. `corepack enable && pnpm install`
> 2. Copy `backend/.env.example` to `backend/.env` and `frontend/.env.example` to `frontend/.env`
> 3. `cd backend && pnpm prisma migrate dev`
> 4. `pnpm --filter backend prisma db seed`
> 5. In one terminal: `pnpm --filter backend dev`
> 6. In another: `pnpm --filter frontend dev`
> 7. Visit http://localhost:5173 (login demo: `demo@invoice.test` / `password123`)

BareBones Invoice is a production-minded, offline-first invoicing PWA that mirrors the essentials of Invoice2go without the bloat. It ships as a TypeScript full-stack using React 18 + Vite + Tailwind on the client and Fastify + Prisma + SQLite (default) on the server. The app is installable, supports background sync, produces tax-ready CSV/PDF exports, and can run entirely in Docker.

## Features

- ⚡️ Fast React 18 + Vite PWA with install support, Workbox precaching, background sync, and IndexedDB draft storage.
- 🧾 Invoice editing with line items, tax toggles (GST/QST/custom), discounts, shipping, payments, PDF download, and simulated email send.
- 👥 Client CRM with search, sort, and linking to invoices.
- 💵 Payment logging (cash/e-transfer/card/other) auto-updating balances and statuses.
- 📊 Tax & income reports with presets, CSV export (GST/QST columns) and PDF summaries via pdfmake.
- 🔐 JWT auth (email/password), Fastify schema validation, rate limits, and Prisma-backed persistence.
- 🧱 Offline drafts + cached lists via IndexedDB, with conflict copies tagged `(local copy)` when server wins.
- 📦 Dockerfile and docker-compose (API + optional Postgres) plus GitHub Actions CI for build/test.

## Project Structure

```
/frontend   # React + Vite PWA
/backend    # Fastify API + Prisma ORM
prisma/     # Database schema & migrations
```

## Environment setup

### Backend

1. Duplicate `backend/.env.example` → `backend/.env` and tweak as needed.
   - **SQLite default:** `DATABASE_PROVIDER="sqlite"`, `DATABASE_URL="file:./dev.db"`
   - **Switch to Postgres:** set `DATABASE_PROVIDER="postgresql"` and `DATABASE_URL="postgresql://user:pass@host:5432/db"`
2. Install deps and run migrations
   ```bash
   corepack enable
   pnpm install
   cd backend
   pnpm prisma migrate dev
   pnpm prisma db seed
   ```
3. Start the API with hot reload
   ```bash
   pnpm dev
   ```

### Frontend

1. Duplicate `frontend/.env.example` → `frontend/.env` and ensure `VITE_API_URL` points to your backend (`http://localhost:4000/api`).
2. In a new terminal, run the dev server:
   ```bash
   pnpm --filter frontend dev
   ```
3. The PWA is available at http://localhost:5173. Use Chrome/Edge to install it or test offline.

### Seed Data

The seed script provisions:
- `demo@invoice.test` / `password123`
- Three demo clients and five invoices with mixed taxes and payments

Run it via:
```bash
pnpm --filter backend prisma db seed
```

## Testing

Backend vitest suites cover invoice math and report summaries. Frontend relies on integration behaviour.

```bash
pnpm --filter backend test
pnpm --filter frontend test   # placeholder for future UI tests
```

## Build & Production

```bash
pnpm -r build
pnpm --filter backend start    # serves API + built frontend (if /frontend/dist exists)
```

### Docker

Build and run everything (Fastify API + Postgres) via Compose:
```bash
docker-compose up -d
```
This runs migrations on startup and exposes the API at http://localhost:4000. Switch back to SQLite by editing `docker-compose.yml` env vars to the SQLite values noted above.

### Standalone image

```bash
docker build -t barebones-invoice .
docker run --env-file backend/.env -p 4000:4000 barebones-invoice
```

## Scripts Reference

| Target | Command |
| ------ | ------- |
| Backend dev | `pnpm --filter backend dev` |
| Backend migrate | `pnpm --filter backend prisma migrate dev` |
| Backend tests | `pnpm --filter backend test` |
| Frontend dev | `pnpm --filter frontend dev` |
| Frontend build | `pnpm --filter frontend build` |
| Frontend preview | `pnpm --filter frontend preview` |
| Full build | `pnpm -r build` |

## Repository hygiene & assets

- **No binaries in PRs.** PNG/JPG/PDF/font/ZIP assets are blocked by CI (`.github/workflows/ci/no-binaries.yml`) and the local `pnpm run pre-commit` script. Only lightweight text assets (e.g. SVG icons) are allowed in pull requests.
- **Run the guard locally** with `pnpm run pre-commit` before committing. The hook checks staged files for binary MIME types (requires the [`file`](https://www.darwinsys.com/file/) CLI, e.g. `brew install file-formula` or `apt install file`).
- **Uploads directory.** Development uploads are written to `uploads/` (gitignored). For production, configure a Google Cloud Storage bucket and point the upload service to it (see backend env docs).
- **Regenerating icons/assets.** Update the SVG placeholders under `frontend/public/icons/`. Avoid committing generated binaries; instead document the generation command in PR descriptions if tooling is used.

## PWA & Offline

- `manifest.json` is emitted by `vite-plugin-pwa` with 192×192 and 512×512 icons.
- Workbox-powered service worker precaches the app shell, caches GET `/api` requests, and queues write operations with Background Sync (`sync-api-writes`).
- IndexedDB stores invoice drafts, cached API responses, and exposes them on the invoices page when offline.
- Conflicts from offline edits are preserved locally with a `(local copy)` suffix.

## PDF & CSV Exports

- Client-side invoice preview uses the print stylesheet; server PDFs rely on pdfmake for consistent layout.
- Report exports live under `/api/reports/summary.csv` and `/api/reports/summary.pdf` (auth required).

## Security Notes

- Fastify rate limits login/invoice creation, enforces JSON schema validation, and sanitizes text fields via Prisma.
- JWT secrets are supplied via env; tokens returned from login/register.
- CORS is scoped to the Vite dev origin.

## Useful cURL

```bash
# Login
curl -X POST http://localhost:4000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"demo@invoice.test","password":"password123"}'

# Reports CSV
curl "http://localhost:4000/api/reports/summary.csv?from=2024-01-01&to=2024-12-31" \
  -H "Authorization: Bearer <TOKEN>" -o summary.csv
```

## CI

GitHub Actions (`.github/workflows/ci.yml`) installs dependencies, builds, and runs backend tests on pushes and PRs.

---
Built with ❤️ as a minimal yet production-ready invoicing foundation.
