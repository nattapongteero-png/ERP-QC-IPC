/**
 * Quotation service tests (list items 1a–1d).
 * Covers create + number generation, get/list, update, and convert-to-SO.
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

import {
  createQuotation,
  getQuotation,
  listQuotations,
  updateQuotation,
  deleteQuotation,
  convertQuotationToSalesOrder,
  generateQuotationNumber,
} from '@/lib/services/quotation.service';

const USER_ID = 1;
const ITEM_ID = 1;

function seedBaseData() {
  sqlite.exec(`INSERT INTO users (id, email, password, name, role, is_active)
    VALUES (${USER_ID}, 'test@test.com', 'hash', 'Test User', 'admin', 1)`);
  sqlite.exec(`INSERT INTO items (id, code, name_th, type, primary_unit, on_hand, on_hand_cost, is_active)
    VALUES (${ITEM_ID}, 'FG-001', 'Finished Good 1', 'finished_goods', 'box', 100, 5000, 1)`);
}

function cleanTables() {
  for (const t of ['quotation_lines', 'quotations', 'sales_order_lines', 'sales_orders', 'items', 'users']) {
    try { sqlite.exec(`DELETE FROM ${t}`); } catch { /* table may not exist */ }
  }
}

describe('Quotation Service', () => {
  beforeAll(() => {
    sqlite = new Database(':memory:');
    sqlite.exec('PRAGMA journal_mode = WAL');
    testDb = drizzle(sqlite, { schema });

    const tables = [
      schema.sqliteUsers, schema.sqliteItems, schema.sqliteCustomers,
      schema.sqliteInventoryLots, schema.sqliteWarehouses,
      schema.sqliteSalesOrders, schema.sqliteSalesOrderLines,
      schema.sqliteQuotations, schema.sqliteQuotationLines,
    ];
    for (const table of tables) {
      try { sqlite.exec(generateCreateTableSql(table)); } catch { /* skip */ }
    }
  });

  afterAll(() => { sqlite.close(); });

  beforeEach(() => {
    cleanTables();
    seedBaseData();
  });

  const sampleCreate = () => ({
    customerName: 'โรงพยาบาลตัวอย่าง',
    customerContact: '02-123-4567',
    lines: [
      { itemId: ITEM_ID, itemCode: 'FG-001', description: 'ยาสมุนไพร', quantity: 10, unit: 'box', unitPrice: 250 },
      { description: 'ค่าบริการจัดส่ง (free text)', quantity: 1, unit: 'ครั้ง', unitPrice: 500 },
    ],
  });

  it('creates a quotation with a sequential QT number and computes the total', async () => {
    const { id, quotationNumber } = await createQuotation(sampleCreate(), USER_ID);
    expect(id).toBeGreaterThan(0);
    expect(quotationNumber).toMatch(/^QT\d{4}-0001$/);

    const q = await getQuotation(id);
    expect(q).not.toBeNull();
    expect(q!.customerName).toBe('โรงพยาบาลตัวอย่าง');
    expect(q!.status).toBe('draft');
    // 10*250 + 1*500 = 3000
    expect(q!.totalAmount).toBe(3000);
    expect(q!.lines).toHaveLength(2);
    expect(q!.lines[0].totalPrice).toBe(2500);
  });

  it('increments the document number for the next quotation', async () => {
    await createQuotation(sampleCreate(), USER_ID);
    const second = await createQuotation(sampleCreate(), USER_ID);
    expect(second.quotationNumber).toMatch(/^QT\d{4}-0002$/);

    const next = await generateQuotationNumber();
    expect(next).toMatch(/^QT\d{4}-0003$/);
  });

  it('lists quotations newest-first and filters by status', async () => {
    const a = await createQuotation(sampleCreate(), USER_ID);
    const b = await createQuotation(sampleCreate(), USER_ID);

    const all = await listQuotations();
    expect(all[0].id).toBe(b.id); // newest first
    expect(all).toHaveLength(2);

    await updateQuotation(a.id, { status: 'sent' });
    const sent = await listQuotations({ status: 'sent' });
    expect(sent).toHaveLength(1);
    expect(sent[0].id).toBe(a.id);
  });

  it('updates header fields', async () => {
    const { id } = await createQuotation(sampleCreate(), USER_ID);
    await updateQuotation(id, { status: 'accepted', paymentTerms: 'เครดิต 30 วัน' });
    const q = await getQuotation(id);
    expect(q!.status).toBe('accepted');
    expect(q!.paymentTerms).toBe('เครดิต 30 วัน');
  });

  it('deletes a quotation and its lines', async () => {
    const { id } = await createQuotation(sampleCreate(), USER_ID);
    await deleteQuotation(id);
    expect(await getQuotation(id)).toBeNull();
  });

  it('converts an accepted quotation into a sales order (only item-linked lines)', async () => {
    const { id } = await createQuotation(sampleCreate(), USER_ID);
    await updateQuotation(id, { status: 'accepted' });

    const { soId } = await convertQuotationToSalesOrder(id, USER_ID);
    expect(soId).toBeGreaterThan(0);

    // Quotation is now marked converted and linked to the SO.
    const q = await getQuotation(id);
    expect(q!.status).toBe('converted');
    expect(q!.soId).toBe(soId);

    // Only the item-linked line (not the free-text one) became an SO line.
    const soLines = sqlite
      .query('SELECT * FROM sales_order_lines WHERE so_id = ?')
      .all(soId);
    expect(soLines).toHaveLength(1);
  });

  it('converting twice is idempotent (returns the same SO)', async () => {
    const { id } = await createQuotation(sampleCreate(), USER_ID);
    const first = await convertQuotationToSalesOrder(id, USER_ID);
    const second = await convertQuotationToSalesOrder(id, USER_ID);
    expect(second.soId).toBe(first.soId);
  });

  it('refuses to convert a quotation with no item-linked lines', async () => {
    const { id } = await createQuotation(
      {
        customerName: 'ลูกค้าบริการล้วน',
        lines: [{ description: 'ค่าที่ปรึกษา', quantity: 1, unit: 'งาน', unitPrice: 5000 }],
      },
      USER_ID,
    );
    await expect(convertQuotationToSalesOrder(id, USER_ID)).rejects.toThrow();
  });
});
