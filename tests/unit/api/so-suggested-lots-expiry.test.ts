/**
 * The sales order screen must not offer expired stock.
 *
 * issueMaterial refuses an expired lot, but refusing at the last click is not
 * the same as not offering it. Three things went wrong together here:
 *
 *  1. suggestedLots is sorted FEFO (nearest expiry first), so an expired lot
 *     was offered as the FIRST choice every time.
 *  2. availableStock summed stock that can never legally leave.
 *  3. canFulfill therefore promised a delivery the system would then refuse.
 *
 * UAT holds 4 expired lots still marked 'released', so this was live.
 *
 * The warehouse FEFO helper (getAvailableLots) already filtered expiry in SQL;
 * this screen was the one path that did not. These tests pin both to the same
 * rule so they cannot drift apart again.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { isLotExpired } from '@/lib/utils/lot-expiry';

const strip = (p: string) =>
  readFileSync(join(process.cwd(), p), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const DETAIL = strip('src/app/api/sales/orders/[id]/detail/route.ts');
const INVENTORY = strip('src/lib/services/inventory.service.ts');

describe('sales order detail — expired lots are dropped, not just refused later', () => {
  it('filters expired lots out of the candidate list', () => {
    expect(DETAIL).toMatch(/\.filter\([\s\S]*!isLotExpired\(lot\.expiryDate\)\)/);
  });

  it('uses the shared rule rather than its own date maths', () => {
    // A second, hand-rolled comparison here is how the two paths drifted apart
    // in the first place.
    expect(DETAIL).toMatch(/import \{ isLotExpired \} from '@\/lib\/utils\/lot-expiry'/);
    expect(DETAIL).not.toMatch(/new Date\(\) *[<>]|Date\.now\(\) *[<>]/);
  });

  it('the array that gets summed is itself the filtered one', () => {
    // Otherwise availableStock counts stock that cannot ship, and canFulfill
    // promises a delivery issueMaterial will reject.
    //
    // Checking only that `isLotExpired` appears somewhere above the sum is not
    // enough: the filter could be applied to a SEPARATE array while the sum
    // still reads the unfiltered one. So take the actual statement that builds
    // `releasedLots` and require the expiry filter to be inside it.
    const from = DETAIL.indexOf('const releasedLots');
    expect(from).toBeGreaterThan(-1);
    const decl = DETAIL.slice(from, DETAIL.indexOf('const totalAvailable', from));
    expect(decl).toMatch(/!isLotExpired\(lot\.expiryDate\)/);

    // And the sum must read that same variable.
    const sumLine = DETAIL.slice(DETAIL.indexOf('const totalAvailable'));
    expect(sumLine.slice(0, 160)).toMatch(/releasedLots\.reduce/);
  });

  it('feeds the same filtered list to suggestedLots', () => {
    // suggestedLots slices releasedLots — the filtered array — not the raw one.
    expect(DETAIL).toMatch(/suggestedLots: releasedLots/);
  });
});

describe('the warehouse FEFO helper keeps its own expiry filter', () => {
  it('excludes expired lots in SQL for both dialects', () => {
    expect(INVENTORY).toMatch(/expiryDate\} IS NULL OR .*date\('now'\)/);
    expect(INVENTORY).toMatch(/expiryDate\} IS NULL OR .*CURDATE\(\)/);
  });

  it('treats an undated lot as usable — same rule as isLotExpired', () => {
    // Both sides must agree that NULL expiry means "no expiry", not "expired".
    expect(INVENTORY).toMatch(/IS NULL OR/);
    expect(isLotExpired(null)).toBe(false);
  });
});

describe('the rule the screen now applies, exercised for real', () => {
  // Mirrors the filter in the route, so the behaviour is asserted rather than
  // just the source text.
  const keep = (lots: Array<{ lotNumber: string; expiryDate: string | null }>) =>
    lots.filter((l) => !isLotExpired(l.expiryDate)).map((l) => l.lotNumber);

  it('drops the expired ones and keeps the rest', () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0];
    const nextYear = new Date(Date.now() + 365 * 86_400_000).toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];

    expect(
      keep([
        { lotNumber: 'EXPIRED', expiryDate: yesterday },
        { lotNumber: 'GOOD', expiryDate: nextYear },
        { lotNumber: 'TODAY', expiryDate: today },
        { lotNumber: 'UNDATED', expiryDate: null },
      ]),
    ).toEqual(['GOOD', 'TODAY', 'UNDATED']);
  });

  it('would have dropped the real UAT lot that shipped expired', () => {
    // RM-0001-260611-451, expiry 2026-06-25, shipped 2026-06-29.
    expect(isLotExpired('2026-06-25', new Date(2026, 5, 29))).toBe(true);
  });

  it('leaves nothing to suggest when every lot is expired — better than a false promise', () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0];
    expect(keep([{ lotNumber: 'E1', expiryDate: yesterday }])).toEqual([]);
  });
});
