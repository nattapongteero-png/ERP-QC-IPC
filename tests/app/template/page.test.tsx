// Template Module UI Tests
// Ensures template pages render without runtime errors

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock DevExtreme charts (require canvas which jsdom doesn't support)
const MockPieChart = ({ children }: { children?: React.ReactNode }) => (
  <div data-testid="mock-pie-chart">{children}</div>
);

const MockChart = ({ children }: { children?: React.ReactNode }) => (
  <div data-testid="mock-chart">{children}</div>
);

vi.mock('devextreme-react/pie-chart', () => ({
  default: MockPieChart,
  PieChart: MockPieChart,
  Series: () => null,
  Label: () => null,
  Legend: () => null,
  Tooltip: () => null,
  Connector: () => null,
}));

vi.mock('devextreme-react/chart', () => ({
  default: MockChart,
  Chart: MockChart,
  CommonSeriesSettings: () => null,
  Series: () => null,
  ArgumentAxis: () => null,
  ValueAxis: () => null,
  Legend: () => null,
  Tooltip: () => null,
}));

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => '/template',
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

describe('Template Dashboard Page', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    // Mock dashboard metrics response
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          totalItems: 100,
          activeItems: 75,
          draftItems: 20,
          archivedItems: 5,
          totalValue: 1500000,
          avgUnitPrice: 15000,
          itemsByStatus: [
            { status: 'active', count: 75 },
            { status: 'draft', count: 20 },
            { status: 'archived', count: 5 },
          ],
          itemsByPriority: [
            { priority: 'low', count: 30 },
            { priority: 'medium', count: 50 },
            { priority: 'high', count: 15 },
            { priority: 'urgent', count: 5 },
          ],
          itemsByCategory: [
            { categoryId: 1, categoryName: 'Category A', count: 40, value: 600000 },
            { categoryId: 2, categoryName: 'Category B', count: 35, value: 500000 },
          ],
          recentItems: [
            {
              id: 1,
              code: 'ITEM-001',
              nameTh: 'Test Item 1',
              status: 'active',
              priority: 'medium',
              totalValue: 10000,
            },
          ],
          monthlyTrend: [
            { month: 'Jan', count: 20, value: 200000 },
            { month: 'Feb', count: 25, value: 250000 },
          ],
        },
      }),
    });
  });

  it('renders dashboard page without crashing', async () => {
    const TemplateDashboardPage = (await import('@/app/template/page')).default;

    render(
      <TestWrapper>
        <TemplateDashboardPage />
      </TestWrapper>
    );

    // Check that the page title is rendered
    expect(screen.getByText('Template Dashboard')).toBeInTheDocument();
    expect(screen.getByText('ERP Module Prototype')).toBeInTheDocument();
  });

  it('renders KPI cards section', async () => {
    const TemplateDashboardPage = (await import('@/app/template/page')).default;

    render(
      <TestWrapper>
        <TemplateDashboardPage />
      </TestWrapper>
    );

    // Wait for data to load and check for KPI labels
    await waitFor(() => {
      expect(screen.getAllByText('Total Items').length).toBeGreaterThan(0);
    }, { timeout: 3000 });

    await waitFor(() => {
      expect(screen.getAllByText('Active Items').length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });

  it('renders quick access links', async () => {
    const TemplateDashboardPage = (await import('@/app/template/page')).default;

    render(
      <TestWrapper>
        <TemplateDashboardPage />
      </TestWrapper>
    );

    // Check for quick access section
    expect(screen.getByText('Quick Access')).toBeInTheDocument();
    expect(screen.getByText('All Items')).toBeInTheDocument();
    // Use getAllByText since there may be multiple "New Item" buttons
    expect(screen.getAllByText('New Item').length).toBeGreaterThan(0);
  });
});

describe('Template Items List Page', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    // Mock items list response
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/template/items')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: {
              items: [
                {
                  id: 1,
                  code: 'ITEM-001',
                  nameTh: 'Test Item 1',
                  nameEn: 'Test Item 1 EN',
                  status: 'active',
                  priority: 'medium',
                  quantity: 100,
                  unitPrice: 150,
                  totalValue: 15000,
                  category: { id: 1, nameTh: 'Category A' },
                },
                {
                  id: 2,
                  code: 'ITEM-002',
                  nameTh: 'Test Item 2',
                  nameEn: 'Test Item 2 EN',
                  status: 'draft',
                  priority: 'high',
                  quantity: 50,
                  unitPrice: 200,
                  totalValue: 10000,
                  category: { id: 2, nameTh: 'Category B' },
                },
              ],
              total: 2,
              page: 1,
              limit: 50,
              totalPages: 1,
            },
          }),
        });
      }
      if (url.includes('/api/template/categories')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: [
              { id: 1, code: 'CAT-A', nameTh: 'Category A' },
              { id: 2, code: 'CAT-B', nameTh: 'Category B' },
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

  it('renders items list page without crashing', async () => {
    const TemplateItemsPage = (await import('@/app/template/items/page')).default;

    render(
      <TestWrapper>
        <TemplateItemsPage />
      </TestWrapper>
    );

    // Check that the page title is rendered
    expect(screen.getByText('Template Items')).toBeInTheDocument();
    expect(screen.getByText('Manage all items in the system')).toBeInTheDocument();
  });

  it('renders filter section', async () => {
    const TemplateItemsPage = (await import('@/app/template/items/page')).default;

    render(
      <TestWrapper>
        <TemplateItemsPage />
      </TestWrapper>
    );

    // Check for filter elements
    expect(screen.getByText('Filters:')).toBeInTheDocument();
  });
});

describe('Template New Item Page', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    // Mock categories response
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 1, code: 'CAT-A', nameTh: 'Category A' },
          { id: 2, code: 'CAT-B', nameTh: 'Category B' },
        ],
      }),
    });
  });

  it('renders new item form without crashing', async () => {
    const TemplateNewItemPage = (await import('@/app/template/items/new/page')).default;

    render(
      <TestWrapper>
        <TemplateNewItemPage />
      </TestWrapper>
    );

    // Check that the form elements are rendered
    expect(screen.getByText('Create New Item')).toBeInTheDocument();
    expect(screen.getByText('Basic Information')).toBeInTheDocument();
    expect(screen.getByText('Status & Priority')).toBeInTheDocument();
  });

  it('renders form fields', async () => {
    const TemplateNewItemPage = (await import('@/app/template/items/new/page')).default;

    render(
      <TestWrapper>
        <TemplateNewItemPage />
      </TestWrapper>
    );

    // Check for form field labels
    expect(screen.getByText('Code')).toBeInTheDocument();
    expect(screen.getByText('Name (Thai)')).toBeInTheDocument();
    expect(screen.getByText('Category')).toBeInTheDocument();
    expect(screen.getByText('Quantity & Pricing')).toBeInTheDocument();
  });
});
