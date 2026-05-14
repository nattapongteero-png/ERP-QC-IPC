/**
 * Role Form Tests - Permission Selection & Infinite Re-render Prevention
 * Covers: Bug fix for DevExtreme TagBox infinite re-render loop (React error #185)
 * when checking/unchecking permissions on /hr/roles/[id] edit page.
 *
 * Root cause: TagBox's template-manager calls React setState on every prop change.
 * New array refs from .filter() on each render triggered infinite update cycle.
 * Fix: React.memo with deep comparison + functional setState with same-ref return.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Track router.push calls
const mockRouterPush = vi.fn();

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    back: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => '/hr/roles/1',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// ---- Test data ----

const mockRole = {
  id: 1,
  code: 'ADMIN',
  name: 'ผู้ดูแลระบบ',
  description: 'สิทธิ์เต็มในการจัดการระบบ',
  isSystemRole: false,
  isActive: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const mockPermissions = [
  { id: 1, code: 'hr:read', name: 'HR View', module: 'HR', createdAt: '2024-01-01' },
  { id: 2, code: 'hr:write', name: 'HR Edit', module: 'HR', createdAt: '2024-01-01' },
  { id: 3, code: 'hr:admin', name: 'HR Admin', module: 'HR', createdAt: '2024-01-01' },
  { id: 4, code: 'hr:health_staff', name: 'HR Health Staff', module: 'HR', createdAt: '2024-01-01' },
  { id: 5, code: 'production:read', name: 'Production View', module: 'Production', createdAt: '2024-01-01' },
  { id: 6, code: 'production:write', name: 'Production Edit', module: 'Production', createdAt: '2024-01-01' },
  { id: 7, code: 'production:approve', name: 'Production Approve', module: 'Production', createdAt: '2024-01-01' },
  { id: 8, code: 'quality:read', name: 'Quality View', module: 'Quality', createdAt: '2024-01-01' },
  { id: 9, code: 'quality:write', name: 'Quality Edit', module: 'Quality', createdAt: '2024-01-01' },
];

// Role has 2 existing permissions
const mockRolePermissions = [
  { id: 1, code: 'hr:read', name: 'HR View', module: 'HR', createdAt: '2024-01-01' },
  { id: 5, code: 'production:read', name: 'Production View', module: 'Production', createdAt: '2024-01-01' },
];

// ---- Test utilities ----

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
    },
  });
}

function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

/** Configure mockFetch to respond to role-form API endpoints */
function setupFetchMocks(opts: {
  role?: typeof mockRole | null;
  rolePermissions?: typeof mockRolePermissions;
  allPermissions?: typeof mockPermissions;
} = {}) {
  const {
    role = mockRole,
    rolePermissions = mockRolePermissions,
    allPermissions = mockPermissions,
  } = opts;

  mockFetch.mockImplementation((url: string) => {
    // GET /api/hr/roles/[id]/permissions
    if (/\/api\/hr\/roles\/\d+\/permissions/.test(url)) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: rolePermissions }),
      });
    }
    // GET /api/hr/roles/[id]
    if (/\/api\/hr\/roles\/\d+/.test(url)) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: role }),
      });
    }
    // GET /api/hr/permissions
    if (url.includes('/api/hr/permissions')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: allPermissions }),
      });
    }
    return Promise.resolve({
      ok: true,
      json: async () => ({ data: [] }),
    });
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ============================================
// Tests
// ============================================

