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

import { eq, and, desc, asc, inArray, sql } from 'drizzle-orm';
import { executeDbOperation, getInsertId, getTableRef } from '../db/db-helper';
import { isSqlite } from '../db';
import { parseAcceptanceStages, type AcceptanceStage } from '../master-data/ipc-stages';
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
  sqliteInventoryLots,
  sqliteBOMInProcessQC,
  sqliteIPCTestSamples,
  sqliteQualityTests,
  sqliteQualitySpecs,
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
  mysqlInventoryLots,
  mysqlBOMInProcessQC,
  mysqlIPCTestSamples,
  mysqlQualityTests,
  mysqlQualitySpecs,
} from '../db/schema';
import { getNow } from '../db/date-utils';
import { issueMaterial, getLotsForPicking, getAvailableLots } from './inventory.service';
import { calculateMinMax } from '../utils/ipc-criteria-calc';

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
      inventoryLots: sqliteInventoryLots,
      bomInProcessQC: sqliteBOMInProcessQC,
      ipcTestSamples: sqliteIPCTestSamples,
      qualityTests: sqliteQualityTests,
      qualitySpecs: sqliteQualitySpecs,
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
    inventoryLots: mysqlInventoryLots,
    bomInProcessQC: mysqlBOMInProcessQC,
    ipcTestSamples: mysqlIPCTestSamples,
    qualityTests: mysqlQualityTests,
    qualitySpecs: mysqlQualitySpecs,
  };
}

// ===========================
// Environmental Logs
// ===========================

export interface CreateWOEnvironmentalLogInput {
  workOrderId: number;
  bomConditionId?: number;
  roomId?: number;
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
        roomId: tables.woEnvironmentalLogs.roomId,
        roomCode: tables.productionRooms.code,
        roomName: tables.productionRooms.name,
        roomNameTh: tables.productionRooms.nameTh,
        phase: tables.woEnvironmentalLogs.phase,
        recordedDate: tables.woEnvironmentalLogs.recordedDate,
        recordedTime: tables.woEnvironmentalLogs.recordedTime,
        temperature: tables.woEnvironmentalLogs.temperature,
        humidity: tables.woEnvironmentalLogs.humidity,
        isNormal: tables.woEnvironmentalLogs.isNormal,
        operatorId: tables.woEnvironmentalLogs.operatorId,
        operatorName: tables.users.name,
        notes: tables.woEnvironmentalLogs.notes,
        createdAt: tables.woEnvironmentalLogs.createdAt,
      })
      .from(tables.woEnvironmentalLogs)
      .leftJoin(tables.productionRooms, eq(tables.woEnvironmentalLogs.roomId, tables.productionRooms.id))
      .leftJoin(tables.users, eq(tables.woEnvironmentalLogs.operatorId, tables.users.id))
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
      roomId: data.roomId || null,
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

export async function updateWOEnvironmentalLog(
  logId: number,
  data: { roomId?: number; temperature?: number; humidity?: number; isNormal?: boolean; notes?: string }
) {
  const tables = getTables();
  return executeDbOperation(async (db: any) => {
    const updateData: Record<string, unknown> = {};
    if (data.roomId !== undefined) updateData.roomId = data.roomId || null;
    if (data.temperature !== undefined) updateData.temperature = data.temperature;
    if (data.humidity !== undefined) updateData.humidity = data.humidity;
    if (data.isNormal !== undefined) updateData.isNormal = data.isNormal;
    if (data.notes !== undefined) updateData.notes = data.notes;

    await db.update(tables.woEnvironmentalLogs).set(updateData).where(eq(tables.woEnvironmentalLogs.id, logId));
    const [log] = await db.select().from(tables.woEnvironmentalLogs).where(eq(tables.woEnvironmentalLogs.id, logId));
    return log;
  });
}

export async function deleteWOEnvironmentalLog(logId: number) {
  const tables = getTables();
  return executeDbOperation(async (db: any) => {
    await db.delete(tables.woEnvironmentalLogs).where(eq(tables.woEnvironmentalLogs.id, logId));
    return { success: true };
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
        monitoringIntervalMinutes: tables.environmentalConditions.monitoringIntervalMinutes,
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
      return { isNormal: true, limits: null, bomConditionId: null, monitoringIntervalMinutes: null };
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
      monitoringIntervalMinutes: condition.monitoringIntervalMinutes
        ? Number(condition.monitoringIntervalMinutes)
        : null,
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

    const filtered = phase ? logs.filter((log: any) => log.phase === phase) : logs;

    // Resolve operator + verifier user names in one round-trip
    const userIds = new Set<number>();
    for (const l of filtered) {
      if (l.operatorId) userIds.add(l.operatorId);
      if (l.verifierId) userIds.add(l.verifierId);
    }

    const userMap = new Map<number, string>();
    if (userIds.size > 0) {
      const users = await db
        .select({ id: tables.users.id, name: tables.users.name })
        .from(tables.users)
        .where(inArray(tables.users.id, Array.from(userIds)));
      for (const u of users) userMap.set(u.id, u.name);
    }

    return filtered.map((log: any) => ({
      ...log,
      operatorName: log.operatorId ? userMap.get(log.operatorId) || null : null,
      verifierName: log.verifierId ? userMap.get(log.verifierId) || null : null,
    }));
  });
}

