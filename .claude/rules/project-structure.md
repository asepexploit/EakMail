# Rule: Project Structure

> **Binding.** Applies to every change. Cross-ref: [CLAUDE.md §2–4](../../CLAUDE.md#2-the-golden-rule-structure-discipline), [ARCHITECTURE.md](../../ARCHITECTURE.md).

The goal: a repository a senior developer can navigate in seconds, where every file's location and purpose is obvious.

---

## 1. Top-level layout

```
eakmail/
├── EakMail-frontend/     # all frontend (see §3)
├── EakMail-backend/      # all backend (see §4)
├── .claude/              # rules & instructions
├── ARCHITECTURE.md
├── BLUEPRINT.md
├── DESIGN_SYSTEM.md
├── PRD.md
├── TASKS.md
└── CLAUDE.md
```

Frontend and backend are **separate applications**, never merged. See [frontend-backend-separation.md](./frontend-backend-separation.md).

---

## 2. Universal structure principles

1. **Feature/domain-first, not type-first at scale.** Group by what the code *does* (e.g. `orders/`, `workflows/`), not only by technical type. Within a feature, small type folders (`components/`, `hooks/`) are fine.
2. **One responsibility per file.** A file does one clear thing named for that thing.
3. **Reasonable depth.** Aim for **≤ 4 levels** below an app root for normal code. If you need more, the design is probably wrong — reconsider before nesting deeper.
4. **No orphan/dead files or folders.** If nothing imports it and it isn't an entry point, it shouldn't exist.
5. **Index files sparingly.** Use `index.ts` barrels only to define a module's public surface — not to re-export everything and blur boundaries.
6. **Colocate what changes together.** A component's styles/tests/subcomponents live beside it.
7. **Names describe content, not vague buckets.** Avoid `utils/`, `helpers/`, `misc/`, `common/` as dumping grounds; prefer specific names (`format/`, `crypto/`, `telegram/`). A single narrow `lib/` for genuinely cross-cutting primitives is acceptable, kept small.
8. **Extend by pattern.** New code mirrors the structure of the closest existing feature. Do not invent a competing layout — see [code-quality.md](./code-quality.md) and §5.

---

## 3. `EakMail-frontend/` canonical structure

React + TypeScript + Vite. UI only. Detailed how-to: [instructions/frontend-guide.md](../instructions/frontend-guide.md).

```
EakMail-frontend/
├── src/
│   ├── app/                     # app shell, routing, providers
│   │   ├── App.tsx
│   │   ├── router.tsx
│   │   └── providers/           # query client, theme, auth providers
│   ├── pages/                   # one folder per route/page (thin — compose features)
│   │   ├── overview/
│   │   ├── suppliers/
│   │   ├── accounts/
│   │   ├── products/
│   │   ├── orders/
│   │   ├── monitoring/
│   │   ├── logs/
│   │   ├── payments/
│   │   ├── settings/
│   │   └── workflow-builder/
│   ├── features/                # feature logic grouped by domain
│   │   ├── orders/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── api/             # API client calls for this feature
│   │   │   └── types.ts         # local view types (shared types come from shared pkg)
│   │   ├── workflows/
│   │   │   ├── canvas/          # React Flow canvas
│   │   │   ├── nodes/           # one file per node's visual component
│   │   │   ├── config-panel/    # per-node config forms
│   │   │   └── ...
│   │   └── .../
│   ├── components/              # shared, presentational, design-system components
│   │   ├── ui/                  # Button, Input, Table, Badge, Modal, Card ...
│   │   ├── layout/              # AppShell, Sidebar, Navbar, StatusBar
│   │   └── charts/              # chart wrappers
│   ├── lib/                     # small cross-cutting FE primitives (api client, ws, format)
│   ├── stores/                  # Zustand stores (UI/local state)
│   ├── styles/                  # tailwind config entry, tokens, globals
│   └── main.tsx
├── public/
├── index.html
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── vite.config.ts
```

Rules specific to frontend:
- **Pages are thin.** A page composes features/components; it holds no heavy logic.
- **Design-system components** live in `components/ui/` and follow [DESIGN_SYSTEM.md](../../DESIGN_SYSTEM.md). One component per file.
- **Workflow nodes:** one file per node visual in `features/workflows/nodes/`; do not put all nodes in one file.
- **No backend logic** anywhere here (see [frontend-backend-separation.md](./frontend-backend-separation.md)).

---

## 4. `EakMail-backend/` canonical structure

Node.js + TypeScript. Server only. Detailed how-to: [instructions/backend-guide.md](../instructions/backend-guide.md).

```
EakMail-backend/
├── src/
│   ├── api/                     # Fastify HTTP + WS layer (thin controllers)
│   │   ├── routes/              # one file per resource (orders, suppliers, ...)
│   │   ├── middleware/
│   │   ├── ws/                  # websocket handlers
│   │   └── server.ts
│   ├── modules/                 # domain modules (business logic lives here)
│   │   ├── orders/
│   │   │   ├── order.service.ts
│   │   │   ├── order.repository.ts
│   │   │   └── order.types.ts
│   │   ├── suppliers/
│   │   ├── products/
│   │   ├── payments/            # Pakasir client, webhook, refund
│   │   ├── auth/
│   │   └── ...
│   ├── workflow/                # the workflow engine (see BLUEPRINT §8, ARCHITECTURE §6)
│   │   ├── engine/              # interpreter, execution lifecycle
│   │   ├── nodes/               # ONE FILE PER NODE TYPE executor
│   │   ├── registry.ts          # node registry
│   │   └── variables.ts         # {{var}} templating
│   ├── telegram/                # Telegram layer (ARCHITECTURE §4)
│   │   ├── bot/                 # storefront bot (Telegraf)
│   │   │   ├── handlers/        # one file per command (start, catalog, order, status, language)
│   │   │   └── i18n/            # bilingual message catalog — locales/id.ts, locales/en.ts, t() resolver (F16)
│   │   └── session-manager/     # MTProto (GramJS) pool
│   ├── queue/                   # BullMQ queues + workers
│   │   ├── queues.ts
│   │   └── workers/             # one file per worker
│   ├── db/                      # Prisma client, migrations, seed
│   │   ├── prisma/
│   │   └── repositories shared helpers
│   ├── lib/                     # small cross-cutting primitives (crypto, logger, config)
│   ├── config/                  # env schema + loader
│   └── index.ts                 # composition root / bootstrap
├── prisma/                      # schema.prisma, migrations (or under src/db)
├── package.json
├── tsconfig.json
└── Dockerfile
```

Rules specific to backend:
- **Layered per module:** `route (thin) → service (logic) → repository (data)`. Routes never contain business logic; repositories never contain HTTP.
- **One node executor per file** in `workflow/nodes/` — mirrors [BLUEPRINT.md §8](../../BLUEPRINT.md#8-node-system). Adding a node: [instructions/adding-a-node.md](../instructions/adding-a-node.md).
- **One worker per file** in `queue/workers/`.
- **Secrets/crypto** only in `lib/crypto` + the modules that need them; never leak to the API response shape (see [ARCHITECTURE.md §10](../../ARCHITECTURE.md#10-security)).
- **No frontend/UI code** anywhere here.

---

## 5. Changing the structure

- New code **must fit the existing pattern.** Find the nearest analogous feature and mirror it.
- A genuinely new *kind* of thing (new architectural layer) requires:
  1. updating this rule and [ARCHITECTURE.md](../../ARCHITECTURE.md),
  2. a one-line note of *why* in the PR/commit.
- Never introduce a second way to do something that already has a place. Consistency > personal preference.

---

## 6. Quick checklist

- [ ] File is in the correct app (`EakMail-frontend` / `EakMail-backend`).
- [ ] File is in the correct feature/module/layer folder.
- [ ] Depth is ≤ 4 levels below app root (or justified).
- [ ] Names follow [naming-conventions.md](./naming-conventions.md).
- [ ] No new `utils/misc/common` dumping ground.
- [ ] Nothing orphaned or duplicated.
