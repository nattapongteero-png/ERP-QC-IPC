/**
 * PQR (Product Quality Review) Service
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 1)
 *
 * Business logic for managing annual product quality reviews.
 */

import { eq, and, desc, sql, like, gte, lte, or } from 'drizzle-orm';
import { getTableRef, executeDbOperation, getInsertId } from '../db/db-helper';
import { getNow, toDbDate, formatDateFromDb, toQueryDate } from '../db/date-utils';
import type {
  PqrReport,
  PqrMetric,
  PqrReportWithMetrics,
  PqrCreate,
  PqrUpdate,
  PqrDashboard,
  PqrStatus,
} from '@/types/pqr';

// ============================================
// Helper Functions
// ============================================

function generateReportNumber(year: number, sequence: number): string {
  return `PQR-${year}-${String(sequence).padStart(3, '0')}`;
}

async function getNextSequence(year: number): Promise<number> {
  const pqrReportsTable = getTableRef('pqrReports');

  const result = await executeDbOperation(async (db) => {
    return db
      .select({ count: sql<number>`count(*)` })
      .from(pqrReportsTable)
      .where(eq(pqrReportsTable.reviewYear, year));
  });

  return (Number(result[0]?.count) || 0) + 1;
}

// ============================================
// List & Query Functions
// ============================================

export interface PqrListParams {
  status?: PqrStatus;
  productId?: number;
  reviewYear?: number;
  search?: string;
  page?: number;
  limit?: number;
}

