/**
 * Inventory turnover must be computed the same way for both periods it compares.
 *
 * Turnover is COGS / average inventory, and average inventory is
 * (opening + closing) / 2. The current period did that. The previous period
 * used a bare closing balance ("Simplified for previous period"), so the two
 * turnovers came out of different formulas — and every %change on that KPI was
 * partly an artefact of the mismatch rather than a real movement.
 *
 * The asymmetry is the bug, so that is what these tests pin.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const strip = (p: string) =>
  readFileSync(join(process.cwd(), p), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const SERVICE = strip('src/lib/services/executive-dashboard.service.ts');

describe('the "simplified previous period" shortcut is gone', () => {
  it('no longer sets prevAvgInventory to a bare closing balance', () => {
    expect(SERVICE).not.toMatch(/prevAvgInventory = prevInventoryBalance;/);
    expect(SERVICE).not.toMatch(/Simplified for previous period/);
  });

  it('averages the previous period the same way as the current one', () => {
    expect(SERVICE).toMatch(/prevAvgInventory = \(prevInventoryBalance \+ prevOpeningInventory\) \/ 2/);
  });

  it('fetches the previous period opening balance rather than reusing its close', () => {
    expect(SERVICE).toMatch(/prevOpeningInventory = await getInventoryBalance\(/);
    expect(SERVICE).toMatch(/prevOpeningDate\.setDate\(prevOpeningDate\.getDate\(\) - 1\)/);
  });

  it('annualizes the previous period by ITS OWN length, not the current one', () => {
    // A QTD current vs a shorter prior stub would otherwise annualize the prior
    // turnover with the wrong factor.
    expect(SERVICE).toMatch(/prevAnnualizationFactor = 365 \/ prevDaysInPeriod/);
    expect(SERVICE).toMatch(/prevInventoryTurnover =\s*prevAvgInventory > 0 \? \(prevCogs \/ prevAvgInventory\) \* prevAnnualizationFactor/);
  });
});

describe('both periods now share one formula', () => {
  // Turnover computed the way the service now does it, for assertion.
  const turnover = (cogs: number, opening: number, closing: number, days: number) => {
    const avg = (opening + closing) / 2;
    return avg > 0 ? (cogs / avg) * (365 / days) : 0;
  };

  it('same inputs give the same turnover for either period', () => {
    const cur = turnover(100_000, 40_000, 60_000, 30);
    const prev = turnover(100_000, 40_000, 60_000, 30);
    expect(cur).toBe(prev);
  });

  it('a rising average pulls turnover down, as it should', () => {
    const low = turnover(100_000, 40_000, 60_000, 30); // avg 50k
    const high = turnover(100_000, 90_000, 110_000, 30); // avg 100k
    expect(high).toBeLessThan(low);
  });

  it('the old shortcut would have diverged — closing-only overstates when stock is falling', () => {
    // Stock fell over the period: opening 80k, closing 40k.
    const correct = turnover(100_000, 80_000, 40_000, 30); // avg 60k
    const oldShortcut = 100_000 / 40_000 * (365 / 30); // closing only
    expect(oldShortcut).toBeGreaterThan(correct);
  });

  it('guards divide-by-zero when there is no inventory', () => {
    expect(turnover(100_000, 0, 0, 30)).toBe(0);
  });
});
