/**
 * Tests for the payment layer, offline (mock Pakasir client, mocked repository + queue):
 *  - webhook signature verification (good / bad / missing HMAC)
 *  - verifyWebhook: PAID transition marks paid + enqueues fulfillment exactly once
 *  - duplicate PAID webhook does not re-enqueue
 *  - createTransaction is idempotent per order and returns qr/va from the mock client
 *  - the mock Pakasir client returns qr for QRIS and a VA number for VA methods
 */
import '../support/payment-env.js';
import { createHmac } from 'node:crypto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrderStatus, PaymentStatus, PaymentMethod } from '@eakmail/shared-types';
import { WEBHOOK_SECRET } from '../support/payment-env.js';

// ---- mock the data + queue seams (no live DB / Redis) -----------------------

const repo = {
  findOrderForPayment: vi.fn(),
  findByOrderId: vi.fn(),
  upsert: vi.fn(),
  markPaid: vi.fn(),
  updateStatus: vi.fn(),
};
vi.mock('../../src/modules/payments/payment.repository.js', () => ({
  paymentRepository: repo,
}));

const fulfillmentAdd = vi.fn();
vi.mock('../../src/queue/queues.js', () => ({
  QueueName: { ORDER_FULFILLMENT: 'order-fulfillment' },
  getQueues: () => ({ 'order-fulfillment': { add: fulfillmentAdd } }),
}));

// Import AFTER the mocks are registered.
const { paymentService } = await import('../../src/modules/payments/payment.service.js');
const { verifyWebhookSignature } = await import('../../src/modules/payments/webhook-verify.js');
const { PakasirMockClient } = await import('../../src/modules/payments/pakasir-mock.js');

/** A stored Payment row shaped like Prisma returns. */
function paymentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pay-1',
    orderId: 'order-1',
    provider: 'pakasir',
    method: PaymentMethod.QRIS,
    amount: 15_000,
    fee: 0,
    status: PaymentStatus.PENDING,
    pakasirTxnId: 'mock_txn',
    qrString: '00020101MOCK',
    vaNumber: null,
    paymentUrl: null,
    expiresAt: null,
    raw: {},
    ...overrides,
  };
}

