# EakMail — Design System (Dashboard UI/UX)

> **Project:** Brand EakMail
> **Status:** Blueprint / Planning (no implementation yet)
> **Last updated:** 2026-10-01
>
> **Companion documents:** [ARCHITECTURE.md](./ARCHITECTURE.md) · [BLUEPRINT.md](./BLUEPRINT.md) · [PRD.md](./PRD.md) · [TASKS.md](./TASKS.md)

This document defines the visual and interaction design for the **admin dashboard** (React + Tailwind + Radix, canvas via React Flow — see [ARCHITECTURE.md §2](./ARCHITECTURE.md#2-technology-stack-decisions)). The dashboard binds to `127.0.0.1:<PORT>` and is used by admins to run the whole operation described in [BLUEPRINT.md §Admin Dashboard](./BLUEPRINT.md#11-admin-dashboard).

---

## 1. Design Principles

1. **Operator-grade clarity** — this is a control panel, not a marketing site. Dense but legible; scannable at a glance.
2. **Live by default** — status, health, and executions update in real time without refresh.
3. **The canvas is the hero** — the workflow builder gets the most design investment (see [§8](#8-workflow-editor-canvas)).
4. **Safe actions** — destructive/irreversible actions (delete workflow, refund, delete account) require confirmation and are visually distinct.
5. **Dark-mode first** — operators stare at this for hours; dark is the default, light is fully supported (see [§10](#10-dark-mode)).
6. **Keyboard-friendly** — power users can navigate and act via keyboard.

---

## 2. Layout

### 2.1 App shell

```
┌───────────────────────────────────────────────────────────────────────┐
│ TOPBAR: logo · global search · env badge(127.0.0.1:PORT) · health · user│
├──────────┬────────────────────────────────────────────────────────────┤
│          │                                                              │
│ SIDEBAR  │   MAIN CONTENT AREA                                          │
│ (nav)    │   (page header + breadcrumbs + content)                      │
│          │                                                              │
│ Overview │                                                              │
│ Suppliers│                                                              │
│ Accounts │                                                              │
│ Workflows│                                                              │
│ Products │                                                              │
│ Orders   │                                                              │
│ Monitor  │                                                              │
│ Logs     │                                                              │
│ Payments │                                                              │
│ Settings │                                                              │
│          │                                                              │
├──────────┴────────────────────────────────────────────────────────────┤
│ STATUS BAR: queue depth · active executions · worker status · WS state   │
└───────────────────────────────────────────────────────────────────────┘
```

- **Topbar (56px):** brand mark, command palette (`⌘K`/`Ctrl K`), a persistent **environment badge** showing the bind address `127.0.0.1:<PORT>`, a global health dot, and the admin menu.
- **Sidebar (collapsible, 240px → 64px):** primary navigation mirroring [BLUEPRINT.md §11](./BLUEPRINT.md#11-admin-dashboard). Icons + labels; collapses to icons.
- **Main area:** each page = header (title, actions) + breadcrumb + content.
- **Status bar (32px):** always-visible operational vitals (queue depth, active executions, worker/WS connection).

### 2.2 Grid & spacing

- 8px spacing scale (`4, 8, 12, 16, 24, 32, 48, 64`).
- Content max-width `1440px` for tables/forms; the **workflow canvas is full-bleed**.
- 12-column responsive grid for dashboards/cards.

---

## 3. Color System

Defined as CSS custom properties (tokens) on `:root`, redefined for dark mode. Semantic tokens map to a base palette.

### 3.1 Base palette

| Token | Light | Dark | Use |
|---|---|---|---|
| `--brand` | `#4F46E5` (indigo 600) | `#6366F1` (indigo 500) | Primary brand, active nav, primary buttons. |
| `--brand-accent` | `#06B6D4` (cyan 500) | `#22D3EE` (cyan 400) | Accents, links, highlights, canvas connections. |
| `--bg` | `#F8FAFC` | `#0B1120` | App background. |
| `--surface` | `#FFFFFF` | `#111827` | Cards, panels. |
| `--surface-2` | `#F1F5F9` | `#1F2937` | Nested surfaces, canvas bg. |
| `--border` | `#E2E8F0` | `#273244` | Dividers, card borders. |
| `--text` | `#0F172A` | `#E5E7EB` | Primary text. |
| `--text-muted` | `#64748B` | `#94A3B8` | Secondary text. |

### 3.2 Semantic status colors

Used consistently across order states, execution states, node states, and health.

| Token | Color | Meaning |
|---|---|---|
| `--success` | `#16A34A` / `#22C55E` | DELIVERED, SUCCESS node, healthy account, paid. |
| `--running` | `#2563EB` / `#3B82F6` | RUNNING / FULFILLING / node in progress. |
| `--warning` | `#D97706` / `#F59E0B` | PENDING, PAUSED, retrying, FLOOD_WAIT. |
| `--danger` | `#DC2626` / `#EF4444` | FAILED, FAIL node, banned account, refund. |
| `--neutral` | `#64748B` / `#94A3B8` | IDLE, EXPIRED, cancelled, disabled. |
| `--info` | `#0891B2` / `#22D3EE` | Informational, extracted data. |

> These status tokens are the **single source of truth** for the state colors referenced in [BLUEPRINT.md §5.2 order state machine](./BLUEPRINT.md#52-order-state-machine) and [ARCHITECTURE.md §6.3 execution lifecycle](./ARCHITECTURE.md#63-execution-lifecycle).

---

## 4. Typography

| Role | Font | Size / Weight |
|---|---|---|
| UI base | **Inter** (system-ui fallback) | 14px / 400 |
| Headings | Inter | H1 24/600, H2 20/600, H3 16/600 |
| Data / numbers / logs / regex | **JetBrains Mono** | 13px / 400 |
| Small / captions | Inter | 12px / 500, `--text-muted` |

- Monospace is used everywhere raw data appears: log lines, message payloads, regex fields, session/txn IDs, JSON viewers.
- Line-height 1.5 body, 1.3 headings. Tabular figures for tables/metrics.

---

## 5. Component Library

Built on Radix primitives + Tailwind. Core components:

| Component | Notes |
|---|---|
| **Button** | Variants: primary, secondary, ghost, danger. Sizes sm/md. Loading state. |
| **Input / Textarea / Select** | Labelled, error state, helper text. |
| **Secret field** | Write-only, masked; "Set" not "edit"; never displays stored value (see [ARCHITECTURE.md §10](./ARCHITECTURE.md#10-security)). |
| **Table (DataTable)** | Sort, filter, paginate, column visibility, row actions, sticky header, empty state. Used for Orders, Products, Logs, Payments. |
| **Card / StatCard** | KPI display with label, value, delta, sparkline. |
| **Badge / StatusPill** | Colored by `--success/--running/--warning/--danger/--neutral` (see [§3.2](#32-semantic-status-colors)). |
| **Modal / Dialog** | For create/edit and confirmations. |
| **ConfirmDialog** | Required for destructive actions; danger-styled. |
| **Drawer / Side panel** | Node config panel, order details, execution details. |
| **Tabs** | Within detail views. |
| **Toast** | Non-blocking success/error notifications. |
| **Tooltip / Popover** | Radix-based. |
| **CommandPalette** | `⌘K` quick nav + actions. |
| **CodeBlock / JSONViewer** | Monospace, copy button; for payloads & logs. |
| **LiveLog** | Auto-scrolling, color-coded, filterable log stream (see [§9](#9-monitoring--logs-views)). |
| **Node (canvas)** | Custom React Flow node; see [§8](#8-workflow-editor-canvas). |

Accessibility: all interactive components keyboard-navigable, visible focus rings (`--brand-accent`), ARIA roles via Radix, WCAG AA contrast in both themes.

---

## 6. Iconography & Motion

- **Icons:** Lucide (consistent stroke). Each sidebar section and node category has a signature icon.
- **Motion:** subtle, purposeful. 150–200ms ease for hover/panel; node "pulse" animation when a node is actively running in a live execution; connection edges animate flow direction during live runs. Respect `prefers-reduced-motion`.

---

## 7. Key Screens

### 7.1 Overview (dashboard home)
- Top row of **StatCards**: Orders Today, Success Rate, Revenue, Queue Depth, Active Executions, Healthy Accounts.
- **Live executions** mini-list (click → Monitor).
- **Recent failures** list (click → Logs/Order).
- Charts: orders over time, success rate trend. (Charts follow the `dataviz` guidance when implemented.)

### 7.2 Suppliers
- Table: name, bot @username, bound accounts, default workflow, success rate, avg time, status.
- Create/edit drawer; "Test default workflow" action.

### 7.3 Telegram Accounts
- Cards/table: label, phone (masked), status (`--success` connected / `--warning` FLOOD_WAIT / `--danger` banned / `--neutral` logged out), last activity.
- **Login flow**: phone → code → 2FA (multi-step dialog); session stored server-side only.

### 7.4 Products (Produk)
- Table + create/edit drawer: name, **price** (editable), SKU, description, image, supplier, mapped workflow, options (with optional per-option price delta), active toggle.
- **Price is edited inline/drawer** and applies to subsequent orders (F6 / [PRD.md §5.4](./PRD.md#54-product-management-f6)); changes are audit-logged.
- Active toggle controls storefront visibility. Workflow mapping selector (see [BLUEPRINT.md §9](./BLUEPRINT.md#9-product--workflow-mapping)).

### 7.4b Bot Config (Pengaturan Bot) — F17
- **Bot token** field (write-only, masked; "Set token") — [ARCHITECTURE.md §10](./ARCHITECTURE.md#10-security).
- **Text editor** for bot copy per language (tabs: **ID** / **EN**): welcome/`/start`, menu text, button labels, payment instructions, success/fail templates, help.
- **Menu/buttons builder**: list of buttons (label + action), reorderable.
- **Branding**: store name, logo/welcome image, support contact.
- Live preview of a sample bot message; Save applies without code deploy. (See [PRD.md §5.4a](./PRD.md#54a-storefront-bot-configuration-f17).)

### 7.5 Orders
- DataTable: id, customer, product, amount, status pill, created, actions.
- Filters: status, date, supplier, product.
- Row → **Order detail** drawer: timeline (state machine), linked execution (jump to Monitor), payment info, manual **Retry**/**Refund** (confirm dialog).

### 7.6 Payments
- Pakasir transactions: order, method (QRIS/VA), amount, fee, status, expiry.
- Reconciliation view; refund actions.

---

## 8. Workflow Editor (Canvas)

The centerpiece — an n8n-style node editor. See concept in [BLUEPRINT.md §7](./BLUEPRINT.md#7-visual-workflow-builder-n8n-style) and node types in [BLUEPRINT.md §8](./BLUEPRINT.md#8-node-system).

### 8.1 Layout

```
┌────────────────────────────────────────────────────────────────────────┐
│ TOOLBAR: [workflow name ▾] [supplier ▾] [account ▾] · Save · Test ▶ · ⋯  │
├───────────┬──────────────────────────────────────────────┬──────────────┤
│ NODE       │                                               │ CONFIG PANEL │
│ PALETTE    │              CANVAS (React Flow)              │ (selected     │
│ (grouped)  │        nodes + edges + ports + minimap        │  node)        │
│            │                                               │              │
│ Trigger    │   [START]──►[SEND]──►[WAIT]──►[MATCH]──►…      │  fields:      │
│ Action     │                                               │  text, regex, │
│ Wait       │                                               │  timeout,     │
│ Logic      │                                               │  retry, vars  │
│ Data       │                                               │              │
│ Control    │                                               │  [Test node]  │
│ Terminal   │   ┌ minimap ┐                                  │              │
└───────────┴───┴──────────┴──────────────────────────────┴──────────────┘
```

- **Palette (left):** node types grouped by category (Trigger, Action, Wait, Logic, Data, Control, Terminal — matching [BLUEPRINT.md §8](./BLUEPRINT.md#8-node-system)). Drag onto canvas.
- **Canvas (center):** pan/zoom, snap-to-grid, multi-select, copy/paste, undo/redo, minimap, fit-to-view. Edges drawn port→port; branching ports labeled (`matched`/`no-match`, `true`/`false`, `timeout`).
- **Config panel (right):** context form for the selected node — text, button match, regex (monospace), condition expression, timeout, retry, variable names. Live validation.

### 8.2 Node visual anatomy

```
┌─────────────────────────────┐
│ ◧ icon   NODE TITLE      ⋮   │   ← category color stripe on left edge
│ ─────────────────────────── │
│ summary of config           │   e.g. "send: /beli"
│                             │
│ ○ in            out ●  ●    │   ← ports; multiple outs for branches
└─────────────────────────────┘
```

- **Category color stripe** (left edge) keyed to node category; status halo when running (`--running`), green on success (`--success`), red on failure (`--danger`).
- Ports are clear circles; hover highlights valid drop targets.
- Selected node = `--brand-accent` outline.

### 8.3 Node category colors (canvas)

| Category | Stripe token |
|---|---|
| Trigger | `--brand` |
| Action | `--brand-accent` |
| Wait | `--warning` |
| Logic | `--info` |
| Data | `#8B5CF6` (violet) |
| Control | `--neutral` |
| Terminal (SUCCESS) | `--success` |
| Terminal (FAIL) | `--danger` |

### 8.4 Test mode overlay
- Pressing **Test ▶** runs the draft (see [BLUEPRINT.md §10.2](./BLUEPRINT.md#102-test-mode)).
- Nodes **light up in sequence**; the active node pulses; edges animate along the taken path.
- A bottom **execution drawer** streams: node, message sent, message received (monospace), match result, extracted vars, timing, errors.
- Controls: Pause · Resume · Step · Abort.
- Validation errors appear inline on nodes (red badge) before running.

---

## 9. Monitoring & Logs Views

Realtime views powered by the WebSocket stream (see [ARCHITECTURE.md §9](./ARCHITECTURE.md#9-dashboard--monitoring)).

### 9.1 Live Monitoring
- **Active executions list** (left): each row = order/execution id, workflow, supplier, current node, elapsed, status pill.
- **Execution detail** (right): the **same node graph** rendered read-only, lighting up live exactly like test mode; per-node input/output on click.
- **Controls per execution:** Pause · Resume · Retry (from failed node / from start) · Cancel — mapped to [BLUEPRINT.md §10.3](./BLUEPRINT.md#103-live-controls-production--test).

### 9.2 Logs
- **LiveLog** stream, color-coded by level and status token; filter by execution, supplier, level, time; search; pause/auto-scroll toggle; copy line; expand to full payload (JSONViewer).
- **Dead-letter panel:** failed jobs with retry/discard actions (see [ARCHITECTURE.md §7](./ARCHITECTURE.md#7-queue--worker)).
- **Audit log:** admin actions (see [ARCHITECTURE.md §10](./ARCHITECTURE.md#10-security)).

### 9.3 Log line format (visual)
```
12:04:31.882  ▸ exec#8421  SEND MESSAGE   → "/beli"                 ok  120ms
12:04:33.014  ▸ exec#8421  WAIT RESPONSE  ← "Pilih produk:"     matched 1.1s
12:04:33.020  ▸ exec#8421  EXTRACT DATA   account="a@b.com"    extracted
12:04:33.101  ▸ exec#8421  FAIL           reason="regex no-match"  ✕
```
Color: timestamp `--text-muted`, node type `--text`, status word by status token.

---

## 10. Dark Mode

- **Default theme is dark.** Light mode fully supported and toggleable (persisted per admin).
- Implemented via `data-theme` on `:root` + `@media (prefers-color-scheme)` fallback; all colors reference tokens from [§3](#3-color-system) so no component hardcodes hex.
- Canvas, logs, and charts each have tuned dark/light variants (e.g. canvas grid dots, edge contrast, log background).
- Contrast maintained at WCAG AA in both themes; status colors chosen to remain distinguishable in both.

---

## 11. Responsive Behavior

The dashboard is **desktop-first** (it's an operator console) but degrades gracefully.

| Breakpoint | Behavior |
|---|---|
| ≥1280px (default) | Full shell: sidebar + content + right panels side by side; canvas with palette + config panel. |
| 768–1279px | Sidebar collapses to icons; right-side drawers overlay instead of docking; tables scroll horizontally. |
| <768px (tablet/phone) | Monitoring, Orders, Overview become read-only-friendly stacked views; **workflow editing is not supported on small screens** — a notice suggests a larger display (editing the node graph needs canvas space). Live monitoring and order actions remain usable. |

- Tables → card lists on narrow widths.
- Modals become full-screen sheets on phones.
- The **environment badge** (`127.0.0.1:<PORT>`) stays visible at all sizes.

---

## 13. Metis-Inspired Refinements (Brand EakMail)

The dashboard should read as a **modern, professional SaaS admin panel**, using **[Metis](https://themewagon.github.io/metis/)** purely as a **style/layout reference** — layout patterns, density, card/table/chart treatment. **We do not copy the template**; EakMail has its own design system (everything above). This section refines the earlier sections toward that professional SaaS look and is the design brief the frontend realizes (build guide: [.claude/instructions/frontend-guide.md](./.claude/instructions/frontend-guide.md)).

### 13.1 What we borrow from Metis (as reference)
- **Two-column shell:** persistent left **sidebar** + top **navbar**, dense but clean content area — matches our shell in [§2](#2-layout).
- **Card-based KPI row** at the top of the Overview with metric + delta (e.g. "+12.5%") — our StatCards ([§7.1](#71-overview-dashboard-home)).
- **Clean data tables** with clear headers, row hover, status **badges**, and pagination.
- **Chart sections** with range toggles (7D/30D/90D/1Y).
- **Recent activity / recent orders** lists.
- **Quick-add modal** pattern for fast create actions.
- **Visual restraint:** generous spacing, subtle shadows, rounded corners, strong typographic hierarchy — professional, not flashy.

### 13.2 What stays distinctly EakMail (not Metis)
- **Dark-mode-first** (Metis is light-first) — see [§10](#10-dark-mode); EakMail palette from [§3](#3-color-system), not Bootstrap defaults.
- **Indigo→cyan brand** ([§3.1](#31-base-palette)), Inter + JetBrains Mono ([§4](#4-typography)) — not Metis's colors/fonts.
- **The workflow builder canvas** ([§8](#8-workflow-editor-canvas)) and **live monitoring** ([§9](#9-monitoring--logs-views)) — operator features Metis doesn't have; these are the product's signature and take design priority.
- **Local-first env badge** `127.0.0.1:<PORT>` in the navbar.

### 13.3 Sidebar (refined spec)
- Width 240px expanded / 64px collapsed; `--surface` bg, `--border` right divider.
- Brand mark at top; grouped nav with section labels. **Dashboard labels are in Bahasa Indonesia** (see [§14](#14-dashboard-language--bahasa-indonesia)) — e.g. **OPERASIONAL**: Ringkasan (Overview), Pesanan (Orders), Monitoring, Log · **KATALOG**: Produk (Products), Supplier, Akun (Accounts) · **BOT**: Pengaturan Bot (Bot Config) · **BUILDER**: Workflow Builder · **SISTEM**: Pembayaran (Payments), Pengaturan (Settings).
- Active item: `--brand` left indicator bar + tinted background; Lucide icon + label; hover raises contrast.
- Collapsible groups; state persisted per admin. Icons-only when collapsed with tooltips.

### 13.4 Navbar (top bar, refined spec)
- Height 56px, `--surface`, subtle bottom shadow.
- Left: sidebar toggle + breadcrumbs. Center/left: **global search / command palette** (`⌘K`).
- Right: **environment badge** (`127.0.0.1:<PORT>`), **health dot** (aggregate account/queue/worker health), theme toggle, notifications bell (with unread dot), admin avatar menu.

### 13.5 Cards & KPIs (refined spec)
- `--surface` bg, `--border` 1px, radius `12px`, soft shadow (elevation-1); 16–24px padding.
- **StatCard:** label (muted, 12px), big value (24px/600, tabular), delta pill colored `--success`/`--danger` with ▲/▼, optional sparkline (`--brand-accent`).
- Hover: elevation-2 (subtle). Cards align on the 12-col grid.

### 13.6 Tables (refined spec)
- Sticky header (`--surface-2`), 12–13px header caps in `--text-muted`; rows 44–48px, zebra optional, hover `--surface-2`.
- Right-aligned numeric columns (tabular figures); **StatusPill** column using status tokens ([§3.2](#32-semantic-status-colors)).
- Row actions in a trailing `⋮` menu; toolbar above with search, filters, column toggle; pagination + row count below.
- Empty state with icon + one-line guidance + primary action.

### 13.7 Forms & modals (refined spec)
- Labels above inputs; helper/error text below; 40px input height; focus ring `--brand-accent`.
- **Quick-add modal** (Metis-style) for fast create (product, supplier, account); larger flows use a right **Drawer**.
- **Secret fields** are write-only ("Set", masked) — never render stored secrets ([§5](#5-component-library), [ARCHITECTURE.md §10](./ARCHITECTURE.md#10-security)).
- Destructive actions use `ConfirmDialog` (danger-styled).

### 13.8 Badges / status pills (refined spec)
- Pill shape, 11–12px, medium weight, tinted bg + solid text of the same status token; a leading dot for quick scanning.
- Consistent across Orders, Executions, Accounts, Payments — the single mapping in [§3.2](#32-semantic-status-colors).

### 13.9 Charts (refined spec)
- Overview charts: **Orders over time** (area/line), **Success rate trend** (line), **Order status distribution** (donut), with **7D/30D/90D/1Y** range toggles (Metis pattern).
- Follow the `dataviz` guidance at build time; colors from tokens, legible in dark + light, tooltips on hover.

### 13.10 Elevation & radius scale
- Radius: `sm 8px` (inputs/badges), `md 12px` (cards/modals), `lg 16px` (canvas panels).
- Shadow: `elevation-0` none, `1` subtle (cards), `2` hover, `3` popovers/modals — tuned separately for dark/light.

### 13.11 Reference screen composition — Overview
```
┌ Navbar: ☰  breadcrumbs        ⌘K search        127.0.0.1:PORT ● theme 🔔 avatar ┐
├ Sidebar ┬───────────────────────────────────────────────────────────────────────┤
│ groups  │  [Orders Today ▲] [Success % ▲] [Revenue ▲] [Queue] [Active] [Accounts]│  ← StatCards
│         │  ┌ Orders over time (7D/30D/90D/1Y) ─────┐ ┌ Status distribution (donut)┐│
│         │  └───────────────────────────────────────┘ └────────────────────────────┘│
│         │  ┌ Recent orders (table + status pills) ──┐ ┌ Live executions ───────────┐│
│         │  └───────────────────────────────────────┘ └ Recent failures ───────────┘│
├─────────┴───────────────────────────────────────────────────────────────────────┤
│ Status bar: queue depth · active executions · worker ● · WS ●                       │
└─────────────────────────────────────────────────────────────────────────────────┘
```
This composition is the target "professional SaaS admin panel" look; the workflow builder ([§8](#8-workflow-editor-canvas)) and monitoring ([§9](#9-monitoring--logs-views)) remain the highest-investment, EakMail-unique screens.

---

## 14. Dashboard Language — Bahasa Indonesia

> **The admin dashboard UI is in Bahasa Indonesia** (single language, no switcher in v1). Requirement: [PRD.md §5.10 / F18 / FR-16](./PRD.md#510-dashboard-language-f18). The storefront bot stays bilingual separately ([§13.2](#132-what-stays-distinctly-eakmail-not-metis), [PRD.md §5.9](./PRD.md#59-storefront-bot-localization-f16)).

- **All user-visible dashboard copy is Indonesian:** navigation, page titles, buttons, table headers, form labels, empty states, toasts, confirmations, error messages.
- **Reference label mapping** (Indonesian shown in UI → English concept used in these docs/code):

| UI (Bahasa Indonesia) | Concept (docs/code) |
|---|---|
| Ringkasan | Overview |
| Pesanan | Orders |
| Produk | Products |
| Supplier | Supplier |
| Akun | (Telegram) Accounts |
| Pengaturan Bot | Bot Config |
| Pembayaran | Payments |
| Log | Logs |
| Pengaturan | Settings |
| Simpan / Batal / Hapus | Save / Cancel / Delete |
| Aktif / Nonaktif | Active / Inactive |
| Coba Lagi / Refund | Retry / Refund |

- **Technical/domain terms may remain English** where that is the norm and matches the glossary ([BLUEPRINT.md §2](./BLUEPRINT.md#2-core-concepts--glossary)): *workflow, node, webhook, timeout, retry, execution, supplier*. Keep this consistent — don't translate a term in one screen and keep it English in another.
- **Copy is Indonesian; code is English.** This is display-only and does **not** change the code standard: identifiers, file names, and API fields stay English per [.claude/rules/naming-conventions.md](./.claude/rules/naming-conventions.md). Even though there is no runtime language switcher, **do not hardcode Indonesian strings inline in components** — keep UI copy in a single strings module so it stays consistent and future EN support is cheap (see [.claude/instructions/frontend-guide.md](./.claude/instructions/frontend-guide.md)).
- Formatting: Rupiah currency (`Rp`), Indonesian date/number formatting where shown to the admin.

---

## 12. Consistency & Cross-References

- Every status color here maps to states defined in [ARCHITECTURE.md §6.3](./ARCHITECTURE.md#63-execution-lifecycle) and [BLUEPRINT.md §5.2](./BLUEPRINT.md#52-order-state-machine).
- Node categories/visuals correspond 1:1 to [BLUEPRINT.md §8 Node System](./BLUEPRINT.md#8-node-system).
- Screens correspond to dashboard sections in [BLUEPRINT.md §11](./BLUEPRINT.md#11-admin-dashboard) and requirements in [PRD.md](./PRD.md).
- Frontend stack & realtime transport: [ARCHITECTURE.md §2](./ARCHITECTURE.md#2-technology-stack-decisions), [§9](./ARCHITECTURE.md#9-dashboard--monitoring).
- Metis-inspired professional look: [§13](#13-metis-inspired-refinements-brand-eakmail); frontend realization: [.claude/instructions/frontend-guide.md](./.claude/instructions/frontend-guide.md).
- Governance (structure/quality/separation): [CLAUDE.md](./CLAUDE.md) and [.claude/rules/](./.claude/rules/).
- UI build tasks: [TASKS.md Phase 7](./TASKS.md#phase-7--dashboard-ui).
