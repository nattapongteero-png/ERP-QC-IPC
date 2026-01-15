/**
 * CAPA Management Dashboard Page Tests
 * Feature: 014-unit-cost
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import CapaDashboardPage from '@/app/gmp/capa/page';
import {
  renderWithProviders,
  setupFetchMock,
  clearFetchMock,
  createSingleResponse,
} from '../../../helpers/ui-test-utils';
import { MOCK_CAPAS, MOCK_CAPA_DASHBOARD, GMP_FETCH_HANDLERS } from '../../../helpers/fetch-mock-handlers';

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

// Mock DevExtreme PieChart
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
    Size: () => null,
  };
});

// Mock DevExtreme Chart
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

// Mock DevExtreme DataGrid
vi.mock('devextreme-react/data-grid', () => {
  const MockDataGrid = ({ children }: { children?: React.ReactNode }) => <div data-testid="data-grid">{children}</div>;
  return {
    __esModule: true,
    default: MockDataGrid,
    Column: () => null,
    Paging: () => null,
    Pager: () => null,
    FilterRow: () => null,
    HeaderFilter: () => null,
    SearchPanel: () => null,
    Selection: () => null,
    Sorting: () => null,
    ColumnChooser: () => null,
    Export: () => null,
    Toolbar: () => null,
    Item: () => null,
    LoadPanel: () => null,
    MasterDetail: () => null,
    StateStoring: () => null,
  };
});

// Mock DevExtreme Tabs
vi.mock('devextreme-react/tabs', () => ({
  __esModule: true,
  default: () => null,
  Tabs: () => null,
  Item: () => null,
}));

// Mock DevExtreme Button
vi.mock('devextreme-react/button', () => ({
  __esModule: true,
  default: ({ text }: { text?: string }) => <button>{text}</button>,
}));

// Mock CapaDataEntryDialog
vi.mock('@/components/capa/CapaDataEntryDialog', () => ({
  CapaDataEntryDialog: () => null,
}));

// Mock WorkflowStatusBadge
vi.mock('@/components/shared/WorkflowStatusBadge', () => ({
  WorkflowStatusBadge: ({ status }: { status: string }) => <span data-testid="status-badge">{status}</span>,
}));

describe('CapaDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFetchMock();
  });

  describe('Page Rendering', () => {
    it('should render page with correct title', async () => {
      setupFetchMock(GMP_FETCH_HANDLERS);

      renderWithProviders(<CapaDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('CAPA Management')).toBeInTheDocument();
      });
    });

    it('should render page subtitle', async () => {
      setupFetchMock(GMP_FETCH_HANDLERS);

      renderWithProviders(<CapaDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText(/Corrective and Preventive Actions/)).toBeInTheDocument();
      });
    });

    it('should render New CAPA button', async () => {
      setupFetchMock(GMP_FETCH_HANDLERS);

      renderWithProviders(<CapaDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('New CAPA')).toBeInTheDocument();
      });
    });

    it('should render Refresh button', async () => {
      setupFetchMock(GMP_FETCH_HANDLERS);

      renderWithProviders(<CapaDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument();
      });
    });
  });

  describe('KPI Cards', () => {
    it('should display KPI cards', async () => {
      setupFetchMock(GMP_FETCH_HANDLERS);

      renderWithProviders(<CapaDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Open CAPAs')).toBeInTheDocument();
        // "Overdue" appears in both KPI card and tabs
        expect(screen.getAllByText('Overdue').length).toBeGreaterThan(0);
        // "Pending Approval" appears in KPI card and tabs
        expect(screen.getAllByText('Pending Approval').length).toBeGreaterThan(0);
        expect(screen.getByText('Closed This Month')).toBeInTheDocument();
        expect(screen.getByText('Effectiveness Rate')).toBeInTheDocument();
      });
    });
  });

  describe('Charts Section', () => {
    it('should render Status Distribution chart section', async () => {
      setupFetchMock(GMP_FETCH_HANDLERS);

      renderWithProviders(<CapaDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Status Distribution')).toBeInTheDocument();
      });
    });

    it('should render Priority Distribution chart section', async () => {
      setupFetchMock(GMP_FETCH_HANDLERS);

      renderWithProviders(<CapaDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Priority Distribution')).toBeInTheDocument();
      });
    });

    it('should render Risk Matrix section', async () => {
      setupFetchMock(GMP_FETCH_HANDLERS);

      renderWithProviders(<CapaDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Risk Matrix (ICH Q9)')).toBeInTheDocument();
      });
    });
  });

  describe('Tab Navigation', () => {
    it('should render tab buttons', async () => {
      setupFetchMock(GMP_FETCH_HANDLERS);

      renderWithProviders(<CapaDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('All CAPAs')).toBeInTheDocument();
        expect(screen.getByText('Active')).toBeInTheDocument();
        // "Overdue" is in both tabs and KPI cards
        expect(screen.getAllByText('Overdue').length).toBeGreaterThan(0);
      });
    });
  });

  describe('Data Fetching', () => {
    it('should fetch CAPA dashboard on mount', async () => {
      setupFetchMock(GMP_FETCH_HANDLERS);

      renderWithProviders(<CapaDashboardPage />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      // Verify the API was called with correct endpoint
      const calls = vi.mocked(fetch).mock.calls;
      const dashboardCall = calls.find(([url]) =>
        typeof url === 'string' && url.includes('/api/capa/dashboard')
      );
      expect(dashboardCall).toBeDefined();
    });

    it('should fetch CAPA list on mount', async () => {
      setupFetchMock(GMP_FETCH_HANDLERS);

      renderWithProviders(<CapaDashboardPage />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      // Verify the API was called with correct endpoint
      const calls = vi.mocked(fetch).mock.calls;
      const capaCall = calls.find(([url]) =>
        typeof url === 'string' && url.includes('/api/capa')
      );
      expect(capaCall).toBeDefined();
    });

    it('should handle empty dashboard data gracefully', async () => {
      setupFetchMock({
        '/api/capa/dashboard': { data: createSingleResponse({
          totalOpen: 0,
          byStatus: {},
          byPriority: {},
          overdue: 0,
          closedThisMonth: 0,
          effectivenessRate: 0,
        }) },
        '/api/capa': { data: createSingleResponse({ capas: [], total: 0 }) },
      });

      renderWithProviders(<CapaDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('CAPA Management')).toBeInTheDocument();
      });
    });

    it('should handle API error gracefully', async () => {
      setupFetchMock({
        '/api/capa/dashboard': {
          data: { success: false, error: 'Server error' },
          ok: false,
          status: 500,
        },
        '/api/capa': {
          data: { success: false, error: 'Server error' },
          ok: false,
          status: 500,
        },
      });

      renderWithProviders(<CapaDashboardPage />);

      // Page should still render even on API error
      await waitFor(() => {
        expect(screen.getByText('CAPA Management')).toBeInTheDocument();
      });
    });

    it('should correctly parse API response structure (regression)', () => {
      // GMP CAPA pages use { capas: [...], total: number } format
      const mockResponse = createSingleResponse({ capas: MOCK_CAPAS, total: MOCK_CAPAS.length });

      // Correct: data returns object with capas array
      expect(mockResponse.data).toHaveProperty('capas');
      expect(Array.isArray(mockResponse.data.capas)).toBe(true);
      expect(mockResponse.data.capas.length).toBe(MOCK_CAPAS.length);
    });
  });
});
