/**
 * PQR Service Real Integration Tests
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 1)
 *
 * These tests call actual service functions with real SQLite database
 * to verify complete PQR functionality with real-world scenarios.
 *
 * Uses schema-sync to create tables from Drizzle ORM schema definitions.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { getTableName, getTableColumns } from 'drizzle-orm';
import { SQLiteTable } from 'drizzle-orm/sqlite-core';
import * as schema from '@/lib/db/schema';

// Type for column properties
interface ColumnDefinition {
  name: string;
  getSQLType(): string;
  notNull?: boolean;
  primary?: boolean;
  autoIncrement?: boolean;
  default?: string | number | boolean;
}

// Create test database
let sqlite: Database.Database;
let testDb: ReturnType<typeof drizzle>;

// Mock the database module to use our test database
vi.mock('@/lib/db', async () => {
  return {
    isSqlite: () => true,
    getDb: async () => testDb,
    getSqliteDb: () => testDb,
    markSchemaSynced: () => {},
    schema,
  };
});

// Mock audit to avoid side effects
vi.mock('@/lib/audit', () => ({
  createAuditLog: vi.fn(() => Promise.resolve()),
}));

// Import service after mocking
import {
  createPqrReport,
  getPqrById,
  listPqrReports,
  updatePqrReport,
  deletePqrReport,
  aggregateBatchMetrics,
  aggregateDeviationMetrics,
  aggregateCapaMetrics,
  aggregateComplaintMetrics,
  aggregateOosMetrics,
  aggregateStabilityStatus,
  calculatePQRMetrics,
  approvePQR,
  getPqrDashboard,
  getProductsWithoutPqr,
} from '@/lib/services/pqr-service';

// Helper to create tables from schema
function createTableFromSchema(db: Database.Database, table: SQLiteTable) {
  const tableName = getTableName(table);
  const columns = getTableColumns(table);

  const columnDefs = Object.entries(columns).map(([, col]) => {
    const colDef = (col as ColumnDefinition).getSQLType();
    const notNull = (col as ColumnDefinition).notNull ? 'NOT NULL' : '';
    const primaryKey = (col as ColumnDefinition).primary ? 'PRIMARY KEY' : '';
    const autoIncrement = (col as ColumnDefinition).autoIncrement ? 'AUTOINCREMENT' : '';
    const defaultVal = (col as ColumnDefinition).default !== undefined ? `DEFAULT ${(col as ColumnDefinition).default}` : '';

    return `${(col as ColumnDefinition).name} ${colDef} ${primaryKey} ${autoIncrement} ${notNull} ${defaultVal}`.trim();
  });

  const sql = `CREATE TABLE IF NOT EXISTS ${tableName} (${columnDefs.join(', ')})`;
  db.exec(sql);
}

// Test user and product IDs
let testUserId: number;
let qaUserId: number;
let testProductId: number;
let testProduct2Id: number;
let testWarehouseId: number;
let testBom1Id: number;

beforeAll(async () => {
  // Create in-memory SQLite database
  sqlite = new Database(':memory:');
  testDb = drizzle(sqlite, { schema });

  // Create necessary tables
  createTableFromSchema(sqlite, schema.sqliteUsers);
  createTableFromSchema(sqlite, schema.sqliteItems);
  createTableFromSchema(sqlite, schema.sqliteWarehouses);
  createTableFromSchema(sqlite, schema.sqliteBOM);
  createTableFromSchema(sqlite, schema.sqlitePqrReports);
  createTableFromSchema(sqlite, schema.sqlitePqrMetrics);
  createTableFromSchema(sqlite, schema.sqliteWorkOrders);
  createTableFromSchema(sqlite, schema.sqliteDeviations);
  createTableFromSchema(sqlite, schema.sqliteCapa);
  createTableFromSchema(sqlite, schema.sqliteComplaints);
  createTableFromSchema(sqlite, schema.sqliteInventoryLots);
  createTableFromSchema(sqlite, schema.sqliteQualityTests);
  createTableFromSchema(sqlite, schema.sqliteStabilityStudies);
  createTableFromSchema(sqlite, schema.sqliteStabilitySamples);

  // Insert test users
  testUserId = sqlite.prepare(`
    INSERT INTO users (email, password, name, role, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run('test@test.com', 'hash', 'Test User', 'quality_control', new Date().toISOString()).lastInsertRowid as number;

  qaUserId = sqlite.prepare(`
    INSERT INTO users (email, password, name, role, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run('qa@test.com', 'hash', 'QA Manager', 'quality_control', new Date().toISOString()).lastInsertRowid as number;

  // Insert test warehouse
  testWarehouseId = sqlite.prepare(`
    INSERT INTO warehouses (code, name, type, created_at)
    VALUES (?, ?, ?, ?)
  `).run('WH-FG', 'Finished Goods Warehouse', 'finished_goods', new Date().toISOString()).lastInsertRowid as number;

  // Insert test products (finished goods)
  testProductId = sqlite.prepare(`
    INSERT INTO items (code, name_th, name_en, type, category, primary_unit, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('FG-001', 'ยาแคปซูลสมุนไพร A', 'Herbal Capsule A', 'finished_goods', 'herbal_capsule', 'ขวด', new Date().toISOString()).lastInsertRowid as number;

  testProduct2Id = sqlite.prepare(`
    INSERT INTO items (code, name_th, name_en, type, category, primary_unit, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('FG-002', 'ยาเม็ดสมุนไพร B', 'Herbal Tablet B', 'finished_goods', 'herbal_tablet', 'กล่อง', new Date().toISOString()).lastInsertRowid as number;

  // Insert test BOMs for products
  testBom1Id = sqlite.prepare(`
    INSERT INTO bom (code, name, product_id, version, status, batch_size, batch_unit, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run('BOM-001', 'BOM for Product A', testProductId, '1.0', 'approved', 1000, 'ขวด', new Date().toISOString()).lastInsertRowid as number;

  // BOM for product 2 (not used in most tests but needed for data consistency)
  sqlite.prepare(`
    INSERT INTO bom (code, name, product_id, version, status, batch_size, batch_unit, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run('BOM-002', 'BOM for Product B', testProduct2Id, '1.0', 'approved', 1000, 'กล่อง', new Date().toISOString());
});

afterAll(() => {
  sqlite?.close();
});

beforeEach(() => {
  // Clear PQR tables before each test (in reverse dependency order)
  sqlite.exec('DELETE FROM pqr_metrics');
  sqlite.exec('DELETE FROM pqr_reports');
  sqlite.exec('DELETE FROM stability_samples');
  sqlite.exec('DELETE FROM stability_studies');
  sqlite.exec('DELETE FROM quality_tests');
  sqlite.exec('DELETE FROM capa');
  sqlite.exec('DELETE FROM deviations');
  sqlite.exec('DELETE FROM work_orders');
  sqlite.exec('DELETE FROM complaints');
  sqlite.exec('DELETE FROM inventory_lots');
});

describe('PQR Service - Real Database Tests', () => {
  describe('createPqrReport', () => {
    it('should create a new PQR report with all fields', async () => {
      const data = {
        productId: testProductId,
        reviewYear: 2024,
        periodStart: '2024-01-01',
        periodEnd: '2024-12-31',
        batchesProduced: 120,
        deviationCount: 5,
        capaCount: 3,
        complaintCount: 2,
        oosCount: 1,
        recallCount: 0,
        stabilityStatus: 'All studies on track',
        conclusions: 'Product quality is satisfactory',
        recommendations: 'Continue current manufacturing practices',
      };

      const pqr = await createPqrReport(data, testUserId);

      expect(pqr).toBeDefined();
      expect(pqr.reportNumber).toMatch(/^PQR-2024-\d{3}$/);
      expect(pqr.productId).toBe(testProductId);
      expect(pqr.reviewYear).toBe(2024);
      expect(pqr.periodStart).toBe('2024-01-01');
      expect(pqr.periodEnd).toBe('2024-12-31');
      expect(pqr.status).toBe('draft');
      expect(pqr.batchesProduced).toBe(120);
      expect(pqr.deviationCount).toBe(5);
      expect(pqr.capaCount).toBe(3);
      expect(pqr.complaintCount).toBe(2);
      expect(pqr.oosCount).toBe(1);
      expect(pqr.recallCount).toBe(0);
      expect(pqr.stabilityStatus).toBe('All studies on track');
      expect(pqr.conclusions).toBe('Product quality is satisfactory');
      expect(pqr.recommendations).toBe('Continue current manufacturing practices');
      expect(pqr.createdBy).toBe(testUserId);
      expect(pqr.productName).toBe('ยาแคปซูลสมุนไพร A');
      expect(pqr.productCode).toBe('FG-001');
    });

    it('should generate sequential report numbers within same year', async () => {
      const pqr1 = await createPqrReport(
        { productId: testProductId, reviewYear: 2024 },
        testUserId
      );

      const pqr2 = await createPqrReport(
        { productId: testProduct2Id, reviewYear: 2024 },
        testUserId
      );

      const seq1 = parseInt(pqr1.reportNumber.split('-')[2], 10);
      const seq2 = parseInt(pqr2.reportNumber.split('-')[2], 10);

      expect(seq2).toBe(seq1 + 1);
    });

    it('should default metrics to zero if not provided', async () => {
      const pqr = await createPqrReport(
        { productId: testProductId, reviewYear: 2024 },
        testUserId
      );

      expect(pqr.batchesProduced).toBe(0);
      expect(pqr.deviationCount).toBe(0);
      expect(pqr.capaCount).toBe(0);
      expect(pqr.complaintCount).toBe(0);
      expect(pqr.oosCount).toBe(0);
      expect(pqr.recallCount).toBe(0);
    });
  });

  describe('getPqrById', () => {
    it('should retrieve PQR report with metrics', async () => {
      const created = await createPqrReport(
        {
          productId: testProductId,
          reviewYear: 2024,
          batchesProduced: 100,
        },
        testUserId
      );

      const retrieved = await getPqrById(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.reportNumber).toBe(created.reportNumber);
      expect(retrieved?.productName).toBe('ยาแคปซูลสมุนไพร A');
      expect(retrieved?.metrics).toEqual([]);
    });

    it('should return null for non-existent PQR', async () => {
      const result = await getPqrById(99999);
      expect(result).toBeNull();
    });
  });

  describe('listPqrReports', () => {
    it('should list all PQR reports with pagination', async () => {
      await createPqrReport(
        { productId: testProductId, reviewYear: 2024 },
        testUserId
      );
      await createPqrReport(
        { productId: testProduct2Id, reviewYear: 2024 },
        testUserId
      );

      const result = await listPqrReports({ page: 1, limit: 10 });

      expect(result.total).toBe(2);
      expect(result.items.length).toBe(2);
      expect(result.totalPages).toBe(1);
    });

    it('should filter by status', async () => {
      const pqr1 = await createPqrReport(
        { productId: testProductId, reviewYear: 2024 },
        testUserId
      );

      await updatePqrReport(pqr1.id, { status: 'under_review' }, testUserId);

      const result = await listPqrReports({ status: 'under_review' });

      expect(result.items.length).toBe(1);
      expect(result.items[0].status).toBe('under_review');
    });

    it('should filter by product', async () => {
      await createPqrReport(
        { productId: testProductId, reviewYear: 2024 },
        testUserId
      );
      await createPqrReport(
        { productId: testProduct2Id, reviewYear: 2024 },
        testUserId
      );

      const result = await listPqrReports({ productId: testProductId });

      expect(result.items.length).toBe(1);
      expect(result.items[0].productId).toBe(testProductId);
    });

    it('should filter by review year', async () => {
      await createPqrReport(
        { productId: testProductId, reviewYear: 2024 },
        testUserId
      );
      await createPqrReport(
        { productId: testProductId, reviewYear: 2023 },
        testUserId
      );

      const result = await listPqrReports({ reviewYear: 2024 });

      expect(result.items.length).toBe(1);
      expect(result.items[0].reviewYear).toBe(2024);
    });

    it('should search by report number or product', async () => {
      const pqr = await createPqrReport(
        { productId: testProductId, reviewYear: 2024 },
        testUserId
      );

      const resultByNumber = await listPqrReports({ search: pqr.reportNumber });
      expect(resultByNumber.items.length).toBe(1);

      const resultByProduct = await listPqrReports({ search: 'FG-001' });
      expect(resultByProduct.items.length).toBe(1);
    });
  });

  describe('updatePqrReport', () => {
    it('should update PQR report fields', async () => {
      const pqr = await createPqrReport(
        {
          productId: testProductId,
          reviewYear: 2024,
          batchesProduced: 100,
        },
        testUserId
      );

      const updated = await updatePqrReport(
        pqr.id,
        {
          batchesProduced: 150,
          deviationCount: 10,
          conclusions: 'Updated conclusions',
        },
        testUserId
      );

      expect(updated?.batchesProduced).toBe(150);
      expect(updated?.deviationCount).toBe(10);
      expect(updated?.conclusions).toBe('Updated conclusions');
    });

    it('should update status', async () => {
      const pqr = await createPqrReport(
        { productId: testProductId, reviewYear: 2024 },
        testUserId
      );

      const updated = await updatePqrReport(
        pqr.id,
        { status: 'under_review' },
        testUserId
      );

      expect(updated?.status).toBe('under_review');
    });
  });

  describe('deletePqrReport', () => {
    it('should delete PQR report and its metrics', async () => {
      const pqr = await createPqrReport(
        { productId: testProductId, reviewYear: 2024 },
        testUserId
      );

      const result = await deletePqrReport(pqr.id);
      expect(result).toBe(true);

      const retrieved = await getPqrById(pqr.id);
      expect(retrieved).toBeNull();
    });
  });

  describe('approvePQR', () => {
    it('should approve PQR and set approval fields', async () => {
      const pqr = await createPqrReport(
        {
          productId: testProductId,
          reviewYear: 2024,
          recommendations: 'Initial recommendations',
        },
        testUserId
      );

      const approved = await approvePQR(pqr.id, qaUserId, 'Approved by QA Manager');

      expect(approved).toBeDefined();
      expect(approved?.status).toBe('approved');
      expect(approved?.approvedBy).toBe(qaUserId);
      expect(approved?.approvedAt).toBeTruthy();
      expect(approved?.approvedByName).toBe('QA Manager');
      expect(approved?.recommendations).toContain('Initial recommendations');
      expect(approved?.recommendations).toContain('Approval Comments: Approved by QA Manager');
    });

    it('should approve without comments', async () => {
      const pqr = await createPqrReport(
        { productId: testProductId, reviewYear: 2024 },
        testUserId
      );

      const approved = await approvePQR(pqr.id, qaUserId);

      expect(approved?.status).toBe('approved');
      expect(approved?.approvedBy).toBe(qaUserId);
    });
  });

  describe('aggregateBatchMetrics', () => {
    it('should aggregate batch production metrics', async () => {
      // Create work orders for the product
      sqlite.prepare(`
        INSERT INTO work_orders (wo_number, bom_id, product_id, batch_number, planned_quantity, unit, status, actual_end_date, yield_percentage, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run('WO-2024-001', testBom1Id, testProductId, 'B001', 1000, 'ขวด', 'completed', '2024-06-15', 98.5, new Date().toISOString());

      sqlite.prepare(`
        INSERT INTO work_orders (wo_number, bom_id, product_id, batch_number, planned_quantity, unit, status, actual_end_date, yield_percentage, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run('WO-2024-002', testBom1Id, testProductId, 'B002', 1000, 'ขวด', 'completed', '2024-08-20', 97.8, new Date().toISOString());

      sqlite.prepare(`
        INSERT INTO work_orders (wo_number, bom_id, product_id, batch_number, planned_quantity, unit, status, actual_end_date, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run('WO-2024-003', testBom1Id, testProductId, 'B003', 1000, 'ขวด', 'in_progress', '2024-10-10', new Date().toISOString());

      const metrics = await aggregateBatchMetrics(
        testProductId,
        '2024-01-01',
        '2024-12-31'
      );

      expect(metrics.totalBatches).toBe(3);
      expect(metrics.averageYield).toBeCloseTo(98.15, 1);
      expect(metrics.batchPassRate).toBeCloseTo(66.67, 1); // 2 completed out of 3
      expect(metrics.batchesByStatus.completed).toBe(2);
      expect(metrics.batchesByStatus.in_progress).toBe(1);
    });

    it('should return zero metrics when no batches', async () => {
      const metrics = await aggregateBatchMetrics(
        testProductId,
        '2024-01-01',
        '2024-12-31'
      );

      expect(metrics.totalBatches).toBe(0);
      expect(metrics.averageYield).toBeNull();
      expect(metrics.batchPassRate).toBeNull();
      expect(metrics.batchesByStatus).toEqual({});
    });
  });

  describe('aggregateDeviationMetrics', () => {
    it('should aggregate deviation metrics linked to product', async () => {
      // Create work order
      const woId = sqlite.prepare(`
        INSERT INTO work_orders (wo_number, bom_id, product_id, batch_number, planned_quantity, unit, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run('WO-2024-001', testBom1Id, testProductId, 'B001', 1000, 'ขวด', 'completed', new Date().toISOString()).lastInsertRowid as number;

      // Create deviations
      sqlite.prepare(`
        INSERT INTO deviations (deviation_number, description, work_order_id, severity, status, reported_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('DEV-001', 'Minor packaging issue', woId, 'minor', 'closed', '2024-03-15', new Date().toISOString());

      sqlite.prepare(`
        INSERT INTO deviations (deviation_number, description, work_order_id, severity, status, reported_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('DEV-002', 'Major temperature deviation', woId, 'major', 'investigating', '2024-06-20', new Date().toISOString());

      sqlite.prepare(`
        INSERT INTO deviations (deviation_number, description, work_order_id, severity, status, reported_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('DEV-003', 'Critical contamination detected', woId, 'critical', 'closed', '2024-09-10', new Date().toISOString());

      const metrics = await aggregateDeviationMetrics(
        testProductId,
        '2024-01-01',
        '2024-12-31'
      );

      expect(metrics.totalDeviations).toBe(3);
      expect(metrics.bySeverity.minor).toBe(1);
      expect(metrics.bySeverity.major).toBe(1);
      expect(metrics.bySeverity.critical).toBe(1);
      expect(metrics.byStatus.closed).toBe(2);
      expect(metrics.byStatus.investigating).toBe(1);
      expect(metrics.closedCount).toBe(2);
    });

    it('should return empty metrics when no deviations', async () => {
      const metrics = await aggregateDeviationMetrics(
        testProductId,
        '2024-01-01',
        '2024-12-31'
      );

      expect(metrics.totalDeviations).toBe(0);
      expect(metrics.bySeverity).toEqual({});
      expect(metrics.byStatus).toEqual({});
      expect(metrics.closedCount).toBe(0);
    });
  });

  describe('aggregateCapaMetrics', () => {
    it('should aggregate CAPA metrics with on-time closure rate', async () => {
      // Create work order and deviation
      const woId = sqlite.prepare(`
        INSERT INTO work_orders (wo_number, bom_id, product_id, batch_number, planned_quantity, unit, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run('WO-2024-001', testBom1Id, testProductId, 'B001', 1000, 'ขวด', 'completed', new Date().toISOString()).lastInsertRowid as number;

      const devId = sqlite.prepare(`
        INSERT INTO deviations (deviation_number, description, work_order_id, severity, status, reported_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('DEV-001', 'Major process deviation', woId, 'major', 'closed', '2024-03-01', new Date().toISOString()).lastInsertRowid as number;

      // Create CAPAs
      // On-time closure
      sqlite.prepare(`
        INSERT INTO capa (capa_number, title, source_type, deviation_id, type, status, due_date, closed_date, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run('CAPA-001', 'CAPA for major deviation', 'deviation', devId, 'corrective', 'closed', '2024-05-01', '2024-04-25', '2024-03-15');

      // Late closure
      sqlite.prepare(`
        INSERT INTO capa (capa_number, title, source_type, deviation_id, type, status, due_date, closed_date, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run('CAPA-002', 'CAPA preventive action', 'deviation', devId, 'preventive', 'closed', '2024-06-01', '2024-06-15', '2024-04-01');

      // Still open
      sqlite.prepare(`
        INSERT INTO capa (capa_number, title, source_type, deviation_id, type, status, due_date, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run('CAPA-003', 'CAPA investigation ongoing', 'deviation', devId, 'both', 'in_progress', '2024-12-01', '2024-05-01');

      const metrics = await aggregateCapaMetrics(
        testProductId,
        '2024-01-01',
        '2024-12-31'
      );

      expect(metrics.totalCapas).toBe(3);
      expect(metrics.byStatus.closed).toBe(2);
      expect(metrics.byStatus.in_progress).toBe(1);
      expect(metrics.onTimeClosureRate).toBe(50); // 1 out of 2 closed on time
    });

    it('should return empty metrics when no CAPAs', async () => {
      const metrics = await aggregateCapaMetrics(
        testProductId,
        '2024-01-01',
        '2024-12-31'
      );

      expect(metrics.totalCapas).toBe(0);
      expect(metrics.byStatus).toEqual({});
      expect(metrics.onTimeClosureRate).toBeNull();
    });
  });

  describe('aggregateComplaintMetrics', () => {
    it('should aggregate complaint metrics by category and severity', async () => {
      // Create complaints
      sqlite.prepare(`
        INSERT INTO complaints (complaint_number, received_date, source, description, product_id, category, severity, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run('COMP-001', '2024-02-10', 'customer', 'Quality issue reported', testProductId, 'quality', 'major', 'closed', new Date().toISOString());

      sqlite.prepare(`
        INSERT INTO complaints (complaint_number, received_date, source, description, product_id, category, severity, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run('COMP-002', '2024-05-20', 'distributor', 'Packaging defect', testProductId, 'packaging', 'minor', 'under_investigation', new Date().toISOString());

      sqlite.prepare(`
        INSERT INTO complaints (complaint_number, received_date, source, description, product_id, category, severity, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run('COMP-003', '2024-08-15', 'customer', 'Critical quality issue', testProductId, 'quality', 'critical', 'closed', new Date().toISOString());

      const metrics = await aggregateComplaintMetrics(
        testProductId,
        '2024-01-01',
        '2024-12-31'
      );

      expect(metrics.totalComplaints).toBe(3);
      expect(metrics.byCategory.quality).toBe(2);
      expect(metrics.byCategory.packaging).toBe(1);
      expect(metrics.bySeverity.minor).toBe(1);
      expect(metrics.bySeverity.major).toBe(1);
      expect(metrics.bySeverity.critical).toBe(1);
    });
  });

  describe('aggregateOosMetrics', () => {
    it('should aggregate OOS metrics from quality tests', async () => {
      // Create inventory lot
      const lotId = sqlite.prepare(`
        INSERT INTO inventory_lots (lot_number, item_id, warehouse_id, quantity, unit, manufacturing_date, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('LOT-001', testProductId, testWarehouseId, 1000, 'ขวด', '2024-03-01', new Date().toISOString()).lastInsertRowid as number;

      // Create quality tests
      sqlite.prepare(`
        INSERT INTO quality_tests (lot_id, test_type, status, test_date, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(lotId, 'identity', 'pass', '2024-03-05', new Date().toISOString());

      sqlite.prepare(`
        INSERT INTO quality_tests (lot_id, test_type, status, test_date, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(lotId, 'assay', 'fail', '2024-03-05', new Date().toISOString());

      sqlite.prepare(`
        INSERT INTO quality_tests (lot_id, test_type, status, test_date, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(lotId, 'dissolution', 'pass', '2024-03-05', new Date().toISOString());

      sqlite.prepare(`
        INSERT INTO quality_tests (lot_id, test_type, status, test_date, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(lotId, 'assay', 'fail', '2024-06-10', new Date().toISOString());

      const metrics = await aggregateOosMetrics(
        testProductId,
        '2024-01-01',
        '2024-12-31'
      );

      expect(metrics.totalTests).toBe(4);
      expect(metrics.oosCount).toBe(2);
      expect(metrics.oosRate).toBe(50);
      expect(metrics.byTestType.identity.total).toBe(1);
      expect(metrics.byTestType.identity.oos).toBe(0);
      expect(metrics.byTestType.assay.total).toBe(2);
      expect(metrics.byTestType.assay.oos).toBe(2);
      expect(metrics.byTestType.dissolution.total).toBe(1);
      expect(metrics.byTestType.dissolution.oos).toBe(0);
    });
  });

  describe('aggregateStabilityStatus', () => {
    it('should aggregate stability study status with OOS alerts', async () => {
      // Create inventory lot
      const lotId = sqlite.prepare(`
        INSERT INTO inventory_lots (lot_number, item_id, warehouse_id, quantity, unit, manufacturing_date, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('LOT-001', testProductId, testWarehouseId, 1000, 'ขวด', '2024-01-01', new Date().toISOString()).lastInsertRowid as number;

      // Create stability studies
      const study1Id = sqlite.prepare(`
        INSERT INTO stability_studies (study_number, lot_id, status, start_date, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run('STAB-001', lotId, 'ongoing', '2024-01-15', new Date().toISOString()).lastInsertRowid as number;

      const study2Id = sqlite.prepare(`
        INSERT INTO stability_studies (study_number, lot_id, status, start_date, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run('STAB-002', lotId, 'ongoing', '2024-06-01', new Date().toISOString()).lastInsertRowid as number;

      // Create samples - study1 has OOS, study2 is on track
      sqlite.prepare(`
        INSERT INTO stability_samples (study_id, timepoint, oos_detected, created_at)
        VALUES (?, ?, ?, ?)
      `).run(study1Id, 3, 1, new Date().toISOString()); // timepoint is integer (months), oos_detected is boolean as integer

      sqlite.prepare(`
        INSERT INTO stability_samples (study_id, timepoint, oos_detected, created_at)
        VALUES (?, ?, ?, ?)
      `).run(study2Id, 3, 0, new Date().toISOString());

      const metrics = await aggregateStabilityStatus(
        testProductId,
        '2024-01-01',
        '2024-12-31'
      );

      expect(metrics.studiesCount).toBe(2);
      expect(metrics.alerts).toBe(1);
      expect(metrics.onTrack).toBe(1);
      expect(metrics.summary).toContain('2 stability studies');
      expect(metrics.summary).toContain('1 on track');
      expect(metrics.summary).toContain('1 with OOS alerts');
    });
  });

  describe('calculatePQRMetrics', () => {
    it('should calculate KPIs and generate recommendations', async () => {
      // Prepare aggregated data
      const aggregatedData = {
        batchMetrics: {
          totalBatches: 100,
          averageYield: 98.5,
          batchPassRate: 97.0,
          batchesByStatus: { completed: 97, failed: 3 },
        },
        deviationMetrics: {
          totalDeviations: 8,
          bySeverity: { minor: 5, major: 2, critical: 1 },
          byStatus: { closed: 7, investigating: 1 },
          closedCount: 7,
        },
        capaMetrics: {
          totalCapas: 5,
          byStatus: { closed: 4, in_progress: 1 },
          onTimeClosureRate: 75.0,
        },
        complaintMetrics: {
          totalComplaints: 2,
          byCategory: { quality: 1, packaging: 1 },
          bySeverity: { minor: 1, major: 1 },
        },
        oosMetrics: {
          totalTests: 500,
          oosCount: 5,
          oosRate: 1.0,
          byTestType: { assay: { total: 100, oos: 2 }, dissolution: { total: 400, oos: 3 } },
        },
        stabilityMetrics: {
          studiesCount: 3,
          onTrack: 3,
          alerts: 0,
          summary: '3 stability studies: 3 on track',
        },
      };

      const targets = {
        batchSuccessRate: 95,
        maxDeviationRate: 5,
        minCapaClosureRate: 90,
        maxOosRate: 2,
        maxComplaintRate: 1,
      };

      const result = await calculatePQRMetrics(aggregatedData, targets);

      expect(result.kpis.length).toBeGreaterThan(0);
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(100);
      expect(result.recommendations).toBeInstanceOf(Array);

      // Check specific KPIs
      const batchSuccessKpi = result.kpis.find(k => k.metricType === 'batch_success_rate');
      expect(batchSuccessKpi).toBeDefined();
      expect(batchSuccessKpi?.status).toBe('pass'); // 97% >= 95%

      const deviationKpi = result.kpis.find(k => k.metricType === 'deviation_rate');
      expect(deviationKpi).toBeDefined();
      expect(deviationKpi?.metricValue).toBe(8.0); // 8 deviations / 100 batches * 100
      expect(deviationKpi?.status).toBe('fail'); // 8% > 6% (5% * 1.2)

      const capaKpi = result.kpis.find(k => k.metricType === 'capa_closure_rate');
      expect(capaKpi).toBeDefined();
      expect(capaKpi?.metricValue).toBe(75.0);
      expect(capaKpi?.status).toBe('fail'); // 75% < (90% - 10% = 80%)
    });

    it('should generate recommendations based on performance', async () => {
      const poorPerformanceData = {
        batchMetrics: {
          totalBatches: 100,
          averageYield: 85.0,
          batchPassRate: 80.0,
          batchesByStatus: { completed: 80, failed: 20 },
        },
        deviationMetrics: {
          totalDeviations: 15,
          bySeverity: { critical: 3, major: 7, minor: 5 },
          byStatus: { closed: 10, investigating: 5 },
          closedCount: 10,
        },
        capaMetrics: {
          totalCapas: 10,
          byStatus: { closed: 5, in_progress: 5 },
          onTimeClosureRate: 40.0,
        },
        complaintMetrics: {
          totalComplaints: 5,
          byCategory: { quality: 3, packaging: 2 },
          bySeverity: { critical: 2, major: 2, minor: 1 },
        },
        oosMetrics: {
          totalTests: 100,
          oosCount: 10,
          oosRate: 10.0,
          byTestType: { assay: { total: 100, oos: 10 } },
        },
        stabilityMetrics: {
          studiesCount: 2,
          onTrack: 0,
          alerts: 2,
          summary: '2 stability studies: 2 with OOS alerts',
        },
      };

      const targets = {
        batchSuccessRate: 95,
        maxDeviationRate: 5,
        minCapaClosureRate: 90,
        maxOosRate: 2,
        maxComplaintRate: 1,
      };

      const result = await calculatePQRMetrics(poorPerformanceData, targets);

      // Should have low overall score
      expect(result.overallScore).toBeLessThan(50);

      // Should have multiple recommendations
      expect(result.recommendations.length).toBeGreaterThan(3);

      // Should flag critical issues
      const hasDeviationRec = result.recommendations.some(r => r.includes('deviation rate'));
      const hasCapaRec = result.recommendations.some(r => r.includes('CAPA'));
      const hasComplaintRec = result.recommendations.some(r => r.includes('Complaint'));
      const hasStabilityRec = result.recommendations.some(r => r.includes('stability'));

      expect(hasDeviationRec).toBe(true);
      expect(hasCapaRec).toBe(true);
      expect(hasComplaintRec).toBe(true);
      expect(hasStabilityRec).toBe(true);
    });
  });

  describe('getPqrDashboard', () => {
    it('should return dashboard statistics', async () => {
      // Create multiple PQRs
      await createPqrReport(
        { productId: testProductId, reviewYear: 2024, batchesProduced: 100 },
        testUserId
      );

      const pqr2 = await createPqrReport(
        { productId: testProduct2Id, reviewYear: 2024, batchesProduced: 120 },
        testUserId
      );

      await updatePqrReport(pqr2.id, { status: 'under_review' }, testUserId);

      const pqr3 = await createPqrReport(
        { productId: testProductId, reviewYear: 2023, batchesProduced: 90 },
        testUserId
      );

      await approvePQR(pqr3.id, qaUserId);

      const dashboard = await getPqrDashboard();

      expect(dashboard.totalReports).toBe(3);
      expect(dashboard.byStatus.draft).toBe(1);
      expect(dashboard.byStatus.under_review).toBe(1);
      expect(dashboard.byStatus.approved).toBe(1);
      expect(dashboard.pendingReview).toBe(1);
      expect(dashboard.approvedThisYear).toBe(0); // approved one is for 2023
      expect(dashboard.byYear.length).toBeGreaterThan(0);
      expect(dashboard.recentReports.length).toBeGreaterThan(0);
    });
  });

  describe('getProductsWithoutPqr', () => {
    it('should return products without PQR for given year', async () => {
      // Create PQR for product 1 only
      await createPqrReport(
        { productId: testProductId, reviewYear: 2024 },
        testUserId
      );

      const products = await getProductsWithoutPqr(2024);

      expect(products.length).toBe(1);
      expect(products[0].id).toBe(testProduct2Id);
      expect(products[0].name).toBe('ยาเม็ดสมุนไพร B');
      expect(products[0].code).toBe('FG-002');
    });

    it('should return all products when no PQRs exist', async () => {
      const products = await getProductsWithoutPqr(2024);

      expect(products.length).toBe(2);
    });
  });

  describe('Complete PQR Workflow', () => {
    it('should complete full PQR workflow from creation to approval', async () => {
      // 1. Create PQR in draft
      const pqr = await createPqrReport(
        {
          productId: testProductId,
          reviewYear: 2024,
          periodStart: '2024-01-01',
          periodEnd: '2024-12-31',
        },
        testUserId
      );

      expect(pqr.status).toBe('draft');

      // 2. Create related data for aggregation
      const woId = sqlite.prepare(`
        INSERT INTO work_orders (wo_number, bom_id, product_id, batch_number, planned_quantity, unit, status, actual_end_date, yield_percentage, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run('WO-2024-001', testBom1Id, testProductId, 'B001', 1000, 'ขวด', 'completed', '2024-06-15', 98.5, new Date().toISOString()).lastInsertRowid as number;

      const devId = sqlite.prepare(`
        INSERT INTO deviations (deviation_number, description, work_order_id, severity, status, reported_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('DEV-001', 'Minor deviation in workflow test', woId, 'minor', 'closed', '2024-06-20', new Date().toISOString()).lastInsertRowid as number;

      sqlite.prepare(`
        INSERT INTO capa (capa_number, title, source_type, deviation_id, type, status, due_date, closed_date, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run('CAPA-001', 'CAPA for workflow test', 'deviation', devId, 'corrective', 'closed', '2024-08-01', '2024-07-25', '2024-06-25');

      // 3. Aggregate metrics
      const batchMetrics = await aggregateBatchMetrics(testProductId, '2024-01-01', '2024-12-31');
      const deviationMetrics = await aggregateDeviationMetrics(testProductId, '2024-01-01', '2024-12-31');
      const capaMetrics = await aggregateCapaMetrics(testProductId, '2024-01-01', '2024-12-31');
      const complaintMetrics = await aggregateComplaintMetrics(testProductId, '2024-01-01', '2024-12-31');
      const oosMetrics = await aggregateOosMetrics(testProductId, '2024-01-01', '2024-12-31');
      const stabilityMetrics = await aggregateStabilityStatus(testProductId, '2024-01-01', '2024-12-31');

      expect(batchMetrics.totalBatches).toBe(1);
      expect(deviationMetrics.totalDeviations).toBe(1);
      expect(capaMetrics.totalCapas).toBe(1);

      // 4. Calculate KPIs
      const kpis = await calculatePQRMetrics(
        { batchMetrics, deviationMetrics, capaMetrics, complaintMetrics, oosMetrics, stabilityMetrics },
        { batchSuccessRate: 95, maxDeviationRate: 5, minCapaClosureRate: 90, maxOosRate: 2, maxComplaintRate: 1 }
      );

      expect(kpis.kpis.length).toBeGreaterThan(0);
      expect(kpis.recommendations.length).toBeGreaterThan(0);

      // 5. Update PQR with aggregated data
      const updated = await updatePqrReport(
        pqr.id,
        {
          batchesProduced: batchMetrics.totalBatches,
          deviationCount: deviationMetrics.totalDeviations,
          capaCount: capaMetrics.totalCapas,
          complaintCount: complaintMetrics.totalComplaints,
          oosCount: oosMetrics.oosCount,
          stabilityStatus: stabilityMetrics.summary,
          conclusions: `Overall score: ${kpis.overallScore}%. All KPIs reviewed.`,
          recommendations: kpis.recommendations.join('\n'),
          status: 'under_review',
        },
        testUserId
      );

      expect(updated?.status).toBe('under_review');
      expect(updated?.batchesProduced).toBe(1);
      expect(updated?.deviationCount).toBe(1);

      // 6. Approve PQR
      const approved = await approvePQR(pqr.id, qaUserId, 'All metrics reviewed and acceptable');

      expect(approved?.status).toBe('approved');
      expect(approved?.approvedBy).toBe(qaUserId);
      expect(approved?.approvedAt).toBeTruthy();
    });
  });
});
