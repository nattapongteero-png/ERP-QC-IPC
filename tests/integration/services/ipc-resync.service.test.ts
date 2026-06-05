/**
 * Integration Tests: IPC phase re-sync on WO sync
 *
 * Regression for the user-reported bug: editing an IPC criteria's phase in a
 * BOM did not propagate to a Work Order that already initialized that criteria.
 *
 * New behavior (initializeWOIPCTests):
 *  - a PENDING test (not yet recorded) re-syncs its ipc_phase to the current
 *    BOM config phase;
 *  - a test WITH a result stays frozen (GMP integrity);
 *  - a brand-new BOM criteria still seeds a new test.
 * Returns { created, rephased }.
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
import { getSqliteDate } from '../../helpers/service-test-utils';
import { initializeWOIPCTests } from '@/lib/services/wo-execution.service';

describe('IPC re-sync — initializeWOIPCTests', () => {
  let sqlite: Database.Database;
  let db: TestDatabase;
  const now = getSqliteDate();
  const WO_ID = 1;
  const BOM_ID = 1;
  const LOT_ID = 1;
  const OPERATOR_ID = 1;

  beforeAll(() => {
    const setup = setupTestDatabase([
      schema.sqliteWorkOrders,
      schema.sqliteInventoryLots,
      schema.sqliteQualityTests,
      schema.sqliteBOMInProcessQC,
      schema.sqliteIPCCriteria,
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
      'quality_tests',
      'bom_in_process_qc',
      'ipc_criteria',
      'inventory_lots',
      'work_orders',
    ]);

    // WO linked to BOM, with a batch lot the IPC tests attach to.
    sqlite
      .prepare(
        `INSERT INTO work_orders
          (id, wo_number, bom_id, product_id, batch_number, planned_quantity, unit, status, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(WO_ID, 'WO-IPC-1', BOM_ID, 5, 'B-IPC-1', 100, 'box', 'in_progress', now, now);
    sqlite
      .prepare(
        `INSERT INTO inventory_lots
          (id, item_id, lot_number, batch_number, warehouse_id, quantity, reserved_quantity, unit, status, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(LOT_ID, 5, 'B-IPC-1', 'B-IPC-1', 1, 0, 0, 'box', 'under_test', now, now);
    // One IPC criterion.
    sqlite
      .prepare(`INSERT INTO ipc_criteria (id, code, name, created_at) VALUES (?,?,?,?)`)
      .run(1, 'IPC-AVGWT', 'Average Weight', now);
  });

  function seedBomIpc(criteriaId: number, sequence: number, phase: string) {
    sqlite
      .prepare(
        `INSERT INTO bom_in_process_qc (bom_id, criteria_id, sequence, sample_size, is_critical, phase, created_at)
         VALUES (?,?,?,?,?,?,?)`,
      )
      .run(BOM_ID, criteriaId, sequence, 5, 0, phase, now);
  }

  function seedExistingTest(sampleNumber: string, status: string, ipcPhase: string | null) {
    sqlite
      .prepare(
        `INSERT INTO quality_tests
          (lot_id, test_type, sample_number, status, ipc_phase, ipc_criteria_id, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?)`,
      )
      .run(LOT_ID, 'in_process', sampleNumber, status, ipcPhase, 1, now, now);
  }

  function getPhase(sampleNumber: string): string | null {
    const row = sqlite
      .prepare(
        `SELECT ipc_phase FROM quality_tests WHERE lot_id=? AND sample_number=?`,
      )
      .get(LOT_ID, sampleNumber) as { ipc_phase: string | null } | undefined;
    return row?.ipc_phase ?? null;
  }

  it('re-syncs a PENDING test to the current BOM phase', async () => {
    seedBomIpc(1, 1, 'pre_production'); // BOM now says pre_production
    seedExistingTest('IPC-1', 'pending', 'production'); // stale phase

    const result = await initializeWOIPCTests(WO_ID, OPERATOR_ID);

    expect(result.created).toHaveLength(0); // nothing new created
    expect(result.rephased).toBe(1);
    expect(getPhase('IPC-1')).toBe('pre_production'); // moved
  });

  it('keeps a COMPLETED test frozen (does not move phase)', async () => {
    seedBomIpc(1, 1, 'pre_production');
    seedExistingTest('IPC-1', 'pass', 'production'); // already recorded

    const result = await initializeWOIPCTests(WO_ID, OPERATOR_ID);

    expect(result.rephased).toBe(0);
    expect(getPhase('IPC-1')).toBe('production'); // frozen
  });

  it('backfills a NULL phase even on a completed test', async () => {
    seedBomIpc(1, 1, 'pre_production');
    seedExistingTest('IPC-1', 'pass', null); // legacy null phase

    const result = await initializeWOIPCTests(WO_ID, OPERATOR_ID);

    expect(result.rephased).toBe(1);
    expect(getPhase('IPC-1')).toBe('pre_production');
  });

  it('creates a new test for a BOM criteria not yet seeded', async () => {
    seedBomIpc(1, 1, 'pre_production'); // sequence 1 → IPC-1, none exists yet

    const result = await initializeWOIPCTests(WO_ID, OPERATOR_ID);

    expect(result.created).toHaveLength(1);
    expect(getPhase('IPC-1')).toBe('pre_production');
  });
});
