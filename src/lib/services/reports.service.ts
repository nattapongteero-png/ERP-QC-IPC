/**
 * Reports Service
 * Real-world reporting with traceability, analytics, and GMP compliance reports
 */

import { getDb, isSqlite } from '../db';
import { toDateSafe } from '../db/date-utils';
import { eq, and, sql, desc, asc, gte, lte, or } from 'drizzle-orm';
import {
  sqliteItems,
  sqliteInventoryLots,
  sqliteInventoryTransactions,
  sqliteWorkOrders,
  sqliteQualityTests,
  sqliteDeviations,
  sqlitePurchaseOrders,
  sqliteSalesOrders,
  sqliteVendors,
  sqliteReportExecutions,
  sqliteReportTemplates,
  mysqlItems,
  mysqlInventoryLots,
  mysqlInventoryTransactions,
  mysqlWorkOrders,
  mysqlQualityTests,
  mysqlDeviations,
  mysqlPurchaseOrders,
  mysqlSalesOrders,
  mysqlVendors,
  mysqlReportExecutions,
  mysqlReportTemplates,
} from '../db/schema';
import { traceForward, traceBackward } from './inventory.service';
import { calculateYield } from './production.service';
import { generateCOA, getDeviationStatistics } from './quality.service';

// Get table references
function getTables() {
  if (isSqlite()) {
    return {
      items: sqliteItems,
      lots: sqliteInventoryLots,
      transactions: sqliteInventoryTransactions,
      workOrders: sqliteWorkOrders,
      tests: sqliteQualityTests,
      deviations: sqliteDeviations,
      purchaseOrders: sqlitePurchaseOrders,
      salesOrders: sqliteSalesOrders,
      vendors: sqliteVendors,
      customers: sqliteVendors,
      reportExecutions: sqliteReportExecutions,
      reportTemplates: sqliteReportTemplates,
    };
  }
  return {
    items: mysqlItems,
    lots: mysqlInventoryLots,
    transactions: mysqlInventoryTransactions,
    workOrders: mysqlWorkOrders,
    tests: mysqlQualityTests,
    deviations: mysqlDeviations,
    purchaseOrders: mysqlPurchaseOrders,
    salesOrders: mysqlSalesOrders,
    vendors: mysqlVendors,
    customers: mysqlVendors,
    reportExecutions: mysqlReportExecutions,
    reportTemplates: mysqlReportTemplates,
  };
}

/**
 * Inventory Valuation Report
 */
export async function getInventoryValuationReport(): Promise<{
  totalValue: number;
  byCategory: Array<{ category: string; quantity: number; value: number }>;
  byStatus: Array<{ status: string; quantity: number; value: number }>;
  items: Array<{ itemCode: string; itemName: string; quantity: number; unit: string; unitCost: number; totalValue: number }>;
}> {
  const { items, lots } = getTables();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  const inventoryData = await database
    .select({
      itemId: lots.itemId,
      itemCode: items.code,
      itemName: items.nameEn,
      category: items.category,
      unit: items.primaryUnit,
      status: lots.status,
      quantity: sql<number>`COALESCE(SUM(${lots.quantity}), 0)`,
    })
    .from(lots)
    .innerJoin(items, eq(lots.itemId, items.id))
    .where(sql`${lots.quantity} > 0`)
    .groupBy(lots.itemId, items.code, items.nameEn, items.category, items.primaryUnit, lots.status);

  // Simplified - in real implementation, would use actual cost from transactions
  const unitCost = 100; // Default unit cost

  const byCategory = new Map<string, { quantity: number; value: number }>();
  const byStatus = new Map<string, { quantity: number; value: number }>();
  const itemSummary = new Map<number, { code: string; name: string; quantity: number; unit: string; value: number }>();
  let totalValue = 0;

  for (const row of inventoryData) {
    const qty = Number(row.quantity) || 0;
    const value = qty * unitCost;
    totalValue += value;

    // By category
    const cat = row.category || 'Uncategorized';
    const catData = byCategory.get(cat) || { quantity: 0, value: 0 };
    catData.quantity += qty;
    catData.value += value;
    byCategory.set(cat, catData);

    // By status
    const statusData = byStatus.get(row.status) || { quantity: 0, value: 0 };
    statusData.quantity += qty;
    statusData.value += value;
    byStatus.set(row.status, statusData);

    // By item
    const itemData = itemSummary.get(row.itemId) || { code: row.itemCode, name: row.itemName || row.itemCode, quantity: 0, unit: row.unit, value: 0 };
    itemData.quantity += qty;
    itemData.value += value;
    itemSummary.set(row.itemId, itemData);
  }

  return {
    totalValue,
    byCategory: Array.from(byCategory.entries()).map(([category, data]) => ({ category, ...data })),
    byStatus: Array.from(byStatus.entries()).map(([status, data]) => ({ status, ...data })),
    items: Array.from(itemSummary.values()).map((item: any) => ({
      itemCode: item.code,
      itemName: item.name,
      quantity: item.quantity,
      unit: item.unit,
      unitCost,
      totalValue: item.value,
    })),
  };
}

