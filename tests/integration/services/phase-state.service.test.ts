/**
 * Integration Tests: Phase State Service — empty phases auto-advance
 *
 * Regression for the user-reported bug: a monitored phase whose gating
 * activity has ZERO configured items must be treated as "done" so the active
 * phase advances instead of stranding the operator on an empty phase.
 *   pre_production → material weighing
 *   production     → IPC tests
 *   packaging      → packaging integrity checks
 *
 * The three gating activities are pulled from wo-execution.service, which we
 * mock so each scenario controls exactly what is "configured".
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

// Control the three gating activities directly.
const mocks = vi.hoisted(() => ({
  materials: [] as any[],
  ipc: [] as any[],
  integrity: [] as any[],
}));

vi.mock('@/lib/services/wo-execution.service', () => ({
  getWOMaterials: vi.fn(async () => mocks.materials),
  getWOIPCTests: vi.fn(async () => mocks.ipc),
  getWOPackagingIntegrityLogs: vi.fn(async () => mocks.integrity),
}));

import {
  setupTestDatabase,
  closeTestDatabase,
  cleanTables,
  TestDatabase,
} from '../../helpers/test-db';
import { getSqliteDate } from '../../helpers/service-test-utils';
import { getPhaseState } from '@/lib/services/phase-state.service';

describe('Phase State — empty phases are "done"', () => {
  let sqlite: Database.Database;
  let db: TestDatabase;
  const now = getSqliteDate();
  const WO_ID = 1;

  beforeAll(() => {
    const setup = setupTestDatabase([
      schema.sqliteWorkOrders,
      schema.sqliteBOMRooms,
      schema.sqliteWOEnvironmentalLogs,
    ]);
    sqlite = setup.sqlite;
    db = setup.db;
    setTestDb(db);
  });

  afterAll(() => {
    closeTestDatabase(sqlite);
  });

  beforeEach(() => {
    cleanTables(sqlite, ['wo_environmental_logs', 'bom_rooms', 'work_orders']);
    mocks.materials = [];
    mocks.ipc = [];
    mocks.integrity = [];
    sqlite
      .prepare(
        `INSERT INTO work_orders
          (id, wo_number, bom_id, product_id, batch_number, planned_quantity, unit, status, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(WO_ID, 'WO-PS-1', 1, 1, 'B-PS-1', 100, 'box', 'in_progress', now, now);
  });

  it('marks every phase completed and activePhase null when nothing is configured', async () => {
    // materials/ipc/integrity all empty → each phase has total 0 → done.
    const state = await getPhaseState(WO_ID);

    expect(state.pre_production.status).toBe('completed');
    expect(state.production.status).toBe('completed');
    expect(state.packaging.status).toBe('completed');
    expect(state.activePhase).toBeNull();
  });

  it('stops at production when IPC tests exist but are not all recorded', async () => {
    // Pre-production empty (done). Production has 2 IPC tests, only 1 recorded.
    mocks.ipc = [
      { id: 1, status: 'pass' },
      { id: 2, status: 'pending' },
    ];

    const state = await getPhaseState(WO_ID);

    expect(state.pre_production.status).toBe('completed'); // empty → done
    expect(state.production.status).toBe('active');
    expect(state.production.progress).toEqual({ completed: 1, total: 2 });
    expect(state.activePhase).toBe('production');
  });

  it('treats production as done once all IPC tests are recorded', async () => {
    mocks.ipc = [
      { id: 1, status: 'pass' },
      { id: 2, status: 'fail' },
    ];

    const state = await getPhaseState(WO_ID);

    expect(state.production.status).toBe('completed');
    // packaging has no integrity logs → done too → no active phase
    expect(state.activePhase).toBeNull();
  });
});
