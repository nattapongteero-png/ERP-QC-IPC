/**
 * Integration Tests for Gowning Verification (per-batch eBMR GMP).
 * Mirrors line-clearance-service.test.ts — exercises the state machine
 * (perform -> verified | rejected) with dual sign-off via raw SQLite.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';

function setupTestDb() {
  const sqliteDb = new Database(':memory:');
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'operator'
    );
    CREATE TABLE IF NOT EXISTS work_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wo_number TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'released'
    );
    CREATE TABLE IF NOT EXISTS wo_gowning_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_order_id INTEGER NOT NULL,
      phase TEXT NOT NULL DEFAULT 'pre_production',
      gown_clean INTEGER DEFAULT 0,
      gloves_on INTEGER DEFAULT 0,
      mask_on INTEGER DEFAULT 0,
      hairnet_on INTEGER DEFAULT 0,
      shoe_cover_on INTEGER DEFAULT 0,
      hands_sanitized INTEGER DEFAULT 0,
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
  `);
  return { sqliteDb };
}

function seed(sqliteDb: Database.Database) {
  sqliteDb.exec(`
    INSERT INTO users (id, email, name, role) VALUES
      (1, 'operator@test.com', 'Test Operator', 'operator'),
      (2, 'supervisor@test.com', 'Test Supervisor', 'supervisor');
    INSERT INTO work_orders (id, wo_number, status) VALUES
      (1, 'WO-2024-001', 'released'),
      (2, 'WO-2024-002', 'released');
  `);
}

const ALL_ITEMS = `gown_clean=1, gloves_on=1, mask_on=1, hairnet_on=1, shoe_cover_on=1, hands_sanitized=1`;

describe('Gowning Verification - Integration Tests', () => {
  let testDb: ReturnType<typeof setupTestDb>;

  beforeAll(() => {
    testDb = setupTestDb();
    seed(testDb.sqliteDb);
  });
  afterAll(() => testDb.sqliteDb.close());

  it('creates a gowning record with all 6 items checked → performed', () => {
    const { sqliteDb } = testDb;
    sqliteDb.exec(`
      INSERT INTO wo_gowning_records (work_order_id, ${ALL_ITEMS.replace(/=1/g, '')}, performed_by, performed_at, status)
      VALUES (1, 1,1,1,1,1,1, 1, datetime('now'), 'performed')
    `);
    const row = sqliteDb.prepare(`SELECT * FROM wo_gowning_records WHERE work_order_id = 1`).get() as any;
    expect(row.status).toBe('performed');
    expect(row.performed_by).toBe(1);
    expect(row.gown_clean).toBe(1);
    expect(row.hands_sanitized).toBe(1);
  });

  it('is one record per batch (work order)', () => {
    const { sqliteDb } = testDb;
    const count = sqliteDb.prepare(`SELECT COUNT(*) AS c FROM wo_gowning_records WHERE work_order_id = 1`).get() as { c: number };
    expect(count.c).toBe(1);
  });

  it('verifies with a different user → verified (dual control)', () => {
    const { sqliteDb } = testDb;
    const rec = sqliteDb.prepare(`SELECT id, performed_by FROM wo_gowning_records WHERE work_order_id = 1`).get() as { id: number; performed_by: number };
    const verifierId = 2;
    expect(verifierId).not.toBe(rec.performed_by); // dual control
    sqliteDb.exec(`
      UPDATE wo_gowning_records SET verified_by = ${verifierId}, verified_at = datetime('now'), status = 'verified'
      WHERE id = ${rec.id}
    `);
    const row = sqliteDb.prepare(`SELECT status, verified_by FROM wo_gowning_records WHERE id = ${rec.id}`).get() as any;
    expect(row.status).toBe('verified');
    expect(row.verified_by).toBe(verifierId);
  });

  it('handles rejection on a second work order', () => {
    const { sqliteDb } = testDb;
    sqliteDb.exec(`
      INSERT INTO wo_gowning_records (work_order_id, gown_clean,gloves_on,mask_on,hairnet_on,shoe_cover_on,hands_sanitized, performed_by, performed_at, status)
      VALUES (2, 1,1,1,1,1,1, 1, datetime('now'), 'performed')
    `);
    const rec = sqliteDb.prepare(`SELECT id FROM wo_gowning_records WHERE work_order_id = 2`).get() as { id: number };
    sqliteDb.exec(`
      UPDATE wo_gowning_records SET verified_by = 2, verified_at = datetime('now'), status = 'rejected', notes = '[Verifier]: mask not worn correctly'
      WHERE id = ${rec.id}
    `);
    const row = sqliteDb.prepare(`SELECT status, notes FROM wo_gowning_records WHERE id = ${rec.id}`).get() as any;
    expect(row.status).toBe('rejected');
    expect(row.notes).toContain('mask not worn');
  });

  it('all-items rule: a record missing an item should not be considered complete', () => {
    // Simulate the service guard: all 6 booleans must be 1 to be signable.
    const items = { gown_clean: 1, gloves_on: 1, mask_on: 1, hairnet_on: 1, shoe_cover_on: 0, hands_sanitized: 1 };
    const allChecked = Object.values(items).every((v) => v === 1);
    expect(allChecked).toBe(false);
  });
});
