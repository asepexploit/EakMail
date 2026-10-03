/**
 * Bot config HTTP routes (F17). Thin controllers: validate with zod, delegate to the
 * service, shape the response. No business logic here (backend-guide.md §2).
 * Mounted under /api/bot-config by the server's route registrar.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ValidationError } from '../../lib/errors.js';
import * as botConfigService from '../../modules/bot-config/bot-config.service.js';
import { writeAudit } from '../middleware/audit.js';

const menuButtonSchema = z.object({
  label: z.string().min(1),
  action: z.string().min(1),
  style: z.enum(['success', 'primary', 'danger']).optional(),
  url: z.string().url().optional(),
  width: z.enum(['full', 'half']).optional(),
});

const localeTextsSchema = z.record(z.string(), z.string());

const updateSchema = z.object({
  brandName: z.string().min(1).optional(),
  logoUrl: z.string().url().nullish(),
  startPhotoUrl: z.string().url().nullish(),
  csContactUrl: z.string().url().nullish(),
  topupSuccessImageUrl: z.string().url().nullish(),
  // Write-only; encrypted at rest, never echoed back (ARCHITECTURE.md §10).
  botToken: z.string().min(1).optional(),
  menu: z.array(menuButtonSchema).optional(),
  texts: z
    .object({
      id: localeTextsSchema.optional(),
      en: localeTextsSchema.optional(),
    })
    .optional(),
});

function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(result.error.issues.map((i) => i.message).join('; '));
  }
  return result.data;
}

export async function botConfigRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async () => {
    return botConfigService.getBotConfig();
  });

  app.put('/', async (request) => {
    const body = parse(updateSchema, request.body);
    const updated = await botConfigService.updateBotConfig(body);
    void writeAudit({ adminUserId: request.admin?.id, action: 'bot_config.update' });
    return updated;
  });
}
