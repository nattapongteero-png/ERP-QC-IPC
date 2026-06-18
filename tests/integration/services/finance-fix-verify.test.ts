/**
 * Finance fix verification (real SQLite seed + DB assertions)
 *
 *  #3 credit-debit approveNote(): approved_by must equal the session userId
 *     passed in (never a hardcoded 1).
 *  #4 matching.service listExceptions(): must return invoiceNumber / poNumber /
 *     vendorName via the joins to ap_invoices -> purchase_orders / vendors.
 *
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import * as schema from '@/lib/db/schema';
import Database from 'better-sqlite3';

const { getTestDb, setTestDb } = vi.hoisted(() => {
  let _testDb: unknown = null;
  return {
    getTestDb: () => _testDb,
    setTestDb: (db: unknown) => { _testDb = db; },
  };
});

vi.mock('@/lib/db', () => ({
  isSqlite: () => true,
  getDb: async () => getTestDb(),
  getSqliteDb: () => getTestDb(),
  markSchemaSynced: () => {},
  schema,
}));

vi.mock('@/lib/audit', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  getClientIP: () => '127.0.0.1',
}));

import {
  setupTestDatabase,
  closeTestDatabase,
  cleanTables,
  TestDatabase,
} from '../../helpers/test-db';

import { approveNote } from '@/lib/services/credit-debit-notes.service';
import { listExceptions } from '@/lib/services/matching.service';

describe('Finance fix verification', () => {
  let sqlite: Database.Database;
  let db: TestDatabase;

  beforeAll(() => {
    const setup = setupTestDatabase([
      schema.sqliteUsers,
      schema.sqliteHREmployees,
      schema.sqliteVendors,
      schema.sqliteCustomers,
      schema.sqliteItems,
      schema.sqlitePurchaseOrders,
      schema.sqlitePurchaseOrderLines,
      schema.sqliteInventoryLots,
      schema.sqliteGLAccounts,
      schema.sqliteJournalEntries,
      schema.sqliteVATTransactions,
      schema.sqliteAPInvoices,
      schema.sqliteAPInvoiceLines,
      schema.sqliteARInvoices,
      schema.sqliteARInvoiceLines,
      schema.sqliteCreditDebitNotes,
      schema.sqliteCreditDebitNoteLines,
      schema.sqliteMatchingTolerances,
      schema.sqliteMatchingResults,
      schema.sqliteMatchingExceptions,
    ]);
    sqlite = setup.sqlite;
    db = setup.db;
    setTestDb(db);
  });

  afterAll(() => {
    closeTestDatabase(sqlite);
  });

  beforeEach(() => {
    cleanTables(sqlite, [
      'matching_exceptions',
      'matching_results',
      'matching_tolerances',
      'credit_debit_note_lines',
      'credit_debit_notes',
      'ap_invoice_lines',
      'ap_invoices',
      'purchase_order_lines',
      'purchase_orders',
      'vendors',
      'customers',
      'hr_employees',
      'users',
    ]);
  });

  // ----------------------------------------------------------------------
  // #3 approveNote uses session userId
  // ----------------------------------------------------------------------
  describe('#3 credit-debit approveNote -> approved_by = session user', () => {
    it('sets approved_by to the passed session userId (not 1)', async () => {
      const SESSION_USER = 42;        // the approver from session
      const CREATOR = 7;              // a different user created the note

      await db.insert(schema.sqliteUsers).values([
        { id: CREATOR, email: 'creator@test.com', password: 'x', name: 'Creator', role: 'accountant' },
        { id: SESSION_USER, email: 'approver@test.com', password: 'x', name: 'Approver', role: 'manager' },
      ]);

      // Note must be in 'submitted' status and created by a different user.
      const ins = await db.insert(schema.sqliteCreditDebitNotes).values({
        noteNumber: 'CN2026-000001',
        noteType: 'ar_credit',
        referenceType: 'ar_invoice',
        referenceInvoiceId: 1,
        noteDate: '2026-06-18',
        reasonCode: 'return',
        subtotal: 1000,
        vatRate: 0.07,
        vatAmount: 70,
        totalAmount: 1070,
        status: 'submitted',
        createdBy: CREATOR,
      });
      const noteId = Number((ins as { lastInsertRowid: number }).lastInsertRowid);

      const result = await approveNote(noteId, SESSION_USER);
      expect(result.success).toBe(true);

      const rows = sqlite
        .prepare('SELECT approved_by, status FROM credit_debit_notes WHERE id = ?')
        .get(noteId) as { approved_by: number; status: string };

      expect(rows.status).toBe('approved');
      expect(rows.approved_by).toBe(SESSION_USER);
      expect(rows.approved_by).not.toBe(1);
    });

    it('blocks self-approval (creator == session user)', async () => {
      const USER = 99;
      await db.insert(schema.sqliteUsers).values({
        id: USER, email: 'solo@test.com', password: 'x', name: 'Solo', role: 'manager',
      });
      const ins = await db.insert(schema.sqliteCreditDebitNotes).values({
        noteNumber: 'CN2026-000002',
        noteType: 'ap_credit',
        referenceType: 'ap_invoice',
        referenceInvoiceId: 1,
        noteDate: '2026-06-18',
        reasonCode: 'defect',
        subtotal: 500,
        vatAmount: 35,
        totalAmount: 535,
        status: 'submitted',
        createdBy: USER,
      });
      const noteId = Number((ins as { lastInsertRowid: number }).lastInsertRowid);

      const result = await approveNote(noteId, USER);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/own document/i);

      const row = sqlite
        .prepare('SELECT approved_by, status FROM credit_debit_notes WHERE id = ?')
        .get(noteId) as { approved_by: number | null; status: string };
      expect(row.status).toBe('submitted');
      expect(row.approved_by).toBeNull();
    });
  });

  // ----------------------------------------------------------------------
  // #4 matching listExceptions join context
  // ----------------------------------------------------------------------
  describe('#4 matching listExceptions returns invoice/po/vendor context', () => {
    it('populates invoiceNumber, poNumber, vendorName via joins', async () => {
      await db.insert(schema.sqliteUsers).values({
        id: 1, email: 'u@test.com', password: 'x', name: 'U', role: 'admin',
      });

      // vendor -> PO -> AP invoice (+lines) -> matching tolerance/result/exception
      await db.insert(schema.sqliteVendors).values({
        id: 10, code: 'V-ACME', name: 'ACME Herbal Supplies Co.', isActive: true,
      });
      await db.insert(schema.sqlitePurchaseOrders).values({
        id: 20, poNumber: 'PO2026-000088', vendorId: 10, status: 'approved',
        orderDate: '2026-06-01', totalAmount: 12000,
      });
      await db.insert(schema.sqliteItems).values({
        id: 5, code: 'RM-001', nameTh: 'ขมิ้นชัน', nameEn: 'Turmeric', type: 'raw_material', primaryUnit: 'kg',
      });
      await db.insert(schema.sqlitePurchaseOrderLines).values({
        id: 30, poId: 20, itemId: 5, quantity: 100, unit: 'kg', unitPrice: 120, totalPrice: 12000,
      });
      await db.insert(schema.sqliteGLAccounts).values({
        id: 40, code: '5100', nameTh: 'ซื้อวัตถุดิบ', nameEn: 'Purchases', accountTypeId: 1, isActive: true,
      });
      await db.insert(schema.sqliteAPInvoices).values({
        id: 50, invoiceNumber: 'INV-VENDOR-7788', vendorId: 10, purchaseOrderId: 20,
        invoiceDate: '2026-06-10', dueDate: '2026-07-10', receivedDate: '2026-06-11',
        subtotal: 12600, vatAmount: 882, totalAmount: 13482, status: 'approved',
      });
      await db.insert(schema.sqliteAPInvoiceLines).values({
        id: 60, apInvoiceId: 50, lineNumber: 1, description: 'Turmeric',
        glAccountId: 40, quantity: 105, unitPrice: 120, amount: 12600,
      });
      await db.insert(schema.sqliteMatchingTolerances).values({
        id: 70, name: 'Default', isDefault: true, createdBy: 1,
      });
      await db.insert(schema.sqliteMatchingResults).values({
        id: 80, apInvoiceId: 50, apInvoiceLineId: 60, poLineId: 30,
        toleranceProfileId: 70, poQuantity: 100, invoiceQuantity: 105,
        quantityVariance: 5, quantityVariancePct: 5,
        poUnitPrice: 120, invoiceUnitPrice: 120,
        matchStatus: 'quantity_exception',
      });
      await db.insert(schema.sqliteMatchingExceptions).values({
        id: 90, matchingResultId: 80, exceptionType: 'over_quantity',
        varianceAmount: 600, variancePct: 5, status: 'pending',
      });

      const result = await listExceptions({ page: 1, limit: 20 });

      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
      const row = result.data[0];
      expect(row.id).toBe(90);
      expect(row.invoiceNumber).toBe('INV-VENDOR-7788');
      expect(row.poNumber).toBe('PO2026-000088');
      expect(row.vendorName).toBe('ACME Herbal Supplies Co.');
      expect(row.varianceAmount).toBe(600);
    });
  });
});