/**
 * Expiry Report
 */
export async function getExpiryReport(daysThreshold: number = 90): Promise<{
  expired: Array<{ lotNumber: string; itemCode: string; itemName: string; quantity: number; expiryDate: string; daysExpired: number }>;
  nearExpiry: Array<{ lotNumber: string; itemCode: string; itemName: string; quantity: number; expiryDate: string; daysToExpiry: number }>;
  summary: { expiredCount: number; expiredValue: number; nearExpiryCount: number; nearExpiryValue: number };
}> {
  const { items, lots } = getTables();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);
  const thresholdStr = thresholdDate.toISOString().split('T')[0];

  // Get all lots with expiry dates
  const lotsData = await database
    .select({
      lotNumber: lots.lotNumber,
      quantity: lots.quantity,
      expiryDate: lots.expiryDate,
      status: lots.status,
      itemCode: items.code,
      itemName: items.nameEn,
    })
    .from(lots)
    .innerJoin(items, eq(lots.itemId, items.id))
    .where(
      and(
        sql`${lots.expiryDate} IS NOT NULL`,
        sql`${lots.quantity} > 0`,
        or(eq(lots.status, 'released'), eq(lots.status, 'quarantine'))
      )
    )
    .orderBy(asc(lots.expiryDate));

  const expired: Array<{ lotNumber: string; itemCode: string; itemName: string; quantity: number; expiryDate: string; daysExpired: number }> = [];
  const nearExpiry: Array<{ lotNumber: string; itemCode: string; itemName: string; quantity: number; expiryDate: string; daysToExpiry: number }> = [];
  let expiredValue = 0;
  let nearExpiryValue = 0;
  const unitCost = 100;

  for (const lot of lotsData) {
    if (!lot.expiryDate) continue;

    const expiryDate = toDateSafe(lot.expiryDate);
    const diffDays = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const qty = Number(lot.quantity) || 0;

    if (diffDays < 0) {
      expired.push({
        lotNumber: lot.lotNumber,
        itemCode: lot.itemCode,
        itemName: lot.itemName || lot.itemCode,
        quantity: qty,
        expiryDate: lot.expiryDate,
        daysExpired: Math.abs(diffDays),
      });
      expiredValue += qty * unitCost;
    } else if (diffDays <= daysThreshold) {
      nearExpiry.push({
        lotNumber: lot.lotNumber,
        itemCode: lot.itemCode,
        itemName: lot.itemName || lot.itemCode,
        quantity: qty,
        expiryDate: lot.expiryDate,
        daysToExpiry: diffDays,
      });
      nearExpiryValue += qty * unitCost;
    }
  }

  return {
    expired,
    nearExpiry,
    summary: {
      expiredCount: expired.length,
      expiredValue,
      nearExpiryCount: nearExpiry.length,
      nearExpiryValue,
    },
  };
}

/**
 * Production Yield Report
 */
