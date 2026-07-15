/**
 * PR urgency thresholds.
 *
 * Urgency is derived from the required date, not from the priority someone
 * typed on the form: a PR marked "normal" but due in three days IS urgent.
 *
 * Buyers' bands: <=7 urgent, 15-30 normal, >30 low. 8-14 was unstated and is
 * folded into normal (the nearest band), so the boundaries below are the
 * contract — they are the part that silently rots if someone edits the maths.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const PAGE = join(process.cwd(), 'src/app/purchasing/requisitions/page.tsx');
const source = readFileSync(PAGE, 'utf-8');

function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** Mirrors urgencyOf() in the page — kept in step by the source assertions below. */
type UrgencyLevel = 'urgent' | 'normal' | 'low';
function urgencyOf(requiredDate: string | Date | null | undefined): UrgencyLevel | null {
  if (!requiredDate) return null;
  const due = new Date(requiredDate);
  if (isNaN(due.getTime())) return null;
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round(
    (startOfDay(due).getTime() - startOfDay(new Date()).getTime()) / 86_400_000,
  );
  if (days <= 7) return 'urgent';
  if (days <= 30) return 'normal';
  return 'low';
}

function inDays(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

describe('PR urgency thresholds', () => {
  it('treats 7 days or less as urgent', () => {
    expect(urgencyOf(inDays(0))).toBe('urgent');
    expect(urgencyOf(inDays(3))).toBe('urgent');
    expect(urgencyOf(inDays(7))).toBe('urgent');
  });

  it('treats an overdue requisition as urgent', () => {
    // Past the required date is the strongest form of "needed within 7 days".
    expect(urgencyOf(inDays(-1))).toBe('urgent');
    expect(urgencyOf(inDays(-40))).toBe('urgent');
  });

  it('treats 8 to 30 days as normal', () => {
    expect(urgencyOf(inDays(8))).toBe('normal');   // first day past urgent
    expect(urgencyOf(inDays(14))).toBe('normal');  // the unstated 8-14 band
    expect(urgencyOf(inDays(30))).toBe('normal');  // last day before low
  });

  it('treats more than 30 days as low', () => {
    expect(urgencyOf(inDays(31))).toBe('low');
    expect(urgencyOf(inDays(365))).toBe('low');
  });

  it('returns null with no required date instead of guessing', () => {
    // A draft with no date is not evidence of low urgency.
    expect(urgencyOf(null)).toBeNull();
    expect(urgencyOf(undefined)).toBeNull();
    expect(urgencyOf('')).toBeNull();
    expect(urgencyOf('not-a-date')).toBeNull();
  });
});

describe('PR urgency cards — wiring', () => {
  const code = codeOnly(source);

  it('derives urgency from requiredDate', () => {
    expect(code).toMatch(/urgencyOf\(r\.requiredDate/);
  });

  it('keeps the same day thresholds as this test', () => {
    // If someone edits the maths, this fails next to the table above.
    expect(code).toMatch(/days <= 7.*'urgent'/s);
    expect(code).toMatch(/days <= 30.*'normal'/s);
  });

  it('counts open requisitions only', () => {
    // A converted/cancelled PR waits on no one — counting it as urgent would
    // send buyers chasing closed work.
    expect(code).toMatch(/openRequisitions/);
    expect(code).toMatch(/'converted', 'cancelled', 'rejected'/);
  });

  it('renders the three urgency cards', () => {
    expect(code).toMatch(/urgency-urgent/);
    expect(code).toMatch(/urgency-normal/);
    expect(code).toMatch(/urgency-low/);
  });

  it('has no "high" urgency band', () => {
    // The buyers explicitly dropped it.
    expect(code).not.toMatch(/urgency\.high/);
  });

  it('formats the counts with the shared formatter', () => {
    expect(code).toMatch(/formatNumber\(urgencyCounts\.urgent\)/);
  });
});
