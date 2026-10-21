# EakMail — Operational Runbook

> **Audience:** operators running EakMail day to day.
> **Scope:** procedures for bootstrap, onboarding, incident triage, reconciliation, backup/restore, and going live. How to *build and start* the stack lives in [DEPLOYMENT.md](./DEPLOYMENT.md); *how it works* lives in [ARCHITECTURE.md](../ARCHITECTURE.md) and [BLUEPRINT.md](../BLUEPRINT.md).
> **Last updated:** 2026-10-01
>
> **Companion documents:** [DEPLOYMENT.md](./DEPLOYMENT.md) · [README.md](../README.md) · [ARCHITECTURE.md §12](../ARCHITECTURE.md#12-deployment-topology) · [BLUEPRINT.md §6](../BLUEPRINT.md#6-supplier-flow-admin-side) · [PRD.md §10](../PRD.md#10-security--privacy) / [§12](../PRD.md#12-risks--assumptions)

Conventions used below:

- `docker compose ...` assumes you are in the repo root and using [`docker-compose.yml`](../docker-compose.yml).
- The API is at `http://127.0.0.1:8787`, routes are under `/api` (e.g. `/api/orders`). The dashboard is at `http://127.0.0.1:5173`. Most operator actions have a **dashboard** equivalent; API paths are given so they can be scripted.
- State names (`PENDING`, `PAID`, `FAILED`, `REFUND_PENDING`, `REFUNDED`, `CONNECTED`, `FLOOD_WAIT`, `BANNED`, ...) match the enums in `@eakmail/shared-types` and the state machines in [BLUEPRINT.md §5.2](../BLUEPRINT.md#52-order-state-machine).

---

## 1. First-run bootstrap

Goal: a fresh install where an operator can log in.

1. Bring up the stack — see [DEPLOYMENT.md §6](./DEPLOYMENT.md#6-bring-it-up). Migrations run automatically on backend start ([DEPLOYMENT.md §4](./DEPLOYMENT.md#4-migrations-on-container-start)).
2. Seed the dev admin + sample data:
   ```bash
   docker compose exec backend node dist/db/seed.js
   ```
   (Local dev without Docker: `pnpm --filter @eakmail/backend seed`.)
3. Log in at <http://127.0.0.1:5173> with the seed admin: `admin@eakmail.local` / `admin12345`.
4. **Immediately** change the admin password and enable 2FA (TOTP) from the settings page.
5. Confirm health: `curl -s http://127.0.0.1:8787/health` → `{"status":"ok"}`.

You are now ready to onboard a supplier (§2). Keep `USE_MOCKS=true` until you have completed the going-live checklist (§9).

---

## 2. Onboarding a supplier

This mirrors the admin-side supplier flow in [BLUEPRINT.md §6](../BLUEPRINT.md#6-supplier-flow-admin-side). Do it in the dashboard; API paths are noted for scripting.

1. **Add a Telegram user account** (the account that will drive the supplier bot) — Akun page → login (multi-step): `POST /api/accounts/login/start` (phone) then `POST /api/accounts/login/code` (code, and 2FA password if set). The produced session string is encrypted at rest (FR-11). See §3 for re-login.
2. **Create the supplier** — Suppliers page. Record the supplier's bot username.
3. **Bind account(s) to the supplier** — so the engine knows which user account may reach which bot ([ARCHITECTURE.md §4.2](../ARCHITECTURE.md#42-supplier-automation--user-accounts-mtproto)).
4. **Build / assign a workflow** — in the visual builder (or start from the seeded canonical workflow). Validate, then **Test ▶** it in test mode (no order/delivery) and watch nodes light up.
5. **Create products** and map each to the supplier + workflow; set pricing/options and the active toggle.
6. **Sell** — the storefront bot exposes the catalog to customers; orders flow through payment → fulfillment (§4–§5).

> The canonical workflow (`START → SEND /beli → WAIT MESSAGE → MATCH TEXT → CLICK BUTTON → WAIT RESPONSE → EXTRACT DATA → SUCCESS → DELIVER`) is seeded and is the reference shape for a new supplier.

---

## 3. Telegram account re-login & FLOOD_WAIT handling

Account health is tracked as `CONNECTED` / `FLOOD_WAIT` / `BANNED` / `LOGGED_OUT` / `DISCONNECTED` (`AccountStatus` in shared-types).

### Re-login (LOGGED_OUT / DISCONNECTED)

An account can drop its session (Telegram-side logout, expired session, restart without a valid session). Symptom: account status is `LOGGED_OUT` or `DISCONNECTED` on the Akun page, and executions that need that account stall/fail.

1. Akun page → the affected account → start login again:
   `POST /api/accounts/login/start` with the phone, then `POST /api/accounts/login/code` with the code (and 2FA password if the account has one).
2. On success a fresh session string is produced and **re-encrypted** at rest; the session pool reconnects and status returns to `CONNECTED`.
3. Re-run any stalled executions from the Orders page (§4).

### FLOOD_WAIT

Telegram returns `FLOOD_WAIT` with a cooldown when an account sends too fast. The Session Manager detects it, sets the account status to `FLOOD_WAIT`, and applies per-account rate limiting + human-like pacing (jitter/delays) — see `src/telegram/session-manager/pacing.ts` and `gramjs-session-manager.ts`.

Operator actions:

1. **Wait out the cooldown.** Do not force retries during `FLOOD_WAIT` — it extends the ban window. The account returns to `CONNECTED` automatically after the cooldown.
2. If FLOOD_WAIT is frequent, reduce throughput for that account: bind an **additional** account to the supplier so work spreads across accounts, and/or slow the workflow (add `DELAY` nodes / raise pacing).
3. Repeated or escalating FLOOD_WAIT can precede a ban — see below.

### BANNED

If the account is `BANNED`, it cannot be recovered by re-login. Remove/replace it, bind a different account to the supplier, and review pacing. Automating a Telegram **user** account carries ToS/ban risk — this is an accepted risk, see [PRD.md §12](../PRD.md#12-risks--assumptions).

---

## 4. Failed-fulfillment triage

When an order does not deliver, work from order → execution → step logs.

1. **Find the order.** Orders page (or `GET /api/orders?status=FAILED`). Open the order detail drawer for its timeline and the linked execution.
2. **Open the execution.** `GET /api/executions/:id` returns the execution with its **step log** (`execution_step` rows: node id/type, status, input/output, error, timestamp). This is replayable and is the primary diagnostic — find the first step with status `FAILED` and read its `error`.
   - Common causes: supplier bot changed its message format (an `EXTRACT DATA` / `MATCH TEXT` node no longer matches), the driving account is not `CONNECTED` (§3), or a per-node `TIMEOUT` fired.
3. **Watch live if reproducible.** The Monitoring/Live page streams per-node enter/exit, messages, variables, and errors over WebSocket.
4. **Act:**
   - **Retry the order** (re-arm + re-enqueue fulfillment): `POST /api/orders/:id/retry`, or the Retry action in the order drawer. Fulfillment is idempotent (exactly-once delivery, FR-6), so retrying a partially-run order does not double-deliver.
   - **Send a live control** to an in-flight execution (pause / resume / retry-from-node / cancel): `POST /api/executions/:id/command` ([BLUEPRINT.md §10.3](../BLUEPRINT.md#103-live-controls-production--test)).
   - **If it cannot be fixed**, refund (§5 below and the refund path).
5. **Fix the root cause.** If the supplier changed its bot output, edit the workflow (usually the extraction/match node), Test ▶ it, save a new version, then retry affected orders. Versioning + rollback is available if a change regresses.

---

## 5. Refund / failed-after-payment path

An execution that FAILS after the order is `PAID` moves the order to `REFUND_PENDING` → refund/credit → `REFUNDED`, and the customer is notified (FR-8). See [BLUEPRINT.md §5.2](../BLUEPRINT.md#52-order-state-machine).

- **Trigger a refund** for a failed-after-payment order: `POST /api/orders/:id/refund` with an optional `notifyText` for the customer message, or the Refund action in the order drawer. (Refund logic: `src/modules/payments/refund.service.ts` + `order.service.ts`.)
- Refunds are guarded by the order state machine — only orders in a refundable state transition; duplicate refund attempts are rejected by the guards.
- After refunding, review §4 step 5 so the next order of the same product does not fail the same way.

---

## 6. Stuck / failed jobs (dead-letter handling)

EakMail uses four BullMQ queues: `order-fulfillment`, `workflow-run`, `payment-poll`, `notifications` (`src/queue/queues.ts`). A job that exhausts its retries stays on BullMQ's **failed set** for that queue (there is no separate dead-letter queue); the worker logs `job failed` with the queue name, job id, and error (`src/queue/workers/index.ts`).

Triage:

1. **Find failures in the logs:** `docker compose logs backend | grep "job failed"` — note the `queue` and `jobId`.
2. **Trace to a domain object.** An `order-fulfillment` job carries `{ orderId }`; a `workflow-run` job carries `{ workflowId, orderId, ... }`; `payment-poll` carries `{ orderId }`. Use the order/execution to triage per §4.
3. **Re-drive the work through the domain, not the raw job.** Re-arm an order with `POST /api/orders/:id/retry` (this re-enqueues fulfillment idempotently). Prefer this over manually replaying a raw BullMQ job, so idempotency guards apply.
4. **Redis inspection** (advanced): failed jobs live under the queue's keys in Redis. Because Redis is the queue's durable store, do not flush it while jobs are pending — see §7.

> If failures pile up for one queue, first check the dependency the queue needs: `order-fulfillment`/`workflow-run` need `CONNECTED` accounts (§3); `payment-poll` needs Pakasir reachability (§8).

---

## 7. Backup & restore

Two datastores hold state: **Postgres** (all business data) and **Redis** (queue state + AOF). Postgres is the source of truth; Redis holds in-flight queue jobs and pub/sub — losing Redis loses queued/in-flight jobs but not committed orders.

### Backup — Postgres (logical dump)

```bash
# Dump the whole database to a compressed file on the host.
docker compose exec -T postgres pg_dump -U "${POSTGRES_USER:-eakmail}" "${POSTGRES_DB:-eakmail}" \
  | gzip > eakmail-db-$(date +%F).sql.gz
```

### Backup — Redis (AOF)

Redis runs with `appendonly yes` (see [`docker-compose.yml`](../docker-compose.yml)); its data lives in the `redisdata` volume as an append-only file. To take a point-in-time copy:

```bash
docker compose exec redis redis-cli BGREWRITEAOF     # compact the AOF
# then copy the AOF out of the redisdata volume, e.g.:
docker run --rm -v eakmail_redisdata:/data -v "$PWD":/backup alpine \
  sh -c 'tar czf /backup/eakmail-redis-$(date +%F).tgz -C /data .'
```

> Volume name is `<project>_redisdata` — confirm with `docker volume ls`. The same pattern backs up `pgdata` if you prefer a file-level Postgres copy over `pg_dump` (stop Postgres first for a consistent file-level copy).

### Restore — Postgres

```bash
gunzip -c eakmail-db-YYYY-MM-DD.sql.gz \
  | docker compose exec -T postgres psql -U "${POSTGRES_USER:-eakmail}" "${POSTGRES_DB:-eakmail}"
```

Restore into a **fresh** database (drop/recreate first if restoring over an existing one). After restore, restart the backend so it reconnects and re-applies any pending migrations.

### Restore — Redis

Stop Redis, replace the AOF in the `redisdata` volume with your backup, start Redis. Queue jobs resume; the engine resumes in-flight executions from their checkpoints on backend start.

> Test restores periodically against a throwaway compose project — an untested backup is not a backup.

---

## 8. Payment / webhook reconciliation

Payment truth comes from Pakasir. EakMail confirms payment two ways ([ARCHITECTURE.md §8](../ARCHITECTURE.md#8-payment)):

- **Webhook:** `POST /api/payments/webhook` — raw body, **HMAC-verified** against `PAKASIR_WEBHOOK_SECRET` (`src/modules/payments/webhook-verify.ts`). On a valid, `PAID` event it marks the order `PAID` and enqueues `order-fulfillment` (FR-7).
- **Polling fallback:** the `payment-poll` queue re-checks provider status for orders that may have missed a webhook.

Reconcile a suspect order:

1. Look up the order + its payment: Orders/Payments page, or `GET /api/orders/:id` / `GET /api/payments/:orderId`.
2. If money left the customer but the order is still `PENDING`:
   - Confirm the webhook secret matches Pakasir's dashboard config, and that `POST /api/payments/webhook` is reachable from Pakasir (in loopback-only mode it is **not** publicly reachable — see §10; polling covers this).
   - Rely on / trigger the polling fallback so the order flips to `PAID` and fulfillment enqueues.
3. If the order is `PAID` but not delivered → this is a fulfillment problem, go to §4.
4. Webhook signature failures are logged (rejected before any state change). Persistent failures usually mean a wrong `PAKASIR_WEBHOOK_SECRET` or a proxy altering the raw body — the webhook needs the **exact raw bytes** for HMAC (the route uses a scoped raw-body parser, so do not let a proxy re-serialize the JSON).

---

## 9. Going-live checklist

Do all of these before serving real customers ([PRD.md §10](../PRD.md#10-security--privacy), [TASKS.md Phase 9](../TASKS.md#phase-9--production--deployment)):

- [ ] Set `USE_MOCKS=false` in `EakMail-backend/.env`. This path now connects **live** to Telegram + Pakasir.
- [ ] Set a strong `ENCRYPTION_KEY` (32 bytes) and `SESSION_SECRET`, and `NODE_ENV=production`.
- [ ] Fill live credentials: `TELEGRAM_API_ID` / `TELEGRAM_API_HASH`; `PAKASIR_SLUG` / `PAKASIR_API_KEY` / `PAKASIR_WEBHOOK_SECRET`; storefront bot token (set via the dashboard **Pengaturan Bot**, stored encrypted).
- [ ] Change the seed admin password and enable 2FA.
- [ ] Log in at least one Telegram account and bind it to each supplier; confirm status `CONNECTED`.
- [ ] Confirm backups run (§7) and a test restore succeeds.
- [ ] Decide on exposure: keep loopback-only, or put a reverse proxy in front (§10).

### Encryption-key rotation notes

`ENCRYPTION_KEY` decrypts all at-rest secrets (Telegram sessions, bot token, payment keys, deliveries). **Rotating it is not a drop-in swap** — data encrypted under the old key cannot be read by the new one. To rotate:

1. Take a Postgres backup (§7).
2. Re-encrypt secrets: decrypt each secret with the old key and re-encrypt with the new key (do this with the old key still configured, then switch). Practically, the low-friction path is to re-enter secrets under the new key — re-login Telegram accounts (§3), re-save the bot token and payment keys in the dashboard.
3. Deploy with the new `ENCRYPTION_KEY`, then verify accounts reconnect and a test order fulfills.

Never commit `.env`, and store the key in your secret manager, not in the repo.

---

## 10. Reverse-proxy note

By default every service publishes on `127.0.0.1` only (FR-10) — the stack is unreachable from the network, which is the safe default. To expose it:

- Put a TLS-terminating reverse proxy (nginx/Caddy/Traefik) on the host in front of the **dashboard** port (`127.0.0.1:${DASHBOARD_PORT:-5173}`), and let the dashboard's own nginx proxy `/api` + `/ws` onward to the backend (it already does — [`EakMail-frontend/nginx.conf`](../EakMail-frontend/nginx.conf)). Keep the backend and datastore ports on loopback; do not publish `8787`, `5432`, or `6379` to `0.0.0.0`.
- Terminate HTTPS at the proxy, forward the `Upgrade`/`Connection` headers so the `/ws` WebSocket works, and require auth at the edge if the dashboard should not be public.
- Only after this should Pakasir webhooks (§8) reach `/api/payments/webhook` from the internet; ensure the proxy forwards the **raw** request body unchanged for HMAC verification.

Exposing beyond loopback is an explicit, warned opt-in ([PRD.md §10](../PRD.md#10-security--privacy)).

---

## Cross-Document Map

| Topic | Where |
|---|---|
| Build & start the stack, env var table, migrations, seeding | [DEPLOYMENT.md](./DEPLOYMENT.md) |
| Quick start (local dev) | [README.md](../README.md) |
| Topology & rationale | [ARCHITECTURE.md §12](../ARCHITECTURE.md#12-deployment-topology) |
| Supplier onboarding concept | [BLUEPRINT.md §6](../BLUEPRINT.md#6-supplier-flow-admin-side) |
| Order/refund state machine | [BLUEPRINT.md §5.2](../BLUEPRINT.md#52-order-state-machine) |
| Payment design | [ARCHITECTURE.md §8](../ARCHITECTURE.md#8-payment) |
| Security, bind address, exposure policy, risks | [PRD.md §10](../PRD.md#10-security--privacy) / [§12](../PRD.md#12-risks--assumptions) |
| Build plan & phase status | [TASKS.md](../TASKS.md) |
