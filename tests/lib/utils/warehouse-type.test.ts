/**
 * Item type → destination warehouse routing used by the PO receive dialog.
 *
 * Regression cover for the bug where the dialog always defaulted to
 * warehouses[0] (WH-RM), so a finished-goods receipt was quarantined into the
 * raw-material warehouse.
 */
import { describe, it, expect } from 'vitest';
import {
  warehouseTypeForItemType,
  checklistCategoryForItemType,
  pickWarehouseForItemType,
} from '@/lib/utils/warehouse-type';

const WAREHOUSES = [
  { id: 1, code: 'WH-RM', type: 'raw_material' },
  { id: 2, code: 'WH-FG', type: 'finished_goods' },
  { id: 3, code: 'WH-QC', type: 'qc' },
];

describe('warehouseTypeForItemType', () => {
  it('routes finished goods and WIP to the finished-goods warehouse', () => {
    expect(warehouseTypeForItemType('finished_goods')).toBe('finished_goods');
    expect(warehouseTypeForItemType('wip')).toBe('finished_goods');
  });

  it('routes raw material, packaging and consumables to raw material', () => {
    expect(warehouseTypeForItemType('raw_material')).toBe('raw_material');
    expect(warehouseTypeForItemType('packaging')).toBe('raw_material');
    expect(warehouseTypeForItemType('consumable')).toBe('raw_material');
  });

  it('falls back to raw material for unknown / missing types', () => {
    expect(warehouseTypeForItemType(null)).toBe('raw_material');
    expect(warehouseTypeForItemType(undefined)).toBe('raw_material');
    expect(warehouseTypeForItemType('something_else')).toBe('raw_material');
  });
});

describe('checklistCategoryForItemType', () => {
  it('gives a finished-goods line the finished-goods checklist', () => {
    expect(checklistCategoryForItemType('finished_goods')).toBe('finished_goods');
    expect(checklistCategoryForItemType('wip')).toBe('finished_goods');
  });

  it('gives everything else the raw-material checklist', () => {
    expect(checklistCategoryForItemType('raw_material')).toBe('raw_material');
    expect(checklistCategoryForItemType(null)).toBe('raw_material');
  });
});

describe('pickWarehouseForItemType', () => {
  it('picks the FG warehouse for an FG item even when RM is first in the list', () => {
    expect(pickWarehouseForItemType(WAREHOUSES, 'finished_goods')?.code).toBe('WH-FG');
  });

  it('picks the RM warehouse for a raw-material item', () => {
    expect(pickWarehouseForItemType(WAREHOUSES, 'raw_material')?.code).toBe('WH-RM');
  });

  it('falls back to the first warehouse when no matching type is seeded', () => {
    const noFg = [{ id: 9, code: 'WH-ONLY', type: 'raw_material' }];
    expect(pickWarehouseForItemType(noFg, 'finished_goods')?.code).toBe('WH-ONLY');
  });

  it('returns undefined when there are no warehouses at all', () => {
    expect(pickWarehouseForItemType([], 'finished_goods')).toBeUndefined();
  });
});
