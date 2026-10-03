/**
 * Supplier business logic. Handles both BOT and API supplier types.
 * API secrets are encrypted before storage; the key is never returned in DTOs.
 * Takes/returns plain data — no Fastify objects. See backend-guide.md §2.
 */
import type {
  SupplierDto,
  UpsertSupplierRequest,
  ApiSupplierSyncResponse,
} from '@eakmail/shared-types';
import { SupplierType } from '@eakmail/shared-types';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import { encrypt } from '../../lib/crypto.js';
import * as repository from './supplier.repository.js';
import type { SupplierRecord } from './supplier.repository.js';
import { fetchApiProducts, fetchApiProfile } from './api-supplier.service.js';

function toDto(record: SupplierRecord): SupplierDto {
  return {
    id: record.id,
    name: record.name,
    supplierType: (record.supplierType as SupplierDto['supplierType']) ?? SupplierType.BOT,
    botUsername: record.botUsername,
    accountIds: record.accounts.map((binding) => binding.accountId),
    defaultWorkflowId: record.defaultWorkflowId,
    apiBaseUrl: record.apiBaseUrl ?? null,
    apiKeySet: Boolean(record.apiKeyEnc),
    apiAuthHeader: record.apiAuthHeader ?? null,
    successRate: record.successRate,
    avgFulfillMs: record.avgFulfillMs,
    lastError: record.lastError,
  };
}

/** Ensure every accountId in the request refers to a real TelegramAccount. */
async function assertAccountsExist(accountIds: string[]): Promise<void> {
  const unique = Array.from(new Set(accountIds));
  if (unique.length !== accountIds.length) {
    throw new ValidationError('Duplicate account ids in accountIds.');
  }
  if (unique.length === 0) return;
  const found = await repository.countAccounts(unique);
  if (found !== unique.length) {
    throw new ValidationError('One or more bound Telegram accounts do not exist.');
  }
}

export async function listSuppliers(): Promise<SupplierDto[]> {
  const records = await repository.findAll();
  return records.map(toDto);
}

export async function getSupplier(id: string): Promise<SupplierDto> {
  const record = await repository.findById(id);
  if (!record) throw new NotFoundError('Supplier');
  return toDto(record);
}

export async function createSupplier(input: UpsertSupplierRequest): Promise<SupplierDto> {
  const type = input.supplierType ?? SupplierType.BOT;
  const accountIds = input.accountIds ?? [];
  if (type === SupplierType.BOT) {
    await assertAccountsExist(accountIds);
  }
  const apiKeyEnc = input.apiKey ? encrypt(input.apiKey) : null;
  const record = await repository.create({
    name: input.name,
    supplierType: type,
    botUsername: input.botUsername ?? '',
    accountIds: Array.from(new Set(accountIds)),
    defaultWorkflowId: input.defaultWorkflowId ?? null,
    apiBaseUrl: input.apiBaseUrl ?? null,
    apiKeyEnc,
    apiAuthHeader: input.apiAuthHeader ?? null,
  });
  return toDto(record);
}

export async function updateSupplier(
  id: string,
  input: UpsertSupplierRequest,
): Promise<SupplierDto> {
  const existing = await repository.findById(id);
  if (!existing) throw new NotFoundError('Supplier');
  const type = input.supplierType ?? (existing.supplierType as SupplierType) ?? SupplierType.BOT;
  const accountIds = input.accountIds ?? [];
  if (type === SupplierType.BOT) {
    await assertAccountsExist(accountIds);
  }
  // If a new apiKey string is provided → encrypt and replace. If null → clear. If undefined → keep existing.
  const apiKeyEnc: string | null | undefined = input.apiKey !== undefined
    ? (input.apiKey ? encrypt(input.apiKey) : null)
    : undefined;

  const record = await repository.update(id, {
    name: input.name,
    supplierType: type,
    botUsername: input.botUsername ?? existing.botUsername,
    accountIds: Array.from(new Set(accountIds)),
    defaultWorkflowId: input.defaultWorkflowId !== undefined
      ? (input.defaultWorkflowId ?? null)
      : existing.defaultWorkflowId,
    apiBaseUrl: input.apiBaseUrl !== undefined ? (input.apiBaseUrl ?? null) : existing.apiBaseUrl,
    apiKeyEnc,
    apiAuthHeader: input.apiAuthHeader !== undefined
      ? (input.apiAuthHeader ?? null)
      : existing.apiAuthHeader,
  });
  return toDto(record);
}

export async function deleteSupplier(id: string): Promise<void> {
  const existing = await repository.findById(id);
  if (!existing) throw new NotFoundError('Supplier');
  await repository.remove(id);
}

/**
 * Fetch products from an API supplier + profile balance.
 * Used by the "Sync Produk" button in the dashboard.
 */
export async function syncApiSupplierProducts(
  id: string,
): Promise<ApiSupplierSyncResponse> {
  const record = await repository.findById(id);
  if (!record) throw new NotFoundError('Supplier');
  if (record.supplierType !== SupplierType.API) {
    throw new ValidationError('Supplier bukan tipe API.');
  }
  if (!record.apiBaseUrl || !record.apiKeyEnc) {
    throw new ValidationError('API Base URL dan API Key harus diisi terlebih dahulu.');
  }
  const config = {
    baseUrl: record.apiBaseUrl,
    apiKeyEnc: record.apiKeyEnc,
    authHeader: record.apiAuthHeader,
  };
  const [{ products }, profile] = await Promise.all([
    fetchApiProducts(config),
    fetchApiProfile(config),
  ]);
  return { products, balance: profile.balance, total: products.length };
}

/**
 * Return the raw (decryptable) API config for the workflow engine.
 * Never call this from an HTTP route — only from workers/engine.
 */
export async function getApiSupplierConfig(
  id: string,
): Promise<{ baseUrl: string; apiKeyEnc: string; authHeader: string | null } | null> {
  const record = await repository.findById(id);
  if (!record || record.supplierType !== SupplierType.API) return null;
  if (!record.apiBaseUrl || !record.apiKeyEnc) return null;
  return {
    baseUrl: record.apiBaseUrl,
    apiKeyEnc: record.apiKeyEnc,
    authHeader: record.apiAuthHeader ?? null,
  };
}
