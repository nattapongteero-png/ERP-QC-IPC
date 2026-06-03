/**
 * Equipment Notification Service tests
 * Feature: 022-equipment-notifications
 */
import { describe, it, expect } from 'vitest';
import {
  classifySeverity,
  EquipmentNotificationError,
  NOTIFICATION_ERROR_CODES,
} from '@/types/equipment-notifications';

describe('classifySeverity', () => {
  const today = new Date('2026-06-03T12:00:00Z');

  it('marks past date as overdue', () => {
    expect(classifySeverity('2026-06-01', today)).toBe('overdue');
    expect(classifySeverity('2026-05-01', today)).toBe('overdue');
  });

  it('marks today as due_today', () => {
    expect(classifySeverity('2026-06-03', today)).toBe('due_today');
  });

  it('marks within 7 days as due_in_7d', () => {
    expect(classifySeverity('2026-06-04', today)).toBe('due_in_7d');
    expect(classifySeverity('2026-06-10', today)).toBe('due_in_7d');
  });

  it('marks within 30 days as due_in_30d', () => {
    expect(classifySeverity('2026-06-11', today)).toBe('due_in_30d');
    expect(classifySeverity('2026-07-03', today)).toBe('due_in_30d');
  });

  it('marks beyond 30 days as info', () => {
    expect(classifySeverity('2026-08-01', today)).toBe('info');
  });
});

describe('EquipmentNotificationError', () => {
  it('carries code, message and details', () => {
    const err = new EquipmentNotificationError(
      NOTIFICATION_ERROR_CODES.ALREADY_ACKNOWLEDGED,
      'Already finalized',
      { id: 1 },
    );
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('ALREADY_ACKNOWLEDGED');
    expect(err.message).toBe('Already finalized');
    expect(err.details).toEqual({ id: 1 });
  });

  it('exposes all error codes', () => {
    const codes = Object.values(NOTIFICATION_ERROR_CODES);
    expect(codes).toContain('ALREADY_ACKNOWLEDGED');
    expect(codes).toContain('ALREADY_RESOLVED');
    expect(codes).toContain('NOT_FOUND');
    expect(codes).toContain('PERMISSION_DENIED');
    expect(codes).toContain('INVALID_TEMPLATE');
    expect(codes).toContain('EQUIPMENT_NOT_FOUND');
  });
});

describe('dedupe key behavior (logical contract)', () => {
  // The service computes dedupe key as entityType|entityId|scheduleId|YYYY-MM-DD
  // — these tests document the contract rather than calling the service.
  function makeKey(et: string, eid: number, sid: number | null, due: string | null): string {
    const day = due ? due.slice(0, 10) : 'no-due';
    return `${et}|${eid}|${sid ?? 'none'}|${day}`;
  }

  it('same equipment + same schedule + same due day = same key', () => {
    const a = makeKey('scale', 7, 100, '2026-06-15T08:00:00Z');
    const b = makeKey('scale', 7, 100, '2026-06-15T18:00:00Z');
    expect(a).toBe(b);
  });

  it('different schedule = different key', () => {
    const a = makeKey('scale', 7, 100, '2026-06-15');
    const b = makeKey('scale', 7, 101, '2026-06-15');
    expect(a).not.toBe(b);
  });

  it('different equipment = different key', () => {
    const a = makeKey('scale', 7, 100, '2026-06-15');
    const b = makeKey('scale', 8, 100, '2026-06-15');
    expect(a).not.toBe(b);
  });

  it('different due date = different key', () => {
    const a = makeKey('scale', 7, 100, '2026-06-15');
    const b = makeKey('scale', 7, 100, '2026-06-16');
    expect(a).not.toBe(b);
  });
});
