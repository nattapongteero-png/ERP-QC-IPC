/**
 * QC Sampling Plan master service (Audit QC5)
 *
 * Per-item / per-category sampling plan that overrides the ISO 2859-1
 * in-code defaults from quality.service.ts.
 *
 * Resolution order when picking a plan for a given lot:
 *   1. Active plan with itemId = lot.itemId
 *   2. Active plan with category = item.category
 *   3. null  → caller falls back to calculateSamplingPlan()
 */
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { isSqlite } from '../db';
import { executeDbOperation, getTableRef, getInsertId } from '../db/db-helper';
import { getNow } from '../db/date-utils';

export type InspectionLevel = 'I' | 'II' | 'III';
export type SamplingFrequency =
  | 'every_lot'
  | 'random_30pct'
  | 'random_10pct'
  | 'skip_lot'
  | 'reduced'
  | 'tightened';

export const VALID_FREQUENCIES: SamplingFrequency[] = [
  'every_lot',
  'random_30pct',
  'random_10pct',
  'skip_lot',
  'reduced',
  'tightened',
];

export interface SamplingPlanInput {
  code: string;
  name: string;
  itemId?: number | null;
  category?: string | null;
  inspectionLevel?: InspectionLevel;
  aql?: number;
  sampleSize?: number | null;
  acceptNumber?: number | null;
  rejectNumber?: number | null;
  frequency?: SamplingFrequency;
  standardRef?: string | null;
  defaultSampleQty?: number | null;
  defaultRetainQty?: number | null;
  isActive?: boolean;
  notes?: string | null;
  createdBy?: number | null;
}

export interface SamplingPlanUpdate {
  name?: string;
  itemId?: number | null;
  category?: string | null;
  inspectionLevel?: InspectionLevel;
  aql?: number;
  sampleSize?: number | null;
  acceptNumber?: number | null;
  rejectNumber?: number | null;
  frequency?: SamplingFrequency;
  standardRef?: string | null;
  defaultSampleQty?: number | null;
  defaultRetainQty?: number | null;
  isActive?: boolean;
  notes?: string | null;
}

export async function createSamplingPlan(input: SamplingPlanInput) {
  if (!input.code?.trim()) throw new Error('code is required');
  if (!input.name?.trim()) throw new Error('name is required');

  return executeDbOperation(async (db: any) => {
    const tbl = getTableRef('qcSamplingPlans');
    const values: Record<string, unknown> = {
      code: input.code.trim().toLowerCase(),
      name: input.name.trim(),
      itemId: input.itemId ?? null,
      category: input.category ?? null,
      inspectionLevel: input.inspectionLevel ?? 'II',
      aql: input.aql ?? 1.0,
      sampleSize: input.sampleSize ?? null,
      acceptNumber: input.acceptNumber ?? null,
      rejectNumber: input.rejectNumber ?? null,
      frequency: input.frequency ?? 'every_lot',
      standardRef: input.standardRef ?? null,
      defaultSampleQty: input.defaultSampleQty ?? null,
      defaultRetainQty: input.defaultRetainQty ?? null,
      isActive: input.isActive ?? true,
      notes: input.notes ?? null,
      createdBy: input.createdBy ?? null,
      createdAt: getNow(),
      updatedAt: getNow(),
    };

    if (isSqlite()) {
      const [row] = await db.insert(tbl).values(values).returning();
      return row;
    }
    const result = await db.insert(tbl).values(values);
    const id = Number(getInsertId(result));
    const [row] = await db.select().from(tbl).where(eq(tbl.id, id));
    return row;
  });
}

export async function updateSamplingPlan(id: number, patch: SamplingPlanUpdate) {
  return executeDbOperation(async (db: any) => {
    const tbl = getTableRef('qcSamplingPlans');
    const values: Record<string, unknown> = { updatedAt: getNow() };
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined) values[k] = v;
    }
    if (isSqlite()) {
      const [row] = await db.update(tbl).set(values).where(eq(tbl.id, id)).returning();
      return row;
    }
    await db.update(tbl).set(values).where(eq(tbl.id, id));
    const [row] = await db.select().from(tbl).where(eq(tbl.id, id));
    return row;
  });
}

export async function deactivateSamplingPlan(id: number) {
  return updateSamplingPlan(id, { isActive: false });
}

export async function listSamplingPlans(filter: { activeOnly?: boolean } = {}) {
  return executeDbOperation(async (db: any) => {
    const tbl = getTableRef('qcSamplingPlans');
    const items = getTableRef('items');
    let q = db
      .select({
        id: tbl.id,
        code: tbl.code,
        name: tbl.name,
        itemId: tbl.itemId,
        itemCode: items.code,
        itemName: items.nameTh,
        category: tbl.category,
        inspectionLevel: tbl.inspectionLevel,
        aql: tbl.aql,
        sampleSize: tbl.sampleSize,
        acceptNumber: tbl.acceptNumber,
        rejectNumber: tbl.rejectNumber,
        frequency: tbl.frequency,
        standardRef: tbl.standardRef,
        defaultSampleQty: tbl.defaultSampleQty,
        defaultRetainQty: tbl.defaultRetainQty,
        isActive: tbl.isActive,
        notes: tbl.notes,
        createdAt: tbl.createdAt,
      })
      .from(tbl)
      .leftJoin(items, eq(tbl.itemId, items.id));
    if (filter.activeOnly) q = q.where(eq(tbl.isActive, true));
    q = q.orderBy(desc(tbl.isActive), asc(tbl.code));
    return q;
  });
}

/**
 * Resolve the most-specific active plan for an item.
 * Priority: itemId match > category match > null.
 */
export async function resolveSamplingPlanForItem(
  itemId: number,
  category?: string | null,
) {
  return executeDbOperation(async (db: any) => {
    const tbl = getTableRef('qcSamplingPlans');

    // Item-specific first
    const [byItem] = await db
      .select()
      .from(tbl)
      .where(and(eq(tbl.itemId, itemId), eq(tbl.isActive, true)))
      .orderBy(desc(tbl.id))
      .limit(1);
    if (byItem) return byItem;

    if (category) {
      const [byCategory] = await db
        .select()
        .from(tbl)
        .where(
          and(
            eq(tbl.category, category),
            isNull(tbl.itemId),
            eq(tbl.isActive, true),
          ),
        )
        .orderBy(desc(tbl.id))
        .limit(1);
      if (byCategory) return byCategory;
    }

    // Global default — both itemId and category null
    const [global] = await db
      .select()
      .from(tbl)
      .where(and(isNull(tbl.itemId), isNull(tbl.category), eq(tbl.isActive, true)))
      .orderBy(desc(tbl.id))
      .limit(1);
    return global || null;
  });
}

