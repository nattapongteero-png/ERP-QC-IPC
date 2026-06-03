/**
 * Goods Receipt Tolerance Service — admin CRUD for receipt_tolerances
 * Feature: 020-goods-receipt
 */
import { eq } from 'drizzle-orm';
import { executeDbOperation, getTableRef, getInsertId } from '../db/db-helper';
import { getNow } from '../db/date-utils';
import type { ChecklistCategory, ReceiptTolerance } from '@/types/goods-receipt';

function getTables() {
  return {
    tolerances: getTableRef('receiptTolerances'),
  };
}

export async function listTolerances(includeInactive = false): Promise<ReceiptTolerance[]> {
  return executeDbOperation(async (db) => {
    const t = getTables();
    const rows = includeInactive
      ? await db.select().from(t.tolerances)
      : await db.select().from(t.tolerances).where(eq(t.tolerances.isActive, true));
    return rows.map(normalize);
  });
}

export async function upsertTolerance(
  input: {
    category: ChecklistCategory;
    tolerancePercent?: number;
    isActive?: boolean;
    notes?: string | null;
  },
): Promise<ReceiptTolerance> {
  return executeDbOperation(async (db) => {
    const t = getTables();
    const existing = await db
      .select()
      .from(t.tolerances)
      .where(eq(t.tolerances.category, input.category))
      .limit(1);

    if (existing.length > 0) {
      const updates: any = { updatedAt: getNow() };
      if (input.tolerancePercent != null) updates.tolerancePercent = input.tolerancePercent;
      if (input.isActive != null) updates.isActive = input.isActive;
      if (input.notes !== undefined) updates.notes = input.notes;
      await db.update(t.tolerances).set(updates).where(eq(t.tolerances.id, existing[0].id));
      const fresh = await db.select().from(t.tolerances).where(eq(t.tolerances.id, existing[0].id)).limit(1);
      return normalize(fresh[0]);
    }

    const ins = await db.insert(t.tolerances).values({
      category: input.category,
      tolerancePercent: input.tolerancePercent ?? 0,
      isActive: input.isActive ?? true,
      notes: input.notes ?? null,
      createdAt: getNow(),
      updatedAt: getNow(),
    });
    const id = getInsertId(ins);
    const fresh = await db.select().from(t.tolerances).where(eq(t.tolerances.id, id)).limit(1);
    return normalize(fresh[0]);
  });
}

function normalize(row: any): ReceiptTolerance {
  return {
    id: Number(row.id),
    category: row.category as ChecklistCategory,
    tolerancePercent: Number(row.tolerancePercent),
    isActive: Boolean(row.isActive),
    notes: row.notes ?? null,
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}
