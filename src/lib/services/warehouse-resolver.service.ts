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

// The transactional db handle threaded from executeDbOperation is untyped (any)
// across this codebase; match that convention here.
type DbClient = any;

/** Warehouse type that holds QC-drawn samples (the "ชั้นวาง/คลังตัวอย่าง QC"). */
export const QC_WAREHOUSE_TYPE = 'qc';

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

/** Resolve (self-seeding) the QC sample warehouse id. */
export async function getOrCreateQcWarehouse(db: DbClient): Promise<number> {
  return getOrCreateWarehouseByType(db, QC_WAREHOUSE_TYPE, QC_WAREHOUSE_SEED);
}
