/**
 * Audit Dashboard Service
 * Feature: 009-gmp-compliance-gap-analysis Phase 2 (US11)
 *
 * Provides 8 KPI metrics for external auditor review:
 * - FR-047: RM Received YTD
 * - FR-048: RM Status Breakdown
 * - FR-049: Expiry Alerts
 * - FR-050: Min Stock Alerts
 * - FR-051: QC Summary
 * - FR-052: Production Status
 * - FR-053: Pending QC Release
 * - FR-054: FG Approved YTD
 */

import { getTableRef, executeDbOperation } from '../db/db-helper';
import { isSqlite } from '../db';
import { eq, and, gte, lte, count, sum, sql, inArray } from 'drizzle-orm';

// ============================================
// Types
// ============================================

export interface AuditKpis {
  rmReceivedYtd: RmReceivedYtd;
  rmStatusBreakdown: RmStatusBreakdown;
  expiryAlerts: ExpiryAlerts;
  minStockAlerts: MinStockAlerts;
  qcSummary: QcSummary;
  productionStatus: ProductionStatus;
  pendingQcRelease: PendingQcRelease;
  fgApproved: FgApproved;
  generatedAt: string;
}

export interface RmReceivedYtd {
  totalLots: number;
  totalQuantity: number;
  byMonth: { month: string; lots: number; quantity: number }[];
}

export interface RmStatusBreakdown {
  quarantine: number;
  underTest: number;
  released: number;
  rejected: number;
  blocked: number;
  total: number;
}

export interface ExpiryAlerts {
  expired: number;
  expiringSoon: number; // Within 30 days
  expiringWarning: number; // Within 90 days
  items: { lotId: number; lotNumber: string; itemName: string; expiryDate: string; daysUntilExpiry: number }[];
}

export interface MinStockAlerts {
  criticalCount: number; // Below min stock
  warningCount: number; // Below reorder point
  items: { itemId: number; itemCode: string; itemName: string; onHand: number; minStock: number; reorderPoint: number | null }[];
}

export interface QcSummary {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  pendingTests: number;
  passRate: number;
  byTestType: { testType: string; passed: number; failed: number; pending: number }[];
}

export interface ProductionStatus {
  planned: number;
  released: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  total: number;
  completionRate: number;
}

export interface PendingQcRelease {
  count: number;
  items: { lotId: number; lotNumber: string; itemName: string; testDate: string; daysWaiting: number }[];
}

export interface FgApproved {
  totalBatches: number;
  totalQuantity: number;
  byMonth: { month: string; batches: number; quantity: number }[];
}

// ============================================
// Helper Functions
// ============================================

function getYearStart(): string {
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  return isSqlite() ? yearStart.toISOString() : yearStart.toISOString().slice(0, 19).replace('T', ' ');
}

function getToday(): string {
  const now = new Date();
  return isSqlite() ? now.toISOString() : now.toISOString().slice(0, 19).replace('T', ' ');
}

function addDays(date: Date, days: number): string {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return isSqlite() ? result.toISOString() : result.toISOString().slice(0, 19).replace('T', ' ');
}

// ============================================
// T031: FR-047 RM Received YTD
// ============================================

