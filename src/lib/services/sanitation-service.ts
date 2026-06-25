/**
 * Sanitation Service
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 4)
 *
 * Business logic for sanitation schedules, logs, and pest control.
 */

import { eq, and, desc, sql, gte, lte } from 'drizzle-orm';
import { getDb, isSqlite } from '../db';
import { getInsertId } from '../db/db-helper';
import { toDateSafe, getNow } from '../db/date-utils';
import {
  sqliteSanitationSchedules,
  sqliteSanitationLogs,
  sqlitePestControlLogs,
  sqliteUsers,
} from '../db/schema';
import { createAuditLog } from '../audit';
import type {
  SanitationSchedule,
  SanitationScheduleCreate,
  SanitationScheduleUpdate,
  SanitationLog,
  SanitationLogCreate,
  SanitationLogUpdate,
  PestControlLog,
  PestControlLogCreate,
  PestControlLogUpdate,
  PendingTask,
  SanitationTrends,
  SanitationScheduleListParams,
  SanitationLogListParams,
  SanitationLogListResponse,
  PestControlLogListParams,
  PestControlLogListResponse,
  SanitationTrendsParams,
  AreaType,
  SanitationFrequency,
  DueDateRange,
  GeneratedDueDate,
  PestControlTrendsParams,
  PestControlTrends,
} from '@/types/sanitation';

// ============================================
// Sanitation Schedules
// ============================================

/**
 * Get all sanitation schedules with optional filters
 */
export async function getSanitationSchedules(
  params: SanitationScheduleListParams = {}
): Promise<SanitationSchedule[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;
  const conditions = [];

  if (params.areaType) {
    conditions.push(eq(sqliteSanitationSchedules.areaType, params.areaType));
  }
  if (params.frequency) {
    conditions.push(eq(sqliteSanitationSchedules.frequency, params.frequency));
  }
  if (params.isActive !== undefined) {
    conditions.push(eq(sqliteSanitationSchedules.isActive, params.isActive));
  }

  const schedules = await database
    .select()
    .from(sqliteSanitationSchedules)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(sqliteSanitationSchedules.name);

  // Enrich with computed fields
  return Promise.all(
    schedules.map(async (schedule: any) => {
      const lastLog = await database
        .select()
        .from(sqliteSanitationLogs)
        .where(
          and(
            eq(sqliteSanitationLogs.scheduleId, schedule.id),
            eq(sqliteSanitationLogs.status, 'completed')
          )
        )
        .orderBy(desc(sqliteSanitationLogs.performedDate))
        .limit(1);

      const complianceStats = await calculateScheduleCompliance(schedule.id);

      return {
        id: schedule.id,
        name: schedule.name,
        areaType: schedule.areaType as AreaType,
        areaId: schedule.areaId,
        equipmentId: schedule.equipmentId,
        frequency: schedule.frequency as SanitationFrequency,
        dayOfWeek: schedule.dayOfWeek,
        dayOfMonth: schedule.dayOfMonth,
        method: schedule.method || '',
        verificationRequired: schedule.verificationRequired ?? true,
        isActive: schedule.isActive ?? true,
        lastCompleted: lastLog[0]?.performedDate || null,
        nextDue: calculateNextDueDate(schedule),
        complianceRate: complianceStats,
        createdAt: schedule.createdAt,
      };
    })
  );
}

/**
 * Get a single sanitation schedule by ID
 */
export async function getSanitationScheduleById(id: number): Promise<SanitationSchedule | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  const schedule = await database
    .select()
    .from(sqliteSanitationSchedules)
    .where(eq(sqliteSanitationSchedules.id, id))
    .limit(1);

  if (!schedule[0]) return null;

  const lastLog = await database
    .select()
    .from(sqliteSanitationLogs)
    .where(
      and(
        eq(sqliteSanitationLogs.scheduleId, id),
        eq(sqliteSanitationLogs.status, 'completed')
      )
    )
    .orderBy(desc(sqliteSanitationLogs.performedDate))
    .limit(1);

  const complianceStats = await calculateScheduleCompliance(id);

  return {
    id: schedule[0].id,
    name: schedule[0].name,
    areaType: schedule[0].areaType as AreaType,
    areaId: schedule[0].areaId,
    equipmentId: schedule[0].equipmentId,
    frequency: schedule[0].frequency as SanitationFrequency,
    dayOfWeek: schedule[0].dayOfWeek,
    dayOfMonth: schedule[0].dayOfMonth,
    method: schedule[0].method || '',
    verificationRequired: schedule[0].verificationRequired ?? true,
    isActive: schedule[0].isActive ?? true,
    lastCompleted: lastLog[0]?.performedDate || null,
    nextDue: calculateNextDueDate(schedule[0]),
    complianceRate: complianceStats,
    createdAt: schedule[0].createdAt,
  };
}

