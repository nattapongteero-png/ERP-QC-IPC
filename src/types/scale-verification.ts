/**
 * Scale Pre-Use Verification — Types & Error Codes
 * Feature: 021-scale-verification
 */

export type AccuracyClass = 'E1' | 'E2' | 'F1' | 'F2' | 'M1';
export const ACCURACY_CLASSES: AccuracyClass[] = ['E1', 'E2', 'F1', 'F2', 'M1'];

export type VerificationResult = 'pass' | 'fail';

export type ScaleStatus = 'active' | 'out_of_service' | 'maintenance';

export interface StandardWeight {
  id: number;
  code: string;
  denominationValue: number;
  denominationUnit: string; // 'g' | 'kg' | 'mg'
  accuracyClass: AccuracyClass;
  certificateNumber: string;
  certificateIssuer: string;
  certificateIssueDate: string;
  certificateExpiryDate: string;
  ownerDepartment: string | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScaleVerification {
  id: number;
  scaleId: number;
  standardWeightId: number;
  certifiedValueSnapshot: number;
  certifiedUnitSnapshot: string;
  actualReading: number;
  deviationAmount: number;
  deviationPercent: number;
  result: VerificationResult;
  operatorUserId: number;
  signatureId: number | null;
  performedAt: string;
  validUntil: string;
  notes: string | null;
  createdAt: string;
}

export interface CreateVerificationInput {
  scaleId: number;
  standardWeightId: number;
  actualReading: number;
  notes?: string | null;
  signature: {
    password?: string;
    pin?: string;
  };
}

export interface CreateStandardWeightInput {
  code: string;
  denominationValue: number;
  denominationUnit: string;
  accuracyClass: AccuracyClass;
  certificateNumber: string;
  certificateIssuer: string;
  certificateIssueDate: string;
  certificateExpiryDate: string;
  ownerDepartment?: string | null;
  notes?: string | null;
}

export const SCALE_VERIFICATION_ERROR_CODES = {
  SCALE_NOT_FOUND: 'SCALE_NOT_FOUND',
  STANDARD_WEIGHT_NOT_FOUND: 'STANDARD_WEIGHT_NOT_FOUND',
  CERTIFICATE_EXPIRED: 'CERTIFICATE_EXPIRED',
  WEIGHT_OUT_OF_RANGE: 'WEIGHT_OUT_OF_RANGE',
  EXTREME_DEVIATION: 'EXTREME_DEVIATION',
  SCALE_OUT_OF_SERVICE: 'SCALE_OUT_OF_SERVICE',
  VERIFICATION_REQUIRED: 'VERIFICATION_REQUIRED',
  VERIFICATION_EXPIRED: 'VERIFICATION_EXPIRED',
  DUPLICATE_WEIGHT_CODE: 'DUPLICATE_WEIGHT_CODE',
  MISSING_SIGNATURE: 'MISSING_SIGNATURE',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  NOT_FOUND: 'NOT_FOUND',
} as const;

export type ScaleVerificationErrorCode =
  (typeof SCALE_VERIFICATION_ERROR_CODES)[keyof typeof SCALE_VERIFICATION_ERROR_CODES];

export class ScaleVerificationError extends Error {
  constructor(
    public readonly code: ScaleVerificationErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ScaleVerificationError';
  }
}

/**
 * Compute deviation percent rounded to 4 decimal places
 */
export function computeDeviationPercent(certified: number, actual: number): number {
  if (certified === 0) return 0;
  const raw = ((actual - certified) / certified) * 100;
  return Math.round(raw * 10000) / 10000;
}

/**
 * Determine pass/fail given tolerance percent
 */
export function evaluateResult(deviationPercent: number, tolerancePercent: number): VerificationResult {
  return Math.abs(deviationPercent) <= tolerancePercent ? 'pass' : 'fail';
}

/**
 * Detect extreme deviation (>10×) suggesting wrong weight selected
 */
export function isExtremeDeviation(certified: number, actual: number): boolean {
  if (certified === 0) return false;
  const ratio = Math.abs(actual / certified);
  return ratio < 0.1 || ratio > 10;
}
