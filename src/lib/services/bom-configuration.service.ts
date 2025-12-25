/**
 * BOM Configuration Service
 * CRUD operations for BOM-level configuration (BMPR Form Phase 3)
 */

import { isSqlite } from '../db';
import { executeDbOperation, getInsertId } from '../db/db-helper';
import { eq, and, asc } from 'drizzle-orm';
import {
  sqliteBOMRooms,
  sqliteBOMEquipment,
  sqliteBOMEnvironmentalConditions,
  sqliteBOMSOPSteps,
  sqliteBOMPackagingQC,
  sqliteProductionRooms,
  sqliteProductionEquipment,
  sqliteEnvironmentalConditions,
  sqliteSOPStepTemplates,
  sqlitePackagingQCCriteria,
  mysqlBOMRooms,
  mysqlBOMEquipment,
  mysqlBOMEnvironmentalConditions,
  mysqlBOMSOPSteps,
  mysqlBOMPackagingQC,
  mysqlProductionRooms,
  mysqlProductionEquipment,
  mysqlEnvironmentalConditions,
  mysqlSOPStepTemplates,
  mysqlPackagingQCCriteria,
  NewBOMRoom,
  NewBOMEquipmentConfig,
  NewBOMEnvironmentalCondition,
  NewBOMSOPStep,
  NewBOMPackagingQC,
} from '../db/schema';
import { getNow } from '../db/date-utils';

// Get table references based on database type
function getTables() {
  if (isSqlite()) {
    return {
      bomRooms: sqliteBOMRooms,
      bomEquipment: sqliteBOMEquipment,
      bomEnvironmentalConditions: sqliteBOMEnvironmentalConditions,
      bomSOPSteps: sqliteBOMSOPSteps,
      bomPackagingQC: sqliteBOMPackagingQC,
      productionRooms: sqliteProductionRooms,
      productionEquipment: sqliteProductionEquipment,
      environmentalConditions: sqliteEnvironmentalConditions,
      sopStepTemplates: sqliteSOPStepTemplates,
      packagingQCCriteria: sqlitePackagingQCCriteria,
    };
  }
  return {
    bomRooms: mysqlBOMRooms,
    bomEquipment: mysqlBOMEquipment,
    bomEnvironmentalConditions: mysqlBOMEnvironmentalConditions,
    bomSOPSteps: mysqlBOMSOPSteps,
    bomPackagingQC: mysqlBOMPackagingQC,
    productionRooms: mysqlProductionRooms,
    productionEquipment: mysqlProductionEquipment,
    environmentalConditions: mysqlEnvironmentalConditions,
    sopStepTemplates: mysqlSOPStepTemplates,
    packagingQCCriteria: mysqlPackagingQCCriteria,
  };
}

// ==========================================
// BOM Rooms
// ==========================================

export async function getBOMRooms(bomId: number, phase?: string) {
  return executeDbOperation(async (db) => {
    const { bomRooms, productionRooms } = getTables();

    const conditions = [eq(bomRooms.bomId, bomId)];
    if (phase) {
      conditions.push(eq(bomRooms.phase, phase));
    }

    return db.select({
      bomRoom: bomRooms,
      room: productionRooms,
    })
    .from(bomRooms)
    .leftJoin(productionRooms, eq(bomRooms.roomId, productionRooms.id))
    .where(and(...conditions))
    .orderBy(asc(bomRooms.phase), asc(bomRooms.sequence));
  });
}

export async function addBOMRoom(data: Omit<NewBOMRoom, 'id' | 'createdAt'>) {
  return executeDbOperation(async (db) => {
    const { bomRooms, productionRooms } = getTables();

    const result = await db.insert(bomRooms).values({
      ...data,
      createdAt: getNow(),
    } as any);

    const insertId = getInsertId(result);

    const results = await db.select({
      bomRoom: bomRooms,
      room: productionRooms,
    })
    .from(bomRooms)
    .leftJoin(productionRooms, eq(bomRooms.roomId, productionRooms.id))
    .where(eq(bomRooms.id, insertId));

    return results[0] || null;
  });
}

