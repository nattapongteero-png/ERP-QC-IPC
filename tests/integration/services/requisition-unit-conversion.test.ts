/**
 * Tests for requisition approval unit conversion logic
 * Verifies: cross-unit comparison (g ↔ kg), same-unit, no conversion rate
 */
import { describe, it, expect } from 'vitest';

/**
 * Pure logic function matching the conversion in requisition/route.ts approve action.
 * availableQty is in item's primaryUnit; requiredQty is in material's unit.
 * If material unit == secondaryUnit and conversionRate > 0, convert available to material unit.
 */
function checkStockSufficiency(
  requiredQty: number,
  availableInPrimaryUnit: number,
  materialUnit: string | null,
  secondaryUnit: string | null,
  conversionRate: number | null,
): { sufficient: boolean; availableInMaterialUnit: number } {
  let available = availableInPrimaryUnit;

  if (materialUnit && secondaryUnit && conversionRate &&
      materialUnit === secondaryUnit && conversionRate > 0) {
    available = available * conversionRate;
  }

  return {
    sufficient: available >= requiredQty,
    availableInMaterialUnit: available,
  };
}

describe('Requisition Unit Conversion', () => {
  describe('Cross-unit: material in g, inventory in kg', () => {
    it('should approve when stock is sufficient after conversion', () => {
      // RM-4812: needs 100,000 g, has 10,000 kg (= 10,000,000 g)
      const result = checkStockSufficiency(100000, 10000, 'g', 'g', 1000);
      expect(result.sufficient).toBe(true);
      expect(result.availableInMaterialUnit).toBe(10000000); // 10,000 kg × 1000 = 10,000,000 g
    });

    it('should reject when stock is truly insufficient after conversion', () => {
      // needs 200,000 g, has 100 kg (= 100,000 g)
      const result = checkStockSufficiency(200000, 100, 'g', 'g', 1000);
      expect(result.sufficient).toBe(false);
      expect(result.availableInMaterialUnit).toBe(100000);
    });

    it('should handle exact boundary (available == required)', () => {
      // needs 5,000 g, has 5 kg (= 5,000 g)
      const result = checkStockSufficiency(5000, 5, 'g', 'g', 1000);
      expect(result.sufficient).toBe(true);
      expect(result.availableInMaterialUnit).toBe(5000);
    });
  });

  describe('Same unit: material in kg, inventory in kg', () => {
    it('should compare directly when units match (no conversion needed)', () => {
      // material unit = kg, primaryUnit = kg, no secondaryUnit match
      const result = checkStockSufficiency(100, 150, 'kg', 'g', 1000);
      // materialUnit (kg) !== secondaryUnit (g) → no conversion
      expect(result.sufficient).toBe(true);
      expect(result.availableInMaterialUnit).toBe(150);
    });

    it('should compare directly when secondaryUnit is null', () => {
      const result = checkStockSufficiency(100, 150, 'kg', null, null);
      expect(result.sufficient).toBe(true);
      expect(result.availableInMaterialUnit).toBe(150);
    });
  });

  describe('No conversion rate defined', () => {
    it('should not convert when conversionRate is null', () => {
      const result = checkStockSufficiency(100, 50, 'g', 'g', null);
      // Can't convert — compare raw values
      expect(result.sufficient).toBe(false);
      expect(result.availableInMaterialUnit).toBe(50);
    });

    it('should not convert when conversionRate is 0', () => {
      const result = checkStockSufficiency(100, 50, 'g', 'g', 0);
      expect(result.sufficient).toBe(false);
      expect(result.availableInMaterialUnit).toBe(50);
    });
  });

  describe('Edge cases', () => {
    it('should handle fractional conversion rates', () => {
      // material in L, inventory in mL (rate = 0.001)
      // Actually this means: 1 primaryUnit = 0.001 secondaryUnit — unusual
      // More realistic: primaryUnit = L, secondaryUnit = mL, rate = 1000
      const result = checkStockSufficiency(5000, 10, 'mL', 'mL', 1000);
      expect(result.sufficient).toBe(true);
      expect(result.availableInMaterialUnit).toBe(10000);
    });

    it('should handle zero required quantity', () => {
      const result = checkStockSufficiency(0, 100, 'g', 'g', 1000);
      expect(result.sufficient).toBe(true);
    });

    it('should handle zero available stock', () => {
      const result = checkStockSufficiency(100, 0, 'g', 'g', 1000);
      expect(result.sufficient).toBe(false);
      expect(result.availableInMaterialUnit).toBe(0);
    });

    it('should handle material unit is null', () => {
      const result = checkStockSufficiency(100, 200, null, 'g', 1000);
      // materialUnit null → no conversion
      expect(result.sufficient).toBe(true);
      expect(result.availableInMaterialUnit).toBe(200);
    });
  });
});
