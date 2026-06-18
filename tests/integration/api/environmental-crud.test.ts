/**
 * F023 CRUD endpoints (PUT + DELETE) integration tests
 *
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockSession = vi.fn();
vi.mock('@/lib/auth', () => ({
  getSession: () => mockSession(),
  isAdminRole: (role: string) => role === 'admin',
}));

const mockGetPerms = vi.fn();
vi.mock('@/lib/auth/permission-resolver', () => ({
  getRolePermissionSet: (role: string) => mockGetPerms(role),
}));

// Capture mutations sent to db
const dbCalls = {
  updates: [] as Array<{ table: string; patch: Record<string, unknown> }>,
  // Records deleteOrDisableById invocations (maintenance-plan DELETE migrated
  // to this helper); default mode is 'disabled' (soft-delete) for the existing
  // assertions, overridable per-test.
  deleteOrDisable: [] as Array<{ table: string; id: number; patch: Record<string, unknown> }>,
};
let deleteOrDisableMode: 'deleted' | 'disabled' = 'disabled';

vi.mock('@/lib/db/db-helper', () => ({
  getTableRef: (n: string) => ({ __table: n }),
  isSqlite: () => true,
  executeDbOperation: async (op: (db: unknown) => unknown) =>
    op({
      update(_tbl: { __table: string }) {
        return {
          set(patch: Record<string, unknown>) {
            return {
              where(_w: unknown) {
                dbCalls.updates.push({ table: _tbl.__table, patch });
                return Promise.resolve({ changes: 1 });
              },
            };
          },
        };
      },
    }),
  dbOperations: {
    deleteOrDisableById: async (
      table: string,
      id: number,
      patch: Record<string, unknown> = {},
    ) => {
      dbCalls.deleteOrDisable.push({ table, id, patch });
      return { mode: deleteOrDisableMode };
    },
  },
}));

vi.mock('@/lib/db/date-utils', () => ({
  getNow: () => '2026-06-03T00:00:00.000Z',
}));

import { PUT as PUT_SYS, DELETE as DEL_SYS } from '@/app/api/environmental/water-systems/[id]/route';
import { PUT as PUT_PT, DELETE as DEL_PT } from '@/app/api/environmental/sample-points/[id]/route';
import { PUT as PUT_SPEC, DELETE as DEL_SPEC } from '@/app/api/environmental/water-specs/[id]/route';
import { PUT as PUT_TMPL, DELETE as DEL_TMPL } from '@/app/api/environmental/templates/[id]/route';
import { PUT as PUT_SCHED, DELETE as DEL_SCHED } from '@/app/api/environmental/schedules/[id]/route';
import {
  PUT as PUT_MP_TMPL,
  DELETE as DEL_MP_TMPL,
} from '@/app/api/master-data/maintenance-plan-templates/[id]/route';

const params1 = { params: Promise.resolve({ id: '1' }) };
const reqOf = (path: string, body: unknown, method = 'PUT') =>
  new NextRequest(`http://localhost${path}`, {
    method,
    body: JSON.stringify(body),
  });

describe('F023 CRUD — Water System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbCalls.updates = [];
    dbCalls.deleteOrDisable = [];
    deleteOrDisableMode = 'disabled';
    mockSession.mockResolvedValue({ userId: 1, role: 'admin' });
    mockGetPerms.mockResolvedValue(new Set(['environmental:configure']));
  });

  it('PUT 401 unauthenticated', async () => {
    mockSession.mockResolvedValue(null);
    const res = await PUT_SYS(reqOf('/api/environmental/water-systems/1', { name: 'x' }), params1);
    expect(res.status).toBe(401);
  });

  it('PUT 403 no permission', async () => {
    mockSession.mockResolvedValue({ userId: 5, role: 'qc' });
    mockGetPerms.mockResolvedValue(new Set());
    const res = await PUT_SYS(reqOf('/api/environmental/water-systems/1', { name: 'x' }), params1);
    expect(res.status).toBe(403);
  });

  it('PUT updates fields', async () => {
    const res = await PUT_SYS(
      reqOf('/api/environmental/water-systems/1', { name: 'New name', isActive: false }),
      params1,
    );
    expect(res.status).toBe(200);
    expect(dbCalls.updates.length).toBe(1);
    expect(dbCalls.updates[0].patch.name).toBe('New name');
    expect(dbCalls.updates[0].patch.isActive).toBe(false);
  });

  it('DELETE soft-deletes via isActive=false', async () => {
    const res = await DEL_SYS(reqOf('/api/environmental/water-systems/1', null, 'DELETE'), params1);
    expect(res.status).toBe(200);
    expect(dbCalls.updates[0].patch.isActive).toBe(false);
  });

  it('DELETE 401 unauthenticated', async () => {
    mockSession.mockResolvedValue(null);
    const res = await DEL_SYS(reqOf('/api/environmental/water-systems/1', null, 'DELETE'), params1);
    expect(res.status).toBe(401);
  });
});

describe('F023 CRUD — Sample Point', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbCalls.updates = [];
    dbCalls.deleteOrDisable = [];
    deleteOrDisableMode = 'disabled';
    mockSession.mockResolvedValue({ userId: 1, role: 'admin' });
  });

  it('PUT updates name', async () => {
    const res = await PUT_PT(
      reqOf('/api/environmental/sample-points/1', { name: 'Updated point' }),
      params1,
    );
    expect(res.status).toBe(200);
    expect(dbCalls.updates[0].patch.name).toBe('Updated point');
  });

  it('DELETE soft-deletes', async () => {
    const res = await DEL_PT(reqOf('/api/environmental/sample-points/1', null, 'DELETE'), params1);
    expect(res.status).toBe(200);
    expect(dbCalls.updates[0].patch.isActive).toBe(false);
  });
});

describe('F023 CRUD — Water Spec', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbCalls.updates = [];
    dbCalls.deleteOrDisable = [];
    deleteOrDisableMode = 'disabled';
    mockSession.mockResolvedValue({ userId: 1, role: 'admin' });
  });

  it('PUT updates spec range', async () => {
    const res = await PUT_SPEC(
      reqOf('/api/environmental/water-specs/1', { specMin: 5.0, specMax: 7.0 }),
      params1,
    );
    expect(res.status).toBe(200);
    expect(dbCalls.updates[0].patch.specMin).toBe(5.0);
    expect(dbCalls.updates[0].patch.specMax).toBe(7.0);
  });

  it('PUT can null out spec bounds', async () => {
    const res = await PUT_SPEC(
      reqOf('/api/environmental/water-specs/1', { specMin: null }),
      params1,
    );
    expect(res.status).toBe(200);
    expect(dbCalls.updates[0].patch.specMin).toBe(null);
  });

  it('DELETE soft-deletes', async () => {
    const res = await DEL_SPEC(reqOf('/api/environmental/water-specs/1', null, 'DELETE'), params1);
    expect(res.status).toBe(200);
    expect(dbCalls.updates[0].patch.isActive).toBe(false);
  });
});

describe('F023 CRUD — Inspection Template', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbCalls.updates = [];
    dbCalls.deleteOrDisable = [];
    deleteOrDisableMode = 'disabled';
    mockSession.mockResolvedValue({ userId: 1, role: 'admin' });
  });

  it('PUT updates template items as JSON', async () => {
    const items = [{ label: 'a', parameter: 'p', isMandatory: true, sortOrder: 1 }];
    const res = await PUT_TMPL(
      reqOf('/api/environmental/templates/1', { items }),
      params1,
    );
    expect(res.status).toBe(200);
    expect(dbCalls.updates[0].patch.itemsJson).toBe(JSON.stringify(items));
  });

  it('DELETE soft-deletes', async () => {
    const res = await DEL_TMPL(reqOf('/api/environmental/templates/1', null, 'DELETE'), params1);
    expect(res.status).toBe(200);
    expect(dbCalls.updates[0].patch.isActive).toBe(false);
  });
});

describe('F023 CRUD — Inspection Schedule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbCalls.updates = [];
    dbCalls.deleteOrDisable = [];
    deleteOrDisableMode = 'disabled';
    mockSession.mockResolvedValue({ userId: 1, role: 'admin' });
  });

  it('PUT updates frequency', async () => {
    const res = await PUT_SCHED(
      reqOf('/api/environmental/schedules/1', { frequency: 'weekly', alertDaysBefore: 3 }),
      params1,
    );
    expect(res.status).toBe(200);
    expect(dbCalls.updates[0].patch.frequency).toBe('weekly');
    expect(dbCalls.updates[0].patch.alertDaysBefore).toBe(3);
  });

  it('DELETE soft-deletes', async () => {
    const res = await DEL_SCHED(reqOf('/api/environmental/schedules/1', null, 'DELETE'), params1);
    expect(res.status).toBe(200);
    expect(dbCalls.updates[0].patch.isActive).toBe(false);
  });
});

describe('F022 CRUD — Maintenance Plan Template', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbCalls.updates = [];
    dbCalls.deleteOrDisable = [];
    deleteOrDisableMode = 'disabled';
    mockSession.mockResolvedValue({ userId: 1, role: 'admin' });
    mockGetPerms.mockResolvedValue(new Set(['equipment:notifications:configure']));
  });

  it('PUT updates template', async () => {
    const res = await PUT_MP_TMPL(
      reqOf('/api/master-data/maintenance-plan-templates/1', {
        name: 'Updated',
        intervalValue: 6,
        alertDaysBefore: 7,
      }),
      params1,
    );
    expect(res.status).toBe(200);
    expect(dbCalls.updates[0].patch.name).toBe('Updated');
    expect(dbCalls.updates[0].patch.intervalValue).toBe(6);
  });

  it('DELETE soft-deletes (disabled when in use)', async () => {
    deleteOrDisableMode = 'disabled';
    const res = await DEL_MP_TMPL(
      reqOf('/api/master-data/maintenance-plan-templates/1', null, 'DELETE'),
      params1,
    );
    expect(res.status).toBe(200);
    // Route migrated to deleteOrDisableById: an in-use template is soft-disabled.
    expect(dbCalls.deleteOrDisable.length).toBe(1);
    expect(dbCalls.deleteOrDisable[0].table).toBe('maintenancePlanTemplates');
    const body = await res.json();
    expect(body.mode).toBe('disabled');
  });

  it('DELETE removes an unused template (deleted)', async () => {
    deleteOrDisableMode = 'deleted';
    const res = await DEL_MP_TMPL(
      reqOf('/api/master-data/maintenance-plan-templates/2', null, 'DELETE'),
      { params: Promise.resolve({ id: '2' }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mode).toBe('deleted');
  });

  it('PUT 403 no permission', async () => {
    mockSession.mockResolvedValue({ userId: 5, role: 'qc' });
    mockGetPerms.mockResolvedValue(new Set());
    const res = await PUT_MP_TMPL(
      reqOf('/api/master-data/maintenance-plan-templates/1', { name: 'x' }),
      params1,
    );
    expect(res.status).toBe(403);
  });
});
