/**
 * Master Data Service
 * CRUD operations for GMP Production Master Data (BMPR Form Phase 3)
 */

import { isSqlite } from '../db';
import { executeDbOperation, getInsertId } from '../db/db-helper';
import { eq, and, asc, or, isNull } from 'drizzle-orm';
import {
  sqliteProductionRooms,
  sqliteProductionEquipment,
  sqliteEnvironmentalConditions,
  sqliteSOPStepTemplates,
  sqlitePackagingQCCriteria,
  mysqlProductionRooms,
  mysqlProductionEquipment,
  mysqlEnvironmentalConditions,
  mysqlSOPStepTemplates,
  mysqlPackagingQCCriteria,
  NewProductionRoom,
  NewProductionEquipment,
  NewEnvironmentalCondition,
  NewSOPStepTemplate,
  NewPackagingQCCriteria,
} from '../db/schema';
import { getNow } from '../db/date-utils';

// Get table references based on database type
function getTables() {
  if (isSqlite()) {
    return {
      productionRooms: sqliteProductionRooms,
      productionEquipment: sqliteProductionEquipment,
      environmentalConditions: sqliteEnvironmentalConditions,
      sopStepTemplates: sqliteSOPStepTemplates,
      packagingQCCriteria: sqlitePackagingQCCriteria,
    };
  }
  return {
    productionRooms: mysqlProductionRooms,
    productionEquipment: mysqlProductionEquipment,
    environmentalConditions: mysqlEnvironmentalConditions,
    sopStepTemplates: mysqlSOPStepTemplates,
    packagingQCCriteria: mysqlPackagingQCCriteria,
  };
}

// ==========================================
// Production Rooms
// ==========================================

export interface ProductionRoomFilters {
  roomType?: string;
  isActive?: boolean;
}

export async function getProductionRooms(filters?: ProductionRoomFilters) {
  return executeDbOperation(async (db) => {
    const { productionRooms } = getTables();

    const conditions = [];
    if (filters?.roomType) {
      conditions.push(eq(productionRooms.roomType, filters.roomType));
    }
    if (filters?.isActive !== undefined) {
      conditions.push(eq(productionRooms.isActive, filters.isActive));
    }

    let query = db.select().from(productionRooms);
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    return query.orderBy(asc(productionRooms.code));
  });
}

export async function getProductionRoomById(id: number) {
  return executeDbOperation(async (db) => {
    const { productionRooms } = getTables();
    const results = await db.select().from(productionRooms).where(eq(productionRooms.id, id));
    return results[0] || null;
  });
}

export async function createProductionRoom(data: Omit<NewProductionRoom, 'id' | 'createdAt' | 'updatedAt'>) {
  return executeDbOperation(async (db) => {
    const { productionRooms } = getTables();
    const now = getNow();

    const result = await db.insert(productionRooms).values({
      ...data,
      createdAt: now,
      updatedAt: now,
    } as any);

    const insertId = getInsertId(result);
    const results = await db.select().from(productionRooms).where(eq(productionRooms.id, insertId));
    return results[0] || null;
  });
}

export async function updateProductionRoom(id: number, data: Partial<Omit<NewProductionRoom, 'id' | 'createdAt'>>) {
  return executeDbOperation(async (db) => {
    const { productionRooms } = getTables();

    await db.update(productionRooms)
      .set({ ...data, updatedAt: getNow() } as any)
      .where(eq(productionRooms.id, id));

    const results = await db.select().from(productionRooms).where(eq(productionRooms.id, id));
    return results[0] || null;
  });
}

export async function deactivateProductionRoom(id: number) {
  return updateProductionRoom(id, { isActive: false });
}

// ==========================================
// Production Equipment
// ==========================================

export interface ProductionEquipmentFilters {
  equipmentType?: string;
  roomId?: number;
  isActive?: boolean;
  // 'in_line' | 'off_line'. When set to 'in_line', legacy rows with a NULL
  // line_category are included too (null is treated as in-line).
  lineCategory?: string;
}

