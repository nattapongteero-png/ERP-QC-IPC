/**
 * Complaint Service
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * Manages customer complaints with investigation workflow,
 * QC routing, and trend analysis.
 */

import { getDb, isSqlite } from '../db';
import { getNow, toDbDate, getTodayStr } from '../db/date-utils';
import { eq, and, desc, gte, lte, like, count } from 'drizzle-orm';
import {
  sqliteComplaints,
  sqliteComplaintInvestigations,
  sqliteItems,
  sqliteInventoryLots,
  sqliteUsers,
  sqliteCapa,
  mysqlComplaints,
  mysqlComplaintInvestigations,
  mysqlItems,
  mysqlInventoryLots,
  mysqlUsers,
  mysqlCapa,
} from '../db/schema';
import { createAuditLog } from '../audit';

// Get table references based on database type
function getTables() {
  if (isSqlite()) {
    return {
      complaints: sqliteComplaints,
      investigations: sqliteComplaintInvestigations,
      items: sqliteItems,
      lots: sqliteInventoryLots,
      users: sqliteUsers,
      capa: sqliteCapa,
    };
  }
  return {
    complaints: mysqlComplaints,
    investigations: mysqlComplaintInvestigations,
    items: mysqlItems,
    lots: mysqlInventoryLots,
    users: mysqlUsers,
    capa: mysqlCapa,
  };
}
import type {
  ComplaintSource,
  ComplaintCategory,
  ComplaintSeverity,
  ComplaintStatus,
  Complaint,
  ComplaintCreate,
  ComplaintUpdate,
  ComplaintDetails,
  ComplaintInvestigation,
  ComplaintInvestigationCreate,
  ComplaintTrends,
  ComplaintListParams,
  ComplaintListResponse,
  ComplaintTrendsParams,
} from '@/types/complaints';

