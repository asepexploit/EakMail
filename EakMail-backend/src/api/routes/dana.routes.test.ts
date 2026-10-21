/**
 * HTTP integration tests for dana.routes.ts.
 * Builds a minimal Fastify instance with only the DANA routes registered,
 * mocks both services, and fires real HTTP requests via app.inject().
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { UnauthorizedError, NotFoundError, ValidationError } from '../../lib/errors.js';
import { errorHandler } from '../middleware/error-handler.js';

// ── Mock services ─────────────────────────────────────────────────────────────
vi.mock('../../modules/payments/dana-device.service.js', () => ({
  danaDeviceService: {
    verify: vi.fn(),
    register: vi.fn(),
    list: vi.fn(),
    revoke: vi.fn(),
  },
}));

vi.mock('../../modules/payments/dana-event.service.js', () => ({
  danaEventService: {
    processEvent: vi.fn(),
    getDeviceStatus: vi.fn(),
    listEvents: vi.fn(),
  },
}));

import { danaDeviceService } from '../../modules/payments/dana-device.service.js';
import { danaEventService } from '../../modules/payments/dana-event.service.js';
import { danaRoutes } from './dana.routes.js';

const mockDevice = danaDeviceService as unknown as Record<string, ReturnType<typeof vi.fn>>;
const mockEvent = danaEventService as unknown as Record<string, ReturnType<typeof vi.fn>>;

// ── App factory ────────────────────────────────────────────────────────────────
async function buildTestApp() {
  const app = Fastify({ logger: false });
  app.setErrorHandler(errorHandler);
  await app.register(danaRoutes, { prefix: '/api/payments/dana' });
  await app.ready();
  return app;
}

// ── Fixtures ───────────────────────────────────────────────────────────────────
const VALID_DEVICE = { id: 'dev-001', label: 'Test HP', revokedAt: null };

const VALID_EVENT_BODY = {
  notification_id: 'notif-abc-001',
  device_id: 'dev-001',
  timestamp: '2026-10-22T10:00:00.000Z',
  raw_title: 'Uang Masuk',
  raw_body: 'Rp50.000 dari Pembeli',
  parsed_amount: 50000,
  parsed_description: 'Uang Masuk — Rp50.000 dari Pembeli',
};

// ── Tests ──────────────────────────────────────────────────────────────────────
describe('POST /api/payments/dana/event', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;
  beforeEach(async () => { vi.clearAllMocks(); app = await buildTestApp(); });
  afterEach(async () => app.close());

  it('returns 200 ACCEPTED for a valid event', async () => {
    mockDevice.verify.mockResolvedValue(VALID_DEVICE);
    mockEvent.processEvent.mockResolvedValue({ status: 'ACCEPTED', event_id: 'ev-001' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/payments/dana/event',
      headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' },
      payload: VALID_EVENT_BODY,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ACCEPTED');
    expect(body.event_id).toBe('ev-001');
  });

  it('returns 200 DUPLICATE for a repeated event', async () => {
    mockDevice.verify.mockResolvedValue(VALID_DEVICE);
    mockEvent.processEvent.mockResolvedValue({ status: 'DUPLICATE', event_id: 'ev-001' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/payments/dana/event',
      headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' },
      payload: VALID_EVENT_BODY,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('DUPLICATE');
  });

  it('returns 401 when Authorization header is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/payments/dana/event',
      headers: { 'content-type': 'application/json' },
      payload: VALID_EVENT_BODY,
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 when token is invalid', async () => {
    mockDevice.verify.mockRejectedValue(new UnauthorizedError());

    const res = await app.inject({
      method: 'POST',
      url: '/api/payments/dana/event',
      headers: { authorization: 'Bearer bad-token', 'content-type': 'application/json' },
      payload: VALID_EVENT_BODY,
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 400 when payload is missing required fields', async () => {
    mockDevice.verify.mockResolvedValue(VALID_DEVICE);

    const res = await app.inject({
      method: 'POST',
      url: '/api/payments/dana/event',
      headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' },
      payload: { notification_id: 'x' }, // missing most fields
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 401 when device_id in body does not match the token owner', async () => {
    mockDevice.verify.mockResolvedValue({ ...VALID_DEVICE, id: 'dev-OTHER' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/payments/dana/event',
      headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' },
      payload: { ...VALID_EVENT_BODY, device_id: 'dev-001' }, // mismatch with dev-OTHER
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 400 when timestamp is not valid ISO 8601', async () => {
    mockDevice.verify.mockResolvedValue(VALID_DEVICE);

    const res = await app.inject({
      method: 'POST',
      url: '/api/payments/dana/event',
      headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' },
      payload: { ...VALID_EVENT_BODY, timestamp: 'not-a-date' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /api/payments/dana/status', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;
  beforeEach(async () => { vi.clearAllMocks(); app = await buildTestApp(); });
  afterEach(async () => app.close());

  it('returns 200 with device stats', async () => {
    mockDevice.verify.mockResolvedValue(VALID_DEVICE);
    mockEvent.getDeviceStatus.mockResolvedValue({
      device_id: 'dev-001',
      last_event_at: '2026-10-22T09:00:00.000Z',
      total_events_today: 3,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/payments/dana/status',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.device_id).toBe('dev-001');
    expect(body.total_events_today).toBe(3);
  });

  it('returns 401 when no token provided', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/payments/dana/status' });
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/payments/dana/events', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;
  beforeEach(async () => { vi.clearAllMocks(); app = await buildTestApp(); });
  afterEach(async () => app.close());

  it('returns 200 with a list of events', async () => {
    const fakeEvents = [
      { id: 'ev-1', notificationId: 'n1', eventStatus: 'ACCEPTED', parsedAmount: 50000, createdAt: new Date() },
      { id: 'ev-2', notificationId: 'n2', eventStatus: 'NO_MATCH', parsedAmount: null, createdAt: new Date() },
    ];
    mockEvent.listEvents.mockResolvedValue(fakeEvents);

    const res = await app.inject({ method: 'GET', url: '/api/payments/dana/events' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(2);
  });
});

describe('POST /api/payments/dana/devices/register', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;
  beforeEach(async () => { vi.clearAllMocks(); app = await buildTestApp(); });
  afterEach(async () => app.close());

  it('returns 201 with deviceId and token', async () => {
    mockDevice.register.mockResolvedValue({ deviceId: 'dev-new', token: 'plain-token-xyz' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/payments/dana/devices/register',
      headers: { 'content-type': 'application/json' },
      payload: { label: 'HP Baru' },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.deviceId).toBe('dev-new');
    expect(body.token).toBe('plain-token-xyz');
  });

  it('returns 400 when label is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/payments/dana/devices/register',
      headers: { 'content-type': 'application/json' },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /api/payments/dana/devices/revoke', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;
  beforeEach(async () => { vi.clearAllMocks(); app = await buildTestApp(); });
  afterEach(async () => app.close());

  it('returns 200 ok when device exists', async () => {
    mockDevice.revoke.mockResolvedValue(undefined);

    const res = await app.inject({
      method: 'POST',
      url: '/api/payments/dana/devices/revoke',
      headers: { 'content-type': 'application/json' },
      payload: { device_id: 'dev-001' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
  });

  it('returns 404 when device does not exist', async () => {
    mockDevice.revoke.mockRejectedValue(new NotFoundError('DanaDevice'));

    const res = await app.inject({
      method: 'POST',
      url: '/api/payments/dana/devices/revoke',
      headers: { 'content-type': 'application/json' },
      payload: { device_id: 'nonexistent' },
    });

    expect(res.statusCode).toBe(404);
  });
});

describe('GET /api/payments/dana/devices', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;
  beforeEach(async () => { vi.clearAllMocks(); app = await buildTestApp(); });
  afterEach(async () => app.close());

  it('returns 200 with device list', async () => {
    mockDevice.list.mockResolvedValue([
      { id: 'dev-001', label: 'HP 1', revokedAt: null, createdAt: new Date() },
    ]);

    const res = await app.inject({ method: 'GET', url: '/api/payments/dana/devices' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
  });
});
