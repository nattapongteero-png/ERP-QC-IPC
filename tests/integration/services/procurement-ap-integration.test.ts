/**
 * Procurement → AP Integration Tests
 *
 * End-to-end integration tests covering the full Purchase-to-Pay (P2P) cycle:
 *
 * Flow 1: Manual AP Invoice → Approval → Payment
 * Flow 2: Partial Payment Flow
 * Flow 3: Multi-Invoice Vendor Payment
 * Flow 4: AP with WHT (Withholding Tax)
 * Flow 5: Multi-Line Invoice with Different GL Accounts
 * Flow 6: VAT Transaction Tracking
 * Flow 7: Payment Listing and Filtering
 * Flow 8: Journal Entry Integrity
 * Flow 9: Error Handling and Edge Cases
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
  seedVendors,
  seedCustomers,
  ACCT_TEST_IDS,
  verifyTrialBalance,
  getAccountBalance,
} from '../../helpers/seed-accounting';

// ============================================
// DB Mock Setup (hoisted)
// ============================================
const { getTestDb, setTestDb } = vi.hoisted(() => {
  let _testDb: any = null;
  return {
    getTestDb: () => _testDb,
    setTestDb: (db: any) => { _testDb = db; },
  };
});

let testSqlite: Database.Database;
let testDb: any;

vi.mock('@/lib/db', () => ({
  isSqlite: () => true,
  getDb: async () => getTestDb(),
  getSqliteDb: () => getTestDb(),
  schema,
}));

vi.mock('@/lib/audit', () => ({
  createAuditLog: vi.fn(() => Promise.resolve()),
}));

// Mock matching service (no 3-way matching complexity in these tests)
vi.mock('@/lib/services/matching.service', () => ({
  runMatching: vi.fn(() => Promise.resolve({ success: true, status: 'matched', exceptions: [] })),
}));

import {
  createAPInvoice,
  approveAPInvoice,
  recordAPPayment,
  listPayments,
  calculateWHT,
} from '@/lib/services/accounting.service';

// ============================================
// All tables needed for integration tests
// ============================================
const ALL_TABLES = [
  schema.sqliteGLAccountTypes,
  schema.sqliteGLAccounts,
  schema.sqliteFiscalYears,
  schema.sqliteFiscalPeriods,
  schema.sqliteJournalEntries,
  schema.sqliteJournalLines,
  schema.sqliteVendors,
  schema.sqliteCustomers,
  schema.sqliteAPInvoices,
  schema.sqliteAPInvoiceLines,
  schema.sqliteARInvoices,
  schema.sqliteARInvoiceLines,
  schema.sqlitePayments,
  schema.sqlitePaymentAllocations,
  schema.sqliteVATTransactions,
  schema.sqliteUsers,
  schema.sqliteAuditTrail,
  schema.sqliteItems,
  schema.sqliteWarehouses,
  schema.sqliteInventoryLots,
  schema.sqliteInventoryTransactions,
  schema.sqlitePurchaseOrders,
  schema.sqlitePurchaseOrderLines,
];

describe('Procurement to AP Integration Tests', () => {
  beforeEach(() => {
    testSqlite = new Database(':memory:');
    testSqlite.pragma('journal_mode = WAL');
    testDb = drizzle(testSqlite, { schema });
    setTestDb(testDb);

    for (const table of ALL_TABLES) {
      try {
        testSqlite.exec(generateCreateTableSql(table));
      } catch {
        // Table might already exist
      }
    }

    // Seed baseline data
    seedGLAccountTypes(testSqlite);
    seedGLAccounts(testSqlite);
    seedFiscalYearAndPeriods(testSqlite);
    seedVendors(testSqlite);
    seedCustomers(testSqlite);

    // Add additional GL accounts needed for PO receipt flow
    testSqlite.exec(`
      INSERT OR IGNORE INTO gl_accounts (id, code, name_th, name_en, account_type_id, level, is_active, is_postable, is_bank_account, created_by, created_at, updated_at)
      VALUES
        (300, '1130', 'สินค้าคงเหลือ', 'Inventory', ${ACCT_TEST_IDS.ASSET_TYPE}, 1, 1, 1, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (301, '2110', 'เจ้าหนี้การค้า (ทั่วไป)', 'AP General', ${ACCT_TEST_IDS.LIABILITY_TYPE}, 1, 1, 1, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    // Create test user
    testSqlite.exec(`
      INSERT OR IGNORE INTO users (id, name, email, password, role, is_active)
      VALUES (1, 'Finance User', 'finance@test.com', 'hash', 'finance', 1)
    `);

    // Create warehouse and items for PO receipt tests
    testSqlite.exec(`
      INSERT OR IGNORE INTO warehouses (id, code, name, type, is_active, created_at, updated_at)
      VALUES (1, 'WH-MAIN', 'Main Warehouse', 'main', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    testSqlite.exec(`
      INSERT OR IGNORE INTO items (id, code, name_th, name_en, type, category, primary_unit, is_active, on_hand, on_hand_cost, created_at, updated_at)
      VALUES
        (10, 'RM-HERB-001', 'สมุนไพร A', 'Herb A', 'raw_material', 'herbs', 'kg', 1, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (11, 'RM-HERB-002', 'สมุนไพร B', 'Herb B', 'raw_material', 'herbs', 'kg', 1, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (12, 'PKG-BOX-001', 'กล่องบรรจุ', 'Packaging Box', 'packaging', 'packaging', 'pcs', 1, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);
  });

  afterEach(() => {
    if (testSqlite) testSqlite.close();
    vi.clearAllMocks();
  });

  // ============================================
  // Flow 1: Manual AP Invoice Full Cycle
  // ============================================
  describe('Flow 1: Manual AP Invoice Full Cycle', () => {
    it('should complete full P2P cycle with correct GL impact', async () => {
      // Step 1: Create AP invoice
      const invoice = await createAPInvoice(
        {
          invoiceNumber: 'AP-INT-001',
          vendorId: ACCT_TEST_IDS.VENDOR,
          invoiceDate: '2025-01-15',
          dueDate: '2025-02-15',
          receivedDate: '2025-01-15',
          lines: [
            { description: 'Herbs purchase', glAccountId: ACCT_TEST_IDS.COGS, quantity: 100, unitPrice: 50 },
          ],
        },
        1
      );

      expect(invoice.status).toBe('draft');
      expect(invoice.subtotal).toBe(5000);
      expect(invoice.vatAmount).toBe(350);
      expect(invoice.totalAmount).toBe(5350);

      // Step 2: Approve (creates journal entry)
      const approved = await approveAPInvoice(invoice.id, 1);
      expect(approved.status).toBe('posted');
      expect(approved.journalEntryId).toBeDefined();

      // Verify GL: COGS debited, VAT debited, AP credited
      expect(getAccountBalance(testSqlite, ACCT_TEST_IDS.COGS)).toBe(5000);
      expect(getAccountBalance(testSqlite, ACCT_TEST_IDS.INPUT_VAT_RECV)).toBe(350);
      expect(getAccountBalance(testSqlite, ACCT_TEST_IDS.AP_DOMESTIC)).toBe(-5350);
      expect(verifyTrialBalance(testSqlite).isBalanced).toBe(true);

      // Step 3: Record full payment
      const { invoice: paid } = await recordAPPayment(
        invoice.id,
        {
          paymentDate: '2025-02-01',
          bankAccountId: ACCT_TEST_IDS.BANK,
          paymentMethod: 'transfer',
          referenceNumber: 'TXN-20250201',
          amount: 5350,
        },
        1
      );

      expect(paid.status).toBe('paid');
      expect(paid.paidAmount).toBe(5350);

      // Verify GL: AP zeroed out, Bank decreased
      expect(getAccountBalance(testSqlite, ACCT_TEST_IDS.AP_DOMESTIC)).toBe(0);
      expect(getAccountBalance(testSqlite, ACCT_TEST_IDS.BANK)).toBe(-5350);
      expect(verifyTrialBalance(testSqlite).isBalanced).toBe(true);
    });
  });

  // ============================================
  // Flow 2: Partial Payment Flow
  // ============================================
  describe('Flow 2: Partial Payment Flow', () => {
    it('should handle multiple partial payments until fully paid', async () => {
      const invoice = await createAPInvoice(
        {
          invoiceNumber: 'AP-PARTIAL-001',
          vendorId: ACCT_TEST_IDS.VENDOR,
          invoiceDate: '2025-01-15',
          dueDate: '2025-02-15',
          receivedDate: '2025-01-15',
          lines: [
            { description: 'Large order herbs', glAccountId: ACCT_TEST_IDS.COGS, quantity: 200, unitPrice: 100 },
          ],
        },
        1
      );

      // Total: 20000 + VAT 1400 = 21400
      expect(invoice.totalAmount).toBe(21400);
      await approveAPInvoice(invoice.id, 1);

      // Payment 1: 10,000
      const { invoice: afterPay1 } = await recordAPPayment(
        invoice.id,
        { paymentDate: '2025-01-20', bankAccountId: ACCT_TEST_IDS.BANK, paymentMethod: 'transfer', amount: 10000 },
        1
      );
      expect(afterPay1.status).toBe('partial');
      expect(afterPay1.paidAmount).toBe(10000);

      // Payment 2: 5,000
      const { invoice: afterPay2 } = await recordAPPayment(
        invoice.id,
        { paymentDate: '2025-01-25', bankAccountId: ACCT_TEST_IDS.BANK, paymentMethod: 'check', referenceNumber: 'CHK-001', amount: 5000 },
        1
      );
      expect(afterPay2.status).toBe('partial');
      expect(afterPay2.paidAmount).toBe(15000);

      // Payment 3: remaining 6,400
      const { invoice: fullyPaid } = await recordAPPayment(
        invoice.id,
        { paymentDate: '2025-02-01', bankAccountId: ACCT_TEST_IDS.BANK, paymentMethod: 'transfer', amount: 6400 },
        1
      );
      expect(fullyPaid.status).toBe('paid');
      expect(fullyPaid.paidAmount).toBe(21400);

      // AP fully cleared, Bank decreased by total
      expect(getAccountBalance(testSqlite, ACCT_TEST_IDS.AP_DOMESTIC)).toBe(0);
      expect(getAccountBalance(testSqlite, ACCT_TEST_IDS.BANK)).toBe(-21400);
      expect(verifyTrialBalance(testSqlite).isBalanced).toBe(true);
    });
  });

  // ============================================
  // Flow 3: Multi-Invoice Vendor Payment
  // ============================================
  describe('Flow 3: Multi-Invoice Vendor Payment', () => {
    it('should handle multiple invoices with cumulative GL impact', async () => {
      // Invoice 1: 1000 + 70 VAT = 1070
      const inv1 = await createAPInvoice(
        {
          invoiceNumber: 'AP-MULTI-001',
          vendorId: ACCT_TEST_IDS.VENDOR,
          invoiceDate: '2025-01-10',
          dueDate: '2025-02-10',
          receivedDate: '2025-01-10',
          lines: [{ description: 'Herbs batch 1', glAccountId: ACCT_TEST_IDS.COGS, quantity: 10, unitPrice: 100 }],
        },
        1
      );

      // Invoice 2: 10000 + 700 VAT = 10700
      const inv2 = await createAPInvoice(
        {
          invoiceNumber: 'AP-MULTI-002',
          vendorId: ACCT_TEST_IDS.VENDOR,
          invoiceDate: '2025-01-15',
          dueDate: '2025-02-15',
          receivedDate: '2025-01-15',
          lines: [{ description: 'Herbs batch 2', glAccountId: ACCT_TEST_IDS.COGS, quantity: 50, unitPrice: 200 }],
        },
        1
      );

      // Invoice 3: 5500 + 385 VAT = 5885
      const inv3 = await createAPInvoice(
        {
          invoiceNumber: 'AP-MULTI-003',
          vendorId: ACCT_TEST_IDS.VENDOR,
          invoiceDate: '2025-01-20',
          dueDate: '2025-02-20',
          receivedDate: '2025-01-20',
          lines: [
            { description: 'Packaging', glAccountId: ACCT_TEST_IDS.COGS, quantity: 100, unitPrice: 30 },
            { description: 'Labels', glAccountId: ACCT_TEST_IDS.COGS, quantity: 500, unitPrice: 5 },
          ],
        },
        1
      );

      // Approve all
      await approveAPInvoice(inv1.id, 1);
      await approveAPInvoice(inv2.id, 1);
      await approveAPInvoice(inv3.id, 1);

      // Total AP: 1070 + 10700 + 5885 = 17655
      expect(getAccountBalance(testSqlite, ACCT_TEST_IDS.AP_DOMESTIC)).toBe(-17655);

      // Pay all
      await recordAPPayment(inv1.id, { paymentDate: '2025-02-05', bankAccountId: ACCT_TEST_IDS.BANK, paymentMethod: 'transfer', amount: 1070 }, 1);
      await recordAPPayment(inv2.id, { paymentDate: '2025-02-10', bankAccountId: ACCT_TEST_IDS.BANK, paymentMethod: 'transfer', amount: 10700 }, 1);
      await recordAPPayment(inv3.id, { paymentDate: '2025-02-15', bankAccountId: ACCT_TEST_IDS.BANK, paymentMethod: 'check', amount: 5885 }, 1);

      // All AP cleared
      expect(getAccountBalance(testSqlite, ACCT_TEST_IDS.AP_DOMESTIC)).toBe(0);
      // Total COGS: 1000 + 10000 + 5500 = 16500
      expect(getAccountBalance(testSqlite, ACCT_TEST_IDS.COGS)).toBe(16500);
      // Total VAT: 70 + 700 + 385 = 1155
      expect(getAccountBalance(testSqlite, ACCT_TEST_IDS.INPUT_VAT_RECV)).toBe(1155);
      // Total bank: -17655
      expect(getAccountBalance(testSqlite, ACCT_TEST_IDS.BANK)).toBe(-17655);
      expect(verifyTrialBalance(testSqlite).isBalanced).toBe(true);
    });
  });

  // ============================================
  // Flow 4: Payment with WHT Deduction
  // ============================================
  describe('Flow 4: Payment with WHT Deduction', () => {
    it('should correctly handle WHT in payment journal entry', async () => {
      const invoice = await createAPInvoice(
        {
          invoiceNumber: 'AP-WHT-001',
          vendorId: ACCT_TEST_IDS.VENDOR,
          invoiceDate: '2025-01-15',
          dueDate: '2025-02-15',
          receivedDate: '2025-01-15',
          lines: [{ description: 'Professional services', glAccountId: ACCT_TEST_IDS.COGS, quantity: 1, unitPrice: 10000 }],
        },
        1
      );

      expect(invoice.totalAmount).toBe(10700); // 10000 + 700 VAT
      await approveAPInvoice(invoice.id, 1);

      // Pay with 3% WHT
      const whtCalc = calculateWHT(10700, 3);
      expect(whtCalc.whtAmount).toBe(321);
      expect(whtCalc.netPayment).toBe(10379);

      const { invoice: paid } = await recordAPPayment(
        invoice.id,
        { paymentDate: '2025-02-01', bankAccountId: ACCT_TEST_IDS.BANK, paymentMethod: 'transfer', amount: 10700, whtRate: 3 },
        1
      );

      expect(paid.status).toBe('paid');

      // WHT Payable = -321 (credit-normal)
      expect(getAccountBalance(testSqlite, ACCT_TEST_IDS.WHT_PAYABLE)).toBe(-321);
      // Bank only debited net amount: -10379
      expect(getAccountBalance(testSqlite, ACCT_TEST_IDS.BANK)).toBe(-10379);
      // AP fully cleared
      expect(getAccountBalance(testSqlite, ACCT_TEST_IDS.AP_DOMESTIC)).toBe(0);
      expect(verifyTrialBalance(testSqlite).isBalanced).toBe(true);
    });
  });

  // ============================================
  // Flow 5: Multi-Line Invoice with Different GL Accounts
  // ============================================
  describe('Flow 5: Multi-Line Invoice Different GL Accounts', () => {
    it('should distribute costs to correct GL accounts', async () => {
      const invoice = await createAPInvoice(
        {
          invoiceNumber: 'AP-MULTIGL-001',
          vendorId: ACCT_TEST_IDS.VENDOR,
          invoiceDate: '2025-01-15',
          dueDate: '2025-02-15',
          receivedDate: '2025-01-15',
          lines: [
            { description: 'Raw herbs', glAccountId: ACCT_TEST_IDS.COGS, quantity: 10, unitPrice: 500 },
            { description: 'Factory supplies', glAccountId: ACCT_TEST_IDS.MANUFACTURING_OVERHEAD, quantity: 5, unitPrice: 200 },
          ],
        },
        1
      );

      // COGS: 5000, MFG OH: 1000, Subtotal: 6000, VAT: 420, Total: 6420
      expect(invoice.subtotal).toBe(6000);
      expect(invoice.totalAmount).toBe(6420);

      await approveAPInvoice(invoice.id, 1);

      expect(getAccountBalance(testSqlite, ACCT_TEST_IDS.COGS)).toBe(5000);
      expect(getAccountBalance(testSqlite, ACCT_TEST_IDS.MANUFACTURING_OVERHEAD)).toBe(1000);
      expect(getAccountBalance(testSqlite, ACCT_TEST_IDS.INPUT_VAT_RECV)).toBe(420);
      expect(verifyTrialBalance(testSqlite).isBalanced).toBe(true);
    });
  });

  // ============================================
  // Flow 6: VAT Transaction Tracking
  // ============================================
  describe('Flow 6: VAT Transaction Tracking', () => {
    it('should create input VAT transaction for each approved invoice', async () => {
      const inv1 = await createAPInvoice(
        {
          invoiceNumber: 'AP-VAT-001',
          vendorId: ACCT_TEST_IDS.VENDOR,
          invoiceDate: '2025-01-10',
          dueDate: '2025-02-10',
          receivedDate: '2025-01-10',
          lines: [{ description: 'Purchase 1', glAccountId: ACCT_TEST_IDS.COGS, quantity: 10, unitPrice: 1000 }],
        },
        1
      );

      const inv2 = await createAPInvoice(
        {
          invoiceNumber: 'AP-VAT-002',
          vendorId: ACCT_TEST_IDS.VENDOR,
          invoiceDate: '2025-01-15',
          dueDate: '2025-02-15',
          receivedDate: '2025-01-15',
          lines: [{ description: 'Purchase 2', glAccountId: ACCT_TEST_IDS.COGS, quantity: 20, unitPrice: 500 }],
        },
        1
      );

      await approveAPInvoice(inv1.id, 1);
      await approveAPInvoice(inv2.id, 1);

      const vatTxns = testSqlite
        .prepare("SELECT * FROM vat_transactions WHERE transaction_type = 'input' ORDER BY id")
        .all() as any[];

      expect(vatTxns).toHaveLength(2);
      expect(Number(vatTxns[0].vat_amount)).toBe(700);  // 10000 x 7%
      expect(Number(vatTxns[0].taxable_amount)).toBe(10000);
      expect(Number(vatTxns[1].vat_amount)).toBe(700);  // 10000 x 7%
      expect(Number(vatTxns[1].taxable_amount)).toBe(10000);
    });
  });

  // ============================================
  // Flow 7: Payment Listing
  // ============================================
  describe('Flow 7: Payment Listing', () => {
    it('should list AP payments with correct filters', async () => {
      // Create and pay 2 invoices with different methods
      const inv1 = await createAPInvoice(
        {
          invoiceNumber: 'AP-PAYLIST-001',
          vendorId: ACCT_TEST_IDS.VENDOR,
          invoiceDate: '2025-01-10',
          dueDate: '2025-02-10',
          receivedDate: '2025-01-10',
          lines: [{ description: 'Order 1', glAccountId: ACCT_TEST_IDS.COGS, quantity: 5, unitPrice: 100 }],
        },
        1
      );
      await approveAPInvoice(inv1.id, 1);
      await recordAPPayment(inv1.id, { paymentDate: '2025-01-15', bankAccountId: ACCT_TEST_IDS.BANK, paymentMethod: 'transfer', amount: 535 }, 1);

      const inv2 = await createAPInvoice(
        {
          invoiceNumber: 'AP-PAYLIST-002',
          vendorId: ACCT_TEST_IDS.VENDOR,
          invoiceDate: '2025-01-12',
          dueDate: '2025-02-12',
          receivedDate: '2025-01-12',
          lines: [{ description: 'Order 2', glAccountId: ACCT_TEST_IDS.COGS, quantity: 10, unitPrice: 200 }],
        },
        1
      );
      await approveAPInvoice(inv2.id, 1);
      await recordAPPayment(inv2.id, { paymentDate: '2025-01-20', bankAccountId: ACCT_TEST_IDS.BANK, paymentMethod: 'check', amount: 2140 }, 1);

      // List all AP payments
      const allPayments = await listPayments({ paymentType: 'ap' });
      expect(allPayments.length).toBeGreaterThanOrEqual(2);

      // Filter by method
      const transferPayments = await listPayments({ paymentType: 'ap', paymentMethod: 'transfer' });
      expect(transferPayments.length).toBeGreaterThanOrEqual(1);
      transferPayments.forEach(p => {
        expect(p.paymentMethod).toBe('transfer');
      });
    });
  });

  // ============================================
  // Flow 8: Journal Entry Integrity
  // ============================================
  describe('Flow 8: Journal Entry Integrity', () => {
    it('should have balanced debit/credit in all journal entries', async () => {
      for (let i = 1; i <= 3; i++) {
        const inv = await createAPInvoice(
          {
            invoiceNumber: 'AP-JE-' + String(i).padStart(3, '0'),
            vendorId: ACCT_TEST_IDS.VENDOR,
            invoiceDate: '2025-01-15',
            dueDate: '2025-02-15',
            receivedDate: '2025-01-15',
            lines: [{ description: 'Purchase ' + i, glAccountId: ACCT_TEST_IDS.COGS, quantity: i * 10, unitPrice: 100 }],
          },
          1
        );
        await approveAPInvoice(inv.id, 1);
        await recordAPPayment(inv.id, { paymentDate: '2025-02-01', bankAccountId: ACCT_TEST_IDS.BANK, paymentMethod: 'transfer', amount: inv.totalAmount }, 1);
      }

      // Every journal entry must be internally balanced
      const entries = testSqlite
        .prepare('SELECT id, total_debit, total_credit FROM journal_entries')
        .all() as Array<{ id: number; total_debit: number; total_credit: number }>;

      for (const entry of entries) {
        expect(Math.abs(entry.total_debit - entry.total_credit)).toBeLessThan(0.01);
      }

      expect(verifyTrialBalance(testSqlite).isBalanced).toBe(true);
    });

    it('should link journal entries back to source documents', async () => {
      const invoice = await createAPInvoice(
        {
          invoiceNumber: 'AP-SOURCE-001',
          vendorId: ACCT_TEST_IDS.VENDOR,
          invoiceDate: '2025-01-15',
          dueDate: '2025-02-15',
          receivedDate: '2025-01-15',
          lines: [{ description: 'Test', glAccountId: ACCT_TEST_IDS.COGS, quantity: 1, unitPrice: 1000 }],
        },
        1
      );

      const approved = await approveAPInvoice(invoice.id, 1);

      const je = testSqlite
        .prepare('SELECT source_type, source_id FROM journal_entries WHERE id = ?')
        .get(approved.journalEntryId) as { source_type: string; source_id: number };

      expect(je.source_type).toBe('PO_RECEIPT');
      expect(je.source_id).toBe(invoice.id);
    });
  });

  // ============================================
  // Flow 9: Error Handling
  // ============================================
  describe('Flow 9: Error Handling', () => {
    it('should reject payment for already fully paid invoice', async () => {
      const invoice = await createAPInvoice(
        {
          invoiceNumber: 'AP-OVERPAY-001',
          vendorId: ACCT_TEST_IDS.VENDOR,
          invoiceDate: '2025-01-15',
          dueDate: '2025-02-15',
          receivedDate: '2025-01-15',
          lines: [{ description: 'Test', glAccountId: ACCT_TEST_IDS.COGS, quantity: 1, unitPrice: 1000 }],
        },
        1
      );

      await approveAPInvoice(invoice.id, 1);
      await recordAPPayment(invoice.id, { paymentDate: '2025-01-20', bankAccountId: ACCT_TEST_IDS.BANK, paymentMethod: 'transfer', amount: 1070 }, 1);

      // Try to pay again - should reject
      await expect(
        recordAPPayment(invoice.id, { paymentDate: '2025-01-25', bankAccountId: ACCT_TEST_IDS.BANK, paymentMethod: 'transfer', amount: 100 }, 1)
      ).rejects.toThrow();
    });

    it('should reject overpayment on partial invoice', async () => {
      const invoice = await createAPInvoice(
        {
          invoiceNumber: 'AP-OVER-001',
          vendorId: ACCT_TEST_IDS.VENDOR,
          invoiceDate: '2025-01-15',
          dueDate: '2025-02-15',
          receivedDate: '2025-01-15',
          lines: [{ description: 'Test', glAccountId: ACCT_TEST_IDS.COGS, quantity: 1, unitPrice: 1000 }],
        },
        1
      );

      await approveAPInvoice(invoice.id, 1);
      await recordAPPayment(invoice.id, { paymentDate: '2025-01-20', bankAccountId: ACCT_TEST_IDS.BANK, paymentMethod: 'transfer', amount: 500 }, 1);

      // Remaining is 570, try to pay 600
      await expect(
        recordAPPayment(invoice.id, { paymentDate: '2025-01-25', bankAccountId: ACCT_TEST_IDS.BANK, paymentMethod: 'transfer', amount: 600 }, 1)
      ).rejects.toThrow('exceeds outstanding');
    });

    it('should handle concurrent invoice creation with unique numbers', async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        createAPInvoice(
          {
            invoiceNumber: 'AP-CONC-' + String(i + 1).padStart(3, '0'),
            vendorId: ACCT_TEST_IDS.VENDOR,
            invoiceDate: '2025-01-15',
            dueDate: '2025-02-15',
            receivedDate: '2025-01-15',
            lines: [{ description: 'Item ' + i, glAccountId: ACCT_TEST_IDS.COGS, quantity: 1, unitPrice: 100 }],
          },
          1
        )
      );

      const invoices = await Promise.all(promises);
      const ids = invoices.map(inv => inv.id);
      expect(new Set(ids).size).toBe(5);
    });
  });
});
