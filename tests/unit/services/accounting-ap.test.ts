/**
 * AP Invoice Service Unit Tests
 * Feature: 010-accounting-module-integration
 * User Story 2: Record Purchase-to-Pay Transactions
 *
 * Tests AP invoice CRUD functions:
 * - createAPInvoice() with VAT calculation
 * - getAPInvoiceById()
 * - listAPInvoices() with filters
 * - updateAPInvoice() for draft status
 * - approveAPInvoice() with journal entry creation
 * - recordAPPayment() with WHT support
 * - createVATTransaction()
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
} from '../../helpers/seed-accounting';

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

// Mock audit module
vi.mock('@/lib/audit', () => ({
  createAuditLog: vi.fn(() => Promise.resolve()),
}));

// Import after mocks are set up
import {
  createAPInvoice,
  getAPInvoiceById,
  listAPInvoices,
  updateAPInvoice,
  approveAPInvoice,
  recordAPPayment,
  createVATTransaction,
  calculateVAT,
  calculateWHT,
  THAI_VAT_RATE,
} from '@/lib/services/accounting.service';

describe('AP Invoice Service', () => {
  beforeEach(() => {
    testSqlite = new Database(':memory:');
    testSqlite.pragma('journal_mode = WAL');
    testDb = drizzle(testSqlite, { schema });
    setTestDb(testDb);

    const tables = [
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
    ];

    for (const table of tables) {
      try {
        const createSql = generateCreateTableSql(table);
        testSqlite.exec(createSql);
      } catch (err) {
        // Table might already exist
      }
    }

    // Seed test data
    seedGLAccountTypes(testSqlite);
    seedGLAccounts(testSqlite);
    seedFiscalYearAndPeriods(testSqlite);
    seedVendors(testSqlite);

    // Create test user
    testSqlite.exec(`
      INSERT OR IGNORE INTO users (id, name, email, password, role, is_active)
      VALUES (1, 'Test User', 'test@test.com', 'hash', 'admin', 1)
    `);
  });

  afterEach(() => {
    if (testSqlite) {
      testSqlite.close();
    }
    vi.clearAllMocks();
  });

  describe('calculateVAT', () => {
    it('should calculate VAT correctly for exclusive amount', () => {
      const result = calculateVAT(1000, false);

      expect(result.baseAmount).toBe(1000);
      expect(result.vatAmount).toBe(70); // 7%
      expect(result.totalAmount).toBe(1070);
    });

    it('should extract VAT correctly for inclusive amount', () => {
      const result = calculateVAT(1070, true);

      expect(result.baseAmount).toBeCloseTo(1000, 2);
      expect(result.vatAmount).toBeCloseTo(70, 2);
      expect(result.totalAmount).toBe(1070);
    });

    it('should use 7% Thai VAT rate', () => {
      expect(THAI_VAT_RATE).toBe(0.07);
    });
  });

  describe('calculateWHT', () => {
    it('should calculate WHT correctly at 3%', () => {
      const result = calculateWHT(10000, 3);

      expect(result.whtAmount).toBe(300);
      expect(result.netPayment).toBe(9700);
    });

    it('should calculate WHT correctly at 5%', () => {
      const result = calculateWHT(10000, 5);

      expect(result.whtAmount).toBe(500);
      expect(result.netPayment).toBe(9500);
    });
  });

  describe('createAPInvoice', () => {
    it('should create AP invoice with lines', async () => {
      const invoice = await createAPInvoice(
        {
          invoiceNumber: 'INV-2025-001',
          vendorId: ACCT_TEST_IDS.VENDOR,
          invoiceDate: '2025-01-15',
          dueDate: '2025-02-15',
          receivedDate: '2025-01-15',
          description: 'Office supplies',
          lines: [
            {
              description: 'Printer paper',
              glAccountId: ACCT_TEST_IDS.EXPENSE,
              quantity: 10,
              unitPrice: 100,
            },
          ],
        },
        1
      );

      expect(invoice).toBeDefined();
      expect(invoice.invoiceNumber).toBe('INV-2025-001');
      expect(invoice.vendorId).toBe(ACCT_TEST_IDS.VENDOR);
      expect(invoice.status).toBe('draft');
      expect(invoice.subtotal).toBe(1000);
      expect(invoice.vatAmount).toBe(70); // 7% VAT
      expect(invoice.totalAmount).toBe(1070);
      expect(invoice.lines?.length).toBe(1);
    });

    it('should calculate totals for multiple lines', async () => {
      const invoice = await createAPInvoice(
        {
          invoiceNumber: 'INV-2025-002',
          vendorId: ACCT_TEST_IDS.VENDOR,
          invoiceDate: '2025-01-15',
          dueDate: '2025-02-15',
          receivedDate: '2025-01-15',
          lines: [
            {
              description: 'Item 1',
              glAccountId: ACCT_TEST_IDS.EXPENSE,
              quantity: 5,
              unitPrice: 200,
            },
            {
              description: 'Item 2',
              glAccountId: ACCT_TEST_IDS.EXPENSE,
              quantity: 3,
              unitPrice: 300,
            },
          ],
        },
        1
      );

      expect(invoice.subtotal).toBe(1900); // 1000 + 900
      expect(invoice.vatAmount).toBeCloseTo(133, 0); // 7% of 1900
      expect(invoice.lines?.length).toBe(2);
    });
  });

  describe('getAPInvoiceById', () => {
    it('should return invoice with lines', async () => {
      const created = await createAPInvoice(
        {
          invoiceNumber: 'INV-2025-003',
          vendorId: ACCT_TEST_IDS.VENDOR,
          invoiceDate: '2025-01-15',
          dueDate: '2025-02-15',
          receivedDate: '2025-01-15',
          lines: [
            {
              description: 'Test item',
              glAccountId: ACCT_TEST_IDS.EXPENSE,
              quantity: 1,
              unitPrice: 500,
            },
          ],
        },
        1
      );

      const invoice = await getAPInvoiceById(created.id);

      expect(invoice.id).toBe(created.id);
      expect(invoice.invoiceNumber).toBe('INV-2025-003');
      expect(invoice.lines).toBeDefined();
      expect(invoice.lines?.length).toBe(1);
    });

    it('should throw error for non-existent invoice', async () => {
      await expect(getAPInvoiceById(999999)).rejects.toThrow('not found');
    });
  });

  describe('listAPInvoices', () => {
    beforeEach(async () => {
      await createAPInvoice(
        {
          invoiceNumber: 'INV-A',
          vendorId: ACCT_TEST_IDS.VENDOR,
          invoiceDate: '2025-01-01',
          dueDate: '2025-02-01',
          receivedDate: '2025-01-01',
          lines: [{ description: 'A', glAccountId: ACCT_TEST_IDS.EXPENSE, quantity: 1, unitPrice: 100 }],
        },
        1
      );
      await createAPInvoice(
        {
          invoiceNumber: 'INV-B',
          vendorId: ACCT_TEST_IDS.VENDOR,
          invoiceDate: '2025-01-15',
          dueDate: '2025-02-15',
          receivedDate: '2025-01-15',
          lines: [{ description: 'B', glAccountId: ACCT_TEST_IDS.EXPENSE, quantity: 1, unitPrice: 200 }],
        },
        1
      );
    });

    it('should list all invoices', async () => {
      const invoices = await listAPInvoices({});

      expect(invoices.length).toBe(2);
    });

    it('should filter by status', async () => {
      const invoices = await listAPInvoices({ status: 'draft' });

      expect(invoices.length).toBe(2);
      invoices.forEach((inv) => expect(inv.status).toBe('draft'));
    });

    it('should search by invoice number', async () => {
      const invoices = await listAPInvoices({ search: 'INV-A' });

      expect(invoices.length).toBe(1);
      expect(invoices[0].invoiceNumber).toBe('INV-A');
    });
  });

  describe('updateAPInvoice', () => {
    it('should update draft invoice', async () => {
      const created = await createAPInvoice(
        {
          invoiceNumber: 'INV-UPDATE',
          vendorId: ACCT_TEST_IDS.VENDOR,
          invoiceDate: '2025-01-15',
          dueDate: '2025-02-15',
          receivedDate: '2025-01-15',
          lines: [{ description: 'Test', glAccountId: ACCT_TEST_IDS.EXPENSE, quantity: 1, unitPrice: 100 }],
        },
        1
      );

      const updated = await updateAPInvoice(
        created.id,
        { description: 'Updated description' },
        1
      );

      expect(updated.description).toBe('Updated description');
    });

    it('should throw error for non-draft invoice', async () => {
      const created = await createAPInvoice(
        {
          invoiceNumber: 'INV-NODRAFT',
          vendorId: ACCT_TEST_IDS.VENDOR,
          invoiceDate: '2025-01-15',
          dueDate: '2025-02-15',
          receivedDate: '2025-01-15',
          lines: [{ description: 'Test', glAccountId: ACCT_TEST_IDS.EXPENSE, quantity: 1, unitPrice: 100 }],
        },
        1
      );

      // Approve the invoice first
      await approveAPInvoice(created.id, 1);

      await expect(
        updateAPInvoice(created.id, { description: 'Try update' }, 1)
      ).rejects.toThrow('draft');
    });
  });

  describe('approveAPInvoice', () => {
    it('should approve invoice and create journal entry', async () => {
      const created = await createAPInvoice(
        {
          invoiceNumber: 'INV-APPROVE',
          vendorId: ACCT_TEST_IDS.VENDOR,
          invoiceDate: '2025-01-15',
          dueDate: '2025-02-15',
          receivedDate: '2025-01-15',
          lines: [{ description: 'Test', glAccountId: ACCT_TEST_IDS.EXPENSE, quantity: 1, unitPrice: 1000 }],
        },
        1
      );

      const approved = await approveAPInvoice(created.id, 1);

      expect(approved.status).toBe('posted');
      expect(approved.approvedBy).toBe(1);
      expect(approved.approvedAt).not.toBeNull();
      expect(approved.journalEntryId).not.toBeNull();
    });

    it('should throw error for non-draft invoice', async () => {
      const created = await createAPInvoice(
        {
          invoiceNumber: 'INV-DOUBLE',
          vendorId: ACCT_TEST_IDS.VENDOR,
          invoiceDate: '2025-01-15',
          dueDate: '2025-02-15',
          receivedDate: '2025-01-15',
          lines: [{ description: 'Test', glAccountId: ACCT_TEST_IDS.EXPENSE, quantity: 1, unitPrice: 100 }],
        },
        1
      );

      await approveAPInvoice(created.id, 1);

      await expect(approveAPInvoice(created.id, 1)).rejects.toThrow('Cannot approve');
    });
  });

  describe('recordAPPayment', () => {
    it('should record full payment', async () => {
      const created = await createAPInvoice(
        {
          invoiceNumber: 'INV-PAY',
          vendorId: ACCT_TEST_IDS.VENDOR,
          invoiceDate: '2025-01-15',
          dueDate: '2025-02-15',
          receivedDate: '2025-01-15',
          lines: [{ description: 'Test', glAccountId: ACCT_TEST_IDS.EXPENSE, quantity: 1, unitPrice: 1000 }],
        },
        1
      );

      await approveAPInvoice(created.id, 1);
      const approved = await getAPInvoiceById(created.id);

      const result = await recordAPPayment(
        created.id,
        {
          paymentDate: '2025-01-20',
          bankAccountId: ACCT_TEST_IDS.BANK,
          paymentMethod: 'transfer',
          amount: approved.totalAmount,
        },
        1
      );

      expect(result.payment.paymentNumber).toMatch(/^PY-\d{6}-\d{6}$/);
      expect(result.invoice.status).toBe('paid');
      expect(result.invoice.paidAmount).toBe(approved.totalAmount);
    });

    it('should record partial payment', async () => {
      const created = await createAPInvoice(
        {
          invoiceNumber: 'INV-PARTIAL',
          vendorId: ACCT_TEST_IDS.VENDOR,
          invoiceDate: '2025-01-15',
          dueDate: '2025-02-15',
          receivedDate: '2025-01-15',
          lines: [{ description: 'Test', glAccountId: ACCT_TEST_IDS.EXPENSE, quantity: 1, unitPrice: 1000 }],
        },
        1
      );

      await approveAPInvoice(created.id, 1);

      const result = await recordAPPayment(
        created.id,
        {
          paymentDate: '2025-01-20',
          bankAccountId: ACCT_TEST_IDS.BANK,
          paymentMethod: 'transfer',
          amount: 500,
        },
        1
      );

      expect(result.invoice.status).toBe('partial');
      expect(result.invoice.paidAmount).toBe(500);
    });

    it('should handle WHT deduction', async () => {
      const created = await createAPInvoice(
        {
          invoiceNumber: 'INV-WHT',
          vendorId: ACCT_TEST_IDS.VENDOR,
          invoiceDate: '2025-01-15',
          dueDate: '2025-02-15',
          receivedDate: '2025-01-15',
          lines: [{ description: 'Services', glAccountId: ACCT_TEST_IDS.EXPENSE, quantity: 1, unitPrice: 10000 }],
        },
        1
      );

      await approveAPInvoice(created.id, 1);
      const approved = await getAPInvoiceById(created.id);

      const result = await recordAPPayment(
        created.id,
        {
          paymentDate: '2025-01-20',
          bankAccountId: ACCT_TEST_IDS.BANK,
          paymentMethod: 'transfer',
          amount: approved.totalAmount,
          whtRate: 3, // 3% WHT
        },
        1
      );

      expect(result.payment.whtAmount).toBeGreaterThan(0);
      expect(result.payment.netPayment).toBeLessThan(result.payment.amount + result.payment.whtAmount);
    });

    it('should reject payment exceeding outstanding amount', async () => {
      const created = await createAPInvoice(
        {
          invoiceNumber: 'INV-OVER',
          vendorId: ACCT_TEST_IDS.VENDOR,
          invoiceDate: '2025-01-15',
          dueDate: '2025-02-15',
          receivedDate: '2025-01-15',
          lines: [{ description: 'Test', glAccountId: ACCT_TEST_IDS.EXPENSE, quantity: 1, unitPrice: 100 }],
        },
        1
      );

      await approveAPInvoice(created.id, 1);

      await expect(
        recordAPPayment(
          created.id,
          {
            paymentDate: '2025-01-20',
            bankAccountId: ACCT_TEST_IDS.BANK,
            paymentMethod: 'transfer',
            amount: 9999, // Way more than invoice total
          },
          1
        )
      ).rejects.toThrow('exceeds');
    });
  });

  describe('createVATTransaction', () => {
    it('should create input VAT transaction', async () => {
      const result = await createVATTransaction({
        transactionType: 'input',
        vendorId: ACCT_TEST_IDS.VENDOR,
        taxInvoiceNumber: 'TAX-001',
        taxInvoiceDate: '2025-01-15',
        taxableAmount: 1000,
        vatAmount: 70,
        partyName: 'Test Vendor',
        partyTaxId: '0123456789012',
      });

      expect(result.id).toBeDefined();
    });
  });
});
