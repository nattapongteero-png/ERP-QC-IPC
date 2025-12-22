/**
 * Internal Audit Service
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 10)
 *
 * Business logic for audit plans, audits, and findings.
 */

import { eq, and, desc, sql, gte, lte } from 'drizzle-orm';
import { getSqliteDb } from '../db';
import {
  sqliteAuditPlans,
  sqliteAudits,
  sqliteAuditFindings,
  sqliteUsers,
  sqliteCapa,
} from '../db/schema';
import { createAuditLog } from '../audit';
import type {
  AuditPlan,
  AuditPlanCreate,
  AuditPlanUpdate,
  Audit,
  AuditCreate,
  AuditUpdate,
  AuditDetails,
  AuditFinding,
  AuditFindingCreate,
  AuditFindingUpdate,
  AuditStatistics,
  ChapterCoverage,
  AuditPlanListParams,
  AuditListParams,
  AuditListResponse,
  AuditFindingListParams,
  AuditFindingListResponse,
  AuditPlanStatus,
  AuditType,
  AuditStatus,
  AuditFindingCategory,
  AuditFindingStatus,
} from '@/types/audits';

// ============================================
// Audit Plans
// ============================================

/**
 * Get all audit plans with optional filters
 */
export async function getAuditPlans(
  params: AuditPlanListParams = {}
): Promise<AuditPlan[]> {
  const database = getSqliteDb();
  const conditions = [];

  if (params.year) {
    conditions.push(eq(sqliteAuditPlans.planYear, params.year));
  }
  if (params.status) {
    conditions.push(eq(sqliteAuditPlans.status, params.status));
  }

  const plans = await database
    .select({
      plan: sqliteAuditPlans,
      approver: sqliteUsers,
      creator: sqliteUsers,
    })
    .from(sqliteAuditPlans)
    .leftJoin(sqliteUsers, eq(sqliteAuditPlans.approvedBy, sqliteUsers.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(sqliteAuditPlans.planYear));

  // Enrich with audit counts
  return Promise.all(
    plans.map(async (row) => {
      const audits = await database
        .select()
        .from(sqliteAudits)
        .where(eq(sqliteAudits.planId, row.plan.id));

      const completedCount = audits.filter((a) => a.status === 'completed').length;

      // Get creator name (second join)
      const creator = await database
        .select()
        .from(sqliteUsers)
        .where(eq(sqliteUsers.id, row.plan.createdBy || 0))
        .limit(1);

      return {
        id: row.plan.id,
        planYear: row.plan.planYear,
        name: row.plan.name || `Audit Plan ${row.plan.planYear}`,
        status: row.plan.status as AuditPlanStatus,
        totalAudits: audits.length,
        completedAudits: completedCount,
        approvedBy: row.plan.approvedBy,
        approvedByName: row.approver?.name,
        approvedAt: row.plan.approvedAt,
        createdBy: row.plan.createdBy || 0,
        createdByName: creator[0]?.name,
        createdAt: row.plan.createdAt,
      };
    })
  );
}

/**
 * Get a single audit plan by ID
 */
export async function getAuditPlanById(id: number): Promise<AuditPlan | null> {
  const database = getSqliteDb();

  const plans = await database
    .select({
      plan: sqliteAuditPlans,
      approver: sqliteUsers,
    })
    .from(sqliteAuditPlans)
    .leftJoin(sqliteUsers, eq(sqliteAuditPlans.approvedBy, sqliteUsers.id))
    .where(eq(sqliteAuditPlans.id, id))
    .limit(1);

  if (!plans[0]) return null;

  const row = plans[0];

  const audits = await database
    .select()
    .from(sqliteAudits)
    .where(eq(sqliteAudits.planId, id));

  const completedCount = audits.filter((a) => a.status === 'completed').length;

  const creator = await database
    .select()
    .from(sqliteUsers)
    .where(eq(sqliteUsers.id, row.plan.createdBy || 0))
    .limit(1);

  return {
    id: row.plan.id,
    planYear: row.plan.planYear,
    name: row.plan.name || `Audit Plan ${row.plan.planYear}`,
    status: row.plan.status as AuditPlanStatus,
    totalAudits: audits.length,
    completedAudits: completedCount,
    approvedBy: row.plan.approvedBy,
    approvedByName: row.approver?.name,
    approvedAt: row.plan.approvedAt,
    createdBy: row.plan.createdBy || 0,
    createdByName: creator[0]?.name,
    createdAt: row.plan.createdAt,
  };
}

/**
 * Create a new audit plan
 */
export async function createAuditPlan(
  data: AuditPlanCreate,
  userId: number
): Promise<AuditPlan> {
  const database = getSqliteDb();

  const result = await database
    .insert(sqliteAuditPlans)
    .values({
      planYear: data.planYear,
      name: data.name,
      status: 'draft',
      createdBy: userId,
      createdAt: new Date().toISOString(),
    })
    .returning();

  await createAuditLog({
    userId,
    action: 'CREATE',
    entityType: 'audit_plan',
    entityId: result[0].id,
    newValue: result[0],
  });

  return getAuditPlanById(result[0].id) as Promise<AuditPlan>;
}

/**
 * Update an audit plan
 */
export async function updateAuditPlan(
  id: number,
  data: AuditPlanUpdate,
  userId: number
): Promise<AuditPlan | null> {
  const database = getSqliteDb();

  const existing = await getAuditPlanById(id);
  if (!existing) return null;

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.status !== undefined) updateData.status = data.status;

  if (Object.keys(updateData).length > 0) {
    await database
      .update(sqliteAuditPlans)
      .set(updateData)
      .where(eq(sqliteAuditPlans.id, id));
  }

  await createAuditLog({
    userId,
    action: 'UPDATE',
    entityType: 'audit_plan',
    entityId: id,
    previousValue: existing,
    newValue: { ...existing, ...updateData },
  });

  return getAuditPlanById(id);
}

