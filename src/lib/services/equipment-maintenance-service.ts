/**
 * Equipment Maintenance Service
 * Phase 10: Equipment Enhancement (Tasks T1002-T1007)
 *
 * Business logic for equipment maintenance, calibration, and status management.
 */

import { eq, and, desc, lte, gte, lt } from 'drizzle-orm';
import { getDb, isSqlite } from '../db';
import { getInsertId } from '../db/db-helper';
import { getNow, toDbDate, getTodayStr, toQueryDate, formatDateFromDb } from '../db/date-utils';
import {
  sqliteEquipment,
  sqliteMaintenanceRecords,
  mysqlEquipment,
  mysqlMaintenanceRecords,
} from '../db/schema';
import { createAuditLog } from '../audit';
import type {
  Equipment,
  MaintenanceRecord,
  ScheduleCalibrationInput,
  OverdueCalibration,
  CalibrationAlert,
  UpdateEquipmentStatusInput,
  UpdateCleaningStatusInput,
  EquipmentListParams,
  CreateMaintenanceRecordInput,
  CompleteCalibrationInput,
  EquipmentStatus,
  MaintenanceType,
  MaintenanceStatus,
} from '@/types/equipment';

// ============================================
// Helper: Get correct tables based on database
// ============================================

function getEquipmentTable() {
  return isSqlite() ? sqliteEquipment : mysqlEquipment;
}

function getMaintenanceRecordsTable() {
  return isSqlite() ? sqliteMaintenanceRecords : mysqlMaintenanceRecords;
}

// Note: getUsersTable is available if needed for future enhancements
// function getUsersTable() {
//   return isSqlite() ? sqliteUsers : mysqlUsers;
// }

// ============================================
// Equipment Query Functions
// ============================================

/**
 * Get equipment by ID
 */
export async function getEquipmentById(id: number): Promise<Equipment | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;
  const equipmentTable = getEquipmentTable();

  const equipment = await database
    .select()
    .from(equipmentTable)
    .where(eq(equipmentTable.id, id))
    .limit(1);

  if (!equipment[0]) return null;

  const row = equipment[0];
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    type: row.type,
    location: row.location,
    model: row.model,
    manufacturer: row.manufacturer,
    serialNumber: row.serialNumber,
    installationDate: row.installationDate ? formatDateFromDb(row.installationDate) : null,
    lastMaintenanceDate: row.lastMaintenanceDate ? formatDateFromDb(row.lastMaintenanceDate) : null,
    nextMaintenanceDate: row.nextMaintenanceDate ? formatDateFromDb(row.nextMaintenanceDate) : null,
    lastCalibrationDate: row.lastCalibrationDate ? formatDateFromDb(row.lastCalibrationDate) : null,
    nextCalibrationDate: row.nextCalibrationDate ? formatDateFromDb(row.nextCalibrationDate) : null,
    cleaningStatus: row.cleaningStatus,
    status: row.status,
    isActive: row.isActive ?? true,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Get equipment list with optional filters
 */
