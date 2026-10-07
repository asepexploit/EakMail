/**
 * CRUD + query untuk TelegramAccountStock.
 * Semua field sensitif (sessionEnc, password2faEnc, apiHashEnc) disimpan
 * terenkripsi — tidak pernah dikembalikan ke luar modul ini dalam bentuk plain.
 */
import { prisma } from '../../db/client.js';
import type { TelegramAccountStockStatus } from '@prisma/client';

export interface StockRow {
  id: string;
  productId: string;
  phone: string;
  password2faEnc: string | null;
  sessionEnc: string | null;
  apiId: number | null;
  apiHashEnc: string | null;
  status: TelegramAccountStockStatus;
  isSessionActive: boolean;
  isLoggedOutByBuyer: boolean;
  orderId: string | null;
  soldAt: Date | null;
  lastOtpRequestAt: Date | null;
  otpRequestCount: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateStockInput {
  productId: string;
  phone: string;
  password2faEnc?: string;
  sessionEnc?: string;
  apiId?: number;
  apiHashEnc?: string;
  notes?: string;
  status?: TelegramAccountStockStatus;
  isSessionActive?: boolean;
}

export interface UpdateStockInput {
  status?: TelegramAccountStockStatus;
  sessionEnc?: string;
  password2faEnc?: string;
  isSessionActive?: boolean;
  isLoggedOutByBuyer?: boolean;
  orderId?: string;
  soldAt?: Date;
  lastOtpRequestAt?: Date;
  otpRequestCount?: number;
  notes?: string;
}

export const stockRepository = {
  async create(data: CreateStockInput): Promise<StockRow> {
    return prisma.telegramAccountStock.create({ data });
  },

  async findById(id: string): Promise<StockRow | null> {
    return prisma.telegramAccountStock.findUnique({ where: { id } });
  },

  async findByOrderId(orderId: string): Promise<StockRow | null> {
    return prisma.telegramAccountStock.findUnique({ where: { orderId } });
  },

  async findAll(filters?: {
    productId?: string;
    status?: TelegramAccountStockStatus;
  }): Promise<StockRow[]> {
    return prisma.telegramAccountStock.findMany({
      where: {
        ...(filters?.productId ? { productId: filters.productId } : {}),
        ...(filters?.status ? { status: filters.status } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  /** Ambil satu akun AVAILABLE untuk di-reserve ke sebuah order (atomic). */
  async reserveOne(productId: string, orderId: string): Promise<StockRow | null> {
    return prisma.$transaction(async (tx) => {
      const stock = await tx.telegramAccountStock.findFirst({
        where: { productId, status: 'AVAILABLE', isSessionActive: true },
        orderBy: { createdAt: 'asc' },
      });
      if (!stock) return null;
      return tx.telegramAccountStock.update({
        where: { id: stock.id },
        data: { status: 'RESERVED', orderId },
      });
    });
  },

  /** Konfirmasi RESERVED → SOLD setelah pembayaran sukses. */
  async markSold(id: string): Promise<StockRow> {
    return prisma.telegramAccountStock.update({
      where: { id },
      data: { status: 'SOLD', soldAt: new Date() },
    });
  },

  /** Kembalikan RESERVED → AVAILABLE bila order dibatalkan / expired. */
  async releaseReserved(id: string): Promise<void> {
    await prisma.telegramAccountStock.update({
      where: { id },
      data: { status: 'AVAILABLE', orderId: null },
    });
  },

  async update(id: string, data: UpdateStockInput): Promise<StockRow> {
    return prisma.telegramAccountStock.update({ where: { id }, data });
  },

  async incrementOtpCount(id: string): Promise<void> {
    await prisma.telegramAccountStock.update({
      where: { id },
      data: {
        otpRequestCount: { increment: 1 },
        lastOtpRequestAt: new Date(),
      },
    });
  },

  async countByStatus(productId: string): Promise<Record<TelegramAccountStockStatus, number>> {
    const rows = await prisma.telegramAccountStock.groupBy({
      by: ['status'],
      where: { productId },
      _count: { status: true },
    });
    const base: Record<TelegramAccountStockStatus, number> = {
      AVAILABLE: 0,
      RESERVED: 0,
      SOLD: 0,
      INVALID: 0,
      NO_SESSION: 0,
    };
    for (const r of rows) base[r.status] = r._count.status;
    return base;
  },

  async remove(id: string): Promise<void> {
    await prisma.telegramAccountStock.delete({ where: { id } });
  },
};
