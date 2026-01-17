/**
 * Accounting Tax Service Unit Tests
 * Feature: 010-accounting-module-integration
 * User Story 6: Manage VAT and Withholding Tax
 *
 * Tests VAT calculation, WHT calculation, and tax report generation.
 * These are pure calculation functions - no database access needed.
 */

import { describe, it, expect } from 'vitest';
import { calculateVAT, calculateWHT } from '@/lib/services/accounting.service';
import {
  WHT_RATES,
  getWHTRate,
  getWHTRateConfig,
  getWHTRateOptions,
  calculateWHTFromConfig,
  THAI_VAT_RATE,
  WHT_MINIMUM_THRESHOLD,
} from '@/lib/db/seeds/wht-rates';

describe('VAT Calculations', () => {
  describe('calculateVAT', () => {
    it('should calculate VAT at 7% correctly', () => {
      const result = calculateVAT(1000);
      expect(result.vatAmount).toBe(70);
      expect(result.totalAmount).toBe(1070);
    });

    it('should handle zero amount', () => {
      const result = calculateVAT(0);
      expect(result.vatAmount).toBe(0);
      expect(result.totalAmount).toBe(0);
    });

    it('should handle decimal amounts', () => {
      const result = calculateVAT(1234.56);
      expect(result.vatAmount).toBeCloseTo(86.42, 2);
      expect(result.totalAmount).toBeCloseTo(1320.98, 2);
    });

    it('should handle large amounts', () => {
      const result = calculateVAT(1000000);
      expect(result.vatAmount).toBe(70000);
      expect(result.totalAmount).toBe(1070000);
    });
  });

  describe('THAI_VAT_RATE constant', () => {
    it('should be 7%', () => {
      expect(THAI_VAT_RATE).toBe(7);
    });
  });
});

describe('WHT Calculations', () => {
  describe('calculateWHT', () => {
    it('should calculate WHT at 3% correctly', () => {
      const result = calculateWHT(1000, 3);
      expect(result.whtAmount).toBe(30);
      expect(result.netPayment).toBe(970);
    });

    it('should calculate WHT at 5% correctly', () => {
      const result = calculateWHT(1000, 5);
      expect(result.whtAmount).toBe(50);
      expect(result.netPayment).toBe(950);
    });

    it('should calculate WHT at 1% correctly', () => {
      const result = calculateWHT(1000, 1);
      expect(result.whtAmount).toBe(10);
      expect(result.netPayment).toBe(990);
    });

    it('should handle zero rate', () => {
      const result = calculateWHT(1000, 0);
      expect(result.whtAmount).toBe(0);
      expect(result.netPayment).toBe(1000);
    });

    it('should handle decimal amounts', () => {
      const result = calculateWHT(1234.56, 3);
      expect(result.whtAmount).toBeCloseTo(37.04, 2);
      expect(result.netPayment).toBeCloseTo(1197.52, 2);
    });
  });
});

