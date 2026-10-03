/**
 * Customers HTTP routes (thin controller: validate with zod → delegate to the service →
 * return the DTO). No business logic here (backend-guide.md §2).
 * Registered by the API server under the `/api/customers` prefix.
 *
 *   GET   /api/customers        paginated list (search / language / blocked filters)
 *   GET   /api/customers/stats  dashboard summary counters
 *   GET   /api/customers/:id    single customer + order metrics
 *   PATCH /api/customers/:id    admin update (block/unblock, adjust balance)
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Language } from '@eakmail/shared-types';
import { ValidationError } from '../../lib/errors.js';
import { customerService } from '../../modules/customers/index.js';
import { balanceService } from '../../modules/customers/balance.service.js';

const listQuerySchema = z.object({
  search: z.string().min(1).max(200).optional(),
  language: z.nativeEnum(Language).optional(),
  // Query strings arrive as text; accept the usual truthy/falsy spellings and map to boolean.
  blocked: z
    .enum(['true', 'false', '1', '0'])
    .transform((v) => v === 'true' || v === '1')
    .optional(),
  page: z.coerce.number().int().positive().optional(),
  // Dashboard views request up to a few hundred rows at once; allow a sane upper bound
  // (consistent with orders/executions) so those pages don't 400.
  pageSize: z.coerce.number().int().positive().max(500).optional(),
});

const idParamSchema = z.object({ id: z.string().min(1) });

const updateBodySchema = z
  .object({
    isBlocked: z.boolean().optional(),
    balance: z.number().int().min(0).optional(),
  })
  .refine((body) => body.isBlocked !== undefined || body.balance !== undefined, {
    message: 'No fields to update',
  });

/** Parse with zod, converting failures to the domain ValidationError (mapped to 400). */
function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(result.error.issues.map((i) => i.message).join('; '));
  }
  return result.data;
}

export async function customersRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async (request) => {
    // Parsed inline (not via the shared `parse<T>` helper) because the query schema
    // transforms `blocked` from text to boolean, so its input and output types differ.
    const result = listQuerySchema.safeParse(request.query);
    if (!result.success) {
      throw new ValidationError(result.error.issues.map((i) => i.message).join('; '));
    }
    return customerService.listCustomers(result.data);
  });

  app.get('/stats', async () => {
    return customerService.getStats();
  });

  app.get('/:id', async (request) => {
    const { id } = parse(idParamSchema, request.params);
    return customerService.getCustomer(id);
  });

  app.patch('/:id', async (request) => {
    const { id } = parse(idParamSchema, request.params);
    const body = parse(updateBodySchema, request.body ?? {});
    return customerService.updateCustomer(id, body);
  });

  /** POST /api/customers/:id/balance — admin adds balance to a customer. */
  app.post('/:id/balance', async (request, reply) => {
    const { id } = parse(idParamSchema, request.params);
    const { amount, note } = parse(
      z.object({
        amount: z.number().int().positive(),
        note: z.string().max(200).nullish(),
      }),
      request.body,
    );
    const result = await balanceService.topup(id, amount, note ?? undefined);
    return reply.code(200).send(result);
  });

  /** GET /api/customers/:id/balance/history — balance transaction log. */
  app.get('/:id/balance/history', async (request) => {
    const { id } = parse(idParamSchema, request.params);
    const items = await balanceService.listTransactions(id);
    return { items };
  });
}
