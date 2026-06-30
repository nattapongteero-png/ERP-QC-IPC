/**
 * Unit tests — payment-terms normalization + write-path whitelist.
 */

import { describe, it, expect } from 'vitest';
import {
  normalizePaymentTerms,
  paymentTermsWriteSchema,
  PAYMENT_TERMS_OPTIONS,
} from '@/lib/constants/payment-terms';

describe('normalizePaymentTerms', () => {
  it('passes canonical values through', () => {
    for (const v of ['COD', 'Net 7', 'Net 15', 'Net 30', 'Net 45', 'Net 60']) {
      expect(normalizePaymentTerms(v)).toBe(v);
    }
  });

  it('treats empty/null/undefined as "" (not specified)', () => {
    expect(normalizePaymentTerms('')).toBe('');
    expect(normalizePaymentTerms('   ')).toBe('');
    expect(normalizePaymentTerms(null)).toBe('');
    expect(normalizePaymentTerms(undefined)).toBe('');
  });

  it('normalizes spacing/case variants', () => {
    expect(normalizePaymentTerms('net 30')).toBe('Net 30');
    expect(normalizePaymentTerms('Net30')).toBe('Net 30');
    expect(normalizePaymentTerms('NET  60')).toBe('Net 60');
  });

  it('maps Thai/free-text day counts', () => {
    expect(normalizePaymentTerms('30วัน')).toBe('Net 30');
    expect(normalizePaymentTerms('เครดิต 30 วัน')).toBe('Net 30');
    expect(normalizePaymentTerms('45 days')).toBe('Net 45');
    expect(normalizePaymentTerms('เครดิต 1 เดือน')).toBe('Net 30');
  });

  it('maps cash-on-delivery phrasings to COD', () => {
    expect(normalizePaymentTerms('เงินสด')).toBe('COD');
    expect(normalizePaymentTerms('cash')).toBe('COD');
    expect(normalizePaymentTerms('ชำระเมื่อรับสินค้า')).toBe('COD');
  });

  it('returns null for unmappable values', () => {
    expect(normalizePaymentTerms('ภายหลัง')).toBeNull();
    expect(normalizePaymentTerms('Net 90')).toBeNull(); // not in whitelist
    expect(normalizePaymentTerms('blah')).toBeNull();
  });
});

describe('paymentTermsWriteSchema', () => {
  it('accepts + normalizes a legacy value', () => {
    expect(paymentTermsWriteSchema.parse('30วัน')).toBe('Net 30');
  });
  it('collapses empty to undefined', () => {
    expect(paymentTermsWriteSchema.parse('')).toBeUndefined();
    expect(paymentTermsWriteSchema.parse(undefined)).toBeUndefined();
  });
  it('rejects an unmappable value', () => {
    expect(() => paymentTermsWriteSchema.parse('Net 90')).toThrow();
  });
});

describe('PAYMENT_TERMS_OPTIONS', () => {
  it('matches the canonical whitelist (6 terms + empty)', () => {
    expect(PAYMENT_TERMS_OPTIONS.map((o) => o.value)).toEqual([
      '', 'COD', 'Net 7', 'Net 15', 'Net 30', 'Net 45', 'Net 60',
    ]);
  });
});