export async function getRmReceivedYtd(): Promise<RmReceivedYtd> {
  const lotsTable = getTableRef('inventoryLots');
  const itemsTable = getTableRef('items');
  const yearStart = getYearStart();

  // Get raw materials (type = 'raw_material' or 'material')
  const rawMaterialTypes = ['raw_material', 'material', 'packaging'];

  // Get YTD total
  const totals = await executeDbOperation(async (db) => {
    return db
      .select({
        totalLots: count(),
        totalQuantity: sum(lotsTable.quantity),
      })
      .from(lotsTable)
      .innerJoin(itemsTable, eq(lotsTable.itemId, itemsTable.id))
      .where(
        and(
          gte(lotsTable.receivedDate, yearStart),
          inArray(itemsTable.type, rawMaterialTypes)
        )
      );
  });

  // Get by month
  const byMonthData = await executeDbOperation(async (db) => {
    return db
      .select({
        month: isSqlite()
          ? sql<string>`strftime('%Y-%m', ${lotsTable.receivedDate})`
          : sql<string>`DATE_FORMAT(${lotsTable.receivedDate}, '%Y-%m')`,
        lots: count(),
        quantity: sum(lotsTable.quantity),
      })
      .from(lotsTable)
      .innerJoin(itemsTable, eq(lotsTable.itemId, itemsTable.id))
      .where(
        and(
          gte(lotsTable.receivedDate, yearStart),
          inArray(itemsTable.type, rawMaterialTypes)
        )
      )
      .groupBy(
        isSqlite()
          ? sql`strftime('%Y-%m', ${lotsTable.receivedDate})`
          : sql`DATE_FORMAT(${lotsTable.receivedDate}, '%Y-%m')`
      )
      .orderBy(
        isSqlite()
          ? sql`strftime('%Y-%m', ${lotsTable.receivedDate})`
          : sql`DATE_FORMAT(${lotsTable.receivedDate}, '%Y-%m')`
      );
  });

  return {
    totalLots: totals[0]?.totalLots || 0,
    totalQuantity: Number(totals[0]?.totalQuantity) || 0,
    byMonth: byMonthData.map((m: { month: string; lots: number; quantity: string | number | null }) => ({
      month: m.month,
      lots: m.lots,
      quantity: Number(m.quantity) || 0,
    })),
  };
}

// ============================================
// T032: FR-048 RM Status Breakdown
// ============================================

export async function getRmStatusBreakdown(): Promise<RmStatusBreakdown> {
  const lotsTable = getTableRef('inventoryLots');
  const itemsTable = getTableRef('items');
  const rawMaterialTypes = ['raw_material', 'material', 'packaging'];

  const statusCounts = await executeDbOperation(async (db) => {
    return db
      .select({
        status: lotsTable.status,
        count: count(),
      })
      .from(lotsTable)
      .innerJoin(itemsTable, eq(lotsTable.itemId, itemsTable.id))
      .where(inArray(itemsTable.type, rawMaterialTypes))
      .groupBy(lotsTable.status);
  });

  const breakdown: RmStatusBreakdown = {
    quarantine: 0,
    underTest: 0,
    released: 0,
    rejected: 0,
    blocked: 0,
    total: 0,
  };

  for (const row of statusCounts) {
    const cnt = row.count;
    breakdown.total += cnt;
    switch (row.status) {
      case 'quarantine':
        breakdown.quarantine = cnt;
        break;
      case 'under_test':
        breakdown.underTest = cnt;
        break;
      case 'released':
        breakdown.released = cnt;
        break;
      case 'rejected':
        breakdown.rejected = cnt;
        break;
      case 'blocked':
        breakdown.blocked = cnt;
        break;
    }
  }

  return breakdown;
}

// ============================================
// T033: FR-049 Expiry Alerts
// ============================================

