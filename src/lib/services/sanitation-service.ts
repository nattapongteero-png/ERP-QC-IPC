/**
 * Sanitation Service
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 4)
 *
 * Business logic for sanitation schedules, logs, and pest control.
 */

import { eq, and, desc, sql, gte, lte } from 'drizzle-orm';
import { getSqliteDb } from '../db';
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
  const database = getSqliteDb();
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
    schedules.map(async (schedule) => {
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
  const database = getSqliteDb();

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
  const database = getSqliteDb();

  const result = await database
    .insert(sqliteSanitationSchedules)
    .values({
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
      createdAt: new Date().toISOString(),
    })
    .returning();

  await createAuditLog({
    userId,
    action: 'CREATE',
    entityType: 'sanitation_schedule',
    entityId: result[0].id,
    newValue: result[0],
  });

  return {
    id: result[0].id,
    name: result[0].name,
    areaType: result[0].areaType as AreaType,
    areaId: result[0].areaId,
    equipmentId: result[0].equipmentId,
    frequency: result[0].frequency as SanitationFrequency,
    dayOfWeek: result[0].dayOfWeek,
    dayOfMonth: result[0].dayOfMonth,
    method: result[0].method || '',
    verificationRequired: result[0].verificationRequired ?? true,
    isActive: result[0].isActive ?? true,
    lastCompleted: null,
    nextDue: calculateNextDueDate(result[0]),
    complianceRate: 100,
    createdAt: result[0].createdAt,
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
  const database = getSqliteDb();

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
    entityType: 'sanitation_schedule',
    entityId: id,
    previousValue: existing,
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
  const database = getSqliteDb();

  const existing = await getSanitationScheduleById(id);
  if (!existing) return false;

  await database
    .update(sqliteSanitationSchedules)
    .set({ isActive: false })
    .where(eq(sqliteSanitationSchedules.id, id));

  await createAuditLog({
    userId,
    action: 'DELETE',
    entityType: 'sanitation_schedule',
    entityId: id,
    previousValue: existing,
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
  const database = getSqliteDb();
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
      (l) => l.schedule?.areaType === params.areaType
    );
  }

  const countResult = await database
    .select({ count: sql<number>`count(*)` })
    .from(sqliteSanitationLogs)
    .where(whereClause);

  return {
    logs: filteredLogs.map((row) => ({
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
  const database = getSqliteDb();

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
  const database = getSqliteDb();

  // Get the schedule's method if not provided
  let method = data.method;
  if (!method && data.scheduleId) {
    const schedule = await getSanitationScheduleById(data.scheduleId);
    method = schedule?.method || '';
  }

  const result = await database
    .insert(sqliteSanitationLogs)
    .values({
      scheduleId: data.scheduleId,
      scheduledDate: data.scheduledDate || new Date().toISOString().split('T')[0],
      performedDate: data.performedDate,
      performedBy: userId,
      method: method || '',
      chemicalsUsed: data.chemicalsUsed || null,
      status: data.status,
      notes: data.notes || null,
      createdAt: new Date().toISOString(),
    })
    .returning();

  await createAuditLog({
    userId,
    action: 'CREATE',
    entityType: 'sanitation_log',
    entityId: result[0].id,
    newValue: result[0],
  });

  return getSanitationLogById(result[0].id) as Promise<SanitationLog>;
}

/**
 * Update a sanitation log
 */
export async function updateSanitationLog(
  id: number,
  data: SanitationLogUpdate,
  userId: number
): Promise<SanitationLog | null> {
  const database = getSqliteDb();

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
    entityType: 'sanitation_log',
    entityId: id,
    previousValue: existing,
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
  const database = getSqliteDb();

  const existing = await getSanitationLogById(id);
  if (!existing) return null;

  await database
    .update(sqliteSanitationLogs)
    .set({
      verifiedBy: userId,
      verifiedAt: new Date().toISOString(),
    })
    .where(eq(sqliteSanitationLogs.id, id));

  await createAuditLog({
    userId,
    action: 'VERIFY',
    entityType: 'sanitation_log',
    entityId: id,
    previousValue: existing,
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
  const database = getSqliteDb();
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
    logs: logs.map((row) => ({
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
  const database = getSqliteDb();

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
  const database = getSqliteDb();

  const result = await database
    .insert(sqlitePestControlLogs)
    .values({
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
      createdAt: new Date().toISOString(),
    })
    .returning();

  await createAuditLog({
    userId,
    action: 'CREATE',
    entityType: 'pest_control_log',
    entityId: result[0].id,
    newValue: result[0],
  });

  return getPestControlLogById(result[0].id) as Promise<PestControlLog>;
}

/**
 * Update a pest control log
 */
export async function updatePestControlLog(
  id: number,
  data: PestControlLogUpdate,
  userId: number
): Promise<PestControlLog | null> {
  const database = getSqliteDb();

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
    entityType: 'pest_control_log',
    entityId: id,
    previousValue: existing,
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
  const database = getSqliteDb();

  const existing = await getPestControlLogById(id);
  if (!existing) return null;

  await database
    .update(sqlitePestControlLogs)
    .set({ verifiedBy: userId })
    .where(eq(sqlitePestControlLogs.id, id));

  await createAuditLog({
    userId,
    action: 'VERIFY',
    entityType: 'pest_control_log',
    entityId: id,
    previousValue: existing,
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
  const database = getSqliteDb();
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
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });
}

/**
 * Get sanitation trends and statistics
 */
export async function getSanitationTrends(
  params: SanitationTrendsParams = {}
): Promise<SanitationTrends> {
  const database = getSqliteDb();
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
    ? logs.filter((l) => l.schedule?.areaType === params.areaType)
    : logs;

  // Calculate overall compliance
  const completedCount = filteredLogs.filter((l) => l.log.status === 'completed').length;
  const totalCount = filteredLogs.length;
  const overallComplianceRate = totalCount > 0 ? (completedCount / totalCount) * 100 : 100;

  // Calculate by area
  const areaTypes: AreaType[] = ['production', 'warehouse', 'lab', 'office'];
  const byArea = areaTypes.map((areaType) => {
    const areaLogs = logs.filter((l) => l.schedule?.areaType === areaType);
    const areaCompleted = areaLogs.filter((l) => l.log.status === 'completed').length;
    const areaMissed = areaLogs.filter((l) => l.log.status === 'missed').length;
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

  const pestActivityTrend = pestLogs.map((log) => ({
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
    const dayLogs = filteredLogs.filter((l) => l.log.performedDate === dateStr);
    const dayCompleted = dayLogs.filter((l) => l.log.status === 'completed').length;
    const dayMissed = dayLogs.filter((l) => l.log.status === 'missed').length;
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
  const database = getSqliteDb();

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

  const completedCount = logs.filter((l) => l.status === 'completed').length;
  return (completedCount / logs.length) * 100;
}
