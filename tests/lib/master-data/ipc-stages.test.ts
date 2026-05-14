import { describe, it, expect } from 'vitest';
import {
  parseAcceptanceStages,
  serializeAcceptanceStages,
  calcStageAcceptance,
  totalStageSamples,
  emptyStage,
  USP_DISSOLUTION_PLAN,
  USP_UNIFORMITY_PLAN,
} from '@/lib/master-data/ipc-stages';

describe('parseAcceptanceStages', () => {
  it('returns empty array for null/undefined/empty string', () => {
    expect(parseAcceptanceStages(null)).toEqual([]);
    expect(parseAcceptanceStages(undefined)).toEqual([]);
    expect(parseAcceptanceStages('')).toEqual([]);
  });

  it('returns empty array for invalid JSON', () => {
    expect(parseAcceptanceStages('not-json')).toEqual([]);
    expect(parseAcceptanceStages('{}')).toEqual([]);
  });

  it('parses valid JSON array of stages', () => {
    const stages = [
      { sampleSize: 6, tolerancePercent: 0, onFail: 'next_stage' },
      { sampleSize: 12, tolerancePercent: 0, onFail: 'deviation' },
    ];
    expect(parseAcceptanceStages(JSON.stringify(stages))).toEqual(stages);
  });

  it('passes through arrays directly', () => {
    const stages = [{ sampleSize: 10, tolerancePercent: 5, onFail: 'next_stage' as const }];
    expect(parseAcceptanceStages(stages)).toEqual(stages);
  });

  it('filters out invalid stage objects', () => {
    const mixed = [
      { sampleSize: 6, tolerancePercent: 0, onFail: 'next_stage' },
      { sampleSize: 0, tolerancePercent: 0, onFail: 'next_stage' }, // invalid: 0 sample size
      { sampleSize: 12, tolerancePercent: 0, onFail: 'invalid' }, // invalid onFail
      { sampleSize: 24, tolerancePercent: -5, onFail: 'next_stage' }, // invalid: negative tolerance
      'not an object',
      null,
    ];
    const result = parseAcceptanceStages(JSON.stringify(mixed));
    expect(result).toEqual([{ sampleSize: 6, tolerancePercent: 0, onFail: 'next_stage' }]);
  });
});

describe('serializeAcceptanceStages', () => {
  it('returns null for empty array', () => {
    expect(serializeAcceptanceStages([])).toBeNull();
    expect(serializeAcceptanceStages(null)).toBeNull();
    expect(serializeAcceptanceStages(undefined)).toBeNull();
  });

  it('serializes valid stages to JSON string', () => {
    const stages = [{ sampleSize: 6, tolerancePercent: 0, onFail: 'next_stage' as const }];
    const result = serializeAcceptanceStages(stages);
    expect(result).toBe(JSON.stringify(stages));
  });

  it('strips invalid stages before serialization', () => {
    const mixed = [
      { sampleSize: 6, tolerancePercent: 0, onFail: 'next_stage' as const },
      { sampleSize: 0, tolerancePercent: 0, onFail: 'next_stage' as const }, // invalid
    ];
    const result = serializeAcceptanceStages(mixed);
    expect(result).toBe(JSON.stringify([{ sampleSize: 6, tolerancePercent: 0, onFail: 'next_stage' }]));
  });

  it('round-trips through parse', () => {
    const stages = [
      { sampleSize: 6, tolerancePercent: 5, onFail: 'next_stage' as const },
      { sampleSize: 12, tolerancePercent: 0, onFail: 'deviation' as const },
    ];
    const json = serializeAcceptanceStages(stages);
    expect(parseAcceptanceStages(json)).toEqual(stages);
  });
});

describe('calcStageAcceptance', () => {
  it('floors allowed-fail count from sample size and tolerance', () => {
    expect(calcStageAcceptance({ sampleSize: 20, tolerancePercent: 5, onFail: 'next_stage' })).toEqual({
      sampleSize: 20,
      allowedFail: 1, // floor(20 * 5 / 100) = 1
      mustPass: 19,
    });
  });

  it('zero tolerance means zero allowed fail', () => {
    expect(calcStageAcceptance({ sampleSize: 6, tolerancePercent: 0, onFail: 'next_stage' })).toEqual({
      sampleSize: 6,
      allowedFail: 0,
      mustPass: 6,
    });
  });

  it('rounds down — never up — so the criterion is not relaxed', () => {
    // 10 * 7% = 0.7 → floor = 0 (not 1)
    expect(calcStageAcceptance({ sampleSize: 10, tolerancePercent: 7, onFail: 'next_stage' })).toEqual({
      sampleSize: 10,
      allowedFail: 0,
      mustPass: 10,
    });
  });
});

describe('totalStageSamples', () => {
  it('returns 0 for empty array', () => {
    expect(totalStageSamples([])).toBe(0);
  });

  it('sums sample sizes across stages', () => {
    expect(totalStageSamples(USP_DISSOLUTION_PLAN)).toBe(24); // 6 + 6 + 12
    expect(totalStageSamples(USP_UNIFORMITY_PLAN)).toBe(30); // 10 + 20
  });
});

describe('emptyStage', () => {
  it('returns a usable default stage', () => {
    const stage = emptyStage();
    expect(stage.sampleSize).toBeGreaterThan(0);
    expect(stage.tolerancePercent).toBeGreaterThanOrEqual(0);
    expect(['next_stage', 'reject_batch', 'deviation']).toContain(stage.onFail);
  });
});

describe('USP standard plans', () => {
  it('USP <711> Dissolution: 6 → 6 → 12 stages', () => {
    expect(USP_DISSOLUTION_PLAN).toHaveLength(3);
    expect(USP_DISSOLUTION_PLAN.map((s) => s.sampleSize)).toEqual([6, 6, 12]);
    expect(USP_DISSOLUTION_PLAN[0].onFail).toBe('next_stage');
    expect(USP_DISSOLUTION_PLAN[2].onFail).toBe('deviation');
  });

  it('USP <905> Uniformity: 10 → 20 stages', () => {
    expect(USP_UNIFORMITY_PLAN).toHaveLength(2);
    expect(USP_UNIFORMITY_PLAN.map((s) => s.sampleSize)).toEqual([10, 20]);
  });
});
