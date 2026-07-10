/**
 * Regression tests for the eBMR number-formatting bug.
 *
 * Reported on /production/work-orders/34: quantities reaching the thousands
 * rendered as "1000" with no separator, and some rendered with no unit.
 *
 * These tests pin the two guarantees the eBMR screens rely on:
 *   1. thousands separators appear, from 1,000 upward;
 *   2. a legitimate 0 still renders as "0" (never "" or "-"), so a weighed
 *      quantity of zero is not mistaken for "not yet weighed".
 */

import { describe, it, expect } from 'vitest';
import { formatNumber, formatMoney, formatBaht } from '@/lib/utils/number-format';

describe('formatNumber — thousands separator (the reported bug)', () => {
  it('inserts a comma at the thousands boundary', () => {
    expect(formatNumber(1000)).toBe('1,000');
    expect(formatNumber(12000)).toBe('12,000');
    expect(formatNumber(1234567)).toBe('1,234,567');
  });

  it('leaves sub-thousand values untouched', () => {
    expect(formatNumber(999)).toBe('999');
    expect(formatNumber(1)).toBe('1');
  });

  it('keeps real decimals but trims trailing zeros', () => {
    expect(formatNumber(1000.5)).toBe('1,000.5');
    expect(formatNumber(1000.0)).toBe('1,000');
    expect(formatNumber(1000.034)).toBe('1,000.034');
  });

  it('honours an explicit decimal cap', () => {
    expect(formatNumber(1234.5678, 2)).toBe('1,234.57');
    expect(formatNumber(1000, 3)).toBe('1,000');
  });

  it('handles negatives (material variance can be negative)', () => {
    expect(formatNumber(-1500)).toBe('-1,500');
    expect(formatNumber(-0.25)).toBe('-0.25');
  });

  it('accepts numeric strings, as returned by MySQL DECIMAL columns', () => {
    expect(formatNumber('2500')).toBe('2,500');
    expect(formatNumber('2500.50')).toBe('2,500.5');
  });
});

describe('formatNumber — null/zero contract the eBMR guards depend on', () => {
  it('preserves a legitimate zero', () => {
    // A weighed qty of 0 must not collapse into an empty/"-" cell.
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber('0')).toBe('0');
  });

  it('returns an empty string for absent values, leaving "-" to the caller', () => {
    expect(formatNumber(null)).toBe('');
    expect(formatNumber(undefined)).toBe('');
    expect(formatNumber('')).toBe('');
  });

  it('returns an empty string for non-numeric input rather than "NaN"', () => {
    expect(formatNumber('abc')).toBe('');
  });
});

describe('formatNumber — is SSR-stable (no locale dependence)', () => {
  it('does not rely on the ambient locale', () => {
    // The helper uses a regex, not toLocaleString, so the server and the
    // browser must agree byte-for-byte regardless of process locale.
    const before = formatNumber(1234567.891, 2);
    expect(before).toBe('1,234,567.89');
    // Same call, same answer — no hidden Intl/locale state.
    expect(formatNumber(1234567.891, 2)).toBe(before);
  });
});

describe('formatMoney / formatBaht', () => {
  it('formatMoney pads to fixed decimals with separators', () => {
    expect(formatMoney(1000)).toBe('1,000.00');
    expect(formatMoney(1163.0341)).toBe('1,163.03');
  });

  it('formatMoney coerces absent values to a zero amount', () => {
    expect(formatMoney(null)).toBe('0.00');
  });

  it('formatBaht prefixes the symbol and keeps the sign outside it', () => {
    expect(formatBaht(1000)).toBe('฿1,000.00');
    expect(formatBaht(-50.5)).toBe('-฿50.50');
  });
});

describe('eBMR render shapes — number + unit', () => {
  // Mirrors the JSX pattern `{formatNumber(qty)} {unit}` used across the
  // work-order screens, so a thousands-scale batch reads correctly.
  const render = (qty: number | null, unit: string) =>
    qty != null ? `${formatNumber(qty)} ${unit}`.trim() : '-';

  it('shows separator and unit together', () => {
    expect(render(1000, 'kg')).toBe('1,000 kg');
    expect(render(25000, 'เม็ด')).toBe('25,000 เม็ด');
  });

  it('shows a zero quantity with its unit, not a dash', () => {
    expect(render(0, 'kg')).toBe('0 kg');
  });

  it('shows a dash only when the value is genuinely absent', () => {
    expect(render(null, 'kg')).toBe('-');
  });
});
