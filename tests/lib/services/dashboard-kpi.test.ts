/**
 * Dashboard KPI helpers.
 *
 * These decide whether a number on the dashboard reads as "on target" or as a
 * problem, so the direction of the comparison and the month-window maths are
 * pinned here rather than trusted.
 */
import { describe, it, expect } from 'vitest';
import { kpiStatus, KPI_TARGETS, KPI_DEFINITIONS } from '@/lib/constants/kpi-targets';
import { recentMonths } from '@/lib/services/production-dashboard.service';
import { topNWithOther } from '@/lib/services/purchasing-dashboard.service';

describe('kpiStatus', () => {
  it('treats hitting the target exactly as on target', () => {
    expect(kpiStatus(95, 95)).toBe('on_target');
  });

  it('flags a value under a higher-is-better target', () => {
    expect(kpiStatus(94.9, 95)).toBe('below_target');
  });

  it('inverts the comparison when lower is better', () => {
    // reject rate: 1.5% against a 2% ceiling is good
    expect(kpiStatus(1.5, 2, true)).toBe('on_target');
    expect(kpiStatus(2.1, 2, true)).toBe('below_target');
    expect(kpiStatus(2, 2, true)).toBe('on_target');
  });

  it('returns unknown rather than guessing when there is no value', () => {
    expect(kpiStatus(null, 95)).toBe('unknown');
    expect(kpiStatus(undefined, 95)).toBe('unknown');
    expect(kpiStatus(Number.NaN, 95)).toBe('unknown');
  });

  it('handles zero as a real value, not as missing', () => {
    expect(kpiStatus(0, 95)).toBe('below_target');
    expect(kpiStatus(0, 2, true)).toBe('on_target');
  });
});

describe('recentMonths', () => {
  it('returns the requested count, oldest first, ending on the given month', () => {
    const m = recentMonths('2026-08-04', 12);
    expect(m).toHaveLength(12);
    expect(m[11]).toBe('2026-08');
    expect(m[0]).toBe('2025-09');
  });

  it('crosses the year boundary correctly', () => {
    expect(recentMonths('2026-02-15', 4)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });

  it('zero-pads single-digit months', () => {
    expect(recentMonths('2026-03-01', 1)).toEqual(['2026-03']);
  });
});

describe('topNWithOther', () => {
  const rows = [
    { name: 'a', value: 10 },
    { name: 'b', value: 50 },
    { name: 'c', value: 30 },
    { name: 'd', value: 5 },
    { name: 'e', value: 1 },
  ];

  it('keeps the largest N, sorted descending', () => {
    const { top } = topNWithOther(rows, 3);
    expect(top.map((r) => r.name)).toEqual(['b', 'c', 'a']);
  });

  it('folds the tail into one other bucket rather than adding colours', () => {
    const { otherValue, otherCount } = topNWithOther(rows, 3);
    expect(otherCount).toBe(2);
    expect(otherValue).toBe(6);
  });

  it('produces no other bucket when everything fits', () => {
    const { top, otherValue, otherCount } = topNWithOther(rows, 10);
    expect(top).toHaveLength(5);
    expect(otherCount).toBe(0);
    expect(otherValue).toBe(0);
  });

  it('does not mutate the input order', () => {
    const copy = [...rows];
    topNWithOther(rows, 2);
    expect(rows).toEqual(copy);
  });
});

describe('KPI definitions are explicit, not implied', () => {
  it('excludes minor deviations from Right First Time', () => {
    // Counting every paperwork note would drive RFT toward zero and make the
    // number meaningless — the exclusion is deliberate and must stay visible.
    expect(KPI_DEFINITIONS.rftDeviationSeverities).toEqual(['major', 'critical']);
    expect(KPI_DEFINITIONS.rftDeviationSeverities).not.toContain('minor');
  });

  it('treats an early delivery as on time', () => {
    expect(KPI_DEFINITIONS.otdGraceDays).toBe(0);
    expect(KPI_DEFINITIONS.otifEarlyToleranceDays).toBeNull();
  });

  it('ties PPV to standard cost so finance and procurement share one baseline', () => {
    expect(KPI_DEFINITIONS.ppvBaseline).toBe('standard_cost');
  });

  it('keeps every target inside a sane percentage range', () => {
    const all = [
      ...Object.values(KPI_TARGETS.production),
      ...Object.values(KPI_TARGETS.purchasing),
      ...Object.values(KPI_TARGETS.sales),
    ];
    for (const v of all) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });
});