export async function listPqrReports(params: PqrListParams = {}): Promise<{
  items: PqrReport[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const { status, productId, reviewYear, search, page = 1, limit = 20 } = params;
  const offset = (page - 1) * limit;

  const pqrReportsTable = getTableRef('pqrReports');
  const itemsTable = getTableRef('items');
  const usersTable = getTableRef('users');

  // Build conditions
  const conditions = [];
  if (status) conditions.push(eq(pqrReportsTable.status, status));
  if (productId) conditions.push(eq(pqrReportsTable.productId, productId));
  if (reviewYear) conditions.push(eq(pqrReportsTable.reviewYear, reviewYear));
  if (search) {
    conditions.push(
      or(
        like(pqrReportsTable.reportNumber, `%${search}%`),
        like(itemsTable.nameTh, `%${search}%`),
        like(itemsTable.code, `%${search}%`)
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Get total count
  const countResult = await executeDbOperation(async (db) => {
    let query = db
      .select({ count: sql<number>`count(*)` })
      .from(pqrReportsTable)
      .leftJoin(itemsTable, eq(pqrReportsTable.productId, itemsTable.id));

    if (whereClause) {
      query = query.where(whereClause);
    }
    return query;
  });

  const total = Number(countResult[0]?.count) || 0;

  // Get records
  const records = await executeDbOperation(async (db) => {
    let query = db
      .select({
        id: pqrReportsTable.id,
        reportNumber: pqrReportsTable.reportNumber,
        productId: pqrReportsTable.productId,
        productName: itemsTable.nameTh,
        productCode: itemsTable.code,
        reviewYear: pqrReportsTable.reviewYear,
        periodStart: pqrReportsTable.periodStart,
        periodEnd: pqrReportsTable.periodEnd,
        status: pqrReportsTable.status,
        batchesProduced: pqrReportsTable.batchesProduced,
        deviationCount: pqrReportsTable.deviationCount,
        capaCount: pqrReportsTable.capaCount,
        complaintCount: pqrReportsTable.complaintCount,
        oosCount: pqrReportsTable.oosCount,
        recallCount: pqrReportsTable.recallCount,
        stabilityStatus: pqrReportsTable.stabilityStatus,
        conclusions: pqrReportsTable.conclusions,
        recommendations: pqrReportsTable.recommendations,
        approvedBy: pqrReportsTable.approvedBy,
        approvedByName: usersTable.name,
        approvedAt: pqrReportsTable.approvedAt,
        createdBy: pqrReportsTable.createdBy,
        createdAt: pqrReportsTable.createdAt,
      })
      .from(pqrReportsTable)
      .leftJoin(itemsTable, eq(pqrReportsTable.productId, itemsTable.id))
      .leftJoin(usersTable, eq(pqrReportsTable.approvedBy, usersTable.id));

    if (whereClause) {
      query = query.where(whereClause);
    }

    return query
      .orderBy(desc(pqrReportsTable.reviewYear), desc(pqrReportsTable.createdAt))
      .limit(limit)
      .offset(offset);
  });

  // Format dates
  const items = records.map((r: typeof records[number]) => ({
    ...r,
    periodStart: formatDateFromDb(r.periodStart),
    periodEnd: formatDateFromDb(r.periodEnd),
    approvedAt: formatDateFromDb(r.approvedAt),
    createdAt: formatDateFromDb(r.createdAt),
  })) as PqrReport[];

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getPqrById(id: number): Promise<PqrReportWithMetrics | null> {
  const pqrReportsTable = getTableRef('pqrReports');
  const pqrMetricsTable = getTableRef('pqrMetrics');
  const itemsTable = getTableRef('items');
  const usersTable = getTableRef('users');

  // Get report
  const reportResult = await executeDbOperation(async (db) => {
    return db
      .select({
        id: pqrReportsTable.id,
        reportNumber: pqrReportsTable.reportNumber,
        productId: pqrReportsTable.productId,
        productName: itemsTable.nameTh,
        productCode: itemsTable.code,
        reviewYear: pqrReportsTable.reviewYear,
        periodStart: pqrReportsTable.periodStart,
        periodEnd: pqrReportsTable.periodEnd,
        status: pqrReportsTable.status,
        batchesProduced: pqrReportsTable.batchesProduced,
        deviationCount: pqrReportsTable.deviationCount,
        capaCount: pqrReportsTable.capaCount,
        complaintCount: pqrReportsTable.complaintCount,
        oosCount: pqrReportsTable.oosCount,
        recallCount: pqrReportsTable.recallCount,
        stabilityStatus: pqrReportsTable.stabilityStatus,
        conclusions: pqrReportsTable.conclusions,
        recommendations: pqrReportsTable.recommendations,
        approvedBy: pqrReportsTable.approvedBy,
        approvedByName: usersTable.name,
        approvedAt: pqrReportsTable.approvedAt,
        createdBy: pqrReportsTable.createdBy,
        createdAt: pqrReportsTable.createdAt,
      })
      .from(pqrReportsTable)
      .leftJoin(itemsTable, eq(pqrReportsTable.productId, itemsTable.id))
      .leftJoin(usersTable, eq(pqrReportsTable.approvedBy, usersTable.id))
      .where(eq(pqrReportsTable.id, id));
  });

  if (!reportResult[0]) return null;

  // Get metrics
  const metricsResult = await executeDbOperation(async (db) => {
    return db
      .select()
      .from(pqrMetricsTable)
      .where(eq(pqrMetricsTable.pqrId, id));
  });

  const report = {
    ...reportResult[0],
    periodStart: formatDateFromDb(reportResult[0].periodStart),
    periodEnd: formatDateFromDb(reportResult[0].periodEnd),
    approvedAt: formatDateFromDb(reportResult[0].approvedAt),
    createdAt: formatDateFromDb(reportResult[0].createdAt),
  } as PqrReport;

  return {
    ...report,
    metrics: metricsResult as PqrMetric[],
  };
}

// ============================================
// CRUD Functions
// ============================================

export async function createPqrReport(
  data: PqrCreate,
  userId: number
): Promise<PqrReport> {
  const pqrReportsTable = getTableRef('pqrReports');

  const sequence = await getNextSequence(data.reviewYear);
  const reportNumber = generateReportNumber(data.reviewYear, sequence);

  const result = await executeDbOperation(async (db) => {
    return db.insert(pqrReportsTable).values({
      reportNumber,
      productId: data.productId,
      reviewYear: data.reviewYear,
      periodStart: data.periodStart ? toDbDate(data.periodStart) : null,
      periodEnd: data.periodEnd ? toDbDate(data.periodEnd) : null,
      status: 'draft',
      batchesProduced: data.batchesProduced || 0,
      deviationCount: data.deviationCount || 0,
      capaCount: data.capaCount || 0,
      complaintCount: data.complaintCount || 0,
      oosCount: data.oosCount || 0,
      recallCount: data.recallCount || 0,
      stabilityStatus: data.stabilityStatus || null,
      conclusions: data.conclusions || null,
      recommendations: data.recommendations || null,
      createdBy: userId,
      createdAt: getNow(),
    });
  });

  const id = getInsertId(result);
  const report = await getPqrById(id);
  return report!;
}

export async function updatePqrReport(
  id: number,
  data: PqrUpdate,
  userId: number
): Promise<PqrReport | null> {
  const pqrReportsTable = getTableRef('pqrReports');

  // Build update object
  const updateData: Record<string, unknown> = {};

  if (data.productId !== undefined) updateData.productId = data.productId;
  if (data.reviewYear !== undefined) updateData.reviewYear = data.reviewYear;
  if (data.periodStart !== undefined) updateData.periodStart = toDbDate(data.periodStart);
  if (data.periodEnd !== undefined) updateData.periodEnd = toDbDate(data.periodEnd);
  if (data.status !== undefined) updateData.status = data.status;
  if (data.batchesProduced !== undefined) updateData.batchesProduced = data.batchesProduced;
  if (data.deviationCount !== undefined) updateData.deviationCount = data.deviationCount;
  if (data.capaCount !== undefined) updateData.capaCount = data.capaCount;
  if (data.complaintCount !== undefined) updateData.complaintCount = data.complaintCount;
  if (data.oosCount !== undefined) updateData.oosCount = data.oosCount;
  if (data.recallCount !== undefined) updateData.recallCount = data.recallCount;
  if (data.stabilityStatus !== undefined) updateData.stabilityStatus = data.stabilityStatus;
  if (data.conclusions !== undefined) updateData.conclusions = data.conclusions;
  if (data.recommendations !== undefined) updateData.recommendations = data.recommendations;

  // Handle approval
  if (data.status === 'approved') {
    updateData.approvedBy = userId;
    updateData.approvedAt = getNow();
  }

  if (Object.keys(updateData).length === 0) {
    return getPqrById(id);
  }

  await executeDbOperation(async (db) => {
    return db.update(pqrReportsTable).set(updateData).where(eq(pqrReportsTable.id, id));
  });

  return getPqrById(id);
}

export async function deletePqrReport(id: number): Promise<boolean> {
  const pqrReportsTable = getTableRef('pqrReports');
  const pqrMetricsTable = getTableRef('pqrMetrics');

  // Delete metrics first
  await executeDbOperation(async (db) => {
    return db.delete(pqrMetricsTable).where(eq(pqrMetricsTable.pqrId, id));
  });

  // Delete report
  await executeDbOperation(async (db) => {
    return db.delete(pqrReportsTable).where(eq(pqrReportsTable.id, id));
  });

  return true;
}

// ============================================
// Dashboard Functions
// ============================================

export async function getPqrDashboard(): Promise<PqrDashboard> {
  const pqrReportsTable = getTableRef('pqrReports');
  const currentYear = new Date().getFullYear();

  // Get counts by status
  const statusCounts = await executeDbOperation(async (db) => {
    return db
      .select({
        status: pqrReportsTable.status,
        count: sql<number>`count(*)`,
      })
      .from(pqrReportsTable)
      .groupBy(pqrReportsTable.status);
  });

  const byStatus: Record<PqrStatus, number> = {
    draft: 0,
    under_review: 0,
    approved: 0,
  };

  statusCounts.forEach((row: typeof statusCounts[number]) => {
    if (row.status in byStatus) {
      byStatus[row.status as PqrStatus] = Number(row.count);
    }
  });

  // Get counts by year
  const yearCounts = await executeDbOperation(async (db) => {
    return db
      .select({
        year: pqrReportsTable.reviewYear,
        count: sql<number>`count(*)`,
      })
      .from(pqrReportsTable)
      .groupBy(pqrReportsTable.reviewYear)
      .orderBy(desc(pqrReportsTable.reviewYear))
      .limit(5);
  });

  const byYear = yearCounts.map((row: typeof yearCounts[number]) => ({
    year: Number(row.year),
    count: Number(row.count),
  }));

  // Get approved this year count
  const approvedThisYearResult = await executeDbOperation(async (db) => {
    return db
      .select({ count: sql<number>`count(*)` })
      .from(pqrReportsTable)
      .where(
        and(
          eq(pqrReportsTable.status, 'approved'),
          eq(pqrReportsTable.reviewYear, currentYear)
        )
      );
  });

  // Get average metrics from latest approved reports
  const avgMetricsResult = await executeDbOperation(async (db) => {
    return db
      .select({
        avgDeviations: sql<number>`AVG(CASE WHEN ${pqrReportsTable.batchesProduced} > 0 THEN CAST(${pqrReportsTable.deviationCount} AS REAL) / ${pqrReportsTable.batchesProduced} * 100 ELSE 0 END)`,
        avgOos: sql<number>`AVG(CASE WHEN ${pqrReportsTable.batchesProduced} > 0 THEN CAST(${pqrReportsTable.oosCount} AS REAL) / ${pqrReportsTable.batchesProduced} * 100 ELSE 0 END)`,
        avgComplaints: sql<number>`AVG(CASE WHEN ${pqrReportsTable.batchesProduced} > 0 THEN CAST(${pqrReportsTable.complaintCount} AS REAL) / ${pqrReportsTable.batchesProduced} * 100 ELSE 0 END)`,
        avgCapaClosure: sql<number>`AVG(CASE WHEN ${pqrReportsTable.capaCount} > 0 THEN 100 ELSE 0 END)`,
      })
      .from(pqrReportsTable)
      .where(eq(pqrReportsTable.status, 'approved'));
  });

  // Get recent reports
  const recentResult = await listPqrReports({ limit: 5 });

  const totalReports = Object.values(byStatus).reduce((a, b) => a + b, 0);

  return {
    totalReports,
    byStatus,
    byYear,
    pendingReview: byStatus.under_review,
    approvedThisYear: Number(approvedThisYearResult[0]?.count) || 0,
    averageMetrics: {
      deviationRate: avgMetricsResult[0]?.avgDeviations
        ? Number(avgMetricsResult[0].avgDeviations.toFixed(2))
        : null,
      capaClosureRate: avgMetricsResult[0]?.avgCapaClosure
        ? Number(avgMetricsResult[0].avgCapaClosure.toFixed(2))
        : null,
      oosRate: avgMetricsResult[0]?.avgOos
        ? Number(avgMetricsResult[0].avgOos.toFixed(2))
        : null,
      complaintRate: avgMetricsResult[0]?.avgComplaints
        ? Number(avgMetricsResult[0].avgComplaints.toFixed(2))
        : null,
    },
    recentReports: recentResult.items,
  };
}

// ============================================
// Aggregation Functions (T405-T411)
// ============================================

/**
 * T405: Aggregate batch metrics for a product within date range
 */
export async function aggregateBatchMetrics(
  productId: number,
  startDate: string,
  endDate: string
): Promise<{
  totalBatches: number;
  averageYield: number | null;
  batchPassRate: number | null;
  batchesByStatus: Record<string, number>;
}> {
  const workOrdersTable = getTableRef('workOrders');

  const startQueryDate = toQueryDate(startDate);
  const endQueryDate = toQueryDate(endDate);

  // Get all batches for the product in date range
  const batches = await executeDbOperation(async (db) => {
    return db
      .select({
        id: workOrdersTable.id,
        status: workOrdersTable.status,
        yieldPercentage: workOrdersTable.yieldPercentage,
        actualEndDate: workOrdersTable.actualEndDate,
      })
      .from(workOrdersTable)
      .where(
        and(
          eq(workOrdersTable.productId, productId),
          gte(workOrdersTable.actualEndDate, startQueryDate),
          lte(workOrdersTable.actualEndDate, endQueryDate)
        )
      );
  });

  const totalBatches = batches.length;

  // Calculate average yield (only for completed batches with yield data)
  const yieldValues = batches
    .filter((b) => b.yieldPercentage !== null && b.yieldPercentage !== undefined)
    .map((b) => Number(b.yieldPercentage));

  const averageYield =
    yieldValues.length > 0
      ? yieldValues.reduce((sum, val) => sum + val, 0) / yieldValues.length
      : null;

  // Calculate pass rate (completed vs total)
  const completedCount = batches.filter((b) => b.status === 'completed').length;
  const batchPassRate = totalBatches > 0 ? (completedCount / totalBatches) * 100 : null;

  // Count by status
  const batchesByStatus: Record<string, number> = {};
  batches.forEach((b) => {
    const status = b.status || 'unknown';
    batchesByStatus[status] = (batchesByStatus[status] || 0) + 1;
  });

  return {
    totalBatches,
    averageYield: averageYield ? Number(averageYield.toFixed(2)) : null,
    batchPassRate: batchPassRate ? Number(batchPassRate.toFixed(2)) : null,
    batchesByStatus,
  };
}

/**
 * T406: Aggregate deviation metrics for a product within date range
 */
export async function aggregateDeviationMetrics(
  productId: number,
  startDate: string,
  endDate: string
): Promise<{
  totalDeviations: number;
  bySeverity: Record<string, number>;
  byStatus: Record<string, number>;
  closedCount: number;
}> {
  const deviationsTable = getTableRef('deviations');
  const workOrdersTable = getTableRef('workOrders');

  const startQueryDate = toQueryDate(startDate);
  const endQueryDate = toQueryDate(endDate);

  // Get deviations related to product through work orders
  const deviations = await executeDbOperation(async (db) => {
    return db
      .select({
        id: deviationsTable.id,
        severity: deviationsTable.severity,
        status: deviationsTable.status,
        reportedAt: deviationsTable.reportedAt,
      })
      .from(deviationsTable)
      .innerJoin(workOrdersTable, eq(deviationsTable.workOrderId, workOrdersTable.id))
      .where(
        and(
          eq(workOrdersTable.productId, productId),
          gte(deviationsTable.reportedAt, startQueryDate),
          lte(deviationsTable.reportedAt, endQueryDate)
        )
      );
  });

  const totalDeviations = deviations.length;

  // Count by severity
  const bySeverity: Record<string, number> = {};
  deviations.forEach((d) => {
    const severity = d.severity || 'unknown';
    bySeverity[severity] = (bySeverity[severity] || 0) + 1;
  });

  // Count by status
  const byStatus: Record<string, number> = {};
  deviations.forEach((d) => {
    const status = d.status || 'unknown';
    byStatus[status] = (byStatus[status] || 0) + 1;
  });

  const closedCount = deviations.filter((d) => d.status === 'closed').length;

  return {
    totalDeviations,
    bySeverity,
    byStatus,
    closedCount,
  };
}

/**
 * T407: Aggregate CAPA metrics related to product deviations
 */
export async function aggregateCapaMetrics(
  productId: number,
  startDate: string,
  endDate: string
): Promise<{
  totalCapas: number;
  byStatus: Record<string, number>;
  onTimeClosureRate: number | null;
}> {
  const capaTable = getTableRef('capa');
  const deviationsTable = getTableRef('deviations');
  const workOrdersTable = getTableRef('workOrders');

  const startQueryDate = toQueryDate(startDate);
  const endQueryDate = toQueryDate(endDate);

  // Get CAPAs related to product through deviations
  const capas = await executeDbOperation(async (db) => {
    return db
      .select({
        id: capaTable.id,
        status: capaTable.status,
        dueDate: capaTable.dueDate,
        closedDate: capaTable.closedDate,
        createdAt: capaTable.createdAt,
      })
      .from(capaTable)
      .innerJoin(deviationsTable, eq(capaTable.deviationId, deviationsTable.id))
      .innerJoin(workOrdersTable, eq(deviationsTable.workOrderId, workOrdersTable.id))
      .where(
        and(
          eq(workOrdersTable.productId, productId),
          gte(capaTable.createdAt, startQueryDate),
          lte(capaTable.createdAt, endQueryDate)
        )
      );
  });

  const totalCapas = capas.length;

  // Count by status
  const byStatus: Record<string, number> = {};
  capas.forEach((c) => {
    const status = c.status || 'unknown';
    byStatus[status] = (byStatus[status] || 0) + 1;
  });

  // Calculate on-time closure rate
  const closedCapas = capas.filter((c) => c.status === 'closed' && c.closedDate && c.dueDate);
  const onTimeCount = closedCapas.filter((c) => {
    const closed = new Date(c.closedDate as string | Date);
    const due = new Date(c.dueDate as string | Date);
    return closed <= due;
  }).length;

  const onTimeClosureRate =
    closedCapas.length > 0 ? (onTimeCount / closedCapas.length) * 100 : null;

  return {
    totalCapas,
    byStatus,
    onTimeClosureRate: onTimeClosureRate ? Number(onTimeClosureRate.toFixed(2)) : null,
  };
}

/**
 * T408: Aggregate complaint metrics for a product
 */
export async function aggregateComplaintMetrics(
  productId: number,
  startDate: string,
  endDate: string
): Promise<{
  totalComplaints: number;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
}> {
  const complaintsTable = getTableRef('complaints');

  const startQueryDate = toQueryDate(startDate);
  const endQueryDate = toQueryDate(endDate);

  // Get complaints for the product
  const complaints = await executeDbOperation(async (db) => {
    return db
      .select({
        id: complaintsTable.id,
        category: complaintsTable.category,
        severity: complaintsTable.severity,
        receivedDate: complaintsTable.receivedDate,
      })
      .from(complaintsTable)
      .where(
        and(
          eq(complaintsTable.productId, productId),
          gte(complaintsTable.receivedDate, startQueryDate),
          lte(complaintsTable.receivedDate, endQueryDate)
        )
      );
  });

  const totalComplaints = complaints.length;

  // Count by category
  const byCategory: Record<string, number> = {};
  complaints.forEach((c) => {
    const category = c.category || 'unknown';
    byCategory[category] = (byCategory[category] || 0) + 1;
  });

  // Count by severity
  const bySeverity: Record<string, number> = {};
  complaints.forEach((c) => {
    const severity = c.severity || 'unknown';
    bySeverity[severity] = (bySeverity[severity] || 0) + 1;
  });

  return {
    totalComplaints,
    byCategory,
    bySeverity,
  };
}

/**
 * T409: Aggregate OOS (Out of Spec) metrics for a product
 */
export async function aggregateOosMetrics(
  productId: number,
  startDate: string,
  endDate: string
): Promise<{
  totalTests: number;
  oosCount: number;
  oosRate: number | null;
  byTestType: Record<string, { total: number; oos: number }>;
}> {
  const qualityTestsTable = getTableRef('qualityTests');
  const inventoryLotsTable = getTableRef('inventoryLots');

  const startQueryDate = toQueryDate(startDate);
  const endQueryDate = toQueryDate(endDate);

  // Get quality tests for product lots
  const tests = await executeDbOperation(async (db) => {
    return db
      .select({
        id: qualityTestsTable.id,
        testType: qualityTestsTable.testType,
        status: qualityTestsTable.status,
        testDate: qualityTestsTable.testDate,
      })
      .from(qualityTestsTable)
      .innerJoin(inventoryLotsTable, eq(qualityTestsTable.lotId, inventoryLotsTable.id))
      .where(
        and(
          eq(inventoryLotsTable.itemId, productId),
          gte(qualityTestsTable.testDate, startQueryDate),
          lte(qualityTestsTable.testDate, endQueryDate)
        )
      );
  });

  const totalTests = tests.length;
  const oosCount = tests.filter((t) => t.status === 'fail').length;
  const oosRate = totalTests > 0 ? (oosCount / totalTests) * 100 : null;

  // Count by test type
  const byTestType: Record<string, { total: number; oos: number }> = {};
  tests.forEach((t) => {
    const testType = t.testType || 'unknown';
    if (!byTestType[testType]) {
      byTestType[testType] = { total: 0, oos: 0 };
    }
    byTestType[testType].total += 1;
    if (t.status === 'fail') {
      byTestType[testType].oos += 1;
    }
  });

  return {
    totalTests,
    oosCount,
    oosRate: oosRate ? Number(oosRate.toFixed(2)) : null,
    byTestType,
  };
}

/**
 * T410: Aggregate stability study status for a product
 */
export async function aggregateStabilityStatus(
  productId: number,
  startDate: string,
  endDate: string
): Promise<{
  studiesCount: number;
  onTrack: number;
  alerts: number;
  summary: string;
}> {
  const stabilityStudiesTable = getTableRef('stabilityStudies');
  const stabilitySamplesTable = getTableRef('stabilitySamples');
  const inventoryLotsTable = getTableRef('inventoryLots');

  const startQueryDate = toQueryDate(startDate);
  const endQueryDate = toQueryDate(endDate);

  // Get stability studies for product
  const studies = await executeDbOperation(async (db) => {
    return db
      .select({
        id: stabilityStudiesTable.id,
        status: stabilityStudiesTable.status,
        startDate: stabilityStudiesTable.startDate,
      })
      .from(stabilityStudiesTable)
      .innerJoin(inventoryLotsTable, eq(stabilityStudiesTable.lotId, inventoryLotsTable.id))
      .where(
        and(
          eq(inventoryLotsTable.itemId, productId),
          gte(stabilityStudiesTable.startDate, startQueryDate),
          lte(stabilityStudiesTable.startDate, endQueryDate)
        )
      );
  });

  const studiesCount = studies.length;

  // Count studies with OOS alerts
  const studyIds = studies.map((s) => s.id);
  let alertsCount = 0;

  if (studyIds.length > 0) {
    const samplesWithOos = await executeDbOperation(async (db) => {
      return db
        .select({
          studyId: stabilitySamplesTable.studyId,
          oosDetected: stabilitySamplesTable.oosDetected,
        })
        .from(stabilitySamplesTable)
        .where(
          and(
            sql`${stabilitySamplesTable.studyId} IN (${sql.raw(studyIds.join(','))})`,
            eq(stabilitySamplesTable.oosDetected, true)
          )
        );
    });

    // Count unique studies with OOS
    const studiesWithOos = new Set(samplesWithOos.map((s) => s.studyId));
    alertsCount = studiesWithOos.size;
  }

  const onTrack = studiesCount - alertsCount;

  // Generate summary
  let summary = `${studiesCount} stability ${studiesCount === 1 ? 'study' : 'studies'}`;
  if (studiesCount > 0) {
    summary += `: ${onTrack} on track`;
    if (alertsCount > 0) {
      summary += `, ${alertsCount} with OOS alerts`;
    }
  }

  return {
    studiesCount,
    onTrack,
    alerts: alertsCount,
    summary,
  };
}

/**
 * T411: Calculate PQR KPIs and recommendations from aggregated data
 */
export async function calculatePQRMetrics(
  aggregatedData: {
    batchMetrics: Awaited<ReturnType<typeof aggregateBatchMetrics>>;
    deviationMetrics: Awaited<ReturnType<typeof aggregateDeviationMetrics>>;
    capaMetrics: Awaited<ReturnType<typeof aggregateCapaMetrics>>;
    complaintMetrics: Awaited<ReturnType<typeof aggregateComplaintMetrics>>;
    oosMetrics: Awaited<ReturnType<typeof aggregateOosMetrics>>;
    stabilityMetrics: Awaited<ReturnType<typeof aggregateStabilityStatus>>;
  },
  targets: {
    batchSuccessRate?: number;
    maxDeviationRate?: number;
    minCapaClosureRate?: number;
    maxOosRate?: number;
    maxComplaintRate?: number;
  }
): Promise<{
  kpis: Array<{
    metricType: MetricType;
    metricValue: number | null;
    target: number | null;
    status: MetricStatus;
    details: string;
  }>;
  overallScore: number;
  recommendations: string[];
}> {
  const kpis: Array<{
    metricType: MetricType;
    metricValue: number | null;
    target: number | null;
    status: MetricStatus;
    details: string;
  }> = [];

  const recommendations: string[] = [];

  // Batch Success Rate KPI
  const batchSuccessRate = aggregatedData.batchMetrics.batchPassRate;
  const batchSuccessTarget = targets.batchSuccessRate || 95;
  kpis.push({
    metricType: 'batch_success_rate',
    metricValue: batchSuccessRate,
    target: batchSuccessTarget,
    status:
      batchSuccessRate === null
        ? 'warning'
        : batchSuccessRate >= batchSuccessTarget
        ? 'pass'
        : batchSuccessRate >= batchSuccessTarget - 5
        ? 'warning'
        : 'fail',
    details: JSON.stringify(aggregatedData.batchMetrics.batchesByStatus),
  });

  if (batchSuccessRate !== null && batchSuccessRate < batchSuccessTarget) {
    recommendations.push(
      `Batch success rate (${batchSuccessRate.toFixed(1)}%) is below target (${batchSuccessTarget}%). Review production processes and training.`
    );
  }

  // Average Yield KPI
  if (aggregatedData.batchMetrics.averageYield !== null) {
    kpis.push({
      metricType: 'yield_average',
      metricValue: aggregatedData.batchMetrics.averageYield,
      target: null,
      status: 'pass',
      details: `Average yield: ${aggregatedData.batchMetrics.averageYield.toFixed(2)}%`,
    });
  }

  // Deviation Rate KPI
  const totalBatches = aggregatedData.batchMetrics.totalBatches;
  const deviationRate =
    totalBatches > 0
      ? (aggregatedData.deviationMetrics.totalDeviations / totalBatches) * 100
      : null;
  const maxDeviationRate = targets.maxDeviationRate || 5;

  kpis.push({
    metricType: 'deviation_rate',
    metricValue: deviationRate,
    target: maxDeviationRate,
    status:
      deviationRate === null
        ? 'warning'
        : deviationRate <= maxDeviationRate
        ? 'pass'
        : deviationRate <= maxDeviationRate * 1.2
        ? 'warning'
        : 'fail',
    details: JSON.stringify(aggregatedData.deviationMetrics.bySeverity),
  });

  if (deviationRate !== null && deviationRate > maxDeviationRate) {
    const criticalCount = aggregatedData.deviationMetrics.bySeverity.critical || 0;
    if (criticalCount > 0) {
      recommendations.push(
        `High deviation rate (${deviationRate.toFixed(1)}%) with ${criticalCount} critical ${criticalCount === 1 ? 'deviation' : 'deviations'}. Immediate action required.`
      );
    } else {
      recommendations.push(
        `Deviation rate (${deviationRate.toFixed(1)}%) exceeds target (${maxDeviationRate}%). Review and strengthen controls.`
      );
    }
  }

  // CAPA Closure Rate KPI
  const capaClosureRate = aggregatedData.capaMetrics.onTimeClosureRate;
  const minCapaClosureRate = targets.minCapaClosureRate || 90;

  kpis.push({
    metricType: 'capa_closure_rate',
    metricValue: capaClosureRate,
    target: minCapaClosureRate,
    status:
      capaClosureRate === null
        ? 'warning'
        : capaClosureRate >= minCapaClosureRate
        ? 'pass'
        : capaClosureRate >= minCapaClosureRate - 10
        ? 'warning'
        : 'fail',
    details: JSON.stringify(aggregatedData.capaMetrics.byStatus),
  });

  if (capaClosureRate !== null && capaClosureRate < minCapaClosureRate) {
    recommendations.push(
      `CAPA on-time closure rate (${capaClosureRate.toFixed(1)}%) is below target (${minCapaClosureRate}%). Improve CAPA management and accountability.`
    );
  }

  // OOS Rate KPI
  const oosRate = aggregatedData.oosMetrics.oosRate;
  const maxOosRate = targets.maxOosRate || 2;

  kpis.push({
    metricType: 'oos_rate',
    metricValue: oosRate,
    target: maxOosRate,
    status:
      oosRate === null
        ? 'warning'
        : oosRate <= maxOosRate
        ? 'pass'
        : oosRate <= maxOosRate * 1.5
        ? 'warning'
        : 'fail',
    details: JSON.stringify(aggregatedData.oosMetrics.byTestType),
  });

  if (oosRate !== null && oosRate > maxOosRate) {
    recommendations.push(
      `OOS rate (${oosRate.toFixed(1)}%) exceeds target (${maxOosRate}%). Investigate testing procedures and equipment calibration.`
    );
  }

  // Complaint Rate KPI
  const complaintRate =
    totalBatches > 0
      ? (aggregatedData.complaintMetrics.totalComplaints / totalBatches) * 100
      : null;
  const maxComplaintRate = targets.maxComplaintRate || 1;

  kpis.push({
    metricType: 'complaint_rate',
    metricValue: complaintRate,
    target: maxComplaintRate,
    status:
      complaintRate === null
        ? 'warning'
        : complaintRate <= maxComplaintRate
        ? 'pass'
        : complaintRate <= maxComplaintRate * 1.5
        ? 'warning'
        : 'fail',
    details: JSON.stringify({
      byCategory: aggregatedData.complaintMetrics.byCategory,
      bySeverity: aggregatedData.complaintMetrics.bySeverity,
    }),
  });

  if (complaintRate !== null && complaintRate > maxComplaintRate) {
    const criticalComplaints = aggregatedData.complaintMetrics.bySeverity.critical || 0;
    if (criticalComplaints > 0) {
      recommendations.push(
        `Complaint rate (${complaintRate.toFixed(1)}%) is high with ${criticalComplaints} critical ${criticalComplaints === 1 ? 'complaint' : 'complaints'}. Urgent investigation required.`
      );
    } else {
      recommendations.push(
        `Complaint rate (${complaintRate.toFixed(1)}%) exceeds target (${maxComplaintRate}%). Review quality controls and customer communication.`
      );
    }
  }

  // Stability Compliance KPI
  const stabilityCompliance =
    aggregatedData.stabilityMetrics.studiesCount > 0
      ? (aggregatedData.stabilityMetrics.onTrack / aggregatedData.stabilityMetrics.studiesCount) *
        100
      : null;

  kpis.push({
    metricType: 'stability_compliance',
    metricValue: stabilityCompliance,
    target: 100,
    status:
      stabilityCompliance === null
        ? 'warning'
        : stabilityCompliance === 100
        ? 'pass'
        : stabilityCompliance >= 95
        ? 'warning'
        : 'fail',
    details: aggregatedData.stabilityMetrics.summary,
  });

  if (aggregatedData.stabilityMetrics.alerts > 0) {
    recommendations.push(
      `${aggregatedData.stabilityMetrics.alerts} stability ${aggregatedData.stabilityMetrics.alerts === 1 ? 'study has' : 'studies have'} OOS alerts. Investigate and update shelf life if needed.`
    );
  }

  // Calculate overall score (% of KPIs that passed)
  const passCount = kpis.filter((k) => k.status === 'pass').length;
  const overallScore = kpis.length > 0 ? Math.round((passCount / kpis.length) * 100) : 0;

  // Add general recommendation based on overall score
  if (overallScore === 100) {
    recommendations.unshift('All quality metrics met targets. Continue current practices.');
  } else if (overallScore >= 80) {
    recommendations.unshift(
      'Most quality metrics are satisfactory. Address identified areas for improvement.'
    );
  } else if (overallScore >= 60) {
    recommendations.unshift(
      'Multiple quality metrics need attention. Develop improvement plan with timelines.'
    );
  } else {
    recommendations.unshift(
      'Significant quality concerns identified. Immediate management review and action plan required.'
    );
  }

  return {
    kpis,
    overallScore,
    recommendations,
  };
}

/**
 * T412: Approve a PQR report
 */
export async function approvePQR(
  pqrId: number,
  approverId: number,
  comments?: string
): Promise<PqrReport | null> {
  const pqrReportsTable = getTableRef('pqrReports');

  // Update status to approved with approver info
  await executeDbOperation(async (db) => {
    return db
      .update(pqrReportsTable)
      .set({
        status: 'approved',
        approvedBy: approverId,
        approvedAt: getNow(),
        // If comments provided, append to recommendations
        ...(comments && {
          recommendations: sql`CONCAT(COALESCE(${pqrReportsTable.recommendations}, ''), '\n\nApproval Comments: ', ${comments})`,
        }),
      })
      .where(eq(pqrReportsTable.id, pqrId));
  });

  return getPqrById(pqrId);
}

// ============================================
// Utility Functions
// ============================================

export async function getProductsWithoutPqr(year: number): Promise<
  { id: number; name: string; code: string }[]
> {
  const pqrReportsTable = getTableRef('pqrReports');
  const itemsTable = getTableRef('items');

  // Get products that are finished goods and don't have a PQR for the given year
  const result = await executeDbOperation(async (db) => {
    const existingPqrProducts = db
      .select({ productId: pqrReportsTable.productId })
      .from(pqrReportsTable)
      .where(eq(pqrReportsTable.reviewYear, year));

    return db
      .select({
        id: itemsTable.id,
        name: itemsTable.nameTh,
        code: itemsTable.code,
      })
      .from(itemsTable)
      .where(
        and(
          eq(itemsTable.category, 'finished_goods'),
          sql`${itemsTable.id} NOT IN (${existingPqrProducts})`
        )
      )
      .orderBy(itemsTable.nameTh);
  });

  return result as { id: number; name: string; code: string }[];
}
