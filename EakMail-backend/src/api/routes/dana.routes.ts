/**
 * DANA payment routes — receives notification events from Eak-DANA APK.
 * Registered under /api/payments/dana.
 *
 * All routes require a valid device Bearer token verified by danaDeviceService.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { danaEventService } from '../../modules/payments/dana-event.service.js';
import { danaDeviceService } from '../../modules/payments/dana-device.service.js';
import { UnauthorizedError, ValidationError } from '../../lib/errors.js';

const danaEventSchema = z.object({
  notification_id: z.string().min(1).max(128),
  device_id: z.string().min(1).max(64),
  timestamp: z.string().datetime(),
  raw_title: z.string().max(512),
  raw_body: z.string().max(2048),
  parsed_amount: z.number().positive().nullable(),
  parsed_description: z.string().max(512).nullable(),
});

const registerDeviceSchema = z.object({
  label: z.string().min(1).max(80),
});

const revokeDeviceSchema = z.object({
  device_id: z.string().min(1),
});

/** Extract and verify Bearer token from Authorization header. */
async function requireDevice(request: { headers: { authorization?: string } }) {
  const auth = request.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing Bearer token');
  }
  const token = auth.slice(7).trim();
  return danaDeviceService.verify(token);
}

export async function danaRoutes(app: FastifyInstance) {
  /**
   * POST /api/payments/dana/event
   * Receives a DANA notification event from the APK.
   */
  app.post('/event', async (req, reply) => {
    const device = await requireDevice(req);

    const parsed = danaEventSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(`Invalid payload: ${parsed.error.issues[0]?.message}`);
    }

    // Ensure device_id in body matches the verified token's device
    if (parsed.data.device_id !== device.id) {
      throw new UnauthorizedError('device_id mismatch');
    }

    const result = await danaEventService.processEvent(parsed.data, device.id);
    return reply.code(200).send(result);
  });

  /**
   * GET /api/payments/dana/status
   * Returns stats for the authenticated device.
   */
  app.get('/status', async (req, reply) => {
    const device = await requireDevice(req);
    const status = await danaEventService.getDeviceStatus(device.id);
    return reply.code(200).send(status);
  });

  /**
   * GET /api/payments/dana/events
   * Dashboard: list recent DANA events.
   */
  app.get('/events', async (_req, reply) => {
    const events = await danaEventService.listEvents(200);
    return reply.code(200).send(events);
  });

  /**
   * POST /api/payments/dana/devices/register
   * Register a new Eak-DANA device. Returns plain token once.
   */
  app.post('/devices/register', async (req, reply) => {
    const parsed = registerDeviceSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('label is required');
    }
    const result = await danaDeviceService.register(parsed.data.label);
    return reply.code(201).send(result);
  });

  /**
   * GET /api/payments/dana/devices
   * Dashboard: list all devices.
   */
  app.get('/devices', async (_req, reply) => {
    const devices = await danaDeviceService.list();
    return reply.code(200).send(devices);
  });

  /**
   * POST /api/payments/dana/devices/revoke
   * Revoke a device token.
   */
  app.post('/devices/revoke', async (req, reply) => {
    const parsed = revokeDeviceSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('device_id is required');
    }
    await danaDeviceService.revoke(parsed.data.device_id);
    return reply.code(200).send({ ok: true });
  });
}
