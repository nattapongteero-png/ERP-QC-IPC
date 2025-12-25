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
import { executeDbOperation } from '../db/db-helper';
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
  sqliteBOMEnvironmentalConditions,
  sqliteBOMSOPSteps,
  sqliteBOMPackagingQC,
  sqliteWorkOrderMaterials,
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
  mysqlBOMEnvironmentalConditions,
  mysqlBOMSOPSteps,
  mysqlBOMPackagingQC,
  mysqlWorkOrderMaterials,
  mysqlProductionRooms,
  mysqlProductionEquipment,
  mysqlEnvironmentalConditions,
  mysqlSOPStepTemplates,
  mysqlPackagingQCCriteria,
  mysqlItems,
  mysqlUsers,
} from '../db/schema';
import { getNow } from '../db/date-utils';

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
      bomEnvironmentalConditions: sqliteBOMEnvironmentalConditions,
      bomSOPSteps: sqliteBOMSOPSteps,
      bomPackagingQC: sqliteBOMPackagingQC,
      workOrderMaterials: sqliteWorkOrderMaterials,
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
    bomEnvironmentalConditions: mysqlBOMEnvironmentalConditions,
    bomSOPSteps: mysqlBOMSOPSteps,
    bomPackagingQC: mysqlBOMPackagingQC,
    workOrderMaterials: mysqlWorkOrderMaterials,
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
    const [log] = await db
      .insert(tables.woEnvironmentalLogs)
      .values({
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
      })
      .returning();

    return log;
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
    const [log] = await db
      .insert(tables.woCleaningLogs)
      .values({
        workOrderId: data.workOrderId,
        phase: data.phase,
        itemType: data.itemType,
        roomId: data.roomId,
        equipmentId: data.equipmentId,
        isClean: data.isClean,
        operatorId: data.operatorId,
        performedAt: data.performedAt,
        createdAt: getNow(),
      })
      .returning();

    return log;
  });
}

export async function verifyWOCleaningLog(logId: number, verifierId: number) {
  const tables = getTables();

  return executeDbOperation(async (db: any) => {
    const [log] = await db
      .update(tables.woCleaningLogs)
      .set({
        verifierId,
        verifiedAt: getNow(),
      })
      .where(eq(tables.woCleaningLogs.id, logId))
      .returning();

    return log;
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
      const [execution] = await db
        .insert(tables.woSOPExecution)
        .values({
          workOrderId,
          bomStepId: step.id,
          sequence: step.sequence,
          isCompleted: false,
          status: 'pending',
          createdAt: getNow(),
          updatedAt: getNow(),
        })
        .returning();

      executions.push(execution);
    }

    return executions;
  });
}

export async function startWOSOPStep(executionId: number, operatorId: number) {
  const tables = getTables();

  return executeDbOperation(async (db: any) => {
    const [execution] = await db
      .update(tables.woSOPExecution)
      .set({
        operatorId,
        startedAt: getNow(),
        status: 'in_progress',
        updatedAt: getNow(),
      })
      .where(eq(tables.woSOPExecution.id, executionId))
      .returning();

    return execution;
  });
}

export async function completeWOSOPStep(
  executionId: number,
  actualParameters?: string,
  notes?: string
) {
  const tables = getTables();

  return executeDbOperation(async (db: any) => {
    const [execution] = await db
      .update(tables.woSOPExecution)
      .set({
        isCompleted: true,
        actualParameters,
        completedAt: getNow(),
        status: 'completed',
        notes,
        updatedAt: getNow(),
      })
      .where(eq(tables.woSOPExecution.id, executionId))
      .returning();

    return execution;
  });
}

