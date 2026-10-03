# EakMail — System Blueprint (Concept & Flows)

> **Project:** Brand EakMail
> **Status:** Blueprint / Planning (no implementation yet)
> **Last updated:** 2026-10-01
>
> **Companion documents:** [ARCHITECTURE.md](./ARCHITECTURE.md) · [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) · [PRD.md](./PRD.md) · [TASKS.md](./TASKS.md)

This document explains **how the whole system works conceptually** — every flow end to end, and the design of the no-code workflow engine that is the project's centerpiece. For the technical stack and infrastructure, see [ARCHITECTURE.md](./ARCHITECTURE.md). For what must be built and in what order, see [TASKS.md](./TASKS.md).

---

## 1. The Big Idea (in one paragraph)

Many digital-goods sellers on Telegram get their stock from **other Telegram bots**: you open a chat, type `/beli`, a menu appears, you tap a button, the bot replies with an account/OTP, and you copy it to your customer. EakMail turns that manual chore into a **configurable automation**. An admin draws the interaction as a **flowchart of nodes** in a visual builder (like n8n), binds it to a supplier and a product, and from then on every customer order is fulfilled automatically: the system logs in as a Telegram *user*, drives the supplier bot exactly as a human would, extracts the delivered data, and hands it to the customer — all observable live, pausable, retryable, and refund-safe.

---

## 2. Core Concepts & Glossary