// Type for database query result rows
interface DbComplaintRow {
  id: number;
  complaintNumber: string;
  receivedDate: string;
  source: string;
  customerName: string | null;
  customerContact: string | null;
  productId: number | null;
  productName: string | null;
  lotId: number | null;
  lotNumber: string | null;
  category: string;
  severity: string;
  description: string;
  status: string;
  regulatoryReportRequired: boolean | null;
  regulatoryReportDate: string | null;
  capaId: number | null;
  capaNumber: string | null;
  recallRequired: boolean | null;
  recallId: number | null;
  closedDate: string | null;
  closedBy: number | null;
  closedByName: string | null;
  createdBy: number | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DbInvestigationRow {
  id: number;
  complaintId: number;
  investigatorId: number | null;
  investigatorName: string | null;
  startDate: string | null;
  completionDate: string | null;
  batchRecordReview: string | null;
  retainSampleTest: string | null;
  rootCause: string | null;
  conclusion: string | null;
  recommendation: string | null;
}

// ============================================
// Number Generation
// ============================================

/**
 * Generate next complaint number (COMP-YYMM-####)
 */
export async function generateComplaintNumber(): Promise<string> {
  const { complaints } = getTables();
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const prefix = `COMP-${year}${month}-`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await ((await getDb()) as any)
    .select({ complaintNumber: complaints.complaintNumber })
    .from(complaints)
    .where(like(complaints.complaintNumber, `${prefix}%`))
    .orderBy(desc(complaints.complaintNumber))
    .limit(1);

  let nextNumber = 1;
  if (result.length > 0) {
    const lastNumber = result[0].complaintNumber;
    const numPart = parseInt(lastNumber.split('-')[2], 10);
    nextNumber = numPart + 1;
  }

  return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
}

// ============================================
// Complaint CRUD Operations
// ============================================

/**
 * List complaints with optional filtering and pagination
 */
export async function listComplaints(
  params: ComplaintListParams = {}
): Promise<ComplaintListResponse> {
  const { status, category, severity, productId, fromDate, toDate, page = 1, limit = 20 } = params;
  const offset = (page - 1) * limit;
  const { complaints: complaintsTable, items, lots } = getTables();
  const db = await getDb();

  // Build query conditions
  const conditions = [];
  if (status) conditions.push(eq(complaintsTable.status, status));
  if (category) conditions.push(eq(complaintsTable.category, category));
  if (severity) conditions.push(eq(complaintsTable.severity, severity));
  if (productId) conditions.push(eq(complaintsTable.productId, productId));
  if (fromDate) conditions.push(gte(complaintsTable.receivedDate, fromDate));
  if (toDate) conditions.push(lte(complaintsTable.receivedDate, toDate));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Get total count
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const countResult = await (db as any)
    .select({ count: count() })
    .from(complaintsTable)
    .where(whereClause);
  const total = countResult[0]?.count || 0;

  // Get complaints with related data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const complaints = await (db as any)
    .select({
      id: complaintsTable.id,
      complaintNumber: complaintsTable.complaintNumber,
      receivedDate: complaintsTable.receivedDate,
      source: complaintsTable.source,
      customerName: complaintsTable.customerName,
      customerContact: complaintsTable.customerContact,
      productId: complaintsTable.productId,
      productName: items.nameTh,
      lotId: complaintsTable.lotId,
      lotNumber: lots.lotNumber,
      category: complaintsTable.category,
      severity: complaintsTable.severity,
      description: complaintsTable.description,
      status: complaintsTable.status,
      regulatoryReportRequired: complaintsTable.regulatoryReportRequired,
      regulatoryReportDate: complaintsTable.regulatoryReportDate,
      capaId: complaintsTable.capaId,
      recallRequired: complaintsTable.recallRequired,
      recallId: complaintsTable.recallId,
      closedDate: complaintsTable.closedDate,
      closedBy: complaintsTable.closedBy,
      createdBy: complaintsTable.createdBy,
      createdAt: complaintsTable.createdAt,
      updatedAt: complaintsTable.updatedAt,
    })
    .from(complaintsTable)
    .leftJoin(items, eq(complaintsTable.productId, items.id))
    .leftJoin(lots, eq(complaintsTable.lotId, lots.id))
    .where(whereClause)
    .orderBy(desc(complaintsTable.createdAt))
    .limit(limit)
    .offset(offset);

  const complaintList: Complaint[] = complaints.map((c: DbComplaintRow) => ({
    ...c,
    source: c.source as ComplaintSource,
    category: c.category as ComplaintCategory,
    severity: c.severity as ComplaintSeverity,
    status: c.status as ComplaintStatus,
    regulatoryReportRequired: c.regulatoryReportRequired || false,
    recallRequired: c.recallRequired || false,
  }));

  return { complaints: complaintList, total };
}

/**
 * Get complaint by ID with basic info
 */
export async function getComplaintById(id: number): Promise<Complaint | null> {
  const { complaints: complaintsTable, items, lots } = getTables();
  const db = await getDb();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (db as any)
    .select({
      id: complaintsTable.id,
      complaintNumber: complaintsTable.complaintNumber,
      receivedDate: complaintsTable.receivedDate,
      source: complaintsTable.source,
      customerName: complaintsTable.customerName,
      customerContact: complaintsTable.customerContact,
      productId: complaintsTable.productId,
      productName: items.nameTh,
      lotId: complaintsTable.lotId,
      lotNumber: lots.lotNumber,
      category: complaintsTable.category,
      severity: complaintsTable.severity,
      description: complaintsTable.description,
      status: complaintsTable.status,
      regulatoryReportRequired: complaintsTable.regulatoryReportRequired,
      regulatoryReportDate: complaintsTable.regulatoryReportDate,
      capaId: complaintsTable.capaId,
      recallRequired: complaintsTable.recallRequired,
      recallId: complaintsTable.recallId,
      closedDate: complaintsTable.closedDate,
      closedBy: complaintsTable.closedBy,
      createdBy: complaintsTable.createdBy,
      createdAt: complaintsTable.createdAt,
      updatedAt: complaintsTable.updatedAt,
    })
    .from(complaintsTable)
    .leftJoin(items, eq(complaintsTable.productId, items.id))
    .leftJoin(lots, eq(complaintsTable.lotId, lots.id))
    .where(eq(complaintsTable.id, id))
    .limit(1);

  if (result.length === 0) return null;

  const c = result[0] as DbComplaintRow;
  return {
    ...c,
    source: c.source as ComplaintSource,
    category: c.category as ComplaintCategory,
    severity: c.severity as ComplaintSeverity,
    status: c.status as ComplaintStatus,
    regulatoryReportRequired: c.regulatoryReportRequired || false,
    recallRequired: c.recallRequired || false,
  } as Complaint;
}

/**
 * Get complaint with full details including investigation
 */
export async function getComplaintDetails(id: number): Promise<ComplaintDetails | null> {
  const complaint = await getComplaintById(id);
  if (!complaint) return null;

  const { investigations, users, capa: capaTable } = getTables();
  const db = await getDb();

  // Get investigation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const investigationResult = await (db as any)
    .select({
      id: investigations.id,
      complaintId: investigations.complaintId,
      investigatorId: investigations.investigatorId,
      investigatorName: users.name,
      startDate: investigations.startDate,
      completionDate: investigations.completionDate,
      batchRecordReview: investigations.batchRecordReview,
      retainSampleTest: investigations.retainSampleTest,
      rootCause: investigations.rootCause,
      conclusion: investigations.conclusion,
      recommendation: investigations.recommendation,
    })
    .from(investigations)
    .leftJoin(users, eq(investigations.investigatorId, users.id))
    .where(eq(investigations.complaintId, id))
    .limit(1);

  let investigation: ComplaintInvestigation | null = null;
  if (investigationResult.length > 0) {
    const inv = investigationResult[0] as DbInvestigationRow;
    investigation = {
      ...inv,
      investigatorId: inv.investigatorId || 0,
      investigatorName: inv.investigatorName || undefined,
      startDate: inv.startDate || '',
      rootCause: inv.rootCause || '',
      conclusion: inv.conclusion || '',
    };
  }

  // Get linked CAPA if exists
  let capa: object | undefined;
  if (complaint.capaId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const capaResult = await (db as any)
      .select({
        id: capaTable.id,
        capaNumber: capaTable.capaNumber,
        title: capaTable.title,
        status: capaTable.status,
      })
      .from(capaTable)
      .where(eq(capaTable.id, complaint.capaId))
      .limit(1);
    if (capaResult.length > 0) {
      capa = capaResult[0];
    }
  }

  return {
    ...complaint,
    investigation,
    capa,
  };
}

/**
 * Create a new complaint
 */
export async function createComplaint(
  data: ComplaintCreate,
  userId: number
): Promise<Complaint> {
  const { complaints: complaintsTable } = getTables();
  const db = await getDb();
  const complaintNumber = await generateComplaintNumber();
  const now = getNow();

  let complaintId: number;

  if (isSqlite()) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (db as any)
      .insert(complaintsTable)
      .values({
        complaintNumber,
        receivedDate: toDbDate(data.receivedDate),
        source: data.source,
        customerName: data.customerName || null,
        customerContact: data.customerContact || null,
        productId: data.productId,
        lotId: data.lotId || null,
        category: data.category,
        severity: data.severity,
        description: data.description,
        status: 'received',
        regulatoryReportRequired: false,
        recallRequired: false,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: complaintsTable.id });
    complaintId = result[0].id;
  } else {
    // MySQL - insert and get by complaintNumber
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any)
      .insert(complaintsTable)
      .values({
        complaintNumber,
        receivedDate: toDbDate(data.receivedDate),
        source: data.source,
        customerName: data.customerName || null,
        customerContact: data.customerContact || null,
        productId: data.productId,
        lotId: data.lotId || null,
        category: data.category,
        severity: data.severity,
        description: data.description,
        status: 'received',
        regulatoryReportRequired: false,
        recallRequired: false,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inserted = await (db as any)
      .select({ id: complaintsTable.id })
      .from(complaintsTable)
      .where(eq(complaintsTable.complaintNumber, complaintNumber))
      .limit(1);
    complaintId = inserted[0].id;
  }

  // Create audit log
  await createAuditLog({
    userId,
    action: 'CREATE',
    tableName: 'complaints',
    recordId: complaintId,
    newValue: { complaintNumber, category: data.category, severity: data.severity },
  });

  const complaint = await getComplaintById(complaintId);
  return complaint!;
}

/**
 * Update complaint
 */
export async function updateComplaint(
  id: number,
  data: ComplaintUpdate,
  userId: number
): Promise<Complaint> {
  const { complaints: complaintsTable } = getTables();
  const db = await getDb();

  const existing = await getComplaintById(id);
  if (!existing) {
    throw new Error('Complaint not found');
  }

  const now = getNow();
  const updateData: Record<string, unknown> = { updatedAt: now };

  if (data.status !== undefined) updateData.status = data.status;
  if (data.severity !== undefined) updateData.severity = data.severity;
  if (data.regulatoryReportRequired !== undefined) updateData.regulatoryReportRequired = data.regulatoryReportRequired;
  if (data.regulatoryReportDate !== undefined) updateData.regulatoryReportDate = toDbDate(data.regulatoryReportDate);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db as any)
    .update(complaintsTable)
    .set(updateData)
    .where(eq(complaintsTable.id, id));