export async function updateBOMRoom(id: number, data: Partial<Omit<NewBOMRoom, 'id' | 'createdAt' | 'bomId'>>) {
  return executeDbOperation(async (db) => {
    const { bomRooms, productionRooms } = getTables();

    await db.update(bomRooms)
      .set(data as any)
      .where(eq(bomRooms.id, id));

    const results = await db.select({
      bomRoom: bomRooms,
      room: productionRooms,
    })
    .from(bomRooms)
    .leftJoin(productionRooms, eq(bomRooms.roomId, productionRooms.id))
    .where(eq(bomRooms.id, id));

    return results[0] || null;
  });
}

export async function removeBOMRoom(id: number) {
  return executeDbOperation(async (db) => {
    const { bomRooms } = getTables();
    await db.delete(bomRooms).where(eq(bomRooms.id, id));
    return { success: true };
  });
}

// ==========================================
// BOM Equipment
// ==========================================

export async function getBOMEquipment(bomId: number, phase?: string) {
  return executeDbOperation(async (db) => {
    const { bomEquipment, productionEquipment } = getTables();

    const conditions = [eq(bomEquipment.bomId, bomId)];
    if (phase) {
      conditions.push(eq(bomEquipment.phase, phase));
    }

    return db.select({
      bomEquipment: bomEquipment,
      equipment: productionEquipment,
    })
    .from(bomEquipment)
    .leftJoin(productionEquipment, eq(bomEquipment.equipmentId, productionEquipment.id))
    .where(and(...conditions))
    .orderBy(asc(bomEquipment.phase), asc(bomEquipment.sequence));
  });
}

export async function addBOMEquipment(data: Omit<NewBOMEquipmentConfig, 'id' | 'createdAt'>) {
  return executeDbOperation(async (db) => {
    const { bomEquipment, productionEquipment } = getTables();

    const result = await db.insert(bomEquipment).values({
      ...data,
      createdAt: getNow(),
    } as any);

    const insertId = getInsertId(result);

    const results = await db.select({
      bomEquipment: bomEquipment,
      equipment: productionEquipment,
    })
    .from(bomEquipment)
    .leftJoin(productionEquipment, eq(bomEquipment.equipmentId, productionEquipment.id))
    .where(eq(bomEquipment.id, insertId));

    return results[0] || null;
  });
}

export async function updateBOMEquipment(id: number, data: Partial<Omit<NewBOMEquipmentConfig, 'id' | 'createdAt' | 'bomId'>>) {
  return executeDbOperation(async (db) => {
    const { bomEquipment, productionEquipment } = getTables();

    await db.update(bomEquipment)
      .set(data as any)
      .where(eq(bomEquipment.id, id));

    const results = await db.select({
      bomEquipment: bomEquipment,
      equipment: productionEquipment,
    })
    .from(bomEquipment)
    .leftJoin(productionEquipment, eq(bomEquipment.equipmentId, productionEquipment.id))
    .where(eq(bomEquipment.id, id));

    return results[0] || null;
  });
}

export async function removeBOMEquipment(id: number) {
  return executeDbOperation(async (db) => {
    const { bomEquipment } = getTables();
    await db.delete(bomEquipment).where(eq(bomEquipment.id, id));
    return { success: true };
  });
}

// ==========================================
// BOM Environmental Conditions
// ==========================================

export async function getBOMEnvironmentalConditions(bomId: number, phase?: string) {
  return executeDbOperation(async (db) => {
    const { bomEnvironmentalConditions, environmentalConditions } = getTables();

    const conditions = [eq(bomEnvironmentalConditions.bomId, bomId)];
    if (phase) {
      conditions.push(eq(bomEnvironmentalConditions.phase, phase));
    }

    return db.select({
      bomCondition: bomEnvironmentalConditions,
      condition: environmentalConditions,
    })
    .from(bomEnvironmentalConditions)
    .leftJoin(environmentalConditions, eq(bomEnvironmentalConditions.conditionId, environmentalConditions.id))
    .where(and(...conditions))
    .orderBy(asc(bomEnvironmentalConditions.phase));
  });
}

export async function addBOMEnvironmentalCondition(data: Omit<NewBOMEnvironmentalCondition, 'id' | 'createdAt'>) {
  return executeDbOperation(async (db) => {
    const { bomEnvironmentalConditions, environmentalConditions } = getTables();

    const result = await db.insert(bomEnvironmentalConditions).values({
      ...data,
      createdAt: getNow(),
    } as any);

    const insertId = getInsertId(result);

    const results = await db.select({
      bomCondition: bomEnvironmentalConditions,
      condition: environmentalConditions,
    })
    .from(bomEnvironmentalConditions)
    .leftJoin(environmentalConditions, eq(bomEnvironmentalConditions.conditionId, environmentalConditions.id))
    .where(eq(bomEnvironmentalConditions.id, insertId));

    return results[0] || null;
  });
}

