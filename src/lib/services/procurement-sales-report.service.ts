/**
 * Purchasing & Sales reports.
 *
 * Both reports answer the same three questions over a date range — how much was
 * ordered, what state is it in, and who did we trade with — so they are built
 * from one shared shape rather than two divergent implementations.
 *
 * Money rules that apply throughout:
 *  - Cancelled and rejected orders are EXCLUDED from value totals. They are
 *    counted separately so the operator can see them, but carrying them as
 *    spend/revenue would overstate both.
 *  - Draft orders are INCLUDED in the totals but flagged, because a draft is
 *    real intent that has not been committed yet. The status breakdown makes
 *    the split visible instead of burying it in one number.
 */

import { and, gte, lte, sql, eq, inArray } from 'drizzle-orm';
import { getTableRef, executeDbOperation } from '../db/db-helper';
import { toQueryDate, formatDateFromDb } from '../db/date-utils';

// ============================================
// Types
// ============================================

export interface ReportDateRange {
  /** YYYY-MM-DD inclusive. Omit for no lower bound. */
  dateFrom?: string;
  /** YYYY-MM-DD inclusive. Omit for no upper bound. */
  dateTo?: string;
}

export interface StatusBucket {
  status: string;
  count: number;
  /** Baht value of the orders in this status. */
  value: number;
}

export interface PartyBucket {
  /** Vendor name (purchasing) or customer name (sales). */
  name: string;
  code: string | null;
  orders: number;
  value: number;
}

export interface MonthBucket {
  /** YYYY-MM */
  month: string;
  orders: number;
  value: number;
}

export interface ReportSummary {
  /** Orders in range, excluding cancelled/rejected. */
  orders: number;
  /** Baht value of those orders. */
  value: number;
  /** Average order value; null when there are no orders (never a fake 0). */
  avgOrderValue: number | null;
  /** Orders excluded from `value` because they were cancelled/rejected. */
  voidedOrders: number;
  voidedValue: number;
  /** Distinct vendors (purchasing) or customers (sales). */
  parties: number;
}

export interface ProcurementSalesReport<Row> {
  summary: ReportSummary;
  byStatus: StatusBucket[];
  byParty: PartyBucket[];
  byMonth: MonthBucket[];
  rows: Row[];
  generatedAt: string;
}

export interface PurchaseReportRow {
  id: number;
  poNumber: string;
  orderDate: string | null;
  expectedDate: string | null;
  vendorName: string | null;
  vendorCode: string | null;
  status: string;
  totalAmount: number;
}

export interface SalesReportRow {
  id: number;
  soNumber: string;
  orderDate: string | null;
  requiredDate: string | null;
  shippedDate: string | null;
  customerName: string | null;
  status: string;
  totalAmount: number;
}

/**
 * Statuses whose value must never be counted as spend/revenue.
 * Listed explicitly (not `!= 'cancelled'`) so adding a status to the schema
 * enum forces a deliberate decision here rather than silently changing a total.
 */
const PO_VOID_STATUSES = ['cancelled', 'rejected'];
const SO_VOID_STATUSES = ['cancelled', 'rejected'];

/** Build the inclusive date-range predicate for a report query. */
function dateRangeConditions(
  column: unknown,
  range: ReportDateRange,
): unknown[] {
  const conds: unknown[] = [];
  if (range.dateFrom) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    conds.push(gte(column as any, toQueryDate(range.dateFrom)));
  }
  if (range.dateTo) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    conds.push(lte(column as any, toQueryDate(range.dateTo)));
  }
  return conds;
}

/** Roll a set of rows up into the summary/status/party/month shape. */
function aggregate<
  Row extends { status: string; totalAmount: number; orderDate: string | null },
