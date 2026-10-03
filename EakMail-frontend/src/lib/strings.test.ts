import { describe, expect, it } from 'vitest';
import { strings } from './strings.js';

/**
 * Guards against accidentally-deleted UI copy keys. Components read these by path,
 * so a missing key is a runtime `undefined` in the dashboard. We assert the key sets
 * for navigation and common actions exist and are non-empty Bahasa Indonesia strings.
 */

function expectNonEmptyString(value: unknown): void {
  expect(typeof value).toBe('string');
  expect((value as string).length).toBeGreaterThan(0);
}

describe('strings.nav', () => {
  const requiredNavKeys = [
    'overview',
    'orders',
    'monitoring',
    'logs',
    'products',
    'suppliers',
    'accounts',
    'botConfig',
    'workflowBuilder',
    'payments',
    'settings',
  ] as const;

  it('exposes every top-level nav label', () => {
    for (const key of requiredNavKeys) {
      expect(strings.nav).toHaveProperty(key);
      expectNonEmptyString((strings.nav as Record<string, unknown>)[key]);
    }
  });

  it('exposes all sidebar group headings', () => {
    const groups = strings.nav.groups;
    for (const key of ['operasional', 'katalog', 'bot', 'builder', 'sistem'] as const) {
      expectNonEmptyString(groups[key]);
    }
  });
});

describe('strings.actions', () => {
  const requiredActionKeys = [
    'save',
    'cancel',
    'delete',
    'edit',
    'add',
    'create',
    'close',
    'confirm',
    'retry',
    'refund',
    'refresh',
    'search',
    'filter',
    'test',
  ] as const;

  it('exposes every common action label', () => {
    for (const key of requiredActionKeys) {
      expect(strings.actions).toHaveProperty(key);
      expectNonEmptyString((strings.actions as Record<string, unknown>)[key]);
    }
  });
});

describe('strings.common', () => {
  it('exposes generic state words used across pages', () => {
    for (const key of ['active', 'inactive', 'loading', 'empty', 'error', 'all'] as const) {
      expectNonEmptyString((strings.common as Record<string, unknown>)[key]);
    }
  });
});

describe('strings.table', () => {
  it('rowCount is a function producing an Indonesian label', () => {
    expect(typeof strings.table.rowCount).toBe('function');
    expect(strings.table.rowCount(5)).toBe('5 baris');
  });
});

describe('brand', () => {
  it('names the product', () => {
    expect(strings.brand.name).toBe('EakMail');
    expectNonEmptyString(strings.brand.tagline);
  });
});
