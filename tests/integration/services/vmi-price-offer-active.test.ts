/**
 * VMI Price-Offer Activation — Timezone Bug Regression Test
 *
 * Price-offer effective/expiry values are whole calendar days stored at midnight
 * UTC. The old code compared them against the current instant, so an offer whose
 * effectiveDate is "today" was dropped from the price sync during the hours
 * before midnight-UTC (e.g. before 07:00 in Thailand, UTC+7) — the offer showed
 * "ไม่ใช้งาน" and never synced.
 *
 * This test seeds offers with effective dates of yesterday / today / tomorrow and
 * asserts getPriceItems() (via the price sync) includes exactly the ones whose
 * day window covers today, regardless of the time of day the test runs.
 *
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

process.env.DB_TYPE = 'sqlite';
process.env.SQLITE_DB_PATH = ':memory:';

import { initializeDatabase, getDb } from '@/lib/db';
import { getTableRef } from '@/lib/db/db-helper';
import { vmiSyncService } from '@/lib/services/vmi-sync.service';

// Access the private getPriceItems via a typed cast — we test the query logic
// directly rather than the whole portal round-trip.
const svc = vmiSyncService as unknown as {
  getPriceItems(itemIds: number[] | undefined): Promise<Array<{ id: number; code: string; unitPrice: number }>>;
};

// YYYY-MM-DD midnight-UTC string for a day offset from the current Thai day.
// Mirrors how the app stores effectiveDate (parseDbDate(new Date("YYYY-MM-DD"))).
function dayOffsetIso(offset: number): string {
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000); // shift to Thai local
  const ms = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset);
  return new Date(ms).toISOString();
}

let itemSeq = 0;
async function seedVmiItemWithOffer(opts: {
  effectiveOffset: number;
  expiryOffset?: number | null;
  isActive?: boolean;
  unitPrice?: number;
}): Promise<{ itemId: number; code: string }> {
  const db = (await getDb()) as any;
  const items = getTableRef('items');
  const offers = getTableRef('VMIPriceOffers');
  const vendors = getTableRef('vendors');

  itemSeq += 1;
  const code = `VMI-TEST-${String(itemSeq).padStart(3, '0')}`;

  // Ensure a SELF vendor exists.
  let vendorRows = await db.select().from(vendors).limit(1);
  if (vendorRows.length === 0) {
    await db.insert(vendors).values({
      code: 'SELF', name: 'Self', isApproved: true, isVmi: true, isActive: true,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    vendorRows = await db.select().from(vendors).limit(1);
  }
  const vendorId = vendorRows[0].id;

  const insertItem = await db.insert(items).values({
    code, nameTh: `สินค้า ${code}`, nameEn: code, type: 'finished_goods',
    category: 'herbal', primaryUnit: 'แคปซูล', vmiSyncEnabled: true, isActive: true,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  }).returning();
  const itemId = insertItem[0].id;

  await db.insert(offers).values({
    vendorId, itemId,
    unitPrice: String(opts.unitPrice ?? 100),
    effectiveDate: dayOffsetIso(opts.effectiveOffset),
    expiryDate: opts.expiryOffset == null ? null : dayOffsetIso(opts.expiryOffset),
    isActive: opts.isActive ?? true,
    syncStatus: 'pending',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });

  return { itemId, code };
}

async function clearAll() {
  const db = (await getDb()) as any;
  await db.delete(getTableRef('VMIPriceOffers'));
  await db.delete(getTableRef('items'));
}

describe('VMI price-offer activation (date-only, timezone-safe)', () => {
  beforeAll(async () => {
    await initializeDatabase();
  });
  beforeEach(async () => {
    await clearAll();
  });

  it('includes an offer whose effective date is TODAY (the timezone bug)', async () => {
    const { itemId } = await seedVmiItemWithOffer({ effectiveOffset: 0 });
    const priced = await svc.getPriceItems([itemId]);
    expect(priced.map((p) => p.id)).toContain(itemId);
  });

  it('includes an offer effective YESTERDAY', async () => {
    const { itemId } = await seedVmiItemWithOffer({ effectiveOffset: -1 });
    const priced = await svc.getPriceItems([itemId]);
    expect(priced.map((p) => p.id)).toContain(itemId);
  });

  it('excludes an offer effective TOMORROW (not yet active)', async () => {
    const { itemId } = await seedVmiItemWithOffer({ effectiveOffset: 1 });
    const priced = await svc.getPriceItems([itemId]);
    expect(priced.map((p) => p.id)).not.toContain(itemId);
  });

  it('excludes an offer that expired YESTERDAY', async () => {
    const { itemId } = await seedVmiItemWithOffer({ effectiveOffset: -5, expiryOffset: -1 });
    const priced = await svc.getPriceItems([itemId]);
    expect(priced.map((p) => p.id)).not.toContain(itemId);
  });

  it('includes an offer expiring TODAY (still valid through the day)', async () => {
    const { itemId } = await seedVmiItemWithOffer({ effectiveOffset: -5, expiryOffset: 0 });
    const priced = await svc.getPriceItems([itemId]);
    expect(priced.map((p) => p.id)).toContain(itemId);
  });

  it('excludes an inactive offer even if effective today', async () => {
    const { itemId } = await seedVmiItemWithOffer({ effectiveOffset: 0, isActive: false });
    const priced = await svc.getPriceItems([itemId]);
    expect(priced.map((p) => p.id)).not.toContain(itemId);
  });
});
