/**
 * Unified Dashboard Service
 * Aggregates KPIs from all business modules: HR, Purchase, Sales, VMI, GMP
 */

import { isSqlite } from '../db';
import { eq, and, sql, gte, lte, inArray } from 'drizzle-orm';
import { getTableRef, executeDbOperation } from '../db/db-helper';
import { getTodayStr, toQueryDate } from '../db/date-utils';
import { sqliteVmiSyncHistory, mysqlVmiSyncHistory } from '../db/schema';

// ============================================
// Types
// ============================================

export interface HRKpis {
  totalEmployees: number;
  activeEmployees: number;
  trainingCompliance: number; // percentage
  healthRecordsDue: number;
  gmpAuthorized: number;
  pendingNotifications: number;
}

export interface PurchaseKpis {
  pendingPOs: number;
  approvedPOs: number;
  poValueMtd: number;
  activeVendors: number;
  /** Null when not measurable — no actual delivery date is recorded on POs. */
  onTimeDeliveryRate: number | null;
  avlCoverage: number; // percentage
}

export interface SalesKpis {
  pendingSOs: number;
  soValueMtd: number;
  ordersFulfilledMtd: number;
  atpShortages: number;
  fulfillmentRate: number; // percentage
}

export interface VMIKpis {
  vmiItems: number;
  lastSyncTime: string | null;
  stockBelowReorder: number;
  pendingAsns: number;
  outstandingOrderValue: number;
}

export interface GMPKpis {
  /** Sum of the four counts below — a workload figure, NOT a compliance score. */
  openIssues: number;
  openDeviations: number;
  openCapas: number;
  openAuditFindings: number;
  trainingGaps: number;
}

/**
 * Non-terminal statuses — anything not in these lists is finished work.
 * Kept explicit (rather than `!= 'closed'`) so that adding a status to a schema
 * enum forces a deliberate decision here instead of silently changing a
 * GMP-facing count.
 */
const OPEN_DEVIATION_STATUSES = ['open', 'investigating'];
const OPEN_CAPA_STATUSES = [
  'open',
  'investigation',
  'action_pending',
  'verification',
  'pending_approval',
];
const OPEN_FINDING_STATUSES = ['open', 'capa_assigned'];

export interface DashboardModuleKpis {
  hr: HRKpis;
  purchase: PurchaseKpis;
  sales: SalesKpis;
  vmi: VMIKpis;
  gmp: GMPKpis;
  generatedAt: string;
}

// ============================================
// Helper Functions
// ============================================

function getMonthStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/**
 * Get month start for query conditions
 * MySQL requires Date object, SQLite requires ISO string
 */
function getMonthStartForQuery(): Date | string {
  const monthStart = getMonthStart();
  return isSqlite() ? monthStart.toISOString() : monthStart;
}

// ============================================
// HR KPIs
// ============================================

