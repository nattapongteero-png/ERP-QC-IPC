import { describe, it, expect } from 'vitest';
import {
  convertUnits,
  calculateIssuance,
  calculateReturn,
  type UnitConfig,
} from '@/lib/utils/unit-conversion';

const turmericCapsule: UnitConfig = {
  primaryUnit: 'box',
  secondaryUnit: 'capsule',
  weightUnit: 'g',
  conversionRate: 1000,         // 1 box = 1,000 capsules
  secondaryToWeightRate: 0.1,    // 1 capsule = 0.1 g
  weightTrackingEnabled: true,
};

const noWeightItem: UnitConfig = {
  primaryUnit: 'pack',
  secondaryUnit: 'sachet',
  conversionRate: 50,
  weightTrackingEnabled: false,
};

describe('convertUnits — 3-level conversion', () => {
  it('PU input expands to SU and WU', () => {
    const r = convertUnits(2, 'PU', turmericCapsule);
    expect(r.pu).toBe(2);
    expect(r.su).toBe(2000);
    expect(r.wu).toBeCloseTo(200, 6);
  });

  it('SU input bridges to PU and WU', () => {
    const r = convertUnits(1750, 'SU', turmericCapsule);
    expect(r.pu).toBeCloseTo(1.75, 6);
    expect(r.su).toBe(1750);
    expect(r.wu).toBeCloseTo(175, 6);
  });

  it('WU input back-converts via SU', () => {
    const r = convertUnits(175, 'WU', turmericCapsule);
    expect(r.su).toBeCloseTo(1750, 6);
    expect(r.pu).toBeCloseTo(1.75, 6);
    expect(r.wu).toBeCloseTo(175, 6);
  });

  it('returns null for WU when weight tracking is disabled', () => {
    const r = convertUnits(2, 'PU', noWeightItem);
    expect(r.su).toBe(100);
    expect(r.wu).toBeNull();
  });

  it('throws when WU input is requested but tracking is off', () => {
    expect(() => convertUnits(50, 'WU', noWeightItem)).toThrow();
  });
});

describe('calculateIssuance — round-up to PU', () => {
  // The headline test case the spec called out:
  // "Setup: 1 box = 1,000 capsules → request 1,700 capsules → issue 2 boxes"
  it('rounds up 1,700 SU to 2 PU (system-defined test case)', () => {
    const r = calculateIssuance(1700, turmericCapsule);
    expect(r.requestedSU).toBe(1700);
    expect(r.puToIssue).toBe(2);
    expect(r.actualIssuedSU).toBe(2000);
    expect(r.remainderSU).toBe(300);
  });

  it('exact-multiple request needs no extra PU', () => {
    const r = calculateIssuance(2000, turmericCapsule);
    expect(r.puToIssue).toBe(2);
    expect(r.remainderSU).toBe(0);
  });

  it('1 SU still triggers 1 full PU', () => {
    const r = calculateIssuance(1, turmericCapsule);
    expect(r.puToIssue).toBe(1);
    expect(r.actualIssuedSU).toBe(1000);
    expect(r.remainderSU).toBe(999);
  });

  it('throws on zero/negative request', () => {
    expect(() => calculateIssuance(0, turmericCapsule)).toThrow();
    expect(() => calculateIssuance(-5, turmericCapsule)).toThrow();
  });

  it('throws when conversionRate is missing', () => {
    expect(() => calculateIssuance(100, { primaryUnit: 'box' })).toThrow();
  });
});

describe('calculateReturn — weight-based remainder back to PU', () => {
  // The second headline test case:
  // "Production: weighed used = 175 g (1,750 capsules) from 2,000 issued → return 0.25 box"
  it('returns 0.25 PU for 175 g actual use against 2,000 SU issued (system-defined test case)', () => {
    const r = calculateReturn(175, 2000, turmericCapsule);
    expect(r.actualUsedSU).toBeCloseTo(1750, 6);
    expect(r.returnedSU).toBeCloseTo(250, 6);
    expect(r.returnedPU).toBeCloseTo(0.25, 6);
    expect(r.isZeroCost).toBe(true);
  });

  it('zero waste when used weight matches issued SU exactly', () => {
    const r = calculateReturn(200, 2000, turmericCapsule); // 200g = 2000 capsules
    expect(r.returnedSU).toBeCloseTo(0, 6);
    expect(r.returnedPU).toBeCloseTo(0, 6);
  });

  it('throws when consumption exceeds issued amount', () => {
    expect(() => calculateReturn(250, 2000, turmericCapsule)).toThrow(/exceeds/);
  });

  it('throws when weight tracking is disabled', () => {
    expect(() => calculateReturn(50, 100, noWeightItem)).toThrow();
  });
});
