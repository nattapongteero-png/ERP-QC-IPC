/**
 * Work-order pre-production equipment inspection. Pulls the equipment a BOM
 * requires for a phase (bom_equipment) and lets the operator record a pass/fail
 * inspection per the equipment's checklist before production starts. Replaces the
 * old "verify scale before weighing" gate with an explicit pre-production step.
 */
import { executeDbOperation, getInsertId, getTableRef } from '../db/db-helper';
import { getNow } from '../db/date-utils';
import { eq, and, desc } from 'drizzle-orm';
import { getBOMEquipment, getBOMSOPSteps } from './bom-configuration.service';

function getTables() {
  return {
    inspections: getTableRef('wOEquipmentInspection'),
    workOrders: getTableRef('workOrders'),
    equipment: getTableRef('productionEquipment'),
  };
}

export interface WOEquipmentInspectionSopStep {
  name: string;         // stepNameTh || stepName
  instructions: string; // instructionsTh || instructions — วิธีการตรวจ
}

export interface WOEquipmentInspectionItem {
  bomEquipmentId: number;
  equipmentId: number;
  code: string;
  name: string;
  nameTh: string;
  equipmentType: string;
  // Inspection checklist items. Derived from the BOM's SOP steps that reference
  // this equipment for the phase (each SOP step = one check item); falls back to
  // the equipment's own inspectionChecklist when no SOP step references it.
  checklist: string[];
  // The SOP steps (with instructions = วิธีการตรวจ) that define how to inspect.
  sopSteps: WOEquipmentInspectionSopStep[];
  isRequired: boolean;
  sequence: number;
  // Latest inspection for this equipment on this WO+phase, if any.
  result: string | null;
  performedAt: string | null;
}

export async function getWOEquipmentInspectionItems(
  workOrderId: number,
  phase = 'pre_production',
): Promise<WOEquipmentInspectionItem[]> {
  const t = getTables();

  // Resolve the work order's BOM.
  const bomId = await executeDbOperation(async (db) => {
    const rows = await db.select({ bomId: t.workOrders.bomId }).from(t.workOrders).where(eq(t.workOrders.id, workOrderId));
    return (rows[0]?.bomId as number | undefined) ?? null;
  });
  if (!bomId) return [];

  // Equipment the BOM requires for this phase.
  const bomEquip = (await getBOMEquipment(bomId, phase)) as {
    bomEquipment: Record<string, unknown>;
    equipment: Record<string, unknown> | null;
  }[];

  // SOP steps that define HOW to inspect each equipment for this phase — the BOM
  // SOP steps (bom_sop_steps) whose equipmentIds reference the equipment.
  // instructions = วิธีการตรวจ. Built into a map: equipmentId -> steps.
  const sopRows = (await getBOMSOPSteps(bomId)) as {
    bomStep: Record<string, unknown>;
    template: Record<string, unknown> | null;
  }[];
  const sopByEquip = new Map<number, WOEquipmentInspectionSopStep[]>();
  for (const r of sopRows) {
    const step = r.bomStep;
    if ((step.phase as string) !== phase) continue;
    let ids: number[] = [];
    try {
      const parsed = JSON.parse((step.equipmentIds as string) || '[]');
      if (Array.isArray(parsed)) ids = parsed.map(Number).filter((n) => Number.isFinite(n));
    } catch { ids = []; }
    if (!ids.length) continue;
    const tmpl = r.template;
    const name = (step.stepNameTh as string) || (step.stepName as string) || (tmpl?.nameTh as string) || (tmpl?.name as string) || '';
    const instructions = (step.instructionsTh as string) || (step.instructions as string) || (tmpl?.instructionsTh as string) || (tmpl?.instructions as string) || '';
    for (const id of ids) {
      const arr = sopByEquip.get(id) || [];
      arr.push({ name, instructions });
      sopByEquip.set(id, arr);
    }
  }

  // Existing inspections for this WO+phase (latest per equipment).
  const existing = await executeDbOperation(async (db) => {
    return db
      .select()
      .from(t.inspections)
      .where(and(eq(t.inspections.workOrderId, workOrderId), eq(t.inspections.phase, phase)))
      .orderBy(desc(t.inspections.performedAt));
  });
  const latestByEquip = new Map<number, Record<string, unknown>>();
  for (const ins of existing as Record<string, unknown>[]) {
    const eid = ins.equipmentId as number;
    if (!latestByEquip.has(eid)) latestByEquip.set(eid, ins);
  }

  return bomEquip
    .filter((be) => be.equipment)
    .map((row) => {
      const eq0 = row.equipment as Record<string, unknown>;
      const bomEq = row.bomEquipment as Record<string, unknown>;
      let checklist: string[] = [];
      try {
        const parsed = JSON.parse((eq0.inspectionChecklist as string) || '[]');
        if (Array.isArray(parsed)) checklist = parsed.map(String);
      } catch {
        checklist = [];
      }
      const last = latestByEquip.get(eq0.id as number);
      const sopSteps = sopByEquip.get(eq0.id as number) || [];
      // Prefer the SOP-derived checklist (each SOP step name = one check item);
      // fall back to the equipment's own inspectionChecklist when no SOP step
      // references it.
      const sopChecklist = sopSteps.map((s) => s.name).filter(Boolean);
      const finalChecklist = sopChecklist.length ? sopChecklist : checklist;
      return {
        bomEquipmentId: bomEq.id as number,
        equipmentId: eq0.id as number,
        code: eq0.code as string,
        name: eq0.name as string,
        nameTh: eq0.nameTh as string,
        equipmentType: eq0.equipmentType as string,
        checklist: finalChecklist,
        sopSteps,
        isRequired: (bomEq.isRequired as boolean) ?? true,
        sequence: (bomEq.sequence as number) ?? 1,
        result: (last?.result as string | null) ?? null,
        performedAt: (last?.performedAt as string | null) ?? null,
      };
    })
    .sort((a, b) => a.sequence - b.sequence);
}

export interface RecordWOEquipmentInspectionInput {
  workOrderId: number;
  phase?: string;
  equipmentId: number;
  bomEquipmentId?: number;
  result: 'pass' | 'fail';
  checklistResults?: { item: string; ok: boolean; note?: string }[];
  notes?: string;
}

export async function recordWOEquipmentInspection(input: RecordWOEquipmentInspectionInput, userId: number) {
  return executeDbOperation(async (db) => {
    const t = getTables();
    const result = await db.insert(t.inspections).values({
      workOrderId: input.workOrderId,
      phase: input.phase || 'pre_production',
      equipmentId: input.equipmentId,
      bomEquipmentId: input.bomEquipmentId ?? null,
      result: input.result,
      checklistResults: input.checklistResults ? JSON.stringify(input.checklistResults) : null,
      operatorId: userId,
      performedAt: getNow(),
      notes: input.notes || null,
      createdAt: getNow(),
    } as Record<string, unknown>);
    return { id: getInsertId(result) };
  });
}

// Summary counts for the execution dashboard card status.
export async function getWOEquipmentInspectionSummary(workOrderId: number, phase = 'pre_production') {
  const items = await getWOEquipmentInspectionItems(workOrderId, phase);
  const total = items.length;
  const completed = items.filter((i) => i.result != null).length;
  return { total, completed, verified: completed };
}
