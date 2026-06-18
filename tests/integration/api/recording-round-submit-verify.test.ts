/**
 * IPC Recording Round — submit (quality_tests sync) + verify (Triple Independence)
 *
 * Verifies two CRITICAL Production-domain fixes end-to-end against real SQLite:
 *
 *  #1  POST /api/recording/rounds/[id]/submit
 *      - Computes pass/fail server-side from the criteria spec (multi_point).
 *      - syncQualityTest() pushes that result back onto the WO-linked
 *        quality_tests row (status -> pass/fail), so the Execution Dashboard
 *        IPC progress + Production Output gate can reach 100%.
 *      - Bind-mismatch guard: every nullable column written as null, never
 *        undefined. We assert the UPDATE persisted and no column is undefined.
 *
 *  #2  POST /api/recording/rounds/[id]/verify  (Triple Independence)
 *      - verifier == submitter  -> 403 (and DB untouched)
 *      - verifier == starter    -> 403
 *      - verifier != both       -> 200, verifiedById set, verifiedAt set
 *      - pre-conditions: not-submitted 409, already-verified 409
 *
 * Real in-memory SQLite + Drizzle schema sync. Mocks limited to:
 *  - @/lib/db          (inject in-memory db)
 *  - @/lib/audit       (no-op createAuditLog)
 *  - @/lib/api-utils   (bypass withAuth; inject session per-call)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@/lib/db/schema';
import { generateCreateTableSql } from '../../helpers/schema-sync';

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
  getClientIP: vi.fn(() => '127.0.0.1'),
}));

// withAuth: inject a session whose userId we control per-call via a module var.
let CURRENT_USER_ID = 1;
vi.mock('@/lib/api-utils', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-utils')>('@/lib/api-utils');
  return {
    ...actual,
    withAuth: (
      _req: Request,
      handler: (s: { userId: number; role: string }) => Promise<Response>,
    ) => handler({ userId: CURRENT_USER_ID, role: 'admin' }),
  };
});

import { POST as submitPost } from '@/app/api/recording/rounds/[id]/submit/route';
import { POST as verifyPost } from '@/app/api/recording/rounds/[id]/verify/route';

function runSql(sql: string): void {
  sqlite.prepare(sql).run();
}

function callSubmit(roundId: number, userId: number) {
  CURRENT_USER_ID = userId;
  const req = new Request(`http://localhost/api/recording/rounds/${roundId}/submit`, {
    method: 'POST',
  });
  return submitPost(req as Parameters<typeof submitPost>[0], {
    params: Promise.resolve({ id: String(roundId) }),
  });
}

function callVerify(roundId: number, userId: number) {
  CURRENT_USER_ID = userId;
  const req = new Request(`http://localhost/api/recording/rounds/${roundId}/verify`, {
    method: 'POST',
  });
  return verifyPost(req as Parameters<typeof verifyPost>[0], {
    params: Promise.resolve({ id: String(roundId) }),
  });
}

// ── Seed helpers ───────────────────────────────────────────────────

const OPERATOR = 10; // started + submitted the round
const VERIFIER = 20; // second qualified person

interface SeedCtx {
  criteriaId: number;
  qtId: number;
  lotId: number;
  batchNumber: string;
}

/**
 * multi_point criteria, target 0.5 ± 10% (per-point 0.45..0.55), all_pass.
 * A quality_tests in_process row linked via ipcCriteriaId + lot.batchNumber.
 */
