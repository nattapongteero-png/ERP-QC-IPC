/**
 * Purchase & Sales report aggregation — asserted against seeded orders with
 * KNOWN amounts, so the expected totals are arithmetic rather than whatever the
 * code happens to return.
 *
 * The rule under test: cancelled/rejected orders must never be counted as
 * spend or revenue, but must still be visible. A report that silently folds a
 * cancelled ฿1M order into the total is worse than no report.
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { initializeDatabase, getDb } from '@/lib/db';
import { getTableRef } from '@/lib/db/db-helper';
import {
  getPurchaseReport,
  getSalesReport,
} from '@/lib/services/procurement-sales-report.service';
import { getNow, toDbDate } from '@/lib/db/date-utils';

const VENDOR_A = 9801;
const VENDOR_B = 9802;
const PO_IDS = [9811, 9812, 9813, 9814];
const SO_IDS = [9821, 9822, 9823];

describe('getPurchaseReport', () => {
  beforeAll(async () => {
    await initializeDatabase();
  });

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- getDb()
    // returns a SQLite|MySQL union whose .delete() signatures don't unify.
    const db = (await getDb()) as any;
    const po = getTableRef('purchaseOrders');
    const vendors = getTableRef('vendors');
    const { inArray } = await import('drizzle-orm');

    await db.delete(po).where(inArray(po.id, PO_IDS));
    await db.delete(vendors).where(inArray(vendors.id, [VENDOR_A, VENDOR_B]));

    await db.insert(vendors).values([
      { id: VENDOR_A, code: 'V-A', name: 'Vendor A', isActive: true, createdAt: getNow(), updatedAt: getNow() },
      { id: VENDOR_B, code: 'V-B', name: 'Vendor B', isActive: true, createdAt: getNow(), updatedAt: getNow() },
    ]);

    await db.insert(po).values([
      // Vendor A: 1,000 + 2,500 = 3,500 across two months
      { id: PO_IDS[0], poNumber: 'PO-R-1', vendorId: VENDOR_A, status: 'received', orderDate: toDbDate('2026-03-10'), totalAmount: 1000, createdAt: getNow(), updatedAt: getNow() },
      { id: PO_IDS[1], poNumber: 'PO-R-2', vendorId: VENDOR_A, status: 'sent', orderDate: toDbDate('2026-04-05'), totalAmount: 2500, createdAt: getNow(), updatedAt: getNow() },
      // Vendor B: 500
      { id: PO_IDS[2], poNumber: 'PO-R-3', vendorId: VENDOR_B, status: 'draft', orderDate: toDbDate('2026-04-20'), totalAmount: 500, createdAt: getNow(), updatedAt: getNow() },
      // Cancelled — a large amount that must NOT reach the total.
      { id: PO_IDS[3], poNumber: 'PO-R-4', vendorId: VENDOR_B, status: 'cancelled', orderDate: toDbDate('2026-04-22'), totalAmount: 999999, createdAt: getNow(), updatedAt: getNow() },
    ]);
  });

  it('totals only live orders and reports the cancelled ones separately', async () => {
    const r = await getPurchaseReport({ dateFrom: '2026-01-01', dateTo: '2026-12-31' });

    // 1,000 + 2,500 + 500 — the 999,999 cancelled PO is excluded.
    expect(r.summary.value).toBe(4000);
    expect(r.summary.orders).toBe(3);
    // ...but it is still disclosed, not hidden.
    expect(r.summary.voidedOrders).toBe(1);
    expect(r.summary.voidedValue).toBe(999999);
  });

  it('averages over live orders only, and never fakes a zero', async () => {
    const r = await getPurchaseReport({ dateFrom: '2026-01-01', dateTo: '2026-12-31' });
    expect(r.summary.avgOrderValue).toBeCloseTo(4000 / 3, 6);

    // A range with no orders must yield null, not 0 — "no orders" and "orders
    // averaging ฿0" are different facts.
    const empty = await getPurchaseReport({ dateFrom: '1990-01-01', dateTo: '1990-12-31' });
    expect(empty.summary.orders).toBe(0);
    expect(empty.summary.avgOrderValue).toBeNull();
  });

  it('groups by vendor, excluding cancelled spend', async () => {
    const r = await getPurchaseReport({ dateFrom: '2026-01-01', dateTo: '2026-12-31' });
    const a = r.byParty.find((p) => p.code === 'V-A');
    const b = r.byParty.find((p) => p.code === 'V-B');

    expect(a?.value).toBe(3500);
    expect(a?.orders).toBe(2);
    // Vendor B's cancelled 999,999 must not appear in their spend.
    expect(b?.value).toBe(500);
    expect(b?.orders).toBe(1);
  });

  it('shows every status in the breakdown, including cancelled', async () => {
    const r = await getPurchaseReport({ dateFrom: '2026-01-01', dateTo: '2026-12-31' });
    const statuses = r.byStatus.map((s) => s.status);
    // The breakdown exists to show where orders went — hiding cancelled here
    // would make the report unable to explain its own totals.
    expect(statuses).toContain('cancelled');
    expect(statuses).toContain('received');
  });

  it('buckets by month from the order date', async () => {
    const r = await getPurchaseReport({ dateFrom: '2026-01-01', dateTo: '2026-12-31' });
    const mar = r.byMonth.find((m) => m.month === '2026-03');
    const apr = r.byMonth.find((m) => m.month === '2026-04');

    expect(mar?.value).toBe(1000);
    // April live orders: 2,500 + 500 (cancelled 999,999 excluded).
    expect(apr?.value).toBe(3000);
  });

  it('honours the date range instead of ignoring it', async () => {
    // Guards the broken-filter class of bug: a report that accepts dateFrom/
    // dateTo and then silently returns everything.
    const r = await getPurchaseReport({ dateFrom: '2026-04-01', dateTo: '2026-04-30' });
    expect(r.rows.every((row) => String(row.orderDate).startsWith('2026-04'))).toBe(true);
    expect(r.summary.value).toBe(3000); // 2,500 + 500 only
  });
});

describe('getSalesReport', () => {
  beforeAll(async () => {
    await initializeDatabase();
  });

  beforeEach(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see above.
    const db = (await getDb()) as any;
    const so = getTableRef('salesOrders');
    const { inArray } = await import('drizzle-orm');

    await db.delete(so).where(inArray(so.id, SO_IDS));

    await db.insert(so).values([
      { id: SO_IDS[0], soNumber: 'SO-R-1', customerName: 'Customer X', status: 'delivered', orderDate: toDbDate('2026-05-02'), totalAmount: 8000, createdAt: getNow(), updatedAt: getNow() },
      { id: SO_IDS[1], soNumber: 'SO-R-2', customerName: 'Customer X', status: 'shipped', orderDate: toDbDate('2026-05-18'), totalAmount: 2000, createdAt: getNow(), updatedAt: getNow() },
      // Cancelled revenue must not be booked.
      { id: SO_IDS[2], soNumber: 'SO-R-3', customerName: 'Customer Y', status: 'cancelled', orderDate: toDbDate('2026-05-20'), totalAmount: 500000, createdAt: getNow(), updatedAt: getNow() },
    ]);
  });

  it('totals only live orders and groups by customer', async () => {
    const r = await getSalesReport({ dateFrom: '2026-05-01', dateTo: '2026-05-31' });

    expect(r.summary.value).toBe(10000); // 8,000 + 2,000
    expect(r.summary.orders).toBe(2);
    expect(r.summary.voidedOrders).toBe(1);
    expect(r.summary.voidedValue).toBe(500000);

    const x = r.byParty.find((p) => p.name === 'Customer X');
    expect(x?.value).toBe(10000);
    expect(x?.orders).toBe(2);
    // Customer Y only has a cancelled order — they must not show as revenue.
    expect(r.byParty.find((p) => p.name === 'Customer Y')).toBeUndefined();
  });

  it('counts distinct trading partners from live orders only', async () => {
    const r = await getSalesReport({ dateFrom: '2026-05-01', dateTo: '2026-05-31' });
    expect(r.summary.parties).toBe(1); // X only; Y's sole order is cancelled
  });
});
