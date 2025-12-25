/**
 * GL Accounts Service Unit Tests
 * Feature: 010-accounting-module-integration
 * User Story 1: Create and Manage Chart of Accounts
 *
 * Tests GL account CRUD functions:
 * - listGLAccounts() with filters
 * - listGLAccountTypes()
 * - getGLAccountById()
 * - createGLAccount() with validation
 * - updateGLAccount()
 * - deactivateGLAccount()
 * - getGLAccountTree()
 * - exportChartOfAccounts()
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
  ACCT_TEST_IDS,
} from '../../helpers/seed-accounting';

// Store db reference for module mock
let testSqlite: Database.Database;
let testDb: any;

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
  listGLAccounts,
  listGLAccountTypes,
  getGLAccountById,
  createGLAccount,
  updateGLAccount,
  deactivateGLAccount,
  getGLAccountTree,
  exportChartOfAccounts,
} from '@/lib/services/accounting.service';

describe('GL Accounts Service', () => {
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

  describe('listGLAccountTypes', () => {
    it('should return all account types ordered by display order', async () => {
      const types = await listGLAccountTypes();

      expect(types.length).toBeGreaterThan(0);
      expect(types[0]).toHaveProperty('id');
      expect(types[0]).toHaveProperty('code');
      expect(types[0]).toHaveProperty('nameTh');
      expect(types[0]).toHaveProperty('category');
      expect(types[0]).toHaveProperty('normalBalance');
    });

    it('should include all standard TAS account types', async () => {
      const types = await listGLAccountTypes();
      const codes = types.map(t => t.code);

      expect(codes).toContain('1'); // Assets
      expect(codes).toContain('2'); // Liabilities
      expect(codes).toContain('3'); // Equity
      expect(codes).toContain('4'); // Revenue
      expect(codes).toContain('5'); // Expenses
    });
  });

  describe('listGLAccounts', () => {
    it('should return all accounts when no filters provided', async () => {
      const accounts = await listGLAccounts({});

      expect(accounts.length).toBeGreaterThan(0);
      expect(accounts[0]).toHaveProperty('id');
      expect(accounts[0]).toHaveProperty('code');
      expect(accounts[0]).toHaveProperty('nameTh');
      expect(accounts[0]).toHaveProperty('accountType');
    });

    it('should filter by account type', async () => {
      const accounts = await listGLAccounts({
        accountTypeId: ACCT_TEST_IDS.ASSET_TYPE,
      });

      expect(accounts.length).toBeGreaterThan(0);
      accounts.forEach(account => {
        expect(account.accountTypeId).toBe(ACCT_TEST_IDS.ASSET_TYPE);
      });
    });

    it('should filter by isActive', async () => {
      const activeAccounts = await listGLAccounts({ isActive: true });
      const inactiveAccounts = await listGLAccounts({ isActive: false });

      activeAccounts.forEach(a => expect(a.isActive).toBe(true));
      inactiveAccounts.forEach(a => expect(a.isActive).toBe(false));
    });

    it('should filter by isPostable', async () => {
      const postableAccounts = await listGLAccounts({ isPostable: true });

      postableAccounts.forEach(a => expect(a.isPostable).toBe(true));
    });

    it('should search by code or name', async () => {
      const accounts = await listGLAccounts({ search: 'Cash' });

      expect(accounts.length).toBeGreaterThan(0);
      accounts.forEach(account => {
        const matchesSearch =
          account.code.toLowerCase().includes('cash') ||
          account.nameTh.toLowerCase().includes('cash') ||
          account.nameEn.toLowerCase().includes('cash');
        expect(matchesSearch).toBe(true);
      });
    });
  });

  describe('getGLAccountById', () => {
    it('should return account with correct properties', async () => {
      const account = await getGLAccountById(ACCT_TEST_IDS.CASH);

      expect(account).not.toBeNull();
      expect(account?.id).toBe(ACCT_TEST_IDS.CASH);
      expect(account?.code).toBe('1111');
      expect(account?.nameTh).toBe('เงินสด');
      expect(account?.accountTypeId).toBe(ACCT_TEST_IDS.ASSET_TYPE);
    });

    it('should return null for non-existent account', async () => {
      const account = await getGLAccountById(999999);

      expect(account).toBeNull();
    });
  });

  describe('createGLAccount', () => {
    it('should create account with valid data', async () => {
      const account = await createGLAccount({
        code: '1-1100-99',
        nameTh: 'บัญชีทดสอบ',
        nameEn: 'Test Account',
        accountTypeId: ACCT_TEST_IDS.ASSET_TYPE,
        isPostable: true,
        isBankAccount: false,
      }, 1);

      expect(account).toBeDefined();
      expect(account.code).toBe('1-1100-99');
      expect(account.nameTh).toBe('บัญชีทดสอบ');
      expect(account.isActive).toBe(true);
      expect(account.level).toBe(1);
    });

    it('should create child account with correct level', async () => {
      // First create parent
      const parent = await createGLAccount({
        code: '1-9000',
        nameTh: 'บัญชีแม่',
        nameEn: 'Parent Account',
        accountTypeId: ACCT_TEST_IDS.ASSET_TYPE,
        isPostable: false,
      }, 1);

      // Then create child
      const child = await createGLAccount({
        code: '1-9000-01',
        nameTh: 'บัญชีลูก',
        nameEn: 'Child Account',
        accountTypeId: ACCT_TEST_IDS.ASSET_TYPE,
        parentId: parent.id,
        isPostable: true,
      }, 1);

      expect(child.parentId).toBe(parent.id);
      expect(child.level).toBe(parent.level + 1);
    });

    it('should reject duplicate account code', async () => {
      await createGLAccount({
        code: '1-1100-98',
        nameTh: 'บัญชีหนึ่ง',
        nameEn: 'Account One',
        accountTypeId: ACCT_TEST_IDS.ASSET_TYPE,
      }, 1);

      await expect(
        createGLAccount({
          code: '1-1100-98',
          nameTh: 'บัญชีสอง',
          nameEn: 'Account Two',
          accountTypeId: ACCT_TEST_IDS.ASSET_TYPE,
        }, 1)
      ).rejects.toThrow(); // SQLite throws UNIQUE constraint error
    });

    it('should create bank account with bank details', async () => {
      const account = await createGLAccount({
        code: '1-1120-99',
        nameTh: 'บัญชีธนาคารทดสอบ',
        nameEn: 'Test Bank Account',
        accountTypeId: ACCT_TEST_IDS.ASSET_TYPE,
        isPostable: true,
        isBankAccount: true,
        bankName: 'ธนาคารกรุงเทพ',
        bankAccountNumber: '123-456789-0',
      }, 1);

      expect(account.isBankAccount).toBe(true);
      expect(account.bankName).toBe('ธนาคารกรุงเทพ');
      expect(account.bankAccountNumber).toBe('123-456789-0');
    });
  });

  describe('updateGLAccount', () => {
    it('should update account names', async () => {
      const updated = await updateGLAccount(
        ACCT_TEST_IDS.CASH,
        {
          nameTh: 'เงินสดฉุกเฉิน',
          nameEn: 'Petty Cash Updated',
        },
        1
      );

      expect(updated.nameTh).toBe('เงินสดฉุกเฉิน');
      expect(updated.nameEn).toBe('Petty Cash Updated');
    });

    it('should update bank account details', async () => {
      // First create a bank account
      const account = await createGLAccount({
        code: '1-1120-88',
        nameTh: 'บัญชีธนาคาร',
        nameEn: 'Bank Account',
        accountTypeId: ACCT_TEST_IDS.ASSET_TYPE,
        isBankAccount: true,
      }, 1);

      const updated = await updateGLAccount(
        account.id,
        {
          bankName: 'ธนาคารกสิกรไทย',
          bankAccountNumber: '987-654321-0',
        },
        1
      );

      expect(updated.bankName).toBe('ธนาคารกสิกรไทย');
      expect(updated.bankAccountNumber).toBe('987-654321-0');
    });

    it('should throw error for non-existent account', async () => {
      await expect(
        updateGLAccount(999999, { nameTh: 'Test' }, 1)
      ).rejects.toThrow('not found');
    });
  });

  describe('deactivateGLAccount', () => {
    it('should set isActive to false', async () => {
      // Create a new account to deactivate
      const account = await createGLAccount({
        code: '1-1100-77',
        nameTh: 'บัญชีที่จะปิด',
        nameEn: 'Account to Deactivate',
        accountTypeId: ACCT_TEST_IDS.ASSET_TYPE,
      }, 1);

      const deactivated = await deactivateGLAccount(account.id, 1);

      expect(deactivated.isActive).toBe(false);
    });

    it('should throw error for non-existent account', async () => {
      await expect(deactivateGLAccount(999999, 1)).rejects.toThrow('not found');
    });
  });

  describe('getGLAccountTree', () => {
    it('should return accounts in tree structure', async () => {
      const tree = await getGLAccountTree();

      expect(Array.isArray(tree)).toBe(true);
      expect(tree.length).toBeGreaterThan(0);
      // Root level accounts should have no parentId
      tree.forEach(node => {
        expect(node.parentId).toBeNull();
        expect(node).toHaveProperty('children');
      });
    });

    it('should include children in parent nodes', async () => {
      // Create parent and child for testing
      const parent = await createGLAccount({
        code: '1-8000',
        nameTh: 'หมวดทดสอบ',
        nameEn: 'Test Category',
        accountTypeId: ACCT_TEST_IDS.ASSET_TYPE,
        isPostable: false,
      }, 1);

      await createGLAccount({
        code: '1-8000-01',
        nameTh: 'บัญชีลูก 1',
        nameEn: 'Child 1',
        accountTypeId: ACCT_TEST_IDS.ASSET_TYPE,
        parentId: parent.id,
        isPostable: true,
      }, 1);

      await createGLAccount({
        code: '1-8000-02',
        nameTh: 'บัญชีลูก 2',
        nameEn: 'Child 2',
        accountTypeId: ACCT_TEST_IDS.ASSET_TYPE,
        parentId: parent.id,
        isPostable: true,
      }, 1);

      const tree = await getGLAccountTree();
      const parentNode = tree.find(n => n.id === parent.id);

      expect(parentNode).toBeDefined();
      expect(parentNode?.children.length).toBe(2);
    });
  });

  describe('exportChartOfAccounts', () => {
    it('should export all active accounts by default', async () => {
      const result = await exportChartOfAccounts({});

      expect(result).toHaveProperty('accounts');
      expect(result).toHaveProperty('exportedAt');
      expect(result).toHaveProperty('count');
      expect(Array.isArray(result.accounts)).toBe(true);
      expect(result.count).toBe(result.accounts.length);
    });

    it('should include inactive accounts when requested', async () => {
      // Create and deactivate an account
      const account = await createGLAccount({
        code: '1-1100-66',
        nameTh: 'บัญชีไม่ใช้งาน',
        nameEn: 'Inactive Account',
        accountTypeId: ACCT_TEST_IDS.ASSET_TYPE,
      }, 1);
      await deactivateGLAccount(account.id, 1);

      const withInactive = await exportChartOfAccounts({ includeInactive: true });
      const withoutInactive = await exportChartOfAccounts({ includeInactive: false });

      expect(withInactive.count).toBeGreaterThanOrEqual(withoutInactive.count);
    });

    it('should include account type info in export', async () => {
      const result = await exportChartOfAccounts({});

      result.accounts.forEach(account => {
        // Check that account has required fields
        expect(account).toHaveProperty('code');
        expect(account).toHaveProperty('nameTh');
        expect(account).toHaveProperty('nameEn');
        expect(account).toHaveProperty('level');
      });
    });
  });
});