export async function getHRKpis(): Promise<HRKpis> {
  const employeesTable = getTableRef('HREmployees');
  const healthRecordsTable = getTableRef('HRHealthRecords');
  const authorizationsTable = getTableRef('HRAuthorizations');
  const notificationsTable = getTableRef('HRNotifications');
  const trainingRecordsTable = getTableRef('HRTrainingRecords');
  const today = getTodayStr();

  const [
    totalResult,
    activeResult,
    trainingResult,
    healthDueResult,
    authResult,
    notifResult,
  ] = await Promise.all([
    // Total employees
    executeDbOperation(async (db) => {
      const result = await db.select({ count: sql`count(*)` }).from(employeesTable);
      return Number(result[0]?.count || 0);
    }),
    // Active employees
    executeDbOperation(async (db) => {
      const result = await db
        .select({ count: sql`count(*)` })
        .from(employeesTable)
        .where(eq(employeesTable.status, 'active'));
      return Number(result[0]?.count || 0);
    }),
    // Training compliance numerator: count of ACTIVE employees who hold at
    // least one passed training record that is still valid (no expiry, or
    // expiry in the future). Divided by active employees below to get the %.
    executeDbOperation(async (db) => {
      try {
        const result = await db
          .select({
            count: sql`count(DISTINCT ${trainingRecordsTable.employeeId})`,
          })
          .from(trainingRecordsTable)
          .innerJoin(
            employeesTable,
            eq(trainingRecordsTable.employeeId, employeesTable.id)
          )
          .where(
            and(
              eq(employeesTable.status, 'active'),
              eq(trainingRecordsTable.result, 'pass'),
              sql`(${trainingRecordsTable.expiryDate} IS NULL OR ${trainingRecordsTable.expiryDate} > ${toQueryDate(today)})`
            )
          );
        return Number(result[0]?.count || 0);
      } catch {
        return 0; // Table may not exist (e.g. fresh DB)
      }
    }),
    // Health records due (employees with expired or expiring health records)
    executeDbOperation(async (db) => {
      const result = await db
        .select({ count: sql`count(*)` })
        .from(healthRecordsTable)
        .where(
          and(
            eq(healthRecordsTable.fitnessStatus, 'fit'),
            lte(healthRecordsTable.nextExamDue, toQueryDate(today))
          )
        );
      return Number(result[0]?.count || 0);
    }),
    // GMP authorized employees
    executeDbOperation(async (db) => {
      const result = await db
        .select({ count: sql`count(DISTINCT ${authorizationsTable.employeeId})` })
        .from(authorizationsTable)
        .where(eq(authorizationsTable.isActive, true));
      return Number(result[0]?.count || 0);
    }),
    // Pending notifications — computed LIVE from source data, not from
    // pre-generated hr_notifications rows. The notification rows are only
    // created when a cron hits the /check endpoints, so counting them made the
    // card read 0 even when employees were genuinely overdue. Instead we count,
    // right now, the things that warrant attention so the card never silently
    // misses a real event:
    //   • training expired (expiry_date <= today)
    //   • training expiring within 30 days
    //   • health exam due/overdue (next_exam_due <= today)
    //   • GMP authorization expiring within 30 days
    // Any unread hr_notifications rows that DO exist are also included (max with
    // the live count) so a cron-driven setup never under-reports either.
    executeDbOperation(async (db) => {
      const thirtyDaysAhead = new Date();
      thirtyDaysAhead.setDate(thirtyDaysAhead.getDate() + 30);
      const within30 = toQueryDate(thirtyDaysAhead);
      const todayQ = toQueryDate(today);

      const safeCount = async (run: () => Promise<unknown>): Promise<number> => {
        try {
          const r = (await run()) as Array<{ count?: number }>;
          return Number(r[0]?.count || 0);
        } catch {
          return 0; // table may not exist on a fresh DB
        }
      };

      const [trainingDue, healthDue, authExpiring, unreadRows] = await Promise.all([
        // training expired OR expiring within 30 days (passed records only)
        safeCount(() =>
          db
            .select({ count: sql`count(*)` })
            .from(trainingRecordsTable)
            .where(
              and(
                eq(trainingRecordsTable.result, 'pass'),
                sql`${trainingRecordsTable.expiryDate} IS NOT NULL`,
                lte(trainingRecordsTable.expiryDate, within30)
              )
            )
        ),
        // health exams due or overdue
        safeCount(() =>
          db
            .select({ count: sql`count(*)` })
            .from(healthRecordsTable)
            .where(
              and(
                sql`${healthRecordsTable.nextExamDue} IS NOT NULL`,
                lte(healthRecordsTable.nextExamDue, todayQ)
              )
            )
        ),
        // active GMP authorizations expiring within 30 days
        safeCount(() =>
          db
            .select({ count: sql`count(*)` })
            .from(authorizationsTable)
            .where(
              and(
                eq(authorizationsTable.isActive, true),
                sql`${authorizationsTable.effectiveTo} IS NOT NULL`,
                gte(authorizationsTable.effectiveTo, todayQ),
                lte(authorizationsTable.effectiveTo, within30)
              )
            )
        ),
        // any unread pre-generated notification rows
        safeCount(() =>
          db
            .select({ count: sql`count(*)` })
            .from(notificationsTable)
            .where(eq(notificationsTable.isRead, false))
        ),
      ]);

      const liveCount = trainingDue + healthDue + authExpiring;
      return Math.max(liveCount, unreadRows);
    }),
  ]);

  const trainingCompliance = activeResult > 0
    ? Math.round((trainingResult / activeResult) * 100)
    : 0;

  return {
    totalEmployees: totalResult,
    activeEmployees: activeResult,
    trainingCompliance,
    healthRecordsDue: healthDueResult,
    gmpAuthorized: authResult,
    pendingNotifications: notifResult,
  };
}