function sign(body: string): string {
  return createHmac('sha256', WEBHOOK_SECRET).update(Buffer.from(body, 'utf8')).digest('hex');
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('verifyWebhookSignature', () => {
  it('accepts a correct HMAC (raw + sha256= prefixed)', () => {
    const body = '{"order_id":"order-1"}';
    const hex = sign(body);
    expect(verifyWebhookSignature(Buffer.from(body), hex)).toBe(true);
    expect(verifyWebhookSignature(Buffer.from(body), `sha256=${hex}`)).toBe(true);
  });

  it('rejects a wrong signature', () => {
    const body = '{"order_id":"order-1"}';
    const wrong = sign('{"order_id":"tampered"}');
    expect(verifyWebhookSignature(Buffer.from(body), wrong)).toBe(false);
  });

  it('rejects a missing / malformed signature', () => {
    const body = Buffer.from('{}');
    expect(verifyWebhookSignature(body, undefined)).toBe(false);
    expect(verifyWebhookSignature(body, 'not-hex-!!')).toBe(false);
  });
});

describe('paymentService.verifyWebhook', () => {
  it('throws on a bad signature (never touches persistence)', async () => {
    await expect(
      paymentService.verifyWebhook(Buffer.from('{"order_id":"order-1"}'), 'deadbeef'),
    ).rejects.toThrow(/signature/i);
    expect(repo.findByOrderId).not.toHaveBeenCalled();
  });

  it('marks PAID and enqueues fulfillment exactly once on a valid PAID webhook', async () => {
    const body = JSON.stringify({ order_id: 'order-1', status: 'paid', id: 'txn-9', fee: 100 });
    repo.findByOrderId.mockResolvedValue(paymentRow());
    repo.markPaid.mockResolvedValue(true); // this call performed the transition

    const event = await paymentService.verifyWebhook(Buffer.from(body), sign(body));

    expect(event.orderId).toBe('order-1');
    expect(event.status).toBe(PaymentStatus.PAID);
    expect(repo.markPaid).toHaveBeenCalledWith('order-1', 'txn-9', 100);
    expect(fulfillmentAdd).toHaveBeenCalledTimes(1);
    expect(fulfillmentAdd).toHaveBeenCalledWith(
      'fulfill',
      { orderId: 'order-1' },
      { jobId: 'fulfill-order-1' },
    );
  });

  it('does not re-enqueue on a duplicate PAID webhook', async () => {
    const body = JSON.stringify({ order_id: 'order-1', status: 'paid', id: 'txn-9' });
    repo.findByOrderId.mockResolvedValue(paymentRow());
    repo.markPaid.mockResolvedValue(false); // already settled

    await paymentService.verifyWebhook(Buffer.from(body), sign(body));

    expect(fulfillmentAdd).not.toHaveBeenCalled();
  });

  it('ignores a webhook for an unknown order', async () => {
    const body = JSON.stringify({ order_id: 'ghost', status: 'paid' });
    repo.findByOrderId.mockResolvedValue(null);

    await paymentService.verifyWebhook(Buffer.from(body), sign(body));

    expect(repo.markPaid).not.toHaveBeenCalled();
    expect(fulfillmentAdd).not.toHaveBeenCalled();
  });
});

describe('paymentService.createTransaction', () => {
  it('creates a Pakasir transaction and upserts a Payment (idempotent per order)', async () => {
    repo.findOrderForPayment.mockResolvedValue({ id: 'order-1', amount: 15_000, status: OrderStatus.PENDING });
    repo.upsert.mockImplementation(async (data: Record<string, unknown>) => paymentRow({ ...data }));

    const first = await paymentService.createTransaction({ orderId: 'order-1', method: PaymentMethod.QRIS });
    const second = await paymentService.createTransaction({ orderId: 'order-1', method: PaymentMethod.QRIS });

    // Same order → same deterministic mock txn id (idempotent).
    expect(first.pakasirTxnId).toBe(second.pakasirTxnId);
    expect(first.orderId).toBe('order-1');
    expect(first.qrString).toBeTruthy();
    expect(repo.upsert).toHaveBeenCalledTimes(2);
    // upsert keyed on orderId collapses retries to one row.
    expect(repo.upsert.mock.calls[0]![0]).toMatchObject({ orderId: 'order-1' });
  });

  it('returns the existing payment when the order is no longer PENDING', async () => {
    repo.findOrderForPayment.mockResolvedValue({ id: 'order-1', amount: 15_000, status: OrderStatus.PAID });
    repo.findByOrderId.mockResolvedValue(paymentRow({ status: PaymentStatus.PAID }));

    const dto = await paymentService.createTransaction({ orderId: 'order-1', method: PaymentMethod.QRIS });

    expect(dto.status).toBe(PaymentStatus.PAID);
    expect(repo.upsert).not.toHaveBeenCalled();
  });
});

describe('PakasirMockClient', () => {
  it('returns a QR string for QRIS and is deterministic per order', async () => {
    const client = new PakasirMockClient();
    const a = await client.createTransaction({ orderId: 'order-1', method: PaymentMethod.QRIS, amount: 15_000 });
    const b = await client.createTransaction({ orderId: 'order-1', method: PaymentMethod.QRIS, amount: 15_000 });
    expect(a.qrString).toBeTruthy();
    expect(a.vaNumber).toBeNull();
    expect(a.txnId).toBe(b.txnId);
  });

  it('returns a VA number for VA methods and a URL for a payment link', async () => {
    const client = new PakasirMockClient();
    const va = await client.createTransaction({ orderId: 'order-2', method: PaymentMethod.BRI_VA, amount: 20_000 });
    expect(va.vaNumber).toMatch(/^\d{16}$/);
    expect(va.qrString).toBeNull();

    const link = await client.createTransaction({ orderId: 'order-3', method: PaymentMethod.PAYMENT_LINK, amount: 20_000 });
    expect(link.paymentUrl).toContain('https://');
  });
});
