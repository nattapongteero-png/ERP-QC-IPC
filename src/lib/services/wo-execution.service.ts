/**
 * Work Order Execution Service
 *
 * Handles runtime execution data for work orders including:
 * - Environmental logs
 * - Cleaning logs
 * - SOP step execution
 * - Material weighing
 * - Packaging weight logs
 * - Packaging integrity logs
 * - Finished product inspection
 * - Packaging materials
 */

import { eq, and, desc, asc } from 'drizzle-orm';
import { executeDbOperation, getInsertId } from '../db/db-helper';
import { isSqlite } from '../db';
import {
  // SQLite tables
  sqliteWOEnvironmentalLogs,
  sqliteWOCleaningLogs,
  sqliteWOSOPExecution,
  sqliteWOPackagingWeightLogs,
  sqliteWOPackagingIntegrityLogs,
  sqliteWOFinishedInspection,
  sqliteWOPackagingMaterials,
  sqliteBOMRooms,
  sqliteBOMEquipment,
  sqliteBOMEnvironmentalConditions,
  sqliteBOMSOPSteps,
  sqliteBOMPackagingQC,
  sqliteWorkOrderMaterials,
  sqliteWorkOrders,
  sqliteProductionRooms,
  sqliteProductionEquipment,
  sqliteEnvironmentalConditions,
  sqliteSOPStepTemplates,
  sqlitePackagingQCCriteria,
  sqliteItems,
  sqliteUsers,
  // MySQL tables
  mysqlWOEnvironmentalLogs,
  mysqlWOCleaningLogs,
  mysqlWOSOPExecution,
  mysqlWOPackagingWeightLogs,
  mysqlWOPackagingIntegrityLogs,
  mysqlWOFinishedInspection,
  mysqlWOPackagingMaterials,
  mysqlBOMRooms,
  mysqlBOMEquipment,
  mysqlBOMEnvironmentalConditions,
  mysqlBOMSOPSteps,
  mysqlBOMPackagingQC,
  mysqlWorkOrderMaterials,
  mysqlWorkOrders,
  mysqlProductionRooms,
  mysqlProductionEquipment,
  mysqlEnvironmentalConditions,
  mysqlSOPStepTemplates,
  mysqlPackagingQCCriteria,
  mysqlItems,
  mysqlUsers,
} from '../db/schema';
import { getNow } from '../db/date-utils';
import { issueMaterial, getLotsForPicking } from './inventory.service';

// Get the appropriate tables based on database type
function getTables() {
  if (isSqlite()) {
    return {
      woEnvironmentalLogs: sqliteWOEnvironmentalLogs,
      woCleaningLogs: sqliteWOCleaningLogs,
      woSOPExecution: sqliteWOSOPExecution,
      woPackagingWeightLogs: sqliteWOPackagingWeightLogs,
      woPackagingIntegrityLogs: sqliteWOPackagingIntegrityLogs,
      woFinishedInspection: sqliteWOFinishedInspection,
      woPackagingMaterials: sqliteWOPackagingMaterials,
      bomRooms: sqliteBOMRooms,
      bomEquipment: sqliteBOMEquipment,
      bomEnvironmentalConditions: sqliteBOMEnvironmentalConditions,
      bomSOPSteps: sqliteBOMSOPSteps,
      bomPackagingQC: sqliteBOMPackagingQC,
      workOrderMaterials: sqliteWorkOrderMaterials,
      workOrders: sqliteWorkOrders,
      productionRooms: sqliteProductionRooms,
      productionEquipment: sqliteProductionEquipment,
      environmentalConditions: sqliteEnvironmentalConditions,
      sopStepTemplates: sqliteSOPStepTemplates,
      packagingQCCriteria: sqlitePackagingQCCriteria,
      items: sqliteItems,
      users: sqliteUsers,
    };
  }
  return {
    woEnvironmentalLogs: mysqlWOEnvironmentalLogs,
    woCleaningLogs: mysqlWOCleaningLogs,
    woSOPExecution: mysqlWOSOPExecution,
    woPackagingWeightLogs: mysqlWOPackagingWeightLogs,
    woPackagingIntegrityLogs: mysqlWOPackagingIntegrityLogs,
    woFinishedInspection: mysqlWOFinishedInspection,
    woPackagingMaterials: mysqlWOPackagingMaterials,
    bomRooms: mysqlBOMRooms,
    bomEquipment: mysqlBOMEquipment,
    bomEnvironmentalConditions: mysqlBOMEnvironmentalConditions,
    bomSOPSteps: mysqlBOMSOPSteps,
    bomPackagingQC: mysqlBOMPackagingQC,
    workOrderMaterials: mysqlWorkOrderMaterials,
    workOrders: mysqlWorkOrders,
    productionRooms: mysqlProductionRooms,
    productionEquipment: mysqlProductionEquipment,
    environmentalConditions: mysqlEnvironmentalConditions,
    sopStepTemplates: mysqlSOPStepTemplates,
    packagingQCCriteria: mysqlPackagingQCCriteria,
    items: mysqlItems,
    users: mysqlUsers,
  };
}

// ===========================
// Environmental Logs
// ===========================

export interface CreateWOEnvironmentalLogInput {
  workOrderId: number;
  bomConditionId?: number;
  phase: string;
  recordedDate: string;
  recordedTime: string;
  temperature: number;
  humidity: number;
  isNormal: boolean;
  operatorId: number;
  notes?: string;
}

