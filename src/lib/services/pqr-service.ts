/**
 * PQR (Product Quality Review) Service
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 1)
 *
 * Business logic for managing annual product quality reviews.
 */

import { eq, and, desc, sql, like, gte, lte, or } from 'drizzle-orm';
import { getTableRef, executeDbOperation, getInsertId } from '../db/db-helper';
import { getNow, toDbDate, formatDateFromDb } from '../db/date-utils';
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

  statusCounts.forEach((row) => {
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

  const byYear = yearCounts.map((row) => ({
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
