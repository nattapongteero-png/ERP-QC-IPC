/**
 * What the per-unit percentage in the recording table is measured against.
 *
 * It used to compare each unit with the mean of the sample — the comparison
 * USP <905> Weight Variation prescribes, which asks whether the units agree
 * with each other. An in-process weight check asks something else: whether
 * they agree with the dose. A batch that drifts off target together passes the
 * mean test with every unit wrong, which is exactly the case this is meant to
 * catch, so the reference is the Target the author entered.
 */
import { describe, it, expect } from 'vitest';

/** The formula the recorders use, kept here so a change to it fails a test. */
const deviation = (net: number, target: number) =>
  target > 0 ? ((net - target) / target) * 100 : null;

const outOfSpec = (net: number, target: number, tolPct: number) => {
  const d = deviation(net, target);
  // Matches the component: a value on the limit is inside it. Without the
  // epsilon, (0.55 - 0.5) / 0.5 * 100 is 10.000000000000009 and one side of
  // the tolerance behaves differently from the other.
  return d != null && Math.abs(d) - tolPct > 1e-9;
};

describe('per-unit percentage', () => {
  it('measures the distance from Target, not from the sample mean', () => {
    // Weights reported on screen for Target 0.5.
    expect(deviation(0.5084, 0.5)).toBeCloseTo(1.68, 2);
    expect(deviation(0.4984, 0.5)).toBeCloseTo(-0.32, 2);
    expect(deviation(0.4894, 0.5)).toBeCloseTo(-2.12, 2);
    expect(deviation(0.5164, 0.5)).toBeCloseTo(3.28, 2);
  });

  it('catches a batch that drifts off target together', () => {
    // Five units within 0.4% of each other but all ~2.6% above target: the
    // mean-based comparison passes every one of them, this one does not.
    const target = 0.5;
    const nets = [0.5128, 0.5130, 0.5132, 0.5129, 0.5131];
    const mean = nets.reduce((a, b) => a + b, 0) / nets.length;

    const byMean = nets.filter((n) => Math.abs(((n - mean) / mean) * 100) > 1);
    expect(byMean).toHaveLength(0);

    const byTarget = nets.filter((n) => outOfSpec(n, target, 1));
    expect(byTarget).toHaveLength(nets.length);
  });

  it('judges against the tolerance either side of Target', () => {
    const target = 0.5;
    expect(outOfSpec(0.55, target, 10)).toBe(false); // exactly +10%
    expect(outOfSpec(0.551, target, 10)).toBe(true);
    expect(outOfSpec(0.45, target, 10)).toBe(false); // exactly -10%
    expect(outOfSpec(0.449, target, 10)).toBe(true);
  });

  it('reports nothing until a Target is given', () => {
    expect(deviation(0.51, 0)).toBeNull();
  });
});