export async function getProductionYieldReport(
  dateFrom?: string,
  dateTo?: string
): Promise<{
  summary: { totalBatches: number; averageYield: number; belowTargetCount: number };
  byProduct: Array<{ productCode: string; productName: string; batchCount: number; avgYield: number; minYield: number; maxYield: number }>;
  batches: Array<{ woNumber: string; batchNumber: string; productName: string; plannedQty: number; actualQty: number; yieldPercent: number; status: string }>;
}> {
  const { workOrders, items } = getTables();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  const conditions = [
    or(eq(workOrders.status, 'completed'), eq(workOrders.status, 'closed')),
  ];
  if (dateFrom) conditions.push(gte(workOrders.actualEndDate, dateFrom));
  if (dateTo) conditions.push(lte(workOrders.actualEndDate, dateTo));

  const woData = await database
    .select({
      id: workOrders.id,
      woNumber: workOrders.woNumber,
      batchNumber: workOrders.batchNumber,
      productId: workOrders.productId,
      plannedQuantity: workOrders.plannedQuantity,
      actualQuantity: workOrders.actualQuantity,
      status: workOrders.status,
      productCode: items.code,
      productName: items.nameEn,
    })
    .from(workOrders)
    .innerJoin(items, eq(workOrders.productId, items.id))
    .where(and(...conditions))
    .orderBy(desc(workOrders.actualEndDate));

  const batches: Array<{ woNumber: string; batchNumber: string; productName: string; plannedQty: number; actualQty: number; yieldPercent: number; status: string }> = [];
  const productYields = new Map<number, { code: string; name: string; yields: number[] }>();
  let totalYield = 0;
  let belowTargetCount = 0;

  for (const wo of woData) {
    const planned = Number(wo.plannedQuantity) || 0;
    const actual = Number(wo.actualQuantity) || 0;
    const yieldPercent = planned > 0 ? (actual / planned) * 100 : 0;

    batches.push({
      woNumber: wo.woNumber,
      batchNumber: wo.batchNumber,
      productName: wo.productName || wo.productCode,
      plannedQty: planned,
      actualQty: actual,
      yieldPercent: Math.round(yieldPercent * 100) / 100,
      status: yieldPercent < 95 ? 'Below Target' : 'Normal',
    });

    totalYield += yieldPercent;
    if (yieldPercent < 95) belowTargetCount++;

    // Group by product
    const productData: { code: string; name: string; yields: number[] } = productYields.get(wo.productId) || { code: wo.productCode, name: wo.productName || wo.productCode, yields: [] };
    productData.yields.push(yieldPercent);
    productYields.set(wo.productId, productData);
  }

  const byProduct = Array.from(productYields.values()).map((p: any) => ({
    productCode: p.code,
    productName: p.name,
    batchCount: p.yields.length,
    avgYield: Math.round((p.yields.reduce((a: number, b: number) => a + b, 0) / p.yields.length) * 100) / 100,
    minYield: Math.round(Math.min(...p.yields) * 100) / 100,
    maxYield: Math.round(Math.max(...p.yields) * 100) / 100,
  }));

  return {
    summary: {
      totalBatches: batches.length,
      averageYield: batches.length > 0 ? Math.round((totalYield / batches.length) * 100) / 100 : 0,
      belowTargetCount,
    },
    byProduct,
    batches,
  };
}

/**
 * Full Traceability Report
 */
export async function getTraceabilityReport(
  lotId: number,
  direction: 'forward' | 'backward' | 'both'
): Promise<{
  sourceLot: { lotNumber: string; itemCode: string; itemName: string; quantity: number; status: string };
  forwardTrace: Array<{ level: number; itemCode: string; itemName: string; lotNumber: string; quantity: number; date?: string }>;
  backwardTrace: Array<{ level: number; itemCode: string; itemName: string; lotNumber: string; quantity: number; date?: string; coaNumber?: string }>;
}> {
  const { lots, items } = getTables();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  // Get source lot
  const [sourceLot] = await database
    .select({
      lotNumber: lots.lotNumber,
      quantity: lots.quantity,
      status: lots.status,
      itemCode: items.code,
      itemName: items.nameEn,
    })
    .from(lots)
    .innerJoin(items, eq(lots.itemId, items.id))
    .where(eq(lots.id, lotId));

  if (!sourceLot) {
    throw new Error(`Lot ${lotId} not found`);
  }

  let forwardTrace: Array<{ level: number; itemCode: string; itemName: string; lotNumber: string; quantity: number; date?: string }> = [];
  let backwardTrace: Array<{ level: number; itemCode: string; itemName: string; lotNumber: string; quantity: number; date?: string; coaNumber?: string }> = [];

  if (direction === 'forward' || direction === 'both') {
    const forward = await traceForward(lotId);
    forwardTrace = forward.map(t => ({
      level: t.level,
      itemCode: t.itemCode,
      itemName: t.itemName,
      lotNumber: t.lotNumber,
      quantity: t.quantity,
      date: t.date,
    }));
  }

  if (direction === 'backward' || direction === 'both') {
    const backward = await traceBackward(lotId);
    backwardTrace = backward.map(t => ({
      level: t.level,
      itemCode: t.itemCode,
      itemName: t.itemName,
      lotNumber: t.lotNumber,
      quantity: t.quantity,
      date: t.date,
      coaNumber: t.coaNumber,
    }));
  }

  return {
    sourceLot: {
      lotNumber: sourceLot.lotNumber,
      itemCode: sourceLot.itemCode,
      itemName: sourceLot.itemName || sourceLot.itemCode,
      quantity: Number(sourceLot.quantity) || 0,
      status: sourceLot.status,
    },
    forwardTrace,
    backwardTrace,
  };
}

