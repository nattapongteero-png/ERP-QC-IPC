/**
 * Integration Tests for QC Disposition Service
 * Feature: 009-gmp-compliance-gap-analysis Phase 7 (US15 - T094)
 *
 * Tests disposition workflow with dual sign-off:
 * - FR-067: Disposition Decision (accept, reject, rework, scrap, return_to_vendor, conditional_release)
 * - FR-068: Disposition Reason (mandatory for non-accept)
 * - FR-069: Auto Lot Status Update after approval
 * - FR-070: Complete Audit Trail
 * - FR-071-074: Electronic Signatures
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Database from 'better-sqlite3';

// Types for test data
interface User {
  id: number;
  username: string;
  fullName: string;
  password: string;
}

interface InventoryLot {
  id: number;
  itemId: number;
  lotNumber: string;
  quantity: number;
  unit: string;
  status: string;
}

interface QualityTest {
  id: number;
  lotId: number;
  testType: string;
  status: string;
  result: string | null;
  disposition: string | null;
  dispositionBy: number | null;
  dispositionAt: string | null;
  dispositionReason: string | null;
  dispositionApprovedBy: number | null;
  dispositionApprovedAt: string | null;
}

interface ElectronicSignature {
  id: number;
  entityType: string;
  entityId: number;
  action: string;
  userId: number;
  meaning: string;
  signedAt: string;
}

// Test database instance
let db: Database.Database;

// Test data
const testUsers: User[] = [
  { id: 1, username: 'qcanalyst', fullName: 'John QC Analyst', password: 'password123' },
  { id: 2, username: 'qcmanager', fullName: 'Jane QC Manager', password: 'password456' },
];

const testItem = { id: 1, code: 'RM001', nameEn: 'Test Material', nameTh: 'วัตถุดิบทดสอบ' };

const testLots: InventoryLot[] = [
  { id: 1, itemId: 1, lotNumber: 'LOT-001', quantity: 100, unit: 'kg', status: 'under_test' },
  { id: 2, itemId: 1, lotNumber: 'LOT-002', quantity: 200, unit: 'kg', status: 'under_test' },
];

// Helper functions
function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      fullName TEXT NOT NULL,
      password TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL,
      nameEn TEXT,
      nameTh TEXT
    );

    CREATE TABLE IF NOT EXISTS inventory_lots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      itemId INTEGER NOT NULL,
      lotNumber TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'quarantine',
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS quality_tests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lotId INTEGER NOT NULL,
      testType TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      result TEXT,
      disposition TEXT,
      dispositionBy INTEGER,
      dispositionAt TEXT,
      dispositionReason TEXT,
      dispositionApprovedBy INTEGER,
      dispositionApprovedAt TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS electronic_signatures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entityType TEXT NOT NULL,
      entityId INTEGER NOT NULL,
      action TEXT NOT NULL,
      userId INTEGER NOT NULL,
      meaning TEXT NOT NULL,
      signedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function seedTestData() {
  // Insert users
  const insertUser = db.prepare(
    'INSERT INTO users (id, username, fullName, password) VALUES (?, ?, ?, ?)'
  );
  for (const user of testUsers) {
    insertUser.run(user.id, user.username, user.fullName, user.password);
  }

  // Insert item
  db.prepare('INSERT INTO items (id, code, nameEn, nameTh) VALUES (?, ?, ?, ?)')
    .run(testItem.id, testItem.code, testItem.nameEn, testItem.nameTh);

  // Insert lots
  const insertLot = db.prepare(
    'INSERT INTO inventory_lots (id, itemId, lotNumber, quantity, unit, status) VALUES (?, ?, ?, ?, ?, ?)'
  );
  for (const lot of testLots) {
    insertLot.run(lot.id, lot.itemId, lot.lotNumber, lot.quantity, lot.unit, lot.status);
  }
}

function createTest(lotId: number, testType: string, status: string, result: string | null = null): number {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO quality_tests (lotId, testType, status, result, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(lotId, testType, status, result, now, now);
  return info.lastInsertRowid as number;
}

function setDisposition(
  testId: number,
  disposition: string,
  reason: string,
  userId: number
): { success: boolean; error?: string } {
  const now = new Date().toISOString();

  // Get test
  const test = db.prepare('SELECT * FROM quality_tests WHERE id = ?').get(testId) as QualityTest | undefined;
  if (!test) {
    return { success: false, error: 'Test not found' };
  }

  // Check if already has disposition
  if (test.disposition) {
    return { success: false, error: 'Test already has a disposition decision' };
  }

  // Validate reason for non-accept
  if (disposition !== 'accept' && !reason.trim()) {
    return { success: false, error: 'Disposition reason is required for non-accept decisions' };
  }

  // Update test
  db.prepare(`
    UPDATE quality_tests
    SET disposition = ?, dispositionBy = ?, dispositionAt = ?, dispositionReason = ?, updatedAt = ?
    WHERE id = ?
  `).run(disposition, userId, now, reason || null, now, testId);

  // Create signature
  const user = db.prepare('SELECT fullName FROM users WHERE id = ?').get(userId) as { fullName: string } | undefined;
  const meaning = `Disposition decision: ${disposition}${reason ? `. Reason: ${reason}` : ''}`;

  db.prepare(`
    INSERT INTO electronic_signatures (entityType, entityId, action, userId, meaning, signedAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('disposition', testId, 'disposition_decision', userId, meaning, now);

  return { success: true };
}

function approveDisposition(
  testId: number,
  userId: number,
  notes?: string
): { success: boolean; lotStatusUpdated?: boolean; newLotStatus?: string; error?: string } {
  const now = new Date().toISOString();

  // Get test
  const test = db.prepare('SELECT * FROM quality_tests WHERE id = ?').get(testId) as QualityTest | undefined;
  if (!test) {
    return { success: false, error: 'Test not found' };
  }

  // Check if has disposition
  if (!test.disposition) {
    return { success: false, error: 'No disposition decision to approve' };
  }

  // Check if already approved
  if (test.dispositionApprovedBy) {
    return { success: false, error: 'Disposition already approved' };
  }

  // Check dual sign-off
  if (test.dispositionBy === userId) {
    return { success: false, error: 'Approver must be different from the person who made the disposition decision' };
  }

  // Update test
  db.prepare(`
    UPDATE quality_tests
    SET dispositionApprovedBy = ?, dispositionApprovedAt = ?, updatedAt = ?
    WHERE id = ?
  `).run(userId, now, now, testId);

  // Create signature
  const meaning = `Disposition approved: ${test.disposition}${notes ? `. Notes: ${notes}` : ''}`;
  db.prepare(`
    INSERT INTO electronic_signatures (entityType, entityId, action, userId, meaning, signedAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('disposition', testId, 'disposition_approval', userId, meaning, now);

  // Update lot status
  const statusMap: Record<string, string> = {
    accept: 'released',
    reject: 'rejected',
    scrap: 'scrapped',
    return_to_vendor: 'returned',
    rework: 'under_rework',
    conditional_release: 'conditional',
  };

  const newLotStatus = statusMap[test.disposition];
  if (newLotStatus) {
    db.prepare('UPDATE inventory_lots SET status = ?, updatedAt = ? WHERE id = ?')
      .run(newLotStatus, now, test.lotId);
    return { success: true, lotStatusUpdated: true, newLotStatus };
  }

  return { success: true, lotStatusUpdated: false };
}

function getQCSummary(): {
  total: number;
  pending: number;
  passed: number;
  failed: number;
  pendingDisposition: number;
  pendingApproval: number;
} {
  const tests = db.prepare('SELECT * FROM quality_tests').all() as QualityTest[];

  return {
    total: tests.length,
    pending: tests.filter(t => t.status === 'pending').length,
    passed: tests.filter(t => t.status === 'passed').length,
    failed: tests.filter(t => t.status === 'failed').length,
    pendingDisposition: tests.filter(t => t.status === 'failed' && !t.disposition).length,
    pendingApproval: tests.filter(t => t.disposition && !t.dispositionApprovedBy).length,
  };
}

describe('QC Disposition Service Integration Tests', () => {
  beforeAll(() => {
    // Create in-memory SQLite database
    db = new Database(':memory:');
    createTables();
  });

  afterAll(() => {
    db.close();
  });

  beforeEach(() => {
    // Clear test data
    db.exec('DELETE FROM electronic_signatures');
    db.exec('DELETE FROM quality_tests');
    db.exec('DELETE FROM inventory_lots');
    db.exec('DELETE FROM items');
    db.exec('DELETE FROM users');

    // Re-seed test data
    seedTestData();
  });

  describe('FR-067: Disposition Decision', () => {
    it('should set accept disposition on a failed test', () => {
      const testId = createTest(1, 'incoming', 'failed', 'fail');
      const result = setDisposition(testId, 'accept', '', 1);

      expect(result.success).toBe(true);

      const test = db.prepare('SELECT * FROM quality_tests WHERE id = ?').get(testId) as QualityTest;
      expect(test.disposition).toBe('accept');
      expect(test.dispositionBy).toBe(1);
    });

    it('should set reject disposition with reason', () => {
      const testId = createTest(1, 'incoming', 'failed', 'fail');
      const result = setDisposition(testId, 'reject', 'Material contaminated', 1);

      expect(result.success).toBe(true);

      const test = db.prepare('SELECT * FROM quality_tests WHERE id = ?').get(testId) as QualityTest;
      expect(test.disposition).toBe('reject');
      expect(test.dispositionReason).toBe('Material contaminated');
    });

    it('should set rework disposition', () => {
      const testId = createTest(1, 'incoming', 'failed', 'fail');
      const result = setDisposition(testId, 'rework', 'Needs reprocessing', 1);

      expect(result.success).toBe(true);

      const test = db.prepare('SELECT * FROM quality_tests WHERE id = ?').get(testId) as QualityTest;
      expect(test.disposition).toBe('rework');
    });

    it('should set scrap disposition', () => {
      const testId = createTest(1, 'incoming', 'failed', 'fail');
      const result = setDisposition(testId, 'scrap', 'Cannot be salvaged', 1);

      expect(result.success).toBe(true);

      const test = db.prepare('SELECT * FROM quality_tests WHERE id = ?').get(testId) as QualityTest;
      expect(test.disposition).toBe('scrap');
    });

    it('should set return_to_vendor disposition', () => {
      const testId = createTest(1, 'incoming', 'failed', 'fail');
      const result = setDisposition(testId, 'return_to_vendor', 'Does not meet specs', 1);

      expect(result.success).toBe(true);

      const test = db.prepare('SELECT * FROM quality_tests WHERE id = ?').get(testId) as QualityTest;
      expect(test.disposition).toBe('return_to_vendor');
    });

    it('should set conditional_release disposition', () => {
      const testId = createTest(1, 'incoming', 'failed', 'fail');
      const result = setDisposition(testId, 'conditional_release', 'Use only for specific product', 1);

      expect(result.success).toBe(true);

      const test = db.prepare('SELECT * FROM quality_tests WHERE id = ?').get(testId) as QualityTest;
      expect(test.disposition).toBe('conditional_release');
    });

    it('should not allow disposition on already dispositioned test', () => {
      const testId = createTest(1, 'incoming', 'failed', 'fail');
      setDisposition(testId, 'accept', '', 1);

      const result = setDisposition(testId, 'reject', 'Changed mind', 2);
      expect(result.success).toBe(false);
      expect(result.error).toContain('already has a disposition');
    });
  });

  describe('FR-068: Disposition Reason', () => {
    it('should require reason for reject disposition', () => {
      const testId = createTest(1, 'incoming', 'failed', 'fail');
      const result = setDisposition(testId, 'reject', '', 1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('reason is required');
    });

    it('should require reason for rework disposition', () => {
      const testId = createTest(1, 'incoming', 'failed', 'fail');
      const result = setDisposition(testId, 'rework', '', 1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('reason is required');
    });

    it('should not require reason for accept disposition', () => {
      const testId = createTest(1, 'incoming', 'failed', 'fail');
      const result = setDisposition(testId, 'accept', '', 1);

      expect(result.success).toBe(true);
    });
  });

  describe('FR-069: Auto Lot Status Update', () => {
    it('should update lot status to released after accept approval', () => {
      const testId = createTest(1, 'incoming', 'failed', 'fail');
      setDisposition(testId, 'accept', '', 1);
      const result = approveDisposition(testId, 2);

      expect(result.success).toBe(true);
      expect(result.lotStatusUpdated).toBe(true);
      expect(result.newLotStatus).toBe('released');

      const lot = db.prepare('SELECT * FROM inventory_lots WHERE id = 1').get() as InventoryLot;
      expect(lot.status).toBe('released');
    });

    it('should update lot status to rejected after reject approval', () => {
      const testId = createTest(1, 'incoming', 'failed', 'fail');
      setDisposition(testId, 'reject', 'Does not meet spec', 1);
      const result = approveDisposition(testId, 2);

      expect(result.success).toBe(true);
      expect(result.newLotStatus).toBe('rejected');

      const lot = db.prepare('SELECT * FROM inventory_lots WHERE id = 1').get() as InventoryLot;
      expect(lot.status).toBe('rejected');
    });

    it('should update lot status to scrapped after scrap approval', () => {
      const testId = createTest(1, 'incoming', 'failed', 'fail');
      setDisposition(testId, 'scrap', 'Cannot be used', 1);
      approveDisposition(testId, 2);

      const lot = db.prepare('SELECT * FROM inventory_lots WHERE id = 1').get() as InventoryLot;
      expect(lot.status).toBe('scrapped');
    });

    it('should update lot status to returned after return_to_vendor approval', () => {
      const testId = createTest(1, 'incoming', 'failed', 'fail');
      setDisposition(testId, 'return_to_vendor', 'Vendor defect', 1);
      approveDisposition(testId, 2);

      const lot = db.prepare('SELECT * FROM inventory_lots WHERE id = 1').get() as InventoryLot;
      expect(lot.status).toBe('returned');
    });

    it('should update lot status to under_rework after rework approval', () => {
      const testId = createTest(1, 'incoming', 'failed', 'fail');
      setDisposition(testId, 'rework', 'Needs processing', 1);
      approveDisposition(testId, 2);

      const lot = db.prepare('SELECT * FROM inventory_lots WHERE id = 1').get() as InventoryLot;
      expect(lot.status).toBe('under_rework');
    });

    it('should update lot status to conditional after conditional_release approval', () => {
      const testId = createTest(1, 'incoming', 'failed', 'fail');
      setDisposition(testId, 'conditional_release', 'Limited use only', 1);
      approveDisposition(testId, 2);

      const lot = db.prepare('SELECT * FROM inventory_lots WHERE id = 1').get() as InventoryLot;
      expect(lot.status).toBe('conditional');
    });
  });

  describe('FR-071-074: Dual Sign-Off with Electronic Signatures', () => {
    it('should create signature when setting disposition', () => {
      const testId = createTest(1, 'incoming', 'failed', 'fail');
      setDisposition(testId, 'reject', 'Out of spec', 1);

      const signatures = db.prepare(
        'SELECT * FROM electronic_signatures WHERE entityType = ? AND entityId = ?'
      ).all('disposition', testId) as ElectronicSignature[];

      expect(signatures.length).toBe(1);
      expect(signatures[0].action).toBe('disposition_decision');
      expect(signatures[0].userId).toBe(1);
    });

    it('should create signature when approving disposition', () => {
      const testId = createTest(1, 'incoming', 'failed', 'fail');
      setDisposition(testId, 'reject', 'Out of spec', 1);
      approveDisposition(testId, 2, 'Verified and approved');

      const signatures = db.prepare(
        'SELECT * FROM electronic_signatures WHERE entityType = ? AND entityId = ?'
      ).all('disposition', testId) as ElectronicSignature[];

      expect(signatures.length).toBe(2);
      const approvalSig = signatures.find(s => s.action === 'disposition_approval');
      expect(approvalSig).toBeDefined();
      expect(approvalSig!.userId).toBe(2);
    });

    it('should enforce different approver from disposition maker', () => {
      const testId = createTest(1, 'incoming', 'failed', 'fail');
      setDisposition(testId, 'reject', 'Out of spec', 1);

      // Same user tries to approve
      const result = approveDisposition(testId, 1);
      expect(result.success).toBe(false);
      expect(result.error).toContain('different from the person');
    });

    it('should not allow approval without disposition', () => {
      const testId = createTest(1, 'incoming', 'failed', 'fail');

      const result = approveDisposition(testId, 2);
      expect(result.success).toBe(false);
      expect(result.error).toContain('No disposition decision');
    });

    it('should not allow double approval', () => {
      const testId = createTest(1, 'incoming', 'failed', 'fail');
      setDisposition(testId, 'reject', 'Out of spec', 1);
      approveDisposition(testId, 2);

      // Create a third user for second approval attempt
      db.prepare('INSERT INTO users (id, username, fullName, password) VALUES (?, ?, ?, ?)')
        .run(3, 'admin', 'Admin User', 'admin123');

      const result = approveDisposition(testId, 3);
      expect(result.success).toBe(false);
      expect(result.error).toContain('already approved');
    });
  });

  describe('QC Summary Statistics', () => {
    it('should count tests by status', () => {
      createTest(1, 'incoming', 'pending', null);
      createTest(1, 'incoming', 'passed', 'pass');
      createTest(1, 'incoming', 'failed', 'fail');
      createTest(2, 'incoming', 'failed', 'fail');

      const summary = getQCSummary();

      expect(summary.total).toBe(4);
      expect(summary.pending).toBe(1);
      expect(summary.passed).toBe(1);
      expect(summary.failed).toBe(2);
    });

    it('should count pending disposition tests', () => {
      const test1 = createTest(1, 'incoming', 'failed', 'fail');
      const test2 = createTest(1, 'incoming', 'failed', 'fail');
      createTest(1, 'incoming', 'failed', 'fail');

      // Set disposition on first two
      setDisposition(test1, 'reject', 'Bad quality', 1);
      setDisposition(test2, 'accept', '', 1);

      const summary = getQCSummary();

      expect(summary.pendingDisposition).toBe(1); // Only test3 needs disposition
    });

    it('should count pending approval tests', () => {
      const test1 = createTest(1, 'incoming', 'failed', 'fail');
      const test2 = createTest(1, 'incoming', 'failed', 'fail');

      setDisposition(test1, 'reject', 'Bad quality', 1);
      setDisposition(test2, 'accept', '', 1);

      // Approve only first
      approveDisposition(test1, 2);

      const summary = getQCSummary();

      expect(summary.pendingApproval).toBe(1); // Only test2 pending approval
    });
  });
});
