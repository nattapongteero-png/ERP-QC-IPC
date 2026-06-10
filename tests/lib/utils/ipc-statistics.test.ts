/**
 * IPC statistics — eBMR audit gap #3
 */
import { describe, it, expect } from 'vitest';
import {
  computeIPCStats,
  computePercentDeviation,
  groupIPCByPhase,
} from '@/lib/utils/ipc-statistics';

describe('computeIPCStats', () => {
  it('returns zeros for an empty set', () => {
    const r = computeIPCStats([]);
    expect(r).toEqual({ count: 0, mean: null, stdDev: null, min: null, max: null });
  });

  it('ignores non-numeric / null entries', () => {
    const r = computeIPCStats([
      { numericResult: 10 },
      { numericResult: null },
      { numericResult: 14 },
      { numericResult: undefined },
      { numericResult: 12 },
    ]);
    expect(r.count).toBe(3);
    expect(r.mean).toBe(12);
  });

  it('returns count=1, no stdDev when only one sample', () => {
    const r = computeIPCStats([{ numericResult: 7 }]);
    expect(r.count).toBe(1);
    expect(r.mean).toBe(7);
    expect(r.stdDev).toBeNull();
  });

  it('computes Bessel-corrected (sample) stdDev for n>=2', () => {
    // values: 10, 12, 14 — mean 12, sample sd = sqrt(((4+0+4)/2)) = 2
    const r = computeIPCStats([
      { numericResult: 10 },
      { numericResult: 12 },
      { numericResult: 14 },
    ]);
    expect(r.mean).toBe(12);
    expect(r.stdDev).toBeCloseTo(2);
    expect(r.min).toBe(10);
    expect(r.max).toBe(14);
  });
});

describe('computePercentDeviation', () => {
  it('returns null when value missing', () => {
    expect(computePercentDeviation(null, 10, 20)).toBeNull();
    expect(computePercentDeviation(undefined, 10, 20)).toBeNull();
  });

  it('returns null when spec bounds missing', () => {
    expect(computePercentDeviation(15, null, 20)).toBeNull();
    expect(computePercentDeviation(15, 10, undefined)).toBeNull();
  });

  it('uses spec midpoint when no target provided', () => {
    // spec [10, 20] → midpoint = 15
    // value 18 → (18-15)/15 * 100 = 20
    expect(computePercentDeviation(18, 10, 20)).toBeCloseTo(20);
  });

  it('returns 0 when value equals the midpoint', () => {
    expect(computePercentDeviation(15, 10, 20)).toBe(0);
  });

  it('prefers explicit target over midpoint', () => {
    // target = 12, value = 13 → (13-12)/12 *100 = ~8.333
    expect(computePercentDeviation(13, 10, 20, 12)).toBeCloseTo(8.3333, 3);
  });

  it('returns null when target is 0 (no divide-by-zero)', () => {
    expect(computePercentDeviation(5, -1, 1)).toBeNull();
  });

  it('negative deviation when value below midpoint', () => {
    expect(computePercentDeviation(12, 10, 20)).toBeCloseTo(-20);
  });
});

describe('groupIPCByPhase', () => {
  it('buckets tests by ipcPhase', () => {
    const tests = [
      { id: 1, ipcPhase: 'production' },
      { id: 2, ipcPhase: 'packaging' },
      { id: 3, ipcPhase: 'production' },
    ];
    const out = groupIPCByPhase(tests);
    expect(out.production?.length).toBe(2);
    expect(out.packaging?.length).toBe(1);
  });

  it('defaults missing/null phase to "production"', () => {
    const tests = [
      { id: 1, ipcPhase: null },
      { id: 2 },
      { id: 3, ipcPhase: 'production' },
    ];
    const out = groupIPCByPhase(tests);
    expect(out.production?.length).toBe(3);
  });

  // Regression: a transient non-array shape during WO-page navigation must not
  // throw "(... ).map is not a function" / "is not iterable". It crashed the
  // whole Work Order page when ebmr.ipcTests briefly arrived as an object.
  it('returns {} for a non-array input instead of throwing', () => {
    // deliberately pass wrong shapes the way a stale/partial cache might
    expect(groupIPCByPhase(undefined as never)).toEqual({});
    expect(groupIPCByPhase(null as never)).toEqual({});
    expect(groupIPCByPhase({ items: [] } as never)).toEqual({});
    expect(groupIPCByPhase({} as never)).toEqual({});
    expect(() => groupIPCByPhase('oops' as never)).not.toThrow();
  });
});
