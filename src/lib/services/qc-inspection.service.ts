/**
 * QC Inspection (Audit Q5)
 * QA team's own inspection records, independent of the production BOM.
 * Each record may link to a Work Order — the UI exposes that as an
 * "open eBMR" link without making the inspection a child of the BOM.
 */
import { and, desc, eq, like, sql } from 'drizzle-orm';
import { executeDbOperation, getTableRef, getInsertId, isSqlite } from '../db/db-helper';
import { getNow } from '../db/date-utils';

export type InspectionType = 'incoming' | 'in_process' | 'finished' | 'ad_hoc';
export type OverallResult = 'pending' | 'pass' | 'fail';

export interface CreateInspectionInput {
  workOrderId?: number | null;
  batchNumber?: string | null;
  inspectionType: InspectionType;
  subject: string;
  findings?: string | null;
  overallResult?: OverallResult;
  inspectorId: number;
  inspectedAt?: string;
  notes?: string | null;
}

export interface UpdateInspectionInput {
  findings?: string | null;
  overallResult?: OverallResult;
  subject?: string;
  notes?: string | null;
}

/**
 * Generate QCI-{YYYY}-{4digit} number. Sequence resets each calendar year.
 */
async function generateInspectionNumber(): Promise<string> {
  return executeDbOperation(async (db: any) => {
    const tbl = getTableRef('qcInspections');
    const year = new Date().getFullYear();
    const prefix = `QCI-${year}-`;
    const existing = await db
      .select({ inspectionNumber: tbl.inspectionNumber })
      .from(tbl)
      .where(like(tbl.inspectionNumber, `${prefix}%`))
      .orderBy(desc(tbl.id))
      .limit(1);

    let next = 1;
    if (existing.length > 0) {
      const last = String(existing[0].inspectionNumber);
      const n = Number(last.split('-').pop());
      if (Number.isFinite(n)) next = n + 1;
    }
    return prefix + String(next).padStart(4, '0');
  });
}

export async function createInspection(data: CreateInspectionInput) {
  if (!data.subject?.trim()) throw new Error('subject is required');
  if (!data.inspectorId) throw new Error('inspectorId is required');

  const inspectionNumber = await generateInspectionNumber();
  const inspectedAt = data.inspectedAt ?? new Date().toISOString();

  return executeDbOperation(async (db: any) => {
    const tbl = getTableRef('qcInspections');
    const values: Record<string, unknown> = {
      inspectionNumber,
      workOrderId: data.workOrderId ?? null,
      batchNumber: data.batchNumber ?? null,
      inspectionType: data.inspectionType,
      subject: data.subject.trim(),
      findings: data.findings ?? null,
      overallResult: data.overallResult ?? 'pending',
      inspectorId: data.inspectorId,
      inspectedAt: isSqlite() ? inspectedAt : new Date(inspectedAt),
      notes: data.notes ?? null,
      createdAt: getNow(),
      updatedAt: getNow(),
    };

    if (isSqlite()) {
      const [row] = await db.insert(tbl).values(values).returning();
      return row;
    } else {
      const result = await db.insert(tbl).values(values);
      const id = Number(getInsertId(result));
      const [row] = await db.select().from(tbl).where(eq(tbl.id, id));
      return row;
    }
  });
}

export async function updateInspection(id: number, data: UpdateInspectionInput) {
  return executeDbOperation(async (db: any) => {
    const tbl = getTableRef('qcInspections');
    const values: Record<string, unknown> = { updatedAt: getNow() };
    if (data.findings !== undefined) values.findings = data.findings;
    if (data.overallResult !== undefined) values.overallResult = data.overallResult;
    if (data.subject !== undefined) values.subject = data.subject.trim();
    if (data.notes !== undefined) values.notes = data.notes;

    if (isSqlite()) {
      const [row] = await db.update(tbl).set(values).where(eq(tbl.id, id)).returning();
      return row;
    } else {
      await db.update(tbl).set(values).where(eq(tbl.id, id));
      const [row] = await db.select().from(tbl).where(eq(tbl.id, id));
      return row;
    }
  });
}

export interface ListInspectionsFilter {
  workOrderId?: number;
  inspectionType?: InspectionType;
  overallResult?: OverallResult;
  limit?: number;
}

export async function listInspections(filter: ListInspectionsFilter = {}) {
  return executeDbOperation(async (db: any) => {
    const tbl = getTableRef('qcInspections');
    const users = getTableRef('users');
    const workOrders = getTableRef('workOrders');

    const conditions: any[] = [];
    if (filter.workOrderId) conditions.push(eq(tbl.workOrderId, filter.workOrderId));
    if (filter.inspectionType) conditions.push(eq(tbl.inspectionType, filter.inspectionType));
    if (filter.overallResult) conditions.push(eq(tbl.overallResult, filter.overallResult));

    let q = db
      .select({
        id: tbl.id,
        inspectionNumber: tbl.inspectionNumber,
        workOrderId: tbl.workOrderId,
        workOrderNumber: workOrders.woNumber,
        batchNumber: tbl.batchNumber,
        inspectionType: tbl.inspectionType,
        subject: tbl.subject,
        findings: tbl.findings,
        overallResult: tbl.overallResult,
        inspectorId: tbl.inspectorId,
        inspectorName: users.name,
        inspectedAt: tbl.inspectedAt,
        notes: tbl.notes,
        createdAt: tbl.createdAt,
      })
      .from(tbl)
      .leftJoin(users, eq(tbl.inspectorId, users.id))
      .leftJoin(workOrders, eq(tbl.workOrderId, workOrders.id));

    if (conditions.length > 0) q = q.where(and(...conditions));
    q = q.orderBy(desc(tbl.inspectedAt));
    if (filter.limit) q = q.limit(filter.limit);
    return q;
  });
}

export async function getInspection(id: number) {
  const rows = await listInspections({ limit: undefined });
  return rows.find((r: any) => r.id === id) || null;
}
