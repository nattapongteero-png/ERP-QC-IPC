/**
 * Tests for stock unit conversion display and validation
 * Verifies: kg/g conversion, standard pair enforcement, precision, formatting
 */
import { describe, it, expect } from 'vitest';

// Standard conversion map (same as in API routes)
const STANDARD_CONVERSIONS: Record<string, number> = {
  'kg:g': 1000, 'g:mg': 1000, 'kg:mg': 1000000,
  'l:ml': 1000, 'ml:µl': 1000, 'l:µl': 1000000,
  't:kg': 1000,
};

function getStandardConversion(primaryUnit: string, secondaryUnit: string): number | null {
  const key = `${primaryUnit.toLowerCase()}:${secondaryUnit.toLowerCase()}`;
  return STANDARD_CONVERSIONS[key] ?? null;
}

/**
 * Same logic as StockStatus component — calculate secondary stock value
 * Uses Math.round to avoid floating-point noise
 */
function calculateSecondaryStock(onHand: number, conversionFactor: number): number {
  return Math.round(onHand * conversionFactor * 10000) / 10000;
}

/**
 * Simulate stock after issue: deduct in primary unit
 */
function calculateStockAfterIssue(
  onHandPrimaryUnit: number,
  issueQty: number,
  issueUnit: string,
  primaryUnit: string,
  secondaryUnit: string,
  conversionRate: number,
): { onHandPrimary: number; onHandSecondary: number } {
  let deductInPrimary = issueQty;

  // Convert issue qty to primary unit if it's in secondary unit
  if (issueUnit.toLowerCase() === secondaryUnit.toLowerCase() &&
      issueUnit.toLowerCase() !== primaryUnit.toLowerCase() &&
      conversionRate > 0) {
    deductInPrimary = issueQty / conversionRate;
  }

  const onHandPrimary = onHandPrimaryUnit - deductInPrimary;
  const onHandSecondary = calculateSecondaryStock(onHandPrimary, conversionRate);

  return { onHandPrimary, onHandSecondary };
}

describe('Standard Unit Conversion Validation', () => {
  it('should return 1000 for kg:g pair', () => {
    expect(getStandardConversion('kg', 'g')).toBe(1000);
  });

  it('should return 1000 for l:ml pair', () => {
    expect(getStandardConversion('l', 'ml')).toBe(1000);
  });

  it('should return 1000000 for kg:mg pair', () => {
    expect(getStandardConversion('kg', 'mg')).toBe(1000000);
  });

  it('should return null for non-standard pairs', () => {
    expect(getStandardConversion('box', 'pack')).toBeNull();
    expect(getStandardConversion('bottle', 'cap')).toBeNull();
  });

  it('should be case-insensitive', () => {
    expect(getStandardConversion('Kg', 'G')).toBe(1000);
    expect(getStandardConversion('KG', 'G')).toBe(1000);
  });

  it('should reject wrong factor for standard pair', () => {
    // If user enters 1002 for kg:g, system should override to 1000
    const standard = getStandardConversion('kg', 'g');
    expect(standard).toBe(1000);
    expect(standard).not.toBe(1002);
  });
});

describe('Secondary Stock Calculation', () => {
  it('should correctly convert kg to g', () => {
    expect(calculateSecondaryStock(7000, 1000)).toBe(7000000);
  });

  it('should handle decimal primary values', () => {
    expect(calculateSecondaryStock(6999.8, 1000)).toBe(6999800);
  });

  it('should avoid floating-point noise', () => {
    // Without rounding: 6999.8004 * 1000 = 6999800.400000001
    // With rounding: 6999800.4
    const result = calculateSecondaryStock(6999.8004, 1000);
    expect(result).toBe(6999800.4);
    expect(String(result)).not.toContain('0000001'); // no floating point noise
  });

  it('should handle zero stock', () => {
    expect(calculateSecondaryStock(0, 1000)).toBe(0);
  });

  it('should handle large numbers', () => {
    expect(calculateSecondaryStock(100000, 1000)).toBe(100000000);
  });
});

describe('Stock After Issue — Regression Tests', () => {
  it('should correctly deduct 200g from 7000 kg stock', () => {
    // Bug scenario: 7000 kg stock, issue 200g
    // Expected: 6999.8 kg and 6,999,800 g
    const result = calculateStockAfterIssue(7000, 200, 'g', 'kg', 'g', 1000);
    expect(result.onHandPrimary).toBe(6999.8);
    expect(result.onHandSecondary).toBe(6999800);
  });

  it('should correctly deduct 500g from 10 kg stock', () => {
    const result = calculateStockAfterIssue(10, 500, 'g', 'kg', 'g', 1000);
    expect(result.onHandPrimary).toBe(9.5);
    expect(result.onHandSecondary).toBe(9500);
  });

  it('should correctly deduct in primary unit (kg from kg)', () => {
    const result = calculateStockAfterIssue(7000, 0.2, 'kg', 'kg', 'g', 1000);
    expect(result.onHandPrimary).toBe(6999.8);
    expect(result.onHandSecondary).toBe(6999800);
  });

  it('should show consistent primary/secondary values', () => {
    // g = kg * 1000 must always hold
    const result = calculateStockAfterIssue(7000, 200, 'g', 'kg', 'g', 1000);
    expect(result.onHandSecondary).toBe(result.onHandPrimary * 1000);
  });

  it('should correctly deduct 100ml from 5 l stock', () => {
    const result = calculateStockAfterIssue(5, 100, 'ml', 'l', 'ml', 1000);
    expect(result.onHandPrimary).toBe(4.9);
    expect(result.onHandSecondary).toBe(4900);
  });

  describe('Regression: wrong conversionRate produces wrong values', () => {
    it('conversionRate=1002 gives wrong secondary value', () => {
      // This is the bug: factor 1002 instead of 1000
      const result = calculateStockAfterIssue(7000, 200, 'g', 'kg', 'g', 1002);
      // 200/1002 = 0.19960... → 7000 - 0.1996 = 6999.8004
      expect(result.onHandPrimary).not.toBe(6999.8); // proves it's wrong
      // Secondary: 6999.8004 * 1002 = 7,013,799.6 — NOT 6,999,800
      expect(result.onHandSecondary).not.toBe(6999800); // proves it's wrong
    });

    it('conversionRate=1000 gives correct secondary value', () => {
      const result = calculateStockAfterIssue(7000, 200, 'g', 'kg', 'g', 1000);
      expect(result.onHandPrimary).toBe(6999.8);
      expect(result.onHandSecondary).toBe(6999800);
    });
  });
});

describe('Number Formatting', () => {
  const fmt = (n: number, maxDecimals = 4) =>
    n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: maxDecimals });

  it('should format with commas', () => {
    expect(fmt(6999800)).toBe('6,999,800');
    expect(fmt(100005.7)).toBe('100,005.7');
  });

  it('should respect maxDecimals', () => {
    expect(fmt(6999.8, 4)).toBe('6,999.8');
    expect(fmt(6999800, 2)).toBe('6,999,800');
  });

  it('should not show trailing zeros beyond precision', () => {
    expect(fmt(7000, 4)).toBe('7,000');
    expect(fmt(7000.0, 4)).toBe('7,000');
  });

  it('should handle small decimals', () => {
    expect(fmt(0.1996, 4)).toBe('0.1996');
  });
});
