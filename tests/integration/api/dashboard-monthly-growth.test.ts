/**
 * Dashboard Monthly-Growth KPI — Real Integration Test
 *
 * Guards against the regression where "การเติบโตรายเดือน" was a hardcoded
 * "+8.5%". This test seeds real sales orders across two calendar months and
 * asserts the API computes the growth percentage from actual data, and that
 * it reports null (→ UI shows "—") when there is no prior month to compare.
 *
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Use in-memory SQLite with the full auto-synced schema.
process.env.DB_TYPE = 'sqlite';
process.env.SQLITE_DB_PATH = ':memory:';

// Admin session bypasses permission checks in withAuth().
vi.mock('@/lib/auth', () => ({
  getSession: () => Promise.resolve({ userId: 1, role: 'ADMIN' }),
  isAdminRole: (role: string) => role === 'admin' || role === 'ADMIN',
}));

import { initializeDatabase, getDb } from '@/lib/db';
import { getTableRef } from '@/lib/db/db-helper';
import { GET } from '@/app/api/dashboard/route';

// Build a YYYY-MM-DD string for the Nth day of a month offset from now.
function dateInMonth(monthOffset: number, day = 15): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + monthOffset, day);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

let soSeq = 0;
async function seedSalesOrder(orderDate: string, totalAmount: number, status = 'confirmed') {
  const so = getTableRef('salesOrders');
  const db = (await getDb()) as any;
  soSeq += 1;
  await db.insert(so).values({
    soNumber: `SO-TEST-${String(soSeq).padStart(4, '0')}`,
    customerName: 'Test Customer',
    status,
    orderDate,
    totalAmount,
  });
}

async function clearSalesOrders() {
  const so = getTableRef('salesOrders');
  const db = (await getDb()) as any;
  await db.delete(so);
}

async function fetchSummary() {
  const req = new NextRequest('http://localhost/api/dashboard');
  const res = await GET(req);
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.success).toBe(true);
  return body.data.summary;
}

describe('Dashboard API — monthly growth (real data, not hardcoded)', () => {
  beforeAll(async () => {
    await initializeDatabase();
  });

  beforeEach(async () => {
    await clearSalesOrders();
  });

  it('computes growth from this month vs last month sales', async () => {
    // Last month: 100,000 ; this month: 110,000 → +10%
    await seedSalesOrder(dateInMonth(-1), 100_000);
    await seedSalesOrder(dateInMonth(0), 60_000);
    await seedSalesOrder(dateInMonth(0), 50_000);

    const summary = await fetchSummary();

    expect(summary.lastMonthSales).toBe(100_000);
    expect(summary.thisMonthSales).toBe(110_000);
    expect(summary.monthlyGrowthPercent).toBeCloseTo(10, 5);
  });

  it('reports a negative percentage when sales decline', async () => {
    await seedSalesOrder(dateInMonth(-1), 200_000);
    await seedSalesOrder(dateInMonth(0), 150_000);

    const summary = await fetchSummary();

    expect(summary.monthlyGrowthPercent).toBeCloseTo(-25, 5);
  });

  it('returns null (no fake value) when there is no prior-month baseline', async () => {
    // Only this month has sales; last month is empty → cannot compute a %.
    await seedSalesOrder(dateInMonth(0), 50_000);

    const summary = await fetchSummary();

    expect(summary.lastMonthSales).toBe(0);
    expect(summary.monthlyGrowthPercent).toBeNull();
  });

  it('excludes draft and cancelled orders from the totals', async () => {
    await seedSalesOrder(dateInMonth(-1), 100_000, 'confirmed');
    await seedSalesOrder(dateInMonth(0), 100_000, 'confirmed');
    await seedSalesOrder(dateInMonth(0), 999_999, 'draft');
    await seedSalesOrder(dateInMonth(0), 999_999, 'cancelled');

    const summary = await fetchSummary();

    expect(summary.thisMonthSales).toBe(100_000);
    expect(summary.monthlyGrowthPercent).toBeCloseTo(0, 5);
  });

  it('never returns the old hardcoded +8.5% placeholder', async () => {
    await seedSalesOrder(dateInMonth(-1), 100_000);
    await seedSalesOrder(dateInMonth(0), 100_000);

    const summary = await fetchSummary();

    // 0% growth here; the literal 8.5 must never appear from a real 0% month.
    expect(summary.monthlyGrowthPercent).not.toBe(8.5);
  });
});
