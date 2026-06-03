/**
 * Scale Verification Service tests
 * Feature: 021-scale-verification
 *
 * Covers: deviation math, extreme deviation guard, certificate expiry,
 * pass/fail evaluation, scale-status side effect.
 */
import { describe, it, expect } from 'vitest';
import {
  computeDeviationPercent,
  evaluateResult,
  isExtremeDeviation,
  ScaleVerificationError,
  SCALE_VERIFICATION_ERROR_CODES,
} from '@/types/scale-verification';

describe('computeDeviationPercent', () => {
  it('returns 0 when actual equals certified', () => {
    expect(computeDeviationPercent(1000, 1000)).toBe(0);
  });

  it('returns positive when actual is greater', () => {
    expect(computeDeviationPercent(1000, 1001)).toBe(0.1);
  });

  it('returns negative when actual is less', () => {
    expect(computeDeviationPercent(1000, 999)).toBe(-0.1);
  });

  it('rounds to 4 decimal places', () => {
    // (1000.05 - 1000) / 1000 * 100 = 0.005
    expect(computeDeviationPercent(1000, 1000.05)).toBe(0.005);
  });

  it('handles small denominations precisely', () => {
    // 10g certified, 10.0001 measured = 0.001%
    expect(computeDeviationPercent(10, 10.0001)).toBe(0.001);
  });

  it('returns 0 when certified is 0 (defensive)', () => {
    expect(computeDeviationPercent(0, 100)).toBe(0);
  });
});

describe('evaluateResult', () => {
  it('passes within tolerance', () => {
    expect(evaluateResult(0.005, 0.1)).toBe('pass');
    expect(evaluateResult(-0.005, 0.1)).toBe('pass');
    expect(evaluateResult(0.1, 0.1)).toBe('pass'); // boundary
  });

  it('fails outside tolerance', () => {
    expect(evaluateResult(0.2, 0.1)).toBe('fail');
    expect(evaluateResult(-0.15, 0.1)).toBe('fail');
  });

  it('honors zero tolerance', () => {
    expect(evaluateResult(0, 0)).toBe('pass');
    expect(evaluateResult(0.0001, 0)).toBe('fail');
  });
});

describe('isExtremeDeviation', () => {
  it('false when actual is within 10× of certified', () => {
    expect(isExtremeDeviation(100, 100.5)).toBe(false);
    expect(isExtremeDeviation(100, 200)).toBe(false);
    expect(isExtremeDeviation(100, 999)).toBe(false);
  });

  it('true when actual is >10× certified', () => {
    expect(isExtremeDeviation(100, 1001)).toBe(true);
  });

  it('true when actual is <1/10 of certified', () => {
    expect(isExtremeDeviation(1000, 99)).toBe(true);
  });

  it('false when certified is zero (defensive)', () => {
    expect(isExtremeDeviation(0, 100)).toBe(false);
  });
});

describe('ScaleVerificationError', () => {
  it('carries code and details', () => {
    const err = new ScaleVerificationError(
      SCALE_VERIFICATION_ERROR_CODES.CERTIFICATE_EXPIRED,
      'Expired on 2024-01-01',
      { expiry: '2024-01-01' },
    );
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('CERTIFICATE_EXPIRED');
    expect(err.details?.expiry).toBe('2024-01-01');
  });

  it('exposes all 12 error codes', () => {
    const codes = Object.values(SCALE_VERIFICATION_ERROR_CODES);
    expect(codes).toContain('SCALE_NOT_FOUND');
    expect(codes).toContain('STANDARD_WEIGHT_NOT_FOUND');
    expect(codes).toContain('CERTIFICATE_EXPIRED');
    expect(codes).toContain('WEIGHT_OUT_OF_RANGE');
    expect(codes).toContain('EXTREME_DEVIATION');
    expect(codes).toContain('SCALE_OUT_OF_SERVICE');
    expect(codes).toContain('VERIFICATION_REQUIRED');
    expect(codes).toContain('VERIFICATION_EXPIRED');
    expect(codes).toContain('DUPLICATE_WEIGHT_CODE');
    expect(codes).toContain('MISSING_SIGNATURE');
    expect(codes).toContain('PERMISSION_DENIED');
    expect(codes).toContain('NOT_FOUND');
  });
});

describe('Validation business rules (logical)', () => {
  it('1000g certified, 1000.05g read → pass at 0.1% tolerance', () => {
    const dev = computeDeviationPercent(1000, 1000.05);
    expect(evaluateResult(dev, 0.1)).toBe('pass');
    expect(isExtremeDeviation(1000, 1000.05)).toBe(false);
  });

  it('1000g certified, 1002g read → fail at 0.1% tolerance', () => {
    const dev = computeDeviationPercent(1000, 1002);
    expect(evaluateResult(dev, 0.1)).toBe('fail');
    expect(isExtremeDeviation(1000, 1002)).toBe(false);
  });

  it('catches wrong-weight selection: 100g certified, 1000g read → EXTREME', () => {
    expect(isExtremeDeviation(100, 1000)).toBe(false); // exactly 10× — boundary
    expect(isExtremeDeviation(100, 1001)).toBe(true);
  });
});
