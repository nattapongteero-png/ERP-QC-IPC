/**
 * Payment & Invoice Delete/Update Service Tests
 * Feature: 010-accounting-module-integration
 *
 * Tests for functions added during AP/AR edit/delete implementation:
 * - deletePayment() - removes payment + allocations
 * - updatePayment() - updates editable payment fields
 * - deleteAPInvoice() - removes draft AP invoice + lines
 * - deleteARInvoice() - removes draft AR invoice + lines
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

vi.mock('@/lib/audit', () => ({
  createAuditLog: vi.fn(() => Promise.resolve()),
}));

import {
  createAPInvoice,
  getAPInvoiceById,
  approveAPInvoice,
  recordAPPayment,
  deleteAPInvoice,
  deletePayment,
  updatePayment,
  createARInvoice,
  confirmARInvoice,
  deleteARInvoice,
} from '@/lib/services/accounting.service';

describe('Payment & Invoice Delete/Update', () => {
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
    ];

    for (const table of tables) {
      try {
        const createSql = generateCreateTableSql(table);
        testSqlite.exec(createSql);
      } catch {
        // Table might already exist
      }
    }

    seedGLAccountTypes(testSqlite);
    seedGLAccounts(testSqlite);
    seedFiscalYearAndPeriods(testSqlite);
    seedVendors(testSqlite);
    seedCustomers(testSqlite);

    testSqlite.exec(`
      INSERT OR IGNORE INTO users (id, name, email, password, role, is_active)
      VALUES (1, 'Test User', 'test@test.com', 'hash', 'admin', 1)
    `);
  });

  afterEach(() => {
    if (testSqlite) testSqlite.close();
    vi.clearAllMocks();
  });

  // ============================================
  // Helper: create an approved AP invoice with payment
  // ============================================
  async function createAPInvoiceWithPayment() {
    const invoice = await createAPInvoice(
      {
        invoiceNumber: 'AP-DEL-TEST',
        vendorId: ACCT_TEST_IDS.VENDOR,
        invoiceDate: '2025-01-15',
        dueDate: '2025-02-15',
        receivedDate: '2025-01-15',
        lines: [{ description: 'Test item', glAccountId: ACCT_TEST_IDS.EXPENSE, quantity: 1, unitPrice: 1000 }],
      },
      1
    );
    await approveAPInvoice(invoice.id, 1);
    const approved = await getAPInvoiceById(invoice.id);

    const result = await recordAPPayment(
      invoice.id,
      {
        paymentDate: '2025-01-20',
        bankAccountId: ACCT_TEST_IDS.BANK,
        paymentMethod: 'transfer',
        referenceNumber: 'REF-001',
        amount: approved.totalAmount,
        description: 'Test payment',
      },
      1
    );

    return { invoice: result.invoice, paymentNumber: result.payment.paymentNumber };
  }

  // ============================================
  // deletePayment
  // ============================================
  describe('deletePayment', () => {
    it('should delete an existing payment and its allocations', async () => {
      const { paymentNumber } = await createAPInvoiceWithPayment();

      // Find payment ID
      const paymentRow = testSqlite
        .prepare('SELECT id FROM payments WHERE payment_number = ?')
        .get(paymentNumber) as { id: number };

      await deletePayment(paymentRow.id, 1);

      // Verify payment is gone
      const deleted = testSqlite
        .prepare('SELECT id FROM payments WHERE id = ?')
        .get(paymentRow.id);
      expect(deleted).toBeUndefined();

      // Verify allocations are gone
      const allocations = testSqlite
        .prepare('SELECT id FROM payment_allocations WHERE payment_id = ?')
        .all(paymentRow.id);
      expect(allocations).toHaveLength(0);
    });

    it('should throw error when payment not found', async () => {
      await expect(deletePayment(99999, 1)).rejects.toThrow('not found');
    });

    it('should throw error when deleting cancelled payment', async () => {
      const { paymentNumber } = await createAPInvoiceWithPayment();

      const paymentRow = testSqlite
        .prepare('SELECT id FROM payments WHERE payment_number = ?')
        .get(paymentNumber) as { id: number };

      // Manually set status to cancelled
      testSqlite
        .prepare('UPDATE payments SET status = ? WHERE id = ?')
        .run('cancelled', paymentRow.id);

      await expect(deletePayment(paymentRow.id, 1)).rejects.toThrow('cancelled');
    });
  });

  // ============================================
  // updatePayment
  // ============================================
  describe('updatePayment', () => {
    it('should update payment editable fields', async () => {
      const { paymentNumber } = await createAPInvoiceWithPayment();

      const paymentRow = testSqlite
        .prepare('SELECT id FROM payments WHERE payment_number = ?')
        .get(paymentNumber) as { id: number };

      await updatePayment(
        paymentRow.id,
        {
          paymentDate: '2025-02-01',
          paymentMethod: 'check',
          referenceNumber: 'CHK-999',
          description: 'Updated description',
        },
        1
      );

      const updated = testSqlite
        .prepare('SELECT payment_method, reference_number, description FROM payments WHERE id = ?')
        .get(paymentRow.id) as { payment_method: string; reference_number: string; description: string };

      expect(updated.payment_method).toBe('check');
      expect(updated.reference_number).toBe('CHK-999');
      expect(updated.description).toBe('Updated description');
    });

    it('should update only provided fields (partial update)', async () => {
      const { paymentNumber } = await createAPInvoiceWithPayment();

      const paymentRow = testSqlite
        .prepare('SELECT id, reference_number FROM payments WHERE payment_number = ?')
        .get(paymentNumber) as { id: number; reference_number: string };

      const originalRef = paymentRow.reference_number;

      // Only update description
      await updatePayment(paymentRow.id, { description: 'Only desc changed' }, 1);

      const updated = testSqlite
        .prepare('SELECT reference_number, description FROM payments WHERE id = ?')
        .get(paymentRow.id) as { reference_number: string; description: string };

      expect(updated.description).toBe('Only desc changed');
      expect(updated.reference_number).toBe(originalRef);
    });

    it('should throw error when payment not found', async () => {
      await expect(
        updatePayment(99999, { description: 'test' }, 1)
      ).rejects.toThrow('not found');
    });

    it('should throw error when updating cancelled payment', async () => {
      const { paymentNumber } = await createAPInvoiceWithPayment();

      const paymentRow = testSqlite
        .prepare('SELECT id FROM payments WHERE payment_number = ?')
        .get(paymentNumber) as { id: number };

      testSqlite
        .prepare('UPDATE payments SET status = ? WHERE id = ?')
        .run('cancelled', paymentRow.id);

      await expect(
        updatePayment(paymentRow.id, { description: 'test' }, 1)
      ).rejects.toThrow('cancelled');
    });

    it('should allow clearing referenceNumber and description to null', async () => {
      const { paymentNumber } = await createAPInvoiceWithPayment();

      const paymentRow = testSqlite
        .prepare('SELECT id FROM payments WHERE payment_number = ?')
        .get(paymentNumber) as { id: number };

      await updatePayment(
        paymentRow.id,
        { referenceNumber: null, description: null },
        1
      );

      const updated = testSqlite
        .prepare('SELECT reference_number, description FROM payments WHERE id = ?')
        .get(paymentRow.id) as { reference_number: string | null; description: string | null };

      expect(updated.reference_number).toBeNull();
      expect(updated.description).toBeNull();
    });
  });

  // ============================================
  // deleteAPInvoice
  // ============================================
  describe('deleteAPInvoice', () => {
    it('should delete a draft AP invoice and its lines', async () => {
      const invoice = await createAPInvoice(
        {
          invoiceNumber: 'AP-DEL-DRAFT',
          vendorId: ACCT_TEST_IDS.VENDOR,
          invoiceDate: '2025-01-15',
          dueDate: '2025-02-15',
          receivedDate: '2025-01-15',
          lines: [
            { description: 'Line 1', glAccountId: ACCT_TEST_IDS.EXPENSE, quantity: 2, unitPrice: 500 },
            { description: 'Line 2', glAccountId: ACCT_TEST_IDS.EXPENSE, quantity: 1, unitPrice: 300 },
          ],
        },
        1
      );

      // Confirm invoice and lines exist
      const beforeLines = testSqlite
        .prepare('SELECT id FROM ap_invoice_lines WHERE ap_invoice_id = ?')
        .all(invoice.id);
      expect(beforeLines.length).toBe(2);

      await deleteAPInvoice(invoice.id, 1);

      // Invoice gone
      const deletedInvoice = testSqlite
        .prepare('SELECT id FROM ap_invoices WHERE id = ?')
        .get(invoice.id);
      expect(deletedInvoice).toBeUndefined();

      // Lines gone
      const deletedLines = testSqlite
        .prepare('SELECT id FROM ap_invoice_lines WHERE ap_invoice_id = ?')
        .all(invoice.id);
      expect(deletedLines).toHaveLength(0);
    });

    it('should reject deleting approved (non-draft) AP invoice', async () => {
      const invoice = await createAPInvoice(
        {
          invoiceNumber: 'AP-NO-DEL',
          vendorId: ACCT_TEST_IDS.VENDOR,
          invoiceDate: '2025-01-15',
          dueDate: '2025-02-15',
          receivedDate: '2025-01-15',
          lines: [{ description: 'Test', glAccountId: ACCT_TEST_IDS.EXPENSE, quantity: 1, unitPrice: 1000 }],
        },
        1
      );

      await approveAPInvoice(invoice.id, 1);

      await expect(deleteAPInvoice(invoice.id, 1)).rejects.toThrow('draft');
    });

    it('should throw error when AP invoice not found', async () => {
      await expect(deleteAPInvoice(99999, 1)).rejects.toThrow();
    });
  });

  // ============================================
  // deleteARInvoice
  // ============================================
  describe('deleteARInvoice', () => {
    it('should delete a draft AR invoice and its lines', async () => {
      const invoice = await createARInvoice(
        {
          invoiceNumber: 'AR-DEL-001',
          taxInvoiceNumber: 'TX-DEL-001',
          customerId: ACCT_TEST_IDS.CUSTOMER_1,
          invoiceDate: '2025-01-15',
          dueDate: '2025-02-15',
          description: 'Test AR invoice',
          lines: [
            { description: 'Service A', glAccountId: ACCT_TEST_IDS.SALES_REVENUE, quantity: 1, unitPrice: 5000 },
            { description: 'Service B', glAccountId: ACCT_TEST_IDS.SALES_REVENUE, quantity: 2, unitPrice: 1500 },
          ],
        },
        1
      );

      // Confirm invoice and lines exist
      const beforeLines = testSqlite
        .prepare('SELECT id FROM ar_invoice_lines WHERE ar_invoice_id = ?')
        .all(invoice.id);
      expect(beforeLines.length).toBe(2);

      await deleteARInvoice(invoice.id, 1);

      // Invoice gone
      const deletedInvoice = testSqlite
        .prepare('SELECT id FROM ar_invoices WHERE id = ?')
        .get(invoice.id);
      expect(deletedInvoice).toBeUndefined();

      // Lines gone
      const deletedLines = testSqlite
        .prepare('SELECT id FROM ar_invoice_lines WHERE ar_invoice_id = ?')
        .all(invoice.id);
      expect(deletedLines).toHaveLength(0);
    });

    it('should reject deleting confirmed (non-draft) AR invoice', async () => {
      const invoice = await createARInvoice(
        {
          invoiceNumber: 'AR-NO-DEL',
          taxInvoiceNumber: 'TX-NO-DEL',
          customerId: ACCT_TEST_IDS.CUSTOMER_1,
          invoiceDate: '2025-01-15',
          dueDate: '2025-02-15',
          lines: [{ description: 'Test', glAccountId: ACCT_TEST_IDS.SALES_REVENUE, quantity: 1, unitPrice: 1000 }],
        },
        1
      );

      await confirmARInvoice(invoice.id, 1);

      await expect(deleteARInvoice(invoice.id, 1)).rejects.toThrow('draft');
    });

    it('should throw error when AR invoice not found', async () => {
      await expect(deleteARInvoice(99999, 1)).rejects.toThrow();
    });
  });
});
