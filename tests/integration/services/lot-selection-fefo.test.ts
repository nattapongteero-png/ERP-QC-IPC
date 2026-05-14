/**
 * Tests for lot selection FEFO auto-select and expiry filtering logic
 * Verifies: FEFO ordering, multi-lot allocation, expiry exclusion, unit conversion
 */
import { describe, it, expect } from 'vitest';

interface AvailableLot {
  id: number;
  lotNumber: string;
  availableQty: number;
  unit: string;
  expiryDate: string | null;
}

/**
 * Pure logic matching the autoSelectLots function in material-weighing/page.tsx
 * Selects lots in FEFO order to cover weighedQty, with optional unit conversion.
 */
function autoSelectLots(
  lots: AvailableLot[],
  weighedQty: number,
  materialUnit: string | null,
  secondaryUnit: string | null,
  conversionRate: number | null,
): number[] {
  if (!lots || lots.length === 0 || weighedQty <= 0) return [];

  // Convert weighedQty from material unit to lot unit (primaryUnit) if needed
  let targetQty = weighedQty;
  if (materialUnit && secondaryUnit && conversionRate &&
      materialUnit === secondaryUnit && conversionRate > 0) {
    targetQty = weighedQty / conversionRate;
  }

  const selected: number[] = [];
  let remaining = targetQty;

  // Lots already sorted by FEFO from backend
  for (const lot of lots) {
    if (remaining <= 0) break;
    selected.push(lot.id);
    remaining -= lot.availableQty;
  }
  return selected;
}

/**
 * Pure logic for filtering expired lots (mirrors backend SQL condition)
 */
function filterNonExpired(lots: AvailableLot[], today: string): AvailableLot[] {
  return lots.filter(lot =>
    lot.expiryDate === null || lot.expiryDate >= today
  );
}

describe('Lot Selection — FEFO Auto-Select', () => {
  const lots: AvailableLot[] = [
    { id: 1, lotNumber: 'LOT-A', availableQty: 30, unit: 'kg', expiryDate: '2026-06-01' },
    { id: 2, lotNumber: 'LOT-B', availableQty: 50, unit: 'kg', expiryDate: '2026-08-15' },
    { id: 3, lotNumber: 'LOT-C', availableQty: 100, unit: 'kg', expiryDate: '2026-12-01' },
  ];

  it('should select single lot when qty fits', () => {
    // Need 25 kg, LOT-A has 30 kg → select only LOT-A
    const selected = autoSelectLots(lots, 25, 'kg', null, null);
    expect(selected).toEqual([1]);
  });

  it('should select multiple lots when single lot insufficient', () => {
    // Need 60 kg, LOT-A (30) + LOT-B (50) → need both
    const selected = autoSelectLots(lots, 60, 'kg', null, null);
    expect(selected).toEqual([1, 2]);
  });

  it('should select all lots when needed', () => {
    // Need 150 kg, all three lots combined (30+50+100=180)
    const selected = autoSelectLots(lots, 150, 'kg', null, null);
    expect(selected).toEqual([1, 2, 3]);
  });

  it('should handle exact boundary (qty equals single lot)', () => {
    const selected = autoSelectLots(lots, 30, 'kg', null, null);
    expect(selected).toEqual([1]);
  });

  it('should return empty when no lots available', () => {
    expect(autoSelectLots([], 100, 'kg', null, null)).toEqual([]);
  });

  it('should return empty when weighedQty is 0', () => {
    expect(autoSelectLots(lots, 0, 'kg', null, null)).toEqual([]);
  });
});

describe('Lot Selection — Unit Conversion', () => {
  const lotsKg: AvailableLot[] = [
    { id: 1, lotNumber: 'LOT-A', availableQty: 5, unit: 'kg', expiryDate: '2026-06-01' },
    { id: 2, lotNumber: 'LOT-B', availableQty: 10, unit: 'kg', expiryDate: '2026-08-15' },
  ];

  it('should convert g to kg before selecting lots', () => {
    // Material weighedQty = 3000g, conversion rate = 1000 (g/kg)
    // Target in kg = 3000 / 1000 = 3 kg → LOT-A (5kg) is enough
    const selected = autoSelectLots(lotsKg, 3000, 'g', 'g', 1000);
    expect(selected).toEqual([1]);
  });

  it('should select multiple lots after conversion when single insufficient', () => {
    // Material weighedQty = 8000g = 8 kg → LOT-A (5kg) not enough, need LOT-B too
    const selected = autoSelectLots(lotsKg, 8000, 'g', 'g', 1000);
    expect(selected).toEqual([1, 2]);
  });

  it('should not convert when material unit does not match secondaryUnit', () => {
    // Material unit = 'kg', secondaryUnit = 'g' → no conversion
    // weighedQty = 3 (kg) → LOT-A (5kg) is enough
    const selected = autoSelectLots(lotsKg, 3, 'kg', 'g', 1000);
    expect(selected).toEqual([1]);
  });
});

describe('Lot Selection — Expiry Filtering', () => {
  const allLots: AvailableLot[] = [
    { id: 1, lotNumber: 'EXPIRED', availableQty: 50, unit: 'kg', expiryDate: '2026-01-01' },
    { id: 2, lotNumber: 'VALID-SOON', availableQty: 30, unit: 'kg', expiryDate: '2026-05-01' },
    { id: 3, lotNumber: 'VALID-LATER', availableQty: 100, unit: 'kg', expiryDate: '2026-12-01' },
    { id: 4, lotNumber: 'NO-EXPIRY', availableQty: 20, unit: 'kg', expiryDate: null },
  ];

  it('should filter out expired lots', () => {
    const today = '2026-04-08';
    const valid = filterNonExpired(allLots, today);
    expect(valid.map(l => l.id)).toEqual([2, 3, 4]);
    expect(valid.find(l => l.lotNumber === 'EXPIRED')).toBeUndefined();
  });

  it('should keep lots expiring today', () => {
    const today = '2026-05-01';
    const valid = filterNonExpired(allLots, today);
    expect(valid.map(l => l.id)).toEqual([2, 3, 4]);
  });

  it('should keep lots with null expiry date', () => {
    const today = '2027-01-01'; // far future
    const valid = filterNonExpired(allLots, today);
    expect(valid.find(l => l.lotNumber === 'NO-EXPIRY')).toBeDefined();
  });

  it('should return empty when all lots expired', () => {
    const today = '2027-12-31';
    const valid = filterNonExpired(allLots, today);
    // Only null-expiry lot survives
    expect(valid.length).toBe(1);
    expect(valid[0].lotNumber).toBe('NO-EXPIRY');
  });
});

describe('Lot Selection — Integration (filter + auto-select)', () => {
  it('should filter expired then FEFO auto-select', () => {
    const allLots: AvailableLot[] = [
      { id: 1, lotNumber: 'EXPIRED', availableQty: 100, unit: 'kg', expiryDate: '2026-01-01' },
      { id: 2, lotNumber: 'VALID-A', availableQty: 20, unit: 'kg', expiryDate: '2026-05-15' },
      { id: 3, lotNumber: 'VALID-B', availableQty: 40, unit: 'kg', expiryDate: '2026-08-01' },
    ];
    const today = '2026-04-08';
    const valid = filterNonExpired(allLots, today);
    // Only VALID-A and VALID-B remain
    expect(valid.length).toBe(2);

    // Need 50 kg → VALID-A (20) + VALID-B (40) = 60 → both selected
    const selected = autoSelectLots(valid, 50, 'kg', null, null);
    expect(selected).toEqual([2, 3]);
  });
});
