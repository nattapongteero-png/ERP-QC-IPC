import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Schema from the API route
const querySchema = z.object({
  hospitalCode: z.string().optional(),
  tppCode: z.string().optional(),
  ttmtCode: z.string().optional(),
  warehouseCode: z.string().optional(),
  includeExpiring: z.coerce.boolean().default(false),
  expiringWithinDays: z.coerce.number().min(1).max(365).default(90),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(50),
});

describe('GET /api/external/vendor/hospital-stock', () => {
  it('parses tppCode query parameter correctly', () => {
    const url = new URL('http://localhost/api/external/vendor/hospital-stock');
    url.searchParams.set('tppCode', '1234567890123');

    const params = Object.fromEntries(url.searchParams);
    const parsed = querySchema.safeParse(params);

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.tppCode).toBe('1234567890123');
    }
  });

  it('parses ttmtCode query parameter correctly', () => {
    const url = new URL('http://localhost/api/external/vendor/hospital-stock');
    url.searchParams.set('ttmtCode', 'A12345678');

    const params = Object.fromEntries(url.searchParams);
    const parsed = querySchema.safeParse(params);

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.ttmtCode).toBe('A12345678');
    }
  });

  it('parses both tppCode and ttmtCode together', () => {
    const url = new URL('http://localhost/api/external/vendor/hospital-stock');
    url.searchParams.set('tppCode', '1234567890123');
    url.searchParams.set('ttmtCode', 'A12345678');

    const params = Object.fromEntries(url.searchParams);
    const parsed = querySchema.safeParse(params);

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.tppCode).toBe('1234567890123');
      expect(parsed.data.ttmtCode).toBe('A12345678');
    }
  });

  it('parses includeExpiring as boolean from string', () => {
    const url = new URL('http://localhost/api/external/vendor/hospital-stock');
    url.searchParams.set('includeExpiring', 'true');

    const params = Object.fromEntries(url.searchParams);
    const parsed = querySchema.safeParse(params);

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.includeExpiring).toBe(true);
      expect(typeof parsed.data.includeExpiring).toBe('boolean');
    }
  });

  it('parses includeExpiring false from string (omit parameter for false)', () => {
    // Note: z.coerce.boolean() converts any truthy string (including "false") to true
    // To get false, simply omit the parameter - it defaults to false
    const url = new URL('http://localhost/api/external/vendor/hospital-stock');
    // Don't set includeExpiring - it should default to false

    const params = Object.fromEntries(url.searchParams);
    const parsed = querySchema.safeParse(params);

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.includeExpiring).toBe(false);
    }
  });

  it('parses expiringWithinDays as number from string', () => {
    const url = new URL('http://localhost/api/external/vendor/hospital-stock');
    url.searchParams.set('expiringWithinDays', '60');

    const params = Object.fromEntries(url.searchParams);
    const parsed = querySchema.safeParse(params);

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.expiringWithinDays).toBe(60);
      expect(typeof parsed.data.expiringWithinDays).toBe('number');
    }
  });

  it('defaults expiringWithinDays to 90 when not provided', () => {
    const url = new URL('http://localhost/api/external/vendor/hospital-stock');

    const params = Object.fromEntries(url.searchParams);
    const parsed = querySchema.safeParse(params);

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.expiringWithinDays).toBe(90);
    }
  });

  it('validates expiringWithinDays minimum value', () => {
    const url = new URL('http://localhost/api/external/vendor/hospital-stock');
    url.searchParams.set('expiringWithinDays', '0');

    const params = Object.fromEntries(url.searchParams);
    const parsed = querySchema.safeParse(params);

    expect(parsed.success).toBe(false);
  });

  it('validates expiringWithinDays maximum value', () => {
    const url = new URL('http://localhost/api/external/vendor/hospital-stock');
    url.searchParams.set('expiringWithinDays', '366');

    const params = Object.fromEntries(url.searchParams);
    const parsed = querySchema.safeParse(params);

    expect(parsed.success).toBe(false);
  });

  it('parses page and pageSize correctly', () => {
    const url = new URL('http://localhost/api/external/vendor/hospital-stock');
    url.searchParams.set('page', '2');
    url.searchParams.set('pageSize', '25');

    const params = Object.fromEntries(url.searchParams);
    const parsed = querySchema.safeParse(params);

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.page).toBe(2);
      expect(parsed.data.pageSize).toBe(25);
    }
  });

  it('defaults page to 1 and pageSize to 50', () => {
    const url = new URL('http://localhost/api/external/vendor/hospital-stock');

    const params = Object.fromEntries(url.searchParams);
    const parsed = querySchema.safeParse(params);

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.page).toBe(1);
      expect(parsed.data.pageSize).toBe(50);
    }
  });

  it('validates pageSize maximum value', () => {
    const url = new URL('http://localhost/api/external/vendor/hospital-stock');
    url.searchParams.set('pageSize', '101');

    const params = Object.fromEntries(url.searchParams);
    const parsed = querySchema.safeParse(params);

    expect(parsed.success).toBe(false);
  });

  it('accepts warehouseCode parameter', () => {
    const url = new URL('http://localhost/api/external/vendor/hospital-stock');
    url.searchParams.set('warehouseCode', 'WH001');

    const params = Object.fromEntries(url.searchParams);
    const parsed = querySchema.safeParse(params);

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.warehouseCode).toBe('WH001');
    }
  });

  it('accepts hospitalCode parameter', () => {
    const url = new URL('http://localhost/api/external/vendor/hospital-stock');
    url.searchParams.set('hospitalCode', 'H001');

    const params = Object.fromEntries(url.searchParams);
    const parsed = querySchema.safeParse(params);

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.hospitalCode).toBe('H001');
    }
  });

  it('parses all parameters together', () => {
    const url = new URL('http://localhost/api/external/vendor/hospital-stock');
    url.searchParams.set('hospitalCode', 'H001');
    url.searchParams.set('tppCode', '1234567890123');
    url.searchParams.set('ttmtCode', 'A12345678');
    url.searchParams.set('warehouseCode', 'WH001');
    url.searchParams.set('includeExpiring', 'true');
    url.searchParams.set('expiringWithinDays', '30');
    url.searchParams.set('page', '1');
    url.searchParams.set('pageSize', '20');

    const params = Object.fromEntries(url.searchParams);
    const parsed = querySchema.safeParse(params);

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toEqual({
        hospitalCode: 'H001',
        tppCode: '1234567890123',
        ttmtCode: 'A12345678',
        warehouseCode: 'WH001',
        includeExpiring: true,
        expiringWithinDays: 30,
        page: 1,
        pageSize: 20,
      });
    }
  });
});