export async function removeBOMEnvironmentalCondition(id: number) {
  return executeDbOperation(async (db) => {
    const { bomEnvironmentalConditions } = getTables();
    await db.delete(bomEnvironmentalConditions).where(eq(bomEnvironmentalConditions.id, id));
    return { success: true };
  });
}

// ==========================================
// BOM SOP Steps
// ==========================================

export async function getBOMSOPSteps(bomId: number) {
  return executeDbOperation(async (db) => {
    const { bomSOPSteps, sopStepTemplates } = getTables();

    return db.select({
      bomStep: bomSOPSteps,
      template: sopStepTemplates,
    })
    .from(bomSOPSteps)
    .leftJoin(sopStepTemplates, eq(bomSOPSteps.templateId, sopStepTemplates.id))
    .where(eq(bomSOPSteps.bomId, bomId))
    .orderBy(asc(bomSOPSteps.sequence));
  });
}

export async function getBOMSOPStepById(id: number) {
  return executeDbOperation(async (db) => {
    const { bomSOPSteps, sopStepTemplates } = getTables();

    const results = await db.select({
      bomStep: bomSOPSteps,
      template: sopStepTemplates,
    })
    .from(bomSOPSteps)
    .leftJoin(sopStepTemplates, eq(bomSOPSteps.templateId, sopStepTemplates.id))
    .where(eq(bomSOPSteps.id, id));

    return results[0] || null;
  });
}

export async function addBOMSOPStep(data: Omit<NewBOMSOPStep, 'id' | 'createdAt'>) {
  return executeDbOperation(async (db) => {
    const { bomSOPSteps, sopStepTemplates } = getTables();

    const result = await db.insert(bomSOPSteps).values({
      ...data,
      createdAt: getNow(),
    } as any);

    const insertId = getInsertId(result);

    const results = await db.select({
      bomStep: bomSOPSteps,
      template: sopStepTemplates,
    })
    .from(bomSOPSteps)
    .leftJoin(sopStepTemplates, eq(bomSOPSteps.templateId, sopStepTemplates.id))
    .where(eq(bomSOPSteps.id, insertId));

    return results[0] || null;
  });
}

export async function updateBOMSOPStep(id: number, data: Partial<Omit<NewBOMSOPStep, 'id' | 'createdAt' | 'bomId'>>) {
  return executeDbOperation(async (db) => {
    const { bomSOPSteps, sopStepTemplates } = getTables();

    await db.update(bomSOPSteps)
      .set(data as any)
      .where(eq(bomSOPSteps.id, id));

    const results = await db.select({
      bomStep: bomSOPSteps,
      template: sopStepTemplates,
    })
    .from(bomSOPSteps)
    .leftJoin(sopStepTemplates, eq(bomSOPSteps.templateId, sopStepTemplates.id))
    .where(eq(bomSOPSteps.id, id));

    return results[0] || null;
  });
}

export async function removeBOMSOPStep(id: number) {
  return executeDbOperation(async (db) => {
    const { bomSOPSteps } = getTables();
    await db.delete(bomSOPSteps).where(eq(bomSOPSteps.id, id));
    return { success: true };
  });
}

export async function reorderBOMSOPSteps(bomId: number, stepIds: number[]) {
  return executeDbOperation(async (db) => {
    const { bomSOPSteps } = getTables();

    // Update sequence for each step
    for (let i = 0; i < stepIds.length; i++) {
      await db.update(bomSOPSteps)
        .set({ sequence: i + 1 } as any)
        .where(and(
          eq(bomSOPSteps.id, stepIds[i]),
          eq(bomSOPSteps.bomId, bomId)
        ));
    }

    return getBOMSOPSteps(bomId);
  });
}

// ==========================================
// BOM Packaging QC
// ==========================================

