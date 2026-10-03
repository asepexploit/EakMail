# Rule: Frontend / Backend Separation

> **Binding & non-negotiable.** Cross-ref: [CLAUDE.md §3](../../CLAUDE.md#3-the-non-negotiable-frontend--backend-separation), [project-structure.md](./project-structure.md), [shared-types.md](./shared-types.md).

Frontend and backend are two **separate applications** with a single, explicit contract between them. Their logic is **never** mixed.

---

## 1. The boundary

```
┌─────────────────────┐        HTTP (REST) + WebSocket        ┌─────────────────────┐
│  EakMail-frontend   │  ───────────────────────────────────► │  EakMail-backend    │
│  (React dashboard)  │  ◄─────────────────────────────────── │  (API/engine/worker)│
└─────────────────────┘        + shared TypeScript types       └─────────────────────┘
```

**The ONLY things that cross the boundary:**
1. HTTP/REST + WebSocket calls (runtime).
2. Shared TypeScript **types** for request/response/event payloads (compile-time — see [shared-types.md](./shared-types.md)).

Nothing else. No shared runtime code, no cross-imports of internals.

---

## 2. What belongs where

### `EakMail-frontend/` — ONLY
- React components, pages, hooks, routing.
- UI state (Zustand), server-state caching (TanStack Query).
- Styling (Tailwind, design system), charts, the React Flow canvas.
- **API client** code that *calls* the backend and shapes responses for display.

### `EakMail-backend/` — ONLY
- Fastify API (REST + WS), controllers, middleware.
- Business logic (services), data access (repositories, Prisma).
- Workflow engine, Telegram layer (Bot API + MTProto), queue/workers.
- Payment (Pakasir), secrets/crypto, config.

---

## 3. Forbidden (hard fails)

- ❌ Any React/JSX/TSX, Tailwind, or DOM code inside `EakMail-backend/`.
- ❌ Any DB query, Prisma, Telegram/MTProto, BullMQ, or payment-secret code inside `EakMail-frontend/`.
- ❌ Frontend importing from `EakMail-backend/src/**` (or vice versa).
- ❌ Business rules implemented in the frontend (e.g. computing refund eligibility, deciding order state). The frontend *displays* state; the backend *decides* it.
- ❌ Secrets (session strings, API keys, webhook secrets) ever reaching the frontend or an API response body. See [ARCHITECTURE.md §10](../../ARCHITECTURE.md#10-security).
- ❌ A single package/folder that contains both apps' code.

---

## 4. Allowed & required

- ✅ Frontend calls backend via a typed API client in `EakMail-frontend/src/features/*/api/` or `src/lib/`.
- ✅ Both apps import request/response/event **types** from the shared type source ([shared-types.md](./shared-types.md)).
- ✅ Backend validates every input at the API boundary (never trust the client), even though types are shared.
- ✅ Realtime execution events flow backend → frontend over WebSocket only ([ARCHITECTURE.md §9](../../ARCHITECTURE.md#9-dashboard--monitoring)).

---

## 5. Why this matters

- Independent deploy/scale (see [ARCHITECTURE.md §12](../../ARCHITECTURE.md#12-deployment-topology)).
- Security: automation and payment secrets are physically absent from anything shipped to a browser.
- Clarity: a developer always knows where a piece of logic lives.

---

## 6. Checklist

- [ ] New code is in exactly one app.
- [ ] No forbidden imports across the boundary.
- [ ] Business decisions live in the backend.
- [ ] Shared data shapes come from the shared types, not duplicated.
- [ ] No secret can appear in a frontend bundle or API response.
