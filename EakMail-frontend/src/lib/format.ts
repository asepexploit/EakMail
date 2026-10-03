/**
 * Locale-aware formatting for the dashboard.
 * Currency is Rupiah and dates/numbers use the Indonesian locale
 * (DESIGN_SYSTEM.md §14). Code stays English; only the output is localized.
 */

const ID_LOCALE = 'id-ID';

const rupiahFormatter = new Intl.NumberFormat(ID_LOCALE, {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat(ID_LOCALE);

const dateFormatter = new Intl.DateTimeFormat(ID_LOCALE, {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat(ID_LOCALE, {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const timeFormatter = new Intl.DateTimeFormat(ID_LOCALE, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/** Amounts are stored as integer Rupiah (no minor units). */
export function formatRupiah(amount: number): string {
  if (!Number.isFinite(amount)) return 'Rp 0';
  return rupiahFormatter.format(amount);
}

/** Whole/decimal number with Indonesian grouping (e.g. 1.234). */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return numberFormatter.format(value);
}

/** Percentage from an already-scaled value (0..100). */
export function formatPercent(value: number, fractionDigits = 1): string {
  if (!Number.isFinite(value)) return '0%';
  return `${value.toFixed(fractionDigits)}%`;
}

function toDate(input: Date | string | number): Date {
  return input instanceof Date ? input : new Date(input);
}

export function formatDate(input: Date | string | number): string {
  const date = toDate(input);
  if (Number.isNaN(date.getTime())) return '-';
  return dateFormatter.format(date);
}

export function formatDateTime(input: Date | string | number): string {
  const date = toDate(input);
  if (Number.isNaN(date.getTime())) return '-';
  return dateTimeFormatter.format(date);
}

export function formatTime(input: Date | string | number): string {
  const date = toDate(input);
  if (Number.isNaN(date.getTime())) return '-';
  return timeFormatter.format(date);
}

/** Compact elapsed duration from milliseconds (e.g. "1.2s", "3m 04s"). */
export function formatDuration(milliseconds: number): string {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return '-';
  if (milliseconds < 1000) return `${Math.round(milliseconds)}ms`;
  const totalSeconds = milliseconds / 1000;
  if (totalSeconds < 60) return `${totalSeconds.toFixed(1)}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
}
