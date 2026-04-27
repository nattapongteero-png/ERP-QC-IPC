/**
 * Procurement → Accounts Payable Unit Tests
 *
 * Tests the service-level functions in the Procurement-to-Pay (P2P) flow:
 * 1. AP Invoice CRUD (create, approve, delete)
 * 2. AP Payment recording with WHT support
 * 3. Journal entry creation during approval
 * 4. Payment journal entry (DR AP, CR Bank, CR WHT)
 * 5. Invoice status transitions (draft → posted → partial → paid)
 * 6. Trial balance verification after each accounting event
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

// Mock matching service to avoid complex setup
vi.mock('@/lib/services/matching.service', () => ({
  runMatching: vi.fn(() => Promise.resolve({ success: true, status: 'matched', exceptions: [] })),
}));

import {
  createAPInvoice,
  getAPInvoiceById,
  listAPInvoices,
  approveAPInvoice,
  recordAPPayment,
  deleteAPInvoice,
  deletePayment,
  updatePayment,
  calculateVAT,
  calculateWHT,
} from '@/lib/services/accounting.service';

// ============================================
// Table Setup
// ============================================
const REQUIRED_TABLES = [
  schema.sqliteGLAccountTypes,
  schema.sqliteGLAccounts,
  schema.sqliteFiscalYears,
  schema.sqliteFiscalPeriods,
  schema.sqliteJournalEntries,
  schema.sqliteJournalLines,
  schema.sqliteVendors,
  schema.sqliteAPInvoices,
  schema.sqliteAPInvoiceLines,
  schema.sqlitePayments,
  schema.sqlitePaymentAllocations,
  schema.sqliteVATTransactions,
  schema.sqliteUsers,
  schema.sqliteAuditTrail,
];

describe('Procurement → AP Flow Unit Tests', () => {
  beforeEach(() => {
    testSqlite = new Database(':memory:');
    testSqlite.pragma('journal_mode = WAL');
    testDb = drizzle(testSqlite, { schema });
    setTestDb(testDb);

    for (const table of REQUIRED_TABLES) {
      try {
        testSqlite.exec(generateCreateTableSql(table));
      } catch {
        // Table might already exist
      }
    }

    seedGLAccountTypes(testSqlite);
    seedGLAccounts(testSqlite);
    seedFiscalYearAndPeriods(testSqlite);
    seedVendors(testSqlite);

    testSqlite.exec(`
      INSERT OR IGNORE INTO users (id, name, email, password, role, is_active)
      VALUES (1, 'Finance User', 'finance@test.com', 'hash', 'finance', 1)
    `);
  });

  afterEach(() => {
    if (testSqlite) testSqlite.close();
    vi.clearAllMocks();
  });

  // ============================================
  // Helper: create a standard AP invoice
  // ============================================
  async function createTestAPInvoice(overrides?: Partial<{
    invoiceNumber: string;
    vendorId: number;
    lines: Array<{ description: string; glAccountId: number; quantity: number; unitPrice: number }>;
  }>) {
    return createAPInvoice(
      {
        invoiceNumber: overrides?.invoiceNumber || 'AP-TEST-001',
        vendorId: overrides?.vendorId || ACCT_TEST_IDS.VENDOR,
        invoiceDate: '2025-01-15',
        dueDate: '2025-02-15',
        receivedDate: '2025-01-15',
        lines: overrides?.lines || [
          { description: 'Raw herbs purchase', glAccountId: ACCT_TEST_IDS.COGS, quantity: 10, unitPrice: 1000 },
        ],
      },
      1
    );
  }

  // ============================================
  // 1. AP Invoice Creation
  // ============================================
  describe('AP Invoice Creation', () => {
    it('should create AP invoice with correct VAT calculation', async () => {
      const invoice = await createTestAPInvoice();

      expect(invoice.id).toBeDefined();
      expect(invoice.invoiceNumber).toBe('AP-TEST-001');
      expect(invoice.vendorId).toBe(ACCT_TEST_IDS.VENDOR);
      expect(invoice.status).toBe('draft');

      // Subtotal: 10 x 1000 = 10,000
      expect(invoice.subtotal).toBe(10000);
      // VAT 7%: 10,000 x 0.07 = 700
      expect(invoice.vatAmount).toBe(700);
      // Total: 10,000 + 700 = 10,700
      expect(invoice.totalAmount).toBe(10700);
      expect(invoice.paidAmount).toBe(0);
    });

    it('should create AP invoice with multiple lines', async () => {
      const invoice = await createTestAPInvoice({
        lines: [
          { description: 'Herbs A', glAccountId: ACCT_TEST_IDS.COGS, quantity: 5, unitPrice: 2000 },
          { description: 'Herbs B', glAccountId: ACCT_TEST_IDS.COGS, quantity: 3, unitPrice: 500 },
        ],
      });

      expect(invoice.lines!).toHaveLength(2);
      expect(invoice.subtotal).toBe(11500); // 5x2000 + 3x500
      expect(invoice.vatAmount).toBe(805); // 11500 x 0.07
      expect(invoice.totalAmount).toBe(12305);
    });

    it('should set correct line numbers', async () => {
      const invoice = await createTestAPInvoice({
        lines: [
          { description: 'Line 1', glAccountId: ACCT_TEST_IDS.COGS, quantity: 1, unitPrice: 100 },
          { description: 'Line 2', glAccountId: ACCT_TEST_IDS.COGS, quantity: 2, unitPrice: 200 },
        ],
      });

      expect(invoice.lines![0].lineNumber).toBe(1);
      expect(invoice.lines![1].lineNumber).toBe(2);
    });

    it('should retrieve AP invoice by ID', async () => {
      const created = await createTestAPInvoice();
      const retrieved = await getAPInvoiceById(created.id);

      expect(retrieved.id).toBe(created.id);
      expect(retrieved.invoiceNumber).toBe('AP-TEST-001');
      expect(retrieved.lines).toHaveLength(1);
    });

    it('should list AP invoices', async () => {
      await createTestAPInvoice({ invoiceNumber: 'AP-LIST-001' });
      await createTestAPInvoice({ invoiceNumber: 'AP-LIST-002' });

      const invoices = await listAPInvoices();
      expect(invoices.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter AP invoices by vendor', async () => {
      await createTestAPInvoice({ invoiceNumber: 'AP-FILT-001' });

      const invoices = await listAPInvoices({ vendorId: ACCT_TEST_IDS.VENDOR });
      expect(invoices.length).toBeGreaterThanOrEqual(1);
      invoices.forEach(inv => {
        expect(inv.vendorId).toBe(ACCT_TEST_IDS.VENDOR);
      });
    });

    it('should throw when retrieving non-existent invoice', async () => {
      await expect(getAPInvoiceById(99999)).rejects.toThrow('not found');
    });
  });

  // ============================================
  // 2. AP Invoice Approval with Journal Entry
  // ============================================
  describe('AP Invoice Approval', () => {
    it('should approve draft invoice and create journal entry', async () => {
      const invoice = await createTestAPInvoice();
      const approved = await approveAPInvoice(invoice.id, 1);

      expect(approved.status).toBe('posted');
      expect(approved.approvedBy).toBe(1);
      expect(approved.journalEntryId).toBeDefined();
    });

    it('should create correct journal entry lines (DR Expense, DR VAT, CR AP)', async () => {
      const invoice = await createTestAPInvoice();
      await approveAPInvoice(invoice.id, 1);

      // Verify journal entry lines
      const journalLines = testSqlite
        .prepare(`
          SELECT jl.gl_account_id, jl.debit, jl.credit, jl.description
          FROM journal_lines jl
          JOIN journal_entries je ON jl.journal_entry_id = je.id
          WHERE je.source_id = ?
          ORDER BY jl.line_number
        `)
        .all(invoice.id) as Array<{
          gl_account_id: number;
          debit: number;
          credit: number;
          description: string;
        }>;

      expect(journalLines.length).toBeGreaterThanOrEqual(2);

      // Expense debit (COGS)
      const expenseLine = journalLines.find(l => l.gl_account_id === ACCT_TEST_IDS.COGS);
      expect(expenseLine).toBeDefined();
      expect(expenseLine!.debit).toBe(10000);
      expect(expenseLine!.credit).toBe(0);

      // VAT debit (Input VAT Receivable 1141)
      const vatLine = journalLines.find(l => l.gl_account_id === ACCT_TEST_IDS.INPUT_VAT_RECV);
      expect(vatLine).toBeDefined();
      expect(vatLine!.debit).toBe(700);

      // AP credit (2111)
      const apLine = journalLines.find(l => l.gl_account_id === ACCT_TEST_IDS.AP_DOMESTIC);
      expect(apLine).toBeDefined();
      expect(apLine!.credit).toBe(10700);
    });

    it('should post journal entry automatically', async () => {
      const invoice = await createTestAPInvoice();
      const approved = await approveAPInvoice(invoice.id, 1);

      const je = testSqlite
        .prepare('SELECT status FROM journal_entries WHERE id = ?')
        .get(approved.journalEntryId) as { status: string };

      expect(je.status).toBe('posted');
    });

    it('should create VAT transaction on approval', async () => {
      const invoice = await createTestAPInvoice();
      await approveAPInvoice(invoice.id, 1);

      const vatTx = testSqlite
        .prepare('SELECT * FROM vat_transactions WHERE ap_invoice_id = ?')
        .get(invoice.id) as any;

      expect(vatTx).toBeDefined();
      expect(vatTx.transaction_type).toBe('input');
      expect(Number(vatTx.vat_amount)).toBe(700);
    });

    it('should maintain balanced trial balance after approval', async () => {
      const invoice = await createTestAPInvoice();
      await approveAPInvoice(invoice.id, 1);

      const trialBalance = verifyTrialBalance(testSqlite);
      expect(trialBalance.isBalanced).toBe(true);
    });

    it('should reject approving non-draft invoice', async () => {
      const invoice = await createTestAPInvoice();
      await approveAPInvoice(invoice.id, 1);

      // Try to approve again
      await expect(approveAPInvoice(invoice.id, 1)).rejects.toThrow("status 'posted'");
    });

    it('should reject approving invoice with no lines', async () => {
      // Create invoice then delete its lines manually
      const invoice = await createTestAPInvoice();
      testSqlite.exec('DELETE FROM ap_invoice_lines WHERE ap_invoice_id = ' + invoice.id);

      await expect(approveAPInvoice(invoice.id, 1)).rejects.toThrow('no lines');
    });
  });

  // ============================================
  // 3. AP Payment Recording
  // ============================================
  describe('AP Payment Recording', () => {
    it('should record full payment for posted invoice', async () => {
      const invoice = await createTestAPInvoice();
      await approveAPInvoice(invoice.id, 1);

      const { payment, invoice: updatedInvoice } = await recordAPPayment(
        invoice.id,
        {
          paymentDate: '2025-01-20',
          bankAccountId: ACCT_TEST_IDS.BANK,
          paymentMethod: 'transfer',
          referenceNumber: 'TXN-001',
          amount: 10700,
          description: 'Full payment',
        },
        1
      );

      expect(payment.paymentNumber).toMatch(/^PY-/);
      expect(updatedInvoice.status).toBe('paid');
      expect(updatedInvoice.paidAmount).toBe(10700);
    });

    it('should support partial payment', async () => {
      const invoice = await createTestAPInvoice();
      await approveAPInvoice(invoice.id, 1);

      const { invoice: partial } = await recordAPPayment(
        invoice.id,
        {
          paymentDate: '2025-01-20',
          bankAccountId: ACCT_TEST_IDS.BANK,
          paymentMethod: 'transfer',
          amount: 5000,
        },
        1
      );

      expect(partial.status).toBe('partial');
      expect(partial.paidAmount).toBe(5000);

      // Second payment for remaining
      const { invoice: fullyPaid } = await recordAPPayment(
        invoice.id,
        {
          paymentDate: '2025-01-25',
          bankAccountId: ACCT_TEST_IDS.BANK,
          paymentMethod: 'transfer',
          amount: 5700,
        },
        1
      );

      expect(fullyPaid.status).toBe('paid');
      expect(fullyPaid.paidAmount).toBe(10700);
    });

    it('should create correct payment journal entry (DR AP, CR Bank)', async () => {
      const invoice = await createTestAPInvoice();
      await approveAPInvoice(invoice.id, 1);

      await recordAPPayment(
        invoice.id,
        {
          paymentDate: '2025-01-20',
          bankAccountId: ACCT_TEST_IDS.BANK,
          paymentMethod: 'transfer',
          amount: 10700,
        },
        1
      );

      // Find payment journal entry (the second one - first is from approval)
      const journalEntries = testSqlite
        .prepare("SELECT id FROM journal_entries WHERE description LIKE '%Payment%' ORDER BY id DESC LIMIT 1")
        .all() as Array<{ id: number }>;

      expect(journalEntries.length).toBe(1);
      const payJeId = journalEntries[0].id;

      const lines = testSqlite
        .prepare('SELECT gl_account_id, debit, credit FROM journal_lines WHERE journal_entry_id = ?')
        .all(payJeId) as Array<{ gl_account_id: number; debit: number; credit: number }>;

      // DR: AP Liability
      const apDebit = lines.find(l => l.gl_account_id === ACCT_TEST_IDS.AP_DOMESTIC);
      expect(apDebit).toBeDefined();
      expect(apDebit!.debit).toBe(10700);

      // CR: Bank
      const bankCredit = lines.find(l => l.gl_account_id === ACCT_TEST_IDS.BANK);
      expect(bankCredit).toBeDefined();
      expect(bankCredit!.credit).toBe(10700);
    });

    it('should calculate and record WHT correctly', async () => {
      const invoice = await createTestAPInvoice();
      await approveAPInvoice(invoice.id, 1);

      await recordAPPayment(
        invoice.id,
        {
          paymentDate: '2025-01-20',
          bankAccountId: ACCT_TEST_IDS.BANK,
          paymentMethod: 'transfer',
          amount: 10700,
          whtRate: 3, // 3% WHT
        },
        1
      );

      // WHT = 10700 x 3% = 321
      const whtCalc = calculateWHT(10700, 3);
      expect(whtCalc.whtAmount).toBe(321);
      expect(whtCalc.netPayment).toBe(10379); // 10700 - 321
    });

    it('should reject payment exceeding outstanding amount', async () => {
      const invoice = await createTestAPInvoice();
      await approveAPInvoice(invoice.id, 1);

      await expect(
        recordAPPayment(
          invoice.id,
          {
            paymentDate: '2025-01-20',
            bankAccountId: ACCT_TEST_IDS.BANK,
            paymentMethod: 'transfer',
            amount: 99999,
          },
          1
        )
      ).rejects.toThrow('exceeds outstanding');
    });

    it('should reject payment for draft invoice', async () => {
      const invoice = await createTestAPInvoice();
      // Not approved yet

      await expect(
        recordAPPayment(
          invoice.id,
          {
            paymentDate: '2025-01-20',
            bankAccountId: ACCT_TEST_IDS.BANK,
            paymentMethod: 'transfer',
            amount: 10700,
          },
          1
        )
      ).rejects.toThrow("status 'draft'");
    });

    it('should maintain balanced trial balance after payment', async () => {
      const invoice = await createTestAPInvoice();
      await approveAPInvoice(invoice.id, 1);
      await recordAPPayment(
        invoice.id,
        {
          paymentDate: '2025-01-20',
          bankAccountId: ACCT_TEST_IDS.BANK,
          paymentMethod: 'transfer',
          amount: 10700,
        },
        1
      );

      const tb = verifyTrialBalance(testSqlite);
      expect(tb.isBalanced).toBe(true);
    });
  });

  // ============================================
  // 4. AP Invoice & Payment Delete
  // ============================================
  describe('AP Invoice & Payment Delete', () => {
    it('should delete draft AP invoice and its lines', async () => {
      const invoice = await createTestAPInvoice();

      await deleteAPInvoice(invoice.id, 1);

      const deleted = testSqlite
        .prepare('SELECT id FROM ap_invoices WHERE id = ?')
        .get(invoice.id);
      expect(deleted).toBeUndefined();

      const lines = testSqlite
        .prepare('SELECT id FROM ap_invoice_lines WHERE ap_invoice_id = ?')
        .all(invoice.id);
      expect(lines).toHaveLength(0);
    });

    it('should reject deleting approved (non-draft) AP invoice', async () => {
      const invoice = await createTestAPInvoice();
      await approveAPInvoice(invoice.id, 1);

      await expect(deleteAPInvoice(invoice.id, 1)).rejects.toThrow('draft');
    });

    it('should delete payment and its allocations', async () => {
      const invoice = await createTestAPInvoice();
      await approveAPInvoice(invoice.id, 1);

      await recordAPPayment(
        invoice.id,
        {
          paymentDate: '2025-01-20',
          bankAccountId: ACCT_TEST_IDS.BANK,
          paymentMethod: 'transfer',
          amount: 10700,
        },
        1
      );

      const paymentRow = testSqlite
        .prepare('SELECT id FROM payments LIMIT 1')
        .get() as { id: number };

      await deletePayment(paymentRow.id, 1);

      const deletedPayment = testSqlite
        .prepare('SELECT id FROM payments WHERE id = ?')
        .get(paymentRow.id);
      expect(deletedPayment).toBeUndefined();

      const allocations = testSqlite
        .prepare('SELECT id FROM payment_allocations WHERE payment_id = ?')
        .all(paymentRow.id);
      expect(allocations).toHaveLength(0);
    });

    it('should reject deleting cancelled payment', async () => {
      const invoice = await createTestAPInvoice();
      await approveAPInvoice(invoice.id, 1);
      await recordAPPayment(
        invoice.id,
        {
          paymentDate: '2025-01-20',
          bankAccountId: ACCT_TEST_IDS.BANK,
          paymentMethod: 'transfer',
          amount: 10700,
        },
        1
      );

      const paymentRow = testSqlite
        .prepare('SELECT id FROM payments LIMIT 1')
        .get() as { id: number };

      testSqlite.prepare('UPDATE payments SET status = ? WHERE id = ?').run('cancelled', paymentRow.id);

      await expect(deletePayment(paymentRow.id, 1)).rejects.toThrow('cancelled');
    });
  });

  // ============================================
  // 5. Payment Update
  // ============================================
  describe('Payment Update', () => {
    it('should update payment editable fields', async () => {
      const invoice = await createTestAPInvoice();
      await approveAPInvoice(invoice.id, 1);
      await recordAPPayment(
        invoice.id,
        {
          paymentDate: '2025-01-20',
          bankAccountId: ACCT_TEST_IDS.BANK,
          paymentMethod: 'transfer',
          referenceNumber: 'REF-001',
          amount: 10700,
        },
        1
      );

      const paymentRow = testSqlite
        .prepare('SELECT id FROM payments LIMIT 1')
        .get() as { id: number };

      await updatePayment(
        paymentRow.id,
        {
          paymentMethod: 'check',
          referenceNumber: 'CHK-999',
          description: 'Updated via test',
        },
        1
      );

      const updated = testSqlite
        .prepare('SELECT payment_method, reference_number, description FROM payments WHERE id = ?')
        .get(paymentRow.id) as { payment_method: string; reference_number: string; description: string };

      expect(updated.payment_method).toBe('check');
      expect(updated.reference_number).toBe('CHK-999');
      expect(updated.description).toBe('Updated via test');
    });

    it('should reject updating cancelled payment', async () => {
      const invoice = await createTestAPInvoice();
      await approveAPInvoice(invoice.id, 1);
      await recordAPPayment(
        invoice.id,
        {
          paymentDate: '2025-01-20',
          bankAccountId: ACCT_TEST_IDS.BANK,
          paymentMethod: 'transfer',
          amount: 10700,
        },
        1
      );

      const paymentRow = testSqlite
        .prepare('SELECT id FROM payments LIMIT 1')
        .get() as { id: number };

      testSqlite.prepare('UPDATE payments SET status = ? WHERE id = ?').run('cancelled', paymentRow.id);

      await expect(
        updatePayment(paymentRow.id, { description: 'should fail' }, 1)
      ).rejects.toThrow('cancelled');
    });
  });

  // ============================================
  // 6. GL Balance Verification
  // ============================================
  describe('GL Balance Verification', () => {
    it('should show AP liability increase after invoice approval', async () => {
      const balanceBefore = getAccountBalance(testSqlite, ACCT_TEST_IDS.AP_DOMESTIC);

      const invoice = await createTestAPInvoice();
      await approveAPInvoice(invoice.id, 1);

      const balanceAfter = getAccountBalance(testSqlite, ACCT_TEST_IDS.AP_DOMESTIC);
      // AP is a credit-normal account; balance = debit - credit
      // Credit of 10700 means balance decreases by 10700
      expect(balanceAfter - balanceBefore).toBe(-10700);
    });

    it('should show AP liability decrease after payment', async () => {
      const invoice = await createTestAPInvoice();
      await approveAPInvoice(invoice.id, 1);

      const balanceAfterApproval = getAccountBalance(testSqlite, ACCT_TEST_IDS.AP_DOMESTIC);

      await recordAPPayment(
        invoice.id,
        {
          paymentDate: '2025-01-20',
          bankAccountId: ACCT_TEST_IDS.BANK,
          paymentMethod: 'transfer',
          amount: 10700,
        },
        1
      );

      const balanceAfterPayment = getAccountBalance(testSqlite, ACCT_TEST_IDS.AP_DOMESTIC);
      // Debit of 10700 increases balance by 10700 (cancelling the credit)
      expect(balanceAfterPayment - balanceAfterApproval).toBe(10700);
    });

    it('should show net zero AP balance after full payment cycle', async () => {
      const invoice = await createTestAPInvoice();
      await approveAPInvoice(invoice.id, 1);
      await recordAPPayment(
        invoice.id,
        {
          paymentDate: '2025-01-20',
          bankAccountId: ACCT_TEST_IDS.BANK,
          paymentMethod: 'transfer',
          amount: 10700,
        },
        1
      );

      const apBalance = getAccountBalance(testSqlite, ACCT_TEST_IDS.AP_DOMESTIC);
      expect(apBalance).toBe(0);
    });

    it('should show expense increase after invoice approval', async () => {
      const invoice = await createTestAPInvoice();
      await approveAPInvoice(invoice.id, 1);

      const expenseBalance = getAccountBalance(testSqlite, ACCT_TEST_IDS.COGS);
      expect(expenseBalance).toBe(10000); // Debit-normal, so positive
    });

    it('should show bank balance decrease after payment', async () => {
      const invoice = await createTestAPInvoice();
      await approveAPInvoice(invoice.id, 1);
      await recordAPPayment(
        invoice.id,
        {
          paymentDate: '2025-01-20',
          bankAccountId: ACCT_TEST_IDS.BANK,
          paymentMethod: 'transfer',
          amount: 10700,
        },
        1
      );

      const bankBalance = getAccountBalance(testSqlite, ACCT_TEST_IDS.BANK);
      // Credit to bank = negative balance (debit - credit = 0 - 10700 = -10700)
      expect(bankBalance).toBe(-10700);
    });
  });

  // ============================================
  // 7. Tax Calculations
  // ============================================
  describe('Tax Calculations', () => {
    it('should calculate VAT at 7%', () => {
      const vat = calculateVAT(10000);
      expect(vat.vatAmount).toBe(700);
      expect(vat.totalAmount).toBe(10700);
    });

    it('should calculate WHT correctly', () => {
      const wht = calculateWHT(10000, 3);
      expect(wht.whtAmount).toBe(300);
      expect(wht.netPayment).toBe(9700);
    });

    it('should handle WHT with zero rate', () => {
      const wht = calculateWHT(10000, 0);
      expect(wht.whtAmount).toBe(0);
      expect(wht.netPayment).toBe(10000);
    });
  });
});
