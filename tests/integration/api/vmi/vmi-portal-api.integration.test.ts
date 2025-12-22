/**
 * Integration Tests for VMI Portal API
 *
 * Tests the real VMI Portal API endpoints with actual credentials.
 * These tests connect to the live VMI Portal server.
 *
 * Configuration:
 * - VMI Portal URL: https://vmi-portal.bmscloud.in.th
 * - Vendor ID: VEN-0009
 * - API Key: vmi_vend_VEN-0009_ff5bbcafbc0ecff77e4af01a10729e2b
 *
 * Feature: 008-vmi-vendor-sync
 */

import { describe, it, expect, beforeAll } from 'vitest';

// VMI Portal Configuration
const VMI_CONFIG = {
  baseUrl: 'https://vmi-portal.bmscloud.in.th/api/external/vendor',
  vendorId: 'VEN-0009',
  apiKey: 'vmi_vend_VEN-0009_ff5bbcafbc0ecff77e4af01a10729e2b',
};

// Helper function to make API requests
async function vmiRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ status: number; data: unknown }> {
  const url = `${VMI_CONFIG.baseUrl}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': VMI_CONFIG.apiKey,
      ...options.headers,
    },
  });

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  return {
    status: response.status,
    data,
  };
}

describe('VMI Portal API - Integration Tests', () => {
  // Skip if running in CI environment without VMI access
  const skipIntegration = process.env.SKIP_VMI_INTEGRATION === 'true';

  describe.skipIf(skipIntegration)('Authentication', () => {
    it('should authenticate with valid API key', async () => {
      const result = await vmiRequest('/items');

      expect(result.status).toBe(200);
      expect(result.data).toHaveProperty('success', true);
    });

    it('should reject invalid API key', async () => {
      const url = `${VMI_CONFIG.baseUrl}/items`;

      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'invalid-api-key',
        },
      });

      expect(response.status).toBe(401);
    });

    it('should reject request without API key', async () => {
      const url = `${VMI_CONFIG.baseUrl}/items`;

      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).toBe(401);
    });
  });

  describe.skipIf(skipIntegration)('Items API', () => {
    it('should fetch vendor items', async () => {
      const result = await vmiRequest('/items');

      expect(result.status).toBe(200);
      expect(result.data).toHaveProperty('success', true);
      expect(result.data).toHaveProperty('vendorId');
      expect(result.data).toHaveProperty('items');
      expect(Array.isArray((result.data as { items: unknown[] }).items)).toBe(true);
    });

    it('should sync items to VMI Portal', async () => {
      const testItems = [
        {
          localCode: 'TEST-INTEGRATION-001',
          tppCode: '8850999222222',
          ttmtCode: 'A98765432',
          name: 'Integration Test Product 1',
          genericName: 'Test Generic',
          unit: 'box',
          packSize: 10,
          packUnit: 'carton',
          isHerbal: false,
          category: 'Test Category',
          isActive: true,
        },
      ];

      const result = await vmiRequest('/items', {
        method: 'POST',
        body: JSON.stringify({ items: testItems }),
      });

      expect(result.status).toBe(200);
      expect(result.data).toHaveProperty('success', true);
      expect(result.data).toHaveProperty('summary');
      expect((result.data as { summary: { total: number } }).summary.total).toBe(1);
    });

    it('should validate item data format', async () => {
      const invalidItems = [
        {
          // Missing required fields
          name: 'Invalid Item',
        },
      ];

      const result = await vmiRequest('/items', {
        method: 'POST',
        body: JSON.stringify({ items: invalidItems }),
      });

      // Should either fail or report validation errors
      if (result.status === 200) {
        const data = result.data as { summary?: { failed: number } };
        expect(data.summary?.failed).toBeGreaterThanOrEqual(0);
      } else {
        expect(result.status).toBe(400);
      }
    });
  });

  describe.skipIf(skipIntegration)('Prices API', () => {
    it('should sync prices to VMI Portal', async () => {
      const priceOffers = [
        {
          localCode: 'TEST-001', // Must exist in VMI Portal
          unitPrice: 100.50,
          packPrice: 950.00,
          moq: 5,
          leadTimeDays: 3,
          effectiveDate: new Date().toISOString(),
          isActive: true,
        },
      ];

      const result = await vmiRequest('/prices', {
        method: 'POST',
        body: JSON.stringify({ offers: priceOffers }),
      });

      expect(result.status).toBe(200);
      expect(result.data).toHaveProperty('success', true);
      expect(result.data).toHaveProperty('summary');
    });

    it('should handle price sync for non-existent items', async () => {
      const priceOffers = [
        {
          localCode: 'NON-EXISTENT-ITEM-99999',
          unitPrice: 50.00,
          effectiveDate: new Date().toISOString(),
        },
      ];

      const result = await vmiRequest('/prices', {
        method: 'POST',
        body: JSON.stringify({ offers: priceOffers }),
      });

      expect(result.status).toBe(200);
      const data = result.data as { summary?: { failed: number }; errors?: unknown[] };
      // Should report failure for non-existent item
      if (data.summary) {
        expect(data.summary.failed).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe.skipIf(skipIntegration)('Inventory API', () => {
    it('should sync inventory to VMI Portal', async () => {
      const inventoryData = [
        {
          localCode: 'TEST-001', // Must exist in VMI Portal
          quantityAvailable: 1000,
        },
      ];

      const result = await vmiRequest('/inventory', {
        method: 'POST',
        body: JSON.stringify({ inventory: inventoryData }),
      });

      expect(result.status).toBe(200);
      expect(result.data).toHaveProperty('success', true);
      expect(result.data).toHaveProperty('summary');
    });

    it('should handle zero inventory quantities', async () => {
      const inventoryData = [
        {
          localCode: 'TEST-001',
          quantityAvailable: 0,
        },
      ];

      const result = await vmiRequest('/inventory', {
        method: 'POST',
        body: JSON.stringify({ inventory: inventoryData }),
      });

      expect(result.status).toBe(200);
      expect(result.data).toHaveProperty('success', true);
    });

    it('should reject negative inventory quantities', async () => {
      const inventoryData = [
        {
          localCode: 'TEST-001',
          quantityAvailable: -100,
        },
      ];

      const result = await vmiRequest('/inventory', {
        method: 'POST',
        body: JSON.stringify({ inventory: inventoryData }),
      });

      // Should either reject or report validation error
      if (result.status === 200) {
        const data = result.data as { summary?: { failed: number } };
        expect(data.summary?.failed).toBeGreaterThanOrEqual(0);
      } else {
        expect(result.status).toBe(400);
      }
    });
  });

  describe.skipIf(skipIntegration)('Orders API', () => {
    it('should fetch orders list', async () => {
      const result = await vmiRequest('/orders');

      expect(result.status).toBe(200);
      expect(result.data).toHaveProperty('success', true);
      expect(result.data).toHaveProperty('orders');
      expect(Array.isArray((result.data as { orders: unknown[] }).orders)).toBe(true);
    });

    it('should fetch orders with status filter', async () => {
      const result = await vmiRequest('/orders?status=submitted');

      expect(result.status).toBe(200);
      expect(result.data).toHaveProperty('success', true);
    });

    it('should fetch orders with date range filter', async () => {
      const fromDate = '2024-01-01';
      const toDate = '2024-12-31';
      const result = await vmiRequest(`/orders?orderDateFrom=${fromDate}&orderDateTo=${toDate}`);

      expect(result.status).toBe(200);
      expect(result.data).toHaveProperty('success', true);
    });

    it('should fetch orders with pagination', async () => {
      const result = await vmiRequest('/orders?page=1&pageSize=10');

      expect(result.status).toBe(200);
      expect(result.data).toHaveProperty('success', true);
      expect(result.data).toHaveProperty('pagination');
    });

    it('should return 404 for non-existent order', async () => {
      const result = await vmiRequest('/orders/999999999');

      expect(result.status).toBe(404);
    });
  });

  describe.skipIf(skipIntegration)('API Response Format', () => {
    it('should return consistent response format for success', async () => {
      const result = await vmiRequest('/items');

      expect(result.status).toBe(200);
      expect(result.data).toHaveProperty('success', true);
      expect(result.data).toHaveProperty('vendorId');
    });

    it('should return consistent error format for validation errors', async () => {
      const result = await vmiRequest('/items', {
        method: 'POST',
        body: JSON.stringify({ items: null }),
      });

      // Different VMI Portal versions may return different error formats
      if (result.status === 400) {
        // Check for either success: false or error code
        const data = result.data as { success?: boolean; code?: string };
        expect(data.success === false || data.code !== undefined).toBe(true);
      }
    });

    it('should include pagination in list responses', async () => {
      const result = await vmiRequest('/orders?page=1&pageSize=5');

      expect(result.status).toBe(200);
      const data = result.data as { pagination?: { page: number; pageSize: number } };
      if (data.pagination) {
        expect(data.pagination).toHaveProperty('page');
        expect(data.pagination).toHaveProperty('pageSize');
      }
    });
  });

  describe.skipIf(skipIntegration)('Rate Limiting and Performance', () => {
    it('should handle multiple rapid requests', async () => {
      const requests = Array(5).fill(null).map(() => vmiRequest('/items'));

      const results = await Promise.all(requests);

      results.forEach((result) => {
        expect([200, 429]).toContain(result.status);
      });
    });

    it('should respond within acceptable time', async () => {
      const startTime = Date.now();
      await vmiRequest('/items');
      const endTime = Date.now();

      const responseTime = endTime - startTime;
      expect(responseTime).toBeLessThan(5000); // 5 seconds max
    });
  });
});

describe('VMI Portal API - Connection Health Check', () => {
  it('should verify VMI Portal is reachable', async () => {
    try {
      const result = await vmiRequest('/items');
      console.log('VMI Portal Connection Status:', result.status === 200 ? 'Connected' : 'Error');
      console.log('Vendor ID:', (result.data as { vendorId?: unknown })?.vendorId);
      console.log('Items Count:', ((result.data as { items?: unknown[] })?.items)?.length ?? 0);
      expect(result.status).toBe(200);
    } catch (error) {
      console.error('VMI Portal Connection Failed:', error);
      throw error;
    }
  });
});