// ============================================
// Purchase KPIs
// ============================================

export async function getPurchaseKpis(): Promise<PurchaseKpis> {
  const poTable = getTableRef('purchaseOrders');
  const vendorsTable = getTableRef('vendors');
  const avlTable = getTableRef('approvedVendorList');
  const itemsTable = getTableRef('items');
  const monthStart = getMonthStartForQuery();

  const [
    pendingResult,
    approvedResult,
    valueResult,
    vendorResult,
    avlResult,
    itemsResult,
  ] = await Promise.all([
    // Pending POs
    executeDbOperation(async (db) => {
      const result = await db
        .select({ count: sql`count(*)` })
        .from(poTable)
        .where(eq(poTable.status, 'draft'));
      return Number(result[0]?.count || 0);
    }),
    // Approved POs
    executeDbOperation(async (db) => {
      const result = await db
        .select({ count: sql`count(*)` })
        .from(poTable)
        .where(eq(poTable.status, 'approved'));
      return Number(result[0]?.count || 0);
    }),
    // PO Value MTD
    executeDbOperation(async (db) => {
      const result = await db
        .select({ total: sql`COALESCE(SUM(${poTable.totalAmount}), 0)` })
        .from(poTable)
        .where(gte(poTable.createdAt, monthStart));
      return Number(result[0]?.total || 0);
    }),
    // Active vendors
    executeDbOperation(async (db) => {
      const result = await db
        .select({ count: sql`count(*)` })
        .from(vendorsTable)
        .where(eq(vendorsTable.isActive, true));
      return Number(result[0]?.count || 0);
    }),
    // AVL entries count (entries with approval date = approved items)
    executeDbOperation(async (db) => {
      const result = await db
        .select({ count: sql`count(DISTINCT ${avlTable.itemId})` })
        .from(avlTable)
        .where(sql`${avlTable.approvalDate} IS NOT NULL`);
      return Number(result[0]?.count || 0);
    }),
    // Total items count
    executeDbOperation(async (db) => {
      const result = await db
        .select({ count: sql`count(*)` })
        .from(itemsTable)
        .where(eq(itemsTable.isActive, true));
      return Number(result[0]?.count || 0);
    }),
  ]);

  const avlCoverage = itemsResult > 0
    ? Math.round((avlResult / itemsResult) * 100)
    : 0;

  return {
    pendingPOs: pendingResult,
    approvedPOs: approvedResult,
    poValueMtd: valueResult,
    activeVendors: vendorResult,
    // Null, not a number: purchase_orders records an expectedDate but no actual
    // receipt date, so on-time delivery cannot be computed from the data we
    // have. This previously returned a hardcoded 95, which rendered as a green
    // "95%" KPI indistinguishable from a real measurement. Null makes the UI
    // show "—" (no data). To implement for real, capture an actual delivery
    // date on receipt and compare it against expectedDate.
    onTimeDeliveryRate: null,
    avlCoverage,
  };
}

// ============================================
// Sales KPIs
// ============================================

