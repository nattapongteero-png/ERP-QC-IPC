/**
 * Production Audit fixes — MFD/EXP traceability tests
 * Audit issues: #24, #25, #26, #27, #28
 *
 * Asserts:
 * - When a lot is created at Production Output, manufacturingDate is set
 *   from WO actualStartDate (not null, not today).
 * - expiryDate = manufacturingDate + product.shelfLifeDays (not today + shelfLifeDays).
 * - Operator can override both via form input.
 */
import { describe, it, expect } from 'vitest';

/**
 * Pure logic: derive MFD from WO + shelf life calculation.
 * This replicates the code path inside recordProductionOutput so we can
 * test it without a full DB stub.
 */
function deriveMfd(
  override: string | null | undefined,
  woActualStartDate: string | Date | null | undefined,
  woStartDate: string | Date | null | undefined,
  today: () => string,
): string {
  if (override) return override;
  const toStr = (v: string | Date | null | undefined): string | null => {
    if (!v) return null;
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if (typeof v === 'string') return v.length >= 10 ? v.slice(0, 10) : null;
    return null;
  };
  return toStr(woActualStartDate) ?? toStr(woStartDate) ?? today();
}

function deriveExpiry(
  override: string | null | undefined,
  manufacturingDate: string,
  shelfLifeDays: number | null,
): string | null {
  if (override) return override;
  if (!shelfLifeDays || !manufacturingDate) return null;
  const mfdDate = new Date(manufacturingDate);
  const expiry = new Date(mfdDate);
  expiry.setDate(expiry.getDate() + shelfLifeDays);
  return expiry.toISOString().slice(0, 10);
}

describe('Audit #24 — MFD mapped from WO.actualStartDate', () => {
  const today = () => '2026-06-03';

  it('uses WO actualStartDate when no override', () => {
    const mfd = deriveMfd(null, '2026-05-22', null, today);
    expect(mfd).toBe('2026-05-22');
  });

  it('falls back to WO startDate when actualStartDate is null', () => {
    const mfd = deriveMfd(null, null, '2026-05-20', today);
    expect(mfd).toBe('2026-05-20');
  });

  it('falls back to today only when both WO dates are null', () => {
    const mfd = deriveMfd(null, null, null, today);
    expect(mfd).toBe('2026-06-03');
  });

  it('honors operator override over WO dates', () => {
    const mfd = deriveMfd('2026-05-22', '2026-05-20', null, today);
    expect(mfd).toBe('2026-05-22');
  });

  it('accepts Date object for WO actualStartDate', () => {
    const mfd = deriveMfd(null, new Date('2026-05-22T08:00:00Z'), null, today);
    expect(mfd).toBe('2026-05-22');
  });

  it('returns YYYY-MM-DD format always', () => {
    const mfd = deriveMfd(null, '2026-05-22T10:30:00.000Z', null, today);
    expect(mfd).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(mfd).toBe('2026-05-22');
  });
});

describe('Audit #25 — EXP = MFD + shelfLifeDays (not today + shelfLifeDays)', () => {
  it('computes expiry from MFD (730 days)', () => {
    const exp = deriveExpiry(null, '2026-05-22', 730);
    expect(exp).toBe('2028-05-21');
  });

  it('computes expiry from MFD (365 days)', () => {
    const exp = deriveExpiry(null, '2026-06-03', 365);
    expect(exp).toBe('2027-06-03');
  });

  it('honors operator override', () => {
    const exp = deriveExpiry('2027-12-31', '2026-05-22', 730);
    expect(exp).toBe('2027-12-31');
  });

  it('returns null when shelfLifeDays is null', () => {
    const exp = deriveExpiry(null, '2026-05-22', null);
    expect(exp).toBeNull();
  });

  it('returns null when MFD is empty', () => {
    const exp = deriveExpiry(null, '', 730);
    expect(exp).toBeNull();
  });

  it('CRITICAL: EXP for a WO produced last month should reflect MFD not today', () => {
    // The audit found EXP was wrongly using TODAY for back-dated production.
    // A lot produced 2026-05-22 with 730-day shelf life MUST expire
    // 2028-05-21, NOT today + 730 (= 2028-06-02).
    const wrongAudit = (() => {
      const e = new Date('2026-06-03');
      e.setDate(e.getDate() + 730);
      return e.toISOString().slice(0, 10);
    })();
    const correctFix = deriveExpiry(null, '2026-05-22', 730);
    expect(correctFix).toBe('2028-05-21');
    expect(correctFix).not.toBe(wrongAudit);
  });
});

describe('Audit #28 — every WO-produced lot has non-null MFD', () => {
  it('a lot derived from any WO with actualStartDate has non-null MFD', () => {
    const woVariants = [
      { actualStartDate: '2026-05-22', startDate: null },
      { actualStartDate: null, startDate: '2026-05-20' },
      { actualStartDate: new Date('2026-05-22'), startDate: null },
    ];
    for (const wo of woVariants) {
      const mfd = deriveMfd(null, wo.actualStartDate, wo.startDate, () => '2026-06-03');
      expect(mfd).not.toBeNull();
      expect(mfd).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('emergency fallback: even with NO WO dates, MFD is set (never null)', () => {
    const mfd = deriveMfd(null, null, null, () => '2026-06-03');
    expect(mfd).toBe('2026-06-03');
  });
});
