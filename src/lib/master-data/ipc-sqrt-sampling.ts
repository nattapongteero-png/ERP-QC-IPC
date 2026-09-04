/**
 * The √n + 1 sampling rule.
 *
 * A pharmacopoeial rule of thumb for how many units of a lot to draw: take the
 * square root of the lot size, round up, add one. A 100-unit lot gives 11, a
 * 5,000-unit lot gives 72 — the sample grows with the lot but nothing like as
 * fast, which is the whole point of the rule.
 *
 * n is the lot itself, so it cannot be written into a criterion: the criterion
 * is reused across every batch, and every batch has a different yield. It has
 * to be read from the work order at the moment of recording.
 *
 * This is arithmetic only — nothing here reads or writes anything.
 */

/** How the lot size for a work order is arrived at. */
export type LotSizeSource = 'actual' | 'planned';

export interface SqrtSampleSize {
  /** The n the formula was given. */
  lotSize: number;
  /** Where n came from — what the batch actually yielded, or what was planned. */
  source: LotSizeSource;
  /** ⌈√n⌉ + 1. */
  sampleSize: number;
  /** The working, for the screen: "√5000 = 70.71 → 71 + 1". */
  workings: string;
}

/**
 * Apply √n + 1 to a work order's yield.
 *
 * The actual quantity wins over the planned one once it exists: the sample has
 * to be drawn from the units that are really there, and a batch that yielded
 * 4,200 of a planned 5,000 is a 4,200-unit lot.
 *
 * Returns null when there is no usable yield yet — a work order that has not
 * declared a quantity gives the formula nothing to work with, and inventing a
 * sample size for it would be worse than saying so.
 */
export function sqrtPlusOneSampleSize(
  plannedQuantity: number | null | undefined,
  actualQuantity: number | null | undefined,
): SqrtSampleSize | null {
  const actual = toLotSize(actualQuantity);
  const planned = toLotSize(plannedQuantity);
  const lotSize = actual ?? planned;
  if (lotSize == null) return null;

  const root = Math.sqrt(lotSize);
  // Rounded up before the +1: half a unit cannot be sampled, and rounding down
  // would take fewer units than the rule asks for.
  const rounded = Math.ceil(root);
  return {
    lotSize,
    source: actual != null ? 'actual' : 'planned',
    sampleSize: rounded + 1,
    workings: `√${formatNumber(lotSize)} = ${root.toFixed(2)} → ${formatNumber(rounded)} + 1`,
  };
}

/** A lot size has to be a positive whole count of units to be sampled. */
function toLotSize(value: number | null | undefined): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  // A yield recorded as 4200.5 kg is still one lot of 4,200 whole units to
  // draw from; the fraction is not a unit anybody can pick up.
  return Math.floor(n);
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

/** Whether a criterion's sampling method is the one this rule applies to. */
export function usesSqrtSampling(testMethod: string | null | undefined): boolean {
  return testMethod === 'square_root';
}
