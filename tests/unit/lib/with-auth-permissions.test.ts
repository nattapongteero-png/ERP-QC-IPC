import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for withAuth() permission-denial responses.
 *
 * Regression context: when a user hit an API they lacked permission for, the
 * response was just `{ error: "You do not have permission to perform this
 * action" }` with no clue about WHICH permission was missing. Users and
 * admins had to dig through code. Now the response includes:
 *   - missingPermissions: which permission code(s) are required
 *   - userRole: the role the user has now
 *   - actionHint: how to fix it
 *
 * These tests lock in that contract so the toast stays actionable.
 */

// Mock the session module so we can inject different roles into tests.
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: () => ({ value: 'mock-token' }),
  }),
}));

// Helper: dynamic import after mocking so the module picks up our mocks.
async function importWithAuth() {
  const module = await import('../../../src/lib/api-utils');
  return module;
}

async function makeRequest(url: string, method: string = 'GET'): Promise<Request> {
  return new Request(url, { method });
}

describe('withAuth — permission denial response shape', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns 403 with missingPermissions when role lacks required permission', async () => {
    vi.doMock('../../../src/lib/auth', async () => {
      const actual = await vi.importActual<typeof import('../../../src/lib/auth')>(
        '../../../src/lib/auth',
      );
      return {
        ...actual,
        getSession: vi.fn().mockResolvedValue({
          userId: 1,
          email: 'prod@test.com',
          role: 'PROD_MANAGER',
          name: 'Production Manager',
        }),
      };
    });

    const { withAuth } = await importWithAuth();
    const request = await makeRequest('http://test/api/sales/orders');
    const handler = vi.fn();

    const response = await withAuth(request, handler, ['sales:approve']);

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    // Error message must contain the missing permission code + role for
    // the toast to render actionable info.
    expect(body.error).toContain('sales:approve');
    expect(body.error).toContain('PROD_MANAGER');
    // Structured fields — consumed by global-api-errors.tsx
    expect(body.missingPermissions).toEqual(['sales:approve']);
    expect(body.userRole).toBe('PROD_MANAGER');
    expect(body.actionHint).toBeDefined();
    expect(body.actionHint).toContain('/hr/roles');

    // Handler must NOT be called on a denial.
    expect(handler).not.toHaveBeenCalled();
  });

  it('reports ALL missing permissions, not just the first', async () => {
    vi.doMock('../../../src/lib/auth', async () => {
      const actual = await vi.importActual<typeof import('../../../src/lib/auth')>(
        '../../../src/lib/auth',
      );
      return {
        ...actual,
        getSession: vi.fn().mockResolvedValue({
          userId: 2,
          email: 'qc@test.com',
          role: 'QC_ANALYST',
          name: 'QC Analyst',
        }),
      };
    });

    const { withAuth } = await importWithAuth();
    const request = await makeRequest('http://test/api/settings');
    const handler = vi.fn();

    // QC_ANALYST has 'qc' alias — lacks BOTH 'settings:read' and 'users:write'
    const response = await withAuth(request, handler, [
      'settings:read',
      'users:write',
    ]);

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.missingPermissions).toContain('settings:read');
    expect(body.missingPermissions).toContain('users:write');
    expect(body.missingPermissions.length).toBe(2);
  });

  it('allows admin to bypass all permission checks', async () => {
    vi.doMock('../../../src/lib/auth', async () => {
      const actual = await vi.importActual<typeof import('../../../src/lib/auth')>(
        '../../../src/lib/auth',
      );
      return {
        ...actual,
        getSession: vi.fn().mockResolvedValue({
          userId: 99,
          email: 'admin@test.com',
          role: 'admin',
          name: 'Admin',
        }),
      };
    });

    const { withAuth, successResponse } = await importWithAuth();
    const request = await makeRequest('http://test/api/anything');
    const handler = vi.fn().mockResolvedValue(successResponse({ ok: true }));

    const response = await withAuth(request, handler, [
      'sales:approve',
      'settings:write',
      'users:write',
    ]);

    expect(handler).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
  });

  it('allows through when user has ALL required permissions', async () => {
    vi.doMock('../../../src/lib/auth', async () => {
      const actual = await vi.importActual<typeof import('../../../src/lib/auth')>(
        '../../../src/lib/auth',
      );
      return {
        ...actual,
        getSession: vi.fn().mockResolvedValue({
          userId: 5,
          email: 'qc@test.com',
          role: 'QC_ANALYST',
          name: 'QC',
        }),
      };
    });

    const { withAuth, successResponse } = await importWithAuth();
    const request = await makeRequest('http://test/api/quality/tests');
    const handler = vi.fn().mockResolvedValue(successResponse({ ok: true }));

    const response = await withAuth(request, handler, [
      'quality:read',
      'quality:write',
    ]);

    expect(handler).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
  });

  it('returns 401 when no session', async () => {
    vi.doMock('../../../src/lib/auth', async () => {
      const actual = await vi.importActual<typeof import('../../../src/lib/auth')>(
        '../../../src/lib/auth',
      );
      return {
        ...actual,
        getSession: vi.fn().mockResolvedValue(null),
      };
    });

    const { withAuth } = await importWithAuth();
    const request = await makeRequest('http://test/api/sales/orders');
    const handler = vi.fn();

    const response = await withAuth(request, handler, ['sales:read']);

    expect(response.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it('no permission required — passes through for any logged-in user', async () => {
    vi.doMock('../../../src/lib/auth', async () => {
      const actual = await vi.importActual<typeof import('../../../src/lib/auth')>(
        '../../../src/lib/auth',
      );
      return {
        ...actual,
        getSession: vi.fn().mockResolvedValue({
          userId: 7,
          email: 'anyone@test.com',
          role: 'PROD_OPERATOR',
          name: 'Op',
        }),
      };
    });

    const { withAuth, successResponse } = await importWithAuth();
    const request = await makeRequest('http://test/api/public');
    const handler = vi.fn().mockResolvedValue(successResponse({ ok: true }));

    // No requiredPermissions arg → open to all authenticated users
    const response = await withAuth(request, handler);

    expect(handler).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
  });
});

describe('withAuth — permission denial message format', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('Thai-first error message is user-friendly and points to /hr/roles', async () => {
    vi.doMock('../../../src/lib/auth', async () => {
      const actual = await vi.importActual<typeof import('../../../src/lib/auth')>(
        '../../../src/lib/auth',
      );
      return {
        ...actual,
        getSession: vi.fn().mockResolvedValue({
          userId: 1,
          email: 'x',
          role: 'PROD_MANAGER',
          name: 'X',
        }),
      };
    });

    const { withAuth } = await importWithAuth();
    const request = await makeRequest('http://test/api/hr/roles/5');
    const response = await withAuth(request, vi.fn(), ['hr:admin']);

    const body = await response.json();
    expect(body.error).toMatch(/ไม่มีสิทธิ์/);
    expect(body.error).toContain('hr:admin');
    expect(body.error).toContain('PROD_MANAGER');
    expect(body.actionHint).toContain('/hr/roles');
  });
});
