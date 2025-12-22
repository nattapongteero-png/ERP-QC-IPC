/**
 * Complaint Service
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * Manages customer complaints with investigation workflow,
 * QC routing, and trend analysis.
 */

import { getDb, useSqlite } from '../db';
import { eq, and, desc, asc, gte, lte, like, or, sql, count } from 'drizzle-orm';
import {
  sqliteComplaints,
  sqliteComplaintInvestigations,
  sqliteItems,
  sqliteInventoryLots,
  sqliteUsers,
  sqliteCapa,
} from '../db/schema';
import { createAuditLog } from '../audit';
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
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const prefix = `COMP-${year}${month}-`;

  if (useSqlite()) {
    const result = await (await getDb())
      .select({ complaintNumber: sqliteComplaints.complaintNumber })
      .from(sqliteComplaints)
      .where(like(sqliteComplaints.complaintNumber, `${prefix}%`))
      .orderBy(desc(sqliteComplaints.complaintNumber))
      .limit(1);

    let nextNumber = 1;
    if (result.length > 0) {
      const lastNumber = result[0].complaintNumber;
      const numPart = parseInt(lastNumber.split('-')[2], 10);
      nextNumber = numPart + 1;
    }

    return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
  }

  throw new Error('MySQL not implemented for Complaints');
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

  if (useSqlite()) {
    // Build query conditions
    const conditions = [];
    if (status) conditions.push(eq(sqliteComplaints.status, status));
    if (category) conditions.push(eq(sqliteComplaints.category, category));
    if (severity) conditions.push(eq(sqliteComplaints.severity, severity));
    if (productId) conditions.push(eq(sqliteComplaints.productId, productId));
    if (fromDate) conditions.push(gte(sqliteComplaints.receivedDate, fromDate));
    if (toDate) conditions.push(lte(sqliteComplaints.receivedDate, toDate));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const countResult = await (await getDb())
      .select({ count: count() })
      .from(sqliteComplaints)
      .where(whereClause);
    const total = countResult[0]?.count || 0;

    // Get complaints with related data
    const complaints = await (await getDb())
      .select({
        id: sqliteComplaints.id,
        complaintNumber: sqliteComplaints.complaintNumber,
        receivedDate: sqliteComplaints.receivedDate,
        source: sqliteComplaints.source,
        customerName: sqliteComplaints.customerName,
        customerContact: sqliteComplaints.customerContact,
        productId: sqliteComplaints.productId,
        productName: sqliteItems.name,
        lotId: sqliteComplaints.lotId,
        lotNumber: sqliteInventoryLots.lotNumber,
        category: sqliteComplaints.category,
        severity: sqliteComplaints.severity,
        description: sqliteComplaints.description,
        status: sqliteComplaints.status,
        regulatoryReportRequired: sqliteComplaints.regulatoryReportRequired,
        regulatoryReportDate: sqliteComplaints.regulatoryReportDate,
        capaId: sqliteComplaints.capaId,
        recallRequired: sqliteComplaints.recallRequired,
        recallId: sqliteComplaints.recallId,
        closedDate: sqliteComplaints.closedDate,
        closedBy: sqliteComplaints.closedBy,
        createdBy: sqliteComplaints.createdBy,
        createdAt: sqliteComplaints.createdAt,
        updatedAt: sqliteComplaints.updatedAt,
      })
      .from(sqliteComplaints)
      .leftJoin(sqliteItems, eq(sqliteComplaints.productId, sqliteItems.id))
      .leftJoin(sqliteInventoryLots, eq(sqliteComplaints.lotId, sqliteInventoryLots.id))
      .where(whereClause)
      .orderBy(desc(sqliteComplaints.createdAt))
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

  throw new Error('MySQL not implemented for Complaints');
}

/**
 * Get complaint by ID with basic info
 */
