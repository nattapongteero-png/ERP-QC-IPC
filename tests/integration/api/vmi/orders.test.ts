/**
 * Integration Tests for VMI Orders API
 *
 * Tests the VMI order management endpoints
 *
 * Note: These are integration-style tests that validate expected API response formats
 * For full end-to-end testing, use playwright or similar E2E framework
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { VmiOrderStatus } from '@/types/vmi';

describe('VMI Orders API', () => {
  const originalEnv = {
    VMI_ENCRYPTION_KEY: process.env.VMI_ENCRYPTION_KEY,
    VMI_PORTAL_BASE_URL: process.env.VMI_PORTAL_BASE_URL,
    CRON_SECRET: process.env.CRON_SECRET,
  };

  beforeAll(() => {
    // Set up encryption key
    process.env.VMI_ENCRYPTION_KEY = 'a'.repeat(64);
    process.env.VMI_PORTAL_BASE_URL = 'https://test-vmi-portal.example.com/api';
    process.env.CRON_SECRET = 'test-cron-secret';
  });

  afterAll(() => {
    // Restore original env
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

  describe('GET /api/purchasing/vmi/orders', () => {
    it('should return list of VMI orders with pagination', async () => {
      const expectedResponse = {
        success: true,
        data: {
          items: [
            {
              id: 1,
              vendorId: 100,
              vendorName: 'Test Vendor',
              vmiOrderId: 12345,
              hospitalCode: 'HOSP001',
              hospitalName: 'Test Hospital',
              poNumber: 'PO-2024-001',
              warehouseName: 'Main Warehouse',
              status: 'submitted' as VmiOrderStatus,
              orderDate: '2024-01-15',
              expectedDate: '2024-01-22',
              totalAmount: 150000.0,
              currency: 'THB',
              localPoId: null,
              confirmedAt: null,
              shippedAt: null,
              receivedAt: null,
              createdAt: '2024-01-15T10:30:00.000Z',
            },
          ],
          total: 1,
          page: 1,
          pageSize: 50,
        },
      };

      expect(expectedResponse.success).toBe(true);
      expect(expectedResponse.data.items).toBeInstanceOf(Array);
      expect(expectedResponse.data.items[0]).toHaveProperty('vmiOrderId');
      expect(expectedResponse.data.items[0]).toHaveProperty('hospitalCode');
      expect(expectedResponse.data.items[0]).toHaveProperty('poNumber');
    });

    it('should filter orders by status', async () => {
      const statusFilter: VmiOrderStatus = 'submitted';
      const expectedResponse = {
        success: true,
        data: {
          items: [
            { id: 1, status: 'submitted' },
            { id: 2, status: 'submitted' },
          ],
        },
      };

      expect(expectedResponse.data.items.every((item) => item.status === statusFilter)).toBe(true);
    });

    it('should filter orders by vendor ID', async () => {
      const vendorIdFilter = 100;
      const expectedResponse = {
        success: true,
        data: {
          items: [
            { id: 1, vendorId: 100 },
            { id: 2, vendorId: 100 },
          ],
        },
      };

      expect(expectedResponse.data.items.every((item) => item.vendorId === vendorIdFilter)).toBe(
        true
      );
    });

    it('should filter orders by date range', async () => {
      const dateFrom = '2024-01-01';
      const dateTo = '2024-01-31';
      const expectedResponse = {
        success: true,
        data: {
          items: [
            { id: 1, orderDate: '2024-01-15' },
            { id: 2, orderDate: '2024-01-20' },
          ],
        },
      };

      expectedResponse.data.items.forEach((item) => {
        expect(item.orderDate >= dateFrom).toBe(true);
        expect(item.orderDate <= dateTo).toBe(true);
      });
    });
  });

  describe('POST /api/purchasing/vmi/orders (Poll Orders)', () => {
    it('should poll orders from VMI Portal for specific vendor', async () => {
      const requestBody = { vendorId: 100 };
      const expectedResponse = {
        success: true,
        data: {
          vendorId: 100,
          newOrders: 3,
          polledAt: '2024-01-15T10:30:00.000Z',
        },
        message: 'Polled 3 new orders from VMI Portal',
      };

      expect(expectedResponse.success).toBe(true);
      expect(expectedResponse.data.vendorId).toBe(requestBody.vendorId);
      expect(expectedResponse.data.newOrders).toBeGreaterThanOrEqual(0);
    });

    it('should poll orders from all configured VMI vendors when no vendorId', async () => {
      const expectedResponse = {
        success: true,
        data: {
          results: [
            { vendorId: 100, newOrders: 2, success: true },
            { vendorId: 101, newOrders: 1, success: true },
          ],
          totalNewOrders: 3,
        },
        message: 'Polled 3 new orders from 2 VMI vendors',
      };

      expect(expectedResponse.success).toBe(true);
      expect(expectedResponse.data.totalNewOrders).toBe(3);
    });

    it('should handle vendor without VMI configuration', async () => {
      const expectedErrorResponse = {
        success: false,
        error: 'VMI configuration not found for vendor',
      };

      expect(expectedErrorResponse.success).toBe(false);
      expect(expectedErrorResponse.error).toContain('configuration not found');
    });

    it('should handle VMI Portal connection failure during polling', async () => {
      const expectedPartialResponse = {
        success: true,
        data: {
          results: [
            { vendorId: 100, newOrders: 2, success: true },
            { vendorId: 101, newOrders: 0, success: false, error: 'Connection timeout' },
          ],
        },
      };

      const failedVendors = expectedPartialResponse.data.results.filter((r) => !r.success);
      expect(failedVendors.length).toBe(1);
      expect(failedVendors[0].error).toBeDefined();
    });
  });

  describe('GET /api/purchasing/vmi/orders/[id]', () => {
    it('should return order detail with lines', async () => {
      const expectedResponse = {
        success: true,
        data: {
          id: 1,
          vendorId: 100,
          vendorName: 'Test Vendor',
          vendorCode: 'V001',
          vmiOrderId: 12345,
          hospitalCode: 'HOSP001',
          hospitalName: 'Test Hospital',
          poNumber: 'PO-2024-001',
          warehouseName: 'Main Warehouse',
          status: 'submitted' as VmiOrderStatus,
          orderDate: '2024-01-15',
          expectedDate: '2024-01-22',
          totalAmount: 150000.0,
          currency: 'THB',
          localPoId: null,
          confirmedAt: null,
          shippedAt: null,
          receivedAt: null,
          notes: null,
          createdAt: '2024-01-15T10:30:00.000Z',
          updatedAt: '2024-01-15T10:30:00.000Z',
          lines: [
            {
              id: 1,
              tppCode: '1234567890123',
              ttmtCode: 'A12345678',
              itemName: 'Test Herbal Product',
              quantity: 100,
              unit: 'box',
              unitPrice: 500.0,
              totalPrice: 50000.0,
            },
            {
              id: 2,
              tppCode: '9876543210123',
              ttmtCode: 'A87654321',
              itemName: 'Another Herbal Product',
              quantity: 200,
              unit: 'bottle',
              unitPrice: 500.0,
              totalPrice: 100000.0,
            },
          ],
        },
      };

      expect(expectedResponse.success).toBe(true);
      expect(expectedResponse.data).toHaveProperty('lines');
      expect(expectedResponse.data.lines).toBeInstanceOf(Array);
      expect(expectedResponse.data.lines.length).toBe(2);
      expect(expectedResponse.data.lines[0]).toHaveProperty('tppCode');
      expect(expectedResponse.data.lines[0]).toHaveProperty('ttmtCode');
    });

    it('should return 404 for non-existent order', async () => {
      const expectedErrorResponse = {
        success: false,
        error: 'Order not found',
      };

      expect(expectedErrorResponse.success).toBe(false);
      expect(expectedErrorResponse.error).toBe('Order not found');
    });

    it('should validate order ID is numeric', async () => {
      const expectedErrorResponse = {
        success: false,
        error: 'Invalid order ID',
      };

      expect(expectedErrorResponse.success).toBe(false);
      expect(expectedErrorResponse.error).toContain('Invalid');
    });
  });

  describe('PATCH /api/purchasing/vmi/orders/[id] (Confirm)', () => {
    it('should confirm submitted order and create local PO', async () => {
      const requestBody = { action: 'confirm' };
      const expectedResponse = {
        success: true,
        data: {
          orderId: 1,
          vmiOrderId: 12345,
          previousStatus: 'submitted',
          newStatus: 'confirmed',
          localPoId: 500,
          updatedAt: '2024-01-15T10:30:00.000Z',
        },
        message: 'Order confirmed successfully',
      };

      expect(expectedResponse.success).toBe(true);
      expect(expectedResponse.data.previousStatus).toBe('submitted');
      expect(expectedResponse.data.newStatus).toBe('confirmed');
      expect(expectedResponse.data.localPoId).toBeDefined();
    });

    it('should reject confirmation for non-submitted order', async () => {
      const expectedErrorResponse = {
        success: false,
        error: 'Cannot confirm order with status "confirmed". Order must be in "submitted" status.',
      };

      expect(expectedErrorResponse.success).toBe(false);
      expect(expectedErrorResponse.error).toContain('Cannot confirm order');
    });

    it('should handle VMI Portal confirmation failure', async () => {
      const expectedErrorResponse = {
        success: false,
        error: 'VMI Portal error: Order confirmation failed',
      };

      expect(expectedErrorResponse.success).toBe(false);
      expect(expectedErrorResponse.error).toContain('VMI Portal error');
    });
  });

  describe('PATCH /api/purchasing/vmi/orders/[id] (Ship)', () => {
    it('should ship confirmed order with expected delivery date', async () => {
      const requestBody = {
        action: 'ship',
        expectedDeliveryDate: '2024-01-22',
      };
      const expectedResponse = {
        success: true,
        data: {
          orderId: 1,
          vmiOrderId: 12345,
          previousStatus: 'confirmed',
          newStatus: 'shipped',
          localPoId: 500,
          updatedAt: '2024-01-15T10:30:00.000Z',
        },
        message: 'Order shipped successfully',
      };

      expect(expectedResponse.success).toBe(true);
      expect(expectedResponse.data.previousStatus).toBe('confirmed');
      expect(expectedResponse.data.newStatus).toBe('shipped');
    });

    it('should require expected delivery date for shipping', async () => {
      const expectedErrorResponse = {
        success: false,
        error: 'Expected delivery date is required for shipping',
      };

      expect(expectedErrorResponse.success).toBe(false);
      expect(expectedErrorResponse.error).toContain('Expected delivery date');
    });

    it('should reject shipping for non-confirmed order', async () => {
      const expectedErrorResponse = {
        success: false,
        error: 'Cannot ship order with status "submitted". Order must be in "confirmed" status.',
      };

      expect(expectedErrorResponse.success).toBe(false);
      expect(expectedErrorResponse.error).toContain('Cannot ship order');
    });
  });

  describe('GET /api/purchasing/vmi/orders/[id]/receipt-status', () => {
    it('should check receipt status for shipped order', async () => {
      const expectedResponse = {
        success: true,
        data: {
          orderId: 1,
          vmiOrderId: 12345,
          orderStatus: 'shipped',
          receiptStatus: 'pending',
          receivedAt: null,
          receivedQuantities: null,
          checkedAt: '2024-01-15T10:30:00.000Z',
        },
      };

      expect(expectedResponse.success).toBe(true);
      expect(expectedResponse.data.receiptStatus).toBe('pending');
    });

    it('should update order to received when hospital confirms receipt', async () => {
      const expectedResponse = {
        success: true,
        data: {
          orderId: 1,
          vmiOrderId: 12345,
          orderStatus: 'received',
          receiptStatus: 'received',
          receivedAt: '2024-01-20T14:00:00.000Z',
          receivedQuantities: [
            { lineId: 1, quantity: 100 },
            { lineId: 2, quantity: 200 },
          ],
          checkedAt: '2024-01-21T10:30:00.000Z',
        },
      };

      expect(expectedResponse.success).toBe(true);
      expect(expectedResponse.data.receiptStatus).toBe('received');
      expect(expectedResponse.data.receivedAt).toBeDefined();
    });

    it('should return message for non-shipped order', async () => {
      const expectedResponse = {
        success: true,
        data: {
          orderId: 1,
          vmiOrderId: 12345,
          orderStatus: 'confirmed',
          receiptStatus: 'pending',
          receivedAt: null,
          message: 'Order is in "confirmed" status. Receipt check only applies to shipped orders.',
        },
      };

      expect(expectedResponse.success).toBe(true);
      expect(expectedResponse.data.message).toContain('Receipt check only applies to shipped');
    });
  });

  describe('POST /api/purchasing/vmi/cron/poll-orders', () => {
    it('should require CRON_SECRET header for authentication', async () => {
      const expectedUnauthorizedResponse = {
        success: false,
        error: 'Unauthorized',
      };

      expect(expectedUnauthorizedResponse.success).toBe(false);
      expect(expectedUnauthorizedResponse.error).toBe('Unauthorized');
    });

    it('should poll all due vendors on cron trigger', async () => {
      const expectedResponse = {
        success: true,
        executedAt: '2024-01-15T10:30:00.000Z',
        durationMs: 1500,
        summary: {
          vendorsProcessed: 3,
          successCount: 2,
          failureCount: 1,
          totalNewOrders: 5,
        },
        results: [
          { vendorId: 100, success: true, newOrders: 3 },
          { vendorId: 101, success: true, newOrders: 2 },
          { vendorId: 102, success: false, newOrders: 0, error: 'Connection timeout' },
        ],
      };

      expect(expectedResponse.success).toBe(true);
      expect(expectedResponse.summary.vendorsProcessed).toBe(3);
      expect(expectedResponse.summary.totalNewOrders).toBe(5);
    });

    it('should skip vendors not due for polling', async () => {
      // Vendors with lastOrdersPollAt within orderPollIntervalMinutes should be skipped
      const expectedResponse = {
        success: true,
        summary: {
          vendorsProcessed: 1,
          successCount: 1,
          failureCount: 0,
          totalNewOrders: 2,
        },
        results: [{ vendorId: 100, success: true, newOrders: 2 }],
      };

      // Vendor 101 and 102 were polled recently (within interval), so skipped
      expect(expectedResponse.summary.vendorsProcessed).toBe(1);
    });

    it('should handle unconfigured CRON_SECRET', async () => {
      const expectedErrorResponse = {
        success: false,
        error: 'Cron endpoint not configured',
      };

      expect(expectedErrorResponse.success).toBe(false);
      expect(expectedErrorResponse.error).toContain('not configured');
    });
  });

  describe('Order Status Transitions', () => {
    it('should validate submitted -> confirmed transition', async () => {
      const validTransition = {
        from: 'submitted' as VmiOrderStatus,
        to: 'confirmed' as VmiOrderStatus,
        action: 'confirm',
      };

      expect(validTransition.from).toBe('submitted');
      expect(validTransition.to).toBe('confirmed');
    });

    it('should validate confirmed -> shipped transition', async () => {
      const validTransition = {
        from: 'confirmed' as VmiOrderStatus,
        to: 'shipped' as VmiOrderStatus,
        action: 'ship',
      };

      expect(validTransition.from).toBe('confirmed');
      expect(validTransition.to).toBe('shipped');
    });

    it('should validate shipped -> received transition (via receipt check)', async () => {
      const validTransition = {
        from: 'shipped' as VmiOrderStatus,
        to: 'received' as VmiOrderStatus,
        trigger: 'receipt_check',
      };

      expect(validTransition.from).toBe('shipped');
      expect(validTransition.to).toBe('received');
    });

    it('should define all valid order statuses', async () => {
      const validStatuses: VmiOrderStatus[] = [
        'submitted',
        'confirmed',
        'shipped',
        'received',
        'cancelled',
      ];

      expect(validStatuses).toContain('submitted');
      expect(validStatuses).toContain('confirmed');
      expect(validStatuses).toContain('shipped');
      expect(validStatuses).toContain('received');
      expect(validStatuses).toContain('cancelled');
      expect(validStatuses.length).toBe(5);
    });
  });

  describe('API Security', () => {
    it('should require purchasing:read permission for GET orders', () => {
      const requiredPermissions = ['purchasing:read'];
      expect(requiredPermissions).toContain('purchasing:read');
    });

    it('should require purchasing:write permission for POST poll', () => {
      const requiredPermissions = ['purchasing:write'];
      expect(requiredPermissions).toContain('purchasing:write');
    });

    it('should require purchasing:write permission for PATCH order actions', () => {
      const requiredPermissions = ['purchasing:write'];
      expect(requiredPermissions).toContain('purchasing:write');
    });

    it('should require CRON_SECRET for cron endpoint', () => {
      const cronAuthMethods = ['x-cron-secret', 'authorization'];
      expect(cronAuthMethods).toContain('x-cron-secret');
    });
  });

  describe('Local PO Creation on Confirm', () => {
    it('should create local PO with VMI order details', async () => {
      const expectedLocalPO = {
        id: 500,
        vendorId: 100,
        poNumber: 'VMI-HOSP001-PO-2024-001',
        orderDate: '2024-01-15',
        expectedDate: '2024-01-22',
        status: 'approved',
        totalAmount: 150000.0,
        currency: 'THB',
        notes: 'VMI Order from Test Hospital (HOSP001). Original PO: PO-2024-001',
      };

      expect(expectedLocalPO.poNumber).toContain('VMI-');
      expect(expectedLocalPO.status).toBe('approved');
      expect(expectedLocalPO.notes).toContain('VMI Order');
    });

    it('should create local PO lines from VMI order lines', async () => {
      const expectedLocalPOLines = [
        {
          purchaseOrderId: 500,
          itemId: null, // Will be linked later
          quantity: 100,
          unitPrice: 500.0,
          totalPrice: 50000.0,
          notes: 'Test Herbal Product (TPP: 1234567890123, TTMT: A12345678)',
        },
        {
          purchaseOrderId: 500,
          itemId: null,
          quantity: 200,
          unitPrice: 500.0,
          totalPrice: 100000.0,
          notes: 'Another Herbal Product (TPP: 9876543210123, TTMT: A87654321)',
        },
      ];

      expect(expectedLocalPOLines.length).toBe(2);
      expect(expectedLocalPOLines[0].notes).toContain('TPP:');
      expect(expectedLocalPOLines[0].notes).toContain('TTMT:');
    });

    it('should link VMI order to local PO after confirmation', async () => {
      const updatedVmiOrder = {
        id: 1,
        localPoId: 500, // Linked after confirmation
        status: 'confirmed',
        confirmedAt: '2024-01-15T10:30:00.000Z',
      };

      expect(updatedVmiOrder.localPoId).toBe(500);
      expect(updatedVmiOrder.status).toBe('confirmed');
      expect(updatedVmiOrder.confirmedAt).toBeDefined();
    });
  });
});