>(
  rows: Row[],
  voidStatuses: string[],
  partyOf: (r: Row) => { name: string; code: string | null },
): Omit<ProcurementSalesReport<Row>, 'rows' | 'generatedAt'> {
  const live = rows.filter((r) => !voidStatuses.includes(r.status));
  const voided = rows.filter((r) => voidStatuses.includes(r.status));

  const value = live.reduce((s, r) => s + (Number(r.totalAmount) || 0), 0);

  const statusMap = new Map<string, StatusBucket>();
  const partyMap = new Map<string, PartyBucket>();
  const monthMap = new Map<string, MonthBucket>();

  for (const r of rows) {
    const amount = Number(r.totalAmount) || 0;

    // Status breakdown covers EVERY order, including voided ones — the point of
    // the breakdown is to show where the orders went, not to hide the void ones.
    const s = statusMap.get(r.status) ?? { status: r.status, count: 0, value: 0 };
    s.count += 1;
    s.value += amount;
    statusMap.set(r.status, s);

    if (voidStatuses.includes(r.status)) continue;

    const p = partyOf(r);
    const key = p.code || p.name || '-';
    const party = partyMap.get(key) ?? {
      name: p.name || '-',
      code: p.code,
      orders: 0,
      value: 0,
    };
    party.orders += 1;
    party.value += amount;
    partyMap.set(key, party);

    // orderDate is stored YYYY-MM-DD (sqlite) or a Date (mysql); slice handles
    // both once stringified, and rows with no date are simply not bucketed
    // rather than being dumped into a wrong month.
    if (r.orderDate) {
      const month = String(r.orderDate).slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(month)) {
        const m = monthMap.get(month) ?? { month, orders: 0, value: 0 };
        m.orders += 1;
        m.value += amount;
        monthMap.set(month, m);
      }
    }
  }

  return {
    summary: {
      orders: live.length,
      value,
      // Null, not 0, when there is nothing to average — a 0 here would read as
      // "orders averaging ฿0" rather than "no orders".
      avgOrderValue: live.length > 0 ? value / live.length : null,
      voidedOrders: voided.length,
      voidedValue: voided.reduce((s, r) => s + (Number(r.totalAmount) || 0), 0),
      parties: partyMap.size,
    },
    byStatus: [...statusMap.values()].sort((a, b) => b.value - a.value),
    byParty: [...partyMap.values()].sort((a, b) => b.value - a.value),
    byMonth: [...monthMap.values()].sort((a, b) => a.month.localeCompare(b.month)),
  };
}

// ============================================
// Purchasing
// ============================================

export async function getPurchaseReport(
  range: ReportDateRange = {},
): Promise<ProcurementSalesReport<PurchaseReportRow>> {
  const po = getTableRef('purchaseOrders');
  const vendors = getTableRef('vendors');

  const rows = await executeDbOperation(async (db) => {
    const conds = dateRangeConditions(po.orderDate, range);

    const q = db
      .select({
        id: po.id,
        poNumber: po.poNumber,
        orderDate: po.orderDate,
        expectedDate: po.expectedDate,
        vendorName: vendors.name,
        vendorCode: vendors.code,
        status: po.status,
        totalAmount: po.totalAmount,
      })
      .from(po)
      .leftJoin(vendors, eq(vendors.id, po.vendorId));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = conds.length ? await q.where(and(...(conds as any))) : await q;
    return result as unknown as PurchaseReportRow[];
  });

  const normalised = rows.map((r) => ({
    ...r,
    orderDate: r.orderDate ? formatDateFromDb(r.orderDate) : null,
    expectedDate: r.expectedDate ? formatDateFromDb(r.expectedDate) : null,
    totalAmount: Number(r.totalAmount) || 0,
  }));

  return {
    ...aggregate(normalised, PO_VOID_STATUSES, (r) => ({
      name: r.vendorName || '-',
      code: r.vendorCode,
    })),
    rows: normalised.sort((a, b) =>
      String(b.orderDate ?? '').localeCompare(String(a.orderDate ?? '')),
    ),
    generatedAt: new Date().toISOString(),
  };
}

// ============================================
// Sales
// ============================================

export async function getSalesReport(
  range: ReportDateRange = {},
): Promise<ProcurementSalesReport<SalesReportRow>> {
  const so = getTableRef('salesOrders');

  const rows = await executeDbOperation(async (db) => {
    const conds = dateRangeConditions(so.orderDate, range);

    const q = db
      .select({
        id: so.id,
        soNumber: so.soNumber,
        orderDate: so.orderDate,
        requiredDate: so.requiredDate,
        shippedDate: so.shippedDate,
        customerName: so.customerName,
        status: so.status,
        totalAmount: so.totalAmount,
      })
      .from(so);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = conds.length ? await q.where(and(...(conds as any))) : await q;
    return result as unknown as SalesReportRow[];
  });

  const normalised = rows.map((r) => ({
    ...r,
    orderDate: r.orderDate ? formatDateFromDb(r.orderDate) : null,
    requiredDate: r.requiredDate ? formatDateFromDb(r.requiredDate) : null,
    shippedDate: r.shippedDate ? formatDateFromDb(r.shippedDate) : null,
    totalAmount: Number(r.totalAmount) || 0,
  }));

  return {
    ...aggregate(normalised, SO_VOID_STATUSES, (r) => ({
      name: r.customerName || '-',
      code: null,
    })),
    rows: normalised.sort((a, b) =>
      String(b.orderDate ?? '').localeCompare(String(a.orderDate ?? '')),
    ),
    generatedAt: new Date().toISOString(),
  };
}