export async function createWOCleaningLog(data: CreateWOCleaningLogInput) {
  const tables = getTables();

  return executeDbOperation(async (db: any) => {
    // Check if there's an existing log that was verify-failed (re-mark-clean flow)
    const conditions = [
      eq(tables.woCleaningLogs.workOrderId, data.workOrderId),
      eq(tables.woCleaningLogs.phase, data.phase),
      eq(tables.woCleaningLogs.itemType, data.itemType),
    ];
    if (data.roomId) conditions.push(eq(tables.woCleaningLogs.roomId, data.roomId));
    if (data.equipmentId) conditions.push(eq(tables.woCleaningLogs.equipmentId, data.equipmentId));

    const existing = await db.select().from(tables.woCleaningLogs).where(and(...conditions)).limit(1);

    if (existing.length > 0 && existing[0].verifyResult === 'fail') {
      // Re-mark clean: update existing log, reset verify fields
      const updateData = {
        isClean: data.isClean,
        operatorId: data.operatorId,
        performedAt: isSqlite() ? data.performedAt : new Date(data.performedAt),
        verifierId: null,
        verifiedAt: null,
        verifyResult: null,
        notes: data.notes || null,
      };

      if (isSqlite()) {
        const [log] = await db.update(tables.woCleaningLogs).set(updateData).where(eq(tables.woCleaningLogs.id, existing[0].id)).returning();
        return log;
      } else {
        await db.update(tables.woCleaningLogs).set(updateData).where(eq(tables.woCleaningLogs.id, existing[0].id));
        const [log] = await db.select().from(tables.woCleaningLogs).where(eq(tables.woCleaningLogs.id, existing[0].id));
        return log;
      }
    }

    // Normal create
    const values = {
      workOrderId: data.workOrderId,
      phase: data.phase,
      itemType: data.itemType,
      roomId: data.roomId,
      equipmentId: data.equipmentId,
      isClean: data.isClean,
      operatorId: data.operatorId,
      performedAt: isSqlite() ? data.performedAt : new Date(data.performedAt),
      notes: data.notes || null,
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

export async function verifyWOCleaningLog(logId: number, verifierId: number, verifyResult: string = 'pass') {
  const tables = getTables();

  // Dual control: check operator != verifier
  const [existingLog] = await executeDbOperation(async (db: any) => {
    return db.select({ operatorId: tables.woCleaningLogs.operatorId })
      .from(tables.woCleaningLogs).where(eq(tables.woCleaningLogs.id, logId));
  });
  if (existingLog && Number(existingLog.operatorId) === verifierId) {
    throw new Error('ไม่สามารถตรวจสอบรายการของตนเองได้ ผู้ปฏิบัติและผู้ตรวจสอบต้องเป็นคนละคนกัน');
  }

  return executeDbOperation(async (db: any) => {
    const updateData: Record<string, unknown> = {
      verifierId,
      verifiedAt: getNow(),
      verifyResult,
    };

    // If verify failed, reset isClean so Production must re-mark
    if (verifyResult === 'fail') {
      updateData.isClean = false;
    }

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
              verifyResult: log.verifyResult || undefined,
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
              verifyResult: log.verifyResult || undefined,
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
        // Template ID for fetching sub-steps
        templateId: tables.bomSOPSteps.templateId,
      })
      .from(tables.woSOPExecution)
      .innerJoin(tables.bomSOPSteps, eq(tables.woSOPExecution.bomStepId, tables.bomSOPSteps.id))
      .where(eq(tables.woSOPExecution.workOrderId, workOrderId))
      .orderBy(asc(tables.woSOPExecution.sequence));

    // Fetch template sub-steps for each step that has a templateId
    const sopTemplateSteps = getTableRef('sOPTemplateSteps');
    const templateIds = [...new Set(executions.map((e: any) => e.templateId).filter(Boolean))] as number[];

    let templateStepsMap: Record<number, any[]> = {};
    if (templateIds.length > 0) {
      const { inArray } = await import('drizzle-orm');
      const allTemplateSteps = await db
        .select()
        .from(sopTemplateSteps)
        .where(inArray(sopTemplateSteps.templateId, templateIds))
        .orderBy(asc(sopTemplateSteps.sequence));

      for (const ts of allTemplateSteps) {
        if (!templateStepsMap[ts.templateId]) templateStepsMap[ts.templateId] = [];
        templateStepsMap[ts.templateId].push(ts);
      }
    }

    // Resolve operator/verifier names
    const userIds = new Set<number>();
    for (const e of executions) {
      if (e.operatorId) userIds.add(e.operatorId);
      if (e.verifierId) userIds.add(e.verifierId);
    }
    const userMap = new Map<number, string>();
    if (userIds.size > 0) {
      const { inArray } = await import('drizzle-orm');
      const users = await db
        .select({ id: tables.users.id, name: tables.users.name })
        .from(tables.users)
        .where(inArray(tables.users.id, [...userIds]));
      for (const u of users) userMap.set(u.id, u.name);
    }

    // Attach template sub-steps + user names to each execution
    return executions.map((exec: any) => ({
      ...exec,
      operatorName: exec.operatorId ? (userMap.get(exec.operatorId) || null) : null,
      verifierName: exec.verifierId ? (userMap.get(exec.verifierId) || null) : null,
      templateSteps: exec.templateId ? (templateStepsMap[exec.templateId] || []) : [],
    }));
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

export async function confirmWOSOPSubSteps(
  executionId: number,
  confirmedSubStepIds: number[]
) {
  const tables = getTables();

  return executeDbOperation(async (db: any) => {
    // Get current actualParameters
    const [current] = await db.select({ actualParameters: tables.woSOPExecution.actualParameters })
      .from(tables.woSOPExecution)
      .where(eq(tables.woSOPExecution.id, executionId));

    let params: Record<string, unknown> = {};
    if (current?.actualParameters) {
      try {
        params = typeof current.actualParameters === 'string'
          ? JSON.parse(current.actualParameters)
          : current.actualParameters;
      } catch { /* ignore */ }
    }

    params._confirmedSubSteps = confirmedSubStepIds;

    const updateData = {
      actualParameters: JSON.stringify(params),
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

  // Dual control: check operator != verifier
  const [existingStep] = await executeDbOperation(async (db: any) => {
    return db.select({ operatorId: tables.woSOPExecution.operatorId })
      .from(tables.woSOPExecution).where(eq(tables.woSOPExecution.id, executionId));
  });
  if (existingStep && Number(existingStep.operatorId) === verifierId) {
    throw new Error('ไม่สามารถตรวจสอบรายการของตนเองได้ ผู้ปฏิบัติและผู้ตรวจสอบต้องเป็นคนละคนกัน');
  }

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
  lotId?: number; // Optional: if provided, use this lot; otherwise FEFO auto-pick
  waterDate?: string;
  waterConductivity?: number;
  waterTemperature?: number;
}

export async function getWOMaterials(workOrderId: number) {
  const tables = getTables();

  // Step 1: Fetch materials from DB
  const materials = await executeDbOperation(async (db: any) => {
    return db
      .select({
        id: tables.workOrderMaterials.id,
        workOrderId: tables.workOrderMaterials.workOrderId,
        itemId: tables.workOrderMaterials.itemId,
        bomLineId: tables.workOrderMaterials.bomLineId,
        plannedQty: tables.workOrderMaterials.plannedQuantity,
        actualQty: tables.workOrderMaterials.actualQuantity,
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
        lotId: tables.workOrderMaterials.lotId,
        // Item details
        itemNameTh: tables.items.nameTh,
        itemNameEn: tables.items.nameEn,
        itemName: tables.items.nameEn,
        itemCode: tables.items.code,
        primaryUnit: tables.items.primaryUnit,
        secondaryUnit: tables.items.secondaryUnit,
        conversionRate: tables.items.conversionRate,
        // Lot details (from LEFT JOIN)
        lotNumber: tables.inventoryLots.lotNumber,
      })
      .from(tables.workOrderMaterials)
      .innerJoin(tables.items, eq(tables.workOrderMaterials.itemId, tables.items.id))
      .leftJoin(tables.inventoryLots, eq(tables.workOrderMaterials.lotId, tables.inventoryLots.id))
      .where(eq(tables.workOrderMaterials.workOrderId, workOrderId));
  });

  // Step 2: Resolve user names for weighedBy and verifiedBy
  const userIds = new Set<number>();
  materials.forEach((m: any) => {
    if (m.weighedBy) userIds.add(Number(m.weighedBy));
    if (m.verifiedBy) userIds.add(Number(m.verifiedBy));
  });

  const userNameMap = new Map<number, string>();
  if (userIds.size > 0) {
    const userResults = await executeDbOperation(async (db: any) => {
      return db
        .select({ id: tables.users.id, name: tables.users.name })
        .from(tables.users)
        .where(inArray(tables.users.id, Array.from(userIds)));
    });
    userResults.forEach((u: any) => userNameMap.set(Number(u.id), u.name));
  }

  // Step 3: Compute available stock per item (outside executeDbOperation to avoid DB conflict)
  const itemIds: number[] = [...new Set<number>(materials.map((m: any) => Number(m.itemId)))];
  const stockMap = new Map<number, number>();

  for (const id of itemIds) {
    try {
      const lots = await getAvailableLots(id);
      const totalAvailable = lots.reduce((sum: number, lot) => sum + lot.availableQty, 0);
      stockMap.set(id, totalAvailable);
    } catch {
      stockMap.set(id, 0);
    }
  }

  return materials.map((m: any) => ({
    ...m,
    weighedByName: m.weighedBy ? userNameMap.get(Number(m.weighedBy)) || null : null,
    verifiedByName: m.verifiedBy ? userNameMap.get(Number(m.verifiedBy)) || null : null,
    itemAvailableQty: stockMap.get(Number(m.itemId)) || 0,
  }));
}

export async function recordMaterialWeight(data: RecordMaterialWeightInput) {
  const tables = getTables();

  // Record the weighing data only — inventory deduction happens at Verify step
  const updateData: Record<string, any> = {
    weighedQty: data.weighedQty,
    weighedBy: data.weighedBy,
    weighedAt: getNow(),
    waterDate: data.waterDate,
    waterConductivity: data.waterConductivity,
    waterTemperature: data.waterTemperature,
  };

  // If user selected a specific lot, save the preference (no stock deduction yet)
  if (data.lotId) {
    updateData.lotId = data.lotId;
  }

  return executeDbOperation(async (db: any) => {
    if (isSqlite()) {
      const [mat] = await db.update(tables.workOrderMaterials).set(updateData).where(eq(tables.workOrderMaterials.id, data.materialId)).returning();
      return mat;
    } else {
      await db.update(tables.workOrderMaterials).set(updateData).where(eq(tables.workOrderMaterials.id, data.materialId));
      const [mat] = await db.select().from(tables.workOrderMaterials).where(eq(tables.workOrderMaterials.id, data.materialId));
      return mat;
    }
  });
}

export async function verifyMaterialWeight(materialId: number, verifierId: number) {
  const tables = getTables();

  // Check material exists and has been weighed
  const [existing] = await executeDbOperation(async (db: any) => {
    return db.select({
      id: tables.workOrderMaterials.id,
      itemId: tables.workOrderMaterials.itemId,
      workOrderId: tables.workOrderMaterials.workOrderId,
      status: tables.workOrderMaterials.status,
      weighedBy: tables.workOrderMaterials.weighedBy,
      weighedAt: tables.workOrderMaterials.weighedAt,
      weighedQty: tables.workOrderMaterials.weighedQty,
      unit: tables.workOrderMaterials.unit,
      lotId: tables.workOrderMaterials.lotId,
    }).from(tables.workOrderMaterials).where(eq(tables.workOrderMaterials.id, materialId));
  });

  if (!existing) {
    throw new Error('Material not found');
  }
  if (!existing.weighedAt) {
    throw new Error('Material has not been weighed yet');
  }

  // Dual control: verifier must be different from operator
  if (existing.weighedBy && Number(existing.weighedBy) === verifierId) {
    throw new Error('ไม่สามารถตรวจสอบรายการของตนเองได้ ผู้ปฏิบัติและผู้ตรวจสอบต้องเป็นคนละคนกัน');
  }

  // If material was weighed but not issued, issue from inventory now
  if (existing.status !== 'issued') {
    // Unit conversion: convert weighedQty to primary unit (inventory unit) if needed
    let deductQty = Number(existing.weighedQty);
    const [itemData] = await executeDbOperation(async (db: any) => {
      return db.select({
        primaryUnit: tables.items.primaryUnit,
        secondaryUnit: tables.items.secondaryUnit,
        conversionRate: tables.items.conversionRate,
      }).from(tables.items).where(eq(tables.items.id, existing.itemId));
    });

    if (itemData && existing.unit && itemData.secondaryUnit &&
        existing.unit === itemData.secondaryUnit &&
        itemData.conversionRate && itemData.conversionRate > 0) {
      // BOM unit is secondary unit → convert to primary: deductQty = weighedQty / conversionRate
      deductQty = deductQty / Number(itemData.conversionRate);
      console.log(`[Unit Conversion] ${existing.weighedQty} ${existing.unit} → ${deductQty.toFixed(4)} ${itemData.primaryUnit} (rate: ${itemData.conversionRate})`);
    }

    // FEFO multi-lot allocation using converted quantity
    let allocated: { lotId: number; lotNumber: string; quantity: number; expiryDate: string | null }[] = [];

    if (existing.lotId) {
      const { allocated: userLotAlloc } = await getLotsForPicking(existing.itemId, deductQty);
      const userLotIdx = userLotAlloc.findIndex((a: any) => a.lotId === existing.lotId);
      if (userLotIdx >= 0) {
        const [userLot] = userLotAlloc.splice(userLotIdx, 1);
        allocated = [userLot, ...userLotAlloc];
      } else {
        allocated = userLotAlloc;
      }
    } else {
      const result = await getLotsForPicking(existing.itemId, deductQty);
      allocated = result.allocated;
    }

    if (allocated.length === 0) {
      throw new Error('Cannot verify — no available inventory for this item (stock balance is 0)');
    }

    // Get work order info for reference
    const [workOrder] = await executeDbOperation(async (db: any) => {
      return db.select({ woNumber: tables.workOrders.woNumber, batchNumber: tables.workOrders.batchNumber })
        .from(tables.workOrders)
        .where(eq(tables.workOrders.id, existing.workOrderId));
    });

    const woNumber = workOrder?.woNumber || `WO-${existing.workOrderId}`;
    const batchNumber = workOrder?.batchNumber || '';

    // Issue from each allocated lot
    let totalIssued = 0;
    for (const alloc of allocated) {
      try {
        await issueMaterial(
          alloc.lotId,
          alloc.quantity,
          'WO',
          existing.workOrderId,
          woNumber,
          verifierId,
          `Material weighing for ${woNumber} (issued at verify)`,
          { workOrderId: existing.workOrderId, batchNumber }
        );
        totalIssued += alloc.quantity;
      } catch (error: any) {
        console.error(`Failed to issue from lot ${alloc.lotId}:`, error.message);
      }
    }

    if (totalIssued === 0) {
      throw new Error('Cannot verify — inventory issue failed for all lots');
    }

    // Assign primary lot (first allocated) to material record.
    //
    // `actualQuantity` is stored in PRIMARY unit (= totalIssued) because cost
    // calculation in unit-cost.service.ts multiplies it by `unitCost`/`currentWAC`
    // which are per primary unit. The weighing-unit value is preserved on
    // `weighedQty` and is used for display in the WO Materials tab (see the
    // detail API — variance/actualQty are computed from weighedQty so that the
    // tab shows unit-consistent numbers, e.g. planned 222 g vs actual 222 g).
    await executeDbOperation(async (db: any) => {
      await db.update(tables.workOrderMaterials).set({
        lotId: allocated[0].lotId,
        status: 'issued',
        actualQuantity: totalIssued,
        issuedBy: verifierId,
        issuedAt: getNow(),
      }).where(eq(tables.workOrderMaterials.id, materialId));
    });
  }

  // Now verify
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

export async function updateWOPackagingWeightLog(
  logId: number,
  sampleWeights: string,
  notes: string | undefined,
  _userId: number,
  bomId: number,
) {
  const tables = getTables();

  return executeDbOperation(async (db: any) => {
    // Get QC criteria for recalculation
    let weightMin = 0;
    let weightMax = 999999;
    let maxFailures = 2;

    const qcProfiles = await db
      .select({
        weightMin: tables.packagingQCCriteria.weightMin,
        weightMax: tables.packagingQCCriteria.weightMax,
        maxFailures: tables.packagingQCCriteria.maxFailures,
      })
      .from(tables.bomPackagingQC)
      .innerJoin(tables.packagingQCCriteria, eq(tables.bomPackagingQC.criteriaId, tables.packagingQCCriteria.id))
      .where(eq(tables.bomPackagingQC.bomId, bomId));

    if (qcProfiles.length > 0) {
      weightMin = qcProfiles[0].weightMin;
      weightMax = qcProfiles[0].weightMax;
      maxFailures = qcProfiles[0].maxFailures;
    }

    // Recalculate pass/fail
    const weights: number[] = JSON.parse(sampleWeights);
    const failedCount = weights.filter((w) => w < weightMin || w > weightMax).length;
    const isPass = failedCount <= maxFailures;

    const updateData: any = {
      sampleWeights,
      failedCount,
      isPass,
      notes,
    };

    if (isSqlite()) {
      const [log] = await db.update(tables.woPackagingWeightLogs).set(updateData).where(eq(tables.woPackagingWeightLogs.id, logId)).returning();
      return log;
    } else {
      await db.update(tables.woPackagingWeightLogs).set(updateData).where(eq(tables.woPackagingWeightLogs.id, logId));
      const [log] = await db.select().from(tables.woPackagingWeightLogs).where(eq(tables.woPackagingWeightLogs.id, logId));
      return log;
    }
  });
}

// ===========================
export async function deleteWOPackagingWeightLog(logId: number) {
  const tables = getTables();

  return executeDbOperation(async (db: any) => {
    if (isSqlite()) {
      await db.delete(tables.woPackagingWeightLogs).where(eq(tables.woPackagingWeightLogs.id, logId));
    } else {
      await db.delete(tables.woPackagingWeightLogs).where(eq(tables.woPackagingWeightLogs.id, logId));
    }
    return { success: true };
  });
}

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

    if (!inspections[0]) return null;

    // Parse checklistResults from JSON string to object
    const inspection = { ...inspections[0] };
    if (typeof inspection.checklistResults === 'string') {
      try {
        inspection.checklistResults = JSON.parse(inspection.checklistResults);
      } catch { /* keep as-is */ }
    }

    // Resolve user names for sampler, inspector, re-inspector
    const userIds = new Set<number>();
    if (inspection.samplerId) userIds.add(inspection.samplerId);
    if (inspection.inspectorId) userIds.add(inspection.inspectorId);
    if (inspection.reInspectorId) userIds.add(inspection.reInspectorId);

    if (userIds.size > 0) {
      const { inArray } = await import('drizzle-orm');
      const users = await db
        .select({ id: tables.users.id, name: tables.users.name })
        .from(tables.users)
        .where(inArray(tables.users.id, [...userIds]));
      const userMap = new Map<number, string>();
      for (const u of users) userMap.set(u.id, u.name);

      inspection.samplerName = inspection.samplerId ? (userMap.get(inspection.samplerId) || null) : null;
      inspection.inspectorName = inspection.inspectorId ? (userMap.get(inspection.inspectorId) || null) : null;
      inspection.reInspectorName = inspection.reInspectorId ? (userMap.get(inspection.reInspectorId) || null) : null;
    }

    return inspection;
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
  inspectorId: number | undefined,
  status: string,
  notes?: string,
) {
  const tables = getTables();

  return executeDbOperation(async (db: any) => {
    const updateData: any = {
      checklistResults,
      status,
      updatedAt: getNow(),
    };
    if (notes !== undefined) {
      updateData.notes = notes;
    }
    // Only set inspector when confirming (not draft)
    if (inspectorId) {
      updateData.inspectorId = inspectorId;
      updateData.inspectedAt = getNow();
    }

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

  // GMP Dual Control: the verifier must be a different user than the
  // operator who issued/used this packaging material. We check this up
  // front and throw a business-rule error so the API route can surface
  // a 422 instead of letting a DB update succeed incorrectly.
  const [existing] = await executeDbOperation(async (db: any) => {
    return db.select({
      id: tables.woPackagingMaterials.id,
      operatorId: tables.woPackagingMaterials.operatorId,
    }).from(tables.woPackagingMaterials).where(eq(tables.woPackagingMaterials.id, materialId));
  });

  if (!existing) {
    throw new Error('Packaging material not found');
  }
  if (existing.operatorId && Number(existing.operatorId) === verifierId) {
    throw new Error('ไม่สามารถตรวจสอบรายการของตนเองได้ ผู้ปฏิบัติและผู้ตรวจสอบต้องเป็นคนละคนกัน');
  }

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

// ===========================
// In-Process Control (IPC)
// ===========================

/**
 * Get BOM IPC config (which quality specs are linked to this BOM for IPC)
 */
export async function getBOMIPCConfig(bomId: number) {
  const tables = getTables();
  const ipcCriteria = getTableRef('iPCCriteria');

  return executeDbOperation(async (db: any) => {
    return db
      .select({
        id: tables.bomInProcessQC.id,
        bomId: tables.bomInProcessQC.bomId,
        criteriaId: tables.bomInProcessQC.criteriaId,
        sequence: tables.bomInProcessQC.sequence,
        sampleSize: tables.bomInProcessQC.sampleSize,
        isCritical: tables.bomInProcessQC.isCritical,
        // IPC Criteria details
        testName: ipcCriteria.name,
        testNameTh: ipcCriteria.nameTh,
        testMethod: ipcCriteria.testMethod,
        specification: ipcCriteria.specification,
        minValue: ipcCriteria.minValue,
        maxValue: ipcCriteria.maxValue,
        unit: ipcCriteria.unit,
        criteriaType: ipcCriteria.criteriaType,
        tolerancePercent: ipcCriteria.tolerancePercent,
        specTarget: ipcCriteria.specTarget,
        specTolerancePercent: ipcCriteria.specTolerancePercent,
        dosageForm: ipcCriteria.dosageForm,
        criteriaIsCritical: ipcCriteria.isCritical,
        // Phase 3: multi-stage acceptance plan from criteria
        acceptanceStages: ipcCriteria.acceptanceStages,
      })
      .from(tables.bomInProcessQC)
      .innerJoin(ipcCriteria, eq(tables.bomInProcessQC.criteriaId, ipcCriteria.id))
      .where(eq(tables.bomInProcessQC.bomId, bomId))
      .orderBy(asc(tables.bomInProcessQC.sequence));
  });
}

export interface CreateIPCTestInput {
  workOrderId: number;
  criteriaId: number;
  bomIpcId: number;
  sampleSize: number;
  operatorId: number;
  notes?: string;
}

/**
 * Find lot IDs associated with a work order (by batchNumber + material lots)
 */
async function findWOLotIds(db: any, tables: ReturnType<typeof getTables>, workOrderId: number): Promise<number[]> {
  const [wo] = await db
    .select({
      id: tables.workOrders.id,
      bomId: tables.workOrders.bomId,
      batchNumber: tables.workOrders.batchNumber,
      productId: tables.workOrders.productId,
      unit: tables.workOrders.unit,
    })
    .from(tables.workOrders)
    .where(eq(tables.workOrders.id, workOrderId));

  if (!wo) return [];

  const lotIds = new Set<number>();

  // Find lots by batch number
  if (wo.batchNumber) {
    const batchLots = await db
      .select({ id: tables.inventoryLots.id })
      .from(tables.inventoryLots)
      .where(eq(tables.inventoryLots.batchNumber, wo.batchNumber));
    batchLots.forEach((l: any) => lotIds.add(l.id));
  }

  return Array.from(lotIds);
}

/**
 * Get all IPC tests for a work order with samples and spec info
 */
export async function getWOIPCTests(workOrderId: number) {
  const tables = getTables();

  return executeDbOperation(async (db: any) => {
    const lotIds = await findWOLotIds(db, tables, workOrderId);
    if (lotIds.length === 0) return [];

    // Get quality_tests with testType = 'in_process' for these lots
    const tests = await db
      .select({
        id: tables.qualityTests.id,
        lotId: tables.qualityTests.lotId,
        specId: tables.qualityTests.specId,
        testType: tables.qualityTests.testType,
        sampleNumber: tables.qualityTests.sampleNumber,
        sampleSize: tables.qualityTests.sampleSize,
        testDate: tables.qualityTests.testDate,
        result: tables.qualityTests.result,
        numericResult: tables.qualityTests.numericResult,
        status: tables.qualityTests.status,
        testedBy: tables.qualityTests.testedBy,
        approvedBy: tables.qualityTests.approvedBy,
        approvedAt: tables.qualityTests.approvedAt,
        notes: tables.qualityTests.notes,
        specMinValue: tables.qualityTests.specMinValue,
        specMaxValue: tables.qualityTests.specMaxValue,
        specSpecification: tables.qualityTests.specSpecification,
        specUnit: tables.qualityTests.specUnit,
        criteriaType: tables.qualityTests.criteriaType,
        tolerancePercent: tables.qualityTests.tolerancePercent,
        // Phase 3: stage plan snapshot — null = single-stage
        acceptanceStages: tables.qualityTests.acceptanceStages,
        disposition: tables.qualityTests.disposition,
        // Spec details
        testName: tables.qualitySpecs.testName,
        testMethod: tables.qualitySpecs.testMethod,
      })
      .from(tables.qualityTests)
      .leftJoin(tables.qualitySpecs, eq(tables.qualityTests.specId, tables.qualitySpecs.id))
      .where(
        and(
          eq(tables.qualityTests.testType, 'in_process'),
          eq(tables.qualityTests.lotId, lotIds[0])
        )
      )
      .orderBy(asc(tables.qualityTests.id));

    // Collect user IDs for name resolution
    const userIds = new Set<number>();
    for (const t of tests) {
      if (t.testedBy) userIds.add(t.testedBy);
      if (t.approvedBy) userIds.add(t.approvedBy);
    }

    // Resolve user names
    let userMap = new Map<number, string>();
    if (userIds.size > 0) {
      const { inArray } = await import('drizzle-orm');
      const users = await db
        .select({ id: tables.users.id, name: tables.users.name })
        .from(tables.users)
        .where(inArray(tables.users.id, [...userIds]));
      for (const u of users) userMap.set(u.id, u.name);
    }

    // Get samples for each test + resolve testName + user names + group by round
    const testsWithSamples = await Promise.all(
      tests.map(async (test: any) => {
        const samples = await db
          .select()
          .from(tables.ipcTestSamples)
          .where(eq(tables.ipcTestSamples.qualityTestId, test.id))
          .orderBy(asc(tables.ipcTestSamples.testRound), asc(tables.ipcTestSamples.sampleNumber));

        // Calculate max round and group samples by round
        let maxRound = 0;
        const roundsMap: Record<number, any[]> = {};
        for (const s of samples) {
          const round = Number(s.testRound) || 1;
          if (round > maxRound) maxRound = round;
          if (!roundsMap[round]) roundsMap[round] = [];
          roundsMap[round].push(s);
        }
        const rounds = Object.entries(roundsMap).map(([round, roundSamples]) => ({
          round: Number(round),
          samples: roundSamples,
          result: (() => {
            const failCount = roundSamples.filter((s: any) => s.result === 'fail').length;
            const total = roundSamples.length;
            const tolerancePct = Number(test.tolerancePercent) || 0;
            if (total === 0) return 'pending';
            const failPct = (failCount / total) * 100;
            return failPct > tolerancePct ? 'fail' : 'pass';
          })(),
          avg: (() => {
            const nums = roundSamples.filter((s: any) => s.numericValue != null);
            return nums.length > 0 ? nums.reduce((sum: number, s: any) => sum + Number(s.numericValue), 0) / nums.length : null;
          })(),
          isApproved: roundSamples.every((s: any) => s.approvedBy != null),
          approvedBy: roundSamples[0]?.approvedBy || null,
          approvedAt: roundSamples[0]?.approvedAt || null,
        }));

        return {
          ...test,
          testName: test.testName || test.notes || test.specSpecification || `IPC-${test.sampleNumber || test.id}`,
          testedByName: test.testedBy ? (userMap.get(test.testedBy) || null) : null,
          approvedByName: test.approvedBy ? (userMap.get(test.approvedBy) || null) : null,
          samples,
          rounds,
          totalRounds: maxRound,
        };
      })
    );

    return testsWithSamples;
  });
}

/**
 * Record an IPC test result (single value or with samples)
 */
export interface RecordIPCTestInput {
  qualityTestId: number;
  numericResult?: number;
  result?: string;
  notes?: string;
  testedBy: number;
  testRound?: number; // auto-increments if not provided
  samples?: Array<{
    sampleNumber: number;
    numericValue?: number;
    textValue?: string;
    result?: string; // for checkbox mode: 'pass' or 'fail'
  }>;
}

export async function recordIPCTestResult(input: RecordIPCTestInput) {
  const tables = getTables();

  return executeDbOperation(async (db: any) => {
    // Get test with spec info
    const [test] = await db
      .select()
      .from(tables.qualityTests)
      .where(eq(tables.qualityTests.id, input.qualityTestId));

    if (!test) throw new Error('Quality test not found');

    // Determine test round: use provided or auto-increment from max existing round
    let testRound = input.testRound;
    if (!testRound) {
      const existingSamples = await db
        .select({ testRound: tables.ipcTestSamples.testRound })
        .from(tables.ipcTestSamples)
        .where(eq(tables.ipcTestSamples.qualityTestId, input.qualityTestId))
        .orderBy(desc(tables.ipcTestSamples.testRound))
        .limit(1);
      const maxRound = existingSamples.length > 0 ? Number(existingSamples[0].testRound) : 0;
      testRound = maxRound + 1;
    }

    // Calculate pass/fail based on spec limits
    let autoResult = input.result;
    if (input.numericResult != null && test.specMinValue != null && test.specMaxValue != null) {
      autoResult = (input.numericResult >= Number(test.specMinValue) && input.numericResult <= Number(test.specMaxValue))
        ? 'pass' : 'fail';
    }

    // Phase 3: stage-specific tolerance overrides single-stage tolerance.
    // Stage index = testRound - 1. Falls back to test.tolerancePercent for
    // single-stage tests or when stage data is missing/invalid.
    const stages: AcceptanceStage[] = parseAcceptanceStages(test.acceptanceStages);
    const currentStage: AcceptanceStage | null = stages[testRound - 1] ?? null;
    const isLastStage = stages.length > 0 && testRound >= stages.length;
    const stageOnFail = currentStage?.onFail ?? null;

    // If samples provided, calculate aggregate result
    if (input.samples && input.samples.length > 0) {
      // Delete existing samples for this round (in case of re-recording)
      await db.delete(tables.ipcTestSamples).where(
        and(
          eq(tables.ipcTestSamples.qualityTestId, input.qualityTestId),
          eq(tables.ipcTestSamples.testRound, testRound)
        )
      );

      const criteriaType = test.criteriaType || 'numeric';
      // Use stage tolerance when multi-stage; fall back to test-level tolerance.
      const tolerancePct = currentStage ? currentStage.tolerancePercent : (Number(test.tolerancePercent) || 0);

      // Per-sample pass/fail comes from the user when the criteria is
      // checkbox / pass_fail / visual; numeric is auto-calculated from spec.
      // Text mode treats every recorded answer as 'pass' — the spec defines
      // the format, not the answer.
      const isChecklistMode = criteriaType === 'checkbox' || criteriaType === 'pass_fail' || criteriaType === 'visual';
      const isTextMode = criteriaType === 'text';

      for (const sample of input.samples) {
        let sampleResult: string | null = null;

        if (isChecklistMode) {
          sampleResult = sample.result || null;
        } else if (isTextMode) {
          sampleResult = sample.result || 'pass';
        } else {
          // Numeric mode: auto-calculate from min/max
          if (sample.numericValue != null && test.specMinValue != null && test.specMaxValue != null) {
            sampleResult = (sample.numericValue >= Number(test.specMinValue) && sample.numericValue <= Number(test.specMaxValue))
              ? 'pass' : 'fail';
          }
        }

        await db.insert(tables.ipcTestSamples).values({
          qualityTestId: input.qualityTestId,
          sampleNumber: sample.sampleNumber,
          testRound,
          numericValue: sample.numericValue ?? null,
          textValue: sample.textValue ?? null,
          result: sampleResult,
          createdAt: getNow(),
        });
      }

      // Aggregate: tolerance-based pass/fail
      const sampleResults = input.samples.map((s) => {
        if (isChecklistMode) {
          return s.result === 'pass';
        }
        if (isTextMode) {
          // Text answers are accepted as long as a value was provided
          return (s.result ?? 'pass') === 'pass';
        }
        if (s.numericValue != null && test.specMinValue != null && test.specMaxValue != null) {
          return s.numericValue >= Number(test.specMinValue) && s.numericValue <= Number(test.specMaxValue);
        }
        return true; // text-only samples default to pass
      });
      const failCount = sampleResults.filter((passed) => !passed).length;
      const totalCount = sampleResults.length;
      const failPercent = totalCount > 0 ? (failCount / totalCount) * 100 : 0;
      autoResult = failPercent > tolerancePct ? 'fail' : 'pass';

      // Calculate average numeric result from samples (numeric mode only)
      if (criteriaType === 'numeric') {
        const numericSamples = input.samples.filter((s) => s.numericValue != null);
        if (numericSamples.length > 0) {
          input.numericResult = numericSamples.reduce((sum, s) => sum + (s.numericValue || 0), 0) / numericSamples.length;
        }
      }
    } else if (input.numericResult != null) {
      // Single-value record: also track as a sample for round history
      await db.delete(tables.ipcTestSamples).where(
        and(
          eq(tables.ipcTestSamples.qualityTestId, input.qualityTestId),
          eq(tables.ipcTestSamples.testRound, testRound)
        )
      );
      let singleResult: string | null = null;
      if (test.specMinValue != null && test.specMaxValue != null) {
        singleResult = (input.numericResult >= Number(test.specMinValue) && input.numericResult <= Number(test.specMaxValue))
          ? 'pass' : 'fail';
      }
      await db.insert(tables.ipcTestSamples).values({
        qualityTestId: input.qualityTestId,
        sampleNumber: 1,
        testRound,
        numericValue: input.numericResult,
        textValue: null,
        result: singleResult,
        createdAt: getNow(),
      });
    }

    // Sanitize numericResult — NaN breaks MySQL
    const safeNumericResult = (input.numericResult != null && !isNaN(input.numericResult))
      ? input.numericResult : null;

    // Phase 3: when this round failed and the stage's onFail is reject/deviation
    // (and this is the terminal action — last stage or non-advancing action),
    // mark the overall test status to match. 'next_stage' keeps status='fail' on
    // the round but the test stays in flight so operator can run the next stage.
    let testStatus = autoResult || 'pending';
    if (autoResult === 'fail' && currentStage) {
      if (stageOnFail === 'reject_batch') testStatus = 'fail';
      else if (stageOnFail === 'deviation') testStatus = 'deviation';
      else if (stageOnFail === 'next_stage' && !isLastStage) testStatus = 'retest';
      else testStatus = 'fail'; // last stage falling through to next_stage = treat as fail
    }

    const updateData: any = {
      numericResult: safeNumericResult,
      result: autoResult || input.result || null,
      status: testStatus,
      testedBy: input.testedBy,
      testDate: getNow(),
      notes: input.notes || null,
    };

    if (isSqlite()) {
      await db
        .update(tables.qualityTests)
        .set(updateData)
        .where(eq(tables.qualityTests.id, input.qualityTestId));
    } else {
      await db
        .update(tables.qualityTests)
        .set(updateData)
        .where(eq(tables.qualityTests.id, input.qualityTestId));
    }

    // Auto-create deviation when a stage with onFail='deviation' actually failed
    let deviationId: number | null = null;
    if (autoResult === 'fail' && stageOnFail === 'deviation') {
      deviationId = await createDeviationForFailedIPC(db, tables, {
        qualityTestId: input.qualityTestId,
        testRound,
        stageIndex: testRound - 1,
        operatorId: input.testedBy,
      });
    }

    const [updated] = await db
      .select()
      .from(tables.qualityTests)
      .where(eq(tables.qualityTests.id, input.qualityTestId));

    return { ...updated, testRound, deviationId };
  });
}

/**
 * Auto-create a deviation record when an IPC test fails its final stage.
 *
 * Returns the created deviation ID, or null if the underlying lot/work order
 * cannot be resolved (we never block the test recording because of deviation
 * bookkeeping — the failing test result is the source of truth).
 */
async function createDeviationForFailedIPC(
  db: any,
  tables: ReturnType<typeof getTables>,
  params: {
    qualityTestId: number;
    testRound: number;
    stageIndex: number;
    operatorId: number;
  },
): Promise<number | null> {
  try {
    const [test] = await db
      .select({
        lotId: tables.qualityTests.lotId,
        sampleNumber: tables.qualityTests.sampleNumber,
        notes: tables.qualityTests.notes,
        specSpecification: tables.qualityTests.specSpecification,
      })
      .from(tables.qualityTests)
      .where(eq(tables.qualityTests.id, params.qualityTestId));
    if (!test) return null;

    // Find the work order this lot belongs to (best-effort — by batchNumber match)
    let workOrderId: number | null = null;
    const [lot] = await db
      .select({ batchNumber: tables.inventoryLots.batchNumber })
      .from(tables.inventoryLots)
      .where(eq(tables.inventoryLots.id, test.lotId));
    if (lot?.batchNumber) {
      const [wo] = await db
        .select({ id: tables.workOrders.id })
        .from(tables.workOrders)
        .where(eq(tables.workOrders.batchNumber, lot.batchNumber));
      if (wo) workOrderId = wo.id;
    }

    const year = new Date().getFullYear();
    const seq = String(Math.floor(Math.random() * 9000) + 1000);
    const deviationNumber = `DEV-${year}-${seq}`;

    const deviationsTable = getTableRef('deviations');
    const result = await db.insert(deviationsTable).values({
      deviationNumber,
      title: `IPC Failure — ${test.notes || test.sampleNumber || 'Unknown test'}`,
      description: `In-Process Control test failed at Stage ${params.stageIndex + 1} (Round ${params.testRound}). Spec: ${test.specSpecification || 'n/a'}. Auto-generated by stage onFail=deviation rule.`,
      type: 'OOS',
      sourceType: 'production',
      sourceId: params.qualityTestId,
      lotId: test.lotId,
      workOrderId,
      severity: 'minor',
      status: 'open',
      reportedBy: params.operatorId,
      reportedAt: getNow(),
      createdAt: getNow(),
      updatedAt: getNow(),
    });
    return Number(getInsertId(result));
  } catch (err) {
    // Never let deviation bookkeeping break a test recording — log and swallow
    console.error('[ipc] Failed to auto-create deviation:', err);
    return null;
  }
}

/**
 * Approve an IPC test — per-round or entire test
 * If testRound is provided, approves only that round's samples.
 * If all rounds are approved, also marks the overall quality_tests record as approved.
 */
export async function approveIPCTest(qualityTestId: number, approvedBy: number, disposition: string = 'accept', testRound?: number) {
  const tables = getTables();

  // Dual control: check tester != approver
  const [existingTest] = await executeDbOperation(async (db: any) => {
    return db.select({ testedBy: tables.qualityTests.testedBy })
      .from(tables.qualityTests).where(eq(tables.qualityTests.id, qualityTestId));
  });
  if (existingTest && existingTest.testedBy && Number(existingTest.testedBy) === approvedBy) {
    throw new Error('ไม่สามารถตรวจสอบรายการของตนเองได้ ผู้ปฏิบัติและผู้ตรวจสอบต้องเป็นคนละคนกัน');
  }

  return executeDbOperation(async (db: any) => {
    const now = getNow();

    if (testRound) {
      // Approve specific round: set approvedBy/approvedAt on all samples of that round
      await db
        .update(tables.ipcTestSamples)
        .set({ approvedBy, approvedAt: now })
        .where(
          and(
            eq(tables.ipcTestSamples.qualityTestId, qualityTestId),
            eq(tables.ipcTestSamples.testRound, testRound)
          )
        );

      // Check if ALL rounds are now approved
      const unapproved = await db
        .select({ id: tables.ipcTestSamples.id })
        .from(tables.ipcTestSamples)
        .where(
          and(
            eq(tables.ipcTestSamples.qualityTestId, qualityTestId),
            sql`${tables.ipcTestSamples.approvedBy} IS NULL`
          )
        )
        .limit(1);

      // If all rounds approved, mark overall test as approved too
      if (unapproved.length === 0) {
        await db
          .update(tables.qualityTests)
          .set({ approvedBy, approvedAt: now, disposition })
          .where(eq(tables.qualityTests.id, qualityTestId));
      }
    } else {
      // Legacy: approve entire test at once
      await db
        .update(tables.qualityTests)
        .set({ approvedBy, approvedAt: now, disposition })
        .where(eq(tables.qualityTests.id, qualityTestId));

      // Also mark all samples as approved
      await db
        .update(tables.ipcTestSamples)
        .set({ approvedBy, approvedAt: now })
        .where(eq(tables.ipcTestSamples.qualityTestId, qualityTestId));
    }

    const [updated] = await db
      .select()
      .from(tables.qualityTests)
      .where(eq(tables.qualityTests.id, qualityTestId));
    return { ...updated, approvedRound: testRound };
  });
}

/**
 * Initialize IPC tests for a work order from its BOM config.
 * Creates quality_tests records for each BOM IPC spec.
 * Uses the same lot-finding pattern as qc-tests route (batchNumber-based).
 */
export async function initializeWOIPCTests(workOrderId: number, operatorId: number) {
  const tables = getTables();

  return executeDbOperation(async (db: any) => {
    // Get WO with BOM and batchNumber
    const [wo] = await db
      .select({
        id: tables.workOrders.id,
        bomId: tables.workOrders.bomId,
        batchNumber: tables.workOrders.batchNumber,
        productId: tables.workOrders.productId,
        unit: tables.workOrders.unit,
      })
      .from(tables.workOrders)
      .where(eq(tables.workOrders.id, workOrderId));

    if (!wo?.bomId) throw new Error('Work order has no BOM linked');

    // Get BOM IPC config
    const ipcConfig = await getBOMIPCConfig(wo.bomId);
    if (ipcConfig.length === 0) return [];

    // Find lot by batchNumber (same as qc-tests pattern)
    let targetLotId: number | null = null;
    if (wo.batchNumber) {
      const batchLots = await db
        .select({ id: tables.inventoryLots.id })
        .from(tables.inventoryLots)
        .where(eq(tables.inventoryLots.batchNumber, wo.batchNumber));
      if (batchLots.length > 0) {
        targetLotId = batchLots[0].id;
      }
    }

    // Auto-create in-process lot if none exists
    if (!targetLotId) {
      const lotResult = await db.insert(tables.inventoryLots).values({
        itemId: wo.productId,
        lotNumber: `${wo.batchNumber || `WO${workOrderId}`}-IP`,
        batchNumber: wo.batchNumber || null,
        warehouseId: 1,
        quantity: 0,
        reservedQuantity: 0,
        unit: wo.unit || 'unit',
        status: 'under_test',
        manufacturingDate: getNow(),
        createdAt: getNow(),
        updatedAt: getNow(),
      });
      targetLotId = Number(getInsertId(lotResult));
    }

    // Check existing IPC tests to avoid duplicates
    const existingTests = await db
      .select({ sampleNumber: tables.qualityTests.sampleNumber })
      .from(tables.qualityTests)
      .where(
        and(
          eq(tables.qualityTests.lotId, targetLotId),
          eq(tables.qualityTests.testType, 'in_process')
        )
      );
    const existingCount = existingTests.length;

    // Create quality_tests for each BOM IPC criteria
    const created = [];
    for (let i = 0; i < ipcConfig.length; i++) {
      const config = ipcConfig[i];
      // Skip if already initialized (based on count match)
      if (existingCount >= ipcConfig.length) continue;

      // When specTarget is present, recompute Min/Max from Target + SpecTolerancePercent
      // so the quality test always uses the formula-derived bounds (server-authoritative).
      let effectiveMin = config.minValue;
      let effectiveMax = config.maxValue;
      const specTargetNum = config.specTarget !== null && config.specTarget !== undefined
        ? Number(config.specTarget)
        : null;
      const specTolPctNum = Number(config.specTolerancePercent) || 0;
      if (specTargetNum !== null && !Number.isNaN(specTargetNum)) {
        const calc = calculateMinMax(specTargetNum, specTolPctNum);
        if (calc) {
          effectiveMin = calc.min;
          effectiveMax = calc.max;
        }
      }

      const testResult = await db.insert(tables.qualityTests).values({
        lotId: targetLotId,
        testType: 'in_process',
        sampleNumber: `IPC-${config.sequence || (i + 1)}`,
        sampleSize: config.sampleSize,
        status: 'pending',
        requestedBy: operatorId,
        requestedAt: getNow(),
        // Snapshot criteria values
        specMinValue: effectiveMin,
        specMaxValue: effectiveMax,
        specSpecification: config.specification || config.testName,
        specUnit: config.unit,
        criteriaType: config.criteriaType || 'numeric',
        tolerancePercent: Number(config.tolerancePercent) || 0,
        specTarget: specTargetNum,
        specTolerancePercent: specTolPctNum,
        // Phase 3: snapshot multi-stage plan so subsequent edits to the criteria
        // can't change the plan that's already in flight on this work order.
        acceptanceStages: typeof config.acceptanceStages === 'string'
          ? config.acceptanceStages
          : (config.acceptanceStages ? JSON.stringify(config.acceptanceStages) : null),
        notes: config.testNameTh || config.testName,
        createdAt: getNow(),
        updatedAt: getNow(),
      });
      created.push({ id: getInsertId(testResult), criteriaId: config.criteriaId, testName: config.testName });
    }

    return created;
  });
}
