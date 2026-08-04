/**
 * Production Equipment Maintenance — GMP maintenance register.
 *
 * Separate from the accounting maintenance tables on purpose (see the schema
 * comment): a GMP maintenance record is a quality document, not an asset one.
 *
 * Standards this implements:
 *   - 21 CFR 211.67  — the written procedure must carry the responsible party,
 *                      the schedule, and the method/materials used.
 *   - 21 CFR 211.182 — each log entry is dated and signed by the person who
 *                      performed the work AND the person who checked it.
 *   - PIC/S GMP Ch.3 — preventive-maintenance schedule plus completion records;
 *                      the interval must be justified (criticality / vendor /
 *                      history), which is why intervalRationale exists.
 */
import { eq, and, desc, inArray, type SQL } from 'drizzle-orm';
import { executeDbOperation, getTableRef, getInsertId } from '../db/db-helper';
import { getNow, getTodayStr, formatDateFromDb } from '../db/date-utils';

function getTables() {
  return {
    schedules: getTableRef('productionMaintenanceSchedules'),
    records: getTableRef('productionMaintenanceRecords'),
    equipment: getTableRef('productionEquipment'),
    users: getTableRef('users'),
  };
}

export type MaintenanceDueStatus = 'ok' | 'due_soon' | 'due_today' | 'overdue' | 'inactive';
export type IntervalType = 'days' | 'weeks' | 'months';

export const MAINTENANCE_TYPES = ['preventive', 'corrective', 'calibration'] as const;
export const INTERVAL_TYPES: IntervalType[] = ['days', 'weeks', 'months'];

export class MaintenanceError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'MaintenanceError';
  }
}

// ============================================
// Date maths — no Date.now(); today comes from date-utils so tests can pin it
// ============================================

