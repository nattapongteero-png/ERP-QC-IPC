/**
 * Test Database Helper
 * Feature: 009-gmp-compliance-gap-analysis
 *
 * Provides database setup and cleanup utilities for integration tests.
 * Uses real SQLite with schema sync from Drizzle ORM.
 */

import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '@/lib/db/schema';
import { generateCreateTableSql } from './schema-sync';

// Type for test database
export type TestDatabase = BetterSQLite3Database<typeof schema>;

// Store the active test database for the current test suite
let activeSqlite: Database.Database | null = null;
let activeTestDb: TestDatabase | null = null;

/**
 * Setup a test database with the required tables
 * @param tables - Array of Drizzle table definitions to create
 * @returns Object with sqlite instance and drizzle db
 */
export function setupTestDatabase(tables: unknown[]): {
  sqlite: Database.Database;
  db: TestDatabase;
} {
  // Create in-memory SQLite database
  const sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');

  const db = drizzle(sqlite, { schema });

  // Create tables from Drizzle schema
  for (const table of tables) {
    try {
      const createSql = generateCreateTableSql(table);
      sqlite.exec(createSql);
    } catch (err) {
      // Table might already exist - log for debugging
      console.log(`Table creation note: ${err}`);
    }
  }

  // Store references for cleanup
  activeSqlite = sqlite;
  activeTestDb = db;

  return { sqlite, db };
}

/**
 * Clean specified tables by deleting all rows
 * Must be called with table names in correct order (FK dependencies)
 * @param sqlite - Better-sqlite3 database instance
 * @param tableNames - Array of table names to clean (in FK order)
 */
export function cleanTables(sqlite: Database.Database, tableNames: string[]): void {
  for (const tableName of tableNames) {
    try {
      sqlite.exec(`DELETE FROM ${tableName}`);
    } catch (err) {
      console.log(`Table clean note for ${tableName}: ${err}`);
    }
  }
}

/**
 * Close the test database connection
 * @param sqlite - Better-sqlite3 database instance
 */
export function closeTestDatabase(sqlite: Database.Database): void {
  if (sqlite) {
    sqlite.close();
  }
  if (activeSqlite === sqlite) {
    activeSqlite = null;
    activeTestDb = null;
  }
}

/**
 * Get the active test database (for use within test files)
 * Returns null if no test database is set up
 */
export function getActiveTestDb(): TestDatabase | null {
  return activeTestDb;
}

/**
 * Get the active SQLite instance (for raw SQL operations)
 * Returns null if no test database is set up
 */
export function getActiveSqlite(): Database.Database | null {
  return activeSqlite;
}

/**
 * Execute raw SQL on the test database
 * Useful for seeding data or complex setup
 * @param sqlite - Better-sqlite3 database instance
 * @param sql - SQL statement to execute
 */
export function execSql(sqlite: Database.Database, sql: string): void {
  sqlite.exec(sql);
}

/**
 * Create mock function for database module
 * Use this with vi.mock to inject test database
 */
export function createDbMock(db: TestDatabase) {
  return {
    isSqlite: () => true,
    getDb: async () => db,
    getSqliteDb: () => db,
    markSchemaSynced: () => {},
    schema,
  };
}