export async function getWOEnvironmentalLogs(workOrderId: number, phase?: string) {
  const tables = getTables();

  return executeDbOperation(async (db: any) => {
    const query = db
      .select({
        id: tables.woEnvironmentalLogs.id,
        workOrderId: tables.woEnvironmentalLogs.workOrderId,
        bomConditionId: tables.woEnvironmentalLogs.bomConditionId,
        phase: tables.woEnvironmentalLogs.phase,
        recordedDate: tables.woEnvironmentalLogs.recordedDate,
        recordedTime: tables.woEnvironmentalLogs.recordedTime,
        temperature: tables.woEnvironmentalLogs.temperature,
        humidity: tables.woEnvironmentalLogs.humidity,
        isNormal: tables.woEnvironmentalLogs.isNormal,
        operatorId: tables.woEnvironmentalLogs.operatorId,
        notes: tables.woEnvironmentalLogs.notes,
        createdAt: tables.woEnvironmentalLogs.createdAt,
      })
      .from(tables.woEnvironmentalLogs)
      .where(eq(tables.woEnvironmentalLogs.workOrderId, workOrderId))
      .orderBy(
        desc(tables.woEnvironmentalLogs.recordedDate),
        desc(tables.woEnvironmentalLogs.recordedTime)
      );

    const logs = await query;

    if (phase) {
      return logs.filter((log: any) => log.phase === phase);
    }
    return logs;
  });
}

export async function createWOEnvironmentalLog(data: CreateWOEnvironmentalLogInput) {
  const tables = getTables();

  return executeDbOperation(async (db: any) => {
    const values = {
      workOrderId: data.workOrderId,
      bomConditionId: data.bomConditionId,
      phase: data.phase,
      recordedDate: data.recordedDate,
      recordedTime: data.recordedTime,
      temperature: data.temperature,
      humidity: data.humidity,
      isNormal: data.isNormal,
      operatorId: data.operatorId,
      notes: data.notes,
      createdAt: getNow(),
    };

    if (isSqlite()) {
      const [log] = await db.insert(tables.woEnvironmentalLogs).values(values).returning();
      return log;
    } else {
      const result = await db.insert(tables.woEnvironmentalLogs).values(values);
      const insertId = getInsertId(result);
      const [log] = await db.select().from(tables.woEnvironmentalLogs).where(eq(tables.woEnvironmentalLogs.id, insertId));
      return log;
    }
  });
}

export async function validateEnvironmentalReading(
  bomId: number,
  phase: string,
  temperature: number,
  humidity: number
) {
  const tables = getTables();

  return executeDbOperation(async (db: any) => {
    // Get the condition profile linked to this BOM for this phase
    const conditions = await db
      .select({
        bomConditionId: tables.bomEnvironmentalConditions.id,
        conditionId: tables.bomEnvironmentalConditions.conditionId,
        temperatureMin: tables.environmentalConditions.temperatureMin,
        temperatureMax: tables.environmentalConditions.temperatureMax,
        humidityMax: tables.environmentalConditions.humidityMax,
      })
      .from(tables.bomEnvironmentalConditions)
      .innerJoin(
        tables.environmentalConditions,
        eq(tables.bomEnvironmentalConditions.conditionId, tables.environmentalConditions.id)
      )
      .where(
        and(
          eq(tables.bomEnvironmentalConditions.bomId, bomId),
          eq(tables.bomEnvironmentalConditions.phase, phase)
        )
      );

    if (conditions.length === 0) {
      return { isNormal: true, limits: null, bomConditionId: null };
    }

    const condition = conditions[0];
    const isNormal =
      temperature >= condition.temperatureMin &&
      temperature <= condition.temperatureMax &&
      humidity <= condition.humidityMax;

    return {
      isNormal,
      limits: {
        temperatureMin: condition.temperatureMin,
        temperatureMax: condition.temperatureMax,
        humidityMax: condition.humidityMax,
      },
      bomConditionId: condition.bomConditionId,
    };
  });
}

// ===========================
// Cleaning Logs
// ===========================

export interface CreateWOCleaningLogInput {
  workOrderId: number;
  phase: string;
  itemType: string;
  roomId?: number;
  equipmentId?: number;
  isClean: boolean;
  operatorId: number;
  performedAt: string;
  notes?: string;
}

export async function getWOCleaningLogs(workOrderId: number, phase?: string) {
  const tables = getTables();

  return executeDbOperation(async (db: any) => {
    const logs = await db
      .select({
        id: tables.woCleaningLogs.id,
        workOrderId: tables.woCleaningLogs.workOrderId,
        phase: tables.woCleaningLogs.phase,
        itemType: tables.woCleaningLogs.itemType,
        roomId: tables.woCleaningLogs.roomId,
        equipmentId: tables.woCleaningLogs.equipmentId,
        isClean: tables.woCleaningLogs.isClean,
        operatorId: tables.woCleaningLogs.operatorId,
        performedAt: tables.woCleaningLogs.performedAt,
        verifierId: tables.woCleaningLogs.verifierId,
        verifiedAt: tables.woCleaningLogs.verifiedAt,
        notes: tables.woCleaningLogs.notes,
        createdAt: tables.woCleaningLogs.createdAt,
      })
      .from(tables.woCleaningLogs)
      .where(eq(tables.woCleaningLogs.workOrderId, workOrderId))
      .orderBy(desc(tables.woCleaningLogs.performedAt));

    if (phase) {
      return logs.filter((log: any) => log.phase === phase);
    }
    return logs;
  });
}

