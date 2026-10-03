# CLAUDE.md — EakMail Project Guide

> **This file is the primary guide for all development on EakMail.** Every change — by Claude or any developer — MUST follow the standards, structure, and conventions defined here and in [.claude/](./.claude/).
>
> **Read first, every session:** this file, then the relevant rule in [.claude/rules/](./.claude/rules/).

---

## 1. What is EakMail?

EakMail is a **self-hosted platform for selling digital goods on Telegram**, where fulfillment is automated by driving third-party Telegram supplier bots through a **no-code, n8n-style visual workflow builder**.

The full design lives in these documents — **do not restate their content, reference them**:

| Document | Purpose |
|---|---|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System architecture, tech stack, DB, security, deployment. |
| [BLUEPRINT.md](./BLUEPRINT.md) | Concept, all flows, node system, workflow engine, extraction. |
| [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) | Dashboard UI/UX, components, colors, typography, dark mode. |
| [PRD.md](./PRD.md) | Product requirements, features, user stories, risks. |
| [TASKS.md](./TASKS.md) | Phased, dependency-ordered build plan. |

**These documents are the source of truth for *what* to build. This file and `.claude/` are the source of truth for *how* to build it.**

---

## 2. The Golden Rule: Structure Discipline

> **EakMail is written to the standard of a senior / top-tier engineering team.**
> No god files. No god components. No dumping all logic into a few big files. Every file has one clear responsibility. When a file grows complex, it is split — before it becomes a problem, not after.

This is not optional polish. It is a hard requirement enforced on every change. The detailed, binding rules live in **[.claude/rules/project-structure.md](./.claude/rules/project-structure.md)** and **[.claude/rules/code-quality.md](./.claude/rules/code-quality.md)**. A short summary:

- **Consistent, clear naming** for folders and files.
- **Reasonable folder depth** — deep enough to organize, shallow enough to navigate.
- **One responsibility per file**; small, focused modules.
- **Split before it bloats** — a file trending large or complex is broken into smaller modules.
- **No unnecessary files or folders.**
- **The structure must be immediately understandable to another developer.**
- **Architecture changes stay within the defined structure** — you extend the pattern, you don't invent a competing one.

---

## 3. The Non-Negotiable: Frontend / Backend Separation

> **Frontend and backend are strictly separated. Frontend logic and backend logic are NEVER mixed.**

The repository has two clearly separated top-level applications:

```
eakmail/
├── EakMail-frontend/     ← ALL frontend (dashboard UI). React + TypeScript + Vite.
├── EakMail-backend/      ← ALL backend (API, worker, bots, engine). Node + TypeScript.
├── docs / *.md           ← ARCHITECTURE, BLUEPRINT, DESIGN_SYSTEM, PRD, TASKS, CLAUDE
└── .claude/              ← rules & instructions
```

Rules (full detail in [.claude/rules/frontend-backend-separation.md](./.claude/rules/frontend-backend-separation.md)):

