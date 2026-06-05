/**
 * Integration Tests: Production Gate Service — unconfigured-phase skipping
 *
 * Regression for the user-reported bug: when a phase has NOTHING configured in
 * the BOM (no cleaning rooms/equipment, no SOP steps), the gate must NOT block
 * advancement — there is genuinely nothing to record. Conversely, when the BOM
 * DOES configure a check, the gate must still block until it's recorded.
 *
 * Final product inspection is regulatory (not BOM-driven) and stays mandatory.
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
import {
  canStartProduction,
  canCompleteProduction,
  canStartPackaging,
} from '@/lib/services/production-gate.service';

describe('Production Gate — unconfigured phases are skippable', () => {
  let sqlite: Database.Database;
  let db: TestDatabase;
  const now = getSqliteDate();

  beforeAll(() => {
    const setup = setupTestDatabase([
      schema.sqliteWorkOrders,
      schema.sqliteBOMRooms,
      schema.sqliteBOMEquipment,
      schema.sqliteWOCleaningLogs,
      schema.sqliteWOSOPExecution,
      schema.sqliteBOMSOPSteps,
      schema.sqliteWorkOrderMaterials,
      schema.sqliteWOFinishedInspection,
      schema.sqliteWOPackagingWeightLogs,
      schema.sqliteWOPackagingIntegrityLogs,
      schema.sqliteWOPackagingMaterials,
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
      'wo_packaging_materials',
      'wo_packaging_integrity_logs',
      'wo_packaging_weight_logs',
      'wo_finished_inspection',
      'work_order_materials',
      'bom_sop_steps',
      'wo_sop_execution',
      'wo_cleaning_logs',
      'bom_equipment',
      'bom_rooms',
      'work_orders',
    ]);
  });

  // ── seed helpers ───────────────────────────────────────────
  const WO_ID = 1;
  const BOM_ID = 1;

  function seedWO() {
    sqlite
      .prepare(
        `INSERT INTO work_orders
          (id, wo_number, bom_id, product_id, batch_number, planned_quantity, unit, status, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(WO_ID, 'WO-TEST-1', BOM_ID, 1, 'B-TEST-1', 100, 'box', 'in_progress', now, now);
  }

  function seedWeighedMaterials() {
    // One material, fully weighed + verified (so weighing isn't the blocker).
    sqlite
      .prepare(
        `INSERT INTO work_order_materials
          (id, work_order_id, item_id, planned_quantity, unit, weighed_qty, verified_by, created_at)
         VALUES (?,?,?,?,?,?,?,?)`,
      )
      .run(1, WO_ID, 2, 10, 'kg', 10, 3, now);
  }

  function seedBomRoom(phase: string) {
    sqlite
      .prepare(
        `INSERT INTO bom_rooms (bom_id, room_id, phase, sequence, is_required, created_at)
         VALUES (?,?,?,?,?,?)`,
      )
      .run(BOM_ID, 1, phase, 1, 1, now);
  }

  function seedFinishedInspection(status: string) {
    sqlite
      .prepare(
        `INSERT INTO wo_finished_inspection
          (id, work_order_id, sample_date, sampler_id, checklist_results, inspector_id, status, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?)`,
      )
      .run(1, WO_ID, now, 2, '[]', 3, status, now, now);
  }

  // ── canStartProduction ─────────────────────────────────────
  describe('canStartProduction', () => {
    it('passes when BOM has no pre-production cleaning configured (materials done)', async () => {
      seedWO();
      seedWeighedMaterials();
      // No bom_rooms / bom_equipment for pre_production at all.

      const result = await canStartProduction(WO_ID);

      expect(result.canProceed).toBe(true);
      expect(result.blockers).toEqual([]);
      expect(result.completedChecks.join(' ')).toMatch(/no pre-production cleaning required/i);
    });

    it('blocks when BOM configures cleaning but no logs recorded', async () => {
      seedWO();
      seedWeighedMaterials();
      seedBomRoom('pre_production'); // configured, but no wo_cleaning_logs

      const result = await canStartProduction(WO_ID);

      expect(result.canProceed).toBe(false);
      expect(result.blockers.join(' ')).toMatch(/no pre-production cleaning logs/i);
    });
  });

  // ── canCompleteProduction ──────────────────────────────────
  describe('canCompleteProduction', () => {
    it('passes when no SOP steps and no post-production cleaning configured (inspection passed)', async () => {
      seedWO();
      seedFinishedInspection('passed');
      // No wo_sop_execution rows, no bom_rooms for post_production.

      const result = await canCompleteProduction(WO_ID);

      expect(result.canProceed).toBe(true);
      expect(result.blockers).toEqual([]);
      expect(result.completedChecks.join(' ')).toMatch(/no SOP steps required/i);
    });

    it('still blocks when final inspection is missing (regulatory, not BOM-driven)', async () => {
      seedWO();
      // No SOP, no cleaning, and no finished inspection row.

      const result = await canCompleteProduction(WO_ID);

      expect(result.canProceed).toBe(false);
      expect(result.blockers.join(' ')).toMatch(/Final Inspection/i);
    });
  });

  // ── canStartPackaging ──────────────────────────────────────
  describe('canStartPackaging', () => {
    it('passes when BOM has no packaging cleaning configured', async () => {
      seedWO();
      // No bom_rooms / bom_equipment for packaging.

      const result = await canStartPackaging(WO_ID);

      expect(result.canProceed).toBe(true);
      expect(result.blockers).toEqual([]);
      expect(result.completedChecks.join(' ')).toMatch(/no packaging cleaning required/i);
    });

    it('blocks when BOM configures packaging cleaning but no logs recorded', async () => {
      seedWO();
      seedBomRoom('packaging'); // configured, no logs

      const result = await canStartPackaging(WO_ID);

      expect(result.canProceed).toBe(false);
      expect(result.blockers.join(' ')).toMatch(/no packaging cleaning logs/i);
    });
  });
});
