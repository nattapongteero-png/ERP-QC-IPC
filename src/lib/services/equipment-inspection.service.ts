/**
 * Equipment Inspection service — the "ทะเบียนตรวจสอบอุปกรณ์" registry that
 * replaces the scale-only verification menu. Records a general pass/fail
 * inspection (per an equipment's checklist) for ANY production_equipment, both
 * in-line and off-line (e.g. air-conditioner). Scales keep their separate
 * standard-weight (ลูกตุ้ม) verification in scale-verification.service.ts.
 */
import { executeDbOperation, getInsertId, getTableRef } from '../db/db-helper';
import { getNow, getTodayStr } from '../db/date-utils';
import { eq, and, desc } from 'drizzle-orm';

function getTables() {
  return {
    inspections: getTableRef('equipmentInspections'),
    equipment: getTableRef('productionEquipment'),
    users: getTableRef('users'),
  };
}

export interface EquipmentInspectionInput {
  equipmentId: number;
  inspectionType?: string; // 'routine' | 'pre_production'
  result: 'pass' | 'fail';
  checklistResults?: { item: string; ok: boolean; note?: string }[];
  notes?: string;
}

// Add N days to a YYYY-MM-DD string (avoids Date.now — uses today from date-utils).
function addDays(fromYmd: string, days: number): string {
  const [y, m, d] = fromYmd.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + days);
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

export type InspectionDueStatus = 'never' | 'ok' | 'due_soon' | 'overdue' | 'no_schedule';

export interface EquipmentInspectionRow {
  id: number;
  code: string;
  name: string;
  nameTh: string;
  equipmentType: string;
  lineCategory: string | null;
  inspectionIntervalDays: number | null;
  inspectionChecklist: string | null;
  /** Equipment is configured to be inspected before every production run. */
  requirePreUseInspection: boolean;
  /** Whether a PASSING inspection already exists for today (covers the whole day). */
  inspectedToday: boolean;
  /** requirePreUseInspection && !inspectedToday — production must not start yet. */
  preUseDueToday: boolean;
  lastResult: string | null;
  lastPerformedAt: string | null;
  nextDueDate: string | null;
  dueStatus: InspectionDueStatus;
}

/** YYYY-MM-DD of a stored performed_at value (string in SQLite, Date in MySQL). */
function toYmd(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    const mm = String(value.getMonth() + 1).padStart(2, '0');
    const dd = String(value.getDate()).padStart(2, '0');
    return `${value.getFullYear()}-${mm}-${dd}`;
  }
  const s = String(value);
  return s.length >= 10 ? s.slice(0, 10) : null;
}

/**
 * Has this equipment already PASSED an inspection today?
 *
 * The pre-use rule is "ตรวจก่อนใช้งานทุกรอบการผลิต — แต่ถ้าวันนั้นตรวจไปแล้ว
 * ไม่ต้องตรวจซ้ำ": the requirement is per production run, but one passing check
 * covers the rest of that calendar day, so a second run on the same day does not
 * ask for another inspection. A FAILED inspection does not count — the equipment
 * has to pass before it can be used.
 */
export async function hasPassedInspectionToday(equipmentId: number): Promise<boolean> {
  return executeDbOperation(async (db) => {
    const t = getTables();
    const rows = await db
      .select({ performedAt: t.inspections.performedAt, result: t.inspections.result })
      .from(t.inspections)
      .where(eq(t.inspections.equipmentId, equipmentId))
      .orderBy(desc(t.inspections.performedAt))
      .limit(50);
    const today = getTodayStr();
    return (rows as Record<string, unknown>[]).some(
      (r) => r.result === 'pass' && toYmd(r.performedAt) === today,
    );
  });
}

