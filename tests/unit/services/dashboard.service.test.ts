/**
 * Dashboard Service Unit Tests
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@/lib/db/schema';

let testDb: ReturnType<typeof drizzle> | null = null;

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(() => Promise.resolve(testDb)),
  isSqlite: vi.fn(() => true),
}));

import {
  getHRKpis,
  getPurchaseKpis,
  getSalesKpis,
  getVMIKpis,
  getGMPKpis,
  getDashboardModuleKpis,
} from '@/lib/services/dashboard.service';

describe('Dashboard Service', () => {
  let sqliteDb: ReturnType<typeof Database>;
  let db: ReturnType<typeof drizzle>;

  beforeAll(async () => {
    process.env.DB_TYPE = 'sqlite';

    sqliteDb = new Database(':memory:');
    db = drizzle(sqliteDb, { schema });
    testDb = db;

    // Create minimal schema for tests
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS hr_employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_number TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS hr_health_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        fitness_status TEXT NOT NULL,
        next_exam_date TEXT,
        next_exam_due TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS hr_authorizations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        status TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS hr_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        is_read INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS purchase_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        po_number TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL,
        total_amount REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS vendors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vendor_code TEXT NOT NULL UNIQUE,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS approved_vendor_list (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER NOT NULL,
        vendor_id INTEGER NOT NULL,
        status TEXT NOT NULL,
        approval_date TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        is_active INTEGER NOT NULL DEFAULT 1,
        reorder_point REAL,
        on_hand REAL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sales_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        so_number TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL,
        total_amount REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS deviations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        deviation_number TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS capa (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        capa_number TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS audit_findings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        finding_number TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS hr_training_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        expiry_date TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Insert minimal test data
    sqliteDb.exec(`
      INSERT INTO hr_employees (employee_number, status) VALUES
        ('EMP001', 'active'),
        ('EMP002', 'active'),
        ('EMP003', 'inactive');

      INSERT INTO purchase_orders (po_number, status, total_amount, created_at) VALUES
        ('PO001', 'draft', 10000, datetime('now')),
        ('PO002', 'approved', 20000, datetime('now'));

      INSERT INTO vendors (vendor_code, is_active) VALUES
        ('VEN001', 1),
        ('VEN002', 1);

      INSERT INTO items (code, is_active, reorder_point, on_hand) VALUES
        ('ITEM001', 1, 100, 50),
        ('ITEM002', 1, 200, 250);

      INSERT INTO sales_orders (so_number, status, total_amount, created_at) VALUES
        ('SO001', 'draft', 15000, datetime('now')),
        ('SO002', 'fulfilled', 25000, datetime('now'));

      INSERT INTO deviations (deviation_number, status) VALUES
        ('DEV001', 'open'),
        ('DEV002', 'closed');
    `);
  });

  afterAll(() => {
    sqliteDb.close();
  });

  describe('getHRKpis', () => {
    it('should return HR KPIs structure', async () => {
      const kpis = await getHRKpis();

      expect(kpis).toHaveProperty('totalEmployees');
      expect(kpis).toHaveProperty('activeEmployees');
      expect(kpis).toHaveProperty('trainingCompliance');
      expect(kpis).toHaveProperty('healthRecordsDue');
      expect(kpis).toHaveProperty('gmpAuthorized');
      expect(kpis).toHaveProperty('pendingNotifications');

      // All values should be numbers
      expect(typeof kpis.totalEmployees).toBe('number');
      expect(typeof kpis.activeEmployees).toBe('number');
      expect(typeof kpis.trainingCompliance).toBe('number');
      expect(typeof kpis.healthRecordsDue).toBe('number');
      expect(typeof kpis.gmpAuthorized).toBe('number');
      expect(typeof kpis.pendingNotifications).toBe('number');

      // Training compliance should be percentage (0-100)
      expect(kpis.trainingCompliance).toBeGreaterThanOrEqual(0);
      expect(kpis.trainingCompliance).toBeLessThanOrEqual(100);
    });

    it('should have valid employee counts from test data', async () => {
      const kpis = await getHRKpis();

      expect(kpis.totalEmployees).toBe(3);
      expect(kpis.activeEmployees).toBe(2);
      expect(kpis.activeEmployees).toBeLessThanOrEqual(kpis.totalEmployees);
    });
  });

  describe('getPurchaseKpis', () => {
    it('should return Purchase KPIs structure', async () => {
      const kpis = await getPurchaseKpis();

      expect(kpis).toHaveProperty('pendingPOs');
      expect(kpis).toHaveProperty('approvedPOs');
      expect(kpis).toHaveProperty('poValueMtd');
      expect(kpis).toHaveProperty('activeVendors');
      expect(kpis).toHaveProperty('onTimeDeliveryRate');
      expect(kpis).toHaveProperty('avlCoverage');

      // All values should be numbers
      expect(typeof kpis.pendingPOs).toBe('number');
      expect(typeof kpis.approvedPOs).toBe('number');
      expect(typeof kpis.poValueMtd).toBe('number');
      expect(typeof kpis.activeVendors).toBe('number');
      // Null, not a number: POs record no actual delivery date, so this is not
      // measurable. Asserting only `typeof === 'number'` is what allowed a
      // hardcoded 95 to pass here for months.
      expect(kpis.onTimeDeliveryRate).toBeNull();
      expect(typeof kpis.avlCoverage).toBe('number');
    });

    it('should return correct counts from test data', async () => {
      const kpis = await getPurchaseKpis();

      expect(kpis.pendingPOs).toBe(1); // PO001 is draft
      expect(kpis.approvedPOs).toBe(1); // PO002 is approved
      expect(kpis.activeVendors).toBe(2);
    });
  });

  describe('getSalesKpis', () => {
    it('should return Sales KPIs structure', async () => {
      const kpis = await getSalesKpis();

      expect(kpis).toHaveProperty('pendingSOs');
      expect(kpis).toHaveProperty('soValueMtd');
      expect(kpis).toHaveProperty('ordersFulfilledMtd');
      expect(kpis).toHaveProperty('atpShortages');
      expect(kpis).toHaveProperty('fulfillmentRate');

      // All values should be numbers
      expect(typeof kpis.pendingSOs).toBe('number');
      expect(typeof kpis.soValueMtd).toBe('number');
      expect(typeof kpis.ordersFulfilledMtd).toBe('number');
      expect(typeof kpis.atpShortages).toBe('number');
      expect(typeof kpis.fulfillmentRate).toBe('number');
    });

    it('should return correct counts from test data', async () => {
      const kpis = await getSalesKpis();

      expect(kpis.pendingSOs).toBe(1); // SO001 is draft
    });
  });

  describe('getVMIKpis', () => {
    it('should return VMI KPIs structure', async () => {
      const kpis = await getVMIKpis();

      expect(kpis).toHaveProperty('vmiItems');
      expect(kpis).toHaveProperty('lastSyncTime');
      expect(kpis).toHaveProperty('stockBelowReorder');
      expect(kpis).toHaveProperty('pendingAsns');
      expect(kpis).toHaveProperty('outstandingOrderValue');

      // Numeric values
      expect(typeof kpis.vmiItems).toBe('number');
      expect(typeof kpis.stockBelowReorder).toBe('number');
      expect(typeof kpis.pendingAsns).toBe('number');
      expect(typeof kpis.outstandingOrderValue).toBe('number');
    });

    it('should identify items below reorder point', async () => {
      const kpis = await getVMIKpis();

      expect(kpis.vmiItems).toBe(2); // Both items have reorder points
      expect(kpis.stockBelowReorder).toBe(1); // ITEM001: 50 < 100
    });
  });

  describe('getGMPKpis', () => {
    it('should return GMP KPIs structure', async () => {
      const kpis = await getGMPKpis();

      expect(kpis).toHaveProperty('openIssues');
      expect(kpis).toHaveProperty('openDeviations');
      expect(kpis).toHaveProperty('openCapas');
      expect(kpis).toHaveProperty('openAuditFindings');
      expect(kpis).toHaveProperty('trainingGaps');

      // All values should be numbers
      expect(typeof kpis.openIssues).toBe('number');
      expect(typeof kpis.openDeviations).toBe('number');
      expect(typeof kpis.openCapas).toBe('number');
      expect(typeof kpis.openAuditFindings).toBe('number');
      expect(typeof kpis.trainingGaps).toBe('number');

      // openIssues is the sum of the four open counts — a workload figure,
      // never a synthesised "score".
      expect(kpis.openIssues).toBe(
        kpis.openDeviations +
          kpis.openCapas +
          kpis.openAuditFindings +
          kpis.trainingGaps,
      );
    });

    it('should return correct counts from test data', async () => {
      const kpis = await getGMPKpis();

      expect(kpis.openDeviations).toBe(1); // DEV001 is open
    });
  });

  describe('getDashboardModuleKpis', () => {
    it('should return all module KPIs', async () => {
      const kpis = await getDashboardModuleKpis();

      expect(kpis).toHaveProperty('hr');
      expect(kpis).toHaveProperty('purchase');
      expect(kpis).toHaveProperty('sales');
      expect(kpis).toHaveProperty('vmi');
      expect(kpis).toHaveProperty('gmp');
      expect(kpis).toHaveProperty('generatedAt');

      // Verify nested structures
      expect(kpis.hr).toHaveProperty('totalEmployees');
      expect(kpis.purchase).toHaveProperty('pendingPOs');
      expect(kpis.sales).toHaveProperty('pendingSOs');
      expect(kpis.vmi).toHaveProperty('vmiItems');
      expect(kpis.gmp).toHaveProperty('overallScore');

      // generatedAt should be ISO timestamp
      expect(typeof kpis.generatedAt).toBe('string');
      expect(() => new Date(kpis.generatedAt)).not.toThrow();
    });

    it('should have valid timestamp format', async () => {
      const kpis = await getDashboardModuleKpis();
      const timestamp = new Date(kpis.generatedAt);

      expect(timestamp.getTime()).not.toBeNaN();
      // Should be recent (within last minute)
      const now = new Date();
      const diff = now.getTime() - timestamp.getTime();
      expect(diff).toBeLessThan(60000); // Less than 1 minute
    });

    it('should verify test data in aggregated KPIs', async () => {
      const kpis = await getDashboardModuleKpis();

      // Verify data from our test setup
      expect(kpis.hr.totalEmployees).toBe(3);
      expect(kpis.hr.activeEmployees).toBe(2);
      expect(kpis.purchase.pendingPOs).toBe(1);
      expect(kpis.purchase.approvedPOs).toBe(1);
      expect(kpis.purchase.activeVendors).toBe(2);
      expect(kpis.sales.pendingSOs).toBe(1);
      expect(kpis.vmi.vmiItems).toBe(2);
      expect(kpis.vmi.stockBelowReorder).toBe(1);
      expect(kpis.gmp.openDeviations).toBe(1);
    });
  });
});