export async function createWOCleaningLog(data: CreateWOCleaningLogInput) {
  const tables = getTables();

  return executeDbOperation(async (db: any) => {
    const values = {
      workOrderId: data.workOrderId,
      phase: data.phase,
      itemType: data.itemType,
      roomId: data.roomId,
      equipmentId: data.equipmentId,
      isClean: data.isClean,
      operatorId: data.operatorId,
      performedAt: isSqlite() ? data.performedAt : new Date(data.performedAt),
      createdAt: getNow(),
    };

    if (isSqlite()) {
      const [log] = await db.insert(tables.woCleaningLogs).values(values).returning();
      return log;
    } else {
      const result = await db.insert(tables.woCleaningLogs).values(values);
      const insertId = getInsertId(result);
      const [log] = await db.select().from(tables.woCleaningLogs).where(eq(tables.woCleaningLogs.id, insertId));
      return log;
    }
  });
}

export async function verifyWOCleaningLog(logId: number, verifierId: number) {
  const tables = getTables();

  return executeDbOperation(async (db: any) => {
    const updateData = {
      verifierId,
      verifiedAt: getNow(),
    };

    if (isSqlite()) {
      const [log] = await db.update(tables.woCleaningLogs).set(updateData).where(eq(tables.woCleaningLogs.id, logId)).returning();
      return log;
    } else {
      await db.update(tables.woCleaningLogs).set(updateData).where(eq(tables.woCleaningLogs.id, logId));
      const [log] = await db.select().from(tables.woCleaningLogs).where(eq(tables.woCleaningLogs.id, logId));
      return log;
    }
  });
}

export async function getWOCleaningStatus(workOrderId: number, phase: string) {
  const logs = await getWOCleaningLogs(workOrderId, phase);

  const totalItems = logs.length;
  const cleanedItems = logs.filter((log: any) => log.isClean).length;
  const verifiedItems = logs.filter((log: any) => log.verifierId).length;
  const isComplete = totalItems > 0 && cleanedItems === totalItems && verifiedItems === totalItems;

  return {
    totalItems,
    cleanedItems,
    verifiedItems,
    isComplete,
  };
}

/**
 * Get cleaning requirements by merging BOM room/equipment config with existing cleaning logs.
 * Returns a checklist of items that need cleaning for a given phase.
 */
