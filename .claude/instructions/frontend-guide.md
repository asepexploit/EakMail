# Instruction: Building the Frontend (Dashboard)

> How-to for `EakMail-frontend/`. Follow the binding rules first: [project-structure.md](../rules/project-structure.md), [frontend-backend-separation.md](../rules/frontend-backend-separation.md), [code-quality.md](../rules/code-quality.md), [naming-conventions.md](../rules/naming-conventions.md). Design source of truth: [DESIGN_SYSTEM.md](../../DESIGN_SYSTEM.md).

The dashboard is a **modern, professional SaaS admin panel**, styled as **Brand EakMail**, using [Metis](https://themewagon.github.io/metis/) only as a layout/style *reference*. See [DESIGN_SYSTEM.md §13](../../DESIGN_SYSTEM.md#13-metis-inspired-refinements-brand-eakmail).

---

## 1. Stack & entry

- React 18 + TypeScript + Vite, Tailwind + Radix, React Flow, TanStack Query + Zustand, WebSocket client. (Authoritative: [ARCHITECTURE.md §2](../../ARCHITECTURE.md#2-technology-stack-decisions).)
- Entry: `src/main.tsx` → `src/app/App.tsx` → `src/app/router.tsx` + providers.

---

## 2. Layering (thin pages, rich features)

```
pages/         thin route components — compose features & layout, no heavy logic
features/      domain logic: components + hooks + api client + local types
components/ui  design-system primitives (Button, Table, Badge, Modal, Card, ...)
components/layout  AppShell, Sidebar, Navbar, StatusBar
components/charts   chart wrappers
lib/           api client, ws client, formatters
stores/        Zustand UI state
styles/        tailwind entry, design tokens, globals
```

- A **page** wires a feature into a route; if it grows logic, push logic into the feature.
- A **feature** owns its API calls (`features/<x>/api/`), hooks (`useX`), and components.
- **Design-system components** are presentational and reusable; they don't fetch data.

---

## 3. Building a page (recipe)

1. Add the route in `app/router.tsx` and a folder in `pages/<name>/`.
2. Use `components/layout/AppShell` (sidebar + navbar + status bar) — see [DESIGN_SYSTEM.md §2](../../DESIGN_SYSTEM.md#2-layout).
3. Fetch via a feature hook using **TanStack Query** calling the feature's `api/` (typed with shared types — [shared-types.md](../rules/shared-types.md)).
4. Render with `components/ui/*`; status via `StatusBadge` colored by the tokens in [DESIGN_SYSTEM.md §3.2](../../DESIGN_SYSTEM.md#32-semantic-status-colors).
5. Keep the page file thin; extract sections into feature components before it bloats ([code-quality.md](../rules/code-quality.md)).

---

## 4. Design system usage

- **Never hardcode colors.** Use CSS variables / Tailwind tokens mapped to [DESIGN_SYSTEM.md §3](../../DESIGN_SYSTEM.md#3-color-system). Dark mode is default ([§10](../../DESIGN_SYSTEM.md#10-dark-mode)).
- Typography: Inter for UI, JetBrains Mono for data/logs/regex ([§4](../../DESIGN_SYSTEM.md#4-typography)).
- Components map to [DESIGN_SYSTEM.md §5](../../DESIGN_SYSTEM.md#5-component-library); one component per file.
- Follow the Metis-inspired look in [DESIGN_SYSTEM.md §13](../../DESIGN_SYSTEM.md#13-metis-inspired-refinements-brand-eakmail).
- **UI language is Bahasa Indonesia** (F18, [DESIGN_SYSTEM.md §14](../../DESIGN_SYSTEM.md#14-dashboard-language--bahasa-indonesia)). Put all display copy in a **single UI strings module** (e.g. `src/lib/strings.ts` or `src/styles`-adjacent `i18n/`), **never hardcode Indonesian text inline** in components. Code identifiers stay English ([../rules/naming-conventions.md](../rules/naming-conventions.md)). Format currency as Rupiah and dates/numbers in ID locale. No language switcher in v1, but centralizing copy keeps future EN cheap.

---

## 5. Realtime (monitoring & test mode)

- Use the WS client in `lib/` to subscribe to execution events ([ARCHITECTURE.md §9](../../ARCHITECTURE.md#9-dashboard--monitoring)).
- The monitoring view and the builder's test overlay render the **same** node graph read-only, lighting up per event ([DESIGN_SYSTEM.md §8.4](../../DESIGN_SYSTEM.md#84-test-mode-overlay), [§9.1](../../DESIGN_SYSTEM.md#91-live-monitoring)).
- Handle reconnect; never assume the socket is always up (show WS state in the status bar).

---

## 6. Workflow builder (React Flow)

- Lives in `features/workflows/`: `canvas/`, `nodes/` (one file per node visual), `config-panel/`.
- Node visuals implement the anatomy in [DESIGN_SYSTEM.md §8.2–8.3](../../DESIGN_SYSTEM.md#82-node-visual-anatomy); categories/colors from [BLUEPRINT.md §8](../../BLUEPRINT.md#8-node-system).
- The graph is the shared `WorkflowGraph` contract ([shared-types.md](../rules/shared-types.md)); do not invent a divergent frontend shape.
- Adding a node type: [adding-a-node.md](./adding-a-node.md).

---

## 7. Boundaries (do NOT)

- ❌ No business logic (order/refund/execution decisions) in the frontend — call the backend.
- ❌ No DB/Telegram/queue/payment code here.
- ❌ No secrets; secret inputs are write-only fields ([DESIGN_SYSTEM.md §5](../../DESIGN_SYSTEM.md#5-component-library)).

---

## 8. Checklist

- [ ] Page thin; logic in features/hooks.
- [ ] Colors/typography via design tokens; dark mode works.
- [ ] Data via typed feature API + TanStack Query.
- [ ] One component/hook per file; nothing trending to a god component.
- [ ] No backend logic or secrets present.
