# EakMail — Product Requirements Document (PRD)

> **Project:** Brand EakMail
> **Status:** Blueprint / Planning (no implementation yet)
> **Last updated:** 2026-10-01
>
> **Companion documents:** [ARCHITECTURE.md](./ARCHITECTURE.md) · [BLUEPRINT.md](./BLUEPRINT.md) · [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) · [TASKS.md](./TASKS.md)

---

## 1. Summary

EakMail is a self-hosted platform for selling **digital goods** on Telegram where fulfillment is automated by **driving third-party Telegram supplier bots** through a **no-code, n8n-style visual workflow builder**. Admins onboard any supplier, design the buy interaction as a node graph, test it live, map it to products, and let orders fulfill automatically — fully observable and refund-safe.

Concept walkthrough: [BLUEPRINT.md](./BLUEPRINT.md). Technical design: [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## 2. Goals & Non-Goals

### Goals
- **G1** — Onboard a new supplier and go live **without writing or deploying code**.
- **G2** — Fulfill customer orders automatically end-to-end (order → pay → automate supplier → deliver).
- **G3** — Give admins a **visual workflow builder** with drag-and-drop nodes, live test, and versioning.
- **G4** — Provide **real-time monitoring** of every execution with pause/resume/retry/cancel.
- **G5** — Guarantee **no double-charge / no double-delivery**, with automatic refunds on failure.
- **G6** — Run **local-first** (`127.0.0.1:<PORT>`) and keep all secrets server-side and encrypted.

### Non-Goals (v1)
- Public multi-tenant SaaS (single operator/team, self-hosted).
- A marketplace of pre-built supplier templates (may come later; sharing/versioning groundwork exists).
- Mobile app (dashboard is web, desktop-first — see [DESIGN_SYSTEM.md §11](./DESIGN_SYSTEM.md#11-responsive-behavior)).
- Automating suppliers over channels other than Telegram.

---

## 3. Personas

| Persona | Description | Primary needs |
|---|---|---|
| **Operator/Admin** | Runs the store; configures suppliers, workflows, products; monitors. | No-code builder, reliability, visibility, control. |
| **Customer** | Buys digital goods via the Telegram storefront bot. | Fast browse→pay→receive; clear status; refunds when things fail. |
| **(External) Supplier bot** | Third-party bot providing stock. Not a user of our system. | — |

Actors overview: [BLUEPRINT.md §3](./BLUEPRINT.md#3-actors).

---

## 4. Feature Overview

| # | Feature | Priority | Where designed |
|---|---|---|---|
| F1 | Telegram user-account management (MTProto login pool) | P0 | [ARCHITECTURE.md §4.2](./ARCHITECTURE.md#42-supplier-automation--user-accounts-mtproto) |
| F2 | Supplier management | P0 | [BLUEPRINT.md §6](./BLUEPRINT.md#6-supplier-flow-admin-side) |
| F3 | Visual workflow builder (drag-and-drop, n8n-style) | P0 | [BLUEPRINT.md §7](./BLUEPRINT.md#7-visual-workflow-builder-n8n-style) |
| F4 | Node system (send/wait/match/click/extract/condition/…) | P0 | [BLUEPRINT.md §8](./BLUEPRINT.md#8-node-system) |
| F5 | Workflow test mode (live) | P0 | [BLUEPRINT.md §10.2](./BLUEPRINT.md#102-test-mode) |
| F6 | Product management + product→workflow mapping | P0 | [BLUEPRINT.md §9](./BLUEPRINT.md#9-product--workflow-mapping) |
| F7 | Storefront bot (browse/order) | P0 | [ARCHITECTURE.md §4.1](./ARCHITECTURE.md#41-customer-storefront-bot-bot-api) |
| F8 | Order management + fulfillment engine | P0 | [BLUEPRINT.md §5](./BLUEPRINT.md#5-order-flow-end-to-end) |
| F9 | Payment (Pakasir) + webhook + refunds | P0 | [ARCHITECTURE.md §8](./ARCHITECTURE.md#8-payment) |
| F10 | Real-time monitoring + live controls | P0 | [DESIGN_SYSTEM.md §9](./DESIGN_SYSTEM.md#9-monitoring--logs-views) |
| F11 | Logs, dead-letter, audit log | P1 | [DESIGN_SYSTEM.md §9](./DESIGN_SYSTEM.md#9-monitoring--logs-views) |
| F12 | Workflow versioning/rollback | P1 | [ARCHITECTURE.md §11](./ARCHITECTURE.md#11-database-logical-model) |
| F13 | Dashboard auth + 2FA | P0 | [ARCHITECTURE.md §10](./ARCHITECTURE.md#10-security) |
| F14 | Overview/KPIs dashboard | P1 | [DESIGN_SYSTEM.md §7.1](./DESIGN_SYSTEM.md#71-overview-dashboard-home) |
| F15 | Customer balance/deposit (optional) | P2 | [§8](#8-payment) |
| F16 | Storefront bot bilingual (ID default + EN) | P0 | [§5.9](#59-storefront-bot-localization-f16), [ARCHITECTURE.md §4.1](./ARCHITECTURE.md#41-customer-storefront-bot-bot-api) |
| F17 | Storefront bot config from dashboard (token, text, buttons, menu, welcome) | P0 | [§5.4a](#54a-storefront-bot-configuration-f17), [ARCHITECTURE.md §4.1](./ARCHITECTURE.md#41-customer-storefront-bot-bot-api) |
| F18 | Dashboard UI in Bahasa Indonesia | P0 | [§5.10](#510-dashboard-language-f18), [DESIGN_SYSTEM.md §14](./DESIGN_SYSTEM.md#14-dashboard-language--bahasa-indonesia) |

Priorities: **P0** = required for MVP, **P1** = fast-follow, **P2** = later.

---

## 5. Admin Features

### 5.1 Supplier management (F2)
- Create/edit/delete suppliers: name, target bot `@username`/peer, bound Telegram account(s), default workflow.
- View per-supplier stats: success rate, avg fulfillment time, last error.
- Test a supplier's default workflow.

### 5.2 Telegram account management (F1)
- Add account → guided login (phone → code → optional 2FA password).
- Session stored **encrypted, server-side only** (see [ARCHITECTURE.md §10](./ARCHITECTURE.md#10-security)).
- Monitor account health: connected / FLOOD_WAIT / banned / logged-out; last activity.
- Bind accounts to suppliers; the pool routes around unhealthy accounts.

### 5.3 Workflow builder (F3, F4, F5, F12)
- Drag-and-drop canvas; connect nodes via ports; branch on match/condition/timeout.
- Configure per node: message/command text, button match (label/regex/index), text match (contains/regex/equals), condition expression, timeout, retry (count + backoff), variable names, extraction regex.
- Variable templating `{{var}}` across nodes.
- Validate (dangling nodes, missing config, no terminal, unreachable branches).
- **Test** the workflow live against a real supplier account without creating an order.
- Save with **versioning**; rollback to a previous version.
- Select which supplier/account the workflow targets.

### 5.4 Product management (F6)
- **Full CRUD produk & harga dari dashboard, tanpa coding** — nama, **harga** (bisa diubah kapan saja), SKU, deskripsi, opsi/varian, gambar (opsional), status aktif/nonaktif.
- Atur **harga** per produk (dan per opsi bila ada) langsung di dashboard; perubahan harga berlaku untuk order berikutnya.
- Map produk → workflow (+ supplier); inject opsi produk sebagai variabel workflow.
- Aktif/nonaktifkan produk (tampil/sembunyi di storefront bot) dari dashboard.

### 5.4a Storefront bot configuration (F17)
> **Semua pengaturan bot toko dilakukan dari dashboard, tanpa coding.**

- **Bot token** storefront bot diatur dari dashboard (disimpan **encrypted, write-only** — lihat [ARCHITECTURE.md §10](./ARCHITECTURE.md#10-security)).
- **Teks & pesan bot** yang dapat diedit: welcome/`/start`, teks menu, label tombol, instruksi pembayaran, template pesan sukses/gagal, teks bantuan — untuk **kedua bahasa** (ID default + EN, sesuai [§5.9](#59-storefront-bot-localization-f16)).
- **Menu & tombol**: susun tombol/menu inline (label + aksi) dari dashboard.
- **Branding**: nama toko, logo/gambar sambutan (opsional), kontak/support.
- Perubahan diterapkan tanpa restart/coding; disimpan di DB (`bot_config`).

### 5.5 Order management (F8)
- List/filter orders (status, date, supplier, product).
- Drill into an order: state timeline, linked execution, payment record.
- Manual **retry** (from failed node or from start) and **refund** (confirm dialog).

### 5.6 Monitoring & control (F10, F11)
- Live list of active executions; open one to watch the graph light up node-by-node.
- Controls: pause / resume / retry / cancel.
- Logs (searchable, filterable), dead-letter queue, audit log.

### 5.7 Payments (F9)
- View Pakasir transactions, reconciliation, refunds.
- Configure Pakasir `slug`, API key (write-only), webhook secret.

### 5.8 Settings (F13)
- Bind port (`127.0.0.1:<PORT>`), theme, admin accounts, 2FA, encryption/secret management.

### 5.9 Storefront bot localization (F16)
> **Scope decision (updated 2026-10-01):** the **customer-facing storefront bot** is **bilingual (ID default + EN)**. The **admin dashboard is single-language: Bahasa Indonesia** (see [§5.10](#510-dashboard-language-f18)). Workflow-generated delivery/notification templates are out of scope for v1 localization (a later enhancement).

- The storefront bot supports **two languages: Bahasa Indonesia (default) and English**.
- **Default language is Bahasa Indonesia** — every new customer starts in ID.
- A customer can **switch language at any time** via a `/language` command (and an inline button in menus). The choice is **persisted per customer** (`customer.language`) and applied to all subsequent bot messages.
- All customer-facing bot copy (menus, catalog labels, order status, payment instructions, delivery message wrapper, errors) is provided in **both languages** via a message catalog (i18n), never hardcoded inline. The editable bot text (F17, [§5.4a](#54a-storefront-bot-configuration-f17)) is stored per language.
- Product data (names/descriptions) may be authored per language where relevant; if a translation is missing, the bot falls back to the default (ID). *(See F16 notes in [ARCHITECTURE.md §4.1](./ARCHITECTURE.md#41-customer-storefront-bot-bot-api).)*

### 5.10 Dashboard language (F18)
- The **admin dashboard UI is in Bahasa Indonesia** (single language, no switcher in v1).
- All dashboard labels, menus, buttons, table headers, and messages are written in Bahasa Indonesia. Design detail: [DESIGN_SYSTEM.md §14](./DESIGN_SYSTEM.md#14-dashboard-language--bahasa-indonesia).
- Technical/domain terms may stay in English where that is the norm (e.g. "workflow", "node", "webhook", "timeout", "retry") — kept consistent with the docs' glossary ([BLUEPRINT.md §2](./BLUEPRINT.md#2-core-concepts--glossary)).
- **Note:** this is *display language only*; it does **not** relax the technical rule that **code identifiers, file names, and API fields stay in English** ([.claude/rules/naming-conventions.md](./.claude/rules/naming-conventions.md)). Copy is Indonesian; code is English.

---

## 6. User Stories

### Admin — supplier & accounts
- **US-A1**: As an admin, I can add a Telegram user account by logging in with phone + code (+2FA) so it can drive supplier bots. *AC:* session persisted encrypted; account shows "connected"; never exposed to the browser.
- **US-A2**: As an admin, I can create a supplier and bind it to one or more accounts. *AC:* supplier appears with a health/stats row.

### Admin — workflow builder
- **US-A3**: As an admin, I can drag nodes onto a canvas and connect them to describe a supplier interaction. *AC:* graph saves; validation blocks invalid graphs with clear messages.
- **US-A4**: As an admin, I can configure a node's message, button match, regex, condition, timeout, and retry from a side panel. *AC:* config persists; `{{variables}}` resolve at run time.
- **US-A5**: As an admin, I can build the canonical flow `START → SEND /beli → WAIT MESSAGE → MATCH TEXT → CLICK BUTTON → WAIT RESPONSE → EXTRACT DATA → SUCCESS → DELIVER`. *AC:* it runs end-to-end in test mode.
- **US-A6**: As an admin, I can **test** a workflow live and watch each node execute with its input/output. *AC:* live stream shows sent/received messages, match results, extracted vars, timing, errors; no order/delivery created.
- **US-A7**: As an admin, I can save versions and roll back. *AC:* previous versions restorable.

### Admin — products & orders
- **US-A8**: As an admin, I can create a product and map it to a workflow. *AC:* ordering the product runs that workflow.
- **US-A8b**: As an admin, I can set and change a product's **price** (and options) from the dashboard. *AC:* new price applies to subsequent orders; change is audit-logged.
- **US-A8c**: As an admin, I can activate/deactivate a product from the dashboard. *AC:* inactive products disappear from the storefront bot catalog.
- **US-A9**: As an admin, I can see all orders and drill into an order's execution. *AC:* timeline + linked execution visible.
- **US-A10**: As an admin, I can manually retry or refund an order. *AC:* retry re-runs safely (no double-deliver); refund updates order + payment.

### Admin — bot configuration (F17)
- **US-A13**: As an admin, I can set the storefront **bot token** from the dashboard. *AC:* token stored encrypted/write-only; bot connects with the new token; token never shown back.
- **US-A14**: As an admin, I can edit the bot's **welcome/menu text, button labels, and messages** (for ID and EN) from the dashboard, no coding. *AC:* changes apply to the live bot without a code deploy; empty EN falls back to ID.
- **US-A15**: As an admin, I can arrange the bot's **menu/buttons** from the dashboard. *AC:* the storefront bot reflects the configured menu.

### Admin — monitoring
- **US-A11**: As an admin, I can watch live executions and pause/resume/retry/cancel them. *AC:* control reflected within ~1s; state persists across worker restart.
- **US-A12**: As an admin, I can search logs and inspect any step's payload. *AC:* filter by execution/supplier/level/time; copy payloads.

### Customer
- **US-C1**: As a customer, I can browse products and place an order in the storefront bot. *AC:* order created (PENDING); payment instructions (QRIS/VA) shown.
- **US-C2**: As a customer, I pay and automatically receive my purchased item. *AC:* on PAID → fulfill → DELIVERED with payload; status queryable via `/status`.
- **US-C3**: As a customer, if fulfillment fails I am notified and refunded. *AC:* order → FAILED → REFUNDED; customer messaged.
- **US-C4**: As a new customer, I interact with the bot in **Bahasa Indonesia by default**. *AC:* first `/start` and all messages are in ID unless I change language.
- **US-C5**: As a customer, I can **switch to English (or back to Indonesian) at any time** via `/language`. *AC:* choice persists per customer; all subsequent messages render in the chosen language; a missing translation falls back to ID.

---

## 7. Functional Requirements (selected, testable)

- **FR-1** The system MUST log in and maintain Telegram user sessions via MTProto and drive supplier bots (send message, click inline button, read messages).
- **FR-2** The workflow engine MUST execute a persisted node graph and record a step log per node (input, output, error, timing).
- **FR-3** Each node MUST support configurable `timeout` and `retry` (count + backoff) where applicable (see [BLUEPRINT.md §8](./BLUEPRINT.md#8-node-system)).
- **FR-4** `EXTRACT DATA` MUST support regex with named capture groups → execution variables.
- **FR-5** The builder MUST support drag-and-drop nodes, port-based branching, per-node config, validation, live test, and versioning.
- **FR-6** Orders MUST be idempotent; a paid order MUST fulfill exactly once and deliver exactly once.
- **FR-7** Payment MUST integrate Pakasir create-transaction and confirm via webhook (with polling fallback).
- **FR-8** On fulfillment failure after payment, the system MUST move the order to refund and issue a refund/credit.
- **FR-9** The dashboard MUST stream live execution events over WebSocket and expose pause/resume/retry/cancel.
- **FR-10** The dashboard MUST bind to `127.0.0.1:<PORT>` by default.
- **FR-11** Secrets (sessions, API keys, webhook secret) MUST be encrypted at rest and never returned to the browser.
- **FR-12** The storefront bot MUST support Bahasa Indonesia (default) and English, with all customer-facing copy served from a message catalog (no hardcoded user-facing strings).
- **FR-13** The storefront bot MUST let a customer switch language via `/language`, persist the choice per customer (`customer.language`), apply it to all subsequent messages, and fall back to Bahasa Indonesia when a translation is missing.
- **FR-14** The dashboard MUST allow full CRUD of products and their **prices/options** without code; price changes apply to subsequent orders and are audit-logged.
- **FR-15** The dashboard MUST allow configuring the storefront bot (token, editable text/messages per language, menu/buttons, branding) without code; the bot token MUST be encrypted and write-only.
- **FR-16** The admin dashboard UI MUST be in Bahasa Indonesia (single language in v1). This affects display copy only; code identifiers/API fields remain English.

---

## 8. Payment

- **Provider:** Pakasir. Create: `POST https://pakasir.com/api/v2/create-transaction/{slug}/{order_id}`, header `X-Api-Key`, body `{ method, amount }`.
- **Methods:** QRIS + Virtual Accounts (`bri_va`, `bni_va`, `cimb_niaga_va`, `permata_va`, `maybank_va`, `bnc_va`, `artha_graha_va`, `sampoerna_va`) + `payment_link`.
- **Idempotency:** Pakasir is "find-or-create" per `(slug, order_id)` — aligns with our idempotent order model.
- **Confirmation:** webhook (primary, signature-verified) → order PAID → enqueue fulfillment; polling fallback via `payment-poll` queue (respecting 2 req/s).
- **Refunds:** on failure → `REFUND_PENDING` → refund via Pakasir capability or **internal balance credit**.
- **Optional balance/deposit model (F15, P2):** customers top up; orders deduct balance; reduces per-order gateway round-trips. **Open decision** — default to per-order Pakasir for MVP.

Full flow & diagrams: [ARCHITECTURE.md §8](./ARCHITECTURE.md#8-payment), [BLUEPRINT.md §5](./BLUEPRINT.md#5-order-flow-end-to-end).

---

## 9. Error Handling & Reliability

| Scenario | Behavior |
|---|---|
| Node timeout | Route to node's `timeout` port or apply `RETRY`; if unhandled → execution FAILED. |
| Supplier reply not matching | `MATCH`/`EXTRACT` `no-match` port; may retry or FAIL with reason. |
| Telegram FLOOD_WAIT | Session Manager backs off; account marked warning; job re-scheduled after wait. |
| Account banned/disconnected | Route to another bound healthy account; if none, execution FAILED + admin alert. |
| Worker crash / restart | Executions checkpoint state; resume where left off (see [ARCHITECTURE.md §7](./ARCHITECTURE.md#7-queue--worker)). |
| Payment webhook missed | Polling fallback reconciles status. |
| Fulfillment fails after payment | Auto-refund path (§8); customer notified. |
| Duplicate order/job | Idempotency key + delivery uniqueness prevents double-charge/deliver (FR-6). |
| Extraction produced empty/invalid data | `CONDITION` validation → FAIL rather than deliver garbage. |
| Dead-letter jobs | Retained; admin can retry/discard from dashboard. |

Reliability guarantees: no double-charge, no double-delivery, automatic refund on failure, full replayable step logs.

---

## 10. Security & Privacy

- **Secrets:** Telegram session strings, Pakasir API key, webhook secret encrypted at rest (AES-256-GCM); decrypted only in worker/session-manager processes; **never** sent to the browser (write-only secret fields — see [DESIGN_SYSTEM.md §5](./DESIGN_SYSTEM.md#5-component-library)).
- **Auth:** dashboard login (argon2id), HttpOnly SameSite=Strict session cookie, optional TOTP 2FA.
- **Network:** default bind `127.0.0.1:<PORT>`; explicit, warned opt-in for any external exposure.
- **Webhook:** Pakasir signature/secret verified before acting on payment events.
- **Audit:** admin actions logged (workflow edits, retries, refunds, account/secret changes).
- **Least privilege:** storefront bot and frontend never hold automation/payment secrets.
- **Customer data:** store minimum (Telegram id/username, orders, deliveries); deliveries encrypted at rest.

Threat handling and controls: [ARCHITECTURE.md §10](./ARCHITECTURE.md#10-security).

---

## 11. Non-Functional Requirements

| Area | Target |
|---|---|
| **Live update latency** | Execution events reach dashboard < 1s. |
| **Fulfillment throughput** | Bounded by per-account Telegram rate limits; configurable concurrency per account. |
| **Reliability** | No double-charge/deliver; auto-resume after restart. |
| **Availability** | Single-host self-hosted; graceful restart; queue durability. |
| **Usability** | New supplier onboarded via UI in minutes, no code. |
| **Accessibility** | WCAG AA, keyboard-navigable, dark/light (see [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)). |
| **Portability** | Docker Compose single-command run (see [TASKS.md Phase 9](./TASKS.md#phase-9--production--deployment)). |

---

## 12. Risks & Assumptions

| Risk | Mitigation |
|---|---|
| **Telegram ToS / account bans** (userbot automation) | Human-like pacing/jitter, disposable pooled accounts, health routing, isolate risk in Session Manager. Documented in [ARCHITECTURE.md §4.2](./ARCHITECTURE.md#42-supplier-automation--user-accounts-mtproto). |
| **Suppliers change their bot's messages/buttons** | No-code workflow edits + versioning; validation/extraction failures surface fast in monitoring. |
| **Extraction fragility** (free-form replies) | Robust regex, TRANSFORM/SWITCH fallbacks, CONDITION validation before deliver (see [BLUEPRINT.md §12](./BLUEPRINT.md#12-product-extraction-deep-dive)). |
| **Payment/webhook reliability** | Polling fallback; idempotent create; reconciliation view. |
| **Secret leakage** | Encryption at rest, server-side only, write-only UI fields, audit log. |
| **Legal/compliance of resold goods** | Operator responsibility; out of scope for the platform, noted as assumption. |

**Assumptions:** single operator/team; self-hosted; Indonesian market/Pakasir; suppliers are Telegram bots reachable by the bound user accounts; admin is trusted.

---

## 13. Success Metrics

- **Onboarding time**: new supplier live in < 15 min without code.
- **Fulfillment success rate**: ≥ target % (configurable alert threshold).
- **Mean time-to-deliver** after payment.
- **Refund rate** and **double-delivery rate = 0**.
- **Time-to-detect failures** via monitoring.

---

## 14. Cross-Document Map

| Topic | Where |
|---|---|
| System architecture, stack, DB, security, deployment | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| Concept, flows, node system, extraction | [BLUEPRINT.md](./BLUEPRINT.md) |
| Dashboard UI/UX, components, colors, dark mode, responsive | [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) |
| Build phases, tasks, dependency order | [TASKS.md](./TASKS.md) |