export async function getCleaningRequirements(workOrderId: number, phase: string) {
  const tables = getTables();

  return executeDbOperation(async (db: any) => {
    // 1. Get the work order's BOM ID
    const woResult = await db
      .select({ bomId: tables.workOrders.bomId })
      .from(tables.workOrders)
      .where(eq(tables.workOrders.id, workOrderId))
      .limit(1);

    if (woResult.length === 0) return [];
    const bomId = woResult[0].bomId;
    if (!bomId) return [];

    // 2. Get BOM rooms for this phase
    const bomRooms = await db
      .select({
        bomRoomId: tables.bomRooms.id,
        roomId: tables.bomRooms.roomId,
        phase: tables.bomRooms.phase,
        sequence: tables.bomRooms.sequence,
        isRequired: tables.bomRooms.isRequired,
        roomCode: tables.productionRooms.code,
        roomName: tables.productionRooms.name,
        roomNameTh: tables.productionRooms.nameTh,
      })
      .from(tables.bomRooms)
      .leftJoin(tables.productionRooms, eq(tables.bomRooms.roomId, tables.productionRooms.id))
      .where(and(eq(tables.bomRooms.bomId, bomId), eq(tables.bomRooms.phase, phase)))
      .orderBy(asc(tables.bomRooms.sequence));

    // 3. Get BOM equipment for this phase
    const bomEquip = await db
      .select({
        bomEquipId: tables.bomEquipment.id,
        equipmentId: tables.bomEquipment.equipmentId,
        phase: tables.bomEquipment.phase,
        sequence: tables.bomEquipment.sequence,
        isRequired: tables.bomEquipment.isRequired,
        equipmentCode: tables.productionEquipment.code,
        equipmentName: tables.productionEquipment.name,
        equipmentNameTh: tables.productionEquipment.nameTh,
      })
      .from(tables.bomEquipment)
      .leftJoin(tables.productionEquipment, eq(tables.bomEquipment.equipmentId, tables.productionEquipment.id))
      .where(and(eq(tables.bomEquipment.bomId, bomId), eq(tables.bomEquipment.phase, phase)))
      .orderBy(asc(tables.bomEquipment.sequence));

    // 4. Get existing cleaning logs for this WO + phase (with operator/verifier names)
    const logs = await db
      .select({
        id: tables.woCleaningLogs.id,
        workOrderId: tables.woCleaningLogs.workOrderId,
        phase: tables.woCleaningLogs.phase,
        itemType: tables.woCleaningLogs.itemType,
        roomId: tables.woCleaningLogs.roomId,
        equipmentId: tables.woCleaningLogs.equipmentId,
        isClean: tables.woCleaningLogs.isClean,
        operatorId: tables.woCleaningLogs.operatorId,
        performedAt: tables.woCleaningLogs.performedAt,
        verifierId: tables.woCleaningLogs.verifierId,
        verifiedAt: tables.woCleaningLogs.verifiedAt,
        notes: tables.woCleaningLogs.notes,
      })
      .from(tables.woCleaningLogs)
      .where(and(
        eq(tables.woCleaningLogs.workOrderId, workOrderId),
        eq(tables.woCleaningLogs.phase, phase),
      ))
      .orderBy(desc(tables.woCleaningLogs.performedAt));

    // 5. Resolve operator/verifier names
    const userIds = new Set<number>();
    for (const log of logs) {
      if (log.operatorId) userIds.add(log.operatorId);
      if (log.verifierId) userIds.add(log.verifierId);
    }
    const userMap = new Map<number, string>();
    if (userIds.size > 0) {
      const users = await db
        .select({ id: tables.users.id, name: tables.users.name })
        .from(tables.users);
      for (const u of users) {
        if (userIds.has(u.id)) userMap.set(u.id, u.name);
      }
    }

    // 6. Build room-based log lookup (roomId -> latest log)
    const roomLogMap = new Map<number, any>();
    for (const log of logs) {
      if (log.itemType === 'room' && log.roomId && !roomLogMap.has(log.roomId)) {
        roomLogMap.set(log.roomId, log);
      }
    }

    // 7. Build equipment-based log lookup (equipmentId -> latest log)
    const equipLogMap = new Map<number, any>();
    for (const log of logs) {
      if (log.itemType === 'equipment' && log.equipmentId && !equipLogMap.has(log.equipmentId)) {
        equipLogMap.set(log.equipmentId, log);
      }
    }

    // 8. Merge BOM rooms with logs → CleaningRequirement[]
    const requirements: any[] = [];

    for (const room of bomRooms) {
      const log = roomLogMap.get(room.roomId);
      requirements.push({
        type: 'room',
        id: room.roomId,
        code: room.roomCode || '',
        name: room.roomName || '',
        nameTh: room.roomNameTh || '',
        isRequired: Boolean(room.isRequired),
        cleaningLog: log
          ? {
              id: log.id,
              workOrderId: log.workOrderId,
              phase: log.phase,
              itemType: log.itemType,
              roomId: log.roomId,
              isClean: Boolean(log.isClean),
              operatorId: log.operatorId,
              operatorName: userMap.get(log.operatorId) || undefined,
              performedAt: log.performedAt,
              verifierId: log.verifierId || undefined,
              verifierName: log.verifierId ? userMap.get(log.verifierId) || undefined : undefined,
              verifiedAt: log.verifiedAt || undefined,
              notes: log.notes || undefined,
            }
          : undefined,
      });
    }

    for (const equip of bomEquip) {
      const log = equipLogMap.get(equip.equipmentId);
      requirements.push({
        type: 'equipment',
        id: equip.equipmentId,
        code: equip.equipmentCode || '',
        name: equip.equipmentName || '',
        nameTh: equip.equipmentNameTh || '',
        isRequired: Boolean(equip.isRequired),
        cleaningLog: log
          ? {
              id: log.id,
              workOrderId: log.workOrderId,
              phase: log.phase,
              itemType: log.itemType,
              equipmentId: log.equipmentId,
              isClean: Boolean(log.isClean),
              operatorId: log.operatorId,
              operatorName: userMap.get(log.operatorId) || undefined,
              performedAt: log.performedAt,
              verifierId: log.verifierId || undefined,
              verifierName: log.verifierId ? userMap.get(log.verifierId) || undefined : undefined,
              verifiedAt: log.verifiedAt || undefined,
              notes: log.notes || undefined,
            }
          : undefined,
      });
    }

    return requirements;
  });
}

// ===========================
// SOP Execution
// ===========================

export interface CreateWOSOPExecutionInput {
  workOrderId: number;
  bomStepId: number;
  sequence: number;
}

export async function getWOSOPExecution(workOrderId: number) {
  const tables = getTables();

  return executeDbOperation(async (db: any) => {
    const executions = await db
      .select({
        id: tables.woSOPExecution.id,
        workOrderId: tables.woSOPExecution.workOrderId,
        bomStepId: tables.woSOPExecution.bomStepId,
        sequence: tables.woSOPExecution.sequence,
        isCompleted: tables.woSOPExecution.isCompleted,
        actualParameters: tables.woSOPExecution.actualParameters,
        operatorId: tables.woSOPExecution.operatorId,
        startedAt: tables.woSOPExecution.startedAt,
        completedAt: tables.woSOPExecution.completedAt,
        verifierId: tables.woSOPExecution.verifierId,
        verifiedAt: tables.woSOPExecution.verifiedAt,
        status: tables.woSOPExecution.status,
        notes: tables.woSOPExecution.notes,
        createdAt: tables.woSOPExecution.createdAt,
        // BOM step details
        stepName: tables.bomSOPSteps.stepName,
        stepNameTh: tables.bomSOPSteps.stepNameTh,
        instructions: tables.bomSOPSteps.instructions,
        instructionsTh: tables.bomSOPSteps.instructionsTh,
        expectedParameters: tables.bomSOPSteps.parameters,
        equipmentIds: tables.bomSOPSteps.equipmentIds,
        requiresVerification: tables.bomSOPSteps.requiresVerification,
      })
      .from(tables.woSOPExecution)
      .innerJoin(tables.bomSOPSteps, eq(tables.woSOPExecution.bomStepId, tables.bomSOPSteps.id))
      .where(eq(tables.woSOPExecution.workOrderId, workOrderId))
      .orderBy(asc(tables.woSOPExecution.sequence));

    return executions;
  });
}

