/**
 * Integration Tests: Environmental Inspection Records — history / edit / delete
 * Feature: 023-environmental-monitoring
 *
 * Covers the record-history CRUD added for the Premises inspections module:
 *  - listInspectionRecords / getInspectionRecord
 *  - updateInspectionRecord (re-evaluates vs stored spec snapshot, recomputes overall)
 *  - deleteInspectionRecord (removes record + results)
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
  createTemplate,
  createSchedule,
  recordInspection,
  listInspectionRecords,
  getInspectionRecord,
  updateInspectionRecord,
  deleteInspectionRecord,
} from '@/lib/services/environmental-inspection.service';

describe('Environmental Inspection Records (history / edit / delete)', () => {
  let sqlite: Database.Database;
  let db: TestDatabase;

  beforeAll(() => {
    const setup = setupTestDatabase([
      schema.sqliteUsers,
      schema.sqliteInspectionTemplates,
      schema.sqliteInspectionSchedules,
      schema.sqliteInspectionRecords,
      schema.sqliteInspectionResults,
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
      'env_inspection_results',
      'env_inspection_records',
      'env_inspection_schedules',
      'env_inspection_templates',
      'electronic_signatures',
      'deviations',
      'users',
    ]);
    seedTestUser(sqlite, 1);
  });

  async function seedRecordedInspection(value: number) {
    const tpl = await createTemplate(
      {
        name: 'Daily Room Check',
        targetType: 'room',
        items: [
          {
            label: 'อุณหภูมิ',
            parameter: 'temperature',
            unit: '°C',
            specMin: 15,
            specMax: 30,
            isMandatory: true,
            sortOrder: 1,
          },
        ],
      },
      1,
    );
    const sched = await createSchedule({
      targetType: 'room',
      targetId: 5,
      targetName: 'ห้องผสม A',
      templateId: tpl.id,
      frequency: 'daily',
    });
    const rec = await recordInspection(
      {
        scheduleId: sched.id,
        templateId: tpl.id,
        targetType: 'room',
        targetId: 5,
        results: [{ templateItemId: 1, parameter: 'temperature', numericValue: value }],
        notes: 'first reading',
        signature: { password: 'verify' },
      },
      1,
    );
    return { tpl, sched, rec };
  }

  it('listInspectionRecords returns the recorded inspection with names', async () => {
    await seedRecordedInspection(22);
    const list = await listInspectionRecords();
    expect(list.length).toBe(1);
    expect(list[0].targetName).toBe('ห้องผสม A');
    expect(list[0].templateName).toBe('Daily Room Check');
    expect(list[0].overallResult).toBe('in_spec');
  });

  it('getInspectionRecord returns per-item results with labels + spec snapshot', async () => {
    const { rec } = await seedRecordedInspection(22);
    const detail = await getInspectionRecord(rec.inspectionId);
    expect(detail.results.length).toBe(1);
    expect(detail.results[0].label).toBe('อุณหภูมิ');
    expect(detail.results[0].numericValue).toBe(22);
    expect(detail.results[0].specMaxSnapshot).toBe(30);
    expect(detail.results[0].result).toBe('in_spec');
  });

  it('updateInspectionRecord re-evaluates against the stored spec and flips overall to out_of_spec', async () => {
    const { rec } = await seedRecordedInspection(22);
    const detail = await getInspectionRecord(rec.inspectionId);
    const resultId = detail.results[0].id;

    const res = await updateInspectionRecord(
      rec.inspectionId,
      { notes: 'corrected', results: [{ id: resultId, numericValue: 40 }] },
      1,
    );
    expect(res.overallResult).toBe('out_of_spec');
    expect(res.outOfSpecCount).toBe(1);

    const after = await getInspectionRecord(rec.inspectionId);
    expect(after.results[0].numericValue).toBe(40);
    expect(after.results[0].result).toBe('out_of_spec');
    expect(after.notes).toBe('corrected');
  });

  it('updateInspectionRecord writes an audit_trail entry', async () => {
    const { rec } = await seedRecordedInspection(22);
    const detail = await getInspectionRecord(rec.inspectionId);
    await updateInspectionRecord(
      rec.inspectionId,
      { results: [{ id: detail.results[0].id, numericValue: 25 }] },
      1,
    );
    const auditRows = sqlite
      .prepare("SELECT * FROM audit_trail WHERE table_name = 'inspectionRecords' AND action = 'UPDATE'")
      .all();
    expect(auditRows.length).toBe(1);
  });

  it('deleteInspectionRecord removes the record and its results', async () => {
    const { rec } = await seedRecordedInspection(22);
    await deleteInspectionRecord(rec.inspectionId, 1);

    const list = await listInspectionRecords();
    expect(list.length).toBe(0);
    const resultRows = sqlite
      .prepare('SELECT * FROM env_inspection_results WHERE inspection_id = ?')
      .all(rec.inspectionId);
    expect(resultRows.length).toBe(0);
  });

  it('getInspectionRecord throws for a missing id', async () => {
    await expect(getInspectionRecord(99999)).rejects.toThrow();
  });
});