export async function getComplaintById(id: number): Promise<Complaint | null> {
  if (useSqlite()) {
    const result = await (await getDb())
      .select({
        id: sqliteComplaints.id,
        complaintNumber: sqliteComplaints.complaintNumber,
        receivedDate: sqliteComplaints.receivedDate,
        source: sqliteComplaints.source,
        customerName: sqliteComplaints.customerName,
        customerContact: sqliteComplaints.customerContact,
        productId: sqliteComplaints.productId,
        productName: sqliteItems.name,
        lotId: sqliteComplaints.lotId,
        lotNumber: sqliteInventoryLots.lotNumber,
        category: sqliteComplaints.category,
        severity: sqliteComplaints.severity,
        description: sqliteComplaints.description,
        status: sqliteComplaints.status,
        regulatoryReportRequired: sqliteComplaints.regulatoryReportRequired,
        regulatoryReportDate: sqliteComplaints.regulatoryReportDate,
        capaId: sqliteComplaints.capaId,
        recallRequired: sqliteComplaints.recallRequired,
        recallId: sqliteComplaints.recallId,
        closedDate: sqliteComplaints.closedDate,
        closedBy: sqliteComplaints.closedBy,
        createdBy: sqliteComplaints.createdBy,
        createdAt: sqliteComplaints.createdAt,
        updatedAt: sqliteComplaints.updatedAt,
      })
      .from(sqliteComplaints)
      .leftJoin(sqliteItems, eq(sqliteComplaints.productId, sqliteItems.id))
      .leftJoin(sqliteInventoryLots, eq(sqliteComplaints.lotId, sqliteInventoryLots.id))
      .where(eq(sqliteComplaints.id, id))
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
    };
  }

  throw new Error('MySQL not implemented for Complaints');
}

/**
 * Get complaint with full details including investigation
 */
