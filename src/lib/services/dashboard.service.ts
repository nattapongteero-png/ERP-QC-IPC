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
    // Pending notifications
    executeDbOperation(async (db) => {
      const result = await db
        .select({ count: sql`count(*)` })
        .from(notificationsTable)
        .where(eq(notificationsTable.isRead, false));
      return Number(result[0]?.count || 0);
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
  const monthStart = getMonthStartForQuery();

  const [
    pendingResult,
    valueResult,
    fulfilledResult,
    totalOrdersResult,
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
    // Orders fulfilled MTD
    executeDbOperation(async (db) => {
      const result = await db
        .select({ count: sql`count(*)` })
        .from(soTable)
        .where(
          and(
            eq(soTable.status, 'fulfilled'),
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
  ]);

  const fulfillmentRate = totalOrdersResult > 0
    ? Math.round((fulfilledResult / totalOrdersResult) * 100)
    : 0;

  return {
    pendingSOs: pendingResult,
    soValueMtd: valueResult,
    ordersFulfilledMtd: fulfilledResult,
    atpShortages: 0, // Would require ATP calculation
    fulfillmentRate,
  };
}

// ============================================
// VMI KPIs
// ============================================

export async function getVMIKpis(): Promise<VMIKpis> {
  const itemsTable = getTableRef('items');

  // VMI is external portal integration - provide basic metrics
  const vmiItemsResult = await executeDbOperation(async (db) => {
    // Items that have VMI vendor mapping would have reorderPoint set
    const result = await db
      .select({ count: sql`count(*)` })
      .from(itemsTable)
      .where(
        and(
          eq(itemsTable.isActive, true),
          sql`${itemsTable.reorderPoint} IS NOT NULL`
        )
      );
    return Number(result[0]?.count || 0);
  });

  const belowReorderResult = await executeDbOperation(async (db) => {
    const result = await db
      .select({ count: sql`count(*)` })
      .from(itemsTable)
      .where(
        and(
          sql`${itemsTable.reorderPoint} IS NOT NULL`,
          sql`${itemsTable.onHand} < ${itemsTable.reorderPoint}`
        )
      );
    return Number(result[0]?.count || 0);
  });

  return {
    vmiItems: vmiItemsResult,
    lastSyncTime: null, // Would come from VMI sync logs
    stockBelowReorder: belowReorderResult,
    pendingAsns: 0, // Would require ASN tracking
    outstandingOrderValue: 0, // Would require VMI order tracking
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
