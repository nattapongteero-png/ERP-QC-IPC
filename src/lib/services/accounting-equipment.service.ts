/**
 * Equipment and Maintenance Service
 * Feature: 010-accounting-module-integration
 * User Story 8: Track Equipment and Maintenance Costs
 *
 * Equipment tracking, maintenance scheduling, and MTBF analysis
 * for manufacturing operations and GMP compliance.
 */

import { getDb, isSqlite } from '../db';
import { getNow, toDbDate, toQueryDate, getTodayStr, formatDateFromDb } from '../db/date-utils';
import { eq, and, sql, desc, asc, gte, lte, or, isNull, lt } from 'drizzle-orm';
import { getAccountingTables } from './accounting.service';
import type {
  EquipmentCreateInput,
  EquipmentUpdateInput,
  EquipmentQueryInput,
  MaintenanceScheduleCreateInput,
  MaintenanceScheduleUpdateInput,
  MaintenanceRecordCreateInput,
  MaintenanceRecordQueryInput,
  MaintenanceDueQueryInput,
} from '../validation/accounting';
import type {
  AccountingEquipment,
  AcctMaintenanceSchedule,
  AcctMaintenanceRecord,
  FixedAsset,
} from '@/lib/db/schema';

// ============================================
// Equipment Functions
// ============================================

/**
 * Create equipment linked to a fixed asset
 */
export async function createEquipment(
  input: EquipmentCreateInput,
  createdBy?: number
): Promise<{ id: number }> {
  const { equipment, fixedAssets } = getAccountingTables();
  const database = (await getDb()) as any;

  // Verify fixed asset exists
  const asset = await database
    .select()
    .from(fixedAssets)
    .where(eq(fixedAssets.id, input.fixedAssetId))
    .limit(1);

  if (asset.length === 0) {
    throw new Error('Fixed asset not found');
  }

  // Check if equipment already exists for this asset
  const existing = await database
    .select()
    .from(equipment)
    .where(eq(equipment.fixedAssetId, input.fixedAssetId))
    .limit(1);

  if (existing.length > 0) {
    throw new Error('Equipment already exists for this fixed asset');
  }

  const result = await database.insert(equipment).values({
    fixedAssetId: input.fixedAssetId,
    serialNumber: input.serialNumber,
    manufacturer: input.manufacturer,
    model: input.model,
    specifications: input.specifications,
    warrantyStartDate: input.warrantyStartDate ? toDbDate(input.warrantyStartDate) : null,
    warrantyEndDate: input.warrantyEndDate ? toDbDate(input.warrantyEndDate) : null,
    operatingHours: 0,
    operatingUnits: 0,
    lastMeterReading: 0,
    isAvailable: true,
    createdAt: getNow(),
    updatedAt: getNow(),
  } as Record<string, unknown>);

  const insertedId = isSqlite()
    ? (result as { lastInsertRowid: number }).lastInsertRowid
    : (result as unknown as [{ insertId: number }])[0].insertId;

  return { id: Number(insertedId) };
}

/**
 * Get equipment by ID with fixed asset info
 */
export async function getEquipmentById(id: number): Promise<(AccountingEquipment & { asset?: FixedAsset }) | null> {
  const { equipment, fixedAssets } = getAccountingTables();
  const database = (await getDb()) as any;

  const result = await database
    .select({
      equipment: equipment,
      asset: fixedAssets,
    })
    .from(equipment)
    .leftJoin(fixedAssets, eq(equipment.fixedAssetId, fixedAssets.id))
    .where(eq(equipment.id, id))
    .limit(1);

  if (result.length === 0) return null;

  return {
    ...(result[0].equipment as AccountingEquipment),
    asset: result[0].asset as FixedAsset | undefined,
  };
}

/**
 * List equipment with filters
 */
