/**
 * Unit tests for Quality Specifications Dashboard Page
 *
 * Tests the redesigned /quality/specs page with:
 * - 3 view modes (Grid, Cards, Analytics)
 * - 6 KPI stat cards
 * - Filter panel with search, status, and critical filters
 * - DevExtreme DataGrid with custom cell renderers
 * - PieCharts for status and critical distribution
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

// Mock DevExtreme components
vi.mock('devextreme-react/data-grid', () => ({
  default: ({ dataSource, children, onRowClick }: { dataSource: unknown[]; children: React.ReactNode; onRowClick?: (e: { data: unknown; rowType: string }) => void }) => (
    <div data-testid="dx-data-grid">
      <div data-testid="grid-row-count">{Array.isArray(dataSource) ? dataSource.length : 0} rows</div>
      {children}
    </div>
  ),
  Column: () => null,
  Paging: () => null,
  Pager: () => null,
  FilterRow: () => null,
  SearchPanel: () => null,
  HeaderFilter: () => null,
  Scrolling: () => null,
  Export: () => null,
}));

vi.mock('devextreme-react/pie-chart', () => ({
  PieChart: ({ dataSource }: { dataSource: unknown[] }) => (
    <div data-testid="dx-pie-chart">
      {Array.isArray(dataSource) ? dataSource.length : 0} data points
    </div>
  ),
  Series: () => null,
  Label: () => null,
  Legend: () => null,
  Tooltip: () => null,
  Connector: () => null,
}));

vi.mock('devextreme-react/select-box', () => ({
  SelectBox: ({ placeholder, onValueChanged }: { placeholder?: string; onValueChanged?: (e: { value: string }) => void }) => (
    <select
      data-testid={`select-${placeholder?.replace(/\s+/g, '-').toLowerCase() || 'box'}`}
      onChange={(e) => onValueChanged?.({ value: e.target.value })}
    >
      <option value="">All</option>
      <option value="true">True</option>
      <option value="false">False</option>
    </select>
  ),
}));

vi.mock('devextreme-react/text-box', () => ({
  TextBox: ({ placeholder, onValueChanged }: { placeholder?: string; onValueChanged?: (e: { value: string }) => void }) => (
    <input
      data-testid="search-textbox"
      placeholder={placeholder}
      onChange={(e) => onValueChanged?.({ value: e.target.value })}
    />
  ),
}));

// Mock DxButton
vi.mock('@/components/ui/dx-button', () => ({
  DxButton: ({ text, onClick, icon }: { text?: string; onClick?: () => void; icon?: string }) => (
    <button onClick={onClick} data-testid={`dx-button-${icon || text?.toLowerCase().replace(/\s+/g, '-')}`}>
      {text || icon}
    </button>
  ),
}));

// Mock shared components
vi.mock('@/components/shared', () => ({
  ResponsivePageHeader: ({ title, subtitle, actions }: { title: string; subtitle: string; actions?: React.ReactNode }) => (
    <div data-testid="page-header">
      <h1>{title}</h1>
      <p>{subtitle}</p>
      <div data-testid="page-header-actions">{actions}</div>
    </div>
  ),
  StatCard: ({ label, value, isLoading }: { label: string; value: number | string; isLoading?: boolean }) => (
    <div data-testid={`stat-card-${label.replace(/\s+/g, '-').toLowerCase()}`}>
      <span>{label}</span>
      <span>{isLoading ? 'Loading...' : value}</span>
    </div>
  ),
}));

// Mock exceljs and file-saver
vi.mock('exceljs', () => ({
  Workbook: vi.fn(() => ({
    addWorksheet: vi.fn(() => ({})),
    xlsx: { writeBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)) },
  })),
}));

vi.mock('file-saver', () => ({
  saveAs: vi.fn(),
}));

vi.mock('devextreme/excel_exporter', () => ({
  exportDataGrid: vi.fn().mockResolvedValue(undefined),
}));

// Import the component after mocks
import QualitySpecsPage from '@/app/quality/specs/page';

// Mock data
const mockSpecs = [
  {
    id: 1,
    itemId: 1,
    itemCode: 'RM-001',
    itemName: 'ฟ้าทะลายโจร',
    testName: 'Andrographolide Content',
    testMethod: 'HPLC',
    specification: '≥ 1.0%',
    minValue: 1.0,
    maxValue: null,
    unit: '%',
    isCritical: true,
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 2,
    itemId: 1,
    itemCode: 'RM-001',
    itemName: 'ฟ้าทะลายโจร',
    testName: 'Moisture Content',
    testMethod: 'LOD',
    specification: '≤ 10%',
    minValue: null,
    maxValue: 10,
    unit: '%',
    isCritical: false,
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 3,
    itemId: 2,
    itemCode: 'RM-002',
    itemName: 'ขิง',
    testName: 'Heavy Metals',
    testMethod: 'ICP-MS',
    specification: '≤ 10 ppm',
    minValue: null,
    maxValue: 10,
    unit: 'ppm',
    isCritical: true,
    isActive: false,
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 4,
    itemId: 3,
    itemCode: 'FG-001',
    itemName: 'ยาแคปซูลฟ้าทะลายโจร',
    testName: 'Dissolution',
    testMethod: 'USP',
    specification: '≥ 80% in 45 min',
    minValue: 80,
    maxValue: null,
    unit: '%',
    isCritical: false,
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
  },
];

// Setup fetch mock
const setupFetchMock = (specs = mockSpecs) => {
  global.fetch = vi.fn().mockResolvedValue({
    json: () => Promise.resolve({
      success: true,
      data: { items: specs, total: specs.length },
    }),
  });
};

// Create test wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  const TestWrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  TestWrapper.displayName = 'TestWrapper';
  return TestWrapper;
};

describe('QualitySpecsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupFetchMock();
  });

  describe('Page Rendering', () => {
    it('should render the page header with correct title', async () => {
      render(<QualitySpecsPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId('page-header')).toBeInTheDocument();
      });

      // Title from i18n: t('specifications.title') = 'Specifications'
      expect(screen.getByText('Specifications')).toBeInTheDocument();
    });

    it('should render the page header with correct subtitle', async () => {
      render(<QualitySpecsPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        // Subtitle from i18n: t('specifications.description') = 'Manage quality specifications'
        expect(screen.getByText('Manage quality specifications')).toBeInTheDocument();
      });
    });

    it('should render action buttons', async () => {
      render(<QualitySpecsPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId('dx-button-refresh')).toBeInTheDocument();
        expect(screen.getByTestId('dx-button-plus')).toBeInTheDocument();
      });
    });
  });

  describe('Stat Cards', () => {
    it('should render all 6 stat cards', async () => {
      render(<QualitySpecsPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        // Stat card testids from English i18n labels
        expect(screen.getByTestId('stat-card-total-specs')).toBeInTheDocument();
        expect(screen.getByTestId('stat-card-active')).toBeInTheDocument();
        expect(screen.getByTestId('stat-card-critical')).toBeInTheDocument();
        expect(screen.getByTestId('stat-card-non-critical')).toBeInTheDocument();
        expect(screen.getByTestId('stat-card-inactive')).toBeInTheDocument();
        expect(screen.getByTestId('stat-card-items-with-specs')).toBeInTheDocument();
      });
    });

    it('should display correct total count', async () => {
      render(<QualitySpecsPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        const totalCard = screen.getByTestId('stat-card-total-specs');
        expect(totalCard).toHaveTextContent('4');
      });
    });

    it('should display correct active count', async () => {
      render(<QualitySpecsPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        const activeCard = screen.getByTestId('stat-card-active');
        expect(activeCard).toHaveTextContent('3'); // 3 active specs
      });
    });

    it('should display correct critical count', async () => {
      render(<QualitySpecsPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        const criticalCard = screen.getByTestId('stat-card-critical');
        expect(criticalCard).toHaveTextContent('2'); // 2 critical specs
      });
    });

    it('should display correct inactive count', async () => {
      render(<QualitySpecsPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        const inactiveCard = screen.getByTestId('stat-card-inactive');
        expect(inactiveCard).toHaveTextContent('1'); // 1 inactive spec
      });
    });

    it('should display correct unique items count', async () => {
      render(<QualitySpecsPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        const itemsCard = screen.getByTestId('stat-card-items-with-specs');
        expect(itemsCard).toHaveTextContent('3'); // 3 unique items
      });
    });
  });

  describe('View Mode Toggle', () => {
    it('should render view mode toggle buttons', async () => {
      render(<QualitySpecsPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        // View mode labels from i18n: t('common.viewGrid/viewCards/viewAnalytics')
        expect(screen.getByText('Grid view')).toBeInTheDocument();
        expect(screen.getByText('Cards view')).toBeInTheDocument();
        expect(screen.getByText('Analytics view')).toBeInTheDocument();
      });
    });

    it('should start with Grid view as default', async () => {
      render(<QualitySpecsPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId('dx-data-grid')).toBeInTheDocument();
      });
    });

    it('should switch to Cards view when clicking Cards button', async () => {
      render(<QualitySpecsPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId('dx-data-grid')).toBeInTheDocument();
      });

      const cardsButton = screen.getByText('Cards view');
      fireEvent.click(cardsButton);

      await waitFor(() => {
        expect(screen.getByText('Items with Most Specifications')).toBeInTheDocument();
      });
    });

    it('should switch to Analytics view when clicking Analytics button', async () => {
      render(<QualitySpecsPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId('dx-data-grid')).toBeInTheDocument();
      });

      const analyticsButton = screen.getByText('Analytics view');
      fireEvent.click(analyticsButton);

      await waitFor(() => {
        expect(screen.getByText('Distribution by Status')).toBeInTheDocument();
        expect(screen.getByText('Distribution by Criticality')).toBeInTheDocument();
      });
    });
  });

  describe('Filter Panel', () => {
    it('should render search textbox', async () => {
      render(<QualitySpecsPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId('search-textbox')).toBeInTheDocument();
      });
    });

    it('should render status filter dropdown', async () => {
      render(<QualitySpecsPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId('select-status')).toBeInTheDocument();
      });
    });

    it('should render critical filter dropdown', async () => {
      render(<QualitySpecsPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId('select-type')).toBeInTheDocument();
      });
    });
  });

  describe('DataGrid View', () => {
    it('should render DataGrid component', async () => {
      render(<QualitySpecsPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId('dx-data-grid')).toBeInTheDocument();
      });
    });

    it('should display row count header', async () => {
      render(<QualitySpecsPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        // From i18n: t('specs.grid.specsCount', { count: 4 }) = '4 specifications'
        expect(screen.getByText('4 specifications')).toBeInTheDocument();
      });
    });
  });

  describe('Cards View', () => {
    it('should render top items section', async () => {
      render(<QualitySpecsPage />, { wrapper: createWrapper() });

      const cardsButton = screen.getByText('Cards view');
      fireEvent.click(cardsButton);

      await waitFor(() => {
        expect(screen.getByText('Items with Most Specifications')).toBeInTheDocument();
      });
    });

    it('should render spec cards', async () => {
      render(<QualitySpecsPage />, { wrapper: createWrapper() });

      const cardsButton = screen.getByText('Cards view');
      fireEvent.click(cardsButton);

      await waitFor(() => {
        expect(screen.getByText('Andrographolide Content')).toBeInTheDocument();
        expect(screen.getByText('Moisture Content')).toBeInTheDocument();
      });
    });
  });

  describe('Analytics View', () => {
    it('should render pie charts', async () => {
      render(<QualitySpecsPage />, { wrapper: createWrapper() });

      const analyticsButton = screen.getByText('Analytics view');
      fireEvent.click(analyticsButton);

      await waitFor(() => {
        const pieCharts = screen.getAllByTestId('dx-pie-chart');
        expect(pieCharts.length).toBeGreaterThanOrEqual(2);
      });
    });

    it('should render status summary section', async () => {
      render(<QualitySpecsPage />, { wrapper: createWrapper() });

      const analyticsButton = screen.getByText('Analytics view');
      fireEvent.click(analyticsButton);

      await waitFor(() => {
        expect(screen.getByText('Status Summary')).toBeInTheDocument();
      });
    });

    it('should render critical summary section', async () => {
      render(<QualitySpecsPage />, { wrapper: createWrapper() });

      const analyticsButton = screen.getByText('Analytics view');
      fireEvent.click(analyticsButton);

      await waitFor(() => {
        expect(screen.getByText('Criticality Summary')).toBeInTheDocument();
      });
    });

    it('should render quick actions section', async () => {
      render(<QualitySpecsPage />, { wrapper: createWrapper() });

      const analyticsButton = screen.getByText('Analytics view');
      fireEvent.click(analyticsButton);

      await waitFor(() => {
        expect(screen.getByText('Quick Actions')).toBeInTheDocument();
        expect(screen.getByText('Add New Specification')).toBeInTheDocument();
        expect(screen.getByText('Create New Test')).toBeInTheDocument();
      });
    });

    it('should render top items table', async () => {
      render(<QualitySpecsPage />, { wrapper: createWrapper() });

      const analyticsButton = screen.getByText('Analytics view');
      fireEvent.click(analyticsButton);

      await waitFor(() => {
        // There should be two "Items with Most Specifications" - one as chart title and one as table title
        const topItemsHeaders = screen.getAllByText('Items with Most Specifications');
        expect(topItemsHeaders.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('Navigation', () => {
    it('should navigate to new spec page when clicking New Spec button', async () => {
      render(<QualitySpecsPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByTestId('dx-button-plus')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('dx-button-plus'));

      expect(mockPush).toHaveBeenCalledWith('/quality/specs/new');
    });

    it('should navigate to new test page from quick actions', async () => {
      render(<QualitySpecsPage />, { wrapper: createWrapper() });

      const analyticsButton = screen.getByText('Analytics view');
      fireEvent.click(analyticsButton);

      await waitFor(() => {
        expect(screen.getByText('Create New Test')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Create New Test'));

      expect(mockPush).toHaveBeenCalledWith('/quality/tests/new');
    });
  });

  describe('Empty State', () => {
    it('should handle empty data gracefully', async () => {
      setupFetchMock([]);

      render(<QualitySpecsPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        const totalCard = screen.getByTestId('stat-card-total-specs');
        expect(totalCard).toHaveTextContent('0');
      });
    });
  });

  describe('API Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({
          success: false,
          error: 'Failed to fetch',
        }),
      });

      render(<QualitySpecsPage />, { wrapper: createWrapper() });

      await waitFor(() => {
        // Should still render the page structure
        expect(screen.getByTestId('page-header')).toBeInTheDocument();
      });
    });
  });
});
