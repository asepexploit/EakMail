# Rule: Naming Conventions

> **Binding.** Cross-ref: [project-structure.md](./project-structure.md), [code-quality.md](./code-quality.md).

Consistent names make the codebase navigable without documentation. Pick the convention below and never deviate within its scope.

---

## 1. Folders

- **`kebab-case`** for all folders: `workflow-builder/`, `session-manager/`, `config-panel/`.
- Names describe a **domain or concern**, not a vague bucket. Banned as generic dumping grounds: `misc/`, `stuff/`, `helpers/` (as a catch-all). A narrow, specific `lib/` for cross-cutting primitives is allowed and kept small.
- Plural for collections of like things (`nodes/`, `routes/`, `workers/`, `components/`), singular for a single concept (`engine/`, `auth/`).

---

## 2. Files

| Kind | Convention | Example |
|---|---|---|
| React component | `PascalCase.tsx` | `OrderTable.tsx`, `StatusBadge.tsx` |
| React hook | `useX.ts` (camelCase, `use` prefix) | `useLiveExecution.ts` |
| Backend service | `<domain>.service.ts` | `order.service.ts` |
| Backend repository | `<domain>.repository.ts` | `order.repository.ts` |
| Backend route | `<resource>.routes.ts` | `orders.routes.ts` |
| Types (local) | `<domain>.types.ts` or `types.ts` | `order.types.ts` |
| Node executor (backend) | `<node-name>.node.ts` | `extract-data.node.ts` |
| Node visual (frontend) | `<NodeName>Node.tsx` | `ExtractDataNode.tsx` |
| Worker | `<name>.worker.ts` | `order-fulfillment.worker.ts` |
| Test | `<name>.test.ts` / `.spec.ts` | `order.service.test.ts` |
| Config/entry | lowercase | `server.ts`, `router.tsx`, `config/index.ts` |

- One primary export per file; the file name matches that export.
- Avoid `index.ts` except as a deliberate public barrel for a module.

---

## 3. Symbols (in code)

| Symbol | Convention | Example |
|---|---|---|
| Variables, functions | `camelCase` | `createTransaction`, `activeExecution` |
| React components | `PascalCase` | `WorkflowCanvas` |
| Types, interfaces, enums | `PascalCase` | `OrderStatus`, `WorkflowNode` |
| Enum members / constants | `UPPER_SNAKE_CASE` | `OrderStatus.PENDING`, `MAX_RETRIES` |
| Booleans | `is/has/should/can` prefix | `isHealthy`, `hasTimedOut` |
| Async that returns a promise | verb phrase | `fetchOrders`, `runWorkflow` |
| Event names / WS channels | `kebab` or `namespaced.dot` | `execution.step`, `order-fulfillment` |

- **No abbreviations** except well-known ones (`id`, `url`, `db`, `ws`, `api`). Prefer `execution` over `exec` in names except where an established short form is used consistently (`exec#8421` in logs).
- Domain terms match the docs' glossary ([BLUEPRINT.md §2](../../BLUEPRINT.md#2-core-concepts--glossary)): `supplier`, `workflow`, `execution`, `node`, `delivery`, `session`.

---

## 4. Consistency across FE/BE

- The same concept uses the same word everywhere (an `execution` is never a `run` in one place and `execution` in another).
- Shared type names ([shared-types.md](./shared-types.md)) are used verbatim on both sides.
- State enum values match the state machines in [ARCHITECTURE.md §6.3](../../ARCHITECTURE.md#63-execution-lifecycle) and [BLUEPRINT.md §5.2](../../BLUEPRINT.md#52-order-state-machine).

---

## 5. Language: code is English, copy may be localized

The dashboard UI is displayed in **Bahasa Indonesia** (F18) and the storefront bot is bilingual (F16), but that is **display copy only**. It does not change how we name code.

- **Code is always English:** identifiers (variables, functions, types, components), file/folder names, DB columns, API fields, enum values, commit messages, comments.
- **User-facing copy is localized text, kept out of code:**
  - Dashboard: Indonesian strings live in a single **UI strings module** ([instructions/frontend-guide.md](../instructions/frontend-guide.md), [DESIGN_SYSTEM.md §14](../../DESIGN_SYSTEM.md#14-dashboard-language--bahasa-indonesia)) — never hardcoded inline in components.
  - Storefront bot: copy lives in the **i18n message catalog** + `bot_config` overrides ([instructions/backend-guide.md](../instructions/backend-guide.md)) — never hardcoded inline in handlers.
- ❌ Do not name a variable/function/field in Indonesian (no `hargaProduk`, use `productPrice`).
- ❌ Do not scatter display strings across components/handlers; centralize them.

---

## 6. Checklist

- [ ] Folder is `kebab-case`, specific, not a dumping ground.
- [ ] File name matches its convention and primary export.
- [ ] Symbols follow the case table.
- [ ] Concept named identically to the docs' glossary and to the other app.
- [ ] Code identifiers are English; user-facing copy is centralized (strings module / i18n catalog), not inline.
