/**
 * COA — Date Flow & Signature-Name Integration Tests
 * Feature: Quality / Certificate of Analysis
 *
 * Proves the data that the COA shows actually persists and flows from the
 * source QC sample, exercised against a real in-memory SQLite database
 * (tables created from the Drizzle ORM schema):
 *
 *   - manufacture / expiry / retest dates copy from the QC sample into the COA
 *   - a sample with NO dates produces a COA with null dates (the root cause of
 *     the "—" blanks the operator saw — it is a missing-input issue, not a bug)
 *   - the issued COA exposes approver/releaser NAMES (used by the certificate
 *     "Reviewed by" / "Approved by" without requiring a signature row)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { getTableName, getTableColumns } from 'drizzle-orm';
import { SQLiteTable } from 'drizzle-orm/sqlite-core';
import * as schema from '@/lib/db/schema';

// ============================================
// Constants
// ============================================
const USER = { ANALYST: 1, QC_MANAGER: 2, QA_RELEASE: 3 };
const PRODUCT = { A: 1 };
const CRITERION = { MOISTURE: 1 };

const DATES = {
  MANUFACTURE: '2026-01-15',
  EXPIRY: '2028-01-14',
  RETEST: '2027-07-15',
};

// ============================================
// Schema-sync helper (inline)
// ============================================
interface DrizzleColumnMeta {
  name: string;
  dataType: string;
  primary?: boolean;
  autoIncrement?: boolean;
  notNull?: boolean;
  hasDefault?: boolean;
  default?: unknown;
  isUnique?: boolean;
}

function generateCreateTableSql(table: SQLiteTable): string {
  const tableName = getTableName(table);
  const columns = getTableColumns(table);
  const defs: string[] = [];
  for (const [, column] of Object.entries(columns)) {
    const col = column as unknown as DrizzleColumnMeta;
    let def = `"${col.name}" `;
    switch (col.dataType) {
      case 'string': def += 'TEXT'; break;
      case 'number': def += 'INTEGER'; break;
      case 'boolean': def += 'INTEGER'; break;
      default: def += 'TEXT';
    }
    if (col.primary) {
      def += ' PRIMARY KEY';
      if (col.autoIncrement) def += ' AUTOINCREMENT';
    }
    if (col.notNull && !col.primary) def += ' NOT NULL';
    if (col.hasDefault && col.default !== undefined) {
      const dv = typeof col.default === 'string' ? `'${col.default}'` : col.default;
      if (dv !== null && typeof dv !== 'function') def += ` DEFAULT ${dv}`;
    }
    if (col.isUnique && !col.primary) def += ' UNIQUE';
    defs.push(def);
  }
  return `CREATE TABLE IF NOT EXISTS "${tableName}" (\n  ${defs.join(',\n  ')}\n)`;
}

// ============================================
// Test DB + mocks
// ============================================
let sqlite: Database.Database;
let testDb: ReturnType<typeof drizzle>;

vi.mock('@/lib/db', async () => ({
  isSqlite: () => true,
  getDb: async () => testDb,
  getSqliteDb: () => testDb,
  markSchemaSynced: () => {},
  schema,
}));

vi.mock('@/lib/audit', () => ({
  createAuditLog: vi.fn(() => Promise.resolve()),
}));

import {
  generateCoaFromSample,
  getCoaById,
} from '@/lib/services/coa.service';

function syncSchema() {
  const tables = [
    schema.sqliteUsers,
    schema.sqliteItems,
    schema.sqliteCustomers,
    schema.sqliteIPCCriteria,
    schema.sqliteQcSamples,
    schema.sqliteQcSampleTests,
    schema.sqliteCoaTemplates,
    schema.sqliteCoaDocuments,
    schema.sqliteCoaTestResults,
    schema.sqliteCoaSignatures,
    schema.sqliteCoaPrintHistory,
  ];
  for (const t of tables) {
    try { sqlite.exec(generateCreateTableSql(t)); }
    catch (err) { console.log(`Table creation note: ${err}`); }
  }
}

function seedBase() {
  sqlite.exec(`
    INSERT OR IGNORE INTO users (id, name, email, password, role, department, is_active)
    VALUES
      (${USER.ANALYST}, 'นักวิเคราะห์ A', 'analyst@test.com', 'h', 'analyst', 'QC', 1),
      (${USER.QC_MANAGER}, 'ผู้จัดการ QC', 'qcm@test.com', 'h', 'qc_manager', 'QC', 1),
      (${USER.QA_RELEASE}, 'ผู้ปล่อย QA', 'qa@test.com', 'h', 'qa_manager', 'QA', 1)
  `);
  sqlite.exec(`
    INSERT OR IGNORE INTO items (id, code, name_th, name_en, type, category, primary_unit, is_active)
    VALUES (${PRODUCT.A}, 'FG-0002', 'แคปซูลฟ้าทะลายโจร', 'Andrographis Capsule', 'finished_product', 'capsule', 'box', 1)
  `);
  sqlite.exec(`
    INSERT OR IGNORE INTO ipc_criteria (id, code, name, name_th, test_method, unit, criteria_type, is_active)
    VALUES (${CRITERION.MOISTURE}, 'MOISTURE', 'Moisture', 'ความชื้น', 'Moisture analyzer', '%', 'numeric', 1)
  `);
  // A global default COA template so resolveTemplate() resolves.
  sqlite.exec(`
    INSERT OR IGNORE INTO coa_templates
      (id, name, product_category, is_default, is_active, show_storage_conditions, show_expiry_date, show_retest_date, show_qr_verify, language, created_at, updated_at)
    VALUES (1, 'Default', NULL, 1, 1, 1, 1, 1, 1, 'bilingual', '2026-01-01', '2026-01-01')
  `);
}

/**
 * Insert a RELEASED qc sample (+ one passing test) directly, with or without
 * dates, and return its id. Mirrors what the QC entry flow persists.
 */
