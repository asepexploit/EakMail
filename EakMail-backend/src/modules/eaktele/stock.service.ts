/**
 * Business logic stok akun EakTele.
 * Mengelola lifecycle stok: assign ke order, release, mark sold, validasi.
 */
import { encrypt, decrypt } from '../../lib/crypto.js';
import { NotFoundError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { stockRepository } from './stock.repository.js';
import type { CreateStockInput, StockRow } from './stock.repository.js';

const log = logger.child({ module: 'eaktele-stock' });

export interface StockDto {
  id: string;
  productId: string;
  phone: string;
  has2fa: boolean;
  hasSession: boolean;
  status: string;
  isSessionActive: boolean;
  isLoggedOutByBuyer: boolean;
  orderId: string | null;
  soldAt: string | null;
  lastOtpRequestAt: string | null;
  otpRequestCount: number;
  notes: string | null;
  createdAt: string;
}

/** Tampilan detail untuk pembeli — hanya phone + 2FA (plain), tidak ada session */
export interface StockDeliveryDetail {
  phone: string;
  password2fa: string | null;
}

function toDto(row: StockRow): StockDto {
  return {
    id: row.id,
    productId: row.productId,
    phone: row.phone,
    has2fa: Boolean(row.password2faEnc),
    hasSession: Boolean(row.sessionEnc),
    status: row.status,
    isSessionActive: row.isSessionActive,
    isLoggedOutByBuyer: row.isLoggedOutByBuyer,
    orderId: row.orderId,
    soldAt: row.soldAt?.toISOString() ?? null,
    lastOtpRequestAt: row.lastOtpRequestAt?.toISOString() ?? null,
    otpRequestCount: row.otpRequestCount,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  };
}

export const stockService = {
  async list(filters?: { productId?: string; status?: string }): Promise<StockDto[]> {
    const rows = await stockRepository.findAll(filters as Parameters<typeof stockRepository.findAll>[0]);
    return rows.map(toDto);
  },

  async get(id: string): Promise<StockDto> {
    const row = await stockRepository.findById(id);
    if (!row) throw new NotFoundError('TelegramAccountStock');
    return toDto(row);
  },

  async getByOrderId(orderId: string): Promise<StockDto> {
    const row = await stockRepository.findByOrderId(orderId);
    if (!row) throw new NotFoundError('TelegramAccountStock');
    return toDto(row);
  },

  /** Informasi yang dikirim ke pembeli setelah bayar (plain 2FA). */
  async getDeliveryDetail(id: string): Promise<StockDeliveryDetail> {
    const row = await stockRepository.findById(id);
    if (!row) throw new NotFoundError('TelegramAccountStock');
    return {
      phone: row.phone,
      password2fa: row.password2faEnc ? decrypt(row.password2faEnc) : null,
    };
  },

  /** Tambah stok baru — dipanggil setelah login berhasil atau import session. */
  async addStock(input: {
    productId: string;
    phone: string;
    password2fa?: string;
    sessionEnc?: string;   // sudah dienkripsi oleh login flow
    apiId?: number;
    apiHashEnc?: string;
    notes?: string;
  }): Promise<StockDto> {
    const data: CreateStockInput = {
      productId: input.productId,
      phone: input.phone,
      notes: input.notes,
    };

    if (input.password2fa) data.password2faEnc = encrypt(input.password2fa);
    if (input.sessionEnc) {
      data.sessionEnc = input.sessionEnc;
      data.status = 'AVAILABLE';
      data.isSessionActive = true;
    } else {
      data.status = 'NO_SESSION';
      data.isSessionActive = false;
    }
    if (input.apiId) data.apiId = input.apiId;
    if (input.apiHashEnc) data.apiHashEnc = input.apiHashEnc;

    const row = await stockRepository.create(data);
    log.info({ id: row.id, phone: row.phone, status: row.status }, 'stock added');
    return toDto(row);
  },

  /** Assign satu akun AVAILABLE ke order (atomic reserve). */
  async reserveForOrder(productId: string, orderId: string): Promise<StockDto> {
    const row = await stockRepository.reserveOne(productId, orderId);
    if (!row) {
      throw new Error('Stok akun habis untuk produk ini');
    }
    log.info({ stockId: row.id, orderId }, 'stock reserved');
    return toDto(row);
  },

  async confirmSold(stockId: string): Promise<StockDto> {
    const row = await stockRepository.markSold(stockId);
    log.info({ stockId: row.id }, 'stock marked SOLD');
    return toDto(row);
  },

  async releaseReserved(stockId: string): Promise<void> {
    await stockRepository.releaseReserved(stockId);
    log.info({ stockId }, 'stock released back to AVAILABLE');
  },

  /** Buyer melaporkan sudah logout web session. */
  async markBuyerLoggedOut(stockId: string): Promise<void> {
    await stockRepository.update(stockId, { isLoggedOutByBuyer: true });
  },

  /** Tandai session tidak valid (dipanggil oleh otp.service saat connect gagal). */
  async markInvalid(stockId: string): Promise<void> {
    await stockRepository.update(stockId, {
      status: 'INVALID',
      isSessionActive: false,
    });
    log.warn({ stockId }, 'stock marked INVALID (session dead)');
  },

  /** Update session setelah login berhasil via stock-login.service. */
  async applySession(stockId: string, sessionEnc: string): Promise<StockDto> {
    const row = await stockRepository.update(stockId, {
      sessionEnc,
      status: 'AVAILABLE',
      isSessionActive: true,
    });
    log.info({ stockId }, 'session applied to stock');
    return toDto(row);
  },

  async remove(id: string): Promise<void> {
    const row = await stockRepository.findById(id);
    if (!row) throw new NotFoundError('TelegramAccountStock');
    await stockRepository.remove(id);
    log.info({ id }, 'stock deleted');
  },

  async countByStatus(productId: string) {
    return stockRepository.countByStatus(productId);
  },
};
