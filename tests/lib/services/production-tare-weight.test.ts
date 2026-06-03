/**
 * Production Audit fixes — Net fill weight = Gross - Tare
 * Audit issues: #3, #19
 *
 * Pure-math validation of the tare subtraction rule used inside
 * createWOPackagingWeightLog / updateWOPackagingWeightLog.
 */
import { describe, it, expect } from 'vitest';

function evaluateNet(
  grossWeights: number[],
  tare: number,
  weightMin: number,
  weightMax: number,
  maxFailures: number,
) {
  const t = Number(tare) > 0 ? Number(tare) : 0;
  const net = grossWeights.map((w) => Math.max(0, w - t));
  const failedCount = net.filter((w) => w < weightMin || w > weightMax).length;
  return { net, failedCount, isPass: failedCount <= maxFailures };
}

describe('Audit #3/#19 — pass/fail evaluated against NET fill weight', () => {
  // Real case: tube weighs 4g tare, target fill = 10g (8.5..11.5), max 2 failures
  const spec = { min: 8.5, max: 11.5, maxFail: 2 };

  it('all 5 samples pass when net is inside [8.5, 11.5]', () => {
    const gross = [14.2, 14.0, 14.5, 13.9, 14.3];
    const r = evaluateNet(gross, 4, spec.min, spec.max, spec.maxFail);
    expect(r.net).toEqual([10.2, 10, 10.5, 9.9, 10.3]);
    expect(r.failedCount).toBe(0);
    expect(r.isPass).toBe(true);
  });

  it('CRITICAL: WITHOUT tare a sample that is actually correct fails (regression)', () => {
    const gross = [14.2, 14.0, 14.5, 13.9, 14.3];
    const withoutTare = evaluateNet(gross, 0, spec.min, spec.max, spec.maxFail);
    expect(withoutTare.failedCount).toBe(5);
    expect(withoutTare.isPass).toBe(false);
  });

  it('detects under-fill when net < min', () => {
    // Net would be 7.5,8.0,7.8 (under 8.5)
    const gross = [11.5, 12.0, 11.8, 14.0, 14.0];
    const r = evaluateNet(gross, 4, spec.min, spec.max, spec.maxFail);
    expect(r.failedCount).toBe(3);
    expect(r.isPass).toBe(false);
  });

  it('detects over-fill when net > max', () => {
    // Net would be 12.0 (over 11.5) for 3 samples
    const gross = [16.0, 16.0, 16.0, 14.0, 14.0];
    const r = evaluateNet(gross, 4, spec.min, spec.max, spec.maxFail);
    expect(r.failedCount).toBe(3);
    expect(r.isPass).toBe(false);
  });

  it('tareWeight=0 (legacy) keeps samples as net (backwards compatible)', () => {
    const r = evaluateNet([10, 10.2, 9.8, 10.1, 9.9], 0, spec.min, spec.max, spec.maxFail);
    expect(r.net).toEqual([10, 10.2, 9.8, 10.1, 9.9]);
    expect(r.failedCount).toBe(0);
    expect(r.isPass).toBe(true);
  });

  it('negative net is clamped to 0 (cannot go below empty container)', () => {
    const r = evaluateNet([3, 14.0], 4, spec.min, spec.max, spec.maxFail);
    expect(r.net[0]).toBe(0);
    expect(r.net[1]).toBe(10);
  });

  it('non-numeric tare (NaN, undefined) treated as 0', () => {
    const r = evaluateNet([10], Number.NaN, spec.min, spec.max, spec.maxFail);
    expect(r.net).toEqual([10]);
  });
});