/**
 * Quality Summary Report
 */
export async function getQualitySummaryReport(
  dateFrom?: string,
  dateTo?: string
): Promise<{
  testSummary: { total: number; passed: number; failed: number; pending: number; passRate: number };
  deviationSummary: { total: number; open: number; closed: number; bySeverity: Record<string, number> };
  byTestType: Array<{ testType: string; total: number; passed: number; failed: number; passRate: number }>;
}> {
  const { tests, deviations } = getTables();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  // Get test statistics
  const testConditions = [];
  if (dateFrom) testConditions.push(gte(tests.createdAt, dateFrom));
  if (dateTo) testConditions.push(lte(tests.createdAt, dateTo));

  const testData = await database
    .select({
      testType: tests.testType,
      status: tests.status,
    })
    .from(tests)
    .where(testConditions.length > 0 ? and(...testConditions) : undefined);

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  let pendingTests = 0;
  const byTestType = new Map<string, { total: number; passed: number; failed: number }>();

  for (const test of testData) {
    totalTests++;
    const typeData = byTestType.get(test.testType) || { total: 0, passed: 0, failed: 0 };
    typeData.total++;

    if (test.status === 'passed') {
      passedTests++;
      typeData.passed++;
    } else if (test.status === 'failed') {
      failedTests++;
      typeData.failed++;
    } else {
      pendingTests++;
    }

    byTestType.set(test.testType, typeData);
  }

  // Get deviation statistics
  const devStats = await getDeviationStatistics(dateFrom, dateTo);

  return {
    testSummary: {
      total: totalTests,
      passed: passedTests,
      failed: failedTests,
      pending: pendingTests,
      passRate: totalTests > 0 ? Math.round((passedTests / (passedTests + failedTests)) * 10000) / 100 : 0,
    },
    deviationSummary: {
      total: devStats.total,
      open: devStats.byStatus['open'] || 0,
      closed: devStats.byStatus['closed'] || 0,
      bySeverity: devStats.bySeverity,
    },
    byTestType: Array.from(byTestType.entries()).map(([testType, data]) => ({
      testType,
      total: data.total,
      passed: data.passed,
      failed: data.failed,
      passRate: data.total > 0 ? Math.round((data.passed / data.total) * 10000) / 100 : 0,
    })),
  };
}

/**
 * Stock Movement Report
 */
export async function getStockMovementReport(
  itemId?: number,
  dateFrom?: string,
  dateTo?: string
): Promise<{
  summary: { totalReceived: number; totalIssued: number; totalAdjusted: number; netChange: number };
  movements: Array<{
    date: string;
    transactionType: string;
    itemCode: string;
    lotNumber: string;
    quantity: number;
    referenceNumber?: string;
    performedBy?: string;
  }>;
}> {
  const { transactions, lots, items } = getTables();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  const conditions = [];
  if (dateFrom) conditions.push(gte(transactions.createdAt, dateFrom));
  if (dateTo) conditions.push(lte(transactions.createdAt, dateTo));

  let query = database
    .select({
      createdAt: transactions.createdAt,
      transactionType: transactions.transactionType,
      quantity: transactions.quantity,
      referenceNumber: transactions.referenceNumber,
      lotNumber: lots.lotNumber,
      itemCode: items.code,
    })
    .from(transactions)
    .innerJoin(lots, eq(transactions.lotId, lots.id))
    .innerJoin(items, eq(lots.itemId, items.id));

  if (itemId) {
    conditions.push(eq(lots.itemId, itemId));
  }

  const txnData = await query
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(transactions.createdAt));

  let totalReceived = 0;
  let totalIssued = 0;
  let totalAdjusted = 0;

  const movements = txnData.map((txn: any) => {
    const qty = Number(txn.quantity) || 0;

    if (txn.transactionType === 'receive') {
      totalReceived += qty;
    } else if (txn.transactionType === 'issue') {
      totalIssued += Math.abs(qty);
    } else if (txn.transactionType === 'adjust') {
      totalAdjusted += qty;
    }

    return {
      date: txn.createdAt || '',
      transactionType: txn.transactionType,
      itemCode: txn.itemCode,
      lotNumber: txn.lotNumber,
      quantity: qty,
      referenceNumber: txn.referenceNumber || undefined,
    };
  });

  return {
    summary: {
      totalReceived,
      totalIssued,
      totalAdjusted,
      netChange: totalReceived - totalIssued + totalAdjusted,
    },
    movements,
  };
}

