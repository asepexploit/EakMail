# EakMail — Development Tasks (Phased, Dependency-Ordered)

> **Project:** Brand EakMail
> **Status:** In progress — core implemented (see below)
> **Last updated:** 2026-10-01
>
> **Companion documents:** [ARCHITECTURE.md](./ARCHITECTURE.md) · [BLUEPRINT.md](./BLUEPRINT.md) · [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) · [PRD.md](./PRD.md)

> **Implementation status (as of 2026-10-02):** Phases 0–7 are largely implemented — backend (auth+2FA, accounts + Session Manager with mock, suppliers, workflows + validation + versioning, products + pricing, bot-config, workflow engine + all node executors, Pakasir payment with mock + HMAC webhook + refund, orders + BullMQ workers), the React dashboard (Bahasa Indonesia via the strings module), and the n8n-style workflow builder. Phase 8 has a vitest suite (backend engine/nodes/expression/variables/mock session manager e2e; frontend strings/format/graph-adapter). Phase 9 ships Docker Compose + two Dockerfiles + nginx and operator docs. Not yet done: CI pipeline, Playwright E2E, dedicated payment-sandbox/idempotency/resilience/security/load/a11y test suites. Run it: [README.md](./README.md). Deploy + operate: [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md), [docs/RUNBOOK.md](./docs/RUNBOOK.md). Checkboxes below reflect what exists in the codebase.

