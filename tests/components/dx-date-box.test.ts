import { describe, it, expect } from 'vitest';
import {
  buddhistDateFormat,
  buddhistDateTimeFormat,
  parseStringToDate,
} from '../../src/components/ui/dx-date-box';

describe('DxDateBox Buddhist Era Formatting', () => {
  describe('buddhistDateFormat', () => {
    describe('formatter', () => {
      it('should convert Gregorian date to Buddhist Era format (DD/MM/YYYY+543)', () => {
        // December 21, 2025 (Gregorian) = December 21, 2568 (Buddhist Era)
        const date = new Date(2025, 11, 21); // Month is 0-indexed
        const result = buddhistDateFormat.formatter!(date);
        expect(result).toBe('21/12/2568');
      });

      it('should pad single-digit day and month with zeros', () => {
        // January 5, 2024 (Gregorian) = January 5, 2567 (Buddhist Era)
        const date = new Date(2024, 0, 5);
        const result = buddhistDateFormat.formatter!(date);
        expect(result).toBe('05/01/2567');
      });

      it('should return empty string for null/undefined date', () => {
        expect(buddhistDateFormat.formatter!(null as unknown as Date)).toBe('');
        expect(buddhistDateFormat.formatter!(undefined as unknown as Date)).toBe('');
      });

      it('should return empty string for invalid date', () => {
        const invalidDate = new Date('invalid');
        expect(buddhistDateFormat.formatter!(invalidDate)).toBe('');
      });

      it('should handle various years correctly', () => {
        // Year 2000 -> 2543
        expect(buddhistDateFormat.formatter!(new Date(2000, 0, 1))).toBe('01/01/2543');
        // Year 1990 -> 2533
        expect(buddhistDateFormat.formatter!(new Date(1990, 5, 15))).toBe('15/06/2533');
        // Year 2030 -> 2573
        expect(buddhistDateFormat.formatter!(new Date(2030, 11, 31))).toBe('31/12/2573');
      });
    });

    describe('parser', () => {
      it('should convert Buddhist Era format back to Gregorian Date', () => {
        const result = buddhistDateFormat.parser!('21/12/2568');
        expect(result).toBeInstanceOf(Date);
        expect(result!.getFullYear()).toBe(2025); // 2568 - 543 = 2025
        expect(result!.getMonth()).toBe(11); // December (0-indexed)
        expect(result!.getDate()).toBe(21);
      });

      it('should parse single-digit day and month', () => {
        const result = buddhistDateFormat.parser!('5/1/2567');
        expect(result!.getFullYear()).toBe(2024);
        expect(result!.getMonth()).toBe(0);
        expect(result!.getDate()).toBe(5);
      });

      it('should return null for empty string', () => {
        expect(buddhistDateFormat.parser!('')).toBeNull();
      });

      it('should return null for invalid format', () => {
        expect(buddhistDateFormat.parser!('2025-12-21')).toBeNull();
        expect(buddhistDateFormat.parser!('invalid')).toBeNull();
        expect(buddhistDateFormat.parser!('21-12-2568')).toBeNull();
      });

      it('should roundtrip correctly (format -> parse -> format)', () => {
        const originalDate = new Date(2025, 6, 15); // July 15, 2025
        const formatted = buddhistDateFormat.formatter!(originalDate);
        const parsed = buddhistDateFormat.parser!(formatted);
        const reformatted = buddhistDateFormat.formatter!(parsed!);
        expect(reformatted).toBe(formatted);
      });
    });
  });

  describe('buddhistDateTimeFormat', () => {
    describe('formatter', () => {
      it('should convert date to Buddhist Era datetime format (DD/MM/YYYY+543 HH:mm)', () => {
        const date = new Date(2025, 11, 21, 14, 30); // Dec 21, 2025 14:30
        const result = buddhistDateTimeFormat.formatter!(date);
        expect(result).toBe('21/12/2568 14:30');
      });

      it('should pad single-digit hours and minutes with zeros', () => {
        const date = new Date(2024, 0, 5, 9, 5); // Jan 5, 2024 09:05
        const result = buddhistDateTimeFormat.formatter!(date);
        expect(result).toBe('05/01/2567 09:05');
      });

      it('should handle midnight correctly', () => {
        const date = new Date(2025, 5, 10, 0, 0);
        const result = buddhistDateTimeFormat.formatter!(date);
        expect(result).toBe('10/06/2568 00:00');
      });

      it('should return empty string for invalid date', () => {
        expect(buddhistDateTimeFormat.formatter!(null as unknown as Date)).toBe('');
        expect(buddhistDateTimeFormat.formatter!(new Date('invalid'))).toBe('');
      });
    });

    describe('parser', () => {
      it('should convert Buddhist Era datetime format back to Gregorian Date', () => {
        const result = buddhistDateTimeFormat.parser!('21/12/2568 14:30');
        expect(result).toBeInstanceOf(Date);
        expect(result!.getFullYear()).toBe(2025);
        expect(result!.getMonth()).toBe(11);
        expect(result!.getDate()).toBe(21);
        expect(result!.getHours()).toBe(14);
        expect(result!.getMinutes()).toBe(30);
      });

      it('should return null for invalid format', () => {
        expect(buddhistDateTimeFormat.parser!('21/12/2568')).toBeNull(); // Missing time
        expect(buddhistDateTimeFormat.parser!('2025-12-21 14:30')).toBeNull();
        expect(buddhistDateTimeFormat.parser!('')).toBeNull();
      });

      it('should roundtrip correctly', () => {
        const originalDate = new Date(2025, 6, 15, 10, 45);
        const formatted = buddhistDateTimeFormat.formatter!(originalDate);
        const parsed = buddhistDateTimeFormat.parser!(formatted);
        const reformatted = buddhistDateTimeFormat.formatter!(parsed!);
        expect(reformatted).toBe(formatted);
      });
    });
  });

  describe('parseStringToDate', () => {
    it('should parse ISO date string (YYYY-MM-DD)', () => {
      const result = parseStringToDate('2025-12-21');
      expect(result).toBeInstanceOf(Date);
      expect(result!.getFullYear()).toBe(2025);
      expect(result!.getMonth()).toBe(11);
      expect(result!.getDate()).toBe(21);
    });

    it('should parse ISO datetime string (YYYY-MM-DDTHH:mm:ss)', () => {
      const result = parseStringToDate('2025-12-21T14:30:00');
      expect(result).toBeInstanceOf(Date);
      expect(result!.getFullYear()).toBe(2025);
      expect(result!.getHours()).toBe(14);
      expect(result!.getMinutes()).toBe(30);
    });

    it('should return null for undefined', () => {
      expect(parseStringToDate(undefined)).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(parseStringToDate('')).toBeNull();
    });

    it('should return null for invalid date string', () => {
      expect(parseStringToDate('not-a-date')).toBeNull();
      expect(parseStringToDate('32/13/2025')).toBeNull();
    });
  });

  describe('Buddhist Era year calculation', () => {
    it('should add exactly 543 years to Gregorian year', () => {
      const testCases = [
        { gregorian: 2000, buddhist: 2543 },
        { gregorian: 2025, buddhist: 2568 },
        { gregorian: 1957, buddhist: 2500 },
        { gregorian: 2100, buddhist: 2643 },
      ];

      testCases.forEach(({ gregorian, buddhist }) => {
        const date = new Date(gregorian, 0, 1);
        const formatted = buddhistDateFormat.formatter!(date);
        expect(formatted).toContain(String(buddhist));
      });
    });

    it('should subtract exactly 543 years from Buddhist Era year', () => {
      const testCases = [
        { buddhist: 2543, gregorian: 2000 },
        { buddhist: 2568, gregorian: 2025 },
        { buddhist: 2500, gregorian: 1957 },
        { buddhist: 2643, gregorian: 2100 },
      ];

      testCases.forEach(({ buddhist, gregorian }) => {
        const parsed = buddhistDateFormat.parser!(`01/01/${buddhist}`);
        expect(parsed!.getFullYear()).toBe(gregorian);
      });
    });
  });
});
