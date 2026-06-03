/**
 * Validation schema tests for Feature 022
 */
import { describe, it, expect } from 'vitest';
import {
  acknowledgeNotificationSchema,
  snoozeNotificationSchema,
  createMaintenancePlanTemplateSchema,
  applyTemplateSchema,
} from '@/lib/validation/equipment-notifications';

describe('acknowledgeNotificationSchema', () => {
  it('accepts empty body', () => {
    expect(acknowledgeNotificationSchema.safeParse({}).success).toBe(true);
  });

  it('accepts a note', () => {
    expect(acknowledgeNotificationSchema.safeParse({ note: 'Will fix tomorrow' }).success).toBe(true);
  });

  it('rejects oversized note', () => {
    const bad = acknowledgeNotificationSchema.safeParse({ note: 'x'.repeat(1001) });
    expect(bad.success).toBe(false);
  });
});

describe('snoozeNotificationSchema', () => {
  it('accepts a valid snooze (1-60 days)', () => {
    expect(snoozeNotificationSchema.safeParse({ snoozeDays: 1 }).success).toBe(true);
    expect(snoozeNotificationSchema.safeParse({ snoozeDays: 30 }).success).toBe(true);
    expect(snoozeNotificationSchema.safeParse({ snoozeDays: 60 }).success).toBe(true);
  });

  it('rejects out-of-range snooze', () => {
    expect(snoozeNotificationSchema.safeParse({ snoozeDays: 0 }).success).toBe(false);
    expect(snoozeNotificationSchema.safeParse({ snoozeDays: 61 }).success).toBe(false);
    expect(snoozeNotificationSchema.safeParse({ snoozeDays: -1 }).success).toBe(false);
  });

  it('rejects non-integer snooze', () => {
    expect(snoozeNotificationSchema.safeParse({ snoozeDays: 1.5 }).success).toBe(false);
  });
});

describe('createMaintenancePlanTemplateSchema', () => {
  const valid = {
    name: 'Annual calibration',
    maintenanceType: 'calibration',
    intervalType: 'months',
    intervalValue: 12,
    alertDaysBefore: 14,
  };

  it('accepts a valid template', () => {
    expect(createMaintenancePlanTemplateSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects empty name', () => {
    expect(
      createMaintenancePlanTemplateSchema.safeParse({ ...valid, name: '' }).success,
    ).toBe(false);
  });

  it('rejects invalid maintenanceType', () => {
    expect(
      createMaintenancePlanTemplateSchema.safeParse({ ...valid, maintenanceType: 'random' }).success,
    ).toBe(false);
  });

  it('rejects non-positive interval', () => {
    expect(
      createMaintenancePlanTemplateSchema.safeParse({ ...valid, intervalValue: 0 }).success,
    ).toBe(false);
    expect(
      createMaintenancePlanTemplateSchema.safeParse({ ...valid, intervalValue: -1 }).success,
    ).toBe(false);
  });

  it('rejects alertDaysBefore > 365', () => {
    expect(
      createMaintenancePlanTemplateSchema.safeParse({ ...valid, alertDaysBefore: 400 }).success,
    ).toBe(false);
  });
});

describe('applyTemplateSchema', () => {
  it('accepts a valid apply', () => {
    const ok = applyTemplateSchema.safeParse({ templateId: 1, equipmentIds: [1, 2, 3] });
    expect(ok.success).toBe(true);
  });

  it('rejects empty equipmentIds', () => {
    const bad = applyTemplateSchema.safeParse({ templateId: 1, equipmentIds: [] });
    expect(bad.success).toBe(false);
  });

  it('rejects negative ids', () => {
    expect(
      applyTemplateSchema.safeParse({ templateId: -1, equipmentIds: [1] }).success,
    ).toBe(false);
    expect(
      applyTemplateSchema.safeParse({ templateId: 1, equipmentIds: [-1] }).success,
    ).toBe(false);
  });
});