export async function getEquipmentList(
  params: EquipmentListParams = {}
): Promise<Equipment[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;
  const equipmentTable = getEquipmentTable();
  const conditions = [];

  if (params.status) {
    conditions.push(eq(equipmentTable.status, params.status));
  }
  if (params.cleaningStatus) {
    conditions.push(eq(equipmentTable.cleaningStatus, params.cleaningStatus));
  }
  if (params.type) {
    conditions.push(eq(equipmentTable.type, params.type));
  }
  if (params.isActive !== undefined) {
    conditions.push(eq(equipmentTable.isActive, params.isActive));
  }

  const equipment = await database
    .select()
    .from(equipmentTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(equipmentTable.name);

  return equipment.map((row: typeof equipmentTable.$inferSelect) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    type: row.type,
    location: row.location,
    model: row.model,
    manufacturer: row.manufacturer,
    serialNumber: row.serialNumber,
    installationDate: row.installationDate ? formatDateFromDb(row.installationDate) : null,
    lastMaintenanceDate: row.lastMaintenanceDate ? formatDateFromDb(row.lastMaintenanceDate) : null,
    nextMaintenanceDate: row.nextMaintenanceDate ? formatDateFromDb(row.nextMaintenanceDate) : null,
    lastCalibrationDate: row.lastCalibrationDate ? formatDateFromDb(row.lastCalibrationDate) : null,
    nextCalibrationDate: row.nextCalibrationDate ? formatDateFromDb(row.nextCalibrationDate) : null,
    cleaningStatus: row.cleaningStatus,
    status: row.status,
    isActive: row.isActive ?? true,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

// ============================================
// Maintenance Records
// ============================================

/**
 * Create a maintenance record
 */
export async function createMaintenanceRecord(
  data: CreateMaintenanceRecordInput,
  userId: number
): Promise<MaintenanceRecord> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;
  const maintenanceTable = getMaintenanceRecordsTable();

  const values = {
    equipmentId: data.equipmentId,
    type: data.type,
    description: data.description || null,
    scheduledDate: data.scheduledDate ? toDbDate(data.scheduledDate) : null,
    completedDate: data.completedDate ? toDbDate(data.completedDate) : null,
    performedBy: data.performedBy || null,
    cost: data.cost || null,
    notes: data.notes || null,
    status: data.status || 'scheduled',
    createdAt: getNow(),
    updatedAt: getNow(),
  };

  let recordId: number;
  if (isSqlite()) {
    const [result] = await database
      .insert(maintenanceTable)
      .values(values)
      .returning({ id: maintenanceTable.id });
    recordId = result.id;
  } else {
    const result = await database.insert(maintenanceTable).values(values);
    recordId = getInsertId(result);
  }

  // Refetch the record for response
  const [record] = await database
    .select()
    .from(maintenanceTable)
    .where(eq(maintenanceTable.id, recordId));

  await createAuditLog({
    userId,
    action: 'CREATE',
    tableName: 'maintenance_records',
    recordId,
    newValue: record,
  });

  // Get equipment name for response
  const equipment = await getEquipmentById(data.equipmentId);

  return {
    id: record.id,
    equipmentId: record.equipmentId,
    equipmentName: equipment?.name,
    type: record.type as MaintenanceType,
    description: record.description,
    scheduledDate: record.scheduledDate ? formatDateFromDb(record.scheduledDate) : null,
    completedDate: record.completedDate ? formatDateFromDb(record.completedDate) : null,
    performedBy: record.performedBy,
    cost: record.cost ? Number(record.cost) : null,
    notes: record.notes,
    status: record.status as MaintenanceStatus,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

// ============================================
// T1003: Schedule Calibration
// ============================================

/**
 * Schedule a calibration for equipment
 * Creates a maintenance record with type='calibration' and updates nextCalibrationDate
 */
export async function scheduleCalibration(
  input: ScheduleCalibrationInput,
  userId: number
): Promise<MaintenanceRecord> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;
  const equipmentTable = getEquipmentTable();

  // Verify equipment exists
  const equipment = await getEquipmentById(input.equipmentId);
  if (!equipment) {
    throw new Error(`Equipment with ID ${input.equipmentId} not found`);
  }

  // Create maintenance record
  const maintenanceRecord = await createMaintenanceRecord(
    {
      equipmentId: input.equipmentId,
      type: 'calibration',
      description: input.description || 'Scheduled calibration',
      scheduledDate: input.scheduledDate,
      performedBy: input.assignedTo,
      status: 'scheduled',
    },
    userId
  );

  // Update equipment's nextCalibrationDate
  await database
    .update(equipmentTable)
    .set({
      nextCalibrationDate: toDbDate(input.scheduledDate),
      updatedAt: getNow(),
    })
    .where(eq(equipmentTable.id, input.equipmentId));

  await createAuditLog({
    userId,
    action: 'UPDATE',
    tableName: 'equipment',
    recordId: input.equipmentId,
    newValue: { nextCalibrationDate: input.scheduledDate },
  });

  return maintenanceRecord;
}

// ============================================
// T1004: Get Overdue Calibrations
// ============================================

/**
 * Get equipment with overdue calibrations
 * Returns equipment where nextCalibrationDate < today (or N days ago)
 */
export async function getOverdueCalibrations(
  daysOverdue: number = 0
): Promise<OverdueCalibration[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;
  const equipmentTable = getEquipmentTable();

  // Calculate the threshold date
  const today = new Date();
  const thresholdDate = new Date(today);
  thresholdDate.setDate(today.getDate() - daysOverdue);
  const threshold = toQueryDate(thresholdDate);

  // Query equipment with overdue calibrations
  const equipment = await database
    .select()
    .from(equipmentTable)
    .where(
      and(
        eq(equipmentTable.isActive, true),
        lt(equipmentTable.nextCalibrationDate, threshold)
      )
    )
    .orderBy(equipmentTable.nextCalibrationDate);

  return equipment.map((row: typeof equipmentTable.$inferSelect) => {
    const nextCalDate = row.nextCalibrationDate
      ? new Date(formatDateFromDb(row.nextCalibrationDate))
      : null;
    const daysOverdueCalc = nextCalDate
      ? Math.floor((today.getTime() - nextCalDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    return {
      equipmentId: row.id,
      equipmentName: row.name,
      equipmentType: row.type || '',
      lastCalibrationDate: row.lastCalibrationDate
        ? formatDateFromDb(row.lastCalibrationDate)
        : null,
      nextCalibrationDate: row.nextCalibrationDate
        ? formatDateFromDb(row.nextCalibrationDate)
        : null,
      daysOverdue: daysOverdueCalc,
    };
  });
}

// ============================================
// T1005: Send Calibration Alerts
// ============================================

/**
 * Get equipment needing calibration within N days
 * For now just returns the list (actual notification can be added later)
 */
export async function sendCalibrationAlerts(
  daysAhead: number = 7
): Promise<CalibrationAlert[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;
  const equipmentTable = getEquipmentTable();

  // Calculate the threshold date (today + daysAhead)
  const today = new Date();
  const futureDate = new Date(today);
  futureDate.setDate(today.getDate() + daysAhead);

  const todayQuery = toQueryDate(today);
  const futureQuery = toQueryDate(futureDate);

  // Query equipment needing calibration within daysAhead
  const equipment = await database
    .select()
    .from(equipmentTable)
    .where(
      and(
        eq(equipmentTable.isActive, true),
        gte(equipmentTable.nextCalibrationDate, todayQuery),
        lte(equipmentTable.nextCalibrationDate, futureQuery)
      )
    )
    .orderBy(equipmentTable.nextCalibrationDate);

  return equipment.map((row: typeof equipmentTable.$inferSelect) => {
    const nextCalDate = row.nextCalibrationDate
      ? new Date(formatDateFromDb(row.nextCalibrationDate))
      : new Date();
    const daysUntil = Math.floor(
      (nextCalDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      equipmentId: row.id,
      equipmentName: row.name,
      equipmentType: row.type || '',
      nextCalibrationDate: formatDateFromDb(row.nextCalibrationDate),
      daysUntil,
    };
  });
}

// ============================================
// T1006: Update Equipment Status
// ============================================

/**
 * Update equipment status with validation
 * Validates status transitions and creates audit log
 */
export async function updateEquipmentStatus(
  input: UpdateEquipmentStatusInput
): Promise<Equipment> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;
  const equipmentTable = getEquipmentTable();

  // Verify equipment exists
  const equipment = await getEquipmentById(input.equipmentId);
  if (!equipment) {
    throw new Error(`Equipment with ID ${input.equipmentId} not found`);
  }

  // Validate status transition
  // Example: can't go from inactive to active without maintenance
  const currentStatus = equipment.status as EquipmentStatus;
  if (currentStatus === 'inactive' && input.newStatus === 'active') {
    // Check if there's a recent completed maintenance
    const maintenanceTable = getMaintenanceRecordsTable();
    const recentMaintenance = await database
      .select()
      .from(maintenanceTable)
      .where(
        and(
          eq(maintenanceTable.equipmentId, input.equipmentId),
          eq(maintenanceTable.status, 'completed')
        )
      )
      .orderBy(desc(maintenanceTable.completedDate))
      .limit(1);

    if (!recentMaintenance || recentMaintenance.length === 0) {
      throw new Error(
        'Cannot activate equipment without completed maintenance record'
      );
    }
  }

  // Update equipment status
  await database
    .update(equipmentTable)
    .set({
      status: input.newStatus,
      updatedAt: getNow(),
    })
    .where(eq(equipmentTable.id, input.equipmentId));

  // Create audit log
  await createAuditLog({
    userId: input.userId,
    action: 'UPDATE',
    tableName: 'equipment',
    recordId: input.equipmentId,
    oldValue: { status: currentStatus },
    newValue: { status: input.newStatus, reason: input.reason },
  });

  // Return updated equipment
  const updated = await getEquipmentById(input.equipmentId);
  if (!updated) {
    throw new Error('Failed to retrieve updated equipment');
  }
  return updated;
}

// ============================================
// T1007: Update Cleaning Status
// ============================================

/**
 * Update equipment cleaning status
 * Creates audit log for tracking
 */
export async function updateCleaningStatus(
  input: UpdateCleaningStatusInput
): Promise<Equipment> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;
  const equipmentTable = getEquipmentTable();

  // Verify equipment exists
  const equipment = await getEquipmentById(input.equipmentId);
  if (!equipment) {
    throw new Error(`Equipment with ID ${input.equipmentId} not found`);
  }

  const oldCleaningStatus = equipment.cleaningStatus;

  // Update cleaning status
  await database
    .update(equipmentTable)
    .set({
      cleaningStatus: input.cleaningStatus,
      updatedAt: getNow(),
    })
    .where(eq(equipmentTable.id, input.equipmentId));

  // Create audit log
  await createAuditLog({
    userId: input.userId,
    action: 'UPDATE',
    tableName: 'equipment',
    recordId: input.equipmentId,
    oldValue: { cleaningStatus: oldCleaningStatus },
    newValue: { cleaningStatus: input.cleaningStatus },
  });

  // Return updated equipment
  const updated = await getEquipmentById(input.equipmentId);
  if (!updated) {
    throw new Error('Failed to retrieve updated equipment');
  }
  return updated;
}

// ============================================
// Complete Calibration
// ============================================

/**
 * Complete a calibration and update equipment dates
 * Updates lastCalibrationDate and calculates nextCalibrationDate
 */
export async function completeCalibration(
  input: CompleteCalibrationInput
): Promise<Equipment> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;
  const equipmentTable = getEquipmentTable();

  // Verify equipment exists
  const equipment = await getEquipmentById(input.equipmentId);
  if (!equipment) {
    throw new Error(`Equipment with ID ${input.equipmentId} not found`);
  }

  // Calculate next calibration date (default 365 days from now)
  const today = new Date();
  const intervalDays = input.calibrationIntervalDays || 365;
  const nextCalibrationDate = new Date(today);
  nextCalibrationDate.setDate(today.getDate() + intervalDays);

  // Update equipment
  await database
    .update(equipmentTable)
    .set({
      lastCalibrationDate: toDbDate(getTodayStr()),
      nextCalibrationDate: toDbDate(nextCalibrationDate.toISOString().split('T')[0]),
      updatedAt: getNow(),
    })
    .where(eq(equipmentTable.id, input.equipmentId));

  // Create audit log
  await createAuditLog({
    userId: input.userId,
    action: 'UPDATE',
    tableName: 'equipment',
    recordId: input.equipmentId,
    newValue: {
      lastCalibrationDate: getTodayStr(),
      nextCalibrationDate: nextCalibrationDate.toISOString().split('T')[0],
    },
  });

  // Return updated equipment
  const updated = await getEquipmentById(input.equipmentId);
  if (!updated) {
    throw new Error('Failed to retrieve updated equipment');
  }
  return updated;
}