export async function getSalesKpis(): Promise<SalesKpis> {
  const soTable = getTableRef('salesOrders');
  const itemsTable = getTableRef('items');
  const lotsTable = getTableRef('inventoryLots');
  const solTable = getTableRef('salesOrderLines');
  const monthStart = getMonthStartForQuery();

  const [
    pendingResult,
    valueResult,
    fulfilledResult,
    totalOrdersResult,
    atpShortageResult,
  ] = await Promise.all([
    // Pending SOs
    executeDbOperation(async (db) => {
      const result = await db
        .select({ count: sql`count(*)` })
        .from(soTable)
        .where(eq(soTable.status, 'draft'));
      return Number(result[0]?.count || 0);
    }),
    // SO Value MTD
    executeDbOperation(async (db) => {
      const result = await db
        .select({ total: sql`COALESCE(SUM(${soTable.totalAmount}), 0)` })
        .from(soTable)
        .where(gte(soTable.createdAt, monthStart));
      return Number(result[0]?.total || 0);
    }),
    // Orders fulfilled MTD. The sales-order lifecycle uses 'delivered' as the
    // terminal fulfilled state (the orders list counts 'delivered' too) — there
    // is no 'fulfilled' status, so the old query always returned 0.
    executeDbOperation(async (db) => {
      const result = await db
        .select({ count: sql`count(*)` })
        .from(soTable)
        .where(
          and(
            eq(soTable.status, 'delivered'),
            gte(soTable.updatedAt, monthStart)
          )
        );
      return Number(result[0]?.count || 0);
    }),
    // Total orders MTD
    executeDbOperation(async (db) => {
      const result = await db
        .select({ count: sql`count(*)` })
        .from(soTable)
        .where(gte(soTable.createdAt, monthStart));
      return Number(result[0]?.count || 0);
    }),
    // ATP (Available-To-Promise) shortages: count of active items where the
    // open committed demand exceeds what's actually available to promise.
    //   ATP          = items.on_hand − Σ(reserved_quantity across the item's lots)
    //   open demand  = Σ(quantity − shipped_quantity) over lines of sales orders
    //                  that are committed but not yet terminal (exclude draft —
    //                  unconfirmed, and delivered/cancelled — already closed).
    // An item is "short" when open_demand > ATP (and there is demand at all).
    // Correlated subqueries are standard SQL and run on both MySQL and SQLite.
    executeDbOperation(async (db) => {
      const reserved = sql`COALESCE((SELECT SUM(${lotsTable.reservedQuantity}) FROM ${lotsTable} WHERE ${lotsTable.itemId} = ${itemsTable.id}), 0)`;
      const openDemand = sql`COALESCE((SELECT SUM(${solTable.quantity} - ${solTable.shippedQuantity}) FROM ${solTable} INNER JOIN ${soTable} ON ${soTable.id} = ${solTable.soId} WHERE ${solTable.itemId} = ${itemsTable.id} AND ${soTable.status} NOT IN ('delivered', 'cancelled', 'draft')), 0)`;
      const result = await db
        .select({ count: sql`count(*)` })
        .from(itemsTable)
        .where(
          and(
            eq(itemsTable.isActive, true),
            sql`${openDemand} > 0`,
            sql`${openDemand} > (${itemsTable.onHand} - ${reserved})`
          )
        );
      return Number(result[0]?.count || 0);
    }),
  ]);

  const fulfillmentRate = totalOrdersResult > 0
    ? Math.round((fulfilledResult / totalOrdersResult) * 100)
    : 0;

  return {
    pendingSOs: pendingResult,
    soValueMtd: valueResult,
    ordersFulfilledMtd: fulfilledResult,
    atpShortages: atpShortageResult,
    fulfillmentRate,
  };
}

// ============================================
// VMI KPIs
// ============================================

