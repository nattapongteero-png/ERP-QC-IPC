/**
 * Inventory-value dashboard KPIs — asserted against seeded data with KNOWN
 * quantities and costs, so the expected baht figures are arithmetic, not
 * whatever the code happens to return.
 *
 * The bugs this guards against all passed a `typeof x === 'number'` check:
 *  - a hardcoded value that never reflects the data
 *  - a NULL unit cost silently dropping a lot's value from the total
 *  - rejected/consumed stock inflating the inventory balance
 *  - a filter on a status string that does not exist in the enum (always zero)
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { initializeDatabase, getDb } from '@/lib/db';
import { getTableRef } from '@/lib/db/db-helper';
import { getInventoryValueKpis } from '@/lib/services/dashboard.service';
import { getNow, toDbDate, getTodayStr } from '@/lib/db/date-utils';

/** Day offset from today as a YYYY-MM-DD string. */
function dayOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const WAREHOUSE_ID = 9910;
const FG_ITEM = 9901;
const RM_ITEM_A = 9902;
const RM_ITEM_B = 9903;
const PKG_ITEM = 9904;

describe('getInventoryValueKpis', () => {
  beforeAll(async () => {
    await initializeDatabase();
  });

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- getDb()
    // returns a SQLite|MySQL union whose .delete() signatures don't unify; a
    // test run targets exactly one driver.
    const db = (await getDb()) as any;
    const items = getTableRef('items');
    const lots = getTableRef('inventoryLots');
    const warehouses = getTableRef('warehouses');

    // Clear only our fixtures so the test is independent of other seed data.
    const { inArray } = await import('drizzle-orm');
    await db.delete(lots).where(
      inArray(lots.itemId, [FG_ITEM, RM_ITEM_A, RM_ITEM_B, PKG_ITEM]),
    );
    await db.delete(items).where(
      inArray(items.id, [FG_ITEM, RM_ITEM_A, RM_ITEM_B, PKG_ITEM]),
    );
    await db.delete(warehouses).where(inArray(warehouses.id, [WAREHOUSE_ID]));

    await db.insert(warehouses).values({
      id: WAREHOUSE_ID,
      code: 'WH-TEST-VAL',
      name: 'Value Test Warehouse',
      type: 'raw_material',
      isActive: true,
      createdAt: getNow(),
      updatedAt: getNow(),
    });

    const baseItem = {
      primaryUnit: 'kg',
      isActive: true,
      createdAt: getNow(),
      updatedAt: getNow(),
    };

    await db.insert(items).values([
      { id: FG_ITEM, code: 'FG-VAL-1', name: 'Finished Good', nameTh: 'สินค้าสำเร็จรูป', type: 'finished_goods', ...baseItem },
      { id: RM_ITEM_A, code: 'RM-VAL-1', name: 'Raw Material A', nameTh: 'วัตถุดิบ A', type: 'raw_material', ...baseItem },
      { id: RM_ITEM_B, code: 'RM-VAL-2', name: 'Raw Material B', nameTh: 'วัตถุดิบ B', type: 'raw_material', ...baseItem },
      { id: PKG_ITEM, code: 'PKG-VAL-1', name: 'Packaging', nameTh: 'บรรจุภัณฑ์', type: 'packaging', ...baseItem },
    ]);

    const baseLot = {
      warehouseId: WAREHOUSE_ID,
      unit: 'kg',
      receivedDate: toDbDate(getTodayStr()),
      createdAt: getNow(),
      updatedAt: getNow(),
    };

    await db.insert(lots).values([
      // --- Raw materials: 2 items, 3 lots, all costed ---
      // 100 * 50 = 5,000
      { ...baseLot, itemId: RM_ITEM_A, lotNumber: 'RM-A-1', quantity: 100, cost: 50, status: 'released' },
      // 20 * 25 = 500  (quarantine still counts — it is stock we own)
      { ...baseLot, itemId: RM_ITEM_A, lotNumber: 'RM-A-2', quantity: 20, cost: 25, status: 'quarantine' },
      // 10 * 10 = 100  (under_test also counts)
      { ...baseLot, itemId: RM_ITEM_B, lotNumber: 'RM-B-1', quantity: 10, cost: 10, status: 'under_test' },
      // Excluded: rejected stock awaiting disposal must NOT be carried as value.
      { ...baseLot, itemId: RM_ITEM_B, lotNumber: 'RM-B-REJ', quantity: 999, cost: 999, status: 'rejected' },
      // Excluded: blocked stock.
      { ...baseLot, itemId: RM_ITEM_B, lotNumber: 'RM-B-BLK', quantity: 999, cost: 999, status: 'blocked' },
      // Excluded: fully consumed (quantity 0) — would otherwise inflate lot count.
      { ...baseLot, itemId: RM_ITEM_B, lotNumber: 'RM-B-EMPTY', quantity: 0, cost: 500, status: 'released' },

      // --- Finished goods: one costed, one NOT costed (the FG reality) ---
      // 5 * 1000 = 5,000
      { ...baseLot, itemId: FG_ITEM, lotNumber: 'FG-1', quantity: 5, cost: 1000, status: 'released' },
      // cost NULL — contributes quantity but no value, and must be reported.
      { ...baseLot, itemId: FG_ITEM, lotNumber: 'FG-2', quantity: 7, cost: null, status: 'released' },

      // --- Packaging ---
      // 200 * 2 = 400
      { ...baseLot, itemId: PKG_ITEM, lotNumber: 'PKG-1', quantity: 200, cost: 2, status: 'released' },
    ]);
  });

  it('values raw materials from real quantities and costs', async () => {
    const kpis = await getInventoryValueKpis();

    // 100*50 + 20*25 + 10*10 = 5,000 + 500 + 100
    expect(kpis.rawMaterials.value).toBe(5600);
    expect(kpis.rawMaterials.items).toBe(2); // RM_ITEM_A, RM_ITEM_B
    expect(kpis.rawMaterials.lots).toBe(3);
    expect(kpis.rawMaterials.quantity).toBe(130);
    expect(kpis.rawMaterials.uncostedLots).toBe(0);
  });

  it('excludes rejected, blocked and fully-consumed lots from stock value', async () => {
    const kpis = await getInventoryValueKpis();

    // The rejected/blocked lots are 999*999 each. If either leaked in, the
    // value would jump by ~998k and the lot count would exceed 3.
    expect(kpis.rawMaterials.value).toBeLessThan(10_000);
    expect(kpis.rawMaterials.lots).toBe(3);
  });

  it('reports uncosted finished-goods lots instead of silently undercounting', async () => {
    const kpis = await getInventoryValueKpis();

    // Only the costed lot contributes: 5 * 1000.
    expect(kpis.finishedGoods.value).toBe(5000);
    // ...but BOTH lots are stock we hold.
    expect(kpis.finishedGoods.lots).toBe(2);
    expect(kpis.finishedGoods.quantity).toBe(12); // 5 + 7
    // The gap is surfaced, not hidden — this is what stops the ฿5,000 from
    // being read as the true worth of the finished goods.
    expect(kpis.finishedGoods.uncostedLots).toBe(1);
  });

  it('keeps finished goods, raw materials and packaging separate', async () => {
    const kpis = await getInventoryValueKpis();

    expect(kpis.packaging.value).toBe(400); // 200 * 2
    expect(kpis.packaging.items).toBe(1);
    // A category must never absorb another's stock.
    expect(kpis.finishedGoods.items).toBe(1);
    expect(kpis.rawMaterials.items).toBe(2);
  });

  it('uses the canonical finished_goods item type', async () => {
    const kpis = await getInventoryValueKpis();

    // Guards the always-zero class of bug: a filter on a type string that is
    // not in the enum ('finished_good', 'product') returns 0 forever, and no
    // amount of seeding can make it non-zero.
    expect(kpis.finishedGoods.lots).toBeGreaterThan(0);
    expect(kpis.finishedGoods.value).toBeGreaterThan(0);
  });
});

