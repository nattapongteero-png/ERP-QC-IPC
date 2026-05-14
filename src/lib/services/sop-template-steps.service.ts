import { executeDbOperation, getInsertId, getTableRef } from '../db/db-helper';
import { eq, and, asc } from 'drizzle-orm';
import { getNow } from '../db/date-utils';
import type { NewSOPTemplateStep } from '../db/schema';

function getTable() {
  return getTableRef('sOPTemplateSteps');
}

export async function getSOPTemplateSteps(templateId: number) {
  return executeDbOperation(async (db) => {
    const table = getTable();
    return db.select()
      .from(table)
      .where(eq(table.templateId, templateId))
      .orderBy(asc(table.sequence));
  });
}

export async function getSOPTemplateStepById(id: number) {
  return executeDbOperation(async (db) => {
    const table = getTable();
    const results = await db.select()
      .from(table)
      .where(eq(table.id, id));
    return results[0] || null;
  });
}

export async function addSOPTemplateStep(data: Omit<NewSOPTemplateStep, 'id' | 'createdAt'>) {
  return executeDbOperation(async (db) => {
    const table = getTable();
    const result = await db.insert(table).values({
      ...data,
      createdAt: getNow(),
    } as any);

    const insertId = getInsertId(result);
    const results = await db.select()
      .from(table)
      .where(eq(table.id, insertId));
    return results[0] || null;
  });
}

export async function updateSOPTemplateStep(
  id: number,
  data: Partial<Omit<NewSOPTemplateStep, 'id' | 'createdAt' | 'templateId'>>
) {
  return executeDbOperation(async (db) => {
    const table = getTable();
    await db.update(table)
      .set(data as any)
      .where(eq(table.id, id));

    const results = await db.select()
      .from(table)
      .where(eq(table.id, id));
    return results[0] || null;
  });
}

export async function removeSOPTemplateStep(id: number) {
  return executeDbOperation(async (db) => {
    const table = getTable();
    await db.delete(table).where(eq(table.id, id));
    return { success: true };
  });
}

export async function reorderSOPTemplateSteps(templateId: number, stepIds: number[]) {
  return executeDbOperation(async (db) => {
    const table = getTable();
    for (let i = 0; i < stepIds.length; i++) {
      await db.update(table)
        .set({ sequence: i + 1 } as any)
        .where(and(
          eq(table.id, stepIds[i]),
          eq(table.templateId, templateId)
        ));
    }
    return getSOPTemplateSteps(templateId);
  });
}
