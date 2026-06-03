/**
 * Validation schema tests for Feature 021 — Scale Verification
 */
import { describe, it, expect } from 'vitest';
import {
  createStandardWeightSchema,
  createVerificationSchema,
  updateScaleConfigSchema,
} from '@/lib/validation/scale-verification';

describe('createStandardWeightSchema', () => {
  const valid = {
    code: 'SW-001',
    denominationValue: 1000,
    denominationUnit: 'g',
    accuracyClass: 'E2',
    certificateNumber: 'CERT-2025-001',
    certificateIssuer: 'NIMT',
    certificateIssueDate: '2026-01-01',
    certificateExpiryDate: '2027-01-01',
  };

  it('accepts a valid weight', () => {
    expect(createStandardWeightSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects expiry before issue date', () => {
    const bad = { ...valid, certificateExpiryDate: '2025-12-01' };
    expect(createStandardWeightSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects non-positive denomination', () => {
    expect(createStandardWeightSchema.safeParse({ ...valid, denominationValue: 0 }).success).toBe(false);
    expect(createStandardWeightSchema.safeParse({ ...valid, denominationValue: -1 }).success).toBe(false);
  });

  it('rejects invalid accuracy class', () => {
    const bad = { ...valid, accuracyClass: 'A1' };
    expect(createStandardWeightSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects invalid unit', () => {
    const bad = { ...valid, denominationUnit: 'lb' };
    expect(createStandardWeightSchema.safeParse(bad).success).toBe(false);
  });
});

describe('createVerificationSchema', () => {
  it('accepts a complete verification', () => {
    const ok = createVerificationSchema.safeParse({
      scaleId: 1,
      standardWeightId: 1,
      actualReading: 1000.05,
      signature: { password: 'pw' },
    });
    expect(ok.success).toBe(true);
  });

  it('rejects negative reading', () => {
    const bad = createVerificationSchema.safeParse({
      scaleId: 1,
      standardWeightId: 1,
      actualReading: -1,
      signature: { password: 'pw' },
    });
    expect(bad.success).toBe(false);
  });

  it('requires either password or pin in signature', () => {
    const bad = createVerificationSchema.safeParse({
      scaleId: 1,
      standardWeightId: 1,
      actualReading: 1000,
      signature: {},
    });
    expect(bad.success).toBe(false);
  });

  it('accepts pin-only signature', () => {
    const ok = createVerificationSchema.safeParse({
      scaleId: 1,
      standardWeightId: 1,
      actualReading: 1000,
      signature: { pin: '1234' },
    });
    expect(ok.success).toBe(true);
  });
});

describe('updateScaleConfigSchema', () => {
  it('accepts updating verification interval', () => {
    const ok = updateScaleConfigSchema.safeParse({ verificationIntervalHours: 12 });
    expect(ok.success).toBe(true);
  });

  it('rejects interval > 168 hours', () => {
    const bad = updateScaleConfigSchema.safeParse({ verificationIntervalHours: 200 });
    expect(bad.success).toBe(false);
  });

  it('accepts changing tolerance', () => {
    const ok = updateScaleConfigSchema.safeParse({ tolerancePercent: 0.05 });
    expect(ok.success).toBe(true);
  });

  it('rejects negative tolerance', () => {
    const bad = updateScaleConfigSchema.safeParse({ tolerancePercent: -0.1 });
    expect(bad.success).toBe(false);
  });

  it('accepts changing scale status', () => {
    expect(
      updateScaleConfigSchema.safeParse({ scaleStatus: 'out_of_service' }).success,
    ).toBe(true);
    expect(updateScaleConfigSchema.safeParse({ scaleStatus: 'invalid' }).success).toBe(false);
  });
});
