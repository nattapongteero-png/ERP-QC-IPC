/**
 * BOM API - Duplicate Code Rejection Tests
 *
 * Tests that POST /api/bom correctly rejects creation when BOM code already exists.
 * This is the root cause of the "BOM code already exists" error.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock db-helper
const mockExecuteDbOperation = vi.fn();
vi.mock('@/lib/db/db-helper', () => ({
  getTableRef: vi.fn((tableName: string) => ({ tableName })),
  executeDbOperation: (...args: any[]) => mockExecuteDbOperation(...args),
  dbDate: vi.fn(() => new Date()),
  getInsertId: vi.fn(() => 1),
  parseDbDate: vi.fn((date: any) => date ? new Date(date) : null),
}));

// Mock audit
vi.mock('@/lib/audit', () => ({
  createAuditLog: vi.fn(),
  getClientIP: vi.fn(() => '127.0.0.1'),
}));

// Track what responses are returned
const mockResponses: Array<{ type: string; data: any }> = [];

vi.mock('@/lib/api-utils', () => ({
  successResponse: vi.fn((data: any, message?: string) => {
    const resp = { success: true, data, message };
    mockResponses.push({ type: 'success', data: resp });
    return new Response(JSON.stringify(resp), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }),
  errorResponse: vi.fn((message: string, status = 400) => {
    const resp = { success: false, error: message };
    mockResponses.push({ type: 'error', data: resp });
    return new Response(JSON.stringify(resp), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }),
  serverErrorResponse: vi.fn((error: any) => {
    const resp = { success: false, error: error?.message || 'Internal error' };
    mockResponses.push({ type: 'serverError', data: resp });
    return new Response(JSON.stringify(resp), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }),
  withAuth: vi.fn((_request: any, handler: any) => handler({ userId: 1, role: 'admin' })),
  getPaginationParams: vi.fn(() => ({ page: 1, limit: 20 })),
  createPaginatedResponse: vi.fn((items: any[], total: number, pagination: any) => ({
    items, total, ...pagination,
  })),
}));

// Import AFTER mocks
import { POST } from '@/app/api/bom/route';

function createMockRequest(body: any): Request {
  return new Request('http://localhost/api/bom', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const validBomData = {
  code: 'BOM-FG-0001',
  name: 'Test BOM',
  productId: 1,
  version: '1.0',
  batchSize: 100,
  batchUnit: 'bottle',
  yieldTarget: null,
  lossAllowance: null,
  theoreticalYield: null,
  effectiveDate: null,
  expiryDate: null,
  lines: [],
};

describe('BOM API - Duplicate Code Rejection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResponses.length = 0;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should reject creation when BOM code already exists', async () => {
    // Mock: first db call (check existing) returns existing BOM
    mockExecuteDbOperation.mockResolvedValueOnce([
      { id: 1, code: 'BOM-FG-0001', name: 'Existing BOM' },
    ]);

    const request = createMockRequest(validBomData);
    await POST(request as any);

    // Should return error response
    expect(mockResponses.length).toBeGreaterThan(0);
    const lastResponse = mockResponses[mockResponses.length - 1];
    expect(lastResponse.type).toBe('error');
    expect(lastResponse.data.error).toBe('BOM code already exists');
  });

  it('should allow creation when BOM code does not exist', async () => {
    // Mock: first db call (check existing) returns empty
    mockExecuteDbOperation.mockResolvedValueOnce([]);
    // Mock: second db call (insert BOM) returns insert result
    mockExecuteDbOperation.mockResolvedValueOnce({ insertId: 10 });

    const request = createMockRequest(validBomData);
    await POST(request as any);

    // Should return success response
    expect(mockResponses.length).toBeGreaterThan(0);
    const lastResponse = mockResponses[mockResponses.length - 1];
    expect(lastResponse.type).toBe('success');
  });

  it('should reject when required fields are missing', async () => {
    const request = createMockRequest({
      code: '',
      name: '',
      productId: null,
      batchSize: null,
      batchUnit: '',
    });
    await POST(request as any);

    expect(mockResponses.length).toBeGreaterThan(0);
    const lastResponse = mockResponses[mockResponses.length - 1];
    expect(lastResponse.type).toBe('error');
    expect(lastResponse.data.error).toContain('required');
  });

  it('should call executeDbOperation with uniqueness check query', async () => {
    mockExecuteDbOperation.mockResolvedValueOnce([]);
    mockExecuteDbOperation.mockResolvedValueOnce({ insertId: 10 });

    const request = createMockRequest(validBomData);
    await POST(request as any);

    // First call should be the uniqueness check
    expect(mockExecuteDbOperation).toHaveBeenCalled();
    const firstCall = mockExecuteDbOperation.mock.calls[0];
    expect(firstCall).toBeDefined();
    // The first call should be a function that checks for existing code
    expect(typeof firstCall[0]).toBe('function');
  });

  it('should prevent duplicate BOM codes for same product', async () => {
    // Simulate: code BOM-FG-0001 already exists for product 1
    mockExecuteDbOperation.mockResolvedValueOnce([
      { id: 1, code: 'BOM-FG-0001', productId: 1 },
    ]);

    const request = createMockRequest({
      ...validBomData,
      code: 'BOM-FG-0001',
      productId: 1,
    });
    await POST(request as any);

    const lastResponse = mockResponses[mockResponses.length - 1];
    expect(lastResponse.type).toBe('error');
    expect(lastResponse.data.error).toBe('BOM code already exists');
  });
});