export async function getVMIKpis(): Promise<VMIKpis> {
  const itemsTable = getTableRef('items');
  // getTableRef upper-cases the first letter → resolves to sqlite/mysqlVMIOrders.
  const vmiOrdersTable = getTableRef('vMIOrders');

  // VMI items = items actually flagged for VMI sync (vmiSyncEnabled), not
  // merely "has a reorder point". This is the real VMI-managed catalogue.
  // Note: the VMI flag on an item is `vmiSyncEnabled` — `isVMI` lives on the
  // vendors table, not items.
  const vmiItemsResult = await executeDbOperation(async (db) => {
    const result = await db
      .select({ count: sql`count(*)` })
      .from(itemsTable)
      .where(and(eq(itemsTable.isActive, true), eq(itemsTable.vmiSyncEnabled, true)));
    return Number(result[0]?.count || 0);
  });

  // Below reorder among VMI items. CAST to a number so the comparison is
  // numeric (string columns would compare lexicographically and miscount).
  const belowReorderResult = await executeDbOperation(async (db) => {
    const result = await db
      .select({ count: sql`count(*)` })
      .from(itemsTable)
      .where(
        and(
          eq(itemsTable.isActive, true),
          eq(itemsTable.vmiSyncEnabled, true),
          sql`${itemsTable.reorderPoint} IS NOT NULL`,
          sql`CAST(${itemsTable.onHand} AS REAL) < CAST(${itemsTable.reorderPoint} AS REAL)`
        )
      );
    return Number(result[0]?.count || 0);
  });

  // Pending ASNs = VMI orders shipped by the vendor but not yet received.
  const pendingAsnsResult = await executeDbOperation(async (db) => {
    const result = await db
      .select({ count: sql`count(*)` })
      .from(vmiOrdersTable)
      .where(eq(vmiOrdersTable.status, 'shipped'));
    return Number(result[0]?.count || 0);
  });

  // Outstanding order value = total value of VMI orders not yet received or
  // cancelled (still in flight: submitted/confirmed/shipped).
  const outstandingResult = await executeDbOperation(async (db) => {
    const result = await db
      .select({ total: sql`COALESCE(SUM(${vmiOrdersTable.totalValue}), 0)` })
      .from(vmiOrdersTable)
      .where(sql`${vmiOrdersTable.status} NOT IN ('received', 'cancelled')`);
    return Number(result[0]?.total || 0);
  });

  // Last sync = the most recent COMPLETED VMI sync run, taken from the sync
  // history table. (The old query used MAX(items.lastVmiSyncAt), but the sync
  // flow never writes that column, so the dashboard always showed "never" even
  // after a successful sync. The history table is the source of truth.)
  const syncHistoryTable = isSqlite() ? sqliteVmiSyncHistory : mysqlVmiSyncHistory;
  const lastSyncResult = await executeDbOperation(async (db) => {
    const result = await db
      .select({ last: sql`MAX(${syncHistoryTable.completedAt})` })
      .from(syncHistoryTable)
      .where(eq(syncHistoryTable.status, 'completed'));
    return (result[0]?.last as string | null) ?? null;
  });

  return {
    vmiItems: vmiItemsResult,
    lastSyncTime: lastSyncResult,
    stockBelowReorder: belowReorderResult,
    pendingAsns: pendingAsnsResult,
    outstandingOrderValue: outstandingResult,
  };
}

// ============================================
// GMP KPIs
// ============================================

export async function getGMPKpis(): Promise<GMPKpis> {
  const deviationsTable = getTableRef('deviations');
  const capaTable = getTableRef('capa');
  const auditFindingsTable = getTableRef('auditFindings');
  const trainingRecordsTable = getTableRef('HRTrainingRecords');
  const today = getTodayStr();

  const [
    deviationsResult,
    capasResult,
    findingsResult,
    trainingGapsResult,
  ] = await Promise.all([
    // Unresolved deviations. Counts every status before resolution — a
    // deviation under investigation is still open. Filtering to status='open'
    // alone hid `investigating` records and let the card read "all clear"
    // while investigations were outstanding.
    executeDbOperation(async (db) => {
      const result = await db
        .select({ count: sql`count(*)` })
        .from(deviationsTable)
        .where(inArray(deviationsTable.status, OPEN_DEVIATION_STATUSES));
      return Number(result[0]?.count || 0);
    }),
    // Unresolved CAPAs — every non-terminal state, not just 'open'. A CAPA in
    // action_pending or pending_approval is outstanding work.
    executeDbOperation(async (db) => {
      const result = await db
        .select({ count: sql`count(*)` })
        .from(capaTable)
        .where(inArray(capaTable.status, OPEN_CAPA_STATUSES));
      return Number(result[0]?.count || 0);
    }),
    // Unresolved audit findings. `capa_assigned` is still unremediated — only
    // `closed` is done.
    executeDbOperation(async (db) => {
      const result = await db
        .select({ count: sql`count(*)` })
        .from(auditFindingsTable)
        .where(inArray(auditFindingsTable.status, OPEN_FINDING_STATUSES));
      return Number(result[0]?.count || 0);
    }),
    // Training gaps (expired training)
    executeDbOperation(async (db) => {
      try {
        const result = await db
          .select({ count: sql`count(*)` })
          .from(trainingRecordsTable)
          .where(
            and(
              sql`${trainingRecordsTable.expiryDate} IS NOT NULL`,
              lte(trainingRecordsTable.expiryDate, toQueryDate(today))
            )
          );
        return Number(result[0]?.count || 0);
      } catch {
        return 0;
      }
    }),
  ]);

  // No overall "compliance score" is reported. The previous formula was
  // 100 - (issues * 5): the 5-point weight was invented, tied to no GMP chapter
  // or standard, and returned a perfect 100 on an empty database. Presenting an
  // unfounded number as a GMP compliance score to an inspector is worse than
  // presenting none, so the UI now shows the four counts that ARE measured and
  // omits the score. A real weighted score belongs in
  // compliance-dashboard-service.ts, which scores against actual GMP chapters.
  const openIssues = deviationsResult + capasResult + findingsResult + trainingGapsResult;

  return {
    openIssues,
    openDeviations: deviationsResult,
    openCapas: capasResult,
    openAuditFindings: findingsResult,
    trainingGaps: trainingGapsResult,
  };
}

