# Instruction: Adding a Workflow Node Type

> The node system is the extension point of the whole product. Adding a node touches **both apps** through the **shared contract** — do it in lockstep. Rules: [shared-types.md](../rules/shared-types.md), [frontend-backend-separation.md](../rules/frontend-backend-separation.md), [code-quality.md](../rules/code-quality.md). Concept: [BLUEPRINT.md §8](../../BLUEPRINT.md#8-node-system).

A node type = **one file per side**, registered, never a giant switch.

---

## Steps

### 1. Define the contract (shared types)
- Add the `NodeType` enum member and the node's **config type** and **port** definitions to the shared types source ([shared-types.md](../rules/shared-types.md)).
- Ports must match [BLUEPRINT.md §8](../../BLUEPRINT.md#8-node-system) conventions (e.g. `matched`/`no-match`, `true`/`false`, `timeout`).

### 2. Document it
- Add the node to the catalog table in [BLUEPRINT.md §8](../../BLUEPRINT.md#8-node-system) (purpose, key config, outputs) — this is the single source of truth for the catalog.
- If it introduces a new category, add its color to [DESIGN_SYSTEM.md §8.3](../../DESIGN_SYSTEM.md#83-node-category-colors-canvas).

### 3. Backend executor
- Create `EakMail-backend/src/workflow/nodes/<node-name>.node.ts` implementing the common executor interface (input → does work via Session Manager if needed → output/ports/error).
- **Register** it in `workflow/registry.ts` (map `NodeType` → executor). Do not add a `switch` case anywhere.
- Respect per-node `timeout`/`retry` semantics ([PRD.md §9](../../PRD.md#9-error-handling--reliability)); emit step logs/events like other nodes.

### 4. Frontend visual + config
- Create `EakMail-frontend/src/features/workflows/nodes/<NodeName>Node.tsx` — the React Flow visual (anatomy: [DESIGN_SYSTEM.md §8.2](../../DESIGN_SYSTEM.md#82-node-visual-anatomy)).
- Register it in the canvas node-type map and add it to the palette (correct category).
- Create its config form in `features/workflows/config-panel/` using design-system inputs (regex fields monospace).

### 5. Validate & test
- Add builder validation (required config) consistent with existing nodes.
- Add a backend unit test for the executor (happy path + each output port + timeout/retry) against the mock supplier bot ([TASKS.md Phase 8](../../TASKS.md#phase-8--testing--hardening)).

---

## Do / Don't

- ✅ One executor file, one visual file, one config form; registered via maps.
- ✅ Config shape identical on both sides (from shared types).
- ❌ No node logic in a shared/god file; no growing switch statements.
- ❌ No backend work in the visual; no UI in the executor.

---

## Checklist

- [ ] Shared `NodeType` + config type + ports added (one source).
- [ ] [BLUEPRINT.md §8](../../BLUEPRINT.md#8-node-system) catalog updated (+ color if new category).
- [ ] Backend executor file + registry entry (no switch).
- [ ] Frontend visual + palette + config form.
- [ ] Validation + tests added.