/**
 * Create a new sanitation schedule
 */
export async function createSanitationSchedule(
  data: SanitationScheduleCreate,
  userId: number
): Promise<SanitationSchedule> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  const values = {
    name: data.name,
    areaType: data.areaType,
    areaId: data.areaId || null,
    equipmentId: data.equipmentId || null,
    frequency: data.frequency,
    dayOfWeek: data.dayOfWeek || null,
    dayOfMonth: data.dayOfMonth || null,
    method: data.method,
    verificationRequired: data.verificationRequired ?? true,
    isActive: true,
    createdAt: getNow(),
  };

  let recordId: number;
  if (isSqlite()) {
    const [result] = await database
      .insert(sqliteSanitationSchedules)
      .values(values)
      .returning({ id: sqliteSanitationSchedules.id });
    recordId = result.id;
  } else {
    const result = await database
      .insert(sqliteSanitationSchedules)
      .values(values);
    recordId = getInsertId(result);
  }

  // Refetch the record
  const [record] = await database
    .select()
    .from(sqliteSanitationSchedules)
    .where(eq(sqliteSanitationSchedules.id, recordId));

  await createAuditLog({
    userId,
    action: 'CREATE',
    tableName: 'sanitation_schedule',
    recordId: record.id,
    newValue: record,
  });

  return {
    id: record.id,
    name: record.name,
    areaType: record.areaType as AreaType,
    areaId: record.areaId,
    equipmentId: record.equipmentId,
    frequency: record.frequency as SanitationFrequency,
    dayOfWeek: record.dayOfWeek,
    dayOfMonth: record.dayOfMonth,
    method: record.method || '',
    verificationRequired: record.verificationRequired ?? true,
    isActive: record.isActive ?? true,
    lastCompleted: null,
    nextDue: calculateNextDueDate(record),
    complianceRate: 100,
    createdAt: record.createdAt,
  };
}

/**
 * Update a sanitation schedule
 */
export async function updateSanitationSchedule(
  id: number,
  data: SanitationScheduleUpdate,
  userId: number
): Promise<SanitationSchedule | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  const existing = await getSanitationScheduleById(id);
  if (!existing) return null;

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.method !== undefined) updateData.method = data.method;
  if (data.verificationRequired !== undefined)
    updateData.verificationRequired = data.verificationRequired;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  if (Object.keys(updateData).length > 0) {
    await database
      .update(sqliteSanitationSchedules)
      .set(updateData)
      .where(eq(sqliteSanitationSchedules.id, id));
  }

  await createAuditLog({
    userId,
    action: 'UPDATE',
    tableName: 'sanitation_schedule',
    recordId: id,
    oldValue: existing,
    newValue: { ...existing, ...updateData },
  });

  return getSanitationScheduleById(id);
}

/**
 * Delete (deactivate) a sanitation schedule
 */
export async function deleteSanitationSchedule(
  id: number,
  userId: number
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  const existing = await getSanitationScheduleById(id);
  if (!existing) return false;

  await database
    .update(sqliteSanitationSchedules)
    .set({ isActive: false })
    .where(eq(sqliteSanitationSchedules.id, id));

  await createAuditLog({
    userId,
    action: 'DELETE',
    tableName: 'sanitation_schedule',
    recordId: id,
    oldValue: existing,
  });

  return true;
}

// ============================================
// Sanitation Logs
// ============================================

/**
 * Get sanitation logs with pagination and filters
 */
