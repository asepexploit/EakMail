/**
 * Broadcast HTTP routes (customer messaging). Thin controller: validate with zod → delegate
 * to the service → shape the response. No business logic here (backend-guide.md §2).
 * Registered by the API server under the `/api/broadcast` prefix.
 *
 *   GET  /api/broadcast   broadcast history (newest first) as BroadcastDto[]
 *   POST /api/broadcast   create a broadcast, enqueue the fan-out, return BroadcastDto
 *
 * POST never blocks on the send — the service enqueues and returns immediately (the broadcast
 * worker owns delivery).
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ValidationError } from '../../lib/errors.js';
import { broadcastService } from '../../modules/broadcast/broadcast.service.js';

const createSchema = z.object({
  message: z.string().min(1).max(4096),
  imageUrl: z.string().url().nullish(),
});

/** Parse with zod, converting failures to the domain ValidationError (mapped to 400). */
function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(result.error.issues.map((i) => i.message).join('; '));
  }
  return result.data;
}

/** The authenticated admin id, when the auth guard has populated it; null otherwise. */
function adminId(request: FastifyRequest): string | null {
  return request.admin?.id ?? null;
}

export async function broadcastRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async () => {
    return broadcastService.list();
  });

  app.post('/', async (request, reply) => {
    const body = parse(createSchema, request.body);
    const created = await broadcastService.createAndEnqueue({
      message: body.message,
      imageUrl: body.imageUrl ?? null,
      adminId: adminId(request),
    });
    return reply.code(201).send(created);
  });
}
