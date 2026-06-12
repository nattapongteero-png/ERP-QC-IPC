/**
 * One-shot backfill: create the auto-Goods-Receipt for purchase orders that
 * advanced past 'draft' before the auto-GRN trigger covered their path (e.g.
 * POs received via the legacy /receive endpoint, which skipped GRN creation).
 *
 * Idempotent — autoCreateGrnForSource skips any PO that already has a GRN.
 *
 *   docker exec -e DATABASE_URL='mysql://...' \
 *     herbal-erp-app-dev bun run /app/scripts/backfill-po-grn.ts 1 5
 *   docker exec -e DATABASE_URL='mysql://...' \
 *     herbal-erp-app-dev bun run /app/scripts/backfill-po-grn.ts --all
 */
import { autoCreateGrnForSource } from '../src/lib/services/goods-receipt.service';
import { getDb, isSqlite } from '../src/lib/db';
import { inArray } from 'drizzle-orm';
import { sqlitePurchaseOrders, mysqlPurchaseOrders } from '../src/lib/db/schema';

const ADMIN_USER_ID = 1;
// Statuses that should already have a GRN (anything past draft/pending).
const ADVANCED = ['approved', 'sent', 'partial', 'received'];

async function resolveTargetPoIds(): Promise<number[]> {
  const db = (await getDb()) as any;
  const po = isSqlite() ? sqlitePurchaseOrders : mysqlPurchaseOrders;
  const rows = await db
    .select({ id: po.id, status: po.status })
    .from(po)
    .where(inArray(po.status, ADVANCED));
  return rows.map((r: { id: number }) => Number(r.id));
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: bun run backfill-po-grn.ts <poId...> | --all');
    process.exit(1);
  }

  const poIds =
    args[0] === '--all'
      ? await resolveTargetPoIds()
      : args.map((a) => parseInt(a)).filter((n) => Number.isFinite(n));

  console.log(`Backfilling GRN for PO ids: ${poIds.join(', ') || '(none)'}`);
  for (const poId of poIds) {
    try {
      const r = await autoCreateGrnForSource({ sourceType: 'po', poId, userId: ADMIN_USER_ID });
      console.log(
        `  PO #${poId}: ${r.created ? `created GRN #${r.grnId}` : r.grnId ? `already has GRN #${r.grnId}` : 'no warehouse / skipped'}`,
      );
    } catch (err) {
      console.error(`  PO #${poId}: FAILED`, err instanceof Error ? err.message : err);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
