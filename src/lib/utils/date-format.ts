/**
 * Client-side date formatting utilities
 *
 * These functions extract date strings using LOCAL timezone,
 * avoiding the UTC shift caused by Date.toISOString().
 *
 * Problem: toISOString() converts to UTC, so in UTC+7 (Bangkok),
 * a date picked as "March 31 00:00 local" becomes "March 30 17:00 UTC",
 * and .split('T')[0] returns "2026-03-30" instead of "2026-03-31".
 */

/**
 * Extract YYYY-MM-DD from a Date using local timezone (not UTC).
 * Safe replacement for `date.toISOString().split('T')[0]`.
 */
export function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
