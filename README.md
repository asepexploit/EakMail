# EakMail

Self-hosted platform for selling digital goods on Telegram, fulfilled by **driving supplier bots automatically** through a no-code, n8n-style visual workflow builder. Local-first: the dashboard and API bind to `127.0.0.1` by default.

> **Docs:** [CLAUDE.md](./CLAUDE.md) (dev guide) · [ARCHITECTURE.md](./ARCHITECTURE.md) · [BLUEPRINT.md](./BLUEPRINT.md) · [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) · [PRD.md](./PRD.md) · [TASKS.md](./TASKS.md) · rules in [.claude/](./.claude/)

## Layout

```
eakmail/
├── EakMail-frontend/   # React + TS dashboard (Bahasa Indonesia UI)
├── EakMail-backend/    # Node + TS API, workflow engine, Telegram, queue, payment
├── packages/shared-types/  # the frozen FE/BE type contract
└── docker-compose.yml  # postgres + redis + backend + dashboard
```

## Prerequisites

- Node.js 20, pnpm 9 (`corepack enable`)
- PostgreSQL 16 + Redis 7 — or Docker to run them via compose.

## Quick start (local dev)

```bash
# 1. install
pnpm install

# 2. start infra (or use your own Postgres/Redis)
docker compose up -d postgres redis

# 3. configure backend
cp EakMail-backend/.env.example EakMail-backend/.env
#   edit .env: set ENCRYPTION_KEY, SESSION_SECRET. Keep USE_MOCKS=true to run without
#   live Telegram/Pakasir. Telegram/Pakasir creds are optional for a mocked run.

# 4. database
pnpm --filter @eakmail/backend prisma:generate
pnpm --filter @eakmail/backend prisma:migrate      # creates tables
pnpm --filter @eakmail/backend seed                # dev admin + sample supplier/workflow/product

# 5. run (two terminals)
pnpm dev:backend    # http://127.0.0.1:8787
pnpm dev:frontend   # http://127.0.0.1:5173  (proxies /api + /ws to backend)
```

Dev admin from the seed: `admin@eakmail.local` / `admin12345` (change it).

## Mocks vs live

`USE_MOCKS=true` (default) runs the whole system **without connecting to Telegram or Pakasir** — a scripted mock supplier drives the workflow engine and a mock payment returns fake QR/VA. This is safe for development, CI, and demos.

To go live, set `USE_MOCKS=false` and fill `TELEGRAM_API_ID/HASH`, the storefront bot token (via the dashboard **Pengaturan Bot** page, stored encrypted), and `PAKASIR_SLUG/API_KEY/WEBHOOK_SECRET`. See the security notes in [ARCHITECTURE.md §10](./ARCHITECTURE.md#10-security). Automating a Telegram user account carries ToS/ban risk — see [PRD.md §12](./PRD.md#12-risks--assumptions).

## Full stack via Docker

```bash
cp EakMail-backend/.env.example EakMail-backend/.env   # edit secrets
docker compose up -d --build
# dashboard: http://127.0.0.1:5173   api: http://127.0.0.1:8787
```
Migrations run automatically on backend container start. To seed inside the container:
`docker compose exec backend node dist/db/seed.js` (or run the seed once locally against the same DB).

## Scripts

| Command | Does |
|---|---|
| `pnpm typecheck` | Typecheck all packages |
| `pnpm test` | Run all tests |
| `pnpm dev:backend` / `pnpm dev:frontend` | Dev servers |
| `pnpm --filter @eakmail/backend prisma:migrate` | Apply DB migrations |
| `pnpm --filter @eakmail/backend seed` | Seed dev data |

## Status

Phase 0–5 implemented (foundation, DB, backend core, Telegram layer, workflow engine + all nodes, Pakasir payment) plus the dashboard and workflow builder. Build plan and progress: [TASKS.md](./TASKS.md). Deploy: [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md). Operate (runbooks): [docs/RUNBOOK.md](./docs/RUNBOOK.md).
