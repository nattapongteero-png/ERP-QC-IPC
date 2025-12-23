/**
 * Internal Audit Service
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 10)
 *
 * Business logic for audit plans, audits, and findings.
 */

import { eq, and, desc, sql, gte, lte } from 'drizzle-orm';
import { getDb, isSqlite } from '../db';
import { getNow, toDbDate, getTodayStr } from '../db/date-utils';
import {
  sqliteAuditPlans,
  sqliteAudits,
  sqliteAuditFindings,
  sqliteUsers,
  sqliteCapa,
  mysqlAuditPlans,
  mysqlAudits,
  mysqlAuditFindings,
  mysqlUsers,
  mysqlCapa,
} from '../db/schema';

/**
 * Get database-specific table references
 */
function getTables() {
  if (isSqlite()) {
    return {
      auditPlans: sqliteAuditPlans,
      audits: sqliteAudits,
      findings: sqliteAuditFindings,
      users: sqliteUsers,
      capa: sqliteCapa,
    };
  }
  return {
    auditPlans: mysqlAuditPlans,
    audits: mysqlAudits,
    findings: mysqlAuditFindings,
    users: mysqlUsers,
    capa: mysqlCapa,
  };
}
import { createAuditLog } from '../audit';
import type {
  AuditPlan,
  AuditPlanCreate,
  AuditPlanUpdate,
  Audit,
  AuditCreate,
  AuditUpdate,
  AuditCompleteRequest,
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
  GenerateAuditScheduleOptions,
  CreateCapaFromFindingOptions,
  FindingClosureVerification,
} from '@/types/audits';
import { createCapa, getCapaById } from './capa-service';

// ============================================
// Audit Plans
// ============================================

/**
 * Get all audit plans with optional filters
 */