  // Create audit log
  await createAuditLog({
    userId,
    action: 'UPDATE',
    tableName: 'complaints',
    recordId: id,
    oldValue: { status: existing.status, severity: existing.severity },
    newValue: updateData,
  });

  const updated = await getComplaintById(id);
  return updated!;
}

/**
 * Route complaint to QC (start investigation)
 */
export async function routeToQC(
  complaintId: number,
  investigatorId: number,
  userId: number
): Promise<ComplaintInvestigation> {
  const { complaints: complaintsTable, investigations, users } = getTables();
  const db = await getDb();

  const complaint = await getComplaintById(complaintId);
  if (!complaint) {
    throw new Error('Complaint not found');
  }

  if (complaint.status !== 'received') {
    throw new Error('Complaint is already under investigation or closed');
  }

  const now = getNow();
  const todayStr = getTodayStr();
  let investigationId: number;

  if (isSqlite()) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (db as any)
      .insert(investigations)
      .values({
        complaintId,
        investigatorId,
        startDate: toDbDate(todayStr),
        createdAt: now,
      })
      .returning({ id: investigations.id });
    investigationId = result[0].id;
  } else {
    // MySQL - insert and get by complaintId
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any)
      .insert(investigations)
      .values({
        complaintId,
        investigatorId,
        startDate: toDbDate(todayStr),
        createdAt: now,
      });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inserted = await (db as any)
      .select({ id: investigations.id })
      .from(investigations)
      .where(eq(investigations.complaintId, complaintId))
      .limit(1);
    investigationId = inserted[0].id;
  }

  // Update complaint status
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db as any)
    .update(complaintsTable)
    .set({ status: 'under_investigation', updatedAt: now })
    .where(eq(complaintsTable.id, complaintId));

  // Create audit log
  await createAuditLog({
    userId,
    action: 'UPDATE',
    tableName: 'complaint_investigations',
    recordId: investigationId,
    newValue: { complaintId, investigatorId },
  });

  // Get investigator name
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const investigator = await (db as any)
    .select({ displayName: users.name })
    .from(users)
    .where(eq(users.id, investigatorId))
    .limit(1);

  return {
    id: investigationId,
    complaintId,
    investigatorId,
    investigatorName: investigator[0]?.displayName || undefined,
    startDate: todayStr,
    completionDate: null,
    batchRecordReview: null,
    retainSampleTest: null,
    rootCause: '',
    conclusion: '',
    recommendation: null,
  };
}