export async function getSanitationLogs(
  params: SanitationLogListParams = {}
): Promise<SanitationLogListResponse> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;
  const page = params.page || 1;
  const limit = params.limit || 20;
  const offset = (page - 1) * limit;

  const conditions = [];

  if (params.scheduleId) {
    conditions.push(eq(sqliteSanitationLogs.scheduleId, params.scheduleId));
  }
  if (params.status) {
    conditions.push(eq(sqliteSanitationLogs.status, params.status));
  }
  if (params.fromDate) {
    conditions.push(gte(sqliteSanitationLogs.performedDate, params.fromDate));
  }
  if (params.toDate) {
    conditions.push(lte(sqliteSanitationLogs.performedDate, params.toDate));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const logs = await database
    .select({
      log: sqliteSanitationLogs,
      schedule: sqliteSanitationSchedules,
      performer: sqliteUsers,
    })
    .from(sqliteSanitationLogs)
    .leftJoin(
      sqliteSanitationSchedules,
      eq(sqliteSanitationLogs.scheduleId, sqliteSanitationSchedules.id)
    )
    .leftJoin(sqliteUsers, eq(sqliteSanitationLogs.performedBy, sqliteUsers.id))
    .where(whereClause)
    .orderBy(desc(sqliteSanitationLogs.performedDate))
    .limit(limit)
    .offset(offset);

  // Apply areaType filter after join
  let filteredLogs = logs;
  if (params.areaType) {
    filteredLogs = logs.filter(
      (l: any) => l.schedule?.areaType === params.areaType
    );
  }

  const countResult = await database
    .select({ count: sql<number>`count(*)` })
    .from(sqliteSanitationLogs)
    .where(whereClause);

  return {
    logs: filteredLogs.map((row: any) => ({
      id: row.log.id,
      scheduleId: row.log.scheduleId || 0,
      scheduleName: row.schedule?.name,
      areaType: (row.schedule?.areaType || 'production') as AreaType,
      scheduledDate: row.log.scheduledDate || '',
      performedDate: row.log.performedDate || '',
      performedBy: row.log.performedBy || 0,
      performedByName: row.performer?.name,
      method: row.log.method || '',
      chemicalsUsed: row.log.chemicalsUsed,
      status: row.log.status as 'completed' | 'partial' | 'missed',
      verifiedBy: row.log.verifiedBy,
      verifiedAt: row.log.verifiedAt,
      deviationId: row.log.deviationId,
      notes: row.log.notes,
      createdAt: row.log.createdAt,
    })),
    total: countResult[0]?.count || 0,
  };
}

/**
 * Get a single sanitation log by ID
 */
export async function getSanitationLogById(id: number): Promise<SanitationLog | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  const logs = await database
    .select({
      log: sqliteSanitationLogs,
      schedule: sqliteSanitationSchedules,
      performer: sqliteUsers,
    })
    .from(sqliteSanitationLogs)
    .leftJoin(
      sqliteSanitationSchedules,
      eq(sqliteSanitationLogs.scheduleId, sqliteSanitationSchedules.id)
    )
    .leftJoin(sqliteUsers, eq(sqliteSanitationLogs.performedBy, sqliteUsers.id))
    .where(eq(sqliteSanitationLogs.id, id))
    .limit(1);

  if (!logs[0]) return null;

  const row = logs[0];
  return {
    id: row.log.id,
    scheduleId: row.log.scheduleId || 0,
    scheduleName: row.schedule?.name,
    areaType: (row.schedule?.areaType || 'production') as AreaType,
    scheduledDate: row.log.scheduledDate || '',
    performedDate: row.log.performedDate || '',
    performedBy: row.log.performedBy || 0,
    performedByName: row.performer?.name,
    method: row.log.method || '',
    chemicalsUsed: row.log.chemicalsUsed,
    status: row.log.status as 'completed' | 'partial' | 'missed',
    verifiedBy: row.log.verifiedBy,
    verifiedAt: row.log.verifiedAt,
    deviationId: row.log.deviationId,
    notes: row.log.notes,
    createdAt: row.log.createdAt,
  };
}

/**
 * Create a sanitation log entry
 */
export async function createSanitationLog(
  data: SanitationLogCreate,
  userId: number
): Promise<SanitationLog> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  // Get the schedule's method if not provided
  let method = data.method;
  if (!method && data.scheduleId) {
    const schedule = await getSanitationScheduleById(data.scheduleId);
    method = schedule?.method || '';
  }

  const values = {
    scheduleId: data.scheduleId,
    scheduledDate: data.scheduledDate || new Date().toISOString().split('T')[0],
    performedDate: data.performedDate,
    performedBy: userId,
    method: method || '',
    chemicalsUsed: data.chemicalsUsed || null,
    status: data.status,
    notes: data.notes || null,
    createdAt: getNow(),
  };

  let recordId: number;
  if (isSqlite()) {
    const [result] = await database
      .insert(sqliteSanitationLogs)
      .values(values)
      .returning({ id: sqliteSanitationLogs.id });
    recordId = result.id;
  } else {
    const result = await database
      .insert(sqliteSanitationLogs)
      .values(values);
    recordId = getInsertId(result);
  }

  // Refetch for audit log
  const [record] = await database
    .select()
    .from(sqliteSanitationLogs)
    .where(eq(sqliteSanitationLogs.id, recordId));

  await createAuditLog({
    userId,
    action: 'CREATE',
    tableName: 'sanitation_log',
    recordId: record.id,
    newValue: record,
  });

  return getSanitationLogById(record.id) as Promise<SanitationLog>;
}

