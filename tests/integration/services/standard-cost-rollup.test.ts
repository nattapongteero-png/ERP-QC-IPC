/**
 * Standard-cost roll-up from BOM.
 *
 * This guards a bug class that no type-check or smoke test caught: the function
 * selected THREE columns that do not exist on the schema (`bom.itemId`,
 * `bom.isActive`, `bomLines.componentId`), so Drizzle threw "Cannot convert
 * undefined or null to object" and the "รวมต้นทุนจาก BOM" button failed 100% of
 * the time. Asserting a real rolled-up NUMBER — not just "it didn't throw" — is
 * what makes that regression impossible to reintroduce.
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { initializeDatabase, getDb } from '@/lib/db';
import { getTableRef } from '@/lib/db/db-helper';
import {
  rollupStandardCosts,
  createStandardCost,
  getCurrentStandardCost,
} from '@/lib/services/variance-analysis.service';
import { getNow } from '@/lib/db/date-utils';

const PRODUCT = 9701; // finished good with a BOM
const COMP_A = 9702;  // raw material, standard cost 10/unit
const COMP_B = 9703;  // raw material, standard cost 4/unit
const BOM_ID = 9710;
const USER = 1;

describe('rollupStandardCosts', () => {
  beforeAll(async () => {
    await initializeDatabase();
  });

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- getDb()
    // returns a SQLite|MySQL union whose .delete() signatures don't unify.
    const db = (await getDb()) as any;
    const { inArray } = await import('drizzle-orm');
    const items = getTableRef('items');
    const bom = getTableRef('bOM');
    const bomLines = getTableRef('bOMLines');
    const sc = getTableRef('standardCosts');

    await db.delete(sc).where(inArray(sc.itemId, [PRODUCT, COMP_A, COMP_B]));
    await db.delete(bomLines).where(inArray(bomLines.bomId, [BOM_ID]));
    await db.delete(bom).where(inArray(bom.id, [BOM_ID]));
    await db.delete(items).where(inArray(items.id, [PRODUCT, COMP_A, COMP_B]));

    const base = { primaryUnit: 'kg', isActive: true, createdAt: getNow(), updatedAt: getNow() };
    await db.insert(items).values([
      { id: PRODUCT, code: 'FG-RU-1', name: 'Rollup Product', nameTh: 'สินค้าทดสอบ', type: 'finished_goods', ...base },
      { id: COMP_A, code: 'RM-RU-1', name: 'Component A', nameTh: 'วัตถุดิบ A', type: 'raw_material', ...base },
      { id: COMP_B, code: 'RM-RU-2', name: 'Component B', nameTh: 'วัตถุดิบ B', type: 'raw_material', ...base },
    ]);

    // The BOM must be 'approved' — costing off a draft recipe would be wrong.
    await db.insert(bom).values({
      id: BOM_ID,
      code: 'BOM-RU-1',
      name: 'Rollup BOM',
      productId: PRODUCT,
      version: '1',
      status: 'approved',
      batchSize: 1,
      batchUnit: 'kg',
      createdAt: getNow(),
      updatedAt: getNow(),
    });

    // 3 x A + 5 x B
    await db.insert(bomLines).values([
      { bomId: BOM_ID, itemId: COMP_A, quantity: 3, unit: 'kg', sequence: 1 },
      { bomId: BOM_ID, itemId: COMP_B, quantity: 5, unit: 'kg', sequence: 2 },
    ]);

    // Component standard costs: A = 10/unit, B = 4/unit
    await createStandardCost(
      { itemId: COMP_A, effectiveDate: '2026-01-01', materialCost: 10, laborCost: 0, overheadCost: 0 },
      USER,
    );
    await createStandardCost(
      { itemId: COMP_B, effectiveDate: '2026-01-01', materialCost: 4, laborCost: 0, overheadCost: 0 },
      USER,
    );
  });

  it('rolls material cost up from the BOM components', async () => {
    const result = await rollupStandardCosts([PRODUCT], '2026-06-01', USER);

    expect(result.errors).toEqual([]);
    expect(result.itemsProcessed).toBe(1);
    expect(result.itemsUpdated).toBe(1);

    // 3 x 10 + 5 x 4 = 50 — a real computed number, not "it didn't throw".
    const cost = await getCurrentStandardCost(PRODUCT);
    expect(cost?.materialCost).toBe(50);
  });

  it('does not throw on a full roll-up with no item filter', async () => {
    // The reported failure: the button posts no itemIds and every roll-up died
    // on an undefined column before touching a single row.
    const result = await rollupStandardCosts(undefined, undefined, USER);
    expect(result).toHaveProperty('itemsProcessed');
    expect(result.errors).toEqual([]);
  });

  it('ignores BOMs that are not approved', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await getDb()) as any;
    const { eq } = await import('drizzle-orm');
    const bom = getTableRef('bOM');
    await db.update(bom).set({ status: 'draft' }).where(eq(bom.id, BOM_ID));

    const result = await rollupStandardCosts([PRODUCT], '2026-06-02', USER);
    // A draft recipe must not drive standard costs.
    expect(result.itemsProcessed).toBe(0);
    expect(result.itemsUpdated).toBe(0);
  });

  it('keeps existing labor and overhead when rolling material up', async () => {
    // Roll-up only recomputes MATERIAL; labor/overhead carry forward, so a
    // roll-up must never silently zero them.
    await createStandardCost(
      { itemId: PRODUCT, effectiveDate: '2026-05-01', materialCost: 999, laborCost: 7, overheadCost: 3 },
      USER,
    );

    await rollupStandardCosts([PRODUCT], '2026-06-03', USER);

    const cost = await getCurrentStandardCost(PRODUCT);
    expect(cost?.materialCost).toBe(50); // recomputed from BOM
    expect(cost?.laborCost).toBe(7);     // preserved
    expect(cost?.overheadCost).toBe(3);  // preserved
  });
});