function seedMultiPoint(opts: { points: number[]; status?: string }): SeedCtx {
  const now = new Date().toISOString();
  const batchNumber = 'BATCH-IPC-01';

  // user rows (operator, verifier)
  runSql(
    `INSERT INTO users (id, email, password, name, role, is_active, created_at, updated_at)
     VALUES (${OPERATOR}, 'op@erp.local', 'x', 'Operator', 'operator', 1, '${now}', '${now}')`,
  );
  runSql(
    `INSERT INTO users (id, email, password, name, role, is_active, created_at, updated_at)
     VALUES (${VERIFIER}, 'qa@erp.local', 'x', 'Verifier', 'qa', 1, '${now}', '${now}')`,
  );

  // item + warehouse + lot carrying the batch number
  runSql(
    `INSERT INTO items (id, code, name_th, type, primary_unit, is_active, created_at, updated_at)
     VALUES (1, 'PROD-A', 'ผลิตภัณฑ์ A', 'finished_good', 'tablet', 1, '${now}', '${now}')`,
  );
  runSql(
    `INSERT INTO warehouses (id, code, name, type, is_active, created_at, updated_at)
     VALUES (1, 'WH-1', 'Main', 'finished_good', 1, '${now}', '${now}')`,
  );
  runSql(
    `INSERT INTO inventory_lots (id, item_id, lot_number, batch_number, warehouse_id, quantity, unit, status, created_at, updated_at)
     VALUES (1, 1, 'LOT-1', '${batchNumber}', 1, 100, 'tablet', 'under_test', '${now}', '${now}')`,
  );

  const spec = JSON.stringify({
    type: 'multi_point',
    pointCount: '4',
    pointLabel: 'หัวตอก',
    perPointTarget: '0.5',
    perPointTolerance: '10',
    aggregateRule: 'all_pass',
    aggregateLimit: '',
    tareSourceCode: '',
  });
  runSql(
    `INSERT INTO ipc_criteria (id, code, name, specification, criteria_type, sample_size, check_interval_minutes, is_critical, is_active, tolerance_percent, spec_tolerance_percent, max_retest_rounds, created_at)
     VALUES (1, 'IPC-WT', 'Tablet Weight', '${spec}', 'multi_point', 4, 30, 0, 1, 0, 0, 1, '${now}')`,
  );
  const criteriaId = 1;

  // quality_tests in_process row linked to the criteria + lot's batch.
  const status = opts.status ?? 'pending';
  runSql(
    `INSERT INTO quality_tests (id, lot_id, ipc_criteria_id, test_type, status, criteria_type, created_at, updated_at)
     VALUES (1, 1, ${criteriaId}, 'in_process', '${status}', 'multi_point', '${now}', '${now}')`,
  );
  const qtId = 1;

  // recording round — started by OPERATOR, not yet submitted.
  const data = JSON.stringify({ points: opts.points.map(String) });
  runSql(
    `INSERT INTO ipc_recording_rounds (id, criteria_id, batch_number, round_number, data, started_at, started_by_id)
     VALUES (1, ${criteriaId}, '${batchNumber}', 1, '${data.replace(/'/g, "''")}', '${now}', ${OPERATOR})`,
  );

  return { criteriaId, qtId, lotId: 1, batchNumber };
}

// ── DB lifecycle ───────────────────────────────────────────────────

beforeAll(() => {
  sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  testDb = drizzle(sqlite, { schema });

  const tables = [
    schema.sqliteUsers,
    schema.sqliteWarehouses,
    schema.sqliteItems,
    schema.sqliteInventoryLots,
    schema.sqliteIPCCriteria,
    schema.sqliteIPCRecordingRounds,
    schema.sqliteQualityTests,
  ];
  for (const t of tables) {
    try {
      runSql(generateCreateTableSql(t));
    } catch (e) {
      console.warn('Table create note:', (e as Error).message);
    }
  }
});

afterAll(() => {
  sqlite?.close();
});

beforeEach(() => {
  for (const tableName of [
    'ipc_recording_rounds',
    'quality_tests',
    'ipc_criteria',
    'inventory_lots',
    'items',
    'warehouses',
    'users',
  ]) {
    try {
      runSql(`DELETE FROM ${tableName}`);
      runSql(`DELETE FROM sqlite_sequence WHERE name='${tableName}'`);
    } catch {
      /* table may not exist */
    }
  }
});

// ── #1  submit -> quality_tests sync ──────────────────────────────

