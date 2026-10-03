# Instruction: Building the Backend (API / Engine / Worker / Bots)

> How-to for `EakMail-backend/`. Follow the binding rules first: [project-structure.md](../rules/project-structure.md), [frontend-backend-separation.md](../rules/frontend-backend-separation.md), [code-quality.md](../rules/code-quality.md), [naming-conventions.md](../rules/naming-conventions.md). System design: [ARCHITECTURE.md](../../ARCHITECTURE.md).

---

## 1. Stack & entry

- Node 20 + TypeScript (strict), Fastify (REST + WS), BullMQ + Redis, PostgreSQL + Prisma, GramJS (MTProto), Telegraf (Bot API), Pakasir. (Authoritative: [ARCHITECTURE.md §2](../../ARCHITECTURE.md#2-technology-stack-decisions).)
- Entry / composition root: `src/index.ts` boots config → db → queue → telegram → api.

---

## 2. Layering per module

```
api/routes/<resource>.routes.ts   thin: validate input, call service, shape response
modules/<domain>/<domain>.service.ts    business logic (the decisions)
modules/<domain>/<domain>.repository.ts data access (Prisma), no HTTP
modules/<domain>/<domain>.types.ts      local domain types
```

Hard rules:
- **Routes contain no business logic.** They validate (schema) and delegate.
- **Repositories contain no HTTP and no business rules.** Just data access.
- **Services never import Fastify request/response objects.** They take/return plain data.
- Cross-cutting primitives (crypto, logger, config) live in `lib/` and `config/`.

---

## 3. The workflow engine

Lives in `src/workflow/` (see [ARCHITECTURE.md §6](../../ARCHITECTURE.md#6-workflow-engine), [BLUEPRINT.md §8](../../BLUEPRINT.md#8-node-system)).

- `engine/` — interpreter + execution lifecycle (pause/resume/retry/cancel, checkpoint/resume).
- `nodes/` — **one file per node type** (`<node-name>.node.ts`), each implementing a common executor interface.
- `registry.ts` — maps `NodeType` → executor. **No giant switch**; register nodes here.
- `variables.ts` — `{{var}}` templating.
- Executes the shared `WorkflowGraph` contract ([shared-types.md](../rules/shared-types.md)); persists `execution` + `execution_step` per node; emits events to Redis pub/sub → WS.

Adding a node: [adding-a-node.md](./adding-a-node.md).

---

## 4. Telegram layer

`src/telegram/` (see [ARCHITECTURE.md §4](../../ARCHITECTURE.md#4-telegram-layer)):
- `bot/` — storefront bot (Telegraf), stateless handlers (one file per command in `bot/handlers/`), state in DB.
- `bot/i18n/` — **bilingual message catalog** (F16): `locales/id.ts` (default) + `locales/en.ts`, plus a `t(key, lang)` resolver with **fallback to `id`**. **No hardcoded customer-facing strings** anywhere in the bot — every user-visible message goes through `t()` using `customer.language`. `/language` switches and persists the choice. Only the storefront bot is localized (not the dashboard). See [PRD.md §5.9](../../PRD.md#59-storefront-bot-localization-f16).
- `session-manager/` — MTProto (GramJS) pool: login, encrypted sessions, `sendMessage`/`clickInlineButton`/`waitForMessage`, health (FLOOD_WAIT/ban), per-account rate limiting + human pacing.
- The engine talks to suppliers **only** through the Session Manager's controlled API.

---

## 5. Queue / workers

`src/queue/` (see [ARCHITECTURE.md §7](../../ARCHITECTURE.md#7-queue--worker)):
- `queues.ts` — queue definitions (`order-fulfillment`, `workflow-run`, `payment-poll`, `notifications`).
- `workers/` — **one worker per file**.
- Enforce **idempotency** (unique order key + delivery uniqueness) — never double-fulfill/deliver ([PRD.md FR-6](../../PRD.md#7-functional-requirements-selected-testable)).
- Per-account rate limits; exponential backoff; dead-letter retained for UI retry.

---

## 6. Payment (Pakasir)

`src/modules/payments/` (see [ARCHITECTURE.md §8](../../ARCHITECTURE.md#8-payment)):
- Client: `POST /api/v2/create-transaction/{slug}/{order_id}`, header `X-Api-Key`, body `{method, amount}`; respect 2 req/s.
- Webhook receiver: **verify signature/secret** before trusting → mark PAID → enqueue fulfillment.
- Polling fallback; refund path on failure.

---

## 7. Security (always)

- Secrets (session strings, API keys, webhook secret) **encrypted at rest** via `lib/crypto`, decrypted only where needed; **never** in an API response ([ARCHITECTURE.md §10](../../ARCHITECTURE.md#10-security)).
- Validate **every** input at the API boundary even with shared types ([shared-types.md](../rules/shared-types.md)).
- Auth: argon2id, HttpOnly SameSite cookie, optional TOTP.
- Audit-log sensitive admin actions.
- Default bind `127.0.0.1:<PORT>`.

---

## 8. Errors & reliability

- Central error taxonomy; services throw typed domain errors, the API layer maps them to HTTP.
- Never swallow errors; log with Pino (structured).
- Follow the failure/refund and resilience behaviors in [PRD.md §9](../../PRD.md#9-error-handling--reliability).

---

## 9. Boundaries (do NOT)

- ❌ No React/JSX/Tailwind/UI here.
- ❌ No business logic in routes or repositories.
- ❌ No secret in any response shape.

---

## 10. Checklist

- [ ] Route thin; logic in service; data in repository.
- [ ] New node = new file + registry entry (no switch bloat).
- [ ] Idempotency preserved; no double-deliver path.
- [ ] Inputs validated; secrets encrypted and never returned.
- [ ] Errors typed and logged; docs updated if design changed.