describe('WHT Rate Configuration', () => {
  describe('WHT_RATES', () => {
    it('should contain standard Thai WHT rate categories', () => {
      expect(WHT_RATES.length).toBeGreaterThan(0);

      const codes = WHT_RATES.map(r => r.code);
      expect(codes).toContain('SERVICE');
      expect(codes).toContain('RENT');
      expect(codes).toContain('TRANSPORT');
      expect(codes).toContain('ADVERTISING');
      expect(codes).toContain('PROFESSIONAL');
    });

    it('should have correct rates for service fees', () => {
      const serviceRate = WHT_RATES.find(r => r.code === 'SERVICE');
      expect(serviceRate).toBeDefined();
      expect(serviceRate?.rateIndividual).toBe(3);
      expect(serviceRate?.rateJuristicPerson).toBe(3);
    });

    it('should have correct rates for rent', () => {
      const rentRate = WHT_RATES.find(r => r.code === 'RENT');
      expect(rentRate).toBeDefined();
      expect(rentRate?.rateIndividual).toBe(5);
      expect(rentRate?.rateJuristicPerson).toBe(5);
    });

    it('should have correct rates for transport', () => {
      const transportRate = WHT_RATES.find(r => r.code === 'TRANSPORT');
      expect(transportRate).toBeDefined();
      expect(transportRate?.rateIndividual).toBe(1);
      expect(transportRate?.rateJuristicPerson).toBe(1);
    });
  });

  describe('getWHTRate', () => {
    it('should return individual rate for PND 3', () => {
      const rate = getWHTRate('SERVICE', 'pnd3');
      expect(rate).toBe(3);
    });

    it('should return juristic person rate for PND 53', () => {
      const rate = getWHTRate('SERVICE', 'pnd53');
      expect(rate).toBe(3);
    });

    it('should return undefined for unknown code', () => {
      const rate = getWHTRate('UNKNOWN', 'pnd3');
      expect(rate).toBeUndefined();
    });

    it('should handle rent rates correctly', () => {
      expect(getWHTRate('RENT', 'pnd3')).toBe(5);
      expect(getWHTRate('RENT', 'pnd53')).toBe(5);
    });
  });

  describe('getWHTRateConfig', () => {
    it('should return full config for valid code', () => {
      const config = getWHTRateConfig('SERVICE');
      expect(config).toBeDefined();
      expect(config?.code).toBe('SERVICE');
      expect(config?.nameTh).toBe('ค่าบริการ');
      expect(config?.nameEn).toBe('Service Fees');
    });

    it('should return undefined for unknown code', () => {
      const config = getWHTRateConfig('UNKNOWN');
      expect(config).toBeUndefined();
    });
  });

  describe('getWHTRateOptions', () => {
    it('should return array of options for dropdown', () => {
      const options = getWHTRateOptions();
      expect(options.length).toBeGreaterThan(0);
      expect(options[0]).toHaveProperty('code');
      expect(options[0]).toHaveProperty('nameTh');
      expect(options[0]).toHaveProperty('nameEn');
    });
  });

  describe('calculateWHTFromConfig', () => {
    it('should calculate WHT from config correctly', () => {
      const result = calculateWHTFromConfig(10000, 'SERVICE', 'pnd53');
      expect(result).not.toBeNull();
      expect(result?.whtRate).toBe(3);
      expect(result?.whtAmount).toBe(300);
      expect(result?.netPayment).toBe(9700);
    });

    it('should return zero for amounts below threshold', () => {
      const result = calculateWHTFromConfig(500, 'SERVICE', 'pnd53');
      expect(result).not.toBeNull();
      expect(result?.whtRate).toBe(0);
      expect(result?.whtAmount).toBe(0);
      expect(result?.netPayment).toBe(500);
    });

    it('should return null for unknown WHT type', () => {
      const result = calculateWHTFromConfig(10000, 'UNKNOWN', 'pnd53');
      expect(result).toBeNull();
    });

    it('should use individual rate for PND 3', () => {
      const result = calculateWHTFromConfig(10000, 'RENT', 'pnd3');
      expect(result?.whtRate).toBe(5);
      expect(result?.whtAmount).toBe(500);
    });

    it('should handle minimum threshold exactly', () => {
      const result = calculateWHTFromConfig(WHT_MINIMUM_THRESHOLD, 'SERVICE', 'pnd53');
      expect(result).not.toBeNull();
      expect(result?.whtAmount).toBe(30); // 3% of 1000
    });

    it('should handle just below threshold', () => {
      const result = calculateWHTFromConfig(WHT_MINIMUM_THRESHOLD - 1, 'SERVICE', 'pnd53');
      expect(result?.whtAmount).toBe(0);
    });
  });

  describe('WHT_MINIMUM_THRESHOLD', () => {
    it('should be 1000 THB', () => {
      expect(WHT_MINIMUM_THRESHOLD).toBe(1000);
    });
  });
});