export async function initializeWOSOPExecution(workOrderId: number, bomId: number) {
  const tables = getTables();

  return executeDbOperation(async (db: any) => {
    // Get BOM SOP steps
    const bomSteps = await db
      .select()
      .from(tables.bomSOPSteps)
      .where(eq(tables.bomSOPSteps.bomId, bomId))
      .orderBy(asc(tables.bomSOPSteps.sequence));

    // Create WO SOP execution records
    const executions = [];
    for (const step of bomSteps) {
      const values = {
        workOrderId,
        bomStepId: step.id,
        sequence: step.sequence,
        isCompleted: false,
        status: 'pending',
        createdAt: getNow(),
        updatedAt: getNow(),
      };

      if (isSqlite()) {
        const [execution] = await db.insert(tables.woSOPExecution).values(values).returning();
        executions.push(execution);
      } else {
        const result = await db.insert(tables.woSOPExecution).values(values);
        const insertId = getInsertId(result);
        const [execution] = await db.select().from(tables.woSOPExecution).where(eq(tables.woSOPExecution.id, insertId));
        executions.push(execution);
      }
    }

    return executions;
  });
}

export async function startWOSOPStep(executionId: number, operatorId: number) {
  const tables = getTables();

  return executeDbOperation(async (db: any) => {
    const updateData = {
      operatorId,
      startedAt: getNow(),
      status: 'in_progress',
      updatedAt: getNow(),
    };

    if (isSqlite()) {
      const [execution] = await db.update(tables.woSOPExecution).set(updateData).where(eq(tables.woSOPExecution.id, executionId)).returning();
      return execution;
    } else {
      await db.update(tables.woSOPExecution).set(updateData).where(eq(tables.woSOPExecution.id, executionId));
      const [execution] = await db.select().from(tables.woSOPExecution).where(eq(tables.woSOPExecution.id, executionId));
      return execution;
    }
  });
}

export async function completeWOSOPStep(
  executionId: number,
  actualParameters?: string,
  notes?: string
) {
  const tables = getTables();

  return executeDbOperation(async (db: any) => {
    const updateData = {
      isCompleted: true,
      actualParameters,
      completedAt: getNow(),
      status: 'completed',
      notes,
      updatedAt: getNow(),
    };

    if (isSqlite()) {
      const [execution] = await db.update(tables.woSOPExecution).set(updateData).where(eq(tables.woSOPExecution.id, executionId)).returning();
      return execution;
    } else {
      await db.update(tables.woSOPExecution).set(updateData).where(eq(tables.woSOPExecution.id, executionId));
      const [execution] = await db.select().from(tables.woSOPExecution).where(eq(tables.woSOPExecution.id, executionId));
      return execution;
    }
  });
}

export async function verifyWOSOPStep(executionId: number, verifierId: number) {
  const tables = getTables();

  return executeDbOperation(async (db: any) => {
    const updateData = {
      verifierId,
      verifiedAt: getNow(),
      status: 'verified',
      updatedAt: getNow(),
    };

    if (isSqlite()) {
      const [execution] = await db.update(tables.woSOPExecution).set(updateData).where(eq(tables.woSOPExecution.id, executionId)).returning();
      return execution;
    } else {
      await db.update(tables.woSOPExecution).set(updateData).where(eq(tables.woSOPExecution.id, executionId));
      const [execution] = await db.select().from(tables.woSOPExecution).where(eq(tables.woSOPExecution.id, executionId));
      return execution;
    }
  });
}

// ===========================
// Material Weighing
// ===========================

export interface RecordMaterialWeightInput {
  materialId: number;
  weighedQty: number;
  weighedBy: number;
  waterDate?: string;
  waterConductivity?: number;
  waterTemperature?: number;
}

export async function getWOMaterials(workOrderId: number) {
  const tables = getTables();

  return executeDbOperation(async (db: any) => {
    const materials = await db
      .select({
        id: tables.workOrderMaterials.id,
        workOrderId: tables.workOrderMaterials.workOrderId,
        itemId: tables.workOrderMaterials.itemId,
        bomLineId: tables.workOrderMaterials.bomLineId,
        plannedQuantity: tables.workOrderMaterials.plannedQuantity,
        actualQuantity: tables.workOrderMaterials.actualQuantity,
        weighedQty: tables.workOrderMaterials.weighedQty,
        weighedBy: tables.workOrderMaterials.weighedBy,
        weighedAt: tables.workOrderMaterials.weighedAt,
        verifiedBy: tables.workOrderMaterials.verifiedBy,
        verifiedAt: tables.workOrderMaterials.verifiedAt,
        waterDate: tables.workOrderMaterials.waterDate,
        waterConductivity: tables.workOrderMaterials.waterConductivity,
        waterTemperature: tables.workOrderMaterials.waterTemperature,
        status: tables.workOrderMaterials.status,
        unit: tables.workOrderMaterials.unit,
        // Item details
        itemNameTh: tables.items.nameTh,
        itemNameEn: tables.items.nameEn,
        itemCode: tables.items.code,
      })
      .from(tables.workOrderMaterials)
      .innerJoin(tables.items, eq(tables.workOrderMaterials.itemId, tables.items.id))
      .where(eq(tables.workOrderMaterials.workOrderId, workOrderId));

    return materials;
  });
}

