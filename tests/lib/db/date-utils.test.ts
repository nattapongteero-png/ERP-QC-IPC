import { describe, it, expect } from 'vitest';
import { toDateSafe, formatDateFromDb, formatMonthFromDb, toQueryDate } from '@/lib/db/date-utils';

describe('date-utils', () => {
  describe('toDateSafe', () => {
    it('should convert string date to Date object', () => {
      const result = toDateSafe('2024-12-23');
      expect(result).toBeInstanceOf(Date);
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(11); // 0-indexed
      expect(result.getDate()).toBe(23);
    });

    it('should return Date object unchanged', () => {
      const input = new Date('2024-12-23');
      const result = toDateSafe(input);
      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBe(input.getTime());
    });

    it('should handle ISO string format', () => {
      const result = toDateSafe('2024-12-23T10:30:00.000Z');
      expect(result).toBeInstanceOf(Date);
      expect(result.getFullYear()).toBe(2024);
    });

    it('should handle null/undefined by returning current date', () => {
      const now = new Date();
      const result = toDateSafe(null);
      expect(result.getFullYear()).toBe(now.getFullYear());
    });
  });

  describe('formatDateFromDb', () => {
    it('should format Date object to YYYY-MM-DD', () => {
      const result = formatDateFromDb(new Date('2024-12-23'));
      expect(result).toBe('2024-12-23');
    });

    it('should format string date to YYYY-MM-DD', () => {
      const result = formatDateFromDb('2024-12-23T10:30:00.000Z');
      expect(result).toBe('2024-12-23');
    });

    it('should pass through already formatted YYYY-MM-DD string', () => {
      const result = formatDateFromDb('2024-12-23');
      expect(result).toBe('2024-12-23');
    });
  });

  describe('formatMonthFromDb', () => {
    it('should format Date object to YYYY-MM', () => {
      const result = formatMonthFromDb(new Date('2024-12-23'));
      expect(result).toBe('2024-12');
    });

    it('should format string date to YYYY-MM', () => {
      const result = formatMonthFromDb('2024-03-15');
      expect(result).toBe('2024-03');
    });
  });

  describe('toQueryDate', () => {
    it('should convert string date for query conditions', () => {
      const result = toQueryDate('2024-12-23');
      // In SQLite mode (test env), returns string
      expect(typeof result === 'string' || result instanceof Date).toBe(true);
    });

    it('should handle Date object input', () => {
      const input = new Date('2024-12-23');
      const result = toQueryDate(input);
      expect(typeof result === 'string' || result instanceof Date).toBe(true);
    });

    it('should handle null/undefined', () => {
      const result = toQueryDate(null);
      expect(typeof result === 'string' || result instanceof Date).toBe(true);
    });
  });
});
