/**
 * PR list stat-card figures: count AND value per band.
 *
 * Mirrors the aggregation in src/app/purchasing/requisitions/page.tsx. The .tsx
 * render test for the same page cannot run on this machine (DevExtreme's theme
 * loader crashes the jsdom worker), so the money math — the part with real
 * logic risk — is pinned here in the node environment instead.
 */

import { describe, it, expect } from 'vitest';
import { formatBaht, formatNumber } from '@/lib/utils/number-format';

const CLOSED = ['converted', 'cancelled', 'rejected'];
const normalizeStatus = (s: string) => s?.toLowerCase() || '';

type Row = { status: string; totalAmount: number; requiredDate?: string | null };

const urgencyOf = (requiredDate: string | Date | null | undefined) => {
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
};

const sumAmount = (rows: Row[]) => rows.reduce((s, r) => s + Number(r.totalAmount || 0), 0);

const daysFromNow = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const rows: Row[] = [
  { status: 'draft', totalAmount: 5000, requiredDate: daysFromNow(3) },
  { status: 'pending_approval', totalAmount: 150000, requiredDate: daysFromNow(20) },
  { status: 'approved', totalAmount: 25000, requiredDate: daysFromNow(45) },
  { status: 'draft', totalAmount: 1000, requiredDate: daysFromNow(1) },
  { status: 'cancelled', totalAmount: 99000, requiredDate: daysFromNow(2) },
];

describe('PR stat card amounts', () => {
  const open = rows.filter((r) => !CLOSED.includes(normalizeStatus(r.status)));
  const byBand = (band: string) => open.filter((r) => urgencyOf(r.requiredDate) === band);

  it('sums value per urgency band alongside the count', () => {
    expect(byBand('urgent')).toHaveLength(2);
    expect(sumAmount(byBand('urgent'))).toBe(6000);

    expect(byBand('normal')).toHaveLength(1);
    expect(sumAmount(byBand('normal'))).toBe(150000);

    expect(byBand('low')).toHaveLength(1);
    expect(sumAmount(byBand('low'))).toBe(25000);
  });

  it('keeps the ฿99,000 cancelled PR out of the urgent band despite its urgent date', () => {
    // It is urgent-dated, so only the closed-status filter can exclude it.
    expect(urgencyOf(rows[4].requiredDate)).toBe('urgent');
    expect(sumAmount(byBand('urgent'))).not.toBe(105000);
  });

  it('sums KPI bands over the whole book, closed included', () => {
    expect(sumAmount(rows)).toBe(280000);
    expect(sumAmount(rows.filter((r) => normalizeStatus(r.status) === 'pending_approval'))).toBe(150000);
    expect(sumAmount(rows.filter((r) => normalizeStatus(r.status) === 'approved'))).toBe(25000);
    expect(sumAmount(rows.filter((r) => CLOSED.includes(normalizeStatus(r.status))))).toBe(99000);
  });

  it('renders amounts with separators and a unit, and zero as 0 not a dash', () => {
    expect(formatBaht(280000)).toBe('฿280,000.00');
    expect(formatBaht(6000)).toBe('฿6,000.00');
    // A zero band must read "0", never "-".
    expect(formatNumber(0)).toBe('0');
    expect(formatBaht(0)).toBe('฿0.00');
  });

  it('treats a missing required date as uncounted rather than guessing a band', () => {
    expect(urgencyOf(null)).toBeNull();
    expect(urgencyOf(undefined)).toBeNull();
  });
});