- **`EakMail-frontend/`** contains only UI concerns: components, pages, state, styling, API *client* calls. It never contains business logic, DB access, Telegram/MTProto, queue, or payment secrets.
- **`EakMail-backend/`** contains only server concerns: API, workflow engine, Telegram layer, queue/worker, payment, DB. It never contains React/JSX/Tailwind/UI code.
- **The only contract between them is the HTTP/WebSocket API** plus **shared TypeScript types** (see the shared-types rule). No frontend importing backend internals, and vice versa.
- Aligns with [ARCHITECTURE.md §12 Deployment Topology](./ARCHITECTURE.md#12-deployment-topology).

---

## 4. Directory Structure (canonical)

The authoritative structure for both apps is defined in **[.claude/rules/project-structure.md](./.claude/rules/project-structure.md)**. Follow it exactly; extend it by pattern, never by exception.

Top level:

```
eakmail/
├── EakMail-frontend/
├── EakMail-backend/
├── .claude/
│   ├── README.md
│   ├── rules/
│   └── instructions/
├── ARCHITECTURE.md
├── BLUEPRINT.md
├── DESIGN_SYSTEM.md
├── PRD.md
├── TASKS.md
└── CLAUDE.md
```

---

## 5. Tech Stack (summary — authoritative list in ARCHITECTURE.md §2)

| Side | Stack |
|---|---|
| **Frontend** | React 18 + TypeScript + Vite, Tailwind CSS + Radix UI, React Flow (workflow canvas), TanStack Query + Zustand, WebSocket client. |
| **Backend** | Node.js 20 + TypeScript (strict), Fastify (REST + WS), BullMQ + Redis, PostgreSQL + Prisma, GramJS (MTProto), Telegraf (Bot API), Pakasir (payment). |

Do not introduce new frameworks/libraries without updating [ARCHITECTURE.md §2](./ARCHITECTURE.md#2-technology-stack-decisions) and noting it in the relevant task. See [.claude/rules/dependencies.md](./.claude/rules/dependencies.md).

---

## 6. Dashboard Design Direction

The dashboard must look like a **modern, professional SaaS admin panel**, using **[Metis](https://themewagon.github.io/metis/)** as a *style/layout reference only* — **never copy-paste the template**. EakMail has its **own** design system (Brand EakMail).

- Full design system: [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) (colors, typography, components, dark mode, responsive).
- Metis-inspired refinements (sidebar, navbar, cards, tables, charts, badges, forms, modals, workflow builder): [DESIGN_SYSTEM.md §13 Metis-Inspired Refinements](./DESIGN_SYSTEM.md#13-metis-inspired-refinements-brand-eakmail).
- Frontend structure that realizes it: [.claude/instructions/frontend-guide.md](./.claude/instructions/frontend-guide.md).

---

## 7. Workflow for Every Change

1. **Locate the relevant docs** — which phase in [TASKS.md](./TASKS.md), which feature in [PRD.md](./PRD.md).
2. **Read the applicable rule** in [.claude/rules/](./.claude/rules/).
3. **Place code in the correct app** (`EakMail-frontend` or `EakMail-backend`) and the correct folder per the structure rule.
4. **Keep files small and single-responsibility.** If a file is getting big/complex, split it now.
5. **Never mix frontend and backend concerns.**
6. **Update docs** if you change architecture, structure, stack, or requirements (see [.claude/rules/documentation.md](./.claude/rules/documentation.md)).
7. **Verify** against the phase's Definition of Done in [TASKS.md](./TASKS.md).

---

## 8. Definition of Done (per change)

- [ ] Code is in the correct app and folder; naming follows conventions.
- [ ] No file mixes frontend and backend logic.
- [ ] No god file/component; files are focused and reasonably sized.
- [ ] Types shared via the shared-types mechanism, not duplicated.
- [ ] Relevant `.md` docs updated if structure/architecture/requirements changed.
- [ ] Matches the design system for any UI.
- [ ] Lint + typecheck pass.

---

## 9. Index of Rules & Instructions

**Rules** (binding — [.claude/rules/](./.claude/rules/)):
- [project-structure.md](./.claude/rules/project-structure.md) — folders, files, depth, naming, canonical trees.
- [frontend-backend-separation.md](./.claude/rules/frontend-backend-separation.md) — the hard boundary.
- [code-quality.md](./.claude/rules/code-quality.md) — no god files, size/complexity limits, splitting.
- [naming-conventions.md](./.claude/rules/naming-conventions.md) — how to name everything.
- [shared-types.md](./.claude/rules/shared-types.md) — the FE/BE type contract.
- [documentation.md](./.claude/rules/documentation.md) — keep docs consistent & cross-referenced.
- [dependencies.md](./.claude/rules/dependencies.md) — adding libraries responsibly.
- [git-workflow.md](./.claude/rules/git-workflow.md) — commits, branches.

**Instructions** (how-to guides — [.claude/instructions/](./.claude/instructions/)):
- [frontend-guide.md](./.claude/instructions/frontend-guide.md) — building the dashboard.
- [backend-guide.md](./.claude/instructions/backend-guide.md) — building the API/engine/worker.
- [adding-a-node.md](./.claude/instructions/adding-a-node.md) — extending the workflow node system.
- [adding-a-feature.md](./.claude/instructions/adding-a-feature.md) — end-to-end feature checklist.