/**
 * Approve an audit plan
 */
export async function approveAuditPlan(
  id: number,
  userId: number
): Promise<AuditPlan | null> {
  const database = getSqliteDb();

  const existing = await getAuditPlanById(id);
  if (!existing) return null;
  if (existing.status !== 'draft') return null;

  await database
    .update(sqliteAuditPlans)
    .set({
      status: 'approved',
      approvedBy: userId,
      approvedAt: new Date().toISOString(),
    })
    .where(eq(sqliteAuditPlans.id, id));

  await createAuditLog({
    userId,
    action: 'APPROVE',
    entityType: 'audit_plan',
    entityId: id,
    previousValue: existing,
  });

  return getAuditPlanById(id);
}

// ============================================
// Audits
// ============================================

/**
 * Generate audit number
 */
export async function generateAuditNumber(): Promise<string> {
  const database = getSqliteDb();
  const now = new Date();
  const yearMonth = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prefix = `AUD-${yearMonth}-`;

  const existing = await database
    .select()
    .from(sqliteAudits)
    .where(sql`${sqliteAudits.auditNumber} LIKE ${prefix + '%'}`)
    .orderBy(desc(sqliteAudits.auditNumber))
    .limit(1);

  if (existing[0]) {
    const lastNum = parseInt(existing[0].auditNumber.split('-').pop() || '0', 10);
    return `${prefix}${String(lastNum + 1).padStart(4, '0')}`;
  }

  return `${prefix}0001`;
}

/**
 * Get audits with pagination and filters
 */
