import { describe, it, expect } from 'vitest';
import { calculateMinMax, validateSpecInputs } from '@/lib/utils/ipc-criteria-calc';

describe('calculateMinMax', () => {
  it('returns {min: target, max: target} when tolerance is 0', () => {
    expect(calculateMinMax(300, 0)).toEqual({ min: 300, max: 300 });
    expect(calculateMinMax(100.5, 0)).toEqual({ min: 100.5, max: 100.5 });
  });

  it('calculates Min/Max from target and tolerance percent', () => {
    // 300 ± 5% → 285 to 315
    expect(calculateMinMax(300, 5)).toEqual({ min: 285, max: 315 });
    // 200 ± 10% → 180 to 220
    expect(calculateMinMax(200, 10)).toEqual({ min: 180, max: 220 });
    // 1000 ± 2% → 980 to 1020
    expect(calculateMinMax(1000, 2)).toEqual({ min: 980, max: 1020 });
  });

  it('rounds to 4 decimal places to avoid floating point artifacts', () => {
    // 7.2 * 0.15 = 1.0799999... → 1.08
    const result = calculateMinMax(7.2, 15);
    expect(result).not.toBeNull();
    expect(result!.min).toBe(6.12);
    expect(result!.max).toBe(8.28);
  });

  it('handles decimal targets and tolerance', () => {
    // 1.5 ± 2.5% → 1.4625 to 1.5375
    expect(calculateMinMax(1.5, 2.5)).toEqual({ min: 1.4625, max: 1.5375 });
  });

  it('handles tolerance = 100 (Min = 0, Max = 2×target)', () => {
    expect(calculateMinMax(50, 100)).toEqual({ min: 0, max: 100 });
  });

  it('returns null for invalid target (<= 0)', () => {
    expect(calculateMinMax(0, 5)).toBeNull();
    expect(calculateMinMax(-10, 5)).toBeNull();
  });

  it('returns null for invalid tolerance (< 0)', () => {
    expect(calculateMinMax(100, -1)).toBeNull();
  });

  it('returns null when target is not a finite number', () => {
    expect(calculateMinMax(NaN, 5)).toBeNull();
    expect(calculateMinMax(Infinity, 5)).toBeNull();
  });

  it('returns null when tolerance is not a finite number', () => {
    expect(calculateMinMax(100, NaN)).toBeNull();
  });
});

describe('validateSpecInputs', () => {
  it('returns null (no error) for valid inputs', () => {
    expect(validateSpecInputs(300, 5)).toBeNull();
    expect(validateSpecInputs(100, 0)).toBeNull();
    expect(validateSpecInputs(1, 100)).toBeNull();
  });

  it('returns error when target is missing', () => {
    expect(validateSpecInputs(null, 5)).toMatch(/target/i);
    expect(validateSpecInputs(undefined, 5)).toMatch(/target/i);
  });

  it('returns error when target <= 0', () => {
    expect(validateSpecInputs(0, 5)).toMatch(/greater than 0|> 0/i);
    expect(validateSpecInputs(-5, 5)).toMatch(/greater than 0|> 0/i);
  });

  it('returns error when tolerance < 0', () => {
    expect(validateSpecInputs(100, -1)).toMatch(/tolerance/i);
  });

  it('returns error when tolerance > 100', () => {
    expect(validateSpecInputs(100, 150)).toMatch(/tolerance/i);
  });

  it('allows tolerance of exactly 0 and exactly 100', () => {
    expect(validateSpecInputs(100, 0)).toBeNull();
    expect(validateSpecInputs(100, 100)).toBeNull();
  });
});