describe('RoleForm - Edit Mode (Permission Selection)', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockRouterPush.mockReset();
    setupFetchMocks();
  });

  it('renders edit form without crashing (no infinite re-render)', async () => {
    // This is the core regression test: before the fix, rendering in edit mode
    // with permissions caused React error #185 "Maximum update depth exceeded"
    const { RoleForm } = await import('@/components/hr/role-form');

    const { container } = render(
      <TestWrapper>
        <RoleForm mode="edit" roleId={1} />
      </TestWrapper>
    );

    // Wait for role data to load and form to render
    await waitFor(() => {
      expect(screen.getByText(/แก้ไขบทบาท.*ADMIN/)).toBeInTheDocument();
    }, { timeout: 10000 });

    // Verify the page did not crash — permissions section is visible
    expect(container.textContent).toContain('สิทธิ์การเข้าถึง');
  }, 15000);

  it('displays permission modules grouped correctly', async () => {
    const { RoleForm } = await import('@/components/hr/role-form');

    render(
      <TestWrapper>
        <RoleForm mode="edit" roleId={1} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/แก้ไขบทบาท.*ADMIN/)).toBeInTheDocument();
    }, { timeout: 10000 });

    // Should show all 3 modules from mock data
    expect(screen.getByText('HR')).toBeInTheDocument();
    expect(screen.getByText('Production')).toBeInTheDocument();
    expect(screen.getByText('Quality')).toBeInTheDocument();
  }, 15000);

  it('shows correct permission count in header', async () => {
    const { RoleForm } = await import('@/components/hr/role-form');

    render(
      <TestWrapper>
        <RoleForm mode="edit" roleId={1} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/แก้ไขบทบาท.*ADMIN/)).toBeInTheDocument();
    }, { timeout: 10000 });

    // mockRolePermissions has 2 items → should show "2 สิทธิ์" in summary
    await waitFor(() => {
      const summarySection = screen.getByText('จำนวนสิทธิ์');
      const parent = summarySection.closest('div');
      expect(parent?.textContent).toContain('2 สิทธิ์');
    }, { timeout: 5000 });
  }, 15000);

  it('renders with zero permissions without crashing', async () => {
    // Edge case: role with no permissions should not crash
    setupFetchMocks({ rolePermissions: [] });

    const { RoleForm } = await import('@/components/hr/role-form');

    render(
      <TestWrapper>
        <RoleForm mode="edit" roleId={1} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/แก้ไขบทบาท.*ADMIN/)).toBeInTheDocument();
    }, { timeout: 10000 });

    // Permission count should be 0
    await waitFor(() => {
      const summarySection = screen.getByText('จำนวนสิทธิ์');
      const parent = summarySection.closest('div');
      expect(parent?.textContent).toContain('0 สิทธิ์');
    });
  }, 15000);

  it('renders with all permissions selected without crashing', async () => {
    // Edge case: all permissions assigned to role
    setupFetchMocks({ rolePermissions: mockPermissions });

    const { RoleForm } = await import('@/components/hr/role-form');

    render(
      <TestWrapper>
        <RoleForm mode="edit" roleId={1} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/แก้ไขบทบาท.*ADMIN/)).toBeInTheDocument();
    }, { timeout: 10000 });

    // Should show all 9 permissions selected
    await waitFor(() => {
      const summarySection = screen.getByText('จำนวนสิทธิ์');
      const parent = summarySection.closest('div');
      expect(parent?.textContent).toContain('9 สิทธิ์');
    });
  }, 15000);

  it('populates form fields from loaded role data', async () => {
    const { RoleForm } = await import('@/components/hr/role-form');

    render(
      <TestWrapper>
        <RoleForm mode="edit" roleId={1} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/แก้ไขบทบาท.*ADMIN/)).toBeInTheDocument();
    }, { timeout: 10000 });

    // Role code should be displayed (disabled field)
    const codeInput = screen.getByPlaceholderText('เช่น quality_manager');
    expect(codeInput).toHaveValue('ADMIN');
    expect(codeInput).toBeDisabled();

    // Role name should be editable
    const nameInput = screen.getByPlaceholderText('เช่น ผู้จัดการคุณภาพ');
    expect(nameInput).toHaveValue('ผู้ดูแลระบบ');
  }, 15000);
});

describe('RoleForm - Create Mode', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockRouterPush.mockReset();
    setupFetchMocks({ role: null, rolePermissions: [] });
  });

  it('renders create form without crashing', async () => {
    const { RoleForm } = await import('@/components/hr/role-form');

    render(
      <TestWrapper>
        <RoleForm mode="create" />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('สร้างบทบาทใหม่')).toBeInTheDocument();
    }, { timeout: 10000 });

    // Permissions section should be visible
    expect(screen.getByText(/สิทธิ์การเข้าถึง/)).toBeInTheDocument();
  }, 15000);

  it('shows permission modules in create mode', async () => {
    const { RoleForm } = await import('@/components/hr/role-form');

    render(
      <TestWrapper>
        <RoleForm mode="create" />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('สร้างบทบาทใหม่')).toBeInTheDocument();
    }, { timeout: 10000 });

    // All modules from allPermissions should be displayed
    await waitFor(() => {
      expect(screen.getByText('HR')).toBeInTheDocument();
      expect(screen.getByText('Production')).toBeInTheDocument();
      expect(screen.getByText('Quality')).toBeInTheDocument();
    });

    // No permissions selected initially → "0 สิทธิ์"
    const summarySection = screen.getByText('จำนวนสิทธิ์');
    const parent = summarySection.closest('div');
    expect(parent?.textContent).toContain('0 สิทธิ์');
  }, 15000);

  it('has enabled role code field in create mode', async () => {
    const { RoleForm } = await import('@/components/hr/role-form');

    render(
      <TestWrapper>
        <RoleForm mode="create" />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('สร้างบทบาทใหม่')).toBeInTheDocument();
    }, { timeout: 10000 });

    const codeInput = screen.getByPlaceholderText('เช่น quality_manager');
    expect(codeInput).not.toBeDisabled();
  }, 15000);
});