describe('getInventoryValueKpis — expiry exposure', () => {
  beforeAll(async () => {
    await initializeDatabase();
  });

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see above.
    const db = (await getDb()) as any;
    const items = getTableRef('items');
    const lots = getTableRef('inventoryLots');
    const warehouses = getTableRef('warehouses');
    const { inArray } = await import('drizzle-orm');

    await db.delete(lots).where(inArray(lots.itemId, [RM_ITEM_A]));
    await db.delete(items).where(inArray(items.id, [RM_ITEM_A]));
    await db.delete(warehouses).where(inArray(warehouses.id, [WAREHOUSE_ID]));

    await db.insert(warehouses).values({
      id: WAREHOUSE_ID,
      code: 'WH-TEST-EXP',
      name: 'Expiry Test Warehouse',
      type: 'raw_material',
      isActive: true,
      createdAt: getNow(),
      updatedAt: getNow(),
    });

    await db.insert(items).values({
      id: RM_ITEM_A,
      code: 'RM-EXP-1',
      name: 'Expiring Material',
      nameTh: 'วัตถุดิบใกล้หมดอายุ',
      type: 'raw_material',
      primaryUnit: 'kg',
      isActive: true,
      createdAt: getNow(),
      updatedAt: getNow(),
    });

    const baseLot = {
      itemId: RM_ITEM_A,
      warehouseId: WAREHOUSE_ID,
      unit: 'kg',
      status: 'released',
      receivedDate: toDbDate(getTodayStr()),
      createdAt: getNow(),
      updatedAt: getNow(),
    };

    await db.insert(lots).values([
      // Already expired: 3 * 100 = 300
      { ...baseLot, lotNumber: 'EXP-PAST', quantity: 3, cost: 100, expiryDate: toDbDate(dayOffset(-5)) },
      // Expiring soon (within 30d): 2 * 200 = 400
      { ...baseLot, lotNumber: 'EXP-SOON', quantity: 2, cost: 200, expiryDate: toDbDate(dayOffset(10)) },
      // Beyond the 30-day horizon — must be excluded entirely.
      { ...baseLot, lotNumber: 'EXP-FAR', quantity: 50, cost: 900, expiryDate: toDbDate(dayOffset(200)) },
      // No expiry date — excluded.
      { ...baseLot, lotNumber: 'EXP-NONE', quantity: 50, cost: 900, expiryDate: null },
    ]);
  });

  it('reports the baht value at risk, not just a lot count', async () => {
    const { expiringSoon } = await getInventoryValueKpis();

    // A lot count alone cannot tell an owner whether ฿400 or ฿400k is at stake.
    expect(expiringSoon.lots).toBe(1);
    expect(expiringSoon.quantity).toBe(2);
    expect(expiringSoon.value).toBe(400); // 2 * 200
  });

  it('separates already-expired stock from stock expiring soon', async () => {
    const { expiringSoon } = await getInventoryValueKpis();

    expect(expiringSoon.expiredLots).toBe(1);
    expect(expiringSoon.expiredValue).toBe(300); // 3 * 100

    // The two windows are disjoint: an expired lot is never also "expiring soon".
    expect(expiringSoon.lots).toBe(1);
  });

  it('excludes stock beyond the 30-day horizon and stock with no expiry date', async () => {
    const { expiringSoon } = await getInventoryValueKpis();

    // EXP-FAR and EXP-NONE are 50 * 900 = 45,000 each. If the horizon or the
    // NULL check leaked, the value would be far larger.
    const total = expiringSoon.value + expiringSoon.expiredValue;
    expect(total).toBe(700); // 400 + 300
  });
});
