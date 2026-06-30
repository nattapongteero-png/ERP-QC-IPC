/**
 * Canonical payment-terms options — the single source of truth shared by the PO
 * create + edit pages, the server validators (PO create/PATCH, PR→PO convert),
 * and the Metaherb po-submit webhook. Keeping one list here prevents the
 * create/edit forms from drifting out of sync (which is how free-text values
 * like "30วัน" / "เครดิต 1 เดือน" leaked into the DB and out to Metaherb).
 */

import { z } from 'zod';

/** The allowed payment-term codes (empty string = "not specified"). */
export const PAYMENT_TERMS_VALUES = ['', 'COD', 'Net 7', 'Net 15', 'Net 30', 'Net 45', 'Net 60'] as const;

export type PaymentTermValue = (typeof PAYMENT_TERMS_VALUES)[number];

/** Non-empty canonical codes (for "is this a known term" checks). */
const KNOWN_TERMS = new Set<string>(PAYMENT_TERMS_VALUES.filter((v) => v !== ''));

/** Dropdown options (value + Thai label) for DxSelectBox on both PO forms. */
export const PAYMENT_TERMS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '-- เลือก --' },
  { value: 'COD', label: 'COD - ชำระเงินเมื่อรับสินค้า' },
  { value: 'Net 7', label: 'Net 7 - ชำระภายใน 7 วัน' },
  { value: 'Net 15', label: 'Net 15 - ชำระภายใน 15 วัน' },
  { value: 'Net 30', label: 'Net 30 - ชำระภายใน 30 วัน' },
  { value: 'Net 45', label: 'Net 45 - ชำระภายใน 45 วัน' },
  { value: 'Net 60', label: 'Net 60 - ชำระภายใน 60 วัน' },
];

/**
 * Normalize a free-text / legacy payment-terms value to a canonical code.
 * Returns the canonical code, or null if it can't be mapped (caller decides
 * whether to reject). Already-canonical values pass straight through. Empty /
 * null → '' (not specified).
 *
 * Covers the common legacy variants seen in the wild: "Net30", "net 30",
 * "30 วัน", "เครดิต 30 วัน", "30วัน", "เงินสด"/"cash" → COD, etc.
 */
export function normalizePaymentTerms(value: string | null | undefined): string | null {
  if (value == null) return '';
  const raw = String(value).trim();
  if (raw === '') return '';

  // Already canonical (case/space-insensitive on the "Net N" form).
  const collapsed = raw.replace(/\s+/g, ' ');
  if (KNOWN_TERMS.has(collapsed)) return collapsed;

  const lower = collapsed.toLowerCase();

  // COD / cash-on-delivery / เงินสด / ชำระเมื่อรับของ
  if (
    lower === 'cod' ||
    lower.includes('cash') ||
    lower.includes('เงินสด') ||
    lower.includes('ชำระเมื่อรับ') ||
    lower.includes('ปลายทาง')
  ) {
    return 'COD';
  }

  // "Net N" written without a space, or just a day count with วัน / days /
  // เครดิต. Extract the first run of digits and snap to the nearest known term.
  const m = lower.match(/(\d{1,3})/);
  if (m && (lower.includes('net') || lower.includes('วัน') || lower.includes('day') || lower.includes('เครดิต'))) {
    const days = parseInt(m[1], 10);
    const candidate = `Net ${days}`;
    if (KNOWN_TERMS.has(candidate)) return candidate;
    // "1 เดือน" → 30; map common month phrasing.
    if (lower.includes('เดือน') || lower.includes('month')) {
      const months = days;
      const asDays = months * 30;
      const monthCandidate = `Net ${asDays}`;
      if (KNOWN_TERMS.has(monthCandidate)) return monthCandidate;
    }
  }

  // Bare "1 เดือน" / "1 month" (no digit-as-days, treat as 30-day).
  if ((lower.includes('เดือน') || lower.includes('month')) && /\b1\b/.test(lower)) {
    return 'Net 30';
  }

  return null; // unmappable → caller rejects
}

/**
 * Zod schema for a payment-terms field on a WRITE path (PO create/PATCH, PR→PO
 * convert). Accepts a canonical value, OR normalizes a legacy/free-text value to
 * canonical (backward-compat for editing old POs), and rejects anything that
 * can't be mapped. Optional + nullable; empty/undefined → undefined.
 */
export const paymentTermsWriteSchema = z
  .string()
  .max(100)
  .nullable()
  .optional()
  .transform((v) => normalizePaymentTerms(v))
  .refine((v) => v !== null, {
    message: 'เงื่อนไขการชำระเงินไม่ถูกต้อง — เลือกจากรายการมาตรฐาน (COD, Net 7/15/30/45/60)',
  })
  // After the refine, null is impossible; collapse '' → undefined so the type is
  // `string | undefined` (matches PRToPOConvertInput / DB nullable handling).
  .transform((v) => (v ? v : undefined));