/**
 * Vendor Performance Report
 */
export async function getVendorPerformanceReport(): Promise<{
  vendors: Array<{
    vendorCode: string;
    vendorName: string;
    totalPOs: number;
    totalAmount: number;
    onTimeRate: number;
    qualityRate: number;
    overallScore: number;
  }>;
}> {
  const { vendors, purchaseOrders, lots } = getTables();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  const vendorData = await database
    .select({
      id: vendors.id,
      code: vendors.code,
      name: vendors.name,
    })
    .from(vendors)
    .where(eq(vendors.isActive, true));

  const result = [];

  for (const vendor of vendorData) {
    // Get PO statistics
    const poData = await database
      .select({
        count: sql<number>`COUNT(*)`,
        totalAmount: sql<number>`COALESCE(SUM(${purchaseOrders.totalAmount}), 0)`,
      })
      .from(purchaseOrders)
      .where(eq(purchaseOrders.vendorId, vendor.id));

    // Get quality statistics
    const lotData = await database
      .select({
        status: lots.status,
        count: sql<number>`COUNT(*)`,
      })
      .from(lots)
      .where(eq(lots.vendorId, vendor.id))
      .groupBy(lots.status);

    let releasedCount = 0;
    let rejectedCount = 0;
    for (const lot of lotData) {
      if (lot.status === 'released') releasedCount = Number(lot.count) || 0;
      if (lot.status === 'rejected') rejectedCount = Number(lot.count) || 0;
    }

    const qualityRate = (releasedCount + rejectedCount) > 0 
      ? (releasedCount / (releasedCount + rejectedCount)) * 100 
      : 100;

    const onTimeRate = 95; // Simplified - would need actual delivery tracking
    const overallScore = (onTimeRate * 0.3 + qualityRate * 0.7);

    result.push({
      vendorCode: vendor.code,
      vendorName: vendor.name,
      totalPOs: Number(poData[0]?.count) || 0,
      totalAmount: Number(poData[0]?.totalAmount) || 0,
      onTimeRate: Math.round(onTimeRate * 10) / 10,
      qualityRate: Math.round(qualityRate * 10) / 10,
      overallScore: Math.round(overallScore * 10) / 10,
    });
  }

  return { vendors: result };
}

// ============================================
// Report Execution Audit Logging
// ============================================

/**
 * Report action types
 */
export type ReportAction = 'view' | 'export' | 'print';

/**
 * Report execution status
 */
export type ReportExecutionStatus = 'success' | 'error' | 'cancelled';

/**
 * Export format types
 */
export type ExportFormat = 'pdf' | 'xlsx' | 'docx' | 'csv' | 'rtf' | 'html';

/**
 * Log a report execution for audit trail
 */
export async function logReportExecution(params: {
  templateId: number;
  userId: number;
  action: ReportAction;
  parameters?: Record<string, unknown>;
  exportFormat?: ExportFormat;
  durationMs?: number;
  status: ReportExecutionStatus;
  errorMessage?: string;
  ipAddress?: string;
}): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;
  const { reportExecutions } = getTables();

  const result = await database.insert(reportExecutions).values({
    templateId: params.templateId,
    userId: params.userId,
    action: params.action,
    parameters: params.parameters ? JSON.stringify(params.parameters) : null,
    exportFormat: params.exportFormat || null,
    durationMs: params.durationMs || null,
    status: params.status,
    errorMessage: params.errorMessage || null,
    ipAddress: params.ipAddress || null,
  });

  // Return the inserted ID
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (result as any).insertId || (result as any).lastInsertRowid || 0;
}

