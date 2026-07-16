/**
 * The delivery-note register must show the lot AND its expiry date.
 *
 * The rows already existed — fulfillSalesOrderLine() has been writing
 * sales_deliveries with the lot it shipped from — but the only API was scoped
 * to a single sales order, so nobody could see them across orders or print a
 * note for a customer.
 *
 * Expiry is JOINED from the lot rather than copied onto the delivery row: a lot
 * has one expiry date, and a second copy could only ever drift out of step.
 * These tests prove the join actually carries it through.
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { initializeDatabase, getDb } from '@/lib/db';
import { getTableRef } from '@/lib/db/db-helper';
import {
  listDeliveryNotes,
  getDeliveryNote,
} from '@/lib/services/delivery-note.service';
import { getNow, toDbDate } from '@/lib/db/date-utils';

const WH = 9810;
const ITEM = 9811;
const LOT_OK = 9821, LOT_EXPIRED = 9822, LOT_SOON = 9823;
const SO = 9830;
const SO_LINE = 9840;
const DEL_A = 9851, DEL_B = 9852, DEL_C = 9853;
const USER = 1;

function inDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

async function seed() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- getDb()
  // returns a SQLite|MySQL union whose builders don't unify.
  const db = (await getDb()) as any;
  const { inArray, eq } = await import('drizzle-orm');

  const deliveries = getTableRef('salesDeliveries');
  const soLines = getTableRef('salesOrderLines');
  const orders = getTableRef('salesOrders');
  const items = getTableRef('items');
  const lots = getTableRef('inventoryLots');
  const warehouses = getTableRef('warehouses');

  await db.delete(deliveries).where(inArray(deliveries.id, [DEL_A, DEL_B, DEL_C]));
  await db.delete(soLines).where(inArray(soLines.id, [SO_LINE]));
  await db.delete(orders).where(inArray(orders.id, [SO]));
  await db.delete(lots).where(inArray(lots.id, [LOT_OK, LOT_EXPIRED, LOT_SOON]));
  await db.delete(items).where(inArray(items.id, [ITEM]));
  await db.delete(warehouses).where(inArray(warehouses.id, [WH]));

  await db.insert(warehouses).values({
    id: WH, code: 'WH-DN', name: 'DN Warehouse', type: 'finished_goods',
    isActive: true, createdAt: getNow(), updatedAt: getNow(),
  });

  await db.insert(items).values({
    id: ITEM, code: 'FG-DN-1', name: 'DN Item', nameTh: 'สินค้าใบส่งของ',
    type: 'finished_goods', primaryUnit: 'box', isActive: true,
    createdAt: getNow(), updatedAt: getNow(),
  });

  const baseLot = {
    itemId: ITEM, warehouseId: WH, unit: 'box', quantity: 100, status: 'released',
    receivedDate: toDbDate(inDays(-60)), createdAt: getNow(), updatedAt: getNow(),
  };
  await db.insert(lots).values([
    { ...baseLot, id: LOT_OK, lotNumber: 'LOT-OK', expiryDate: toDbDate(inDays(400)) },
    { ...baseLot, id: LOT_EXPIRED, lotNumber: 'LOT-EXPIRED', expiryDate: toDbDate(inDays(-5)) },
    { ...baseLot, id: LOT_SOON, lotNumber: 'LOT-SOON', expiryDate: toDbDate(inDays(10)) },
  ]);

  await db.insert(orders).values({
    id: SO, soNumber: 'SO-DN-1', customerName: 'โรงพยาบาลทดสอบ', status: 'shipped',
    orderDate: toDbDate(inDays(-10)), totalAmount: 1000, createdBy: USER,
    createdAt: getNow(), updatedAt: getNow(),
  });

  await db.insert(soLines).values({
    id: SO_LINE, soId: SO, itemId: ITEM, lotId: LOT_OK, quantity: 30,
    unit: 'box', unitPrice: 10, totalPrice: 300, createdAt: getNow(),
  });

  const baseDel = {
    soId: SO, soLineId: SO_LINE, itemId: ITEM, unit: 'box', status: 'shipped',
    deliveryDate: toDbDate(inDays(-1)), createdBy: USER, createdAt: getNow(),
  };
  await db.insert(deliveries).values([
    // Two lines share ONE delivery number — a note can cover several lots.
    { ...baseDel, id: DEL_A, lotId: LOT_OK, lotNumber: 'LOT-OK', quantity: 10, deliveryNumber: 'DL-TEST-001' },
    { ...baseDel, id: DEL_B, lotId: LOT_SOON, lotNumber: 'LOT-SOON', quantity: 5, deliveryNumber: 'DL-TEST-001' },
    { ...baseDel, id: DEL_C, lotId: LOT_EXPIRED, lotNumber: 'LOT-EXPIRED', quantity: 2, deliveryNumber: 'DL-TEST-002' },
  ]);
}

describe('listDeliveryNotes', () => {
  beforeAll(async () => { await initializeDatabase(); });
  beforeEach(seed);

  it('carries the lot expiry date through from the lot', async () => {
    const { rows } = await listDeliveryNotes({ soId: SO });
    const ok = rows.find((r) => r.lotNumber === 'LOT-OK');

    // The whole point of item 15: a delivery note must be printable with the
    // lot number AND its expiry.
    expect(ok?.expiryDate).toBe(inDays(400));
    expect(ok?.lotNumber).toBe('LOT-OK');
  });

  it('shows the customer and order the delivery belongs to', async () => {
    const { rows } = await listDeliveryNotes({ soId: SO });
    expect(rows[0]?.soNumber).toBe('SO-DN-1');
    expect(rows[0]?.customerName).toBe('โรงพยาบาลทดสอบ');
  });

  it('counts documents separately from lines', async () => {
    const { summary } = await listDeliveryNotes({ soId: SO });
    // 3 lines across 2 delivery numbers — a note can cover several lots.
    expect(summary.lines).toBe(3);
    expect(summary.documents).toBe(2);
    expect(summary.orders).toBe(1);
  });

  it('flags a line shipped from an already-expired lot', async () => {
    const { summary } = await listDeliveryNotes({ soId: SO });
    // Shipping expired stock is a GMP failure — the register must surface it
    // rather than leave it to be discovered later.
    expect(summary.expiredLines).toBe(1);
  });

  it('flags a line whose lot expires within 30 days', async () => {
    const { summary } = await listDeliveryNotes({ soId: SO });
    expect(summary.expiringSoonLines).toBe(1);
  });

  it('does not count a far-future lot as expiring', async () => {
    const { summary } = await listDeliveryNotes({ soId: SO });
    // 3 lines: one expired, one soon, one fine.
    expect(summary.lines - summary.expiredLines - summary.expiringSoonLines).toBe(1);
  });

  it('honours the date range instead of ignoring it', async () => {
    // Guards the accept-a-filter-then-drop-it bug class.
    const none = await listDeliveryNotes({ dateFrom: inDays(30), dateTo: inDays(60) });
    expect(none.rows.filter((r) => r.soId === SO)).toEqual([]);

    const some = await listDeliveryNotes({ dateFrom: inDays(-5), dateTo: inDays(1), soId: SO });
    expect(some.rows.length).toBe(3);
  });
});

describe('getDeliveryNote', () => {
  beforeAll(async () => { await initializeDatabase(); });
  beforeEach(seed);

  it('returns every line under one delivery number', async () => {
    const note = await getDeliveryNote('DL-TEST-001');
    // Both lots on the note — printing only the first would ship goods the
    // paperwork does not mention.
    expect(note?.lines).toHaveLength(2);
    expect(note?.lines.map((l) => l.lotNumber).sort()).toEqual(['LOT-OK', 'LOT-SOON']);
  });

  it('carries the header once for the printed note', async () => {
    const note = await getDeliveryNote('DL-TEST-001');
    expect(note?.soNumber).toBe('SO-DN-1');
    expect(note?.customerName).toBe('โรงพยาบาลทดสอบ');
  });

  it('returns null for a number that does not exist', async () => {
    expect(await getDeliveryNote('DL-NOPE')).toBeNull();
  });
});
