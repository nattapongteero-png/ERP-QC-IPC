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

    // eBMR audit gap #5 — resolve equipment + room display names so the
    // Cleaning Verification table prints the actual equipment ID/name
    // instead of a generic "room"/"equipment" label.
    const equipmentIds = new Set<number>();
    const roomIds = new Set<number>();
    for (const l of filtered) {
      if (l.equipmentId) equipmentIds.add(l.equipmentId);
      if (l.roomId) roomIds.add(l.roomId);
    }
    const equipmentMap = new Map<number, { code: string; name: string }>();
    const roomMap = new Map<number, { code: string; name: string }>();
    try {
      if (equipmentIds.size > 0) {
        const equipmentTable = getTableRef('productionEquipment');
        const rows = await db
          .select({
            id: equipmentTable.id,
            code: equipmentTable.code,
            name: equipmentTable.name,
          })
          .from(equipmentTable)
          .where(inArray(equipmentTable.id, Array.from(equipmentIds)));
        for (const r of rows) {
          equipmentMap.set(r.id as number, { code: r.code as string, name: r.name as string });
        }
      }
      if (roomIds.size > 0) {
        const roomTable = getTableRef('productionRooms');
        const rows = await db
          .select({
            id: roomTable.id,
            code: roomTable.code,
            name: roomTable.name,
          })
          .from(roomTable)
          .where(inArray(roomTable.id, Array.from(roomIds)));
        for (const r of rows) {
          roomMap.set(r.id as number, { code: r.code as string, name: r.name as string });
        }
      }
    } catch {
      // master tables may be missing in older setups
    }

    return filtered.map((log: any) => {
      const equip = log.equipmentId ? equipmentMap.get(log.equipmentId) : null;
      const room = log.roomId ? roomMap.get(log.roomId) : null;
      return {
        ...log,
        operatorName: log.operatorId ? userMap.get(log.operatorId) || null : null,
        verifierName: log.verifierId ? userMap.get(log.verifierId) || null : null,
        equipmentCode: equip?.code || null,
        equipmentName: equip?.name || null,
        roomCode: room?.code || null,
        roomName: room?.name || null,
      };
    });
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
        // Phase: drives per-phase SOP cards on Execution Dashboard
        phase: tables.bomSOPSteps.phase,
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
    // Template-level GMP document (sop_step_templates.gmpDocumentId), keyed by
    // templateId. Distinct from per-sub-step and per-IPC document links — shown
    // at the step header on the SOP execution screen.
    const templateGmpDocMap: Record<number, number | null> = {};
    // BOM-level IPC linkage (Phase 14): linkedIPC keyed by bomStepId
    // (was templateId pre-Phase-14). Each BOM owns its IPC links — different
    // BOMs sharing the same SOP template can attach different IPC criteria.
    const linkedIPCMapByBomStep: Record<number, any[]> = {};
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

      // Pull the template-level document link from sop_step_templates.
      const stepTemplatesTable = tables.sopStepTemplates;
      const templateRows = await db
        .select({ id: stepTemplatesTable.id, gmpDocumentId: stepTemplatesTable.gmpDocumentId })
        .from(stepTemplatesTable)
        .where(inArray(stepTemplatesTable.id, templateIds));
      for (const tr of templateRows as any[]) {
        templateGmpDocMap[tr.id] = tr.gmpDocumentId ?? null;
      }

      // Phase 14 — pull IPC links from bom_sop_step_ipc (BOM-level), not
      // sop_template_ipc_criteria (master). Each WO SOP step references a
      // bom_step_id, and the IPCs attached to that bom_step are what the
      // operator records. procedureStepId is preserved on each link so the
      // UI can still group IPCs under specific sub-steps (templateSteps).
      const allBomStepIds = [...new Set(executions.map((e: any) => e.bomStepId).filter(Boolean))] as number[];
      if (allBomStepIds.length > 0) {
        const linkTable = getTableRef('bOMSOPStepIPC');
        const ipcTable = getTableRef('iPCCriteria');
        const ipcLinks = await db
          .select({
            id: linkTable.id,
            bomStepId: linkTable.bomStepId,
            procedureStepId: linkTable.procedureStepId,
            criteriaId: linkTable.criteriaId,
            sequence: linkTable.sequence,
            sampleSize: linkTable.sampleSize,
            isCritical: linkTable.isCritical,
            notes: linkTable.notes,
            // BOM-level override of master maxRetestRounds (nullable).
            bomMaxRetestRounds: linkTable.maxRetestRounds,
            criteriaCode: ipcTable.code,
            criteriaName: ipcTable.name,
            criteriaNameTh: ipcTable.nameTh,
            specification: ipcTable.specification,
            minValue: ipcTable.minValue,
            maxValue: ipcTable.maxValue,
            specTarget: ipcTable.specTarget,
            specTolerancePercent: ipcTable.specTolerancePercent,
            unit: ipcTable.unit,
            criteriaType: ipcTable.criteriaType,
            testMethod: ipcTable.testMethod,
            isCriteriaCritical: ipcTable.isCritical,
            masterMaxRetestRounds: ipcTable.maxRetestRounds,
            // Per-IPC GMP document link (soft ref to documents.id). Surfaced on
            // the IPC card in the SOP execution screen.
            gmpDocumentId: ipcTable.gmpDocumentId,
          })
          .from(linkTable)
          .innerJoin(ipcTable, eq(linkTable.criteriaId, ipcTable.id))
          .where(inArray(linkTable.bomStepId, allBomStepIds))
          .orderBy(asc(linkTable.sequence), asc(linkTable.id));

        for (const link of ipcLinks as any[]) {
          // Resolve effective maxRetestRounds: BOM override > master default.
          const effectiveMax = link.bomMaxRetestRounds != null
            ? Number(link.bomMaxRetestRounds)
            : (link.masterMaxRetestRounds != null ? Number(link.masterMaxRetestRounds) : null);
          const enriched = { ...link, maxRetestRounds: effectiveMax };
          if (!linkedIPCMapByBomStep[link.bomStepId]) linkedIPCMapByBomStep[link.bomStepId] = [];
          linkedIPCMapByBomStep[link.bomStepId].push(enriched);
        }
      }
    }

    // Collect every user id we'll need names for (executions + recorded
    // tests). One round-trip resolves all of them.
    const userIds = new Set<number>();
    for (const e of executions) {
      if (e.operatorId) userIds.add(e.operatorId);
      if (e.verifierId) userIds.add(e.verifierId);
    }

    // Phase 5 + 6a — find which IPC criteria are already recorded per WO
    // step (skip re-prompt) AND attach sample-level details so the UI can
    // expand a "บันทึกแล้ว" badge into a read-only details panel without
    // a second round-trip. We match on the deterministic sample_number
    // used by recordSOPLinkedIPCResults (`SOP-{executionId}-IPC-{criteriaId}`).
    const recordedKey = new Map<string, {
      id: number;
      status: string | null;
      testedBy: number | null;
      testDate: string | null;
      acceptanceStages: string | null;
      retestRound: number | null;
      retestReason: string | null;
      samples: Array<{
        sampleNumber: number;
        testRound: number;
        numericValue: number | null;
        textValue: string | null;
        result: string | null;
      }>;
    }>();
    if (executions.length > 0) {
      const lotIds = await findWOLotIds(db, tables, workOrderId);
      if (lotIds.length > 0) {
        const { like, inArray } = await import('drizzle-orm');
        const recordedTests = await db
          .select({
            id: tables.qualityTests.id,
            sampleNumber: tables.qualityTests.sampleNumber,
            status: tables.qualityTests.status,
            testedBy: tables.qualityTests.testedBy,
            testDate: tables.qualityTests.testDate,
            acceptanceStages: tables.qualityTests.acceptanceStages,
            retestRound: tables.qualityTests.retestRound,
            retestReason: tables.qualityTests.retestReason,
          })
          .from(tables.qualityTests)
          .where(and(
            inArray(tables.qualityTests.lotId, lotIds),
            eq(tables.qualityTests.testType, 'in_process'),
            like(tables.qualityTests.sampleNumber, 'SOP-%-IPC-%'),
          ));

        // Batch-fetch samples for every recorded test in one query.
        const testIds = (recordedTests as any[]).map((t) => t.id);
        const samplesByTest = new Map<number, any[]>();
        if (testIds.length > 0) {
          const sampleRows = await db
            .select({
              qualityTestId: tables.ipcTestSamples.qualityTestId,
              sampleNumber: tables.ipcTestSamples.sampleNumber,
              testRound: tables.ipcTestSamples.testRound,
              numericValue: tables.ipcTestSamples.numericValue,
              textValue: tables.ipcTestSamples.textValue,
              result: tables.ipcTestSamples.result,
            })
            .from(tables.ipcTestSamples)
            .where(inArray(tables.ipcTestSamples.qualityTestId, testIds))
            .orderBy(asc(tables.ipcTestSamples.testRound), asc(tables.ipcTestSamples.sampleNumber));
          for (const s of sampleRows as any[]) {
            if (!samplesByTest.has(s.qualityTestId)) samplesByTest.set(s.qualityTestId, []);
            samplesByTest.get(s.qualityTestId)!.push({
              sampleNumber: s.sampleNumber,
              testRound: s.testRound,
              numericValue: s.numericValue != null ? Number(s.numericValue) : null,
              textValue: s.textValue,
              result: s.result,
            });
          }

          // Resolve testedBy names along with operator names already collected.
          for (const t of recordedTests as any[]) {
            if (t.testedBy) userIds.add(t.testedBy);
          }
        }

        for (const t of recordedTests as any[]) {
          recordedKey.set(t.sampleNumber, {
            id: t.id,
            status: t.status,
            testedBy: t.testedBy,
            testDate: t.testDate,
            acceptanceStages: t.acceptanceStages ?? null,
            retestRound: t.retestRound != null ? Number(t.retestRound) : null,
            retestReason: t.retestReason ?? null,
            samples: samplesByTest.get(t.id) || [],
          });
        }
      }
    }

    // Resolve user names for everyone we touch (operators, verifiers,
    // recorded-test testers).
    const userMap = new Map<number, string>();
    if (userIds.size > 0) {
      const { inArray } = await import('drizzle-orm');
      const users = await db
        .select({ id: tables.users.id, name: tables.users.name })
        .from(tables.users)
        .where(inArray(tables.users.id, [...userIds]));
      for (const u of users) userMap.set(u.id, u.name);
    }

    // Attach template sub-steps + user names + linked IPC criteria.
    // Each step gets its own copy of linkedIPC[] with recordedTestId / status
    // resolved against the deterministic sample_number for that exec id.
    return executions.map((exec: any) => {
      // Phase 14 — IPC links keyed by bomStepId (BOM-level), not templateId.
      const baseLinks = exec.bomStepId ? (linkedIPCMapByBomStep[exec.bomStepId] || []) : [];
      const linkedIPC = baseLinks.map((link: any) => {
        const key = `SOP-${exec.id}-IPC-${link.criteriaId}`;
        const found = recordedKey.get(key);
        return {
          ...link,
          recordedTestId: found?.id ?? null,
          recordedStatus: found?.status ?? null,
          recordedSamples: found?.samples ?? [],
          recordedTestedBy: found?.testedBy ?? null,
          recordedTestedByName: found?.testedBy ? (userMap.get(found.testedBy) || null) : null,
          recordedTestDate: found?.testDate ?? null,
          recordedAcceptanceStages: found?.acceptanceStages ?? null,
          recordedRetestRound: found?.retestRound ?? null,
          recordedRetestReason: found?.retestReason ?? null,
        };
      });

      return {
        ...exec,
        operatorName: exec.operatorId ? (userMap.get(exec.operatorId) || null) : null,
        verifierName: exec.verifierId ? (userMap.get(exec.verifierId) || null) : null,
        templateSteps: exec.templateId ? (templateStepsMap[exec.templateId] || []) : [],
        // Template-level GMP document — shown at the step header.
        templateGmpDocumentId: exec.templateId ? (templateGmpDocMap[exec.templateId] ?? null) : null,
        linkedIPC,
      };
    });
  });
}