export async function getBOMPackagingQC(bomId: number) {
  return executeDbOperation(async (db) => {
    const { bomPackagingQC, packagingQCCriteria } = getTables();

    return db.select({
      bomQC: bomPackagingQC,
      criteria: packagingQCCriteria,
    })
    .from(bomPackagingQC)
    .leftJoin(packagingQCCriteria, eq(bomPackagingQC.criteriaId, packagingQCCriteria.id))
    .where(eq(bomPackagingQC.bomId, bomId));
  });
}

export async function setBOMPackagingQC(data: Omit<NewBOMPackagingQC, 'id' | 'createdAt'>) {
  return executeDbOperation(async (db) => {
    const { bomPackagingQC, packagingQCCriteria } = getTables();

    // Remove existing QC for this BOM first (only one allowed)
    await db.delete(bomPackagingQC).where(eq(bomPackagingQC.bomId, data.bomId));

    const result = await db.insert(bomPackagingQC).values({
      ...data,
      createdAt: getNow(),
    } as any);

    const insertId = getInsertId(result);

    const results = await db.select({
      bomQC: bomPackagingQC,
      criteria: packagingQCCriteria,
    })
    .from(bomPackagingQC)
    .leftJoin(packagingQCCriteria, eq(bomPackagingQC.criteriaId, packagingQCCriteria.id))
    .where(eq(bomPackagingQC.id, insertId));

    return results[0] || null;
  });
}

export async function removeBOMPackagingQC(bomId: number) {
  return executeDbOperation(async (db) => {
    const { bomPackagingQC } = getTables();
    await db.delete(bomPackagingQC).where(eq(bomPackagingQC.bomId, bomId));
    return { success: true };
  });
}

// ==========================================
// Copy BOM Configuration
// ==========================================

export async function copyBOMConfiguration(sourceBomId: number, targetBomId: number) {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    // Copy rooms
    const sourceRooms = await db.select()
      .from(tables.bomRooms)
      .where(eq(tables.bomRooms.bomId, sourceBomId));

    for (const room of sourceRooms) {
      await db.insert(tables.bomRooms).values({
        bomId: targetBomId,
        roomId: room.roomId,
        phase: room.phase,
        sequence: room.sequence,
        isRequired: room.isRequired,
        createdAt: getNow(),
      } as any);
    }

    // Copy equipment
    const sourceEquipment = await db.select()
      .from(tables.bomEquipment)
      .where(eq(tables.bomEquipment.bomId, sourceBomId));

    for (const equip of sourceEquipment) {
      await db.insert(tables.bomEquipment).values({
        bomId: targetBomId,
        equipmentId: equip.equipmentId,
        phase: equip.phase,
        sequence: equip.sequence,
        isRequired: equip.isRequired,
        createdAt: getNow(),
      } as any);
    }

    // Copy environmental conditions
    const sourceConditions = await db.select()
      .from(tables.bomEnvironmentalConditions)
      .where(eq(tables.bomEnvironmentalConditions.bomId, sourceBomId));

    for (const cond of sourceConditions) {
      await db.insert(tables.bomEnvironmentalConditions).values({
        bomId: targetBomId,
        conditionId: cond.conditionId,
        phase: cond.phase,
        createdAt: getNow(),
      } as any);
    }

    // Copy SOP steps
    const sourceSteps = await db.select()
      .from(tables.bomSOPSteps)
      .where(eq(tables.bomSOPSteps.bomId, sourceBomId));

    for (const step of sourceSteps) {
      await db.insert(tables.bomSOPSteps).values({
        bomId: targetBomId,
        templateId: step.templateId,
        sequence: step.sequence,
        stepName: step.stepName,
        stepNameTh: step.stepNameTh,
        instructions: step.instructions,
        instructionsTh: step.instructionsTh,
        parameters: step.parameters,
        equipmentIds: step.equipmentIds,
        requiresVerification: step.requiresVerification,
        createdAt: getNow(),
      } as any);
    }

    // Copy packaging QC
    const sourceQC = await db.select()
      .from(tables.bomPackagingQC)
      .where(eq(tables.bomPackagingQC.bomId, sourceBomId));

    for (const qc of sourceQC) {
      await db.insert(tables.bomPackagingQC).values({
        bomId: targetBomId,
        criteriaId: qc.criteriaId,
        createdAt: getNow(),
      } as any);
    }

    return { success: true, message: 'BOM configuration copied successfully' };
  });
}
