/**
 * Integration Tests: Two-step lot release (QC Flow item 6)
 *
 * Covers:
 *  - setLotQcDisposition: approved keeps status, rejected → rejected
 *  - releaseLotWithCount: blocked until QC approved
 *  - releaseLotWithCount: count required, matching count → released
 *  - releaseLotWithCount: variance requires a reason, then corrects the qty
 *    and logs an 'adjust' inventory transaction
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import * as schema from '@/lib/db/schema';
import Database from 'better-sqlite3';

const { getTestDb, setTestDb } = vi.hoisted(() => {
  let _testDb: unknown = null;
  return {
    getTestDb: () => _testDb,
    setTestDb: (db: unknown) => {
      _testDb = db;
    },
  };
});

vi.mock('@/lib/db', () => ({
  isSqlite: () => true,
  getDb: async () => getTestDb(),
  getSqliteDb: () => getTestDb(),
  markSchemaSynced: () => {},
  schema,
}));

import {
  setupTestDatabase,
  closeTestDatabase,
  cleanTables,
  TestDatabase,
} from '../../helpers/test-db';
import { seedTestUser } from '../../helpers/service-test-seeds';
import { getSqliteDate } from '../../helpers/service-test-utils';
import {
  setLotQcDisposition,
  releaseLotWithCount,
} from '@/lib/services/inventory.service';

describe('Two-step lot release (item 6)', () => {
  let sqlite: Database.Database;
  let db: TestDatabase;

  beforeAll(() => {
    const setup = setupTestDatabase([
      schema.sqliteUsers,
      schema.sqliteItems,
      schema.sqliteWarehouses,
      schema.sqliteInventoryLots,
      schema.sqliteInventoryTransactions,
      schema.sqliteAuditTrail,
    ]);
    sqlite = setup.sqlite;
    db = setup.db;
    setTestDb(db);
  });

  afterAll(() => {
    closeTestDatabase(sqlite);
  });

  function seedItemAndLot(qty = 100): number {
    sqlite.exec(`
      INSERT INTO items (code, name_th, type, primary_unit, is_active, on_hand, created_at, updated_at)
      VALUES ('RM-1', 'วัตถุดิบทดสอบ', 'raw_material', 'kg', 1, 0, '${getSqliteDate()}', '${getSqliteDate()}')
    `);
    sqlite.exec(`
      INSERT INTO warehouses (code, name, type, is_active, created_at, updated_at)
      VALUES ('WH-RM', 'คลังวัตถุดิบ', 'raw_material', 1, '${getSqliteDate()}', '${getSqliteDate()}')
    `);
    sqlite.exec(`
      INSERT INTO inventory_lots (item_id, lot_number, quantity, status, warehouse_id, unit, received_date, created_at, updated_at)
      VALUES (1, 'LOT-A', ${qty}, 'quarantine', 1, 'kg', '${getSqliteDate()}', '${getSqliteDate()}', '${getSqliteDate()}')
    `);
    const row = sqlite.prepare(`SELECT id FROM inventory_lots WHERE lot_number='LOT-A'`).get() as { id: number };
    return row.id;
  }

  beforeEach(() => {
    cleanTables(sqlite, [
      'audit_trail',
      'inventory_transactions',
      'inventory_lots',
      'warehouses',
      'items',
      'users',
    ]);
    seedTestUser(sqlite, 1);
  });

  it('QC approve keeps status quarantine but records disposition', async () => {
    const lotId = seedItemAndLot();
    const res = await setLotQcDisposition(lotId, 'approved', 1);
    expect(res.qcDisposition).toBe('approved');
    expect(res.status).toBe('quarantine');

    const lot = sqlite.prepare(`SELECT status, qc_disposition FROM inventory_lots WHERE id=?`).get(lotId) as {
      status: string;
      qc_disposition: string;
    };
    expect(lot.status).toBe('quarantine');
    expect(lot.qc_disposition).toBe('approved');
  });

  it('QC reject sets the lot status to rejected', async () => {
    const lotId = seedItemAndLot();
    const res = await setLotQcDisposition(lotId, 'rejected', 1, 'ปนเปื้อน');
    expect(res.status).toBe('rejected');
  });

  it('release is blocked until QC has approved', async () => {
    const lotId = seedItemAndLot();
    await expect(releaseLotWithCount(lotId, 100, 1)).rejects.toThrow(/QC/);
  });

  it('release with a matching count moves the lot to released', async () => {
    const lotId = seedItemAndLot(100);
    await setLotQcDisposition(lotId, 'approved', 1);
    const res = await releaseLotWithCount(lotId, 100, 1);
    expect(res.status).toBe('released');
    expect(res.variance).toBe(0);

    const lot = sqlite.prepare(`SELECT status, quantity, counted_quantity FROM inventory_lots WHERE id=?`).get(lotId) as {
      status: string;
      quantity: number;
      counted_quantity: number;
    };
    expect(lot.status).toBe('released');
    expect(Number(lot.quantity)).toBe(100);
    expect(Number(lot.counted_quantity)).toBe(100);

    // No adjust transaction when count matches.
    const adj = sqlite.prepare(`SELECT COUNT(*) c FROM inventory_transactions WHERE transaction_type='adjust'`).get() as { c: number };
    expect(adj.c).toBe(0);
  });

  it('release with a variance requires a reason', async () => {
    const lotId = seedItemAndLot(100);
    await setLotQcDisposition(lotId, 'approved', 1);
    await expect(releaseLotWithCount(lotId, 95, 1)).rejects.toThrow(/ส่วนต่าง/);
  });

  it('release with a variance + reason corrects qty and logs an adjust txn', async () => {
    const lotId = seedItemAndLot(100);
    await setLotQcDisposition(lotId, 'approved', 1);
    const res = await releaseLotWithCount(lotId, 95, 1, 'นับจริงขาด 5 kg');
    expect(res.status).toBe('released');
    expect(res.variance).toBe(-5);

    const lot = sqlite.prepare(`SELECT quantity, count_variance_reason FROM inventory_lots WHERE id=?`).get(lotId) as {
      quantity: number;
      count_variance_reason: string;
    };
    expect(Number(lot.quantity)).toBe(95);
    expect(lot.count_variance_reason).toContain('ขาด');

    const adj = sqlite.prepare(`SELECT quantity FROM inventory_transactions WHERE transaction_type='adjust'`).get() as {
      quantity: number;
    };
    expect(Number(adj.quantity)).toBe(-5);
  });

  it('cannot release the same lot twice', async () => {
    const lotId = seedItemAndLot(100);
    await setLotQcDisposition(lotId, 'approved', 1);
    await releaseLotWithCount(lotId, 100, 1);
    await expect(releaseLotWithCount(lotId, 100, 1)).rejects.toThrow();
  });
});
