/**
 * VMI Sales Order Service Integration Tests
 *
 * Tests the VMI order workflow:
 * 1. createSalesOrderFromVmi() — creates real SO from VMI order data
 * 2. VmiSalesOrderService.confirmOrder() — confirm flow creates SO + notifies portal
 * 3. VmiSalesOrderService.pollOrders() — polls VMI Portal API for new orders
 *
 * Uses in-memory SQLite with schema sync (same pattern as sales-service-real.test.ts)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@/lib/db/schema';
import { generateCreateTableSql } from '../../helpers/schema-sync';

// Create test database
let sqlite: Database.Database;
let testDb: ReturnType<typeof drizzle>;

// Mock the database module
vi.mock('@/lib/db', async () => {
  return {
    isSqlite: () => true,
    getDb: async () => testDb,
    getSqliteDb: () => testDb,
    getMysqlDb: async () => testDb,
    db: () => testDb,
    markSchemaSynced: () => {},
    schema,
  };
});

// Mock audit to avoid side effects
vi.mock('@/lib/audit', () => ({
  createAuditLog: vi.fn(() => Promise.resolve()),
}));

// Mock crypto decrypt — return a fake API key
vi.mock('@/lib/crypto/encrypt', () => ({
  decrypt: vi.fn(() => 'test-api-key-12345'),
  encrypt: vi.fn((val: string) => `encrypted:${val}`),
}));

// Mock vmiPortalConfigService.updateLastOrdersPoll
vi.mock('@/lib/services/vmi-portal-config.service', () => ({
  vmiPortalConfigService: {
    updateLastOrdersPoll: vi.fn(() => Promise.resolve()),
  },
}));

// Mock accounting service (imported by sales.service)
vi.mock('@/lib/services/accounting.service', () => ({
  createSOShipmentJournalEntry: vi.fn(() => Promise.resolve({})),
  createARInvoiceFromSOShipment: vi.fn(() => Promise.resolve({})),
  THAI_VAT_RATE: 0.07,
}));

// Mock unit-cost service
vi.mock('@/lib/services/unit-cost.service', () => ({
  calculateCOGS: vi.fn(() => Promise.resolve({ totalCost: 0, unitCost: 0, marginAmount: 0, marginPercent: 0 })),
  updateSOLineWithCOGS: vi.fn(() => Promise.resolve()),
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Import services AFTER mocking
import { createSalesOrderFromVmi } from '@/lib/services/sales.service';
import { VmiSalesOrderService } from '@/lib/services/vmi-sales-order.service';

// Test constants
const TEST_USER_ID = 1;
const TODAY = new Date().toISOString().split('T')[0];

describe('VMI Sales Order Service Integration Tests', () => {
  beforeAll(() => {
    sqlite = new Database(':memory:');
    testDb = drizzle(sqlite);

    // Create all required tables
    const tables = [
      schema.sqliteUsers,
      schema.sqliteVendors,
      schema.sqliteCustomers,
      schema.sqliteItems,
      schema.sqliteWarehouses,
      schema.sqliteWarehouseLocations,
      schema.sqliteInventoryLots,
      schema.sqliteInventoryTransactions,
      schema.sqliteSalesOrders,
      schema.sqliteSalesOrderLines,
      schema.sqliteVmiPortalConfig,
      schema.sqliteVmiSalesOrders,
      schema.sqliteVmiSalesOrderLines,
    ];

    for (const table of tables) {
      const sql = generateCreateTableSql(table);
      sqlite.exec(sql);
    }
  });

  afterAll(() => {
    sqlite.close();
  });

  beforeEach(() => {
    // Clean up tables (reverse order for FK)
    sqlite.exec('DELETE FROM vmi_sales_order_lines');
    sqlite.exec('DELETE FROM vmi_sales_orders');
    sqlite.exec('DELETE FROM vmi_portal_config');
    sqlite.exec('DELETE FROM sales_order_lines');
    sqlite.exec('DELETE FROM sales_orders');
    sqlite.exec('DELETE FROM items');
    sqlite.exec('DELETE FROM customers');
    sqlite.exec('DELETE FROM users');

    // Seed base data
    sqlite.exec(`
      INSERT INTO users (id, email, password, name, role, is_active)
      VALUES (1, 'sales@test.com', 'hash', 'Sales User', 'sales', 1)
    `);

    sqlite.exec(`
      INSERT INTO items (id, code, name_th, name_en, type, category, primary_unit, shelf_life_days, on_hand, on_hand_cost, is_lot_controlled, is_fefo, is_active, tpp_code, ttmt_code)
      VALUES
        (1, 'FG-001', 'ฟ้าทะลายโจรแคปซูล', 'Andrographis Capsule', 'finished_product', 'capsule', 'box', 365, 0, 0, 1, 1, 1, '1234567890123', 'A12345678'),
        (2, 'FG-002', 'ขมิ้นชันแคปซูล', 'Turmeric Capsule', 'finished_product', 'capsule', 'box', 365, 0, 0, 1, 1, 1, '9876543210123', 'A87654321')
    `);

    sqlite.exec(`
      INSERT INTO customers (id, code, name, phone, email, address, customer_type, is_active)
      VALUES (1, 'HOSP-001', 'Test Hospital', '021111111', 'hosp@test.com', '123 Hospital Rd', 'hospital', 1)
    `);

    // Reset fetch mock only (don't restore module mocks — they lose their implementations)
    mockFetch.mockReset();
  });

  // ============================================
  // createSalesOrderFromVmi() Unit Tests
  // ============================================
  describe('createSalesOrderFromVmi()', () => {
    it('should create a sales order with status=confirmed and source=vmi', async () => {
      const result = await createSalesOrderFromVmi({
        vmiSalesOrderId: 100,
        customerName: 'Test Hospital',
        orderDate: TODAY,
        totalAmount: 15000,
        lines: [
          { itemId: 1, quantity: 50, unit: 'box', unitPrice: 150 },
          { itemId: 2, quantity: 20, unit: 'box', unitPrice: 375 },
        ],
        userId: TEST_USER_ID,
        notes: 'VMI Order #12345 from VMI Portal',
      });

      expect(result.orderId).toBeGreaterThan(0);
      expect(result.soNumber).toMatch(/^SO-\d{6}-\d{4}$/);

      // Verify SO record
      const so = sqlite.prepare('SELECT * FROM sales_orders WHERE id = ?').get(result.orderId) as any;
      expect(so.status).toBe('confirmed');
      expect(so.source).toBe('vmi');
      expect(so.vmi_sales_order_id).toBe(100);
      expect(so.customer_name).toBe('Test Hospital');
      expect(so.total_amount).toBe(15000); // 50*150 + 20*375 = 15000
      expect(so.notes).toBe('VMI Order #12345 from VMI Portal');
    });

    it('should create order lines with correct prices', async () => {
      const result = await createSalesOrderFromVmi({
        vmiSalesOrderId: 101,
        customerName: 'Hospital B',
        orderDate: TODAY,
        totalAmount: 7500,
        lines: [
          { itemId: 1, quantity: 50, unit: 'box', unitPrice: 150 },
        ],
        userId: TEST_USER_ID,
      });

      const lines = sqlite.prepare('SELECT * FROM sales_order_lines WHERE so_id = ?').all(result.orderId) as any[];
      expect(lines.length).toBe(1);
      expect(lines[0].item_id).toBe(1);
      expect(lines[0].quantity).toBe(50);
      expect(lines[0].unit_price).toBe(150);
      expect(lines[0].total_price).toBe(7500);
    });

    it('should generate unique SO numbers for multiple VMI orders', async () => {
      const result1 = await createSalesOrderFromVmi({
        vmiSalesOrderId: 201,
        customerName: 'Hospital A',
        orderDate: TODAY,
        totalAmount: 5000,
        lines: [{ itemId: 1, quantity: 10, unit: 'box', unitPrice: 500 }],
        userId: TEST_USER_ID,
      });

      const result2 = await createSalesOrderFromVmi({
        vmiSalesOrderId: 202,
        customerName: 'Hospital B',
        orderDate: TODAY,
        totalAmount: 3000,
        lines: [{ itemId: 2, quantity: 10, unit: 'box', unitPrice: 300 }],
        userId: TEST_USER_ID,
      });

      expect(result1.soNumber).not.toBe(result2.soNumber);
    });

    it('should handle optional requiredDate', async () => {
      const futureDate = '2026-04-15';
      const result = await createSalesOrderFromVmi({
        vmiSalesOrderId: 301,
        customerName: 'Hospital C',
        orderDate: TODAY,
        requiredDate: futureDate,
        totalAmount: 1500,
        lines: [{ itemId: 1, quantity: 10, unit: 'box', unitPrice: 150 }],
        userId: TEST_USER_ID,
      });

      const so = sqlite.prepare('SELECT * FROM sales_orders WHERE id = ?').get(result.orderId) as any;
      expect(so.required_date).toBe(futureDate);
    });

    it('should handle null requiredDate', async () => {
      const result = await createSalesOrderFromVmi({
        vmiSalesOrderId: 302,
        customerName: 'Hospital D',
        orderDate: TODAY,
        requiredDate: null,
        totalAmount: 1500,
        lines: [{ itemId: 1, quantity: 10, unit: 'box', unitPrice: 150 }],
        userId: TEST_USER_ID,
      });

      const so = sqlite.prepare('SELECT * FROM sales_orders WHERE id = ?').get(result.orderId) as any;
      expect(so.required_date).toBeNull();
    });
  });

  // ============================================
  // VMI Order Polling Tests
  // ============================================
  describe('VmiSalesOrderService.pollOrders()', () => {
    beforeEach(() => {
      // Seed a VMI portal config
      sqlite.exec(`
        INSERT INTO vmi_portal_config (id, name, portal_url, api_key_encrypted, vendor_id, is_enabled, order_polling_enabled)
        VALUES (1, 'Test Portal', 'https://test-portal.example.com', 'encrypted:test-key', 'V001', 1, 1)
      `);
    });

    it('should return empty result when no portals are enabled', async () => {
      // Disable the portal
      sqlite.exec(`UPDATE vmi_portal_config SET is_enabled = 0`);

      const service = new VmiSalesOrderService();
      const result = await service.pollOrders();

      expect(result.portalsPolled).toBe(0);
      expect(result.ordersReceived).toBe(0);
      expect(result.orders).toHaveLength(0);
    });

    it('should poll portal and create orders from API response', async () => {
      // Mock the portal list endpoint
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            orders: [
              {
                id: 5001,
                hospitalCode: 'HOSP001',
                hospitalName: 'Test Hospital',
                poNumber: 'PO-2026-001',
                status: 'submitted',
                orderDate: '2026-03-10',
                expectedDeliveryDate: '2026-03-20',
                totalValue: '15000.00',
                itemCount: 2,
              },
            ],
          }),
        })
        // Mock the order detail endpoint
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            order: {
              id: 5001,
              hospitalCode: 'HOSP001',
              hospitalName: 'Test Hospital',
              poNumber: 'PO-2026-001',
              status: 'submitted',
              orderDate: '2026-03-10',
              expectedDeliveryDate: '2026-03-20',
              totalValue: '15000.00',
              itemCount: 2,
              items: [
                {
                  id: 1,
                  localCode: 'FG-001',
                  name: 'ฟ้าทะลายโจรแคปซูล',
                  unit: 'box',
                  tppCode: '1234567890123',
                  ttmtCode: 'A12345678',
                  quantityOrdered: '50',
                  unitPrice: '150',
                  lineTotal: '7500',
                },
                {
                  id: 2,
                  localCode: 'FG-002',
                  name: 'ขมิ้นชันแคปซูล',
                  unit: 'box',
                  tppCode: '9876543210123',
                  ttmtCode: 'A87654321',
                  quantityOrdered: '20',
                  unitPrice: '375',
                  lineTotal: '7500',
                },
              ],
            },
          }),
        });

      const service = new VmiSalesOrderService();
      const result = await service.pollOrders();

      expect(result.portalsPolled).toBe(1);
      expect(result.ordersReceived).toBe(1);
      expect(result.orders).toHaveLength(1);
      expect(result.orders[0].vmiOrderId).toBe('5001');
      expect(result.orders[0].vmiCustomerName).toBe('Test Hospital');

      // Verify order was saved to DB
      const savedOrder = sqlite.prepare('SELECT * FROM vmi_sales_orders WHERE vmi_order_id = ?').get('5001') as any;
      expect(savedOrder).toBeTruthy();
      expect(savedOrder.vmi_status).toBe('submitted');
      expect(savedOrder.local_status).toBe('pending');
      expect(savedOrder.vmi_customer_name).toBe('Test Hospital');
      expect(savedOrder.total_amount).toBe(15000);

      // Verify lines were saved
      const savedLines = sqlite.prepare('SELECT * FROM vmi_sales_order_lines WHERE vmi_sales_order_id = ?').all(savedOrder.id) as any[];
      expect(savedLines).toHaveLength(2);
      expect(savedLines[0].item_name).toBe('ฟ้าทะลายโจรแคปซูล');
      expect(savedLines[0].match_status).toBe('matched'); // TPP code matches item 1
      expect(savedLines[1].match_status).toBe('matched'); // TPP code matches item 2
    });

    it('should skip already imported orders', async () => {
      // Pre-seed an existing order
      sqlite.exec(`
        INSERT INTO vmi_sales_orders (id, portal_id, vmi_order_id, vmi_status, local_status, vmi_customer_id, vmi_customer_name, order_date, total_amount, order_data_json)
        VALUES (1, 1, '5001', 'submitted', 'pending', 'HOSP001', 'Test Hospital', '2026-03-10', 15000, '{}')
      `);

      // Mock returns same order ID 5001
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          orders: [
            { id: 5001, hospitalCode: 'HOSP001', hospitalName: 'Test Hospital', poNumber: 'PO-2026-001', status: 'submitted', orderDate: '2026-03-10', expectedDeliveryDate: null, totalValue: '15000', itemCount: 1 },
          ],
        }),
      });

      const service = new VmiSalesOrderService();
      const result = await service.pollOrders();

      // Should skip because 5001 already exists
      expect(result.ordersReceived).toBe(0);
      // Only the list call, no detail call
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle portal API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const service = new VmiSalesOrderService();
      const result = await service.pollOrders();

      expect(result.portalsPolled).toBe(1);
      expect(result.ordersReceived).toBe(0);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBe(1);
      expect(result.errors![0].portalId).toBe(1);
    });

    it('should match items by TPP code during poll', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            orders: [
              { id: 6001, hospitalCode: 'HOSP001', hospitalName: 'Hospital', poNumber: 'PO-001', status: 'submitted', orderDate: '2026-03-10', expectedDeliveryDate: null, totalValue: '7500', itemCount: 1 },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            order: {
              id: 6001, hospitalCode: 'HOSP001', hospitalName: 'Hospital', poNumber: 'PO-001', status: 'submitted', orderDate: '2026-03-10', expectedDeliveryDate: null, totalValue: '7500', itemCount: 1,
              items: [
                { id: 1, localCode: 'UNKNOWN', name: 'Test Item', unit: 'box', tppCode: '1234567890123', ttmtCode: null, quantityOrdered: '50', unitPrice: '150', lineTotal: '7500' },
              ],
            },
          }),
        });

      const service = new VmiSalesOrderService();
      await service.pollOrders();

      const line = sqlite.prepare('SELECT * FROM vmi_sales_order_lines WHERE vmi_line_id = ?').get('1') as any;
      expect(line.match_status).toBe('matched');
      expect(line.item_id).toBe(1); // Matched to item with tpp_code '1234567890123'
    });

    it('should mark lines as unmatched when no item matches', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            orders: [
              { id: 7001, hospitalCode: 'HOSP001', hospitalName: 'Hospital', poNumber: 'PO-002', status: 'submitted', orderDate: '2026-03-10', expectedDeliveryDate: null, totalValue: '1000', itemCount: 1 },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            order: {
              id: 7001, hospitalCode: 'HOSP001', hospitalName: 'Hospital', poNumber: 'PO-002', status: 'submitted', orderDate: '2026-03-10', expectedDeliveryDate: null, totalValue: '1000', itemCount: 1,
              items: [
                { id: 1, localCode: 'UNKNOWN-CODE', name: 'Unknown Item', unit: 'box', tppCode: '0000000000000', ttmtCode: null, quantityOrdered: '10', unitPrice: '100', lineTotal: '1000' },
              ],
            },
          }),
        });

      const service = new VmiSalesOrderService();
      const pollResult = await service.pollOrders();

      expect(pollResult.ordersReceived).toBe(1);
      expect(pollResult.errors).toBeUndefined();

      const allLines = sqlite.prepare('SELECT * FROM vmi_sales_order_lines').all() as any[];
      expect(allLines.length).toBeGreaterThan(0);

      const line = allLines.find((l: any) => l.item_name === 'Unknown Item');
      expect(line).toBeTruthy();
      expect(line.match_status).toBe('unmatched');
      expect(line.item_id).toBeNull();
    });
  });

  // ============================================
  // VMI Order Confirm Workflow Tests
  // ============================================
  describe('VmiSalesOrderService.confirmOrder() workflow', () => {
    beforeEach(() => {
      // Seed portal config
      sqlite.exec(`
        INSERT INTO vmi_portal_config (id, name, portal_url, api_key_encrypted, vendor_id, is_enabled, order_polling_enabled)
        VALUES (1, 'Test Portal', 'https://test-portal.example.com', 'encrypted:test-key', 'V001', 1, 1)
      `);

      // Seed a VMI order with matched lines
      sqlite.exec(`
        INSERT INTO vmi_sales_orders (id, portal_id, vmi_order_id, vmi_status, local_status, vmi_customer_id, vmi_customer_name, order_date, total_amount, order_data_json)
        VALUES (1, 1, '5001', 'submitted', 'pending', 'HOSP001', 'Test Hospital', '2026-03-10', 15000, '{"id":5001}')
      `);

      sqlite.exec(`
        INSERT INTO vmi_sales_order_lines (id, vmi_sales_order_id, item_id, vmi_line_id, tpp_code, item_name, quantity, unit, unit_price, line_total, match_status)
        VALUES
          (1, 1, 1, '101', '1234567890123', 'ฟ้าทะลายโจร', 50, 'box', 150, 7500, 'matched'),
          (2, 1, 2, '102', '9876543210123', 'ขมิ้นชัน', 20, 'box', 375, 7500, 'matched')
      `);
    });

    it('should create a real sales order when confirming VMI order', async () => {
      // Mock the portal PATCH notification (always succeeds)
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      const service = new VmiSalesOrderService();
      const result = await service.confirmOrder(1, { userId: TEST_USER_ID });

      // Verify sales order was created
      expect(result.salesOrder.id).toBeGreaterThan(0);
      expect(result.salesOrder.soNumber).toMatch(/^SO-\d{6}-\d{4}$/);
      expect(result.salesOrder.status).toBe('confirmed');

      // Verify the SO record in DB
      const so = sqlite.prepare('SELECT * FROM sales_orders WHERE id = ?').get(result.salesOrder.id) as any;
      expect(so.status).toBe('confirmed');
      expect(so.source).toBe('vmi');
      expect(so.vmi_sales_order_id).toBe(1);
      expect(so.customer_name).toBe('Test Hospital');

      // Verify SO lines
      const soLines = sqlite.prepare('SELECT * FROM sales_order_lines WHERE so_id = ? ORDER BY id').all(result.salesOrder.id) as any[];
      expect(soLines).toHaveLength(2);
      expect(soLines[0].item_id).toBe(1);
      expect(soLines[0].quantity).toBe(50);
      expect(soLines[0].unit_price).toBe(150);
      expect(soLines[1].item_id).toBe(2);
      expect(soLines[1].quantity).toBe(20);
      expect(soLines[1].unit_price).toBe(375);
    });

    it('should update VMI order status to confirmed', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      const service = new VmiSalesOrderService();
      await service.confirmOrder(1, { userId: TEST_USER_ID });

      const vmiOrder = sqlite.prepare('SELECT * FROM vmi_sales_orders WHERE id = 1').get() as any;
      expect(vmiOrder.vmi_status).toBe('confirmed');
      expect(vmiOrder.local_status).toBe('confirmed');
      expect(vmiOrder.confirmed_at).toBeTruthy();
      expect(vmiOrder.sales_order_id).toBeGreaterThan(0);
    });

    it('should notify VMI Portal with PATCH request', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      const service = new VmiSalesOrderService();
      await service.confirmOrder(1, { userId: TEST_USER_ID });

      // Verify the PATCH call to portal
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://test-portal.example.com/api/external/vendor/orders/5001');
      expect(options.method).toBe('PATCH');
      const body = JSON.parse(options.body);
      expect(body.action).toBe('confirm');
    });

    it('should succeed even if portal notification fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection timeout'));

      const service = new VmiSalesOrderService();
      const result = await service.confirmOrder(1, { userId: TEST_USER_ID });

      // Should still succeed — portal notification is non-blocking
      expect(result.salesOrder.id).toBeGreaterThan(0);
      expect(result.salesOrder.status).toBe('confirmed');
    });

    it('should reject confirm when lines are unmatched', async () => {
      // Update a line to unmatched
      sqlite.exec(`UPDATE vmi_sales_order_lines SET match_status = 'unmatched', item_id = NULL WHERE id = 2`);

      const service = new VmiSalesOrderService();
      await expect(service.confirmOrder(1, { userId: TEST_USER_ID })).rejects.toThrow(/not matched|unmatched/i);
    });

    it('should reject confirm for non-existent order', async () => {
      const service = new VmiSalesOrderService();
      await expect(service.confirmOrder(999, { userId: TEST_USER_ID })).rejects.toThrow(/not found/i);
    });
  });

  // ============================================
  // VMI Order Ship Workflow Tests
  // ============================================
  describe('VmiSalesOrderService.shipOrder()', () => {
    beforeEach(() => {
      sqlite.exec(`
        INSERT INTO vmi_portal_config (id, name, portal_url, api_key_encrypted, vendor_id, is_enabled, order_polling_enabled)
        VALUES (1, 'Test Portal', 'https://test-portal.example.com', 'encrypted:test-key', 'V001', 1, 1)
      `);

      // Seed a confirmed VMI order
      sqlite.exec(`
        INSERT INTO vmi_sales_orders (id, portal_id, vmi_order_id, vmi_status, local_status, vmi_customer_id, vmi_customer_name, order_date, total_amount, order_data_json, sales_order_id, confirmed_at)
        VALUES (1, 1, '5001', 'confirmed', 'confirmed', 'HOSP001', 'Test Hospital', '2026-03-10', 15000, '{"id":5001}', 100, '2026-03-10T10:00:00Z')
      `);

      sqlite.exec(`
        INSERT INTO vmi_sales_order_lines (id, vmi_sales_order_id, item_id, vmi_line_id, tpp_code, item_name, quantity, unit, unit_price, line_total, match_status)
        VALUES (1, 1, 1, '101', '1234567890123', 'ฟ้าทะลายโจร', 50, 'box', 150, 7500, 'matched')
      `);
    });

    it('should mark order as shipped and notify portal', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      const service = new VmiSalesOrderService();
      const result = await service.shipOrder(1, { shipmentDate: '2026-03-15', expectedDeliveryDate: '2026-03-20' });

      expect(result.message).toContain('shipped');

      // Verify DB update
      const vmiOrder = sqlite.prepare('SELECT * FROM vmi_sales_orders WHERE id = 1').get() as any;
      expect(vmiOrder.vmi_status).toBe('shipped');
      expect(vmiOrder.local_status).toBe('shipped');
      expect(vmiOrder.shipped_at).toBeTruthy();

      // Verify PATCH to portal with ship action
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/orders/5001');
      expect(options.method).toBe('PATCH');
      const body = JSON.parse(options.body);
      expect(body.action).toBe('ship');
      expect(body.expectedDeliveryDate).toBe('2026-03-20');
    });

    it('should reject shipping non-confirmed order', async () => {
      // Change status to pending
      sqlite.exec(`UPDATE vmi_sales_orders SET local_status = 'pending' WHERE id = 1`);

      const service = new VmiSalesOrderService();
      await expect(service.shipOrder(1, { shipmentDate: '2026-03-15', expectedDeliveryDate: '2026-03-20' })).rejects.toThrow(/confirmed/i);
    });
  });

  // ============================================
  // Full Workflow: Poll -> Match -> Confirm -> Ship
  // ============================================
  describe('Full VMI Order Workflow', () => {
    beforeEach(() => {
      sqlite.exec(`
        INSERT INTO vmi_portal_config (id, name, portal_url, api_key_encrypted, vendor_id, is_enabled, order_polling_enabled)
        VALUES (1, 'BMS Portal', 'https://vmi-portal.example.com', 'encrypted:key', 'V001', 1, 1)
      `);
    });

    it('should complete poll -> confirm -> ship workflow', async () => {
      // Step 1: Poll — mock API returns one order
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            orders: [
              { id: 8001, hospitalCode: 'HOSP001', hospitalName: 'Test Hospital', poNumber: 'PO-2026-100', status: 'submitted', orderDate: '2026-03-11', expectedDeliveryDate: '2026-03-21', totalValue: '7500', itemCount: 1 },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            order: {
              id: 8001, hospitalCode: 'HOSP001', hospitalName: 'Test Hospital', poNumber: 'PO-2026-100', status: 'submitted', orderDate: '2026-03-11', expectedDeliveryDate: '2026-03-21', totalValue: '7500', itemCount: 1,
              items: [
                { id: 1, localCode: 'FG-001', name: 'ฟ้าทะลายโจรแคปซูล', unit: 'box', tppCode: '1234567890123', ttmtCode: 'A12345678', quantityOrdered: '50', unitPrice: '150', lineTotal: '7500' },
              ],
            },
          }),
        });

      const service = new VmiSalesOrderService();
      const pollResult = await service.pollOrders();

      expect(pollResult.ordersReceived).toBe(1);
      const vmiOrderId = pollResult.orders[0].id;

      // Verify order is pending with matched items
      const vmiOrder = sqlite.prepare('SELECT * FROM vmi_sales_orders WHERE id = ?').get(vmiOrderId) as any;
      expect(vmiOrder.local_status).toBe('pending');

      const lines = sqlite.prepare('SELECT * FROM vmi_sales_order_lines WHERE vmi_sales_order_id = ?').all(vmiOrderId) as any[];
      expect(lines[0].match_status).toBe('matched');
      expect(lines[0].item_id).toBe(1);

      // Step 2: Confirm — creates sales order
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) }); // Portal PATCH

      const confirmResult = await service.confirmOrder(vmiOrderId, { userId: TEST_USER_ID });

      expect(confirmResult.salesOrder.soNumber).toMatch(/^SO-\d{6}-\d{4}$/);
      expect(confirmResult.salesOrder.status).toBe('confirmed');

      // Verify SO in DB
      const so = sqlite.prepare('SELECT * FROM sales_orders WHERE id = ?').get(confirmResult.salesOrder.id) as any;
      expect(so.source).toBe('vmi');
      expect(so.status).toBe('confirmed');
      expect(so.customer_name).toBe('Test Hospital');

      // Step 3: Ship — mark as shipped
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) }); // Portal PATCH

      const shipResult = await service.shipOrder(vmiOrderId, { shipmentDate: '2026-03-16', expectedDeliveryDate: '2026-03-21' });
      expect(shipResult.message).toContain('shipped');

      // Verify final state
      const finalOrder = sqlite.prepare('SELECT * FROM vmi_sales_orders WHERE id = ?').get(vmiOrderId) as any;
      expect(finalOrder.vmi_status).toBe('shipped');
      expect(finalOrder.local_status).toBe('shipped');
      expect(finalOrder.confirmed_at).toBeTruthy();
      expect(finalOrder.shipped_at).toBeTruthy();
    });
  });
});