export async function getComplaintDetails(id: number): Promise<ComplaintDetails | null> {
  const complaint = await getComplaintById(id);
  if (!complaint) return null;

  if (useSqlite()) {
    // Get investigation
    const investigationResult = await (await getDb())
      .select({
        id: sqliteComplaintInvestigations.id,
        complaintId: sqliteComplaintInvestigations.complaintId,
        investigatorId: sqliteComplaintInvestigations.investigatorId,
        investigatorName: sqliteUsers.displayName,
        startDate: sqliteComplaintInvestigations.startDate,
        completionDate: sqliteComplaintInvestigations.completionDate,
        batchRecordReview: sqliteComplaintInvestigations.batchRecordReview,
        retainSampleTest: sqliteComplaintInvestigations.retainSampleTest,
        rootCause: sqliteComplaintInvestigations.rootCause,
        conclusion: sqliteComplaintInvestigations.conclusion,
        recommendation: sqliteComplaintInvestigations.recommendation,
      })
      .from(sqliteComplaintInvestigations)
      .leftJoin(sqliteUsers, eq(sqliteComplaintInvestigations.investigatorId, sqliteUsers.id))
      .where(eq(sqliteComplaintInvestigations.complaintId, id))
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
      const capaResult = await (await getDb())
        .select({
          id: sqliteCapa.id,
          capaNumber: sqliteCapa.capaNumber,
          title: sqliteCapa.title,
          status: sqliteCapa.status,
        })
        .from(sqliteCapa)
        .where(eq(sqliteCapa.id, complaint.capaId))
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

  throw new Error('MySQL not implemented for Complaints');
}

/**
 * Create a new complaint
 */
export async function createComplaint(
  data: ComplaintCreate,
  userId: number
): Promise<Complaint> {
  if (useSqlite()) {
    const complaintNumber = await generateComplaintNumber();
    const now = new Date().toISOString();

    const result = await (await getDb())
      .insert(sqliteComplaints)
      .values({
        complaintNumber,
        receivedDate: data.receivedDate,
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
      .returning({ id: sqliteComplaints.id });

    const complaintId = result[0].id;

    // Create audit log
    await createAuditLog({
      userId,
      action: 'complaint_created',
      tableName: 'complaints',
      recordId: complaintId,
      newValues: { complaintNumber, category: data.category, severity: data.severity },
    });

    const complaint = await getComplaintById(complaintId);
    return complaint!;
  }

  throw new Error('MySQL not implemented for Complaints');
}

/**
 * Update complaint
 */
export async function updateComplaint(
  id: number,
  data: ComplaintUpdate,
  userId: number
): Promise<Complaint> {
  if (useSqlite()) {
    const existing = await getComplaintById(id);
    if (!existing) {
      throw new Error('Complaint not found');
    }

    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = { updatedAt: now };

    if (data.status !== undefined) updateData.status = data.status;
    if (data.severity !== undefined) updateData.severity = data.severity;
    if (data.regulatoryReportRequired !== undefined) updateData.regulatoryReportRequired = data.regulatoryReportRequired;
    if (data.regulatoryReportDate !== undefined) updateData.regulatoryReportDate = data.regulatoryReportDate;

    await (await getDb())
      .update(sqliteComplaints)
      .set(updateData)
      .where(eq(sqliteComplaints.id, id));

    // Create audit log
    await createAuditLog({
      userId,
      action: 'complaint_updated',
      tableName: 'complaints',
      recordId: id,
      oldValues: { status: existing.status, severity: existing.severity },
      newValues: updateData,
    });

    const updated = await getComplaintById(id);
    return updated!;
  }

  throw new Error('MySQL not implemented for Complaints');
}

/**
 * Route complaint to QC (start investigation)
 */
export async function routeToQC(
  complaintId: number,
  investigatorId: number,
  userId: number
): Promise<ComplaintInvestigation> {
  if (useSqlite()) {
    const complaint = await getComplaintById(complaintId);
    if (!complaint) {
      throw new Error('Complaint not found');
    }

    if (complaint.status !== 'received') {
      throw new Error('Complaint is already under investigation or closed');
    }

    const now = new Date().toISOString();

    // Create investigation record
    const result = await (await getDb())
      .insert(sqliteComplaintInvestigations)
      .values({
        complaintId,
        investigatorId,
        startDate: now.split('T')[0],
        createdAt: now,
      })
      .returning({ id: sqliteComplaintInvestigations.id });

    const investigationId = result[0].id;

    // Update complaint status
    await (await getDb())
      .update(sqliteComplaints)
      .set({ status: 'under_investigation', updatedAt: now })
      .where(eq(sqliteComplaints.id, complaintId));

    // Create audit log
    await createAuditLog({
      userId,
      action: 'complaint_routed_to_qc',
      tableName: 'complaint_investigations',
      recordId: investigationId,
      newValues: { complaintId, investigatorId },
    });

    // Get investigator name
    const investigator = await (await getDb())
      .select({ displayName: sqliteUsers.displayName })
      .from(sqliteUsers)
      .where(eq(sqliteUsers.id, investigatorId))
      .limit(1);

    return {
      id: investigationId,
      complaintId,
      investigatorId,
      investigatorName: investigator[0]?.displayName || undefined,
      startDate: now.split('T')[0],
      completionDate: null,
      batchRecordReview: null,
      retainSampleTest: null,
      rootCause: '',
      conclusion: '',
      recommendation: null,
    };
  }

  throw new Error('MySQL not implemented for Complaints');
}

/**
 * Record investigation findings
 */
export async function recordInvestigation(
  complaintId: number,
  data: ComplaintInvestigationCreate,
  userId: number
): Promise<ComplaintInvestigation> {
  if (useSqlite()) {
    // Get existing investigation
    const existingInv = await (await getDb())
      .select()
      .from(sqliteComplaintInvestigations)
      .where(eq(sqliteComplaintInvestigations.complaintId, complaintId))
      .limit(1);

    if (existingInv.length === 0) {
      throw new Error('Investigation not started - route to QC first');
    }

    const now = new Date().toISOString();

    await (await getDb())
      .update(sqliteComplaintInvestigations)
      .set({
        batchRecordReview: data.batchRecordReview || null,
        retainSampleTest: data.retainSampleTest || null,
        rootCause: data.rootCause,
        conclusion: data.conclusion,
        recommendation: data.recommendation || null,
        completionDate: now.split('T')[0],
      })
      .where(eq(sqliteComplaintInvestigations.complaintId, complaintId));

    // Update complaint status to resolved
    await (await getDb())
      .update(sqliteComplaints)
      .set({ status: 'resolved', updatedAt: now })
      .where(eq(sqliteComplaints.id, complaintId));

    // Create audit log
    await createAuditLog({
      userId,
      action: 'complaint_investigation_recorded',
      tableName: 'complaint_investigations',
      recordId: existingInv[0].id,
      newValues: { rootCause: data.rootCause, conclusion: data.conclusion },
    });

    // Get updated investigation with investigator name
    const investigationResult = await (await getDb())
      .select({
        id: sqliteComplaintInvestigations.id,
        complaintId: sqliteComplaintInvestigations.complaintId,
        investigatorId: sqliteComplaintInvestigations.investigatorId,
        investigatorName: sqliteUsers.displayName,
        startDate: sqliteComplaintInvestigations.startDate,
        completionDate: sqliteComplaintInvestigations.completionDate,
        batchRecordReview: sqliteComplaintInvestigations.batchRecordReview,
        retainSampleTest: sqliteComplaintInvestigations.retainSampleTest,
        rootCause: sqliteComplaintInvestigations.rootCause,
        conclusion: sqliteComplaintInvestigations.conclusion,
        recommendation: sqliteComplaintInvestigations.recommendation,
      })
      .from(sqliteComplaintInvestigations)
      .leftJoin(sqliteUsers, eq(sqliteComplaintInvestigations.investigatorId, sqliteUsers.id))
      .where(eq(sqliteComplaintInvestigations.complaintId, complaintId))
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

  throw new Error('MySQL not implemented for Complaints');
}

/**
 * Close complaint
 */
export async function closeComplaint(
  id: number,
  closureNotes: string | null,
  userId: number
): Promise<Complaint> {
  if (useSqlite()) {
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

    const now = new Date().toISOString();

    await (await getDb())
      .update(sqliteComplaints)
      .set({
        status: 'closed',
        closedDate: now,
        closedBy: userId,
        updatedAt: now,
      })
      .where(eq(sqliteComplaints.id, id));

    // Create audit log
    await createAuditLog({
      userId,
      action: 'complaint_closed',
      tableName: 'complaints',
      recordId: id,
      newValues: { closedDate: now, closureNotes },
    });

    const closed = await getComplaintById(id);
    return closed!;
  }

  throw new Error('MySQL not implemented for Complaints');
}

/**
 * Link CAPA to complaint
 */
export async function linkCapa(
  complaintId: number,
  capaId: number,
  userId: number
): Promise<Complaint> {
  if (useSqlite()) {
    const now = new Date().toISOString();

    await (await getDb())
      .update(sqliteComplaints)
      .set({
        capaId,
        updatedAt: now,
      })
      .where(eq(sqliteComplaints.id, complaintId));

    // Create audit log
    await createAuditLog({
      userId,
      action: 'complaint_capa_linked',
      tableName: 'complaints',
      recordId: complaintId,
      newValues: { capaId },
    });

    const updated = await getComplaintById(complaintId);
    return updated!;
  }

  throw new Error('MySQL not implemented for Complaints');
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
  const { period = 'month', groupBy = 'category' } = params;

  if (useSqlite()) {
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
    const complaints = await (await getDb())
      .select({
        receivedDate: sqliteComplaints.receivedDate,
        category: sqliteComplaints.category,
        productId: sqliteComplaints.productId,
        productName: sqliteItems.name,
      })
      .from(sqliteComplaints)
      .leftJoin(sqliteItems, eq(sqliteComplaints.productId, sqliteItems.id))
      .where(gte(sqliteComplaints.receivedDate, startDateStr));

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

  throw new Error('MySQL not implemented for Complaints');
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
  if (useSqlite()) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthStartStr = monthStart.toISOString().split('T')[0];

    // Get all complaints
    const allComplaints = await (await getDb())
      .select({
        status: sqliteComplaints.status,
        severity: sqliteComplaints.severity,
        closedDate: sqliteComplaints.closedDate,
      })
      .from(sqliteComplaints);

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

  throw new Error('MySQL not implemented for Complaints');
}
