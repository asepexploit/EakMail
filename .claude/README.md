# .claude/ — Rules & Instructions for EakMail

This directory holds the **binding engineering rules** and **how-to instructions** for developing EakMail. It is read alongside the top-level [CLAUDE.md](../CLAUDE.md).

- **[rules/](./rules/)** — *binding* constraints. Every change MUST comply. If a change would violate a rule, the rule wins; update the rule deliberately (with reason) rather than quietly breaking it.
- **[instructions/](./instructions/)** — *how-to* guides for common development tasks. Follow them to stay consistent with the established patterns.

## Precedence

When guidance conflicts, resolve in this order:

1. **[.claude/rules/](./rules/)** (binding)
2. **[CLAUDE.md](../CLAUDE.md)** (project guide)
3. Design docs: [ARCHITECTURE.md](../ARCHITECTURE.md), [BLUEPRINT.md](../BLUEPRINT.md), [DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md), [PRD.md](../PRD.md), [TASKS.md](../TASKS.md)
4. **[.claude/instructions/](./instructions/)** (how-to)

If rules and design docs genuinely disagree, stop and reconcile them — update whichever is wrong so they agree again (see [rules/documentation.md](./rules/documentation.md)).

## Rules index

| Rule | Enforces |
|---|---|
| [project-structure.md](./rules/project-structure.md) | Folder/file organization, depth, canonical trees. |
| [frontend-backend-separation.md](./rules/frontend-backend-separation.md) | Strict FE/BE boundary. |
| [code-quality.md](./rules/code-quality.md) | No god files, size/complexity limits, splitting. |
| [naming-conventions.md](./rules/naming-conventions.md) | Naming for folders, files, symbols. |
| [shared-types.md](./rules/shared-types.md) | The FE/BE shared type contract. |
| [documentation.md](./rules/documentation.md) | Keeping docs consistent & cross-referenced. |
| [dependencies.md](./rules/dependencies.md) | Adding libraries responsibly. |
| [git-workflow.md](./rules/git-workflow.md) | Commits, branches, PRs. |

## Instructions index

| Instruction | For |
|---|---|
| [frontend-guide.md](./instructions/frontend-guide.md) | Building the dashboard UI. |
| [backend-guide.md](./instructions/backend-guide.md) | Building API / engine / worker / bots. |
| [adding-a-node.md](./instructions/adding-a-node.md) | Adding a workflow node type. |
| [adding-a-feature.md](./instructions/adding-a-feature.md) | End-to-end feature checklist. |
