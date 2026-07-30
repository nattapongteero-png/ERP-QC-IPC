/**
 * Delivery notes (ใบส่งของ) — the register across every sales order.
 *
 * The rows already existed: fulfillSalesOrderLine() has been writing
 * sales_deliveries (with the lot it shipped from) all along, and there are real
 * ones in the database. What was missing is any way to SEE them: the only API
 * was scoped to one sales order, so nobody could answer "what shipped this
 * week" or print a delivery note for a customer.
 *
 * Expiry is joined from the lot rather than copied onto the delivery row. A lot
 * has exactly one expiry date, so storing a second copy here would only create
 * something that can disagree with it.
 */

import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { getTableRef, executeDbOperation } from '../db/db-helper';
import { toQueryDate, formatDateFromDb } from '../db/date-utils';

export interface DeliveryNoteRow {
  id: number;
  deliveryNumber: string;
  deliveryDate: string | null;
  status: string;
  soId: number;
  soNumber: string | null;
  customerName: string | null;
  itemId: number;
  itemCode: string | null;
  itemName: string | null;
  lotId: number;
  lotNumber: string;
  /** From the lot — the date printed on the delivery note. */
  expiryDate: string | null;
  quantity: number;
  unit: string;
  notes: string | null;
}

export interface DeliveryNoteFilter {
  /** YYYY-MM-DD inclusive. */
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  soId?: number;
}

export interface DeliveryNoteSummary {
  /** Delivery lines in range. */
  lines: number;
  /** Distinct delivery documents (one number can cover several lines). */
  documents: number;
  /** Distinct sales orders shipped against. */
  orders: number;
  /** Lines whose lot is already past its expiry date — must never be shipped. */
  expiredLines: number;
  /** Lines whose lot expires within 30 days. */
  expiringSoonLines: number;
}

export interface DeliveryNoteReport {
  summary: DeliveryNoteSummary;
  rows: DeliveryNoteRow[];
  generatedAt: string;
}

/** Days from today until `date`; null when there is no usable date. */
function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null;
  const due = new Date(date);
  if (isNaN(due.getTime())) return null;
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round(
    (startOfDay(due).getTime() - startOfDay(new Date()).getTime()) / 86_400_000,
  );
}

export async function listDeliveryNotes(
  filter: DeliveryNoteFilter = {},
): Promise<DeliveryNoteReport> {
  const deliveries = getTableRef('salesDeliveries');
  const orders = getTableRef('salesOrders');
  const items = getTableRef('items');
  const lots = getTableRef('inventoryLots');

  const rows = await executeDbOperation(async (db) => {
    const conds: unknown[] = [];
    if (filter.dateFrom) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      conds.push(gte(deliveries.deliveryDate as any, toQueryDate(filter.dateFrom)));
    }
    if (filter.dateTo) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      conds.push(lte(deliveries.deliveryDate as any, toQueryDate(filter.dateTo)));
    }
    if (filter.status) conds.push(eq(deliveries.status, filter.status));
    if (filter.soId) conds.push(eq(deliveries.soId, filter.soId));

    const q = db
      .select({
        id: deliveries.id,
        deliveryNumber: deliveries.deliveryNumber,
        deliveryDate: deliveries.deliveryDate,
        status: deliveries.status,
        soId: deliveries.soId,
        soNumber: orders.soNumber,
        customerName: orders.customerName,
        itemId: deliveries.itemId,
        itemCode: items.code,
        itemName: items.nameTh,
        lotId: deliveries.lotId,
        lotNumber: deliveries.lotNumber,
        // Joined, not stored: one lot has one expiry, so a copy here could
        // only ever drift out of step with it.
        expiryDate: lots.expiryDate,
        quantity: deliveries.quantity,
        unit: deliveries.unit,
        notes: deliveries.notes,
      })
      .from(deliveries)
      .leftJoin(orders, eq(orders.id, deliveries.soId))
      .leftJoin(items, eq(items.id, deliveries.itemId))
      .leftJoin(lots, eq(lots.id, deliveries.lotId))
      .orderBy(desc(deliveries.id));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = conds.length ? await q.where(and(...(conds as any))) : await q;
    return result as unknown as DeliveryNoteRow[];
  });

  const normalised = rows.map((r) => ({
    ...r,
    // formatDateFromDb, NOT String(...).slice(0, 10). MySQL hands back a Date
    // object, and String(Date) is "Tue Jul 28 2026 00:00:00 GMT+0700" — the
    // first ten characters of that are "Tue Jul 28", which is exactly what the
    // register was displaying, in English, even in Thai. SQLite returns a
    // "YYYY-MM-DD" string where the slice happened to work, which is why this
    // survived the tests.
    deliveryDate: r.deliveryDate ? formatDateFromDb(r.deliveryDate) : null,
    expiryDate: r.expiryDate ? formatDateFromDb(r.expiryDate) : null,
    quantity: Number(r.quantity) || 0,
  }));

  // Shipping expired stock is a GMP failure, not a statistic — surface it here
  // so the register can show it rather than leaving it to be found later.
  let expiredLines = 0;
  let expiringSoonLines = 0;
  for (const r of normalised) {
    const days = daysUntil(r.expiryDate);
    if (days === null) continue;
    if (days < 0) expiredLines += 1;
    else if (days <= 30) expiringSoonLines += 1;
  }

  return {
    summary: {
      lines: normalised.length,
      documents: new Set(normalised.map((r) => r.deliveryNumber)).size,
      orders: new Set(normalised.map((r) => r.soId)).size,
      expiredLines,
      expiringSoonLines,
    },
    rows: normalised,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * One delivery document, for printing.
 *
 * A delivery number can cover several lines (one per lot), so this returns the
 * header once and every line under it — which is what a printed note needs.
 */
export async function getDeliveryNote(deliveryNumber: string): Promise<{
  deliveryNumber: string;
  deliveryDate: string | null;
  status: string;
  soNumber: string | null;
  customerName: string | null;
  lines: DeliveryNoteRow[];
} | null> {
  const all = await listDeliveryNotes();
  const lines = all.rows.filter((r) => r.deliveryNumber === deliveryNumber);
  if (lines.length === 0) return null;

  const first = lines[0];
  return {
    deliveryNumber,
    deliveryDate: first.deliveryDate,
    status: first.status,
    soNumber: first.soNumber,
    customerName: first.customerName,
    lines,
  };
}
