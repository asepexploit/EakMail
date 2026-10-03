# Rule: Dependencies

> **Binding.** Cross-ref: [ARCHITECTURE.md §2](../../ARCHITECTURE.md#2-technology-stack-decisions), [code-quality.md](./code-quality.md).

The stack is chosen deliberately. Adding dependencies is a decision, not a reflex.

---

## 1. Before adding a library

Ask, in order:
1. **Is it already covered** by the chosen stack ([ARCHITECTURE.md §2](../../ARCHITECTURE.md#2-technology-stack-decisions))? Use what's there.
2. **Can a small amount of first-party code** do it clearly? Prefer that over a dependency for trivial needs.
3. **Is it well-maintained, popular, and typed?** Avoid abandoned or untyped packages.
4. **Does it belong on this side of the boundary?** A frontend-only lib never enters the backend and vice versa (see [frontend-backend-separation.md](./frontend-backend-separation.md)).

---

## 2. Rules

- ✅ New runtime deps go in the correct app's `package.json` (`EakMail-frontend` or `EakMail-backend`), never the other.
- ✅ Pin/keep lockfile committed; single package manager (pnpm) for the whole repo.
- ✅ If a new library changes the architecture (new framework, new datastore, new transport), update [ARCHITECTURE.md §2](../../ARCHITECTURE.md#2-technology-stack-decisions) and note *why* — see [documentation.md](./documentation.md).
- ❌ No duplicate libraries that do the same job (one HTTP client, one date lib, one state lib).
- ❌ No pulling a heavy framework for a one-off need.
- ❌ No dependency that requires shipping backend secrets to the client.

---

## 3. Security

- Review new deps for obvious risk; avoid packages that request broad system access without reason.
- Keep security-sensitive areas (crypto, auth, payment, Telegram session handling) on **vetted, standard** libraries — do not hand-roll crypto.

---

## 4. Checklist

- [ ] Not already solvable with the existing stack.
- [ ] Added to the correct app only.
- [ ] Maintained, typed, single-purpose (no duplicate).
- [ ] Architecture doc updated if the stack changed.