/**
 * Record investigation findings
 */
export async function recordInvestigation(
  complaintId: number,
  data: ComplaintInvestigationCreate,
  userId: number
): Promise<ComplaintInvestigation> {
  const { complaints: complaintsTable, investigations, users } = getTables();
  const db = await getDb();

  // Get existing investigation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingInv = await (db as any)
    .select()
    .from(investigations)
    .where(eq(investigations.complaintId, complaintId))
    .limit(1);

  if (existingInv.length === 0) {
    throw new Error('Investigation not started - route to QC first');
  }

  const now = getNow();
  const todayStr = getTodayStr();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db as any)
    .update(investigations)
    .set({
      batchRecordReview: data.batchRecordReview || null,
      retainSampleTest: data.retainSampleTest || null,
      rootCause: data.rootCause,
      conclusion: data.conclusion,
      recommendation: data.recommendation || null,
      completionDate: toDbDate(todayStr),
    })
    .where(eq(investigations.complaintId, complaintId));

  // Update complaint status to resolved
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db as any)
    .update(complaintsTable)
    .set({ status: 'resolved', updatedAt: now })
    .where(eq(complaintsTable.id, complaintId));

  // Create audit log
  await createAuditLog({
    userId,
    action: 'UPDATE',
    tableName: 'complaint_investigations',
    recordId: existingInv[0].id,
    newValue: { rootCause: data.rootCause, conclusion: data.conclusion },
  });

  // Get updated investigation with investigator name
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const investigationResult = await (db as any)
    .select({
      id: investigations.id,
      complaintId: investigations.complaintId,
      investigatorId: investigations.investigatorId,
      investigatorName: users.name,
      startDate: investigations.startDate,
      completionDate: investigations.completionDate,
      batchRecordReview: investigations.batchRecordReview,
      retainSampleTest: investigations.retainSampleTest,
      rootCause: investigations.rootCause,
      conclusion: investigations.conclusion,
      recommendation: investigations.recommendation,
    })
    .from(investigations)
    .leftJoin(users, eq(investigations.investigatorId, users.id))
    .where(eq(investigations.complaintId, complaintId))
    .limit(1);

  const inv = investigationResult[0] as DbInvestigationRow;
  return {
    ...inv,
    investigatorId: inv.investigatorId || 0,
    investigatorName: inv.investigatorName || undefined,
    startDate: inv.startDate || '',
    rootCause: inv.rootCause || '',
    conclusion: inv.conclusion || '',
  };
}