export async function recordMaterialWeight(data: RecordMaterialWeightInput) {
  const tables = getTables();

  // Step 1: Record the weighing data
  const material = await executeDbOperation(async (db: any) => {
    const updateData = {
      weighedQty: data.weighedQty,
      weighedBy: data.weighedBy,
      weighedAt: getNow(),
      waterDate: data.waterDate,
      waterConductivity: data.waterConductivity,
      waterTemperature: data.waterTemperature,
    };

    if (isSqlite()) {
      const [mat] = await db.update(tables.workOrderMaterials).set(updateData).where(eq(tables.workOrderMaterials.id, data.materialId)).returning();
      return mat;
    } else {
      await db.update(tables.workOrderMaterials).set(updateData).where(eq(tables.workOrderMaterials.id, data.materialId));
      const [mat] = await db.select().from(tables.workOrderMaterials).where(eq(tables.workOrderMaterials.id, data.materialId));
      return mat;
    }
  });

  // Step 2: Deduct inventory if not already issued
  if (material.status !== 'issued') {
    let lotId = material.lotId;

    // If no lot assigned, auto-find one using FEFO algorithm
    if (!lotId) {
      const { allocated } = await getLotsForPicking(material.itemId, data.weighedQty);
      if (allocated.length > 0) {
        lotId = allocated[0].lotId;
        // Assign the lot to the material record
        await executeDbOperation(async (db: any) => {
          await db.update(tables.workOrderMaterials)
            .set({ lotId })
            .where(eq(tables.workOrderMaterials.id, data.materialId));
        });
      }
    }

    if (lotId) {
      try {
        // Get work order number for reference
        const [workOrder] = await executeDbOperation(async (db: any) => {
          return db.select({ woNumber: tables.workOrders.woNumber, batchNumber: tables.workOrders.batchNumber })
            .from(tables.workOrders)
            .where(eq(tables.workOrders.id, material.workOrderId));
        });

        const woNumber = workOrder?.woNumber || `WO-${material.workOrderId}`;
        const batchNumber = workOrder?.batchNumber || '';

        // Issue material from inventory (deducts lot quantity + creates transaction)
        await issueMaterial(
          lotId,
          data.weighedQty,
          'WO',
          material.workOrderId,
          woNumber,
          data.weighedBy,
          `Material weighing for ${woNumber}`,
          {
            workOrderId: material.workOrderId,
            batchNumber,
          }
        );

        // Update material status to "issued"
        await executeDbOperation(async (db: any) => {
          await db.update(tables.workOrderMaterials).set({
            status: 'issued',
            actualQuantity: data.weighedQty,
            issuedBy: data.weighedBy,
            issuedAt: getNow(),
          }).where(eq(tables.workOrderMaterials.id, data.materialId));
        });

        // Return updated material
        return executeDbOperation(async (db: any) => {
          const [updated] = await db.select().from(tables.workOrderMaterials).where(eq(tables.workOrderMaterials.id, data.materialId));
          return updated;
        });
      } catch (error: any) {
        console.error('Error issuing material from inventory:', error);
        throw new Error(`Material weight recorded but inventory deduction failed: ${error.message}`);
      }
    }
    // If no lot found (e.g. water, non-lot-controlled items), just return the weighing data
  }

  return material;
}

export async function verifyMaterialWeight(materialId: number, verifierId: number) {
  const tables = getTables();

  return executeDbOperation(async (db: any) => {
    const updateData = {
      verifiedBy: verifierId,
      verifiedAt: getNow(),
    };

    if (isSqlite()) {
      const [material] = await db.update(tables.workOrderMaterials).set(updateData).where(eq(tables.workOrderMaterials.id, materialId)).returning();
      return material;
    } else {
      await db.update(tables.workOrderMaterials).set(updateData).where(eq(tables.workOrderMaterials.id, materialId));
      const [material] = await db.select().from(tables.workOrderMaterials).where(eq(tables.workOrderMaterials.id, materialId));
      return material;
    }
  });
}

// ===========================
// Packaging Weight Logs
// ===========================

export interface CreateWOPackagingWeightLogInput {
  workOrderId: number;
  bomQCId?: number;
  checkTime: string;
  sampleWeights: string; // JSON array of weights
  operatorId: number;
  notes?: string;
}

export async function getWOPackagingWeightLogs(workOrderId: number) {
  const tables = getTables();

  return executeDbOperation(async (db: any) => {
    const logs = await db
      .select({
        id: tables.woPackagingWeightLogs.id,
        workOrderId: tables.woPackagingWeightLogs.workOrderId,
        bomQCId: tables.woPackagingWeightLogs.bomQCId,
        checkTime: tables.woPackagingWeightLogs.checkTime,
        sampleWeights: tables.woPackagingWeightLogs.sampleWeights,
        failedCount: tables.woPackagingWeightLogs.failedCount,
        isPass: tables.woPackagingWeightLogs.isPass,
        operatorId: tables.woPackagingWeightLogs.operatorId,
        notes: tables.woPackagingWeightLogs.notes,
        createdAt: tables.woPackagingWeightLogs.createdAt,
      })
      .from(tables.woPackagingWeightLogs)
      .where(eq(tables.woPackagingWeightLogs.workOrderId, workOrderId))
      .orderBy(desc(tables.woPackagingWeightLogs.checkTime));

    return logs;
  });
}

