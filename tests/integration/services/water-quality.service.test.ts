/**
 * Integration Tests: Water Quality Service
 *
 * Covers the previously-untested water-quality module:
 *  - evaluateResult (pure spec comparison)
 *  - createWaterSystem (+ duplicate-code guard)
 *  - createSamplePoint / createSpec
 *  - recordWaterTest: in-spec vs out-of-spec, overall result, per-result rows,
 *    and auto-deviation on out-of-spec.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import * as schema from '@/lib/db/schema';
import Database from 'better-sqlite3';
import { evaluateResult } from '@/types/environmental-monitoring';

// ── evaluateResult (pure) ──────────────────────────────────
describe('evaluateResult', () => {
  it('in_spec when within min/max', () => {
    expect(evaluateResult(3, 0, 5)).toBe('in_spec');
  });
  it('out_of_spec above max', () => {
    expect(evaluateResult(9, null, 5)).toBe('out_of_spec');
  });
  it('out_of_spec below min', () => {
    expect(evaluateResult(2, 5, null)).toBe('out_of_spec');
  });
  it('na when value missing or no spec', () => {
    expect(evaluateResult(null, 0, 5)).toBe('na');
    expect(evaluateResult(3, null, null)).toBe('na');
  });
});

// ── service ────────────────────────────────────────────────
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
import {
  createWaterSystem,
  createSamplePoint,
  createSpec,
  recordWaterTest,
} from '@/lib/services/water-quality.service';

describe('Water Quality Service', () => {
  let sqlite: Database.Database;
  let db: TestDatabase;

  beforeAll(() => {
    const setup = setupTestDatabase([
      schema.sqliteUsers,
      schema.sqliteWaterSystems,
      schema.sqliteWaterSamplePoints,
      schema.sqliteWaterQualitySpecs,
      schema.sqliteWaterQualityTests,
      schema.sqliteWaterQualityTestResults,
      schema.sqliteElectronicSignatures,
      schema.sqliteDeviations,
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
      'deviations',
      'electronic_signatures',
      'water_quality_test_results',
      'water_quality_tests',
      'water_quality_specs',
      'water_sample_points',
      'water_systems',
      'users',
    ]);
    seedTestUser(sqlite, 1);
  });

  it('createWaterSystem returns the system and rejects duplicate code', async () => {
    const sys = await createWaterSystem({
      code: 'PW-01',
      name: 'Purified Water 1',
      systemType: 'purified',
    });
    expect(sys.id).toBeGreaterThan(0);
    expect(sys.code).toBe('PW-01');

    await expect(
      createWaterSystem({ code: 'PW-01', name: 'dup', systemType: 'purified' }),
    ).rejects.toThrow();
  });

  it('createSamplePoint and createSpec persist correctly', async () => {
    const sys = await createWaterSystem({ code: 'RO-01', name: 'RO', systemType: 'ro' });
    const pt = await createSamplePoint({
      waterSystemId: sys.id,
      code: 'RO-SP01',
      name: 'RO Outlet',
    });
    expect(pt.waterSystemId).toBe(sys.id);

    const spec = await createSpec({
      waterSystemId: sys.id,
      parameter: 'conductivity',
      unit: 'uS/cm',
      specMax: 5,
    });
    expect(spec.id).toBeGreaterThan(0);
  });

  async function setupSystemWithSpec() {
    const sys = await createWaterSystem({ code: 'PW-01', name: 'PW', systemType: 'purified' });
    const pt = await createSamplePoint({
      waterSystemId: sys.id,
      code: 'PW-SP01',
      name: 'Loop',
    });
    await createSpec({
      waterSystemId: sys.id,
      parameter: 'conductivity',
      unit: 'uS/cm',
      specMax: 5,
    });
    return { sys, pt };
  }

  it('recordWaterTest: value within spec → in_spec, no deviation', async () => {
    const { sys, pt } = await setupSystemWithSpec();

    const res = await recordWaterTest(
      {
        samplePointId: pt.id,
        waterSystemId: sys.id,
        results: [{ parameter: 'conductivity', numericValue: 3, unit: 'uS/cm' }],
        signature: { password: 'pw' },
      },
      1,
    );

    expect(res.overallResult).toBe('in_spec');
    expect(res.outOfSpecCount).toBe(0);
    expect(res.deviationId).toBeNull();

    const resultRows = sqlite
      .prepare(`SELECT result FROM water_quality_test_results WHERE test_id=?`)
      .all(res.testId) as Array<{ result: string }>;
    expect(resultRows).toHaveLength(1);
    expect(resultRows[0].result).toBe('in_spec');
  });

  it('recordWaterTest: value over max → out_of_spec + auto-deviation', async () => {
    const { sys, pt } = await setupSystemWithSpec();

    const res = await recordWaterTest(
      {
        samplePointId: pt.id,
        waterSystemId: sys.id,
        results: [{ parameter: 'conductivity', numericValue: 9, unit: 'uS/cm' }],
        signature: { password: 'pw' },
      },
      1,
    );

    expect(res.overallResult).toBe('out_of_spec');
    expect(res.outOfSpecCount).toBe(1);
    expect(res.deviationId).toBeGreaterThan(0);

    const dev = sqlite
      .prepare(`SELECT deviation_number, status FROM deviations WHERE id=?`)
      .get(res.deviationId) as { deviation_number: string; status: string } | undefined;
    expect(dev?.deviation_number).toMatch(/^DEV-/);
    expect(dev?.status).toBe('open');
  });
});
