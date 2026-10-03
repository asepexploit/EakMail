/**
 * Data access for AdminUser. No HTTP, no business rules — Prisma only.
 * (.claude/instructions/backend-guide.md §2)
 */
import type { AdminUser } from '@prisma/client';
import { prisma } from '../../db/client.js';

export function findByEmail(email: string): Promise<AdminUser | null> {
  return prisma.adminUser.findUnique({ where: { email } });
}

export function findById(id: string): Promise<AdminUser | null> {
  return prisma.adminUser.findUnique({ where: { id } });
}

export function createAdminUser(input: {
  email: string;
  passwordHash: string;
  totpSecret?: string | null;
  role?: string;
}): Promise<AdminUser> {
  return prisma.adminUser.create({
    data: {
      email: input.email,
      passwordHash: input.passwordHash,
      totpSecret: input.totpSecret ?? null,
      role: input.role ?? 'admin',
    },
  });
}
