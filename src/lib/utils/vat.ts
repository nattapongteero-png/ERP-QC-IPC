/**
 * VAT calculation — single source of truth for the whole app.
 *
 * Thai VAT (7%) is computed at the LINE level, rounded to 2 decimals, then
 * summed (กรมสรรพากร practice). Two pricing modes:
 *
 *  - EXCLUSIVE ("ก่อน VAT" / add on top): the entered amount is the base.
 *      vat = round2(amount * rate);  total = amount + vat
 *      e.g. 650 → base 650, VAT 45.50, total 695.50
 *
 *  - INCLUSIVE ("รวม VAT" / already contains VAT): the entered amount is the
 *      gross. Extract by DIVISION (7/107), never subtraction:
 *      base = round2(amount / (1 + rate));  vat = round2(amount - base)
 *      e.g. 650 → base 607.48, VAT 42.52, total 650.00
 *
 * Either way the base+VAT breakdown ("ที่มา") is always available — required by
 * ป.รัษฎากร ม.86/4 on tax invoices.
 */

export const THAI_VAT_RATE = 0.07;

/** Round to 2 decimals (half-up), guarding against binary-float drift. */
export function round2(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

export interface LineVat {
  /** Amount before VAT (base / ก่อน VAT). */
  base: number;
  /** VAT portion. */
  vat: number;
  /** Amount including VAT (รวม VAT). */
  total: number;
}

/**
 * VAT for a single line amount, honouring the inclusive/exclusive mode.
 * `amount` is the line total as the user entered it (net when exclusive, gross
 * when inclusive).
 */
export function calcLineVat(
  amount: number,
  isInclusive: boolean,
  rate: number = THAI_VAT_RATE,
): LineVat {
  const amt = Number(amount) || 0;
  if (isInclusive) {
    const base = round2(amt / (1 + rate));
    const vat = round2(amt - base);
    return { base, vat, total: round2(amt) };
  }
  const vat = round2(amt * rate);
  return { base: round2(amt), vat, total: round2(amt + vat) };
}

export interface DocVat {
  /** Sum of line bases (ยอดก่อน VAT / subtotal). */
  subtotal: number;
  /** Sum of line VAT (ภาษีมูลค่าเพิ่ม). */
  vatAmount: number;
  /** Sum of line totals (ยอดรวม / รวม VAT). */
  total: number;
}

/**
 * Document-level VAT: compute each line then sum (line-level rounding, Thai
 * standard). Optional `extraCharges` (shipping / other) are treated as further
 * VAT-exclusive lines when `chargesTaxable` is true, or added to the total after
 * VAT when false. Default: charges are NOT taxed (added on top of the total).
 */
export function computeDocVat(
  lineTotals: Array<number | null | undefined>,
  isInclusive: boolean,
  opts?: { rate?: number; extraCharges?: number; chargesTaxable?: boolean },
): DocVat {
  const rate = opts?.rate ?? THAI_VAT_RATE;
  let subtotal = 0;
  let vatAmount = 0;
  let total = 0;
  for (const raw of lineTotals) {
    const { base, vat, total: lineTotal } = calcLineVat(Number(raw) || 0, isInclusive, rate);
    subtotal += base;
    vatAmount += vat;
    total += lineTotal;
  }
  const charges = Number(opts?.extraCharges) || 0;
  if (charges > 0) {
    if (opts?.chargesTaxable) {
      const { base, vat, total: chTotal } = calcLineVat(charges, isInclusive, rate);
      subtotal += base;
      vatAmount += vat;
      total += chTotal;
    } else {
      // Non-taxable charge — sits outside VAT, added to the grand total only.
      total += charges;
    }
  }
  return { subtotal: round2(subtotal), vatAmount: round2(vatAmount), total: round2(total) };
}
