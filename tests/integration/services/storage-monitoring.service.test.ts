/**
 * Integration Tests: Storage Monitoring Service — create / update / delete
 * Audit Q6
 *
 * Covers the DB-backed CRUD added for the Premises Storage Monitoring page:
 *  - createStorageEnvLog (auto alert evaluation)
 *  - updateStorageEnvLog (re-evaluates alert, clears prior acknowledgement)
 *  - deleteStorageEnvLog
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
  createStorageEnvLog,
  updateStorageEnvLog,
  deleteStorageEnvLog,
  listStorageEnvLogs,
  acknowledgeAlert,
} from '@/lib/services/storage-monitoring.service';

describe('Storage Monitoring Service (CRUD)', () => {
  let sqlite: Database.Database;
  let db: TestDatabase;
  let whId: number;

  beforeAll(() => {
    const setup = setupTestDatabase([
      schema.sqliteUsers,
      schema.sqliteWarehouses,
      schema.sqliteStorageEnvLogs,
    ]);
    sqlite = setup.sqlite;
    db = setup.db;
    setTestDb(db);
  });

  afterAll(() => {
    closeTestDatabase(sqlite);
  });

  beforeEach(async () => {
    cleanTables(sqlite, ['storage_env_logs', 'warehouses', 'users']);
    seedTestUser(sqlite, 1);
    // Dry-store spec: 15–30°C / 30–65 %RH
    const [wh] = await db
      .insert(schema.sqliteWarehouses)
      .values({
        code: 'WH-RM',
        name: 'Raw Material',
        type: 'raw_material',
        temperatureMin: 15,
        temperatureMax: 30,
        humidityMin: 30,
        humidityMax: 65,
      })
      .returning();
    whId = wh.id;
  });

  it('createStorageEnvLog records an in-spec reading', async () => {
    const log = await createStorageEnvLog({
      warehouseId: whId,
      temperature: 22,
      humidity: 50,
      recordedBy: 1,
    });
    expect(log.id).toBeGreaterThan(0);
    expect(log.alertLevel).toBe('in_spec');
    expect(log.alertMessage).toBeNull();
  });

  it('updateStorageEnvLog re-evaluates the alert and clears prior acknowledgement', async () => {
    // Start out of spec (temp high), then acknowledge it.
    const created = await createStorageEnvLog({
      warehouseId: whId,
      temperature: 35,
      humidity: 50,
      recordedBy: 1,
    });
    expect(created.alertLevel).toBe('temp_high');
    await acknowledgeAlert(created.id, 1, 'AC checked');

    // Correct the reading to an in-spec value.
    const updated = await updateStorageEnvLog(created.id, {
      temperature: 22,
      humidity: 50,
    });
    expect(updated.alertLevel).toBe('in_spec');
    expect(updated.alertMessage).toBeNull();
    expect(updated.temperature).toBe(22);

    // Acknowledgement is reset because the basis changed.
    const [row] = await listStorageEnvLogs({ warehouseId: whId });
    expect(row.acknowledgedBy).toBeNull();
  });

  it('updateStorageEnvLog can turn an in-spec reading into a multi-axis alert', async () => {
    const created = await createStorageEnvLog({
      warehouseId: whId,
      temperature: 22,
      humidity: 50,
      recordedBy: 1,
    });
    const updated = await updateStorageEnvLog(created.id, {
      temperature: 40,
      humidity: 90,
    });
    expect(updated.alertLevel).toBe('multiple');
    expect(updated.alertMessage).toMatch(/อุณหภูมิ/);
    expect(updated.alertMessage).toMatch(/ความชื้น/);
  });

  it('updateStorageEnvLog rejects clearing both measurements', async () => {
    const created = await createStorageEnvLog({
      warehouseId: whId,
      temperature: 22,
      humidity: 50,
      recordedBy: 1,
    });
    await expect(
      updateStorageEnvLog(created.id, { temperature: null, humidity: null }),
    ).rejects.toThrow();
  });

  it('deleteStorageEnvLog removes the reading', async () => {
    const created = await createStorageEnvLog({
      warehouseId: whId,
      temperature: 22,
      humidity: 50,
      recordedBy: 1,
    });
    await deleteStorageEnvLog(created.id);
    const rows = await listStorageEnvLogs({ warehouseId: whId });
    expect(rows.length).toBe(0);
  });

  it('deleteStorageEnvLog throws for a missing id', async () => {
    await expect(deleteStorageEnvLog(99999)).rejects.toThrow();
  });
});