// ============================================
// Inventory Value KPIs
// ============================================

/**
 * Stock on hand for one item category, as both a count and a baht value.
 *
 * `value` only sums lots that actually carry a unit cost. Lots with a NULL
 * cost contribute their quantity but no value, so `value` is a FLOOR, not the
 * true worth of the stock. `uncostedLots` says how many lots are missing a
 * cost — callers must surface it, otherwise the figure reads as complete when
 * it isn't. Finished-goods lots are routinely uncosted (a lot is only costed
 * once its work order closes and posts a cost), so this gap is normal there
 * and must not be silently rounded away.
 */
export interface StockValue {
  /** Distinct items with stock on hand. */
  items: number;
  /** Lots with quantity > 0. */
  lots: number;
  /** Total quantity across those lots. */
  quantity: number;
  /** Baht value of the costed lots only — a lower bound when uncostedLots > 0. */
  value: number;
  /** Lots counted in `quantity` but excluded from `value` (cost IS NULL). */
  uncostedLots: number;
}

export interface ExpiringStock extends StockValue {
  /** Lots whose expiry date has already passed. */
  expiredLots: number;
  /** Baht value already lost to expiry (costed lots only). */
  expiredValue: number;
}

export interface InventoryValueKpis {
  finishedGoods: StockValue;
  rawMaterials: StockValue;
  packaging: StockValue;
  /** Unexpired stock expiring within the next 30 days. */
  expiringSoon: ExpiringStock;
  generatedAt: string;
}

/** Stock statuses that represent sellable/usable inventory an owner would value. */
const VALUED_LOT_STATUSES = ['quarantine', 'under_test', 'released'] as const;

const EMPTY_STOCK_VALUE: StockValue = {
  items: 0,
  lots: 0,
  quantity: 0,
  value: 0,
  uncostedLots: 0,
};

/**
 * Value the stock on hand for a set of item types.
 *
 * Excludes `rejected` and `blocked` lots — that stock is awaiting disposal and
 * carrying it as inventory value would overstate the balance sheet. Also
 * excludes zero-quantity lots, which are fully consumed and would otherwise
 * inflate the lot count.
 */
async function getStockValueForTypes(types: string[]): Promise<StockValue> {
  const itemsTable = getTableRef('items');
  const lotsTable = getTableRef('inventoryLots');

  return executeDbOperation(async (db) => {
    const result = await db
      .select({
        items: sql<number>`COUNT(DISTINCT ${lotsTable.itemId})`,
        lots: sql<number>`COUNT(*)`,
        quantity: sql<number>`COALESCE(SUM(${lotsTable.quantity}), 0)`,
        // COALESCE inside SUM, not outside: a NULL-cost lot must contribute 0
        // to the value rather than poisoning the whole SUM to NULL.
        value: sql<number>`COALESCE(SUM(${lotsTable.quantity} * COALESCE(${lotsTable.cost}, 0)), 0)`,
        uncostedLots: sql<number>`COALESCE(SUM(CASE WHEN ${lotsTable.cost} IS NULL THEN 1 ELSE 0 END), 0)`,
      })
      .from(lotsTable)
      .innerJoin(itemsTable, eq(itemsTable.id, lotsTable.itemId))
      .where(
        and(
          inArray(itemsTable.type, types),
          inArray(lotsTable.status, [...VALUED_LOT_STATUSES]),
          sql`${lotsTable.quantity} > 0`
        )
      );

    const row = result[0];
    if (!row) return { ...EMPTY_STOCK_VALUE };

    return {
      items: Number(row.items) || 0,
      lots: Number(row.lots) || 0,
      quantity: Number(row.quantity) || 0,
      value: Number(row.value) || 0,
      uncostedLots: Number(row.uncostedLots) || 0,
    };
  });
}