/**
 * Update a sanitation log
 */
export async function updateSanitationLog(
  id: number,
  data: SanitationLogUpdate,
  userId: number
): Promise<SanitationLog | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  const existing = await getSanitationLogById(id);
  if (!existing) return null;

  const updateData: Record<string, unknown> = {};
  if (data.status !== undefined) updateData.status = data.status;
  if (data.notes !== undefined) updateData.notes = data.notes;

  if (Object.keys(updateData).length > 0) {
    await database
      .update(sqliteSanitationLogs)
      .set(updateData)
      .where(eq(sqliteSanitationLogs.id, id));
  }

  await createAuditLog({
    userId,
    action: 'UPDATE',
    tableName: 'sanitation_log',
    recordId: id,
    oldValue: existing,
    newValue: { ...existing, ...updateData },
  });

  return getSanitationLogById(id);
}

/**
 * Verify a sanitation log
 */
export async function verifySanitationLog(
  id: number,
  userId: number
): Promise<SanitationLog | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  const existing = await getSanitationLogById(id);
  if (!existing) return null;

  // Dual control: operator != verifier
  if (existing.performedBy && Number(existing.performedBy) === userId) {
    throw new Error('ไม่สามารถตรวจสอบรายการของตนเองได้ ผู้ปฏิบัติและผู้ตรวจสอบต้องเป็นคนละคนกัน');
  }

  await database
    .update(sqliteSanitationLogs)
    .set({
      verifiedBy: userId,
      verifiedAt: getNow(),
    })
    .where(eq(sqliteSanitationLogs.id, id));

  await createAuditLog({
    userId,
    action: 'APPROVE',
    tableName: 'sanitation_log',
    recordId: id,
    oldValue: existing,
  });

  return getSanitationLogById(id);
}

// ============================================
// Pest Control Logs
// ============================================

/**
 * Get pest control logs with pagination and filters
 */
export async function getPestControlLogs(
  params: PestControlLogListParams = {}
): Promise<PestControlLogListResponse> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;
  const page = params.page || 1;
  const limit = params.limit || 20;
  const offset = (page - 1) * limit;

  const conditions = [];

  if (params.serviceType) {
    conditions.push(eq(sqlitePestControlLogs.serviceType, params.serviceType));
  }
  if (params.fromDate) {
    conditions.push(gte(sqlitePestControlLogs.serviceDate, params.fromDate));
  }
  if (params.toDate) {
    conditions.push(lte(sqlitePestControlLogs.serviceDate, params.toDate));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const logs = await database
    .select({
      log: sqlitePestControlLogs,
      verifier: sqliteUsers,
    })
    .from(sqlitePestControlLogs)
    .leftJoin(sqliteUsers, eq(sqlitePestControlLogs.verifiedBy, sqliteUsers.id))
    .where(whereClause)
    .orderBy(desc(sqlitePestControlLogs.serviceDate))
    .limit(limit)
    .offset(offset);

  const countResult = await database
    .select({ count: sql<number>`count(*)` })
    .from(sqlitePestControlLogs)
    .where(whereClause);

  return {
    logs: logs.map((row: any) => ({
      id: row.log.id,
      serviceDate: row.log.serviceDate,
      contractorName: row.log.contractorName || '',
      technicianName: row.log.technicianName,
      serviceType: row.log.serviceType as 'routine' | 'emergency' | 'follow_up',
      areasServiced: row.log.areasServiced ? JSON.parse(row.log.areasServiced) : [],
      treatmentMethod: row.log.treatmentMethod,
      findingsCount: row.log.findingsCount || 0,
      findings: row.log.findings,
      recommendations: row.log.recommendations,
      followUpRequired: row.log.followUpRequired ?? false,
      followUpDate: row.log.followUpDate,
      verifiedBy: row.log.verifiedBy,
      verifiedByName: row.verifier?.name,
      createdAt: row.log.createdAt,
    })),
    total: countResult[0]?.count || 0,
  };
}

/**
 * Get a single pest control log by ID
 */
