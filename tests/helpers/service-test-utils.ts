/**
 * Service Test Utilities
 * Feature: 014-unit-cost
 *
 * Provides utilities for service layer integration tests that execute
 * real database queries against SQLite to catch schema mismatch bugs.
 */

import * as schema from '@/lib/db/schema';
import { setupTestDatabase, TestDatabase, cleanTables, closeTestDatabase } from './test-db';
import Database from 'better-sqlite3';

/**
 * Create a hoisted database reference for vi.mock
 * Must be called within vi.hoisted() block
 *
 * Usage:
 * ```typescript
 * const { getTestDb, setTestDb } = vi.hoisted(() => createHoistedDbRef());
 *
 * vi.mock('@/lib/db', () => ({
 *   isSqlite: () => true,
 *   getDb: async () => getTestDb(),
 *   getSqliteDb: () => getTestDb(),
 *   markSchemaSynced: () => {},
 *   schema,
 * }));
 * ```
 */
export function createHoistedDbRef() {
  let _testDb: unknown = null;
  return {
    getTestDb: () => _testDb,
    setTestDb: (db: unknown) => { _testDb = db; },
  };
}

/**
 * Standard setup for service tests
 * Returns setup function to be used in beforeAll
 */
export function createServiceTestSetup(tables: unknown[]) {
  let sqlite: Database.Database;
  let db: TestDatabase;

  const setup = () => {
    const result = setupTestDatabase(tables);
    sqlite = result.sqlite;
    db = result.db;
    return { sqlite, db };
  };

  const cleanup = () => {
    if (sqlite) {
      closeTestDatabase(sqlite);
    }
  };

  const getSqlite = () => sqlite;
  const getDb = () => db;

  return { setup, cleanup, getSqlite, getDb };
}

/**
 * Common table combinations for different service domains
 */
export const SERVICE_TABLE_SETS = {
  // Core tables needed by most services
  core: [
    schema.sqliteUsers,
    schema.sqliteItems,
  ],

  // Inventory & Production
  inventory: [
    schema.sqliteUsers,
    schema.sqliteItems,
    schema.sqliteWarehouses,
    schema.sqliteWarehouseLocations,
    schema.sqliteInventoryLots,
    schema.sqliteInventoryTransactions,
  ],

  // Production & Work Orders
  production: [
    schema.sqliteUsers,
    schema.sqliteItems,
    schema.sqliteBOM,
    schema.sqliteBOMLines,
    schema.sqliteWorkOrders,
    schema.sqliteProductionRooms,
    schema.sqliteProductionEquipment,
  ],

  // Purchasing
  purchasing: [
    schema.sqliteUsers,
    schema.sqliteItems,
    schema.sqliteVendors,
    schema.sqlitePurchaseOrders,
    schema.sqlitePurchaseOrderLines,
    schema.sqlitePurchaseRequisitions,
    schema.sqlitePurchaseRequisitionLines,
  ],

  // Sales
  sales: [
    schema.sqliteUsers,
    schema.sqliteItems,
    schema.sqliteCustomers,
    schema.sqliteSalesOrders,
    schema.sqliteSalesOrderLines,
  ],

  // GMP Compliance
  gmp: [
    schema.sqliteUsers,
    schema.sqliteItems,
    schema.sqliteCapa,
    schema.sqliteCapaActions,
    schema.sqliteComplaints,
    schema.sqliteDeviations,
    schema.sqliteAudits,
    schema.sqliteAuditFindings,
    schema.sqliteChangeRequests,
    schema.sqliteDocuments,
    schema.sqliteDocumentVersions,
  ],

  // Accounting
  accounting: [
    schema.sqliteUsers,
    schema.sqliteGLAccountTypes,
    schema.sqliteGLAccounts,
    schema.sqliteFiscalYears,
    schema.sqliteFiscalPeriods,
    schema.sqliteJournalEntries,
    schema.sqliteJournalLines,
  ],

  // Quality
  quality: [
    schema.sqliteUsers,
    schema.sqliteItems,
    schema.sqliteInventoryLots,
    schema.sqlitePackagingQCCriteria,
  ],

  // VMI
  vmi: [
    schema.sqliteUsers,
    schema.sqliteItems,
    schema.sqliteVendors,
    schema.sqliteVmiPortalConfig,
    schema.sqliteVMIOrders,
    schema.sqliteVMIOrderLines,
  ],

  // Issues / Support
  issues: [
    schema.sqliteUsers,
    schema.sqliteIssueCategories,
    schema.sqliteIssues,
    schema.sqliteIssueTags,
    schema.sqliteIssueTagLinks,
    schema.sqliteIssueComments,
    schema.sqliteIssueAttachments,
    schema.sqliteIssueAuditEvents,
    schema.sqliteIssueNotifications,
  ],
};

/**
 * Helper to seed data from array using raw SQL
 * Handles SQLite boolean conversion (1/0 instead of true/false)
 */
export function seedTableData(
  sqlite: Database.Database,
  tableName: string,
  columns: string[],
  rows: (string | number | boolean | null)[][]
): void {
  const columnList = columns.join(', ');
  const placeholders = columns.map(() => '?').join(', ');
  const stmt = sqlite.prepare(`INSERT INTO ${tableName} (${columnList}) VALUES (${placeholders})`);

  for (const row of rows) {
    // Convert booleans to 1/0 for SQLite
    const convertedRow = row.map(val => {
      if (typeof val === 'boolean') return val ? 1 : 0;
      return val;
    });
    stmt.run(...convertedRow);
  }
}

/**
 * Helper to clean specific tables before each test
 */
export function cleanServiceTables(sqlite: Database.Database, tableNames: string[]): void {
  cleanTables(sqlite, tableNames);
}

/**
 * Common test user data
 */
export const TEST_USER = {
  id: 1,
  email: 'test@example.com',
  name: 'Test User',
  role: 'admin',
};

/**
 * Insert test user into database
 */
export function seedTestUser(sqlite: Database.Database): void {
  sqlite.exec(`
    INSERT OR IGNORE INTO users (id, email, name, role, password_hash, is_active, created_at, updated_at)
    VALUES (1, 'test@example.com', 'Test User', 'admin', 'hash', 1, datetime('now'), datetime('now'))
  `);
}

/**
 * Generate sequential IDs for test data
 */
export function generateTestId(prefix: string, index: number): string {
  return `${prefix}${String(index).padStart(3, '0')}`;
}

/**
 * Get current date in SQLite format
 */
export function getSqliteDate(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Get date N days from now in SQLite format
 */
export function getSqliteDateOffset(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 19).replace('T', ' ');
}
