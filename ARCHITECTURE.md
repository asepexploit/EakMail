# EakMail — System Architecture

> **Project:** Brand EakMail — Automated Digital Goods Fulfillment via Telegram Supplier Automation
> **Status:** Blueprint / Planning (no implementation yet)
> **Last updated:** 2026-10-01
>
> **Companion documents:** [BLUEPRINT.md](./BLUEPRINT.md) · [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) · [PRD.md](./PRD.md) · [TASKS.md](./TASKS.md)

---

## 1. Purpose & Scope

EakMail is a self-hosted platform that sells **digital goods** (email accounts, OTP/verification services, subscriptions, and similar automatable products) where fulfillment is performed by **driving third-party Telegram supplier bots automatically**.

The core idea: a supplier that normally requires a human to type `/beli`, wait for a menu, click an inline button, and copy the delivered account, is instead driven by a **configurable, no-code workflow engine** — like [n8n](https://n8n.io) but purpose-built for Telegram automation. Admins configure everything from a **dashboard**, with zero code changes to onboard a new supplier.

This document defines the technical architecture. The *what* and *why* of features live in [PRD.md](./PRD.md); the conceptual/system walkthrough lives in [BLUEPRINT.md](./BLUEPRINT.md).

### Design principles

1. **No-code supplier onboarding** — a new supplier = a new workflow drawn in the dashboard, never a code deploy. See [BLUEPRINT.md §Visual Workflow Builder](./BLUEPRINT.md#7-visual-workflow-builder-n8n-style).
2. **Local-first & private** — the dashboard binds to `127.0.0.1:<PORT>` by default (see [§9](#9-dashboard--monitoring)); nothing is exposed publicly unless the admin explicitly opts in.
3. **Everything is observable** — every workflow run is a persisted, replayable execution with step-by-step logs. See [§6](#6-workflow-engine) and [DESIGN_SYSTEM.md §Monitoring & Logs](./DESIGN_SYSTEM.md#9-monitoring--logs-views).
4. **Fail safe, never double-spend** — orders are idempotent, refunds are automatic on failure, and a customer is never charged twice or delivered twice. See [§7](#7-queue--worker) and [PRD.md §Error Handling](./PRD.md#9-error-handling--reliability).
5. **Secrets never touch the browser** — Telegram session strings, API keys, and payment secrets stay server-side, encrypted at rest. See [§10](#10-security).

---

## 2. Technology Stack (Decisions)

| Layer | Choice | Rationale |
|---|---|---|
| **Language / Runtime** | Node.js 20 LTS + TypeScript (strict) | Single language full-stack; mature MTProto (GramJS) & Bot API (Telegraf) libraries. |
| **Telegram — user account** | **MTProto** via [GramJS](https://github.com/gram-js/gramjs) | Logs in as a real user account → can DM supplier bots, click inline buttons, read all messages. Bots cannot talk to bots, so this is mandatory for supplier automation. |
| **Telegram — customer bot** | **Bot API** via [Telegraf](https://telegraf.js.org) | Official storefront bot customers interact with; safe, ToS-compliant. |
| **HTTP / API framework** | Fastify | Fast, schema-first (JSON Schema validation), first-class TypeScript. |
| **Realtime** | WebSocket (via `@fastify/websocket`) + Socket.IO fallback | Live execution streaming to the dashboard. |
| **Queue / Jobs** | BullMQ (Redis-backed) | Reliable retries, rate-limiting per supplier account, delayed jobs, concurrency control. |
| **Database** | PostgreSQL 16 | Relational integrity for orders/payments; JSONB for flexible workflow graphs. |
| **ORM / Migrations** | Prisma | Type-safe queries + versioned migrations. |
| **Cache / Broker / Locks** | Redis 7 | BullMQ broker, distributed locks, rate-limit counters, pub/sub for realtime. |
| **Frontend (dashboard)** | React 18 + TypeScript + Vite | See [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md). |
| **Workflow canvas** | React Flow | Node-graph editor engine for the visual builder. |
| **State (frontend)** | TanStack Query + Zustand | Server-state caching + local UI state. |
| **Styling** | Tailwind CSS + Radix UI primitives | See [DESIGN_SYSTEM.md §Components](./DESIGN_SYSTEM.md#5-component-library). |
| **Payment** | **Pakasir** (`POST /api/v2/create-transaction/{slug}/{order_id}`) | QRIS + Virtual Accounts; Indonesian market. See [§8](#8-payment). |
| **Auth (dashboard)** | Session cookie + optional TOTP 2FA | Local admin login; see [§10](#10-security). |
| **Logging** | Pino (structured JSON) + log persistence in Postgres for execution logs | |
| **Deployment** | Docker Compose (single-host, self-hosted) | Postgres + Redis + API + Worker + Dashboard in one stack. See [TASKS.md Phase 9](./TASKS.md#phase-9--production--deployment). |

> These are the reference choices for the blueprint. TASKS.md is written against this stack; swapping a component means revisiting the affected phase there.

---

## 3. High-Level System Diagram

```
                         ┌──────────────────────────────────────────────────────┐
                         │                     CUSTOMER SIDE                      │
                         │                                                        │
   Customer ◄──────────► │   Telegram Storefront Bot  (Bot API / Telegraf)        │
   (Telegram)            │      /start /catalog /order /status                     │
                         └───────────────────────┬────────────────────────────────┘
                                                 │  (creates orders)
                                                 ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                                    CORE PLATFORM (self-hosted)                              │
│                                                                                            │
│   ┌───────────────┐     ┌──────────────────┐      ┌───────────────────────────────────┐    │
│   │  API Server    │◄───►│   PostgreSQL      │      │           Redis                    │    │
│   │  (Fastify)     │     │  orders, products │      │  BullMQ queues, locks, pub/sub     │    │
│   │  REST + WS     │     │  workflows, users │      └───────────────┬───────────────────┘    │
│   └──────┬─────────┘     │  executions, logs │                      │                        │
│          │               └──────────────────┘                      │                        │
│          │  enqueue order-fulfillment / workflow-run jobs           │                        │
│          ▼                                                          ▼                        │
│   ┌────────────────────────────────────────────────────────────────────────────────────┐  │
│   │                          WORKER POOL  (BullMQ consumers)                              │  │
│   │                                                                                      │  │
│   │   ┌──────────────────────┐   drives   ┌──────────────────────────────────────────┐  │  │
│   │   │  Workflow Engine       │──────────►│  Telegram Session Manager (MTProto/GramJS) │  │  │
│   │   │  interprets node graph │           │  pool of logged-in user accounts           │──┼──┼──► Supplier
│   │   │  START→SEND→WAIT→...    │◄──────────│  send msg / click button / read updates    │  │  │    Bots
│   │   └──────────────────────┘   events    └──────────────────────────────────────────┘  │  │  (Telegram)
│   │            │                                                                          │  │
│   │            └── writes step logs + execution state ───────────────────────────────────┼──┘
│   └────────────────────────────────────────────────────────────────────────────────────┘  │
│          ▲                                                                                   │
│          │ REST + WebSocket (live execution stream)                                          │
│   ┌──────┴───────────────────────────────────────────────────────────────────────────────┐ │
│   │         ADMIN DASHBOARD  (React + React Flow)   ── binds 127.0.0.1:<PORT> ──            │ │
│   │   Workflow Builder · Suppliers · Orders · Products · Live Monitoring · Logs · Settings  │ │
│   └────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                            │
│   ┌───────────────────────────────┐        ┌──────────────────────────────────────────┐   │
│   │  Payment Service (Pakasir)     │◄──────►│  Pakasir API + Webhook receiver           │   │
│   └───────────────────────────────┘        └──────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

Component responsibilities are detailed below and cross-referenced throughout the docs.

---

## 4. Telegram Layer

Two distinct Telegram integrations, deliberately separated.

### 4.1 Customer Storefront Bot (Bot API)

- Built with **Telegraf**. This is the public-facing bot customers use to browse products, place orders, pay, and receive delivery.
- Stateless request handlers; all state persisted in Postgres.
- Never automates anything — it only creates/reads **orders** and relays results.
- Delivery of purchased goods to the customer happens here (the final `DELIVER TO CUSTOMER` step of a workflow routes back through this bot). See [BLUEPRINT.md §Order Flow](./BLUEPRINT.md#5-order-flow).
- **Bilingual (i18n):** the storefront bot serves **Bahasa Indonesia (default) + English**. All customer-facing copy comes from a **message catalog** (locale files keyed by string id) plus **admin-editable overrides** (see below), never hardcoded. Each customer's language is stored in `customer.language` (default `id`) and switched via `/language` at any time; missing translations fall back to `id`. The **admin dashboard itself is single-language: Bahasa Indonesia** (see [PRD.md §5.10](./PRD.md#510-dashboard-language-f18)). See [PRD.md §5.9](./PRD.md#59-storefront-bot-localization-f16) and [FR-12/FR-13](./PRD.md#7-functional-requirements-selected-testable). *(Localization of workflow-generated delivery/notification templates is a later enhancement, out of v1 scope.)*
- **Fully dashboard-configurable (no code)** — F17: the bot's **token**, **editable text/messages** (per language), **menu/buttons**, and **branding** are all managed from the dashboard and stored in a `bot_config` record (see [§11](#11-database-logical-model)). The bot token is **encrypted, write-only** ([§10](#10-security)). Handlers read config + i18n catalog at runtime, so changes apply without a code deploy. See [PRD.md §5.4a](./PRD.md#54a-storefront-bot-configuration-f17). **Products and their prices are likewise full-CRUD from the dashboard** (F6) — the storefront catalog is rendered from the `product` table, so adding/editing/pricing/activating products needs no code.

### 4.2 Supplier Automation — User Accounts (MTProto)

This is the heart of the system. Because **a bot cannot message another bot**, we automate a **real Telegram user account** via MTProto (GramJS).

**Telegram Session Manager** responsibilities:

- Maintain a **pool of logged-in user accounts** (each with an encrypted session string; see [§10](#10-security)).
- Expose a controlled API to the Workflow Engine:
  - `sendMessage(peer, text)` — e.g. send `/beli`.
  - `clickInlineButton(peer, messageId, match)` — click a button by label/regex/position.
  - `waitForMessage(peer, predicate, timeout)` — resolve on next matching update.
  - `getUpdates(peer)` — stream incoming messages/edits.
- Handle **login lifecycle**: phone + code + optional 2FA password, session persistence, re-auth on expiry, FLOOD_WAIT handling.
- Enforce **per-account rate limits** and **human-like pacing** (jitter/delays) to reduce ban risk.
- **Account health**: track FLOOD_WAIT, bans, disconnects; mark accounts unhealthy and route around them.

**Account ↔ Supplier mapping:** each supplier is bound to one or more user accounts able to reach that supplier's bot. The Workflow Engine requests an account from the pool that is (a) healthy and (b) authorized for the target supplier.

> ⚠️ **ToS note:** automating user accounts carries Telegram ToS risk and ban risk. The architecture isolates this risk to the Session Manager, uses pacing/jitter, and treats accounts as disposable/replaceable resources. Documented as a risk in [PRD.md §Risks](./PRD.md#12-risks--assumptions).

---

## 5. Supplier Automation Subsystem

A **Supplier** is a first-class entity, configured entirely from the dashboard:

- **Identity:** supplier name, the target bot's `@username` / peer id.
- **Bound account(s):** which MTProto user account(s) can reach it.
- **Default workflow:** the workflow that fulfills an order for this supplier.
- **Credentials / balance info:** optional notes, balance-check workflow.
- **Health & stats:** success rate, avg fulfillment time, last error.

The supplier does *not* contain automation logic itself — the logic is a **Workflow** (see [§6](#6-workflow-engine)) referenced by the supplier and/or by a product→workflow mapping (see [BLUEPRINT.md §Product → Workflow Mapping](./BLUEPRINT.md#9-product--workflow-mapping)).

This separation means one supplier can have multiple workflows (e.g. "buy email", "check balance", "buy OTP") and one workflow template can be cloned across similar suppliers.

---

## 6. Workflow Engine

An interpreter that executes a **directed graph of nodes** (the same graph the admin draws in the visual builder). This is the automation brain.

### 6.1 Model

- A **Workflow** = `{ nodes[], edges[], variables, settings }`, stored as JSONB in Postgres (see [§11](#11-database)).
- A **node** = `{ id, type, config, position }`. Node types are enumerated in [BLUEPRINT.md §Node System](./BLUEPRINT.md#8-node-system).
- An **edge** = `{ from, fromPort, to }` — ports allow branching (e.g. a `MATCH` node has `matched` / `no-match` outputs).
- An **execution** = one run of a workflow for one order, with a persisted state machine (see [§6.3](#63-execution-lifecycle)).

### 6.2 Node categories (summary — full spec in BLUEPRINT.md)

| Category | Examples |
|---|---|
| **Trigger** | `START` (manual/test, or triggered by an order) |
| **Action** | `SEND MESSAGE`, `CLICK BUTTON`, `SEND COMMAND` |
| **Wait** | `WAIT MESSAGE`, `WAIT BUTTON`, `DELAY`, `WAIT RESPONSE` |
| **Logic** | `MATCH TEXT` (regex/contains), `CONDITION` (if/else), `SWITCH` |
| **Data** | `EXTRACT DATA` (regex capture groups → variables), `SET VARIABLE`, `TRANSFORM` |
| **Control** | `RETRY`, `TIMEOUT` wrapper, `LOOP` |
| **Terminal** | `SUCCESS` (+ payload), `FAIL` (+ reason), `DELIVER TO CUSTOMER` |

The canonical example workflow:

```
START → SEND /beli → WAIT MESSAGE → MATCH TEXT → CLICK BUTTON
      → WAIT RESPONSE → EXTRACT DATA → SUCCESS → DELIVER TO CUSTOMER
```

### 6.3 Execution lifecycle

```
PENDING → RUNNING → (per-node) → SUCCEEDED
                              ↘ FAILED  ── (RETRY policy) ──► RUNNING
                              ↘ TIMED_OUT
   RUNNING ──(admin)──► PAUSED ──(admin)──► RUNNING
   any     ──(admin)──► CANCELLED
```

- The engine advances node-by-node, persisting **execution state + a step log** after each node so a run is fully **replayable and resumable**.
- Each node's config supplies **timeout** and **retry** (count, backoff) — see [PRD.md §Error Handling](./PRD.md#9-error-handling--reliability).
- **Variables** captured by `EXTRACT DATA` flow forward and are available to later nodes (e.g. the extracted account is passed to `DELIVER TO CUSTOMER`).
- Every state transition emits an event on Redis pub/sub → streamed to the dashboard live view (see [§9](#9-dashboard--monitoring)).

### 6.4 Test mode

Admins can **run a workflow in isolation** (no real order) against a supplier account, watch it execute live, and inspect each node's input/output — see [BLUEPRINT.md §Workflow Execution](./BLUEPRINT.md#10-workflow-execution--test-mode) and [DESIGN_SYSTEM.md §Workflow Editor](./DESIGN_SYSTEM.md#8-workflow-editor-canvas).

---

## 7. Queue / Worker

BullMQ (Redis) decouples order intake from the slow, rate-limited work of driving Telegram.

### Queues

| Queue | Producer | Consumer | Purpose |
|---|---|---|---|
| `order-fulfillment` | API / Storefront bot | Worker | One job per paid order → runs the mapped workflow. |
| `workflow-run` | Workflow Engine / Test mode | Worker | Executes a workflow instance (can be a child of an order job). |
| `payment-poll` | Payment service | Worker | Fallback polling of Pakasir status (webhook is primary). |
| `notifications` | Any | Worker | Outbound customer/admin messages. |

### Guarantees & controls

- **Idempotency:** each order has a unique key; re-enqueuing the same order never double-fulfills. Enforced with Redis locks + a DB unique constraint on `(order_id, state=DELIVERED)`.
- **Concurrency & rate limiting:** BullMQ limiter **per supplier account** to respect Telegram limits and mimic human pacing.
- **Retries:** exponential backoff at the *job* level, distinct from node-level `RETRY`. A job that exhausts retries → order moves to `FAILED` → auto-refund (see [§8](#8-payment)).
- **Dead-letter:** failed jobs retained for inspection and manual retry from the dashboard (see [BLUEPRINT.md §Admin Dashboard](./BLUEPRINT.md#11-admin-dashboard)).
- **Graceful shutdown:** in-flight executions checkpoint their state so they resume after a restart.

---

## 8. Payment

Provider: **Pakasir**.

### Integration points

- **Create transaction:** `POST https://pakasir.com/api/v2/create-transaction/{slug}/{order_id}`
  - Headers: `X-Api-Key: <key>`
  - Body: `{ method, amount }` where `method ∈ { qris, bri_va, bni_va, cimb_niaga_va, permata_va, maybank_va, bnc_va, artha_graha_va, sampoerna_va, payment_link }`.
  - "Find-or-create": identical `(slug, order_id)` requests return the same transaction — naturally idempotent and aligned with our order model.
  - Rate limit: **2 req/s** → routed through the `payment-poll`/payment path with a limiter.
- **Payment confirmation:** primary via **Pakasir webhook** → verified signature → mark order `PAID` → enqueue `order-fulfillment`. Fallback via `payment-poll` queue.
- **Refunds / failure:** if fulfillment fails after payment, order → `REFUND_PENDING`; refund handled per Pakasir capability or via internal balance credit (see [PRD.md §Payment](./PRD.md#8-payment)).

### Flow (happy path)

```
Order created (PENDING)
   → create Pakasir transaction (QRIS/VA) → customer pays
   → Pakasir webhook → verify → Order PAID
   → enqueue order-fulfillment → Workflow runs → SUCCESS
   → DELIVER TO CUSTOMER → Order DELIVERED
```

Secrets (`slug`, `X-Api-Key`, webhook secret) are stored encrypted; see [§10](#10-security). Full flow diagrams in [BLUEPRINT.md §Order Flow](./BLUEPRINT.md#5-order-flow).

---

## 9. Dashboard & Monitoring

- **Local-first bind:** the dashboard + API serve on **`127.0.0.1:<PORT>`** by default (configurable via env). No public exposure unless the admin sets up a reverse proxy/tunnel deliberately.
- **Realtime monitoring:** WebSocket channel streams live execution events (node entered/exited, messages sent/received, variables extracted, errors). See [DESIGN_SYSTEM.md §Monitoring & Logs](./DESIGN_SYSTEM.md#9-monitoring--logs-views).
- **Live controls:** pause / resume / retry / cancel an execution from the UI → command sent to the worker via Redis pub/sub.
- **Health widgets:** account health, queue depth, success rate, per-supplier stats, recent failures.
- **Everything cross-referenced:** UI structure in [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md); feature requirements in [PRD.md](./PRD.md).

---

## 10. Security

| Concern | Approach |
|---|---|
| **Telegram session strings** | Encrypted at rest (AES-256-GCM) with a key from env/secret store; **never** sent to the browser. Decrypted only in the Session Manager process. |
| **API keys & payment secrets** | Same encryption-at-rest; injected server-side only. |
| **Dashboard auth** | Local admin account, argon2id password hashing, session cookie (HttpOnly, SameSite=Strict), optional TOTP 2FA. |
| **Network exposure** | Default bind `127.0.0.1`; documented warnings before enabling any external exposure. |
| **Webhook verification** | Pakasir webhook signature/secret verified before trusting a payment event. |
| **Secrets in the UI** | Masked; write-only fields (enter to set, never read back). |
| **Audit log** | Admin actions (workflow edits, manual retries, refunds, account changes) recorded. |
| **Least privilege** | Worker processes hold Telegram/payment secrets; the frontend and public storefront bot never do. |
| **Rate-limit & anti-abuse** | Storefront order throttling per customer; anti-double-spend via idempotency (see [§7](#7-queue--worker)). |

Threat model & full requirements: [PRD.md §Security](./PRD.md#10-security--privacy).

---

## 11. Database (Logical Model)

PostgreSQL. Full field-level schema is finalized in [TASKS.md Phase 2](./TASKS.md#phase-2--database). High-level entities:

| Entity | Key fields | Notes |
|---|---|---|
| `admin_user` | id, email, password_hash, totp_secret, role | Dashboard login. |
| `telegram_account` | id, label, session_enc, phone, status, health | MTProto user accounts (pooled). |
| `supplier` | id, name, bot_username, account_ids[], default_workflow_id, stats | See [§5](#5-supplier-automation-subsystem). |
| `workflow` | id, name, supplier_id, graph (JSONB), variables, version, is_active | Node graph. |
| `workflow_version` | id, workflow_id, graph, created_at | Version history for rollback. |
| `product` | id, name, price, sku, description, image_url, supplier_id, workflow_id, stock_mode, active | Sold to customers. Full CRUD + pricing from dashboard (F6); `active` toggles storefront visibility. |
| `product_option` | id, product_id, key, value, price_delta | Variants/params passed into the workflow; optional per-option price adjustment. |
| `bot_config` | id, bot_token_enc, brand_name, logo_url, menu (JSONB), texts (JSONB per-locale), updated_at | Storefront bot settings, all dashboard-editable (F17). Token encrypted/write-only ([§10](#10-security)). |
| `customer` | id, telegram_id, username, balance, language | Storefront users. `language` ∈ {`id`,`en`}, default `id` (see [§4.1](#41-customer-storefront-bot-bot-api)). |
| `order` | id, customer_id, product_id, amount, status, idempotency_key | State machine: PENDING→PAID→FULFILLING→DELIVERED / FAILED / REFUNDED. |
| `payment` | id, order_id, provider, pakasir_txn_id, method, amount, status, raw | Pakasir transaction record. |
| `execution` | id, workflow_id, order_id, state, started_at, finished_at, variables | One workflow run. |
| `execution_step` | id, execution_id, node_id, node_type, status, input, output, error, ts | Per-node step log (replay/monitoring). |
| `delivery` | id, order_id, payload_enc, delivered_at | What was delivered to the customer. |
| `audit_log` | id, admin_user_id, action, target, meta, ts | Security/audit. |

Relationships and indexes (e.g. index on `execution(order_id)`, `execution_step(execution_id)`, `order(status)`) are specified in TASKS.md Phase 2.

---

## 12. Deployment Topology

```
docker-compose (single host)
├── postgres        (volume: pgdata)
├── redis           (volume: redisdata)
├── api             (Fastify: REST + WS)      ── binds 127.0.0.1:<PORT>
├── worker          (BullMQ consumers + Session Manager + Workflow Engine)
├── storefront-bot  (Telegraf; long-poll or webhook)
└── dashboard       (static build served by api, or nginx)
```

- Single-host, self-hosted by default (aligns with local-first principle).
- Worker and API can scale horizontally later; state lives in Postgres/Redis so workers are stateless except for held Telegram sessions (managed via the pool + locks).
- Environment config (ports, secrets, Pakasir keys, encryption key) via `.env` / secret store. See [TASKS.md Phase 9](./TASKS.md#phase-9--production--deployment).

---

## 13. Cross-Document Map

| Topic | Where |
|---|---|
| Feature list, user stories, acceptance criteria | [PRD.md](./PRD.md) |
| Conceptual system walkthrough, all flows, node system | [BLUEPRINT.md](./BLUEPRINT.md) |
| Node type catalog | [BLUEPRINT.md §8](./BLUEPRINT.md#8-node-system) |
| Dashboard UI/UX, components, colors, dark mode | [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) |
| Build order, phases, tasks, dependencies | [TASKS.md](./TASKS.md) |
| Database schema (detailed) | [TASKS.md Phase 2](./TASKS.md#phase-2--database) |