export async function getPestControlLogById(id: number): Promise<PestControlLog | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  const logs = await database
    .select({
      log: sqlitePestControlLogs,
      verifier: sqliteUsers,
    })
    .from(sqlitePestControlLogs)
    .leftJoin(sqliteUsers, eq(sqlitePestControlLogs.verifiedBy, sqliteUsers.id))
    .where(eq(sqlitePestControlLogs.id, id))
    .limit(1);

  if (!logs[0]) return null;

  const row = logs[0];
  return {
    id: row.log.id,
    serviceDate: row.log.serviceDate,
    contractorName: row.log.contractorName || '',
    technicianName: row.log.technicianName,
    serviceType: row.log.serviceType as 'routine' | 'emergency' | 'follow_up',
    areasServiced: row.log.areasServiced ? JSON.parse(row.log.areasServiced) : [],
    treatmentMethod: row.log.treatmentMethod,
    findingsCount: row.log.findingsCount || 0,
    findings: row.log.findings,
    recommendations: row.log.recommendations,
    followUpRequired: row.log.followUpRequired ?? false,
    followUpDate: row.log.followUpDate,
    verifiedBy: row.log.verifiedBy,
    verifiedByName: row.verifier?.name,
    createdAt: row.log.createdAt,
  };
}

/**
 * Create a pest control log entry
 */
export async function createPestControlLog(
  data: PestControlLogCreate,
  userId: number
): Promise<PestControlLog> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  const values = {
    serviceDate: data.serviceDate,
    contractorName: data.contractorName,
    technicianName: data.technicianName || null,
    serviceType: data.serviceType,
    areasServiced: JSON.stringify(data.areasServiced),
    treatmentMethod: data.treatmentMethod || null,
    findingsCount: data.findingsCount || 0,
    findings: data.findings || null,
    recommendations: data.recommendations || null,
    followUpRequired: data.followUpRequired ?? false,
    followUpDate: data.followUpDate || null,
    createdAt: getNow(),
  };

  let recordId: number;
  if (isSqlite()) {
    const [result] = await database
      .insert(sqlitePestControlLogs)
      .values(values)
      .returning({ id: sqlitePestControlLogs.id });
    recordId = result.id;
  } else {
    const result = await database
      .insert(sqlitePestControlLogs)
      .values(values);
    recordId = getInsertId(result);
  }

  // Refetch for audit log
  const [record] = await database
    .select()
    .from(sqlitePestControlLogs)
    .where(eq(sqlitePestControlLogs.id, recordId));

  await createAuditLog({
    userId,
    action: 'CREATE',
    tableName: 'pest_control_log',
    recordId: record.id,
    newValue: record,
  });

  return getPestControlLogById(record.id) as Promise<PestControlLog>;
}

/**
 * Update a pest control log
 */
export async function updatePestControlLog(
  id: number,
  data: PestControlLogUpdate,
  userId: number
): Promise<PestControlLog | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  const existing = await getPestControlLogById(id);
  if (!existing) return null;

  const updateData: Record<string, unknown> = {};
  if (data.findings !== undefined) updateData.findings = data.findings;
  if (data.recommendations !== undefined) updateData.recommendations = data.recommendations;
  if (data.followUpRequired !== undefined) updateData.followUpRequired = data.followUpRequired;
  if (data.followUpDate !== undefined) updateData.followUpDate = data.followUpDate;

  if (Object.keys(updateData).length > 0) {
    await database
      .update(sqlitePestControlLogs)
      .set(updateData)
      .where(eq(sqlitePestControlLogs.id, id));
  }

  await createAuditLog({
    userId,
    action: 'UPDATE',
    tableName: 'pest_control_log',
    recordId: id,
    oldValue: existing,
    newValue: { ...existing, ...updateData },
  });

  return getPestControlLogById(id);
}

/**
 * Verify a pest control log
 */
export async function verifyPestControlLog(
  id: number,
  userId: number
): Promise<PestControlLog | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  const existing = await getPestControlLogById(id);
  if (!existing) return null;

  await database
    .update(sqlitePestControlLogs)
    .set({ verifiedBy: userId })
    .where(eq(sqlitePestControlLogs.id, id));

  await createAuditLog({
    userId,
    action: 'APPROVE',
    tableName: 'pest_control_log',
    recordId: id,
    oldValue: existing,
  });

  return getPestControlLogById(id);
}

// ============================================
// Pending Tasks & Trends
// ============================================

/**
 * Get pending sanitation tasks (overdue and upcoming)
 */
