/**
 * Procedure Step ↔ IPC Criteria link service
 *
 * IPC checks attached to a specific procedure step within an SOP Template.
 * Surfaced on the WO SOP Execution "Complete Step" dialog so operators record
 * everything on one screen.
 */

import { eq, and, asc, inArray } from 'drizzle-orm';
import { getTableRef, executeDbOperation, getInsertId } from '../db/db-helper';

export interface ProcedureStepIPCRow {
  id: number;
  procedureStepId: number;
  criteriaId: number;
  sequence: number;
  sampleSize: number;
  isCritical: boolean;
  notes: string | null;
  // Joined from ipc_criteria
  criteriaCode: string;
  criteriaName: string;
  criteriaNameTh: string | null;
  specification: string | null;
  minValue: number | null;
  maxValue: number | null;
  specTarget: number | null;
  specTolerancePercent: number;
  unit: string | null;
  criteriaType: string;
  testMethod: string | null;
  isCriteriaCritical: boolean;
}

export async function listProcedureStepIPC(procedureStepId: number): Promise<ProcedureStepIPCRow[]> {
  return executeDbOperation(async (db) => {
    const link = getTableRef('sOPTemplateIPCCriteria');
    const ipc = getTableRef('iPCCriteria');

    const rows = await db
      .select({
        id: link.id,
        procedureStepId: link.procedureStepId,
        criteriaId: link.criteriaId,
        sequence: link.sequence,
        sampleSize: link.sampleSize,
        isCritical: link.isCritical,
        notes: link.notes,
        criteriaCode: ipc.code,
        criteriaName: ipc.name,
        criteriaNameTh: ipc.nameTh,
        specification: ipc.specification,
        minValue: ipc.minValue,
        maxValue: ipc.maxValue,
        specTarget: ipc.specTarget,
        specTolerancePercent: ipc.specTolerancePercent,
        unit: ipc.unit,
        criteriaType: ipc.criteriaType,
        testMethod: ipc.testMethod,
        isCriteriaCritical: ipc.isCritical,
      })
      .from(link)
      .innerJoin(ipc, eq(link.criteriaId, ipc.id))
      .where(eq(link.procedureStepId, procedureStepId))
      .orderBy(asc(link.sequence), asc(link.id));

    return rows as ProcedureStepIPCRow[];
  });
}

/**
 * Batch-load IPC criteria for many procedure steps at once — used by the WO
 * SOP execution page to fetch all criteria in a single query.
 */
export async function listIPCForSteps(
  procedureStepIds: number[]
): Promise<Record<number, ProcedureStepIPCRow[]>> {
  if (procedureStepIds.length === 0) return {};
  return executeDbOperation(async (db) => {
    const link = getTableRef('sOPTemplateIPCCriteria');
    const ipc = getTableRef('iPCCriteria');

    const rows = await db
      .select({
        id: link.id,
        procedureStepId: link.procedureStepId,
        criteriaId: link.criteriaId,
        sequence: link.sequence,
        sampleSize: link.sampleSize,
        isCritical: link.isCritical,
        notes: link.notes,
        criteriaCode: ipc.code,
        criteriaName: ipc.name,
        criteriaNameTh: ipc.nameTh,
        specification: ipc.specification,
        minValue: ipc.minValue,
        maxValue: ipc.maxValue,
        specTarget: ipc.specTarget,
        specTolerancePercent: ipc.specTolerancePercent,
        unit: ipc.unit,
        criteriaType: ipc.criteriaType,
        testMethod: ipc.testMethod,
        isCriteriaCritical: ipc.isCritical,
      })
      .from(link)
      .innerJoin(ipc, eq(link.criteriaId, ipc.id))
      .where(inArray(link.procedureStepId, procedureStepIds))
      .orderBy(asc(link.sequence), asc(link.id));

    const grouped: Record<number, ProcedureStepIPCRow[]> = {};
    for (const r of rows as ProcedureStepIPCRow[]) {
      if (!grouped[r.procedureStepId]) grouped[r.procedureStepId] = [];
      grouped[r.procedureStepId].push(r);
    }
    return grouped;
  });
}

export interface AddLinkInput {
  procedureStepId: number;
  criteriaId: number;
  sequence?: number;
  sampleSize?: number;
  isCritical?: boolean;
  notes?: string | null;
}

export async function addProcedureStepIPC(input: AddLinkInput): Promise<{ id: number }> {
  return executeDbOperation(async (db) => {
    const link = getTableRef('sOPTemplateIPCCriteria');

    // Reject duplicates for the same (step, criteria) pair
    const existing = await db
      .select({ id: link.id })
      .from(link)
      .where(
        and(
          eq(link.procedureStepId, input.procedureStepId),
          eq(link.criteriaId, input.criteriaId)
        )
      )
      .limit(1);
    if (existing.length > 0) {
      throw new Error('DUPLICATE: IPC criteria นี้ถูกผูกกับขั้นตอนนี้อยู่แล้ว');
    }

    const result = await db.insert(link).values({
      procedureStepId: input.procedureStepId,
      criteriaId: input.criteriaId,
      sequence: input.sequence ?? 1,
      sampleSize: input.sampleSize ?? 1,
      isCritical: input.isCritical ?? false,
      notes: input.notes ?? null,
    });

    return { id: getInsertId(result) };
  });
}

export interface UpdateLinkInput {
  sequence?: number;
  sampleSize?: number;
  isCritical?: boolean;
  notes?: string | null;
}

export async function updateProcedureStepIPC(linkId: number, input: UpdateLinkInput): Promise<void> {
  return executeDbOperation(async (db) => {
    const link = getTableRef('sOPTemplateIPCCriteria');
    const patch: Record<string, unknown> = {};
    if (input.sequence !== undefined) patch.sequence = input.sequence;
    if (input.sampleSize !== undefined) patch.sampleSize = input.sampleSize;
    if (input.isCritical !== undefined) patch.isCritical = input.isCritical;
    if (input.notes !== undefined) patch.notes = input.notes;
    if (Object.keys(patch).length === 0) return;
    await db.update(link).set(patch).where(eq(link.id, linkId));
  });
}

export async function removeProcedureStepIPC(linkId: number): Promise<void> {
  return executeDbOperation(async (db) => {
    const link = getTableRef('sOPTemplateIPCCriteria');
    await db.delete(link).where(eq(link.id, linkId));
  });
}
