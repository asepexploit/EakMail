/**
 * Execution HTTP routes (thin controllers): dashboard list/detail, live control commands,
 * and starting a test run (ARCHITECTURE.md §6, §9). Validate input with zod, delegate to
 * the service, shape the response. No business logic here (backend-guide.md §2).
 *
 * These routes carry full resource paths ("/executions...") and are registered at the
 * "/api" root by the composition root (matching workflows/suppliers).
 *
 *   GET  /api/executions              list executions (newest first)
 *   GET  /api/executions/:id          execution detail with its step log
 *   POST /api/executions/:id/command  send a live control command (pause/resume/...)
 *   POST /api/executions/test         start a test run and enqueue it
 */
import type {
  ExecutionDetailDto,
  ExecutionDto,
  Paginated,
} from '@eakmail/shared-types';
import { ExecutionCommand } from '@eakmail/shared-types';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ValidationError } from '../../lib/errors.js';
import * as executionService from '../../modules/executions/execution.service.js';

const idParamSchema = z.object({ id: z.string().min(1) });

const commandSchema = z.object({
  command: z.nativeEnum(ExecutionCommand),
});

const runTestSchema = z.object({
  workflowId: z.string().min(1),
  accountId: z.string().min(1),
  variables: z.record(z.string(), z.string()).optional(),
});

function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(result.error.issues.map((i) => i.message).join('; '));
  }
  return result.data;
}

export const executionsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/executions', async (): Promise<Paginated<ExecutionDto>> => {
    const items = await executionService.listExecutions();
    return { items, total: items.length, page: 1, pageSize: items.length };
  });

  app.get('/executions/:id', async (request): Promise<ExecutionDetailDto> => {
    const { id } = parse(idParamSchema, request.params);
    return executionService.getExecution(id);
  });

  app.post('/executions/:id/command', async (request): Promise<{ delivered: number }> => {
    const { id } = parse(idParamSchema, request.params);
    const body = parse(commandSchema, request.body);
    return executionService.sendCommand(id, body);
  });

  app.post('/executions/test', async (request, reply): Promise<ExecutionDto> => {
    const body = parse(runTestSchema, request.body);
    const created = await executionService.runTest(body);
    reply.code(202);
    return created;
  });
};
