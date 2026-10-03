/**
 * Supplier HTTP routes (thin controllers). Validate input with Zod, delegate to
 * the service, shape the response. No business logic here. Registered by the
 * composition root under the /api prefix. See backend-guide.md §2.
 */
import type {
  IdParam,
  Paginated,
  SupplierDto,
  UpsertSupplierRequest,
  ApiSupplierSyncResponse,
} from '@eakmail/shared-types';
import { SupplierType } from '@eakmail/shared-types';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ValidationError } from '../../lib/errors.js';
import * as supplierService from '../../modules/suppliers/supplier.service.js';
import { writeAudit } from '../middleware/audit.js';

const upsertSupplierSchema = z.object({
  name: z.string().min(1),
  supplierType: z.enum(['bot', 'api']).optional(),
  // BOT fields
  botUsername: z.string().optional(),
  accountIds: z.array(z.string().min(1)).optional(),
  defaultWorkflowId: z.string().min(1).nullable().optional(),
  // API fields
  apiBaseUrl: z.string().url().nullable().optional(),
  apiKey: z.string().nullable().optional(),       // write-only, stored encrypted
  apiAuthHeader: z.string().nullable().optional(),
});

const idParamSchema = z.object({ id: z.string().min(1) });

function parseBody(body: unknown): UpsertSupplierRequest {
  const result = upsertSupplierSchema.safeParse(body);
  if (!result.success) {
    throw new ValidationError(result.error.issues[0]?.message ?? 'Invalid supplier payload.');
  }
  return {
    ...result.data,
    supplierType: result.data.supplierType as SupplierType | undefined,
    accountIds: result.data.accountIds ?? [],
    botUsername: result.data.botUsername ?? '',
  };
}

function parseId(params: unknown): string {
  const result = idParamSchema.safeParse(params);
  if (!result.success) throw new ValidationError('Invalid supplier id.');
  return result.data.id;
}

export const suppliersRoutes: FastifyPluginAsync = async (app) => {
  app.get('/suppliers', async (): Promise<Paginated<SupplierDto>> => {
    const items = await supplierService.listSuppliers();
    return { items, total: items.length, page: 1, pageSize: items.length };
  });

  app.get<{ Params: IdParam }>('/suppliers/:id', async (request): Promise<SupplierDto> => {
    return supplierService.getSupplier(parseId(request.params));
  });

  app.post('/suppliers', async (request, reply): Promise<SupplierDto> => {
    const created = await supplierService.createSupplier(parseBody(request.body));
    reply.code(201);
    void writeAudit({ adminUserId: request.admin?.id, action: 'supplier.create', target: created.id });
    return created;
  });

  app.put<{ Params: IdParam }>('/suppliers/:id', async (request): Promise<SupplierDto> => {
    const id = parseId(request.params);
    const updated = await supplierService.updateSupplier(id, parseBody(request.body));
    void writeAudit({ adminUserId: request.admin?.id, action: 'supplier.update', target: id });
    return updated;
  });

  app.delete<{ Params: IdParam }>('/suppliers/:id', async (request, reply): Promise<void> => {
    const id = parseId(request.params);
    await supplierService.deleteSupplier(id);
    void writeAudit({ adminUserId: request.admin?.id, action: 'supplier.delete', target: id });
    reply.code(204);
  });

  /** Fetch products + balance from an API supplier (for the Sync Produk modal). */
  app.post<{ Params: IdParam }>(
    '/suppliers/:id/sync-products',
    async (request): Promise<ApiSupplierSyncResponse> => {
      return supplierService.syncApiSupplierProducts(parseId(request.params));
    },
  );
};
