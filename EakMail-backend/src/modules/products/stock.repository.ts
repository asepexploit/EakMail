/**
 * StockItem data access — local inventory for STOCK_ONLY and STOCK_WITH_FALLBACK modes.
 * All mutations are atomic via Prisma transactions so concurrent fulfillment jobs cannot
 * double-consume the same item.
 */
import { prisma } from '../../db/client.js';
import { encrypt, decrypt } from '../../lib/crypto.js';

export const stockRepository = {
  /** Add multiple items (one payload per item). Returns count added. */
  async addItems(productId: string, payloads: string[]): Promise<number> {
    const rows = payloads
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => ({ productId, payload: encrypt(p) }));
    if (rows.length === 0) return 0;
    const result = await prisma.stockItem.createMany({ data: rows });
    return result.count;
  },

  /** Count available (unused) items for a product. */
  async countAvailable(productId: string): Promise<number> {
    return prisma.stockItem.count({ where: { productId, usedAt: null } });
  },

  /**
   * Atomically pop `quantity` available items for an order.
   * Returns the decrypted payloads, or null if not enough stock.
   */
  async popItems(productId: string, orderId: string, quantity: number): Promise<string[] | null> {
    return prisma.$transaction(async (tx) => {
      const items = await tx.stockItem.findMany({
        where: { productId, usedAt: null },
        orderBy: { createdAt: 'asc' },
        take: quantity,
        select: { id: true, payload: true },
      });
      if (items.length < quantity) return null;

      const now = new Date();
      await tx.stockItem.updateMany({
        where: { id: { in: items.map((i) => i.id) } },
        data: { usedAt: now, orderId },
      });

      return items.map((i) => decrypt(i.payload));
    });
  },

  /** List all items for a product (for admin view), with decrypted payload. */
  async listItems(productId: string) {
    const rows = await prisma.stockItem.findMany({
      where: { productId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, productId: true, payload: true, usedAt: true, orderId: true, createdAt: true },
    });
    return rows.map((r) => ({
      id: r.id,
      productId: r.productId,
      payload: decrypt(r.payload),
      usedAt: r.usedAt,
      orderId: r.orderId,
      createdAt: r.createdAt,
    }));
  },

  /** Delete unused items for a product (bulk clear). */
  async clearUnused(productId: string): Promise<number> {
    const result = await prisma.stockItem.deleteMany({
      where: { productId, usedAt: null },
    });
    return result.count;
  },
};