/** Add an interval to a YYYY-MM-DD string, returning YYYY-MM-DD. */
export function addInterval(fromYmd: string, type: IntervalType, value: number): string {
  const [y, m, d] = fromYmd.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  if (type === 'days') dt.setDate(dt.getDate() + value);
  else if (type === 'weeks') dt.setDate(dt.getDate() + value * 7);
  else dt.setMonth(dt.getMonth() + value);
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

/**
 * Where a schedule stands relative to today.
 *
 * Overdue is judged on the DUE DATE alone, never on "days since last done" —
 * a plan whose job was closed early must not read as overdue just because the
 * interval has elapsed since the previous one.
 */
export function dueStatusOf(
  nextDueDate: string | null | undefined,
  alertDaysBefore: number,
  isActive = true,
  today: string = getTodayStr(),
): MaintenanceDueStatus {
  if (!isActive) return 'inactive';
  if (!nextDueDate) return 'ok';
  const due = String(nextDueDate).slice(0, 10);
  if (due < today) return 'overdue';
  if (due === today) return 'due_today';
  const warnFrom = addInterval(due, 'days', -Math.max(0, alertDaysBefore || 0));
  return today >= warnFrom ? 'due_soon' : 'ok';
}

// ============================================
// Schedules
// ============================================

export interface MaintenanceScheduleInput {
  equipmentId: number;
  maintenanceType?: string;
  description?: string | null;
  intervalType?: IntervalType;
  intervalValue: number;
  responsibleUserId?: number | null;
  responsibleRole?: string | null;
  method?: string | null;
  materials?: string | null;
  intervalRationale?: string | null;
  isCritical?: boolean;
  /** Start the first cycle from this date; defaults to today. */
  startDate?: string | null;
  alertDaysBefore?: number;
}

function assertInterval(intervalValue: number, intervalType: string) {
  if (!Number.isFinite(intervalValue) || intervalValue <= 0)
    throw new MaintenanceError('INVALID_INTERVAL', 'รอบบำรุงรักษาต้องมากกว่า 0');
  if (!INTERVAL_TYPES.includes(intervalType as IntervalType))
    throw new MaintenanceError('INVALID_INTERVAL', `หน่วยรอบไม่ถูกต้อง: ${intervalType}`);
}

export async function createMaintenanceSchedule(input: MaintenanceScheduleInput, userId?: number) {
  const intervalType = (input.intervalType ?? 'days') as IntervalType;
  assertInterval(Number(input.intervalValue), intervalType);

  return executeDbOperation(async (db) => {
    const t = getTables();
    const eq_ = await db
      .select({ id: t.equipment.id })
      .from(t.equipment)
      .where(eq(t.equipment.id, input.equipmentId))
      .limit(1);
    if (eq_.length === 0) throw new MaintenanceError('NOT_FOUND', 'ไม่พบอุปกรณ์');

    const start = input.startDate || getTodayStr();
    const res = await db.insert(t.schedules).values({
      equipmentId: input.equipmentId,
      maintenanceType: input.maintenanceType ?? 'preventive',
      description: input.description ?? null,
      intervalType,
      intervalValue: Number(input.intervalValue),
      responsibleUserId: input.responsibleUserId ?? null,
      responsibleRole: input.responsibleRole ?? null,
      method: input.method ?? null,
      materials: input.materials ?? null,
      intervalRationale: input.intervalRationale ?? null,
      isCritical: input.isCritical === true,
      lastPerformedDate: null,
      nextDueDate: addInterval(start, intervalType, Number(input.intervalValue)),
      alertDaysBefore: input.alertDaysBefore ?? 7,
      isActive: true,
      createdBy: userId ?? null,
      createdAt: getNow(),
      updatedAt: getNow(),
    });
    return { id: getInsertId(res) };
  });
}

export async function updateMaintenanceSchedule(
  id: number,
  patch: Partial<MaintenanceScheduleInput> & { isActive?: boolean },
) {
  if (patch.intervalValue != null)
    assertInterval(Number(patch.intervalValue), (patch.intervalType ?? 'days') as IntervalType);

  return executeDbOperation(async (db) => {
    const t = getTables();
    const updates: Record<string, unknown> = { updatedAt: getNow() };
    const copy = [
      'maintenanceType', 'description', 'intervalType', 'intervalValue',
      'responsibleUserId', 'responsibleRole', 'method', 'materials',
      'intervalRationale', 'isCritical', 'alertDaysBefore', 'isActive',
    ] as const;
    for (const k of copy) if (patch[k as keyof typeof patch] !== undefined) updates[k] = patch[k as keyof typeof patch];

    await db.update(t.schedules).set(updates).where(eq(t.schedules.id, id));
    const rows = await db.select().from(t.schedules).where(eq(t.schedules.id, id)).limit(1);
    return rows[0] ?? null;
  });
}

export interface MaintenanceScheduleRow {
  id: number;
  equipmentId: number;
  equipmentCode: string;
  equipmentName: string;
  equipmentType: string;
  lineCategory: string | null;
  equipmentStatus: string;
  maintenanceType: string;
  description: string | null;
  intervalType: string;
  intervalValue: number;
  responsibleUserId: number | null;
  responsibleName: string | null;
  responsibleRole: string | null;
  method: string | null;
  materials: string | null;
  intervalRationale: string | null;
  isCritical: boolean;
  lastPerformedDate: string | null;
  nextDueDate: string | null;
  alertDaysBefore: number;
  isActive: boolean;
  dueStatus: MaintenanceDueStatus;
}

export async function listMaintenanceSchedules(filters?: {
  equipmentId?: number;
  lineCategory?: string;
  activeOnly?: boolean;
}): Promise<MaintenanceScheduleRow[]> {
  return executeDbOperation(async (db) => {
    const t = getTables();
    const conds: SQL[] = [];
    if (filters?.equipmentId) conds.push(eq(t.schedules.equipmentId, filters.equipmentId));
    if (filters?.activeOnly) conds.push(eq(t.schedules.isActive, true));
    if (filters?.lineCategory) conds.push(eq(t.equipment.lineCategory, filters.lineCategory));

    let q = db
      .select({ s: t.schedules, e: t.equipment, u: t.users })
      .from(t.schedules)
      .leftJoin(t.equipment, eq(t.schedules.equipmentId, t.equipment.id))
      .leftJoin(t.users, eq(t.schedules.responsibleUserId, t.users.id));
    if (conds.length > 0) q = q.where(conds.length === 1 ? conds[0] : and(...conds));

    const rows = await q.orderBy(t.schedules.nextDueDate);
    const today = getTodayStr();
    return (rows as Array<{ s: any; e: any; u: any }>).map(({ s, e, u }) => ({
      id: Number(s.id),
      equipmentId: Number(s.equipmentId),
      equipmentCode: e?.code ?? '',
      equipmentName: e?.nameTh ?? e?.name ?? '',
      equipmentType: e?.equipmentType ?? '',
      lineCategory: e?.lineCategory ?? 'in_line',
      equipmentStatus: e?.scaleStatus ?? 'active',
      maintenanceType: String(s.maintenanceType),
      description: s.description ?? null,
      intervalType: String(s.intervalType),
      intervalValue: Number(s.intervalValue),
      responsibleUserId: s.responsibleUserId != null ? Number(s.responsibleUserId) : null,
      responsibleName: u?.name ?? null,
      responsibleRole: s.responsibleRole ?? null,
      method: s.method ?? null,
      materials: s.materials ?? null,
      intervalRationale: s.intervalRationale ?? null,
      isCritical: Boolean(s.isCritical),
      lastPerformedDate: s.lastPerformedDate ? formatDateFromDb(s.lastPerformedDate) : null,
      nextDueDate: s.nextDueDate ? formatDateFromDb(s.nextDueDate) : null,
      alertDaysBefore: Number(s.alertDaysBefore ?? 7),
      isActive: Boolean(s.isActive),
      dueStatus: dueStatusOf(
        s.nextDueDate ? formatDateFromDb(s.nextDueDate) : null,
        Number(s.alertDaysBefore ?? 7),
        Boolean(s.isActive),
        today,
      ),
    }));
  });
}

// ============================================
// Records — completing a job rolls its schedule forward
// ============================================

export interface MaintenanceRecordInput {
  equipmentId: number;
  scheduleId?: number | null;
  maintenanceType?: string;
  description: string;
  performedDate: string;
  workDone?: string | null;
  partsUsed?: string | null;
  downtimeMinutes?: number | null;
  result?: 'completed' | 'failed' | 'deferred';
  notes?: string | null;
  /** Put the equipment back in service when the job closes successfully. */
  returnToService?: boolean;
}

export async function createMaintenanceRecord(input: MaintenanceRecordInput, userId: number) {
  if (!input.description?.trim())
    throw new MaintenanceError('INVALID_INPUT', 'กรุณาระบุรายละเอียดงานบำรุงรักษา');
  if (!input.performedDate)
    throw new MaintenanceError('INVALID_INPUT', 'กรุณาระบุวันที่ทำ');
  if (!userId) throw new MaintenanceError('INVALID_INPUT', 'ไม่พบผู้บันทึก');

  return executeDbOperation(async (db) => {
    const t = getTables();
    const result = input.result ?? 'completed';

    const ins = await db.insert(t.records).values({
      equipmentId: input.equipmentId,
      scheduleId: input.scheduleId ?? null,
      maintenanceType: input.maintenanceType ?? 'preventive',
      description: input.description.trim(),
      performedDate: input.performedDate,
      workDone: input.workDone ?? null,
      partsUsed: input.partsUsed ?? null,
      downtimeMinutes: input.downtimeMinutes ?? null,
      result,
      performedByUserId: userId,
      performedAt: getNow(),
      verifiedByUserId: null,
      verifiedAt: null,
      notes: input.notes ?? null,
      createdAt: getNow(),
      updatedAt: getNow(),
    });
    const recordId = getInsertId(ins);

    // Roll the plan forward only when the work actually got done. A failed or
    // deferred job leaves the schedule where it is, so it keeps showing overdue
    // instead of silently resetting the clock.
    if (input.scheduleId && result === 'completed') {
      const sRows = await db
        .select()
        .from(t.schedules)
        .where(eq(t.schedules.id, input.scheduleId))
        .limit(1);
      const s = sRows[0];
      if (s) {
        await db
          .update(t.schedules)
          .set({
            lastPerformedDate: input.performedDate,
            nextDueDate: addInterval(
              input.performedDate,
              String(s.intervalType) as IntervalType,
              Number(s.intervalValue),
            ),
            updatedAt: getNow(),
          })
          .where(eq(t.schedules.id, input.scheduleId));
      }
    }

    if (input.returnToService && result === 'completed') {
      await db
        .update(t.equipment)
        .set({ scaleStatus: 'active', updatedAt: getNow() })
        .where(eq(t.equipment.id, input.equipmentId));
    }

    return { id: recordId };
  });
}

/**
 * Second signature (21 CFR 211.182). The checker must be a different person
 * than the one who did the work — a single user signing both halves is not a
 * double check.
 */
export async function verifyMaintenanceRecord(recordId: number, verifierUserId: number) {
  return executeDbOperation(async (db) => {
    const t = getTables();
    const rows = await db.select().from(t.records).where(eq(t.records.id, recordId)).limit(1);
    const rec = rows[0];
    if (!rec) throw new MaintenanceError('NOT_FOUND', 'ไม่พบบันทึกบำรุงรักษา');
    if (rec.verifiedByUserId != null)
      throw new MaintenanceError('ALREADY_VERIFIED', 'บันทึกนี้ถูกทวนสอบแล้ว');
    if (Number(rec.performedByUserId) === Number(verifierUserId))
      throw new MaintenanceError(
        'SAME_USER',
        'ผู้ทวนสอบต้องเป็นคนละคนกับผู้ปฏิบัติงาน (21 CFR 211.182)',
      );

    await db
      .update(t.records)
      .set({ verifiedByUserId: verifierUserId, verifiedAt: getNow(), updatedAt: getNow() })
      .where(eq(t.records.id, recordId));
    return { id: recordId };
  });
}

export async function listMaintenanceRecords(filters?: {
  equipmentId?: number;
  limit?: number;
}) {
  return executeDbOperation(async (db) => {
    const t = getTables();
    let q = db
      .select({ r: t.records, e: t.equipment })
      .from(t.records)
      .leftJoin(t.equipment, eq(t.records.equipmentId, t.equipment.id));
    if (filters?.equipmentId) q = q.where(eq(t.records.equipmentId, filters.equipmentId));
    const rows = await q.orderBy(desc(t.records.performedDate)).limit(filters?.limit ?? 200);

    // Resolve signer names in one pass rather than two more joins on the same table.
    const ids = new Set<number>();
    for (const { r } of rows as Array<{ r: any }>) {
      if (r.performedByUserId) ids.add(Number(r.performedByUserId));
      if (r.verifiedByUserId) ids.add(Number(r.verifiedByUserId));
    }
    const nameById = new Map<number, string>();
    if (ids.size > 0) {
      const us = await db
        .select({ id: t.users.id, name: t.users.name })
        .from(t.users)
        .where(inArray(t.users.id, [...ids]));
      for (const u of us as Array<{ id: number; name: string }>) nameById.set(Number(u.id), u.name);
    }

    return (rows as Array<{ r: any; e: any }>).map(({ r, e }) => ({
      id: Number(r.id),
      equipmentId: Number(r.equipmentId),
      equipmentCode: e?.code ?? '',
      equipmentName: e?.nameTh ?? e?.name ?? '',
      scheduleId: r.scheduleId != null ? Number(r.scheduleId) : null,
      maintenanceType: String(r.maintenanceType),
      description: String(r.description),
      performedDate: r.performedDate ? formatDateFromDb(r.performedDate) : null,
      workDone: r.workDone ?? null,
      partsUsed: r.partsUsed ?? null,
      downtimeMinutes: r.downtimeMinutes != null ? Number(r.downtimeMinutes) : null,
      result: String(r.result),
      performedByUserId: Number(r.performedByUserId),
      performedByName: nameById.get(Number(r.performedByUserId)) ?? null,
      performedAt: r.performedAt ? String(r.performedAt) : null,
      verifiedByUserId: r.verifiedByUserId != null ? Number(r.verifiedByUserId) : null,
      verifiedByName: r.verifiedByUserId ? nameById.get(Number(r.verifiedByUserId)) ?? null : null,
      verifiedAt: r.verifiedAt ? String(r.verifiedAt) : null,
      notes: r.notes ?? null,
    }));
  });
}

/**
 * Take equipment out of service / put it back. GMP: equipment being worked on
 * must not be usable in production, so the WO equipment-inspection step reads
 * this status and refuses a pass while it is 'maintenance' / 'out_of_service'.
 */
export async function setEquipmentServiceStatus(
  equipmentId: number,
  status: 'active' | 'maintenance' | 'out_of_service',
) {
  return executeDbOperation(async (db) => {
    const t = getTables();
    await db
      .update(t.equipment)
      .set({ scaleStatus: status, updatedAt: getNow() })
      .where(eq(t.equipment.id, equipmentId));
    return { id: equipmentId, status };
  });
}
