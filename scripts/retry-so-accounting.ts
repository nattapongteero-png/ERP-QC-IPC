/**
 * One-shot recovery: retry accounting for shipped SO deliveries that are
 * missing journal entries / AR invoices because of the VAT-unbalanced JE bug.
 *
 *   docker exec -e DATABASE_URL='mysql://...' \
 *     herbal-erp-app-dev bun run /app/scripts/retry-so-accounting.ts <so_id>
 *   docker exec -e DATABASE_URL='mysql://...' \
 *     herbal-erp-app-dev bun run /app/scripts/retry-so-accounting.ts --all
 */
import {
  retryAccountingForDelivery,
  retryAccountingForAllPendingDeliveries,
} from '../src/lib/services/sales.service';
import { getDb, isSqlite } from '../src/lib/db';
import { eq } from 'drizzle-orm';
import { sqliteSalesDeliveries, mysqlSalesDeliveries } from '../src/lib/db/schema';

const ADMIN_USER_ID = 1;

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: bun run retry-so-accounting.ts <soId|--all>');
    process.exit(1);
  }

  if (arg === '--all') {
    console.log('Sweeping all shipped deliveries with missing accounting...');
    const r = await retryAccountingForAllPendingDeliveries(ADMIN_USER_ID);
    console.log(`Scanned ${r.scanned} deliveries, fixed ${r.fixed}.`);
    for (const d of r.results) {
      console.log(`  delivery #${d.deliveryId} ${d.deliveryNumber}: ${d.message}`);
    }
    return;
  }

  const soId = parseInt(arg);
  if (isNaN(soId)) {
    console.error(`Invalid soId: ${arg}`);
    process.exit(1);
  }

  const db = (await getDb()) as any;
  const dt = isSqlite() ? sqliteSalesDeliveries : mysqlSalesDeliveries;
  const deliveries = await db
    .select({ id: dt.id, deliveryNumber: dt.deliveryNumber })
    .from(dt)
    .where(eq(dt.soId, soId));
  if (deliveries.length === 0) {
    console.log(`SO #${soId} has no deliveries.`);
    return;
  }
  for (const d of deliveries) {
    try {
      const r = await retryAccountingForDelivery(d.id, ADMIN_USER_ID);
      console.log(`delivery #${d.id} ${d.deliveryNumber}: ${r.message}`);
      if (r.salesJournalEntryNumber)
        console.log(`  → Sales JE: ${r.salesJournalEntryNumber}`);
      if (r.cogsJournalEntryNumber)
        console.log(`  → COGS JE: ${r.cogsJournalEntryNumber}`);
      if (r.taxInvoiceNumber)
        console.log(`  → Tax Invoice: ${r.taxInvoiceNumber}`);
    } catch (e) {
      console.error(`delivery #${d.id}: FAILED — ${e instanceof Error ? e.message : e}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
