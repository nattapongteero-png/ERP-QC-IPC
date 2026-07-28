/**
 * Thai tax-identification-number helpers.
 *
 * A เลขประจำตัวผู้เสียภาษี is exactly 13 digits. It is printed on the
 * ใบกำกับภาษี for both parties, and มาตรา 86/4 makes the buyer's number part of
 * what a tax invoice must state. A malformed value is worse than an empty one:
 * it renders onto the document and quietly makes it invalid, so validate on the
 * way in rather than at print time.
 */

/** Strip spaces and hyphens people paste in from other systems. */
export function stripTaxIdFormatting(value: string): string {
  return value.replace(/[\s-]/g, '');
}

/**
 * Normalize a tax ID for storage.
 *
 * - null / undefined / '' → '' (absent, which is allowed: cash and retail
 *   buyers genuinely have no registered number)
 * - 13 digits (with or without spaces/hyphens) → the bare 13 digits
 * - anything else → null, meaning "reject this input"
 */
export function normalizeTaxId(value: unknown): string | null {
  if (value == null) return '';
  const raw = String(value).trim();
  if (raw === '') return '';

  const digits = stripTaxIdFormatting(raw);
  if (!/^\d{13}$/.test(digits)) return null;
  return digits;
}

/** True when the value is a well-formed 13-digit Thai tax ID. */
export function isValidTaxId(value: unknown): boolean {
  const normalized = normalizeTaxId(value);
  return normalized !== null && normalized !== '';
}

/** Display form: 0-0000-00000-00-0, the layout used on Thai tax documents. */
export function formatTaxId(value: unknown): string {
  const normalized = normalizeTaxId(value);
  if (!normalized) return '';
  return [
    normalized.slice(0, 1),
    normalized.slice(1, 5),
    normalized.slice(5, 10),
    normalized.slice(10, 12),
    normalized.slice(12),
  ].join('-');
}
