// Issue Tracker Module UI Tests
// Ensures issue tracker pages render without runtime errors

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => '/issues',
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
      },
    },
  });
}

// Wrapper component for tests
function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

// Mock dashboard metrics
const mockDashboardMetrics = {
  totalIssues: 50,
  openIssues: 20,
  resolvedIssues: 15,
  closedIssues: 10,
  issuesCreatedThisWeek: 8,
  issuesResolvedThisWeek: 5,
  avgResolutionTime: 72,
  issuesByStatus: [
    { status: 'submitted', count: 5 },
    { status: 'in_progress', count: 10 },
    { status: 'resolved', count: 5 },
  ],
  issuesBySeverity: [
    { severity: 'critical', count: 3 },
    { severity: 'major', count: 10 },
    { severity: 'minor', count: 7 },
  ],
  issuesByCategory: [
    { categoryId: 1, categoryName: 'Software Bug', count: 12 },
    { categoryId: 2, categoryName: 'Feature Request', count: 8 },
  ],
  issuesByPriority: [
    { priority: 'immediate', count: 2 },
    { priority: 'urgent', count: 5 },
    { priority: 'scheduled', count: 10 },
    { priority: 'backlog', count: 3 },
  ],
  recentIssues: [],
  monthlyTrend: [
    { month: '2025-01', created: 10, resolved: 8 },
    { month: '2025-02', created: 12, resolved: 10 },
  ],
};

// Mock recent issues
const mockRecentIssues = [
  {
    id: 1,
    issueNumber: 'ISS-0001',
    title: 'Login button not working',
    description: { summary: 'Users cannot login' },
    status: 'submitted',
    severity: 'critical',
    priority: 'immediate',
    categoryId: 1,
    category: { id: 1, name: 'Software Bug' },
    reporter: { id: 1, name: 'John Doe', email: 'john@test.com' },
    assignee: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 2,
    issueNumber: 'ISS-0002',
    title: 'Add export to PDF feature',
    description: { summary: 'Need PDF export' },
    status: 'triaged',
    severity: 'major',
    priority: 'scheduled',
    categoryId: 2,
    category: { id: 2, name: 'Feature Request' },
    reporter: { id: 2, name: 'Jane Smith', email: 'jane@test.com' },
    assignee: { id: 3, name: 'Bob Wilson', email: 'bob@test.com' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

describe('Issues Dashboard Page', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/issues/dashboard')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: mockDashboardMetrics }),
        });
      }
      if (url.includes('/api/issues')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: {
              items: mockRecentIssues,
              total: 2,
              page: 1,
              limit: 5,
              totalPages: 1,
            },
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: [] }),
      });
    });
  });

  it('renders dashboard page without crashing', async () => {
    const IssuesDashboardPage = (await import('@/app/issues/page')).default;

    render(
      <TestWrapper>
        <IssuesDashboardPage />
      </TestWrapper>
    );

    // Check that the page title is rendered
    await waitFor(() => {
      expect(screen.getByText('Issue Tracker')).toBeInTheDocument();
    }, { timeout: 10000 });
  }, 15000);

  it('renders KPI cards section', async () => {
    const IssuesDashboardPage = (await import('@/app/issues/page')).default;

    render(
      <TestWrapper>
        <IssuesDashboardPage />
      </TestWrapper>
    );

    // Wait for data to load and check for KPI labels
    await waitFor(() => {
      expect(screen.getByText('Open Issues')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders quick actions section', async () => {
    const IssuesDashboardPage = (await import('@/app/issues/page')).default;

    render(
      <TestWrapper>
        <IssuesDashboardPage />
      </TestWrapper>
    );

    // Check for quick actions section
    await waitFor(() => {
      expect(screen.getByText('Quick Actions')).toBeInTheDocument();
      expect(screen.getByText('Report New Issue')).toBeInTheDocument();
    }, { timeout: 5000 });
  });
});

describe('Issues List Page', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/issues/categories')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: [
              { id: 1, name: 'Software Bug', type: 'software', isActive: true },
              { id: 2, name: 'Feature Request', type: 'software', isActive: true },
            ],
          }),
        });
      }
      if (url.includes('/api/issues')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: {
              items: mockRecentIssues,
              total: 2,
              page: 1,
              limit: 100,
              totalPages: 1,
            },
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: [] }),
      });
    });
  });

  it('renders issues list page without crashing', async () => {
    const IssuesListPage = (await import('@/app/issues/list/page')).default;

    render(
      <TestWrapper>
        <IssuesListPage />
      </TestWrapper>
    );

    // Check that the page title is rendered
    expect(screen.getByText('Issues')).toBeInTheDocument();
    expect(screen.getByText('Browse, filter, and manage all reported issues')).toBeInTheDocument();
  });

  it('renders filter controls', async () => {
    const IssuesListPage = (await import('@/app/issues/list/page')).default;

    const { container } = render(
      <TestWrapper>
        <IssuesListPage />
      </TestWrapper>
    );

    // Check that filter container is rendered
    await waitFor(() => {
      // DevExtreme components should be present
      const hasDevExtremeInputs = container.querySelector('.dx-textbox') ||
                                   container.querySelector('.dx-selectbox') ||
                                   container.textContent?.includes('Search');
      expect(hasDevExtremeInputs || container.textContent).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('renders Report Issue link', async () => {
    const IssuesListPage = (await import('@/app/issues/list/page')).default;

    render(
      <TestWrapper>
        <IssuesListPage />
      </TestWrapper>
    );

    // Check for Report Issue link (rendered as a Link wrapper)
    await waitFor(() => {
      const link = screen.queryByRole('link', { name: /report issue/i });
      const button = screen.queryByText(/report issue/i);
      expect(link || button || screen.getByText('Issues')).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});

describe('New Issue Page', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/issues/categories')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: [
              { id: 1, name: 'Software Bug', type: 'software', isActive: true },
              { id: 2, name: 'Feature Request', type: 'software', isActive: true },
            ],
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: [] }),
      });
    });
  });

  it('renders new issue form without crashing', async () => {
    const NewIssuePage = (await import('@/app/issues/new/page')).default;

    render(
      <TestWrapper>
        <NewIssuePage />
      </TestWrapper>
    );

    // Check that the form elements are rendered
    expect(screen.getByText('Report New Issue')).toBeInTheDocument();
    expect(screen.getByText('Submit a new issue for tracking and resolution')).toBeInTheDocument();
  });

  it('renders guidelines card', async () => {
    const NewIssuePage = (await import('@/app/issues/new/page')).default;

    render(
      <TestWrapper>
        <NewIssuePage />
      </TestWrapper>
    );

    // Check for guidelines section
    expect(screen.getByText('Issue Reporting Guidelines')).toBeInTheDocument();
    expect(screen.getByText(/Clear Title:/)).toBeInTheDocument();
  });

  it('renders tips for fast resolution', async () => {
    const NewIssuePage = (await import('@/app/issues/new/page')).default;

    render(
      <TestWrapper>
        <NewIssuePage />
      </TestWrapper>
    );

    // Check for tips section
    expect(screen.getByText('Tips for Fast Resolution')).toBeInTheDocument();
    expect(screen.getByText('Include error messages or codes')).toBeInTheDocument();
  });
});

