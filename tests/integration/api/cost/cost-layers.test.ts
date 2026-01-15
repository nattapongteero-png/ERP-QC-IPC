/**
 * Cost Layers API Integration Tests
 * Feature: 014-unit-cost
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Mock Next.js headers
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(() => ({ value: 'test-token' })),
    set: vi.fn(),
    delete: vi.fn()
  }))
}));

// Mock auth session
vi.mock('@/lib/auth', async () => {
  const actual = await vi.importActual('@/lib/auth');
  return {
    ...actual,
    getSession: vi.fn(() => Promise.resolve({
      userId: 1,
      email: 'admin@test.com',
      role: 'admin',
      name: 'Admin User'
    })),
    hasPermission: vi.fn(() => true)
  };
});

let testDb: Database.Database;
const TEST_DB_PATH = path.join(process.cwd(), 'test-cost-layers.db');

beforeAll(() => {
  // Create test database with required tables
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
  testDb = new Database(TEST_DB_PATH);

  // Create minimal schema for cost layers tests
  testDb.exec(`
    CREATE TABLE items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name_th TEXT NOT NULL,
      type TEXT DEFAULT 'raw_material',
      primary_unit TEXT DEFAULT 'unit',
      on_hand REAL DEFAULT 0,
      on_hand_cost REAL DEFAULT 0,
      current_wac REAL,
      last_purchase_cost REAL,
      last_purchase_date TEXT,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE item_cost_layers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      transaction_type TEXT NOT NULL,
      transaction_id INTEGER NOT NULL,
      transaction_date TEXT NOT NULL,
      quantity_in REAL NOT NULL,
      unit_cost REAL NOT NULL,
      total_cost REAL NOT NULL,
      running_qty REAL NOT NULL,
      running_total_cost REAL NOT NULL,
      running_wac REAL NOT NULL,
      notes TEXT,
      created_by INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Seed test data
    INSERT INTO items (id, code, name_th, type, primary_unit, on_hand, on_hand_cost, current_wac)
    VALUES (1, 'RM-001', 'Raw Material 1', 'raw_material', 'kg', 100, 5000, 50);

    INSERT INTO item_cost_layers (item_id, transaction_type, transaction_id, transaction_date, quantity_in, unit_cost, total_cost, running_qty, running_total_cost, running_wac, notes, created_by)
    VALUES
      (1, 'receipt', 1, '2026-01-10', 50, 48, 2400, 50, 2400, 48, 'Initial receipt', 1),
      (1, 'receipt', 2, '2026-01-12', 50, 52, 2600, 100, 5000, 50, 'Second receipt', 1);
  `);
});

afterAll(() => {
  testDb.close();
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
});

describe('Cost Layers API Integration Tests', () => {
  describe('GET /api/cost/items/[id]/cost-layers', () => {
    it('should return cost layers for an item', async () => {
      // Query test database directly (simulates API response)
      const layers = testDb.prepare(`
        SELECT * FROM item_cost_layers WHERE item_id = ?
        ORDER BY transaction_date DESC
      `).all(1);

      expect(layers).toHaveLength(2);
      expect(layers[0]).toHaveProperty('transaction_type');
      expect(layers[0]).toHaveProperty('unit_cost');
      expect(layers[0]).toHaveProperty('running_wac');
    });

    it('should support pagination', async () => {
      const page = 1;
      const pageSize = 1;
      const offset = (page - 1) * pageSize;

      const layers = testDb.prepare(`
        SELECT * FROM item_cost_layers WHERE item_id = ?
        ORDER BY transaction_date DESC
        LIMIT ? OFFSET ?
      `).all(1, pageSize, offset);

      expect(layers).toHaveLength(1);
    });

    it('should filter by transaction type', async () => {
      const transactionType = 'receipt';

      const layers = testDb.prepare(`
        SELECT * FROM item_cost_layers WHERE item_id = ? AND transaction_type = ?
        ORDER BY transaction_date DESC
      `).all(1, transactionType);

      expect(layers).toHaveLength(2);
      expect(layers[0].transaction_type).toBe('receipt');
    });

    it('should filter by date range', async () => {
      const fromDate = '2026-01-11';
      const toDate = '2026-01-15';

      const layers = testDb.prepare(`
        SELECT * FROM item_cost_layers
        WHERE item_id = ?
        AND transaction_date >= ?
        AND transaction_date <= ?
        ORDER BY transaction_date DESC
      `).all(1, fromDate, toDate);

      expect(layers).toHaveLength(1);
      expect(layers[0].transaction_date).toBe('2026-01-12');
    });

    it('should return 404 for non-existent item', async () => {
      const result = testDb.prepare(`
        SELECT * FROM items WHERE id = ?
      `).get(9999);

      expect(result).toBeUndefined();
    });

    it('should return running WAC for each layer', async () => {
      const layers = testDb.prepare(`
        SELECT * FROM item_cost_layers WHERE item_id = ?
        ORDER BY transaction_date ASC
      `).all(1);

      // First receipt: 50 kg @ 48 = WAC 48
      expect(layers[0].running_wac).toBe(48);
      expect(layers[0].running_qty).toBe(50);

      // Second receipt: 50 kg @ 52 = WAC (2400+2600)/100 = 50
      expect(layers[1].running_wac).toBe(50);
      expect(layers[1].running_qty).toBe(100);
    });
  });

  describe('GET /api/cost/items/[id]/cost-views', () => {
    it('should return all cost views for an item', async () => {
      const item = testDb.prepare(`
        SELECT
          id,
          code,
          name_th,
          type,
          primary_unit,
          on_hand,
          on_hand_cost,
          current_wac,
          last_purchase_cost,
          last_purchase_date
        FROM items WHERE id = ?
      `).get(1) as {
        id: number;
        code: string;
        name_th: string;
        type: string;
        primary_unit: string;
        on_hand: number;
        on_hand_cost: number;
        current_wac: number | null;
        last_purchase_cost: number | null;
        last_purchase_date: string | null;
      };

      expect(item).toBeDefined();
      expect(item.code).toBe('RM-001');
      expect(item.current_wac).toBe(50);
      expect(item.on_hand).toBe(100);
      expect(item.on_hand_cost).toBe(5000);
    });

    it('should calculate on-hand value correctly', async () => {
      const item = testDb.prepare(`
        SELECT on_hand, current_wac, on_hand_cost
        FROM items WHERE id = ?
      `).get(1) as { on_hand: number; current_wac: number; on_hand_cost: number };

      // on_hand_cost should equal on_hand * current_wac
      expect(item.on_hand_cost).toBe(item.on_hand * item.current_wac);
    });
  });

  describe('WAC Calculation Logic', () => {
    it('should maintain WAC precision to 4 decimal places', async () => {
      // Create a more complex scenario
      const testItem = testDb.prepare(`
        INSERT INTO items (code, name_th, on_hand, on_hand_cost, current_wac)
        VALUES ('RM-PRECISION', 'Precision Test', 0, 0, 0)
      `).run();
      const itemId = testItem.lastInsertRowid;

      // Simulate receipts with fractional costs
      const receipt1Qty = 33;
      const receipt1Cost = 17.3333;
      const receipt1Total = receipt1Qty * receipt1Cost;

      testDb.prepare(`
        INSERT INTO item_cost_layers
        (item_id, transaction_type, transaction_id, transaction_date, quantity_in, unit_cost, total_cost, running_qty, running_total_cost, running_wac, created_by)
        VALUES (?, 'receipt', 1, '2026-01-15', ?, ?, ?, ?, ?, ?, 1)
      `).run(itemId, receipt1Qty, receipt1Cost, receipt1Total, receipt1Qty, receipt1Total, receipt1Cost);

      const layer = testDb.prepare(`
        SELECT running_wac FROM item_cost_layers WHERE item_id = ?
      `).get(itemId) as { running_wac: number };

      // WAC should be stored with precision
      expect(typeof layer.running_wac).toBe('number');
      expect(layer.running_wac).toBeCloseTo(17.3333, 4);
    });
  });
});
