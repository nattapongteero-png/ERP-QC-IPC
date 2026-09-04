/**
 * √n + 1 takes its n from the work order, not from the criterion.
 *
 * The criterion is written once and reused across every batch; the lot size
 * changes every time. So a criterion using this method cannot carry a sample
 * size at all — it has to be worked out against the yield in front of it.
 */
import { describe, it, expect } from 'vitest';
import { sqrtPlusOneSampleSize, usesSqrtSampling } from '@/lib/master-data/ipc-sqrt-sampling';

describe('√n + 1 sample size', () => {
  it('follows the rule on the sizes a plant actually runs', () => {
    // ⌈√n⌉ + 1 — the textbook values.
    expect(sqrtPlusOneSampleSize(100, null)?.sampleSize).toBe(11);
    expect(sqrtPlusOneSampleSize(5000, null)?.sampleSize).toBe(72);
    expect(sqrtPlusOneSampleSize(10000, null)?.sampleSize).toBe(101);
  });

  it('rounds the root up, never down', () => {
    // √50 = 7.07: rounding down would draw 8 where the rule asks for 9.
    expect(sqrtPlusOneSampleSize(50, null)?.sampleSize).toBe(9);
    // A perfect square gains nothing from rounding.
    expect(sqrtPlusOneSampleSize(144, null)?.sampleSize).toBe(13);
  });

  it('prefers what the batch really yielded over what was planned', () => {
    const r = sqrtPlusOneSampleSize(5000, 4200);
    expect(r?.lotSize).toBe(4200);
    expect(r?.source).toBe('actual');
    expect(r?.sampleSize).toBe(setSize(4200));
  });

  it('falls back to the planned quantity before the batch has yielded', () => {
    const r = sqrtPlusOneSampleSize(5000, null);
    expect(r?.source).toBe('planned');
    expect(r?.lotSize).toBe(5000);
    // Zero is not a yield — a batch that has produced nothing has not produced
    // a smaller lot, it has not produced one at all.
    expect(sqrtPlusOneSampleSize(5000, 0)?.source).toBe('planned');
  });

  it('says nothing rather than inventing a size with no yield to go on', () => {
    expect(sqrtPlusOneSampleSize(null, null)).toBeNull();
    expect(sqrtPlusOneSampleSize(0, 0)).toBeNull();
    expect(sqrtPlusOneSampleSize(-10, null)).toBeNull();
    expect(sqrtPlusOneSampleSize(undefined, undefined)).toBeNull();
  });

  it('treats a fractional yield as the whole units it contains', () => {
    expect(sqrtPlusOneSampleSize(null, 4200.9)?.lotSize).toBe(4200);
  });

  it('shows its working so the number can be checked by hand', () => {
    expect(sqrtPlusOneSampleSize(5000, null)?.workings).toBe('√5,000 = 70.71 → 71 + 1');
  });

  it('applies to this sampling method and no other', () => {
    expect(usesSqrtSampling('square_root')).toBe(true);
    for (const m of ['random', 'systematic', 'stratified', '', null, undefined]) {
      expect(usesSqrtSampling(m)).toBe(false);
    }
  });
});

/** The rule, restated in the test so it is not just the code checking itself. */
const setSize = (n: number) => Math.ceil(Math.sqrt(n)) + 1;
