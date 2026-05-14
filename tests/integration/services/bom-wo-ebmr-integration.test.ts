/**
 * Integration Tests: BOM/Recipe → Work Order → EBMR End-to-End Flow
 *
 * Tests the complete production lifecycle using real service functions:
 * 1. Create BOM with ingredients + operations
 * 2. Create Work Order from BOM
 * 3. Release WO + dispense materials
 * 4. Start production (in_progress)
 * 5. Create batch records (EBMR) for each operation
 * 6. Execute each step: record actual values, complete, verify
 * 7. Record production output + yield
 * 8. Verify EBMR displays all data correctly
 *
 * Reference Work Order: WO2601235718 pattern
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

// Mock the database module
vi.mock('@/lib/db', () => ({
  isSqlite: () => true,
  getDb: async () => getTestDb(),
  getSqliteDb: () => getTestDb(),
  markSchemaSynced: () => {},
  schema,
}));

// Mock external services
vi.mock('@/lib/services/line-clearance.service', () => ({
  canStartProduction: vi.fn().mockResolvedValue({ allowed: true, errors: [] }),
}));

vi.mock('@/lib/services/variance-analysis.service', () => ({
  calculateWorkOrderVariances: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/services/unit-cost.service', () => ({
  getItemWAC: vi.fn().mockResolvedValue(150), // 150 baht per unit WAC
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

// Import helpers
import {
  setupTestDatabase,
  closeTestDatabase,
  cleanTables,
  TestDatabase,
} from '../../helpers/test-db';
import { seedTestUser } from '../../helpers/service-test-seeds';
import { getSqliteDate, getSqliteDateOffset } from '../../helpers/service-test-utils';

// Import service functions
import {
  explodeBOM,
  createWorkOrder,
  updateWorkOrderStatus,
  dispenseMaterial,
  calculateYield,
} from '@/lib/services/production.service';

describe('BOM -> WO -> EBMR Integration', () => {
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

  // ── Seed realistic herbal medicine production data ─────────

  function seedHerbalProductionData() {
    // Users: operator + QA verifier
    sqlite.prepare(`
      INSERT OR IGNORE INTO users (id, email, name, role, password, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    `).run(2, 'operator@herbal.com', 'Operator Somchai', 'operator', 'hash', getSqliteDate(), getSqliteDate());

    sqlite.prepare(`
      INSERT OR IGNORE INTO users (id, email, name, role, password, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    `).run(3, 'qa@herbal.com', 'QA Siriporn', 'qa', 'hash', getSqliteDate(), getSqliteDate());

    // Vendor
    sqlite.prepare(`
      INSERT INTO vendors (id, code, name, is_approved, is_active, created_at, updated_at)
      VALUES (?, ?, ?, 1, 1, ?, ?)
    `).run(1, 'V-HERB01', 'Thai Herbal Supplier Co.', getSqliteDate(), getSqliteDate());

    // Warehouses
    sqlite.prepare(`
      INSERT INTO warehouses (id, code, name, type, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, ?, ?)
    `).run(1, 'WH-RM', 'Raw Material Warehouse', 'raw_material', getSqliteDate(), getSqliteDate());
    sqlite.prepare(`
      INSERT INTO warehouses (id, code, name, type, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, ?, ?)
    `).run(2, 'WH-FG', 'Finished Goods Warehouse', 'finished_goods', getSqliteDate(), getSqliteDate());

    // Items: Finished product + 5 raw materials
    const items = [
      [1, 'FG-CAPSULE-60', 'แคปซูลขมิ้นชัน 60 เม็ด', 'Turmeric Capsule 60pcs', 'finished', 'product', 'box'],
      [2, 'RM-TURMERIC', 'ผงขมิ้นชัน', 'Turmeric Powder', 'raw', 'herb', 'kg'],
      [3, 'RM-PEPPER', 'ผงพริกไทยดำ', 'Black Pepper Extract', 'raw', 'herb', 'kg'],
      [4, 'RM-CAPSULE', 'แคปซูลเปล่า', 'Empty Capsule Shell', 'raw', 'packaging', 'pcs'],
      [5, 'PKG-BOTTLE60', 'ขวดบรรจุ 60 เม็ด', 'Bottle for 60 Capsules', 'raw', 'packaging', 'pcs'],
      [6, 'PKG-LABEL', 'ฉลากขมิ้นชัน', 'Turmeric Label', 'raw', 'packaging', 'pcs'],
    ];
    const itemStmt = sqlite.prepare(`
      INSERT INTO items (id, code, name_th, name_en, type, category, primary_unit, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `);
    for (const item of items) {
      itemStmt.run(...item, getSqliteDate(), getSqliteDate());
    }

    // Inventory lots with realistic quantities
    const lots = [
      [1, 2, 'LOT-TUR-2603-001', 1, 200, 0, 'kg', 'released'],
      [2, 3, 'LOT-PEP-2603-001', 1, 50, 0, 'kg', 'released'],
      [3, 4, 'LOT-CAP-2603-001', 1, 100000, 0, 'pcs', 'released'],
      [4, 5, 'LOT-BOT-2603-001', 1, 10000, 0, 'pcs', 'released'],
      [5, 6, 'LOT-LBL-2603-001', 1, 10000, 0, 'pcs', 'released'],
    ];
    const lotStmt = sqlite.prepare(`
      INSERT INTO inventory_lots (id, item_id, lot_number, warehouse_id, quantity, reserved_quantity, unit, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const lot of lots) {
      lotStmt.run(...lot, getSqliteDate(), getSqliteDate());
    }

    // BOM: Turmeric Capsule recipe
    sqlite.prepare(`
      INSERT INTO bom (id, code, name, product_id, version, status, batch_size, batch_unit, yield_target, loss_allowance, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(1, 'BOM-CAP-TUR-001', 'สูตรแคปซูลขมิ้นชัน', 1, '2.0', 'approved', 1000, 'box', 97, 1.5, getSqliteDate(), getSqliteDate());

    // BOM Lines
    const bomLines = [
      [1, 1, 2, 30, 'kg', 1, 0],   // Turmeric 30kg per 1000 boxes
      [2, 1, 3, 3, 'kg', 2, 0],    // Black pepper 3kg per 1000 boxes
      [3, 1, 4, 60000, 'pcs', 3, 0], // Capsule shells 60000 per 1000 boxes
      [4, 1, 5, 1000, 'pcs', 4, 0],  // Bottles
      [5, 1, 6, 1000, 'pcs', 5, 0],  // Labels
    ];
    const bomLineStmt = sqlite.prepare(`
      INSERT INTO bom_lines (id, bom_id, item_id, quantity, unit, sequence, is_optional, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const line of bomLines) {
      bomLineStmt.run(...line, getSqliteDate());
    }

    // Operations (5 GMP-compliant steps)
    const ops = [
      [1, 1, 1, 'Weighing & Dispensing', 'ชั่งตวงวัตถุดิบตามสูตร BOM', 45, 15, 10,
        'Step 1: Verify line clearance\nStep 2: Weigh turmeric powder per BOM\nStep 3: Weigh black pepper extract\nStep 4: Double-check by second operator\nStep 5: Record actual weights'],
      [2, 1, 2, 'Blending', 'ผสมผงสมุนไพร', 90, 20, 15,
        'Step 1: Load turmeric into blender\nStep 2: Add black pepper extract\nStep 3: Blend at 30 RPM for 45 minutes\nStep 4: Check blend uniformity\nStep 5: Record blending parameters'],
      [3, 1, 3, 'Encapsulation', 'บรรจุแคปซูล', 120, 30, 20,
        'Step 1: Setup capsule filling machine\nStep 2: Load empty capsules\nStep 3: Fill at 500mg per capsule\nStep 4: Check fill weight every 50 capsules\nStep 5: Record fill weights and reject count'],
      [4, 1, 4, 'Visual Inspection & Sorting', 'ตรวจสอบและคัดแยก', 60, 10, 5,
        'Step 1: Visual inspection for defects\nStep 2: Sort good/reject capsules\nStep 3: Count 60 capsules per bottle\nStep 4: Record inspection results'],
      [5, 1, 5, 'Packaging & Labeling', 'บรรจุขวดและติดฉลาก', 45, 10, 10,
        'Step 1: Insert desiccant\nStep 2: Seal bottles\nStep 3: Apply labels with batch number\nStep 4: Verify label information\nStep 5: Pack into shipping boxes'],
    ];
    const opStmt = sqlite.prepare(`
      INSERT INTO operations (id, bom_id, sequence, name, description, standard_time, setup_time, cleaning_time, instructions, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const op of ops) {
      opStmt.run(...op, getSqliteDate());
    }
  }

  // ── Integration Test: Full Production Lifecycle ────────────

  describe('Full Production Lifecycle: BOM -> WO -> Material -> EBMR -> Yield', () => {
    it('should complete the entire BOM -> WO -> EBMR flow end-to-end', async () => {
      seedHerbalProductionData();

      // ── Step 1: BOM Explosion ──
      const bomMaterials = await explodeBOM(1, 500); // 500 boxes (half batch)
      expect(bomMaterials.length).toBe(5);

      // Verify quantity scaling (batch size = 1000, ordering 500 = 50%)
      const turmeric = bomMaterials.find(m => m.itemCode === 'RM-TURMERIC');
      expect(turmeric).toBeDefined();
      // 30 * 500 / 1000 / (1 - 0.015) = ~15.228
      expect(turmeric!.requiredQuantity).toBeGreaterThan(15);
      expect(turmeric!.requiredQuantity).toBeLessThan(16);
      expect(turmeric!.shortage).toBe(0); // 200kg available

      // ── Step 2: Create Work Order ──
      const woId = await createWorkOrder(1, 500, getSqliteDateOffset(1), 1);
      expect(woId).toBeGreaterThan(0);

      const wo = sqlite.prepare('SELECT * FROM work_orders WHERE id = ?').get(woId) as Record<string, unknown>;
      expect(wo.bom_id).toBe(1);
      expect(wo.product_id).toBe(1);
      expect(wo.planned_quantity).toBe(500);
      expect(wo.status).toBe('planned');

      // ── Step 3: Release Work Order ──
      await updateWorkOrderStatus(woId, 'released', 1);
      const releasedWo = sqlite.prepare('SELECT status FROM work_orders WHERE id = ?').get(woId) as { status: string };
      expect(releasedWo.status).toBe('released');

      // ── Step 4: Dispense Materials ──
      // Dispense turmeric
      const dispResult1 = await dispenseMaterial(woId, 1, 15.3, 2); // operator dispenses
      expect(dispResult1.success).toBe(true);

      // Dispense black pepper
      const dispResult2 = await dispenseMaterial(woId, 2, 1.52, 2);
      expect(dispResult2.success).toBe(true);

      // Verify materials recorded with costs
      const materials = sqlite.prepare('SELECT * FROM work_order_materials WHERE work_order_id = ? ORDER BY id').all(woId) as Record<string, unknown>[];
      expect(materials.length).toBe(2);
      expect(materials[0].unit_cost).toBe(150); // WAC from mock
      expect(materials[0].total_cost).toBe(2295); // 15.3 x 150

      // ── Step 5: Start Production ──
      await updateWorkOrderStatus(woId, 'in_progress', 1);
      const inProgWo = sqlite.prepare('SELECT status, actual_start_date FROM work_orders WHERE id = ?').get(woId) as Record<string, unknown>;
      expect(inProgWo.status).toBe('in_progress');
      expect(inProgWo.actual_start_date).toBeTruthy();

      // ── Step 6: Create Batch Records (EBMR) ──
      const operations = sqlite.prepare('SELECT * FROM operations WHERE bom_id = 1 ORDER BY sequence').all() as Record<string, unknown>[];
      expect(operations.length).toBe(5);

      const batchRecordStmt = sqlite.prepare(`
        INSERT INTO batch_records (work_order_id, operation_id, sequence, step_name, instructions, parameters, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
      `);

      const paramSets = [
        JSON.stringify([
          { name: 'turmeric_weight', label: 'Turmeric Weight', type: 'number', unit: 'kg', min: 14.5, max: 15.5, required: true },
          { name: 'pepper_weight', label: 'Black Pepper Weight', type: 'number', unit: 'kg', min: 1.4, max: 1.6, required: true },
          { name: 'double_checked', label: 'Double Checked', type: 'boolean', required: true },
        ]),
        JSON.stringify([
          { name: 'blend_speed', label: 'Blend Speed', type: 'number', unit: 'RPM', min: 25, max: 35, required: true },
          { name: 'blend_time', label: 'Blend Time', type: 'number', unit: 'min', min: 40, max: 50, required: true },
          { name: 'uniformity', label: 'Blend Uniformity', type: 'select', options: ['Pass', 'Fail'], required: true },
        ]),
        JSON.stringify([
          { name: 'fill_weight', label: 'Capsule Fill Weight', type: 'number', unit: 'mg', min: 490, max: 510, required: true },
          { name: 'reject_count', label: 'Reject Count', type: 'number', required: true },
          { name: 'machine_speed', label: 'Machine Speed', type: 'number', unit: 'caps/min', required: false },
        ]),
        JSON.stringify([
          { name: 'defect_count', label: 'Defect Count', type: 'number', required: true },
          { name: 'inspection_pass', label: 'Visual Inspection', type: 'boolean', required: true },
        ]),
        JSON.stringify([
          { name: 'label_verified', label: 'Label Verified', type: 'boolean', required: true },
          { name: 'batch_on_label', label: 'Batch No. on Label', type: 'boolean', required: true },
          { name: 'boxes_packed', label: 'Boxes Packed', type: 'number', required: true },
        ]),
      ];

      const brIds: number[] = [];
      for (let i = 0; i < operations.length; i++) {
        const op = operations[i];
        const info = batchRecordStmt.run(
          woId,
          op.id,
          op.sequence,
          op.name,
          op.instructions,
          paramSets[i],
          getSqliteDate(),
          getSqliteDate(),
        );
        brIds.push(Number(info.lastInsertRowid));
      }
      expect(brIds.length).toBe(5);

      // ── Step 7: Execute Each Batch Record Step ──
      const now = getSqliteDate();
      const updateBr = sqlite.prepare(`
        UPDATE batch_records SET status = ?, actual_values = ?, performed_by = ?, start_time = ?, end_time = ?, notes = ?, updated_at = ?
        WHERE id = ?
      `);

      // Step 1: Weighing
      updateBr.run('completed',
        JSON.stringify({ turmeric_weight: 15.3, pepper_weight: 1.52, double_checked: true }),
        2, now, now, 'All weights within tolerance', now, brIds[0]);

      // Step 2: Blending
      updateBr.run('completed',
        JSON.stringify({ blend_speed: 30, blend_time: 45, uniformity: 'Pass' }),
        2, now, now, 'Blend uniform, no clumps observed', now, brIds[1]);

      // Step 3: Encapsulation
      updateBr.run('completed',
        JSON.stringify({ fill_weight: 502, reject_count: 150, machine_speed: 45 }),
        2, now, now, '150 capsules rejected (dents)', now, brIds[2]);

      // Step 4: Visual Inspection
      updateBr.run('completed',
        JSON.stringify({ defect_count: 12, inspection_pass: true }),
        2, now, now, '12 additional defects found and removed', now, brIds[3]);

      // Step 5: Packaging
      updateBr.run('completed',
        JSON.stringify({ label_verified: true, batch_on_label: true, boxes_packed: 488 }),
        2, now, now, '488 boxes packed (expected 500, 12 short due to defects)', now, brIds[4]);

      // ── Step 8: Verify All Steps ──
      const verifyBr = sqlite.prepare('UPDATE batch_records SET verified_by = ?, verified_at = ? WHERE id = ?');
      for (const brId of brIds) {
        verifyBr.run(3, now, brId); // QA Siriporn verifies
      }

      // ── Step 9: Record Production Output ──
      sqlite.prepare('UPDATE work_orders SET actual_quantity = ?, reject_quantity = ?, updated_at = ? WHERE id = ?')
        .run(488, 12, now, woId);

      // ── Step 10: Calculate Yield ──
      const yieldResult = await calculateYield(woId);
      expect(yieldResult.theoretical).toBe(500);
      expect(yieldResult.actualGood).toBe(488);
      expect(yieldResult.actualReject).toBe(12);
      expect(yieldResult.yieldPercent).toBeCloseTo(97.6, 0);
      expect(yieldResult.status).toBe('normal'); // 97.6 > 92 (97 - 5)

      // ── Step 11: Complete Work Order ──
      await updateWorkOrderStatus(woId, 'completed', 1);
      const completedWo = sqlite.prepare('SELECT status, actual_end_date FROM work_orders WHERE id = ?').get(woId) as Record<string, unknown>;
      expect(completedWo.status).toBe('completed');
      expect(completedWo.actual_end_date).toBeTruthy();
    });
  });

  // ── Integration Test: EBMR Data Completeness ──────────────

  describe('EBMR Full Data Display', () => {
    it('should display all EBMR sections with complete data', async () => {
      seedHerbalProductionData();

      // Create and process work order
      const woId = await createWorkOrder(1, 500, getSqliteDateOffset(1), 1);
      await updateWorkOrderStatus(woId, 'released', 1);
      await updateWorkOrderStatus(woId, 'in_progress', 1);

      // Create batch records for all 5 operations
      const operations = sqlite.prepare('SELECT * FROM operations WHERE bom_id = 1 ORDER BY sequence').all() as Record<string, unknown>[];

      const brStmt = sqlite.prepare(`
        INSERT INTO batch_records (work_order_id, operation_id, sequence, step_name, instructions, parameters, status, performed_by, verified_by, verified_at, start_time, end_time, actual_values, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const now = getSqliteDate();
      for (const op of operations) {
        const params = JSON.stringify([{ name: 'test_param', label: 'Test', type: 'number', required: true }]);
        const actuals = JSON.stringify({ test_param: 42 });
        brStmt.run(woId, op.id, op.sequence, op.name, op.instructions, params,
          2, 3, now, now, now, actuals, 'Step completed normally', now, now);
      }

      // Dispense materials
      await dispenseMaterial(woId, 1, 15, 2); // Turmeric
      await dispenseMaterial(woId, 2, 1.5, 2); // Pepper

      // Now verify EBMR data completeness for the first batch record
      const firstBr = sqlite.prepare('SELECT id FROM batch_records WHERE work_order_id = ? ORDER BY sequence LIMIT 1').get(woId) as { id: number };

      // Full EBMR query (matches API endpoint)
      const ebmr = sqlite.prepare(`
        SELECT
          br.id,
          br.work_order_id,
          wo.wo_number,
          wo.batch_number,
          wo.status as wo_status,
          wo.product_id,
          i.code as product_code,
          i.name_th as product_name,
          i.name_en as product_name_en,
          i.primary_unit as product_unit,
          wo.planned_quantity,
          wo.actual_quantity,
          wo.planned_start_date,
          wo.actual_start_date,
          wo.actual_end_date,
          br.operation_id,
          o.name as operation_name,
          o.description as operation_description,
          o.standard_time,
          o.setup_time,
          o.cleaning_time,
          br.sequence,
          br.step_name,
          br.instructions,
          br.parameters,
          br.actual_values,
          br.status,
          br.start_time,
          br.end_time,
          br.performed_by,
          br.verified_by,
          br.verified_at,
          br.notes,
          br.attachments,
          performer.name as performer_name,
          verifier.name as verifier_name
        FROM batch_records br
        JOIN work_orders wo ON br.work_order_id = wo.id
        JOIN items i ON wo.product_id = i.id
        JOIN operations o ON br.operation_id = o.id
        LEFT JOIN users performer ON br.performed_by = performer.id
        LEFT JOIN users verifier ON br.verified_by = verifier.id
        WHERE br.id = ?
      `).get(firstBr.id) as Record<string, unknown>;

      // ── Verify Section 1: Work Order Information ──
      expect(ebmr.wo_number).toMatch(/^WO-\d{6}-\d{4}$/);
      expect(ebmr.batch_number).toBeTruthy();
      expect(ebmr.wo_status).toBe('in_progress');
      expect(ebmr.planned_quantity).toBe(500);

      // ── Verify Section 2: Product Information ──
      expect(ebmr.product_code).toBe('FG-CAPSULE-60');
      expect(ebmr.product_name).toContain('แคปซูลขมิ้นชัน');
      expect(ebmr.product_name_en).toContain('Turmeric');
      expect(ebmr.product_unit).toBe('box');

      // ── Verify Section 3: Operation Details ──
      expect(ebmr.operation_name).toBe('Weighing & Dispensing');
      expect(ebmr.operation_description).toContain('ชั่งตวง');
      expect(ebmr.standard_time).toBe(45);
      expect(ebmr.setup_time).toBe(15);
      expect(ebmr.cleaning_time).toBe(10);

      // ── Verify Section 4: Step Information ──
      expect(ebmr.step_name).toBe('Weighing & Dispensing');
      expect(ebmr.instructions).toContain('Weigh');
      expect(ebmr.sequence).toBe(1);

      // ── Verify Section 5: Parameters & Actual Values ──
      const params = JSON.parse(ebmr.parameters as string);
      expect(params.length).toBeGreaterThan(0);
      expect(params[0]).toHaveProperty('name');
      expect(params[0]).toHaveProperty('type');

      const actuals = JSON.parse(ebmr.actual_values as string);
      expect(actuals).toHaveProperty('test_param');
      expect(actuals.test_param).toBe(42);

      // ── Verify Section 6: Status & Timing ──
      expect(ebmr.status).toBe('completed');
      expect(ebmr.start_time).toBeTruthy();
      expect(ebmr.end_time).toBeTruthy();

      // ── Verify Section 7: Personnel ──
      expect(ebmr.performer_name).toBe('Operator Somchai');
      expect(ebmr.verifier_name).toBe('QA Siriporn');
      expect(ebmr.verified_at).toBeTruthy();

      // ── Verify Section 8: Notes ──
      expect(ebmr.notes).toBe('Step completed normally');

      // ── Verify All Steps Navigation ──
      const allSteps = sqlite.prepare(`
        SELECT id, sequence, step_name, status FROM batch_records
        WHERE work_order_id = ? ORDER BY sequence
      `).all(woId) as Record<string, unknown>[];

      expect(allSteps.length).toBe(5);
      expect(allSteps[0].step_name).toBe('Weighing & Dispensing');
      expect(allSteps[4].step_name).toBe('Packaging & Labeling');
      for (const step of allSteps) {
        expect(step.status).toBe('completed');
      }

      // ── Verify Materials Section ──
      const woMaterials = sqlite.prepare(`
        SELECT
          wom.id, wom.item_id, i.code as item_code, i.name_th as item_name,
          wom.planned_quantity, wom.actual_quantity, wom.unit, wom.status,
          wom.unit_cost, wom.total_cost
        FROM work_order_materials wom
        JOIN items i ON wom.item_id = i.id
        WHERE wom.work_order_id = ?
        ORDER BY wom.id
      `).all(woId) as Record<string, unknown>[];

      expect(woMaterials.length).toBeGreaterThanOrEqual(2);
      const turmericMat = woMaterials.find(m => m.item_code === 'RM-TURMERIC');
      expect(turmericMat).toBeDefined();
      expect(turmericMat!.actual_quantity).toBe(15);
      expect(turmericMat!.unit_cost).toBe(150);
      expect(turmericMat!.total_cost).toBe(2250); // 15 x 150
    });
  });

  // ── Integration Test: Error Scenarios ──────────────────────

  describe('Error Handling in BOM -> WO -> EBMR Flow', () => {
    it('should reject WO creation for non-existent BOM', async () => {
      seedHerbalProductionData();
      await expect(createWorkOrder(999, 100, getSqliteDateOffset(1), 1)).rejects.toThrow();
    });

    it('should reject material dispensing for unreleased WO', async () => {
      seedHerbalProductionData();
      const woId = await createWorkOrder(1, 100, getSqliteDateOffset(1), 1);
      // WO is still 'planned', not released
      await expect(dispenseMaterial(woId, 1, 5, 1)).rejects.toThrow(/Released or In Progress/);
    });

    it('should reject dispensing from quarantined lot', async () => {
      seedHerbalProductionData();
      // Change lot status to quarantine
      sqlite.prepare('UPDATE inventory_lots SET status = ? WHERE id = ?').run('quarantine', 1);

      const woId = await createWorkOrder(1, 100, getSqliteDateOffset(1), 1);
      await updateWorkOrderStatus(woId, 'released', 1);

      await expect(dispenseMaterial(woId, 1, 5, 1)).rejects.toThrow(/not released/);
    });

    it('should detect shortage when BOM explosion exceeds stock', async () => {
      seedHerbalProductionData();

      // Request very large batch
      const result = await explodeBOM(1, 50000);
      const turmeric = result.find(m => m.itemCode === 'RM-TURMERIC');

      // 30 * 50000 / 1000 / (1 - 0.015) = ~1522.8 kg, only 200 available
      expect(turmeric!.shortage).toBeGreaterThan(0);
      expect(turmeric!.requiredQuantity).toBeGreaterThan(turmeric!.availableStock);
    });
  });

  // ── Integration Test: Multiple Work Orders ────────────────

  describe('Multiple Work Orders from Same BOM', () => {
    it('should create independent batch records per work order', async () => {
      seedHerbalProductionData();

      const woId1 = await createWorkOrder(1, 200, getSqliteDateOffset(1), 1);
      const woId2 = await createWorkOrder(1, 300, getSqliteDateOffset(2), 1);

      // Create batch records for WO1
      const ops = sqlite.prepare('SELECT * FROM operations WHERE bom_id = 1 ORDER BY sequence').all() as Record<string, unknown>[];

      const brStmt = sqlite.prepare(`
        INSERT INTO batch_records (work_order_id, operation_id, sequence, step_name, instructions, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
      `);

      for (const op of ops) {
        brStmt.run(woId1, op.id, op.sequence, op.name, op.instructions, getSqliteDate(), getSqliteDate());
        brStmt.run(woId2, op.id, op.sequence, op.name, op.instructions, getSqliteDate(), getSqliteDate());
      }

      const wo1Records = sqlite.prepare('SELECT * FROM batch_records WHERE work_order_id = ?').all(woId1) as Record<string, unknown>[];
      const wo2Records = sqlite.prepare('SELECT * FROM batch_records WHERE work_order_id = ?').all(woId2) as Record<string, unknown>[];

      expect(wo1Records.length).toBe(5);
      expect(wo2Records.length).toBe(5);

      // Verify they're independent
      const wo1Ids = wo1Records.map(r => r.id);
      const wo2Ids = wo2Records.map(r => r.id);
      for (const id of wo1Ids) {
        expect(wo2Ids).not.toContain(id);
      }
    });
  });
});
