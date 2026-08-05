/**
 * POST /api/sales/vmi-orders/[orderId]/lines/[lineId]/match — regression tests
 *
 * Bug (UAT 2026-08-05): matching a line 500'd with
 *   "Failed query: update `vmi_sales_order_lines` set `unit_price` = ?, `line_total` = ?
 *    where `vmi_sales_order_lines`.`id` = ? — params: ,,24"
 *
 * Two defects in one UPDATE:
 *   1. The route set `matchedItemId` / `matchMethod`, which are NOT columns of
 *      vmi_sales_order_lines (the real ones are item_id / match_status). Drizzle
 *      silently drops unknown keys — so the match was never persisted, which is
 *      why the generated SQL contains only unit_price and line_total.
 *   2. It overwrote unit_price / line_total with the local item's sellingPrice.
 *      That column is NULL for most items, and both line columns are NOT NULL,
 *      so the write blew up. Portal pricing must not be overwritten anyway.
 *
 * Runs against real in-memory SQLite with the real schema, so the NOT NULL
 * constraint is live — the pre-fix route fails this suite.
 *
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import * as schema from '@/lib/db/schema';
import { generateCreateTableSql } from '../../../helpers/schema-sync';
import { createTestSqlite, type TestSqliteClient } from '../../../helpers/sqlite-test-db';

let sqlite: TestSqliteClient;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let testDb: any;
let closeDb: () => void;

vi.mock('@/lib/db', () => ({
  isSqlite: () => true,
  getDb: async () => testDb,
  getSqliteDb: () => testDb,
  getMysqlDb: async () => testDb,
  db: () => testDb,
  markSchemaSynced: () => {},
}));

const mockSession = vi.fn();
vi.mock('@/lib/auth', () => ({
  getSession: () => mockSession(),
  isAdminRole: (role: string) => role === 'admin' || role === 'ADMIN',
  hasPermission: () => true,
}));

const mockAuditLog = vi.fn<(entry: Record<string, unknown>) => Promise<void>>();
vi.mock('@/lib/audit', () => ({
  createAuditLog: (entry: Record<string, unknown>) => mockAuditLog(entry),
}));

vi.mock('@/lib/crypto/encrypt', () => ({
  decrypt: vi.fn(() => 'test-api-key'),
  encrypt: vi.fn((v: string) => `encrypted:${v}`),
}));

// sales.service <-> accounting.service form an import cycle that leaves the
// route's own module bindings undefined when pulled in for real. Same mocks the
// existing VMI service integration test uses.
vi.mock('@/lib/services/accounting.service', () => ({
  createSOShipmentJournalEntry: vi.fn(() => Promise.resolve({})),
  createARInvoiceFromSOShipment: vi.fn(() => Promise.resolve({})),
  THAI_VAT_RATE: 0.07,
}));

vi.mock('@/lib/services/unit-cost.service', () => ({
  calculateCOGS: vi.fn(() =>
    Promise.resolve({ totalCost: 0, unitCost: 0, marginAmount: 0, marginPercent: 0 }),
  ),
  updateSOLineWithCOGS: vi.fn(() => Promise.resolve()),
}));

import { POST } from '@/app/api/sales/vmi-orders/[orderId]/lines/[lineId]/match/route';

const ORDER_ID = 21;
const LINE_ID = 24;
const ITEM_ID = 2; // FG-002 — selling_price is NULL, exactly like the UAT item

function makeReq(itemId: number): NextRequest {
  return new NextRequest(
    `http://localhost/api/sales/vmi-orders/${ORDER_ID}/lines/${LINE_ID}/match`,
    { method: 'POST', body: JSON.stringify({ itemId, userId: 7 }) },
  );
}

function callRoute(itemId: number, orderId = ORDER_ID, lineId = LINE_ID) {
  return POST(makeReq(itemId), {
    params: Promise.resolve({ orderId: String(orderId), lineId: String(lineId) }),
  });
}

const readLine = () =>
  sqlite.prepare('SELECT * FROM vmi_sales_order_lines WHERE id = ?').get(LINE_ID) as Record<
    string,
    unknown
  >;

describe('POST /api/sales/vmi-orders/[orderId]/lines/[lineId]/match', () => {
  beforeAll(async () => {
    ({ sqlite, db: testDb, close: closeDb } = await createTestSqlite());

    for (const table of [
      schema.sqliteUsers,
      schema.sqliteCustomers,
      schema.sqliteItems,
      schema.sqliteVmiPortalConfig,
      schema.sqliteVmiSalesOrders,
      schema.sqliteVmiSalesOrderLines,
    ]) {
      sqlite.exec(generateCreateTableSql(table));
    }
  });

  afterAll(() => closeDb());

  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.mockResolvedValue({ userId: 7, email: 'sales@test.com', role: 'sales', name: 'Sales' });

    sqlite.exec('DELETE FROM vmi_sales_order_lines');
    sqlite.exec('DELETE FROM vmi_sales_orders');
    sqlite.exec('DELETE FROM vmi_portal_config');
    sqlite.exec('DELETE FROM items');
    sqlite.exec('DELETE FROM users');

    sqlite.exec(`
      INSERT INTO users (id, email, password, name, role, is_active)
      VALUES (7, 'sales@test.com', 'hash', 'Sales User', 'sales', 1)
    `);

    // selling_price left NULL on purpose — that is the production state that
    // made the old route write NULL into two NOT NULL columns.
    sqlite.exec(`
      INSERT INTO items (id, code, name_th, name_en, type, primary_unit, on_hand, on_hand_cost,
                         quarantine_qty, is_lot_controlled, is_fefo, is_active, tpp_code)
      VALUES
        (1, 'FG-001', 'ฟ้าทะลายโจรแคปซูล', 'Andrographis Capsule', 'finished_product', 'box',
         0, 0, 0, 1, 1, 1, '1234567890123'),
        (2, 'FG-002', 'ขมิ้นชันแคปซูล', 'Turmeric Capsule', 'finished_product', 'box',
         0, 0, 0, 1, 1, 1, '9876543210123')
    `);

    sqlite.exec(`
      INSERT INTO vmi_portal_config (id, name, portal_url, api_key_encrypted, vendor_id,
                                     is_enabled, order_polling_enabled)
      VALUES (1, 'Test Portal', 'https://portal.example.com', 'encrypted:key', 'V001', 1, 1)
    `);

    sqlite.exec(`
      INSERT INTO vmi_sales_orders (id, portal_id, vmi_order_id, vmi_status, local_status,
                                    vmi_customer_id, vmi_customer_name, order_date, total_amount,
                                    currency, order_data_json, polled_at)
      VALUES (${ORDER_ID}, 1, 'VMI-9001', 'submitted', 'pending', 'HOSP-001', 'Test Hospital',
              '2026-08-05', 2500, 'THB', '{}', '2026-08-05 09:00:00')
    `);

    sqlite.exec(`
      INSERT INTO vmi_sales_order_lines (id, vmi_sales_order_id, vmi_line_id, item_id, tpp_code,
                                         item_name, quantity, unit, unit_price, line_total, match_status)
      VALUES (${LINE_ID}, ${ORDER_ID}, 'L-1', NULL, '9876543210123',
              'ขมิ้นชันแคปซูล 500mg', 10, 'box', 250, 2500, 'unmatched')
    `);
  });

  it('matches a line to an item whose selling_price is NULL (the UAT 500)', async () => {
    const res = await callRoute(ITEM_ID);
    const body = await res.json();

    expect(body.error).toBeUndefined();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);

    const line = readLine();
    expect(line.item_id).toBe(ITEM_ID);
    expect(line.local_code).toBe('FG-002');
    expect(line.match_status).toBe('manual_mapped');
  });

  it('keeps the portal price — matching must not touch unit_price / line_total', async () => {
    const before = readLine();
    const res = await callRoute(ITEM_ID);
    expect(res.status).toBe(200);

    const after = readLine();
    expect(after.unit_price).toBe(before.unit_price);
    expect(after.line_total).toBe(before.line_total);
    expect(after.unit_price).toBe(250);
    expect(after.line_total).toBe(2500);
  });

  it('still overwrites a wrong auto-match, and never leaves the price NULL', async () => {
    // Line was auto-matched to the wrong item first.
    sqlite
      .prepare('UPDATE vmi_sales_order_lines SET item_id = 1, match_status = ? WHERE id = ?')
      .run('multiple_matches', LINE_ID);

    const res = await callRoute(ITEM_ID);
    expect(res.status).toBe(200);

    const line = readLine();
    expect(line.item_id).toBe(ITEM_ID);
    expect(line.match_status).toBe('manual_mapped');
    expect(line.unit_price).not.toBeNull();
    expect(line.line_total).not.toBeNull();
  });

  it('returns the matched item code and Thai name to the UI', async () => {
    const body = await (await callRoute(ITEM_ID)).json();

    expect(body.data.matchedItemId).toBe(ITEM_ID);
    expect(body.data.matchedItemCode).toBe('FG-002');
    expect(body.data.matchedItemName).toBe('ขมิ้นชันแคปซูล');
    expect(body.data.order.lines[0].matchStatus).toBe('manual_mapped');
  });

  it('audits the change against the signed-in user, not a hardcoded id', async () => {
    await callRoute(ITEM_ID);

    expect(mockAuditLog).toHaveBeenCalledTimes(1);
    const entry = mockAuditLog.mock.calls[0][0];
    expect(entry.userId).toBe(7);
    expect(entry.tableName).toBe('vmi_sales_order_lines');
    expect(entry.recordId).toBe(LINE_ID);
  });

  it('401 when unauthenticated', async () => {
    mockSession.mockResolvedValue(null);
    expect((await callRoute(ITEM_ID)).status).toBe(401);
  });

  it('404 when the item does not exist', async () => {
    const res = await callRoute(999);
    expect(res.status).toBe(404);
    expect(readLine().match_status).toBe('unmatched');
  });

  it('404 when the line does not belong to the order', async () => {
    const res = await callRoute(ITEM_ID, ORDER_ID, 9999);
    expect(res.status).toBe(404);
  });

  it('400 once the order has left pending', async () => {
    sqlite.prepare('UPDATE vmi_sales_orders SET local_status = ? WHERE id = ?').run('confirmed', ORDER_ID);

    const res = await callRoute(ITEM_ID);
    expect(res.status).toBe(400);
    expect(readLine().match_status).toBe('unmatched');
  });
});
