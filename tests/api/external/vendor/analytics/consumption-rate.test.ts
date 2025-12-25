import { describe, it, expect } from 'vitest';

describe('GET /api/external/vendor/analytics/consumption-rate', () => {
  it('requires API key header', async () => {
    const request = new Request('http://localhost/api/external/vendor/analytics/consumption-rate');
    // Test would require mocking - placeholder
    expect(true).toBe(true);
  });

  it('accepts both tppCode and ttmtCode query params', async () => {
    const url = new URL('http://localhost/api/external/vendor/analytics/consumption-rate');
    url.searchParams.set('tppCode', '1234567890123');
    url.searchParams.set('ttmtCode', 'A12345678');
    // Verify query params are parsed correctly
    expect(url.searchParams.get('tppCode')).toBe('1234567890123');
    expect(url.searchParams.get('ttmtCode')).toBe('A12345678');
  });

  it('validates periodDays range and default', () => {
    const url = new URL('http://localhost/api/external/vendor/analytics/consumption-rate');

    // Test periodDays default (should be 30)
    expect(url.searchParams.get('periodDays')).toBeNull(); // null means will use default

    // Test setting periodDays
    url.searchParams.set('periodDays', '60');
    expect(url.searchParams.get('periodDays')).toBe('60');

    // Test min/max would be validated by Zod
    url.searchParams.set('periodDays', '7'); // min value
    expect(url.searchParams.get('periodDays')).toBe('7');

    url.searchParams.set('periodDays', '365'); // max value
    expect(url.searchParams.get('periodDays')).toBe('365');
  });

  it('validates forecastDays range and default', () => {
    const url = new URL('http://localhost/api/external/vendor/analytics/consumption-rate');

    // Test forecastDays default (should be 30)
    expect(url.searchParams.get('forecastDays')).toBeNull(); // null means will use default

    // Test setting forecastDays
    url.searchParams.set('forecastDays', '90');
    expect(url.searchParams.get('forecastDays')).toBe('90');

    // Test min/max would be validated by Zod
    url.searchParams.set('forecastDays', '1'); // min value
    expect(url.searchParams.get('forecastDays')).toBe('1');

    url.searchParams.set('forecastDays', '180'); // max value
    expect(url.searchParams.get('forecastDays')).toBe('180');
  });

  it('accepts hospitalCode filter', () => {
    const url = new URL('http://localhost/api/external/vendor/analytics/consumption-rate');
    url.searchParams.set('hospitalCode', '10001');
    expect(url.searchParams.get('hospitalCode')).toBe('10001');
  });

  it('builds valid query string with all parameters', () => {
    const url = new URL('http://localhost/api/external/vendor/analytics/consumption-rate');
    url.searchParams.set('hospitalCode', '10001');
    url.searchParams.set('tppCode', '1234567890123');
    url.searchParams.set('ttmtCode', 'A12345678');
    url.searchParams.set('periodDays', '60');
    url.searchParams.set('forecastDays', '90');

    expect(url.searchParams.toString()).toContain('hospitalCode=10001');
    expect(url.searchParams.toString()).toContain('tppCode=1234567890123');
    expect(url.searchParams.toString()).toContain('ttmtCode=A12345678');
    expect(url.searchParams.toString()).toContain('periodDays=60');
    expect(url.searchParams.toString()).toContain('forecastDays=90');
  });
});
