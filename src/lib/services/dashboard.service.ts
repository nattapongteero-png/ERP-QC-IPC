/**
 * Unified Dashboard Service
 * Aggregates KPIs from all business modules: HR, Purchase, Sales, VMI, GMP
 */

import { isSqlite } from '../db';
import { eq, and, sql, gte, lte } from 'drizzle-orm';
import { getTableRef, executeDbOperation } from '../db/db-helper';
import { getTodayStr, toQueryDate } from '../db/date-utils';

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
  onTimeDeliveryRate: number;
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
  overallScore: number;
  openDeviations: number;
  openCapas: number;
  openAuditFindings: number;
  trainingGaps: number;
}

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
    onTimeDeliveryRate: 95, // Placeholder - would require delivery tracking
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

  // VMI items = items actually flagged for VMI (isVMI), not merely "has a
  // reorder point". This is the real VMI-managed catalogue.
  const vmiItemsResult = await executeDbOperation(async (db) => {
    const result = await db
      .select({ count: sql`count(*)` })
      .from(itemsTable)
      .where(and(eq(itemsTable.isActive, true), eq(itemsTable.isVMI, true)));
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
          eq(itemsTable.isVMI, true),
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

  // Last sync = most recent per-item VMI sync timestamp.
  const lastSyncResult = await executeDbOperation(async (db) => {
    const result = await db
      .select({ last: sql`MAX(${itemsTable.lastVmiSyncAt})` })
      .from(itemsTable)
      .where(eq(itemsTable.isVMI, true));
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
    // Open deviations
    executeDbOperation(async (db) => {
      const result = await db
        .select({ count: sql`count(*)` })
        .from(deviationsTable)
        .where(eq(deviationsTable.status, 'open'));
      return Number(result[0]?.count || 0);
    }),
    // Open CAPAs
    executeDbOperation(async (db) => {
      try {
        const result = await db
          .select({ count: sql`count(*)` })
          .from(capaTable)
          .where(eq(capaTable.status, 'open'));
        return Number(result[0]?.count || 0);
      } catch {
        return 0; // Table may not exist
      }
    }),
    // Open audit findings
    executeDbOperation(async (db) => {
      try {
        const result = await db
          .select({ count: sql`count(*)` })
          .from(auditFindingsTable)
          .where(eq(auditFindingsTable.status, 'open'));
        return Number(result[0]?.count || 0);
      } catch {
        return 0; // Table may not exist
      }
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

  // Calculate overall compliance score (simplified)
  const totalIssues = deviationsResult + capasResult + findingsResult + trainingGapsResult;
  const overallScore = totalIssues === 0 ? 100 : Math.max(0, 100 - (totalIssues * 5));

  return {
    overallScore,
    openDeviations: deviationsResult,
    openCapas: capasResult,
    openAuditFindings: findingsResult,
    trainingGaps: trainingGapsResult,
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
