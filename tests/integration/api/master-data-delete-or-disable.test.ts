/**
 * Master Data DELETE → deleteOrDisableById policy — REAL SQLite integration.
 *
 * Verifies the fix: master-data DELETE routes must
 *   - REAL-DELETE a record that is NOT referenced  → mode='deleted'
 *   - SOFT-DISABLE (isActive=false) a record that IS referenced via FK
 *     → mode='disabled' (row still present, isActive=0)
 *
 * Routes covered (real handlers, real db-helper, real dbOperations):
 *   - production-rooms  (uses dbOperations.deleteOrDisableById)
 *   - ipc-criteria      (uses route-local try/auditedDelete/catch FK → updateById)
 *
 * Approach: a real in-memory better-sqlite3 DB wired into @/lib/db. The master
 * tables are created from the real Drizzle schema (so column shapes match the
 * table objects the routes use), plus a child table with a genuine FOREIGN KEY
 * so SQLite raises SQLITE_CONSTRAINT_FOREIGNKEY on a referenced delete.
 *
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@/lib/db/schema';

// ── Real SQLite DB ─────────────────────────────────────────────────────────
const sqlite = new Database(':memory:');
sqlite.pragma('foreign_keys = ON');
const realDb = drizzle(sqlite, { schema });

// Wire @/lib/db so the (unmocked) db-helper runs against our real DB.
vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return {
    ...actual,
    isSqlite: () => true,
    getDb: async () => realDb,
    getSqliteDb: () => realDb,
    schema,
  };
});

// Auth: always an authenticated admin.
vi.mock('@/lib/auth', () => ({
  getSession: async () => ({ userId: 1, role: 'admin' }),
  isAdminRole: (role: string) => role === 'admin',
}));
vi.mock('@/lib/auth/permission-resolver', () => ({
  getRolePermissionSet: async () => new Set<string>(['*']),
}));

// withAuth in api-utils calls getSession; keep real api-utils but it depends on
// @/lib/auth which we've mocked. Nothing else to stub there.

// ipc-criteria route audits via audit-wrapper. Make auditedDelete perform a
// REAL delete (so a referenced row throws FK and the route's own fallback runs)
// and make insert/update real-but-silent so seeding/disable still hit the DB.
vi.mock('@/lib/db/audit-wrapper', async () => {
  const helper = await import('@/lib/db/db-helper');
  return {
    auditedDelete: async ({ table, id }: { table: string; id: number }) => {
      // Real delete — throws SQLITE_CONSTRAINT_FOREIGNKEY when referenced.
      await helper.dbOperations.deleteById(table, id);
    },
    auditedUpdate: async ({ table, id, data }: { table: string; id: number; data: Record<string, unknown> }) => {
      await helper.dbOperations.updateById(table, id, data);
    },
    auditedInsert: async () => 0,
    getClientIP: () => '127.0.0.1',
  };
});

import { DELETE as DEL_ROOM } from '@/app/api/master-data/production-rooms/route';
import { DELETE as DEL_IPC } from '@/app/api/master-data/ipc-criteria/route';

const delReq = (path: string) => new NextRequest(`http://localhost${path}`, { method: 'DELETE' });

beforeAll(() => {
  // Master tables from real Drizzle schema column shape.
  sqlite.exec(`
    CREATE TABLE production_rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT,
      name_th TEXT NOT NULL,
      room_type TEXT NOT NULL,
      description TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE ipc_criteria (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      name_th TEXT,
      test_method TEXT,
      specification TEXT,
      min_value REAL,
      max_value REAL,
      unit TEXT,
      sample_size INTEGER NOT NULL DEFAULT 5,
      check_interval_minutes INTEGER NOT NULL DEFAULT 30,
      is_critical INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      dosage_form TEXT,
      criteria_type TEXT NOT NULL DEFAULT 'numeric',
      tare_source_criteria_id INTEGER,
      tolerance_percent REAL NOT NULL DEFAULT 0,
      spec_target REAL,
      spec_tolerance_percent REAL NOT NULL DEFAULT 0,
      acceptance_stages TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    -- Child tables with genuine FKs (stand-ins for BOM / schedules).
    CREATE TABLE room_consumers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER NOT NULL REFERENCES production_rooms(id)
    );
    CREATE TABLE bom_ipc_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ipc_id INTEGER NOT NULL REFERENCES ipc_criteria(id)
    );
  `);
});

afterAll(() => {
  sqlite.close();
});

function seedRoom(code: string): number {
  const r = sqlite
    .prepare(`INSERT INTO production_rooms (code, name_th, room_type) VALUES (?, 'ห้องผสม', 'mixing')`)
    .run(code);
  return Number(r.lastInsertRowid);
}
function seedIpc(code: string): number {
  const r = sqlite
    .prepare(`INSERT INTO ipc_criteria (code, name, criteria_type) VALUES (?, 'Weight check', 'numeric')`)
    .run(code);
  return Number(r.lastInsertRowid);
}
const rowRoom = (id: number) =>
  sqlite.prepare(`SELECT id, is_active FROM production_rooms WHERE id = ?`).get(id) as
    | { id: number; is_active: number }
    | undefined;
const rowIpc = (id: number) =>
  sqlite.prepare(`SELECT id, is_active FROM ipc_criteria WHERE id = ?`).get(id) as
    | { id: number; is_active: number }
    | undefined;

beforeEach(() => {
  sqlite.exec('DELETE FROM room_consumers; DELETE FROM bom_ipc_lines;');
});

describe('production-rooms DELETE → deleteOrDisableById', () => {
  it('REAL-DELETEs a room never referenced → mode=deleted, row gone', async () => {
    const id = seedRoom('ROOM-DEL-1');
    expect(rowRoom(id)).toBeTruthy();

    const res = await DEL_ROOM(delReq(`/api/master-data/production-rooms?id=${id}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.mode).toBe('deleted');

    // DB truth: row removed.
    expect(rowRoom(id)).toBeUndefined();
  });

  it('SOFT-DISABLEs a room referenced by FK → mode=disabled, isActive=0, row kept', async () => {
    const id = seedRoom('ROOM-DEL-2');
    sqlite.prepare(`INSERT INTO room_consumers (room_id) VALUES (?)`).run(id);

    const res = await DEL_ROOM(delReq(`/api/master-data/production-rooms?id=${id}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.mode).toBe('disabled');

    // DB truth: row still present and disabled.
    const row = rowRoom(id);
    expect(row).toBeTruthy();
    expect(row!.is_active).toBe(0);
  });
});

describe('ipc-criteria DELETE → deleteOrDisableById', () => {
  it('REAL-DELETEs an IPC criteria never referenced → mode=deleted, row gone', async () => {
    const id = seedIpc('IPC-DEL-1');
    expect(rowIpc(id)).toBeTruthy();

    const res = await DEL_IPC(delReq(`/api/master-data/ipc-criteria?id=${id}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.mode).toBe('deleted');

    expect(rowIpc(id)).toBeUndefined();
  });

  it('SOFT-DISABLEs an IPC criteria referenced in BOM → mode=disabled, isActive=0, row kept', async () => {
    const id = seedIpc('IPC-DEL-2');
    sqlite.prepare(`INSERT INTO bom_ipc_lines (ipc_id) VALUES (?)`).run(id);

    const res = await DEL_IPC(delReq(`/api/master-data/ipc-criteria?id=${id}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.mode).toBe('disabled');

    const row = rowIpc(id);
    expect(row).toBeTruthy();
    expect(row!.is_active).toBe(0);
  });
});