export async function createWOPackagingWeightLog(
  data: CreateWOPackagingWeightLogInput,
  bomId: number
) {
  const tables = getTables();

  return executeDbOperation(async (db: any) => {
    // Get QC criteria from BOM
    let weightMin = 0;
    let weightMax = 999999;
    let maxFailures = 2;
    let bomQCId = data.bomQCId;

    const qcProfiles = await db
      .select({
        bomQCId: tables.bomPackagingQC.id,
        weightMin: tables.packagingQCCriteria.weightMin,
        weightMax: tables.packagingQCCriteria.weightMax,
        maxFailures: tables.packagingQCCriteria.maxFailures,
      })
      .from(tables.bomPackagingQC)
      .innerJoin(
        tables.packagingQCCriteria,
        eq(tables.bomPackagingQC.criteriaId, tables.packagingQCCriteria.id)
      )
      .where(eq(tables.bomPackagingQC.bomId, bomId));

    if (qcProfiles.length > 0) {
      const qc = qcProfiles[0];
      weightMin = qc.weightMin;
      weightMax = qc.weightMax;
      maxFailures = qc.maxFailures;
      bomQCId = qc.bomQCId;
    }

    // Parse weights and calculate failures
    const weights: number[] = JSON.parse(data.sampleWeights);
    const failedCount = weights.filter((w) => w < weightMin || w > weightMax).length;
    const isPass = failedCount <= maxFailures;

    const values = {
      workOrderId: data.workOrderId,
      bomQCId,
      checkTime: data.checkTime,
      sampleWeights: data.sampleWeights,
      failedCount,
      isPass,
      operatorId: data.operatorId,
      notes: data.notes,
      createdAt: getNow(),
    };

    let log;
    if (isSqlite()) {
      [log] = await db.insert(tables.woPackagingWeightLogs).values(values).returning();
    } else {
      const result = await db.insert(tables.woPackagingWeightLogs).values(values);
      const insertId = getInsertId(result);
      [log] = await db.select().from(tables.woPackagingWeightLogs).where(eq(tables.woPackagingWeightLogs.id, insertId));
    }

    return { ...log, weightMin, weightMax, maxFailures };
  });
}

// ===========================
// Packaging Integrity Logs
// ===========================

export interface CreateWOPackagingIntegrityLogInput {
  workOrderId: number;
  checkTime: string;
  tubeCapComplete: boolean;
  lotNumberCorrect: boolean;
  packingCorrect: boolean;
  operatorId: number;
  inspectorId: number;
  notes?: string;
}

export async function getWOPackagingIntegrityLogs(workOrderId: number) {
  const tables = getTables();

  return executeDbOperation(async (db: any) => {
    const logs = await db
      .select({
        id: tables.woPackagingIntegrityLogs.id,
        workOrderId: tables.woPackagingIntegrityLogs.workOrderId,
        checkTime: tables.woPackagingIntegrityLogs.checkTime,
        tubeCapComplete: tables.woPackagingIntegrityLogs.tubeCapComplete,
        lotNumberCorrect: tables.woPackagingIntegrityLogs.lotNumberCorrect,
        packingCorrect: tables.woPackagingIntegrityLogs.packingCorrect,
        operatorId: tables.woPackagingIntegrityLogs.operatorId,
        inspectorId: tables.woPackagingIntegrityLogs.inspectorId,
        notes: tables.woPackagingIntegrityLogs.notes,
        createdAt: tables.woPackagingIntegrityLogs.createdAt,
      })
      .from(tables.woPackagingIntegrityLogs)
      .where(eq(tables.woPackagingIntegrityLogs.workOrderId, workOrderId))
      .orderBy(desc(tables.woPackagingIntegrityLogs.checkTime));

    return logs;
  });
}

export async function createWOPackagingIntegrityLog(data: CreateWOPackagingIntegrityLogInput) {
  const tables = getTables();

  return executeDbOperation(async (db: any) => {
    const values = {
      workOrderId: data.workOrderId,
      checkTime: data.checkTime,
      tubeCapComplete: data.tubeCapComplete,
      lotNumberCorrect: data.lotNumberCorrect,
      packingCorrect: data.packingCorrect,
      operatorId: data.operatorId,
      inspectorId: data.inspectorId,
      notes: data.notes,
      createdAt: getNow(),
    };

    if (isSqlite()) {
      const [log] = await db.insert(tables.woPackagingIntegrityLogs).values(values).returning();
      return log;
    } else {
      const result = await db.insert(tables.woPackagingIntegrityLogs).values(values);
      const insertId = getInsertId(result);
      const [log] = await db.select().from(tables.woPackagingIntegrityLogs).where(eq(tables.woPackagingIntegrityLogs.id, insertId));
      return log;
    }
  });
}

// ===========================
// Finished Product Inspection
// ===========================

export interface CreateWOFinishedInspectionInput {
  workOrderId: number;
  sampleDate: string;
  samplerId: number;
  sampleQtyForTest?: number;
  sampleQtyForRetention?: number;
  checklistResults: string; // JSON object with 15 items
}

export async function getWOFinishedInspection(workOrderId: number) {
  const tables = getTables();

  return executeDbOperation(async (db: any) => {
    const inspections = await db
      .select()
      .from(tables.woFinishedInspection)
      .where(eq(tables.woFinishedInspection.workOrderId, workOrderId));

    return inspections[0] || null;
  });
}

