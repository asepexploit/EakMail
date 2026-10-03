/**
 * Telegram accounts HTTP routes (thin controller). ARCHITECTURE.md §4.2.
 * Validates input with zod, delegates to the account service, shapes the response.
 * No business logic here. Secret fields (sessionEnc) are never in a response.
 *
 * Registered by the API server under the `/api/accounts` prefix.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { LoginStepResponse, TelegramAccountDto } from '@eakmail/shared-types';
import { accountService } from '../../modules/accounts/account.service.js';

// Runtime validation at the API boundary (shared-types.md: validate even with
// shared types). The parsed shapes correspond to StartLoginRequest /
// SubmitCodeRequest / IdParam in @eakmail/shared-types.
const startLoginSchema = z.object({
  label: z.string().min(1).max(80),
  phone: z
    .string()
    .min(6)
    .max(20)
    .regex(/^\+?[0-9]+$/, 'phone must be digits, optionally with a leading +'),
});

const submitCodeSchema = z.object({
  loginId: z.string().min(1),
  code: z.string().min(3).max(10),
  password: z.string().min(1).optional(),
});

const idParamSchema = z.object({ id: z.string().min(1) });

export async function accountsRoutes(app: FastifyInstance): Promise<void> {
  // List all accounts.
  app.get('/', async (): Promise<TelegramAccountDto[]> => accountService.list());

  // Account health/status by id.
  app.get('/:id', async (request): Promise<TelegramAccountDto> => {
    const { id } = idParamSchema.parse(request.params);
    return accountService.status(id);
  });

  // Step 1 of login: request a code for a phone number.
  app.post('/login/start', async (request): Promise<LoginStepResponse> => {
    const body = startLoginSchema.parse(request.body);
    return accountService.startLogin(body.label, body.phone);
  });

  // Step 2 of login: submit the code (and optional 2FA password).
  app.post('/login/code', async (request): Promise<LoginStepResponse> => {
    const body = submitCodeSchema.parse(request.body);
    return accountService.submitCode(body.loginId, body.code, body.password);
  });

  // Remove an account.
  app.delete('/:id', async (request, reply): Promise<void> => {
    const { id } = idParamSchema.parse(request.params);
    await accountService.remove(id);
    await reply.code(204).send();
  });
}
