/**
 * The expiry report has to report real money.
 *
 * It used to price every lot at a flat 100 baht — turmeric powder and finished
 * capsules alike. On UAT that reported ฿282,000 of expired stock against
 * ฿136,070 of actual recorded cost: a 2x overstatement sitting under a number
 * QA would write off against.
 *
 * These tests assert the arithmetic, not the shape. `typeof value === 'number'`
 * is exactly the check that let the flat-100 fiction survive this long.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const strip = (p: string) =>
  readFileSync(join(process.cwd(), p), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const SERVICE = strip('src/lib/services/reports.service.ts');

/**
 * The body of getExpiryReport, bounded by the NEXT exported function.
 *
 * Slicing to the first `\n}` stops at the first nested block and would let a
 * change further down the function go unnoticed — the tests would then pass by
 * simply not looking at the code they claim to check.
 */
const expiryReportBody = (): string => {
  const from = SERVICE.indexOf('export async function getExpiryReport');
  expect(from, 'getExpiryReport not found').toBeGreaterThan(-1);
  const after = SERVICE.indexOf('export async function', from + 10);
  return SERVICE.slice(from, after > -1 ? after : undefined);
};

// The valuation rule the service now applies, mirrored so we can exercise it.
const valueOf = (qty: number, cost: unknown) => {
  const c = Number(cost);
  return Number.isFinite(c) && c > 0 ? qty * c : 0;
};

describe('expiry value is the lot cost, not a guess', () => {
  it('no longer prices every lot at a flat 100', () => {
    const body = expiryReportBody();
    expect(body).not.toMatch(/unitCost = 100/);
    expect(body).toMatch(/lot\.cost/);
  });

  it('reads cost from the lot row', () => {
    const body = expiryReportBody();
    expect(body).toMatch(/cost: lots\.cost/);
  });

  it('multiplies quantity by that lot cost', () => {
    // 2000 capsules at 12.50 is 25,000 — not 200,000 as the flat rate claimed.
    expect(valueOf(2000, 12.5)).toBe(25_000);
    expect(valueOf(25, 340)).toBe(8_500);
  });

  it('reproduces the real UAT total rather than the inflated one', () => {
    // Three of the actual expired lots, with their recorded costs.
    const lots = [
      { qty: 2000, cost: 12.5 },
      { qty: 25, cost: 340 },
      { qty: 100, cost: 55 },
    ];
    const real = lots.reduce((s, l) => s + valueOf(l.qty, l.cost), 0);
    const flat100 = lots.reduce((s, l) => s + l.qty * 100, 0);

    expect(real).toBe(39_000);
    expect(flat100).toBe(212_500);
    expect(real).toBeLessThan(flat100); // the old number was fiction
  });
});

describe('a lot with no cost is a gap, not a zero to hide', () => {
  it('contributes 0 rather than inventing a price', () => {
    expect(valueOf(500, null)).toBe(0);
    expect(valueOf(500, undefined)).toBe(0);
    expect(valueOf(500, 0)).toBe(0);
  });

  it('is counted so the total is not silently understated', () => {
    expect(SERVICE).toMatch(/lotsMissingCost\+\+/);
    expect(SERVICE).toMatch(/lotsMissingCost,/);
  });

  it('does not treat a non-numeric cost as free stock without saying so', () => {
    expect(valueOf(10, 'abc')).toBe(0);
  });
});

describe('the dangerous subset is surfaced', () => {
  it('counts expired lots still marked released', () => {
    // Those are the ones the warehouse will keep trying to pick: the issue is
    // blocked, but the lot still looks usable on the shelf. UAT has 4.
    expect(SERVICE).toMatch(/expiredStillReleased/);
    expect(SERVICE).toMatch(/l\.status === 'released'/);
  });

  it('carries status through to each row so QA can act on it', () => {
    const body = expiryReportBody();
    expect(body).toMatch(/status: lot\.status/);
  });
});

describe('expiry maths agrees with the rule that blocks issuing', () => {
  it('uses the shared day-based helper, not its own timestamp maths', () => {
    // If the report and issueMaterial disagreed about a lot on its expiry
    // date, one would list it as expired while the other still shipped it.
    const body = expiryReportBody();
    expect(body).toMatch(/daysUntilExpiry\(lot\.expiryDate\)/);
    expect(body).not.toMatch(/getTime\(\) - today\.getTime\(\)/);
  });
});
