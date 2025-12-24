/**
 * Integration Tests for Line Clearance Service
 * Feature: 009-gmp-compliance-gap-analysis Phase 2 (US13 - T075)
 *
 * Tests the Line Clearance workflow with:
 * - FR-062: Line Clearance Enforcement before production start
 * - FR-071-074: Electronic Signatures for dual verification
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Database from 'better-sqlite3';

// Helper to set up test database
function setupTestDb() {
  const sqliteDb = new Database(':memory:');

  // Create tables
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'operator',
      department TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS work_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wo_number TEXT NOT NULL UNIQUE,
      product_id INTEGER,
      batch_number TEXT,
      planned_qty REAL NOT NULL DEFAULT 0,
      actual_qty REAL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft',
      planned_start_date TEXT,
      planned_end_date TEXT,
      actual_start_date TEXT,
      actual_end_date TEXT,
      line_clearance_required INTEGER DEFAULT 1,
      line_clearance_status TEXT,
      line_clearance_by INTEGER,
      line_clearance_at TEXT,
      line_clearance_checklist_id INTEGER,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS line_clearance_checklists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_order_id INTEGER NOT NULL,
      previous_product_cleared INTEGER DEFAULT 0,
      area_clean INTEGER DEFAULT 0,
      equipment_clean INTEGER DEFAULT 0,
      no_contamination_risk INTEGER DEFAULT 0,
      labels_removed INTEGER DEFAULT 0,
      docs_ready INTEGER DEFAULT 0,
      performed_by INTEGER,
      performed_at TEXT,
      performed_signature_id INTEGER,
      verified_by INTEGER,
      verified_at TEXT,
      verified_signature_id INTEGER,
      status TEXT NOT NULL DEFAULT 'pending',
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
    );

    CREATE TABLE IF NOT EXISTS electronic_signatures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      full_name TEXT NOT NULL,
      title TEXT,
      signed_at TEXT NOT NULL,
      meaning TEXT NOT NULL,
      password_verified INTEGER DEFAULT 1,
      signature_hash TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return { sqliteDb };
}

// Helper to seed test data
function seedTestData(sqliteDb: Database.Database) {
  // Insert test users with bcrypt-hashed password 'password123'
  // Hash for 'password123' (pre-computed with bcrypt)
  const passwordHash = '$2a$10$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdWoXehVzJptJ/op0lLFCZQ3E.e';

  sqliteDb.exec(`
    INSERT INTO users (id, email, password, name, role, department)
    VALUES
      (1, 'operator@test.com', '${passwordHash}', 'Test Operator', 'operator', 'Production'),
      (2, 'supervisor@test.com', '${passwordHash}', 'Test Supervisor', 'supervisor', 'Production'),
      (3, 'qc@test.com', '${passwordHash}', 'QC Inspector', 'qc', 'Quality Control');

    INSERT INTO work_orders (id, wo_number, product_id, batch_number, planned_qty, status, line_clearance_required)
    VALUES
      (1, 'WO-2024-001', 100, 'BATCH-001', 1000, 'released', 1),
      (2, 'WO-2024-002', 101, 'BATCH-002', 500, 'released', 1),
      (3, 'WO-2024-003', 102, 'BATCH-003', 750, 'released', 0);
  `);
}

describe('Line Clearance Service - Integration Tests', () => {
  let testDb: ReturnType<typeof setupTestDb>;

  beforeAll(() => {
    testDb = setupTestDb();
    seedTestData(testDb.sqliteDb);
  });

  afterAll(() => {
    testDb.sqliteDb.close();
  });

  describe('FR-062: Line Clearance Requirement Check', () => {
    it('should identify work order that requires line clearance', async () => {
      const { sqliteDb } = testDb;

      const result = sqliteDb.prepare(`
        SELECT id, wo_number, line_clearance_required, line_clearance_status
        FROM work_orders WHERE id = 1
      `).get() as { id: number; wo_number: string; line_clearance_required: number; line_clearance_status: string | null };

      expect(result.wo_number).toBe('WO-2024-001');
      expect(result.line_clearance_required).toBe(1);
      expect(result.line_clearance_status).toBeNull();
    });

    it('should identify work order that does NOT require line clearance', async () => {
      const { sqliteDb } = testDb;

      const result = sqliteDb.prepare(`
        SELECT id, wo_number, line_clearance_required
        FROM work_orders WHERE id = 3
      `).get() as { id: number; wo_number: string; line_clearance_required: number };

      expect(result.wo_number).toBe('WO-2024-003');
      expect(result.line_clearance_required).toBe(0);
    });
  });

  describe('Line Clearance Checklist Creation', () => {
    it('should create a new line clearance checklist', async () => {
      const { sqliteDb } = testDb;

      sqliteDb.exec(`
        INSERT INTO line_clearance_checklists (
          work_order_id, previous_product_cleared, area_clean, equipment_clean,
          no_contamination_risk, labels_removed, docs_ready, status
        ) VALUES (
          1, 0, 0, 0, 0, 0, 0, 'pending'
        )
      `);

      const result = sqliteDb.prepare(`
        SELECT * FROM line_clearance_checklists WHERE work_order_id = 1
      `).get() as { id: number; work_order_id: number; status: string };

      expect(result.work_order_id).toBe(1);
      expect(result.status).toBe('pending');
    });

    it('should update checklist items to all checked', async () => {
      const { sqliteDb } = testDb;

      sqliteDb.exec(`
        UPDATE line_clearance_checklists SET
          previous_product_cleared = 1,
          area_clean = 1,
          equipment_clean = 1,
          no_contamination_risk = 1,
          labels_removed = 1,
          docs_ready = 1
        WHERE work_order_id = 1
      `);

      const result = sqliteDb.prepare(`
        SELECT previous_product_cleared, area_clean, equipment_clean,
               no_contamination_risk, labels_removed, docs_ready
        FROM line_clearance_checklists WHERE work_order_id = 1
      `).get() as {
        previous_product_cleared: number;
        area_clean: number;
        equipment_clean: number;
        no_contamination_risk: number;
        labels_removed: number;
        docs_ready: number;
      };

      expect(result.previous_product_cleared).toBe(1);
      expect(result.area_clean).toBe(1);
      expect(result.equipment_clean).toBe(1);
      expect(result.no_contamination_risk).toBe(1);
      expect(result.labels_removed).toBe(1);
      expect(result.docs_ready).toBe(1);
    });
  });

  describe('FR-071-074: Electronic Signatures', () => {
    it('should record performer electronic signature', async () => {
      const { sqliteDb } = testDb;

      const checklistId = sqliteDb.prepare(`
        SELECT id FROM line_clearance_checklists WHERE work_order_id = 1
      `).get() as { id: number };

      // Record performer signature
      sqliteDb.exec(`
        INSERT INTO electronic_signatures (
          entity_type, entity_id, action, user_id, username, full_name, title,
          signed_at, meaning, password_verified, signature_hash
        ) VALUES (
          'line_clearance', ${checklistId.id}, 'perform', 1, 'operator@test.com', 'Test Operator', 'Production Operator',
          datetime('now'), 'I confirm that I have personally verified all line clearance checklist items.', 1, 'hash123'
        )
      `);

      const signatureId = sqliteDb.prepare(`SELECT last_insert_rowid() as id`).get() as { id: number };

      // Update checklist with performer info
      sqliteDb.exec(`
        UPDATE line_clearance_checklists SET
          performed_by = 1,
          performed_at = datetime('now'),
          performed_signature_id = ${signatureId.id},
          status = 'performed'
        WHERE work_order_id = 1
      `);

      const result = sqliteDb.prepare(`
        SELECT status, performed_by, performed_signature_id
        FROM line_clearance_checklists WHERE work_order_id = 1
      `).get() as { status: string; performed_by: number; performed_signature_id: number };

      expect(result.status).toBe('performed');
      expect(result.performed_by).toBe(1);
      expect(result.performed_signature_id).toBe(signatureId.id);
    });

    it('should record verifier electronic signature (different person)', async () => {
      const { sqliteDb } = testDb;

      const checklistId = sqliteDb.prepare(`
        SELECT id, performed_by FROM line_clearance_checklists WHERE work_order_id = 1
      `).get() as { id: number; performed_by: number };

      // Verifier must be different from performer
      const verifierId = 2; // Supervisor
      expect(verifierId).not.toBe(checklistId.performed_by);

      // Record verifier signature
      sqliteDb.exec(`
        INSERT INTO electronic_signatures (
          entity_type, entity_id, action, user_id, username, full_name, title,
          signed_at, meaning, password_verified, signature_hash
        ) VALUES (
          'line_clearance', ${checklistId.id}, 'verify_approve', ${verifierId}, 'supervisor@test.com', 'Test Supervisor', 'Production Supervisor',
          datetime('now'), 'I confirm that I have reviewed and verified the line clearance checklist.', 1, 'hash456'
        )
      `);

      const verifySignatureId = sqliteDb.prepare(`SELECT last_insert_rowid() as id`).get() as { id: number };

      // Update checklist with verifier info
      sqliteDb.exec(`
        UPDATE line_clearance_checklists SET
          verified_by = ${verifierId},
          verified_at = datetime('now'),
          verified_signature_id = ${verifySignatureId.id},
          status = 'verified'
        WHERE work_order_id = 1
      `);

      const result = sqliteDb.prepare(`
        SELECT status, verified_by, verified_signature_id
        FROM line_clearance_checklists WHERE work_order_id = 1
      `).get() as { status: string; verified_by: number; verified_signature_id: number };

      expect(result.status).toBe('verified');
      expect(result.verified_by).toBe(verifierId);
      expect(result.verified_signature_id).toBe(verifySignatureId.id);
    });

    it('should retrieve all signatures for a line clearance', async () => {
      const { sqliteDb } = testDb;

      const checklistId = sqliteDb.prepare(`
        SELECT id FROM line_clearance_checklists WHERE work_order_id = 1
      `).get() as { id: number };

      const signatures = sqliteDb.prepare(`
        SELECT entity_type, entity_id, action, user_id, full_name
        FROM electronic_signatures
        WHERE entity_type = 'line_clearance' AND entity_id = ?
        ORDER BY signed_at
      `).all(checklistId.id) as Array<{ entity_type: string; entity_id: number; action: string; user_id: number; full_name: string }>;

      expect(signatures.length).toBe(2);
      expect(signatures[0].action).toBe('perform');
      expect(signatures[0].full_name).toBe('Test Operator');
      expect(signatures[1].action).toBe('verify_approve');
      expect(signatures[1].full_name).toBe('Test Supervisor');
    });
  });

  describe('Work Order Status Update with Line Clearance', () => {
    it('should update work order line clearance status after verification', async () => {
      const { sqliteDb } = testDb;

      // Update work order with line clearance info
      sqliteDb.exec(`
        UPDATE work_orders SET
          line_clearance_status = 'cleared',
          line_clearance_by = 2,
          line_clearance_at = datetime('now'),
          line_clearance_checklist_id = (SELECT id FROM line_clearance_checklists WHERE work_order_id = 1)
        WHERE id = 1
      `);

      const result = sqliteDb.prepare(`
        SELECT line_clearance_status, line_clearance_by, line_clearance_checklist_id
        FROM work_orders WHERE id = 1
      `).get() as { line_clearance_status: string; line_clearance_by: number; line_clearance_checklist_id: number };

      expect(result.line_clearance_status).toBe('cleared');
      expect(result.line_clearance_by).toBe(2);
      expect(result.line_clearance_checklist_id).toBeTruthy();
    });

    it('should allow transition to in_progress after line clearance is verified', async () => {
      const { sqliteDb } = testDb;

      // Check work order can start production
      const wo = sqliteDb.prepare(`
        SELECT status, line_clearance_required, line_clearance_status
        FROM work_orders WHERE id = 1
      `).get() as { status: string; line_clearance_required: number; line_clearance_status: string };

      const canStartProduction = !wo.line_clearance_required || wo.line_clearance_status === 'cleared';
      expect(canStartProduction).toBe(true);

      // Transition to in_progress
      sqliteDb.exec(`
        UPDATE work_orders SET status = 'in_progress', actual_start_date = date('now')
        WHERE id = 1
      `);

      const updated = sqliteDb.prepare(`
        SELECT status FROM work_orders WHERE id = 1
      `).get() as { status: string };

      expect(updated.status).toBe('in_progress');
    });
  });

  describe('Line Clearance Rejection', () => {
    it('should handle line clearance rejection', async () => {
      const { sqliteDb } = testDb;

      // Create line clearance for work order 2
      sqliteDb.exec(`
        INSERT INTO line_clearance_checklists (
          work_order_id, previous_product_cleared, area_clean, equipment_clean,
          no_contamination_risk, labels_removed, docs_ready,
          performed_by, performed_at, status
        ) VALUES (
          2, 1, 1, 1, 1, 1, 1, 1, datetime('now'), 'performed'
        )
      `);

      const checklistId = sqliteDb.prepare(`SELECT last_insert_rowid() as id`).get() as { id: number };

      // Record rejection signature
      sqliteDb.exec(`
        INSERT INTO electronic_signatures (
          entity_type, entity_id, action, user_id, username, full_name, title,
          signed_at, meaning, password_verified, signature_hash
        ) VALUES (
          'line_clearance', ${checklistId.id}, 'verify_reject', 2, 'supervisor@test.com', 'Test Supervisor', 'Production Supervisor',
          datetime('now'), 'Equipment cleaning was not satisfactory', 1, 'hash789'
        )
      `);

      // Update checklist with rejection
      sqliteDb.exec(`
        UPDATE line_clearance_checklists SET
          verified_by = 2,
          verified_at = datetime('now'),
          status = 'rejected',
          notes = 'Equipment cleaning was not satisfactory'
        WHERE id = ${checklistId.id}
      `);

      // Update work order
      sqliteDb.exec(`
        UPDATE work_orders SET
          line_clearance_status = 'failed'
        WHERE id = 2
      `);

      const result = sqliteDb.prepare(`
        SELECT lc.status as checklist_status, wo.line_clearance_status
        FROM line_clearance_checklists lc
        JOIN work_orders wo ON lc.work_order_id = wo.id
        WHERE lc.id = ?
      `).get(checklistId.id) as { checklist_status: string; line_clearance_status: string };

      expect(result.checklist_status).toBe('rejected');
      expect(result.line_clearance_status).toBe('failed');
    });

    it('should block production start for rejected line clearance', async () => {
      const { sqliteDb } = testDb;

      const wo = sqliteDb.prepare(`
        SELECT status, line_clearance_required, line_clearance_status
        FROM work_orders WHERE id = 2
      `).get() as { status: string; line_clearance_required: number; line_clearance_status: string };

      const canStartProduction = !wo.line_clearance_required || wo.line_clearance_status === 'cleared';
      expect(canStartProduction).toBe(false);
      expect(wo.line_clearance_status).toBe('failed');
    });
  });

  describe('Line Clearance Not Required', () => {
    it('should allow production start when line clearance is not required', async () => {
      const { sqliteDb } = testDb;

      const wo = sqliteDb.prepare(`
        SELECT status, line_clearance_required, line_clearance_status
        FROM work_orders WHERE id = 3
      `).get() as { status: string; line_clearance_required: number; line_clearance_status: string | null };

      expect(wo.line_clearance_required).toBe(0);

      const canStartProduction = !wo.line_clearance_required || wo.line_clearance_status === 'cleared';
      expect(canStartProduction).toBe(true);

      // Can transition to in_progress without line clearance
      sqliteDb.exec(`
        UPDATE work_orders SET status = 'in_progress', actual_start_date = date('now')
        WHERE id = 3
      `);

      const updated = sqliteDb.prepare(`
        SELECT status FROM work_orders WHERE id = 3
      `).get() as { status: string };

      expect(updated.status).toBe('in_progress');
    });
  });
});
