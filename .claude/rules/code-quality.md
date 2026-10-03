# Rule: Code Quality — No God Files

> **Binding.** This is the heart of the "senior-grade" standard. Cross-ref: [CLAUDE.md §2](../../CLAUDE.md#2-the-golden-rule-structure-discipline), [project-structure.md](./project-structure.md).

Write code the way a strong senior engineer would: small, focused, obvious. The reader should never have to hold a whole file in their head.

---

## 1. One responsibility per file

- Each file does **one clear thing** and is named for it.
- If you can't describe a file's job in one short sentence without "and", it's doing too much — split it.
- A React component file renders one component (plus its tiny private subparts). A service file owns one domain's logic. A node executor file handles one node type.

---

## 2. Size & complexity guidelines (split *before* you exceed)

These are guidelines, not a linter's last word — but treat them as strong signals. **When approaching a limit, split proactively; don't wait to blow past it.**

| Thing | Soft target | Hard smell — split now |
|---|---|---|
| File length | ≤ ~200 lines | > ~300 lines |
| Function length | ≤ ~40 lines | > ~60 lines |
| React component | ≤ ~150 lines | > ~200 lines, or > ~5 responsibilities |
| Function parameters | ≤ 4 | > 4 → pass an options object |
| Nesting depth | ≤ 3 | > 3 → extract functions / early-return |
| Cyclomatic branches | modest | many `if/switch` → extract or use a map/registry |

Numbers are context-sensitive (a generated file, a config map, or a big `switch` registry may legitimately be longer) — but the *intent* is firm: **no god files.**

---

## 3. No god files / god components

Signs you're building a god file — stop and split:
- It handles multiple unrelated concerns (fetching + rendering + business rules + formatting).
- Everyone edits it for unrelated reasons (a "change magnet").
- It has many exports that aren't related to each other.
- A component manages many pieces of unrelated state and renders many unrelated sections.

**Fixes:**
- Extract sub-components into their own files (colocated).
- Extract hooks (`useX`) for stateful logic.
- Extract pure functions into a well-named module.
- Split a service into cohesive services; split a big route file per resource.
- Replace long `switch` chains with a **registry/map** (this is exactly how workflow nodes are organized — see [instructions/adding-a-node.md](../instructions/adding-a-node.md)).

---

## 4. When a file "starts to get complex"

Do not let it grow first. The moment a file starts mixing concerns or trending large:
1. Identify the distinct responsibilities inside it.
2. Give each its own file with a clear name.
3. Keep the original as a thin coordinator (or delete it if empty).
4. Update imports; ensure the public surface (barrel/index) stays clean.

Splitting is normal, expected maintenance — not a special event.

---

## 5. General quality bar

- **Strict TypeScript.** No `any` unless truly unavoidable and commented; prefer precise types.
- **Pure where possible.** Isolate side effects (I/O, network, DB) from pure logic.
- **Explicit over clever.** Readable beats terse.
- **Comments explain *why*, not *what*.** Match the surrounding code's comment density.
- **No dead code, no commented-out blocks left behind.**
- **Errors are handled**, not swallowed; follow the error taxonomy (see [instructions/backend-guide.md](../instructions/backend-guide.md) and [PRD.md §9](../../PRD.md#9-error-handling--reliability)).
- **Consistent style** enforced by ESLint + Prettier — don't fight it.

---

## 6. Checklist

- [ ] Each new/changed file has one clear responsibility.
- [ ] Nothing is trending toward a god file; complex files were split.
- [ ] Sizes within guidelines (or the exception is justified).
- [ ] No `any` leaks; types are precise.
- [ ] Long conditionals replaced by registries/maps where appropriate.
- [ ] No dead/commented-out code.
