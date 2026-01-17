/**
 * Cost Reports Service Integration Tests
 * Feature: 014-unit-cost
 *
 * These tests execute REAL database queries against SQLite.
 * They catch schema mismatch bugs that UI tests (with mocked fetch) cannot.
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

// Import test helpers after mock setup
import {
  setupTestDatabase,
  closeTestDatabase,
  cleanTables,
  TestDatabase,
} from '../../helpers/test-db';

// Now import the service (after mock is set up)
import { getCostSummaryReport } from '@/lib/services/unit-cost.service';

describe('Cost Reports Service', () => {
  let sqlite: Database.Database;
  let db: TestDatabase;

  beforeAll(() => {
    // Setup test database with required tables
    const setup = setupTestDatabase([
      schema.sqliteItems,
    ]);
    sqlite = setup.sqlite;
    db = setup.db;
    setTestDb(db);
  });

  afterAll(() => {
    closeTestDatabase(sqlite);
  });

  beforeEach(() => {
    // Clean tables before each test
    cleanTables(sqlite, ['items']);
  });

  describe('getCostSummaryReport', () => {
    it('should execute query without schema errors', async () => {
      // Seed test data
      sqlite.exec(`
        INSERT INTO items (code, name_th, type, primary_unit, is_active, on_hand, on_hand_cost)
        VALUES
          ('RAW001', 'Raw Material 1', 'raw_material', 'kg', 1, 100, 5000),
          ('FG001', 'Finished Good 1', 'finished_goods', 'pc', 1, 50, 10000)
      `);

      // This will FAIL if service references non-existent columns (like categoryId)
      const result = await getCostSummaryReport({});

      expect(result).toBeDefined();
      expect(result.data).toBeInstanceOf(Array);
      expect(result.total).toBe(2);
    });

    it('should filter by itemType', async () => {
      // Seed test data
      sqlite.exec(`
        INSERT INTO items (code, name_th, type, primary_unit, is_active, on_hand, on_hand_cost)
        VALUES
          ('RAW001', 'Raw Material 1', 'raw_material', 'kg', 1, 100, 5000),
          ('FG001', 'Finished Good 1', 'finished_goods', 'pc', 1, 50, 10000)
      `);

      const result = await getCostSummaryReport({ itemType: 'raw_material' });

      expect(result.total).toBe(1);
      expect(result.data[0].itemType).toBe('raw_material');
    });

    it('should filter by category (string match)', async () => {
      // Seed test data with category
      sqlite.exec(`
        INSERT INTO items (code, name_th, type, category, primary_unit, is_active, on_hand, on_hand_cost)
        VALUES
          ('RAW001', 'Herb A', 'raw_material', 'herbs', 'kg', 1, 100, 5000),
          ('RAW002', 'Chemical B', 'raw_material', 'chemicals', 'kg', 1, 50, 3000)
      `);

      const result = await getCostSummaryReport({ category: 'herbs' });

      expect(result.total).toBe(1);
      expect(result.data[0].itemCode).toBe('RAW001');
    });

    it('should search by code or name', async () => {
      sqlite.exec(`
        INSERT INTO items (code, name_th, type, primary_unit, is_active, on_hand, on_hand_cost)
        VALUES
          ('RAW001', 'ขิง', 'raw_material', 'kg', 1, 100, 5000),
          ('RAW002', 'ขมิ้น', 'raw_material', 'kg', 1, 50, 3000)
      `);

      const result = await getCostSummaryReport({ search: 'ขิง' });

      expect(result.total).toBe(1);
      expect(result.data[0].itemCode).toBe('RAW001');
    });

    it('should paginate results', async () => {
      // Seed 10 items
      for (let i = 1; i <= 10; i++) {
        sqlite.exec(`
          INSERT INTO items (code, name_th, type, primary_unit, is_active, on_hand, on_hand_cost)
          VALUES ('RAW${String(i).padStart(3, '0')}', 'Item ${i}', 'raw_material', 'kg', 1, 100, 5000)
        `);
      }

      // Page 1 with pageSize 3
      const page1 = await getCostSummaryReport({ page: 1, pageSize: 3 });
      expect(page1.total).toBe(10);
      expect(page1.data.length).toBe(3);

      // Page 2 with pageSize 3
      const page2 = await getCostSummaryReport({ page: 2, pageSize: 3 });
      expect(page2.data.length).toBe(3);
      // Ensure different items
      expect(page2.data[0].itemCode).not.toBe(page1.data[0].itemCode);
    });

    it('should calculate WAC correctly', async () => {
      sqlite.exec(`
        INSERT INTO items (code, name_th, type, primary_unit, is_active, on_hand, on_hand_cost)
        VALUES ('RAW001', 'Test Item', 'raw_material', 'kg', 1, 100, 5000)
      `);

      const result = await getCostSummaryReport({});

      // WAC = onHandCost / onHand = 5000 / 100 = 50
      expect(result.data[0].currentWAC).toBe(50);
      expect(result.data[0].onHandValue).toBe(5000);
    });
  });
});
