/**
 * Tests: environmental inspection scheduling
 *
 * - computeNextDue: pure date math per frequency.
 * - createSchedule: smoke test that the happy path inserts a schedule and
 *   computes a future nextDue (regression guard for the date-handling path
 *   that previously threw "toISOString is not a function" on MySQL).
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import * as schema from '@/lib/db/schema';
import { sqliteInspectionSchedules } from '@/lib/db/schema-environmental-monitoring';
import Database from 'better-sqlite3';
import { computeNextDue } from '@/types/environmental-monitoring';

// ── computeNextDue (pure) ──────────────────────────────────
describe('computeNextDue', () => {
  const base = new Date('2026-06-01T00:00:00.000Z');

  it('daily adds 1 day', () => {
    expect(computeNextDue('daily', base).toISOString().slice(0, 10)).toBe('2026-06-02');
  });
  it('weekly adds 7 days', () => {
    expect(computeNextDue('weekly', base).toISOString().slice(0, 10)).toBe('2026-06-08');
  });
  it('monthly adds 1 month', () => {
    expect(computeNextDue('monthly', base).toISOString().slice(0, 10)).toBe('2026-07-01');
  });
  it('yearly adds 1 year', () => {
    expect(computeNextDue('yearly', base).toISOString().slice(0, 10)).toBe('2027-06-01');
  });
});

// ── createSchedule (smoke) ─────────────────────────────────
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
import { createSchedule } from '@/lib/services/environmental-inspection.service';

describe('createSchedule', () => {
  let sqlite: Database.Database;
  let db: TestDatabase;

  beforeAll(() => {
    const setup = setupTestDatabase([sqliteInspectionSchedules]);
    sqlite = setup.sqlite;
    db = setup.db;
    setTestDb(db);
  });

  afterAll(() => {
    closeTestDatabase(sqlite);
  });

  beforeEach(() => {
    cleanTables(sqlite, ['env_inspection_schedules']);
  });

  it('inserts a schedule and computes a future nextDue without throwing', async () => {
    const res = await createSchedule({
      targetType: 'room',
      targetId: 5,
      targetName: 'ROOM-PACK-01 — ห้องบรรจุ',
      templateId: 1,
      frequency: 'daily',
      alertDaysBefore: 1,
    });

    expect(res.id).toBeGreaterThan(0);

    const row = sqlite
      .prepare(`SELECT target_name, frequency, next_due FROM env_inspection_schedules WHERE id=?`)
      .get(res.id) as { target_name: string; frequency: string; next_due: string };

    expect(row.target_name).toBe('ROOM-PACK-01 — ห้องบรรจุ'); // Thai preserved
    expect(row.frequency).toBe('daily');
    // nextDue must be a valid date strictly in the future.
    expect(new Date(row.next_due).getTime()).toBeGreaterThan(Date.now());
  });
});