/**
 * Log a report view action
 */
export async function logReportView(params: {
  templateId: number;
  userId: number;
  parameters?: Record<string, unknown>;
  durationMs?: number;
  status?: ReportExecutionStatus;
  errorMessage?: string;
  ipAddress?: string;
}): Promise<number> {
  return logReportExecution({
    ...params,
    action: 'view',
    status: params.status || 'success',
  });
}

/**
 * Log a report export action
 */
export async function logReportExport(params: {
  templateId: number;
  userId: number;
  exportFormat: ExportFormat;
  parameters?: Record<string, unknown>;
  durationMs?: number;
  status?: ReportExecutionStatus;
  errorMessage?: string;
  ipAddress?: string;
}): Promise<number> {
  return logReportExecution({
    ...params,
    action: 'export',
    status: params.status || 'success',
  });
}

/**
 * Log a report print action
 */
export async function logReportPrint(params: {
  templateId: number;
  userId: number;
  parameters?: Record<string, unknown>;
  durationMs?: number;
  status?: ReportExecutionStatus;
  errorMessage?: string;
  ipAddress?: string;
}): Promise<number> {
  return logReportExecution({
    ...params,
    action: 'print',
    status: params.status || 'success',
  });
}

/**
 * Get report executions for a specific template
 */
export async function getReportExecutions(params: {
  templateId?: number;
  userId?: number;
  action?: ReportAction;
  status?: ReportExecutionStatus;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
}): Promise<{
  executions: Array<{
    id: number;
    templateId: number;
    templateName?: string;
    userId: number;
    action: string;
    parameters: string | null;
    exportFormat: string | null;
    executedAt: string | Date;
    durationMs: number | null;
    status: string;
    errorMessage: string | null;
    ipAddress: string | null;
  }>;
  total: number;
}> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;
  const { reportExecutions, reportTemplates } = getTables();
  const limit = params.limit || 50;
  const offset = params.offset || 0;

  // Build conditions
  const conditions: ReturnType<typeof eq>[] = [];
  if (params.templateId) {
    conditions.push(eq(reportExecutions.templateId, params.templateId));
  }
  if (params.userId) {
    conditions.push(eq(reportExecutions.userId, params.userId));
  }
  if (params.action) {
    conditions.push(eq(reportExecutions.action, params.action));
  }
  if (params.status) {
    conditions.push(eq(reportExecutions.status, params.status));
  }

  // Get count
  const countResult = await database
    .select({ count: sql<number>`COUNT(*)` })
    .from(reportExecutions)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  const total = Number(countResult[0]?.count) || 0;

  // Get executions with template info
  const executions = await database
    .select({
      id: reportExecutions.id,
      templateId: reportExecutions.templateId,
      templateName: reportTemplates.name,
      userId: reportExecutions.userId,
      action: reportExecutions.action,
      parameters: reportExecutions.parameters,
      exportFormat: reportExecutions.exportFormat,
      executedAt: reportExecutions.executedAt,
      durationMs: reportExecutions.durationMs,
      status: reportExecutions.status,
      errorMessage: reportExecutions.errorMessage,
      ipAddress: reportExecutions.ipAddress,
    })
    .from(reportExecutions)
    .leftJoin(reportTemplates, eq(reportExecutions.templateId, reportTemplates.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(reportExecutions.id))
    .limit(limit)
    .offset(offset);

  return {
    executions: executions.map((e: typeof executions[0]) => ({
      ...e,
      templateName: e.templateName || undefined,
    })),
    total,
  };
}

/**
 * Get report execution statistics for a template
 */
