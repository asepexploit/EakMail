# Rule: Documentation Consistency

> **Binding.** Cross-ref: [CLAUDE.md §7](../../CLAUDE.md#7-workflow-for-every-change).

The `.md` docs are the project's source of truth. They must stay accurate and cross-referenced. Code that contradicts the docs is a bug in one of them.

---

## 1. The document set

| Doc | Owns |
|---|---|
| [CLAUDE.md](../../CLAUDE.md) | How we build (entry point). |
| [ARCHITECTURE.md](../../ARCHITECTURE.md) | Stack, system design, DB, security, deployment. |
| [BLUEPRINT.md](../../BLUEPRINT.md) | Concept, flows, node system, engine. |
| [DESIGN_SYSTEM.md](../../DESIGN_SYSTEM.md) | Dashboard UI/UX. |
| [PRD.md](../../PRD.md) | Requirements, features, user stories, risks. |
| [TASKS.md](../../TASKS.md) | Build plan, phases, DoD. |
| [.claude/](../) | Binding rules & instructions. |

---

## 2. When you MUST update docs

- **Architecture/stack change** → [ARCHITECTURE.md](../../ARCHITECTURE.md) (§2 stack, or relevant section) + [CLAUDE.md §5](../../CLAUDE.md#5-tech-stack-summary--authoritative-list-in-architecturemd) if the summary changes.
- **New/changed feature or requirement** → [PRD.md](../../PRD.md).
- **New flow / new node type / engine change** → [BLUEPRINT.md](../../BLUEPRINT.md) (§8 for nodes) + [shared-types.md](./shared-types.md) if the contract changes.
- **UI/component/design change** → [DESIGN_SYSTEM.md](../../DESIGN_SYSTEM.md).
- **New structural pattern / folder convention** → [project-structure.md](./project-structure.md).
- **Task/phase progress or scope change** → [TASKS.md](../../TASKS.md).

Docs are updated **in the same change** as the code, not "later".

---

## 3. Consistency requirements

- **Cross-reference, don't duplicate.** If a fact belongs to another doc, link to it (e.g. `[ARCHITECTURE.md §6](../../ARCHITECTURE.md#6-workflow-engine)`) rather than restating it and risking drift.
- **One source of truth per fact.** The node catalog lives in [BLUEPRINT.md §8](../../BLUEPRINT.md#8-node-system); other docs link to it.
- **Terms match the glossary** ([BLUEPRINT.md §2](../../BLUEPRINT.md#2-core-concepts--glossary)).
- **State names match** the state machines in the architecture/blueprint.
- **Anchors stay valid.** If you rename a heading, fix links that point to it.
- Every doc keeps its **Cross-Document Map / companion links** at the bottom current.

---

## 4. Style

- Markdown, GitHub-flavored. Use tables for enumerations, ASCII diagrams for flows/architecture (consistent with existing docs).
- Keep the "Last updated" line current when materially editing a doc.
- Do **not** put source code in the planning docs; document contracts and shapes conceptually. Code lives in the apps.

---

## 5. Checklist

- [ ] Docs affected by this change were updated in the same change.
- [ ] Facts are cross-referenced, not duplicated.
- [ ] Terminology and state names are consistent.
- [ ] Links/anchors still resolve.
