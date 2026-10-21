# EakMail — Deployment Guide

> **Audience:** operators self-hosting EakMail.
> **Scope:** how to build and run the stack with Docker Compose. Day-2 operations (triage, backups, re-login, reconciliation) live in [RUNBOOK.md](./RUNBOOK.md).
> **Last updated:** 2026-10-01
>
> **Companion documents:** [README.md](../README.md) (quick start) · [ARCHITECTURE.md §12](../ARCHITECTURE.md#12-deployment-topology) (topology) · [PRD.md §10](../PRD.md#10-security--privacy) (bind/exposure) · [TASKS.md Phase 9](../TASKS.md#phase-9--production--deployment)

This is a concise deploy reference. It does not restate the architecture — see [ARCHITECTURE.md §12](../ARCHITECTURE.md#12-deployment-topology) for the topology and rationale.

---

## 1. What ships

The whole stack is defined in [`docker-compose.yml`](../docker-compose.yml) at the repo root. It brings up four services:

| Service | Image source | Purpose | Host port (loopback) |
|---|---|---|---|
| `postgres` | `postgres:16-alpine` | Primary datastore | `127.0.0.1:5432` |
| `redis` | `redis:7-alpine` (AOF on) | Queue, locks, pub/sub | `127.0.0.1:6379` |
| `backend` | [`EakMail-backend/Dockerfile`](../EakMail-backend/Dockerfile) | API + workers + storefront bot in one process | `127.0.0.1:${PORT:-8787}` |
| `dashboard` | [`EakMail-frontend/Dockerfile`](../EakMail-frontend/Dockerfile) | Static SPA served by nginx, proxies `/api` + `/ws` to `backend` | `127.0.0.1:${DASHBOARD_PORT:-5173}` |

All ports bind to `127.0.0.1` by default (local-first, FR-10). To expose beyond the host, see [§7](#7-exposing-beyond-127001-reverse-proxy) and [RUNBOOK.md → Going live](./RUNBOOK.md#9-going-live-checklist).

### Image internals (for reference)

- **Backend** ([`EakMail-backend/Dockerfile`](../EakMail-backend/Dockerfile)) is a multi-stage build from the **repo root** (so the pnpm workspace + `@eakmail/shared-types` resolve). It installs the toolchain for the `argon2` native addon, runs `prisma generate` + `tsc`, then ships a slim runtime that runs migrations and starts the process (see [§4](#4-migrations-on-container-start)).
- **Dashboard** ([`EakMail-frontend/Dockerfile`](../EakMail-frontend/Dockerfile)) builds the Vite SPA, then serves `dist/` with nginx using [`EakMail-frontend/nginx.conf`](../EakMail-frontend/nginx.conf). nginx does SPA fallback and proxies `/api/` and `/ws` to `http://backend:8787`.

> The backend runs the API, the four BullMQ workers, and the storefront bot in a **single container/process**. There is no separate worker or bot service to deploy.

---

## 2. Prerequisites

- Docker Engine + Docker Compose v2 (`docker compose ...`).
- A filled `EakMail-backend/.env` (see [§3](#3-environment-variables)).

---

## 3. Environment variables

Compose reads `EakMail-backend/.env` (via `env_file`) into the `backend` service, and reads a small set of variables from the shell/`.env` in the compose working directory for the Postgres credentials and host ports. Copy the template and edit:

```bash
cp EakMail-backend/.env.example EakMail-backend/.env
```

Variables (source of truth: [`EakMail-backend/.env.example`](../EakMail-backend/.env.example)):

| Variable | Default (example) | Required to go live? | Notes |
|---|---|---|---|
| `HOST` | `127.0.0.1` | — | Compose overrides to `0.0.0.0` **inside** the container; the host still only publishes on loopback. |
| `PORT` | `8787` | — | Backend listen port; also the published host port. |
| `NODE_ENV` | `development` | recommended `production` | Set `production` for real deployments. |
| `DATABASE_URL` | `postgresql://eakmail:eakmail@127.0.0.1:5432/...` | yes | Compose overrides this to point at the `postgres` service host. When editing `.env` for compose, the compose override wins. |
| `REDIS_URL` | `redis://127.0.0.1:6379` | yes | Compose overrides to `redis://redis:6379`. |
| `ENCRYPTION_KEY` | `change-me-...` | **yes** | 32-byte key (base64/hex). AES-256-GCM at-rest encryption of secrets (FR-11). **Change before any real data.** Rotation notes: [RUNBOOK.md §9](./RUNBOOK.md#9-going-live-checklist). |
| `SESSION_SECRET` | `change-me-...` | **yes** | Signs the admin session cookie. Change it. |
| `TELEGRAM_API_ID` / `TELEGRAM_API_HASH` | `0` / empty | live only | From my.telegram.org; used by the Session Manager. Not needed while `USE_MOCKS=true`. |
| `STOREFRONT_BOT_TOKEN` | empty | optional | Normally set from the dashboard (Pengaturan Bot, stored encrypted); this env is a fallback. |
| `PAKASIR_BASE_URL` | `https://pakasir.com` | live only | Payment provider base URL. |
| `PAKASIR_SLUG` / `PAKASIR_API_KEY` / `PAKASIR_WEBHOOK_SECRET` | empty | live only | Pakasir credentials + webhook HMAC secret. Not needed while `USE_MOCKS=true`. |
| `USE_MOCKS` | `true` | set **`false`** to go live | `true` never connects to Telegram/Pakasir — safe for build/CI/demo. |

Compose-level variables (read from the shell or the compose `.env`, with defaults):

| Variable | Default | Purpose |
|---|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `eakmail` / `eakmail` / `eakmail` | Postgres container credentials + the DB the backend connects to. |
| `PORT` | `8787` | Published backend host port. |
| `DASHBOARD_PORT` | `5173` | Published dashboard host port. |

> If you change `POSTGRES_USER`/`POSTGRES_PASSWORD`, the backend's `DATABASE_URL` is already derived from them by the compose override, so you do not need to edit it in two places.

---

## 4. Migrations on container start

The backend image applies migrations automatically before the app starts. Its runtime command is:

```
prisma migrate deploy && node dist/index.js
```

(`prisma migrate deploy` from the workspace `node_modules`, then the compiled server — see the runtime stage of [`EakMail-backend/Dockerfile`](../EakMail-backend/Dockerfile)). So every `docker compose up`/restart of the backend brings the schema up to date with committed migrations. No manual migrate step is required in normal operation.

- To watch it happen: `docker compose logs -f backend`.
- To apply migrations manually (e.g. against an external DB before first boot): `docker compose run --rm backend node ../node_modules/prisma/build/index.js migrate deploy`.

---

## 5. Seeding in-container

Migrations create tables but do **not** create the dev admin or sample data. Seed once after the first bring-up:

```bash
docker compose exec backend node dist/db/seed.js
```

This creates the dev admin (`admin@eakmail.local` / `admin12345` — change it immediately) plus a sample supplier, canonical workflow, and product. See [RUNBOOK.md §1](./RUNBOOK.md#1-first-run-bootstrap) for the first-run bootstrap, and change the admin credentials before exposing the dashboard.

> The seed is idempotent-friendly for dev but is intended for first-run bootstrap / demos, not repeated production use.

---

## 6. Bring it up

```bash
# infra only (for local dev against host-run backend)
docker compose up -d postgres redis

# full stack, building images
docker compose up -d --build
```

Then:

- Dashboard: <http://127.0.0.1:5173>
- API health: <http://127.0.0.1:8787/health> → `{"status":"ok"}`

Verify:

```bash
docker compose ps                 # all services healthy/running
docker compose logs -f backend    # migrations applied, server listening, workers started
```

Teardown (keeps volumes/data): `docker compose down`. To also drop data: `docker compose down -v` (destroys Postgres + Redis volumes — see [RUNBOOK.md §7](./RUNBOOK.md#7-backup--restore) first).

---

## 7. Exposing beyond 127.0.0.1 (reverse proxy)

The stack is loopback-only by design (FR-10, [PRD.md §10](../PRD.md#10-security--privacy)). To serve it on a network, put a TLS-terminating reverse proxy in front of the dashboard container and keep the app ports on loopback. See [RUNBOOK.md §10](./RUNBOOK.md#10-reverse-proxy-note) for the concrete note, and the going-live checklist in [RUNBOOK.md §9](./RUNBOOK.md#9-going-live-checklist).

---

## Cross-Document Map

| Topic | Where |
|---|---|
| Quick start (local dev) | [README.md](../README.md) |
| Deployment topology + rationale | [ARCHITECTURE.md §12](../ARCHITECTURE.md#12-deployment-topology) |
| Day-2 operations, triage, backups, re-login | [RUNBOOK.md](./RUNBOOK.md) |
| Bind address / external exposure policy | [PRD.md §10](../PRD.md#10-security--privacy) |
| Build plan & phase status | [TASKS.md](../TASKS.md) |