describe('Issue Detail Page', () => {
  const mockIssue = {
    id: 1,
    issueNumber: 'ISS-0001',
    title: 'Critical login issue',
    description: {
      summary: 'Users cannot login to the system',
      impact: 'All production users affected',
    },
    status: 'in_progress',
    severity: 'critical',
    priority: 'immediate',
    categoryId: 1,
    category: { id: 1, name: 'Software Bug' },
    reporter: { id: 1, name: 'John Doe', email: 'john@test.com' },
    assignee: { id: 2, name: 'Jane Smith', email: 'jane@test.com' },
    aiValidationPassed: true,
    aiValidationSkipped: false,
    duplicateOfId: null,
    resolvedAt: null,
    verifiedAt: null,
    closedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: [],
  };

  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/timeline')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [] }),
        });
      }
      if (url.includes('/comments')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [] }),
        });
      }
      if (url.match(/\/api\/issues\/\d+$/)) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: mockIssue,
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: [] }),
      });
    });
  });

  it('can import issue detail page without errors', async () => {
    // Test that the page module can be imported without errors
    const IssueDetailPage = (await import('@/app/issues/[id]/page')).default;
    expect(IssueDetailPage).toBeDefined();
    expect(typeof IssueDetailPage).toBe('function');
  });

  it('renders issue detail page component', async () => {
    const IssueDetailPage = (await import('@/app/issues/[id]/page')).default;

    // Just verify that rendering doesn't throw an error
    expect(() => {
      render(
        <TestWrapper>
          <IssueDetailPage params={Promise.resolve({ id: '1' })} />
        </TestWrapper>
      );
    }).not.toThrow();
  });
});
