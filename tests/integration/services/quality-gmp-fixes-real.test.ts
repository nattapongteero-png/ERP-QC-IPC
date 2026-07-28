/**
 * Quality + GMP Fixes — Real Integration Tests
 *
 * Verifies the dev fixes in the Quality/GMP domain against a real in-memory
 * SQLite database (schema-sync from Drizzle). Covers:
 *
 *  #1 CAPA e-signature verify password (processCapaApproval)
 *  #2 CAPA delete guard (deleteCapa) + child cascade
 *  #3 deviation + complaint delete guards (initial-status only, child cascade)
 *  #4 PQR real aggregation (aggregatePqrCounts / createPqrReport)
 *
 * Run with: DB_TYPE=sqlite bunx vitest run tests/integration/services/quality-gmp-fixes-real.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { getTableName, getTableColumns } from 'drizzle-orm';
import { SQLiteTable } from 'drizzle-orm/sqlite-core';
import bcrypt from 'bcryptjs';
import * as schema from '@/lib/db/schema';

// ---------------------------------------------------------------------------
// Test database wiring
// ---------------------------------------------------------------------------
let sqlite: Database.Database;
let testDb: ReturnType<typeof drizzle>;

vi.mock('@/lib/db', async () => {
  return {
    isSqlite: () => true,
    getDb: async () => testDb,
    getSqliteDb: () => testDb,
    markSchemaSynced: () => {},
    schema,
  };
});

// Mock audit so we can assert it was called without real DB side-effects.
const auditCalls: Array<Record<string, unknown>> = [];
vi.mock('@/lib/audit', () => ({
  createAuditLog: vi.fn((entry: Record<string, unknown>) => {
    auditCalls.push(entry);
    return Promise.resolve();
  }),
  getClientIP: () => '127.0.0.1',
}));

// Mock api-utils auth so the deviation DELETE route runs against our test db
// without dragging in the full session/permission chain. Response helpers are
// kept real so we still exercise the route's status codes / JSON shape.
vi.mock('@/lib/api-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-utils')>();
  return {
    ...actual,
    withAuth: async (
      _req: Request,
      handler: (session: { userId: number; role: string }) => Promise<unknown>,
    ) => handler({ userId: 1, role: 'administrator' }),
  };
});

// Import services AFTER mocks
import {
  createCapa,
  addAction,
  recordEffectiveness,
  deleteCapa,
  getCapaById,
  submitCapaForApproval,
  updateAction,
  verifyAction,
  processCapaApproval,
} from '@/lib/services/capa-service';
import {
  createComplaint,
  deleteComplaint,
  getComplaintById,
  recordInvestigation,
  routeToQC,
} from '@/lib/services/complaint-service';
import {
  createPqrReport,
  aggregatePqrCounts,
} from '@/lib/services/pqr-service';

// ---------------------------------------------------------------------------
// Schema-sync helper
// ---------------------------------------------------------------------------
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
  const columnDefs: string[] = [];

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
      const defaultVal = typeof col.default === 'string' ? `'${col.default}'` : col.default;
      if (defaultVal !== null && typeof defaultVal !== 'function') def += ` DEFAULT ${defaultVal}`;
    }
    if (col.isUnique && !col.primary) def += ' UNIQUE';
    columnDefs.push(def);
  }
  return `CREATE TABLE IF NOT EXISTS "${tableName}" (\n  ${columnDefs.join(',\n  ')}\n)`;
}

function syncSchema(tables: SQLiteTable[]) {
  for (const table of tables) {
    sqlite.exec(generateCreateTableSql(table));
  }
}

// Seed two users: bcrypt-hashed password + plain seed password.
const PLAIN_PW = 'qa-secret-123';
let BCRYPT_HASH = '';

function seedUsers() {
  // user 1: bcrypt-hashed password ; user 2: plain seed password ; user 3: assignee
  sqlite.prepare(
    `INSERT OR IGNORE INTO users (id, name, email, password, role, is_active) VALUES (?, ?, ?, ?, ?, 1)`
  ).run(1, 'QA Manager', 'qa@test.com', BCRYPT_HASH, 'qa_manager');
  sqlite.prepare(
    `INSERT OR IGNORE INTO users (id, name, email, password, role, is_active) VALUES (?, ?, ?, ?, ?, 1)`
  ).run(2, 'Seed User', 'seed@test.com', PLAIN_PW, 'supervisor');
  sqlite.prepare(
    `INSERT OR IGNORE INTO users (id, name, email, password, role, is_active) VALUES (?, ?, ?, ?, ?, 1)`
  ).run(3, 'Assignee', 'assignee@test.com', 'whatever', 'analyst');
  // user 4: empty password — cannot sign (storedHash falsy path).
  // (schema marks password NOT NULL, so use '' rather than null.)
  sqlite.prepare(
    `INSERT OR IGNORE INTO users (id, name, email, password, role, is_active) VALUES (?, ?, ?, ?, ?, 1)`
  ).run(4, 'No Password', 'nopw@test.com', '', 'analyst');
}

beforeAll(() => {
  BCRYPT_HASH = bcrypt.hashSync(PLAIN_PW, 8);
  sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  testDb = drizzle(sqlite, { schema });

  syncSchema([
    schema.sqliteUsers,
    schema.sqliteItems,
    schema.sqliteWarehouses,
    schema.sqliteInventoryLots,
    schema.sqliteBOM,
    schema.sqliteWorkOrders,
    schema.sqliteCapa,
    schema.sqliteCapaActions,
    schema.sqliteCapaEffectiveness,
    schema.sqliteCapaAttachments,
    schema.sqliteCapaApprovals,
    schema.sqliteDeviations,
    schema.sqliteComplaints,
    schema.sqliteComplaintInvestigations,
    schema.sqliteAuditFindings,
    schema.sqliteQualityTests,
    schema.sqliteStabilityStudies,
    schema.sqliteStabilitySamples,
    schema.sqliteRecalls,
    schema.sqlitePqrReports,
    schema.sqlitePqrMetrics,
  ]);
});

afterAll(() => {
  sqlite.close();
});

beforeEach(() => {
  auditCalls.length = 0;
  // Wipe everything between tests
  for (const t of [
    'capa_effectiveness', 'capa_actions', 'capa_approvals', 'capa_attachments', 'capa',
    'complaint_investigations', 'complaints',
    'deviations', 'quality_tests', 'stability_samples', 'stability_studies',
    'recalls', 'pqr_metrics', 'pqr_reports', 'work_orders', 'bom',
    'inventory_lots', 'items', 'warehouses', 'users',
  ]) {
    try { sqlite.exec(`DELETE FROM ${t}`); } catch { /* table may not exist */ }
  }
  seedUsers();
});

