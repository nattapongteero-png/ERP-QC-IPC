/**
 * Warehouse resolver — find (and self-seed) the special-purpose warehouses the
 * goods-receipt flow routes lots into, so a fresh deploy without the build-time
 * seed still works (same self-seed approach as the checklist template).
 *
 * Feature: 020-goods-receipt (QC-first flow)
 */
import { eq } from 'drizzle-orm';
import { getTableRef, getInsertId } from '../db/db-helper';
import { getNow } from '../db/date-utils';
import { warehouseTypeForItemType } from '../utils/warehouse-type';

// The transactional db handle threaded from executeDbOperation is untyped (any)
// across this codebase; match that convention here.
type DbClient = any;

/** Warehouse type that holds QC-drawn samples (the "ชั้นวาง/คลังตัวอย่าง QC"). */
export const QC_WAREHOUSE_TYPE = 'qc';
/** Room that holds the lot-representative retention sample (ตัวอย่างตัวแทน Lot). */
export const RETENTION_WAREHOUSE_TYPE = 'qc_retention';
/** Room that holds the stability sample (ตัวอย่าง Stability). */
export const STABILITY_WAREHOUSE_TYPE = 'qc_stability';

interface SeedSpec {
  code: string;
  name: string;
  type: string;
}

const QC_WAREHOUSE_SEED: SeedSpec = {
  code: 'WH-QC',
  name: 'คลังตัวอย่าง QC',
  type: QC_WAREHOUSE_TYPE,
};

const RETENTION_WAREHOUSE_SEED: SeedSpec = {
  code: 'WH-RETAIN',
  name: 'ห้องตัวอย่างตัวแทน Lot',
  type: RETENTION_WAREHOUSE_TYPE,
};

const STABILITY_WAREHOUSE_SEED: SeedSpec = {
  code: 'WH-STAB',
  name: 'ห้องตัวอย่าง Stability',
  type: STABILITY_WAREHOUSE_TYPE,
};

/**
 * Return the id of the first warehouse of `type`, creating the given seed row
 * if none exists. Runs inside the caller's transaction (`db` passed in) so it
 * shares atomicity with the surrounding receipt operation.
 */
async function getOrCreateWarehouseByType(
  db: DbClient,
  type: string,
  seed: SeedSpec,
): Promise<number> {
  const warehouses = getTableRef('warehouses');
  const existing = await db
    .select({ id: warehouses.id })
    .from(warehouses)
    .where(eq(warehouses.type, type))
    .limit(1);
  if (existing.length > 0) return Number(existing[0].id);

  const ins = await db.insert(warehouses).values({
    code: seed.code,
    name: seed.name,
    type: seed.type,
    isActive: true,
    createdAt: getNow(),
    updatedAt: getNow(),
  });
  return Number(getInsertId(ins));
}

/** Resolve (self-seeding) the QC sample warehouse id (analysis samples). */
export async function getOrCreateQcWarehouse(db: DbClient): Promise<number> {
  return getOrCreateWarehouseByType(db, QC_WAREHOUSE_TYPE, QC_WAREHOUSE_SEED);
}

/** Resolve (self-seeding) the retention (ตัวแทน Lot) sample room id. */
export async function getOrCreateRetentionWarehouse(db: DbClient): Promise<number> {
  return getOrCreateWarehouseByType(db, RETENTION_WAREHOUSE_TYPE, RETENTION_WAREHOUSE_SEED);
}

/** Resolve (self-seeding) the stability sample room id. */
export async function getOrCreateStabilityWarehouse(db: DbClient): Promise<number> {
  return getOrCreateWarehouseByType(db, STABILITY_WAREHOUSE_TYPE, STABILITY_WAREHOUSE_SEED);
}

// The item-type → warehouse-type rule itself lives in lib/utils so the receive
// dialog can apply the same routing in the browser (this file imports drizzle
// and must stay server-only). Re-exported so existing server callers/tests keep
// importing it from here.
export { warehouseTypeForItemType };

const WAREHOUSE_SEEDS_BY_TYPE: Record<string, SeedSpec> = {
  raw_material: { code: 'WH-RM', name: 'คลังวัตถุดิบ', type: 'raw_material' },
  finished_goods: { code: 'WH-FG', name: 'คลังสินค้าสำเร็จรูป', type: 'finished_goods' },
};

/**
 * Resolve (self-seeding) the destination warehouse id for a given item `type`.
 * Used by the goods-receipt release flow so a finished-goods receipt lands in
 * the Finished Goods warehouse and a raw-material receipt in Raw Material,
 * regardless of what the GRN header defaulted to.
 */
export async function resolveDestinationWarehouseByItemType(
  db: DbClient,
  itemType: string | null | undefined,
): Promise<number> {
  const whType = warehouseTypeForItemType(itemType);
  const seed = WAREHOUSE_SEEDS_BY_TYPE[whType] ?? WAREHOUSE_SEEDS_BY_TYPE.raw_material;
  return getOrCreateWarehouseByType(db, whType, seed);
}