| Term | Meaning |
|---|---|
| **Supplier** | A third-party Telegram bot we buy from. Configured in the dashboard. See [ARCHITECTURE.md §5](./ARCHITECTURE.md#5-supplier-automation-subsystem). |
| **Telegram user account** | A real (non-bot) account, logged in via MTProto, used to drive supplier bots. Pooled. |
| **Storefront bot** | Our public Bot-API bot customers use to buy. |
| **Product** | A sellable item mapped to a supplier + workflow. |
| **Workflow** | A node graph describing how to fulfill (or test) a supplier interaction. |
| **Node** | One step in a workflow (send message, wait, match, extract…). |
| **Execution** | One run of a workflow (for a real order or a test). |
| **Variable** | A value captured/produced during an execution (e.g. the extracted account). |
| **Delivery** | The final payload handed to the customer. |

---

## 3. Actors

- **Customer** — buys via the storefront bot.
- **Admin** — configures suppliers, products, and workflows; monitors executions. (Roles/permissions in [PRD.md §Admin Features](./PRD.md#5-admin-features).)
- **Supplier bot** — the external system being automated (not under our control).
- **Payment provider (Pakasir)** — processes payment. See [ARCHITECTURE.md §8](./ARCHITECTURE.md#8-payment).

---

## 4. Customer Flow

```
┌─────────┐   /start        ┌───────────────┐   browse       ┌──────────────┐
│ Customer │ ───────────────►│ Storefront Bot │ ─────────────►│  Catalog      │
└─────────┘                 └───────────────┘                └──────┬───────┘
      │  choose product + options                                  │
      │◄───────────────────────────────────────────────────────────┘
      │  place order  → Order(PENDING)
      │  ► receive QRIS / VA from Pakasir
      │  pay
      │◄── "Payment received, fulfilling your order…"
      │        (workflow runs behind the scenes — see §5, §10)
      │◄── DELIVERY (the account / OTP / credentials)
      │◄── "Order complete ✅ + receipt"
      ▼
   /status   → check any past order
   /language → switch bot language (ID ⇄ EN)
```

Notes:
- The customer never sees the automation; they see: *browse → pay → receive*.
- **Language:** the bot greets and replies in **Bahasa Indonesia by default**; the customer can switch to **English** anytime via `/language` (or an inline button). The choice is saved per customer (`customer.language`) and applied to every subsequent message. All bot copy comes from a message catalog (i18n); missing translations fall back to ID. Only the storefront bot is bilingual (not the admin dashboard). See [PRD.md §5.9](./PRD.md#59-storefront-bot-localization-f16) and [ARCHITECTURE.md §4.1](./ARCHITECTURE.md#41-customer-storefront-bot-bot-api).
- If fulfillment fails, the customer is told and **automatically refunded** (see [§5.3](#53-failure--refund-path) and [PRD.md §Error Handling](./PRD.md#9-error-handling--reliability)).
- Optional **balance/deposit** model: customer tops up, orders deduct balance (decision surfaced in [PRD.md §Payment](./PRD.md#8-payment)).

---

## 5. Order Flow (end to end)

### 5.1 Happy path

```
1. Customer places order            → Order(PENDING), idempotency_key set
2. Payment service creates Pakasir txn (method=qris/va, amount)
3. Customer pays
4. Pakasir webhook → verify signature → Order(PAID)
5. Enqueue `order-fulfillment` job (BullMQ)          [ARCHITECTURE.md §7]
6. Worker resolves Product → Workflow  (see §9 mapping)
7. Workflow Engine starts an Execution                [ARCHITECTURE.md §6]
8. Nodes run: START → SEND /beli → WAIT → MATCH → CLICK → WAIT → EXTRACT → SUCCESS
9. Extracted data → Delivery                          [ARCHITECTURE.md §11]
10. DELIVER TO CUSTOMER node → storefront bot sends payload
11. Order(DELIVERED) + receipt
```

### 5.2 Order state machine

```
PENDING ──pay──► PAID ──enqueue──► FULFILLING ──success──► DELIVERED
   │                │                   │
   │ expire         │ (no webhook)      │ workflow FAIL / TIMEOUT
   ▼                ▼                   ▼
EXPIRED         (poll fallback)     FAILED ──auto──► REFUND_PENDING ──► REFUNDED
```

### 5.3 Failure & refund path

- Any node hitting `FAIL`/`TIMED_OUT` after node-level `RETRY` is exhausted → Execution `FAILED`.
- Job-level retries (BullMQ) may re-run the whole fulfillment; when those exhaust → Order `FAILED`.
- Order `FAILED` after payment → `REFUND_PENDING` → refund via Pakasir or internal balance credit → `REFUNDED`.
- **Never double-deliver, never double-charge** — guaranteed by idempotency + delivery uniqueness (see [ARCHITECTURE.md §7](./ARCHITECTURE.md#7-queue--worker)).

---

## 6. Supplier Flow (admin side)

How an admin onboards a supplier — **no code**:

```
1. Add Telegram user account(s)         → login (phone → code → 2FA), session stored encrypted
2. Create Supplier                       → name, target bot @username, bind account(s)
3. Build a Workflow (visual builder)     → draw the node graph for this supplier   (§7, §8)
4. Test the Workflow (test mode)         → run live, watch each node, fix config    (§10)
5. Create Product(s)                     → price, options; map product → workflow   (§9)
6. Activate                              → product goes live in the storefront
```

From that point, customer orders for that product are fulfilled automatically. To onboard a *new* supplier tomorrow, the admin repeats steps 2–6 — again, no deployment.

---

## 7. Visual Workflow Builder (n8n-style)

The builder is a **drag-and-drop canvas** (React Flow) where the admin composes the supplier interaction as connected nodes. It is the product's signature feature.

### 7.1 Capabilities

- **Palette** of node types (grouped by category) → drag onto canvas.
- **Connect** nodes by dragging from an output **port** to an input port. Nodes with branches (e.g. `MATCH`, `CONDITION`) expose multiple output ports (e.g. `matched` / `no-match`).
- **Configure** each node in a side panel: message text, button match (label/regex/index), text-match pattern, condition expression, timeout, retry policy, variable names, etc.
- **Select the supplier bot** the workflow targets (and which account/pool).
- **Variables**: reference values captured upstream via `{{varName}}` in later node configs.
- **Validation**: builder warns on dangling nodes, missing required config, unreachable branches, no terminal node.
- **Versioning**: every save creates a `workflow_version` for rollback (see [ARCHITECTURE.md §11](./ARCHITECTURE.md#11-database-logical-model)).
- **Test mode**: run the current draft against a live supplier account and watch it execute (see [§10](#10-workflow-execution--test-mode)).

UI/UX specifics — canvas layout, node visuals, config panel, minimap, colors — are defined in [DESIGN_SYSTEM.md §Workflow Editor](./DESIGN_SYSTEM.md#8-workflow-editor-canvas).

### 7.2 The canonical workflow (reference example)

```
 ┌───────┐   ┌──────────────┐   ┌──────────────┐   ┌─────────────┐
 │ START │──►│ SEND /beli    │──►│ WAIT MESSAGE  │──►│ MATCH TEXT   │
 └───────┘   └──────────────┘   └──────────────┘   └──────┬──────┘
                                              matched │      │ no-match
                                                      ▼      └────────► FAIL
                                              ┌──────────────┐
                                              │ CLICK BUTTON  │
                                              └──────┬───────┘
                                                     ▼
                                              ┌──────────────┐
                                              │ WAIT RESPONSE │
                                              └──────┬───────┘
                                                     ▼
                                              ┌──────────────┐
                                              │ EXTRACT DATA  │  (regex → {{account}})
                                              └──────┬───────┘
                                                     ▼
                                              ┌──────────────┐   ┌────────────────────┐
                                              │   SUCCESS     │──►│ DELIVER TO CUSTOMER │
                                              └──────────────┘   └────────────────────┘
```

---

## 8. Node System

Every node has: `id`, `type`, `config`, `position`, input port(s), output port(s). Configs below are the **blueprint contract**; exact JSON shapes are finalized in [TASKS.md Phase 6](./TASKS.md#phase-6--workflow-builder-visual).

### 8.1 Trigger nodes

| Node | Purpose | Key config | Outputs |
|---|---|---|---|
| `START` | Entry point. In production it's triggered by an order; in test mode, by the admin. | (order context injects variables like `{{product.option}}`) | `next` |

### 8.2 Action nodes

| Node | Purpose | Key config | Outputs |
|---|---|---|---|
| `SEND MESSAGE` | Send text/command to the supplier bot (e.g. `/beli`). | `text` (supports `{{vars}}`), `parseMode` | `next` |
| `CLICK BUTTON` | Click an inline keyboard button on a received message. | match by `label` / `regex` / `index` / `row,col`; `messageRef` | `clicked`, `not-found` |
| `SEND COMMAND` | Convenience for slash commands. | `command`, `args` | `next` |

### 8.3 Wait nodes

| Node | Purpose | Key config | Outputs |
|---|---|---|---|
| `WAIT MESSAGE` | Block until the next message from the supplier arrives. | `timeout`, optional `fromPeer` | `received`, `timeout` |
| `WAIT RESPONSE` | Wait for a message *matching a predicate* (e.g. after a click). | `predicate` (regex/contains), `timeout` | `received`, `timeout` |
| `WAIT BUTTON` | Wait until a message containing inline buttons appears. | `timeout` | `received`, `timeout` |
| `DELAY` | Fixed/jittered pause (human pacing). | `ms`, `jitter` | `next` |

### 8.4 Logic nodes

| Node | Purpose | Key config | Outputs |
|---|---|---|---|
| `MATCH TEXT` | Test the current message text against a pattern. | `mode` (contains/regex/equals), `pattern`, `caseSensitive` | `matched`, `no-match` |
| `CONDITION` | If/else on a variable/expression. | `expression` (e.g. `{{stock}} > 0`) | `true`, `false` |
| `SWITCH` | Multi-branch on a value. | `cases[]` | one port per case + `default` |

### 8.5 Data nodes

| Node | Purpose | Key config | Outputs |
|---|---|---|---|
| `EXTRACT DATA` | Pull values from a message via regex capture groups → variables. | `regex` with named groups, `source` (last msg/var), `assignTo` | `extracted`, `no-match` |
| `SET VARIABLE` | Assign/compute a variable. | `name`, `value` (literal or `{{expr}}`) | `next` |
| `TRANSFORM` | Reshape/format data (trim, split, template). | `operations[]` | `next` |

### 8.6 Control nodes

| Node | Purpose | Key config | Outputs |
|---|---|---|---|
| `RETRY` | Wrap a sub-path; re-run on failure. | `maxAttempts`, `backoff` (fixed/exp), `delay` | `next`, `exhausted` |
| `TIMEOUT` | Enforce a max duration on a sub-path. | `ms` | `next`, `timeout` |
| `LOOP` | Repeat a sub-path (e.g. paginate a menu). | `while`/`count`, `maxIterations` | `body`, `done` |

> Per-node **timeout** and **retry** are also available inline on Wait/Action nodes; the dedicated Control nodes are for wrapping multi-node sub-paths. Reliability semantics: [PRD.md §Error Handling](./PRD.md#9-error-handling--reliability).

### 8.7 Terminal nodes

| Node | Purpose | Key config | Outputs |
|---|---|---|---|
| `SUCCESS` | Mark execution successful; carry a result payload. | `payload` (usually `{{account}}` etc.) | — |
| `FAIL` | Mark execution failed with a reason (triggers refund path). | `reason`, `refund` (bool) | — |
| `DELIVER TO CUSTOMER` | Send the result to the customer via the storefront bot; record `delivery`. | `template` (message using `{{vars}}`) | — |

### 8.8 Variables & templating

- Any string config supports `{{variable}}` interpolation.
- Sources: order/product context, extracted data (`{{account}}`), and `SET VARIABLE` outputs.
- Variables are scoped to the execution and persisted in `execution.variables` for replay/monitoring.

**Seeded variables** (injected at execution start from the order context):

| Variable | Type | Description |
|---|---|---|
| `{{orderId}}` | string | ID order yang sedang diproses. |
| `{{quantity}}` | number | Jumlah total pesanan (misal 3). |
| `{{amount}}` | number | Total harga (sudah `price × quantity`). |
| `{{productId}}` | string | ID produk yang dipesan. |
| `{{productName}}` | string | Nama produk. |
| `{{productSku}}` | string | SKU produk (kosong jika tidak diisi). |
| `{{customerTelegramId}}` | string | Telegram chat ID customer. |
| `{{language}}` | string | Bahasa pilihan customer (`id` / `en`). |

**Multi-quantity fulfillment variables** (injected per iteration when `quantity > 1`):

| Variable | Type | Description |
|---|---|---|
| `{{itemIndex}}` | number | Item ke berapa yang sedang diproses (1-based: 1, 2, 3, …). |
| `{{itemTotal}}` | number | Sama dengan `{{quantity}}`. |

Ketika `quantity > 1`, workflow dijalankan `quantity` kali secara berurutan. Setiap iterasi mengirim pesan ke supplier bot, menunggu respons, dan mengumpulkan hasilnya. Semua hasil digabung menjadi satu pesan delivery ke customer.

---

## 9. Product → Workflow Mapping

- Each **Product** references a **Supplier** and a **Workflow** (see [ARCHITECTURE.md §11](./ARCHITECTURE.md#11-database-logical-model)).
- **Product options** (e.g. duration, region, quantity) are injected into the workflow as variables the nodes can use (e.g. which button to click).
- One workflow can serve many products (parameterized by options); one supplier can own many workflows.
- Resolution at order time: `Order → Product → (Workflow, Supplier, bound account)` → Execution.

```
Product "Gmail 1pc"  ──► Workflow "buy-email-v3"  ──► Supplier "@SupplierBotX"  ──► account #2
      options: {qty:1}          nodes: START→…→DELIVER          bound accounts: [#2,#5]
```

---

## 10. Workflow Execution & Test Mode

### 10.1 Live execution (production)

- Driven by the Workflow Engine over the Session Manager (see [ARCHITECTURE.md §6](./ARCHITECTURE.md#6-workflow-engine)).
- Each node transition is persisted (`execution_step`) and emitted over WebSocket → the dashboard live view renders the graph lighting up node-by-node with inputs/outputs.

### 10.2 Test mode

- Admin clicks **Test** in the builder → engine runs the draft workflow against a chosen supplier account **without creating an order or delivering to a customer**.
- Live panel shows: current node, message sent, message received (raw), match results, extracted variables, timing, errors.
- Admin can **step**, **pause/resume**, **abort**, and inspect any step's payload — enabling rapid tuning of regex/timeouts/buttons.
- Successful test → save version → activate.

### 10.3 Live controls (production & test)

`pause` · `resume` · `retry (from failed node or from start)` · `cancel`. Commands travel API → Redis pub/sub → worker (see [ARCHITECTURE.md §9](./ARCHITECTURE.md#9-dashboard--monitoring)). UI in [DESIGN_SYSTEM.md §Monitoring](./DESIGN_SYSTEM.md#9-monitoring--logs-views).

---

## 11. Admin Dashboard

The control center (bind `127.0.0.1:<PORT>`). **UI in Bahasa Indonesia** ([DESIGN_SYSTEM.md §14](./DESIGN_SYSTEM.md#14-dashboard-language--bahasa-indonesia)). Sections (English names below are the concept labels; UI shows Indonesian):

| Section | What it does | Detail |
|---|---|---|
| **Overview** | KPIs: orders today, success rate, revenue, queue depth, account health. | [DESIGN_SYSTEM.md §Overview](./DESIGN_SYSTEM.md#7-key-screens) |
| **Suppliers** | CRUD suppliers, bind accounts, view stats. | [ARCHITECTURE.md §5](./ARCHITECTURE.md#5-supplier-automation-subsystem) |
| **Telegram Accounts** | Add/login/monitor user accounts; health, FLOOD_WAIT status. | [ARCHITECTURE.md §4.2](./ARCHITECTURE.md#42-supplier-automation--user-accounts-mtproto) |
| **Workflow Builder** | Visual node editor + test mode + versioning. | [§7](#7-visual-workflow-builder-n8n-style), [DESIGN_SYSTEM.md §8](./DESIGN_SYSTEM.md#8-workflow-editor-canvas) |
| **Products** | Full CRUD products + **pricing**, options, active toggle, map to workflow — no code. | [§9](#9-product--workflow-mapping), [PRD.md §5.4](./PRD.md#54-product-management-f6) |
| **Bot Config** | Configure storefront bot from dashboard: token, editable text (ID/EN), menu/buttons, branding — no code. | [PRD.md §5.4a](./PRD.md#54a-storefront-bot-configuration-f17), [DESIGN_SYSTEM.md §7.4b](./DESIGN_SYSTEM.md#74b-bot-config-pengaturan-bot--f17) |
| **Orders** | List/filter orders, drill into execution, manual retry/refund. | [§5](#5-order-flow-end-to-end) |
| **Monitoring / Live** | Real-time executions, per-node stream, controls. | [§10](#10-workflow-execution--test-mode) |
| **Logs** | Searchable step logs, dead-letter jobs, audit log. | [DESIGN_SYSTEM.md §9](./DESIGN_SYSTEM.md#9-monitoring--logs-views) |
| **Payments** | Pakasir transactions, reconciliation, refunds. | [ARCHITECTURE.md §8](./ARCHITECTURE.md#8-payment) |
| **Settings** | Port, secrets (write-only), 2FA, payment keys. | [ARCHITECTURE.md §10](./ARCHITECTURE.md#10-security) |

Full feature requirements & user stories: [PRD.md](./PRD.md).

---

## 12. Product Extraction (deep dive)

"Extraction" = reliably pulling the purchased data out of the supplier bot's reply, which is free-form text.

- **Primary tool:** `EXTRACT DATA` node with **regex + named capture groups** (e.g. `Email:\s*(?<account>\S+)\s+Pass:\s*(?<password>\S+)`).
- **Robustness techniques (configurable, no code):**
  - Match against the *matched* message from a prior `MATCH TEXT`/`WAIT RESPONSE`, not just "last message".
  - `TRANSFORM` node to trim/split/normalize (e.g. strip backticks, split `user:pass`).
  - `CONDITION` to validate extraction (e.g. `{{account}}` non-empty) before `SUCCESS`.
  - Fallbacks via `SWITCH` when suppliers use multiple reply formats.
- **Result:** captured variables become the **Delivery** payload sent by `DELIVER TO CUSTOMER`.
- Extraction failures route to `FAIL` → refund path (§5.3), and are highly visible in [Monitoring/Logs](./DESIGN_SYSTEM.md#9-monitoring--logs-views).

---

## 13. Consistency & Cross-References

- Technical stack, DB entities, security, deployment → [ARCHITECTURE.md](./ARCHITECTURE.md)
- UI/UX for every section above → [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)
- Requirements, user stories, acceptance criteria → [PRD.md](./PRD.md)
- Build phases & task breakdown (dependency-ordered) → [TASKS.md](./TASKS.md)
