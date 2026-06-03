/**
 * Environmental Monitoring & Water Quality — Types
 * Feature: 023-environmental-monitoring
 */

export type InspectionTargetType = 'room' | 'storage_area' | 'quarantine' | 'water_point';

export const INSPECTION_TARGET_TYPES: InspectionTargetType[] = [
  'room',
  'storage_area',
  'quarantine',
  'water_point',
];

export type InspectionFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export const INSPECTION_FREQUENCIES: InspectionFrequency[] = [
  'daily',
  'weekly',
  'monthly',
  'quarterly',
  'yearly',
];

export type InspectionStatus = 'scheduled' | 'in_progress' | 'completed' | 'overdue';

export type WaterSystemType = 'tap' | 'ro' | 'purified' | 'wfi' | 'usp_purified' | 'other';

export const WATER_SYSTEM_TYPES: WaterSystemType[] = [
  'tap',
  'ro',
  'purified',
  'wfi',
  'usp_purified',
  'other',
];

export type ResultStatus = 'in_spec' | 'out_of_spec' | 'na';

export interface InspectionScheduleItem {
  id: number;
  targetType: InspectionTargetType;
  targetId: number;
  targetName: string;
  templateId: number;
  frequency: InspectionFrequency;
  nextDue: string;
  lastDone: string | null;
  alertDaysBefore: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InspectionTemplateItem {
  id: number;
  label: string;
  parameter: string; // 'temperature' | 'humidity' | 'particle_count' | 'cleanliness' | etc.
  unit: string | null;
  specMin: number | null;
  specMax: number | null;
  specText: string | null; // for non-numeric items
  isMandatory: boolean;
  sortOrder: number;
}

export interface InspectionTemplate {
  id: number;
  name: string;
  description: string | null;
  targetType: InspectionTargetType;
  items: InspectionTemplateItem[];
  isActive: boolean;
  createdAt: string;
}

export interface InspectionRecord {
  id: number;
  scheduleId: number | null;
  templateId: number;
  templateVersion: number;
  targetType: InspectionTargetType;
  targetId: number;
  performedAt: string;
  operatorUserId: number;
  signatureId: number | null;
  status: 'completed' | 'in_progress';
  overallResult: ResultStatus;
  notes: string | null;
  deviationId: number | null;
  createdAt: string;
}

export interface InspectionResult {
  id: number;
  inspectionId: number;
  templateItemId: number;
  parameter: string;
  numericValue: number | null;
  textValue: string | null;
  specMinSnapshot: number | null;
  specMaxSnapshot: number | null;
  result: ResultStatus;
  remarks: string | null;
}

export interface WaterSystem {
  id: number;
  code: string;
  name: string;
  systemType: WaterSystemType;
  description: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface WaterSamplePoint {
  id: number;
  waterSystemId: number;
  code: string;
  name: string;
  location: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface WaterQualitySpec {
  id: number;
  samplePointId: number | null; // null = applies to whole system
  waterSystemId: number;
  parameter: string; // 'ph' | 'conductivity' | 'toc' | 'microbial_count'
  unit: string;
  specMin: number | null;
  specMax: number | null;
  notes: string | null;
  isActive: boolean;
}

export interface WaterQualityTest {
  id: number;
  samplePointId: number;
  waterSystemId: number;
  performedAt: string;
  operatorUserId: number;
  signatureId: number | null;
  overallResult: ResultStatus;
  notes: string | null;
  deviationId: number | null;
  createdAt: string;
}

export interface WaterQualityTestResult {
  id: number;
  testId: number;
  specId: number;
  parameter: string;
  numericValue: number | null;
  unit: string;
  specMinSnapshot: number | null;
  specMaxSnapshot: number | null;
  result: ResultStatus;
}

// ============================================
// Error codes
// ============================================

export const ENV_MONITOR_ERROR_CODES = {
  TARGET_NOT_FOUND: 'TARGET_NOT_FOUND',
  TEMPLATE_NOT_FOUND: 'TEMPLATE_NOT_FOUND',
  TEMPLATE_INCOMPLETE: 'TEMPLATE_INCOMPLETE',
  WATER_SYSTEM_NOT_FOUND: 'WATER_SYSTEM_NOT_FOUND',
  SAMPLE_POINT_NOT_FOUND: 'SAMPLE_POINT_NOT_FOUND',
  SPEC_NOT_FOUND: 'SPEC_NOT_FOUND',
  MISSING_SIGNATURE: 'MISSING_SIGNATURE',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_CODE: 'DUPLICATE_CODE',
  INVALID_FREQUENCY: 'INVALID_FREQUENCY',
} as const;

export type EnvMonitorErrorCode =
  (typeof ENV_MONITOR_ERROR_CODES)[keyof typeof ENV_MONITOR_ERROR_CODES];

export class EnvMonitorError extends Error {
  constructor(
    public readonly code: EnvMonitorErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'EnvMonitorError';
  }
}

// ============================================
// Helpers
// ============================================

/**
 * Evaluate a numeric reading against min/max spec.
 * `result='na'` when both min and max are null OR value is null.
 */
export function evaluateResult(
  value: number | null,
  specMin: number | null,
  specMax: number | null,
): ResultStatus {
  if (value == null) return 'na';
  if (specMin == null && specMax == null) return 'na';
  if (specMin != null && value < specMin) return 'out_of_spec';
  if (specMax != null && value > specMax) return 'out_of_spec';
  return 'in_spec';
}

/**
 * Compute next due date from frequency relative to base date.
 */
export function computeNextDue(frequency: InspectionFrequency, base: Date = new Date()): Date {
  const next = new Date(base);
  switch (frequency) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'quarterly':
      next.setMonth(next.getMonth() + 3);
      break;
    case 'yearly':
      next.setFullYear(next.getFullYear() + 1);
      break;
  }
  return next;
}
