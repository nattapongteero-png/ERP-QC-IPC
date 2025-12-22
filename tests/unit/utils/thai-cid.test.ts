import { describe, it, expect } from 'vitest';
import {
  validateThaiCid,
  formatThaiCid,
  isValidThaiCidFormat,
  cleanThaiCid,
  generateTestThaiCid,
} from '@/lib/utils/thai-cid';

describe('Thai CID Validation', () => {
  it('should validate correct Thai CID with checksum', () => {
    // Generate a valid test CID and verify it passes validation
    const validCid = generateTestThaiCid();
    expect(validateThaiCid(validCid)).toBe(true);

    // Known valid test CID (calculated checksum)
    // 1-1007-00123-45-X where X is the checksum
    // For 110070012345: sum = 1*13 + 1*12 + 0*11 + 0*10 + 7*9 + 0*8 + 0*7 + 1*6 + 2*5 + 3*4 + 4*3 + 5*2
    // = 13 + 12 + 0 + 0 + 63 + 0 + 0 + 6 + 10 + 12 + 12 + 10 = 138
    // 138 % 11 = 6, checksum = (11 - 6) % 10 = 5
    expect(validateThaiCid('1100700123455')).toBe(true);
  });

  it('should reject invalid checksum', () => {
    // Same CID but with wrong checksum (6 instead of 5)
    expect(validateThaiCid('1100700123456')).toBe(false);
  });

  it('should reject invalid length', () => {
    expect(validateThaiCid('123456789012')).toBe(false); // 12 digits
    expect(validateThaiCid('12345678901234')).toBe(false); // 14 digits
    expect(validateThaiCid('')).toBe(false);
  });

  it('should reject non-numeric characters', () => {
    expect(validateThaiCid('123456789012A')).toBe(false);
    expect(validateThaiCid('1-234-56789-01-2')).toBe(false);
  });

  it('should format Thai CID correctly', () => {
    expect(formatThaiCid('1234567890123')).toBe('1-2345-67890-12-3');
    expect(formatThaiCid('')).toBe('');
    expect(formatThaiCid('123')).toBe('123'); // Return as-is if invalid
  });

  it('should check format without checksum validation', () => {
    expect(isValidThaiCidFormat('1234567890123')).toBe(true);
    expect(isValidThaiCidFormat('123456789012')).toBe(false);
    expect(isValidThaiCidFormat('123456789012A')).toBe(false);
  });

  it('should clean Thai CID by removing non-digits', () => {
    expect(cleanThaiCid('1-2345-67890-12-3')).toBe('1234567890123');
    expect(cleanThaiCid('1234567890123')).toBe('1234567890123');
  });

  it('should generate valid test Thai CIDs', () => {
    // Generate multiple and verify all are valid
    for (let i = 0; i < 10; i++) {
      const cid = generateTestThaiCid();
      expect(cid).toHaveLength(13);
      expect(validateThaiCid(cid)).toBe(true);
    }
  });
});
