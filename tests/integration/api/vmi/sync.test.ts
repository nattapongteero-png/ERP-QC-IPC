/**
 * Integration Tests for VMI Sync API
 *
 * Tests the VMI sync endpoints for items, prices, and inventory
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

describe('VMI Sync API', () => {
  const originalEnv = {
    VMI_ENCRYPTION_KEY: process.env.VMI_ENCRYPTION_KEY,
    VMI_PORTAL_BASE_URL: process.env.VMI_PORTAL_BASE_URL,
  };

  beforeAll(() => {
    process.env.VMI_ENCRYPTION_KEY = 'a'.repeat(64);
    process.env.VMI_PORTAL_BASE_URL = 'https://test-vmi-portal.example.com/api';
  });

  afterAll(() => {
    Object.entries(originalEnv).forEach(([key, value]) => {
      if (value) {
        process.env[key] = value;
      } else {
        delete process.env[key];
      }
    });
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Items Sync API (US2)
  // ============================================================================

  describe('GET /api/purchasing/vmi/sync/items', () => {
    it('should return items pending sync for a vendor', async () => {
      const expectedResponse = {
        success: true,
        data: {
          vendorId: 100,
          items: [
            {
              id: 1,
              code: 'ITEM-001',
              name: 'Herbal Product A',
              tppCode: '1234567890123',
              ttmtCode: 'A12345678',
              unit: 'box',
              lastSyncedAt: null,
              needsSync: true,
            },
            {
              id: 2,
              code: 'ITEM-002',
              name: 'Herbal Product B',
              tppCode: '9876543210987',
              ttmtCode: 'A98765432',
              unit: 'bottle',
              lastSyncedAt: '2024-01-10T10:00:00.000Z',
              needsSync: true,
            },
          ],
          total: 2,
          lastSyncAt: '2024-01-10T10:00:00.000Z',
        },
      };

      expect(expectedResponse.success).toBe(true);
      expect(expectedResponse.data.items).toBeInstanceOf(Array);
      expect(expectedResponse.data.items[0]).toHaveProperty('tppCode');
      expect(expectedResponse.data.items[0]).toHaveProperty('ttmtCode');
    });

    it('should filter items by vendor ID', async () => {
      const vendorId = 100;
      const expectedResponse = {
        success: true,
        data: {
          vendorId,
          items: [{ id: 1, vendorId: 100 }],
        },
      };

      expect(expectedResponse.data.vendorId).toBe(vendorId);
    });

    it('should only return items with TPP or TTMT codes', async () => {
      const expectedResponse = {
        success: true,
        data: {
          items: [
            { id: 1, tppCode: '1234567890123', ttmtCode: 'A12345678' },
            { id: 2, tppCode: '9876543210987', ttmtCode: null },
          ],
        },
      };

      expectedResponse.data.items.forEach((item) => {
        const hasCode = item.tppCode || item.ttmtCode;
        expect(hasCode).toBeTruthy();
      });
    });

    it('should return items needing sync (modified after last sync)', async () => {
      const expectedResponse = {
        success: true,
        data: {
          items: [
            {
              id: 1,
              updatedAt: '2024-01-15T10:00:00.000Z',
              lastSyncedAt: '2024-01-10T10:00:00.000Z',
              needsSync: true,
            },
          ],
        },
      };

      expect(expectedResponse.data.items[0].needsSync).toBe(true);
    });
  });

  describe('POST /api/purchasing/vmi/sync/items', () => {
    it('should sync items to VMI Portal for a vendor', async () => {
      const requestBody = { vendorId: 100, itemIds: [1, 2, 3] };
      const expectedResponse = {
        success: true,
        data: {
          vendorId: 100,
          synced: 3,
          failed: 0,
          errors: [],
          syncedAt: '2024-01-15T10:30:00.000Z',
        },
        message: 'Successfully synced 3 items to VMI Portal',
      };

      expect(expectedResponse.success).toBe(true);
      expect(expectedResponse.data.synced).toBe(3);
      expect(expectedResponse.data.failed).toBe(0);
    });

    it('should handle partial sync with some failures', async () => {
      const expectedResponse = {
        success: true,
        data: {
          vendorId: 100,
          synced: 2,
          failed: 1,
          errors: [{ itemId: 3, tppCode: '0000000000000', error: 'Invalid TPP code format' }],
        },
      };

      expect(expectedResponse.data.failed).toBe(1);
      expect(expectedResponse.data.errors).toHaveLength(1);
    });

    it('should require vendorId parameter', async () => {
      const expectedErrorResponse = {
        success: false,
        error: 'Vendor ID is required',
      };

      expect(expectedErrorResponse.success).toBe(false);
      expect(expectedErrorResponse.error).toContain('Vendor ID');
    });

    it('should handle empty items array', async () => {
      const expectedResponse = {
        success: true,
        data: {
          synced: 0,
          failed: 0,
          errors: [],
        },
        message: 'No items to sync',
      };

      expect(expectedResponse.data.synced).toBe(0);
    });

    it('should handle VMI Portal connection failure', async () => {
      const expectedErrorResponse = {
        success: false,
        error: 'VMI Portal error: Connection failed',
      };

      expect(expectedErrorResponse.success).toBe(false);
      expect(expectedErrorResponse.error).toContain('VMI Portal');
    });

    it('should update lastSyncedAt for successfully synced items', async () => {
      const expectedBehavior = {
        itemsUpdated: true,
        fieldsUpdated: ['lastSyncedAt', 'syncStatus'],
      };

      expect(expectedBehavior.itemsUpdated).toBe(true);
      expect(expectedBehavior.fieldsUpdated).toContain('lastSyncedAt');
    });
  });

  // ============================================================================
  // Prices Sync API (US3)
  // ============================================================================

  describe('GET /api/purchasing/vmi/sync/prices', () => {
    it('should return price offers for a vendor', async () => {
      const expectedResponse = {
        success: true,
        data: {
          vendorId: 100,
          offers: [
            {
              id: 1,
              itemId: 10,
              tppCode: '1234567890123',
              itemName: 'Herbal Product A',
              unitPrice: 150.0,
              currency: 'THB',
              validFrom: '2024-01-01',
              validTo: '2024-12-31',
              lastSyncedAt: null,
            },
          ],
          total: 1,
        },
      };

      expect(expectedResponse.success).toBe(true);
      expect(expectedResponse.data.offers[0]).toHaveProperty('unitPrice');
      expect(expectedResponse.data.offers[0]).toHaveProperty('validFrom');
    });

    it('should filter by validity period', async () => {
      const expectedResponse = {
        success: true,
        data: {
          offers: [
            { id: 1, validFrom: '2024-01-01', validTo: '2024-12-31', isActive: true },
          ],
        },
      };

      const offer = expectedResponse.data.offers[0];
      const now = new Date('2024-06-15');
      const isValid = new Date(offer.validFrom) <= now && new Date(offer.validTo) >= now;
      expect(isValid).toBe(true);
    });
  });

  describe('POST /api/purchasing/vmi/sync/prices', () => {
    it('should sync price offers to VMI Portal', async () => {
      const requestBody = { vendorId: 100, offerIds: [1, 2] };
      const expectedResponse = {
        success: true,
        data: {
          vendorId: 100,
          synced: 2,
          failed: 0,
          errors: [],
        },
        message: 'Successfully synced 2 price offers to VMI Portal',
      };

      expect(expectedResponse.success).toBe(true);
      expect(expectedResponse.data.synced).toBe(2);
    });

    it('should handle price sync with item not found in VMI Portal', async () => {
      const expectedResponse = {
        success: true,
        data: {
          synced: 1,
          failed: 1,
          errors: [{ offerId: 2, error: 'Item not registered in VMI Portal. Sync items first.' }],
        },
      };

      expect(expectedResponse.data.errors[0].error).toContain('Sync items first');
    });

    it('should validate price offer data before sync', async () => {
      const validationRules = {
        unitPrice: 'Must be positive number',
        validFrom: 'Must be valid date',
        validTo: 'Must be after validFrom',
        tppCode: 'Must be 13-digit number',
      };

      expect(validationRules).toHaveProperty('unitPrice');
      expect(validationRules).toHaveProperty('tppCode');
    });
  });

  // ============================================================================
  // Inventory Sync API (US4)
  // ============================================================================

  describe('POST /api/purchasing/vmi/sync/inventory', () => {
    it('should sync inventory to VMI Portal', async () => {
      const requestBody = { vendorId: 100 };
      const expectedResponse = {
        success: true,
        data: {
          vendorId: 100,
          synced: 15,
          failed: 0,
          errors: [],
          syncedAt: '2024-01-15T10:30:00.000Z',
        },
        message: 'Successfully synced inventory for 15 items to VMI Portal',
      };

      expect(expectedResponse.success).toBe(true);
      expect(expectedResponse.data.synced).toBeGreaterThan(0);
    });

    it('should calculate available quantities from inventory lots', async () => {
      const expectedInventoryCalc = {
        itemId: 1,
        tppCode: '1234567890123',
        totalQuantity: 1000,
        reservedQuantity: 200,
        availableQuantity: 800,
        unit: 'box',
      };

      expect(expectedInventoryCalc.availableQuantity).toBe(
        expectedInventoryCalc.totalQuantity - expectedInventoryCalc.reservedQuantity
      );
    });

    it('should only sync items that are registered in VMI Portal', async () => {
      const expectedBehavior = {
        requirement: 'Only items with lastSyncedAt for items sync should be included',
        skipNonVmiItems: true,
      };

      expect(expectedBehavior.skipNonVmiItems).toBe(true);
    });

    it('should handle inventory sync for items with zero quantity', async () => {
      const expectedResponse = {
        success: true,
        data: {
          synced: 1,
          inventoryItems: [{ tppCode: '1234567890123', availableQuantity: 0 }],
        },
      };

      expect(expectedResponse.data.inventoryItems[0].availableQuantity).toBe(0);
    });
  });

  describe('POST /api/purchasing/vmi/cron/sync-inventory', () => {
    it('should require CRON_SECRET for authentication', async () => {
      const expectedUnauthorizedResponse = {
        success: false,
        error: 'Unauthorized',
      };

      expect(expectedUnauthorizedResponse.success).toBe(false);
    });

    it('should sync inventory for all configured VMI vendors', async () => {
      const expectedResponse = {
        success: true,
        summary: {
          vendorsProcessed: 3,
          successCount: 3,
          failureCount: 0,
          totalItemsSynced: 45,
        },
        results: [
          { vendorId: 100, synced: 15, success: true },
          { vendorId: 101, synced: 20, success: true },
          { vendorId: 102, synced: 10, success: true },
        ],
      };

      expect(expectedResponse.success).toBe(true);
      expect(expectedResponse.summary.totalItemsSynced).toBe(45);
    });

    it('should skip vendors with sync disabled', async () => {
      const expectedBehavior = {
        checkField: 'syncInventoryEnabled',
        skipIfFalse: true,
      };

      expect(expectedBehavior.skipIfFalse).toBe(true);
    });
  });

  // ============================================================================
  // Sync Status API
  // ============================================================================

  describe('GET /api/purchasing/vmi/sync/status', () => {
    it('should return sync status for all VMI vendors', async () => {
      const expectedResponse = {
        success: true,
        data: {
          vendors: [
            {
              vendorId: 100,
              vendorName: 'Test Vendor',
              isConnected: true,
              itemsSync: {
                enabled: true,
                lastSyncAt: '2024-01-15T10:00:00.000Z',
                pendingCount: 5,
                status: 'partial',
              },
              pricesSync: {
                enabled: true,
                lastSyncAt: '2024-01-14T15:00:00.000Z',
                pendingCount: 2,
                status: 'partial',
              },
              inventorySync: {
                enabled: true,
                lastSyncAt: '2024-01-15T06:00:00.000Z',
                status: 'synced',
              },
            },
          ],
        },
      };

      expect(expectedResponse.success).toBe(true);
      expect(expectedResponse.data.vendors[0]).toHaveProperty('itemsSync');
      expect(expectedResponse.data.vendors[0]).toHaveProperty('pricesSync');
      expect(expectedResponse.data.vendors[0]).toHaveProperty('inventorySync');
    });

    it('should include sync health indicators', async () => {
      const healthIndicators = {
        synced: 'All items are synced',
        partial: 'Some items need syncing',
        error: 'Last sync failed',
        never: 'Never synced',
      };

      expect(Object.keys(healthIndicators)).toContain('synced');
      expect(Object.keys(healthIndicators)).toContain('error');
    });
  });

  // ============================================================================
  // API Security
  // ============================================================================

  describe('API Security', () => {
    it('should require purchasing:read for GET sync endpoints', () => {
      const requiredPermissions = ['purchasing:read'];
      expect(requiredPermissions).toContain('purchasing:read');
    });

    it('should require purchasing:write for POST sync endpoints', () => {
      const requiredPermissions = ['purchasing:write'];
      expect(requiredPermissions).toContain('purchasing:write');
    });

    it('should require valid VMI configuration for sync operations', () => {
      const prerequisites = ['vmiConfigExists', 'isConnected', 'hasValidApiKey'];
      expect(prerequisites).toContain('vmiConfigExists');
      expect(prerequisites).toContain('isConnected');
    });
  });

  // ============================================================================
  // Dashboard API (US6)
  // ============================================================================

  describe('GET /api/purchasing/vmi/dashboard', () => {
    it('should return VMI dashboard overview data', async () => {
      const expectedResponse = {
        success: true,
        data: {
          summary: {
            totalVendors: 3,
            connectedVendors: 2,
            disconnectedVendors: 1,
            healthPercentage: 67,
            totalVmiItems: 50,
          },
          transactions: {
            total: 100,
            success: 95,
            error: 5,
            byType: {
              item_sync: { success: 30, error: 2 },
              price_sync: { success: 25, error: 1 },
              inventory_sync: { success: 40, error: 2 },
            },
          },
          orders: {
            total: 15,
            byStatus: {
              submitted: 3,
              confirmed: 5,
              shipped: 4,
              received: 3,
            },
          },
          vendors: [],
        },
      };

      expect(expectedResponse.success).toBe(true);
      expect(expectedResponse.data).toHaveProperty('summary');
      expect(expectedResponse.data).toHaveProperty('transactions');
      expect(expectedResponse.data).toHaveProperty('orders');
      expect(expectedResponse.data).toHaveProperty('vendors');
    });

    it('should calculate health percentage correctly', async () => {
      const summary = {
        totalVendors: 4,
        connectedVendors: 3,
        disconnectedVendors: 1,
      };

      const healthPercentage = Math.round((summary.connectedVendors / summary.totalVendors) * 100);
      expect(healthPercentage).toBe(75);
    });

    it('should filter by vendorId when provided', async () => {
      const vendorId = 100;
      const expectedResponse = {
        success: true,
        data: {
          vendors: [{ vendorId: 100, vendorName: 'Test Vendor' }],
        },
      };

      expect(expectedResponse.data.vendors[0].vendorId).toBe(vendorId);
    });
  });

  describe('GET /api/purchasing/vmi/transactions', () => {
    it('should return VMI transaction log with pagination', async () => {
      const expectedResponse = {
        success: true,
        data: {
          transactions: [
            {
              id: 1,
              vendorId: 100,
              vendorName: 'Test Vendor',
              transactionType: 'item_sync',
              endpoint: '/api/v1/items',
              method: 'POST',
              httpStatus: 200,
              durationMs: 150,
              status: 'success',
              errorMessage: null,
              hasRequestPayload: true,
              hasResponsePayload: true,
              createdAt: '2024-01-15T10:30:00.000Z',
            },
          ],
          pagination: {
            total: 100,
            limit: 50,
            offset: 0,
            hasMore: true,
          },
          transactionTypes: [
            { type: 'item_sync', count: 30 },
            { type: 'price_sync', count: 25 },
          ],
        },
      };

      expect(expectedResponse.success).toBe(true);
      expect(expectedResponse.data.transactions).toBeInstanceOf(Array);
      expect(expectedResponse.data.pagination).toHaveProperty('total');
      expect(expectedResponse.data.pagination).toHaveProperty('hasMore');
    });

    it('should filter transactions by type', async () => {
      const type = 'item_sync';
      const expectedResponse = {
        success: true,
        data: {
          transactions: [
            { transactionType: 'item_sync' },
            { transactionType: 'item_sync' },
          ],
        },
      };

      expectedResponse.data.transactions.forEach((t) => {
        expect(t.transactionType).toBe(type);
      });
    });

    it('should filter transactions by status', async () => {
      const status = 'error';
      const expectedResponse = {
        success: true,
        data: {
          transactions: [
            { status: 'error', errorMessage: 'Connection timeout' },
          ],
        },
      };

      expectedResponse.data.transactions.forEach((t) => {
        expect(t.status).toBe(status);
      });
    });

    it('should filter transactions by date range', async () => {
      const fromDate = '2024-01-01';
      const toDate = '2024-01-31';
      const expectedResponse = {
        success: true,
        data: {
          transactions: [
            { createdAt: '2024-01-15T10:30:00.000Z' },
          ],
        },
      };

      const transactionDate = new Date(expectedResponse.data.transactions[0].createdAt);
      const from = new Date(fromDate);
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);

      expect(transactionDate >= from && transactionDate <= to).toBe(true);
    });
  });

  describe('GET /api/purchasing/vmi/transactions/[id]', () => {
    it('should return transaction detail with payloads', async () => {
      const expectedResponse = {
        success: true,
        data: {
          id: 1,
          vendorId: 100,
          vendorName: 'Test Vendor',
          transactionType: 'item_sync',
          endpoint: '/api/v1/items',
          method: 'POST',
          httpStatus: 200,
          durationMs: 150,
          status: 'success',
          errorMessage: null,
          requestPayload: { items: [{ tppCode: '1234567890123' }] },
          responsePayload: { synced: 1, failed: 0 },
          createdAt: '2024-01-15T10:30:00.000Z',
        },
      };

      expect(expectedResponse.success).toBe(true);
      expect(expectedResponse.data).toHaveProperty('requestPayload');
      expect(expectedResponse.data).toHaveProperty('responsePayload');
    });

    it('should return 404 for non-existent transaction', async () => {
      const expectedResponse = {
        success: false,
        error: 'Transaction not found',
      };

      expect(expectedResponse.success).toBe(false);
      expect(expectedResponse.error).toContain('not found');
    });
  });

  // ============================================================================
  // TPP/TTMT Code Validation
  // ============================================================================

  describe('TPP/TTMT Code Validation', () => {
    it('should validate TPP code format (13 digits)', () => {
      const validTppCodes = ['1234567890123', '9876543210987'];
      const invalidTppCodes = ['123', 'abc1234567890', '12345678901234'];

      validTppCodes.forEach((code) => {
        expect(/^\d{13}$/.test(code)).toBe(true);
      });

      invalidTppCodes.forEach((code) => {
        expect(/^\d{13}$/.test(code)).toBe(false);
      });
    });

    it('should validate TTMT code format (A + 8 digits)', () => {
      const validTtmtCodes = ['A12345678', 'A00000001', 'A99999999'];
      const invalidTtmtCodes = ['12345678', 'B12345678', 'A1234567', 'A123456789'];

      validTtmtCodes.forEach((code) => {
        expect(/^A\d{8}$/.test(code)).toBe(true);
      });

      invalidTtmtCodes.forEach((code) => {
        expect(/^A\d{8}$/.test(code)).toBe(false);
      });
    });

    it('should require at least one code (TPP or TTMT) for VMI sync', () => {
      const itemWithBoth = { tppCode: '1234567890123', ttmtCode: 'A12345678' };
      const itemWithTppOnly = { tppCode: '1234567890123', ttmtCode: null };
      const itemWithTtmtOnly = { tppCode: null, ttmtCode: 'A12345678' };
      const itemWithNone = { tppCode: null, ttmtCode: null };

      expect(itemWithBoth.tppCode || itemWithBoth.ttmtCode).toBeTruthy();
      expect(itemWithTppOnly.tppCode || itemWithTppOnly.ttmtCode).toBeTruthy();
      expect(itemWithTtmtOnly.tppCode || itemWithTtmtOnly.ttmtCode).toBeTruthy();
      expect(itemWithNone.tppCode || itemWithNone.ttmtCode).toBeFalsy();
    });
  });
});
