/**
 * Tests for dana-event.service — processEvent, deduplication, order matching,
 * settleMatchedOrder, getDeviceStatus, listEvents.
 * Prisma and BullMQ are fully mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrderStatus, PaymentStatus } from '@eakmail/shared-types';

// ── Mock Prisma ──────────────────────────────────────────────────────────────
vi.mock('../../db/client.js', () => ({
  prisma: {
    danaEvent: {
      findUnique: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    order: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    payment: {
      upsert: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// ── Mock BullMQ queues ───────────────────────────────────────────────────────
vi.mock('../../queue/queues.js', () => ({
  QueueName: { ORDER_FULFILLMENT: 'order-fulfillment' },
  getQueues: vi.fn(() => ({
    'order-fulfillment': { add: vi.fn().mockResolvedValue(undefined) },
  })),
}));

import { prisma } from '../../db/client.js';
import { getQueues } from '../../queue/queues.js';
import { danaEventService } from './dana-event.service.js';
import type { DanaNotificationEvent } from './dana-event.types.js';

// ── Typed mock helpers ───────────────────────────────────────────────────────
const mockPrisma = prisma as any;
const mockGetQueues = getQueues as ReturnType<typeof vi.fn>;

function makeEvent(overrides: Partial<DanaNotificationEvent> = {}): DanaNotificationEvent {
  return {
    notification_id: 'notif-abc-001',
    device_id: 'dev-001',
    timestamp: '2026-10-22T10:00:00.000Z',
    raw_title: 'Uang Masuk',
    raw_body: 'Rp50.000 dari Pembeli',
    parsed_amount: 50000,
    parsed_description: 'Uang Masuk — Rp50.000 dari Pembeli',
    ...overrides,
  };
}

function makeOrder(overrides: Partial<{ id: string; status: string; amount: number }> = {}) {
  return {
    id: 'order-001',
    status: OrderStatus.PENDING,
    amount: 50000,
    createdAt: new Date(),
    ...overrides,
  };
}

function makeEventRow(overrides: Partial<{ id: string; eventStatus: string }> = {}) {
  return {
    id: 'event-row-001',
    notificationId: 'notif-abc-001',
    eventStatus: 'NO_MATCH',
    orderId: null,
    createdAt: new Date(),
    ...overrides,
  };
}

// ── processEvent ─────────────────────────────────────────────────────────────
describe('danaEventService.processEvent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns DUPLICATE and does not create a row for a known notification_id', async () => {
    mockPrisma.danaEvent.findUnique.mockResolvedValue(makeEventRow({ id: 'existing-001', eventStatus: 'ACCEPTED' }));

    const result = await danaEventService.processEvent(makeEvent(), 'dev-001');

    expect(result.status).toBe('DUPLICATE');
    expect(result.event_id).toBe('existing-001');
    expect(mockPrisma.danaEvent.create).not.toHaveBeenCalled();
  });

  it('returns NO_MATCH and persists the event when no order matches', async () => {
    mockPrisma.danaEvent.findUnique.mockResolvedValue(null);
    mockPrisma.order.findFirst.mockResolvedValue(null);
    mockPrisma.danaEvent.create.mockResolvedValue(makeEventRow({ eventStatus: 'NO_MATCH' }));

    const result = await danaEventService.processEvent(makeEvent(), 'dev-001');

    expect(result.status).toBe('NO_MATCH');
    expect(mockPrisma.danaEvent.create).toHaveBeenCalledOnce();
    // Create arg should have eventStatus NO_MATCH
    const createData = mockPrisma.danaEvent.create.mock.calls[0][0].data;
    expect(createData.eventStatus).toBe('NO_MATCH');
    expect(createData.orderId).toBeNull();
  });

  it('returns ACCEPTED and enqueues fulfillment when order matches', async () => {
    mockPrisma.danaEvent.findUnique.mockResolvedValue(null);
    mockPrisma.order.findFirst.mockResolvedValue(makeOrder());
    mockPrisma.danaEvent.create.mockResolvedValue(makeEventRow({ id: 'ev-001', eventStatus: 'ACCEPTED' }));

    // settleMatchedOrder uses prisma.$transaction
    mockPrisma.$transaction.mockImplementation(async (fn: Function) => fn(mockPrisma));
    mockPrisma.order.findUnique.mockResolvedValue(makeOrder());
    mockPrisma.payment.upsert.mockResolvedValue({});
    mockPrisma.order.update.mockResolvedValue({});
    mockPrisma.danaEvent.update.mockResolvedValue({});

    const fulfillQueue = { add: vi.fn().mockResolvedValue(undefined) };
    mockGetQueues.mockReturnValue({ 'order-fulfillment': fulfillQueue });

    const result = await danaEventService.processEvent(makeEvent(), 'dev-001');

    expect(result.status).toBe('ACCEPTED');
    expect(fulfillQueue.add).toHaveBeenCalledOnce();
    // jobId must be idempotent per orderId
    const addArg = fulfillQueue.add.mock.calls[0];
    expect(addArg[2].jobId).toBe('fulfill-order-001');
  });

  it('stores parsedAmount and deviceId from the event', async () => {
    mockPrisma.danaEvent.findUnique.mockResolvedValue(null);
    mockPrisma.order.findFirst.mockResolvedValue(null);
    mockPrisma.danaEvent.create.mockResolvedValue(makeEventRow());

    await danaEventService.processEvent(makeEvent({ parsed_amount: 75000 }), 'dev-xyz');

    const createData = mockPrisma.danaEvent.create.mock.calls[0][0].data;
    expect(createData.parsedAmount).toBe(75000);
    expect(createData.deviceId).toBe('dev-xyz');
  });

  it('does NOT try to match an order when parsed_amount is null', async () => {
    mockPrisma.danaEvent.findUnique.mockResolvedValue(null);
    mockPrisma.danaEvent.create.mockResolvedValue(makeEventRow());

    await danaEventService.processEvent(makeEvent({ parsed_amount: null }), 'dev-001');

    expect(mockPrisma.order.findFirst).not.toHaveBeenCalled();
  });
});

// ── settleMatchedOrder (via processEvent) ────────────────────────────────────
describe('settle: skips orders that are no longer PENDING', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does NOT update or enqueue when order is already PAID', async () => {
    mockPrisma.danaEvent.findUnique.mockResolvedValue(null);
    mockPrisma.order.findFirst.mockResolvedValue(makeOrder({ status: OrderStatus.PAID }));
    mockPrisma.danaEvent.create.mockResolvedValue(makeEventRow({ eventStatus: 'ACCEPTED' }));

    mockPrisma.$transaction.mockImplementation(async (fn: Function) => fn(mockPrisma));
    // order.findUnique inside transaction returns PAID order
    mockPrisma.order.findUnique.mockResolvedValue(makeOrder({ status: OrderStatus.PAID }));

    const fulfillQueue = { add: vi.fn() };
    mockGetQueues.mockReturnValue({ 'order-fulfillment': fulfillQueue });

    await danaEventService.processEvent(makeEvent(), 'dev-001');

    expect(mockPrisma.payment.upsert).not.toHaveBeenCalled();
    expect(fulfillQueue.add).not.toHaveBeenCalled();
  });
});

// ── getDeviceStatus ───────────────────────────────────────────────────────────
describe('danaEventService.getDeviceStatus', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns device_id, last_event_at, and total_events_today', async () => {
    const lastAt = new Date('2026-10-22T09:00:00Z');
    mockPrisma.danaEvent.findFirst.mockResolvedValue({ createdAt: lastAt });
    mockPrisma.danaEvent.count.mockResolvedValue(7);

    const result = await danaEventService.getDeviceStatus('dev-001');

    expect(result.device_id).toBe('dev-001');
    expect(result.last_event_at).toBe(lastAt.toISOString());
    expect(result.total_events_today).toBe(7);
  });

  it('returns null last_event_at when no events exist', async () => {
    mockPrisma.danaEvent.findFirst.mockResolvedValue(null);
    mockPrisma.danaEvent.count.mockResolvedValue(0);

    const result = await danaEventService.getDeviceStatus('dev-new');

    expect(result.last_event_at).toBeNull();
    expect(result.total_events_today).toBe(0);
  });
});

// ── listEvents ────────────────────────────────────────────────────────────────
describe('danaEventService.listEvents', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns events from prisma with default limit 200', async () => {
    const events = Array.from({ length: 5 }, (_, i) => makeEventRow({ id: `ev-${i}` }));
    mockPrisma.danaEvent.findMany.mockResolvedValue(events);

    const result = await danaEventService.listEvents();

    expect(result).toHaveLength(5);
    const findArg = mockPrisma.danaEvent.findMany.mock.calls[0][0];
    expect(findArg.take).toBe(200);
  });

  it('respects a custom limit', async () => {
    mockPrisma.danaEvent.findMany.mockResolvedValue([]);
    await danaEventService.listEvents(50);
    expect(mockPrisma.danaEvent.findMany.mock.calls[0][0].take).toBe(50);
  });
});