export async function getPendingTasks(daysAhead: number = 7): Promise<PendingTask[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;
  const today = new Date();

  // Get all active schedules
  const schedules = await database
    .select()
    .from(sqliteSanitationSchedules)
    .where(eq(sqliteSanitationSchedules.isActive, true));

  const pendingTasks: PendingTask[] = [];

  for (const schedule of schedules) {
    // Calculate next due date
    const nextDue = calculateNextDueDate(schedule);
    if (!nextDue) continue;

    const dueDate = new Date(nextDue);
    const daysDiff = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    // Include overdue or within daysAhead window
    if (daysDiff <= daysAhead) {
      // Check if there's already a log for this due date
      const existingLog = await database
        .select()
        .from(sqliteSanitationLogs)
        .where(
          and(
            eq(sqliteSanitationLogs.scheduleId, schedule.id),
            eq(sqliteSanitationLogs.scheduledDate, nextDue)
          )
        )
        .limit(1);

      if (!existingLog[0] || existingLog[0].status === 'missed') {
        pendingTasks.push({
          scheduleId: schedule.id,
          scheduleName: schedule.name,
          areaType: schedule.areaType as AreaType,
          areaName: schedule.areaType, // Could be enriched with actual area name
          frequency: schedule.frequency as SanitationFrequency,
          dueDate: nextDue,
          isOverdue: daysDiff < 0,
          daysOverdue: daysDiff < 0 ? Math.abs(daysDiff) : 0,
        });
      }
    }
  }

  // Sort by due date (overdue first)
  return pendingTasks.sort((a, b) => {
    if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
    return toDateSafe(a.dueDate).getTime() - toDateSafe(b.dueDate).getTime();
  });
}

/**
 * Get sanitation trends and statistics
 */
