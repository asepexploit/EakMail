/**
 * Order pricing: amount = selected option's price (if any option selected), else product.price.
 * Each option carries its own fixed price — not a delta from the base.
 * Pure functions — no I/O — so pricing is unit-testable in isolation (PRD.md §5.4).
 */
import type { ProductOption } from '@prisma/client';

/** A selected option, identified by its option row id. */
export interface SelectedOption {
  optionId: string;
}

/**
 * Compute the order unit price. When an option is selected its fixed price is used directly;
 * when no option is selected the product's base price applies. Only one option is expected
 * per order (the first selected wins). Throws when a selected option id is not one of the
 * product's options (guards against tampered/stale selections).
 */
export function computeOrderAmount(
  basePrice: number,
  options: Pick<ProductOption, 'id' | 'price'>[],
  selected: SelectedOption[],
): number {
  if (selected.length === 0) return basePrice;
  const byId = new Map(options.map((o) => [o.id, o.price]));
  const first = selected[0];
  if (!first) return basePrice;
  const optionPrice = byId.get(first.optionId);
  if (optionPrice === undefined) {
    throw new Error(`Unknown product option: ${first.optionId}`);
  }
  return optionPrice;
}

/**
 * Build the deterministic idempotency key for an order. Two create calls with the same
 * customer, product, selected options, and client-supplied token collapse to one order —
 * the unique constraint on `Order.idempotencyKey` enforces it at the DB.
 */
export function buildIdempotencyKey(
  customerId: string,
  productId: string,
  selected: SelectedOption[],
  clientToken?: string,
): string {
  const optionPart = selected
    .map((s) => s.optionId)
    .sort()
    .join(',');
  const token = clientToken?.trim() || 'default';
  return `${customerId}:${productId}:${optionPart}:${token}`;
}