export async function getProductionEquipment(filters?: ProductionEquipmentFilters) {
  return executeDbOperation(async (db) => {
    const { productionEquipment, productionRooms } = getTables();

    const conditions = [];
    if (filters?.equipmentType) {
      conditions.push(eq(productionEquipment.equipmentType, filters.equipmentType));
    }
    if (filters?.roomId) {
      conditions.push(eq(productionEquipment.roomId, filters.roomId));
    }
    if (filters?.isActive !== undefined) {
      conditions.push(eq(productionEquipment.isActive, filters.isActive));
    }
    if (filters?.lineCategory) {
      // Legacy rows have NULL line_category; treat them as in-line so the
      // in-line filter (used by the BOM equipment picker) still finds them.
      if (filters.lineCategory === 'in_line') {
        conditions.push(or(eq(productionEquipment.lineCategory, 'in_line'), isNull(productionEquipment.lineCategory)));
      } else {
        conditions.push(eq(productionEquipment.lineCategory, filters.lineCategory));
      }
    }

    let query = db.select({
      equipment: productionEquipment,
      room: productionRooms,
    })
    .from(productionEquipment)
    .leftJoin(productionRooms, eq(productionEquipment.roomId, productionRooms.id));

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    return query.orderBy(asc(productionEquipment.code));
  });
}

export async function getProductionEquipmentById(id: number) {
  return executeDbOperation(async (db) => {
    const { productionEquipment, productionRooms } = getTables();

    const results = await db.select({
      equipment: productionEquipment,
      room: productionRooms,
    })
    .from(productionEquipment)
    .leftJoin(productionRooms, eq(productionEquipment.roomId, productionRooms.id))
    .where(eq(productionEquipment.id, id));

    return results[0] || null;
  });
}

export async function createProductionEquipment(data: Omit<NewProductionEquipment, 'id' | 'createdAt' | 'updatedAt'>) {
  return executeDbOperation(async (db) => {
    const { productionEquipment, productionRooms } = getTables();
    const now = getNow();

    const result = await db.insert(productionEquipment).values({
      ...data,
      createdAt: now,
      updatedAt: now,
    } as any);

    const insertId = getInsertId(result);
    const results = await db.select({
      equipment: productionEquipment,
      room: productionRooms,
    })
    .from(productionEquipment)
    .leftJoin(productionRooms, eq(productionEquipment.roomId, productionRooms.id))
    .where(eq(productionEquipment.id, insertId));

    return results[0] || null;
  });
}

export async function updateProductionEquipment(id: number, data: Partial<Omit<NewProductionEquipment, 'id' | 'createdAt'>>) {
  return executeDbOperation(async (db) => {
    const { productionEquipment, productionRooms } = getTables();

    await db.update(productionEquipment)
      .set({ ...data, updatedAt: getNow() } as any)
      .where(eq(productionEquipment.id, id));

    const results = await db.select({
      equipment: productionEquipment,
      room: productionRooms,
    })
    .from(productionEquipment)
    .leftJoin(productionRooms, eq(productionEquipment.roomId, productionRooms.id))
    .where(eq(productionEquipment.id, id));

    return results[0] || null;
  });
}

export async function deactivateProductionEquipment(id: number) {
  return updateProductionEquipment(id, { isActive: false });
}

// ==========================================
// Environmental Conditions
// ==========================================

export interface EnvironmentalConditionFilters {
  isActive?: boolean;
}

export async function getEnvironmentalConditions(filters?: EnvironmentalConditionFilters) {
  return executeDbOperation(async (db) => {
    const { environmentalConditions } = getTables();

    const conditions = [];
    if (filters?.isActive !== undefined) {
      conditions.push(eq(environmentalConditions.isActive, filters.isActive));
    }

    let query = db.select().from(environmentalConditions);
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    return query.orderBy(asc(environmentalConditions.code));
  });
}

export async function getEnvironmentalConditionById(id: number) {
  return executeDbOperation(async (db) => {
    const { environmentalConditions } = getTables();
    const results = await db.select().from(environmentalConditions).where(eq(environmentalConditions.id, id));
    return results[0] || null;
  });
}

export async function createEnvironmentalCondition(data: Omit<NewEnvironmentalCondition, 'id' | 'createdAt'>) {
  return executeDbOperation(async (db) => {
    const { environmentalConditions } = getTables();

    const result = await db.insert(environmentalConditions).values({
      ...data,
      createdAt: getNow(),
    } as any);

    const insertId = getInsertId(result);
    const results = await db.select().from(environmentalConditions).where(eq(environmentalConditions.id, insertId));
    return results[0] || null;
  });
}