export async function getSanitationTrends(
  params: SanitationTrendsParams = {}
): Promise<SanitationTrends> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;
  const period = params.period || 'month';

  // Calculate date range
  const endDate = new Date();
  const startDate = new Date();
  switch (period) {
    case 'week':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(startDate.getMonth() - 1);
      break;
    case 'quarter':
      startDate.setMonth(startDate.getMonth() - 3);
      break;
    case 'year':
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
  }

  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  // Get all logs in the period
  const conditions = [
    gte(sqliteSanitationLogs.performedDate, startDateStr),
    lte(sqliteSanitationLogs.performedDate, endDateStr),
  ];

  const logs = await database
    .select({
      log: sqliteSanitationLogs,
      schedule: sqliteSanitationSchedules,
    })
    .from(sqliteSanitationLogs)
    .leftJoin(
      sqliteSanitationSchedules,
      eq(sqliteSanitationLogs.scheduleId, sqliteSanitationSchedules.id)
    )
    .where(and(...conditions));

  // Filter by area type if specified
  const filteredLogs = params.areaType
    ? logs.filter((l: any) => l.schedule?.areaType === params.areaType)
    : logs;

  // Calculate overall compliance
  const completedCount = filteredLogs.filter((l: any) => l.log.status === 'completed').length;
  const totalCount = filteredLogs.length;
  const overallComplianceRate = totalCount > 0 ? (completedCount / totalCount) * 100 : 100;

  // Calculate by area
  const areaTypes: AreaType[] = ['production', 'warehouse', 'lab', 'office'];
  const byArea = areaTypes.map((areaType: any) => {
    const areaLogs = logs.filter((l: any) => l.schedule?.areaType === areaType);
    const areaCompleted = areaLogs.filter((l: any) => l.log.status === 'completed').length;
    const areaMissed = areaLogs.filter((l: any) => l.log.status === 'missed').length;
    const areaTotal = areaLogs.length;

    return {
      areaType,
      complianceRate: areaTotal > 0 ? (areaCompleted / areaTotal) * 100 : 100,
      completedCount: areaCompleted,
      missedCount: areaMissed,
    };
  });

  // Get pest control activity
  const pestLogs = await database
    .select()
    .from(sqlitePestControlLogs)
    .where(
      and(
        gte(sqlitePestControlLogs.serviceDate, startDateStr),
        lte(sqlitePestControlLogs.serviceDate, endDateStr)
      )
    )
    .orderBy(sqlitePestControlLogs.serviceDate);

  const pestActivityTrend = pestLogs.map((log: any) => ({
    period: log.serviceDate,
    findingsCount: log.findingsCount || 0,
  }));

  // Generate daily data points
  const dataPoints: Array<{
    date: string;
    completed: number;
    missed: number;
    complianceRate: number;
  }> = [];

  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const dayLogs = filteredLogs.filter((l: any) => l.log.performedDate === dateStr);
    const dayCompleted = dayLogs.filter((l: any) => l.log.status === 'completed').length;
    const dayMissed = dayLogs.filter((l: any) => l.log.status === 'missed').length;
    const dayTotal = dayLogs.length;

    dataPoints.push({
      date: dateStr,
      completed: dayCompleted,
      missed: dayMissed,
      complianceRate: dayTotal > 0 ? (dayCompleted / dayTotal) * 100 : 100,
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return {
    period,
    overallComplianceRate,
    byArea,
    pestActivityTrend,
    dataPoints,
  };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Calculate the next due date for a schedule
 */
function calculateNextDueDate(
  schedule: typeof sqliteSanitationSchedules.$inferSelect
): string | null {
  const today = new Date();
  const nextDue = new Date();

  switch (schedule.frequency) {
    case 'daily':
      // Next due is today
      break;

    case 'weekly':
      // Find next occurrence of dayOfWeek
      if (schedule.dayOfWeek !== null) {
        const currentDay = today.getDay();
        let daysUntil = schedule.dayOfWeek - currentDay;
        if (daysUntil <= 0) daysUntil += 7;
        nextDue.setDate(today.getDate() + daysUntil);
      }
      break;

    case 'monthly':
      // Find next occurrence of dayOfMonth
      if (schedule.dayOfMonth !== null) {
        nextDue.setDate(schedule.dayOfMonth);
        if (nextDue <= today) {
          nextDue.setMonth(nextDue.getMonth() + 1);
        }
      }
      break;

    case 'quarterly':
      // Next occurrence in current or next quarter
      const currentQuarter = Math.floor(today.getMonth() / 3);
      const quarterStartMonth = currentQuarter * 3;
      nextDue.setMonth(quarterStartMonth);
      if (schedule.dayOfMonth !== null) {
        nextDue.setDate(schedule.dayOfMonth);
      } else {
        nextDue.setDate(1);
      }
      if (nextDue <= today) {
        nextDue.setMonth(nextDue.getMonth() + 3);
      }
      break;

    default:
      return null;
  }

  return nextDue.toISOString().split('T')[0];
}

/**
 * Calculate compliance rate for a schedule
 */
async function calculateScheduleCompliance(scheduleId: number): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  // Get logs from the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const startDateStr = thirtyDaysAgo.toISOString().split('T')[0];

  const logs = await database
    .select()
    .from(sqliteSanitationLogs)
    .where(
      and(
        eq(sqliteSanitationLogs.scheduleId, scheduleId),
        gte(sqliteSanitationLogs.performedDate, startDateStr)
      )
    );

  if (logs.length === 0) return 100; // No data means assumed compliant

  const completedCount = logs.filter((l: any) => l.status === 'completed').length;
  return (completedCount / logs.length) * 100;
}

// ============================================
// T802: Generate Due Dates
// ============================================

/**
 * Generate expected cleaning dates based on schedule frequency
 */
export async function generateDueDates(
  scheduleId: number,
  dateRange?: DueDateRange
): Promise<GeneratedDueDate[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  // Get the schedule
  const schedule = await database
    .select()
    .from(sqliteSanitationSchedules)
    .where(eq(sqliteSanitationSchedules.id, scheduleId))
    .limit(1);

  if (!schedule || schedule.length === 0) {
    return [];
  }

  const scheduleData = schedule[0];

  // Determine date range (default: today to 30 days from now)
  const startDate = dateRange?.startDate
    ? new Date(dateRange.startDate)
    : new Date();
  const endDate = dateRange?.endDate
    ? new Date(dateRange.endDate)
    : new Date(new Date().getTime() + 30 * 86400000);

  const dueDates: GeneratedDueDate[] = [];

  // Generate due dates based on frequency
  let currentDate = new Date(startDate);

  switch (scheduleData.frequency) {
    case 'daily':
      // Generate daily due dates
      while (currentDate <= endDate) {
        dueDates.push({
          scheduleId: scheduleData.id,
          scheduleName: scheduleData.name,
          areaType: scheduleData.areaType,
          frequency: scheduleData.frequency,
          dueDate: currentDate.toISOString().split('T')[0],
        });
        currentDate = new Date(currentDate.getTime() + 86400000); // Add 1 day
      }
      break;

    case 'weekly':
      // Find all occurrences of dayOfWeek in the date range
      if (scheduleData.dayOfWeek !== null) {
        // Move to first occurrence of dayOfWeek
        while (currentDate.getDay() !== scheduleData.dayOfWeek && currentDate <= endDate) {
          currentDate = new Date(currentDate.getTime() + 86400000);
        }

        // Generate weekly occurrences
        while (currentDate <= endDate) {
          dueDates.push({
            scheduleId: scheduleData.id,
            scheduleName: scheduleData.name,
            areaType: scheduleData.areaType,
            frequency: scheduleData.frequency,
            dueDate: currentDate.toISOString().split('T')[0],
          });
          currentDate = new Date(currentDate.getTime() + 7 * 86400000); // Add 7 days
        }
      }
      break;

    case 'monthly':
      // Find all occurrences of dayOfMonth in the date range
      if (scheduleData.dayOfMonth !== null) {
        // Move to first occurrence of dayOfMonth
        currentDate.setDate(scheduleData.dayOfMonth);
        if (currentDate < startDate) {
          currentDate.setMonth(currentDate.getMonth() + 1);
        }

        // Generate monthly occurrences
        while (currentDate <= endDate) {
          dueDates.push({
            scheduleId: scheduleData.id,
            scheduleName: scheduleData.name,
            areaType: scheduleData.areaType,
            frequency: scheduleData.frequency,
            dueDate: currentDate.toISOString().split('T')[0],
          });
          currentDate.setMonth(currentDate.getMonth() + 1);
        }
      }
      break;

    case 'quarterly':
      // Find all quarter starts in the date range
      const startMonth = Math.floor(currentDate.getMonth() / 3) * 3;
      currentDate.setMonth(startMonth);
      currentDate.setDate(scheduleData.dayOfMonth || 1);

      if (currentDate < startDate) {
        currentDate.setMonth(currentDate.getMonth() + 3);
      }

      // Generate quarterly occurrences
      while (currentDate <= endDate) {
        dueDates.push({
          scheduleId: scheduleData.id,
          scheduleName: scheduleData.name,
          areaType: scheduleData.areaType,
          frequency: scheduleData.frequency,
          dueDate: currentDate.toISOString().split('T')[0],
        });
        currentDate.setMonth(currentDate.getMonth() + 3);
      }
      break;
  }

  return dueDates;
}

// ============================================
// T806: Pest Control Trends
// ============================================

/**
 * Get pest control trends and statistics
 */
export async function getPestControlTrends(
  params: PestControlTrendsParams = {}
): Promise<PestControlTrends> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;
  const period = params.period || 'month';

  // Calculate date range
  const endDate = new Date();
  const startDate = new Date();
  switch (period) {
    case 'week':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(startDate.getMonth() - 1);
      break;
    case 'quarter':
      startDate.setMonth(startDate.getMonth() - 3);
      break;
    case 'year':
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
  }

  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  // Get all pest control logs in the period
  const conditions = [
    gte(sqlitePestControlLogs.serviceDate, startDateStr),
    lte(sqlitePestControlLogs.serviceDate, endDateStr),
  ];

  if (params.areaType) {
    // Note: areasServiced is stored as JSON array, need to use LIKE for SQLite
    // This is a simplified check - in production might need more sophisticated JSON query
    conditions.push(
      sql`${sqlitePestControlLogs.areasServiced} LIKE ${'%' + params.areaType + '%'}`
    );
  }

  const logs = await database
    .select()
    .from(sqlitePestControlLogs)
    .where(and(...conditions))
    .orderBy(sqlitePestControlLogs.serviceDate);

  // Calculate metrics
  const totalServices = logs.length;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalFindings = logs.reduce((sum: number, log: any) => sum + (log.findingsCount || 0), 0);
  const averageFindingsPerService = totalServices > 0 ? totalFindings / totalServices : 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const followUpCount = logs.filter((log: any) => log.followUpRequired).length;
  const followUpRate = totalServices > 0 ? (followUpCount / totalServices) * 100 : 0;

  // Group by service type
  const byServiceTypeMap = new Map<string, { count: number; findings: number }>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logs.forEach((log: any) => {
    const type = log.serviceType;
    const existing = byServiceTypeMap.get(type) || { count: 0, findings: 0 };
    byServiceTypeMap.set(type, {
      count: existing.count + 1,
      findings: existing.findings + (log.findingsCount || 0),
    });
  });

   
  const byServiceType = Array.from(byServiceTypeMap.entries()).map(([type, data]) => ({
    serviceType: type as any,
    serviceCount: data.count,
    averageFindings: data.count > 0 ? data.findings / data.count : 0,
  }));

  // Generate data points (group by date)
  const dataPointsMap = new Map<string, { serviceCount: number; findingsCount: number }>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logs.forEach((log: any) => {
    const date = log.serviceDate;
    const existing = dataPointsMap.get(date) || { serviceCount: 0, findingsCount: 0 };
    dataPointsMap.set(date, {
      serviceCount: existing.serviceCount + 1,
      findingsCount: existing.findingsCount + (log.findingsCount || 0),
    });
  });

  const dataPoints = Array.from(dataPointsMap.entries())
    .map(([date, data]) => ({
      date,
      serviceCount: data.serviceCount,
      findingsCount: data.findingsCount,
    }))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  return {
    period,
    totalServices,
    averageFindingsPerService,
    followUpRate,
    byServiceType,
    dataPoints,
  };
}
