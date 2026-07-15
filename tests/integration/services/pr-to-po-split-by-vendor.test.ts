/**
 * Converting a PR must produce ONE purchase order PER VENDOR.
 *
 * A requisition can list items bought from different companies. The converter
 * used to force every line onto a single PO addressed to one vendor, so a mixed
 * PR produced a PO ordering goods from a company that does not sell them.
 *
 * The split is asserted arithmetically — line counts and baht totals per vendor
 * — so "it created some POs" cannot pass for "it split correctly".
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { initializeDatabase, getDb } from '@/lib/db';
import { getTableRef } from '@/lib/db/db-helper';
import { convertPRToPO } from '@/lib/services/purchase-requisition.service';
import { getNow, toDbDate } from '@/lib/db/date-utils';

const EMP = 9590;
const V_A = 9601, V_B = 9602;
const ITEM_1 = 9611, ITEM_2 = 9612, ITEM_3 = 9613;
const PR_ID = 9620;
const L1 = 9631, L2 = 9632, L3 = 9633;
const USER = 1;

/** Line totals: L1=100 (vendor per test), L2=200, L3=400. */
async function seed(preferred: (number | null)[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- getDb()
  // returns a SQLite|MySQL union whose builders don't unify.
  const db = (await getDb()) as any;
  const { inArray, eq } = await import('drizzle-orm');

  const prs = getTableRef('purchaseRequisitions');
  const prLines = getTableRef('purchaseRequisitionLines');
  const pos = getTableRef('purchaseOrders');
  const poLines = getTableRef('purchaseOrderLines');
  const items = getTableRef('items');
  const vendors = getTableRef('vendors');
  const emps = getTableRef('HREmployees');

  // purchase_orders has no prId column, so fixture POs are found by their
  // vendor instead. Clear PO lines first — they FK back to the POs.
  const oldPOs = await db.select({ id: pos.id }).from(pos).where(inArray(pos.vendorId, [V_A, V_B]));
  for (const p of oldPOs) await db.delete(poLines).where(eq(poLines.poId, p.id));
  await db.delete(pos).where(inArray(pos.vendorId, [V_A, V_B]));
  await db.delete(prLines).where(eq(prLines.prId, PR_ID));
  await db.delete(prs).where(eq(prs.id, PR_ID));
  await db.delete(items).where(inArray(items.id, [ITEM_1, ITEM_2, ITEM_3]));
  await db.delete(vendors).where(inArray(vendors.id, [V_A, V_B]));
  await db.delete(emps).where(inArray(emps.id, [EMP]));

  await db.insert(emps).values({
    id: EMP,
    employeeCode: 'EMP-SPLIT',
    firstName: 'Split',
    lastName: 'Tester',
    hireDate: toDbDate('2026-01-01'),
    createdAt: getNow(),
    updatedAt: getNow(),
  });

  await db.insert(vendors).values([
    { id: V_A, code: 'V-AA', name: 'Vendor A', isActive: true, createdAt: getNow(), updatedAt: getNow() },
    { id: V_B, code: 'V-BB', name: 'Vendor B', isActive: true, createdAt: getNow(), updatedAt: getNow() },
  ]);

  const baseItem = { primaryUnit: 'kg', isActive: true, createdAt: getNow(), updatedAt: getNow() };
  await db.insert(items).values([
    { id: ITEM_1, code: 'RM-S1', name: 'Item 1', nameTh: 'สินค้า 1', type: 'raw_material', ...baseItem },
    { id: ITEM_2, code: 'RM-S2', name: 'Item 2', nameTh: 'สินค้า 2', type: 'raw_material', ...baseItem },
    { id: ITEM_3, code: 'RM-S3', name: 'Item 3', nameTh: 'สินค้า 3', type: 'raw_material', ...baseItem },
  ]);

  // The PR must be 'approved' — convert refuses anything else.
  await db.insert(prs).values({
    id: PR_ID,
    prNumber: 'PR-SPLIT-1',
    requesterId: EMP,
    createdBy: USER,
    status: 'approved',
    requiredDate: toDbDate('2026-09-30'),
    createdAt: getNow(),
    updatedAt: getNow(),
  });

  const specs = [
    { id: L1, itemId: ITEM_1, price: 10, total: 100 },
    { id: L2, itemId: ITEM_2, price: 20, total: 200 },
    { id: L3, itemId: ITEM_3, price: 40, total: 400 },
  ];
  await db.insert(prLines).values(
    specs.map((s, i) => ({
      id: s.id,
      prId: PR_ID,
      lineNumber: i + 1,
      itemId: s.itemId,
      description: `Line ${i + 1}`,
      quantity: 10,
      unit: 'kg',
      estimatedPrice: s.price,
      lineTotal: s.total,
      preferredVendorId: preferred[i],
      // Lines are marked 'approved' when the PR is fully approved; convert
      // only picks up lines in that state.
      status: 'approved',
    })),
  );

  return { db, pos, poLines };
}

describe('convertPRToPO — split by vendor', () => {
  beforeAll(async () => {
    await initializeDatabase();
  });

  it('creates one PO per vendor from the lines preferred vendors', async () => {
    // Lines 1+2 -> Vendor A, line 3 -> Vendor B
    await seed([V_A, V_A, V_B]);

    const res = await convertPRToPO({ prId: PR_ID }, USER);

    expect(res.purchaseOrders).toHaveLength(2);
    expect(res.convertedLineCount).toBe(3);

    const a = res.purchaseOrders.find((p) => p.vendorId === V_A);
    const b = res.purchaseOrders.find((p) => p.vendorId === V_B);

    // 100 + 200 on A, 400 on B — the whole point of the split.
    expect(a?.lineCount).toBe(2);
    expect(a?.totalAmount).toBe(300);
    expect(b?.lineCount).toBe(1);
    expect(b?.totalAmount).toBe(400);

    // Each PO must carry its own number, not a shared one.
    expect(a?.poNumber).not.toBe(b?.poNumber);
  });

  it('puts each PO line under the vendor that actually sells it', async () => {
    const { db, poLines } = await seed([V_A, V_A, V_B]);
    const res = await convertPRToPO({ prId: PR_ID }, USER);

    const b = res.purchaseOrders.find((p) => p.vendorId === V_B)!;
    const { eq } = await import('drizzle-orm');
    const bLines = await db.select().from(poLines).where(eq(poLines.poId, b.poId));

    expect(bLines).toHaveLength(1);
    expect(bLines[0].itemId).toBe(ITEM_3);
  });

  it('lets the buyer tick a vendor per line when the PR has none', async () => {
    await seed([null, null, null]);

    const res = await convertPRToPO(
      { prId: PR_ID, lineVendors: { [L1]: V_A, [L2]: V_B, [L3]: V_B } },
      USER,
    );

    expect(res.purchaseOrders).toHaveLength(2);
    expect(res.purchaseOrders.find((p) => p.vendorId === V_A)?.totalAmount).toBe(100);
    expect(res.purchaseOrders.find((p) => p.vendorId === V_B)?.totalAmount).toBe(600);
  });

  it('prefers the ticked vendor over the line preferred vendor', async () => {
    await seed([V_A, V_A, V_A]);

    // Buyer overrides line 3 to Vendor B at convert time.
    const res = await convertPRToPO({ prId: PR_ID, lineVendors: { [L3]: V_B } }, USER);

    expect(res.purchaseOrders).toHaveLength(2);
    expect(res.purchaseOrders.find((p) => p.vendorId === V_B)?.lineCount).toBe(1);
    expect(res.purchaseOrders.find((p) => p.vendorId === V_A)?.totalAmount).toBe(300);
  });

  it('still makes a single PO when every line shares one vendor', async () => {
    await seed([V_A, V_A, V_A]);
    const res = await convertPRToPO({ prId: PR_ID }, USER);

    expect(res.purchaseOrders).toHaveLength(1);
    expect(res.purchaseOrders[0].totalAmount).toBe(700);
    // Back-compat: callers written before the split read poId/poNumber.
    expect(res.poId).toBe(res.purchaseOrders[0].poId);
    expect(res.poNumber).toBe(res.purchaseOrders[0].poNumber);
  });

  it('refuses to convert when a line has no vendor anywhere', async () => {
    await seed([null, null, null]);
    // Must not sweep the line onto someone else's PO.
    await expect(convertPRToPO({ prId: PR_ID }, USER)).rejects.toThrow(
      /LINE_VENDOR_REQUIRED|VENDOR_REQUIRED/,
    );
  });

  it('takes the PO expected date from the PR required date', async () => {
    const { db, pos } = await seed([V_A, V_A, V_A]);
    const res = await convertPRToPO({ prId: PR_ID }, USER);

    const { eq } = await import('drizzle-orm');
    const [po] = await db.select().from(pos).where(eq(pos.id, res.poId));

    // Seeded requiredDate is 2026-09-30: it must carry over rather than be
    // retyped, which is how the two documents drift apart.
    expect(String(po.expectedDate)).toContain('2026-09-30');
  });
});
