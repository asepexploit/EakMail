/**
 * Data access for Telegram user accounts (Prisma only, no HTTP, no business rules).
 * .claude/instructions/backend-guide.md §2.
 */
import type { AccountStatus, Prisma, TelegramAccount } from '@prisma/client';
import { prisma } from '../../db/client.js';

export interface CreateAccountInput {
  label: string;
  phone: string;
  sessionEnc: string;
  status: AccountStatus;
}

export const accountRepository = {
  list(): Promise<TelegramAccount[]> {
    return prisma.telegramAccount.findMany({ orderBy: { createdAt: 'desc' } });
  },

  findById(id: string): Promise<TelegramAccount | null> {
    return prisma.telegramAccount.findUnique({ where: { id } });
  },

  create(input: CreateAccountInput): Promise<TelegramAccount> {
    return prisma.telegramAccount.create({ data: input });
  },

  update(id: string, data: Prisma.TelegramAccountUpdateInput): Promise<TelegramAccount> {
    return prisma.telegramAccount.update({ where: { id }, data });
  },

  delete(id: string): Promise<TelegramAccount> {
    return prisma.telegramAccount.delete({ where: { id } });
  },
};
