/**
 * VMI Customer Sync tests (sheet item 10).
 *
 * Verifies that ingesting a VMI sales order creates a matching row in the
 * `customers` table (so the hospital shows up in the customer register), and
 * that re-ingesting an order for the SAME hospital is idempotent (no duplicate
 * customer, and the same customerId is reused).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from '@/lib/db/schema';
import { generateCreateTableSql } from '../../helpers/schema-sync';

let sqlite: Database;
let testDb: ReturnType<typeof drizzle>;

vi.mock('@/lib/db', async () => ({
  isSqlite: () => true,
  getDb: async () => testDb,
  getSqliteDb: () => testDb,
  db: () => testDb,
  markSchemaSynced: () => {},
  schema,
}));

vi.mock('@/lib/audit', () => ({
  createAuditLog: vi.fn(() => Promise.resolve()),
  getClientIP: vi.fn(() => '127.0.0.1'),
}));

import { ensureVmiCustomer } from '@/lib/services/vmi-customer-sync.service';
import { processOrderCreated } from '@/lib/services/vmi-webhook-events';

const PORTAL_ID = 7;

function orderPayload(orderId: number, overrides: Record<string, unknown> = {}) {
  return {
    orderId,
    poNumber: `PO-${orderId}`,
    hospitalCode: 'HOSP001',
    hospitalName: 'โรงพยาบาลตัวอย่าง',
    orderDate: '2026-07-21',
    totalValue: '2500.00',
    itemCount: 1,
    items: [
      { localCode: 'FG-001', name: 'ยาสมุนไพร', quantity: 10, unitPrice: '250.00' },
    ],
    ...overrides,
  };
}

const context = {
  webhookId: 1,
  deliveryId: 'delivery-1',
  portalId: PORTAL_ID,
  eventType: 'order.created' as const,
};

function customerRows() {
  return sqlite.query('SELECT id, code, name, customer_type, vmi_customer_id FROM customers').all() as Array<{
    id: number;
    code: string;
    name: string;
    customer_type: string;
    vmi_customer_id: string | null;
  }>;
}

function cleanTables() {
  for (const t of ['vmi_sales_order_lines', 'vmi_sales_orders', 'customers']) {
    try { sqlite.exec(`DELETE FROM ${t}`); } catch { /* table may not exist */ }
  }
}

describe('VMI Customer Sync', () => {
  beforeAll(() => {
    sqlite = new Database(':memory:');
    sqlite.exec('PRAGMA journal_mode = WAL');
    testDb = drizzle(sqlite, { schema });

    const tables = [
      schema.sqliteCustomers,
      schema.sqliteVmiSalesOrders,
      schema.sqliteVmiSalesOrderLines,
    ];
    for (const table of tables) {
      try { sqlite.exec(generateCreateTableSql(table)); } catch { /* skip */ }
    }
  });

  afterAll(() => { sqlite.close(); });

  beforeEach(() => { cleanTables(); });

  it('creates a customer row with vmiCustomerId set when a VMI order is ingested', async () => {
    const result = await processOrderCreated(orderPayload(1001), context);
    expect(result.success).toBe(true);

    const customers = customerRows();
    expect(customers).toHaveLength(1);
    expect(customers[0].vmi_customer_id).toBe('HOSP001');
    expect(customers[0].customer_type).toBe('hospital');
    expect(customers[0].name).toBe('โรงพยาบาลตัวอย่าง');
    expect(customers[0].code).toBe('VMI-HOSP001');

    // The VMI order is linked to the real customer row.
    const [order] = sqlite
      .query('SELECT customer_id, vmi_customer_id FROM vmi_sales_orders')
      .all() as Array<{ customer_id: number | null; vmi_customer_id: string }>;
    expect(order.customer_id).toBe(customers[0].id);
    expect(order.vmi_customer_id).toBe('HOSP001');
  });

  it('does NOT create a duplicate customer when a second order for the same hospital is ingested', async () => {
    await processOrderCreated(orderPayload(1001), context);
    await processOrderCreated(orderPayload(1002), context);

    const customers = customerRows();
    expect(customers).toHaveLength(1);

    // Both orders reference the same customer id.
    const orders = sqlite
      .query('SELECT customer_id FROM vmi_sales_orders ORDER BY id')
      .all() as Array<{ customer_id: number | null }>;
    expect(orders).toHaveLength(2);
    expect(orders[0].customer_id).toBe(customers[0].id);
    expect(orders[1].customer_id).toBe(customers[0].id);
  });

  it('ensureVmiCustomer is idempotent and reuses the same customer id', async () => {
    const first = await ensureVmiCustomer({ hospitalCode: 'HOSP002', hospitalName: 'รพ.สอง' });
    const second = await ensureVmiCustomer({ hospitalCode: 'HOSP002', hospitalName: 'รพ.สอง' });
    expect(second).toBe(first);
    expect(customerRows()).toHaveLength(1);
  });

  it('updates the customer name when the portal renames the hospital', async () => {
    const id = await ensureVmiCustomer({ hospitalCode: 'HOSP003', hospitalName: 'ชื่อเดิม' });
    const again = await ensureVmiCustomer({ hospitalCode: 'HOSP003', hospitalName: 'ชื่อใหม่' });
    expect(again).toBe(id);

    const rows = customerRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('ชื่อใหม่');
  });
});