export async function getExpiryAlerts(): Promise<ExpiryAlerts> {
  const lotsTable = getTableRef('inventoryLots');
  const itemsTable = getTableRef('items');
  const today = new Date();
  const todayStr = getToday();
  const thirtyDays = addDays(today, 30);
  const ninetyDays = addDays(today, 90);

  // Get counts by expiry category
  const expired = await executeDbOperation(async (db) => {
    return db
      .select({ count: count() })
      .from(lotsTable)
      .where(lte(lotsTable.expiryDate, todayStr));
  });

  const expiringSoon = await executeDbOperation(async (db) => {
    return db
      .select({ count: count() })
      .from(lotsTable)
      .where(
        and(
          gte(lotsTable.expiryDate, todayStr),
          lte(lotsTable.expiryDate, thirtyDays)
        )
      );
  });

  const expiringWarning = await executeDbOperation(async (db) => {
    return db
      .select({ count: count() })
      .from(lotsTable)
      .where(
        and(
          gte(lotsTable.expiryDate, thirtyDays),
          lte(lotsTable.expiryDate, ninetyDays)
        )
      );
  });

  // Get list of items expiring in 30 days (most urgent)
  const expiringItems = await executeDbOperation(async (db) => {
    return db
      .select({
        lotId: lotsTable.id,
        lotNumber: lotsTable.lotNumber,
        itemName: itemsTable.nameTh,
        expiryDate: lotsTable.expiryDate,
      })
      .from(lotsTable)
      .innerJoin(itemsTable, eq(lotsTable.itemId, itemsTable.id))
      .where(lte(lotsTable.expiryDate, thirtyDays))
      .orderBy(lotsTable.expiryDate)
      .limit(20);
  });

  return {
    expired: expired[0]?.count || 0,
    expiringSoon: expiringSoon[0]?.count || 0,
    expiringWarning: expiringWarning[0]?.count || 0,
    items: expiringItems.map((item: { lotId: number; lotNumber: string; itemName: string; expiryDate: string | Date }) => {
      const expiryDate = typeof item.expiryDate === 'string' ? new Date(item.expiryDate) : item.expiryDate;
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return {
        lotId: item.lotId,
        lotNumber: item.lotNumber,
        itemName: item.itemName,
        expiryDate: typeof item.expiryDate === 'string' ? item.expiryDate : item.expiryDate.toISOString(),
        daysUntilExpiry,
      };
    }),
  };
}

// ============================================
// T034: FR-050 Min Stock Alerts
// ============================================

export async function getMinStockAlerts(): Promise<MinStockAlerts> {
  const itemsTable = getTableRef('items');

  // Get items below min stock
  const criticalItems = await executeDbOperation(async (db) => {
    return db
      .select({
        itemId: itemsTable.id,
        itemCode: itemsTable.code,
        itemName: itemsTable.nameTh,
        onHand: itemsTable.onHand,
        minStock: itemsTable.minStock,
        reorderPoint: itemsTable.reorderPoint,
      })
      .from(itemsTable)
      .where(
        and(
          sql`${itemsTable.minStock} IS NOT NULL`,
          sql`${itemsTable.onHand} < ${itemsTable.minStock}`
        )
      );
  });

  // Get items below reorder point but above min stock
  const warningItems = await executeDbOperation(async (db) => {
    return db
      .select({
        itemId: itemsTable.id,
        itemCode: itemsTable.code,
        itemName: itemsTable.nameTh,
        onHand: itemsTable.onHand,
        minStock: itemsTable.minStock,
        reorderPoint: itemsTable.reorderPoint,
      })
      .from(itemsTable)
      .where(
        and(
          sql`${itemsTable.reorderPoint} IS NOT NULL`,
          sql`${itemsTable.onHand} < ${itemsTable.reorderPoint}`,
          sql`${itemsTable.onHand} >= COALESCE(${itemsTable.minStock}, 0)`
        )
      );
  });

  const allItems = [...criticalItems, ...warningItems].map((item: { itemId: number; itemCode: string; itemName: string; onHand: number | string; minStock: number | string | null; reorderPoint: number | string | null }) => ({
    itemId: item.itemId,
    itemCode: item.itemCode,
    itemName: item.itemName,
    onHand: Number(item.onHand) || 0,
    minStock: Number(item.minStock) || 0,
    reorderPoint: item.reorderPoint ? Number(item.reorderPoint) : null,
  }));

  return {
    criticalCount: criticalItems.length,
    warningCount: warningItems.length,
    items: allItems.slice(0, 20), // Limit to 20 items
  };
}

// ============================================
// T035: FR-051 QC Summary
// ============================================

