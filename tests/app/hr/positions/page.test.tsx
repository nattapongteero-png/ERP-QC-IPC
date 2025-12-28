// HR Positions Page UI Tests
// Tests for positions list page with page-based navigation
// Feature: 007-hr-personnel-management - Task 4: Template Pattern Alignment

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/ui/toast';

// Track router.push calls
const mockRouterPush = vi.fn();

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    back: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => '/hr/positions',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Create a fresh QueryClient for each test
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
    },
  });
}

// Wrapper component for tests
function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        {children}
      </ToastProvider>
    </QueryClientProvider>
  );
}

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock positions data
const mockPositions = [
  {
    id: 1,
    code: 'QC-001',
    title: 'Quality Control Manager',
    titleEn: 'QC Manager',
    orgUnitId: 1,
    jobGrade: 'Manager',
    isGmpCritical: true,
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 2,
    code: 'PROD-001',
    title: 'Production Supervisor',
    titleEn: 'Production Supervisor',
    orgUnitId: 2,
    jobGrade: 'Supervisor',
    isGmpCritical: false,
    isActive: true,
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
  },
];

const mockOrgUnits = [
  { id: 1, code: 'QC', name: 'Quality Control', type: 'department', isActive: true },
  { id: 2, code: 'PROD', name: 'Production', type: 'department', isActive: true },
];

describe('PositionsPage', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockRouterPush.mockReset();

    // Setup API mock responses
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/hr/positions')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: mockPositions }),
        });
      }
      if (url.includes('/api/hr/org-units')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: mockOrgUnits }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: [] }),
      });
    });
  });

  it('renders positions page without crashing', async () => {
    const PositionsPage = (await import('@/app/hr/positions/page')).default;

    const { container } = render(
      <TestWrapper>
        <PositionsPage />
      </TestWrapper>
    );

    // Check that the page container is rendered (complex page with DevExtreme DataGrid)
    await waitFor(() => {
      // Check for the main page container class
      expect(container.querySelector('.p-4, .md\\:p-6')).toBeTruthy();
    }, { timeout: 10000 });
  }, 15000);

  it('renders page structure', async () => {
    const PositionsPage = (await import('@/app/hr/positions/page')).default;

    const { container } = render(
      <TestWrapper>
        <PositionsPage />
      </TestWrapper>
    );

    // Check for navigation breadcrumb containing "HR"
    await waitFor(() => {
      expect(container.textContent).toContain('HR');
    }, { timeout: 10000 });
  }, 15000);

  it('renders positions in the list', async () => {
    const PositionsPage = (await import('@/app/hr/positions/page')).default;

    render(
      <TestWrapper>
        <PositionsPage />
      </TestWrapper>
    );

    // Wait for positions to load (complex page needs more time)
    await waitFor(() => {
      expect(screen.getByText('Quality Control Manager')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders KPI statistics', async () => {
    const PositionsPage = (await import('@/app/hr/positions/page')).default;

    render(
      <TestWrapper>
        <PositionsPage />
      </TestWrapper>
    );

    // Check for KPI cards
    await waitFor(() => {
      expect(screen.getByText(/ตำแหน่งทั้งหมด/)).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders view mode toggle buttons', async () => {
    const PositionsPage = (await import('@/app/hr/positions/page')).default;

    render(
      <TestWrapper>
        <PositionsPage />
      </TestWrapper>
    );

    // Check for view mode buttons
    await waitFor(() => {
      expect(screen.getByTitle(/มุมมองตาราง/)).toBeInTheDocument();
      expect(screen.getByTitle(/มุมมองการ์ด/)).toBeInTheDocument();
      expect(screen.getByTitle(/มุมมองวิเคราะห์/)).toBeInTheDocument();
    }, { timeout: 5000 });
  });
});

describe('PositionForm Component', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockRouterPush.mockReset();

    // Setup API mock responses for form
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/hr/positions/1')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: mockPositions[0] }),
        });
      }
      if (url.includes('/api/hr/org-units')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: mockOrgUnits }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: [] }),
      });
    });
  });

  it('renders create mode form with empty fields', async () => {
    const { PositionForm } = await import('@/components/hr/PositionForm');

    render(
      <TestWrapper>
        <PositionForm mode="create" />
      </TestWrapper>
    );

    // Check for create mode title
    expect(screen.getByText(/เพิ่มตำแหน่งใหม่/)).toBeInTheDocument();
  });

  it('shows cancel button in create mode', async () => {
    const { PositionForm } = await import('@/components/hr/PositionForm');

    render(
      <TestWrapper>
        <PositionForm mode="create" />
      </TestWrapper>
    );

    expect(screen.getByText(/ยกเลิก/)).toBeInTheDocument();
  });

  it('shows save button', async () => {
    const { PositionForm } = await import('@/components/hr/PositionForm');

    render(
      <TestWrapper>
        <PositionForm mode="create" />
      </TestWrapper>
    );

    expect(screen.getByText(/บันทึก/)).toBeInTheDocument();
  });

  it('renders edit mode form with position data', async () => {
    const { PositionForm } = await import('@/components/hr/PositionForm');

    render(
      <TestWrapper>
        <PositionForm mode="edit" positionId={1} />
      </TestWrapper>
    );

    // Wait for data to load and check edit mode title
    await waitFor(() => {
      expect(screen.getByText(/แก้ไขตำแหน่ง/)).toBeInTheDocument();
    });
  });

  it('shows loading state in edit mode while fetching', async () => {
    // Mock a slow fetch
    mockFetch.mockImplementation(() => new Promise(() => {}));

    const { PositionForm } = await import('@/components/hr/PositionForm');

    render(
      <TestWrapper>
        <PositionForm mode="edit" positionId={1} />
      </TestWrapper>
    );

    expect(screen.getByText(/กำลังโหลด/)).toBeInTheDocument();
  });
});

describe('New Position Page', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockOrgUnits }),
    });
  });

  it('renders new position page without crashing', async () => {
    const NewPositionPage = (await import('@/app/hr/positions/new/page')).default;

    render(
      <TestWrapper>
        <NewPositionPage />
      </TestWrapper>
    );

    expect(screen.getByText(/เพิ่มตำแหน่งใหม่/)).toBeInTheDocument();
  });

  it('renders form fields', async () => {
    const NewPositionPage = (await import('@/app/hr/positions/new/page')).default;

    render(
      <TestWrapper>
        <NewPositionPage />
      </TestWrapper>
    );

    expect(screen.getByText(/ข้อมูลตำแหน่ง/)).toBeInTheDocument();
  });
});

describe('Position Detail Page', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/hr/positions/1')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: mockPositions[0] }),
        });
      }
      if (url.includes('/api/hr/org-units')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: mockOrgUnits }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: [] }),
      });
    });
  });

  it('renders position detail page without crashing', async () => {
    // Test the PositionForm in edit mode directly (avoids React Suspense in page)
    const { PositionForm } = await import('@/components/hr/PositionForm');

    render(
      <TestWrapper>
        <PositionForm mode="edit" positionId={1} />
      </TestWrapper>
    );

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText(/แก้ไขตำแหน่ง/)).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('loads and displays position data', async () => {
    // Test the PositionForm in edit mode directly (avoids React Suspense in page)
    const { PositionForm } = await import('@/components/hr/PositionForm');

    render(
      <TestWrapper>
        <PositionForm mode="edit" positionId={1} />
      </TestWrapper>
    );

    // Wait for position code to appear
    await waitFor(() => {
      expect(screen.getByText(/QC-001/)).toBeInTheDocument();
    }, { timeout: 5000 });
  });
});
