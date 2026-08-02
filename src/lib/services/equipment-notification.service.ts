/**
 * Equipment Notification Service — CRUD + idempotent scan + counts
 * Feature: 022-equipment-notifications
 */
import { eq, and, desc, sql, inArray, notInArray, isNull, or, gte, lt } from 'drizzle-orm';
import { executeDbOperation, getTableRef, getInsertId } from '../db/db-helper';
import { getNow, toDbDate, toQueryDate } from '../db/date-utils';
import {
  EquipmentNotificationError,
  NOTIFICATION_ERROR_CODES,
  classifySeverity,
  type EquipmentNotification,
  type NotificationSeverity,
  type NotificationStatus,
  type NotificationType,
} from '@/types/equipment-notifications';

function getTables() {
  return {
    notifications: getTableRef('equipmentNotifications'),
    equipment: getTableRef('equipment'),
    productionEquipment: getTableRef('productionEquipment'),
    acctEquipment: getTableRef('accountingEquipment'),
    schedules: getTableRef('acctMaintenanceSchedules'),
    templates: getTableRef('maintenancePlanTemplates'),
    users: getTableRef('users'),
  };
}

// ============================================
// Read
// ============================================

export interface ListOptions {
  status?: NotificationStatus;
  severity?: NotificationSeverity;
  type?: NotificationType;
  page?: number;
  pageSize?: number;
}

export async function listNotifications(
  opts: ListOptions = {},
): Promise<{ items: EquipmentNotification[]; total: number; unreadCount: number }> {
  return executeDbOperation(async (db) => {
    const t = getTables();
    const conds: any[] = [];
    if (opts.status) conds.push(eq(t.notifications.status, opts.status));
    if (opts.severity) conds.push(eq(t.notifications.severity, opts.severity));
    if (opts.type) conds.push(eq(t.notifications.type, opts.type));

    // Filter out snoozed items whose snooze window is still in the future
    const nowIso = new Date().toISOString();
    conds.push(
      or(
        isNull(t.notifications.snoozedUntil),
        sql`${t.notifications.snoozedUntil} <= ${nowIso}`,
      ),
    );

    const whereExpr = conds.length > 0 ? and(...conds) : undefined;

    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, opts.pageSize ?? 50));
    const offset = (page - 1) * pageSize;

    const rows = await db
      .select()
      .from(t.notifications)
      .where(whereExpr)
      .orderBy(
        // Severity weight: overdue first, then due_today, then 7d, then 30d
        sql`CASE ${t.notifications.severity}
          WHEN 'overdue' THEN 0
          WHEN 'due_today' THEN 1
          WHEN 'due_in_7d' THEN 2
          WHEN 'due_in_30d' THEN 3
          ELSE 4 END`,
        t.notifications.dueAt,
      )
      .limit(pageSize)
      .offset(offset);

    const totalRows = await db
      .select({ c: sql<number>`COUNT(*)` })
      .from(t.notifications)
      .where(whereExpr);
    const total = Number(totalRows[0]?.c ?? 0);

    const unreadRows = await db
      .select({ c: sql<number>`COUNT(*)` })
      .from(t.notifications)
      .where(eq(t.notifications.status, 'open'));
    const unreadCount = Number(unreadRows[0]?.c ?? 0);

    return {
      items: rows.map(normalizeNotification),
      total,
      unreadCount,
    };
  });
}

export async function getUnreadCount(): Promise<number> {
  return executeDbOperation(async (db) => {
    const t = getTables();
    const nowIso = new Date().toISOString();
    const rows = await db
      .select({ c: sql<number>`COUNT(*)` })
      .from(t.notifications)
      .where(
        and(
          eq(t.notifications.status, 'open'),
          or(
            isNull(t.notifications.snoozedUntil),
            sql`${t.notifications.snoozedUntil} <= ${nowIso}`,
          ),
        ),
      );
    return Number(rows[0]?.c ?? 0);
  });
}

// ============================================
// Create — used by scan + ad-hoc (F021 integration)
// ============================================

function makeDedupeKey(
  entityType: string,
  entityId: number,
  scheduleId: number | null,
  dueAtIso: string | null,
): string {
  const dueDayOnly = dueAtIso ? dueAtIso.slice(0, 10) : 'no-due';
  return `${entityType}|${entityId}|${scheduleId ?? 'none'}|${dueDayOnly}`;
}