/**
 * Initialize / sync WO SOP execution rows from current BOM SOP steps.
 *
 * Idempotent: existing rows are preserved (so operator progress isn't lost).
 * Only BOM steps that don't yet have a corresponding wo_sop_execution row
 * are inserted. Safe to re-run after BOM is edited (e.g. a packaging SOP
 * step added after the WO was first initialized).
 */
export async function initializeWOSOPExecution(workOrderId: number, bomId: number) {
  const tables = getTables();

  return executeDbOperation(async (db: any) => {
    // Get BOM SOP steps
    const bomSteps = await db
      .select()
      .from(tables.bomSOPSteps)
      .where(eq(tables.bomSOPSteps.bomId, bomId))
      .orderBy(asc(tables.bomSOPSteps.sequence));

    // Existing executions for this WO — keyed by bom_step_id so we can
    // detect which BOM steps still need a wo_sop_execution row.
    const existing = await db
      .select({ bomStepId: tables.woSOPExecution.bomStepId })
      .from(tables.woSOPExecution)
      .where(eq(tables.woSOPExecution.workOrderId, workOrderId));
    const existingStepIds = new Set<number>(existing.map((e: any) => e.bomStepId));

    const inserted = [];
    for (const step of bomSteps) {
      if (existingStepIds.has(step.id)) continue; // already initialized

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
        inserted.push(execution);
      } else {
        const result = await db.insert(tables.woSOPExecution).values(values);
        const insertId = getInsertId(result);
        const [execution] = await db.select().from(tables.woSOPExecution).where(eq(tables.woSOPExecution.id, insertId));
        inserted.push(execution);
      }
    }

    return inserted;
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

/**
 * Audit #16 — Production Manager approval for CRITICAL SOP steps.
 *
 * Required after operator + verifier have signed off. PM MUST be a different
 * user from both. Fails if step is not marked critical (no double-signoff
 * needed for non-critical steps).
 */
export async function pmApproveWOSOPStep(executionId: number, pmUserId: number) {
  const tables = getTables();

  const [existingStep] = await executeDbOperation(async (db: any) => {
    return db
      .select({
        operatorId: tables.woSOPExecution.operatorId,
        verifierId: tables.woSOPExecution.verifierId,
        bomStepId: tables.woSOPExecution.bomStepId,
        status: tables.woSOPExecution.status,
      })
      .from(tables.woSOPExecution)
      .where(eq(tables.woSOPExecution.id, executionId));
  });

  if (!existingStep) throw new Error('SOP execution not found');
  if (existingStep.status !== 'verified') {
    throw new Error('STEP_NOT_VERIFIED: Step must be verified before PM approval');
  }

  // Check BOM step criticality
  const [bomStep] = await executeDbOperation(async (db: any) => {
    return db
      .select({ isCritical: tables.bomSOPSteps.isCritical })
      .from(tables.bomSOPSteps)
      .where(eq(tables.bomSOPSteps.id, existingStep.bomStepId));
  });
  if (!bomStep?.isCritical) {
    throw new Error('STEP_NOT_CRITICAL: PM approval is only required for critical steps');
  }

  // Triple Independence: PM != operator AND PM != verifier
  if (Number(existingStep.operatorId) === pmUserId) {
    throw new Error('PM_SAME_AS_OPERATOR: Production Manager must be different from the operator');
  }
  if (Number(existingStep.verifierId) === pmUserId) {
    throw new Error('PM_SAME_AS_VERIFIER: Production Manager must be different from the verifier');
  }

  return executeDbOperation(async (db: any) => {
    const updateData = {
      pmApprovedBy: pmUserId,
      pmApprovedAt: getNow(),
      updatedAt: getNow(),
    };
    if (isSqlite()) {
      const [execution] = await db
        .update(tables.woSOPExecution)
        .set(updateData)
        .where(eq(tables.woSOPExecution.id, executionId))
        .returning();
      return execution;
    } else {
      await db
        .update(tables.woSOPExecution)
        .set(updateData)
        .where(eq(tables.woSOPExecution.id, executionId));
      const [execution] = await db
        .select()
        .from(tables.woSOPExecution)
        .where(eq(tables.woSOPExecution.id, executionId));
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
  // Feature 021: scale verification gate
  scaleId?: number;
  /**
   * When true (default), the system enforces a valid scale verification
   * within `verificationIntervalHours` before allowing the weighing.
   * Set to false only for non-scale items (e.g. water).
   */
  requireScaleVerification?: boolean;
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
        // 3-level unit conversion (PU → SU → WU)
        weightUnit: tables.items.weightUnit,
        secondaryToWeightRate: tables.items.secondaryToWeightRate,
        weightTrackingEnabled: tables.items.weightTrackingEnabled,
        // SU actually deducted at requisition approve (Step 2)
        issuedQtySU: tables.workOrderMaterials.issuedQty,
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

  // Audit #11 — reject empty/non-positive weighings. The UI defaults
  // weighedQty to 0 on a fresh dialog (no longer to BOM planned qty), so any
  // record with qty<=0 reaching the service is an attempt to bypass weighing.
  const qty = Number(data.weighedQty);
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error(
      'INVALID_WEIGHED_QTY: weighedQty must be a positive number — operator must read the actual value from the scale',
    );
  }

  // Feature 021 — Scale verification gate
  // Default: require verification when scaleId is provided.
  // Skip when caller explicitly opts out (e.g. water materials).
  let resolvedVerificationId: number | undefined = undefined;
  let weighedAfterExpiry = false;

  if (data.scaleId && data.requireScaleVerification !== false) {
    const { getCurrentVerificationForScale } = await import('./scale-verification.service');
    const verification = await getCurrentVerificationForScale(data.scaleId);
    if (!verification) {
      const { ScaleVerificationError, SCALE_VERIFICATION_ERROR_CODES } = await import(
        '@/types/scale-verification'
      );
      throw new ScaleVerificationError(
        SCALE_VERIFICATION_ERROR_CODES.VERIFICATION_REQUIRED,
        'Scale must be verified with a certified standard weight before weighing',
        { scaleId: data.scaleId },
      );
    }
    // verification.validUntil is enforced by getCurrentVerificationForScale,
    // so a returned record is guaranteed to be a current passing verification.
    // (If a verification expires mid-session per FR-016, the caller may still
    // pass requireScaleVerification=false on the trailing items with
    // weighedAfterExpiry set in callers' update.)
    resolvedVerificationId = verification.id;
  }

  // Record the weighing data only — inventory deduction happens at Verify step
  const updateData: Record<string, any> = {
    weighedQty: data.weighedQty,
    weighedBy: data.weighedBy,
    weighedAt: getNow(),
    waterDate: data.waterDate,
    waterConductivity: data.waterConductivity,
    waterTemperature: data.waterTemperature,
  };

  if (data.scaleId) updateData.scaleId = data.scaleId;
  if (resolvedVerificationId) updateData.scaleVerificationId = resolvedVerificationId;
  if (weighedAfterExpiry) updateData.weighedAfterExpiry = true;

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
  sampleWeights: string; // JSON array of GROSS weights (incl. container)
  /**
   * Audit #3/#19 — Tare weight (เปล่า) of the container/packaging.
   * If provided (>0), pass/fail is evaluated against NET = gross - tare for
   * each sample. BOM weightMin/weightMax represent fill weight (NET).
   * Defaults to 0 for backwards compatibility (samples are treated as net).
   */
  tareWeight?: number;
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

    // Parse weights and calculate failures.
    // Audit #3/#19 — subtract tare so we compare NET fill weight vs spec.
    const grossWeights: number[] = JSON.parse(data.sampleWeights);
    const tare = Number(data.tareWeight) > 0 ? Number(data.tareWeight) : 0;
    const netWeights = grossWeights.map((w) => Math.max(0, w - tare));
    const failedCount = netWeights.filter((w) => w < weightMin || w > weightMax).length;
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
  _tareWeight: number = 0,
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

    // Recalculate pass/fail (Audit #3/#19 — apply tare on update too).
    const grossWeights: number[] = JSON.parse(sampleWeights);
    const tareForUpdate = Number(_tareWeight) > 0 ? Number(_tareWeight) : 0;
    const netWeights = grossWeights.map((w) => Math.max(0, w - tareForUpdate));
    const failedCount = netWeights.filter((w) => w < weightMin || w > weightMax).length;
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
    // Audit #7/#22 — independent inspection check: Inspector MUST be a
    // different user from the Sampler. Enforce as soon as inspectorId is set.
    if (inspectorId) {
      const [existing] = await db
        .select({ samplerId: tables.woFinishedInspection.samplerId })
        .from(tables.woFinishedInspection)
        .where(eq(tables.woFinishedInspection.id, inspectionId));
      if (existing && Number(existing.samplerId) === Number(inspectorId)) {
        throw new Error(
          'SAMPLER_INSPECTOR_SAME: Inspector must be a different user from the Sampler (GMP independent check)',
        );
      }
    }

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
        // Phase: drives per-phase IPC cards on Execution Dashboard
        phase: tables.bomInProcessQC.phase,
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

    // Build the set of valid sample numbers from the *current* BOM IPC config.
    // initializeWOIPCTests keys each quality_test row by `IPC-${sequence}`, so
    // when BOM criteria are added/removed/reordered the older sequence numbers
    // become orphans in the DB. Filter them out at read-time rather than
    // deleting (preserves audit trail) so the page only shows the live set.
    const [wo] = await db
      .select({ bomId: tables.workOrders.bomId })
      .from(tables.workOrders)
      .where(eq(tables.workOrders.id, workOrderId));
    let validSampleNumbers: Set<string> | null = null;
    if (wo?.bomId) {
      const ipcConfig = await getBOMIPCConfig(wo.bomId);
      if (ipcConfig.length > 0) {
        validSampleNumbers = new Set(
          ipcConfig.map((c: { sequence?: number | null }, i: number) =>
            `IPC-${c.sequence || (i + 1)}`,
          ),
        );
      }
    }

    // Get quality_tests with testType = 'in_process' for these lots
    const tests = await db
      .select({
        id: tables.qualityTests.id,
        lotId: tables.qualityTests.lotId,
        specId: tables.qualityTests.specId,
        // Soft FK to ipc_criteria.id. Null for legacy rows seeded before this column.
        ipcCriteriaId: tables.qualityTests.ipcCriteriaId,
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
        // IPC phase snapshot — drives per-phase dashboard cards
        ipcPhase: tables.qualityTests.ipcPhase,
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

    // Drop orphaned rows whose sample_number is no longer present in the
    // current BOM IPC config (see comment at top of this function). When the
    // BOM is empty/missing we leave the data untouched so a misconfigured WO
    // doesn't silently show an empty list.
    const filteredTests = validSampleNumbers
      ? tests.filter((t: { sampleNumber: string | null }) =>
          t.sampleNumber != null && validSampleNumbers!.has(t.sampleNumber),
        )
      : tests;

    // Two-way IPC sync (Bug 2 fix):
    //   Same criterion can be recorded via SOP execution (sample_number
    //   'SOP-X-IPC-Y') OR via this /ipc page (sample_number 'IPC-N'). Operator
    //   should NOT have to record twice. Fetch sibling SOP records for the
    //   same lot+criteria so the UI can surface "already recorded via SOP"
    //   and skip the form.
    const { like, inArray } = await import('drizzle-orm');
    const sopRecords: any[] = await db
      .select({
        id: tables.qualityTests.id,
        ipcCriteriaId: tables.qualityTests.ipcCriteriaId,
        sampleNumber: tables.qualityTests.sampleNumber,
        status: tables.qualityTests.status,
        testedBy: tables.qualityTests.testedBy,
        testDate: tables.qualityTests.testDate,
        result: tables.qualityTests.result,
        approvedBy: tables.qualityTests.approvedBy,
        approvedAt: tables.qualityTests.approvedAt,
      })
      .from(tables.qualityTests)
      .where(and(
        eq(tables.qualityTests.lotId, lotIds[0]),
        eq(tables.qualityTests.testType, 'in_process'),
        like(tables.qualityTests.sampleNumber, 'SOP-%-IPC-%'),
      ));
    const sopByCriteriaId = new Map<number, any>();
    for (const r of sopRecords) {
      // criteriaId precedence: explicit FK column → parsed from sample_number
      // ('SOP-{exec}-IPC-{criteriaId}'). Legacy rows lack the FK so the parse
      // path is the only way they get matched.
      let cid = r.ipcCriteriaId as number | null;
      if (cid == null && typeof r.sampleNumber === 'string') {
        const m = r.sampleNumber.match(/^SOP-[^-]+-IPC-(\d+)$/);
        if (m) cid = Number(m[1]);
      }
      if (cid == null || Number.isNaN(cid)) continue;
      const isRecorded = r.testedBy != null || (r.status && r.status !== 'pending');
      const existing = sopByCriteriaId.get(cid);
      if (!existing) {
        sopByCriteriaId.set(cid, r);
      } else if (isRecorded && existing.testedBy == null && (existing.status === 'pending' || !existing.status)) {
        sopByCriteriaId.set(cid, r);
      }
    }

    // Collect user IDs for name resolution
    const userIds = new Set<number>();
    for (const t of filteredTests) {
      if (t.testedBy) userIds.add(t.testedBy);
      if (t.approvedBy) userIds.add(t.approvedBy);
    }
    for (const r of sopByCriteriaId.values()) {
      if (r.testedBy) userIds.add(r.testedBy);
    }

    // Resolve user names
    let userMap = new Map<number, string>();
    if (userIds.size > 0) {
      const users = await db
        .select({ id: tables.users.id, name: tables.users.name })
        .from(tables.users)
        .where(inArray(tables.users.id, [...userIds]));
      for (const u of users) userMap.set(u.id, u.name);
    }

    // Resolve criteria names from ipc_criteria table — used as the primary
    // testName when the test's snapshot fields don't have a readable label.
    // Avoids "IPC-IPC-1" / JSON-envelope display on rows missing notes.
    const criteriaIds = new Set<number>();
    for (const t of filteredTests) {
      if (t.ipcCriteriaId) criteriaIds.add(t.ipcCriteriaId);
    }
    const criteriaNameMap = new Map<number, string>();
    if (criteriaIds.size > 0) {
      const ipcCriteriaTable = getTableRef('iPCCriteria');
      const crits = await db
        .select({
          id: (ipcCriteriaTable as any).id,
          name: (ipcCriteriaTable as any).name,
          nameTh: (ipcCriteriaTable as any).nameTh,
        })
        .from(ipcCriteriaTable as any)
        .where(inArray((ipcCriteriaTable as any).id, [...criteriaIds]));
      for (const c of crits as any[]) {
        criteriaNameMap.set(c.id, c.nameTh || c.name || '');
      }
    }

    // Get samples for each test + resolve testName + user names + group by round
    const testsWithSamples = await Promise.all(
      filteredTests.map(async (test: any) => {
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

        // SOP sibling (Bug 2 two-way sync) — if this criterion was recorded
        // via SOP execution, attach a hint so the UI can render a read-only
        // "already recorded" panel and skip the form.
        const sopSibling = test.ipcCriteriaId != null ? sopByCriteriaId.get(test.ipcCriteriaId) : null;
        const sopHint = sopSibling && (sopSibling.testedBy != null || (sopSibling.status && sopSibling.status !== 'pending'))
          ? (() => {
              // sample_number format: 'SOP-{stepNumber}-IPC-{seq}'
              const m = typeof sopSibling.sampleNumber === 'string'
                ? sopSibling.sampleNumber.match(/^SOP-([^-]+)-IPC-/)
                : null;
              return {
                sopRecordedTestId: sopSibling.id as number,
                sopRecordedAt: sopSibling.testDate as Date | string | null,
                sopRecordedBy: sopSibling.testedBy as number | null,
                sopRecordedByName: sopSibling.testedBy ? (userMap.get(sopSibling.testedBy) || null) : null,
                sopRecordedResult: sopSibling.result as string | null,
                sopRecordedStatus: sopSibling.status as string | null,
                sopStepNumber: m ? m[1] : null,
              };
            })()
          : null;

        // testName fallback: prefer ipc_criteria.nameTh/name (resolved via
        // ipcCriteriaId). Never use specSpecification (now stored as JSON
        // envelope — would leak raw JSON to operators).
        const safeSpec = test.specSpecification && typeof test.specSpecification === 'string' && !test.specSpecification.trim().startsWith('{')
          ? test.specSpecification
          : null;
        const criteriaName = test.ipcCriteriaId ? criteriaNameMap.get(test.ipcCriteriaId) : null;
        return {
          ...test,
          testName: test.testName || criteriaName || test.notes || safeSpec || `IPC-${test.sampleNumber || test.id}`,
          testedByName: test.testedBy ? (userMap.get(test.testedBy) || null) : null,
          approvedByName: test.approvedBy ? (userMap.get(test.approvedBy) || null) : null,
          samples,
          rounds,
          totalRounds: maxRound,
          ...(sopHint || {}),
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
/**
 * Phase 7a — auto-create deviation for a SOP-linked IPC test that failed.
 *
 * Idempotent on (sourceType='production', sourceId=qualityTestId): if a
 * deviation already exists for the same test we return its info instead of
 * creating another. WO resolution prefers the deterministic
 * sopExecutionId → wo_sop_execution.work_order_id path; falls back to the
 * lot.batchNumber → work_orders.batch_number match used by the legacy IPC
 * flow when the sample number doesn't follow the SOP-{execId}-IPC-{cid}
 * convention.
 */
/**
 * Resolve max retest rounds for a given criteria (FDA OOS 2006 / PIC/S).
 *
 * Priority:
 *  1. Critical criteria → forced 0 (deviation immediately on round 1 fail)
 *  2. Master ipc_criteria.maxRetestRounds (default 1)
 *
 * Future: BOM-level override (bom_in_process_qc.maxRetestRounds) and
 * SOP-step override (sop_template_ipc_criteria.maxRetestRounds) — schema
 * columns exist but resolution path adds complexity; defer until needed.
 */
function resolveMaxRetestRounds(criteria: {
  isCritical?: boolean | number | null;
  maxRetestRounds?: number | null;
}): number {
  if (criteria.isCritical) return 0;
  const v = criteria.maxRetestRounds;
  if (v == null) return 1;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 1;
}

async function ensureDeviationForFailedSOPIPC(
  db: any,
  tables: ReturnType<typeof getTables>,
  params: {
    qualityTestId: number;
    sopExecutionId: number;
    operatorId: number;
    testRound?: number;
    /** Operator-supplied description (overrides auto-generated template). */
    reason?: string | null;
    /** Override severity (defaults to 'minor'). */
    severity?: 'minor' | 'major' | 'critical' | null;
  },
): Promise<{ id: number; deviationNumber: string } | null> {
  try {
    const deviationsTable = getTableRef('deviations');

    // Skip if a deviation for this test already exists. We treat
    // (sourceType, sourceId) as the dedup key — recordSOPLinkedIPCResults is
    // idempotent so re-saving a fail must not create another deviation.
    const existing = await db
      .select({ id: deviationsTable.id, deviationNumber: deviationsTable.deviationNumber })
      .from(deviationsTable)
      .where(and(
        eq(deviationsTable.sourceType, 'production'),
        eq(deviationsTable.sourceId, params.qualityTestId),
      ))
      .limit(1);
    if (existing.length > 0) {
      return { id: existing[0].id, deviationNumber: existing[0].deviationNumber };
    }

    // Quality test snapshot for descriptive fields.
    const [test] = await db
      .select({
        lotId: tables.qualityTests.lotId,
        sampleNumber: tables.qualityTests.sampleNumber,
        notes: tables.qualityTests.notes,
        specSpecification: tables.qualityTests.specSpecification,
        ipcPhase: tables.qualityTests.ipcPhase,
      })
      .from(tables.qualityTests)
      .where(eq(tables.qualityTests.id, params.qualityTestId));
    if (!test) return null;

    // Resolve workOrderId — prefer SOP execution lookup (deterministic).
    let workOrderId: number | null = null;
    const [exec] = await db
      .select({ workOrderId: tables.woSOPExecution.workOrderId })
      .from(tables.woSOPExecution)
      .where(eq(tables.woSOPExecution.id, params.sopExecutionId))
      .limit(1);
    if (exec?.workOrderId) {
      workOrderId = Number(exec.workOrderId);
    } else if (test.lotId) {
      // Fall back to batch matching for non-SOP tests (legacy path).
      const [lot] = await db
        .select({ batchNumber: tables.inventoryLots.batchNumber })
        .from(tables.inventoryLots)
        .where(eq(tables.inventoryLots.id, test.lotId));
      if (lot?.batchNumber) {
        const [wo] = await db
          .select({ id: tables.workOrders.id })
          .from(tables.workOrders)
          .where(eq(tables.workOrders.batchNumber, lot.batchNumber));
        if (wo) workOrderId = Number(wo.id);
      }
    }

    const year = new Date().getFullYear();
    const seq = String(Math.floor(Math.random() * 9000) + 1000);
    const deviationNumber = `DEV-${year}-${seq}`;
    const phaseLabel = test.ipcPhase ? ` [${test.ipcPhase}]` : '';
    const roundLabel = params.testRound ? ` (Round ${params.testRound})` : '';

    // Compose description: prefer operator's reason (with auto context as
    // suffix for traceability) when provided. Falls back to the template
    // when the trigger fired without a UI prompt (e.g. legacy clients).
    const autoContext = `In-Process Control test failed during SOP execution${roundLabel}. Spec: ${test.specSpecification || 'n/a'}.`;
    const operatorReason = (params.reason || '').trim();
    const description = operatorReason
      ? `${operatorReason}\n\n— ${autoContext}`
      : `${autoContext} Auto-generated when operator recorded failing samples on the SOP step.`;

    const validSeverities = new Set(['minor', 'major', 'critical']);
    const severity = params.severity && validSeverities.has(params.severity) ? params.severity : 'minor';

    const result = await db.insert(deviationsTable).values({
      deviationNumber,
      title: `IPC Failure — ${test.notes || test.sampleNumber || 'Unknown test'}${phaseLabel}`,
      description,
      type: 'OOS',
      sourceType: 'production',
      sourceId: params.qualityTestId,
      lotId: test.lotId,
      workOrderId,
      severity,
      status: 'open',
      reportedBy: params.operatorId,
      reportedAt: getNow(),
      createdAt: getNow(),
      updatedAt: getNow(),
    });
    const id = Number(getInsertId(result));
    return { id, deviationNumber };
  } catch (err) {
    console.error('[ipc] Failed to auto-create deviation for SOP-linked IPC fail:', err);
    return null;
  }
}

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
    if (ipcConfig.length === 0) return { created: [], rephased: 0 };

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

    // Existing IPC tests for this WO's lot, keyed by sample_number ("IPC-1",
    // "IPC-2", …). Idempotent sync: if a sample_number is already present,
    // we skip creation so operator results aren't reset. Old tests with
    // ipc_phase=NULL are also backfilled here when we know the phase from
    // the matching BOM config sequence.
    const existingTests = await db
      .select({
        id: tables.qualityTests.id,
        sampleNumber: tables.qualityTests.sampleNumber,
        ipcPhase: tables.qualityTests.ipcPhase,
        status: tables.qualityTests.status,
        ipcCriteriaId: tables.qualityTests.ipcCriteriaId,
      })
      .from(tables.qualityTests)
      .where(
        and(
          eq(tables.qualityTests.lotId, targetLotId),
          eq(tables.qualityTests.testType, 'in_process')
        )
      );
    const existingByNumber = new Map<
      string,
      { id: number; ipcPhase: string | null; status: string | null; ipcCriteriaId: number | null }
    >(
      existingTests
        .filter((t: any) => t.sampleNumber)
        .map((t: any) => [
          t.sampleNumber as string,
          { id: t.id, ipcPhase: t.ipcPhase, status: t.status, ipcCriteriaId: t.ipcCriteriaId ?? null },
        ])
    );

    // Create quality_tests for each BOM IPC criteria
    const created = [];
    // Count of existing tests whose ipc_phase was re-synced to the current BOM
    // config (so callers can refetch the dashboard even when nothing was newly
    // inserted — e.g. an admin edited a criteria's phase after WO init).
    let rephased = 0;
    for (let i = 0; i < ipcConfig.length; i++) {
      const config = ipcConfig[i];
      const sampleNumber = `IPC-${config.sequence || (i + 1)}`;
      const phaseFromConfig = config.phase || 'production';

      // Already exists — re-sync its phase to the current BOM config, then skip
      // creation so operator results aren't reset. A *pending* test (not yet
      // recorded) tracks BOM phase edits; a test with results stays frozen for
      // GMP integrity (its phase is only backfilled when previously NULL).
      const existingForThisCriteria = existingByNumber.get(sampleNumber);
      if (existingForThisCriteria) {
        const isPending = existingForThisCriteria.status === 'pending';
        const phaseChanged = existingForThisCriteria.ipcPhase !== phaseFromConfig;
        const shouldResync =
          existingForThisCriteria.ipcPhase == null || (isPending && phaseChanged);
        // Backfill the ipc_criteria soft-FK on legacy rows that predate the
        // column — the WO IPC tab needs it to route new-type criteria to the
        // recorder panel (otherwise they fall through to an unusable card).
        const needsCriteriaBackfill =
          existingForThisCriteria.ipcCriteriaId == null && config.criteriaId != null;
        if (shouldResync || needsCriteriaBackfill) {
          const patch: Record<string, unknown> = { updatedAt: getNow() };
          if (shouldResync) patch.ipcPhase = phaseFromConfig;
          if (needsCriteriaBackfill) patch.ipcCriteriaId = config.criteriaId ?? null;
          await db
            .update(tables.qualityTests)
            .set(patch)
            .where(eq(tables.qualityTests.id, existingForThisCriteria.id));
          if (shouldResync) rephased++;
        }
        continue;
      }

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
        // Soft FK so WO IPC tab can route new-type tests to recording_rounds path.
        ipcCriteriaId: config.criteriaId,
        testType: 'in_process',
        sampleNumber,
        sampleSize: config.sampleSize,
        status: 'pending',
        requestedBy: operatorId,
        requestedAt: getNow(),
        // Snapshot criteria values. Coerce every nullable column to explicit
        // null (never undefined) — a mix desynchronises the MySQL prepared-
        // statement bind count ("Bind parameters count mismatch"). See the
        // matching note in recordSOPIPCTests.
        specMinValue: effectiveMin ?? null,
        specMaxValue: effectiveMax ?? null,
        specSpecification: config.specification ?? config.testName ?? null,
        specUnit: config.unit ?? null,
        criteriaType: config.criteriaType || 'numeric',
        tolerancePercent: Number(config.tolerancePercent) || 0,
        specTarget: specTargetNum ?? null,
        specTolerancePercent: specTolPctNum ?? null,
        // Phase 3: snapshot multi-stage plan so subsequent edits to the criteria
        // can't change the plan that's already in flight on this work order.
        acceptanceStages: typeof config.acceptanceStages === 'string'
          ? config.acceptanceStages
          : (config.acceptanceStages ? JSON.stringify(config.acceptanceStages) : null),
        // Snapshot phase from BOM IPC config — frozen at init so subsequent
        // BOM edits don't reshuffle which dashboard card hosts this test.
        ipcPhase: phaseFromConfig ?? null,
        notes: (config.testNameTh || config.testName) ?? null,
        createdAt: getNow(),
        updatedAt: getNow(),
      });
      created.push({ id: getInsertId(testResult), criteriaId: config.criteriaId, testName: config.testName });
    }

    return { created, rephased };
  });
}

/**
 * Inline IPC capture for SOP-template-linked criteria.
 *
 * When operator completes a SOP step that has IPC criteria attached at the
 * master template level (sop_template_ipc_criteria), the recording happens
 * inside the same Complete dialog. This creates the corresponding
 * quality_test + ipc_test_samples rows on the fly — those tests are not
 * pre-initialised by initializeWOIPCTests because that function only seeds
 * tests from bom_in_process_qc, not from SOP template links.
 *
 * Each invocation is idempotent at the (workOrder, criteria, sopExecution)
 * tuple — repeat submissions update an existing row rather than duplicating.
 */
export interface SOPLinkedIPCInput {
  criteriaId: number;
  sopExecutionId: number;
  ipcPhase: string;
  /** Numeric values (one per sample) for criteriaType=numeric. */
  numericValues?: (number | null)[];
  /** Sample-level pass/fail for criteriaType=pass_fail / visual / checkbox. */
  sampleResults?: ('pass' | 'fail' | null)[];
  /** Free text response for criteriaType=text. */
  textValue?: string | null;
  notes?: string | null;
  /**
   * Reason for this retest round (FDA OOS 2006). Required on round 2+.
   *  - 'justified': sampling/instrument issue identified — keeps retest window open
   *  - 'unjustified': no clear cause — forces deviation immediately
   * Ignored on round 1.
   */
  retestReason?: 'justified' | 'unjustified' | null;
  /**
   * Inline Deviation reason captured when this save will trigger a Deviation
   * (Critical fail on round 1, Unjustified retest, final-round fail).
   * If null, the auto-generated template description is used. Required by
   * the UI when the trigger conditions are visible to the operator.
   */
  deviationReason?: string | null;
  /** Override severity when creating the auto-deviation. Defaults to 'minor'. */
  deviationSeverity?: 'minor' | 'major' | 'critical' | null;
}

export interface SOPIPCRecordResult {
  qualityTestIds: number[];
  /** Auto-created deviations triggered by failing tests. Empty when all pass. */
  deviations: Array<{
    qualityTestId: number;
    deviationId: number;
    deviationNumber: string;
  }>;
}

export async function recordSOPLinkedIPCResults(
  workOrderId: number,
  operatorId: number,
  inputs: SOPLinkedIPCInput[]
): Promise<SOPIPCRecordResult> {
  const tables = getTables();

  return executeDbOperation(async (db: any) => {
    if (inputs.length === 0) return { qualityTestIds: [], deviations: [] };

    const deviationsCreated: SOPIPCRecordResult['deviations'] = [];

    // Resolve target lot (auto-create if missing — same logic as
    // initializeWOIPCTests so SOP-linked tests share the in-process lot).
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

    if (!wo) throw new Error('Work order not found');

    let targetLotId: number | null = null;
    if (wo.batchNumber) {
      const lots = await db
        .select({ id: tables.inventoryLots.id })
        .from(tables.inventoryLots)
        .where(eq(tables.inventoryLots.batchNumber, wo.batchNumber));
      if (lots.length > 0) targetLotId = lots[0].id;
    }
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

    const ipcCriteriaTable = getTableRef('iPCCriteria');
    const created: number[] = [];

    for (const input of inputs) {
      // Look up criteria spec snapshot.
      const [criteria] = await db
        .select()
        .from(ipcCriteriaTable)
        .where(eq(ipcCriteriaTable.id, input.criteriaId))
        .limit(1);
      if (!criteria) throw new Error(`IPC criteria ${input.criteriaId} not found`);

      // Determine effective min/max via spec target if present.
      let effectiveMin = criteria.minValue;
      let effectiveMax = criteria.maxValue;
      const specTargetNum = criteria.specTarget !== null && criteria.specTarget !== undefined
        ? Number(criteria.specTarget)
        : null;
      const specTolPctNum = Number(criteria.specTolerancePercent) || 0;
      if (specTargetNum !== null && !Number.isNaN(specTargetNum)) {
        const calc = calculateMinMax(specTargetNum, specTolPctNum);
        if (calc) {
          effectiveMin = calc.min;
          effectiveMax = calc.max;
        }
      }

      // Compute per-sample results + overall test result.
      const tolPct = Number(criteria.tolerancePercent) || 0;
      const criteriaType = criteria.criteriaType || 'numeric';
      const samples: Array<{
        sampleNumber: number;
        numericValue: number | null;
        textValue: string | null;
        result: 'pass' | 'fail' | 'pending';
      }> = [];

      if (criteriaType === 'numeric') {
        const values = input.numericValues || [];
        values.forEach((v, idx) => {
          let res: 'pass' | 'fail' | 'pending' = 'pending';
          if (v != null && !Number.isNaN(v)) {
            const minOk = effectiveMin == null || v >= Number(effectiveMin);
            const maxOk = effectiveMax == null || v <= Number(effectiveMax);
            res = minOk && maxOk ? 'pass' : 'fail';
          }
          samples.push({
            sampleNumber: idx + 1,
            numericValue: v != null ? Number(v) : null,
            textValue: null,
            result: res,
          });
        });
      } else if (criteriaType === 'text') {
        // Single sample row holding the operator's text. Pass by default
        // unless the operator marks it failing via sampleResults[0].
        const text = input.textValue ?? null;
        const res = input.sampleResults?.[0] ?? (text ? 'pass' : 'pending');
        samples.push({
          sampleNumber: 1,
          numericValue: null,
          textValue: text,
          result: res === null ? 'pending' : res,
        });
      } else {
        // pass_fail / visual / checkbox — driven by sampleResults[].
        const results = input.sampleResults || [];
        results.forEach((r, idx) => {
          samples.push({
            sampleNumber: idx + 1,
            numericValue: null,
            textValue: null,
            result: r === null ? 'pending' : r,
          });
        });
      }

      // Overall test status from sample failures + tolerance.
      const total = samples.length;
      const failCount = samples.filter((s) => s.result === 'fail').length;
      const pendingCount = samples.filter((s) => s.result === 'pending').length;
      let testStatus: 'pending' | 'pass' | 'fail' = 'pending';
      if (total > 0 && pendingCount === 0) {
        const failPct = total === 0 ? 0 : (failCount / total) * 100;
        testStatus = failPct > tolPct ? 'fail' : 'pass';
      }

      // Idempotent upsert: when the operator saves IPC standalone (Phase 4)
      // they may resave the same step's tests multiple times before
      // completing it. Match the existing row by its deterministic
      // sample_number — UPDATE in place, otherwise INSERT.
      const sampleNumber = `SOP-${input.sopExecutionId}-IPC-${input.criteriaId}`;
      const existingTest = await db
        .select({ id: tables.qualityTests.id })
        .from(tables.qualityTests)
        .where(and(
          eq(tables.qualityTests.lotId, targetLotId),
          eq(tables.qualityTests.testType, 'in_process'),
          eq(tables.qualityTests.sampleNumber, sampleNumber),
        ))
        .limit(1);

      let qualityTestId: number;
      // Every nullable column is coerced to an explicit `null` (never left as
      // `undefined`). A mix of `undefined` and present values makes Drizzle emit
      // a column list where some columns become DEFAULT and others a bound `?`,
      // which desynchronises the MySQL prepared-statement bind count and throws
      // "Bind parameters count mismatch" on INSERT. Coercing to null keeps one
      // placeholder per column. This was the root cause of the IPC save failure.
      const sharedFields = {
        sampleSize: total || 1,
        status: testStatus,
        result: testStatus === 'pending' ? null : testStatus,
        testedBy: testStatus === 'pending' ? null : operatorId,
        testDate: testStatus === 'pending' ? null : getNow(),
        specMinValue: effectiveMin ?? null,
        specMaxValue: effectiveMax ?? null,
        specSpecification: criteria.specification ?? criteria.name ?? null,
        specUnit: criteria.unit ?? null,
        criteriaType: criteriaType ?? 'numeric',
        tolerancePercent: tolPct ?? null,
        specTarget: specTargetNum ?? null,
        specTolerancePercent: specTolPctNum ?? null,
        acceptanceStages: typeof criteria.acceptanceStages === 'string'
          ? criteria.acceptanceStages
          : (criteria.acceptanceStages ? JSON.stringify(criteria.acceptanceStages) : null),
        ipcPhase: input.ipcPhase ?? null,
        retestRound: 1, // Round 1 (this function only handles initial recording)
        retestReason: null, // No reason on round 1
        notes: input.notes ?? (criteria.nameTh || criteria.name) ?? null,
        updatedAt: getNow(),
      };

      if (existingTest.length > 0) {
        qualityTestId = Number(existingTest[0].id);
        await db
          .update(tables.qualityTests)
          .set(sharedFields)
          .where(eq(tables.qualityTests.id, qualityTestId));
        // Replace prior samples — operator may have changed values.
        await db
          .delete(tables.ipcTestSamples)
          .where(eq(tables.ipcTestSamples.qualityTestId, qualityTestId));
      } else {
        const insertRes = await db.insert(tables.qualityTests).values({
          lotId: targetLotId,
          testType: 'in_process',
          sampleNumber,
          ipcCriteriaId: input.criteriaId,
          requestedBy: operatorId,
          requestedAt: getNow(),
          createdAt: getNow(),
          ...sharedFields,
        });
        qualityTestId = Number(getInsertId(insertRes));
      }
      created.push(qualityTestId);

      // Insert sample rows.
      for (const s of samples) {
        await db.insert(tables.ipcTestSamples).values({
          qualityTestId,
          sampleNumber: s.sampleNumber,
          testRound: 1,
          numericValue: s.numericValue,
          textValue: s.textValue,
          result: s.result,
          createdAt: getNow(),
        });
      }

      // Phase 7a + retest gate — create deviation ONLY when round 1 fail
      // exhausts the configured retest budget. Default master = 1 retest
      // allowed (so round 1 fail does NOT auto-create a deviation; operator
      // must record round 2 via addIPCTestRound). Critical criteria force
      // maxRetestRounds = 0 (deviation immediately on round 1 fail) per
      // FDA OOS 2006 guidance.
      if (testStatus === 'fail') {
        const maxRetestRounds = resolveMaxRetestRounds(criteria);
        if (maxRetestRounds === 0) {
          const dev = await ensureDeviationForFailedSOPIPC(db, tables, {
            qualityTestId,
            sopExecutionId: input.sopExecutionId,
            operatorId,
            testRound: 1,
            reason: input.deviationReason ?? null,
            severity: input.deviationSeverity ?? (criteria.isCritical ? 'critical' : 'minor'),
          });
          if (dev) {
            deviationsCreated.push({ qualityTestId, deviationId: dev.id, deviationNumber: dev.deviationNumber });
          }
        }
      }
    }

    return { qualityTestIds: created, deviations: deviationsCreated };
  });
}

/**
 * Phase 6b + Retest Gate — append a new round of IPC samples to an existing test.
 *
 * Two paths share this function:
 *  1. Multi-stage criteria (USP <711>/<905>): drive sampleSize/tolerance from
 *     the stage plan; previous stage must have onFail=next_stage.
 *  2. Single-stage criteria with retest budget (FDA OOS 2006): use the
 *     criteria's default sampleSize/tolerance; retestReason is REQUIRED on
 *     round 2+. Unjustified retest creates deviation immediately.
 *
 * Common validations:
 *   - Existing test must already be present for (sopExecutionId, criteriaId)
 *   - Latest round must be `fail` (no point retesting a passing round)
 */
export async function addIPCTestRound(
  workOrderId: number,
  operatorId: number,
  input: SOPLinkedIPCInput
): Promise<{
  qualityTestId: number;
  round: number;
  testStatus: string;
  deviation: { id: number; deviationNumber: string } | null;
}> {
  const tables = getTables();
  const { parseAcceptanceStages } = await import('../master-data/ipc-stages');

  return executeDbOperation(async (db: any) => {
    // Resolve target lot the same way standalone record does.
    const [wo] = await db
      .select({
        id: tables.workOrders.id,
        batchNumber: tables.workOrders.batchNumber,
      })
      .from(tables.workOrders)
      .where(eq(tables.workOrders.id, workOrderId));
    if (!wo) throw new Error('Work order not found');

    let targetLotId: number | null = null;
    if (wo.batchNumber) {
      const lots = await db
        .select({ id: tables.inventoryLots.id })
        .from(tables.inventoryLots)
        .where(eq(tables.inventoryLots.batchNumber, wo.batchNumber));
      if (lots.length > 0) targetLotId = lots[0].id;
    }
    if (!targetLotId) throw new Error('No matching in-process lot for this work order');

    // Find the existing quality_test.
    const sampleNumber = `SOP-${input.sopExecutionId}-IPC-${input.criteriaId}`;
    const [existing] = await db
      .select()
      .from(tables.qualityTests)
      .where(and(
        eq(tables.qualityTests.lotId, targetLotId),
        eq(tables.qualityTests.testType, 'in_process'),
        eq(tables.qualityTests.sampleNumber, sampleNumber),
      ))
      .limit(1);
    if (!existing) {
      throw new Error('ยังไม่มีการบันทึกรอบแรก — กรุณากดบันทึก IPC เพื่อบันทึกรอบ 1 ก่อน');
    }

    // Existing samples grouped by round to figure out the next round.
    const existingSamples = await db
      .select({
        testRound: tables.ipcTestSamples.testRound,
        result: tables.ipcTestSamples.result,
      })
      .from(tables.ipcTestSamples)
      .where(eq(tables.ipcTestSamples.qualityTestId, existing.id));

    const roundMap = new Map<number, Array<{ result: string | null }>>();
    for (const s of existingSamples as any[]) {
      const r = Number(s.testRound) || 1;
      if (!roundMap.has(r)) roundMap.set(r, []);
      roundMap.get(r)!.push({ result: s.result });
    }
    if (roundMap.size === 0) {
      throw new Error('Existing test has no samples — cannot start a new round');
    }
    const lastRound = Math.max(...roundMap.keys());
    const lastRoundSamples = roundMap.get(lastRound)!;
    const lastRoundFails = lastRoundSamples.filter((s) => s.result === 'fail').length;
    const lastRoundTotal = lastRoundSamples.length;
    const lastRoundFailPct = lastRoundTotal === 0 ? 0 : (lastRoundFails / lastRoundTotal) * 100;

    const stages = parseAcceptanceStages(existing.acceptanceStages);
    const isMultiStage = stages.length > 0;
    const nextRound = lastRound + 1;

    // ----- Branch A: Multi-stage (USP <711>/<905>) -----
    let expectedSize: number;
    let tolPct: number;
    let retestReasonForUpdate: string | null = null;
    let unjustifiedDeviationOverride = false; // forces deviation regardless of pass/fail

    if (isMultiStage) {
      const lastStageIdx = lastRound - 1;
      const lastStage = stages[lastStageIdx];
      if (!lastStage) {
        throw new Error(`Stage ${lastRound} ไม่ได้กำหนดใน acceptance plan`);
      }
      if (lastRoundFailPct <= lastStage.tolerancePercent) {
        throw new Error('รอบก่อนหน้าผ่านแล้ว — ไม่ต้องทำรอบใหม่');
      }
      if (lastStage.onFail !== 'next_stage') {
        throw new Error(`รอบก่อนหน้ากำหนด onFail=${lastStage.onFail} — ไม่อนุญาตให้ retest`);
      }
      const nextStage = stages[nextRound - 1];
      if (!nextStage) {
        throw new Error(`ไม่มี Stage ${nextRound} ใน acceptance plan — สุดทางแล้ว`);
      }
      expectedSize = nextStage.sampleSize;
      tolPct = nextStage.tolerancePercent;
    } else {
      // ----- Branch B: Single-stage retest (FDA OOS 2006) -----
      // Pull master criteria for retest budget + critical flag.
      const ipcCriteriaTable = getTableRef('iPCCriteria');
      const [criteria] = await db
        .select()
        .from(ipcCriteriaTable)
        .where(eq(ipcCriteriaTable.id, input.criteriaId))
        .limit(1);
      if (!criteria) throw new Error(`IPC criteria ${input.criteriaId} not found`);

      // Last round must have failed (otherwise no retest needed).
      if (lastRoundFails === 0) {
        throw new Error('รอบก่อนหน้าไม่มี sample fail — ไม่ต้องทำรอบใหม่');
      }

      // No upstream cap-block: previously we threw "ครบจำนวน retest สูงสุด"
      // before the operator could even submit, which forced a Deviation
      // even when the rerun was going to pass. Per user feedback the
      // budget should only matter for the *result*, not the intent —
      // a passing extra-round result must be saveable without a Deviation.
      // The downstream deviation-creation logic at the end of this fn
      // still creates a Deviation when an over-budget round fails, so
      // FDA OOS 2006 alignment is preserved for the failure path.

      // Round 2+ requires retestReason. Already validated upstream but
      // double-check at the service boundary.
      const reason = input.retestReason;
      if (reason !== 'justified' && reason !== 'unjustified') {
        throw new Error('กรุณาระบุเหตุผลการทดสอบซ้ำ (justified/unjustified)');
      }
      retestReasonForUpdate = reason;
      // Unjustified retest forces deviation per FDA OOS 2006 — record the
      // round but the deviation will be created regardless of result.
      unjustifiedDeviationOverride = reason === 'unjustified';

      expectedSize = Number(criteria.sampleSize) || lastRoundTotal || 1;
      tolPct = Number(criteria.tolerancePercent) || 0;
    }

    // ----- Common: build samples for the new round -----
    const criteriaType = existing.criteriaType || 'numeric';
    const effectiveMin = existing.specMinValue;
    const effectiveMax = existing.specMaxValue;

    const samples: Array<{
      sampleNumber: number;
      numericValue: number | null;
      textValue: string | null;
      result: 'pass' | 'fail' | 'pending';
    }> = [];

    if (criteriaType === 'numeric') {
      const values = (input.numericValues || []).slice(0, expectedSize);
      while (values.length < expectedSize) values.push(null);
      values.forEach((v, idx) => {
        let res: 'pass' | 'fail' | 'pending' = 'pending';
        if (v != null && !Number.isNaN(v)) {
          const minOk = effectiveMin == null || v >= Number(effectiveMin);
          const maxOk = effectiveMax == null || v <= Number(effectiveMax);
          res = minOk && maxOk ? 'pass' : 'fail';
        }
        samples.push({
          sampleNumber: idx + 1,
          numericValue: v != null ? Number(v) : null,
          textValue: null,
          result: res,
        });
      });
    } else if (criteriaType === 'text') {
      const text = input.textValue ?? null;
      const res = input.sampleResults?.[0] ?? (text ? 'pass' : 'pending');
      samples.push({
        sampleNumber: 1,
        numericValue: null,
        textValue: text,
        result: res === null ? 'pending' : res,
      });
    } else {
      const results = (input.sampleResults || []).slice(0, expectedSize);
      while (results.length < expectedSize) results.push(null);
      results.forEach((r, idx) => {
        samples.push({
          sampleNumber: idx + 1,
          numericValue: null,
          textValue: null,
          result: r === null ? 'pending' : r,
        });
      });
    }

    // Compute overall status for this round.
    const total = samples.length;
    const failCount = samples.filter((s) => s.result === 'fail').length;
    const pendingCount = samples.filter((s) => s.result === 'pending').length;
    let testStatus: 'pending' | 'pass' | 'fail' = 'pending';
    if (total > 0 && pendingCount === 0) {
      const failPct = (failCount / total) * 100;
      testStatus = failPct > tolPct ? 'fail' : 'pass';
    }

    // Insert new-round samples (preserve previous rounds).
    for (const s of samples) {
      await db.insert(tables.ipcTestSamples).values({
        qualityTestId: existing.id,
        sampleNumber: s.sampleNumber,
        testRound: nextRound,
        numericValue: s.numericValue,
        textValue: s.textValue,
        result: s.result,
        createdAt: getNow(),
      });
    }

    // Refresh quality_test status to reflect the latest round.
    await db
      .update(tables.qualityTests)
      .set({
        status: testStatus,
        result: testStatus === 'pending' ? null : testStatus,
        sampleSize: total,
        tolerancePercent: tolPct,
        testedBy: testStatus === 'pending' ? null : operatorId,
        testDate: testStatus === 'pending' ? null : getNow(),
        retestRound: nextRound,
        retestReason: retestReasonForUpdate,
        updatedAt: getNow(),
      })
      .where(eq(tables.qualityTests.id, existing.id));

    // Deviation creation logic:
    //  - Multi-stage: keep existing behavior (deviation if final stage fails)
    //  - Single-stage:
    //      * Unjustified retest → deviation immediately (regardless of result)
    //      * Final round failed → deviation
    //      * Otherwise (intermediate retest passed/failed) → no deviation
    let deviation: { id: number; deviationNumber: string } | null = null;
    let shouldCreateDeviation = false;

    if (isMultiStage) {
      shouldCreateDeviation = testStatus === 'fail';
    } else if (unjustifiedDeviationOverride) {
      shouldCreateDeviation = true;
    } else if (testStatus === 'fail') {
      // For single-stage retest: re-resolve the criteria to know the budget.
      const ipcCriteriaTable = getTableRef('iPCCriteria');
      const [criteria] = await db
        .select()
        .from(ipcCriteriaTable)
        .where(eq(ipcCriteriaTable.id, input.criteriaId))
        .limit(1);
      const maxRetestRounds = resolveMaxRetestRounds(criteria);
      const maxRoundsTotal = 1 + maxRetestRounds;
      if (nextRound >= maxRoundsTotal) {
        shouldCreateDeviation = true;
      }
    }

    if (shouldCreateDeviation) {
      // Default severity: 'major' for unjustified retest (FDA OOS treats this
      // as a procedural failure), 'minor' otherwise. Operator can override
      // via input.deviationSeverity.
      const defaultSeverity: 'minor' | 'major' | 'critical' = unjustifiedDeviationOverride ? 'major' : 'minor';
      const dev = await ensureDeviationForFailedSOPIPC(db, tables, {
        qualityTestId: existing.id,
        sopExecutionId: input.sopExecutionId,
        operatorId,
        testRound: nextRound,
        reason: input.deviationReason ?? null,
        severity: input.deviationSeverity ?? defaultSeverity,
      });
      if (dev) deviation = dev;
    }

    return { qualityTestId: existing.id, round: nextRound, testStatus, deviation };
  });
}