function seedReleasedSample(opts: { withDates: boolean; sampleNumber: string; lot: string }) {
  const m = opts.withDates ? `'${DATES.MANUFACTURE}'` : 'NULL';
  const e = opts.withDates ? `'${DATES.EXPIRY}'` : 'NULL';
  const r = opts.withDates ? `'${DATES.RETEST}'` : 'NULL';
  sqlite.exec(`
    INSERT INTO qc_samples
      (sample_number, source_type, product_id, lot_number, manufacture_date, expiry_date, retest_date,
       quantity_received, unit, received_date, received_by, status, created_at, updated_at)
    VALUES
      ('${opts.sampleNumber}', 'raw_material_lot', ${PRODUCT.A}, '${opts.lot}', ${m}, ${e}, ${r},
       100, 'box', '2026-01-16', ${USER.ANALYST}, 'released', '2026-01-16', '2026-01-16')
  `);
  const id = (sqlite.prepare('SELECT last_insert_rowid() AS id').get() as { id: number }).id;
  sqlite.exec(`
    INSERT INTO qc_sample_tests
      (sample_id, criteria_id, sequence, spec_max, unit, test_method, numeric_result, result_status, created_at, updated_at)
    VALUES (${id}, ${CRITERION.MOISTURE}, 1, 8.0, '%', 'Moisture analyzer', 5.1, 'pass', '2026-01-16', '2026-01-16')
  `);
  return id;
}

function clean() {
  for (const t of [
    'coa_print_history', 'coa_signatures', 'coa_test_results', 'coa_documents',
    'coa_templates', 'qc_sample_tests', 'qc_samples',
    'ipc_criteria', 'customers', 'items', 'users',
  ]) {
    sqlite.exec(`DELETE FROM ${t}`);
  }
}