export interface CreateNotificationInput {
  entityType: string;
  entityId: number;
  scheduleId?: number | null;
  type: NotificationType;
  title: string;
  body?: string | null;
  dueAt?: string | null;
  severity?: NotificationSeverity;
  recipientRole?: string | null;
}

/**
 * Idempotent insert keyed on (entityType, entityId, scheduleId, dueDayOnly).
 * If a row with the same dedupe key already exists in `open` or `snoozed`
 * status, return it instead of creating a duplicate.
 */
export async function createNotification(
  input: CreateNotificationInput,
): Promise<EquipmentNotification> {
  return executeDbOperation(async (db) => {
    const t = getTables();
    const dueAt = input.dueAt ?? null;
    const dedupeKey = makeDedupeKey(
      input.entityType,
      input.entityId,
      input.scheduleId ?? null,
      dueAt,
    );

    // Idempotency check
    const existing = await db
      .select()
      .from(t.notifications)
      .where(
        and(
          eq(t.notifications.dedupeKey, dedupeKey),
          inArray(t.notifications.status, ['open', 'snoozed']),
        ),
      )
      .limit(1);
    if (existing.length > 0) {
      return normalizeNotification(existing[0]);
    }

    const severity =
      input.severity ?? (dueAt ? classifySeverity(dueAt) : 'info');

    const ins = await db.insert(t.notifications).values({
      entityType: input.entityType,
      entityId: input.entityId,
      scheduleId: input.scheduleId ?? null,
      type: input.type,
      severity,
      title: input.title,
      body: input.body ?? null,
      dueAt: dueAt ? toDbDate(dueAt) : null,
      status: 'open',
      recipientRole: input.recipientRole ?? null,
      dedupeKey,
      createdAt: getNow(),
      updatedAt: getNow(),
    });
    const id = getInsertId(ins);
    const fresh = await db.select().from(t.notifications).where(eq(t.notifications.id, id)).limit(1);
    return normalizeNotification(fresh[0]);
  });
}

// ============================================
// Acknowledge / Snooze / Resolve
// ============================================

export async function acknowledgeNotification(
  id: number,
  userId: number,
  note?: string | null,
): Promise<EquipmentNotification> {
  return executeDbOperation(async (db) => {
    const t = getTables();
    const rows = await db.select().from(t.notifications).where(eq(t.notifications.id, id)).limit(1);
    if (rows.length === 0)
      throw new EquipmentNotificationError(NOTIFICATION_ERROR_CODES.NOT_FOUND, 'Not found');
    if (rows[0].status === 'acknowledged' || rows[0].status === 'resolved') {
      throw new EquipmentNotificationError(
        NOTIFICATION_ERROR_CODES.ALREADY_ACKNOWLEDGED,
        'Already finalized',
      );
    }
    await db
      .update(t.notifications)
      .set({
        status: 'acknowledged',
        acknowledgedAt: getNow(),
        acknowledgedByUserId: userId,
        acknowledgeNote: note ?? null,
        updatedAt: getNow(),
      })
      .where(eq(t.notifications.id, id));
    const fresh = await db.select().from(t.notifications).where(eq(t.notifications.id, id)).limit(1);
    return normalizeNotification(fresh[0]);
  });
}

export async function snoozeNotification(
  id: number,
  snoozeDays: number,
  userId: number,
  note?: string | null,
): Promise<EquipmentNotification> {
  return executeDbOperation(async (db) => {
    const t = getTables();
    const rows = await db.select().from(t.notifications).where(eq(t.notifications.id, id)).limit(1);
    if (rows.length === 0)
      throw new EquipmentNotificationError(NOTIFICATION_ERROR_CODES.NOT_FOUND, 'Not found');

    const until = new Date(Date.now() + snoozeDays * 24 * 60 * 60 * 1000);
    await db
      .update(t.notifications)
      .set({
        status: 'snoozed',
        snoozedUntil: toDbDate(until),
        acknowledgeNote: note ?? rows[0].acknowledgeNote,
        updatedAt: getNow(),
      })
      .where(eq(t.notifications.id, id));
    const fresh = await db.select().from(t.notifications).where(eq(t.notifications.id, id)).limit(1);
    return normalizeNotification(fresh[0]);
  });
}

