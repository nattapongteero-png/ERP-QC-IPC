/**
 * Reports Service
 * Real-world reporting with traceability, analytics, and GMP compliance reports
 */

import { db, useSqlite } from '../db';
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
  mysqlItems,
  mysqlInventoryLots,
  mysqlInventoryTransactions,
  mysqlWorkOrders,
  mysqlQualityTests,
  mysqlDeviations,
  mysqlPurchaseOrders,
  mysqlSalesOrders,
  mysqlVendors,
} from '../db/schema';
import { traceForward, traceBackward } from './inventory.service';
import { calculateYield } from './production.service';
import { generateCOA, getDeviationStatistics } from './quality.service';

// Get table references
function getTables() {
  if (useSqlite()) {
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
  const database = db();

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
  const database = db();

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

    const expiryDate = new Date(lot.expiryDate);
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
  const database = db();

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
  const database = db();

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
  const database = db();

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
  const database = db();

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
  const database = db();

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