export async function getReportExecutionStats(templateId: number): Promise<{
  totalExecutions: number;
  viewCount: number;
  exportCount: number;
  printCount: number;
  successRate: number;
  averageDurationMs: number;
  lastExecuted: string | null;
  exportFormats: Record<string, number>;
}> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;
  const { reportExecutions } = getTables();

  // Get action counts
  const actionCounts = await database
    .select({
      action: reportExecutions.action,
      count: sql<number>`COUNT(*)`,
    })
    .from(reportExecutions)
    .where(eq(reportExecutions.templateId, templateId))
    .groupBy(reportExecutions.action);

  let viewCount = 0;
  let exportCount = 0;
  let printCount = 0;
  for (const row of actionCounts) {
    if (row.action === 'view') viewCount = Number(row.count) || 0;
    if (row.action === 'export') exportCount = Number(row.count) || 0;
    if (row.action === 'print') printCount = Number(row.count) || 0;
  }
  const totalExecutions = viewCount + exportCount + printCount;

  // Get success rate
  const statusCounts = await database
    .select({
      status: reportExecutions.status,
      count: sql<number>`COUNT(*)`,
    })
    .from(reportExecutions)
    .where(eq(reportExecutions.templateId, templateId))
    .groupBy(reportExecutions.status);

  let successCount = 0;
  let totalCount = 0;
  for (const row of statusCounts) {
    totalCount += Number(row.count) || 0;
    if (row.status === 'success') successCount = Number(row.count) || 0;
  }
  const successRate = totalCount > 0 ? (successCount / totalCount) * 100 : 100;

  // Get average duration
  const durationResult = await database
    .select({
      avgDuration: sql<number>`AVG(${reportExecutions.durationMs})`,
    })
    .from(reportExecutions)
    .where(and(
      eq(reportExecutions.templateId, templateId),
      sql`${reportExecutions.durationMs} IS NOT NULL`
    ));

  const averageDurationMs = Number(durationResult[0]?.avgDuration) || 0;

  // Get last execution
  const lastExecution = await database
    .select({
      executedAt: reportExecutions.executedAt,
    })
    .from(reportExecutions)
    .where(eq(reportExecutions.templateId, templateId))
    .orderBy(desc(reportExecutions.id))
    .limit(1);

  const lastExecuted = lastExecution[0]?.executedAt
    ? String(lastExecution[0].executedAt)
    : null;

  // Get export format distribution
  const formatCounts = await database
    .select({
      format: reportExecutions.exportFormat,
      count: sql<number>`COUNT(*)`,
    })
    .from(reportExecutions)
    .where(and(
      eq(reportExecutions.templateId, templateId),
      eq(reportExecutions.action, 'export'),
      sql`${reportExecutions.exportFormat} IS NOT NULL`
    ))
    .groupBy(reportExecutions.exportFormat);

  const exportFormats: Record<string, number> = {};
  for (const row of formatCounts) {
    if (row.format) {
      exportFormats[row.format] = Number(row.count) || 0;
    }
  }

  return {
    totalExecutions,
    viewCount,
    exportCount,
    printCount,
    successRate: Math.round(successRate * 10) / 10,
    averageDurationMs: Math.round(averageDurationMs),
    lastExecuted,
    exportFormats,
  };
}

/**
 * Get user's report history
 */
export async function getUserReportHistory(params: {
  userId: number;
  limit?: number;
  offset?: number;
}): Promise<{
  history: Array<{
    id: number;
    templateId: number;
    templateName?: string;
    action: string;
    exportFormat: string | null;
    executedAt: string | Date;
    status: string;
  }>;
  total: number;
}> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;
  const { reportExecutions, reportTemplates } = getTables();
  const limit = params.limit || 50;
  const offset = params.offset || 0;

  // Get count
  const countResult = await database
    .select({ count: sql<number>`COUNT(*)` })
    .from(reportExecutions)
    .where(eq(reportExecutions.userId, params.userId));

  const total = Number(countResult[0]?.count) || 0;

  // Get history with template info
  const history = await database
    .select({
      id: reportExecutions.id,
      templateId: reportExecutions.templateId,
      templateName: reportTemplates.name,
      action: reportExecutions.action,
      exportFormat: reportExecutions.exportFormat,
      executedAt: reportExecutions.executedAt,
      status: reportExecutions.status,
    })
    .from(reportExecutions)
    .leftJoin(reportTemplates, eq(reportExecutions.templateId, reportTemplates.id))
    .where(eq(reportExecutions.userId, params.userId))
    .orderBy(desc(reportExecutions.id))
    .limit(limit)
    .offset(offset);

  return {
    history: history.map((h: typeof history[0]) => ({
      ...h,
      templateName: h.templateName || undefined,
    })),
    total,
  };
}
