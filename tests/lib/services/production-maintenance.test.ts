/**
 * Maintenance interval maths and due status.
 *
 * These decide when a GMP maintenance job is reported as overdue, so the edges
 * (month rollover, leap day, "due exactly today", alert window boundary) are
 * pinned rather than assumed.
 */
import { describe, it, expect } from 'vitest';
import { addInterval, dueStatusOf } from '@/lib/services/production-maintenance.service';

describe('addInterval', () => {
  it('adds days', () => {
    expect(addInterval('2026-08-04', 'days', 30)).toBe('2026-09-03');
  });

  it('adds weeks', () => {
    expect(addInterval('2026-08-04', 'weeks', 2)).toBe('2026-08-18');
  });

  it('adds months across a year boundary', () => {
    expect(addInterval('2026-11-15', 'months', 3)).toBe('2027-02-15');
  });

  it('handles a leap day', () => {
    expect(addInterval('2028-02-29', 'days', 1)).toBe('2028-03-01');
  });

  it('supports a negative offset (used for the alert window)', () => {
    expect(addInterval('2026-08-04', 'days', -7)).toBe('2026-07-28');
  });

  it('pads month and day to two digits', () => {
    expect(addInterval('2026-01-05', 'days', 1)).toBe('2026-01-06');
  });
});

describe('dueStatusOf', () => {
  const TODAY = '2026-08-04';

  it('is overdue when the due date has passed', () => {
    expect(dueStatusOf('2026-08-03', 7, true, TODAY)).toBe('overdue');
  });

  it('is due_today on the due date exactly', () => {
    expect(dueStatusOf('2026-08-04', 7, true, TODAY)).toBe('due_today');
  });

  it('is due_soon inside the alert window', () => {
    // alert 7 days before 2026-08-10 → warns from 2026-08-03
    expect(dueStatusOf('2026-08-10', 7, true, TODAY)).toBe('due_soon');
  });

  it('is ok before the alert window opens', () => {
    expect(dueStatusOf('2026-09-30', 7, true, TODAY)).toBe('ok');
  });

  it('opens the alert window exactly alertDaysBefore ahead, inclusive', () => {
    // due 2026-08-11 with a 7-day window warns from 2026-08-04 — which is TODAY,
    // so the first day of the window already counts as due_soon.
    expect(dueStatusOf('2026-08-11', 7, true, TODAY)).toBe('due_soon');
    // one day further out is still outside a 7-day window
    expect(dueStatusOf('2026-08-12', 7, true, TODAY)).toBe('ok');
  });

  it('reports inactive plans as inactive regardless of date', () => {
    expect(dueStatusOf('2020-01-01', 7, false, TODAY)).toBe('inactive');
  });

  it('is ok when no due date is set', () => {
    expect(dueStatusOf(null, 7, true, TODAY)).toBe('ok');
    expect(dueStatusOf(undefined, 7, true, TODAY)).toBe('ok');
  });

  it('tolerates a datetime value, not just YYYY-MM-DD', () => {
    expect(dueStatusOf('2026-08-03T00:00:00.000Z', 7, true, TODAY)).toBe('overdue');
  });

  it('handles a zero alert window — warns only on the day itself', () => {
    expect(dueStatusOf('2026-08-05', 0, true, TODAY)).toBe('ok');
    expect(dueStatusOf('2026-08-04', 0, true, TODAY)).toBe('due_today');
  });
});