describe('COA — Date Flow & Signature Names', () => {
  beforeAll(() => {
    sqlite = new Database(':memory:');
    sqlite.pragma('journal_mode = WAL');
    testDb = drizzle(sqlite, { schema });
    syncSchema();
    seedBase();
  });
  afterAll(() => sqlite.close());
  beforeEach(() => { clean(); seedBase(); });

  describe('dates copy from the QC sample', () => {
    it('a sample WITH dates produces a COA carrying the same dates', async () => {
      const sampleId = seedReleasedSample({
        withDates: true, sampleNumber: 'QC-WITH', lot: 'LOT-WITH-01',
      });

      const gen = await generateCoaFromSample({
        sampleId,
        generatedBy: USER.ANALYST,
      });
      expect(gen.coaId).toBeGreaterThan(0);
      expect(gen.conclusion).toBe('complies');

      const coa = await getCoaById(gen.coaId);
      expect(coa).not.toBeNull();
      // Dates flowed through from the sample (stored as YYYY-MM-DD in sqlite).
      expect(String(coa!.manufactureDate)).toContain(DATES.MANUFACTURE);
      expect(String(coa!.expiryDate)).toContain(DATES.EXPIRY);
      expect(String(coa!.retestDate)).toContain(DATES.RETEST);
      // The generating analyst is exposed as createdByName (the cert's Tested-by).
      expect(coa!.createdByName).toBe('นักวิเคราะห์ A');
    });

    it('a sample WITHOUT dates produces a COA with null dates (root cause)', async () => {
      const sampleId = seedReleasedSample({
        withDates: false, sampleNumber: 'QC-NODATE', lot: 'LOT-NODATE-01',
      });

      const gen = await generateCoaFromSample({
        sampleId,
        generatedBy: USER.ANALYST,
      });
      const coa = await getCoaById(gen.coaId);

      // Confirms the blank "—" on the certificate is a missing-input problem
      // upstream, not data loss in COA generation.
      expect(coa!.manufactureDate).toBeNull();
      expect(coa!.expiryDate).toBeNull();
      expect(coa!.retestDate).toBeNull();
    });

    it('snapshots the test result into the COA', async () => {
      const sampleId = seedReleasedSample({
        withDates: true, sampleNumber: 'QC-TESTS', lot: 'LOT-TESTS-01',
      });
      const gen = await generateCoaFromSample({ sampleId, generatedBy: USER.ANALYST });
      const coa = await getCoaById(gen.coaId);

      expect(coa!.results).toHaveLength(1);
      expect(coa!.results[0].result).toContain('5.1');
      // sample test 'pass' maps to the COA conclusion 'conform'
      expect(coa!.results[0].conclusion).toBe('conform');
    });
  });

  describe('reviewer / approver names (no signature required)', () => {
    it('exposes approvedByName / releasedByName once stamped', async () => {
      const sampleId = seedReleasedSample({
        withDates: true, sampleNumber: 'QC-NAMES', lot: 'LOT-NAMES-01',
      });
      const gen = await generateCoaFromSample({ sampleId, generatedBy: USER.ANALYST });

      // Stamp approver + releaser directly (names-only path used by the demo
      // seeder) — no signature rows.
      sqlite.exec(`
        UPDATE coa_documents
        SET status = 'issued',
            approved_by = ${USER.QC_MANAGER}, approved_at = '2026-01-17',
            released_by = ${USER.QA_RELEASE}, released_at = '2026-01-17'
        WHERE id = ${gen.coaId}
      `);

      const coa = await getCoaById(gen.coaId);
      expect(coa!.status).toBe('issued');
      expect(coa!.approvedByName).toBe('ผู้จัดการ QC');
      expect(coa!.releasedByName).toBe('ผู้ปล่อย QA');
      // No signature rows were created.
      expect(coa!.signatures).toHaveLength(0);
    });
  });

  describe('guard rails', () => {
    it('refuses to generate a COA from a sample that is not released', async () => {
      // Seed a registered (not released) sample.
      sqlite.exec(`
        INSERT INTO qc_samples
          (sample_number, source_type, product_id, lot_number, quantity_received, unit, received_date, received_by, status, created_at, updated_at)
        VALUES ('QC-REG', 'raw_material_lot', ${PRODUCT.A}, 'LOT-REG', 100, 'box', '2026-01-16', ${USER.ANALYST}, 'registered', '2026-01-16', '2026-01-16')
      `);
      const id = (sqlite.prepare('SELECT last_insert_rowid() AS id').get() as { id: number }).id;

      await expect(
        generateCoaFromSample({ sampleId: id, generatedBy: USER.ANALYST }),
      ).rejects.toThrow();
    });
  });
});
