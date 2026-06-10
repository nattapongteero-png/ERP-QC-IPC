/**
 * Item strength (value + unit) — form helpers.
 *
 * Covers the structured-strength feature: items now store strengthValue
 * (number) + strengthUnit (selectable) so BOM/WO can compute powder weight.
 * Tests the form-data round-trip and the unit options.
 */

import { describe, it, expect } from 'vitest';
import {
  strengthUnitOptions,
  getDefaultFormData,
  itemToFormData,
  type Item,
} from '@/components/ui/item-edit-form';

const baseItem = (over: Partial<Item>): Item =>
  ({
    id: 1,
    code: 'FG-001',
    nameTh: 'แคปซูลขมิ้นชัน 500mg',
    nameEn: 'Turmeric Capsule 500mg',
    type: 'finished_goods',
    category: 'finished',
    primaryUnit: 'bottle',
    secondaryUnit: 'cap',
    conversionRate: 1000,
    weightUnit: null,
    secondaryToWeightRate: null,
    weightTrackingEnabled: false,
    shelfLifeDays: 365,
    storageCondition: null,
    minStock: 100,
    maxStock: 10000,
    reorderPoint: 500,
    isLotControlled: true,
    isFEFO: true,
    tppCode: null,
    tppName: null,
    ttmtCode: null,
    ttmtName: null,
    drugCode24: null,
    vmiSyncEnabled: false,
    strength: null,
    strengthValue: null,
    strengthUnit: null,
    gRegNumber: null,
    confidentialityLevel: 'public',
    defaultConfidential: false,
    ...over,
  }) as Item;

describe('strengthUnitOptions', () => {
  it('offers the herbal-medicine dosage + potency units', () => {
    const values = strengthUnitOptions.map((o) => o.value);
    expect(values).toContain('mg');
    expect(values).toContain('mg/แคปซูล');
    expect(values).toContain('IU');
    expect(values).toContain('%');
    // value === label so the stored unit is human-readable
    for (const o of strengthUnitOptions) expect(o.value).toBe(o.label);
  });
});

describe('getDefaultFormData', () => {
  it('starts strength value + unit empty', () => {
    const d = getDefaultFormData();
    expect(d.strengthValue).toBe('');
    expect(d.strengthUnit).toBe('');
  });
});

describe('itemToFormData', () => {
  it('maps numeric strengthValue to a string for the input + carries the unit', () => {
    const form = itemToFormData(baseItem({ strengthValue: 500, strengthUnit: 'mg/แคปซูล' }));
    expect(form.strengthValue).toBe('500');
    expect(form.strengthUnit).toBe('mg/แคปซูล');
  });

  it('leaves strength fields empty when the item has none', () => {
    const form = itemToFormData(baseItem({ strengthValue: null, strengthUnit: null }));
    expect(form.strengthValue).toBe('');
    expect(form.strengthUnit).toBe('');
  });
});