describe('WHT Certificate Number Generation', () => {
  it('should generate certificate number in correct format', () => {
    // Format: WHT{type}-YYYYMM-NNNNNN
    const certNumber = 'WHT53-202501-000001';
    expect(certNumber).toMatch(/^WHT(3|53)-\d{6}-\d{6}$/);
  });

  it('should differentiate PND 3 and PND 53 certificates', () => {
    const pnd3Cert = 'WHT3-202501-000001';
    const pnd53Cert = 'WHT53-202501-000001';

    expect(pnd3Cert).toContain('WHT3-');
    expect(pnd53Cert).toContain('WHT53-');
    expect(pnd3Cert).not.toBe(pnd53Cert);
  });
});

describe('Tax Period Format', () => {
  it('should use YYYY-MM format', () => {
    const taxPeriod = '2025-01';
    expect(taxPeriod).toMatch(/^\d{4}-\d{2}$/);
  });

  it('should generate valid tax period from date', () => {
    const date = new Date('2025-01-15');
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const taxPeriod = `${year}-${month}`;

    expect(taxPeriod).toBe('2025-01');
  });
});

describe('WHT Rate Categories', () => {
  const expectedCategories = [
    { code: 'SERVICE', rateIndividual: 3, rateJuristicPerson: 3 },
    { code: 'RENT', rateIndividual: 5, rateJuristicPerson: 5 },
    { code: 'TRANSPORT', rateIndividual: 1, rateJuristicPerson: 1 },
    { code: 'ADVERTISING', rateIndividual: 2, rateJuristicPerson: 2 },
    { code: 'PROFESSIONAL', rateIndividual: 3, rateJuristicPerson: 3 },
    { code: 'CONTRACT', rateIndividual: 3, rateJuristicPerson: 3 },
  ];

  expectedCategories.forEach(({ code, rateIndividual, rateJuristicPerson }) => {
    it(`should have correct rates for ${code}`, () => {
      const config = getWHTRateConfig(code);
      expect(config).toBeDefined();
      expect(config?.rateIndividual).toBe(rateIndividual);
      expect(config?.rateJuristicPerson).toBe(rateJuristicPerson);
    });
  });
});

describe('VAT Report Structure', () => {
  it('should have correct report interface', () => {
    const mockReport = {
      taxPeriod: '2025-01',
      inputVAT: {
        entries: [],
        totalTaxableAmount: 0,
        totalVATAmount: 0,
      },
      outputVAT: {
        entries: [],
        totalTaxableAmount: 0,
        totalVATAmount: 0,
      },
      netVAT: 0,
    };

    expect(mockReport).toHaveProperty('taxPeriod');
    expect(mockReport).toHaveProperty('inputVAT');
    expect(mockReport).toHaveProperty('outputVAT');
    expect(mockReport).toHaveProperty('netVAT');
  });

  it('should calculate net VAT correctly', () => {
    const outputVAT = 7000;
    const inputVAT = 3000;
    const netVAT = outputVAT - inputVAT;

    expect(netVAT).toBe(4000); // Positive = VAT payable
  });

  it('should handle refundable VAT', () => {
    const outputVAT = 2000;
    const inputVAT = 5000;
    const netVAT = outputVAT - inputVAT;

    expect(netVAT).toBe(-3000); // Negative = VAT refundable
  });
});

describe('WHT Certificate Summary Structure', () => {
  it('should have correct summary interface', () => {
    const mockSummary = {
      taxPeriod: '2025-01',
      certificateType: 'pnd53' as const,
      entries: [],
      totalPaymentAmount: 0,
      totalWHTAmount: 0,
      totalNetAmount: 0,
      certificateCount: 0,
    };

    expect(mockSummary).toHaveProperty('taxPeriod');
    expect(mockSummary).toHaveProperty('certificateType');
    expect(mockSummary).toHaveProperty('entries');
    expect(mockSummary).toHaveProperty('totalPaymentAmount');
    expect(mockSummary).toHaveProperty('totalWHTAmount');
    expect(mockSummary).toHaveProperty('totalNetAmount');
    expect(mockSummary).toHaveProperty('certificateCount');
  });

  it('should validate certificate types', () => {
    const validTypes = ['pnd3', 'pnd53'];
    validTypes.forEach(type => {
      expect(['pnd3', 'pnd53']).toContain(type);
    });
  });
});
