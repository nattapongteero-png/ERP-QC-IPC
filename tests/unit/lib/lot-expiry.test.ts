/**
 * The expiry rule, exercised as real logic rather than by grepping source.
 *
 * Why this matters: UAT shipped a lot four days past its expiry date
 * (DL-202606-0002), and two more expired issues went out through production
 * and material withdrawal. Every path checked lot status and quantity; none
 * checked the date.
 */

import { describe, it, expect } from 'vitest';
import { daysUntilExpiry, isLotExpired, isLotExpiringSoon } from '@/lib/utils/lot-expiry';

// A fixed "today" so these tests do not rot as the calendar moves.
const TODAY = new Date(2026, 6, 16); // 2026-07-16, local

describe('daysUntilExpiry', () => {
  it('counts whole days ahead', () => {
    expect(daysUntilExpiry(new Date(2026, 6, 26), TODAY)).toBe(10);
  });

  it('goes negative once the date has passed', () => {
    expect(daysUntilExpiry(new Date(2026, 6, 12), TODAY)).toBe(-4);
  });

  it('is 0 on the expiry date itself', () => {
    expect(daysUntilExpiry(new Date(2026, 6, 16), TODAY)).toBe(0);
  });

  it('returns null when there is no date — unknown is not zero', () => {
    expect(daysUntilExpiry(null, TODAY)).toBeNull();
    expect(daysUntilExpiry(undefined, TODAY)).toBeNull();
    expect(daysUntilExpiry('', TODAY)).toBeNull();
  });

  it('returns null on an unparseable date rather than NaN', () => {
    expect(daysUntilExpiry('not-a-date', TODAY)).toBeNull();
  });

  it('reads SQLite string dates and MySQL Date objects alike', () => {
    // The dual-schema pattern hands us both shapes.
    expect(daysUntilExpiry('2026-07-26', TODAY)).toBe(10);
    expect(daysUntilExpiry(new Date(2026, 6, 26), TODAY)).toBe(10);
  });
});

describe('isLotExpired', () => {
  it('blocks a lot whose date has passed', () => {
    expect(isLotExpired(new Date(2026, 6, 12), TODAY)).toBe(true);
  });

  it('allows a lot on its final day — it is good until the day ends', () => {
    // The bug this guards: comparing timestamps would fail the same lot at
    // 14:00 that passed at 09:00 on its expiry date.
    expect(isLotExpired(new Date(2026, 6, 16), TODAY)).toBe(false);
  });

  it('is time-of-day independent on the expiry date', () => {
    // The lot expires at 00:00 on the 16th — i.e. the date field says "16th"
    // and carries no meaningful time, which is how these rows actually look.
    // A timestamp comparison would call it expired from 00:01 onward; whole-day
    // comparison keeps it good all day, which is what the label means.
    const expiry = new Date(2026, 6, 16);
    for (const hour of [0, 9, 14, 23]) {
      expect(
        isLotExpired(expiry, new Date(2026, 6, 16, hour, 30)),
        `at ${hour}:30 on its expiry date`,
      ).toBe(false);
    }
  });

  it('counts days by the calendar, not by 24-hour spans', () => {
    // Guards the tempting rewrite `(exp - now) / 86400000`: a lot dated the
    // 17th, checked at 23:00 on the 16th, is 1 calendar day away but only
    // ~1 hour of elapsed time — the timestamp form would round that to 0
    // and, a few hours later, to a negative "expired".
    expect(daysUntilExpiry(new Date(2026, 6, 17), new Date(2026, 6, 16, 23, 0))).toBe(1);
    expect(daysUntilExpiry(new Date(2026, 6, 16), new Date(2026, 6, 16, 23, 0))).toBe(0);
    expect(daysUntilExpiry(new Date(2026, 6, 15), new Date(2026, 6, 16, 1, 0))).toBe(-1);
  });

  it('allows a lot expiring tomorrow', () => {
    expect(isLotExpired(new Date(2026, 6, 17), TODAY)).toBe(false);
  });

  it('does NOT block an undated lot — a blank field is a data gap, not a hazard', () => {
    // Halting the factory over a missing field would be the wrong trade.
    expect(isLotExpired(null, TODAY)).toBe(false);
    expect(isLotExpired(undefined, TODAY)).toBe(false);
  });

  it('blocks the exact lot UAT let through (expired 4 days at ship time)', () => {
    // DL-202606-0002 shipped RM-0001-260611-451, expiry 2026-06-25, on 06-29.
    const shipDate = new Date(2026, 5, 29);
    expect(isLotExpired('2026-06-25', shipDate)).toBe(true);
  });
});

describe('isLotExpiringSoon', () => {
  it('flags a lot inside the window', () => {
    expect(isLotExpiringSoon(new Date(2026, 6, 26), 30, TODAY)).toBe(true);
  });

  it('does not flag one beyond the window', () => {
    expect(isLotExpiringSoon(new Date(2026, 8, 30), 30, TODAY)).toBe(false);
  });

  it('does not call an ALREADY-expired lot "expiring soon" — that is a different state', () => {
    // Otherwise a banner would say "expiring soon" about stock that is gone.
    expect(isLotExpiringSoon(new Date(2026, 6, 12), 30, TODAY)).toBe(false);
  });

  it('includes the boundary day', () => {
    expect(isLotExpiringSoon(new Date(2026, 7, 15), 30, TODAY)).toBe(true);
  });

  it('says nothing about an undated lot', () => {
    expect(isLotExpiringSoon(null, 30, TODAY)).toBe(false);
  });
});
