/**
 * Tests for IPC Specification auto-parsing and Min/Max calculation
 */
import { describe, it, expect } from 'vitest';

function parseSpecification(spec: string): { center: number; deviation: number; isPercent: boolean } | null {
  if (!spec) return null;
  const match = spec.match(/^\s*([\d.]+)\s*(?:±|\+\/?-)\s*([\d.]+)\s*(%?)\s*/);
  if (!match) return null;
  const center = parseFloat(match[1]);
  const deviation = parseFloat(match[2]);
  const isPercent = match[3] === '%';
  if (isNaN(center) || isNaN(deviation)) return null;
  return { center, deviation, isPercent };
}

function calculateMinMax(spec: string): { min: number; max: number } | null {
  const parsed = parseSpecification(spec);
  if (!parsed) return null;
  const delta = parsed.isPercent ? (parsed.center * parsed.deviation / 100) : parsed.deviation;
  return {
    min: Math.round((parsed.center - delta) * 10000) / 10000,
    max: Math.round((parsed.center + delta) * 10000) / 10000,
  };
}

describe('parseSpecification', () => {
  it('should parse "300 ± 5%"', () => {
    const result = parseSpecification('300 ± 5%');
    expect(result).toEqual({ center: 300, deviation: 5, isPercent: true });
  });

  it('should parse "300±5%"', () => {
    const result = parseSpecification('300±5%');
    expect(result).toEqual({ center: 300, deviation: 5, isPercent: true });
  });

  it('should parse "200 +/- 10"', () => {
    const result = parseSpecification('200 +/- 10');
    expect(result).toEqual({ center: 200, deviation: 10, isPercent: false });
  });

  it('should parse "200 +- 10"', () => {
    const result = parseSpecification('200 +- 10');
    expect(result).toEqual({ center: 200, deviation: 10, isPercent: false });
  });

  it('should parse "5.5 ± 0.5%"', () => {
    const result = parseSpecification('5.5 ± 0.5%');
    expect(result).toEqual({ center: 5.5, deviation: 0.5, isPercent: true });
  });

  it('should return null for invalid format', () => {
    expect(parseSpecification('just text')).toBeNull();
    expect(parseSpecification('')).toBeNull();
    expect(parseSpecification('200 mg')).toBeNull();
  });
});

describe('calculateMinMax', () => {
  it('300 ± 5% → Min 285, Max 315', () => {
    const result = calculateMinMax('300 ± 5%');
    expect(result).toEqual({ min: 285, max: 315 });
  });

  it('200 ± 10 (absolute) → Min 190, Max 210', () => {
    const result = calculateMinMax('200 ± 10');
    expect(result).toEqual({ min: 190, max: 210 });
  });

  it('500 ± 7.5% → Min 462.5, Max 537.5', () => {
    const result = calculateMinMax('500 ± 7.5%');
    expect(result).toEqual({ min: 462.5, max: 537.5 });
  });

  it('5.5 ± 0.5% → correct decimals', () => {
    const result = calculateMinMax('5.5 ± 0.5%');
    expect(result).not.toBeNull();
    expect(result!.min).toBeCloseTo(5.4725, 4);
    expect(result!.max).toBeCloseTo(5.5275, 4);
  });

  it('should return null for unparseable spec', () => {
    expect(calculateMinMax('some text')).toBeNull();
  });

  it('re-calculation on spec update: 300±5% then 300±10%', () => {
    expect(calculateMinMax('300 ± 5%')).toEqual({ min: 285, max: 315 });
    expect(calculateMinMax('300 ± 10%')).toEqual({ min: 270, max: 330 });
  });
});
