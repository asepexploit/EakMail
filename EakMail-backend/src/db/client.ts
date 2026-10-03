/** Shared Prisma client singleton. Repositories import `prisma` from here. */
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
