import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatDateTime,
  formatDuration,
  formatNumber,
  formatPercent,
  formatRupiah,
  formatTime,
} from './format.js';

/**
 * Locale output depends on the ICU data bundled with the Node runtime. We assert on
 * structure/tokens (currency marker, grouping separators, month name, digits) rather
 * than an exact byte-for-byte string, so tests stay stable across Node minor versions.
 */

describe('formatRupiah', () => {
  it('formats an integer amount as IDR with no minor units', () => {
    const out = formatRupiah(1500000);
    expect(out).toContain('Rp');
    // id-ID groups thousands with a dot.
    expect(out).toContain('1.500.000');
    expect(out).not.toContain(','); // no decimal fraction
  });

  it('formats zero', () => {
    expect(formatRupiah(0)).toContain('0');
    expect(formatRupiah(0)).toContain('Rp');
  });

  it('falls back to "Rp 0" for non-finite input', () => {
    expect(formatRupiah(Number.NaN)).toBe('Rp 0');
    expect(formatRupiah(Number.POSITIVE_INFINITY)).toBe('Rp 0');
  });
});

describe('formatNumber', () => {
  it('groups thousands with the Indonesian separator', () => {
    expect(formatNumber(1234)).toBe('1.234');
    expect(formatNumber(1000000)).toBe('1.000.000');
  });

  it('returns "0" for non-finite input', () => {
    expect(formatNumber(Number.NaN)).toBe('0');
  });
});

describe('formatPercent', () => {
  it('renders a scaled value with one fraction digit by default', () => {
    expect(formatPercent(42.5)).toBe('42.5%');
  });

  it('honours a custom fraction-digit count', () => {
    expect(formatPercent(42, 0)).toBe('42%');
    expect(formatPercent(42.567, 2)).toBe('42.57%');
  });

  it('returns "0%" for non-finite input', () => {
    expect(formatPercent(Number.NaN)).toBe('0%');
  });
});

describe('date formatting (id-ID)', () => {
  // 15 Jan 2025 09:05:07 local time.
  const sample = new Date(2025, 0, 15, 9, 5, 7);

  it('formatDate renders day, short month and 4-digit year', () => {
    const out = formatDate(sample);
    expect(out).toMatch(/15/);
    expect(out).toMatch(/2025/);
    // id-ID short month for January is "Jan"; assert a 3-letter month token exists.
    expect(out).toMatch(/[A-Za-z]{3}/);
  });

  it('formatDate accepts an ISO string', () => {
    const out = formatDate('2025-01-15T00:00:00.000Z');
    expect(out).toMatch(/2025/);
  });

  it('formatDate accepts an epoch millis number', () => {
    const out = formatDate(sample.getTime());
    expect(out).toMatch(/2025/);
  });

  it('formatDateTime includes an hour:minute component', () => {
    const out = formatDateTime(sample);
    expect(out).toMatch(/2025/);
    expect(out).toMatch(/\d{2}[.:]\d{2}/); // id-ID uses "." as time separator
  });

  it('formatTime renders hh:mm:ss', () => {
    const out = formatTime(sample);
    expect(out).toMatch(/\d{2}[.:]\d{2}[.:]\d{2}/);
  });

  it('returns "-" for an invalid date across all date formatters', () => {
    expect(formatDate('not-a-date')).toBe('-');
    expect(formatDateTime('not-a-date')).toBe('-');
    expect(formatTime('not-a-date')).toBe('-');
  });
});

describe('formatDuration', () => {
  it('renders sub-second durations in ms', () => {
    expect(formatDuration(0)).toBe('0ms');
    expect(formatDuration(250)).toBe('250ms');
    expect(formatDuration(999)).toBe('999ms');
  });

  it('renders seconds with one decimal below a minute', () => {
    expect(formatDuration(1200)).toBe('1.2s');
    expect(formatDuration(59_000)).toBe('59.0s');
  });

  it('renders minutes and zero-padded seconds at/above a minute', () => {
    expect(formatDuration(60_000)).toBe('1m 00s');
    expect(formatDuration(184_000)).toBe('3m 04s');
  });

  it('returns "-" for negative or non-finite input', () => {
    expect(formatDuration(-1)).toBe('-');
    expect(formatDuration(Number.NaN)).toBe('-');
  });
});