export async function updateEnvironmentalCondition(id: number, data: Partial<Omit<NewEnvironmentalCondition, 'id' | 'createdAt'>>) {
  return executeDbOperation(async (db) => {
    const { environmentalConditions } = getTables();

    await db.update(environmentalConditions)
      .set(data as any)
      .where(eq(environmentalConditions.id, id));

    const results = await db.select().from(environmentalConditions).where(eq(environmentalConditions.id, id));
    return results[0] || null;
  });
}

// ==========================================
// SOP Step Templates
// ==========================================

export interface SOPTemplateFilters {
  category?: string;
  isActive?: boolean;
}

export async function getSOPTemplates(filters?: SOPTemplateFilters) {
  return executeDbOperation(async (db) => {
    const { sopStepTemplates } = getTables();

    const conditions = [];
    if (filters?.category) {
      conditions.push(eq(sopStepTemplates.category, filters.category));
    }
    if (filters?.isActive !== undefined) {
      conditions.push(eq(sopStepTemplates.isActive, filters.isActive));
    }

    let query = db.select().from(sopStepTemplates);
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    return query.orderBy(asc(sopStepTemplates.category), asc(sopStepTemplates.code));
  });
}

export async function getSOPTemplateById(id: number) {
  return executeDbOperation(async (db) => {
    const { sopStepTemplates } = getTables();
    const results = await db.select().from(sopStepTemplates).where(eq(sopStepTemplates.id, id));
    return results[0] || null;
  });
}

export async function createSOPTemplate(data: Omit<NewSOPStepTemplate, 'id' | 'createdAt'>) {
  return executeDbOperation(async (db) => {
    const { sopStepTemplates } = getTables();

    const result = await db.insert(sopStepTemplates).values({
      ...data,
      createdAt: getNow(),
    } as any);

    const insertId = getInsertId(result);
    const results = await db.select().from(sopStepTemplates).where(eq(sopStepTemplates.id, insertId));
    return results[0] || null;
  });
}

export async function updateSOPTemplate(id: number, data: Partial<Omit<NewSOPStepTemplate, 'id' | 'createdAt'>>) {
  return executeDbOperation(async (db) => {
    const { sopStepTemplates } = getTables();

    await db.update(sopStepTemplates)
      .set(data as any)
      .where(eq(sopStepTemplates.id, id));

    const results = await db.select().from(sopStepTemplates).where(eq(sopStepTemplates.id, id));
    return results[0] || null;
  });
}

// ==========================================
// Packaging QC Criteria
// ==========================================

export interface PackagingQCCriteriaFilters {
  isActive?: boolean;
}

export async function getPackagingQCCriteria(filters?: PackagingQCCriteriaFilters) {
  return executeDbOperation(async (db) => {
    const { packagingQCCriteria } = getTables();

    const conditions = [];
    if (filters?.isActive !== undefined) {
      conditions.push(eq(packagingQCCriteria.isActive, filters.isActive));
    }

    let query = db.select().from(packagingQCCriteria);
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    return query.orderBy(asc(packagingQCCriteria.code));
  });
}

export async function getPackagingQCCriteriaById(id: number) {
  return executeDbOperation(async (db) => {
    const { packagingQCCriteria } = getTables();
    const results = await db.select().from(packagingQCCriteria).where(eq(packagingQCCriteria.id, id));
    return results[0] || null;
  });
}

export async function createPackagingQCCriteria(data: Omit<NewPackagingQCCriteria, 'id' | 'createdAt'>) {
  return executeDbOperation(async (db) => {
    const { packagingQCCriteria } = getTables();

    const result = await db.insert(packagingQCCriteria).values({
      ...data,
      createdAt: getNow(),
    } as any);

    const insertId = getInsertId(result);
    const results = await db.select().from(packagingQCCriteria).where(eq(packagingQCCriteria.id, insertId));
    return results[0] || null;
  });
}

export async function updatePackagingQCCriteria(id: number, data: Partial<Omit<NewPackagingQCCriteria, 'id' | 'createdAt'>>) {
  return executeDbOperation(async (db) => {
    const { packagingQCCriteria } = getTables();

    await db.update(packagingQCCriteria)
      .set(data as any)
      .where(eq(packagingQCCriteria.id, id));

    const results = await db.select().from(packagingQCCriteria).where(eq(packagingQCCriteria.id, id));
    return results[0] || null;
  });
}