// ===========================================================================
// #1 CAPA e-signature verify password
// ===========================================================================
describe('#1 CAPA approval e-signature password verify', () => {
  // Build a CAPA that is pending_approval so processCapaApproval reaches the
  // password check.
  async function buildPendingApprovalCapa(): Promise<number> {
    const capa = await createCapa({
      title: 'CAPA needs approval',
      sourceType: 'other',
      type: 'corrective',
      priority: 'high',
      ownerId: 1,
      dueDate: '2026-12-01',
      rootCauseAnalysis: 'root cause',
    }, 1);

    const action = await addAction(capa.id, {
      description: 'Fix it',
      actionType: 'corrective',
      assigneeId: 3,
      dueDate: '2026-11-01',
    }, 1);
    await updateAction(action.id, { status: 'completed' }, 3);
    await verifyAction(action.id, 1); // verifier != assignee
    await recordEffectiveness(capa.id, { criteria: 'no recurrence', result: 'effective' }, 1);
    await submitCapaForApproval(capa.id, { closureNotes: 'ready' }, 1);
    return capa.id;
  }

  it('rejects approval with WRONG password (bcrypt user)', async () => {
    const capaId = await buildPendingApprovalCapa();
    await expect(
      processCapaApproval(capaId, { action: 'approve' }, 1, 'totally-wrong')
    ).rejects.toThrow('Invalid password');
    // CAPA must still be pending (not closed)
    const after = await getCapaById(capaId);
    expect(after!.status).toBe('pending_approval');
  });

  it('accepts approval with CORRECT password (bcrypt hash)', async () => {
    const capaId = await buildPendingApprovalCapa();
    await expect(
      processCapaApproval(capaId, { action: 'approve' }, 1, PLAIN_PW)
    ).resolves.toBeUndefined();
  });

  it('REJECTS a plain (un-hashed) stored password', async () => {
    const capaId = await buildPendingApprovalCapa();
    // User 2's password is stored un-hashed. This used to be accepted via a
    // `hash === input` fallback, i.e. a plaintext comparison on a 21 CFR Part
    // 11 signing path. That fallback is gone: only bcrypt-verifiable
    // credentials can produce a signature, so this must now fail even though
    // the supplied password "matches" the stored value.
    await expect(
      processCapaApproval(capaId, { action: 'approve' }, 2, PLAIN_PW)
    ).rejects.toThrow(/Invalid password/i);
  });

  it('rejects when user has no password set', async () => {
    const capaId = await buildPendingApprovalCapa();
    await expect(
      processCapaApproval(capaId, { action: 'approve' }, 4, 'anything')
    ).rejects.toThrow(/no password/i);
  });

  it('rejects when password is empty', async () => {
    const capaId = await buildPendingApprovalCapa();
    await expect(
      processCapaApproval(capaId, { action: 'approve' }, 1, '')
    ).rejects.toThrow(/Password is required/i);
  });
});