/**
 * Close complaint
 */
export async function closeComplaint(
  id: number,
  closureNotes: string | null,
  userId: number
): Promise<Complaint> {
  const { complaints: complaintsTable } = getTables();
  const db = await getDb();

  const complaint = await getComplaintDetails(id);
  if (!complaint) {
    throw new Error('Complaint not found');
  }

  if (complaint.status === 'closed') {
    throw new Error('Complaint is already closed');
  }

  // Verify investigation is complete
  if (!complaint.investigation || !complaint.investigation.conclusion) {
    throw new Error('Cannot close complaint: Investigation not complete');
  }

  const now = getNow();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db as any)
    .update(complaintsTable)
    .set({
      status: 'closed',
      closedDate: now,
      closedBy: userId,
      updatedAt: now,
    })
    .where(eq(complaintsTable.id, id));

  // Create audit log
  await createAuditLog({
    userId,
    action: 'UPDATE',
    tableName: 'complaints',
    recordId: id,
    newValue: { closedDate: now, closureNotes },
  });

  const closed = await getComplaintById(id);
  return closed!;
}

/**
 * Link CAPA to complaint
 */
export async function linkCapa(
  complaintId: number,
  capaId: number,
  userId: number
): Promise<Complaint> {
  const { complaints: complaintsTable } = getTables();
  const db = await getDb();
  const now = getNow();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db as any)
    .update(complaintsTable)
    .set({
      capaId,
      updatedAt: now,
    })
    .where(eq(complaintsTable.id, complaintId));

  // Create audit log
  await createAuditLog({
    userId,
    action: 'UPDATE',
    tableName: 'complaints',
    recordId: complaintId,
    newValue: { capaId },
  });

  const updated = await getComplaintById(complaintId);
  return updated!;
}

// ============================================
// Trends & Analytics
// ============================================

/**
 * Get complaint trends
 */
