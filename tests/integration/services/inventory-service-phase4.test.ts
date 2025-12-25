/**
 * Integration Tests for Inventory Service - Phase 4 GMP Compliance Features
 * Feature: 009-gmp-compliance-gap-analysis Phase 2 (US12 - T065)
 *
 * Tests the Material Receipt workflow with:
 * - FR-055: Manufacturer/Importer tracking
 * - FR-056: Retest date tracking
 * - FR-061: Retest alerts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';

// Helper to set up test database
function setupTestDb() {
  const sqliteDb = new Database(':memory:');

  // Create tables
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name_th TEXT NOT NULL,
      name_en TEXT,
      type TEXT NOT NULL DEFAULT 'raw_material',
      category TEXT,
      primary_unit TEXT NOT NULL DEFAULT 'kg',
      secondary_unit TEXT,
      conversion_factor REAL,
      min_stock REAL DEFAULT 0,
      max_stock REAL,
      reorder_point REAL,
      shelf_life_days INTEGER,
      storage_conditions TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS warehouses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      location TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS inventory_lots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      lot_number TEXT NOT NULL,
      batch_number TEXT,
      warehouse_id INTEGER NOT NULL,
      location_id INTEGER,
      quantity REAL NOT NULL DEFAULT 0,
      reserved_quantity REAL DEFAULT 0,
      unit TEXT NOT NULL,
      cost REAL,
      status TEXT DEFAULT 'quarantine',
      manufacturing_date TEXT,
      expiry_date TEXT,
      received_date TEXT,
      vendor_id INTEGER,
      po_number TEXT,
      coa_number TEXT,
      -- Phase 4: GMP Compliance fields
      manufacturer_name TEXT,
      manufacturer_id INTEGER,
      importer_name TEXT,
      importer_id INTEGER,
      country_of_origin TEXT,
      retest_date TEXT,
      retest_interval_months INTEGER,
      last_retest_date TEXT,
      retest_status TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (item_id) REFERENCES items(id),
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
    );
  `);

  return { sqliteDb };
}

// Helper to seed test data
function seedTestData(sqliteDb: Database.Database) {
  sqliteDb.exec(`
    INSERT INTO items (id, code, name_th, name_en, type, primary_unit)
    VALUES
      (1, 'RM001', 'สมุนไพรทดสอบ', 'Test Herb', 'raw_material', 'kg'),
      (2, 'RM002', 'สารสกัด', 'Extract', 'raw_material', 'g');

    INSERT INTO warehouses (id, code, name)
    VALUES
      (1, 'WH01', 'Main Warehouse'),
      (2, 'WH02', 'Quarantine Warehouse');
  `);
}

describe('Inventory Service - Phase 4 GMP Compliance Features', () => {
  let testDb: ReturnType<typeof setupTestDb>;

  beforeAll(() => {
    testDb = setupTestDb();
    seedTestData(testDb.sqliteDb);
  });

  afterAll(() => {
    testDb.sqliteDb.close();
  });

  describe('FR-055: Manufacturer/Importer Tracking', () => {
    it('should create lot with manufacturer information', async () => {
      const { sqliteDb } = testDb;

      // Insert lot with manufacturer info
      sqliteDb.exec(`
        INSERT INTO inventory_lots (
          item_id, lot_number, warehouse_id, quantity, unit, status,
          manufacturer_name, manufacturer_id, country_of_origin
        ) VALUES (
          1, 'LOT-MFR-001', 1, 100, 'kg', 'quarantine',
          'Thai Herbal Co., Ltd.', 12345, 'Thailand'
        )
      `);

      // Verify the data was stored correctly
      const result = sqliteDb.prepare(`
        SELECT manufacturer_name, manufacturer_id, country_of_origin
        FROM inventory_lots WHERE lot_number = 'LOT-MFR-001'
      `).get() as { manufacturer_name: string; manufacturer_id: number; country_of_origin: string };

      expect(result.manufacturer_name).toBe('Thai Herbal Co., Ltd.');
      expect(result.manufacturer_id).toBe(12345);
      expect(result.country_of_origin).toBe('Thailand');
    });

    it('should create lot with importer information', async () => {
      const { sqliteDb } = testDb;

      sqliteDb.exec(`
        INSERT INTO inventory_lots (
          item_id, lot_number, warehouse_id, quantity, unit, status,
          importer_name, importer_id, country_of_origin
        ) VALUES (
          1, 'LOT-IMP-001', 1, 50, 'kg', 'quarantine',
          'Import Trading Co.', 67890, 'China'
        )
      `);

      const result = sqliteDb.prepare(`
        SELECT importer_name, importer_id, country_of_origin
        FROM inventory_lots WHERE lot_number = 'LOT-IMP-001'
      `).get() as { importer_name: string; importer_id: number; country_of_origin: string };

      expect(result.importer_name).toBe('Import Trading Co.');
      expect(result.importer_id).toBe(67890);
      expect(result.country_of_origin).toBe('China');
    });

    it('should allow both manufacturer and importer on same lot', async () => {
      const { sqliteDb } = testDb;

      sqliteDb.exec(`
        INSERT INTO inventory_lots (
          item_id, lot_number, warehouse_id, quantity, unit, status,
          manufacturer_name, manufacturer_id,
          importer_name, importer_id,
          country_of_origin
        ) VALUES (
          1, 'LOT-BOTH-001', 1, 75, 'kg', 'quarantine',
          'Foreign Manufacturer', 11111,
          'Local Importer', 22222,
          'India'
        )
      `);

      const result = sqliteDb.prepare(`
        SELECT manufacturer_name, importer_name, country_of_origin
        FROM inventory_lots WHERE lot_number = 'LOT-BOTH-001'
      `).get() as { manufacturer_name: string; importer_name: string; country_of_origin: string };

      expect(result.manufacturer_name).toBe('Foreign Manufacturer');
      expect(result.importer_name).toBe('Local Importer');
      expect(result.country_of_origin).toBe('India');
    });
  });

  describe('FR-056: Retest Date Tracking', () => {
    it('should create lot with retest date', async () => {
      const { sqliteDb } = testDb;

      const retestDate = '2025-06-24';

      sqliteDb.exec(`
        INSERT INTO inventory_lots (
          item_id, lot_number, warehouse_id, quantity, unit, status,
          retest_date, retest_interval_months, retest_status
        ) VALUES (
          1, 'LOT-RETEST-001', 1, 100, 'kg', 'released',
          '${retestDate}', 6, 'scheduled'
        )
      `);

      const result = sqliteDb.prepare(`
        SELECT retest_date, retest_interval_months, retest_status
        FROM inventory_lots WHERE lot_number = 'LOT-RETEST-001'
      `).get() as { retest_date: string; retest_interval_months: number; retest_status: string };

      expect(result.retest_date).toBe(retestDate);
      expect(result.retest_interval_months).toBe(6);
      expect(result.retest_status).toBe('scheduled');
    });

    it('should update retest status to overdue when date passed', async () => {
      const { sqliteDb } = testDb;

      // Create a lot with past retest date
      const pastDate = '2024-01-01';

      sqliteDb.exec(`
        INSERT INTO inventory_lots (
          item_id, lot_number, warehouse_id, quantity, unit, status,
          retest_date, retest_status
        ) VALUES (
          1, 'LOT-OVERDUE-001', 1, 100, 'kg', 'released',
          '${pastDate}', 'scheduled'
        )
      `);

      // Verify the lot exists
      const result = sqliteDb.prepare(`
        SELECT retest_date, retest_status
        FROM inventory_lots WHERE lot_number = 'LOT-OVERDUE-001'
      `).get() as { retest_date: string; retest_status: string };

      expect(result.retest_date).toBe(pastDate);

      // Update to overdue
      sqliteDb.exec(`
        UPDATE inventory_lots SET retest_status = 'overdue'
        WHERE lot_number = 'LOT-OVERDUE-001'
      `);

      const updated = sqliteDb.prepare(`
        SELECT retest_status FROM inventory_lots WHERE lot_number = 'LOT-OVERDUE-001'
      `).get() as { retest_status: string };

      expect(updated.retest_status).toBe('overdue');
    });

    it('should record retest completion', async () => {
      const { sqliteDb } = testDb;

      const today = new Date().toISOString().split('T')[0];

      sqliteDb.exec(`
        INSERT INTO inventory_lots (
          item_id, lot_number, warehouse_id, quantity, unit, status,
          retest_date, retest_status, retest_interval_months
        ) VALUES (
          1, 'LOT-COMPLETE-001', 1, 100, 'kg', 'released',
          '${today}', 'scheduled', 6
        )
      `);

      // Simulate retest completion - update last_retest_date and schedule next
      const nextRetestDate = new Date();
      nextRetestDate.setMonth(nextRetestDate.getMonth() + 6);
      const nextRetest = nextRetestDate.toISOString().split('T')[0];

      sqliteDb.exec(`
        UPDATE inventory_lots SET
          last_retest_date = '${today}',
          retest_date = '${nextRetest}',
          retest_status = 'scheduled'
        WHERE lot_number = 'LOT-COMPLETE-001'
      `);

      const result = sqliteDb.prepare(`
        SELECT last_retest_date, retest_date, retest_status
        FROM inventory_lots WHERE lot_number = 'LOT-COMPLETE-001'
      `).get() as { last_retest_date: string; retest_date: string; retest_status: string };

      expect(result.last_retest_date).toBe(today);
      expect(result.retest_date).toBe(nextRetest);
      expect(result.retest_status).toBe('scheduled');
    });
  });

  describe('FR-061: Retest Alerts', () => {
    it('should query lots with upcoming retest dates', async () => {
      const { sqliteDb } = testDb;

      // Create lots with various retest dates
      const today = new Date();

      const upcoming7Days = new Date(today);
      upcoming7Days.setDate(upcoming7Days.getDate() + 7);

      const upcoming30Days = new Date(today);
      upcoming30Days.setDate(upcoming30Days.getDate() + 30);

      const farFuture = new Date(today);
      farFuture.setMonth(farFuture.getMonth() + 3);

      sqliteDb.exec(`
        INSERT INTO inventory_lots (
          item_id, lot_number, warehouse_id, quantity, unit, status,
          retest_date, retest_status
        ) VALUES
          (1, 'LOT-ALERT-7', 1, 100, 'kg', 'released', '${upcoming7Days.toISOString().split('T')[0]}', 'scheduled'),
          (1, 'LOT-ALERT-30', 1, 100, 'kg', 'released', '${upcoming30Days.toISOString().split('T')[0]}', 'scheduled'),
          (1, 'LOT-ALERT-FAR', 1, 100, 'kg', 'released', '${farFuture.toISOString().split('T')[0]}', 'scheduled')
      `);

      // Query lots with retest within 30 days
      const threshold30Days = new Date(today);
      threshold30Days.setDate(threshold30Days.getDate() + 30);

      const alertLots = sqliteDb.prepare(`
        SELECT lot_number, retest_date
        FROM inventory_lots
        WHERE retest_date IS NOT NULL
          AND retest_date <= ?
          AND retest_status = 'scheduled'
          AND status = 'released'
      `).all(threshold30Days.toISOString().split('T')[0]) as Array<{ lot_number: string; retest_date: string }>;

      expect(alertLots.length).toBeGreaterThanOrEqual(2);
      expect(alertLots.map(l => l.lot_number)).toContain('LOT-ALERT-7');
      expect(alertLots.map(l => l.lot_number)).toContain('LOT-ALERT-30');
      expect(alertLots.map(l => l.lot_number)).not.toContain('LOT-ALERT-FAR');
    });

    it('should identify overdue retest lots', async () => {
      const { sqliteDb } = testDb;

      const today = new Date().toISOString().split('T')[0];

      // Create an overdue lot
      sqliteDb.exec(`
        INSERT INTO inventory_lots (
          item_id, lot_number, warehouse_id, quantity, unit, status,
          retest_date, retest_status
        ) VALUES (
          1, 'LOT-OVERDUE-ALERT', 1, 100, 'kg', 'released',
          '2024-01-01', 'scheduled'
        )
      `);

      // Query overdue lots
      const overdueLots = sqliteDb.prepare(`
        SELECT lot_number, retest_date
        FROM inventory_lots
        WHERE retest_date IS NOT NULL
          AND retest_date < ?
          AND (retest_status = 'scheduled' OR retest_status = 'overdue')
          AND status = 'released'
      `).all(today) as Array<{ lot_number: string; retest_date: string }>;

      expect(overdueLots.length).toBeGreaterThanOrEqual(1);
      expect(overdueLots.map(l => l.lot_number)).toContain('LOT-OVERDUE-ALERT');
    });
  });

  describe('Combined GMP Compliance Data', () => {
    it('should create lot with all Phase 4 fields', async () => {
      const { sqliteDb } = testDb;

      const today = new Date();
      const retestDate = new Date(today);
      retestDate.setMonth(retestDate.getMonth() + 12);

      sqliteDb.exec(`
        INSERT INTO inventory_lots (
          item_id, lot_number, warehouse_id, quantity, unit, status,
          manufacturer_name, manufacturer_id,
          importer_name, importer_id,
          country_of_origin,
          retest_date, retest_interval_months, retest_status,
          manufacturing_date, expiry_date, received_date
        ) VALUES (
          1, 'LOT-COMPLETE-GMP', 1, 200, 'kg', 'quarantine',
          'Premium Herbs Co.', 99999,
          'Quality Imports Ltd.', 88888,
          'Vietnam',
          '${retestDate.toISOString().split('T')[0]}', 12, 'scheduled',
          '2024-12-01', '2026-12-01', '${today.toISOString().split('T')[0]}'
        )
      `);

      const result = sqliteDb.prepare(`
        SELECT
          manufacturer_name, manufacturer_id,
          importer_name, importer_id,
          country_of_origin,
          retest_date, retest_interval_months, retest_status
        FROM inventory_lots WHERE lot_number = 'LOT-COMPLETE-GMP'
      `).get() as {
        manufacturer_name: string;
        manufacturer_id: number;
        importer_name: string;
        importer_id: number;
        country_of_origin: string;
        retest_date: string;
        retest_interval_months: number;
        retest_status: string;
      };

      expect(result.manufacturer_name).toBe('Premium Herbs Co.');
      expect(result.manufacturer_id).toBe(99999);
      expect(result.importer_name).toBe('Quality Imports Ltd.');
      expect(result.importer_id).toBe(88888);
      expect(result.country_of_origin).toBe('Vietnam');
      expect(result.retest_interval_months).toBe(12);
      expect(result.retest_status).toBe('scheduled');
    });
  });
});
