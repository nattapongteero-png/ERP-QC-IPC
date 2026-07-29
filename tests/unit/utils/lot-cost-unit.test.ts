/**
 * Guards the ฿35.6M expiry-dashboard figure found on UAT.
 *
 * Lot RM-0001-LOT-20260715 held 24,990 g with cost 1,425 — but 1,425 is
 * RM-0001's price per KILOGRAM (its primary_unit is kg, standard_cost 350, and
 * sibling lots run 55–360/kg). quantity * cost therefore reported ฿35,610,750
 * for a lot actually worth about ฿35,610.
 */
import { describe, it, expect } from 'vitest';
import { checkLotCostUnit, unitScaleFactor } from '@/lib/utils/lot-cost-unit';

describe('unitScaleFactor', () => {
  it('converts within the mass family, both directions', () => {
    expect(unitScaleFactor('g', 'kg')).toBeCloseTo(0.001);
    expect(unitScaleFactor('kg', 'g')).toBe(1000);
    expect(unitScaleFactor('mg', 'g')).toBeCloseTo(0.001);
  });

  it('accepts the Thai unit labels that appear in this database', () => {
    // GRN-2026-00039-L1-QC stores "กก." where the item says "kg".
    expect(unitScaleFactor('กก.', 'kg')).toBe(1);
    expect(unitScaleFactor('กรัม', 'kg')).toBeCloseTo(0.001);
  });

  it('returns null for units it cannot relate', () => {
    // A box has no fixed weight — guessing one would be worse than declining.
    expect(unitScaleFactor('box', 'kg')).toBeNull();
    expect(unitScaleFactor('kg', 'l')).toBeNull();
    expect(unitScaleFactor('', 'kg')).toBeNull();
  });

  it('is 1 for identical units regardless of case or padding', () => {
    expect(unitScaleFactor(' KG ', 'kg')).toBe(1);
  });
});

describe('checkLotCostUnit', () => {
  it('catches the real UAT lot and reports the corrected value', () => {
    const r = checkLotCostUnit({
      quantity: 24990,
      lotUnit: 'g',
      cost: 1425,
      costUnit: 'kg',
    });
    expect(r.mismatch).toBe(true);
    expect(r.storedValue).toBe(35_610_750);      // what the dashboard showed
    expect(r.correctedValue).toBeCloseTo(35_610.75, 2); // what it should be
    expect(r.factor).toBeCloseTo(0.001);
  });

  it('passes a lot whose unit already matches the costing unit', () => {
    // RM-0001-LOT-20260727: 100 kg @ 55/kg = 5,500 — consistent.
    const r = checkLotCostUnit({ quantity: 100, lotUnit: 'kg', cost: 55, costUnit: 'kg' });
    expect(r.mismatch).toBe(false);
    expect(r.storedValue).toBe(5500);
  });

  it('passes a gram lot that is correctly priced per gram', () => {
    // RM-0001-LOT-20260713-370: 19,998 g @ 0.17/g — the same item stored the
    // OTHER way round and was right. Both conventions exist in the data, which
    // is exactly why the check compares units rather than magnitudes.
    const r = checkLotCostUnit({ quantity: 19998, lotUnit: 'g', cost: 0.17, costUnit: 'g' });
    expect(r.mismatch).toBe(false);
  });

  it('does not flag count units it cannot verify', () => {
    const r = checkLotCostUnit({ quantity: 10000, lotUnit: 'box', cost: 100, costUnit: 'kg' });
    expect(r.mismatch).toBe(false);
  });

  it('treats missing cost as zero rather than throwing', () => {
    const r = checkLotCostUnit({ quantity: 9, lotUnit: 'kg', cost: null, costUnit: 'kg' });
    expect(r.mismatch).toBe(false);
    expect(r.storedValue).toBe(0);
  });
});
