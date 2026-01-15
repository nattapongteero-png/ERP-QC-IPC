/**
 * Work Orders List Page Tests
 * Feature: 014-unit-cost
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import WorkOrdersPage from '@/app/production/work-orders/page';
import {
  renderWithProviders,
  setupFetchMock,
  clearFetchMock,
  createPaginatedResponse,
} from '../../../helpers/ui-test-utils';
import { MOCK_WORK_ORDERS, PRODUCTION_FETCH_HANDLERS } from '../../../helpers/fetch-mock-handlers';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
}));

// Mock MainLayout
vi.mock('@/components/layout/main-layout', () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="main-layout">{children}</div>,
}));

// Mock DevExtreme PieChart - the component uses named import PieChart
vi.mock('devextreme-react/pie-chart', () => {
  const MockPieChart = ({ children }: { children?: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>;
  return {
    __esModule: true,
    default: MockPieChart,
    PieChart: MockPieChart,
    Series: () => null,
    Label: () => null,
    Legend: () => null,
    Tooltip: () => null,
    Connector: () => null,
  };
});

// Mock DevExtreme Chart - the component uses named import Chart
vi.mock('devextreme-react/chart', () => {
  const MockChart = ({ children }: { children?: React.ReactNode }) => <div data-testid="chart">{children}</div>;
  return {
    __esModule: true,
    default: MockChart,
    Chart: MockChart,
    CommonSeriesSettings: () => null,
    Series: () => null,
    ArgumentAxis: () => null,
    ValueAxis: () => null,
    Legend: () => null,
    Tooltip: () => null,
    Label: () => null,
  };
});

// Mock exceljs
vi.mock('exceljs', () => ({
  Workbook: vi.fn().mockImplementation(() => ({
    addWorksheet: vi.fn().mockReturnValue({}),
    xlsx: { writeBuffer: vi.fn().mockResolvedValue(Buffer.from('')) },
  })),
}));

// Mock file-saver
vi.mock('file-saver', () => ({
  saveAs: vi.fn(),
}));

// Mock devextreme/excel_exporter
vi.mock('devextreme/excel_exporter', () => ({
  exportDataGrid: vi.fn().mockResolvedValue({}),
}));

describe('WorkOrdersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFetchMock();
  });

  describe('Page Rendering', () => {
    it('should render page with correct title', async () => {
      setupFetchMock(PRODUCTION_FETCH_HANDLERS);

      renderWithProviders(<WorkOrdersPage />);

      await waitFor(() => {
        // Multiple elements contain "Work Orders" (breadcrumb + title), use getAllByText
        expect(screen.getAllByText('Work Orders').length).toBeGreaterThan(0);
      });
    });

    it('should render page subtitle', async () => {
      setupFetchMock(PRODUCTION_FETCH_HANDLERS);

      renderWithProviders(<WorkOrdersPage />);

      await waitFor(() => {
        expect(screen.getByText(/Production Management/)).toBeInTheDocument();
      });
    });

    it('should render New Work Order button', async () => {
      setupFetchMock(PRODUCTION_FETCH_HANDLERS);

      renderWithProviders(<WorkOrdersPage />);

      await waitFor(() => {
        expect(screen.getByText('New Work Order')).toBeInTheDocument();
      });
    });

    it('should render Analytics button', async () => {
      setupFetchMock(PRODUCTION_FETCH_HANDLERS);

      renderWithProviders(<WorkOrdersPage />);

      await waitFor(() => {
        expect(screen.getByText('Analytics')).toBeInTheDocument();
      });
    });

    it('should render status tabs', async () => {
      setupFetchMock(PRODUCTION_FETCH_HANDLERS);

      renderWithProviders(<WorkOrdersPage />);

      await waitFor(() => {
        // These status texts may appear multiple times (tabs + cards), use getAllByText
        expect(screen.getAllByText('All').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Planned').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Released').length).toBeGreaterThan(0);
        expect(screen.getAllByText('In Progress').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Completed').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Cancelled').length).toBeGreaterThan(0);
      });
    });
  });

  describe('Statistics Display', () => {
    it('should display stat cards', async () => {
      setupFetchMock(PRODUCTION_FETCH_HANDLERS);

      renderWithProviders(<WorkOrdersPage />);

      await waitFor(() => {
        expect(screen.getByText('Total Orders')).toBeInTheDocument();
        expect(screen.getByText('High Priority')).toBeInTheDocument();
        expect(screen.getByText('Today')).toBeInTheDocument();
        expect(screen.getByText('Avg Yield')).toBeInTheDocument();
      });
    });
  });

  describe('Data Fetching', () => {
    it('should fetch work orders on mount', async () => {
      setupFetchMock(PRODUCTION_FETCH_HANDLERS);

      renderWithProviders(<WorkOrdersPage />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      // Verify the API was called with correct endpoint
      const calls = vi.mocked(fetch).mock.calls;
      const workOrdersCall = calls.find(([url]) =>
        typeof url === 'string' && url.includes('/api/production/work-orders')
      );
      expect(workOrdersCall).toBeDefined();
    });

    it('should handle empty data gracefully', async () => {
      setupFetchMock({
        '/api/production/work-orders': { data: createPaginatedResponse([]) },
      });

      renderWithProviders(<WorkOrdersPage />);

      await waitFor(() => {
        expect(screen.getAllByText('Work Orders').length).toBeGreaterThan(0);
      });
    });

    it('should handle API error gracefully', async () => {
      setupFetchMock({
        '/api/production/work-orders': {
          data: { success: false, error: 'Server error' },
          ok: false,
          status: 500,
        },
      });

      renderWithProviders(<WorkOrdersPage />);

      // Page should still render even on API error
      await waitFor(() => {
        expect(screen.getAllByText('Work Orders').length).toBeGreaterThan(0);
      });
    });

    it('should correctly parse paginated response structure (regression)', () => {
      // Verify the API response structure used by the page
      const mockResponse = createPaginatedResponse(MOCK_WORK_ORDERS);

      // Correct: data.items returns the array
      expect(Array.isArray(mockResponse.data.items)).toBe(true);

      // Wrong: data should NOT be treated as an array
      expect(Array.isArray(mockResponse.data)).toBe(false);
      expect(mockResponse.data).toHaveProperty('items');
      expect(mockResponse.data).toHaveProperty('total');
    });
  });

  describe('Charts Display', () => {
    it('should render status chart section', async () => {
      setupFetchMock(PRODUCTION_FETCH_HANDLERS);

      renderWithProviders(<WorkOrdersPage />);

      await waitFor(() => {
        expect(screen.getByText('By Status')).toBeInTheDocument();
      });
    });

    it('should render priority chart section', async () => {
      setupFetchMock(PRODUCTION_FETCH_HANDLERS);

      renderWithProviders(<WorkOrdersPage />);

      await waitFor(() => {
        expect(screen.getByText('Active Orders by Priority')).toBeInTheDocument();
      });
    });

    it('should render performance section', async () => {
      setupFetchMock(PRODUCTION_FETCH_HANDLERS);

      renderWithProviders(<WorkOrdersPage />);

      await waitFor(() => {
        expect(screen.getByText('Performance')).toBeInTheDocument();
        expect(screen.getByText('Completion Rate')).toBeInTheDocument();
        expect(screen.getByText('Active Orders')).toBeInTheDocument();
        expect(screen.getByText('Average Yield')).toBeInTheDocument();
      });
    });
  });
});
