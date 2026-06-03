/**
 * F023 — Validation schema tests
 */
import { describe, it, expect } from 'vitest';
import {
  createInspectionTemplateSchema,
  createInspectionScheduleSchema,
  recordInspectionSchema,
  createWaterSystemSchema,
  createWaterSpecSchema,
  recordWaterTestSchema,
} from '@/lib/validation/environmental-monitoring';

describe('createInspectionTemplateSchema', () => {
  const valid = {
    name: 'Daily room check',
    targetType: 'room' as const,
    items: [
      {
        label: 'Temperature',
        parameter: 'temperature',
        unit: 'C',
        specMin: 20,
        specMax: 25,
        isMandatory: true,
        sortOrder: 1,
      },
    ],
  };

  it('accepts valid template', () => {
    expect(createInspectionTemplateSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects empty name', () => {
    expect(
      createInspectionTemplateSchema.safeParse({ ...valid, name: '' }).success,
    ).toBe(false);
  });

  it('rejects invalid target type', () => {
    expect(
      createInspectionTemplateSchema.safeParse({ ...valid, targetType: 'random' }).success,
    ).toBe(false);
  });

  it('rejects empty items', () => {
    expect(
      createInspectionTemplateSchema.safeParse({ ...valid, items: [] }).success,
    ).toBe(false);
  });
});

describe('createInspectionScheduleSchema', () => {
  const valid = {
    targetType: 'room' as const,
    targetId: 1,
    targetName: 'Production room A',
    templateId: 1,
    frequency: 'daily' as const,
    alertDaysBefore: 1,
  };

  it('accepts valid schedule', () => {
    expect(createInspectionScheduleSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects invalid frequency', () => {
    expect(
      createInspectionScheduleSchema.safeParse({ ...valid, frequency: 'random' }).success,
    ).toBe(false);
  });

  it('rejects negative ids', () => {
    expect(
      createInspectionScheduleSchema.safeParse({ ...valid, targetId: -1 }).success,
    ).toBe(false);
  });
});

describe('recordInspectionSchema', () => {
  const valid = {
    templateId: 1,
    targetType: 'room' as const,
    targetId: 1,
    results: [
      { templateItemId: 1, parameter: 'temperature', numericValue: 22.5 },
    ],
    signature: { password: 'pw' },
  };

  it('accepts valid inspection', () => {
    expect(recordInspectionSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects empty results', () => {
    expect(recordInspectionSchema.safeParse({ ...valid, results: [] }).success).toBe(false);
  });

  it('requires signature', () => {
    expect(recordInspectionSchema.safeParse({ ...valid, signature: {} }).success).toBe(false);
  });

  it('accepts pin-only signature', () => {
    expect(
      recordInspectionSchema.safeParse({ ...valid, signature: { pin: '1234' } }).success,
    ).toBe(true);
  });
});

describe('createWaterSystemSchema', () => {
  it('accepts valid system', () => {
    expect(
      createWaterSystemSchema.safeParse({
        code: 'PW-01',
        name: 'Purified Water 1',
        systemType: 'purified',
      }).success,
    ).toBe(true);
  });

  it('rejects invalid system type', () => {
    expect(
      createWaterSystemSchema.safeParse({
        code: 'X',
        name: 'X',
        systemType: 'magic',
      }).success,
    ).toBe(false);
  });
});

describe('createWaterSpecSchema', () => {
  it('accepts pH range spec', () => {
    expect(
      createWaterSpecSchema.safeParse({
        waterSystemId: 1,
        parameter: 'ph',
        unit: '',
        specMin: 5.0,
        specMax: 7.0,
      }).success,
    ).toBe(true);
  });

  it('accepts max-only spec (e.g. conductivity)', () => {
    expect(
      createWaterSpecSchema.safeParse({
        waterSystemId: 1,
        parameter: 'conductivity',
        unit: 'uS/cm',
        specMax: 1.3,
      }).success,
    ).toBe(true);
  });
});

describe('recordWaterTestSchema', () => {
  it('accepts valid test', () => {
    expect(
      recordWaterTestSchema.safeParse({
        samplePointId: 1,
        waterSystemId: 1,
        results: [{ parameter: 'ph', numericValue: 6.5, unit: '' }],
        signature: { password: 'pw' },
      }).success,
    ).toBe(true);
  });

  it('rejects empty results', () => {
    expect(
      recordWaterTestSchema.safeParse({
        samplePointId: 1,
        waterSystemId: 1,
        results: [],
        signature: { password: 'pw' },
      }).success,
    ).toBe(false);
  });
});