export async function listEquipment(
  filters?: EquipmentQueryInput
): Promise<Array<AccountingEquipment & { assetCode?: string; assetName?: string }>> {
  const { equipment, fixedAssets } = getAccountingTables();
  const database = (await getDb()) as any;

  let query = database
    .select({
      equipment: equipment,
      assetCode: fixedAssets.assetCode,
      assetName: fixedAssets.nameTh,
    })
    .from(equipment)
    .leftJoin(fixedAssets, eq(equipment.fixedAssetId, fixedAssets.id));

  const conditions = [];

  if (filters?.isAvailable !== undefined) {
    conditions.push(eq(equipment.isAvailable, filters.isAvailable === 'true'));
  }

  if (filters?.manufacturer) {
    conditions.push(eq(equipment.manufacturer, filters.manufacturer));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  const result = await query.orderBy(desc(equipment.createdAt));

  return result.map((row: { equipment: AccountingEquipment; assetCode: string | null; assetName: string | null }) => ({
    ...(row.equipment as AccountingEquipment),
    assetCode: row.assetCode || undefined,
    assetName: row.assetName || undefined,
  }));
}

/**
 * Update equipment details
 */
export async function updateEquipment(
  id: number,
  input: EquipmentUpdateInput
): Promise<void> {
  const { equipment } = getAccountingTables();
  const database = (await getDb()) as any;

  const updateData: Record<string, unknown> = {
    ...input,
    updatedAt: getNow(),
  };

  if (input.warrantyStartDate) {
    updateData.warrantyStartDate = toDbDate(input.warrantyStartDate);
  }
  if (input.warrantyEndDate) {
    updateData.warrantyEndDate = toDbDate(input.warrantyEndDate);
  }

  await database
    .update(equipment)
    .set(updateData)
    .where(eq(equipment.id, id));
}

/**
 * Update meter reading (operating hours/units)
 */
export async function updateMeterReading(
  equipmentId: number,
  reading: number,
  readingDate?: string
): Promise<{ previousReading: number; newReading: number; hoursAdded: number }> {
  const { equipment } = getAccountingTables();
  const database = (await getDb()) as any;

  // Get current equipment
  const current = await database
    .select()
    .from(equipment)
    .where(eq(equipment.id, equipmentId))
    .limit(1);

  if (current.length === 0) {
    throw new Error('Equipment not found');
  }

  const currentEquipment = current[0] as AccountingEquipment;
  const previousReading = Number(currentEquipment.lastMeterReading) || 0;

  if (reading < previousReading) {
    throw new Error('New meter reading cannot be less than previous reading');
  }

  const hoursAdded = reading - previousReading;
  const newOperatingHours = (Number(currentEquipment.operatingHours) || 0) + hoursAdded;

  await database
    .update(equipment)
    .set({
      lastMeterReading: reading,
      lastMeterReadingDate: toDbDate(readingDate || getTodayStr()),
      operatingHours: newOperatingHours,
      updatedAt: getNow(),
    } as Record<string, unknown>)
    .where(eq(equipment.id, equipmentId));

  return {
    previousReading,
    newReading: reading,
    hoursAdded,
  };
}

// ============================================
// Maintenance Schedule Functions
// ============================================

/**
 * Create maintenance schedule
 */
export async function createMaintenanceSchedule(
  input: MaintenanceScheduleCreateInput,
  createdBy?: number
): Promise<{ id: number }> {
  const { maintenanceSchedules, equipment } = getAccountingTables();
  const database = (await getDb()) as any;

  // Verify equipment exists
  const eq_result = await database
    .select()
    .from(equipment)
    .where(eq(equipment.id, input.equipmentId))
    .limit(1);

  if (eq_result.length === 0) {
    throw new Error('Equipment not found');
  }

  // Calculate next due date
  const nextDue = calculateNextDueDate(
    getTodayStr(),
    input.intervalType,
    input.intervalValue
  );

  const result = await database.insert(maintenanceSchedules).values({
    equipmentId: input.equipmentId,
    maintenanceType: input.maintenanceType,
    description: input.description,
    intervalType: input.intervalType,
    intervalValue: input.intervalValue,
    nextDue: toDbDate(nextDue),
    alertDaysBefore: input.alertDaysBefore || 7,
    isActive: true,
    createdBy,
    createdAt: getNow(),
    updatedAt: getNow(),
  } as Record<string, unknown>);

  const insertedId = isSqlite()
    ? (result as { lastInsertRowid: number }).lastInsertRowid
    : (result as unknown as [{ insertId: number }])[0].insertId;

  return { id: Number(insertedId) };
}

/**
 * Calculate next due date based on interval
 */
function calculateNextDueDate(
  fromDate: string,
  intervalType: string,
  intervalValue: number
): string {
  const date = new Date(fromDate);

  switch (intervalType) {
    case 'days':
      date.setDate(date.getDate() + intervalValue);
      break;
    case 'weeks':
      date.setDate(date.getDate() + intervalValue * 7);
      break;
    case 'months':
      date.setMonth(date.getMonth() + intervalValue);
      break;
    case 'hours':
    case 'units':
      // For hours/units, we set a default date but track by usage
      date.setMonth(date.getMonth() + 1);
      break;
    default:
      date.setMonth(date.getMonth() + 1);
  }

  return date.toISOString().split('T')[0];
}

/**
 * Update maintenance schedule
 */
export async function updateMaintenanceSchedule(
  id: number,
  input: MaintenanceScheduleUpdateInput
): Promise<void> {
  const { maintenanceSchedules } = getAccountingTables();
  const database = (await getDb()) as any;

  await database
    .update(maintenanceSchedules)
    .set({
      ...input,
      updatedAt: getNow(),
    } as Record<string, unknown>)
    .where(eq(maintenanceSchedules.id, id));
}

/**
 * Get maintenance schedules for equipment
 */
export async function getEquipmentSchedules(
  equipmentId: number
): Promise<AcctMaintenanceSchedule[]> {
  const { maintenanceSchedules } = getAccountingTables();
  const database = (await getDb()) as any;

  const result = await database
    .select()
    .from(maintenanceSchedules)
    .where(and(
      eq(maintenanceSchedules.equipmentId, equipmentId),
      eq(maintenanceSchedules.isActive, true)
    ))
    .orderBy(asc(maintenanceSchedules.nextDue));

  return result as AcctMaintenanceSchedule[];
}

// ============================================
// Maintenance Record Functions
// ============================================

/**
 * Record a maintenance event
 */
export async function recordMaintenanceEvent(
  input: MaintenanceRecordCreateInput,
  createdBy?: number
): Promise<{ id: number; totalCost: number }> {
  const { maintenanceRecords, maintenanceSchedules, equipment } = getAccountingTables();
  const database = (await getDb()) as any;

  // Calculate total cost
  const partsCost = input.partsCost || 0;
  const laborCost = input.laborCost || 0;
  const externalServiceCost = input.externalServiceCost || 0;
  const totalCost = partsCost + laborCost + externalServiceCost;

  const result = await database.insert(maintenanceRecords).values({
    equipmentId: input.equipmentId,
    maintenanceScheduleId: input.maintenanceScheduleId,
    maintenanceDate: toDbDate(input.maintenanceDate),
    maintenanceType: input.maintenanceType,
    description: input.description,
    hoursAtMaintenance: input.hoursAtMaintenance,
    partsUsed: input.partsUsed ? JSON.stringify(input.partsUsed) : null,
    partsCost,
    laborHours: input.laborHours || 0,
    laborCost,
    externalServiceCost,
    totalCost,
    downtimeHours: input.downtimeHours || 0,
    isCritical: input.isCritical || false,
    rootCause: input.rootCause,
    performedBy: input.performedBy,
    createdBy,
    createdAt: getNow(),
    updatedAt: getNow(),
  } as Record<string, unknown>);

  const insertedId = isSqlite()
    ? (result as { lastInsertRowid: number }).lastInsertRowid
    : (result as unknown as [{ insertId: number }])[0].insertId;

  // Update equipment last maintenance date
  await database
    .update(equipment)
    .set({
      lastMaintenanceDate: toDbDate(input.maintenanceDate),
      updatedAt: getNow(),
    } as Record<string, unknown>)
    .where(eq(equipment.id, input.equipmentId));

  // If linked to a schedule, update the schedule
  if (input.maintenanceScheduleId) {
    const schedule = await database
      .select()
      .from(maintenanceSchedules)
      .where(eq(maintenanceSchedules.id, input.maintenanceScheduleId))
      .limit(1);

    if (schedule.length > 0) {
      const s = schedule[0] as AcctMaintenanceSchedule;
      const nextDue = calculateNextDueDate(
        input.maintenanceDate,
        s.intervalType,
        s.intervalValue
      );

      await database
        .update(maintenanceSchedules)
        .set({
          lastPerformed: toDbDate(input.maintenanceDate),
          lastPerformedHours: input.hoursAtMaintenance,
          nextDue: toDbDate(nextDue),
          updatedAt: getNow(),
        } as Record<string, unknown>)
        .where(eq(maintenanceSchedules.id, input.maintenanceScheduleId));

      // Update equipment next maintenance due
      await database
        .update(equipment)
        .set({
          nextMaintenanceDue: toDbDate(nextDue),
          updatedAt: getNow(),
        } as Record<string, unknown>)
        .where(eq(equipment.id, input.equipmentId));
    }
  }

  return { id: Number(insertedId), totalCost };
}

/**
 * Get maintenance history for equipment
 */
export async function getEquipmentMaintenanceHistory(
  equipmentId: number,
  filters?: MaintenanceRecordQueryInput
): Promise<AcctMaintenanceRecord[]> {
  const { maintenanceRecords } = getAccountingTables();
  const database = (await getDb()) as any;

  const conditions = [eq(maintenanceRecords.equipmentId, equipmentId)];

  if (filters?.maintenanceType) {
    conditions.push(eq(maintenanceRecords.maintenanceType, filters.maintenanceType));
  }

  if (filters?.dateFrom) {
    conditions.push(gte(maintenanceRecords.maintenanceDate, toQueryDate(filters.dateFrom)));
  }

  if (filters?.dateTo) {
    conditions.push(lte(maintenanceRecords.maintenanceDate, toQueryDate(filters.dateTo)));
  }

  const result = await database
    .select()
    .from(maintenanceRecords)
    .where(and(...conditions))
    .orderBy(desc(maintenanceRecords.maintenanceDate));

  return result as AcctMaintenanceRecord[];
}

// ============================================
// Due/Overdue Maintenance Functions
// ============================================

/**
 * Get upcoming maintenance (due within specified days)
 */
export async function getUpcomingMaintenance(
  filters?: MaintenanceDueQueryInput
): Promise<Array<{
  schedule: AcctMaintenanceSchedule;
  equipment: AccountingEquipment;
  daysUntilDue: number;
}>> {
  const { maintenanceSchedules, equipment } = getAccountingTables();
  const database = (await getDb()) as any;

  const daysAhead = filters?.daysAhead || 30;
  const today = getTodayStr();
  const futureDate = new Date(today);
  futureDate.setDate(futureDate.getDate() + daysAhead);
  const futureDateStr = futureDate.toISOString().split('T')[0];

  const conditions = [
    eq(maintenanceSchedules.isActive, true),
    gte(maintenanceSchedules.nextDue, toQueryDate(today)),
    lte(maintenanceSchedules.nextDue, toQueryDate(futureDateStr)),
  ];

  if (filters?.equipmentId) {
    conditions.push(eq(maintenanceSchedules.equipmentId, filters.equipmentId));
  }

  const result = await database
    .select({
      schedule: maintenanceSchedules,
      equipment: equipment,
    })
    .from(maintenanceSchedules)
    .innerJoin(equipment, eq(maintenanceSchedules.equipmentId, equipment.id))
    .where(and(...conditions))
    .orderBy(asc(maintenanceSchedules.nextDue));

  return result.map((row: { schedule: AcctMaintenanceSchedule; equipment: AccountingEquipment }) => {
    const schedule = row.schedule as AcctMaintenanceSchedule;
    const nextDue = formatDateFromDb(schedule.nextDue);
    const daysUntilDue = Math.ceil(
      (new Date(nextDue).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      schedule,
      equipment: row.equipment as AccountingEquipment,
      daysUntilDue,
    };
  });
}

/**
 * Get overdue maintenance
 */
export async function getOverdueMaintenance(
  filters?: { equipmentId?: number }
): Promise<Array<{
  schedule: AcctMaintenanceSchedule;
  equipment: AccountingEquipment;
  daysOverdue: number;
}>> {
  const { maintenanceSchedules, equipment } = getAccountingTables();
  const database = (await getDb()) as any;

  const today = getTodayStr();

  const conditions = [
    eq(maintenanceSchedules.isActive, true),
    lt(maintenanceSchedules.nextDue, toQueryDate(today)),
  ];

  if (filters?.equipmentId) {
    conditions.push(eq(maintenanceSchedules.equipmentId, filters.equipmentId));
  }

  const result = await database
    .select({
      schedule: maintenanceSchedules,
      equipment: equipment,
    })
    .from(maintenanceSchedules)
    .innerJoin(equipment, eq(maintenanceSchedules.equipmentId, equipment.id))
    .where(and(...conditions))
    .orderBy(asc(maintenanceSchedules.nextDue));

  return result.map((row: { schedule: AcctMaintenanceSchedule; equipment: AccountingEquipment }) => {
    const schedule = row.schedule as AcctMaintenanceSchedule;
    const nextDue = formatDateFromDb(schedule.nextDue);
    const daysOverdue = Math.ceil(
      (new Date(today).getTime() - new Date(nextDue).getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      schedule,
      equipment: row.equipment as AccountingEquipment,
      daysOverdue,
    };
  });
}

// ============================================
// MTBF Analysis Functions
// ============================================

export interface MTBFAnalysis {
  equipmentId: number;
  assetCode: string;
  equipmentName: string;
  totalOperatingHours: number;
  totalFailures: number;
  mtbf: number; // Mean Time Between Failures (hours)
  mttr: number; // Mean Time To Repair (hours)
  availability: number; // Percentage
  lastFailureDate: string | null;
  analysisStartDate: string;
  analysisEndDate: string;
}

/**
 * Calculate Mean Time Between Failures (MTBF)
 * MTBF = Total Operating Time / Number of Failures
 */
export async function calculateMTBF(
  equipmentId: number,
  startDate?: string,
  endDate?: string
): Promise<MTBFAnalysis> {
  const { maintenanceRecords, equipment, fixedAssets } = getAccountingTables();
  const database = (await getDb()) as any;

  // Get equipment info
  const eqResult = await database
    .select({
      equipment: equipment,
      asset: fixedAssets,
    })
    .from(equipment)
    .leftJoin(fixedAssets, eq(equipment.fixedAssetId, fixedAssets.id))
    .where(eq(equipment.id, equipmentId))
    .limit(1);

  if (eqResult.length === 0) {
    throw new Error('Equipment not found');
  }

  const eq_data = eqResult[0].equipment as AccountingEquipment;
  const asset = eqResult[0].asset as FixedAsset | null;

  // Default date range (last 12 months)
  const analysisEndDate = endDate || getTodayStr();
  const defaultStart = new Date(analysisEndDate);
  defaultStart.setFullYear(defaultStart.getFullYear() - 1);
  const analysisStartDate = startDate || defaultStart.toISOString().split('T')[0];

  // Get corrective/emergency maintenance records (failures)
  const conditions = [
    eq(maintenanceRecords.equipmentId, equipmentId),
    or(
      eq(maintenanceRecords.maintenanceType, 'corrective'),
      eq(maintenanceRecords.maintenanceType, 'emergency')
    ),
    gte(maintenanceRecords.maintenanceDate, toQueryDate(analysisStartDate)),
    lte(maintenanceRecords.maintenanceDate, toQueryDate(analysisEndDate)),
  ];

  const failures = await database
    .select()
    .from(maintenanceRecords)
    .where(and(...conditions))
    .orderBy(desc(maintenanceRecords.maintenanceDate));

  const totalFailures = failures.length;
  const totalOperatingHours = Number(eq_data.operatingHours) || 0;

  // Calculate total downtime (MTTR calculation)
  const totalDowntimeHours = failures.reduce(
    (sum: number, f: AcctMaintenanceRecord) => sum + (Number(f.downtimeHours) || 0),
    0
  );

  // Calculate MTBF and MTTR
  const mtbf = totalFailures > 0 ? totalOperatingHours / totalFailures : totalOperatingHours;
  const mttr = totalFailures > 0 ? totalDowntimeHours / totalFailures : 0;

  // Calculate availability: MTBF / (MTBF + MTTR) * 100
  const availability = mtbf > 0 ? (mtbf / (mtbf + mttr)) * 100 : 100;

  // Get last failure date
  const lastFailureDate = failures.length > 0
    ? formatDateFromDb((failures[0] as AcctMaintenanceRecord).maintenanceDate)
    : null;

  return {
    equipmentId,
    assetCode: asset?.assetCode || 'N/A',
    equipmentName: asset?.nameTh || 'Unknown',
    totalOperatingHours,
    totalFailures,
    mtbf: Math.round(mtbf * 100) / 100,
    mttr: Math.round(mttr * 100) / 100,
    availability: Math.round(availability * 100) / 100,
    lastFailureDate,
    analysisStartDate,
    analysisEndDate,
  };
}

// ============================================
// Equipment Cost Summary Functions
// ============================================

export interface EquipmentCostSummary {
  equipmentId: number;
  assetCode: string;
  equipmentName: string;
  totalMaintenanceEvents: number;
  totalPartsCost: number;
  totalLaborCost: number;
  totalExternalCost: number;
  totalMaintenanceCost: number;
  totalDowntimeHours: number;
  preventiveEvents: number;
  correctiveEvents: number;
  emergencyEvents: number;
}

/**
 * Get equipment cost summary
 */
export async function getEquipmentCostSummary(
  equipmentId: number,
  startDate?: string,
  endDate?: string
): Promise<EquipmentCostSummary> {
  const { maintenanceRecords, equipment, fixedAssets } = getAccountingTables();
  const database = (await getDb()) as any;

  // Get equipment info
  const eqResult = await database
    .select({
      equipment: equipment,
      asset: fixedAssets,
    })
    .from(equipment)
    .leftJoin(fixedAssets, eq(equipment.fixedAssetId, fixedAssets.id))
    .where(eq(equipment.id, equipmentId))
    .limit(1);

  if (eqResult.length === 0) {
    throw new Error('Equipment not found');
  }

  const eq_data = eqResult[0].equipment as AccountingEquipment;
  const asset = eqResult[0].asset as FixedAsset | null;

  // Build date conditions
  const conditions = [eq(maintenanceRecords.equipmentId, equipmentId)];

  if (startDate) {
    conditions.push(gte(maintenanceRecords.maintenanceDate, toQueryDate(startDate)));
  }
  if (endDate) {
    conditions.push(lte(maintenanceRecords.maintenanceDate, toQueryDate(endDate)));
  }

  // Get maintenance records
  const records = await database
    .select()
    .from(maintenanceRecords)
    .where(and(...conditions));

  // Calculate totals
  let totalPartsCost = 0;
  let totalLaborCost = 0;
  let totalExternalCost = 0;
  let totalDowntimeHours = 0;
  let preventiveEvents = 0;
  let correctiveEvents = 0;
  let emergencyEvents = 0;

  for (const record of records) {
    const r = record as AcctMaintenanceRecord;
    totalPartsCost += Number(r.partsCost) || 0;
    totalLaborCost += Number(r.laborCost) || 0;
    totalExternalCost += Number(r.externalServiceCost) || 0;
    totalDowntimeHours += Number(r.downtimeHours) || 0;

    switch (r.maintenanceType) {
      case 'preventive':
        preventiveEvents++;
        break;
      case 'corrective':
        correctiveEvents++;
        break;
      case 'emergency':
        emergencyEvents++;
        break;
    }
  }

  return {
    equipmentId,
    assetCode: asset?.assetCode || 'N/A',
    equipmentName: asset?.nameTh || 'Unknown',
    totalMaintenanceEvents: records.length,
    totalPartsCost,
    totalLaborCost,
    totalExternalCost,
    totalMaintenanceCost: totalPartsCost + totalLaborCost + totalExternalCost,
    totalDowntimeHours,
    preventiveEvents,
    correctiveEvents,
    emergencyEvents,
  };
}

/**
 * Get equipment summary statistics
 */
export async function getEquipmentSummary(): Promise<{
  totalEquipment: number;
  availableEquipment: number;
  unavailableEquipment: number;
  overdueMaintenanceCount: number;
  upcomingMaintenanceCount: number;
}> {
  const { equipment, maintenanceSchedules } = getAccountingTables();
  const database = (await getDb()) as any;

  // Count equipment
  const eqResult = await database
    .select({
      total: sql<number>`count(*)`,
      available: sql<number>`sum(case when ${equipment.isAvailable} = true then 1 else 0 end)`,
    })
    .from(equipment);

  const total = Number(eqResult[0]?.total || 0);
  const available = Number(eqResult[0]?.available || 0);

  // Count overdue and upcoming
  const today = getTodayStr();
  const futureDate = new Date(today);
  futureDate.setDate(futureDate.getDate() + 7);
  const weekAhead = futureDate.toISOString().split('T')[0];

  const overdueResult = await database
    .select({ count: sql<number>`count(*)` })
    .from(maintenanceSchedules)
    .where(and(
      eq(maintenanceSchedules.isActive, true),
      lt(maintenanceSchedules.nextDue, toQueryDate(today))
    ));

  const upcomingResult = await database
    .select({ count: sql<number>`count(*)` })
    .from(maintenanceSchedules)
    .where(and(
      eq(maintenanceSchedules.isActive, true),
      gte(maintenanceSchedules.nextDue, toQueryDate(today)),
      lte(maintenanceSchedules.nextDue, toQueryDate(weekAhead))
    ));

  return {
    totalEquipment: total,
    availableEquipment: available,
    unavailableEquipment: total - available,
    overdueMaintenanceCount: Number(overdueResult[0]?.count || 0),
    upcomingMaintenanceCount: Number(upcomingResult[0]?.count || 0),
  };
}
