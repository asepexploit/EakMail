/**
 * Bot config data access (Prisma). The storefront bot configuration is a single row
 * (F17; PRD.md §5.4a). No HTTP, no business rules — see backend-guide.md §2.
 */
import type { BotConfig, Prisma } from '@prisma/client';
import { prisma } from '../../db/client.js';

/**
 * Return the single BotConfig row, creating an empty one on first access.
 * The dashboard always edits one storefront bot, so the row is a singleton.
 */
export async function getSingleton(): Promise<BotConfig> {
  const existing = await prisma.botConfig.findFirst();
  if (existing) return existing;
  return prisma.botConfig.create({ data: {} });
}

export async function update(
  id: string,
  data: Prisma.BotConfigUpdateInput,
): Promise<BotConfig> {
  return prisma.botConfig.update({ where: { id }, data });
}