export async function getQcSummary(): Promise<QcSummary> {
  const testsTable = getTableRef('qualityTests');
  const yearStart = getYearStart();

  // Get overall counts
  const overallCounts = await executeDbOperation(async (db) => {
    return db
      .select({
        status: testsTable.status,
        count: count(),
      })
      .from(testsTable)
      .where(gte(testsTable.createdAt, yearStart))
      .groupBy(testsTable.status);
  });

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  let pendingTests = 0;

  for (const row of overallCounts) {
    totalTests += row.count;
    switch (row.status) {
      case 'pass':
        passedTests = row.count;
        break;
      case 'fail':
        failedTests = row.count;
        break;
      case 'pending':
      case 'retest':
        pendingTests += row.count;
        break;
    }
  }

  const passRate = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;

  // Get by test type
  const byTypeData = await executeDbOperation(async (db) => {
    return db
      .select({
        testType: testsTable.testType,
        status: testsTable.status,
        count: count(),
      })
      .from(testsTable)
      .where(gte(testsTable.createdAt, yearStart))
      .groupBy(testsTable.testType, testsTable.status);
  });

  // Aggregate by test type
  const typeMap = new Map<string, { passed: number; failed: number; pending: number }>();
  for (const row of byTypeData) {
    const type = row.testType || 'unknown';
    if (!typeMap.has(type)) {
      typeMap.set(type, { passed: 0, failed: 0, pending: 0 });
    }
    const entry = typeMap.get(type)!;
    switch (row.status) {
      case 'pass':
        entry.passed += row.count;
        break;
      case 'fail':
        entry.failed += row.count;
        break;
      default:
        entry.pending += row.count;
    }
  }

  const byTestType = Array.from(typeMap.entries()).map(([testType, counts]) => ({
    testType,
    ...counts,
  }));

  return {
    totalTests,
    passedTests,
    failedTests,
    pendingTests,
    passRate,
    byTestType,
  };
}

// ============================================
// T036: FR-052 Production Status
// ============================================

export async function getProductionStatus(): Promise<ProductionStatus> {
  const workOrdersTable = getTableRef('workOrders');
  const yearStart = getYearStart();

  const statusCounts = await executeDbOperation(async (db) => {
    return db
      .select({
        status: workOrdersTable.status,
        count: count(),
      })
      .from(workOrdersTable)
      .where(gte(workOrdersTable.createdAt, yearStart))
      .groupBy(workOrdersTable.status);
  });

  const result: ProductionStatus = {
    planned: 0,
    released: 0,
    inProgress: 0,
    completed: 0,
    cancelled: 0,
    total: 0,
    completionRate: 0,
  };

  for (const row of statusCounts) {
    result.total += row.count;
    switch (row.status) {
      case 'planned':
        result.planned = row.count;
        break;
      case 'released':
        result.released = row.count;
        break;
      case 'in_progress':
        result.inProgress = row.count;
        break;
      case 'completed':
        result.completed = row.count;
        break;
      case 'cancelled':
        result.cancelled = row.count;
        break;
    }
  }

  const nonCancelledTotal = result.total - result.cancelled;
  result.completionRate = nonCancelledTotal > 0
    ? Math.round((result.completed / nonCancelledTotal) * 100)
    : 0;

  return result;
}

// ============================================
// T037: FR-053 Pending QC Release
// ============================================

export async function getPendingQcRelease(): Promise<PendingQcRelease> {
  const lotsTable = getTableRef('inventoryLots');
  const itemsTable = getTableRef('items');
  const testsTable = getTableRef('qualityTests');
  const today = new Date();

  // Get lots under test that have completed tests but not released
  const pendingLots = await executeDbOperation(async (db) => {
    return db
      .select({
        lotId: lotsTable.id,
        lotNumber: lotsTable.lotNumber,
        itemName: itemsTable.nameTh,
        testDate: testsTable.testDate,
      })
      .from(lotsTable)
      .innerJoin(itemsTable, eq(lotsTable.itemId, itemsTable.id))
      .leftJoin(testsTable, eq(testsTable.lotId, lotsTable.id))
      .where(eq(lotsTable.status, 'under_test'))
      .limit(20);
  });

  return {
    count: pendingLots.length,
    items: pendingLots.map((lot: { lotId: number; lotNumber: string; itemName: string; testDate: string | Date | null }) => {
      const testDate = lot.testDate
        ? (typeof lot.testDate === 'string' ? new Date(lot.testDate) : lot.testDate)
        : today;
      const daysWaiting = Math.ceil((today.getTime() - testDate.getTime()) / (1000 * 60 * 60 * 24));
      return {
        lotId: lot.lotId,
        lotNumber: lot.lotNumber,
        itemName: lot.itemName,
        testDate: lot.testDate
          ? (typeof lot.testDate === 'string' ? lot.testDate : lot.testDate.toISOString())
          : today.toISOString(),
        daysWaiting: Math.max(0, daysWaiting),
      };
    }),
  };
}

