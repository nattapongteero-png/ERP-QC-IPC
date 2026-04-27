/**
 * IPC Criteria calculation helpers.
 *
 * These functions translate a Specification (Target) value plus a tolerance
 * percentage into explicit Min/Max bounds. They are used by:
 *   - IPCCriteriaForm (real-time Min/Max preview while typing)
 *   - wo-execution.service.ts (initializeWOIPCTests — stores calculated
 *     minValue/maxValue on quality_tests at work-order start)
 *
 * Keeping the math in one place ensures the form preview and the server-side
 * copy always agree.
 */

/**
 * Calculate Min/Max bounds from a target value and tolerance percent.
 *
 *   Min = target − (target × tolerancePercent / 100)
 *   Max = target + (target × tolerancePercent / 100)
 *
 * Special case: tolerancePercent = 0 → Min = Max = target.
 *
 * Results are rounded to 4 decimal places to avoid floating-point artifacts
 * like 7.2 × 0.15 = 1.0799999999999998.
 *
 * @returns {min, max} or null if inputs are invalid.
 */
export function calculateMinMax(
  target: number,
  tolerancePercent: number,
): { min: number; max: number } | null {
  if (!Number.isFinite(target) || target <= 0) return null;
  if (!Number.isFinite(tolerancePercent) || tolerancePercent < 0) return null;

  const delta = (target * tolerancePercent) / 100;
  return {
    min: roundTo4(target - delta),
    max: roundTo4(target + delta),
  };
}

function roundTo4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/**
 * Validate Target + Tolerance inputs for the IPC Criteria form.
 *
 * @returns null if valid, or a human-readable error message.
 */
export function validateSpecInputs(
  target: number | null | undefined,
  tolerancePercent: number | null | undefined,
): string | null {
  if (target === null || target === undefined || !Number.isFinite(target)) {
    return 'Target (Specification) is required';
  }
  if (target <= 0) {
    return 'Target must be greater than 0';
  }
  const tol = tolerancePercent ?? 0;
  if (!Number.isFinite(tol) || tol < 0 || tol > 100) {
    return 'Tolerance must be between 0 and 100';
  }
  return null;
}
