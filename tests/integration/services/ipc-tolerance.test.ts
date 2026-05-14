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

  // ============================================================
  // Additional tests per user requirements (เกณฑ์ 3.1 & 3.2)
  // ============================================================

  describe('Requirement 3.1 — Numeric ±% tolerance scenarios', () => {
    // เกณฑ์ 3.1: ใส่ค่าตัวเลข + ±% tolerance
    // ถ้าค่าไม่อยู่ใน Min-Max → sample fail
    // ถ้า % ของ sample ที่ fail > tolerance → ทั้งหัวข้อ fail

    it('should pass: 5 samples, 0 fail, tolerance 10%', () => {
      const samples = [
        { numericValue: 200 }, { numericValue: 195 },
        { numericValue: 205 }, { numericValue: 192 }, { numericValue: 208 },
      ];
      // 0/5 = 0% fail ≤ 10% → PASS
      expect(calculateIPCResult(samples, 'numeric', 10, 190, 210)).toBe('pass');
    });

    it('should pass: exactly at min/max boundary values', () => {
      const samples = [
        { numericValue: 190 }, // exact min → pass
        { numericValue: 210 }, // exact max → pass
        { numericValue: 200 },
      ];
      expect(calculateIPCResult(samples, 'numeric', 0, 190, 210)).toBe('pass');
    });

    it('should fail: just outside min boundary', () => {
      const samples = [
        { numericValue: 189.99 }, // just below min → fail
        { numericValue: 200 },
        { numericValue: 205 },
      ];
      // 1/3 = 33.3% > 0% → FAIL
      expect(calculateIPCResult(samples, 'numeric', 0, 190, 210)).toBe('fail');
    });

    it('should fail: just outside max boundary', () => {
      const samples = [
        { numericValue: 200 },
        { numericValue: 210.01 }, // just above max → fail
        { numericValue: 205 },
      ];
      // 1/3 = 33.3% > 0% → FAIL
      expect(calculateIPCResult(samples, 'numeric', 0, 190, 210)).toBe('fail');
    });

    it('should pass: 3/20 fail = 15%, tolerance 15%', () => {
      const samples = Array.from({ length: 20 }, (_, i) => ({
        numericValue: i < 3 ? 220 : 200, // first 3 fail, rest pass
      }));
      // 3/20 = 15% ≤ 15% → PASS
      expect(calculateIPCResult(samples, 'numeric', 15, 190, 210)).toBe('pass');
    });

    it('should fail: 4/20 fail = 20%, tolerance 15%', () => {
      const samples = Array.from({ length: 20 }, (_, i) => ({
        numericValue: i < 4 ? 220 : 200, // first 4 fail, rest pass
      }));
      // 4/20 = 20% > 15% → FAIL
      expect(calculateIPCResult(samples, 'numeric', 15, 190, 210)).toBe('fail');
    });

    it('should handle mix of below-min and above-max failures', () => {
      const samples = [
        { numericValue: 180 }, // below min → fail
        { numericValue: 220 }, // above max → fail
        { numericValue: 200 }, { numericValue: 195 }, { numericValue: 205 },
        { numericValue: 198 }, { numericValue: 201 }, { numericValue: 199 },
        { numericValue: 203 }, { numericValue: 197 },
      ];
      // 2/10 = 20% > 10% → FAIL
      expect(calculateIPCResult(samples, 'numeric', 10, 190, 210)).toBe('fail');
      // but with 20% tolerance → PASS
      expect(calculateIPCResult(samples, 'numeric', 20, 190, 210)).toBe('pass');
    });

    it('should handle all samples failing', () => {
      const samples = [
        { numericValue: 220 }, { numericValue: 180 }, { numericValue: 250 },
      ];
      // 3/3 = 100% > any tolerance < 100 → FAIL
      expect(calculateIPCResult(samples, 'numeric', 50, 190, 210)).toBe('fail');
      // 100% tolerance → PASS (100 > 100 is false)
      expect(calculateIPCResult(samples, 'numeric', 100, 190, 210)).toBe('pass');
    });
  });

  describe('Requirement 3.2 — Checkbox pass/fail scenarios', () => {
    // เกณฑ์ 3.2: ติ๊ก checkbox ผ่าน/ไม่ผ่าน
    // ใช้ tolerance % เดียวกัน

    it('should pass: all 5 checkboxes pass, tolerance 0%', () => {
      const samples = Array.from({ length: 5 }, () => ({ result: 'pass' }));
      expect(calculateIPCResult(samples, 'checkbox', 0)).toBe('pass');
    });

    it('should fail: 1/5 checkbox fail = 20%, tolerance 10%', () => {
      const samples = [
        { result: 'pass' }, { result: 'pass' }, { result: 'fail' },
        { result: 'pass' }, { result: 'pass' },
      ];
      // 1/5 = 20% > 10% → FAIL
      expect(calculateIPCResult(samples, 'checkbox', 10)).toBe('fail');
    });

    it('should pass: 1/5 checkbox fail = 20%, tolerance 20%', () => {
      const samples = [
        { result: 'pass' }, { result: 'pass' }, { result: 'fail' },
        { result: 'pass' }, { result: 'pass' },
      ];
      // 1/5 = 20% ≤ 20% → PASS
      expect(calculateIPCResult(samples, 'checkbox', 20)).toBe('pass');
    });

    it('should fail: 3/10 checkbox fail = 30%, tolerance 25%', () => {
      const samples = [
        { result: 'fail' }, { result: 'pass' }, { result: 'fail' },
        { result: 'pass' }, { result: 'pass' }, { result: 'fail' },
        { result: 'pass' }, { result: 'pass' }, { result: 'pass' }, { result: 'pass' },
      ];
      // 3/10 = 30% > 25% → FAIL
      expect(calculateIPCResult(samples, 'checkbox', 25)).toBe('fail');
    });

    it('should pass: 3/10 checkbox fail = 30%, tolerance 30%', () => {
      const samples = [
        { result: 'fail' }, { result: 'pass' }, { result: 'fail' },
        { result: 'pass' }, { result: 'pass' }, { result: 'fail' },
        { result: 'pass' }, { result: 'pass' }, { result: 'pass' }, { result: 'pass' },
      ];
      // 3/10 = 30% ≤ 30% → PASS
      expect(calculateIPCResult(samples, 'checkbox', 30)).toBe('pass');
    });

    it('should handle all checkboxes fail', () => {
      const samples = Array.from({ length: 5 }, () => ({ result: 'fail' }));
      // 5/5 = 100% > 50% → FAIL
      expect(calculateIPCResult(samples, 'checkbox', 50)).toBe('fail');
    });

    it('should treat undefined/missing result as not-pass', () => {
      // checkbox mode: if result is undefined, it's not 'pass' → treated as fail
      const samples = [
        { result: 'pass' }, { result: undefined }, { result: 'pass' },
      ];
      // 1/3 = 33.3% > 0% → FAIL
      expect(calculateIPCResult(samples, 'checkbox', 0)).toBe('fail');
    });
  });

  describe('Numeric mode without min/max (spec not defined)', () => {
    it('should pass all samples when no spec limits defined', () => {
      const samples = [
        { numericValue: 999 }, { numericValue: -100 },
      ];
      // No specMin/specMax → all default to pass
      expect(calculateIPCResult(samples, 'numeric', 0)).toBe('pass');
    });

    it('should pass when only min is defined (max undefined)', () => {
      const samples = [{ numericValue: 100 }];
      // specMax undefined → sample defaults to pass
      expect(calculateIPCResult(samples, 'numeric', 0, 50)).toBe('pass');
    });
  });

  describe('Fractional tolerance precision', () => {
    it('should handle tolerance with decimal values', () => {
      // 1/3 = 33.33%, tolerance = 33.33% → PASS (≤)
      const samples = [
        { numericValue: 215 }, { numericValue: 200 }, { numericValue: 200 },
      ];
      expect(calculateIPCResult(samples, 'numeric', 33.34, 190, 210)).toBe('pass');
      // tolerance = 33.32% → FAIL (33.33 > 33.32)
      expect(calculateIPCResult(samples, 'numeric', 33.32, 190, 210)).toBe('fail');
    });
  });
});
