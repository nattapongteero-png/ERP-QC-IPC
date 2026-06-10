/**
 * Lookup Seed — Report Categories Tests
 *
 * Verifies report_categories (a DB-backed dropdown, same failure mode as
 * document_types) is auto-seeded on a fresh/empty database, and that
 * re-running the seed is idempotent (no duplicate rows — the bug the old
 * manual seed.ts left behind, which produced 15 = 5×3 rows on UAT).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@/lib/db/schema';
import { generateCreateTableSql } from '../../helpers/schema-sync';

let testSqlite: Database.Database;
let testDb: any;

vi.mock('@/lib/db', () => ({
  isSqlite: () => true,
  db: () => testDb,
  getSqliteDb: () => testDb,
  getMysqlDb: async () => testDb,
  markSchemaSynced: () => {},
  schema,
}));

vi.mock('@/lib/db/date-utils', () => ({
  getNow: () => new Date().toISOString(),
  toDbDate: (date: string) => date,
  getTodayStr: () => new Date().toISOString().split('T')[0],
}));

import { seedLookupTables } from '@/lib/db/seed-lookup';

describe('Lookup Seed — report_categories', () => {
  beforeEach(() => {
    testSqlite = new Database(':memory:');
    testSqlite.pragma('journal_mode = WAL');
    testDb = drizzle(testSqlite, { schema });

    const tables = [
      schema.sqliteItemCategories,
      schema.sqliteItemUnits,
      schema.sqliteIssueCategories,
      schema.sqliteReportCategories,
    ];
    for (const table of tables) {
      try {
        testSqlite.exec(generateCreateTableSql(table));
      } catch (err) {
        console.log(`Table creation note: ${err}`);
      }
    }
  });

  afterEach(() => {
    if (testSqlite) testSqlite.close();
  });

  it('seeds report categories on an empty database', async () => {
    await seedLookupTables();

    const result = testSqlite
      .prepare('SELECT COUNT(*) as count FROM report_categories')
      .get() as any;
    expect(result.count).toBe(5);
  });

  it('seeds the five standard report categories', async () => {
    await seedLookupTables();

    const names = (
      testSqlite
        .prepare('SELECT name FROM report_categories ORDER BY sort_order')
        .all() as any[]
    ).map((r) => r.name);

    expect(names).toEqual([
      'Inventory Reports',
      'Production Reports',
      'Quality Reports',
      'Purchasing Reports',
      'Sales Reports',
    ]);
  });

  it('is idempotent — re-running does NOT duplicate rows', async () => {
    await seedLookupTables();
    await seedLookupTables();
    await seedLookupTables();

    const result = testSqlite
      .prepare('SELECT COUNT(*) as count FROM report_categories')
      .get() as any;
    // Still 5, never 15 — guards against the old non-idempotent seed bug.
    expect(result.count).toBe(5);
  });

  it('does not overwrite existing rows (skips when table non-empty)', async () => {
    testSqlite
      .prepare(
        'INSERT INTO report_categories (name, description, sort_order, is_active) VALUES (?, ?, ?, ?)',
      )
      .run('Custom Category', 'User-defined', 1, 1);

    await seedLookupTables();

    const rows = testSqlite
      .prepare('SELECT name FROM report_categories')
      .all() as any[];
    // Only the pre-existing custom row remains; defaults are NOT injected.
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Custom Category');
  });
});
