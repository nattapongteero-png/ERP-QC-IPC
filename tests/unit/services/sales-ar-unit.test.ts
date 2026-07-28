/**
 * Sales + Accounts Receivable Unit Tests
 *
 * Tests the service-level functions in the Sales-to-Cash flow:
 * 1. Sales Order creation with ATP check
 * 2. AR Invoice CRUD (create, confirm, delete)
 * 3. AR Payment (receipt) recording
 * 4. Journal entry creation during AR confirmation
 * 5. Receipt journal entry (DR Bank, CR AR)
 * 6. Invoice status transitions (draft -> posted -> partial -> paid)
 * 7. GL balance verification at each step
 * 8. Output VAT tracking
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@/lib/db/schema';
import { generateCreateTableSql } from '../../helpers/schema-sync';
import {
  seedGLAccountTypes,
  seedGLAccounts,
  seedFiscalYearAndPeriods,
  seedCustomers,
  ACCT_TEST_IDS,
  verifyTrialBalance,
  getAccountBalance,
} from '../../helpers/seed-accounting';

const { getTestDb, setTestDb } = vi.hoisted(() => {
  let _testDb: any = null;
  return {
    getTestDb: () => _testDb,
    setTestDb: (db: any) => { _testDb = db; },
  };
});

let testSqlite: Database.Database;

vi.mock('@/lib/db', () => ({
  isSqlite: () => true,
  getDb: async () => getTestDb(),
  getSqliteDb: () => getTestDb(),
  schema,
}));

vi.mock('@/lib/audit', () => ({
  createAuditLog: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/lib/services/inventory.service', () => ({
  getLotsForPicking: vi.fn(() => Promise.resolve([])),
  reserveLots: vi.fn(() => Promise.resolve()),
  issueMaterial: vi.fn(() => Promise.resolve()),
  receiveMaterial: vi.fn(() => Promise.resolve(1)),
}));

vi.mock('@/lib/services/unit-cost.service', () => ({
  calculateCOGS: vi.fn(() => Promise.resolve({ unitCost: 50, totalCost: 500, marginAmount: 500, marginPercent: 50 })),
  updateSOLineWithCOGS: vi.fn(() => Promise.resolve()),
  recalculateWAC: vi.fn(() => Promise.resolve({ success: true })),
  updateItemLastPurchase: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/lib/services/matching.service', () => ({
  runMatching: vi.fn(() => Promise.resolve({ success: true, status: 'matched', exceptions: [] })),
}));

import {
  createARInvoice,
  getARInvoiceById,
  listARInvoices,
  confirmARInvoice,
  rejectARInvoice,
  recordARPayment,
  deleteARInvoice,
  createARInvoiceFromSOShipment,
} from '@/lib/services/accounting.service';

import {
  checkATP,
  createSalesOrder,
} from '@/lib/services/sales.service';

const REQUIRED_TABLES = [
  schema.sqliteGLAccountTypes, schema.sqliteGLAccounts,
  schema.sqliteFiscalYears, schema.sqliteFiscalPeriods,
  schema.sqliteJournalEntries, schema.sqliteJournalLines,
  schema.sqliteVendors, schema.sqliteCustomers,
  schema.sqliteAPInvoices, schema.sqliteAPInvoiceLines,
  schema.sqliteARInvoices, schema.sqliteARInvoiceLines,
  schema.sqlitePayments, schema.sqlitePaymentAllocations,
  schema.sqliteVATTransactions, schema.sqliteUsers, schema.sqliteAuditTrail,
  schema.sqliteItems, schema.sqliteWarehouses,
  schema.sqliteInventoryLots, schema.sqliteInventoryTransactions,
  schema.sqliteSalesOrders, schema.sqliteSalesOrderLines, schema.sqliteSalesDeliveries,
  // Holds invoice_requires_accounting_approval, which decides whether a
  // shipment posts its own tax invoice or joins a draft for Accounting.
  schema.sqliteSettings,
];

describe('Sales + AR Unit Tests', () => {
  beforeEach(() => {
    testSqlite = new Database(':memory:');
    testSqlite.pragma('journal_mode = WAL');
    const testDb = drizzle(testSqlite, { schema });
    setTestDb(testDb);

    for (const table of REQUIRED_TABLES) {
      try { testSqlite.exec(generateCreateTableSql(table)); } catch { /* skip */ }
    }

    seedGLAccountTypes(testSqlite);
    seedGLAccounts(testSqlite);
    seedFiscalYearAndPeriods(testSqlite);
    seedCustomers(testSqlite);

    testSqlite.exec("INSERT OR IGNORE INTO users (id, name, email, password, role, is_active) VALUES (1, 'Sales User', 'sales@test.com', 'hash', 'sales', 1)");

    testSqlite.exec(`
      INSERT OR IGNORE INTO items (id, code, name_th, name_en, type, category, primary_unit, is_active, on_hand, on_hand_cost, created_at, updated_at) VALUES
        (20, 'FG-HERB-001', 'ยาสมุนไพร A', 'Herbal Medicine A', 'finished_goods', 'products', 'box', 1, 100, 5000, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (21, 'FG-HERB-002', 'ยาสมุนไพร B', 'Herbal Medicine B', 'finished_goods', 'products', 'bottle', 1, 50, 2500, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    testSqlite.exec("INSERT OR IGNORE INTO warehouses (id, code, name, type, is_active, created_at, updated_at) VALUES (1, 'WH-MAIN', 'Main Warehouse', 'main', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)");

    testSqlite.exec(`
      INSERT OR IGNORE INTO inventory_lots (id, item_id, lot_number, warehouse_id, quantity, reserved_quantity, unit, status, expiry_date, received_date, created_at, updated_at) VALUES
        (100, 20, 'LOT-FG001-001', 1, 80, 10, 'box', 'released', '2027-01-01', '2025-01-01', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (101, 20, 'LOT-FG001-002', 1, 20, 0, 'box', 'released', '2027-06-01', '2025-01-05', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (102, 21, 'LOT-FG002-001', 1, 50, 5, 'bottle', 'released', '2027-03-01', '2025-01-10', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);
  });

  afterEach(() => {
    if (testSqlite) testSqlite.close();
    vi.clearAllMocks();
  });

  async function createTestARInvoice(overrides?: Partial<{
    invoiceNumber: string; taxInvoiceNumber: string; customerId: number;
    lines: Array<{ description: string; glAccountId: number; quantity: number; unitPrice: number }>;
  }>) {
    return createARInvoice({
      invoiceNumber: overrides?.invoiceNumber || 'AR-TEST-001',
      taxInvoiceNumber: overrides?.taxInvoiceNumber || 'T-TEST-001',
      customerId: overrides?.customerId || ACCT_TEST_IDS.CUSTOMER_1,
      invoiceDate: '2025-01-15', dueDate: '2025-02-15',
      lines: overrides?.lines || [
        { description: 'Herbal Medicine sale', glAccountId: ACCT_TEST_IDS.SALES_REVENUE, quantity: 10, unitPrice: 500 },
      ],
    }, 1);
  }

  // ============================================
  // 1. Sales Order & ATP
  // ============================================
  describe('Sales Order & ATP', () => {
    it('should check ATP with sufficient stock', async () => {
      const atp = await checkATP(20, 50);
      expect(atp.itemCode).toBe('FG-HERB-001');
      expect(atp.availableNow).toBe(90); // 100 on-hand - 10 reserved
      expect(atp.canFulfill).toBe(true);
      expect(atp.shortfall).toBe(0);
    });

    it('should detect shortfall', async () => {
      const atp = await checkATP(20, 95);
      expect(atp.canFulfill).toBe(false);
      expect(atp.shortfall).toBe(5);
    });

    it('should calculate ATP breakdown', async () => {
      const atp = await checkATP(21, 10);
      expect(atp.breakdown.onHand).toBe(50);
      expect(atp.breakdown.reserved).toBe(5);
      expect(atp.availableNow).toBe(45);
    });

    it('should throw for non-existent item', async () => {
      await expect(checkATP(9999, 10)).rejects.toThrow('not found');
    });

    it('should create sales order', async () => {
      const result = await createSalesOrder(
        { name: 'Customer Alpha' },
        [{ itemId: 20, quantity: 10, unitPrice: 500, requiredDate: '2025-02-01' }],
        1
      );
      expect(result.orderId).toBeGreaterThan(0);
      expect(result.atpResults).toHaveLength(1);

      const so = testSqlite.prepare('SELECT so_number, customer_name, status, total_amount FROM sales_orders WHERE id = ?').get(result.orderId) as any;
      expect(so.so_number).toMatch(/^SO-/);
      expect(so.customer_name).toBe('Customer Alpha');
      expect(so.status).toBe('draft');
      expect(so.total_amount).toBe(5000);
    });

    it('should create SO with multiple lines', async () => {
      const result = await createSalesOrder(
        { name: 'Customer Beta' },
        [
          { itemId: 20, quantity: 5, unitPrice: 500, requiredDate: '2025-02-01' },
          { itemId: 21, quantity: 3, unitPrice: 800, requiredDate: '2025-02-01' },
        ],
        1
      );
      const lines = testSqlite.prepare('SELECT * FROM sales_order_lines WHERE so_id = ?').all(result.orderId);
      expect(lines).toHaveLength(2);
    });

    it('should reject SO without customer name', async () => {
      await expect(createSalesOrder({ name: '' }, [{ itemId: 20, quantity: 1, unitPrice: 100, requiredDate: '2025-02-01' }], 1)).rejects.toThrow('Customer name');
    });
  });

  // ============================================
  // 2. AR Invoice Creation
  // ============================================
  describe('AR Invoice Creation', () => {
    it('should create with correct VAT', async () => {
      const inv = await createTestARInvoice();
      expect(inv.status).toBe('draft');
      expect(inv.subtotal).toBe(5000);
      expect(inv.vatAmount).toBe(350);
      expect(inv.totalAmount).toBe(5350);
    });

    it('should create with multiple lines', async () => {
      const inv = await createTestARInvoice({
        lines: [
          { description: 'A', glAccountId: ACCT_TEST_IDS.SALES_REVENUE, quantity: 5, unitPrice: 1000 },
          { description: 'B', glAccountId: ACCT_TEST_IDS.SALES_REVENUE, quantity: 10, unitPrice: 200 },
        ],
      });
      expect(inv.lines!).toHaveLength(2);
      expect(inv.subtotal).toBe(7000);
      expect(inv.totalAmount).toBe(7490);
    });

    it('should retrieve by ID', async () => {
      const created = await createTestARInvoice();
      const retrieved = await getARInvoiceById(created.id);
      expect(retrieved.invoiceNumber).toBe('AR-TEST-001');
    });

    it('should list with filter', async () => {
      await createTestARInvoice({ invoiceNumber: 'AR-L1', taxInvoiceNumber: 'T-L1' });
      await createTestARInvoice({ invoiceNumber: 'AR-L2', taxInvoiceNumber: 'T-L2' });
      const list = await listARInvoices({ customerId: ACCT_TEST_IDS.CUSTOMER_1 });
      expect(list.length).toBeGreaterThanOrEqual(2);
    });

    it('should throw for non-existent', async () => {
      await expect(getARInvoiceById(99999)).rejects.toThrow('not found');
    });

    // Freight (list item 16b): the SO's shipping cost is billed exactly once, on
    // the FIRST invoice raised for that order, as a Service-Revenue (4120) line.
    it('bills the order freight once on the first shipment invoice, not on later ones', async () => {
      // A sales order carrying 500 THB of freight.
      testSqlite.exec(`
        INSERT INTO sales_orders (id, so_number, customer_name, status, total_amount, currency, shipping_cost, created_at, updated_at)
        VALUES (9001, 'SO-FREIGHT-1', 'ลูกค้าค่าขนส่ง', 'confirmed', 10000, 'THB', 500, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);

      const shipmentInput = (n: number) => ({
        soId: 9001,
        soNumber: 'SO-FREIGHT-1',
        customerId: ACCT_TEST_IDS.CUSTOMER_1,
        customerName: 'ลูกค้าค่าขนส่ง',
        shipmentDate: '2026-02-01',
        dueDate: '2026-03-03',
        deliveryId: n,
        deliveryNumber: `DL-${n}`,
        itemId: 1,
        itemCode: 'FG-001',
        itemName: 'สินค้า',
        quantity: 1,
        unitPrice: 1000,
        totalAmount: 1070,
        vatAmount: 70,
        netAmount: 1000,
        shippingCost: 500,
      });

      // First shipment → invoice should carry a freight line (2 lines total).
      const first = await createARInvoiceFromSOShipment(shipmentInput(1), 1);
      const firstInv = await getARInvoiceById(first.arInvoiceId);
      const firstFreight = firstInv.lines!.filter((l: any) =>
        String(l.description || '').includes('ค่าขนส่ง'),
      );
      expect(firstFreight).toHaveLength(1);
      expect(Number(firstFreight[0].amount)).toBe(500);

      // Second shipment on the SAME SO → no freight line (freight already billed).
      const second = await createARInvoiceFromSOShipment(shipmentInput(2), 1);
      const secondInv = await getARInvoiceById(second.arInvoiceId);
      const secondFreight = secondInv.lines!.filter((l: any) =>
        String(l.description || '').includes('ค่าขนส่ง'),
      );
      expect(secondFreight).toHaveLength(0);
    });

    // Buyer identification (มาตรา 86/4).
    //
    // Every AR invoice in the local dataset was stored against customer_id = 0
    // because sales_orders carried only a free-text customer_name and the
    // by-name lookup silently returned nothing when the name wasn't an exact
    // match. A tax invoice with no identifiable buyer cannot be used by the
    // customer to claim input VAT and fails a Revenue Department check, so the
    // service must refuse to issue one rather than write the 0 sentinel.
    it('stores the real customer id when the caller supplies it', async () => {
      testSqlite.exec(`
        INSERT INTO sales_orders (id, so_number, customer_name, status, total_amount, currency, shipping_cost, created_at, updated_at)
        VALUES (9101, 'SO-BUYER-OK', 'ลูกค้าทดสอบ 1', 'confirmed', 1000, 'THB', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);

      const res = await createARInvoiceFromSOShipment(
        {
          soId: 9101,
          soNumber: 'SO-BUYER-OK',
          customerId: ACCT_TEST_IDS.CUSTOMER_1,
          customerName: 'ลูกค้าทดสอบ 1',
          shipmentDate: '2026-02-01',
          dueDate: '2026-03-03',
          deliveryId: 101,
          deliveryNumber: 'DL-101',
          itemId: 1,
          itemCode: 'FG-001',
          itemName: 'สินค้า',
          quantity: 1,
          unitPrice: 1000,
          totalAmount: 1070,
          vatAmount: 70,
          netAmount: 1000,
        },
        1,
      );

      const inv = await getARInvoiceById(res.arInvoiceId);
      expect(inv.customerId).toBe(ACCT_TEST_IDS.CUSTOMER_1);
      expect(inv.customerId).not.toBe(0); // the sentinel this fix removes
    });

    it('REFUSES to issue a tax invoice when the buyer cannot be identified', async () => {
      testSqlite.exec(`
        INSERT INTO sales_orders (id, so_number, customer_name, status, total_amount, currency, shipping_cost, created_at, updated_at)
        VALUES (9102, 'SO-BUYER-UNKNOWN', 'ลูกค้าที่ไม่มีในทะเบียน', 'confirmed', 1000, 'THB', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);

      await expect(
        createARInvoiceFromSOShipment(
          {
            soId: 9102,
            soNumber: 'SO-BUYER-UNKNOWN',
            // No customerId, and the name matches no customer record.
            customerName: 'ลูกค้าที่ไม่มีในทะเบียน',
            shipmentDate: '2026-02-01',
            dueDate: '2026-03-03',
            deliveryId: 102,
            deliveryNumber: 'DL-102',
            itemId: 1,
            itemCode: 'FG-001',
            itemName: 'สินค้า',
            quantity: 1,
            unitPrice: 1000,
            totalAmount: 1070,
            vatAmount: 70,
            netAmount: 1000,
          },
          1,
        ),
      ).rejects.toThrow(/ไม่พบลูกค้า/);
    });
  });

  // ============================================
  // Accounting-gated invoicing + consolidation
  // ============================================
  //
  // Two behaviours, one switch. With the gate ON the invoice stays a draft for
  // Accounting to confirm — and because a draft can still be amended (a posted
  // one cannot, without reversing its journal entry), a second shipment on the
  // same order and the same day joins it instead of minting a second
  // ใบกำกับภาษี. A customer who ordered several items and received them
  // together gets ONE tax invoice, not one per delivery line.
  describe('accounting-gated invoicing (invoice_requires_accounting_approval)', () => {
    const shipment = (n: number, itemCode: string) => ({
      soId: 9200,
      soNumber: 'SO-GATE-1',
      customerId: ACCT_TEST_IDS.CUSTOMER_1,
      customerName: 'ลูกค้าทดสอบ 1',
      shipmentDate: '2026-02-10',
      dueDate: '2026-03-12',
      deliveryId: n,
      deliveryNumber: `DL-G${n}`,
      itemId: 1,
      itemCode,
      itemName: 'สินค้า',
      quantity: 1,
      unitPrice: 1000,
      totalAmount: 1070,
      vatAmount: 70,
      netAmount: 1000,
    });

    beforeEach(() => {
      testSqlite.exec(`
        INSERT INTO sales_orders (id, so_number, customer_name, status, total_amount, currency, shipping_cost, created_at, updated_at)
        VALUES (9200, 'SO-GATE-1', 'ลูกค้าทดสอบ 1', 'confirmed', 2000, 'THB', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);
    });

    const enableGate = (on: boolean) => {
      testSqlite.exec(`
        INSERT INTO settings ("key", value, description, category, created_at, updated_at)
        VALUES ('invoice_requires_accounting_approval', '${on}', 'test', 'accounting', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);
    };

    it('OFF (default): each shipment posts its own tax invoice — unchanged behaviour', async () => {
      const a = await createARInvoiceFromSOShipment(shipment(201, 'FG-A'), 1);
      const b = await createARInvoiceFromSOShipment(shipment(202, 'FG-B'), 1);

      expect(a.arInvoiceId).not.toBe(b.arInvoiceId);
      expect(a.taxInvoiceNumber).not.toBe(b.taxInvoiceNumber);

      // Both posted straight away.
      expect((await getARInvoiceById(a.arInvoiceId)).status).toBe('posted');
      expect((await getARInvoiceById(b.arInvoiceId)).status).toBe('posted');
    });

    it('ON: two same-day shipments share ONE draft tax invoice', async () => {
      enableGate(true);

      const a = await createARInvoiceFromSOShipment(shipment(203, 'FG-A'), 1);
      const b = await createARInvoiceFromSOShipment(shipment(204, 'FG-B'), 1);

      // Same document — no second tax-invoice number burned.
      expect(b.arInvoiceId).toBe(a.arInvoiceId);
      expect(b.taxInvoiceNumber).toBe(a.taxInvoiceNumber);

      const inv = await getARInvoiceById(a.arInvoiceId);
      expect(inv.status).toBe('draft');          // waiting on Accounting
      expect(inv.journalEntryId).toBeFalsy();    // nothing posted yet
      expect(inv.lines!.length).toBe(2);         // both shipments on one invoice
    });

    it('ON: Accounting confirming the draft posts it once, and it balances', async () => {
      enableGate(true);

      const a = await createARInvoiceFromSOShipment(shipment(205, 'FG-A'), 1);
      await createARInvoiceFromSOShipment(shipment(206, 'FG-B'), 1);

      const posted = await confirmARInvoice(a.arInvoiceId, 1);
      expect(posted.status).toBe('posted');
      expect(posted.journalEntryId).toBeTruthy();
      expect(verifyTrialBalance(testSqlite).isBalanced).toBe(true);
    });

    it('ON: a DIFFERENT delivery date gets its own invoice (separate tax point)', async () => {
      enableGate(true);

      const day1 = await createARInvoiceFromSOShipment(shipment(207, 'FG-A'), 1);
      const day2 = await createARInvoiceFromSOShipment(
        { ...shipment(208, 'FG-B'), shipmentDate: '2026-02-11' },
        1,
      );

      expect(day2.arInvoiceId).not.toBe(day1.arInvoiceId);
    });
  });

  // ============================================
  // 3. AR Invoice Confirmation
  // ============================================
  describe('AR Invoice Confirmation', () => {
    it('should confirm and create journal entry', async () => {
      const inv = await createTestARInvoice();
      const confirmed = await confirmARInvoice(inv.id, 1);
      expect(confirmed.status).toBe('posted');
      expect(confirmed.journalEntryId).toBeDefined();
    });

    // Approval rejection (list item 2)
    it('rejects a draft invoice with a reason and posts nothing to the GL', async () => {
      const inv = await createTestARInvoice();
      const rejected = await rejectARInvoice(inv.id, 'ราคาผิด ต้องแก้ก่อน', 7);
      expect(rejected.status).toBe('rejected');
      expect(rejected.rejectionReason).toBe('ราคาผิด ต้องแก้ก่อน');
      expect(rejected.rejectedBy).toBe(7);
      expect(rejected.journalEntryId).toBeNull(); // never posted
    });

    it('requires a non-empty reason to reject', async () => {
      const inv = await createTestARInvoice();
      await expect(rejectARInvoice(inv.id, '   ', 1)).rejects.toThrow();
    });

    it('cannot reject an already-posted invoice', async () => {
      const inv = await createTestARInvoice();
      await confirmARInvoice(inv.id, 1);
      await expect(rejectARInvoice(inv.id, 'too late', 1)).rejects.toThrow();
    });

    it('should create correct JE lines (DR AR, CR Revenue, CR VAT)', async () => {
      const inv = await createTestARInvoice();
      await confirmARInvoice(inv.id, 1);

      const lines = testSqlite.prepare(`
        SELECT jl.gl_account_id, jl.debit, jl.credit FROM journal_lines jl
        JOIN journal_entries je ON jl.journal_entry_id = je.id WHERE je.source_id = ?
      `).all(inv.id) as Array<{ gl_account_id: number; debit: number; credit: number }>;

      expect(lines.find(l => l.gl_account_id === ACCT_TEST_IDS.AR_DOMESTIC)!.debit).toBe(5350);
      expect(lines.find(l => l.gl_account_id === ACCT_TEST_IDS.SALES_REVENUE)!.credit).toBe(5000);
      expect(lines.find(l => l.gl_account_id === ACCT_TEST_IDS.OUTPUT_VAT)!.credit).toBe(350);
    });

    it('should auto-post journal entry', async () => {
      const inv = await createTestARInvoice();
      const confirmed = await confirmARInvoice(inv.id, 1);
      const je = testSqlite.prepare('SELECT status FROM journal_entries WHERE id = ?').get(confirmed.journalEntryId) as any;
      expect(je.status).toBe('posted');
    });

    it('should create output VAT transaction', async () => {
      const inv = await createTestARInvoice();
      await confirmARInvoice(inv.id, 1);
      const vatTx = testSqlite.prepare('SELECT * FROM vat_transactions WHERE ar_invoice_id = ?').get(inv.id) as any;
      expect(vatTx.transaction_type).toBe('output');
      expect(Number(vatTx.vat_amount)).toBe(350);
    });

    it('should maintain balanced trial balance', async () => {
      const inv = await createTestARInvoice();
      await confirmARInvoice(inv.id, 1);
      expect(verifyTrialBalance(testSqlite).isBalanced).toBe(true);
    });

    it('should reject confirming non-draft', async () => {
      const inv = await createTestARInvoice();
      await confirmARInvoice(inv.id, 1);
      await expect(confirmARInvoice(inv.id, 1)).rejects.toThrow("status 'posted'");
    });
  });

  // ============================================
  // 4. AR Payment (Receipt)
  // ============================================
  describe('AR Payment (Receipt)', () => {
    it('should record full receipt', async () => {
      const inv = await createTestARInvoice();
      await confirmARInvoice(inv.id, 1);
      const { payment, invoice: paid } = await recordARPayment(inv.id, { paymentDate: '2025-02-01', bankAccountId: ACCT_TEST_IDS.BANK, paymentMethod: 'transfer', amount: 5350 }, 1);
      expect(payment.paymentNumber).toMatch(/^RC-/);
      expect(paid.status).toBe('paid');
      expect(paid.paidAmount).toBe(5350);
    });

    it('should support partial receipts', async () => {
      const inv = await createTestARInvoice();
      await confirmARInvoice(inv.id, 1);
      const { invoice: p1 } = await recordARPayment(inv.id, { paymentDate: '2025-01-20', bankAccountId: ACCT_TEST_IDS.BANK, paymentMethod: 'transfer', amount: 3000 }, 1);
      expect(p1.status).toBe('partial');
      const { invoice: p2 } = await recordARPayment(inv.id, { paymentDate: '2025-01-25', bankAccountId: ACCT_TEST_IDS.BANK, paymentMethod: 'transfer', amount: 2350 }, 1);
      expect(p2.status).toBe('paid');
    });

    it('should create receipt JE (DR Bank, CR AR)', async () => {
      const inv = await createTestARInvoice();
      await confirmARInvoice(inv.id, 1);
      const { payment } = await recordARPayment(inv.id, { paymentDate: '2025-02-01', bankAccountId: ACCT_TEST_IDS.BANK, paymentMethod: 'transfer', amount: 5350 }, 1);

      const lines = testSqlite.prepare('SELECT gl_account_id, debit, credit FROM journal_lines WHERE journal_entry_id = ?').all(payment.journalEntryId) as Array<{ gl_account_id: number; debit: number; credit: number }>;
      expect(lines.find(l => l.gl_account_id === ACCT_TEST_IDS.BANK)!.debit).toBe(5350);
      expect(lines.find(l => l.gl_account_id === ACCT_TEST_IDS.AR_DOMESTIC)!.credit).toBe(5350);
    });

    it('should reject exceeding outstanding', async () => {
      const inv = await createTestARInvoice();
      await confirmARInvoice(inv.id, 1);
      await expect(recordARPayment(inv.id, { paymentDate: '2025-02-01', bankAccountId: ACCT_TEST_IDS.BANK, paymentMethod: 'transfer', amount: 99999 }, 1)).rejects.toThrow('exceeds outstanding');
    });

    it('should reject receipt for draft', async () => {
      const inv = await createTestARInvoice();
      await expect(recordARPayment(inv.id, { paymentDate: '2025-02-01', bankAccountId: ACCT_TEST_IDS.BANK, paymentMethod: 'transfer', amount: 5350 }, 1)).rejects.toThrow("status 'draft'");
    });

    it('should maintain balanced trial balance', async () => {
      const inv = await createTestARInvoice();
      await confirmARInvoice(inv.id, 1);
      await recordARPayment(inv.id, { paymentDate: '2025-02-01', bankAccountId: ACCT_TEST_IDS.BANK, paymentMethod: 'transfer', amount: 5350 }, 1);
      expect(verifyTrialBalance(testSqlite).isBalanced).toBe(true);
    });
  });

  // ============================================
  // 5. AR Invoice Delete
  // ============================================
  describe('AR Invoice Delete', () => {
    it('should delete draft', async () => {
      const inv = await createTestARInvoice();
      await deleteARInvoice(inv.id, 1);
      expect(testSqlite.prepare('SELECT id FROM ar_invoices WHERE id = ?').get(inv.id)).toBeUndefined();
    });

    it('should reject deleting confirmed', async () => {
      const inv = await createTestARInvoice();
      await confirmARInvoice(inv.id, 1);
      await expect(deleteARInvoice(inv.id, 1)).rejects.toThrow('draft');
    });
  });

  // ============================================
  // 6. GL Balance Verification
  // ============================================
  describe('GL Balance Verification', () => {
    it('should show AR increase after confirmation', async () => {
      const inv = await createTestARInvoice();
      await confirmARInvoice(inv.id, 1);
      expect(getAccountBalance(testSqlite, ACCT_TEST_IDS.AR_DOMESTIC)).toBe(5350);
    });

    it('should show revenue credit after confirmation', async () => {
      const inv = await createTestARInvoice();
      await confirmARInvoice(inv.id, 1);
      expect(getAccountBalance(testSqlite, ACCT_TEST_IDS.SALES_REVENUE)).toBe(-5000);
    });

    it('should zero AR after full receipt', async () => {
      const inv = await createTestARInvoice();
      await confirmARInvoice(inv.id, 1);
      await recordARPayment(inv.id, { paymentDate: '2025-02-01', bankAccountId: ACCT_TEST_IDS.BANK, paymentMethod: 'transfer', amount: 5350 }, 1);
      expect(getAccountBalance(testSqlite, ACCT_TEST_IDS.AR_DOMESTIC)).toBe(0);
    });

    it('should show bank increase after receipt', async () => {
      const inv = await createTestARInvoice();
      await confirmARInvoice(inv.id, 1);
      await recordARPayment(inv.id, { paymentDate: '2025-02-01', bankAccountId: ACCT_TEST_IDS.BANK, paymentMethod: 'transfer', amount: 5350 }, 1);
      expect(getAccountBalance(testSqlite, ACCT_TEST_IDS.BANK)).toBe(5350);
    });

    it('should show output VAT liability', async () => {
      const inv = await createTestARInvoice();
      await confirmARInvoice(inv.id, 1);
      expect(getAccountBalance(testSqlite, ACCT_TEST_IDS.OUTPUT_VAT)).toBe(-350);
    });
  });
});