export async function getComplaintTrends(
  params: ComplaintTrendsParams = {}
): Promise<ComplaintTrends> {
  const { period = 'month' } = params;
  const { complaints: complaintsTable, items } = getTables();
  const db = await getDb();

  const now = new Date();
  let startDate: Date;
  let dateFormat: string;

  switch (period) {
    case 'quarter':
      startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      dateFormat = 'month';
      break;
    case 'year':
      startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
      dateFormat = 'month';
      break;
    default: // month
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFormat = 'day';
  }

  const startDateStr = startDate.toISOString().split('T')[0];

  // Get all complaints in period
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const complaints = await (db as any)
    .select({
      receivedDate: complaintsTable.receivedDate,
      category: complaintsTable.category,
      productId: complaintsTable.productId,
      productName: items.nameTh,
    })
    .from(complaintsTable)
    .leftJoin(items, eq(complaintsTable.productId, items.id))
    .where(gte(complaintsTable.receivedDate, startDateStr));

  // Calculate by category
  const byCategory: Record<ComplaintCategory, number> = {
    quality: 0,
    efficacy: 0,
    safety: 0,
    packaging: 0,
    labeling: 0,
    other: 0,
  };

  complaints.forEach((c: { category: string }) => {
    byCategory[c.category as ComplaintCategory]++;
  });

  // Calculate by product
  const productCounts = new Map<number, { productName: string; count: number }>();
  complaints.forEach((c: { productId: number | null; productName: string | null }) => {
    if (c.productId) {
      const existing = productCounts.get(c.productId);
      if (existing) {
        existing.count++;
      } else {
        productCounts.set(c.productId, {
          productName: c.productName || 'Unknown',
          count: 1,
        });
      }
    }
  });

  const byProduct = Array.from(productCounts.entries())
    .map(([productId, data]) => ({
      productId,
      productName: data.productName,
      count: data.count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Calculate data points based on date grouping
  const dateCounts = new Map<string, number>();
  complaints.forEach((c: { receivedDate: string }) => {
    let label: string;
    const date = new Date(c.receivedDate);
    if (dateFormat === 'day') {
      label = c.receivedDate;
    } else {
      label = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    }
    dateCounts.set(label, (dateCounts.get(label) || 0) + 1);
  });

  const dataPoints = Array.from(dateCounts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return {
    period,
    dataPoints,
    byCategory,
    byProduct,
  };
}

/**
 * Get complaint statistics dashboard
 */
export async function getComplaintDashboard(): Promise<{
  totalOpen: number;
  byStatus: Record<ComplaintStatus, number>;
  bySeverity: Record<ComplaintSeverity, number>;
  pendingInvestigation: number;
  resolvedThisMonth: number;
  criticalCount: number;
}> {
  const { complaints: complaintsTable } = getTables();
  const db = await getDb();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthStartStr = monthStart.toISOString().split('T')[0];

  // Get all complaints
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allComplaints = await (db as any)
    .select({
      status: complaintsTable.status,
      severity: complaintsTable.severity,
      closedDate: complaintsTable.closedDate,
    })
    .from(complaintsTable);

  const byStatus: Record<ComplaintStatus, number> = {
    received: 0,
    under_investigation: 0,
    resolved: 0,
    closed: 0,
  };

  const bySeverity: Record<ComplaintSeverity, number> = {
    minor: 0,
    major: 0,
    critical: 0,
  };

  let totalOpen = 0;
  let pendingInvestigation = 0;
  let resolvedThisMonth = 0;
  let criticalCount = 0;

  allComplaints.forEach((c: { status: string; severity: string; closedDate: string | null }) => {
    byStatus[c.status as ComplaintStatus]++;
    bySeverity[c.severity as ComplaintSeverity]++;

    if (c.status !== 'closed') {
      totalOpen++;
    }

    if (c.status === 'received') {
      pendingInvestigation++;
    }

    if (c.closedDate && c.closedDate >= monthStartStr) {
      resolvedThisMonth++;
    }

    if (c.severity === 'critical' && c.status !== 'closed') {
      criticalCount++;
    }
  });

  return {
    totalOpen,
    byStatus,
    bySeverity,
    pendingInvestigation,
    resolvedThisMonth,
    criticalCount,
  };
}