describe('POST /recording/rounds/:id/submit — multi_point pass syncs quality_tests', () => {
  it('all points in range -> round passed=1 + quality_tests.status=pass', async () => {
    const ctx = seedMultiPoint({ points: [0.5, 0.49, 0.51, 0.5] }); // all within 0.45..0.55

    const res = await callSubmit(1, OPERATOR);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    // Round locked + computed
    const round = sqlite
      .prepare('SELECT submitted_by_id, passed, computed_mean, outcome_note FROM ipc_recording_rounds WHERE id=1')
      .get() as { submitted_by_id: number; passed: number; computed_mean: number; outcome_note: string };
    expect(round.submitted_by_id).toBe(OPERATOR);
    expect(round.passed).toBe(1);
    expect(round.computed_mean).toBeCloseTo(0.5, 4);

    // quality_tests synced to pass
    const qt = sqlite
      .prepare('SELECT status, result, numeric_result, tested_by FROM quality_tests WHERE id=1')
      .get() as { status: string; result: string; numeric_result: number; tested_by: number };
    expect(qt.status).toBe('pass');
    expect(qt.result).toBe('pass');
    expect(qt.numeric_result).toBeCloseTo(0.5, 4);
    expect(qt.tested_by).toBe(OPERATOR);
  });

  it('a point out of range -> round passed=0 + quality_tests.status=fail', async () => {
    seedMultiPoint({ points: [0.5, 0.49, 0.7, 0.5] }); // 0.7 > 0.55 -> fail

    const res = await callSubmit(1, OPERATOR);
    expect(res.status).toBe(200);

    const round = sqlite.prepare('SELECT passed FROM ipc_recording_rounds WHERE id=1').get() as { passed: number };
    expect(round.passed).toBe(0);

    const qt = sqlite.prepare('SELECT status, result FROM quality_tests WHERE id=1').get() as {
      status: string;
      result: string;
    };
    expect(qt.status).toBe('fail');
    expect(qt.result).toBe('fail');
  });

  it('bind-mismatch guard: synced quality_tests row has no undefined-derived nulls left dirty', async () => {
    seedMultiPoint({ points: [0.5, 0.5, 0.5, 0.5] });
    const res = await callSubmit(1, OPERATOR);
    expect(res.status).toBe(200);

    // If any nullable was bound as `undefined`, better-sqlite3 throws
    // "Too few parameter values were provided" and the update never lands.
    // Reaching here with status=pass proves the bind count stayed stable.
    const qt = sqlite
      .prepare('SELECT status, numeric_result, tested_by, test_date, updated_at FROM quality_tests WHERE id=1')
      .get() as Record<string, unknown>;
    expect(qt.status).toBe('pass');
    expect(qt.test_date).not.toBeNull();
    expect(qt.updated_at).not.toBeNull();
  });

  it('incomplete round (fewer points than pointCount) -> passed null, quality_tests NOT overwritten', async () => {
    seedMultiPoint({ points: [0.5, 0.5], status: 'pending' }); // only 2 of 4 points

    const res = await callSubmit(1, OPERATOR);
    expect(res.status).toBe(200);

    const round = sqlite.prepare('SELECT passed, outcome_note FROM ipc_recording_rounds WHERE id=1').get() as {
      passed: number | null;
      outcome_note: string;
    };
    expect(round.passed).toBeNull();
    expect(round.outcome_note).toMatch(/incomplete/);

    // syncQualityTest returns early on null outcome -> quality_tests stays pending
    const qt = sqlite.prepare('SELECT status FROM quality_tests WHERE id=1').get() as { status: string };
    expect(qt.status).toBe('pending');
  });

  it('double submit -> second call 409 (round already submitted)', async () => {
    seedMultiPoint({ points: [0.5, 0.5, 0.5, 0.5] });
    const first = await callSubmit(1, OPERATOR);
    expect(first.status).toBe(200);
    const second = await callSubmit(1, OPERATOR);
    expect(second.status).toBe(409);
  });
});

// ── #2  verify — Triple Independence ──────────────────────────────

describe('POST /recording/rounds/:id/verify — Triple Independence', () => {
  async function submitFirst() {
    seedMultiPoint({ points: [0.5, 0.5, 0.5, 0.5] });
    const r = await callSubmit(1, OPERATOR); // submittedById = OPERATOR
    expect(r.status).toBe(200);
  }

  it('403 when verifier == submitter', async () => {
    await submitFirst();
    const res = await callVerify(1, OPERATOR);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/Triple Independence|คนละคน/);

    // DB untouched
    const round = sqlite.prepare('SELECT verified_by_id, verified_at FROM ipc_recording_rounds WHERE id=1').get() as {
      verified_by_id: number | null;
      verified_at: string | null;
    };
    expect(round.verified_by_id).toBeNull();
    expect(round.verified_at).toBeNull();
  });

  it('403 when verifier == starter (different from submitter not relevant — both OPERATOR here)', async () => {
    // starter is OPERATOR; even if a 3rd user submitted, starter must not verify.
    // Simulate: operator started, but verifier(=VERIFIER) submitted, then OPERATOR tries to verify.
    seedMultiPoint({ points: [0.5, 0.5, 0.5, 0.5] });
    const r = await callSubmit(1, VERIFIER); // submittedById = VERIFIER, startedById = OPERATOR
    expect(r.status).toBe(200);

    const res = await callVerify(1, OPERATOR); // OPERATOR is the starter
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/เริ่มบันทึก|Triple Independence/);
  });

  it('200 when verifier is a different person -> verifiedById + verifiedAt set', async () => {
    await submitFirst(); // submitted + started by OPERATOR
    const res = await callVerify(1, VERIFIER);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    const round = sqlite.prepare('SELECT verified_by_id, verified_at FROM ipc_recording_rounds WHERE id=1').get() as {
      verified_by_id: number;
      verified_at: string | null;
    };
    expect(round.verified_by_id).toBe(VERIFIER);
    expect(round.verified_at).not.toBeNull();
  });

  it('409 when round not yet submitted', async () => {
    seedMultiPoint({ points: [0.5, 0.5, 0.5, 0.5] }); // no submit
    const res = await callVerify(1, VERIFIER);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/not submitted/i);
  });

  it('409 when already verified', async () => {
    await submitFirst();
    const ok = await callVerify(1, VERIFIER);
    expect(ok.status).toBe(200);
    const again = await callVerify(1, VERIFIER);
    expect(again.status).toBe(409);
    const body = await again.json();
    expect(body.error).toMatch(/already verified/i);
  });
});
