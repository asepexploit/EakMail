/**
 * Tests for order pricing (pure functions, no I/O):
 *  - computeOrderAmount uses the selected option's own price (not a delta)
 *  - falls back to base price when no option is selected
 *  - rejects an unknown selected option
 *  - buildIdempotencyKey is stable regardless of selection order + token normalization
 */
import '../workflow/_env.js';
import { describe, it, expect } from 'vitest';
import { computeOrderAmount, buildIdempotencyKey } from '../../src/modules/orders/order.pricing.js';

const options = [
  { id: 'opt-basic', price: 50_000 },
  { id: 'opt-premium', price: 75_000 },
  { id: 'opt-free', price: 0 },
];

describe('computeOrderAmount', () => {
  it('returns the base price when no options are selected', () => {
    expect(computeOrderAmount(15_000, options, [])).toBe(15_000);
  });

  it('uses the selected option price directly (not base + delta)', () => {
    expect(computeOrderAmount(15_000, options, [{ optionId: 'opt-premium' }])).toBe(75_000);
  });

  it('falls back to base price when the option price is 0', () => {
    expect(computeOrderAmount(15_000, options, [{ optionId: 'opt-free' }])).toBe(15_000);
  });

  it('uses the first selected option when multiple are provided', () => {
    expect(computeOrderAmount(15_000, options, [{ optionId: 'opt-basic' }, { optionId: 'opt-premium' }])).toBe(50_000);
  });

  it('throws when a selected option id is not one of the product options', () => {
    expect(() => computeOrderAmount(15_000, options, [{ optionId: 'nope' }])).toThrow(/Unknown product option/);
  });
});

describe('buildIdempotencyKey', () => {
  it('is independent of selected-option ordering', () => {
    const a = buildIdempotencyKey('cust', 'prod', [{ optionId: 'b' }, { optionId: 'a' }], 't');
    const b = buildIdempotencyKey('cust', 'prod', [{ optionId: 'a' }, { optionId: 'b' }], 't');
    expect(a).toBe(b);
  });

  it('defaults a blank client token to "default"', () => {
    const withBlank = buildIdempotencyKey('cust', 'prod', [], '   ');
    const withNone = buildIdempotencyKey('cust', 'prod', []);
    expect(withBlank).toBe(withNone);
    expect(withNone.endsWith(':default')).toBe(true);
  });

  it('distinguishes different client tokens', () => {
    const a = buildIdempotencyKey('cust', 'prod', [], 'one');
    const b = buildIdempotencyKey('cust', 'prod', [], 'two');
    expect(a).not.toBe(b);
  });
});