// The registry feed: every active equipment + its latest inspection + due status.
export async function listEquipmentForInspection(lineCategory?: string): Promise<EquipmentInspectionRow[]> {
  return executeDbOperation(async (db) => {
    const t = getTables();
    const conditions = [eq(t.equipment.isActive, true)];
    if (lineCategory === 'in_line') {
      // callers that want only in-line; null legacy handled by caller if needed
      conditions.push(eq(t.equipment.lineCategory, 'in_line'));
    } else if (lineCategory === 'off_line') {
      conditions.push(eq(t.equipment.lineCategory, 'off_line'));
    }
    const equipmentRows = await db.select().from(t.equipment).where(and(...conditions)).orderBy(t.equipment.code);

    // Latest inspection per equipment (fetch all, reduce in JS — table is small).
    const allInsp = await db.select().from(t.inspections).orderBy(desc(t.inspections.performedAt));
    const latestByEquip = new Map<number, Record<string, unknown>>();
    for (const ins of allInsp as Record<string, unknown>[]) {
      const eid = ins.equipmentId as number;
      if (!latestByEquip.has(eid)) latestByEquip.set(eid, ins);
    }

    // Which equipment already has a PASSING inspection today — one pass covers the
    // whole calendar day, so a second production run that day doesn't ask again.
    const passedTodayIds = new Set<number>();
    const todayYmd = getTodayStr();
    for (const ins of allInsp as Record<string, unknown>[]) {
      if (ins.result === 'pass' && toYmd(ins.performedAt) === todayYmd) {
        passedTodayIds.add(ins.equipmentId as number);
      }
    }

    const today = getTodayStr();
    return (equipmentRows as Record<string, unknown>[]).map((e) => {
      const last = latestByEquip.get(e.id as number);
      const interval = (e.inspectionIntervalDays as number | null) ?? null;
      const requirePreUse = Boolean(e.requirePreUseInspection);
      const inspectedToday = passedTodayIds.has(e.id as number);
      const nextDue = (last?.nextDueDate as string | null) ?? null;
      let dueStatus: InspectionDueStatus;
      if (!last) {
        dueStatus = interval ? 'never' : 'no_schedule';
      } else if (!interval || !nextDue) {
        dueStatus = 'no_schedule';
      } else if (nextDue < today) {
        dueStatus = 'overdue';
      } else if (nextDue <= addDays(today, 7)) {
        dueStatus = 'due_soon';
      } else {
        dueStatus = 'ok';
      }
      return {
        id: e.id as number,
        code: e.code as string,
        name: e.name as string,
        nameTh: e.nameTh as string,
        equipmentType: e.equipmentType as string,
        lineCategory: (e.lineCategory as string | null) ?? 'in_line',
        inspectionIntervalDays: interval,
        inspectionChecklist: (e.inspectionChecklist as string | null) ?? null,
        requirePreUseInspection: requirePreUse,
        inspectedToday,
        preUseDueToday: requirePreUse && !inspectedToday,
        lastResult: (last?.result as string | null) ?? null,
        lastPerformedAt: (last?.performedAt as string | null) ?? null,
        nextDueDate: nextDue,
        dueStatus,
      };
    });
  });
}

export async function getInspectionHistory(equipmentId: number, limit = 50) {
  return executeDbOperation(async (db) => {
    const t = getTables();
    return db
      .select({ inspection: t.inspections, user: t.users })
      .from(t.inspections)
      .leftJoin(t.users, eq(t.inspections.performedByUserId, t.users.id))
      .where(eq(t.inspections.equipmentId, equipmentId))
      .orderBy(desc(t.inspections.performedAt))
      .limit(limit);
  });
}

export async function createEquipmentInspection(input: EquipmentInspectionInput, userId?: number) {
  return executeDbOperation(async (db) => {
    const t = getTables();
    const eqRows = await db.select().from(t.equipment).where(eq(t.equipment.id, input.equipmentId));
    const equipment = (eqRows as Record<string, unknown>[])[0];
    if (!equipment) throw new Error('Equipment not found');

    const interval = (equipment.inspectionIntervalDays as number | null) ?? null;
    const today = getTodayStr();
    const nextDueDate = interval ? addDays(today, interval) : null;

    const result = await db.insert(t.inspections).values({
      equipmentId: input.equipmentId,
      inspectionType: input.inspectionType || 'routine',
      result: input.result,
      checklistResults: input.checklistResults ? JSON.stringify(input.checklistResults) : null,
      notes: input.notes || null,
      performedAt: getNow(),
      performedByUserId: userId ?? null,
      nextDueDate,
      createdAt: getNow(),
    } as Record<string, unknown>);

    const id = getInsertId(result);
    return { id, nextDueDate };
  });
}