/**
 * Stock at risk from expiry: already-expired lots, plus lots expiring within
 * the next 30 days. Reports the baht value at stake, not just a lot count —
 * "8 lots expiring" tells an owner nothing about whether that is ฿800 or ฿800k.
 *
 * The two windows are disjoint: a lot is counted as expired OR expiring-soon,
 * never both.
 */
async function getExpiringStock(): Promise<ExpiringStock> {
  const lotsTable = getTableRef('inventoryLots');

  return executeDbOperation(async (db) => {
    const todayStr = getTodayStr();
    const thirtyDaysAhead = new Date();
    thirtyDaysAhead.setDate(thirtyDaysAhead.getDate() + 30);

    const today = toQueryDate(todayStr);
    const horizon = toQueryDate(thirtyDaysAhead);

    const costedValue = sql`${lotsTable.quantity} * COALESCE(${lotsTable.cost}, 0)`;

    const result = await db
      .select({
        // Expiring soon: [today, today+30]
        items: sql<number>`COUNT(DISTINCT CASE WHEN ${lotsTable.expiryDate} >= ${today} THEN ${lotsTable.itemId} END)`,
        lots: sql<number>`COALESCE(SUM(CASE WHEN ${lotsTable.expiryDate} >= ${today} THEN 1 ELSE 0 END), 0)`,
        quantity: sql<number>`COALESCE(SUM(CASE WHEN ${lotsTable.expiryDate} >= ${today} THEN ${lotsTable.quantity} ELSE 0 END), 0)`,
        value: sql<number>`COALESCE(SUM(CASE WHEN ${lotsTable.expiryDate} >= ${today} THEN ${costedValue} ELSE 0 END), 0)`,
        uncostedLots: sql<number>`COALESCE(SUM(CASE WHEN ${lotsTable.expiryDate} >= ${today} AND ${lotsTable.cost} IS NULL THEN 1 ELSE 0 END), 0)`,
        // Already expired: expiry < today
        expiredLots: sql<number>`COALESCE(SUM(CASE WHEN ${lotsTable.expiryDate} < ${today} THEN 1 ELSE 0 END), 0)`,
        expiredValue: sql<number>`COALESCE(SUM(CASE WHEN ${lotsTable.expiryDate} < ${today} THEN ${costedValue} ELSE 0 END), 0)`,
      })
      .from(lotsTable)
      .where(
        and(
          inArray(lotsTable.status, [...VALUED_LOT_STATUSES]),
          sql`${lotsTable.quantity} > 0`,
          sql`${lotsTable.expiryDate} IS NOT NULL`,
          lte(lotsTable.expiryDate, horizon)
        )
      );

    const row = result[0];
    if (!row) {
      return { ...EMPTY_STOCK_VALUE, expiredLots: 0, expiredValue: 0 };
    }

    return {
      items: Number(row.items) || 0,
      lots: Number(row.lots) || 0,
      quantity: Number(row.quantity) || 0,
      value: Number(row.value) || 0,
      uncostedLots: Number(row.uncostedLots) || 0,
      expiredLots: Number(row.expiredLots) || 0,
      expiredValue: Number(row.expiredValue) || 0,
    };
  });
}

/**
 * Stock on hand broken down by category, with baht values — what an owner
 * needs to answer "what is sitting in my warehouse and what is it worth".
 */
export async function getInventoryValueKpis(): Promise<InventoryValueKpis> {
  const [finishedGoods, rawMaterials, packaging, expiringSoon] = await Promise.all([
    getStockValueForTypes(['finished_goods']),
    getStockValueForTypes(['raw_material']),
    getStockValueForTypes(['packaging']),
    getExpiringStock(),
  ]);

  return {
    finishedGoods,
    rawMaterials,
    packaging,
    expiringSoon,
    generatedAt: new Date().toISOString(),
  };
}

// ============================================
// Main Aggregation Function
// ============================================

export async function getDashboardModuleKpis(): Promise<DashboardModuleKpis> {
  const [hr, purchase, sales, vmi, gmp] = await Promise.all([
    getHRKpis(),
    getPurchaseKpis(),
    getSalesKpis(),
    getVMIKpis(),
    getGMPKpis(),
  ]);

  return {
    hr,
    purchase,
    sales,
    vmi,
    gmp,
    generatedAt: new Date().toISOString(),
  };
}
