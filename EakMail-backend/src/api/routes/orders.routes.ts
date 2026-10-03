/**
 * Orders HTTP routes (thin controller: validate with zod → delegate to the service →
 * shape the response). No business logic here (backend-guide.md §2).
 * Registered by the API server under the `/api/orders` prefix.
 *
 *   GET  /api/orders            paginated list (filter by status / customer)
 *   GET  /api/orders/:id        order detail (payment + delivery timestamp)
 *   POST /api/orders/:id/retry  re-arm a failed order and re-enqueue fulfillment
 *   POST /api/orders/:id/refund enter the refund path for a failed-after-payment order
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { OrderStatus } from '@eakmail/shared-types';
import { ValidationError } from '../../lib/errors.js';
import { orderService } from '../../modules/orders/order.service.js';

const listQuerySchema = z.object({
  status: z.nativeEnum(OrderStatus).optional(),
  customerId: z.string().min(1).optional(),
  page: z.coerce.number().int().positive().optional(),
  // Dashboard views (Overview/Orders) request up to a few hundred rows at once; allow
  // a sane upper bound rather than a strict 100 so those pages don't 400.
  pageSize: z.coerce.number().int().positive().max(500).optional(),
});

const idParamSchema = z.object({ id: z.string().min(1) });

const refundBodySchema = z.object({
  /** Optional pre-localized customer notice (the bot i18n catalog owns the copy). */
  notifyText: z.string().min(1).max(4096).optional(),
});

/** Parse with zod, converting failures to the domain ValidationError (mapped to 400). */
function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(result.error.issues.map((i) => i.message).join('; '));
  }
  return result.data;
}

export async function ordersRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async (request) => {
    const query = parse(listQuerySchema, request.query);
    return orderService.listOrders(query);
  });

  app.get('/:id', async (request) => {
    const { id } = parse(idParamSchema, request.params);
    return orderService.getOrder(id);
  });

  app.post('/:id/retry', async (request) => {
    const { id } = parse(idParamSchema, request.params);
    return orderService.retryOrder(id);
  });

  app.post('/:id/refund', async (request) => {
    const { id } = parse(idParamSchema, request.params);
    const body = parse(refundBodySchema, request.body ?? {});
    return orderService.refundOrder(id, body.notifyText);
  });
}
