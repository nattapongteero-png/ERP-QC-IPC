/**
 * Service Tests for Cost Dashboard
 * Feature: 014-unit-cost
 *
 * These tests run actual database queries to catch column mismatch errors
 * that UI-level tests with mocked fetch cannot detect.
 *
 * IMPORTANT: This catches errors like salesOrderId vs soId mismatches
 * that TypeScript and UI tests with mocked fetch cannot detect.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@/lib/db/schema';
import { generateCreateTableSql } from '../../helpers/schema-sync';

// Store db reference for module mock
let testSqlite: Database.Database;
let testDb: ReturnType<typeof drizzle>;

// Mock db module
vi.mock('@/lib/db', () => ({
  isSqlite: () => true,
  db: () => testDb,
  getSqliteDb: () => testDb,
  getDb: () => Promise.resolve(testDb),
  schema,
}));

// Mock audit module
vi.mock('@/lib/audit', () => ({
  createAuditLog: vi.fn(() => Promise.resolve()),
}));

// Import after mocks are set up
import { getCostDashboardKPIs } from '@/lib/services/unit-cost.service';

describe('getCostDashboardKPIs', () => {
  beforeEach(() => {
    // Create in-memory SQLite database
    testSqlite = new Database(':memory:');
    testDb = drizzle(testSqlite, { schema });

    // Create required tables
    const tables = [
      'items',
      'work_orders',
      'work_order_costs',
      'sales_orders',
      'sales_order_lines',
      'item_cost_layers',
    ];

    for (const tableName of tables) {
      const sqliteTable = schema[`sqlite${tableName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')}` as keyof typeof schema];
      if (sqliteTable) {
        const sql = generateCreateTableSql(sqliteTable);
        testSqlite.exec(sql);
      }
    }
  });

  afterEach(() => {
    testSqlite?.close();
  });

  it('executes database query without SQL errors', async () => {
    // This test will FAIL if there are column name mismatches
    // like salesOrderId vs soId, because it runs real SQL against SQLite
    const result = await getCostDashboardKPIs();

    // Verify result structure matches expected type
    expect(result).toBeDefined();
    expect(typeof result.inventoryValue).toBe('number');
    expect(typeof result.wipValue).toBe('number');
    expect(typeof result.grossMarginPercent).toBe('number');
    expect(typeof result.favorableVariance).toBe('number');
    expect(typeof result.unfavorableVariance).toBe('number');
    expect(Array.isArray(result.topCostIncreases)).toBe(true);
    expect(Array.isArray(result.topMarginErosion)).toBe(true);
    expect(Array.isArray(result.costTrend)).toBe(true);
  });

  it('returns valid numeric values (not NaN)', async () => {
    const result = await getCostDashboardKPIs();

    expect(Number.isNaN(result.inventoryValue)).toBe(false);
    expect(Number.isNaN(result.wipValue)).toBe(false);
    expect(Number.isNaN(result.grossMarginPercent)).toBe(false);
  });

  it('handles empty database gracefully', async () => {
    const result = await getCostDashboardKPIs();

    // Should return zeros/empty arrays, not throw
    expect(result.inventoryValue).toBe(0);
    expect(result.wipValue).toBe(0);
    expect(result.topCostIncreases).toHaveLength(0);
  });
});
