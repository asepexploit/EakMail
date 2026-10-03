/**
 * Small display formatters for bot messages. Formatting only — no copy lives here
 * (copy stays in the i18n catalog); these produce the numeric/date substrings that
 * templates interpolate.
 */

/** Group a Rupiah integer with thousands separators, e.g. 15000 → "15.000". */
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID').format(amount);
}

/** Format an expiry timestamp in Jakarta time, or empty string when absent. */
export function formatExpiry(date: Date | string | null): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  }).format(d);
}