export async function resolveNotification(
  id: number,
  userId: number,
): Promise<EquipmentNotification> {
  return executeDbOperation(async (db) => {
    const t = getTables();
    const rows = await db.select().from(t.notifications).where(eq(t.notifications.id, id)).limit(1);
    if (rows.length === 0)
      throw new EquipmentNotificationError(NOTIFICATION_ERROR_CODES.NOT_FOUND, 'Not found');
    await db
      .update(t.notifications)
      .set({
        status: 'resolved',
        resolvedAt: getNow(),
        acknowledgedByUserId: userId,
        updatedAt: getNow(),
      })
      .where(eq(t.notifications.id, id));
    const fresh = await db.select().from(t.notifications).where(eq(t.notifications.id, id)).limit(1);
    return normalizeNotification(fresh[0]);
  });
}

// ============================================
// Scan: walk acct_maintenance_schedules + create notifications
// ============================================

export interface ScanResult {
  scanned: number;
  created: number;
  skipped: number;
}

export async function scanMaintenanceSchedules(): Promise<ScanResult> {
  return executeDbOperation(async (db) => {
    const t = getTables();

    // Get all active schedules with nextDue
    const schedules = await db
      .select()
      .from(t.schedules)
      .where(eq(t.schedules.isActive, true));

    let created = 0;
    let skipped = 0;

    const now = new Date();
    for (const sched of schedules) {
      if (!sched.nextDue) {
        skipped++;
        continue;
      }
      const dueAt = typeof sched.nextDue === 'string'
        ? sched.nextDue
        : new Date(sched.nextDue).toISOString();

      const dueDate = new Date(dueAt);
      const daysUntilDue = Math.round(
        (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      const alertDaysBefore = Number(sched.alertDaysBefore ?? 7);
      // Only create when within alert window OR overdue
      if (daysUntilDue > alertDaysBefore) {
        skipped++;
        continue;
      }

      const severity = classifySeverity(dueAt, now);
      const equipmentId = Number(sched.equipmentId ?? sched.assetId ?? 0);
      if (!equipmentId) {
        skipped++;
        continue;
      }

      const type: NotificationType =
        String(sched.maintenanceType ?? '').toLowerCase() === 'calibration'
          ? 'calibration_due'
          : String(sched.maintenanceType ?? '').toLowerCase() === 'inspection'
            ? 'inspection_due'
            : 'maintenance_due';

      const title = `${type === 'calibration_due' ? 'Calibration' : type === 'inspection_due' ? 'Inspection' : 'Maintenance'} due — equipment #${equipmentId}`;
      const body = `${severity === 'overdue' ? 'OVERDUE' : 'Due'} ${dueDate.toLocaleDateString('th-TH')} (${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) === 1 ? '' : 's'} ${severity === 'overdue' ? 'overdue' : 'remaining'})`;

      const result = await createNotification({
        entityType: 'accounting_equipment',
        entityId: equipmentId,
        scheduleId: Number(sched.id),
        type,
        title,
        body,
        dueAt,
        severity,
      });
      // If the dedupe path returned an existing record, the inserted-id
      // would be unchanged — count as created when row's createdAt matches now.
      const nowTs = Date.now();
      const createdTs = new Date(result.createdAt).getTime();
      if (Math.abs(nowTs - createdTs) < 60_000) {
        created++;
      } else {
        skipped++;
      }
    }

    return { scanned: schedules.length, created, skipped };
  });
}

// Scan the equipment-inspection registry (production_equipment routine inspections,
// used mainly for off-line/support equipment like HVAC) and raise notifications for
// anything overdue or due within its alert window. Reuses the same inbox as the
// accounting maintenance schedules; notifications carry entityType 'production_equipment'.
export async function scanEquipmentInspectionsDue(): Promise<ScanResult> {
  const { listEquipmentForInspection } = await import('./equipment-inspection.service');
  const rows = await listEquipmentForInspection();
  const now = new Date();
  const todayIso = now.toISOString();
  let created = 0;
  let skipped = 0;
  let scanned = 0;

  for (const row of rows) {
    // Only equipment that has an inspection interval configured is tracked here.
    if (!row.inspectionIntervalDays) { skipped++; continue; }
    scanned++;
    // 'ok' / 'no_schedule' are not actionable; flag overdue, due-soon, or never-inspected.
    if (row.dueStatus !== 'overdue' && row.dueStatus !== 'due_soon' && row.dueStatus !== 'never') {
      skipped++;
      continue;
    }
    const dueAt = row.nextDueDate || todayIso.slice(0, 10);
    const severity = classifySeverity(dueAt, now);
    const result = await createNotification({
      entityType: 'production_equipment',
      entityId: row.id,
      scheduleId: null,
      type: 'inspection_due',
      title: `Equipment inspection due — ${row.code} ${row.nameTh}`,
      body: `${row.dueStatus === 'overdue' ? 'OVERDUE' : row.dueStatus === 'never' ? 'Never inspected' : 'Due'} ${dueAt}`,
      dueAt,
      severity,
    });
    const createdTs = new Date(result.createdAt).getTime();
    if (Math.abs(Date.now() - createdTs) < 60_000) created++; else skipped++;
  }

  return { scanned, created, skipped };
}

// ============================================
// Calendar — items due within a date range
// ============================================

export async function getCalendarItems(
  monthIso: string, // 'YYYY-MM'
): Promise<Array<{
  id: number;
  date: string;
  title: string;
  severity: NotificationSeverity;
  entityType: string;
  entityId: number;
}>> {
  return executeDbOperation(async (db) => {
    const t = getTables();
    // Bound by [first of month, first of next month). dueAt is a MySQL datetime
    // (Date) / SQLite ISO text — toQueryDate() returns the right type for each
    // so the comparison actually matches (ISO 'T'/'Z' strings never match a
    // MySQL datetime column, which silently emptied the calendar on UAT).
    const [year, month] = monthIso.split('-').map(Number);
    const startStr = `${monthIso}-01`;
    const nextStr =
      month === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(month + 1).padStart(2, '0')}-01`;

    const rows = await db
      .select()
      .from(t.notifications)
      .where(
        and(
          gte(t.notifications.dueAt, toQueryDate(startStr)),
          lt(t.notifications.dueAt, toQueryDate(nextStr)),
          // Maintenance calendar only — exclude cross-department QC audit
          // notifications (they have no maintenance schedule to plan around).
          notInArray(t.notifications.type, ['lot_received', 'wo_completed', 'deviation_opened']),
        ),
      );

    // Format the due date from local components (not toISOString) so an item
    // due late in the day in UTC+7 lands on the correct calendar cell.
    const toDateStr = (v: unknown): string => {
      if (typeof v === 'string') return v.slice(0, 10);
      const d = new Date(v as any);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    return rows.map((r: any) => ({
      id: Number(r.id),
      date: toDateStr(r.dueAt),
      title: String(r.title),
      severity: r.severity as NotificationSeverity,
      entityType: String(r.entityType),
      entityId: Number(r.entityId),
    }));
  });
}

// ============================================
// Normalizer
// ============================================

function normalizeNotification(row: any): EquipmentNotification {
  return {
    id: Number(row.id),
    entityType: String(row.entityType),
    entityId: Number(row.entityId),
    scheduleId: row.scheduleId != null ? Number(row.scheduleId) : null,
    type: row.type as NotificationType,
    severity: row.severity as NotificationSeverity,
    title: String(row.title),
    body: row.body ?? null,
    dueAt: row.dueAt ? String(row.dueAt) : null,
    status: row.status as NotificationStatus,
    recipientUserId: row.recipientUserId != null ? Number(row.recipientUserId) : null,
    recipientRole: row.recipientRole ?? null,
    acknowledgedAt: row.acknowledgedAt ? String(row.acknowledgedAt) : null,
    acknowledgedByUserId: row.acknowledgedByUserId != null ? Number(row.acknowledgedByUserId) : null,
    acknowledgeNote: row.acknowledgeNote ?? null,
    snoozedUntil: row.snoozedUntil ? String(row.snoozedUntil) : null,
    resolvedAt: row.resolvedAt ? String(row.resolvedAt) : null,
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}
