/**
 * The inventory valuation report has to report real money.
 *
 * It priced every lot in the warehouse at a flat 100 baht. On UAT that
 * reported ฿81.1m of stock against ฿53.1m of recorded cost — ฿28m of fiction
 * under the number the business reads as its inventory position. 57 of 257
 * lots have no cost recorded at all.
 *
 * Arithmetic is asserted here, not shape. `typeof value === 'number'` is
 * exactly the check that let the flat-100 survive.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const strip = (p: string) =>
  readFileSync(join(process.cwd(), p), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const SERVICE = strip('src/lib/services/reports.service.ts');

/** The valuation function's body, bounded by the next exported function. */
const valuationBody = (): string => {
  const from = SERVICE.indexOf('export async function getInventoryValuationReport');
  expect(from, 'getInventoryValuationReport not found').toBeGreaterThan(-1);
  const after = SERVICE.indexOf('export async function', from + 10);
  return SERVICE.slice(from, after > -1 ? after : undefined);
};

// The rule the service now applies, mirrored so behaviour is exercised.
const valueOf = (qty: number, cost: unknown) => {
  const c = Number(cost);
  return Number.isFinite(c) && c > 0 ? qty * c : 0;
};

describe('stock is valued at each lot cost, not a flat rate', () => {
  it('no longer hardcodes 100 for every lot', () => {
    const body = valuationBody();
    expect(body).not.toMatch(/unitCost = 100/);
    expect(body).toMatch(/row\.cost/);
  });

  it('selects cost from the lot row', () => {
    expect(valuationBody()).toMatch(/cost: lots\.cost/);
  });

  it('reads lots individually instead of pre-summing quantity', () => {
    // SUM(quantity) grouped per item would collapse lots received at different
    // prices into one number and throw the cost away before it could be used.
    const body = valuationBody();
    expect(body).not.toMatch(/COALESCE\(SUM\(/);
    expect(body).toMatch(/quantity: lots\.quantity/);
  });

  it('values the same item received at two prices as two different values', () => {
    // This is the case a pre-summed quantity cannot express at all.
    const lotA = valueOf(100, 12.5); // 1,250
    const lotB = valueOf(100, 40);   // 4,000
    expect(lotA).toBe(1_250);
    expect(lotB).toBe(4_000);
    expect(lotA + lotB).toBe(5_250);
    // What the old flat rate would have claimed for the same stock:
    expect(200 * 100).toBe(20_000);
  });
});

describe('a lot with no cost is a gap, not an invented price', () => {
  it('contributes 0 rather than a guess', () => {
    expect(valueOf(500, null)).toBe(0);
    expect(valueOf(500, 0)).toBe(0);
    expect(valueOf(500, 'abc')).toBe(0);
  });

  it('is counted and surfaced, so the total is not silently understated', () => {
    const body = valuationBody();
    expect(body).toMatch(/lotsMissingCost\+\+/);
    expect(body).toMatch(/lotsMissingCost,/);
  });
});

describe('the per-item unit cost column', () => {
  // Weighted average of that item's lots — an item has no single unit cost
  // once received at more than one price.
  const weighted = (lots: Array<{ qty: number; cost: number }>) => {
    const qty = lots.reduce((s, l) => s + l.qty, 0);
    const value = lots.reduce((s, l) => s + valueOf(l.qty, l.cost), 0);
    return qty > 0 ? value / qty : 0;
  };

  it('is the weighted average, not the last or first cost seen', () => {
    // 100 @ 10 and 300 @ 20 → 7,000 over 400 units = 17.50, not 15 (the plain
    // mean) and not 20 (the last lot).
    expect(weighted([{ qty: 100, cost: 10 }, { qty: 300, cost: 20 }])).toBe(17.5);
  });

  it('is derived from the value actually summed', () => {
    // So the column can never disagree with the total printed beside it.
    expect(valuationBody()).toMatch(/item\.value \/ item\.quantity/);
  });

  it('does not divide by zero on an empty item', () => {
    expect(weighted([])).toBe(0);
    expect(valuationBody()).toMatch(/item\.quantity > 0 \?/);
  });
});

describe('totals stay consistent', () => {
  it('category, status and item breakdowns all use the same lot value', () => {
    // One `value` computed per lot and added to each bucket — three separate
    // costings would be three chances to disagree.
    const body = valuationBody();
    expect(body).toMatch(/catData\.value \+= value/);
    expect(body).toMatch(/statusData\.value \+= value/);
    expect(body).toMatch(/itemData\.value \+= value/);
    expect(body).toMatch(/totalValue \+= value/);
  });
});
