import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Schema definition for testing
const querySchema = z.object({
  hospitalCode: z.string().optional(),
  tppCode: z.string().optional(),
  ttmtCode: z.string().optional(),
  warehouseCode: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  groupBy: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(50),
});

describe('GET /api/external/vendor/consumption', () => {
  describe('Query parameter parsing', () => {
    it('accepts tppCode query parameter', () => {
      const url = new URL('http://localhost/api/external/vendor/consumption');
      url.searchParams.set('tppCode', '1234567890123');

      const params = Object.fromEntries(url.searchParams);
      const result = querySchema.safeParse(params);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tppCode).toBe('1234567890123');
      }
    });

    it('accepts ttmtCode query parameter', () => {
      const url = new URL('http://localhost/api/external/vendor/consumption');
      url.searchParams.set('ttmtCode', 'A12345678');

      const params = Object.fromEntries(url.searchParams);
      const result = querySchema.safeParse(params);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.ttmtCode).toBe('A12345678');
      }
    });

    it('accepts both tppCode and ttmtCode together', () => {
      const url = new URL('http://localhost/api/external/vendor/consumption');
      url.searchParams.set('tppCode', '1234567890123');
      url.searchParams.set('ttmtCode', 'A12345678');

      const params = Object.fromEntries(url.searchParams);
      const result = querySchema.safeParse(params);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tppCode).toBe('1234567890123');
        expect(result.data.ttmtCode).toBe('A12345678');
      }
    });
  });

  describe('Date format validation', () => {
    it('accepts valid date format YYYY-MM-DD for startDate', () => {
      const params = {
        startDate: '2024-01-15',
      };
      const result = querySchema.safeParse(params);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.startDate).toBe('2024-01-15');
      }
    });

    it('accepts valid date format YYYY-MM-DD for endDate', () => {
      const params = {
        endDate: '2024-12-31',
      };
      const result = querySchema.safeParse(params);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.endDate).toBe('2024-12-31');
      }
    });

    it('accepts both startDate and endDate with valid format', () => {
      const params = {
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      };
      const result = querySchema.safeParse(params);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.startDate).toBe('2024-01-01');
        expect(result.data.endDate).toBe('2024-12-31');
      }
    });

    it('rejects invalid date format for startDate', () => {
      const params = {
        startDate: '2024/01/15', // Invalid format
      };
      const result = querySchema.safeParse(params);

      expect(result.success).toBe(false);
    });

    it('rejects invalid date format for endDate', () => {
      const params = {
        endDate: '15-01-2024', // Invalid format
      };
      const result = querySchema.safeParse(params);

      expect(result.success).toBe(false);
    });

    it('rejects partial date', () => {
      const params = {
        startDate: '2024-01', // Missing day
      };
      const result = querySchema.safeParse(params);

      expect(result.success).toBe(false);
    });
  });

  describe('GroupBy parameter validation', () => {
    it('accepts daily groupBy value', () => {
      const params = {
        groupBy: 'daily',
      };
      const result = querySchema.safeParse(params);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.groupBy).toBe('daily');
      }
    });

    it('accepts weekly groupBy value', () => {
      const params = {
        groupBy: 'weekly',
      };
      const result = querySchema.safeParse(params);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.groupBy).toBe('weekly');
      }
    });

    it('accepts monthly groupBy value', () => {
      const params = {
        groupBy: 'monthly',
      };
      const result = querySchema.safeParse(params);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.groupBy).toBe('monthly');
      }
    });

    it('defaults to daily when groupBy is not provided', () => {
      const params = {};
      const result = querySchema.safeParse(params);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.groupBy).toBe('daily');
      }
    });

    it('rejects invalid groupBy value', () => {
      const params = {
        groupBy: 'yearly', // Invalid value
      };
      const result = querySchema.safeParse(params);

      expect(result.success).toBe(false);
    });
  });

  describe('Pagination parameters', () => {
    it('accepts valid page and pageSize', () => {
      const params = {
        page: '2',
        pageSize: '25',
      };
      const result = querySchema.safeParse(params);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(2);
        expect(result.data.pageSize).toBe(25);
      }
    });

    it('defaults page to 1 when not provided', () => {
      const params = {};
      const result = querySchema.safeParse(params);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
      }
    });

    it('defaults pageSize to 50 when not provided', () => {
      const params = {};
      const result = querySchema.safeParse(params);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.pageSize).toBe(50);
      }
    });

    it('rejects page less than 1', () => {
      const params = {
        page: '0',
      };
      const result = querySchema.safeParse(params);

      expect(result.success).toBe(false);
    });

    it('rejects pageSize less than 1', () => {
      const params = {
        pageSize: '0',
      };
      const result = querySchema.safeParse(params);

      expect(result.success).toBe(false);
    });

    it('rejects pageSize greater than 100', () => {
      const params = {
        pageSize: '101',
      };
      const result = querySchema.safeParse(params);

      expect(result.success).toBe(false);
    });
  });

  describe('Combined parameters', () => {
    it('accepts all valid parameters together', () => {
      const params = {
        hospitalCode: 'H001',
        tppCode: '1234567890123',
        ttmtCode: 'A12345678',
        warehouseCode: 'WH001',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        groupBy: 'monthly',
        page: '3',
        pageSize: '20',
      };
      const result = querySchema.safeParse(params);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.hospitalCode).toBe('H001');
        expect(result.data.tppCode).toBe('1234567890123');
        expect(result.data.ttmtCode).toBe('A12345678');
        expect(result.data.warehouseCode).toBe('WH001');
        expect(result.data.startDate).toBe('2024-01-01');
        expect(result.data.endDate).toBe('2024-12-31');
        expect(result.data.groupBy).toBe('monthly');
        expect(result.data.page).toBe(3);
        expect(result.data.pageSize).toBe(20);
      }
    });
  });
});
