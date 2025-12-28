/**
 * AR Invoice Service Unit Tests
 * Feature: 010-accounting-module-integration
 * User Story 3: Record Order-to-Cash Transactions
 *
 * Tests AR invoice CRUD functions:
 * - generateTaxInvoiceNumber() - Thai format T-YYYYMM-NNNNNN
 * - generateARInvoiceNumber() - Format AR-YYYYMM-NNNNNN
 * - createARInvoice() with VAT calculation
 * - getARInvoiceById()
 * - listARInvoices() with filters
 * - updateARInvoice() for draft status
 * - confirmARInvoice() with journal entry and Output VAT
 * - recordARPayment() - customer receipts
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
} from '../../helpers/seed-accounting';

// Store db reference for module mock
let testSqlite: Database.Database;
let testDb: ReturnType<typeof drizzle>;

// Mock db module
vi.mock('@/lib/db', () => ({
  isSqlite: () => true,
  db: () => testDb,
  getSqliteDb: () => testDb,
  schema,
}));

// Mock audit module
vi.mock('@/lib/audit', () => ({
  createAuditLog: vi.fn(() => Promise.resolve()),
}));

// Import after mocks are set up
import {
  createARInvoice,
  getARInvoiceById,
  listARInvoices,
  updateARInvoice,
  confirmARInvoice,
  recordARPayment,
  generateTaxInvoiceNumber,
  generateARInvoiceNumber,
  calculateVAT,
  THAI_VAT_RATE,
} from '@/lib/services/accounting.service';

describe('AR Invoice Service', () => {
  beforeEach(() => {
    // Create in-memory SQLite database
    testSqlite = new Database(':memory:');
    testSqlite.pragma('journal_mode = WAL');
    testDb = drizzle(testSqlite, { schema });

    // Create required tables
    const tables = [
      schema.sqliteGLAccountTypes,
      schema.sqliteGLAccounts,
      schema.sqliteFiscalYears,
      schema.sqliteFiscalPeriods,
      schema.sqliteJournalEntries,
      schema.sqliteJournalLines,
      schema.sqliteCustomers,
      schema.sqliteARInvoices,
      schema.sqliteARInvoiceLines,
      schema.sqlitePayments,
      schema.sqlitePaymentAllocations,
      schema.sqliteVATTransactions,
      schema.sqliteUsers,
    ];

    for (const table of tables) {
      try {
        const createSql = generateCreateTableSql(table);
        testSqlite.exec(createSql);
      } catch {
        // Table might already exist
      }
    }

    // Seed test data
    seedGLAccountTypes(testSqlite);
    seedGLAccounts(testSqlite);
    seedFiscalYearAndPeriods(testSqlite);
    seedCustomers(testSqlite);

    // Create test user
    testSqlite.exec(`
      INSERT INTO users (id, email, password, name, role, is_active, created_at, updated_at)
      VALUES (1, 'test@test.com', 'hash', 'Test User', 'admin', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    console.log('Setting up test environment...');
  });

  afterEach(() => {
    console.log('Cleaning up test environment...');
    testSqlite.close();
    vi.clearAllMocks();
  });

  // ============================================
  // Tax Invoice Number Generation Tests
  // ============================================

  describe('generateTaxInvoiceNumber()', () => {
    it('should generate Thai tax invoice number in T-YYYYMM-NNNNNN format', async () => {
      const taxInvoiceNumber = await generateTaxInvoiceNumber('2025-06-15');
      expect(taxInvoiceNumber).toMatch(/^T-202506-\d{6}$/);
      expect(taxInvoiceNumber).toBe('T-202506-000001');
    });

    it('should increment sequence for same month', async () => {
      const first = await generateTaxInvoiceNumber('2025-06-15');
      expect(first).toBe('T-202506-000001');

      // Insert a tax invoice to simulate existing record
      testSqlite.exec(`
        INSERT INTO ar_invoices (
          invoice_number, tax_invoice_number, customer_id, invoice_date, due_date,
          subtotal, vat_amount, total_amount, paid_amount, currency, status,
          created_by, created_at, updated_at
        ) VALUES (
          'AR-202506-000001', 'T-202506-000001', 1, '2025-06-15', '2025-06-30',
          10000, 700, 10700, 0, 'THB', 'draft', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `);

      const second = await generateTaxInvoiceNumber('2025-06-20');
      expect(second).toBe('T-202506-000002');
    });

    it('should reset sequence for new month', async () => {
      // Create June invoice
      testSqlite.exec(`
        INSERT INTO ar_invoices (
          invoice_number, tax_invoice_number, customer_id, invoice_date, due_date,
          subtotal, vat_amount, total_amount, paid_amount, currency, status,
          created_by, created_at, updated_at
        ) VALUES (
          'AR-202506-000001', 'T-202506-000005', 1, '2025-06-15', '2025-06-30',
          10000, 700, 10700, 0, 'THB', 'draft', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `);

      // Generate July invoice
      const julyNumber = await generateTaxInvoiceNumber('2025-07-05');
      expect(julyNumber).toBe('T-202507-000001');
    });
  });

  describe('generateARInvoiceNumber()', () => {
    it('should generate AR invoice number in AR-YYYYMM-NNNNNN format', async () => {
      const invoiceNumber = await generateARInvoiceNumber('2025-06-15');
      expect(invoiceNumber).toMatch(/^AR-202506-\d{6}$/);
      expect(invoiceNumber).toBe('AR-202506-000001');
    });
  });

  // ============================================
  // Create AR Invoice Tests
  // ============================================

  describe('createARInvoice()', () => {
    it('should create AR invoice with correct VAT calculation', async () => {
      const invoice = await createARInvoice(
        {
          invoiceNumber: 'AR-202506-000001',
          taxInvoiceNumber: 'T-202506-000001',
          customerId: ACCT_TEST_IDS.CUSTOMER_1,
          invoiceDate: '2025-06-15',
          dueDate: '2025-06-30',
          description: 'Test AR Invoice',
          lines: [
            {
              description: 'Product Sale',
              glAccountId: ACCT_TEST_IDS.SALES_REVENUE,
              quantity: 2,
              unitPrice: 5000,
            },
          ],
        },
        1
      );

      expect(invoice).toBeDefined();
      expect(invoice.id).toBeGreaterThan(0);
      expect(invoice.invoiceNumber).toBe('AR-202506-000001');
      expect(invoice.taxInvoiceNumber).toBe('T-202506-000001');
      expect(invoice.customerId).toBe(ACCT_TEST_IDS.CUSTOMER_1);
      expect(invoice.status).toBe('draft');

      // Check amounts: 2 x 5000 = 10000 + VAT 7% = 10700
      expect(invoice.subtotal).toBe(10000);
      expect(invoice.vatAmount).toBe(700);
      expect(invoice.totalAmount).toBe(10700);
      expect(invoice.paidAmount).toBe(0);
    });

    it('should create invoice with multiple lines', async () => {
      const invoice = await createARInvoice(
        {
          invoiceNumber: 'AR-202506-000002',
          taxInvoiceNumber: 'T-202506-000002',
          customerId: ACCT_TEST_IDS.CUSTOMER_1,
          invoiceDate: '2025-06-15',
          dueDate: '2025-06-30',
          lines: [
            {
              description: 'Product A',
              glAccountId: ACCT_TEST_IDS.SALES_REVENUE,
              quantity: 1,
              unitPrice: 10000,
            },
            {
              description: 'Product B',
              glAccountId: ACCT_TEST_IDS.SALES_REVENUE,
              quantity: 2,
              unitPrice: 2500,
            },
          ],
        },
        1
      );

      // 10000 + 5000 = 15000 + VAT 7% = 16050
      expect(invoice.subtotal).toBe(15000);
      expect(invoice.vatAmount).toBe(1050);
      expect(invoice.totalAmount).toBe(16050);
      expect(invoice.lines).toHaveLength(2);
    });
  });

  // ============================================
  // Get/List AR Invoice Tests
  // ============================================

  describe('getARInvoiceById()', () => {
    it('should get AR invoice with lines', async () => {
      const created = await createARInvoice(
        {
          invoiceNumber: 'AR-202506-000003',
          taxInvoiceNumber: 'T-202506-000003',
          customerId: ACCT_TEST_IDS.CUSTOMER_1,
          invoiceDate: '2025-06-15',
          dueDate: '2025-06-30',
          lines: [
            {
              description: 'Service',
              glAccountId: ACCT_TEST_IDS.SALES_REVENUE,
              quantity: 1,
              unitPrice: 20000,
            },
          ],
        },
        1
      );

      const invoice = await getARInvoiceById(created.id);

      expect(invoice.id).toBe(created.id);
      expect(invoice.invoiceNumber).toBe('AR-202506-000003');
      expect(invoice.lines).toHaveLength(1);
      expect(invoice.lines![0].description).toBe('Service');
    });

    it('should throw error for non-existent invoice', async () => {
      await expect(getARInvoiceById(99999)).rejects.toThrow('not found');
    });
  });

  describe('listARInvoices()', () => {
    beforeEach(async () => {
      // Create test invoices
      await createARInvoice(
        {
          invoiceNumber: 'AR-202506-000010',
          taxInvoiceNumber: 'T-202506-000010',
          customerId: ACCT_TEST_IDS.CUSTOMER_1,
          invoiceDate: '2025-06-01',
          dueDate: '2025-06-15',
          lines: [
            { description: 'Item 1', glAccountId: ACCT_TEST_IDS.SALES_REVENUE, quantity: 1, unitPrice: 1000 },
          ],
        },
        1
      );

      await createARInvoice(
        {
          invoiceNumber: 'AR-202506-000011',
          taxInvoiceNumber: 'T-202506-000011',
          customerId: ACCT_TEST_IDS.CUSTOMER_1,
          invoiceDate: '2025-06-10',
          dueDate: '2025-06-25',
          lines: [
            { description: 'Item 2', glAccountId: ACCT_TEST_IDS.SALES_REVENUE, quantity: 1, unitPrice: 2000 },
          ],
        },
        1
      );
    });

    it('should list all AR invoices', async () => {
      const invoices = await listARInvoices();
      expect(invoices.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter by customerId', async () => {
      const invoices = await listARInvoices({ customerId: ACCT_TEST_IDS.CUSTOMER_1 });
      expect(invoices.length).toBeGreaterThanOrEqual(2);
      invoices.forEach((inv) => {
        expect(inv.customerId).toBe(ACCT_TEST_IDS.CUSTOMER_1);
      });
    });

    it('should filter by status', async () => {
      const drafts = await listARInvoices({ status: 'draft' });
      drafts.forEach((inv) => {
        expect(inv.status).toBe('draft');
      });
    });

    it('should filter by date range', async () => {
      const invoices = await listARInvoices({
        dateFrom: '2025-06-05',
        dateTo: '2025-06-15',
      });
      expect(invoices.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ============================================
  // Update AR Invoice Tests
  // ============================================

  describe('updateARInvoice()', () => {
    it('should update draft invoice', async () => {
      const created = await createARInvoice(
        {
          invoiceNumber: 'AR-202506-000020',
          taxInvoiceNumber: 'T-202506-000020',
          customerId: ACCT_TEST_IDS.CUSTOMER_1,
          invoiceDate: '2025-06-15',
          dueDate: '2025-06-30',
          lines: [
            { description: 'Original', glAccountId: ACCT_TEST_IDS.SALES_REVENUE, quantity: 1, unitPrice: 1000 },
          ],
        },
        1
      );

      const updated = await updateARInvoice(
        created.id,
        { description: 'Updated description' },
        1
      );

      expect(updated.description).toBe('Updated description');
    });

    it('should not update non-draft invoice', async () => {
      const created = await createARInvoice(
        {
          invoiceNumber: 'AR-202506-000021',
          taxInvoiceNumber: 'T-202506-000021',
          customerId: ACCT_TEST_IDS.CUSTOMER_1,
          invoiceDate: '2025-06-15',
          dueDate: '2025-06-30',
          lines: [
            { description: 'Test', glAccountId: ACCT_TEST_IDS.SALES_REVENUE, quantity: 1, unitPrice: 1000 },
          ],
        },
        1
      );

      // Confirm the invoice
      await confirmARInvoice(created.id, 1);

      // Try to update confirmed invoice
      await expect(
        updateARInvoice(created.id, { description: 'Changed' }, 1)
      ).rejects.toThrow('draft');
    });
  });

  // ============================================
  // Confirm AR Invoice Tests
  // ============================================

  describe('confirmARInvoice()', () => {
    it('should confirm invoice and create journal entry with Output VAT', async () => {
      const created = await createARInvoice(
        {
          invoiceNumber: 'AR-202506-000030',
          taxInvoiceNumber: 'T-202506-000030',
          customerId: ACCT_TEST_IDS.CUSTOMER_1,
          invoiceDate: '2025-06-15',
          dueDate: '2025-06-30',
          description: 'Sales invoice for test',
          lines: [
            {
              description: 'Product sale',
              glAccountId: ACCT_TEST_IDS.SALES_REVENUE,
              quantity: 10,
              unitPrice: 1000, // 10,000 + 700 VAT = 10,700
            },
          ],
        },
        1
      );

      const confirmed = await confirmARInvoice(created.id, 1);

      expect(confirmed.status).toBe('posted');
      expect(confirmed.journalEntryId).not.toBeNull();

      // Verify journal entry was created
      const jeResult = testSqlite.prepare(
        'SELECT * FROM journal_entries WHERE id = ?'
      ).get(confirmed.journalEntryId) as { id: number; entry_number: string; total_debit: number; total_credit: number } | undefined;

      expect(jeResult).toBeDefined();
      expect(jeResult!.total_debit).toBe(10700);
      expect(jeResult!.total_credit).toBe(10700);

      // Verify journal lines (AR Dr, Revenue Cr, VAT Cr)
      const lines = testSqlite.prepare(
        'SELECT * FROM journal_lines WHERE journal_entry_id = ? ORDER BY line_number'
      ).all(confirmed.journalEntryId) as { debit: number; credit: number }[];

      expect(lines.length).toBe(3);

      // Total debits should equal total credits
      const totalDebits = lines.reduce((sum, l) => sum + l.debit, 0);
      const totalCredits = lines.reduce((sum, l) => sum + l.credit, 0);
      expect(totalDebits).toBe(totalCredits);
      expect(totalDebits).toBe(10700);
    });

    it('should not confirm already confirmed invoice', async () => {
      const created = await createARInvoice(
        {
          invoiceNumber: 'AR-202506-000031',
          taxInvoiceNumber: 'T-202506-000031',
          customerId: ACCT_TEST_IDS.CUSTOMER_1,
          invoiceDate: '2025-06-15',
          dueDate: '2025-06-30',
          lines: [
            { description: 'Test', glAccountId: ACCT_TEST_IDS.SALES_REVENUE, quantity: 1, unitPrice: 1000 },
          ],
        },
        1
      );

      await confirmARInvoice(created.id, 1);

      await expect(confirmARInvoice(created.id, 1)).rejects.toThrow();
    });
  });

  // ============================================
  // Record AR Payment Tests
  // ============================================

  describe('recordARPayment()', () => {
    it('should record full payment and mark invoice as paid', async () => {
      const invoice = await createARInvoice(
        {
          invoiceNumber: 'AR-202506-000040',
          taxInvoiceNumber: 'T-202506-000040',
          customerId: ACCT_TEST_IDS.CUSTOMER_1,
          invoiceDate: '2025-06-15',
          dueDate: '2025-06-30',
          lines: [
            { description: 'Test', glAccountId: ACCT_TEST_IDS.SALES_REVENUE, quantity: 1, unitPrice: 10000 },
          ],
        },
        1
      );

      // Confirm to make it payable
      await confirmARInvoice(invoice.id, 1);

      const { payment, invoice: updatedInvoice } = await recordARPayment(
        invoice.id,
        {
          paymentDate: '2025-06-20',
          bankAccountId: ACCT_TEST_IDS.BANK,
          paymentMethod: 'transfer',
          referenceNumber: 'REC-001',
          amount: 10700, // Full amount
        },
        1
      );

      expect(payment.paymentNumber).toMatch(/^RC-202506-\d{6}$/);
      expect(updatedInvoice.status).toBe('paid');
      expect(updatedInvoice.paidAmount).toBe(10700);
    });

    it('should record partial payment and mark invoice as partial', async () => {
      const invoice = await createARInvoice(
        {
          invoiceNumber: 'AR-202506-000041',
          taxInvoiceNumber: 'T-202506-000041',
          customerId: ACCT_TEST_IDS.CUSTOMER_1,
          invoiceDate: '2025-06-15',
          dueDate: '2025-06-30',
          lines: [
            { description: 'Test', glAccountId: ACCT_TEST_IDS.SALES_REVENUE, quantity: 1, unitPrice: 10000 },
          ],
        },
        1
      );

      await confirmARInvoice(invoice.id, 1);

      const { invoice: updatedInvoice } = await recordARPayment(
        invoice.id,
        {
          paymentDate: '2025-06-20',
          bankAccountId: ACCT_TEST_IDS.BANK,
          paymentMethod: 'cash',
          amount: 5000, // Partial
        },
        1
      );

      expect(updatedInvoice.status).toBe('partial');
      expect(updatedInvoice.paidAmount).toBe(5000);
    });

    it('should not allow payment exceeding outstanding amount', async () => {
      const invoice = await createARInvoice(
        {
          invoiceNumber: 'AR-202506-000042',
          taxInvoiceNumber: 'T-202506-000042',
          customerId: ACCT_TEST_IDS.CUSTOMER_1,
          invoiceDate: '2025-06-15',
          dueDate: '2025-06-30',
          lines: [
            { description: 'Test', glAccountId: ACCT_TEST_IDS.SALES_REVENUE, quantity: 1, unitPrice: 1000 },
          ],
        },
        1
      );

      await confirmARInvoice(invoice.id, 1);

      await expect(
        recordARPayment(
          invoice.id,
          {
            paymentDate: '2025-06-20',
            bankAccountId: ACCT_TEST_IDS.BANK,
            paymentMethod: 'transfer',
            amount: 2000, // More than 1070
          },
          1
        )
      ).rejects.toThrow('exceeds');
    });

    it('should not allow payment on draft invoice', async () => {
      const invoice = await createARInvoice(
        {
          invoiceNumber: 'AR-202506-000043',
          taxInvoiceNumber: 'T-202506-000043',
          customerId: ACCT_TEST_IDS.CUSTOMER_1,
          invoiceDate: '2025-06-15',
          dueDate: '2025-06-30',
          lines: [
            { description: 'Test', glAccountId: ACCT_TEST_IDS.SALES_REVENUE, quantity: 1, unitPrice: 1000 },
          ],
        },
        1
      );

      await expect(
        recordARPayment(
          invoice.id,
          {
            paymentDate: '2025-06-20',
            bankAccountId: ACCT_TEST_IDS.BANK,
            paymentMethod: 'transfer',
            amount: 1070,
          },
          1
        )
      ).rejects.toThrow("Cannot record payment for invoice with status 'draft'");
    });
  });

  // ============================================
  // VAT Calculation Tests
  // ============================================

  describe('calculateVAT()', () => {
    it('should calculate VAT correctly with Thai 7% rate', () => {
      expect(THAI_VAT_RATE).toBe(0.07);

      const result = calculateVAT(10000);
      expect(result.baseAmount).toBe(10000);
      expect(result.vatAmount).toBe(700);
      expect(result.totalAmount).toBe(10700);
    });

    it('should handle VAT inclusive calculation', () => {
      const result = calculateVAT(10700, true);
      expect(result.baseAmount).toBe(10000);
      expect(result.vatAmount).toBe(700);
      expect(result.totalAmount).toBe(10700);
    });
  });
});