export async function createWOFinishedInspection(data: CreateWOFinishedInspectionInput) {
  const tables = getTables();

  return executeDbOperation(async (db: any) => {
    const values = {
      workOrderId: data.workOrderId,
      sampleDate: data.sampleDate,
      samplerId: data.samplerId,
      sampleQtyForTest: data.sampleQtyForTest ?? 50,
      sampleQtyForRetention: data.sampleQtyForRetention ?? 3,
      checklistResults: data.checklistResults,
      status: 'pending',
      createdAt: getNow(),
      updatedAt: getNow(),
    };

    if (isSqlite()) {
      const [inspection] = await db.insert(tables.woFinishedInspection).values(values).returning();
      return inspection;
    } else {
      const result = await db.insert(tables.woFinishedInspection).values(values);
      const insertId = getInsertId(result);
      const [inspection] = await db.select().from(tables.woFinishedInspection).where(eq(tables.woFinishedInspection.id, insertId));
      return inspection;
    }
  });
}

export async function updateWOFinishedInspection(
  inspectionId: number,
  checklistResults: string,
  inspectorId: number,
  status: string
) {
  const tables = getTables();

  return executeDbOperation(async (db: any) => {
    const updateData = {
      checklistResults,
      inspectorId,
      inspectedAt: getNow(),
      status,
      updatedAt: getNow(),
    };

    if (isSqlite()) {
      const [inspection] = await db.update(tables.woFinishedInspection).set(updateData).where(eq(tables.woFinishedInspection.id, inspectionId)).returning();
      return inspection;
    } else {
      await db.update(tables.woFinishedInspection).set(updateData).where(eq(tables.woFinishedInspection.id, inspectionId));
      const [inspection] = await db.select().from(tables.woFinishedInspection).where(eq(tables.woFinishedInspection.id, inspectionId));
      return inspection;
    }
  });
}

export async function reInspectWOFinishedInspection(inspectionId: number, reInspectorId: number) {
  const tables = getTables();

  return executeDbOperation(async (db: any) => {
    const updateData = {
      reInspectorId,
      reInspectedAt: getNow(),
      status: 're_inspected',
      updatedAt: getNow(),
    };

    if (isSqlite()) {
      const [inspection] = await db.update(tables.woFinishedInspection).set(updateData).where(eq(tables.woFinishedInspection.id, inspectionId)).returning();
      return inspection;
    } else {
      await db.update(tables.woFinishedInspection).set(updateData).where(eq(tables.woFinishedInspection.id, inspectionId));
      const [inspection] = await db.select().from(tables.woFinishedInspection).where(eq(tables.woFinishedInspection.id, inspectionId));
      return inspection;
    }
  });
}

// ===========================
// Packaging Materials
// ===========================

export interface CreateWOPackagingMaterialInput {
  workOrderId: number;
  itemId?: number;
  materialName: string;
  qtyRequisitioned: number;
  unit: string;
  operatorId?: number;
}

export async function getWOPackagingMaterials(workOrderId: number) {
  const tables = getTables();

  return executeDbOperation(async (db: any) => {
    const materials = await db
      .select()
      .from(tables.woPackagingMaterials)
      .where(eq(tables.woPackagingMaterials.workOrderId, workOrderId));

    return materials;
  });
}

export async function createWOPackagingMaterial(data: CreateWOPackagingMaterialInput) {
  const tables = getTables();

  return executeDbOperation(async (db: any) => {
    const values = {
      workOrderId: data.workOrderId,
      itemId: data.itemId,
      materialName: data.materialName,
      qtyRequisitioned: data.qtyRequisitioned,
      unit: data.unit,
      operatorId: data.operatorId,
      createdAt: getNow(),
      updatedAt: getNow(),
    };

    if (isSqlite()) {
      const [material] = await db.insert(tables.woPackagingMaterials).values(values).returning();
      return material;
    } else {
      const result = await db.insert(tables.woPackagingMaterials).values(values);
      const insertId = getInsertId(result);
      const [material] = await db.select().from(tables.woPackagingMaterials).where(eq(tables.woPackagingMaterials.id, insertId));
      return material;
    }
  });
}

export async function updateWOPackagingMaterial(
  materialId: number,
  qtyUsed?: number,
  qtyReturned?: number
) {
  const tables = getTables();

  return executeDbOperation(async (db: any) => {
    const updateData: Record<string, unknown> = { updatedAt: getNow() };
    if (qtyUsed !== undefined) updateData.qtyUsed = qtyUsed;
    if (qtyReturned !== undefined) updateData.qtyReturned = qtyReturned;

    if (isSqlite()) {
      const [material] = await db.update(tables.woPackagingMaterials).set(updateData).where(eq(tables.woPackagingMaterials.id, materialId)).returning();
      return material;
    } else {
      await db.update(tables.woPackagingMaterials).set(updateData).where(eq(tables.woPackagingMaterials.id, materialId));
      const [material] = await db.select().from(tables.woPackagingMaterials).where(eq(tables.woPackagingMaterials.id, materialId));
      return material;
    }
  });
}

export async function verifyWOPackagingMaterial(materialId: number, verifierId: number) {
  const tables = getTables();

  return executeDbOperation(async (db: any) => {
    const updateData = {
      verifierId,
      updatedAt: getNow(),
    };

    if (isSqlite()) {
      const [material] = await db.update(tables.woPackagingMaterials).set(updateData).where(eq(tables.woPackagingMaterials.id, materialId)).returning();
      return material;
    } else {
      await db.update(tables.woPackagingMaterials).set(updateData).where(eq(tables.woPackagingMaterials.id, materialId));
      const [material] = await db.select().from(tables.woPackagingMaterials).where(eq(tables.woPackagingMaterials.id, materialId));
      return material;
    }
  });
}
