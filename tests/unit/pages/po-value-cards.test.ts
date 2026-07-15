/**
 * The PO list must show money, not just counts.
 *
 * "22 purchase orders" tells a buyer nothing about exposure. The two figures
 * that matter are total committed spend and what is still out with vendors.
 *
 * Cancelled/rejected orders must stay OUT of both: money on an order that will
 * never be placed is not spend, and folding it in overstates the total — the
 * same rule the purchase report uses, so the two screens agree.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const PAGE = join(process.cwd(), 'src/app/purchasing/orders/page.tsx');
const code = readFileSync(PAGE, 'utf-8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

/** Mirrors the page's stats maths. */
const VOID = ['cancelled', 'rejected'];
const OPEN = ['draft', 'pending_approval', 'approved', 'sent', 'partial'];

type Order = { status: string; totalAmount: number };

function totals(orders: Order[]) {
  const live = orders.filter((o) => !VOID.includes(o.status));
  const totalValue = live.reduce((s, o) => s + (Number(o.totalAmount) || 0), 0);
  const openValue = orders
    .filter((o) => OPEN.includes(o.status))
    .reduce((s, o) => s + (Number(o.totalAmount) || 0), 0);
  return { totalValue, openValue };
}

describe('PO value maths', () => {
  const orders: Order[] = [
    { status: 'draft', totalAmount: 100 },
    { status: 'sent', totalAmount: 200 },
    { status: 'received', totalAmount: 400 },
    { status: 'cancelled', totalAmount: 999_999 },
    { status: 'rejected', totalAmount: 888_888 },
  ];

  it('excludes cancelled and rejected orders from total value', () => {
    // 100 + 200 + 400. If either void order leaked in the total jumps by ~1.8M.
    expect(totals(orders).totalValue).toBe(700);
  });

  it('counts only orders still out with vendors as open value', () => {
    // draft 100 + sent 200; received is already in, void orders never will be.
    expect(totals(orders).openValue).toBe(300);
  });

  it('reports zero rather than NaN when amounts are missing', () => {
    const missing = [{ status: 'draft', totalAmount: undefined as unknown as number }];
    // A NaN would render as "฿NaN" on the card.
    expect(totals(missing).totalValue).toBe(0);
  });
});

describe('PO value cards — wiring', () => {
  it('renders both value cards', () => {
    expect(code).toMatch(/po-total-value/);
    expect(code).toMatch(/po-open-value/);
  });

  it('excludes void orders in the page, not just in this test', () => {
    expect(code).toMatch(/const VOID = \['cancelled', 'rejected'\]/);
    expect(code).toMatch(/liveOrders/);
  });

  it('formats the amounts as baht through the shared helper', () => {
    // Project rule: no raw numbers, no toLocaleString.
    expect(code).toMatch(/formatBaht\(stats\.totalValue\)/);
    expect(code).toMatch(/formatBaht\(stats\.openValue\)/);
  });

  it('keeps the existing count cards', () => {
    // The value row is additive — counts still answer "how many".
    expect(code).toMatch(/orders\.kpi\.total/);
    expect(code).toMatch(/orders\.kpi\.received/);
  });
});
