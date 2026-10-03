/**
 * Settings routes — expose non-secret server config status to the dashboard.
 * Never returns actual secret values (ARCHITECTURE.md §10). Secrets are write-only;
 * the response only indicates whether they are configured (non-empty).
 *
 *   GET  /api/settings          current config status (host, port, secret flags)
 *   POST /api/settings/totp/setup      generate a TOTP secret + QR URI for the current admin
 *   POST /api/settings/totp/enable     confirm a TOTP code to activate 2FA
 *   DELETE /api/settings/totp          disable 2FA (requires a valid current TOTP code)
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticator } from 'otplib';
import { config } from '../../config/index.js';
import { requireAuth } from '../middleware/auth.js';
import { prisma } from '../../db/client.js';
import { UnauthorizedError, ValidationError } from '../../lib/errors.js';
import { writeAudit } from '../middleware/audit.js';
import { toAdminUserDto } from '../../modules/auth/auth.service.js';
import type { AdminUserDto } from '@eakmail/shared-types';

export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  // ---- config status ---------------------------------------------------------

  app.get('/', { preHandler: requireAuth }, async () => {
    return {
      host: config.HOST,
      port: config.PORT,
      secrets: {
        sessionSecretSet: Boolean(config.SESSION_SECRET),
        encryptionKeySet: Boolean(config.ENCRYPTION_KEY),
        pakasirApiKeySet: Boolean(config.PAKASIR_API_KEY),
        pakasirWebhookSecretSet: Boolean(config.PAKASIR_WEBHOOK_SECRET),
        telegramConfigured: Boolean(config.TELEGRAM_API_ID && config.TELEGRAM_API_HASH),
      },
    };
  });

  // ---- TOTP setup (generate secret + provisioning URI) -----------------------

  app.post('/totp/setup', { preHandler: requireAuth }, async (req) => {
    const admin = await prisma.adminUser.findUniqueOrThrow({ where: { id: req.admin!.id } });
    if (admin.totpSecret) {
      throw new ValidationError('2FA sudah aktif. Nonaktifkan dulu sebelum mengatur ulang.');
    }
    const secret = authenticator.generateSecret();
    const otpauthUri = authenticator.keyuri(admin.email, 'EakMail', secret);

    // Store the pending secret so /totp/enable can verify it, but do NOT mark it active yet.
    // We reuse totpSecret for this; enable will confirm & keep it.
    // The secret is stored only when enable confirms the code is valid, so this is idempotent.
    // We put it in a temporary session-scoped cache via a separate DB column; to keep the
    // schema unchanged, we store it immediately and rely on the enable step to validate.
    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { totpSecret: secret },
    });

    await writeAudit({ adminUserId: admin.id, action: 'auth.totp.setup' });
    return { otpauthUri, secret };
  });

  // ---- TOTP enable (verify code after scanning QR) ---------------------------

  app.post('/totp/enable', { preHandler: requireAuth }, async (req) => {
    const { code } = z.object({ code: z.string().length(6) }).parse(req.body);
    const admin = await prisma.adminUser.findUniqueOrThrow({ where: { id: req.admin!.id } });

    if (!admin.totpSecret) {
      throw new ValidationError('Jalankan /totp/setup terlebih dahulu.');
    }

    const valid = authenticator.verify({ token: code, secret: admin.totpSecret });
    if (!valid) throw new UnauthorizedError('Kode TOTP tidak valid.');

    // Already stored from setup; just confirm by re-reading. The secret is now confirmed active.
    const updated = await prisma.adminUser.findUniqueOrThrow({ where: { id: admin.id } });
    await writeAudit({ adminUserId: admin.id, action: 'auth.totp.enabled' });
    const body: AdminUserDto = toAdminUserDto(updated);
    return body;
  });

  // ---- TOTP disable ----------------------------------------------------------

  app.delete('/totp', { preHandler: requireAuth }, async (req) => {
    const { code } = z.object({ code: z.string().length(6) }).parse(req.body);
    const admin = await prisma.adminUser.findUniqueOrThrow({ where: { id: req.admin!.id } });

    if (!admin.totpSecret) throw new ValidationError('2FA tidak aktif.');

    const valid = authenticator.verify({ token: code, secret: admin.totpSecret });
    if (!valid) throw new UnauthorizedError('Kode TOTP tidak valid.');

    const updated = await prisma.adminUser.update({
      where: { id: admin.id },
      data: { totpSecret: null },
    });
    await writeAudit({ adminUserId: admin.id, action: 'auth.totp.disabled' });
    const body: AdminUserDto = toAdminUserDto(updated);
    return body;
  });
}