// ===========================================================================
// #2 CAPA delete guard
// ===========================================================================
describe('#2 CAPA delete guard + child cascade', () => {
  it('deletes an OPEN CAPA and removes child rows', async () => {
    const capa = await createCapa({
      title: 'Mistaken CAPA',
      sourceType: 'other',
      type: 'corrective',
      priority: 'low',
      ownerId: 1,
      dueDate: '2026-12-01',
    }, 1);

    // addAction would flip status to action_pending; seed children directly so
    // the CAPA stays 'open' and we can assert the cascade.
    sqlite.prepare(
      `INSERT INTO capa_actions (capa_id, action_number, description, action_type, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(capa.id, 1, 'child action', 'corrective', 'pending', new Date().toISOString());
    sqlite.prepare(
      `INSERT INTO capa_effectiveness (capa_id, check_number, criteria, result, created_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(capa.id, 1, 'crit', 'effective', new Date().toISOString());

    const before = sqlite.prepare('SELECT COUNT(*) c FROM capa_actions WHERE capa_id = ?').get(capa.id) as { c: number };
    expect(before.c).toBe(1);

    const res = await deleteCapa(capa.id, 1);
    expect(res.deleted).toBe(true);

    // CAPA + children all gone
    expect(await getCapaById(capa.id)).toBeNull();
    const actLeft = sqlite.prepare('SELECT COUNT(*) c FROM capa_actions WHERE capa_id = ?').get(capa.id) as { c: number };
    const effLeft = sqlite.prepare('SELECT COUNT(*) c FROM capa_effectiveness WHERE capa_id = ?').get(capa.id) as { c: number };
    expect(actLeft.c).toBe(0);
    expect(effLeft.c).toBe(0);

    // Audit DELETE recorded
    expect(auditCalls.some(a => a.action === 'DELETE' && a.tableName === 'capa')).toBe(true);
  });

  it('refuses to delete a non-open CAPA', async () => {
    const capa = await createCapa({
      title: 'In-progress CAPA',
      sourceType: 'other',
      type: 'corrective',
      priority: 'low',
      ownerId: 1,
      dueDate: '2026-12-01',
    }, 1);
    // Move out of 'open'
    sqlite.prepare('UPDATE capa SET status = ? WHERE id = ?').run('investigation', capa.id);

    await expect(deleteCapa(capa.id, 1)).rejects.toThrow(/เปิด|open/i);
    // Still present
    expect(await getCapaById(capa.id)).not.toBeNull();
  });

  it('throws for non-existent CAPA', async () => {
    await expect(deleteCapa(99999, 1)).rejects.toThrow('CAPA not found');
  });
});

// ===========================================================================
// #3 deviation + complaint delete guards
// ===========================================================================
describe('#3 complaint delete guard + child cascade', () => {
  function seedComplaintProduct() {
    sqlite.prepare(
      `INSERT OR IGNORE INTO items (id, code, name_th, name_en, type, category, primary_unit, is_active)
       VALUES (1, 'FG-001', 'ยา A', 'Herb A', 'finished_goods', 'capsule', 'box', 1)`
    ).run();
  }

  it('deletes a RECEIVED complaint and removes investigations', async () => {
    seedComplaintProduct();
    const complaint = await createComplaint({
      receivedDate: '2026-06-01',
      source: 'customer',
      customerName: 'Cust',
      productId: 1,
      category: 'quality',
      severity: 'major',
      description: 'bad taste',
    }, 1);
    expect(complaint.status).toBe('received');

    // Seed an investigation child row directly (routeToQC would change status).
    sqlite.prepare(
      `INSERT INTO complaint_investigations (complaint_id, investigator_id, start_date, created_at)
       VALUES (?, ?, ?, ?)`
    ).run(complaint.id, 3, '2026-06-02', new Date().toISOString());

    await deleteComplaint(complaint.id, 1);

    expect(await getComplaintById(complaint.id)).toBeNull();
    const invLeft = sqlite.prepare('SELECT COUNT(*) c FROM complaint_investigations WHERE complaint_id = ?').get(complaint.id) as { c: number };
    expect(invLeft.c).toBe(0);
    expect(auditCalls.some(a => a.action === 'DELETE' && a.tableName === 'complaints')).toBe(true);
  });

  it('refuses to delete a complaint not in received status', async () => {
    seedComplaintProduct();
    const complaint = await createComplaint({
      receivedDate: '2026-06-01',
      source: 'customer',
      productId: 1,
      category: 'quality',
      severity: 'minor',
      description: 'minor issue',
    }, 1);
    // Route to QC -> status becomes under_investigation
    await routeToQC(complaint.id, 3, 1);

    await expect(deleteComplaint(complaint.id, 1)).rejects.toThrow(/received/i);
    expect(await getComplaintById(complaint.id)).not.toBeNull();
  });
});

describe('#3 deviation delete guard (DELETE route)', () => {
  function seedDeviation(status: string): number {
    return sqlite.prepare(
      `INSERT INTO deviations (deviation_number, description, status, severity, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(`DEV-${status}-${Date.now()}`, 'desc', status, 'minor', new Date().toISOString(), new Date().toISOString()).lastInsertRowid as number;
  }

  it('allows deleting an OPEN deviation; blocks a non-open one', async () => {
    const route = await import('@/app/api/quality/deviations/[id]/route');

    const openId = seedDeviation('open');
    const okRes = await route.DELETE(
      new Request('http://t/api/quality/deviations/' + openId, { method: 'DELETE' }) as never,
      { params: Promise.resolve({ id: String(openId) }) } as never,
    );
    const okJson = await (okRes as Response).json();
    expect(okJson.success).toBe(true);
    const goneRow = sqlite.prepare('SELECT COUNT(*) c FROM deviations WHERE id = ?').get(openId) as { c: number };
    expect(goneRow.c).toBe(0);

    const closedId = seedDeviation('closed');
    const blockedRes = await route.DELETE(
      new Request('http://t/api/quality/deviations/' + closedId, { method: 'DELETE' }) as never,
      { params: Promise.resolve({ id: String(closedId) }) } as never,
    );
    const blockedJson = await (blockedRes as Response).json();
    expect(blockedJson.success).toBe(false);
    expect((blockedRes as Response).status).toBe(400);
    const stillRow = sqlite.prepare('SELECT COUNT(*) c FROM deviations WHERE id = ?').get(closedId) as { c: number };
    expect(stillRow.c).toBe(1);
  });
});

// ===========================================================================
// #4 PQR real aggregation
// ===========================================================================
describe('#4 PQR real aggregation from source tables', () => {
  const PRODUCT_ID = 1;
  const PERIOD_START = '2024-01-01';
  const PERIOD_END = '2024-12-31';

  function seedPqrSourceData() {
    // product + BOM + warehouse + lot
    sqlite.prepare(
      `INSERT OR IGNORE INTO items (id, code, name_th, name_en, type, category, primary_unit, is_active)
       VALUES (?, 'FG-PQR', 'ยา PQR', 'Herb PQR', 'finished_goods', 'capsule', 'box', 1)`
    ).run(PRODUCT_ID);
    sqlite.prepare(
      `INSERT OR IGNORE INTO warehouses (id, code, name, type, is_active) VALUES (1, 'WH-FG', 'FG', 'finished_goods', 1)`
    ).run();
    const bomId = sqlite.prepare(
      `INSERT INTO bom (code, name, product_id, version, status, batch_size, batch_unit, created_at)
       VALUES ('BOM-PQR', 'BOM', ?, '1.0', 'approved', 1000, 'box', ?)`
    ).run(PRODUCT_ID, new Date().toISOString()).lastInsertRowid as number;

    // 2 completed work orders in-period (batchesProduced should be 2)
    const woId = sqlite.prepare(
      `INSERT INTO work_orders (wo_number, bom_id, product_id, batch_number, planned_quantity, unit, status, actual_end_date, yield_percentage, created_at)
       VALUES ('WO-1', ?, ?, 'B1', 1000, 'box', 'completed', '2024-06-15', 98.0, ?)`
    ).run(bomId, PRODUCT_ID, new Date().toISOString()).lastInsertRowid as number;
    sqlite.prepare(
      `INSERT INTO work_orders (wo_number, bom_id, product_id, batch_number, planned_quantity, unit, status, actual_end_date, yield_percentage, created_at)
       VALUES ('WO-2', ?, ?, 'B2', 1000, 'box', 'completed', '2024-09-15', 97.0, ?)`
    ).run(bomId, PRODUCT_ID, new Date().toISOString());
    // out-of-period WO — must NOT be counted
    sqlite.prepare(
      `INSERT INTO work_orders (wo_number, bom_id, product_id, batch_number, planned_quantity, unit, status, actual_end_date, yield_percentage, created_at)
       VALUES ('WO-OUT', ?, ?, 'B3', 1000, 'box', 'completed', '2025-03-01', 95.0, ?)`
    ).run(bomId, PRODUCT_ID, new Date().toISOString());

    // 3 deviations linked to in-period WO (deviationCount should be 3)
    const devId = sqlite.prepare(
      `INSERT INTO deviations (deviation_number, description, work_order_id, severity, status, reported_at, created_at)
       VALUES ('DEV-P1', 'd1', ?, 'minor', 'closed', '2024-03-01', ?)`
    ).run(woId, new Date().toISOString()).lastInsertRowid as number;
    sqlite.prepare(
      `INSERT INTO deviations (deviation_number, description, work_order_id, severity, status, reported_at, created_at)
       VALUES ('DEV-P2', 'd2', ?, 'major', 'closed', '2024-05-01', ?)`
    ).run(woId, new Date().toISOString());
    sqlite.prepare(
      `INSERT INTO deviations (deviation_number, description, work_order_id, severity, status, reported_at, created_at)
       VALUES ('DEV-P3', 'd3', ?, 'critical', 'investigating', '2024-07-01', ?)`
    ).run(woId, new Date().toISOString());

    // 2 CAPAs linked to the deviation (capaCount should be 2)
    sqlite.prepare(
      `INSERT INTO capa (capa_number, title, source_type, deviation_id, type, status, due_date, closed_date, created_at)
       VALUES ('CAPA-P1', 'c1', 'deviation', ?, 'corrective', 'closed', '2024-06-01', '2024-05-20', '2024-04-01')`
    ).run(devId);
    sqlite.prepare(
      `INSERT INTO capa (capa_number, title, source_type, deviation_id, type, status, due_date, created_at)
       VALUES ('CAPA-P2', 'c2', 'deviation', ?, 'preventive', 'in_progress', '2024-12-01', '2024-06-01')`
    ).run(devId);

    // 4 complaints for product (complaintCount should be 4)
    for (let i = 1; i <= 4; i++) {
      sqlite.prepare(
        `INSERT INTO complaints (complaint_number, received_date, source, description, product_id, category, severity, status, created_at)
         VALUES (?, ?, 'customer', 'c', ?, 'quality', 'minor', 'closed', ?)`
      ).run(`COMP-P${i}`, '2024-04-1' + i, PRODUCT_ID, new Date().toISOString());
    }
    // out-of-period complaint — not counted
    sqlite.prepare(
      `INSERT INTO complaints (complaint_number, received_date, source, description, product_id, category, severity, status, created_at)
       VALUES ('COMP-OUT', '2025-01-15', 'customer', 'c', ?, 'quality', 'minor', 'closed', ?)`
    ).run(PRODUCT_ID, new Date().toISOString());

    // OOS quality tests on product lot (oosCount should be 1 fail of 2)
    const lotId = sqlite.prepare(
      `INSERT INTO inventory_lots (lot_number, item_id, warehouse_id, quantity, unit, manufacturing_date, created_at)
       VALUES ('LOT-P', ?, 1, 1000, 'box', '2024-02-01', ?)`
    ).run(PRODUCT_ID, new Date().toISOString()).lastInsertRowid as number;
    sqlite.prepare(
      `INSERT INTO quality_tests (lot_id, test_type, status, test_date, created_at) VALUES (?, 'assay', 'pass', '2024-03-05', ?)`
    ).run(lotId, new Date().toISOString());
    sqlite.prepare(
      `INSERT INTO quality_tests (lot_id, test_type, status, test_date, created_at) VALUES (?, 'assay', 'fail', '2024-03-06', ?)`
    ).run(lotId, new Date().toISOString());
  }

  it('aggregatePqrCounts returns real counts (not zero) within the period', async () => {
    seedPqrSourceData();
    const agg = await aggregatePqrCounts(PRODUCT_ID, PERIOD_START, PERIOD_END);
    expect(agg).not.toBeNull();
    expect(agg!.batchesProduced).toBe(2);   // out-of-period WO excluded
    expect(agg!.deviationCount).toBe(3);
    expect(agg!.capaCount).toBe(2);
    expect(agg!.complaintCount).toBe(4);     // out-of-period complaint excluded
    expect(agg!.oosCount).toBe(1);
  });

  it('aggregatePqrCounts returns null when productId/period missing', async () => {
    expect(await aggregatePqrCounts(null, PERIOD_START, PERIOD_END)).toBeNull();
    expect(await aggregatePqrCounts(PRODUCT_ID, null, PERIOD_END)).toBeNull();
    expect(await aggregatePqrCounts(PRODUCT_ID, PERIOD_START, null)).toBeNull();
  });

  it('createPqrReport stores aggregated counts and ignores bogus client input', async () => {
    seedPqrSourceData();
    const pqr = await createPqrReport({
      productId: PRODUCT_ID,
      reviewYear: 2024,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      // bogus client values that must be overridden by aggregation
      batchesProduced: 999,
      deviationCount: 999,
      capaCount: 999,
      complaintCount: 999,
      oosCount: 999,
    }, 1);

    expect(pqr.batchesProduced).toBe(2);
    expect(pqr.deviationCount).toBe(3);
    expect(pqr.capaCount).toBe(2);
    expect(pqr.complaintCount).toBe(4);
    expect(pqr.oosCount).toBe(1);
  });
});