export async function getAuditPlans(
  params: AuditPlanListParams = {}
): Promise<AuditPlan[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;
  const { auditPlans, audits, users } = getTables();
  const conditions = [];

  if (params.year) {
    conditions.push(eq(auditPlans.planYear, params.year));
  }
  if (params.status) {
    conditions.push(eq(auditPlans.status, params.status));
  }

  const plans = await database
    .select({
      plan: auditPlans,
      approver: users,
      creator: users,
    })
    .from(auditPlans)
    .leftJoin(users, eq(auditPlans.approvedBy, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(auditPlans.planYear));

  // Enrich with audit counts
  return Promise.all(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    plans.map(async (row: any) => {
      const auditList = await database
        .select()
        .from(audits)
        .where(eq(audits.planId, row.plan.id));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const completedCount = auditList.filter((a: any) => a.status === 'completed').length;

      // Get creator name (second join)
      const creator = await database
        .select()
        .from(users)
        .where(eq(users.id, row.plan.createdBy || 0))
        .limit(1);

      return {
        id: row.plan.id,
        planYear: row.plan.planYear,
        name: row.plan.name || `Audit Plan ${row.plan.planYear}`,
        status: row.plan.status as AuditPlanStatus,
        totalAudits: auditList.length,
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;
  const { auditPlans, audits, users } = getTables();

  const plans = await database
    .select({
      plan: auditPlans,
      approver: users,
    })
    .from(auditPlans)
    .leftJoin(users, eq(auditPlans.approvedBy, users.id))
    .where(eq(auditPlans.id, id))
    .limit(1);

  if (!plans[0]) return null;

  const row = plans[0];

  const auditList = await database
    .select()
    .from(audits)
    .where(eq(audits.planId, id));

  const completedCount = auditList.filter((a: any) => a.status === 'completed').length;

  const creator = await database
    .select()
    .from(users)
    .where(eq(users.id, row.plan.createdBy || 0))
    .limit(1);

  return {
    id: row.plan.id,
    planYear: row.plan.planYear,
    name: row.plan.name || `Audit Plan ${row.plan.planYear}`,
    status: row.plan.status as AuditPlanStatus,
    totalAudits: auditList.length,
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;
  const { auditPlans } = getTables();

  const values = {
    planYear: data.planYear,
    name: data.name,
    status: 'draft',
    createdBy: userId,
    createdAt: getNow(),
  };

  let planId: number;

  if (isSqlite()) {
    const result = await database.insert(auditPlans).values(values).returning();
    planId = result[0].id;
  } else {
    await database.insert(auditPlans).values(values);
    const inserted = await database
      .select({ id: auditPlans.id })
      .from(auditPlans)
      .where(
        and(
          eq(auditPlans.planYear, data.planYear),
          eq(auditPlans.createdBy, userId)
        )
      )
      .orderBy(desc(auditPlans.id))
      .limit(1);
    planId = inserted[0].id;
  }

  await createAuditLog({
    userId,
    action: 'CREATE',
    tableName: 'audit_plan',
    recordId: planId,
    newValue: values,
  });

  return getAuditPlanById(planId) as Promise<AuditPlan>;
}

/**
 * Update an audit plan
 */
export async function updateAuditPlan(
  id: number,
  data: AuditPlanUpdate,
  userId: number
): Promise<AuditPlan | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;
  const { auditPlans } = getTables();

  const existing = await getAuditPlanById(id);
  if (!existing) return null;

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.status !== undefined) updateData.status = data.status;

  if (Object.keys(updateData).length > 0) {
    await database
      .update(auditPlans)
      .set(updateData)
      .where(eq(auditPlans.id, id));
  }

  await createAuditLog({
    userId,
    action: 'UPDATE',
    tableName: 'audit_plan',
    recordId: id,
    oldValue: existing,
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;
  const { auditPlans } = getTables();

  const existing = await getAuditPlanById(id);
  if (!existing) return null;
  if (existing.status !== 'draft') return null;

  await database
    .update(auditPlans)
    .set({
      status: 'approved',
      approvedBy: userId,
      approvedAt: getNow(),
    })
    .where(eq(auditPlans.id, id));

  await createAuditLog({
    userId,
    action: 'APPROVE',
    tableName: 'audit_plan',
    recordId: id,
    oldValue: existing,
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;
  const { audits } = getTables();
  const now = new Date();
  const yearMonth = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prefix = `AUD-${yearMonth}-`;

  const existing = await database
    .select()
    .from(audits)
    .where(sql`${audits.auditNumber} LIKE ${prefix + '%'}`)
    .orderBy(desc(audits.auditNumber))
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;
  const { audits, users, findings } = getTables();
  const page = params.page || 1;
  const limit = params.limit || 20;
  const offset = (page - 1) * limit;

  const conditions = [];

  if (params.planId) {
    conditions.push(eq(audits.planId, params.planId));
  }
  if (params.auditType) {
    conditions.push(eq(audits.auditType, params.auditType));
  }
  if (params.status) {
    conditions.push(eq(audits.status, params.status));
  }
  if (params.fromDate) {
    conditions.push(gte(audits.scheduledDate, params.fromDate));
  }
  if (params.toDate) {
    conditions.push(lte(audits.scheduledDate, params.toDate));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  let auditList = await database
    .select({
      audit: audits,
      leadAuditor: users,
    })
    .from(audits)
    .leftJoin(users, eq(audits.leadAuditorId, users.id))
    .where(whereClause)
    .orderBy(desc(audits.scheduledDate))
    .limit(limit)
    .offset(offset);

  // Filter by GMP chapter if specified
  if (params.gmpChapter) {
    auditList = auditList.filter((a: any) => {
      const chapters = a.audit.gmpChapters ? JSON.parse(a.audit.gmpChapters) : [];
      return chapters.includes(params.gmpChapter);
    });
  }

  const countResult = await database
    .select({ count: sql<number>`count(*)` })
    .from(audits)
    .where(whereClause);

  // Enrich with findings counts
  const enrichedAudits = await Promise.all(
    auditList.map(async (row: any) => {
      const findingsList = await database
        .select()
        .from(findings)
        .where(eq(findings.auditId, row.audit.id));

      const openCount = findingsList.filter((f: any) => f.status !== 'closed').length;

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
        findingsCount: findingsList.length,
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;
  const { audits, users, findings, capa } = getTables();

  const auditList = await database
    .select({
      audit: audits,
      leadAuditor: users,
    })
    .from(audits)
    .leftJoin(users, eq(audits.leadAuditorId, users.id))
    .where(eq(audits.id, id))
    .limit(1);

  if (!auditList[0]) return null;

  const row = auditList[0];

  // Get findings
  const findingsRows = await database
    .select({
      finding: findings,
      owner: users,
      capa: capa,
    })
    .from(findings)
    .leftJoin(users, eq(findings.areaOwner, users.id))
    .leftJoin(capa, eq(findings.capaId, capa.id))
    .where(eq(findings.auditId, id))
    .orderBy(findings.findingNumber);

  const findingsList: AuditFinding[] = findingsRows.map((fr: any) => ({
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

  const openCount = findingsList.filter((f: any) => f.status !== 'closed').length;

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
    findingsCount: findingsList.length,
    openFindingsCount: openCount,
    summary: row.audit.summary,
    reportPath: row.audit.reportPath,
    closedDate: row.audit.closedDate,
    createdAt: row.audit.createdAt,
    findings: findingsList,
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;
  const { audits } = getTables();

  const auditNumber = await generateAuditNumber();

  const values = {
    auditNumber,
    planId: data.planId || null,
    auditType: data.auditType,
    scope: data.scope,
    gmpChapters: JSON.stringify(data.gmpChapters),
    scheduledDate: toDbDate(data.scheduledDate),
    leadAuditorId: data.leadAuditorId,
    auditTeam: data.auditTeam ? JSON.stringify(data.auditTeam) : null,
    status: 'scheduled',
    createdAt: getNow(),
  };

  let auditId: number;

  if (isSqlite()) {
    const result = await database.insert(audits).values(values).returning();
    auditId = result[0].id;
  } else {
    await database.insert(audits).values(values);
    const inserted = await database
      .select({ id: audits.id })
      .from(audits)
      .where(eq(audits.auditNumber, auditNumber))
      .limit(1);
    auditId = inserted[0].id;
  }

  await createAuditLog({
    userId,
    action: 'CREATE',
    tableName: 'audit',
    recordId: auditId,
    newValue: values,
  });

  const audit = await getAuditById(auditId);
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;
  const { audits } = getTables();

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
      .update(audits)
      .set(updateData)
      .where(eq(audits.id, id));
  }

  await createAuditLog({
    userId,
    action: 'UPDATE',
    tableName: 'audit',
    recordId: id,
    oldValue: existing,
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;
  const { audits, auditPlans } = getTables();

  const existing = await getAuditById(id);
  if (!existing) return null;
  if (existing.status !== 'scheduled') return null;

  await database
    .update(audits)
    .set({
      status: 'in_progress',
      actualDate: toDbDate(getTodayStr()),
    })
    .where(eq(audits.id, id));

  // If part of a plan, update plan status
  if (existing.planId) {
    const plan = await getAuditPlanById(existing.planId);
    if (plan && plan.status === 'approved') {
      await database
        .update(auditPlans)
        .set({ status: 'in_progress' })
        .where(eq(auditPlans.id, existing.planId));
    }
  }

  await createAuditLog({
    userId,
    action: 'UPDATE',
    tableName: 'audit',
    recordId: id,
    oldValue: existing,
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;
  const { audits } = getTables();

  const existing = await getAuditById(id);
  if (!existing) return null;
  if (existing.status !== 'in_progress') return null;

  await database
    .update(audits)
    .set({
      status: 'completed',
      summary: data.summary || null,
      reportPath: data.reportPath || null,
      closedDate: toDbDate(getTodayStr()),
    })
    .where(eq(audits.id, id));

  await createAuditLog({
    userId,
    action: 'UPDATE',
    tableName: 'audit',
    recordId: id,
    oldValue: existing,
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;
  const { findings } = getTables();

  const existing = await database
    .select()
    .from(findings)
    .where(eq(findings.auditId, auditId))
    .orderBy(desc(findings.findingNumber));

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;
  const { audits, users, findings, capa } = getTables();
  const page = params.page || 1;
  const limit = params.limit || 20;
  const offset = (page - 1) * limit;

  const conditions = [];

  if (params.auditId) {
    conditions.push(eq(findings.auditId, params.auditId));
  }
  if (params.category) {
    conditions.push(eq(findings.category, params.category));
  }
  if (params.gmpChapter) {
    conditions.push(eq(findings.gmpChapter, params.gmpChapter));
  }
  if (params.status) {
    conditions.push(eq(findings.status, params.status));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const findingsList = await database
    .select({
      finding: findings,
      audit: audits,
      owner: users,
      capa: capa,
    })
    .from(findings)
    .leftJoin(audits, eq(findings.auditId, audits.id))
    .leftJoin(users, eq(findings.areaOwner, users.id))
    .leftJoin(capa, eq(findings.capaId, capa.id))
    .where(whereClause)
    .orderBy(desc(findings.createdAt))
    .limit(limit)
    .offset(offset);

  const countResult = await database
    .select({ count: sql<number>`count(*)` })
    .from(findings)
    .where(whereClause);

  return {
    findings: findingsList.map((row: any) => ({
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;
  const { audits, users, findings, capa } = getTables();

  const findingsList = await database
    .select({
      finding: findings,
      audit: audits,
      owner: users,
      capa: capa,
    })
    .from(findings)
    .leftJoin(audits, eq(findings.auditId, audits.id))
    .leftJoin(users, eq(findings.areaOwner, users.id))
    .leftJoin(capa, eq(findings.capaId, capa.id))
    .where(eq(findings.id, id))
    .limit(1);

  if (!findingsList[0]) return null;

  const row = findingsList[0];
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;
  const { findings } = getTables();

  const findingNumber = await generateFindingNumber(data.auditId);

  const values = {
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
    createdAt: getNow(),
  };

  let findingId: number;

  if (isSqlite()) {
    const result = await database.insert(findings).values(values).returning();
    findingId = result[0].id;
  } else {
    await database.insert(findings).values(values);
    const inserted = await database
      .select({ id: findings.id })
      .from(findings)
      .where(
        and(
          eq(findings.auditId, data.auditId),
          eq(findings.findingNumber, findingNumber)
        )
      )
      .limit(1);
    findingId = inserted[0].id;
  }

  await createAuditLog({
    userId,
    action: 'CREATE',
    tableName: 'audit_finding',
    recordId: findingId,
    newValue: values,
  });

  return getAuditFindingById(findingId) as Promise<AuditFinding>;
}

/**
 * Update a finding
 */
export async function updateAuditFinding(
  id: number,
  data: AuditFindingUpdate,
  userId: number
): Promise<AuditFinding | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;
  const { findings } = getTables();

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
      .update(findings)
      .set(updateData)
      .where(eq(findings.id, id));
  }

  await createAuditLog({
    userId,
    action: 'UPDATE',
    tableName: 'audit_finding',
    recordId: id,
    oldValue: existing,
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;
  const { findings } = getTables();

  const existing = await getAuditFindingById(findingId);
  if (!existing) return null;

  await database
    .update(findings)
    .set({
      capaId,
      status: 'capa_assigned',
    })
    .where(eq(findings.id, findingId));

  await createAuditLog({
    userId,
    action: 'UPDATE',
    tableName: 'audit_finding',
    recordId: findingId,
    oldValue: existing,
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;
  const { findings } = getTables();

  const existing = await getAuditFindingById(id);
  if (!existing) return null;

  // Cannot close if CAPA required but not assigned
  if (existing.capaRequired && !existing.capaId) {
    throw new Error('Cannot close finding: CAPA is required but not assigned');
  }

  await database
    .update(findings)
    .set({
      status: 'closed',
      closedDate: toDbDate(getTodayStr()),
      closedBy: userId,
    })
    .where(eq(findings.id, id));

  await createAuditLog({
    userId,
    action: 'UPDATE',
    tableName: 'audit_finding',
    recordId: id,
    oldValue: existing,
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;
  const { audits, findings } = getTables();

  const startOfYear = `${year}-01-01`;
  const endOfYear = `${year}-12-31`;

  // Get audits in the year
  const auditList = await database
    .select()
    .from(audits)
    .where(
      and(
        gte(audits.scheduledDate, startOfYear),
        lte(audits.scheduledDate, endOfYear)
      )
    );

  const completedAudits = auditList.filter((a: any) => a.status === 'completed');

  // Get all findings from these audits
  const auditIds = auditList.map((a: any) => a.id);
  let findingsList: any[] = [];
  if (auditIds.length > 0) {
    findingsList = await database
      .select()
      .from(findings)
      .where(sql`${findings.auditId} IN (${sql.join(auditIds.map((id: any) => sql`${id}`), sql`, `)})`);
  }

  const findingsByCategory = {
    observation: findingsList.filter((f: any) => f.category === 'observation').length,
    minor: findingsList.filter((f: any) => f.category === 'minor').length,
    major: findingsList.filter((f: any) => f.category === 'major').length,
    critical: findingsList.filter((f: any) => f.category === 'critical').length,
  };

  const openFindings = findingsList.filter((f: any) => f.status !== 'closed').length;

  // Calculate average closure time
  const closedFindings = findingsList.filter((f: any) => f.status === 'closed' && f.closedDate);
  let avgCapaClosureTime = 0;
  if (closedFindings.length > 0) {
    const totalDays = closedFindings.reduce((sum: number, f: any) => {
      const created = new Date(f.createdAt);
      const closed = new Date(f.closedDate!);
      return sum + Math.floor((closed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
    }, 0);
    avgCapaClosureTime = Math.round(totalDays / closedFindings.length);
  }

  return {
    year,
    totalPlanned: auditList.length,
    totalCompleted: completedAudits.length,
    completionRate: auditList.length > 0 ? (completedAudits.length / auditList.length) * 100 : 0,
    totalFindings: findingsList.length,
    findingsByCategory,
    openFindings,
    avgCapaClosureTime,
  };
}

/**
 * Get GMP chapter coverage for a year
 */
export async function getChapterCoverage(year: number): Promise<ChapterCoverage> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;
  const { audits, findings } = getTables();

  const startOfYear = `${year}-01-01`;
  const endOfYear = `${year}-12-31`;

  // Get audits in the year
  const auditList = await database
    .select()
    .from(audits)
    .where(
      and(
        gte(audits.scheduledDate, startOfYear),
        lte(audits.scheduledDate, endOfYear)
      )
    );

  // Get all findings
  const auditIds = auditList.map((a: any) => a.id);
  let findingsList: any[] = [];
  if (auditIds.length > 0) {
    findingsList = await database
      .select()
      .from(findings)
      .where(sql`${findings.auditId} IN (${sql.join(auditIds.map((id: any) => sql`${id}`), sql`, `)})`);
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
    const chapterAudits = auditList.filter((a: any) => {
      const chs = a.gmpChapters ? JSON.parse(a.gmpChapters) : [];
      return chs.includes(chapter);
    });

    const completedChapterAudits = chapterAudits.filter((a: any) => a.status === 'completed');

    // Findings for this chapter
    const chapterFindings = findingsList.filter((f: any) => f.gmpChapter === chapter);

    // Last audit date for this chapter
    const lastAudit = completedChapterAudits
      .filter((a: any) => a.actualDate)
      .sort((a: any, b: any) => b.actualDate!.localeCompare(a.actualDate!))[0];

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

// ============================================
// T902: Generate Audit Schedule
// ============================================

/**
 * Generate audit schedule covering all 10 GMP chapters
 * Creates audits distributed across the year, each covering 1-2 chapters
 */
export async function generateAuditSchedule(
  planId: number,
  options: GenerateAuditScheduleOptions = {}
): Promise<Audit[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;
  const { users } = getTables();

  // Verify plan exists
  const plan = await getAuditPlanById(planId);
  if (!plan) {
    throw new Error(`Audit plan ${planId} not found`);
  }

  // Get default auditor (first available user if not provided)
  let leadAuditorId = options.auditorId;
  if (!leadAuditorId) {
    const userList = await database.select().from(users).where(eq(users.isActive, 1)).limit(1);
    if (userList.length === 0) {
      throw new Error('No active users found to assign as auditor');
    }
    leadAuditorId = userList[0].id;
  }

  const createdAudits: Audit[] = [];

  // Define audit schedule: Each audit covers 1-2 GMP chapters
  // Distribute across 12 months (monthly audits)
  const auditGroups: Array<{ chapters: number[]; month: number }> = [
    { chapters: [1], month: 1 },      // หมวด 1 - ระบบบริหารคุณภาพ
    { chapters: [2], month: 2 },      // หมวด 2 - บุคลากร
    { chapters: [3], month: 3 },      // หมวด 3 - อาคารสถานที่
    { chapters: [4], month: 4 },      // หมวด 4 - สุขาภิบาล
    { chapters: [5], month: 5 },      // หมวด 5 - เอกสารและข้อมูล
    { chapters: [6], month: 6 },      // หมวด 6 - การดำเนินการผลิต
    { chapters: [7], month: 7 },      // หมวด 7 - การควบคุมคุณภาพ
    { chapters: [8], month: 8 },      // หมวด 8 - การจ้างผลิต
    { chapters: [9], month: 9 },      // หมวด 9 - ข้อร้องเรียน
    { chapters: [10], month: 10 },    // หมวด 10 - การตรวจสอบตนเอง
  ];

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

  // Create audits for each group
  for (const group of auditGroups) {
    const scheduledDate = `${plan.planYear}-${String(group.month).padStart(2, '0')}-15`;

    const scope = group.chapters.map(ch => GMP_CHAPTER_NAMES[ch]).join(', ');

    const audit = await createAudit(
      {
        planId,
        auditType: 'internal',
        scope,
        gmpChapters: group.chapters,
        scheduledDate,
        leadAuditorId,
      },
      leadAuditorId
    );

    createdAudits.push(audit);
  }

  return createdAudits;
}

// ============================================
// T905: Create CAPA from Finding
// ============================================

/**
 * Create a new CAPA record from an audit finding
 * Links the CAPA back to the finding via assignCapaToFinding()
 */
export async function createCapaFromFinding(
  findingId: number,
  userId: number,
  capaData?: CreateCapaFromFindingOptions
): Promise<AuditFinding> {
  // Get the finding
  const finding = await getAuditFindingById(findingId);
  if (!finding) {
    throw new Error(`Finding ${findingId} not found`);
  }

  // Determine CAPA owner
  const ownerId = capaData?.assignedTo || userId;

  // Determine due date (default to 30 days from now)
  let dueDate = capaData?.dueDate;
  if (!dueDate) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    dueDate = futureDate.toISOString().split('T')[0];
  }

  // Create CAPA title from finding
  const title = `CAPA for Audit Finding ${finding.findingNumber}: ${finding.description.substring(0, 50)}${finding.description.length > 50 ? '...' : ''}`;

  // Create the CAPA
  const capa = await createCapa(
    {
      title,
      sourceType: 'audit_finding',
      sourceId: findingId,
      type: finding.category === 'observation' ? 'preventive' : 'corrective',
      priority: finding.category === 'critical' ? 'critical' : finding.category === 'major' ? 'high' : 'medium',
      ownerId,
      dueDate,
      rootCauseAnalysis: finding.description,
    },
    userId
  );

  // Link CAPA to finding
  const linkedFinding = await assignCapaToFinding(findingId, capa.id, userId);

  return linkedFinding as AuditFinding;
}

// ============================================
// T906: Verify Finding Closure
// ============================================

/**
 * Verify if an audit finding can be closed
 * Checks CAPA requirements and status
 */
export async function verifyFindingClosure(
  findingId: number
): Promise<FindingClosureVerification> {
  // Get the finding
  const finding = await getAuditFindingById(findingId);
  if (!finding) {
    throw new Error(`Finding ${findingId} not found`);
  }

  // If CAPA not required, can close immediately
  if (!finding.capaRequired) {
    return { canClose: true };
  }

  // If CAPA required, check if assigned
  if (!finding.capaId) {
    return {
      canClose: false,
      reason: 'CAPA is required but not assigned to this finding',
    };
  }

  // Check CAPA status
  const capa = await getCapaById(finding.capaId);
  if (!capa) {
    return {
      canClose: false,
      reason: 'Linked CAPA not found',
    };
  }

  // CAPA must be 'closed' or 'effective' to allow finding closure
  if (capa.status === 'closed' || capa.status === 'effective') {
    return {
      canClose: true,
      capaStatus: capa.status,
    };
  }

  return {
    canClose: false,
    reason: `CAPA status is '${capa.status}' - must be 'closed' or 'effective'`,
    capaStatus: capa.status,
  };
}
