# Rule: Git Workflow

> **Binding.** Cross-ref: [documentation.md](./documentation.md), [TASKS.md](../../TASKS.md).

Keep history clean and reviewable, matching a senior team's habits.

---

## 1. Branches

- Never commit feature work directly to the default branch.
- Branch names: `type/short-description`, e.g. `feat/workflow-canvas`, `fix/pakasir-webhook-verify`, `docs/design-system-metis`.
- One branch per coherent unit of work (roughly one task/feature).

---

## 2. Commits

- **Conventional Commits**: `type(scope): summary`.
  - Types: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`, `style`, `perf`.
  - Scope = area, e.g. `feat(workflow): add extract-data node executor`, `docs(prd): add balance model decision`.
- Small, focused commits — one logical change each. Don't mix refactor + feature + docs in one commit.
- Commit the **doc updates together** with the code they describe (see [documentation.md](./documentation.md)).
- Do not commit secrets, `.env`, session strings, or generated artifacts that belong in `.gitignore`.

---

## 3. Scope hygiene

- A commit touching the frontend and backend for the *same* feature is fine, but keep FE and BE changes in separate commits where practical (they live in separate apps).
- Refactors that split a god file are their own commits (`refactor(...)`), separate from behavior changes — so review is easy.

---

## 4. Pull requests

- PR description states: what changed, which [TASKS.md](../../TASKS.md) phase/task, which [PRD.md](../../PRD.md) feature, and any doc updates.
- Confirm the change respects [frontend-backend-separation.md](./frontend-backend-separation.md) and [code-quality.md](./code-quality.md).
- Lint + typecheck + tests green before merge.

---

## 5. Checklist

- [ ] On a feature branch, not the default branch.
- [ ] Conventional-commit messages, focused commits.
- [ ] No secrets/artifacts committed.
- [ ] Docs updated in the same PR.
- [ ] Separation & quality rules respected.
