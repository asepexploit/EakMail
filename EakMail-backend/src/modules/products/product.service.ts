/**
 * Product business logic (F6; PRD.md §5.4). Owns CRUD over products + their options
 * (each with a fixed price), the active toggle, and audit-logging of price changes.
 * Takes/returns plain DTOs — never Fastify objects (backend-guide.md §2).
 */
import type {
  ProductDto,
  ProductOptionDto,
  UpsertProductRequest,
} from '@eakmail/shared-types';
import { StockMode } from '@eakmail/shared-types';
import { NotFoundError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import * as repository from './product.repository.js';
import type { ProductWithOptions } from './product.repository.js';

const log = logger.child({ module: 'products' });

function toOptionDto(option: ProductWithOptions['options'][number]): ProductOptionDto {
  return {
    id: option.id,
    key: option.key,
    value: option.value,
    price: option.price,
  };
}

function toDto(product: ProductWithOptions): ProductDto {
  return {
    id: product.id,
    name: product.name,
    price: product.price,
    sku: product.sku,
    description: product.description,
    imageUrl: product.imageUrl,
    supplierId: product.supplierId,
    workflowId: product.workflowId,
    stockMode: product.stockMode as ProductDto['stockMode'],
    stock: product.stock,
    deliveryTemplate: product.deliveryTemplate ?? null,
    externalProductId: product.externalProductId ?? null,
    active: product.active,
    isEakTele: product.isEakTele,
    options: product.options.map(toOptionDto),
  };
}

/** Normalize inbound options to Prisma createMany rows, defaulting price to 0. */
function toOptionRows(options: UpsertProductRequest['options']) {
  return (options ?? []).map((o) => ({
    key: o.key,
    value: o.value,
    price: o.price ?? 0,
  }));
}

export async function listProducts(isEakTele = false): Promise<ProductDto[]> {
  const products = await repository.findAll(isEakTele);
  return products.map(toDto);
}

export async function getProduct(id: string): Promise<ProductDto> {
  const product = await repository.findById(id);
  if (!product) throw new NotFoundError('Product');
  return toDto(product);
}

export async function createProduct(input: UpsertProductRequest): Promise<ProductDto> {
  const created = await repository.create({
    name: input.name,
    price: input.price,
    sku: input.sku ?? null,
    description: input.description ?? null,
    imageUrl: input.imageUrl ?? null,
    stockMode: input.stockMode ?? StockMode.MANUAL,
    stock: input.stock ?? 0,
    deliveryTemplate: input.deliveryTemplate ?? null,
    externalProductId: input.externalProductId ?? null,
    active: input.active ?? true,
    isEakTele: input.isEakTele ?? false,
    supplier: input.supplierId ? { connect: { id: input.supplierId } } : undefined,
    workflow: input.workflowId ? { connect: { id: input.workflowId } } : undefined,
    options: { createMany: { data: toOptionRows(input.options) } },
  });
  return toDto(created);
}

export async function updateProduct(
  id: string,
  input: UpsertProductRequest,
  adminUserId?: string,
): Promise<ProductDto> {
  const existing = await repository.findById(id);
  if (!existing) throw new NotFoundError('Product');

  const updated = await repository.updateWithOptions(
    id,
    {
      name: input.name,
      price: input.price,
      sku: input.sku ?? null,
      description: input.description ?? null,
      imageUrl: input.imageUrl ?? null,
      stockMode: input.stockMode ?? existing.stockMode,
      stock: input.stock ?? existing.stock,
      deliveryTemplate: input.deliveryTemplate !== undefined ? (input.deliveryTemplate ?? null) : existing.deliveryTemplate,
      externalProductId: input.externalProductId !== undefined ? (input.externalProductId ?? null) : existing.externalProductId,
      active: input.active ?? existing.active,
      isEakTele: input.isEakTele ?? existing.isEakTele,
      // Reconnect (or clear) relations explicitly so an omitted id detaches.
      supplier: input.supplierId
        ? { connect: { id: input.supplierId } }
        : { disconnect: true },
      workflow: input.workflowId
        ? { connect: { id: input.workflowId } }
        : { disconnect: true },
    },
    toOptionRows(input.options),
  );

  if (existing.price !== updated.price) {
    await auditPriceChange(id, existing.price, updated.price, adminUserId);
  }

  return toDto(updated);
}

export async function setProductActive(
  id: string,
  active: boolean,
): Promise<ProductDto> {
  const existing = await repository.findById(id);
  if (!existing) throw new NotFoundError('Product');
  const updated = await repository.setActive(id, active);
  return toDto(updated);
}

export async function deleteProduct(id: string): Promise<void> {
  const existing = await repository.findById(id);
  if (!existing) throw new NotFoundError('Product');
  await repository.remove(id);
}

/** Record a price change in the audit log (backend-guide.md §7). */
async function auditPriceChange(
  productId: string,
  from: number,
  to: number,
  adminUserId?: string,
): Promise<void> {
  await repository.writeAuditLog({
    action: 'product.price.changed',
    target: productId,
    meta: { from, to },
    adminUser: adminUserId ? { connect: { id: adminUserId } } : undefined,
  });
  log.info({ productId, from, to }, 'product price changed');
}
