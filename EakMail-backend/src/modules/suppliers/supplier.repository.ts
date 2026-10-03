/**
 * Supplier data access (Prisma). No HTTP, no business rules — just queries.
 * A supplier's bound Telegram accounts live in the SupplierAccount join table.
 */
import { prisma } from '../../db/client.js';
import type { Prisma } from '@prisma/client';

/** A supplier row with its account bindings eagerly loaded. */
const supplierWithAccounts = {
  include: { accounts: true },
} satisfies Prisma.SupplierDefaultArgs;

export type SupplierRecord = Prisma.SupplierGetPayload<typeof supplierWithAccounts>;

export interface CreateSupplierData {
  name: string;
  supplierType: string;
  botUsername: string;
  accountIds: string[];
  defaultWorkflowId: string | null;
  apiBaseUrl?: string | null;
  apiKeyEnc?: string | null;
  apiAuthHeader?: string | null;
}

export interface UpdateSupplierData {
  name: string;
  supplierType: string;
  botUsername: string;
  accountIds: string[];
  defaultWorkflowId: string | null;
  apiBaseUrl?: string | null;
  /** When null: keep existing key. When string: replace with new encrypted value. */
  apiKeyEnc?: string | null;
  apiAuthHeader?: string | null;
}

export function findAll(): Promise<SupplierRecord[]> {
  return prisma.supplier.findMany({
    ...supplierWithAccounts,
    orderBy: { createdAt: 'desc' },
  });
}

export function findById(id: string): Promise<SupplierRecord | null> {
  return prisma.supplier.findUnique({
    where: { id },
    ...supplierWithAccounts,
  });
}

/** How many of the given account ids actually exist (for bind validation). */
export function countAccounts(accountIds: string[]): Promise<number> {
  if (accountIds.length === 0) return Promise.resolve(0);
  return prisma.telegramAccount.count({ where: { id: { in: accountIds } } });
}

export function create(data: CreateSupplierData): Promise<SupplierRecord> {
  return prisma.supplier.create({
    data: {
      name: data.name,
      supplierType: data.supplierType,
      botUsername: data.botUsername,
      defaultWorkflowId: data.defaultWorkflowId,
      apiBaseUrl: data.apiBaseUrl ?? null,
      apiKeyEnc: data.apiKeyEnc ?? null,
      apiAuthHeader: data.apiAuthHeader ?? null,
      accounts: {
        create: data.accountIds.map((accountId) => ({ accountId })),
      },
    },
    ...supplierWithAccounts,
  });
}

/**
 * Update supplier fields and fully replace its account bindings in one
 * transaction (delete-then-create keeps the join table in sync with accountIds).
 * apiKeyEnc: null = clear key; undefined = keep existing.
 */
export function update(id: string, data: UpdateSupplierData): Promise<SupplierRecord> {
  return prisma.supplier.update({
    where: { id },
    data: {
      name: data.name,
      supplierType: data.supplierType,
      botUsername: data.botUsername,
      defaultWorkflowId: data.defaultWorkflowId,
      apiBaseUrl: data.apiBaseUrl ?? null,
      ...(data.apiKeyEnc !== undefined ? { apiKeyEnc: data.apiKeyEnc } : {}),
      apiAuthHeader: data.apiAuthHeader ?? null,
      accounts: {
        deleteMany: {},
        create: data.accountIds.map((accountId) => ({ accountId })),
      },
    },
    ...supplierWithAccounts,
  });
}

export function remove(id: string): Promise<void> {
  return prisma.supplier.delete({ where: { id } }).then(() => undefined);
}
