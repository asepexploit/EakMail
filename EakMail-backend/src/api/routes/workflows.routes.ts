/**
 * Workflow HTTP routes (thin controllers): CRUD plus POST validate and rollback.
 * Validate input with Zod, delegate to the service, shape the response. No
 * business logic here. Registered under the /api prefix. See backend-guide.md §2.
 */
import type {
  IdParam,
  Paginated,
  UpsertWorkflowRequest,
  WorkflowDto,
  WorkflowValidationResult,
} from '@eakmail/shared-types';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ValidationError } from '../../lib/errors.js';
import * as workflowService from '../../modules/workflows/workflow.service.js';
import { workflowGraphSchema } from './schemas/workflow-graph.schema.js';
import { writeAudit } from '../middleware/audit.js';

const upsertWorkflowSchema = z.object({
  name: z.string().min(1),
  supplierId: z.string().min(1).nullable().optional(),
  graph: workflowGraphSchema,
  isActive: z.boolean().optional(),
});

const idParamSchema = z.object({ id: z.string().min(1) });

const rollbackSchema = z.object({
  version: z.number().int().positive(),
});

function parseBody(body: unknown): UpsertWorkflowRequest {
  const result = upsertWorkflowSchema.safeParse(body);
  if (!result.success) {
    throw new ValidationError(result.error.issues[0]?.message ?? 'Invalid workflow payload.');
  }
  // Zod validates structure; the graph is contract-shaped from here on.
  return result.data as UpsertWorkflowRequest;
}

function parseId(params: unknown): string {
  const result = idParamSchema.safeParse(params);
  if (!result.success) throw new ValidationError('Invalid workflow id.');
  return result.data.id;
}

function parseRollbackVersion(body: unknown): number {
  const result = rollbackSchema.safeParse(body);
  if (!result.success) throw new ValidationError('Rollback requires a positive integer "version".');
  return result.data.version;
}

export const workflowsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/workflows', async (): Promise<Paginated<WorkflowDto>> => {
    const items = await workflowService.listWorkflows();
    return { items, total: items.length, page: 1, pageSize: items.length };
  });

  app.get<{ Params: IdParam }>('/workflows/:id', async (request): Promise<WorkflowDto> => {
    return workflowService.getWorkflow(parseId(request.params));
  });

  app.post('/workflows', async (request, reply): Promise<WorkflowDto> => {
    const created = await workflowService.createWorkflow(parseBody(request.body));
    reply.code(201);
    void writeAudit({ adminUserId: request.admin?.id, action: 'workflow.create', target: created.id, meta: { name: created.name } });
    return created;
  });

  app.put<{ Params: IdParam }>('/workflows/:id', async (request): Promise<WorkflowDto> => {
    const id = parseId(request.params);
    const updated = await workflowService.updateWorkflow(id, parseBody(request.body));
    void writeAudit({ adminUserId: request.admin?.id, action: 'workflow.update', target: id, meta: { name: updated.name } });
    return updated;
  });

  app.patch<{ Params: IdParam }>('/workflows/:id/active', async (request): Promise<WorkflowDto> => {
    const id = parseId(request.params);
    const body = z.object({ isActive: z.boolean() }).safeParse(request.body);
    if (!body.success) throw new ValidationError('isActive (boolean) is required.');
    const updated = await workflowService.toggleActive(id, body.data.isActive);
    void writeAudit({ adminUserId: request.admin?.id, action: 'workflow.toggle_active', target: id, meta: { isActive: body.data.isActive } });
    return updated;
  });

  app.delete<{ Params: IdParam }>('/workflows/:id', async (request, reply): Promise<void> => {
    const id = parseId(request.params);
    await workflowService.deleteWorkflow(id);
    void writeAudit({ adminUserId: request.admin?.id, action: 'workflow.delete', target: id });
    reply.code(204);
  });

  app.post<{ Params: IdParam }>(
    '/workflows/:id/validate',
    async (request): Promise<WorkflowValidationResult> => {
      return workflowService.validateWorkflow(parseId(request.params));
    },
  );

  app.post<{ Params: IdParam }>(
    '/workflows/:id/rollback',
    async (request): Promise<WorkflowDto> => {
      const id = parseId(request.params);
      const version = parseRollbackVersion(request.body);
      return workflowService.rollbackWorkflow(id, version);
    },
  );
};