export async function verifyWOSOPStep(executionId: number, verifierId: number) {
  const tables = getTables();

  return executeDbOperation(async (db: any) => {
    const [execution] = await db
      .update(tables.woSOPExecution)
      .set({
        verifierId,
        verifiedAt: getNow(),
        status: 'verified',
        updatedAt: getNow(),
      })
      .where(eq(tables.woSOPExecution.id, executionId))
      .returning();

    return execution;
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

  return executeDbOperation(async (db: any) => {
    const [material] = await db
      .update(tables.workOrderMaterials)
      .set({
        weighedQty: data.weighedQty,
        weighedBy: data.weighedBy,
        weighedAt: getNow(),
        waterDate: data.waterDate,
        waterConductivity: data.waterConductivity,
        waterTemperature: data.waterTemperature,
      })
      .where(eq(tables.workOrderMaterials.id, data.materialId))
      .returning();

    return material;
  });
}

export async function verifyMaterialWeight(materialId: number, verifierId: number) {
  const tables = getTables();

  return executeDbOperation(async (db: any) => {
    const [material] = await db
      .update(tables.workOrderMaterials)
      .set({
        verifiedBy: verifierId,
        verifiedAt: getNow(),
      })
      .where(eq(tables.workOrderMaterials.id, materialId))
      .returning();

    return material;
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

    const [log] = await db
      .insert(tables.woPackagingWeightLogs)
      .values({
        workOrderId: data.workOrderId,
        bomQCId,
        checkTime: data.checkTime,
        sampleWeights: data.sampleWeights,
        failedCount,
        isPass,
        operatorId: data.operatorId,
        notes: data.notes,
        createdAt: getNow(),
      })
      .returning();

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
    const [log] = await db
      .insert(tables.woPackagingIntegrityLogs)
      .values({
        workOrderId: data.workOrderId,
        checkTime: data.checkTime,
        tubeCapComplete: data.tubeCapComplete,
        lotNumberCorrect: data.lotNumberCorrect,
        packingCorrect: data.packingCorrect,
        operatorId: data.operatorId,
        inspectorId: data.inspectorId,
        notes: data.notes,
        createdAt: getNow(),
      })
      .returning();

    return log;
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
    const [inspection] = await db
      .insert(tables.woFinishedInspection)
      .values({
        workOrderId: data.workOrderId,
        sampleDate: data.sampleDate,
        samplerId: data.samplerId,
        sampleQtyForTest: data.sampleQtyForTest ?? 50,
        sampleQtyForRetention: data.sampleQtyForRetention ?? 3,
        checklistResults: data.checklistResults,
        status: 'pending',
        createdAt: getNow(),
        updatedAt: getNow(),
      })
      .returning();

    return inspection;
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
    const [inspection] = await db
      .update(tables.woFinishedInspection)
      .set({
        checklistResults,
        inspectorId,
        inspectedAt: getNow(),
        status,
        updatedAt: getNow(),
      })
      .where(eq(tables.woFinishedInspection.id, inspectionId))
      .returning();

    return inspection;
  });
}

export async function reInspectWOFinishedInspection(inspectionId: number, reInspectorId: number) {
  const tables = getTables();

  return executeDbOperation(async (db: any) => {
    const [inspection] = await db
      .update(tables.woFinishedInspection)
      .set({
        reInspectorId,
        reInspectedAt: getNow(),
        status: 're_inspected',
        updatedAt: getNow(),
      })
      .where(eq(tables.woFinishedInspection.id, inspectionId))
      .returning();

    return inspection;
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
    const [material] = await db
      .insert(tables.woPackagingMaterials)
      .values({
        workOrderId: data.workOrderId,
        itemId: data.itemId,
        materialName: data.materialName,
        qtyRequisitioned: data.qtyRequisitioned,
        unit: data.unit,
        operatorId: data.operatorId,
        createdAt: getNow(),
        updatedAt: getNow(),
      })
      .returning();

    return material;
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

    const [material] = await db
      .update(tables.woPackagingMaterials)
      .set(updateData)
      .where(eq(tables.woPackagingMaterials.id, materialId))
      .returning();

    return material;
  });
}

export async function verifyWOPackagingMaterial(materialId: number, verifierId: number) {
  const tables = getTables();

  return executeDbOperation(async (db: any) => {
    const [material] = await db
      .update(tables.woPackagingMaterials)
      .set({
        verifierId,
        updatedAt: getNow(),
      })
      .where(eq(tables.woPackagingMaterials.id, materialId))
      .returning();

    return material;
  });
}
