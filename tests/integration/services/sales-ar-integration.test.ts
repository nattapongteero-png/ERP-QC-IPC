/**
 * Sales -> AR -> Receipt Integration Tests
 *
 * End-to-end integration covering the Order-to-Cash (O2C) cycle:
 * Flow 1: SO -> AR Invoice -> Confirm -> Receipt (full GL verification)
 * Flow 2: Partial receipts until fully paid
 * Flow 3: Multi-invoice customer receipts
 * Flow 4: VMI -> SO -> AR Invoice -> Receipt
 * Flow 5: Output VAT transaction tracking
 * Flow 6: Receipt listing and filtering
 * Flow 7: Journal entry integrity
 * Flow 8: Error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@/lib/db/schema';
import { generateCreateTableSql } from '../../helpers/schema-sync';
import {
  seedGLAccountTypes, seedGLAccounts, seedFiscalYearAndPeriods, seedCustomers,
  ACCT_TEST_IDS, verifyTrialBalance, getAccountBalance,
} from '../../helpers/seed-accounting';

const { getTestDb, setTestDb } = vi.hoisted(() => {
  let _testDb: any = null;
  return { getTestDb: () => _testDb, setTestDb: (db: any) => { _testDb = db; } };
});

let testSqlite: Database.Database;

vi.mock('@/lib/db', () => ({ isSqlite: () => true, getDb: async () => getTestDb(), getSqliteDb: () => getTestDb(), schema }));
vi.mock('@/lib/audit', () => ({ createAuditLog: vi.fn(() => Promise.resolve()) }));
vi.mock('@/lib/services/inventory.service', () => ({ getLotsForPicking: vi.fn(() => Promise.resolve([])), reserveLots: vi.fn(() => Promise.resolve()), issueMaterial: vi.fn(() => Promise.resolve()), receiveMaterial: vi.fn(() => Promise.resolve(1)) }));
vi.mock('@/lib/services/unit-cost.service', () => ({ calculateCOGS: vi.fn(() => Promise.resolve({ unitCost: 50, totalCost: 500, marginAmount: 500, marginPercent: 50 })), updateSOLineWithCOGS: vi.fn(() => Promise.resolve()), recalculateWAC: vi.fn(() => Promise.resolve({ success: true })), updateItemLastPurchase: vi.fn(() => Promise.resolve()) }));
vi.mock('@/lib/services/matching.service', () => ({ runMatching: vi.fn(() => Promise.resolve({ success: true, status: 'matched', exceptions: [] })) }));

import { createARInvoice, confirmARInvoice, recordARPayment, listPayments } from '@/lib/services/accounting.service';
import { createSalesOrder, createSalesOrderFromVmi } from '@/lib/services/sales.service';

const ALL_TABLES = [
  schema.sqliteGLAccountTypes, schema.sqliteGLAccounts, schema.sqliteFiscalYears, schema.sqliteFiscalPeriods,
  schema.sqliteJournalEntries, schema.sqliteJournalLines, schema.sqliteVendors, schema.sqliteCustomers,
  schema.sqliteAPInvoices, schema.sqliteAPInvoiceLines, schema.sqliteARInvoices, schema.sqliteARInvoiceLines,
  schema.sqlitePayments, schema.sqlitePaymentAllocations, schema.sqliteVATTransactions,
  schema.sqliteUsers, schema.sqliteAuditTrail, schema.sqliteItems, schema.sqliteWarehouses,
  schema.sqliteInventoryLots, schema.sqliteInventoryTransactions,
  schema.sqliteSalesOrders, schema.sqliteSalesOrderLines, schema.sqliteSalesDeliveries,
];

describe('Sales to AR Integration Tests', () => {
  beforeEach(() => {
    testSqlite = new Database(':memory:');
    testSqlite.pragma('journal_mode = WAL');
    setTestDb(drizzle(testSqlite, { schema }));
    for (const table of ALL_TABLES) { try { testSqlite.exec(generateCreateTableSql(table)); } catch { /* skip */ } }

    seedGLAccountTypes(testSqlite);
    seedGLAccounts(testSqlite);
    seedFiscalYearAndPeriods(testSqlite);
    seedCustomers(testSqlite);

    testSqlite.exec("INSERT OR IGNORE INTO users (id, name, email, password, role, is_active) VALUES (1, 'Sales', 'sales@test.com', 'hash', 'sales', 1)");
    testSqlite.exec("INSERT OR IGNORE INTO warehouses (id, code, name, type, is_active, created_at, updated_at) VALUES (1, 'WH', 'Main', 'main', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)");
    testSqlite.exec(`INSERT OR IGNORE INTO items (id, code, name_th, name_en, type, category, primary_unit, is_active, on_hand, on_hand_cost, created_at, updated_at) VALUES
      (20, 'FG-001', 'ยา A', 'Med A', 'finished_goods', 'products', 'box', 1, 100, 5000, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (21, 'FG-002', 'ยา B', 'Med B', 'finished_goods', 'products', 'bottle', 1, 50, 2500, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`);
    testSqlite.exec(`INSERT OR IGNORE INTO inventory_lots (id, item_id, lot_number, warehouse_id, quantity, reserved_quantity, unit, status, expiry_date, received_date, created_at, updated_at) VALUES
      (100, 20, 'LOT-001', 1, 80, 0, 'box', 'released', '2027-01-01', '2025-01-01', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (101, 21, 'LOT-002', 1, 50, 0, 'bottle', 'released', '2027-06-01', '2025-01-05', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`);
  });

  afterEach(() => { if (testSqlite) testSqlite.close(); vi.clearAllMocks(); });

  describe('Flow 1: Full O2C cycle', () => {
    it('should complete SO -> AR -> Confirm -> Receipt with GL', async () => {
      const so = await createSalesOrder({ name: 'Customer Alpha' }, [{ itemId: 20, quantity: 10, unitPrice: 500, requiredDate: '2025-02-01' }], 1);
      const inv = await createARInvoice({ invoiceNumber: 'AR-O2C-001', taxInvoiceNumber: 'T-O2C-001', customerId: ACCT_TEST_IDS.CUSTOMER_1, salesOrderId: so.orderId, invoiceDate: '2025-01-15', dueDate: '2025-02-15', lines: [{ description: 'Med A', glAccountId: ACCT_TEST_IDS.SALES_REVENUE, quantity: 10, unitPrice: 500 }] }, 1);

      expect(inv.totalAmount).toBe(5350);
      await confirmARInvoice(inv.id, 1);
      expect(getAccountBalance(testSqlite, ACCT_TEST_IDS.AR_DOMESTIC)).toBe(5350);
      expect(getAccountBalance(testSqlite, ACCT_TEST_IDS.SALES_REVENUE)).toBe(-5000);
      expect(verifyTrialBalance(testSqlite).isBalanced).toBe(true);

      const { invoice: paid } = await recordARPayment(inv.id, { paymentDate: '2025-02-01', bankAccountId: ACCT_TEST_IDS.BANK, paymentMethod: 'transfer', amount: 5350 }, 1);
      expect(paid.status).toBe('paid');
      expect(getAccountBalance(testSqlite, ACCT_TEST_IDS.AR_DOMESTIC)).toBe(0);
      expect(getAccountBalance(testSqlite, ACCT_TEST_IDS.BANK)).toBe(5350);
      expect(verifyTrialBalance(testSqlite).isBalanced).toBe(true);
    });
  });

  describe('Flow 2: Partial Receipts', () => {
    it('should handle 3 partial payments', async () => {
      const inv = await createARInvoice({ invoiceNumber: 'AR-P-001', taxInvoiceNumber: 'T-P-001', customerId: ACCT_TEST_IDS.CUSTOMER_1, invoiceDate: '2025-01-15', dueDate: '2025-02-15', lines: [{ description: 'Big sale', glAccountId: ACCT_TEST_IDS.SALES_REVENUE, quantity: 100, unitPrice: 200 }] }, 1);
      expect(inv.totalAmount).toBe(21400);
      await confirmARInvoice(inv.id, 1);

      const { invoice: p1 } = await recordARPayment(inv.id, { paymentDate: '2025-01-20', bankAccountId: ACCT_TEST_IDS.BANK, paymentMethod: 'transfer', amount: 10000 }, 1);
      expect(p1.status).toBe('partial');

      const { invoice: p2 } = await recordARPayment(inv.id, { paymentDate: '2025-01-25', bankAccountId: ACCT_TEST_IDS.BANK, paymentMethod: 'check', amount: 5000 }, 1);
      expect(p2.status).toBe('partial');

      const { invoice: p3 } = await recordARPayment(inv.id, { paymentDate: '2025-02-01', bankAccountId: ACCT_TEST_IDS.BANK, paymentMethod: 'transfer', amount: 6400 }, 1);
      expect(p3.status).toBe('paid');
      expect(getAccountBalance(testSqlite, ACCT_TEST_IDS.AR_DOMESTIC)).toBe(0);
      expect(verifyTrialBalance(testSqlite).isBalanced).toBe(true);
    });
  });

  describe('Flow 3: Multi-Invoice Customer', () => {
    it('should track cumulative GL correctly', async () => {
      const i1 = await createARInvoice({ invoiceNumber: 'AR-M1', taxInvoiceNumber: 'T-M1', customerId: ACCT_TEST_IDS.CUSTOMER_1, invoiceDate: '2025-01-10', dueDate: '2025-02-10', lines: [{ description: 'S1', glAccountId: ACCT_TEST_IDS.SALES_REVENUE, quantity: 10, unitPrice: 100 }] }, 1);
      const i2 = await createARInvoice({ invoiceNumber: 'AR-M2', taxInvoiceNumber: 'T-M2', customerId: ACCT_TEST_IDS.CUSTOMER_1, invoiceDate: '2025-01-15', dueDate: '2025-02-15', lines: [{ description: 'S2', glAccountId: ACCT_TEST_IDS.SALES_REVENUE, quantity: 50, unitPrice: 200 }] }, 1);

      await confirmARInvoice(i1.id, 1);
      await confirmARInvoice(i2.id, 1);
      expect(getAccountBalance(testSqlite, ACCT_TEST_IDS.AR_DOMESTIC)).toBe(11770); // 1070+10700

      await recordARPayment(i1.id, { paymentDate: '2025-02-05', bankAccountId: ACCT_TEST_IDS.BANK, paymentMethod: 'transfer', amount: 1070 }, 1);
      await recordARPayment(i2.id, { paymentDate: '2025-02-10', bankAccountId: ACCT_TEST_IDS.BANK, paymentMethod: 'transfer', amount: 10700 }, 1);

      expect(getAccountBalance(testSqlite, ACCT_TEST_IDS.AR_DOMESTIC)).toBe(0);
      expect(getAccountBalance(testSqlite, ACCT_TEST_IDS.SALES_REVENUE)).toBe(-11000);
      expect(getAccountBalance(testSqlite, ACCT_TEST_IDS.OUTPUT_VAT)).toBe(-770);
      expect(verifyTrialBalance(testSqlite).isBalanced).toBe(true);
    });
  });

  describe('Flow 4: VMI -> SO -> AR', () => {
    it('should complete VMI order to receipt', async () => {
      const vmiSo = await createSalesOrderFromVmi({ vmiSalesOrderId: 5001, customerName: 'Hospital VMI', orderDate: '2025-01-15', totalAmount: 25000, lines: [{ itemId: 20, quantity: 50, unit: 'box', unitPrice: 500 }], userId: 1 });
      const inv = await createARInvoice({ invoiceNumber: 'AR-VMI-001', taxInvoiceNumber: 'T-VMI-001', customerId: ACCT_TEST_IDS.CUSTOMER_1, salesOrderId: vmiSo.orderId, invoiceDate: '2025-01-20', dueDate: '2025-02-20', lines: [{ description: 'VMI shipment', glAccountId: ACCT_TEST_IDS.SALES_REVENUE, quantity: 50, unitPrice: 500 }] }, 1);

      expect(inv.salesOrderId).toBe(vmiSo.orderId);
      await confirmARInvoice(inv.id, 1);
      const { invoice: paid } = await recordARPayment(inv.id, { paymentDate: '2025-02-15', bankAccountId: ACCT_TEST_IDS.BANK, paymentMethod: 'transfer', amount: inv.totalAmount }, 1);
      expect(paid.status).toBe('paid');
      expect(verifyTrialBalance(testSqlite).isBalanced).toBe(true);
    });
  });

  describe('Flow 5: Output VAT Tracking', () => {
    it('should create output VAT for each confirmed invoice', async () => {
      const i1 = await createARInvoice({ invoiceNumber: 'AR-V1', taxInvoiceNumber: 'T-V1', customerId: ACCT_TEST_IDS.CUSTOMER_1, invoiceDate: '2025-01-10', dueDate: '2025-02-10', lines: [{ description: 'S1', glAccountId: ACCT_TEST_IDS.SALES_REVENUE, quantity: 10, unitPrice: 1000 }] }, 1);
      const i2 = await createARInvoice({ invoiceNumber: 'AR-V2', taxInvoiceNumber: 'T-V2', customerId: ACCT_TEST_IDS.CUSTOMER_1, invoiceDate: '2025-01-15', dueDate: '2025-02-15', lines: [{ description: 'S2', glAccountId: ACCT_TEST_IDS.SALES_REVENUE, quantity: 20, unitPrice: 500 }] }, 1);

      await confirmARInvoice(i1.id, 1);
      await confirmARInvoice(i2.id, 1);

      const vatTxns = testSqlite.prepare("SELECT vat_amount FROM vat_transactions WHERE transaction_type = 'output' ORDER BY id").all() as any[];
      expect(vatTxns).toHaveLength(2);
      expect(Number(vatTxns[0].vat_amount)).toBe(700);
      expect(Number(vatTxns[1].vat_amount)).toBe(700);
    });
  });

  describe('Flow 6: Receipt Listing', () => {
    it('should list AR receipts', async () => {
      const i1 = await createARInvoice({ invoiceNumber: 'AR-RL1', taxInvoiceNumber: 'T-RL1', customerId: ACCT_TEST_IDS.CUSTOMER_1, invoiceDate: '2025-01-10', dueDate: '2025-02-10', lines: [{ description: 'S1', glAccountId: ACCT_TEST_IDS.SALES_REVENUE, quantity: 5, unitPrice: 100 }] }, 1);
      await confirmARInvoice(i1.id, 1);
      await recordARPayment(i1.id, { paymentDate: '2025-01-15', bankAccountId: ACCT_TEST_IDS.BANK, paymentMethod: 'transfer', amount: 535 }, 1);

      const receipts = await listPayments({ paymentType: 'ar' });
      expect(receipts.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Flow 7: JE Integrity', () => {
    it('should keep all JEs balanced', async () => {
      for (let i = 1; i <= 3; i++) {
        const inv = await createARInvoice({ invoiceNumber: 'AR-JE' + i, taxInvoiceNumber: 'T-JE' + i, customerId: ACCT_TEST_IDS.CUSTOMER_1, invoiceDate: '2025-01-15', dueDate: '2025-02-15', lines: [{ description: 'S' + i, glAccountId: ACCT_TEST_IDS.SALES_REVENUE, quantity: i * 10, unitPrice: 100 }] }, 1);
        await confirmARInvoice(inv.id, 1);
        await recordARPayment(inv.id, { paymentDate: '2025-02-01', bankAccountId: ACCT_TEST_IDS.BANK, paymentMethod: 'transfer', amount: inv.totalAmount }, 1);
      }
      const entries = testSqlite.prepare('SELECT total_debit, total_credit FROM journal_entries').all() as any[];
      for (const e of entries) expect(Math.abs(e.total_debit - e.total_credit)).toBeLessThan(0.01);
      expect(verifyTrialBalance(testSqlite).isBalanced).toBe(true);
    });
  });

  describe('Flow 8: Error Handling', () => {
    it('should reject receipt for fully paid', async () => {
      const inv = await createARInvoice({ invoiceNumber: 'AR-E1', taxInvoiceNumber: 'T-E1', customerId: ACCT_TEST_IDS.CUSTOMER_1, invoiceDate: '2025-01-15', dueDate: '2025-02-15', lines: [{ description: 'T', glAccountId: ACCT_TEST_IDS.SALES_REVENUE, quantity: 1, unitPrice: 1000 }] }, 1);
      await confirmARInvoice(inv.id, 1);
      await recordARPayment(inv.id, { paymentDate: '2025-01-20', bankAccountId: ACCT_TEST_IDS.BANK, paymentMethod: 'transfer', amount: 1070 }, 1);
      await expect(recordARPayment(inv.id, { paymentDate: '2025-01-25', bankAccountId: ACCT_TEST_IDS.BANK, paymentMethod: 'transfer', amount: 100 }, 1)).rejects.toThrow();
    });

    it('should reject overpayment', async () => {
      const inv = await createARInvoice({ invoiceNumber: 'AR-E2', taxInvoiceNumber: 'T-E2', customerId: ACCT_TEST_IDS.CUSTOMER_1, invoiceDate: '2025-01-15', dueDate: '2025-02-15', lines: [{ description: 'T', glAccountId: ACCT_TEST_IDS.SALES_REVENUE, quantity: 1, unitPrice: 1000 }] }, 1);
      await confirmARInvoice(inv.id, 1);
      await recordARPayment(inv.id, { paymentDate: '2025-01-20', bankAccountId: ACCT_TEST_IDS.BANK, paymentMethod: 'transfer', amount: 500 }, 1);
      await expect(recordARPayment(inv.id, { paymentDate: '2025-01-25', bankAccountId: ACCT_TEST_IDS.BANK, paymentMethod: 'transfer', amount: 600 }, 1)).rejects.toThrow('exceeds outstanding');
    });
  });
});
