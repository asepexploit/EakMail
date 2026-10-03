# Rule: Shared Types (the FE/BE contract)

> **Binding.** Cross-ref: [frontend-backend-separation.md](./frontend-backend-separation.md), [ARCHITECTURE.md §6](../../ARCHITECTURE.md#6-workflow-engine).

Frontend and backend must agree on data shapes **without importing each other's code**. The agreement is a set of shared TypeScript types.

---

## 1. What is shared

Only **types/interfaces/enums** for things that cross the API/WebSocket boundary:
- API request & response DTOs.
- WebSocket event payloads (execution events, live logs).
- Domain enums used on both sides: `OrderStatus`, `ExecutionState`, `NodeType`, `AccountStatus`.
- The **workflow graph contract**: `WorkflowNode`, `WorkflowEdge`, `WorkflowGraph`, per-node config shapes — the same contract the engine executes and the builder edits (see [TASKS.md Phase 4](../../TASKS.md#phase-4--supplier--workflow-engine): *"freeze the execution contract"*).

**Never shared:** runtime code, business logic, DB models, secrets, framework objects.

---

## 2. Where shared types live

Choose one mechanism and use it consistently (decide in [TASKS.md Phase 0](../../TASKS.md#phase-0--foundation)):

- **Preferred:** a dedicated types package, e.g. `packages/shared-types/` (published to the workspace), imported by both apps as `@eakmail/shared-types`.
- Types are **hand-authored** or **generated from a single source** (e.g. from Zod schemas / OpenAPI). If generated, the generator's source lives in the backend and the output is consumed read-only by the frontend.

Whatever the mechanism: **one source of truth, zero duplication.**

---

## 3. Rules

- ✅ Both apps import the same type for a payload; neither redeclares it.
- ✅ The backend **validates** incoming data at runtime at the API boundary even though the type is shared (types are compile-time only; never trust the client).
- ✅ Local, presentation-only view types may live inside a feature (`features/*/types.ts`) — but anything crossing the wire uses the shared source.
- ❌ Copy-pasting a type from backend to frontend.
- ❌ Putting logic or classes with methods in the shared types (types/interfaces/enums + pure type utilities only).
- ❌ Leaking secret-bearing fields into a shared response type.

---

## 4. Evolving the contract

- Change the shared type in **one place**; both apps pick it up.
- A breaking change to the **workflow graph contract** requires updating the engine ([backend](../instructions/backend-guide.md)), the builder ([frontend](../instructions/frontend-guide.md)), and possibly a migration for stored `workflow.graph` — coordinate and note it (see [documentation.md](./documentation.md)).

---

## 5. Checklist

- [ ] Cross-boundary shape comes from the shared source, not duplicated.
- [ ] Backend validates the payload at runtime.
- [ ] No secrets in shared response types.
- [ ] Workflow-graph changes updated on both sides (+ migration if needed).
