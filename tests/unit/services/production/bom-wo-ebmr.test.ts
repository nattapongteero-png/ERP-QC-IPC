/**
 * Unit Tests: BOM/Recipe → Work Order → EBMR Flow
 *
 * Tests the complete production data flow:
 * 1. BOM with ingredients + operations
 * 2. Work Order creation from BOM
 * 3. Material dispensing
 * 4. Batch record (EBMR) creation per operation
 * 5. EBMR status workflow and data completeness
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

// Mock dependent services
vi.mock('@/lib/services/line-clearance.service', () => ({
  canStartProduction: vi.fn().mockResolvedValue({ allowed: true, errors: [] }),
}));

vi.mock('@/lib/services/variance-analysis.service', () => ({
  calculateWorkOrderVariances: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/services/unit-cost.service', () => ({
  getItemWAC: vi.fn().mockResolvedValue(100),
  updateFinishedGoodsWAC: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/services/inventory.service', () => ({
  getLotsForPicking: vi.fn().mockResolvedValue([]),
  issueMaterial: vi.fn().mockResolvedValue(undefined),
  receiveMaterial: vi.fn().mockResolvedValue(1),
}));

vi.mock('@/lib/audit', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

// Import test helpers after mock setup
import {
  setupTestDatabase,
  closeTestDatabase,
  cleanTables,
  TestDatabase,
} from '../../../helpers/test-db';
import { seedTestUser } from '../../../helpers/service-test-seeds';
import { getSqliteDate, getSqliteDateOffset } from '../../../helpers/service-test-utils';

// Import service functions after mocks
import {
  explodeBOM,
  createWorkOrder,
  updateWorkOrderStatus,
  dispenseMaterial,
  calculateYield,
} from '@/lib/services/production.service';

describe('BOM → Work Order → EBMR Flow', () => {
  let sqlite: Database.Database;
  let db: TestDatabase;

  beforeAll(() => {
    const setup = setupTestDatabase([
      schema.sqliteUsers,
      schema.sqliteAuditTrail,
      schema.sqliteVendors,
      schema.sqliteWarehouses,
      schema.sqliteWarehouseLocations,
      schema.sqliteItems,
      schema.sqliteInventoryLots,
      schema.sqliteInventoryTransactions,
      schema.sqliteBOM,
      schema.sqliteBOMLines,
      schema.sqliteOperations,
      schema.sqliteWorkOrders,
      schema.sqliteWorkOrderMaterials,
      schema.sqliteBatchRecords,
    ]);
    sqlite = setup.sqlite;
    db = setup.db;
    setTestDb(db);
  });

  afterAll(() => {
    closeTestDatabase(sqlite);
  });

  beforeEach(() => {
    cleanTables(sqlite, [
      'batch_records',
      'work_order_materials',
      'work_orders',
      'operations',
      'bom_lines',
      'bom',
      'inventory_transactions',
      'inventory_lots',
      'warehouse_locations',
      'warehouses',
      'vendors',
      'items',
      'audit_trail',
      'users',
    ]);
    seedTestUser(sqlite);
  });

  // ── Seed helpers ──────────────────────────────────────────

  /** Seeds a complete BOM with 3 ingredients and 4 operations (mixing, grinding, filling, packaging) */
  function seedFullBOMWithOperations() {
    // Vendor
    sqlite.exec(`
      INSERT INTO vendors (id, code, name, is_approved, is_active, created_at, updated_at)
      VALUES (1, 'V001', 'Test Vendor', 1, 1, '${getSqliteDate()}', '${getSqliteDate()}')
    `);

    // Warehouse
    sqlite.exec(`
      INSERT INTO warehouses (id, code, name, type, is_active, created_at, updated_at)
      VALUES (1, 'WH001', 'Main Warehouse', 'raw_material', 1, '${getSqliteDate()}', '${getSqliteDate()}')
    `);

    // Items: 1 finished good + 3 raw materials
    sqlite.exec(`
      INSERT INTO items (id, code, name_th, name_en, type, category, primary_unit, is_active, created_at, updated_at)
      VALUES
        (1, 'FG-SYRUP-100', 'น้ำเชื่อมสมุนไพร 100ml', 'Herbal Syrup 100ml', 'finished', 'product', 'bottle', 1, '${getSqliteDate()}', '${getSqliteDate()}'),
        (2, 'RM-GINGER', 'สารสกัดขิง', 'Ginger Extract', 'raw', 'herb', 'kg', 1, '${getSqliteDate()}', '${getSqliteDate()}'),
        (3, 'RM-HONEY', 'น้ำผึ้ง', 'Honey', 'raw', 'herb', 'kg', 1, '${getSqliteDate()}', '${getSqliteDate()}'),
        (4, 'PKG-BOTTLE', 'ขวด 100ml', 'Bottle 100ml', 'raw', 'packaging', 'pcs', 1, '${getSqliteDate()}', '${getSqliteDate()}')
    `);

    // Inventory lots
    sqlite.exec(`
      INSERT INTO inventory_lots (id, item_id, lot_number, warehouse_id, quantity, reserved_quantity, unit, status, created_at, updated_at)
      VALUES
        (1, 2, 'LOT-GINGER-001', 1, 50, 0, 'kg', 'released', '${getSqliteDate()}', '${getSqliteDate()}'),
        (2, 3, 'LOT-HONEY-001', 1, 100, 0, 'kg', 'released', '${getSqliteDate()}', '${getSqliteDate()}'),
        (3, 4, 'LOT-BOTTLE-001', 1, 5000, 0, 'pcs', 'released', '${getSqliteDate()}', '${getSqliteDate()}')
    `);

    // BOM
    sqlite.exec(`
      INSERT INTO bom (id, code, name, product_id, version, status, batch_size, batch_unit, yield_target, loss_allowance, created_at, updated_at)
      VALUES (1, 'BOM-SYRUP-001', 'สูตรน้ำเชื่อมสมุนไพร', 1, '1.0', 'approved', 100, 'bottle', 95, 2, '${getSqliteDate()}', '${getSqliteDate()}')
    `);

    // BOM Lines (ingredients)
    sqlite.exec(`
      INSERT INTO bom_lines (id, bom_id, item_id, quantity, unit, sequence, is_optional, created_at)
      VALUES
        (1, 1, 2, 5, 'kg', 1, 0, '${getSqliteDate()}'),
        (2, 1, 3, 10, 'kg', 2, 0, '${getSqliteDate()}'),
        (3, 1, 4, 100, 'pcs', 3, 0, '${getSqliteDate()}')
    `);

    // Operations (production steps tied to BOM)
    sqlite.exec(`
      INSERT INTO operations (id, bom_id, sequence, name, description, standard_time, setup_time, cleaning_time, instructions, created_at)
      VALUES
        (1, 1, 1, 'Weighing & Dispensing', 'ชั่งตวงวัตถุดิบตามสูตร', 30, 10, 5, 'Weigh all raw materials per BOM formula. Verify with second person.', '${getSqliteDate()}'),
        (2, 1, 2, 'Mixing', 'ผสมวัตถุดิบ', 60, 15, 10, 'Mix ginger extract with honey at 40C for 30 minutes.', '${getSqliteDate()}'),
        (3, 1, 3, 'Filling', 'บรรจุลงขวด', 45, 10, 15, 'Fill 100ml per bottle using automated filling machine. Check fill volume every 10 bottles.', '${getSqliteDate()}'),
        (4, 1, 4, 'Packaging & Labeling', 'บรรจุหีบห่อและติดฉลาก', 30, 5, 5, 'Apply labels, check batch number, pack into boxes of 24.', '${getSqliteDate()}')
    `);
  }

  /** Seed a work order + batch records for an existing BOM */
  function seedWorkOrderWithBatchRecords() {
    seedFullBOMWithOperations();

    // Work order in released status
    sqlite.exec(`
      INSERT INTO work_orders (id, wo_number, bom_id, product_id, batch_number, planned_quantity, unit, status, priority, planned_start_date, created_by, created_at, updated_at)
      VALUES (1, 'WO-202603-0001', 1, 1, 'BATCH-202603-0001', 100, 'bottle', 'released', 3, '${getSqliteDateOffset(1)}', 1, '${getSqliteDate()}', '${getSqliteDate()}')
    `);

    // Work order materials (planned from BOM)
    sqlite.exec(`
      INSERT INTO work_order_materials (id, work_order_id, item_id, lot_id, planned_quantity, actual_quantity, unit, status, created_at)
      VALUES
        (1, 1, 2, 1, 5, 5.1, 'kg', 'issued', '${getSqliteDate()}'),
        (2, 1, 3, 2, 10, 10.2, 'kg', 'issued', '${getSqliteDate()}'),
        (3, 1, 4, 3, 100, 100, 'pcs', 'issued', '${getSqliteDate()}')
    `);

    // Batch records - one per operation with JSON parameters
    const params1 = JSON.stringify([
      { name: 'weight_ginger', label: 'Ginger Weight', type: 'number', unit: 'kg', min: 4.8, max: 5.2, required: true },
      { name: 'weight_honey', label: 'Honey Weight', type: 'number', unit: 'kg', min: 9.5, max: 10.5, required: true },
      { name: 'verified', label: 'Double-checked', type: 'boolean', required: true },
    ]);
    const params2 = JSON.stringify([
      { name: 'temperature', label: 'Mixing Temperature', type: 'number', unit: 'C', min: 38, max: 42, required: true },
      { name: 'mixing_time', label: 'Mixing Duration', type: 'number', unit: 'min', min: 28, max: 35, required: true },
      { name: 'appearance', label: 'Appearance', type: 'select', options: ['Clear', 'Cloudy', 'Hazy'], required: true },
    ]);
    const params3 = JSON.stringify([
      { name: 'fill_volume', label: 'Fill Volume', type: 'number', unit: 'ml', min: 98, max: 102, required: true },
      { name: 'fill_speed', label: 'Fill Speed', type: 'number', unit: 'bottles/min', required: false },
    ]);
    const params4 = JSON.stringify([
      { name: 'label_aligned', label: 'Label Alignment', type: 'boolean', required: true },
      { name: 'batch_printed', label: 'Batch Number Printed', type: 'boolean', required: true },
    ]);

    const insertStmt = sqlite.prepare(`
      INSERT INTO batch_records (id, work_order_id, operation_id, sequence, step_name, instructions, parameters, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `);

    const now = getSqliteDate();
    insertStmt.run(1, 1, 1, 1, 'Weighing & Dispensing', 'Weigh all raw materials per BOM formula.', params1, now, now);
    insertStmt.run(2, 1, 2, 2, 'Mixing', 'Mix ginger extract with honey at 40C for 30 minutes.', params2, now, now);
    insertStmt.run(3, 1, 3, 3, 'Filling', 'Fill 100ml per bottle using automated filling machine.', params3, now, now);
    insertStmt.run(4, 1, 4, 4, 'Packaging & Labeling', 'Apply labels, check batch number, pack into boxes of 24.', params4, now, now);
  }

  // ── 1. BOM with Operations ────────────────────────────────

  describe('BOM with Operations', () => {
    it('should create BOM with ingredients and operations', () => {
      seedFullBOMWithOperations();

      const bom = sqlite.prepare('SELECT * FROM bom WHERE id = 1').get() as Record<string, unknown>;
      expect(bom).toBeDefined();
      expect(bom.code).toBe('BOM-SYRUP-001');
      expect(bom.status).toBe('approved');
      expect(bom.batch_size).toBe(100);
      expect(bom.yield_target).toBe(95);
      expect(bom.loss_allowance).toBe(2);
    });

    it('should have 3 BOM lines (ingredients)', () => {
      seedFullBOMWithOperations();

      const lines = sqlite.prepare('SELECT * FROM bom_lines WHERE bom_id = 1 ORDER BY sequence').all() as Record<string, unknown>[];
      expect(lines.length).toBe(3);
      expect(lines[0].item_id).toBe(2); // Ginger
      expect(lines[1].item_id).toBe(3); // Honey
      expect(lines[2].item_id).toBe(4); // Bottle
    });

    it('should have 4 operations (production steps)', () => {
      seedFullBOMWithOperations();

      const ops = sqlite.prepare('SELECT * FROM operations WHERE bom_id = 1 ORDER BY sequence').all() as Record<string, unknown>[];
      expect(ops.length).toBe(4);
      expect(ops[0].name).toBe('Weighing & Dispensing');
      expect(ops[1].name).toBe('Mixing');
      expect(ops[2].name).toBe('Filling');
      expect(ops[3].name).toBe('Packaging & Labeling');
    });

    it('should have standard_time, setup_time, cleaning_time for each operation', () => {
      seedFullBOMWithOperations();

      const ops = sqlite.prepare('SELECT * FROM operations WHERE bom_id = 1 ORDER BY sequence').all() as Record<string, unknown>[];
      for (const op of ops) {
        expect(op.standard_time).toBeGreaterThan(0);
        expect(op.setup_time).toBeGreaterThanOrEqual(0);
        expect(op.cleaning_time).toBeGreaterThanOrEqual(0);
        expect(op.instructions).toBeTruthy();
      }
    });

    it('should explode BOM with loss allowance', async () => {
      seedFullBOMWithOperations();

      const result = await explodeBOM(1, 100);

      expect(result.length).toBe(3);
      // With 2% loss allowance: 5 / (1 - 0.02) = 5.102
      const ginger = result.find(r => r.itemCode === 'RM-GINGER');
      expect(ginger).toBeDefined();
      expect(ginger!.requiredQuantity).toBeGreaterThan(5); // adjusted for loss
      expect(ginger!.availableStock).toBe(50);
      expect(ginger!.shortage).toBe(0);
    });
  });

  // ── 2. Work Order Creation from BOM ────────────────────────

  describe('Work Order from BOM', () => {
    it('should create work order linked to BOM', async () => {
      seedFullBOMWithOperations();

      const woId = await createWorkOrder(1, 100, getSqliteDateOffset(1), 1);
      expect(woId).toBeGreaterThan(0);

      const wo = sqlite.prepare('SELECT * FROM work_orders WHERE id = ?').get(woId) as Record<string, unknown>;
      expect(wo.bom_id).toBe(1);
      expect(wo.product_id).toBe(1);
      expect(wo.planned_quantity).toBe(100);
      expect(wo.unit).toBe('bottle');
      expect(wo.status).toBe('planned');
    });

    it('should generate WO number and batch number', async () => {
      seedFullBOMWithOperations();

      const woId = await createWorkOrder(1, 100, getSqliteDateOffset(1), 1);
      const wo = sqlite.prepare('SELECT * FROM work_orders WHERE id = ?').get(woId) as Record<string, unknown>;

      expect(wo.wo_number).toMatch(/^WO-\d{6}-\d{4}$/);
      expect(wo.batch_number).toMatch(/^BATCH-\d{6}-\d{4}$/);
    });

    it('should create sequential WO numbers', async () => {
      seedFullBOMWithOperations();

      const woId1 = await createWorkOrder(1, 50, getSqliteDateOffset(1), 1);
      const woId2 = await createWorkOrder(1, 75, getSqliteDateOffset(2), 1);

      const wo1 = sqlite.prepare('SELECT wo_number FROM work_orders WHERE id = ?').get(woId1) as { wo_number: string };
      const wo2 = sqlite.prepare('SELECT wo_number FROM work_orders WHERE id = ?').get(woId2) as { wo_number: string };

      const seq1 = parseInt(wo1.wo_number.split('-').pop()!);
      const seq2 = parseInt(wo2.wo_number.split('-').pop()!);
      expect(seq2).toBe(seq1 + 1);
    });
  });

  // ── 3. Work Order Status Transitions ──────────────────────

  describe('Work Order Status Workflow', () => {
    it('should follow planned -> released -> in_progress -> completed', async () => {
      seedFullBOMWithOperations();
      const woId = await createWorkOrder(1, 100, getSqliteDateOffset(1), 1);

      // planned -> released
      await updateWorkOrderStatus(woId, 'released', 1);
      let wo = sqlite.prepare('SELECT status FROM work_orders WHERE id = ?').get(woId) as { status: string };
      expect(wo.status).toBe('released');

      // released -> in_progress
      await updateWorkOrderStatus(woId, 'in_progress', 1);
      const wo2 = sqlite.prepare('SELECT status, actual_start_date FROM work_orders WHERE id = ?').get(woId) as { status: string; actual_start_date: string };
      expect(wo2.status).toBe('in_progress');
      expect(wo2.actual_start_date).toBeTruthy(); // auto-set

      // in_progress -> completed
      await updateWorkOrderStatus(woId, 'completed', 1);
      const wo3 = sqlite.prepare('SELECT status, actual_end_date FROM work_orders WHERE id = ?').get(woId) as { status: string; actual_end_date: string };
      expect(wo3.status).toBe('completed');
      expect(wo3.actual_end_date).toBeTruthy(); // auto-set
    });

    it('should reject invalid transitions', async () => {
      seedFullBOMWithOperations();
      const woId = await createWorkOrder(1, 100, getSqliteDateOffset(1), 1);

      // planned -> completed (invalid)
      await expect(updateWorkOrderStatus(woId, 'completed', 1)).rejects.toThrow(/Cannot transition/);

      // planned -> in_progress (invalid)
      await expect(updateWorkOrderStatus(woId, 'in_progress', 1)).rejects.toThrow(/Cannot transition/);
    });

    it('should support cancellation from planned state', async () => {
      seedFullBOMWithOperations();
      const woId = await createWorkOrder(1, 100, getSqliteDateOffset(1), 1);

      await updateWorkOrderStatus(woId, 'cancelled', 1);
      const wo = sqlite.prepare('SELECT status FROM work_orders WHERE id = ?').get(woId) as { status: string };
      expect(wo.status).toBe('cancelled');
    });
  });

  // ── 4. Material Dispensing ────────────────────────────────

  describe('Material Dispensing', () => {
    it('should dispense material within tolerance', async () => {
      seedFullBOMWithOperations();
      const woId = await createWorkOrder(1, 100, getSqliteDateOffset(1), 1);
      await updateWorkOrderStatus(woId, 'released', 1);

      // Dispense ginger: required ~5.1kg (with 2% loss), dispensing 5.1kg
      const result = await dispenseMaterial(woId, 1, 5.1, 1);

      expect(result.success).toBe(true);
      expect(result.deviationRequired).toBe(false);
      expect(result.message).toContain('successfully');
    });

    it('should flag deviation when outside tolerance', async () => {
      seedFullBOMWithOperations();
      const woId = await createWorkOrder(1, 100, getSqliteDateOffset(1), 1);
      await updateWorkOrderStatus(woId, 'released', 1);

      // Dispense way more than required (10kg vs ~5.1kg required)
      const result = await dispenseMaterial(woId, 1, 10, 1);

      expect(result.success).toBe(true);
      expect(result.deviationRequired).toBe(true);
      expect(result.message).toContain('tolerance');
    });

    it('should reject dispensing on non-released/non-in_progress WO', async () => {
      seedFullBOMWithOperations();
      const woId = await createWorkOrder(1, 100, getSqliteDateOffset(1), 1);
      // WO is in 'planned' status, not released

      await expect(dispenseMaterial(woId, 1, 5.0, 1)).rejects.toThrow(/Released or In Progress/);
    });

    it('should record material with unit cost', async () => {
      seedFullBOMWithOperations();
      const woId = await createWorkOrder(1, 100, getSqliteDateOffset(1), 1);
      await updateWorkOrderStatus(woId, 'released', 1);

      await dispenseMaterial(woId, 1, 5.0, 1);

      const material = sqlite.prepare('SELECT * FROM work_order_materials WHERE work_order_id = ?').get(woId) as Record<string, unknown>;
      expect(material).toBeDefined();
      expect(material.item_id).toBe(2); // Ginger
      expect(material.actual_quantity).toBe(5.0);
      expect(material.unit_cost).toBe(100); // Mocked WAC
      expect(material.total_cost).toBe(500); // 5 x 100
    });
  });

  // ── 5. Batch Records (EBMR) ──────────────────────────────

  describe('Batch Records - EBMR', () => {
    it('should create batch records for all operations', () => {
      seedWorkOrderWithBatchRecords();

      const records = sqlite.prepare('SELECT * FROM batch_records WHERE work_order_id = 1 ORDER BY sequence').all() as Record<string, unknown>[];
      expect(records.length).toBe(4);
      expect(records[0].step_name).toBe('Weighing & Dispensing');
      expect(records[1].step_name).toBe('Mixing');
      expect(records[2].step_name).toBe('Filling');
      expect(records[3].step_name).toBe('Packaging & Labeling');
    });

    it('should store JSON parameters per step', () => {
      seedWorkOrderWithBatchRecords();

      const record = sqlite.prepare('SELECT * FROM batch_records WHERE id = 1').get() as Record<string, unknown>;
      const params = JSON.parse(record.parameters as string);

      expect(params.length).toBe(3);
      expect(params[0].name).toBe('weight_ginger');
      expect(params[0].type).toBe('number');
      expect(params[0].min).toBe(4.8);
      expect(params[0].max).toBe(5.2);
    });

    it('should start in pending status', () => {
      seedWorkOrderWithBatchRecords();

      const records = sqlite.prepare('SELECT status FROM batch_records WHERE work_order_id = 1').all() as { status: string }[];
      for (const r of records) {
        expect(r.status).toBe('pending');
      }
    });

    it('should transition batch record: pending -> in_progress -> completed', () => {
      seedWorkOrderWithBatchRecords();
      const now = getSqliteDate();

      // Start step 1
      sqlite.prepare('UPDATE batch_records SET status = ?, start_time = ?, performed_by = ? WHERE id = ?')
        .run('in_progress', now, 1, 1);

      let record = sqlite.prepare('SELECT * FROM batch_records WHERE id = 1').get() as Record<string, unknown>;
      expect(record.status).toBe('in_progress');
      expect(record.start_time).toBeTruthy();
      expect(record.performed_by).toBe(1);

      // Record actual values and complete
      const actualValues = JSON.stringify({
        weight_ginger: 5.05,
        weight_honey: 10.1,
        verified: true,
      });
      sqlite.prepare('UPDATE batch_records SET actual_values = ?, status = ?, end_time = ? WHERE id = ?')
        .run(actualValues, 'completed', now, 1);

      record = sqlite.prepare('SELECT * FROM batch_records WHERE id = 1').get() as Record<string, unknown>;
      expect(record.status).toBe('completed');
      expect(record.end_time).toBeTruthy();

      const parsedActual = JSON.parse(record.actual_values as string);
      expect(parsedActual.weight_ginger).toBe(5.05);
      expect(parsedActual.weight_honey).toBe(10.1);
      expect(parsedActual.verified).toBe(true);
    });

    it('should support verification (verifiedBy, verifiedAt)', () => {
      seedWorkOrderWithBatchRecords();
      const now = getSqliteDate();

      // Complete + verify step
      sqlite.prepare('UPDATE batch_records SET status = ?, end_time = ?, verified_by = ?, verified_at = ? WHERE id = ?')
        .run('completed', now, 1, now, 1);

      const record = sqlite.prepare('SELECT * FROM batch_records WHERE id = 1').get() as Record<string, unknown>;
      expect(record.verified_by).toBe(1);
      expect(record.verified_at).toBeTruthy();
    });

    it('should support deviation status', () => {
      seedWorkOrderWithBatchRecords();

      sqlite.prepare('UPDATE batch_records SET status = ?, notes = ? WHERE id = ?')
        .run('deviation', 'Temperature exceeded max', 2);

      const record = sqlite.prepare('SELECT * FROM batch_records WHERE id = 2').get() as Record<string, unknown>;
      expect(record.status).toBe('deviation');
      expect(record.notes).toBe('Temperature exceeded max');
    });
  });

  // ── 6. EBMR Data Completeness ─────────────────────────────

  describe('EBMR Data Completeness', () => {
    it('should link batch record to work order info', () => {
      seedWorkOrderWithBatchRecords();

      const result = sqlite.prepare(`
        SELECT
          br.id as batch_record_id,
          br.step_name,
          wo.wo_number,
          wo.batch_number,
          wo.status as wo_status,
          wo.planned_quantity,
          wo.unit
        FROM batch_records br
        JOIN work_orders wo ON br.work_order_id = wo.id
        WHERE br.id = 1
      `).get() as Record<string, unknown>;

      expect(result.wo_number).toBe('WO-202603-0001');
      expect(result.batch_number).toBe('BATCH-202603-0001');
      expect(result.wo_status).toBe('released');
      expect(result.planned_quantity).toBe(100);
    });

    it('should link batch record to product info', () => {
      seedWorkOrderWithBatchRecords();

      const result = sqlite.prepare(`
        SELECT
          br.id,
          i.code as product_code,
          i.name_th as product_name,
          i.primary_unit as product_unit
        FROM batch_records br
        JOIN work_orders wo ON br.work_order_id = wo.id
        JOIN items i ON wo.product_id = i.id
        WHERE br.id = 1
      `).get() as Record<string, unknown>;

      expect(result.product_code).toBe('FG-SYRUP-100');
      expect(result.product_name).toContain('น้ำเชื่อมสมุนไพร');
      expect(result.product_unit).toBe('bottle');
    });

    it('should link batch record to operation details', () => {
      seedWorkOrderWithBatchRecords();

      const result = sqlite.prepare(`
        SELECT
          br.id,
          br.step_name,
          o.name as operation_name,
          o.description as operation_description,
          o.standard_time,
          o.setup_time,
          o.cleaning_time,
          o.instructions as operation_instructions
        FROM batch_records br
        JOIN operations o ON br.operation_id = o.id
        WHERE br.id = 2
      `).get() as Record<string, unknown>;

      expect(result.operation_name).toBe('Mixing');
      expect(result.operation_description).toContain('ผสมวัตถุดิบ');
      expect(result.standard_time).toBe(60);
      expect(result.operation_instructions).toContain('40C');
    });

    it('should retrieve all materials for the work order', () => {
      seedWorkOrderWithBatchRecords();

      const materials = sqlite.prepare(`
        SELECT
          wom.id,
          wom.item_id,
          i.code as item_code,
          i.name_th as item_name,
          wom.planned_quantity,
          wom.actual_quantity,
          wom.unit,
          wom.status
        FROM work_order_materials wom
        JOIN items i ON wom.item_id = i.id
        WHERE wom.work_order_id = 1
        ORDER BY wom.id
      `).all() as Record<string, unknown>[];

      expect(materials.length).toBe(3);
      // Ginger
      expect(materials[0].item_code).toBe('RM-GINGER');
      expect(materials[0].planned_quantity).toBe(5);
      expect(materials[0].actual_quantity).toBe(5.1);
      expect(materials[0].status).toBe('issued');
      // Honey
      expect(materials[1].item_code).toBe('RM-HONEY');
      // Bottle
      expect(materials[2].item_code).toBe('PKG-BOTTLE');
    });

    it('should provide all steps overview for navigation', () => {
      seedWorkOrderWithBatchRecords();

      const allSteps = sqlite.prepare(`
        SELECT id, sequence, step_name, status, start_time, end_time
        FROM batch_records
        WHERE work_order_id = 1
        ORDER BY sequence
      `).all() as Record<string, unknown>[];

      expect(allSteps.length).toBe(4);
      expect(allSteps[0].sequence).toBe(1);
      expect(allSteps[3].sequence).toBe(4);
    });

    it('should retrieve performer and verifier names', () => {
      seedWorkOrderWithBatchRecords();

      // Seed a second user as verifier
      sqlite.prepare(`
        INSERT INTO users (id, email, name, role, password, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 1, ?, ?)
      `).run(2, 'qa@example.com', 'QA Inspector', 'qa', 'hash', getSqliteDate(), getSqliteDate());

      // Set performer and verifier
      sqlite.prepare('UPDATE batch_records SET performed_by = ?, verified_by = ?, verified_at = ? WHERE id = ?')
        .run(1, 2, getSqliteDate(), 1);

      const result = sqlite.prepare(`
        SELECT
          br.id,
          performer.name as performer_name,
          verifier.name as verifier_name,
          br.verified_at
        FROM batch_records br
        LEFT JOIN users performer ON br.performed_by = performer.id
        LEFT JOIN users verifier ON br.verified_by = verifier.id
        WHERE br.id = 1
      `).get() as Record<string, unknown>;

      expect(result.performer_name).toContain('Test User');
      expect(result.verifier_name).toBe('QA Inspector');
      expect(result.verified_at).toBeTruthy();
    });

    it('should support timing data (start, end, duration calculation)', () => {
      seedWorkOrderWithBatchRecords();

      const startTime = '2026-03-30 08:00:00';
      const endTime = '2026-03-30 08:35:00';

      sqlite.prepare('UPDATE batch_records SET start_time = ?, end_time = ?, status = ? WHERE id = ?')
        .run(startTime, endTime, 'completed', 1);

      const record = sqlite.prepare('SELECT * FROM batch_records WHERE id = 1').get() as Record<string, unknown>;
      const start = new Date(record.start_time as string);
      const end = new Date(record.end_time as string);
      const durationMinutes = (end.getTime() - start.getTime()) / 60000;

      expect(durationMinutes).toBe(35);
    });

    it('should complete full EBMR query matching API response shape', () => {
      seedWorkOrderWithBatchRecords();
      const now = getSqliteDate();

      // Complete step 1 with actual values
      const actualValues = JSON.stringify({ weight_ginger: 5.05, weight_honey: 10.1, verified: true });
      sqlite.prepare('UPDATE batch_records SET status = ?, actual_values = ?, performed_by = ?, start_time = ?, end_time = ? WHERE id = ?')
        .run('completed', actualValues, 1, now, now, 1);

      // Query matching the API batch record detail endpoint
      const detail = sqlite.prepare(`
        SELECT
          br.id,
          br.work_order_id as workOrderId,
          wo.wo_number as woNumber,
          wo.batch_number as batchNumber,
          wo.status as woStatus,
          wo.product_id as productId,
          i.code as productCode,
          i.name_th as productName,
          i.primary_unit as productUnit,
          wo.planned_quantity as plannedQuantity,
          wo.actual_quantity as actualQuantity,
          br.operation_id as operationId,
          o.name as operationName,
          o.description as operationDescription,
          o.standard_time as standardTime,
          br.sequence,
          br.step_name as stepName,
          br.instructions,
          br.parameters,
          br.actual_values as actualValues,
          br.status,
          br.start_time as startTime,
          br.end_time as endTime,
          br.performed_by as performedBy,
          br.verified_by as verifiedBy,
          br.verified_at as verifiedAt,
          br.notes,
          br.attachments
        FROM batch_records br
        JOIN work_orders wo ON br.work_order_id = wo.id
        JOIN items i ON wo.product_id = i.id
        JOIN operations o ON br.operation_id = o.id
        WHERE br.id = 1
      `).get() as Record<string, unknown>;

      // Verify all EBMR sections are populated

      // Section 1: Work Order Info
      expect(detail.woNumber).toBe('WO-202603-0001');
      expect(detail.batchNumber).toBe('BATCH-202603-0001');
      expect(detail.woStatus).toBe('released');

      // Section 2: Product Info
      expect(detail.productCode).toBe('FG-SYRUP-100');
      expect(detail.productName).toContain('น้ำเชื่อมสมุนไพร');
      expect(detail.productUnit).toBe('bottle');
      expect(detail.plannedQuantity).toBe(100);

      // Section 3: Operation Info
      expect(detail.operationName).toBe('Weighing & Dispensing');
      expect(detail.operationDescription).toBeTruthy();
      expect(detail.standardTime).toBe(30);

      // Section 4: Step Details
      expect(detail.stepName).toBe('Weighing & Dispensing');
      expect(detail.instructions).toBeTruthy();
      expect(detail.sequence).toBe(1);

      // Section 5: Parameters & Actual Values
      const params = JSON.parse(detail.parameters as string);
      expect(params.length).toBe(3);
      const actuals = JSON.parse(detail.actualValues as string);
      expect(actuals.weight_ginger).toBe(5.05);

      // Section 6: Status & Timing
      expect(detail.status).toBe('completed');
      expect(detail.startTime).toBeTruthy();
      expect(detail.endTime).toBeTruthy();

      // Section 7: Personnel
      expect(detail.performedBy).toBe(1);
    });
  });

  // ── 7. Yield Calculation ──────────────────────────────────

  describe('Yield Calculation', () => {
    it('should calculate yield correctly for a completed WO', async () => {
      seedFullBOMWithOperations();

      sqlite.prepare(`
        INSERT INTO work_orders (id, wo_number, bom_id, product_id, batch_number, planned_quantity, actual_quantity, reject_quantity, unit, status, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(1, 'WO-2026-0001', 1, 1, 'BATCH-001', 100, 93, 3, 'bottle', 'completed', 1, getSqliteDate(), getSqliteDate());

      const result = await calculateYield(1);

      expect(result.theoretical).toBe(100);
      expect(result.actualGood).toBe(93);
      expect(result.actualReject).toBe(3);
      expect(result.yieldPercent).toBe(93);
      // 93 < (95 - 5) = 90? No -> normal
      expect(result.status).toBe('normal');
    });

    it('should detect low yield', async () => {
      seedFullBOMWithOperations();

      sqlite.prepare(`
        INSERT INTO work_orders (id, wo_number, bom_id, product_id, batch_number, planned_quantity, actual_quantity, reject_quantity, unit, status, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(1, 'WO-2026-0001', 1, 1, 'BATCH-001', 100, 85, 5, 'bottle', 'completed', 1, getSqliteDate(), getSqliteDate());

      const result = await calculateYield(1);

      expect(result.yieldPercent).toBe(85);
      // 85 < (95 - 5) = 90 -> low_yield
      expect(result.status).toBe('low_yield');
    });

    it('should detect high yield (possible measurement error)', async () => {
      seedFullBOMWithOperations();

      sqlite.prepare(`
        INSERT INTO work_orders (id, wo_number, bom_id, product_id, batch_number, planned_quantity, actual_quantity, reject_quantity, unit, status, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(1, 'WO-2026-0001', 1, 1, 'BATCH-001', 100, 110, 0, 'bottle', 'completed', 1, getSqliteDate(), getSqliteDate());

      const result = await calculateYield(1);

      expect(result.yieldPercent).toBe(110);
      expect(result.status).toBe('high_yield');
    });
  });
});
