/**
 * Integration Tests: Water Quality Test Records — history / edit / delete
 * Feature: 023-environmental-monitoring
 *
 * Covers the record-history CRUD added for the Water Quality records page:
 *  - listWaterTests / getWaterTest
 *  - updateWaterTest (re-evaluates vs stored spec snapshot, recomputes overall)
 *  - deleteWaterTest (removes test + results)
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
import {
  createWaterSystem,
  createSamplePoint,
  createSpec,
  recordWaterTest,
  listWaterTests,
  getWaterTest,
  updateWaterTest,
  deleteWaterTest,
} from '@/lib/services/water-quality.service';

describe('Water Quality Test Records (history / edit / delete)', () => {
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
      schema.sqliteAuditTrail,
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
      'audit_trail',
      'water_quality_test_results',
      'water_quality_tests',
      'water_quality_specs',
      'water_sample_points',
      'water_systems',
      'electronic_signatures',
      'deviations',
      'users',
    ]);
    seedTestUser(sqlite, 1);
  });

  async function seedRecordedTest(phValue: number) {
    const sys = await createWaterSystem({ code: 'PW-01', name: 'Purified Water', systemType: 'purified' });
    const pt = await createSamplePoint({ waterSystemId: sys.id, code: 'PW-SP01', name: 'Tank outlet' });
    await createSpec({ waterSystemId: sys.id, parameter: 'ph', unit: '', specMin: 5, specMax: 7 });
    const rec = await recordWaterTest(
      {
        samplePointId: pt.id,
        waterSystemId: sys.id,
        results: [{ parameter: 'ph', numericValue: phValue, unit: '' }],
        notes: 'first',
        signature: { password: 'verify' },
      },
      1,
    );
    return { sys, pt, rec };
  }

  it('listWaterTests returns the recorded test with names', async () => {
    await seedRecordedTest(6);
    const list = await listWaterTests();
    expect(list.length).toBe(1);
    expect(list[0].samplePointName).toBe('Tank outlet');
    expect(list[0].systemName).toBe('Purified Water');
    expect(list[0].overallResult).toBe('in_spec');
  });

  it('getWaterTest returns per-parameter results with spec snapshot', async () => {
    const { rec } = await seedRecordedTest(6);
    const detail = await getWaterTest(rec.testId);
    expect(detail.results.length).toBe(1);
    expect(detail.results[0].parameter).toBe('ph');
    expect(detail.results[0].numericValue).toBe(6);
    expect(detail.results[0].specMaxSnapshot).toBe(7);
    expect(detail.results[0].result).toBe('in_spec');
  });

  it('updateWaterTest re-evaluates and flips overall to out_of_spec', async () => {
    const { rec } = await seedRecordedTest(6);
    const detail = await getWaterTest(rec.testId);
    const res = await updateWaterTest(
      rec.testId,
      { notes: 'corrected', results: [{ id: detail.results[0].id, numericValue: 9 }] },
      1,
    );
    expect(res.overallResult).toBe('out_of_spec');
    expect(res.outOfSpecCount).toBe(1);

    const after = await getWaterTest(rec.testId);
    expect(after.results[0].numericValue).toBe(9);
    expect(after.results[0].result).toBe('out_of_spec');
    expect(after.notes).toBe('corrected');
  });

  it('updateWaterTest writes an audit_trail entry', async () => {
    const { rec } = await seedRecordedTest(6);
    const detail = await getWaterTest(rec.testId);
    await updateWaterTest(rec.testId, { results: [{ id: detail.results[0].id, numericValue: 6.5 }] }, 1);
    const auditRows = sqlite
      .prepare("SELECT * FROM audit_trail WHERE table_name = 'waterQualityTests' AND action = 'UPDATE'")
      .all();
    expect(auditRows.length).toBe(1);
  });

  it('deleteWaterTest removes the test and its results', async () => {
    const { rec } = await seedRecordedTest(6);
    await deleteWaterTest(rec.testId, 1);
    const list = await listWaterTests();
    expect(list.length).toBe(0);
    const resultRows = sqlite
      .prepare('SELECT * FROM water_quality_test_results WHERE test_id = ?')
      .all(rec.testId);
    expect(resultRows.length).toBe(0);
  });

  it('getWaterTest throws for a missing id', async () => {
    await expect(getWaterTest(99999)).rejects.toThrow();
  });
});
