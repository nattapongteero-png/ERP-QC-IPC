/**
 * Bank Reconciliation Service Integration Tests
 * Feature: 014-unit-cost
 *
 * Tests execute real database queries against SQLite to catch schema mismatch bugs.
 * Focus: Verify all SQL queries work without schema errors.
 */

import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import * as schema from '@/lib/db/schema';
import Database from 'better-sqlite3';

// Hoisted getter/setter for test database
const { getTestDb, setTestDb } = vi.hoisted(() => {
  let _testDb: unknown = null;
  return {
    getTestDb: () => _testDb,
    setTestDb: (db: unknown) => { _testDb = db; },
  };
});

// Mock the database module BEFORE importing the service
vi.mock('@/lib/db', () => ({
  isSqlite: () => true,
  getDb: async () => getTestDb(),
  getSqliteDb: () => getTestDb(),
  markSchemaSynced: () => {},
  schema,
}));

// Mock audit
vi.mock('@/lib/audit', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

// Import test helpers after mock setup
import {
  setupTestDatabase,
  closeTestDatabase,
  cleanTables,
  TestDatabase,
} from '../../../helpers/test-db';
import { seedTestUser } from '../../../helpers/service-test-seeds';
import { getSqliteDate } from '../../../helpers/service-test-utils';

// Now import the service (after mock is set up)
import {
  generateStatementNumber,
  createBankStatement,
  getBankStatementById,
  listBankStatements,
  getBankAccounts,
  getReconciliationSummary,
} from '@/lib/services/bank-reconciliation.service';

describe('Bank Reconciliation Service', () => {
  let sqlite: Database.Database;
  let db: TestDatabase;

  beforeAll(() => {
    // Setup test database with required tables
    const setup = setupTestDatabase([
      schema.sqliteUsers,
      schema.sqliteAuditTrail,
      schema.sqliteGLAccountTypes,
      schema.sqliteGLAccounts,
      schema.sqliteFiscalYears,
      schema.sqliteFiscalPeriods,
      schema.sqliteBankStatements,
      schema.sqliteBankStatementLines,
      schema.sqliteJournalEntries,
      schema.sqliteJournalLines,
      schema.sqlitePayments,
    ]);
    sqlite = setup.sqlite;
    db = setup.db;
    setTestDb(db);
  });

  afterAll(() => {
    closeTestDatabase(sqlite);
  });

  beforeEach(() => {
    // Clean tables before each test (in FK order)
    cleanTables(sqlite, [
      'journal_lines',
      'journal_entries',
      'bank_statement_lines',
      'bank_statements',
      'payments',
      'fiscal_periods',
      'fiscal_years',
      'gl_accounts',
      'gl_account_types',
      'users',
    ]);
    // Seed test user
    seedTestUser(sqlite);
  });

  // Seed helpers
  function seedAccountTypes() {
    sqlite.exec(`
      INSERT INTO gl_account_types (id, code, name_th, name_en, category, normal_balance, display_order, created_at, updated_at)
      VALUES
        (1, 'ASSET', 'สินทรัพย์', 'Assets', 'asset', 'debit', 1, '${getSqliteDate()}', '${getSqliteDate()}')
    `);
  }

  function seedBankAccounts() {
    seedAccountTypes();
    // Bank accounts are GL accounts with specific type
    sqlite.exec(`
      INSERT INTO gl_accounts (id, code, name_th, name_en, account_type_id, parent_id, level, is_active, is_postable, created_at, updated_at)
      VALUES
        (1, '1100', 'เงินฝากธนาคาร - กสิกรไทย', 'Bank - Kasikorn', 1, NULL, 0, 1, 1, '${getSqliteDate()}', '${getSqliteDate()}'),
        (2, '1101', 'เงินฝากธนาคาร - ไทยพาณิชย์', 'Bank - SCB', 1, NULL, 0, 1, 1, '${getSqliteDate()}', '${getSqliteDate()}')
    `);
  }

  function seedBankStatement() {
    seedBankAccounts();
    // Actual schema columns: statement_number, bank_account_id, statement_date, opening_balance, closing_balance, total_debits, total_credits
    // Status enum: draft, in_progress, reconciled
    sqlite.exec(`
      INSERT INTO bank_statements (id, statement_number, bank_account_id, statement_date, opening_balance, closing_balance, total_debits, total_credits, status, created_by, imported_at, created_at, updated_at)
      VALUES (1, 'BS-202402-0001', 1, '2024-02-29', 10000, 15000, 5000, 0, 'draft', 1, '${getSqliteDate()}', '${getSqliteDate()}', '${getSqliteDate()}')
    `);
    // bank_statement_lines uses: debit_amount, credit_amount, running_balance, line_number (required)
    // Status enum: unmatched, matched, partially_matched, etc.
    sqlite.exec(`
      INSERT INTO bank_statement_lines (id, statement_id, line_number, transaction_date, description, reference, debit_amount, credit_amount, running_balance, status, created_at)
      VALUES
        (1, 1, 1, '2024-02-05', 'Deposit', 'DEP001', 5000, 0, 15000, 'unmatched', '${getSqliteDate()}'),
        (2, 1, 2, '2024-02-10', 'Withdrawal', 'WD001', 0, 2000, 13000, 'unmatched', '${getSqliteDate()}')
    `);
  }

  describe('generateStatementNumber', () => {
    it('should generate statement number without schema errors', async () => {
      seedBankAccounts();

      const number = await generateStatementNumber(1);

      expect(number).toBeDefined();
      expect(typeof number).toBe('string');
      // Statement number format: BS{YEAR}-{ACCOUNTID}-{SEQUENCE}
      expect(number).toMatch(/^BS\d{4}-\d{3}-\d{4}$/);
    });
  });

  describe('createBankStatement', () => {
    it('should insert without schema errors', async () => {
      seedBankAccounts();

      // createBankStatement returns just the ID (number)
      const statementId = await createBankStatement({
        bankAccountId: 1,
        statementDate: '2024-03-31',
        startDate: '2024-03-01',
        endDate: '2024-03-31',
        openingBalance: 15000,
        closingBalance: 20000,
        currency: 'THB',
      }, 1);

      expect(statementId).toBeDefined();
      expect(typeof statementId).toBe('number');
      expect(statementId).toBeGreaterThan(0);
    });

    it('should be retrievable after creation', async () => {
      seedBankAccounts();

      const statementId = await createBankStatement({
        bankAccountId: 1,
        statementDate: '2024-03-31',
        startDate: '2024-03-01',
        endDate: '2024-03-31',
        openingBalance: 15000,
        closingBalance: 20000,
        currency: 'THB',
      }, 1);

      const statement = await getBankStatementById(statementId);
      expect(statement).toBeDefined();
      expect(statement?.id).toBe(statementId);
    });

    it('should generate statement number automatically', async () => {
      seedBankAccounts();

      const statementId = await createBankStatement({
        bankAccountId: 1,
        statementDate: '2024-03-31',
        startDate: '2024-03-01',
        endDate: '2024-03-31',
        openingBalance: 15000,
        closingBalance: 20000,
        currency: 'THB',
      }, 1);

      const statement = await getBankStatementById(statementId);
      expect(statement?.statementNumber).toMatch(/^BS\d{4}-\d{3}-\d{4}$/);
    });
  });

  describe('getBankStatementById', () => {
    it('should query without schema errors', async () => {
      seedBankStatement();

      const statement = await getBankStatementById(1);

      expect(statement).toBeDefined();
      expect(statement?.id).toBe(1);
    });

    it('should return null for non-existent statement', async () => {
      const statement = await getBankStatementById(99999);

      expect(statement).toBeNull();
    });

    it('should include statement lines', async () => {
      seedBankStatement();

      const statement = await getBankStatementById(1);

      expect(statement?.lines).toBeInstanceOf(Array);
      expect(statement?.lines.length).toBe(2);
    });

    it('should return all statement fields', async () => {
      seedBankStatement();

      const statement = await getBankStatementById(1);

      expect(statement).toHaveProperty('statementNumber');
      expect(statement).toHaveProperty('bankAccountId');
      expect(statement).toHaveProperty('statementDate');
      expect(statement).toHaveProperty('openingBalance');
      expect(statement).toHaveProperty('closingBalance');
      expect(statement).toHaveProperty('status');
    });
  });

  describe('listBankStatements', () => {
    it('should query without schema errors', async () => {
      seedBankStatement();

      // Returns { data: [], total, page, limit }
      const result = await listBankStatements({});

      expect(result).toBeDefined();
      expect(result.data).toBeInstanceOf(Array);
      expect(typeof result.total).toBe('number');
    });

    it('should return paginated results', async () => {
      seedBankStatement();

      const result = await listBankStatements({ page: 1, limit: 10 });

      expect(result.data.length).toBeLessThanOrEqual(10);
      expect(result.total).toBeGreaterThanOrEqual(1);
    });

    it('should filter by status', async () => {
      seedBankStatement();

      const result = await listBankStatements({ status: 'draft' });

      expect(result.data.every(s => s.status === 'draft')).toBe(true);
    });

    it('should filter by bank account', async () => {
      seedBankStatement();

      const result = await listBankStatements({ bankAccountId: 1 });

      expect(result.data.every(s => s.bankAccountId === 1)).toBe(true);
    });

    it('should handle empty results', async () => {
      const result = await listBankStatements({ status: 'reconciled' });

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('getBankAccounts', () => {
    it('should query without schema errors', async () => {
      seedBankAccounts();

      const accounts = await getBankAccounts();

      expect(accounts).toBeDefined();
      expect(accounts).toBeInstanceOf(Array);
    });

    it('should return bank account fields', async () => {
      seedBankAccounts();

      const accounts = await getBankAccounts();

      if (accounts.length > 0) {
        expect(accounts[0]).toHaveProperty('id');
        expect(accounts[0]).toHaveProperty('name');
      }
    });
  });

  describe('getReconciliationSummary', () => {
    it('should query without schema errors', async () => {
      seedBankStatement();

      const summary = await getReconciliationSummary(1);

      expect(summary).toBeDefined();
    });

    it('should return summary fields', async () => {
      seedBankStatement();

      const summary = await getReconciliationSummary(1);

      // ReconciliationSummary type properties
      expect(summary).toHaveProperty('openingBalance');
      expect(summary).toHaveProperty('closingBalance');
      expect(summary).toHaveProperty('totalDebits');
      expect(summary).toHaveProperty('totalCredits');
      expect(summary).toHaveProperty('matchedDebits');
      expect(summary).toHaveProperty('matchedCredits');
      expect(summary).toHaveProperty('unmatchedDebits');
      expect(summary).toHaveProperty('unmatchedCredits');
      expect(summary).toHaveProperty('difference');
      expect(summary).toHaveProperty('isBalanced');
    });

    it('should return null for non-existent statement', async () => {
      const summary = await getReconciliationSummary(99999);

      expect(summary).toBeNull();
    });
  });

  describe('Schema Validation', () => {
    it('should handle all bank statement columns correctly', async () => {
      seedBankAccounts();

      const statementId = await createBankStatement({
        bankAccountId: 1,
        statementDate: '2024-04-30',
        startDate: '2024-04-01',
        endDate: '2024-04-30',
        openingBalance: 25000,
        closingBalance: 30000,
        currency: 'THB',
      }, 1);

      const statement = await getBankStatementById(statementId);

      expect(statement).toHaveProperty('id');
      expect(statement).toHaveProperty('statementNumber');
      expect(statement).toHaveProperty('bankAccountId');
      expect(statement).toHaveProperty('statementDate');
      expect(statement).toHaveProperty('openingBalance');
      expect(statement).toHaveProperty('closingBalance');
      expect(statement).toHaveProperty('status');
      expect(statement).toHaveProperty('createdBy');
      expect(statement).toHaveProperty('createdAt');
      expect(statement).toHaveProperty('updatedAt');
    });
  });
});