export async function getAudits(
  params: AuditListParams = {}
): Promise<AuditListResponse> {
  const database = getSqliteDb();
  const page = params.page || 1;
  const limit = params.limit || 20;
  const offset = (page - 1) * limit;

  const conditions = [];

  if (params.planId) {
    conditions.push(eq(sqliteAudits.planId, params.planId));
  }
  if (params.auditType) {
    conditions.push(eq(sqliteAudits.auditType, params.auditType));
  }
  if (params.status) {
    conditions.push(eq(sqliteAudits.status, params.status));
  }
  if (params.fromDate) {
    conditions.push(gte(sqliteAudits.scheduledDate, params.fromDate));
  }
  if (params.toDate) {
    conditions.push(lte(sqliteAudits.scheduledDate, params.toDate));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  let audits = await database
    .select({
      audit: sqliteAudits,
      leadAuditor: sqliteUsers,
    })
    .from(sqliteAudits)
    .leftJoin(sqliteUsers, eq(sqliteAudits.leadAuditorId, sqliteUsers.id))
    .where(whereClause)
    .orderBy(desc(sqliteAudits.scheduledDate))
    .limit(limit)
    .offset(offset);

  // Filter by GMP chapter if specified
  if (params.gmpChapter) {
    audits = audits.filter((a) => {
      const chapters = a.audit.gmpChapters ? JSON.parse(a.audit.gmpChapters) : [];
      return chapters.includes(params.gmpChapter);
    });
  }

  const countResult = await database
    .select({ count: sql<number>`count(*)` })
    .from(sqliteAudits)
    .where(whereClause);

  // Enrich with findings counts
  const enrichedAudits = await Promise.all(
    audits.map(async (row) => {
      const findings = await database
        .select()
        .from(sqliteAuditFindings)
        .where(eq(sqliteAuditFindings.auditId, row.audit.id));

      const openCount = findings.filter((f) => f.status !== 'closed').length;

      return {
        id: row.audit.id,
        auditNumber: row.audit.auditNumber,
        planId: row.audit.planId,
        auditType: row.audit.auditType as AuditType,
        scope: row.audit.scope || '',
        gmpChapters: row.audit.gmpChapters ? JSON.parse(row.audit.gmpChapters) : [],
        scheduledDate: row.audit.scheduledDate || '',
        actualDate: row.audit.actualDate,
        leadAuditorId: row.audit.leadAuditorId || 0,
        leadAuditorName: row.leadAuditor?.name,
        auditTeam: row.audit.auditTeam ? JSON.parse(row.audit.auditTeam) : [],
        status: row.audit.status as AuditStatus,
        findingsCount: findings.length,
        openFindingsCount: openCount,
        summary: row.audit.summary,
        reportPath: row.audit.reportPath,
        closedDate: row.audit.closedDate,
        createdAt: row.audit.createdAt,
      };
    })
  );

  return {
    audits: enrichedAudits,
    total: countResult[0]?.count || 0,
  };
}

/**
 * Get audit details by ID
 */
export async function getAuditById(id: number): Promise<AuditDetails | null> {
  const database = getSqliteDb();

  const audits = await database
    .select({
      audit: sqliteAudits,
      leadAuditor: sqliteUsers,
    })
    .from(sqliteAudits)
    .leftJoin(sqliteUsers, eq(sqliteAudits.leadAuditorId, sqliteUsers.id))
    .where(eq(sqliteAudits.id, id))
    .limit(1);

  if (!audits[0]) return null;

  const row = audits[0];

  // Get findings
  const findingsRows = await database
    .select({
      finding: sqliteAuditFindings,
      owner: sqliteUsers,
      capa: sqliteCapa,
    })
    .from(sqliteAuditFindings)
    .leftJoin(sqliteUsers, eq(sqliteAuditFindings.areaOwner, sqliteUsers.id))
    .leftJoin(sqliteCapa, eq(sqliteAuditFindings.capaId, sqliteCapa.id))
    .where(eq(sqliteAuditFindings.auditId, id))
    .orderBy(sqliteAuditFindings.findingNumber);

  const findings: AuditFinding[] = findingsRows.map((fr) => ({
    id: fr.finding.id,
    auditId: fr.finding.auditId,
    findingNumber: fr.finding.findingNumber || '',
    category: fr.finding.category as AuditFindingCategory,
    gmpChapter: fr.finding.gmpChapter || 0,
    gmpRequirement: fr.finding.gmpRequirement,
    description: fr.finding.description,
    evidence: fr.finding.evidence,
    areaOwner: fr.finding.areaOwner,
    areaOwnerName: fr.owner?.name,
    capaRequired: fr.finding.capaRequired ?? false,
    capaId: fr.finding.capaId,
    capaNumber: fr.capa?.capaNumber,
    status: fr.finding.status as AuditFindingStatus,
    closedDate: fr.finding.closedDate,
    closedBy: fr.finding.closedBy,
    createdAt: fr.finding.createdAt,
  }));

  // Get plan if exists
  let plan: AuditPlan | null = null;
  if (row.audit.planId) {
    plan = await getAuditPlanById(row.audit.planId);
  }

  const openCount = findings.filter((f) => f.status !== 'closed').length;

  return {
    id: row.audit.id,
    auditNumber: row.audit.auditNumber,
    planId: row.audit.planId,
    auditType: row.audit.auditType as AuditType,
    scope: row.audit.scope || '',
    gmpChapters: row.audit.gmpChapters ? JSON.parse(row.audit.gmpChapters) : [],
    scheduledDate: row.audit.scheduledDate || '',
    actualDate: row.audit.actualDate,
    leadAuditorId: row.audit.leadAuditorId || 0,
    leadAuditorName: row.leadAuditor?.name,
    auditTeam: row.audit.auditTeam ? JSON.parse(row.audit.auditTeam) : [],
    status: row.audit.status as AuditStatus,
    findingsCount: findings.length,
    openFindingsCount: openCount,
    summary: row.audit.summary,
    reportPath: row.audit.reportPath,
    closedDate: row.audit.closedDate,
    createdAt: row.audit.createdAt,
    findings,
    plan,
  };
}

/**
 * Create a new audit
 */
export async function createAudit(
  data: AuditCreate,
  userId: number
): Promise<Audit> {
  const database = getSqliteDb();

  const auditNumber = await generateAuditNumber();

  const result = await database
    .insert(sqliteAudits)
    .values({
      auditNumber,
      planId: data.planId || null,
      auditType: data.auditType,
      scope: data.scope,
      gmpChapters: JSON.stringify(data.gmpChapters),
      scheduledDate: data.scheduledDate,
      leadAuditorId: data.leadAuditorId,
      auditTeam: data.auditTeam ? JSON.stringify(data.auditTeam) : null,
      status: 'scheduled',
      createdAt: new Date().toISOString(),
    })
    .returning();

  await createAuditLog({
    userId,
    action: 'CREATE',
    entityType: 'audit',
    entityId: result[0].id,
    newValue: result[0],
  });

  const audit = await getAuditById(result[0].id);
  return audit as Audit;
}

/**
 * Update an audit
 */
export async function updateAudit(
  id: number,
  data: AuditUpdate,
  userId: number
): Promise<Audit | null> {
  const database = getSqliteDb();

  const existing = await getAuditById(id);
  if (!existing) return null;

  const updateData: Record<string, unknown> = {};
  if (data.scope !== undefined) updateData.scope = data.scope;
  if (data.scheduledDate !== undefined) updateData.scheduledDate = data.scheduledDate;
  if (data.leadAuditorId !== undefined) updateData.leadAuditorId = data.leadAuditorId;
  if (data.auditTeam !== undefined) updateData.auditTeam = JSON.stringify(data.auditTeam);
  if (data.status !== undefined) updateData.status = data.status;

  if (Object.keys(updateData).length > 0) {
    await database
      .update(sqliteAudits)
      .set(updateData)
      .where(eq(sqliteAudits.id, id));
  }

  await createAuditLog({
    userId,
    action: 'UPDATE',
    entityType: 'audit',
    entityId: id,
    previousValue: existing,
    newValue: { ...existing, ...updateData },
  });

  return getAuditById(id);
}

/**
 * Start an audit
 */
export async function startAudit(
  id: number,
  userId: number
): Promise<Audit | null> {
  const database = getSqliteDb();

  const existing = await getAuditById(id);
  if (!existing) return null;
  if (existing.status !== 'scheduled') return null;

  await database
    .update(sqliteAudits)
    .set({
      status: 'in_progress',
      actualDate: new Date().toISOString().split('T')[0],
    })
    .where(eq(sqliteAudits.id, id));

  // If part of a plan, update plan status
  if (existing.planId) {
    const plan = await getAuditPlanById(existing.planId);
    if (plan && plan.status === 'approved') {
      await database
        .update(sqliteAuditPlans)
        .set({ status: 'in_progress' })
        .where(eq(sqliteAuditPlans.id, existing.planId));
    }
  }

  await createAuditLog({
    userId,
    action: 'START',
    entityType: 'audit',
    entityId: id,
    previousValue: existing,
  });

  return getAuditById(id);
}

/**
 * Complete an audit
 */
export async function completeAudit(
  id: number,
  data: AuditCompleteRequest,
  userId: number
): Promise<Audit | null> {
  const database = getSqliteDb();

  const existing = await getAuditById(id);
  if (!existing) return null;
  if (existing.status !== 'in_progress') return null;

  await database
    .update(sqliteAudits)
    .set({
      status: 'completed',
      summary: data.summary || null,
      reportPath: data.reportPath || null,
      closedDate: new Date().toISOString().split('T')[0],
    })
    .where(eq(sqliteAudits.id, id));

  await createAuditLog({
    userId,
    action: 'COMPLETE',
    entityType: 'audit',
    entityId: id,
    previousValue: existing,
  });

  return getAuditById(id);
}

// ============================================
// Audit Findings
// ============================================

/**
 * Generate finding number within audit
 */
async function generateFindingNumber(auditId: number): Promise<string> {
  const database = getSqliteDb();

  const existing = await database
    .select()
    .from(sqliteAuditFindings)
    .where(eq(sqliteAuditFindings.auditId, auditId))
    .orderBy(desc(sqliteAuditFindings.findingNumber));

  if (existing.length > 0 && existing[0].findingNumber) {
    const lastNum = parseInt(existing[0].findingNumber.split('-')[1] || '0', 10);
    return `F-${String(lastNum + 1).padStart(3, '0')}`;
  }

  return 'F-001';
}

/**
 * Get findings with pagination and filters
 */
export async function getAuditFindings(
  params: AuditFindingListParams = {}
): Promise<AuditFindingListResponse> {
  const database = getSqliteDb();
  const page = params.page || 1;
  const limit = params.limit || 20;
  const offset = (page - 1) * limit;

  const conditions = [];

  if (params.auditId) {
    conditions.push(eq(sqliteAuditFindings.auditId, params.auditId));
  }
  if (params.category) {
    conditions.push(eq(sqliteAuditFindings.category, params.category));
  }
  if (params.gmpChapter) {
    conditions.push(eq(sqliteAuditFindings.gmpChapter, params.gmpChapter));
  }
  if (params.status) {
    conditions.push(eq(sqliteAuditFindings.status, params.status));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const findings = await database
    .select({
      finding: sqliteAuditFindings,
      audit: sqliteAudits,
      owner: sqliteUsers,
      capa: sqliteCapa,
    })
    .from(sqliteAuditFindings)
    .leftJoin(sqliteAudits, eq(sqliteAuditFindings.auditId, sqliteAudits.id))
    .leftJoin(sqliteUsers, eq(sqliteAuditFindings.areaOwner, sqliteUsers.id))
    .leftJoin(sqliteCapa, eq(sqliteAuditFindings.capaId, sqliteCapa.id))
    .where(whereClause)
    .orderBy(desc(sqliteAuditFindings.createdAt))
    .limit(limit)
    .offset(offset);

  const countResult = await database
    .select({ count: sql<number>`count(*)` })
    .from(sqliteAuditFindings)
    .where(whereClause);

  return {
    findings: findings.map((row) => ({
      id: row.finding.id,
      auditId: row.finding.auditId,
      auditNumber: row.audit?.auditNumber,
      findingNumber: row.finding.findingNumber || '',
      category: row.finding.category as AuditFindingCategory,
      gmpChapter: row.finding.gmpChapter || 0,
      gmpRequirement: row.finding.gmpRequirement,
      description: row.finding.description,
      evidence: row.finding.evidence,
      areaOwner: row.finding.areaOwner,
      areaOwnerName: row.owner?.name,
      capaRequired: row.finding.capaRequired ?? false,
      capaId: row.finding.capaId,
      capaNumber: row.capa?.capaNumber,
      status: row.finding.status as AuditFindingStatus,
      closedDate: row.finding.closedDate,
      closedBy: row.finding.closedBy,
      createdAt: row.finding.createdAt,
    })),
    total: countResult[0]?.count || 0,
  };
}

/**
 * Get finding by ID
 */
export async function getAuditFindingById(id: number): Promise<AuditFinding | null> {
  const database = getSqliteDb();

  const findings = await database
    .select({
      finding: sqliteAuditFindings,
      audit: sqliteAudits,
      owner: sqliteUsers,
      capa: sqliteCapa,
    })
    .from(sqliteAuditFindings)
    .leftJoin(sqliteAudits, eq(sqliteAuditFindings.auditId, sqliteAudits.id))
    .leftJoin(sqliteUsers, eq(sqliteAuditFindings.areaOwner, sqliteUsers.id))
    .leftJoin(sqliteCapa, eq(sqliteAuditFindings.capaId, sqliteCapa.id))
    .where(eq(sqliteAuditFindings.id, id))
    .limit(1);

  if (!findings[0]) return null;

  const row = findings[0];
  return {
    id: row.finding.id,
    auditId: row.finding.auditId,
    auditNumber: row.audit?.auditNumber,
    findingNumber: row.finding.findingNumber || '',
    category: row.finding.category as AuditFindingCategory,
    gmpChapter: row.finding.gmpChapter || 0,
    gmpRequirement: row.finding.gmpRequirement,
    description: row.finding.description,
    evidence: row.finding.evidence,
    areaOwner: row.finding.areaOwner,
    areaOwnerName: row.owner?.name,
    capaRequired: row.finding.capaRequired ?? false,
    capaId: row.finding.capaId,
    capaNumber: row.capa?.capaNumber,
    status: row.finding.status as AuditFindingStatus,
    closedDate: row.finding.closedDate,
    closedBy: row.finding.closedBy,
    createdAt: row.finding.createdAt,
  };
}

/**
 * Create a new finding
 */
export async function createAuditFinding(
  data: AuditFindingCreate,
  userId: number
): Promise<AuditFinding> {
  const database = getSqliteDb();

  const findingNumber = await generateFindingNumber(data.auditId);

  const result = await database
    .insert(sqliteAuditFindings)
    .values({
      auditId: data.auditId,
      findingNumber,
      category: data.category,
      gmpChapter: data.gmpChapter,
      gmpRequirement: data.gmpRequirement || null,
      description: data.description,
      evidence: data.evidence || null,
      areaOwner: data.areaOwner || null,
      capaRequired: data.capaRequired ?? false,
      status: 'open',
      createdAt: new Date().toISOString(),
    })
    .returning();

  await createAuditLog({
    userId,
    action: 'CREATE',
    entityType: 'audit_finding',
    entityId: result[0].id,
    newValue: result[0],
  });

  return getAuditFindingById(result[0].id) as Promise<AuditFinding>;
}

/**
 * Update a finding
 */
export async function updateAuditFinding(
  id: number,
  data: AuditFindingUpdate,
  userId: number
): Promise<AuditFinding | null> {
  const database = getSqliteDb();

  const existing = await getAuditFindingById(id);
  if (!existing) return null;

  const updateData: Record<string, unknown> = {};
  if (data.category !== undefined) updateData.category = data.category;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.evidence !== undefined) updateData.evidence = data.evidence;
  if (data.areaOwner !== undefined) updateData.areaOwner = data.areaOwner;
  if (data.capaRequired !== undefined) updateData.capaRequired = data.capaRequired;

  if (Object.keys(updateData).length > 0) {
    await database
      .update(sqliteAuditFindings)
      .set(updateData)
      .where(eq(sqliteAuditFindings.id, id));
  }

  await createAuditLog({
    userId,
    action: 'UPDATE',
    entityType: 'audit_finding',
    entityId: id,
    previousValue: existing,
    newValue: { ...existing, ...updateData },
  });

  return getAuditFindingById(id);
}

/**
 * Assign CAPA to finding
 */
export async function assignCapaToFinding(
  findingId: number,
  capaId: number,
  userId: number
): Promise<AuditFinding | null> {
  const database = getSqliteDb();

  const existing = await getAuditFindingById(findingId);
  if (!existing) return null;

  await database
    .update(sqliteAuditFindings)
    .set({
      capaId,
      status: 'capa_assigned',
    })
    .where(eq(sqliteAuditFindings.id, findingId));

  await createAuditLog({
    userId,
    action: 'ASSIGN_CAPA',
    entityType: 'audit_finding',
    entityId: findingId,
    previousValue: existing,
    newValue: { capaId },
  });

  return getAuditFindingById(findingId);
}

/**
 * Close a finding
 */
export async function closeAuditFinding(
  id: number,
  userId: number
): Promise<AuditFinding | null> {
  const database = getSqliteDb();

  const existing = await getAuditFindingById(id);
  if (!existing) return null;

  // Cannot close if CAPA required but not assigned
  if (existing.capaRequired && !existing.capaId) {
    throw new Error('Cannot close finding: CAPA is required but not assigned');
  }

  await database
    .update(sqliteAuditFindings)
    .set({
      status: 'closed',
      closedDate: new Date().toISOString().split('T')[0],
      closedBy: userId,
    })
    .where(eq(sqliteAuditFindings.id, id));

  await createAuditLog({
    userId,
    action: 'CLOSE',
    entityType: 'audit_finding',
    entityId: id,
    previousValue: existing,
  });

  return getAuditFindingById(id);
}

// ============================================
// Statistics
// ============================================

/**
 * Get audit statistics for a year
 */
export async function getAuditStatistics(year: number): Promise<AuditStatistics> {
  const database = getSqliteDb();

  const startOfYear = `${year}-01-01`;
  const endOfYear = `${year}-12-31`;

  // Get audits in the year
  const audits = await database
    .select()
    .from(sqliteAudits)
    .where(
      and(
        gte(sqliteAudits.scheduledDate, startOfYear),
        lte(sqliteAudits.scheduledDate, endOfYear)
      )
    );

  const completedAudits = audits.filter((a) => a.status === 'completed');

  // Get all findings from these audits
  const auditIds = audits.map((a) => a.id);
  let findings: (typeof sqliteAuditFindings.$inferSelect)[] = [];
  if (auditIds.length > 0) {
    findings = await database
      .select()
      .from(sqliteAuditFindings)
      .where(sql`${sqliteAuditFindings.auditId} IN (${sql.join(auditIds.map(id => sql`${id}`), sql`, `)})`);
  }

  const findingsByCategory = {
    observation: findings.filter((f) => f.category === 'observation').length,
    minor: findings.filter((f) => f.category === 'minor').length,
    major: findings.filter((f) => f.category === 'major').length,
    critical: findings.filter((f) => f.category === 'critical').length,
  };

  const openFindings = findings.filter((f) => f.status !== 'closed').length;

  // Calculate average closure time
  const closedFindings = findings.filter((f) => f.status === 'closed' && f.closedDate);
  let avgCapaClosureTime = 0;
  if (closedFindings.length > 0) {
    const totalDays = closedFindings.reduce((sum, f) => {
      const created = new Date(f.createdAt);
      const closed = new Date(f.closedDate!);
      return sum + Math.floor((closed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
    }, 0);
    avgCapaClosureTime = Math.round(totalDays / closedFindings.length);
  }

  return {
    year,
    totalPlanned: audits.length,
    totalCompleted: completedAudits.length,
    completionRate: audits.length > 0 ? (completedAudits.length / audits.length) * 100 : 0,
    totalFindings: findings.length,
    findingsByCategory,
    openFindings,
    avgCapaClosureTime,
  };
}

/**
 * Get GMP chapter coverage for a year
 */
export async function getChapterCoverage(year: number): Promise<ChapterCoverage> {
  const database = getSqliteDb();

  const startOfYear = `${year}-01-01`;
  const endOfYear = `${year}-12-31`;

  // Get audits in the year
  const audits = await database
    .select()
    .from(sqliteAudits)
    .where(
      and(
        gte(sqliteAudits.scheduledDate, startOfYear),
        lte(sqliteAudits.scheduledDate, endOfYear)
      )
    );

  // Get all findings
  const auditIds = audits.map((a) => a.id);
  let findings: (typeof sqliteAuditFindings.$inferSelect)[] = [];
  if (auditIds.length > 0) {
    findings = await database
      .select()
      .from(sqliteAuditFindings)
      .where(sql`${sqliteAuditFindings.auditId} IN (${sql.join(auditIds.map(id => sql`${id}`), sql`, `)})`);
  }

  const chapters = [];
  const GMP_CHAPTER_NAMES: Record<number, string> = {
    1: 'หมวด 1 - ระบบบริหารคุณภาพ',
    2: 'หมวด 2 - บุคลากร',
    3: 'หมวด 3 - อาคารสถานที่และเครื่องมือ',
    4: 'หมวด 4 - การสุขาภิบาลและสุขอนามัย',
    5: 'หมวด 5 - เอกสารและข้อมูล',
    6: 'หมวด 6 - การดำเนินการผลิต',
    7: 'หมวด 7 - การควบคุมคุณภาพ',
    8: 'หมวด 8 - การจ้างผลิตและจ้างตรวจวิเคราะห์',
    9: 'หมวด 9 - ข้อร้องเรียนและการเรียกคืน',
    10: 'หมวด 10 - การตรวจสอบตนเอง',
  };

  for (let chapter = 1; chapter <= 10; chapter++) {
    // Audits covering this chapter
    const chapterAudits = audits.filter((a) => {
      const chs = a.gmpChapters ? JSON.parse(a.gmpChapters) : [];
      return chs.includes(chapter);
    });

    const completedChapterAudits = chapterAudits.filter((a) => a.status === 'completed');

    // Findings for this chapter
    const chapterFindings = findings.filter((f) => f.gmpChapter === chapter);

    // Last audit date for this chapter
    const lastAudit = completedChapterAudits
      .filter((a) => a.actualDate)
      .sort((a, b) => b.actualDate!.localeCompare(a.actualDate!))[0];

    chapters.push({
      chapter,
      name: GMP_CHAPTER_NAMES[chapter] || `Chapter ${chapter}`,
      auditsPlanned: chapterAudits.length,
      auditsCompleted: completedChapterAudits.length,
      findingsCount: chapterFindings.length,
      lastAuditDate: lastAudit?.actualDate || null,
    });
  }

  return {
    year,
    chapters,
  };
}
