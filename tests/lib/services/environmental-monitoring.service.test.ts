/**
 * F023 Environmental Monitoring + Water Quality — service-layer logic tests
 * Tests pure helper functions and the public error contract.
 */
import { describe, it, expect } from 'vitest';
import {
  evaluateResult,
  computeNextDue,
  EnvMonitorError,
  ENV_MONITOR_ERROR_CODES,
} from '@/types/environmental-monitoring';

describe('evaluateResult — spec evaluation', () => {
  it('returns na when value is null', () => {
    expect(evaluateResult(null, 0, 100)).toBe('na');
  });

  it('returns na when both bounds null', () => {
    expect(evaluateResult(50, null, null)).toBe('na');
  });

  it('returns in_spec inside bounds', () => {
    expect(evaluateResult(50, 0, 100)).toBe('in_spec');
    expect(evaluateResult(0, 0, 100)).toBe('in_spec');
    expect(evaluateResult(100, 0, 100)).toBe('in_spec');
  });

  it('returns out_of_spec below min', () => {
    expect(evaluateResult(-1, 0, 100)).toBe('out_of_spec');
  });

  it('returns out_of_spec above max', () => {
    expect(evaluateResult(101, 0, 100)).toBe('out_of_spec');
  });

  it('honors min-only spec', () => {
    expect(evaluateResult(10, 5, null)).toBe('in_spec');
    expect(evaluateResult(4, 5, null)).toBe('out_of_spec');
  });

  it('honors max-only spec', () => {
    expect(evaluateResult(10, null, 100)).toBe('in_spec');
    expect(evaluateResult(101, null, 100)).toBe('out_of_spec');
  });

  it('handles water pH typical range 5.0-7.0', () => {
    expect(evaluateResult(5.5, 5.0, 7.0)).toBe('in_spec');
    expect(evaluateResult(4.9, 5.0, 7.0)).toBe('out_of_spec');
    expect(evaluateResult(7.1, 5.0, 7.0)).toBe('out_of_spec');
  });

  it('handles WFI conductivity (max only)', () => {
    // USP <645> WFI: ≤ 1.3 µS/cm
    expect(evaluateResult(1.1, null, 1.3)).toBe('in_spec');
    expect(evaluateResult(1.4, null, 1.3)).toBe('out_of_spec');
  });
});

describe('computeNextDue', () => {
  const base = new Date('2026-06-03T00:00:00.000Z');

  it('adds 1 day for daily', () => {
    const next = computeNextDue('daily', base);
    expect(next.toISOString().slice(0, 10)).toBe('2026-06-04');
  });

  it('adds 7 days for weekly', () => {
    const next = computeNextDue('weekly', base);
    expect(next.toISOString().slice(0, 10)).toBe('2026-06-10');
  });

  it('adds 1 month for monthly', () => {
    const next = computeNextDue('monthly', base);
    expect(next.toISOString().slice(0, 10)).toBe('2026-07-03');
  });

  it('adds 3 months for quarterly', () => {
    const next = computeNextDue('quarterly', base);
    expect(next.toISOString().slice(0, 10)).toBe('2026-09-03');
  });

  it('adds 1 year for yearly', () => {
    const next = computeNextDue('yearly', base);
    expect(next.toISOString().slice(0, 10)).toBe('2027-06-03');
  });
});

describe('EnvMonitorError', () => {
  it('carries code + message + details', () => {
    const err = new EnvMonitorError(ENV_MONITOR_ERROR_CODES.TEMPLATE_INCOMPLETE, 'm', { x: 1 });
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('TEMPLATE_INCOMPLETE');
    expect(err.details?.x).toBe(1);
  });

  it('exposes all error codes', () => {
    const codes = Object.values(ENV_MONITOR_ERROR_CODES);
    expect(codes).toContain('TARGET_NOT_FOUND');
    expect(codes).toContain('TEMPLATE_NOT_FOUND');
    expect(codes).toContain('TEMPLATE_INCOMPLETE');
    expect(codes).toContain('WATER_SYSTEM_NOT_FOUND');
    expect(codes).toContain('SAMPLE_POINT_NOT_FOUND');
    expect(codes).toContain('SPEC_NOT_FOUND');
    expect(codes).toContain('MISSING_SIGNATURE');
    expect(codes).toContain('PERMISSION_DENIED');
    expect(codes).toContain('NOT_FOUND');
    expect(codes).toContain('DUPLICATE_CODE');
    expect(codes).toContain('INVALID_FREQUENCY');
  });
});
