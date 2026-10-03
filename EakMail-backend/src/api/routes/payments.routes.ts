/**
 * Payment HTTP routes (thin: validate → delegate to service → shape response).
 * ARCHITECTURE.md §8; TASKS.md Phase 5.
 *
 *   POST /api/payments           create a Pakasir transaction for an order
 *   POST /api/payments/webhook   Pakasir webhook (raw body, HMAC-verified)
 *   GET  /api/payments/:orderId  current payment status (polling)
 *
 * The webhook needs the exact raw bytes for signature verification, so this plugin
 * registers a scoped raw-body parser for application/json on the webhook path.
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { PaymentMethod } from '@eakmail/shared-types';
import { AppError, ValidationError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { paymentService } from '../../modules/payments/index.js';
import { prisma } from '../../db/client.js';

const log = logger.child({ module: 'payments-routes' });

const createBody = z.object({
  orderId: z.string().min(1),
  method: z.nativeEnum(PaymentMethod),
});

const orderParams = z.object({
  orderId: z.string().min(1),
});

/** Pakasir sends a plain secret in X-Secret header for webhook authentication. */
function readSignature(req: FastifyRequest): string | undefined {
  const value = req.headers['x-secret'];
  return Array.isArray(value) ? value[0] : value;
}

export async function paymentsRoutes(app: FastifyInstance): Promise<void> {
  // Capture the raw JSON body (Buffer) for the webhook so HMAC verification sees the
  // exact bytes. Scoped to this plugin via a child instance.
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_req, body, done) => done(null, body),
  );

  // Paths are relative to this plugin's registration prefix ('/payments' under '/api'
  // in server.ts) → effective paths are /api/payments, /api/payments/webhook, etc.
  // List (dashboard Payments page) — Paginated<PaymentDto> to match the shared contract.
  app.get('/', async () => {
    const items = await paymentService.listPayments();
    return { items, total: items.length, page: 1, pageSize: items.length };
  });

  app.post('/', async (req, reply) => {
    // Body arrived as a Buffer via the parser above; decode + validate here.
    const parsed = createBody.safeParse(decodeJson(req.body));
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid request');

    const dto = await paymentService.createTransaction(parsed.data);
    return reply.code(201).send(dto);
  });

  app.post('/webhook', async (req, reply) => {
    const raw = req.body;
    if (!Buffer.isBuffer(raw)) throw new ValidationError('Expected raw webhook body');

    const signature = readSignature(req);
    // Log the incoming headers (omitting auth-sensitive values) to help diagnose signature issues.
    log.info(
      {
        hasXSecret: Boolean(signature),
        xSecretLen: signature?.length ?? 0,
        headers: Object.fromEntries(
          Object.entries(req.headers).filter(([k]) => !['authorization', 'cookie'].includes(k)),
        ),
        bodyLen: raw.length,
      },
      'Webhook received',
    );

    // verifyWebhook throws ValidationError on bad signature → mapped to 400 below.
    const event = await paymentService.verifyWebhook(raw, signature);
    log.info({ orderId: event.orderId, status: event.status }, 'Webhook processed');
    return reply.code(200).send({ received: true });
  });

  // Topup aggregate stats for the Overview dashboard.
  // Must be declared before /:orderId so "stats" is not treated as an orderId.
  app.get('/stats', async () => {
    const agg = await prisma.topupRequest.aggregate({
      where: { status: 'PAID' },
      _sum: { amount: true },
      _count: true,
    });
    return {
      totalTopupPaid: agg._sum.amount ?? 0,
      totalTopupCount: agg._count,
    };
  });

  app.get('/:orderId', async (req, reply) => {
    const parsed = orderParams.safeParse(req.params);
    if (!parsed.success) throw new ValidationError('Invalid orderId');
    const dto = await paymentService.getStatus(parsed.data.orderId);
    return reply.send(dto);
  });

  // Map domain errors → HTTP for this plugin's routes (secrets never surface here).
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof AppError) {
      return reply.code(err.httpStatus).send({ error: { code: err.code, message: err.message } });
    }
    log.error({ err }, 'Unhandled payments route error');
    return reply.code(500).send({ error: { code: 'INTERNAL', message: 'Internal error' } });
  });
}

/** Decode a Buffer/string/object request body into a plain JSON value. */
function decodeJson(body: unknown): unknown {
  if (Buffer.isBuffer(body)) {
    if (body.length === 0) return {};
    try {
      return JSON.parse(body.toString('utf8'));
    } catch {
      throw new ValidationError('Invalid JSON body');
    }
  }
  return body ?? {};
}