// ============================================
// T038: FR-054 FG Approved YTD
// ============================================

export async function getFgApproved(): Promise<FgApproved> {
  const lotsTable = getTableRef('inventoryLots');
  const itemsTable = getTableRef('items');
  const yearStart = getYearStart();
  const finishedGoodTypes = ['finished_good', 'product'];

  // Get YTD totals
  const totals = await executeDbOperation(async (db) => {
    return db
      .select({
        totalBatches: count(),
        totalQuantity: sum(lotsTable.quantity),
      })
      .from(lotsTable)
      .innerJoin(itemsTable, eq(lotsTable.itemId, itemsTable.id))
      .where(
        and(
          eq(lotsTable.status, 'released'),
          gte(lotsTable.updatedAt, yearStart),
          inArray(itemsTable.type, finishedGoodTypes)
        )
      );
  });

  // Get by month
  const byMonthData = await executeDbOperation(async (db) => {
    return db
      .select({
        month: isSqlite()
          ? sql<string>`strftime('%Y-%m', ${lotsTable.updatedAt})`
          : sql<string>`DATE_FORMAT(${lotsTable.updatedAt}, '%Y-%m')`,
        batches: count(),
        quantity: sum(lotsTable.quantity),
      })
      .from(lotsTable)
      .innerJoin(itemsTable, eq(lotsTable.itemId, itemsTable.id))
      .where(
        and(
          eq(lotsTable.status, 'released'),
          gte(lotsTable.updatedAt, yearStart),
          inArray(itemsTable.type, finishedGoodTypes)
        )
      )
      .groupBy(
        isSqlite()
          ? sql`strftime('%Y-%m', ${lotsTable.updatedAt})`
          : sql`DATE_FORMAT(${lotsTable.updatedAt}, '%Y-%m')`
      )
      .orderBy(
        isSqlite()
          ? sql`strftime('%Y-%m', ${lotsTable.updatedAt})`
          : sql`DATE_FORMAT(${lotsTable.updatedAt}, '%Y-%m')`
      );
  });

  return {
    totalBatches: totals[0]?.totalBatches || 0,
    totalQuantity: Number(totals[0]?.totalQuantity) || 0,
    byMonth: byMonthData.map((m: { month: string; batches: number; quantity: string | number | null }) => ({
      month: m.month,
      batches: m.batches,
      quantity: Number(m.quantity) || 0,
    })),
  };
}

// ============================================
// T030: Main Aggregation Function
// ============================================

/**
 * Get all 8 audit KPIs in a single call
 * This is the main function called by the API endpoint
 */
export async function getAuditKpis(): Promise<AuditKpis> {
  // Execute all KPI queries in parallel for performance
  const [
    rmReceivedYtd,
    rmStatusBreakdown,
    expiryAlerts,
    minStockAlerts,
    qcSummary,
    productionStatus,
    pendingQcRelease,
    fgApproved,
  ] = await Promise.all([
    getRmReceivedYtd(),
    getRmStatusBreakdown(),
    getExpiryAlerts(),
    getMinStockAlerts(),
    getQcSummary(),
    getProductionStatus(),
    getPendingQcRelease(),
    getFgApproved(),
  ]);

  return {
    rmReceivedYtd,
    rmStatusBreakdown,
    expiryAlerts,
    minStockAlerts,
    qcSummary,
    productionStatus,
    pendingQcRelease,
    fgApproved,
    generatedAt: new Date().toISOString(),
  };
}
