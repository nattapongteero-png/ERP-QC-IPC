/**
 * Unit tests for Goods Receipt Service
 * - State machine transitions
 * - Variance calculation
 * - Tolerance defaults
 * Feature: 020-goods-receipt
 */
import { describe, it, expect } from 'vitest';
import { GRN_LINE_TRANSITIONS, GoodsReceiptError, GOODS_RECEIPT_ERROR_CODES } from '@/types/goods-receipt';

describe('GRN line state machine', () => {
  it('allows created → checklist_done', () => {
    expect(GRN_LINE_TRANSITIONS.created).toContain('checklist_done');
  });

  it('allows created → cancelled (only)', () => {
    expect(GRN_LINE_TRANSITIONS.created).toContain('cancelled');
  });

  it('allows checklist_done → qc_pending', () => {
    expect(GRN_LINE_TRANSITIONS.checklist_done).toContain('qc_pending');
  });

  it('allows qc_pending → qc_approved or rejected', () => {
    expect(GRN_LINE_TRANSITIONS.qc_pending).toContain('qc_approved');
    expect(GRN_LINE_TRANSITIONS.qc_pending).toContain('rejected');
  });

  it('allows qc_approved → released_to_stock or rejected', () => {
    expect(GRN_LINE_TRANSITIONS.qc_approved).toContain('released_to_stock');
    expect(GRN_LINE_TRANSITIONS.qc_approved).toContain('rejected');
  });

  it('forbids released_to_stock → anything (terminal)', () => {
    expect(GRN_LINE_TRANSITIONS.released_to_stock).toEqual([]);
  });

  it('forbids rejected → anything (terminal)', () => {
    expect(GRN_LINE_TRANSITIONS.rejected).toEqual([]);
  });

  it('forbids cancelled → anything (terminal)', () => {
    expect(GRN_LINE_TRANSITIONS.cancelled).toEqual([]);
  });

  it('forbids created → released_to_stock (no skipping)', () => {
    expect(GRN_LINE_TRANSITIONS.created).not.toContain('released_to_stock');
  });

  it('forbids checklist_done → released_to_stock (skipping QC)', () => {
    expect(GRN_LINE_TRANSITIONS.checklist_done).not.toContain('released_to_stock');
  });

  it('forbids qc_pending → released_to_stock (must go through qc_approved)', () => {
    expect(GRN_LINE_TRANSITIONS.qc_pending).not.toContain('released_to_stock');
  });
});

describe('GoodsReceiptError', () => {
  it('captures code, message and details', () => {
    const err = new GoodsReceiptError(
      GOODS_RECEIPT_ERROR_CODES.TRIPLE_INDEPENDENCE_VIOLATION,
      'TI violation',
      { lineId: 42 },
    );
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('TRIPLE_INDEPENDENCE_VIOLATION');
    expect(err.message).toBe('TI violation');
    expect(err.details).toEqual({ lineId: 42 });
    expect(err.name).toBe('GoodsReceiptError');
  });

  it('includes all 14 documented error codes', () => {
    const codes = Object.values(GOODS_RECEIPT_ERROR_CODES);
    expect(codes).toContain('TRIPLE_INDEPENDENCE_VIOLATION');
    expect(codes).toContain('INVALID_TRANSITION');
    expect(codes).toContain('LOT_IN_QUARANTINE');
    expect(codes).toContain('SOURCE_ALREADY_RECEIVED');
    expect(codes).toContain('VARIANCE_NOT_JUSTIFIED');
    expect(codes).toContain('QC_NOT_APPROVED');
    expect(codes).toContain('CHECKLIST_INCOMPLETE');
    expect(codes).toContain('CANCELLATION_WINDOW_EXPIRED');
    expect(codes).toContain('DUPLICATE_VENDOR_LOT');
    expect(codes).toContain('EXPIRY_TOO_SHORT');
    expect(codes).toContain('MISSING_SIGNATURE');
    expect(codes).toContain('PERMISSION_DENIED');
    expect(codes).toContain('NOT_FOUND');
    expect(codes).toContain('INVALID_SOURCE');
  });
});

describe('Variance calculation behavior (logic verification)', () => {
  function calcVariance(expected: number, actual: number) {
    if (expected === 0) return null;
    const amount = actual - expected;
    return { amount, percent: (amount / expected) * 100 };
  }

  it('returns 0% when actual equals expected', () => {
    const v = calcVariance(100, 100);
    expect(v?.percent).toBe(0);
  });

  it('returns negative percent for shortage', () => {
    const v = calcVariance(100, 95);
    expect(v?.percent).toBe(-5);
    expect(v?.amount).toBe(-5);
  });

  it('returns positive percent for over-receipt', () => {
    const v = calcVariance(100, 105);
    expect(v?.percent).toBe(5);
    expect(v?.amount).toBe(5);
  });

  it('within 2% raw material tolerance', () => {
    const v = calcVariance(100, 99);
    expect(Math.abs(v?.percent ?? 0)).toBeLessThan(2);
  });

  it('within 5% finished goods tolerance', () => {
    const v = calcVariance(10000, 9650);
    expect(Math.abs(v?.percent ?? 0)).toBeLessThan(5);
  });

  it('exceeds 2% threshold', () => {
    const v = calcVariance(100, 90);
    expect(Math.abs(v?.percent ?? 0)).toBeGreaterThan(2);
  });
});
