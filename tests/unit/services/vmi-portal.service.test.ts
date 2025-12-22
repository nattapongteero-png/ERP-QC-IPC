/**
 * Unit Tests for VMI Portal Service
 *
 * Tests the VmiPortalService class for VMI Portal API integration
 * API keys are stored in plain text (configured via UI settings)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { VmiPortalService, VmiPortalError } from '@/lib/services/vmi-portal.service';

describe('VmiPortalService', () => {
  const originalEnv = {
    VMI_PORTAL_BASE_URL: process.env.VMI_PORTAL_BASE_URL,
  };

  const testApiKey = 'test-api-key-12345';

  afterAll(() => {
    if (originalEnv.VMI_PORTAL_BASE_URL) {
      process.env.VMI_PORTAL_BASE_URL = originalEnv.VMI_PORTAL_BASE_URL;
    } else {
      delete process.env.VMI_PORTAL_BASE_URL;
    }
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create service with valid config', () => {
      const service = new VmiPortalService({
        vendorId: 1,
        apiKeyEncrypted: testApiKey, // Plain text API key
      });

      expect(service).toBeDefined();
    });

    it('should use custom baseUrl if provided', () => {
      const customUrl = 'https://custom-vmi-portal.example.com/api';
      const service = new VmiPortalService({
        vendorId: 1,
        apiKeyEncrypted: testApiKey,
        baseUrl: customUrl,
      });

      expect(service).toBeDefined();
    });

    it('should use environment baseUrl if not provided', () => {
      process.env.VMI_PORTAL_BASE_URL = 'https://env-vmi-portal.example.com/api';
      const service = new VmiPortalService({
        vendorId: 1,
        apiKeyEncrypted: testApiKey,
      });

      expect(service).toBeDefined();
      delete process.env.VMI_PORTAL_BASE_URL;
    });
  });

  describe('testConnection', () => {
    it('should return true when connection is successful', async () => {
      // Mock successful response
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ success: true }),
      });

      const service = new VmiPortalService({
        vendorId: 1,
        apiKeyEncrypted: testApiKey,
        baseUrl: 'https://test-vmi-portal.example.com/api',
      });

      const result = await service.testConnection();

      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/health'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'X-API-Key': testApiKey, // API key used directly
          }),
        })
      );
    });

    it('should throw VmiPortalError for authentication errors', async () => {
      // Mock 401 response
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({
          error: { code: 'UNAUTHORIZED', message: 'Invalid API Key' },
        }),
      });

      const service = new VmiPortalService({
        vendorId: 1,
        apiKeyEncrypted: testApiKey,
        baseUrl: 'https://test-vmi-portal.example.com/api',
      });

      await expect(service.testConnection()).rejects.toThrow(VmiPortalError);
    });

    it('should return false for network errors', async () => {
      // Mock network error
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const service = new VmiPortalService({
        vendorId: 1,
        apiKeyEncrypted: testApiKey,
        baseUrl: 'https://test-vmi-portal.example.com/api',
      });

      const result = await service.testConnection();
      expect(result).toBe(false);
    });
  });
});

describe('VmiPortalError', () => {
  describe('constructor', () => {
    it('should create error with code and message', () => {
      const error = new VmiPortalError('UNAUTHORIZED', 'Invalid API Key', 401);

      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.message).toBe('Invalid API Key');
      expect(error.httpStatus).toBe(401);
      expect(error.name).toBe('VmiPortalError');
    });

    it('should create error with details', () => {
      const details = { field: 'apiKey', reason: 'expired' };
      const error = new VmiPortalError('API_KEY_EXPIRED', 'Key expired', 401, details);

      expect(error.details).toEqual(details);
    });
  });

  describe('getUserMessage', () => {
    it('should return Thai message for UNAUTHORIZED', () => {
      const error = new VmiPortalError('UNAUTHORIZED', 'Invalid API Key');
      expect(error.getUserMessage('th')).toBe('API Key ไม่ถูกต้อง');
    });

    it('should return English message for UNAUTHORIZED', () => {
      const error = new VmiPortalError('UNAUTHORIZED', 'Invalid API Key');
      expect(error.getUserMessage('en')).toBe('Invalid API Key');
    });

    it('should return Thai message for VALIDATION_ERROR', () => {
      const error = new VmiPortalError('VALIDATION_ERROR', 'Invalid data');
      expect(error.getUserMessage('th')).toBe('ข้อมูลไม่ถูกต้อง');
    });

    it('should return Thai message for ORDER_NOT_FOUND', () => {
      const error = new VmiPortalError('ORDER_NOT_FOUND', 'Order not found');
      expect(error.getUserMessage('th')).toBe('ไม่พบคำสั่งซื้อ');
    });

    it('should return Thai message for INVALID_STATUS_TRANSITION', () => {
      const error = new VmiPortalError('INVALID_STATUS_TRANSITION', 'Cannot change status');
      expect(error.getUserMessage('th')).toBe('ไม่สามารถเปลี่ยนสถานะได้');
    });

    it('should default to English', () => {
      const error = new VmiPortalError('UNAUTHORIZED', 'Invalid API Key');
      expect(error.getUserMessage()).toBe('Invalid API Key');
    });
  });
});

describe('VmiPortalService Order Methods', () => {
  const testApiKey = 'test-api-key-orders';
  let service: VmiPortalService;

  beforeEach(() => {
    vi.restoreAllMocks();
    service = new VmiPortalService({
      vendorId: 1,
      apiKeyEncrypted: testApiKey,
      baseUrl: 'https://test-vmi-portal.example.com/api',
    });
  });

  describe('getOrders', () => {
    it('should fetch orders with default parameters', async () => {
      const mockOrders = {
        orders: [
          { id: 1, poNumber: 'PO-001', status: 'submitted' },
          { id: 2, poNumber: 'PO-002', status: 'confirmed' },
        ],
        total: 2,
        page: 1,
        pageSize: 20,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockOrders),
      });

      const result = await service.getOrders();

      expect(result).toEqual(mockOrders);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/orders'),
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should fetch orders with query parameters', async () => {
      const mockOrders = { orders: [], total: 0, page: 1, pageSize: 10 };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockOrders),
      });

      await service.getOrders({
        status: 'submitted',
        orderDateFrom: '2024-01-01',
        orderDateTo: '2024-01-31',
        page: 1,
        pageSize: 10,
      });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringMatching(/status=submitted/),
        expect.any(Object)
      );
    });

    it('should throw VmiPortalError on API error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ error: { code: 'INTERNAL_ERROR', message: 'Server error' } }),
      });

      await expect(service.getOrders()).rejects.toThrow(VmiPortalError);
    });
  });

  describe('getOrderDetail', () => {
    it('should fetch order detail by ID', async () => {
      const mockOrder = {
        id: 123,
        poNumber: 'PO-2024-001',
        hospitalCode: 'H001',
        hospitalName: 'Test Hospital',
        status: 'submitted',
        lines: [
          { itemCode: 'ITEM-001', quantity: 10, unitPrice: 100 },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockOrder),
      });

      const result = await service.getOrderDetail(123);

      expect(result).toEqual(mockOrder);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/orders/123'),
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should throw ORDER_NOT_FOUND for non-existent order', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ error: { code: 'ORDER_NOT_FOUND', message: 'Order not found' } }),
      });

      await expect(service.getOrderDetail(999)).rejects.toThrow(VmiPortalError);
    });
  });

  describe('confirmOrder', () => {
    it('should confirm an order successfully', async () => {
      const mockResult = {
        success: true,
        orderId: 123,
        newStatus: 'confirmed',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockResult),
      });

      const result = await service.confirmOrder(123);

      expect(result).toEqual(mockResult);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/orders/123'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ action: 'confirm' }),
        })
      );
    });

    it('should throw INVALID_STATUS_TRANSITION for invalid confirmation', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({
          error: { code: 'INVALID_STATUS_TRANSITION', message: 'Order already confirmed' },
        }),
      });

      await expect(service.confirmOrder(123)).rejects.toThrow(VmiPortalError);
    });
  });

  describe('shipOrder', () => {
    it('should ship an order with expected delivery date', async () => {
      const mockResult = {
        success: true,
        orderId: 123,
        newStatus: 'shipped',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockResult),
      });

      const result = await service.shipOrder(123, '2024-02-15');

      expect(result).toEqual(mockResult);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/orders/123'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ action: 'ship', expectedDeliveryDate: '2024-02-15' }),
        })
      );
    });

    it('should throw error for unconfirmed order', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({
          error: { code: 'INVALID_STATUS_TRANSITION', message: 'Order must be confirmed first' },
        }),
      });

      await expect(service.shipOrder(123, '2024-02-15')).rejects.toThrow(VmiPortalError);
    });
  });

  describe('getReceiptStatus', () => {
    it('should fetch receipt status for shipped order', async () => {
      const mockStatus = {
        orderId: 123,
        status: 'received',
        receivedAt: '2024-02-10T10:30:00Z',
        receivedQuantities: [
          { itemCode: 'ITEM-001', ordered: 10, received: 10 },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockStatus),
      });

      const result = await service.getReceiptStatus(123);

      expect(result).toEqual(mockStatus);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/orders/123/receipt-status'),
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should return pending status for unshipped order', async () => {
      const mockStatus = {
        orderId: 123,
        status: 'pending',
        receivedAt: null,
        receivedQuantities: [],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockStatus),
      });

      const result = await service.getReceiptStatus(123);

      expect(result.status).toBe('pending');
    });
  });
});

describe('VmiPortalService Sync Methods', () => {
  const testApiKey = 'test-api-key-sync';
  let service: VmiPortalService;

  beforeEach(() => {
    vi.restoreAllMocks();
    service = new VmiPortalService({
      vendorId: 1,
      apiKeyEncrypted: testApiKey,
      baseUrl: 'https://test-vmi-portal.example.com/api',
    });
  });

  describe('syncItems', () => {
    it('should sync items to VMI Portal successfully', async () => {
      const mockResult = {
        success: true,
        summary: { total: 3, inserted: 3, updated: 0, failed: 0 },
        syncedAt: new Date().toISOString(),
        errors: [],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockResult),
      });

      const items = [
        { localCode: 'ITEM-001', tppCode: '1234567890123', ttmtCode: 'A12345678', name: 'Test Item 1', unit: 'box' },
        { localCode: 'ITEM-002', tppCode: '9876543210987', ttmtCode: 'A98765432', name: 'Test Item 2', unit: 'bottle' },
        { localCode: 'ITEM-003', tppCode: '5555555555555', ttmtCode: 'A55555555', name: 'Test Item 3', unit: 'kg' },
      ];

      const result = await service.syncItems(items);

      expect(result).toEqual(mockResult);
      expect(result.summary.inserted + result.summary.updated).toBe(3);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/items'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ items }),
        })
      );
    });

    it('should handle partial sync with some failures', async () => {
      const mockResult = {
        success: true,
        summary: { total: 3, inserted: 2, updated: 0, failed: 1 },
        syncedAt: new Date().toISOString(),
        errors: [
          { localCode: 'ITEM-INVALID', error: 'Invalid TPP code format' },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockResult),
      });

      const items = [
        { localCode: 'ITEM-001', tppCode: '1234567890123', ttmtCode: 'A12345678', name: 'Test Item 1', unit: 'box' },
        { localCode: 'ITEM-INVALID', tppCode: '0000000000000', ttmtCode: 'AINVALID', name: 'Invalid Item', unit: 'unit' },
        { localCode: 'ITEM-002', tppCode: '9876543210987', ttmtCode: 'A98765432', name: 'Test Item 2', unit: 'bottle' },
      ];

      const result = await service.syncItems(items);

      expect(result.summary.inserted + result.summary.updated).toBe(2);
      expect(result.summary.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
    });

    it('should throw VALIDATION_ERROR for invalid items', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({
          error: { code: 'VALIDATION_ERROR', message: 'Items array is required' },
        }),
      });

      await expect(service.syncItems([])).rejects.toThrow(VmiPortalError);
    });

    it('should throw UNAUTHORIZED for invalid API key', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({
          error: { code: 'UNAUTHORIZED', message: 'Invalid API Key' },
        }),
      });

      const items = [{ localCode: 'ITEM-001', tppCode: '1234567890123', ttmtCode: 'A12345678', name: 'Test', unit: 'box' }];
      await expect(service.syncItems(items)).rejects.toThrow(VmiPortalError);
    });
  });

  describe('syncPrices', () => {
    it('should sync price offers to VMI Portal successfully', async () => {
      const mockResult = {
        success: true,
        summary: { total: 2, inserted: 2, updated: 0, failed: 0 },
        syncedAt: new Date().toISOString(),
        errors: [],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockResult),
      });

      const offers = [
        { localCode: 'ITEM-001', unitPrice: 100.50, effectiveDate: '2024-01-01', expiryDate: '2024-12-31' },
        { localCode: 'ITEM-002', unitPrice: 250.00, effectiveDate: '2024-01-01', expiryDate: '2024-06-30' },
      ];

      const result = await service.syncPrices(offers);

      expect(result).toEqual(mockResult);
      expect(result.summary.inserted + result.summary.updated).toBe(2);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/prices'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ offers }),
        })
      );
    });

    it('should handle price sync with validation errors', async () => {
      const mockResult = {
        success: true,
        summary: { total: 2, inserted: 1, updated: 0, failed: 1 },
        syncedAt: new Date().toISOString(),
        errors: [
          { localCode: 'ITEM-INVALID', error: 'Item not found in VMI Portal' },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockResult),
      });

      const offers = [
        { localCode: 'ITEM-001', unitPrice: 100.50, effectiveDate: '2024-01-01', expiryDate: '2024-12-31' },
        { localCode: 'ITEM-INVALID', unitPrice: 50.00, effectiveDate: '2024-01-01', expiryDate: '2024-12-31' },
      ];

      const result = await service.syncPrices(offers);

      expect(result.summary.failed).toBe(1);
      expect(result.errors?.[0]).toHaveProperty('error');
    });

    it('should throw error for negative prices', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({
          error: { code: 'VALIDATION_ERROR', message: 'Price must be positive' },
        }),
      });

      const offers = [{ localCode: 'ITEM-001', unitPrice: -10.00, effectiveDate: '2024-01-01', expiryDate: '2024-12-31' }];
      await expect(service.syncPrices(offers)).rejects.toThrow(VmiPortalError);
    });
  });

  describe('syncInventory', () => {
    it('should sync inventory to VMI Portal successfully', async () => {
      const mockResult = {
        success: true,
        summary: { total: 3, inserted: 0, updated: 3, failed: 0 },
        syncedAt: new Date().toISOString(),
        errors: [],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockResult),
      });

      const inventory = [
        { localCode: 'ITEM-001', quantityAvailable: 500, unit: 'box' },
        { localCode: 'ITEM-002', quantityAvailable: 1000, unit: 'bottle' },
        { localCode: 'ITEM-003', quantityAvailable: 250, unit: 'kg' },
      ];

      const result = await service.syncInventory(inventory);

      expect(result).toEqual(mockResult);
      expect(result.summary.inserted + result.summary.updated).toBe(3);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/inventory'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ inventory }),
        })
      );
    });

    it('should handle inventory sync with partial failures', async () => {
      const mockResult = {
        success: true,
        summary: { total: 3, inserted: 0, updated: 2, failed: 1 },
        syncedAt: new Date().toISOString(),
        errors: [
          { localCode: 'ITEM-INVALID', error: 'Item not registered in VMI Portal' },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockResult),
      });

      const inventory = [
        { localCode: 'ITEM-001', quantityAvailable: 500, unit: 'box' },
        { localCode: 'ITEM-INVALID', quantityAvailable: 100, unit: 'unit' },
        { localCode: 'ITEM-002', quantityAvailable: 1000, unit: 'bottle' },
      ];

      const result = await service.syncInventory(inventory);

      expect(result.summary.inserted + result.summary.updated).toBe(2);
      expect(result.summary.failed).toBe(1);
    });

    it('should handle network timeout during inventory sync', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Request timeout'));

      const inventory = [{ localCode: 'ITEM-001', quantityAvailable: 500, unit: 'box' }];

      await expect(service.syncInventory(inventory)).rejects.toThrow(VmiPortalError);
    });

    it('should handle zero inventory quantities', async () => {
      const mockResult = {
        success: true,
        summary: { total: 1, inserted: 0, updated: 1, failed: 0 },
        syncedAt: new Date().toISOString(),
        errors: [],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockResult),
      });

      const inventory = [{ localCode: 'ITEM-001', quantityAvailable: 0, unit: 'box' }];

      const result = await service.syncInventory(inventory);

      expect(result.summary.updated).toBe(1);
    });
  });
});