This is the ordered breakdown of work. Phases are sequenced by **dependency**: each phase relies on the ones before it. Within a phase, tasks are roughly ordered too. Feature IDs (F#) reference [PRD.md §4](./PRD.md#4-feature-overview); requirement IDs (FR-#) reference [PRD.md §7](./PRD.md#7-functional-requirements-selected-testable).

**Build order:** Foundation → Database → Backend → Telegram → Supplier Engine → Workflow Builder → Dashboard → Testing → Production.

Legend: `[ ]` todo · **DoD** = Definition of Done.

---

## Dependency Graph (phases)

```
Phase 0 Foundation
      └─► Phase 1 Database
            └─► Phase 2 Backend Core (API, Auth, Queue)
                  ├─► Phase 3 Telegram Layer (Bot API + MTProto)
                  │        └─► Phase 4 Supplier / Workflow Engine
                  │                 └─► Phase 5 Payment & Order Fulfillment
                  ├─► Phase 6 Workflow Builder (frontend + engine contract)
                  │        └─► Phase 7 Dashboard UI (all sections + realtime)
                  └───────────────────────────────────────────────┘
                                     └─► Phase 8 Testing & Hardening
                                              └─► Phase 9 Production & Deployment
```

> Phases 4→5 and 6→7 can partially overlap once the **engine execution contract** (node/execution JSON shapes) is frozen in Phase 4. Freeze it early — both backend engine and frontend builder depend on it.

---

## Phase 0 — Foundation

*Goal: repository, tooling, conventions, skeleton.*

- [x] Init monorepo (e.g. `apps/api`, `apps/worker`, `apps/storefront-bot`, `apps/dashboard`, `packages/shared`).
- [x] Node 20 + TypeScript (strict), ESLint + Prettier, `tsconfig` paths.
- [x] Package manager + workspaces (pnpm).
- [x] `.env` schema + config loader (validated); document `PORT` default bind `127.0.0.1` (FR-10).
- [x] Shared package for **types** (order/execution/node/workflow) — the cross-cutting contract.
- [x] Base Docker Compose scaffolding (postgres, redis) for local dev.
- [x] Pino logging setup; error taxonomy.
- [ ] CI skeleton (lint + typecheck + test).

**DoD:** `pnpm dev` boots empty api/worker/dashboard against local postgres+redis; lint/typecheck pass in CI.
**Refs:** [ARCHITECTURE.md §2](./ARCHITECTURE.md#2-technology-stack-decisions), [§12](./ARCHITECTURE.md#12-deployment-topology).

---

## Phase 1 — Database

*Goal: schema for every entity; migrations; seed.*

- [x] Prisma setup + Postgres connection.
- [x] Model entities from [ARCHITECTURE.md §11](./ARCHITECTURE.md#11-database-logical-model):
  - [x] `admin_user` (id, email, password_hash, totp_secret, role)
  - [x] `telegram_account` (id, label, session_enc, phone, status, health, last_activity)
  - [x] `supplier` (id, name, bot_username, default_workflow_id, stats)
  - [x] `supplier_account` (join: supplier_id ↔ telegram_account_id)
  - [x] `workflow` (id, name, supplier_id, graph JSONB, variables JSONB, version, is_active)
  - [x] `workflow_version` (id, workflow_id, graph, created_at)
  - [x] `product` (id, name, price, sku, description, image_url, supplier_id, workflow_id, stock_mode, active) — full CRUD + pricing from dashboard (F6)
  - [x] `product_option` (id, product_id, key, value, price_delta)
  - [x] `bot_config` (id, bot_token_enc, brand_name, logo_url, menu JSONB, texts JSONB per-locale, updated_at) — storefront bot settings, dashboard-editable (F17)
  - [x] `customer` (id, telegram_id, username, balance, language) — `language` ∈ {`id`,`en`}, default `id` (F16)
  - [x] `order` (id, customer_id, product_id, amount, status, idempotency_key)
  - [x] `payment` (id, order_id, provider, pakasir_txn_id, method, amount, status, raw JSONB)
  - [x] `execution` (id, workflow_id, order_id, state, started_at, finished_at, variables JSONB)
  - [x] `execution_step` (id, execution_id, node_id, node_type, status, input JSONB, output JSONB, error, ts)
  - [x] `delivery` (id, order_id, payload_enc, delivered_at)
  - [x] `audit_log` (id, admin_user_id, action, target, meta JSONB, ts)
- [x] Indexes: `execution(order_id)`, `execution_step(execution_id)`, `order(status)`, `order(idempotency_key unique)`, `payment(pakasir_txn_id)`.
- [x] Enums for order/execution/node/account states (mirror [ARCHITECTURE.md §6.3](./ARCHITECTURE.md#63-execution-lifecycle) & [BLUEPRINT.md §5.2](./BLUEPRINT.md#52-order-state-machine)).
- [x] Migrations + seed script (dev admin, sample supplier/workflow/product).

**DoD:** migrations apply cleanly; seed produces a working sample dataset; unique/idempotency constraints enforced (supports FR-6).
**Refs:** [ARCHITECTURE.md §11](./ARCHITECTURE.md#11-database-logical-model), [PRD.md FR-6](./PRD.md#7-functional-requirements-selected-testable).

---

## Phase 2 — Backend Core

*Goal: API server, auth, queue, realtime, secret encryption.*

- [x] Fastify app; JSON-schema validation; error handler; health endpoint.
- [x] **Secret encryption service** (AES-256-GCM) with env key; write-only secret handling (FR-11).
- [x] **Auth**: admin login (argon2id), session cookie (HttpOnly, SameSite=Strict), optional TOTP 2FA (F13).
- [x] Authz middleware (roles) + audit-log hook.
- [x] **BullMQ** setup (Redis): queues `order-fulfillment`, `workflow-run`, `payment-poll`, `notifications` ([ARCHITECTURE.md §7](./ARCHITECTURE.md#7-queue--worker)).
- [x] Redis: distributed locks + pub/sub for live events + rate-limit counters.
- [x] **WebSocket** channel for execution events (server side) (FR-9).
- [x] REST CRUD scaffolding for: accounts, suppliers, workflows, products (incl. pricing/options), bot-config, orders, payments, logs (thin now, filled per phase).
- [x] Idempotency middleware/util for orders.

**DoD:** authenticated admin can hit CRUD stubs; a test job flows through BullMQ; a test event streams over WebSocket; secrets round-trip encrypted and never returned in plaintext.
**Refs:** [ARCHITECTURE.md §7](./ARCHITECTURE.md#7-queue--worker), [§9](./ARCHITECTURE.md#9-dashboard--monitoring), [§10](./ARCHITECTURE.md#10-security).

---

## Phase 3 — Telegram Layer

*Goal: both Telegram integrations working.*

### 3a. Storefront bot (Bot API, Telegraf) — F7, F16, F17
- [x] Bot bootstrap; `/start`, `/catalog`, `/order`, `/status` handlers (stateless; state in DB).
- [x] Product catalog rendering from DB; order creation (PENDING) with idempotency key.
- [x] Delivery relay endpoint (called by `DELIVER TO CUSTOMER` node in Phase 4).
- [x] **i18n (bilingual ID/EN)** — F16 ([PRD.md §5.9](./PRD.md#59-storefront-bot-localization-f16), [FR-12/FR-13](./PRD.md#7-functional-requirements-selected-testable)):
  - [x] Message catalog with locales `id` (default) + `en`; **no hardcoded** customer-facing strings (translate all handlers above).
  - [x] `customer.language` read/write (default `id`); `/language` command + inline switch button; persist choice.
  - [x] Locale resolution per message with **fallback to `id`** on missing key.
- [x] **Bot driven by `bot_config`** — F17 ([PRD.md §5.4a](./PRD.md#54a-storefront-bot-configuration-f17), [FR-15](./PRD.md#7-functional-requirements-selected-testable)):
  - [x] Read bot **token** from `bot_config` (decrypt); connect with it.
  - [x] Handlers read editable **texts** (per-locale), **menu/buttons**, and **branding** from `bot_config` at runtime (no hardcoded copy; catalog provides defaults, config overrides).
  - [x] Hot-reload/refresh config on change (no code deploy).

### 3b. Telegram Session Manager (MTProto, GramJS) — F1
- [x] Login flow: phone → code → 2FA; produce + **encrypt** session string.
- [x] Session pool: load/decrypt sessions, maintain connections, reconnect.
- [x] Controlled API: `sendMessage`, `clickInlineButton`, `waitForMessage(predicate,timeout)`, `getUpdates` ([ARCHITECTURE.md §4.2](./ARCHITECTURE.md#42-supplier-automation--user-accounts-mtproto)).
- [x] Health tracking: FLOOD_WAIT handling, ban/disconnect detection, status → DB.
- [x] Per-account rate limiting + human-like pacing (jitter/delays).
- [x] Account↔supplier authorization (which account can reach which bot).

**DoD:** a logged-in user account can, via the Session Manager API, send `/beli` to a real test bot, read the reply, and click an inline button; storefront bot can create an order and later deliver a message.
**Refs:** [ARCHITECTURE.md §4](./ARCHITECTURE.md#4-telegram-layer), [PRD.md FR-1](./PRD.md#7-functional-requirements-selected-testable).

---

## Phase 4 — Supplier / Workflow Engine

*Goal: the automation brain — interpret and run node graphs. **Freeze the execution contract here.***

- [x] **Freeze the shared contract**: JSON shapes for `node`, `edge`, `workflow.graph`, `execution`, `execution_step`, variable/templating (`{{var}}`). This is consumed by both engine (this phase) and builder ([Phase 6](#phase-6--workflow-builder-visual)).
- [x] Node type registry + config schemas for every node in [BLUEPRINT.md §8](./BLUEPRINT.md#8-node-system):
  - [x] Trigger: `START`
  - [x] Action: `SEND MESSAGE`, `SEND COMMAND`, `CLICK BUTTON`
  - [x] Wait: `WAIT MESSAGE`, `WAIT RESPONSE`, `WAIT BUTTON`, `DELAY`
  - [x] Logic: `MATCH TEXT`, `CONDITION`, `SWITCH`
  - [x] Data: `EXTRACT DATA` (regex named groups), `SET VARIABLE`, `TRANSFORM`
  - [x] Control: `RETRY`, `TIMEOUT`, `LOOP`
  - [x] Terminal: `SUCCESS`, `FAIL`, `DELIVER TO CUSTOMER`
- [x] **Interpreter**: traverse graph by ports, resolve `{{variables}}`, drive Session Manager (Phase 3b).
- [x] Per-node `timeout` + `retry` (count/backoff) semantics (FR-3); Control-node wrappers.
- [x] Persist `execution` + `execution_step` after each node (replayable) (FR-2).
- [x] Emit live events on Redis pub/sub → WebSocket (per-node enter/exit, msgs, vars, errors).
- [x] Execution lifecycle + controls: pause / resume / retry(from node/start) / cancel via pub/sub commands ([BLUEPRINT.md §10.3](./BLUEPRINT.md#103-live-controls-production--test)).
- [x] Resume-after-restart from checkpoint.
- [x] **Test mode** runner: run a draft workflow with no order/delivery ([BLUEPRINT.md §10.2](./BLUEPRINT.md#102-test-mode)).
- [x] Product-extraction robustness helpers (TRANSFORM ops, CONDITION validation) ([BLUEPRINT.md §12](./BLUEPRINT.md#12-product-extraction-deep-dive)).

**DoD:** the canonical workflow `START → SEND /beli → WAIT MESSAGE → MATCH TEXT → CLICK BUTTON → WAIT RESPONSE → EXTRACT DATA → SUCCESS → DELIVER` runs end-to-end against a test supplier bot, with full step logs, live events, and working pause/resume/retry/cancel.
**Refs:** [ARCHITECTURE.md §6](./ARCHITECTURE.md#6-workflow-engine), [BLUEPRINT.md §8](./BLUEPRINT.md#8-node-system), [§10](./BLUEPRINT.md#10-workflow-execution--test-mode).

---

## Phase 5 — Payment & Order Fulfillment

*Goal: money in, goods out, safely.*

- [x] **Pakasir client**: `POST /api/v2/create-transaction/{slug}/{order_id}` with `X-Api-Key`, body `{method, amount}`; respect 2 req/s limiter.
- [x] Support methods: `qris` + VAs + `payment_link` ([PRD.md §8](./PRD.md#8-payment)).
- [x] **Webhook receiver**: verify signature/secret → mark order PAID → enqueue `order-fulfillment` (F9, FR-7).
- [x] **Polling fallback** via `payment-poll` queue for missed webhooks.
- [x] **Order fulfillment worker**: order → product → workflow → execution (Phase 4); idempotent, exactly-once delivery (FR-6).
- [x] Wire `DELIVER TO CUSTOMER` → storefront bot delivery relay; persist `delivery` (encrypted).
- [x] **Failure → refund** path: execution FAILED → order REFUND_PENDING → refund/credit → REFUNDED; notify customer (FR-8).
- [x] Order state machine transitions + guards ([BLUEPRINT.md §5.2](./BLUEPRINT.md#52-order-state-machine)).
- [x] Dead-letter handling for exhausted jobs (retry/discard later from UI).

**DoD:** a customer order pays via QRIS (sandbox), triggers fulfillment, receives the extracted product exactly once; a forced failure auto-refunds and notifies; duplicate webhook/job never double-delivers.
**Refs:** [ARCHITECTURE.md §8](./ARCHITECTURE.md#8-payment), [BLUEPRINT.md §5](./BLUEPRINT.md#5-order-flow-end-to-end), [PRD.md §9](./PRD.md#9-error-handling--reliability).

---

## Phase 6 — Workflow Builder (Visual)

*Goal: the n8n-style no-code editor. Depends on the frozen contract from Phase 4.*

- [x] React Flow canvas: pan/zoom, snap grid, multi-select, copy/paste, undo/redo, minimap, fit-to-view ([DESIGN_SYSTEM.md §8](./DESIGN_SYSTEM.md#8-workflow-editor-canvas)).
- [x] **Node palette** grouped by category; drag-to-add.
- [x] **Custom node components** with category color stripe, ports, running/success/fail states ([DESIGN_SYSTEM.md §8.2–8.3](./DESIGN_SYSTEM.md#82-node-visual-anatomy)).
- [x] Port-based edge connection incl. branch ports (`matched`/`no-match`, `true`/`false`, `timeout`).
- [x] **Config side panel** per node type: message/command, button match (label/regex/index), text match, condition expr, timeout, retry, variable names, extraction regex (monospace fields) ([PRD.md §5.3](./PRD.md#53-workflow-builder-f3-f4-f5-f12)).
- [x] `{{variable}}` autocomplete/reference across nodes.
- [x] **Validation**: dangling nodes, missing required config, no terminal, unreachable branches — inline errors.
- [x] Save/load graph (maps to `workflow.graph`); **versioning** + rollback UI (F12).
- [x] Supplier/account selector in toolbar.
- [x] **Test ▶**: trigger test-mode run (Phase 4), stream live into the canvas overlay + bottom execution drawer ([DESIGN_SYSTEM.md §8.4](./DESIGN_SYSTEM.md#84-test-mode-overlay)); Pause/Resume/Step/Abort.

**DoD:** an admin can build the canonical workflow entirely by drag-and-drop, configure every node, test it live watching nodes light up, save a version, and roll back — no code.
**Refs:** [BLUEPRINT.md §7](./BLUEPRINT.md#7-visual-workflow-builder-n8n-style), [DESIGN_SYSTEM.md §8](./DESIGN_SYSTEM.md#8-workflow-editor-canvas), [PRD.md F3/F4/F5](./PRD.md#4-feature-overview).

---

## Phase 7 — Dashboard UI

*Goal: all remaining sections + realtime monitoring, per the design system.*

- [x] App shell: topbar (with `127.0.0.1:<PORT>` env badge), sidebar, status bar ([DESIGN_SYSTEM.md §2](./DESIGN_SYSTEM.md#2-layout)).
- [x] **UI strings module (Bahasa Indonesia)** — F18 ([DESIGN_SYSTEM.md §14](./DESIGN_SYSTEM.md#14-dashboard-language--bahasa-indonesia), [FR-16](./PRD.md#7-functional-requirements-selected-testable)): all dashboard copy in a single strings module (no inline Indonesian in components); Rupiah + ID date/number formatting. Code identifiers stay English ([.claude/rules/naming-conventions.md](./.claude/rules/naming-conventions.md)).
- [x] Design tokens (colors/typography), dark-mode-first theming, light toggle ([DESIGN_SYSTEM.md §3](./DESIGN_SYSTEM.md#3-color-system), [§10](./DESIGN_SYSTEM.md#10-dark-mode)).
- [x] Component library: Button, inputs, **Secret field**, DataTable, StatCard, StatusPill, Dialog, ConfirmDialog, Drawer, Tabs, Toast, CommandPalette, JSONViewer, LiveLog ([DESIGN_SYSTEM.md §5](./DESIGN_SYSTEM.md#5-component-library)).
- [x] **Overview** (Ringkasan) page: KPI StatCards, live executions mini-list, recent failures, charts ([DESIGN_SYSTEM.md §7.1](./DESIGN_SYSTEM.md#71-overview-dashboard-home)).
- [x] **Suppliers** page (CRUD, bind accounts, stats, test).
- [x] **Telegram Accounts** (Akun) page (login multi-step, health) ([DESIGN_SYSTEM.md §7.3](./DESIGN_SYSTEM.md#73-telegram-accounts)).
- [x] **Products** (Produk) page — full CRUD + **inline/drawer price editing**, options (+ price delta), active toggle, workflow mapping (F6; [DESIGN_SYSTEM.md §7.4](./DESIGN_SYSTEM.md#74-products-produk), [BLUEPRINT.md §9](./BLUEPRINT.md#9-product--workflow-mapping)).
- [x] **Bot Config** (Pengaturan Bot) page — F17: token (write-only), per-locale text editor (ID/EN tabs), menu/buttons builder, branding, live preview ([DESIGN_SYSTEM.md §7.4b](./DESIGN_SYSTEM.md#74b-bot-config-pengaturan-bot--f17)).
- [x] **Orders** (Pesanan) page + order detail drawer (timeline, linked execution, retry/refund) ([DESIGN_SYSTEM.md §7.5](./DESIGN_SYSTEM.md#75-orders)).
- [x] **Payments** (Pembayaran) page (Pakasir txns, reconciliation, refunds).
- [x] **Monitoring/Live** page: active executions + read-only graph lighting up + controls ([DESIGN_SYSTEM.md §9.1](./DESIGN_SYSTEM.md#91-live-monitoring)).
- [x] **Logs** (Log) page: LiveLog stream (search/filter), dead-letter panel, audit log ([DESIGN_SYSTEM.md §9.2](./DESIGN_SYSTEM.md#92-logs)).
- [x] **Settings** (Pengaturan) page: port, secrets (write-only), 2FA, payment keys.
- [x] WebSocket client + TanStack Query wiring; reconnect handling.
- [x] Responsive behavior + "edit on larger screen" notice for canvas ([DESIGN_SYSTEM.md §11](./DESIGN_SYSTEM.md#11-responsive-behavior)).

**DoD:** every dashboard section in [BLUEPRINT.md §11](./BLUEPRINT.md#11-admin-dashboard) is functional (incl. Products with pricing and Bot Config); UI is in Bahasa Indonesia via the strings module; live monitoring reflects executions < 1s; all destructive actions confirm; dark/light both pass WCAG AA.
**Refs:** [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md), [PRD.md §5](./PRD.md#5-admin-features).

---

## Phase 8 — Testing & Hardening

*Goal: prove the guarantees; make it robust.*

- [ ] **Unit tests**: node executors, variable templating, extraction regex, encryption, idempotency util. *(node executors, variable templating, expression/extraction covered; **encryption unit tests added** (`lib/crypto.test.ts`); idempotency util unit tests still to add.)*
- [x] **Integration tests**: engine end-to-end against a **mock supplier bot**; each node type + branch/timeout/retry.
- [ ] **Payment tests**: Pakasir sandbox create + webhook verify + polling fallback + refund path. *(webhook signature verification unit tests added: `modules/payments/webhook-verify.test.ts`)*
- [ ] **Idempotency/concurrency tests**: duplicate webhooks/jobs → exactly-once deliver (FR-6); prove **zero double-charge/deliver**.
- [ ] **Resilience tests**: worker kill mid-execution → resume from checkpoint; FLOOD_WAIT/ban simulation → account routing.
- [ ] **E2E** (Playwright): build a workflow in the UI, test it, map to product, place order, watch live monitoring deliver.
- [ ] **Security review**: secret handling, auth/2FA, webhook verification, bind address, audit log ([PRD.md §10](./PRD.md#10-security--privacy)).
- [ ] **Load/rate tests**: per-account limiter behavior; queue depth under burst.
- [ ] Accessibility audit (WCAG AA, keyboard) ([DESIGN_SYSTEM.md §5](./DESIGN_SYSTEM.md#5-component-library)).
- [x] Error-taxonomy & user-facing messages review ([PRD.md §9](./PRD.md#9-error-handling--reliability)).
- [x] **i18n tests** (F16): default is `id`; `/language` switches to `en` and persists; every customer-facing string resolves in both locales; missing key falls back to `id`; no hardcoded user-facing strings (FR-12/FR-13). *(added `telegram/bot/i18n/i18n.test.ts`: catalog completeness, resolution order, placeholder substitution, translator() helper, language switch strings)*

**DoD:** all PRD functional requirements (FR-1…FR-13) covered by passing tests; the reliability guarantees demonstrably hold.
**Refs:** [PRD.md §7](./PRD.md#7-functional-requirements-selected-testable), [§9](./PRD.md#9-error-handling--reliability), [§11](./PRD.md#11-non-functional-requirements).

---

## Phase 9 — Production & Deployment

*Goal: ship it self-hosted, safely.*

- [x] Finalize **Docker Compose**: postgres, redis, api, worker, storefront-bot, dashboard ([ARCHITECTURE.md §12](./ARCHITECTURE.md#12-deployment-topology)).
- [x] Config/secrets management: `.env`/secret store, **encryption key** provisioning, key rotation notes.
- [x] Default bind `127.0.0.1:<PORT>`; documented, warned opt-in for external exposure/reverse proxy (FR-10, [PRD.md §10](./PRD.md#10-security--privacy)).
- [x] Backups: Postgres dumps + Redis persistence; restore runbook.
- [x] Migrations on deploy; ~~zero-manual-step~~ first-run (admin bootstrap). *(migrations auto-run on backend container start; admin/sample created by a one-step in-container seed — see [docs/DEPLOYMENT.md §5](./docs/DEPLOYMENT.md#5-seeding-in-container).)*
- [ ] Observability: log shipping/retention, health checks, queue/worker dashboards.
- [x] Runbooks: account re-login, FLOOD_WAIT, failed-fulfillment triage, refund reconciliation, dead-letter handling.
- [x] Operator docs: onboard-a-supplier guide (maps to [BLUEPRINT.md §6](./BLUEPRINT.md#6-supplier-flow-admin-side)).
- [ ] Release checklist + rollback plan.

**DoD:** `docker compose up` brings the full stack online locally; an operator can log in, add an account, build+test a workflow, list a product, and complete a real (sandbox) order end-to-end; backups/runbooks in place.
**Refs:** [ARCHITECTURE.md §12](./ARCHITECTURE.md#12-deployment-topology), [PRD.md §11](./PRD.md#11-non-functional-requirements).

---

## Milestones (suggested)

| Milestone | Phases | Outcome |
|---|---|---|
| **M1 — Skeleton** | 0–2 | Repo, DB, authed API, queue, WS all wired. |
| **M2 — Automation core** | 3–4 | Session Manager + engine run the canonical workflow against a test bot. |
| **M3 — Sellable** | 5 | Pay → fulfill → deliver → refund-on-failure works end-to-end. |
| **M4 — No-code** | 6 | Admin builds & tests workflows visually. |
| **M5 — Console** | 7 | Full dashboard + live monitoring. |
| **M6 — Hardened & shipped** | 8–9 | Tests green, deployed self-hosted. |

---

## Cross-Document Map

| Topic | Where |
|---|---|
| Architecture, stack, DB schema source, security, deployment | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| Concept, all flows, node system, extraction | [BLUEPRINT.md](./BLUEPRINT.md) |
| UI/UX, components, colors, dark mode, responsive | [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) |
| Features, user stories, requirements, risks | [PRD.md](./PRD.md) |
