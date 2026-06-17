/**
 * Complaint Service
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * Manages customer complaints with investigation workflow,
 * QC routing, and trend analysis.
 */

import { getDb, isSqlite } from '../db';
import { getNow, toDbDate, getTodayStr, formatDateFromDb, formatMonthFromDb, toQueryDate } from '../db/date-utils';
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
  AdverseEvent,
  AdverseEventCreate,
  RegulatoryReportingEvaluation,
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
  if (fromDate) conditions.push(gte(complaintsTable.receivedDate, toQueryDate(fromDate)));
  if (toDate) conditions.push(lte(complaintsTable.receivedDate, toQueryDate(toDate)));

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
  if (data.regulatoryReportDate !== undefined) updateData.regulatoryReportDate = data.regulatoryReportDate ? toDbDate(data.regulatoryReportDate) : null;

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
 * Delete a mistaken / test complaint.
 *
 * GMP guard: only complaints still in the initial "received" status may be
 * deleted (i.e. nothing has been investigated, routed, or closed). Anything
 * that has progressed keeps its full history for compliance.
 *
 * Child rows (investigations) are removed first to satisfy FK constraints.
 */
export async function deleteComplaint(id: number, userId: number): Promise<void> {
  const { complaints: complaintsTable, investigations } = getTables();
  const db = await getDb();

  const existing = await getComplaintById(id);
  if (!existing) {
    throw new Error('Complaint not found');
  }

  if (existing.status !== 'received') {
    throw new Error(
      'Only complaints in "received" status can be deleted. Close the complaint instead.'
    );
  }

  // Remove child investigation rows first (FK safety).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db as any)
    .delete(investigations)
    .where(eq(investigations.complaintId, id));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db as any).delete(complaintsTable).where(eq(complaintsTable.id, id));

  await createAuditLog({
    userId,
    action: 'DELETE',
    tableName: 'complaints',
    recordId: id,
    oldValue: { status: existing.status, complaintNumber: existing.complaintNumber },
  });
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

  // For MySQL, pass Date object; for SQLite, pass string
  const startDateValue = isSqlite()
    ? startDate.toISOString().split('T')[0]
    : startDate;

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
    .where(gte(complaintsTable.receivedDate, startDateValue));

  console.log('[DEBUG] Complaints count:', complaints.length);
  if (complaints.length > 0) {
    console.log('[DEBUG] First complaint receivedDate:', complaints[0].receivedDate);
    console.log('[DEBUG] Type of receivedDate:', typeof complaints[0].receivedDate);
    console.log('[DEBUG] Is Date:', complaints[0].receivedDate instanceof Date);
    console.log('[DEBUG] Constructor:', complaints[0].receivedDate?.constructor?.name);
  }

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
  complaints.forEach((c: { receivedDate: Date | string }) => {
    let label: string;
    if (dateFormat === 'day') {
      label = formatDateFromDb(c.receivedDate);
    } else {
      label = formatMonthFromDb(c.receivedDate);
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

// ============================================
// Regulatory Reporting & Adverse Events
// ============================================

/**
 * Evaluate if a complaint requires FDA/regulatory reporting
 * T504: Evaluates based on severity, category, and adverse event status
 */
export async function evaluateRegulatoryReporting(
  complaintId: number,
  userId: number
): Promise<RegulatoryReportingEvaluation> {
  const complaint = await getComplaintDetails(complaintId);
  if (!complaint) {
    throw new Error('Complaint not found');
  }

  const reasons: string[] = [];
  let requiresReporting = false;

  // Check severity - critical/serious triggers consideration
  if (complaint.severity === 'critical') {
    reasons.push('Critical severity level requires regulatory review');
    requiresReporting = true;
  }

  // Check category - safety-related triggers consideration
  if (complaint.category === 'safety') {
    reasons.push('Safety-related complaint may require reporting');
    requiresReporting = true;
  }

  if (complaint.category === 'efficacy') {
    reasons.push('Efficacy issue may require regulatory notification');
    // Don't automatically require reporting for efficacy alone
  }

  // Check for linked adverse event (stored in investigation metadata or separate check)
  const { complaints: complaintsTable } = getTables();
  const db = await getDb();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const complaintData = await (db as any)
    .select({
      description: complaintsTable.description,
    })
    .from(complaintsTable)
    .where(eq(complaintsTable.id, complaintId))
    .limit(1);

  if (complaintData.length > 0) {
    const description = complaintData[0].description.toLowerCase();
    // Simple keyword detection for adverse events
    const adverseKeywords = ['injury', 'hospital', 'emergency', 'allergic', 'reaction', 'adverse', 'death', 'serious'];
    const hasAdverseIndicator = adverseKeywords.some(keyword => description.includes(keyword));

    if (hasAdverseIndicator) {
      reasons.push('Complaint description indicates potential adverse event');
      requiresReporting = true;
    }
  }

  // Generate recommendation based on evaluation
  let recommendation: string;
  if (requiresReporting) {
    recommendation = 'Immediate regulatory reporting required. Contact regulatory affairs department to file FDA MedWatch (Form 3500A) within 15 calendar days. Document all investigation findings and corrective actions.';
  } else if (reasons.length > 0) {
    recommendation = 'Monitor complaint closely. Consult with regulatory affairs if additional evidence emerges. Document decision rationale in investigation notes.';
  } else {
    recommendation = 'No immediate regulatory reporting required. Continue standard complaint investigation process. Update evaluation if new information emerges.';
  }

  // Update complaint's regulatoryReportRequired flag
  const now = getNow();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db as any)
    .update(complaintsTable)
    .set({
      regulatoryReportRequired: requiresReporting,
      updatedAt: now,
    })
    .where(eq(complaintsTable.id, complaintId));

  // Create audit log
  await createAuditLog({
    userId,
    action: 'UPDATE',
    tableName: 'complaints',
    recordId: complaintId,
    newValue: {
      regulatoryReportRequired: requiresReporting,
      evaluationReasons: reasons,
    },
  });

  return {
    requiresReporting,
    reasons,
    recommendation,
  };
}

/**
 * Record an adverse event linked to a complaint
 * T505: Creates/updates adverse event record
 * Note: Stores in complaint investigation metadata since no separate adverse_events table exists
 */
export async function recordAdverseEvent(
  complaintId: number,
  adverseEventData: AdverseEventCreate,
  userId: number
): Promise<AdverseEvent> {
  const complaint = await getComplaintById(complaintId);
  if (!complaint) {
    throw new Error('Complaint not found');
  }

  const { investigations } = getTables();
  const db = await getDb();

  // Check if investigation exists
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingInv = await (db as any)
    .select({
      id: investigations.id,
      recommendation: investigations.recommendation,
    })
    .from(investigations)
    .where(eq(investigations.complaintId, complaintId))
    .limit(1);

  if (existingInv.length === 0) {
    throw new Error('Investigation not started - route to QC first before recording adverse event');
  }

  // Create adverse event object to store in investigation metadata
  const adverseEvent: AdverseEvent = {
    id: Date.now(), // Generate pseudo-ID using timestamp
    complaintId,
    eventType: adverseEventData.eventType,
    eventDate: adverseEventData.eventDate,
    severity: adverseEventData.severity,
    description: adverseEventData.description,
    patientOutcome: adverseEventData.patientOutcome || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Store adverse event details in investigation recommendation field
  // Format: "ADVERSE_EVENT: {json}" for easy parsing
  const adverseEventJson = JSON.stringify(adverseEvent);
  const recommendationPrefix = 'ADVERSE_EVENT_RECORDED: ';
  const existingRecommendation = existingInv[0].recommendation || '';

  // Preserve any existing recommendation that's not an adverse event
  let updatedRecommendation: string;
  if (existingRecommendation.startsWith(recommendationPrefix)) {
    // Replace existing adverse event
    updatedRecommendation = recommendationPrefix + adverseEventJson;
  } else if (existingRecommendation) {
    // Append adverse event to existing recommendation
    updatedRecommendation = `${recommendationPrefix}${adverseEventJson}\n\nPrevious Recommendation: ${existingRecommendation}`;
  } else {
    updatedRecommendation = recommendationPrefix + adverseEventJson;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db as any)
    .update(investigations)
    .set({
      recommendation: updatedRecommendation,
    })
    .where(eq(investigations.complaintId, complaintId));

  // Create audit log
  await createAuditLog({
    userId,
    action: 'UPDATE',
    tableName: 'complaint_investigations',
    recordId: existingInv[0].id,
    newValue: {
      adverseEvent: {
        eventType: adverseEventData.eventType,
        severity: adverseEventData.severity,
        eventDate: adverseEventData.eventDate,
      },
    },
  });

  return adverseEvent;
}

/**
 * Get adverse event for a complaint
 * Helper function to retrieve adverse event from investigation metadata
 */
export async function getAdverseEvent(complaintId: number): Promise<AdverseEvent | null> {
  const { investigations } = getTables();
  const db = await getDb();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const investigation = await (db as any)
    .select({
      recommendation: investigations.recommendation,
    })
    .from(investigations)
    .where(eq(investigations.complaintId, complaintId))
    .limit(1);

  if (investigation.length === 0 || !investigation[0].recommendation) {
    return null;
  }

  const recommendation = investigation[0].recommendation;
  const prefix = 'ADVERSE_EVENT_RECORDED: ';

  if (!recommendation.startsWith(prefix)) {
    return null;
  }

  try {
    // Extract JSON from recommendation
    const jsonStr = recommendation.split('\n')[0].substring(prefix.length);
    const adverseEvent = JSON.parse(jsonStr) as AdverseEvent;
    return adverseEvent;
  } catch {
    return null;
  }
}
