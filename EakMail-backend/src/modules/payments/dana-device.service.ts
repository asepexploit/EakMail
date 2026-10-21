/**
 * DANA device management — register, verify, and revoke Eak-DANA APK device tokens.
 * Tokens are stored hashed (SHA-256); the plain token is only returned at registration.
 */
import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '../../db/client.js';
import { NotFoundError, UnauthorizedError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';

const log = logger.child({ module: 'dana-device-service' });

function hashToken(plain: string): string {
  return createHash('sha256').update(plain).digest('hex');
}

export const danaDeviceService = {
  /** Register a new device. Returns the plain token once — it cannot be recovered. */
  async register(label: string): Promise<{ deviceId: string; token: string }> {
    const token = randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);

    const device = await prisma.danaDevice.create({
      data: { label, tokenHash },
    });

    log.info({ deviceId: device.id, label }, 'DANA device registered');
    return { deviceId: device.id, token };
  },

  /** Verify a Bearer token. Returns the device row or throws UnauthorizedError. */
  async verify(token: string) {
    const tokenHash = hashToken(token);
    const device = await prisma.danaDevice.findUnique({
      where: { tokenHash },
      select: { id: true, label: true, revokedAt: true },
    });

    if (!device || device.revokedAt !== null) {
      throw new UnauthorizedError('Invalid or revoked device token');
    }
    return device;
  },

  /** List all registered devices (dashboard). */
  async list() {
    return prisma.danaDevice.findMany({
      select: { id: true, label: true, revokedAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  },

  /** Revoke a device so its token stops working. */
  async revoke(deviceId: string): Promise<void> {
    const device = await prisma.danaDevice.findUnique({ where: { id: deviceId } });
    if (!device) throw new NotFoundError('DanaDevice');

    await prisma.danaDevice.update({
      where: { id: deviceId },
      data: { revokedAt: new Date() },
    });
    log.info({ deviceId }, 'DANA device revoked');
  },
};
