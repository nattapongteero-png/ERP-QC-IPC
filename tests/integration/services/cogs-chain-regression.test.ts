/**
 * Regression guard for the zero-COGS defect.
 *
 * Proves the Set 2 fix end-to-end on a real SQLite DB:
 *   receiveMaterial(unitCost) -> lot.cost written -> items.current_wac set
 *   -> getItemWAC() non-zero -> calculateCOGS() non-zero
 *
 * Before the fix every step in that chain produced 0/NULL, which is why
 * account 5110 had zero journal lines against 6,778 of revenue.
 */
import { describe, it, expect, beforeAll } from 'vitest';

process.env.DB_TYPE = 'sqlite';

describe('COGS chain: receipt cost -> WAC -> COGS', () => {
  let itemId: number;

  beforeAll(async () => {
    const { syncDatabaseSchema } = await import('../../../src/lib/db/schema-sync');
    await syncDatabaseSchema();

    const { getDb } = await import('../../../src/lib/db');
    const { getTableRef, getInsertId } = await import('../../../src/lib/db/db-helper');
    const db = (await getDb()) as any;

    const items = getTableRef('items');
    const res = await db.insert(items).values({
      code: `VERIFY-${Date.now()}`,
      nameTh: 'ทดสอบต้นทุน',
      nameEn: 'Cost verify',
      type: 'raw_material',
      primaryUnit: 'kg',
      onHand: 0,
    });
    itemId = getInsertId(res);
  });

  it('writes lot cost and derives a non-zero WAC and COGS', async () => {
    const { receiveMaterial } = await import('../../../src/lib/services/inventory.service');
    const { getItemWAC, calculateCOGS } = await import('../../../src/lib/services/unit-cost.service');

    // Receive 100 units @ 25 THB.
    const lotId = await receiveMaterial(
      itemId, `LOT-${Date.now()}`, 100, 'kg', 1,
      null, null, null, 1, null,
      25, // <-- the new unitCost parameter
    );
    expect(lotId).toBeGreaterThan(0);

    const { getDb } = await import('../../../src/lib/db');
    const { getTableRef } = await import('../../../src/lib/db/db-helper');
    const { eq } = await import('drizzle-orm');
    const db = (await getDb()) as any;

    // 1. the lot carries the cost
    const lots = getTableRef('inventoryLots');
    const [lot] = await db.select().from(lots).where(eq((lots as any).id, lotId));
    expect(Number(lot.cost)).toBe(25);

    // 2. WAC reaches the item
    const wac = await getItemWAC(itemId);
    expect(wac).toBeGreaterThan(0);
    expect(wac).toBeCloseTo(25, 2);

    // 3. COGS is non-zero — the whole point
    const cogs = await calculateCOGS(itemId, 4, 100);
    expect(cogs.unitCost).toBeCloseTo(25, 2);
    expect(cogs.totalCost).toBeCloseTo(100, 2);
    expect(cogs.marginAmount).toBeCloseTo(300, 2); // 400 revenue - 100 cost
  });
});
