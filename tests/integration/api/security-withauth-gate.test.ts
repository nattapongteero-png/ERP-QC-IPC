/**
 * SECURITY — withAuth permission gate (integration, route-handler level)
 *
 * Verifies the requiredPermissions gate added to mutation routes blocks
 * low-privilege roles (warehouse/qc) with HTTP 403 while admins pass.
 *
 * Targets:
 *  - POST   /api/users                          (users:write)
 *  - PUT    /api/users/[id]                      (users:write)
 *  - DELETE /api/users/[id]                      (users:delete)
 *  - POST   /api/settings/approval-flows        (settings:write)
 *  - POST   /api/settings/matching-tolerances   (settings:write)
 *
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// --- Session + permission resolver mocks -----------------------------------
const mockSession = vi.fn();
const mockGetPerms = vi.fn();

// withAuth imports { getSession, hasPermission, isAdminRole, Role, Permission }
// from '@/lib/auth'. We keep the REAL hasPermission/isAdminRole (so the static
// PERMISSIONS allow-list is exercised) and only stub getSession.
vi.mock('@/lib/auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth')>('@/lib/auth');
  return {
    ...actual,
    getSession: () => mockSession(),
    // hashPassword is used by the user routes; keep real implementation.
  };
});

vi.mock('@/lib/auth/permission-resolver', () => ({
  getRolePermissionSet: (role: string) => mockGetPerms(role),
}));

// Prevent the handler bodies (which only run when authorized) from touching a
// real DB during the admin "pass" assertions — we only need to confirm the
// gate lets the request reach the handler (status != 403). We assert 403 for
// blocked cases, and "not 403" for the admin case.
const mockExecuteDbOperation = vi.fn();
vi.mock('@/lib/db/db-helper', async () => {
  const actual = await vi.importActual<typeof import('@/lib/db/db-helper')>(
    '@/lib/db/db-helper',
  );
  return {
    ...actual,
    executeDbOperation: (op: (db: unknown) => unknown) => mockExecuteDbOperation(op),
    getInsertId: () => 999,
    dbDate: () => new Date(),
  };
});

vi.mock('@/lib/audit', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  getClientIP: () => '127.0.0.1',
}));

// Services behind the settings routes — stub so an authorized request resolves
// without a DB.
vi.mock('@/lib/services/approval-workflow.service', () => ({
  createApprovalFlow: vi.fn().mockResolvedValue(123),
  listApprovalFlows: vi.fn().mockResolvedValue({ data: [], total: 0 }),
}));
vi.mock('@/lib/services/matching.service', () => ({
  createTolerance: vi.fn().mockResolvedValue(456),
  listTolerances: vi.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 }),
}));

import { POST as usersPost } from '@/app/api/users/route';
import { PUT as usersPut, DELETE as usersDelete } from '@/app/api/users/[id]/route';
import { POST as approvalFlowsPost } from '@/app/api/settings/approval-flows/route';
import { POST as tolerancesPost } from '@/app/api/settings/matching-tolerances/route';

const LOW_PRIV_ROLES = ['warehouse', 'qc'];

function makeReq(url: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

const idParams = { params: Promise.resolve({ id: '5' }) };

async function status(res: Response) {
  return res.status;
}

describe('SECURITY — withAuth permission gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: low-priv role with NO extra DB-granted permissions.
    mockGetPerms.mockResolvedValue(new Set<string>());
    // Make the DB op a no-op success for the admin-pass cases.
    mockExecuteDbOperation.mockResolvedValue([]);
  });

  // --- 401 when unauthenticated --------------------------------------------
  it('returns 401 when no session (POST /api/users)', async () => {
    mockSession.mockResolvedValue(null);
    const res = await usersPost(makeReq('/api/users', 'POST', { email: 'a@b.c', password: 'x', name: 'n' }));
    expect(await status(res)).toBe(401);
  });

  // --- 403 for each low-priv role on each protected mutation ----------------
  for (const role of LOW_PRIV_ROLES) {
    it(`blocks role "${role}" from POST /api/users with 403`, async () => {
      mockSession.mockResolvedValue({ userId: 7, role, email: `${role}@test.com`, name: role });
      const res = await usersPost(
        makeReq('/api/users', 'POST', { email: 'new@test.com', password: 'pw', name: 'New' }),
      );
      expect(await status(res)).toBe(403);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.missingPermissions).toContain('users:write');
    });

    it(`blocks role "${role}" from PUT /api/users/[id] with 403`, async () => {
      mockSession.mockResolvedValue({ userId: 7, role, email: `${role}@test.com`, name: role });
      const res = await usersPut(makeReq('/api/users/5', 'PUT', { name: 'Hacked' }), idParams);
      expect(await status(res)).toBe(403);
      const body = await res.json();
      expect(body.missingPermissions).toContain('users:write');
    });

    it(`blocks role "${role}" from DELETE /api/users/[id] with 403`, async () => {
      mockSession.mockResolvedValue({ userId: 7, role, email: `${role}@test.com`, name: role });
      const res = await usersDelete(makeReq('/api/users/5', 'DELETE'), idParams);
      expect(await status(res)).toBe(403);
      const body = await res.json();
      expect(body.missingPermissions).toContain('users:delete');
    });

    it(`blocks role "${role}" from POST /api/settings/approval-flows with 403`, async () => {
      mockSession.mockResolvedValue({ userId: 7, role, email: `${role}@test.com`, name: role });
      const res = await approvalFlowsPost(
        makeReq('/api/settings/approval-flows', 'POST', { name: 'x', documentType: 'purchase_order' }),
      );
      expect(await status(res)).toBe(403);
      const body = await res.json();
      expect(body.missingPermissions).toContain('settings:write');
    });

    it(`blocks role "${role}" from POST /api/settings/matching-tolerances with 403`, async () => {
      mockSession.mockResolvedValue({ userId: 7, role, email: `${role}@test.com`, name: role });
      const res = await tolerancesPost(
        makeReq('/api/settings/matching-tolerances', 'POST', {
          name: 'x',
          toleranceType: 'quantity',
          toleranceMethod: 'percentage',
          toleranceValue: 5,
        }),
      );
      expect(await status(res)).toBe(403);
      const body = await res.json();
      expect(body.missingPermissions).toContain('settings:write');
    });
  }

  // --- admin passes the gate (status is NOT 403/401) ------------------------
  it('admin passes POST /api/users gate (not 403)', async () => {
    mockSession.mockResolvedValue({ userId: 1, role: 'admin', email: 'admin@test.com', name: 'Admin' });
    // existing email lookup -> empty, insert -> ok
    mockExecuteDbOperation.mockResolvedValueOnce([]).mockResolvedValueOnce({ insertId: 999 });
    const res = await usersPost(
      makeReq('/api/users', 'POST', { email: 'fresh@test.com', password: 'pw', name: 'Fresh', role: 'user' }),
    );
    expect(await status(res)).not.toBe(403);
    expect(await status(res)).not.toBe(401);
  });

  it('admin passes POST /api/settings/approval-flows gate', async () => {
    mockSession.mockResolvedValue({ userId: 1, role: 'admin', email: 'admin@test.com', name: 'Admin' });
    const res = await approvalFlowsPost(
      makeReq('/api/settings/approval-flows', 'POST', { name: 'PO Flow', documentType: 'purchase_order' }),
    );
    expect(await status(res)).not.toBe(403);
    expect(await status(res)).not.toBe(401);
  });

  it('admin passes POST /api/settings/matching-tolerances gate', async () => {
    mockSession.mockResolvedValue({ userId: 1, role: 'admin', email: 'admin@test.com', name: 'Admin' });
    const res = await tolerancesPost(
      makeReq('/api/settings/matching-tolerances', 'POST', {
        name: 'Default',
        toleranceType: 'quantity',
        toleranceMethod: 'percentage',
        toleranceValue: 5,
      }),
    );
    expect(await status(res)).not.toBe(403);
    expect(await status(res)).not.toBe(401);
  });

  // --- DB-granted permission overrides static deny --------------------------
  it('low-priv role WITH db-granted settings:write passes (two-source authz)', async () => {
    mockSession.mockResolvedValue({ userId: 7, role: 'warehouse', email: 'wh@test.com', name: 'WH' });
    mockGetPerms.mockResolvedValue(new Set(['settings:write']));
    const res = await tolerancesPost(
      makeReq('/api/settings/matching-tolerances', 'POST', {
        name: 'Granted',
        toleranceType: 'quantity',
        toleranceMethod: 'percentage',
        toleranceValue: 5,
      }),
    );
    expect(await status(res)).not.toBe(403);
  });
});
