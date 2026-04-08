/**
 * Tests for IPC tolerance-based pass/fail logic
 * Verifies: numeric tolerance %, checkbox mode, backward compatibility (tolerance=0)
 */
import { describe, it, expect } from 'vitest';

/**
 * Pure logic function extracted for testing.
 * Same algorithm as recordIPCTestResult() in wo-execution.service.ts
 */
function calculateIPCResult(
  samples: Array<{ numericValue?: number; result?: string }>,
  criteriaType: 'numeric' | 'checkbox',
  tolerancePercent: number,
  specMin?: number,
  specMax?: number,
): 'pass' | 'fail' {
  const sampleResults = samples.map((s) => {
    if (criteriaType === 'checkbox') {
      return s.result === 'pass';
    }
    if (s.numericValue != null && specMin != null && specMax != null) {
      return s.numericValue >= specMin && s.numericValue <= specMax;
    }
    return true;
  });
  const failCount = sampleResults.filter((passed) => !passed).length;
  const totalCount = sampleResults.length;
  const failPercent = totalCount > 0 ? (failCount / totalCount) * 100 : 0;
  return failPercent > tolerancePercent ? 'fail' : 'pass';
}

describe('IPC Tolerance Pass/Fail Logic', () => {
  describe('Numeric mode with tolerance', () => {
    it('should pass when fail% equals tolerance% (boundary)', () => {
      const samples = [
        { numericValue: 200 }, { numericValue: 195 }, { numericValue: 215 },
        { numericValue: 198 }, { numericValue: 201 }, { numericValue: 193 },
        { numericValue: 205 }, { numericValue: 199 }, { numericValue: 202 }, { numericValue: 197 },
      ];
      expect(calculateIPCResult(samples, 'numeric', 10, 190, 210)).toBe('pass');
    });

    it('should fail when fail% exceeds tolerance%', () => {
      const samples = [
        { numericValue: 200 }, { numericValue: 185 }, { numericValue: 215 },
        { numericValue: 198 }, { numericValue: 201 }, { numericValue: 193 },
        { numericValue: 205 }, { numericValue: 199 }, { numericValue: 202 }, { numericValue: 197 },
      ];
      expect(calculateIPCResult(samples, 'numeric', 10, 190, 210)).toBe('fail');
    });

    it('should pass when all samples are within range', () => {
      const samples = [
        { numericValue: 200 }, { numericValue: 195 }, { numericValue: 205 },
      ];
      expect(calculateIPCResult(samples, 'numeric', 10, 190, 210)).toBe('pass');
    });
  });

  describe('Backward compatibility (tolerance = 0)', () => {
    it('should fail if any single sample fails when tolerance is 0', () => {
      const samples = [
        { numericValue: 200 }, { numericValue: 195 }, { numericValue: 215 },
      ];
      expect(calculateIPCResult(samples, 'numeric', 0, 190, 210)).toBe('fail');
    });

    it('should pass when all samples pass with tolerance 0', () => {
      const samples = [
        { numericValue: 200 }, { numericValue: 195 }, { numericValue: 205 },
      ];
      expect(calculateIPCResult(samples, 'numeric', 0, 190, 210)).toBe('pass');
    });
  });

  describe('Checkbox mode', () => {
    it('should pass when fail% is within tolerance', () => {
      const samples = [
        { result: 'pass' }, { result: 'pass' }, { result: 'fail' },
        { result: 'pass' }, { result: 'pass' },
      ];
      expect(calculateIPCResult(samples, 'checkbox', 20)).toBe('pass');
    });

    it('should fail when fail% exceeds tolerance', () => {
      const samples = [
        { result: 'pass' }, { result: 'fail' }, { result: 'fail' },
        { result: 'pass' }, { result: 'pass' },
      ];
      expect(calculateIPCResult(samples, 'checkbox', 20)).toBe('fail');
    });

    it('should fail if any checkbox fails when tolerance is 0', () => {
      const samples = [
        { result: 'pass' }, { result: 'pass' }, { result: 'fail' },
      ];
      expect(calculateIPCResult(samples, 'checkbox', 0)).toBe('fail');
    });

    it('should pass when all checkboxes pass', () => {
      const samples = [
        { result: 'pass' }, { result: 'pass' }, { result: 'pass' },
      ];
      expect(calculateIPCResult(samples, 'checkbox', 0)).toBe('pass');
    });
  });

  describe('Edge cases', () => {
    it('should pass with empty samples array', () => {
      expect(calculateIPCResult([], 'numeric', 10, 190, 210)).toBe('pass');
    });

    it('should handle 100% tolerance (always pass)', () => {
      const samples = [
        { numericValue: 999 }, { numericValue: 0 },
      ];
      expect(calculateIPCResult(samples, 'numeric', 100, 190, 210)).toBe('pass');
    });

    it('should handle single sample numeric', () => {
      expect(calculateIPCResult([{ numericValue: 215 }], 'numeric', 0, 190, 210)).toBe('fail');
      expect(calculateIPCResult([{ numericValue: 200 }], 'numeric', 0, 190, 210)).toBe('pass');
    });
  });
});
