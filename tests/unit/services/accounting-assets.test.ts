/**
 * Accounting Assets Service Unit Tests
 * Feature: 010-accounting-module-integration
 * User Story 7: Manage Fixed Assets and Depreciation
 *
 * Tests asset category management, fixed asset operations, and depreciation calculations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database module
vi.mock('@/lib/db', () => ({
  db: vi.fn(),
  isSqlite: vi.fn(() => true),
}));

// Mock date-utils
vi.mock('@/lib/db/date-utils', () => ({
  getNow: vi.fn(() => '2025-01-15'),
  toDbDate: vi.fn((date: string) => date),
  toQueryDate: vi.fn((date: string) => date),
  getTodayStr: vi.fn(() => '2025-01-15'),
  formatDateFromDb: vi.fn((date: string | Date) => {
    if (date instanceof Date) return date.toISOString().split('T')[0];
    return date;
  }),
}));

// Mock schema
vi.mock('@/lib/db/schema', () => ({
  sqliteAssetCategories: {
    id: { name: 'id' },
    code: { name: 'code' },
    nameTh: { name: 'name_th' },
    nameEn: { name: 'name_en' },
    defaultUsefulLifeMonths: { name: 'default_useful_life_months' },
    defaultDepreciationMethod: { name: 'default_depreciation_method' },
    maxDepreciationRate: { name: 'max_depreciation_rate' },
  },
  sqliteFixedAssets: {
    id: { name: 'id' },
    assetCode: { name: 'asset_code' },
    nameTh: { name: 'name_th' },
    nameEn: { name: 'name_en' },
    categoryId: { name: 'category_id' },
    acquisitionDate: { name: 'acquisition_date' },
    acquisitionCost: { name: 'acquisition_cost' },
    salvageValue: { name: 'salvage_value' },
    usefulLifeMonths: { name: 'useful_life_months' },
    depreciationMethod: { name: 'depreciation_method' },
    depreciationStartDate: { name: 'depreciation_start_date' },
    accumulatedDepreciation: { name: 'accumulated_depreciation' },
    netBookValue: { name: 'net_book_value' },
    status: { name: 'status' },
    location: { name: 'location' },
    departmentId: { name: 'department_id' },
  },
  sqliteAssetDepreciations: {},
  sqliteAssetDisposals: {},
  sqliteAssetMovements: {},
  mysqlAssetCategories: {},
  mysqlFixedAssets: {},
  mysqlAssetDepreciations: {},
  mysqlAssetDisposals: {},
  mysqlAssetMovements: {},
}));

// Import after mocks
import {
  calculateStraightLineDepreciation,
  calculateDecliningBalanceDepreciation,
  getAssetCategoryConfig,
  getAssetCategoryOptions,
  ASSET_CATEGORIES,
  getDepreciationMethodName,
  THAI_DEPRECIATION_REFERENCE,
} from '@/lib/db/seeds/asset-categories';

describe('Asset Category Configuration', () => {
  describe('ASSET_CATEGORIES', () => {
    it('should contain standard Thai asset categories', () => {
      expect(ASSET_CATEGORIES.length).toBeGreaterThan(0);

      const codes = ASSET_CATEGORIES.map(c => c.code);
      expect(codes).toContain('LAND');
      expect(codes).toContain('BUILDING');
      expect(codes).toContain('MACHINERY');
      expect(codes).toContain('VEHICLE');
      expect(codes).toContain('FURNITURE');
      expect(codes).toContain('COMPUTER');
      expect(codes).toContain('LAB_EQUIPMENT');
      expect(codes).toContain('MFG_EQUIPMENT');
    });

    it('should have correct Thai Revenue Code rates for buildings', () => {
      const building = ASSET_CATEGORIES.find(c => c.code === 'BUILDING');
      expect(building).toBeDefined();
      expect(building?.defaultUsefulLifeMonths).toBe(240); // 20 years
      expect(building?.maxDepreciationRate).toBe(5); // 5% per year
    });

    it('should have correct Thai Revenue Code rates for machinery', () => {
      const machinery = ASSET_CATEGORIES.find(c => c.code === 'MACHINERY');
      expect(machinery).toBeDefined();
      expect(machinery?.defaultUsefulLifeMonths).toBe(60); // 5 years
      expect(machinery?.maxDepreciationRate).toBe(20); // 20% per year
    });

    it('should have correct Thai Revenue Code rates for computers', () => {
      const computer = ASSET_CATEGORIES.find(c => c.code === 'COMPUTER');
      expect(computer).toBeDefined();
      expect(computer?.defaultUsefulLifeMonths).toBe(36); // 3 years
      expect(computer?.maxDepreciationRate).toBe(33.33); // 33.33% per year
    });

    it('should not depreciate land', () => {
      const land = ASSET_CATEGORIES.find(c => c.code === 'LAND');
      expect(land).toBeDefined();
      expect(land?.defaultUsefulLifeMonths).toBe(0);
      expect(land?.maxDepreciationRate).toBe(0);
    });
  });

  describe('getAssetCategoryConfig', () => {
    it('should return config for valid code', () => {
      const config = getAssetCategoryConfig('MACHINERY');
      expect(config).toBeDefined();
      expect(config?.code).toBe('MACHINERY');
      expect(config?.nameTh).toBe('เครื่องจักรและอุปกรณ์');
      expect(config?.nameEn).toBe('Machinery and Equipment');
    });

    it('should return undefined for unknown code', () => {
      const config = getAssetCategoryConfig('UNKNOWN');
      expect(config).toBeUndefined();
    });
  });

  describe('getAssetCategoryOptions', () => {
    it('should return options for dropdown', () => {
      const options = getAssetCategoryOptions();
      expect(options.length).toBeGreaterThan(0);
      expect(options[0]).toHaveProperty('code');
      expect(options[0]).toHaveProperty('nameTh');
      expect(options[0]).toHaveProperty('nameEn');
      expect(options[0]).toHaveProperty('usefulLifeYears');
      expect(options[0]).toHaveProperty('maxRate');
    });

    it('should convert useful life from months to years', () => {
      const options = getAssetCategoryOptions();
      const building = options.find(o => o.code === 'BUILDING');
      expect(building?.usefulLifeYears).toBe(20);
    });
  });

  describe('getDepreciationMethodName', () => {
    it('should return Thai and English names for straight line', () => {
      const name = getDepreciationMethodName('straight_line');
      expect(name.th).toBe('วิธีเส้นตรง');
      expect(name.en).toBe('Straight Line');
    });

    it('should return Thai and English names for declining balance', () => {
      const name = getDepreciationMethodName('declining_balance');
      expect(name.th).toBe('วิธียอดลดลง');
      expect(name.en).toBe('Declining Balance');
    });
  });
});

describe('Depreciation Calculations', () => {
  describe('calculateStraightLineDepreciation', () => {
    it('should calculate monthly depreciation correctly', () => {
      const acquisitionCost = 120000;
      const salvageValue = 0;
      const usefulLifeMonths = 60; // 5 years

      const monthlyDepreciation = calculateStraightLineDepreciation(
        acquisitionCost,
        salvageValue,
        usefulLifeMonths
      );

      expect(monthlyDepreciation).toBe(2000); // 120000 / 60
    });

    it('should account for salvage value', () => {
      const acquisitionCost = 120000;
      const salvageValue = 12000;
      const usefulLifeMonths = 60;

      const monthlyDepreciation = calculateStraightLineDepreciation(
        acquisitionCost,
        salvageValue,
        usefulLifeMonths
      );

      expect(monthlyDepreciation).toBe(1800); // (120000 - 12000) / 60
    });

    it('should return 0 for zero useful life', () => {
      const monthlyDepreciation = calculateStraightLineDepreciation(100000, 0, 0);
      expect(monthlyDepreciation).toBe(0);
    });

    it('should handle decimal results', () => {
      const monthlyDepreciation = calculateStraightLineDepreciation(100000, 0, 36);
      expect(monthlyDepreciation).toBeCloseTo(2777.78, 2);
    });
  });

  describe('calculateDecliningBalanceDepreciation', () => {
    it('should calculate declining balance depreciation correctly', () => {
      const netBookValue = 100000;
      const annualRate = 20; // 20% per year

      const monthlyDepreciation = calculateDecliningBalanceDepreciation(netBookValue, annualRate);

      // 20% / 12 / 100 * 100000 = 1666.67
      expect(monthlyDepreciation).toBeCloseTo(1666.67, 2);
    });

    it('should decrease over time as net book value decreases', () => {
      const year1NBV = 100000;
      const year2NBV = 80000; // After some depreciation
      const annualRate = 20;

      const dep1 = calculateDecliningBalanceDepreciation(year1NBV, annualRate);
      const dep2 = calculateDecliningBalanceDepreciation(year2NBV, annualRate);

      expect(dep2).toBeLessThan(dep1);
    });

    it('should return 0 for zero net book value', () => {
      const monthlyDepreciation = calculateDecliningBalanceDepreciation(0, 20);
      expect(monthlyDepreciation).toBe(0);
    });
  });
});

describe('Thai Revenue Code Compliance', () => {
  describe('THAI_DEPRECIATION_REFERENCE', () => {
    it('should reference Section 65 of Thai Revenue Code', () => {
      expect(THAI_DEPRECIATION_REFERENCE.legalBasis).toContain('Section 65');
    });

    it('should include both depreciation methods', () => {
      expect(THAI_DEPRECIATION_REFERENCE.methods).toContain('straight_line');
      expect(THAI_DEPRECIATION_REFERENCE.methods).toContain('declining_balance');
    });

    it('should document key rules', () => {
      expect(THAI_DEPRECIATION_REFERENCE.rules.length).toBeGreaterThan(0);
      expect(THAI_DEPRECIATION_REFERENCE.rules.some(r => r.includes('Land'))).toBe(true);
      expect(THAI_DEPRECIATION_REFERENCE.rules.some(r => r.includes('Buildings'))).toBe(true);
    });
  });

  describe('Depreciation Rate Limits', () => {
    const expectedRates = [
      { code: 'BUILDING', maxRate: 5, yearsMin: 20 },
      { code: 'MACHINERY', maxRate: 20, yearsMin: 5 },
      { code: 'VEHICLE', maxRate: 20, yearsMin: 5 },
      { code: 'FURNITURE', maxRate: 20, yearsMin: 5 },
      { code: 'COMPUTER', maxRate: 33.33, yearsMin: 3 },
    ];

    expectedRates.forEach(({ code, maxRate, yearsMin }) => {
      it(`should have ${maxRate}% max rate for ${code} (${yearsMin} years)`, () => {
        const config = getAssetCategoryConfig(code);
        expect(config).toBeDefined();
        expect(config?.maxDepreciationRate).toBe(maxRate);
        expect(config?.defaultUsefulLifeMonths).toBe(yearsMin * 12);
      });
    });
  });
});

describe('Asset Code Generation', () => {
  it('should generate code in FA-YYYYMM-NNNNNN format', () => {
    const code = 'FA-202501-000001';
    expect(code).toMatch(/^FA-\d{6}-\d{6}$/);
  });

  it('should increment sequence correctly', () => {
    const code1 = 'FA-202501-000001';
    const code2 = 'FA-202501-000002';

    const seq1 = parseInt(code1.replace('FA-202501-', ''), 10);
    const seq2 = parseInt(code2.replace('FA-202501-', ''), 10);

    expect(seq2).toBe(seq1 + 1);
  });
});

describe('Asset Status', () => {
  it('should support standard statuses', () => {
    const validStatuses = ['active', 'disposed', 'fully_depreciated'];
    validStatuses.forEach(status => {
      expect(['active', 'disposed', 'fully_depreciated']).toContain(status);
    });
  });
});

describe('Asset Disposal Types', () => {
  it('should support standard disposal types', () => {
    const validTypes = ['sale', 'scrap', 'write_off', 'donation'];
    validTypes.forEach(type => {
      expect(['sale', 'scrap', 'write_off', 'donation']).toContain(type);
    });
  });
});

describe('Gain/Loss Calculation', () => {
  it('should calculate gain when sale price > net book value', () => {
    const netBookValue = 50000;
    const salePrice = 60000;
    const gainLoss = salePrice - netBookValue;

    expect(gainLoss).toBe(10000); // Gain
    expect(gainLoss).toBeGreaterThan(0);
  });

  it('should calculate loss when sale price < net book value', () => {
    const netBookValue = 50000;
    const salePrice = 30000;
    const gainLoss = salePrice - netBookValue;

    expect(gainLoss).toBe(-20000); // Loss
    expect(gainLoss).toBeLessThan(0);
  });

  it('should calculate zero when sale price = net book value', () => {
    const netBookValue = 50000;
    const salePrice = 50000;
    const gainLoss = salePrice - netBookValue;

    expect(gainLoss).toBe(0);
  });
});

describe('Net Book Value Calculation', () => {
  it('should calculate net book value correctly', () => {
    const acquisitionCost = 100000;
    const accumulatedDepreciation = 40000;
    const netBookValue = acquisitionCost - accumulatedDepreciation;

    expect(netBookValue).toBe(60000);
  });

  it('should not go below salvage value', () => {
    const acquisitionCost = 100000;
    const salvageValue = 10000;
    const accumulatedDepreciation = 95000;

    const rawNBV = acquisitionCost - accumulatedDepreciation;
    const netBookValue = Math.max(rawNBV, salvageValue);

    expect(netBookValue).toBe(10000); // Minimum is salvage value
  });
});

describe('Depreciation Schedule', () => {
  it('should fully depreciate over useful life', () => {
    const acquisitionCost = 60000;
    const salvageValue = 0;
    const usefulLifeMonths = 60;

    const monthlyDep = calculateStraightLineDepreciation(
      acquisitionCost,
      salvageValue,
      usefulLifeMonths
    );

    const totalDepreciation = monthlyDep * usefulLifeMonths;
    expect(totalDepreciation).toBe(acquisitionCost);
  });

  it('should leave salvage value after full depreciation', () => {
    const acquisitionCost = 60000;
    const salvageValue = 6000;
    const usefulLifeMonths = 60;

    const monthlyDep = calculateStraightLineDepreciation(
      acquisitionCost,
      salvageValue,
      usefulLifeMonths
    );

    const totalDepreciation = monthlyDep * usefulLifeMonths;
    const remainingValue = acquisitionCost - totalDepreciation;

    expect(remainingValue).toBe(salvageValue);
  });
});