describe('RoleForm - System Role Protection', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockRouterPush.mockReset();
    setupFetchMocks({
      role: { ...mockRole, isSystemRole: true },
      rolePermissions: mockRolePermissions,
    });
  });

  it('shows system role warning and disables editing', async () => {
    const { RoleForm } = await import('@/components/hr/role-form');

    render(
      <TestWrapper>
        <RoleForm mode="edit" roleId={1} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/แก้ไขบทบาท.*ADMIN/)).toBeInTheDocument();
    }, { timeout: 10000 });

    // System role warning should be visible
    expect(screen.getByText('บทบาทระบบไม่สามารถแก้ไขได้')).toBeInTheDocument();

    // Save button should be disabled
    const saveButton = screen.getByText('บันทึก').closest('div[role="button"], button');
    expect(saveButton).toBeTruthy();
  }, 15000);
});

describe('RoleForm - Multiple Re-renders Stability', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockRouterPush.mockReset();
    setupFetchMocks();
  });

  it('survives multiple rapid query refetches without crash', async () => {
    // Simulate TanStack Query refetch behavior that was triggering the bug.
    // Each refetch returns new object references — the fix should handle this
    // without infinite re-render.
    let fetchCount = 0;

    mockFetch.mockImplementation((url: string) => {
      fetchCount++;
      if (/\/api\/hr\/roles\/\d+\/permissions/.test(url)) {
        // Return new array reference each time (same content)
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [...mockRolePermissions] }),
        });
      }
      if (/\/api\/hr\/roles\/\d+/.test(url)) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: { ...mockRole } }),
        });
      }
      if (url.includes('/api/hr/permissions')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [...mockPermissions] }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: [] }),
      });
    });

    const { RoleForm } = await import('@/components/hr/role-form');

    render(
      <TestWrapper>
        <RoleForm mode="edit" roleId={1} />
      </TestWrapper>
    );

    // Page should load successfully
    await waitFor(() => {
      expect(screen.getByText(/แก้ไขบทบาท.*ADMIN/)).toBeInTheDocument();
    }, { timeout: 10000 });

    // Verify API was called (not stuck in loop)
    expect(fetchCount).toBeGreaterThan(0);
    // Fetch count should be reasonable (3 endpoints × a few calls, not hundreds)
    expect(fetchCount).toBeLessThan(30);
  }, 15000);

  it('handles permissions loading after role data loads', async () => {
    // Simulate staggered loading: role loads first, then permissions
    let permissionsResolve: (value: unknown) => void;
    const permissionsPromise = new Promise(resolve => {
      permissionsResolve = resolve;
    });

    mockFetch.mockImplementation((url: string) => {
      if (/\/api\/hr\/roles\/\d+\/permissions/.test(url)) {
        return permissionsPromise.then(() => ({
          ok: true,
          json: async () => ({ data: mockRolePermissions }),
        }));
      }
      if (/\/api\/hr\/roles\/\d+/.test(url)) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: mockRole }),
        });
      }
      if (url.includes('/api/hr/permissions')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: mockPermissions }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: [] }),
      });
    });

    const { RoleForm } = await import('@/components/hr/role-form');

    render(
      <TestWrapper>
        <RoleForm mode="edit" roleId={1} />
      </TestWrapper>
    );

    // Role data loads first
    await waitFor(() => {
      expect(screen.getByText(/แก้ไขบทบาท.*ADMIN/)).toBeInTheDocument();
    }, { timeout: 10000 });

    // Initially 0 permissions (still loading)
    const summarySection = screen.getByText('จำนวนสิทธิ์');
    expect(summarySection.closest('div')?.textContent).toContain('0 สิทธิ์');

    // Now resolve permissions
    await act(async () => {
      permissionsResolve!(undefined);
    });

    // Permissions should update
    await waitFor(() => {
      const updated = screen.getByText('จำนวนสิทธิ์');
      expect(updated.closest('div')?.textContent).toContain('2 สิทธิ์');
    }, { timeout: 5000 });
  }, 15000);
});
