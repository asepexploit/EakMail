/**
 * Tests for dana-device.service — token hashing, register, verify, revoke.
 * Prisma is fully mocked so these run without a real database.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedError, NotFoundError } from '../../lib/errors.js';

// ── Mock Prisma ──────────────────────────────────────────────────────────────
vi.mock('../../db/client.js', () => ({
  prisma: {
    danaDevice: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from '../../db/client.js';
import { danaDeviceService } from './dana-device.service.js';

const mockPrisma = prisma as unknown as {
  danaDevice: {
    create: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function makeDevice(overrides: Partial<{ id: string; label: string; revokedAt: Date | null }> = {}) {
  return {
    id: 'device-001',
    label: 'Test HP',
    tokenHash: 'irrelevant-hash',
    revokedAt: null,
    createdAt: new Date('2026-10-21T00:00:00Z'),
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe('danaDeviceService.register', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns a deviceId and a plain token', async () => {
    mockPrisma.danaDevice.create.mockResolvedValue(makeDevice({ id: 'dev-abc' }));

    const result = await danaDeviceService.register('HP Saya');

    expect(result.deviceId).toBe('dev-abc');
    expect(typeof result.token).toBe('string');
    expect(result.token.length).toBeGreaterThan(0);
  });

  it('stores a tokenHash, NOT the plain token', async () => {
    mockPrisma.danaDevice.create.mockResolvedValue(makeDevice());

    const result = await danaDeviceService.register('HP Saya');

    const createArg = mockPrisma.danaDevice.create.mock.calls[0][0].data;
    // The stored hash must NOT equal the plain token
    expect(createArg.tokenHash).not.toBe(result.token);
    // Hash must be a 64-char hex string (SHA-256)
    expect(createArg.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('two registrations produce different tokens', async () => {
    mockPrisma.danaDevice.create
      .mockResolvedValueOnce(makeDevice({ id: 'dev-1' }))
      .mockResolvedValueOnce(makeDevice({ id: 'dev-2' }));

    const r1 = await danaDeviceService.register('HP 1');
    const r2 = await danaDeviceService.register('HP 2');
    expect(r1.token).not.toBe(r2.token);
  });
});

describe('danaDeviceService.verify', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the device for a valid token', async () => {
    const device = makeDevice({ id: 'dev-xyz', revokedAt: null });
    mockPrisma.danaDevice.findUnique.mockResolvedValue({
      id: device.id,
      label: device.label,
      revokedAt: device.revokedAt,
    });

    const result = await danaDeviceService.verify('some-plain-token');
    expect(result.id).toBe('dev-xyz');
  });

  it('throws UnauthorizedError when token not found', async () => {
    mockPrisma.danaDevice.findUnique.mockResolvedValue(null);
    await expect(danaDeviceService.verify('bad-token')).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('throws UnauthorizedError when device is revoked', async () => {
    mockPrisma.danaDevice.findUnique.mockResolvedValue({
      id: 'dev-revoked',
      label: 'Old HP',
      revokedAt: new Date('2026-10-20T00:00:00Z'),
    });
    await expect(danaDeviceService.verify('any-token')).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('looks up by SHA-256 hash of the token, not the plain text', async () => {
    mockPrisma.danaDevice.findUnique.mockResolvedValue(null);
    await danaDeviceService.verify('my-plain-token').catch(() => {});

    const callArg = mockPrisma.danaDevice.findUnique.mock.calls[0][0];
    expect(callArg.where.tokenHash).not.toBe('my-plain-token');
    expect(callArg.where.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('danaDeviceService.list', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns all devices from prisma', async () => {
    const devices = [makeDevice({ id: 'a' }), makeDevice({ id: 'b' })];
    mockPrisma.danaDevice.findMany.mockResolvedValue(devices);

    const result = await danaDeviceService.list();
    expect(result).toHaveLength(2);
  });
});

describe('danaDeviceService.revoke', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sets revokedAt on the device', async () => {
    mockPrisma.danaDevice.findUnique.mockResolvedValue(makeDevice({ id: 'dev-001' }));
    mockPrisma.danaDevice.update.mockResolvedValue({});

    await danaDeviceService.revoke('dev-001');

    const updateArg = mockPrisma.danaDevice.update.mock.calls[0][0];
    expect(updateArg.data.revokedAt).toBeInstanceOf(Date);
  });

  it('throws NotFoundError when device does not exist', async () => {
    mockPrisma.danaDevice.findUnique.mockResolvedValue(null);
    await expect(danaDeviceService.revoke('nonexistent')).rejects.toBeInstanceOf(NotFoundError);
  });
});
