/**
 * Sales Fulfillment Service Tests
 * Tests the shipment/delivery workflow for sales orders
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { getTableName, getTableColumns } from 'drizzle-orm';
import { SQLiteTable } from 'drizzle-orm/sqlite-core';
import * as schema from '@/lib/db/schema';

// Create test database
let sqlite: Database.Database;
let testDb: ReturnType<typeof drizzle>;

// Mock the database module
vi.mock('@/lib/db', async () => {
  return {
    isSqlite: () => true,
    getDb: async () => testDb,
    getSqliteDb: () => testDb,
    db: () => testDb,
    markSchemaSynced: () => {},
    schema,
  };
});

// Mock audit
vi.mock('@/lib/audit', () => ({
  createAuditLog: vi.fn(() => Promise.resolve()),
}));

// Import after mocking
import { fulfillSalesOrderLine, FulfillmentInput } from '@/lib/services/sales.service';
import { receiveMaterial, updateLotStatus } from '@/lib/services/inventory.service';

// Helper for table creation
function generateCreateTableSql(table: SQLiteTable): string {
  const tableName = getTableName(table);
  const columns = getTableColumns(table);
  const columnDefs: string[] = [];

  for (const [, column] of Object.entries(columns)) {
    const col = column as any;
    let def = `"${col.name}" `;
    switch (col.dataType) {
      case 'string': def += 'TEXT'; break;
      case 'number':
        def += col.columnType === 'SQLiteReal' ? 'REAL' : 'INTEGER';
        break;
      default: def += 'TEXT';
    }
    if (col.primary) {
      def += ' PRIMARY KEY';
      if (col.autoIncrement) def += ' AUTOINCREMENT';
    }
    if (col.notNull && !col.primary) def += ' NOT NULL';
    if (col.hasDefault && col.default !== undefined) {
      const defaultVal = typeof col.default === 'string' ? `'${col.default}'` : col.default;
      def += ` DEFAULT ${defaultVal}`;
    }
    if (col.isUnique && !col.primary) def += ' UNIQUE';
    columnDefs.push(def);
  }
  return `CREATE TABLE IF NOT EXISTS "${tableName}" (${columnDefs.join(', ')})`;
}

const TEST_USER_ID = 1;
const FUTURE_DATE = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

describe('Sales Fulfillment Service', () => {
  beforeAll(() => {
    sqlite = new Database(':memory:');
    testDb = drizzle(sqlite);

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
      schema.sqliteSalesDeliveries,
    ];

    for (const table of tables) {
      sqlite.exec(generateCreateTableSql(table));
    }
  });

  afterAll(() => {
    sqlite.close();
  });

  beforeEach(() => {
    sqlite.exec('DELETE FROM sales_deliveries');
    sqlite.exec('DELETE FROM sales_order_lines');
    sqlite.exec('DELETE FROM sales_orders');
    sqlite.exec('DELETE FROM inventory_transactions');
    sqlite.exec('DELETE FROM inventory_lots');
    sqlite.exec('DELETE FROM items');
    sqlite.exec('DELETE FROM warehouses');
    sqlite.exec('DELETE FROM users');

    // Seed base data
    sqlite.exec(`
      INSERT INTO users (id, email, password, name, role, is_active)
      VALUES (1, 'sales@test.com', 'hash', 'Sales User', 'sales', 1)
    `);
    sqlite.exec(`
      INSERT INTO items (id, code, name_th, name_en, type, category, primary_unit, shelf_life_days, on_hand, on_hand_cost, is_lot_controlled, is_fefo, is_active)
      VALUES (1, 'FG-001', 'ฟ้าทะลายโจรแคปซูล', 'Andrographis Capsule', 'finished_product', 'capsule', 'box', 365, 0, 0, 1, 1, 1)
    `);
    sqlite.exec(`
      INSERT INTO warehouses (id, code, name, type, is_active)
      VALUES (1, 'WH-FG', 'Finished Goods Warehouse', 'finished_goods', 1)
    `);
    sqlite.exec(`
      INSERT INTO sales_orders (id, so_number, customer_name, customer_address, status, total_amount, currency, created_by)
      VALUES (1, 'SO-202512-0001', 'Hospital A', '123 Hospital Rd', 'confirmed', 7500, 'THB', 1)
    `);
    sqlite.exec(`
      INSERT INTO sales_order_lines (id, so_id, item_id, quantity, allocated_quantity, shipped_quantity, unit, unit_price, total_price)
      VALUES (1, 1, 1, 50, 0, 0, 'box', 150, 7500)
    `);
  });

  it('should fulfill sales order line with lot deduction', async () => {
    // Create and release lot
    const lotId = await receiveMaterial(1, 'LOT-SHIP-001', 100, 'box', 1, FUTURE_DATE, null, null, TEST_USER_ID);
    await updateLotStatus(lotId, 'released', TEST_USER_ID);

    const input: FulfillmentInput = {
      soId: 1,
      soLineId: 1,
      itemId: 1,
      lotId,
      quantity: 30,
      notes: 'First shipment',
    };

    const result = await fulfillSalesOrderLine(input, TEST_USER_ID);

    expect(result.deliveryId).toBeGreaterThan(0);
    expect(result.deliveryNumber).toMatch(/^DL-\d{6}-\d{4}$/);
    expect(result.shippedQuantity).toBe(30);

    // Verify delivery record
    const delivery = sqlite.prepare('SELECT * FROM sales_deliveries WHERE id = ?').get(result.deliveryId) as any;
    expect(delivery.so_id).toBe(1);
    expect(delivery.lot_number).toBe('LOT-SHIP-001');
    expect(delivery.quantity).toBe(30);

    // Verify SO line updated
    const line = sqlite.prepare('SELECT shipped_quantity FROM sales_order_lines WHERE id = 1').get() as any;
    expect(line.shipped_quantity).toBe(30);

    // Verify lot quantity deducted
    const lot = sqlite.prepare('SELECT quantity FROM inventory_lots WHERE id = ?').get(lotId) as any;
    expect(lot.quantity).toBe(70); // 100 - 30
  });

  it('should reject fulfillment if lot has insufficient quantity', async () => {
    const lotId = await receiveMaterial(1, 'LOT-SHORT', 20, 'box', 1, FUTURE_DATE, null, null, TEST_USER_ID);
    await updateLotStatus(lotId, 'released', TEST_USER_ID);

    const input: FulfillmentInput = {
      soId: 1,
      soLineId: 1,
      itemId: 1,
      lotId,
      quantity: 50,
    };

    await expect(fulfillSalesOrderLine(input, TEST_USER_ID))
      .rejects.toThrow(/Insufficient/);
  });

  it('should reject fulfillment exceeding pending quantity', async () => {
    const lotId = await receiveMaterial(1, 'LOT-OVER', 100, 'box', 1, FUTURE_DATE, null, null, TEST_USER_ID);
    await updateLotStatus(lotId, 'released', TEST_USER_ID);

    const input: FulfillmentInput = {
      soId: 1,
      soLineId: 1,
      itemId: 1,
      lotId,
      quantity: 60, // Line only has 50 pending
    };

    await expect(fulfillSalesOrderLine(input, TEST_USER_ID))
      .rejects.toThrow(/exceeds pending/);
  });

  it('should update order status when fully shipped', async () => {
    const lotId = await receiveMaterial(1, 'LOT-FULL', 100, 'box', 1, FUTURE_DATE, null, null, TEST_USER_ID);
    await updateLotStatus(lotId, 'released', TEST_USER_ID);

    const input: FulfillmentInput = {
      soId: 1,
      soLineId: 1,
      itemId: 1,
      lotId,
      quantity: 50, // Ship all 50
    };

    await fulfillSalesOrderLine(input, TEST_USER_ID);

    // Verify order status updated to shipped
    const so = sqlite.prepare('SELECT status FROM sales_orders WHERE id = 1').get() as any;
    expect(so.status).toBe('shipped');
  });
});
