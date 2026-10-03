# Instruction: Adding a Feature (end-to-end checklist)

> A repeatable path for any new feature that keeps structure, separation, and docs in order. Rules: all of [.claude/rules/](../rules/). Plan: [TASKS.md](../../TASKS.md). Requirements: [PRD.md](../../PRD.md).

---

## 1. Frame it
- Find the feature in [PRD.md §4](../../PRD.md#4-feature-overview) (or add it there with a user story + acceptance criteria).
- Find the owning phase/task in [TASKS.md](../../TASKS.md). If it's new scope, add the task under the right phase.
- Confirm which side(s) it touches: frontend, backend, or both across the API.

---

## 2. Design the contract (if it crosses the wire)
- Define request/response/event **shared types** ([shared-types.md](../rules/shared-types.md)) — one source, no duplication.
- If it changes the workflow graph, follow [adding-a-node.md](./adding-a-node.md) / update the graph contract and note the migration.

---

## 3. Backend
- Add/extend a module (`modules/<domain>/`) with `service` (logic) + `repository` (data) + `types`.
- Expose it via a thin route in `api/routes/`; validate input.
- Add queue/worker or engine changes if needed.
- Keep secrets server-side; audit sensitive actions. (See [backend-guide.md](./backend-guide.md).)

---

## 4. Frontend
- Add a feature folder (`features/<domain>/`) with `api/` (typed client), `hooks/`, `components/`.
- Add/extend a thin page in `pages/`; use design-system components and tokens.
- Wire realtime via the WS client if the feature is live. (See [frontend-guide.md](./frontend-guide.md).)

---

## 5. Keep it clean
- Files single-responsibility and within size guidelines; split proactively ([code-quality.md](../rules/code-quality.md)).
- Naming per [naming-conventions.md](../rules/naming-conventions.md).
- No FE/BE mixing ([frontend-backend-separation.md](../rules/frontend-backend-separation.md)).

---

## 6. Test
- Unit + integration per [TASKS.md Phase 8](../../TASKS.md#phase-8--testing--hardening).
- Cover the acceptance criteria from the user story.
- If it affects orders/payments: prove **no double-charge / no double-deliver**.

---

## 7. Document
- Update the affected `.md` docs in the **same change** ([documentation.md](../rules/documentation.md)).
- Tick the task in [TASKS.md](../../TASKS.md).

---

## 8. Commit
- Conventional commits, focused, FE/BE separable, docs included ([git-workflow.md](../rules/git-workflow.md)).

---

## Definition of Done
- [ ] PRD + TASKS reflect the feature.
- [ ] Shared types define any cross-wire shape.
- [ ] Backend: thin route → service → repository; secrets safe; validated.
- [ ] Frontend: feature + thin page; design system; realtime if needed.
- [ ] Separation + quality + naming rules respected.
- [ ] Tests cover acceptance criteria (and money-safety if relevant).
- [ ] Docs updated; lint + typecheck + tests green.
