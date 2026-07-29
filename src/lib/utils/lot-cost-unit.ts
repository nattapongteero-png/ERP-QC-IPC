/**
 * Lot cost/unit sanity check.
 *
 * Inventory value is computed everywhere as `quantity * cost`. That is only
 * correct when BOTH sides are expressed in the same unit. Nothing in the goods
 * receipt path enforced that, so a lot could be stored as 24,990 **g** carrying
 * a cost of 1,425 (which is the price per **kg**) and the expiry dashboard
 * happily reported ฿35,610,750 for a lot genuinely worth about ฿35,610 — a
 * factor of 1,000 out, on a figure management reads directly.
 *
 * This module does not silently "fix" the number. Rewriting a cost the user
 * entered would be worse: we cannot know whether the quantity or the cost was
 * the mistake. It reports the mismatch so the caller can refuse, warn, or ask.
 */

/** Grams per unit, for the mass units this system stores. */
const MASS_IN_GRAMS: Record<string, number> = {
  mg: 0.001,
  g: 1,
  กรัม: 1,
  kg: 1000,
  'กก.': 1000,
  กิโลกรัม: 1000,
  ton: 1_000_000,
};

/** Millilitres per unit, for volume. */
const VOLUME_IN_ML: Record<string, number> = {
  ml: 1,
  มล: 1,
  l: 1000,
  ลิตร: 1000,
};

function normalise(unit: string | null | undefined): string {
  return String(unit ?? '').trim().toLowerCase();
}

/**
 * Scale factor between two units of the same dimension, or null when they are
 * not comparable (different dimensions, or a count unit like box/bottle whose
 * size is item-specific and not derivable here).
 */
export function unitScaleFactor(
  from: string | null | undefined,
  to: string | null | undefined,
): number | null {
  const f = normalise(from);
  const t = normalise(to);
  if (!f || !t) return null;
  if (f === t) return 1;

  for (const table of [MASS_IN_GRAMS, VOLUME_IN_ML]) {
    const a = table[f];
    const b = table[t];
    if (a != null && b != null) return a / b;
  }
  return null;
}

export interface LotCostCheck {
  /** True when the lot unit and the item's costing unit disagree. */
  mismatch: boolean;
  /** Present only when the two units are convertible. */
  factor?: number;
  /** What the value works out to as stored. */
  storedValue: number;
  /** What it would be if `cost` is actually priced in the item's unit. */
  correctedValue?: number;
  reason?: string;
}

/**
 * Check a lot's quantity/unit against the unit its cost is expressed in
 * (normally the item's primary unit).
 *
 * A mismatch is only reported when the two units are genuinely convertible and
 * differ — comparing "box" to "kg" returns mismatch:false, because a box has no
 * fixed weight here and flagging it would be noise the user cannot act on.
 */
export function checkLotCostUnit(input: {
  quantity: number | string | null | undefined;
  lotUnit: string | null | undefined;
  cost: number | string | null | undefined;
  costUnit: string | null | undefined;
}): LotCostCheck {
  const qty = Number(input.quantity) || 0;
  const cost = Number(input.cost) || 0;
  const storedValue = qty * cost;

  const factor = unitScaleFactor(input.lotUnit, input.costUnit);
  if (factor == null || factor === 1) {
    return { mismatch: false, storedValue };
  }

  return {
    mismatch: true,
    factor,
    storedValue,
    // cost is per costUnit, so the quantity must be expressed in costUnit too.
    correctedValue: qty * factor * cost,
    reason:
      `lot is in "${input.lotUnit}" but cost is priced per "${input.costUnit}" ` +
      `(1 ${input.lotUnit} = ${factor} ${input.costUnit})`,
  };
}
