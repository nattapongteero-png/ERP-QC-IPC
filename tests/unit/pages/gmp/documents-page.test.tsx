/**
 * GMP Document Control Dashboard Page Tests
 * Feature: 014-unit-cost
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import GmpDocumentsDashboardPage from '@/app/gmp/documents/page';
import {
  renderWithProviders,
  setupFetchMock,
  clearFetchMock,
  createSingleResponse,
} from '../../../helpers/ui-test-utils';
import { MOCK_DOCUMENTS, MOCK_DOCUMENTS_DASHBOARD, MOCK_DOCUMENT_TYPES, MOCK_PENDING_APPROVALS, GMP_FETCH_HANDLERS } from '../../../helpers/fetch-mock-handlers';

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

// Mock DevExtreme Button
vi.mock('devextreme-react/button', () => ({
  __esModule: true,
  default: ({ text }: { text?: string }) => <button>{text}</button>,
}));

// Mock DocumentApprovalDialog
vi.mock('@/components/documents', () => ({
  DocumentApprovalDialog: () => null,
}));

// Mock WorkflowStatusBadge
vi.mock('@/components/shared/WorkflowStatusBadge', () => ({
  WorkflowStatusBadge: ({ status }: { status: string }) => <span data-testid="status-badge">{status}</span>,
}));

describe('GmpDocumentsDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFetchMock();
  });

  describe('Page Rendering', () => {
    it('should render page with correct title', async () => {
      setupFetchMock(GMP_FETCH_HANDLERS);

      renderWithProviders(<GmpDocumentsDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('GMP Document Control')).toBeInTheDocument();
      });
    });

    it('should render page subtitle', async () => {
      setupFetchMock(GMP_FETCH_HANDLERS);

      renderWithProviders(<GmpDocumentsDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText(/Manage controlled documents/)).toBeInTheDocument();
      });
    });

    it('should render New Document button', async () => {
      setupFetchMock(GMP_FETCH_HANDLERS);

      renderWithProviders(<GmpDocumentsDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('New Document')).toBeInTheDocument();
      });
    });

    it('should render Refresh button', async () => {
      setupFetchMock(GMP_FETCH_HANDLERS);

      renderWithProviders(<GmpDocumentsDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument();
      });
    });
  });

  describe('KPI Cards', () => {
    it('should display KPI cards', async () => {
      setupFetchMock(GMP_FETCH_HANDLERS);

      renderWithProviders(<GmpDocumentsDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Total Documents')).toBeInTheDocument();
        // "Active" appears in tabs and KPI cards
        expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
        // "Draft" appears in tabs and KPI cards
        expect(screen.getAllByText('Draft').length).toBeGreaterThan(0);
        expect(screen.getByText('Pending Approvals')).toBeInTheDocument();
        expect(screen.getByText('Up for Review')).toBeInTheDocument();
      });
    });
  });

  describe('Charts Section', () => {
    it('should render Status Distribution chart section', async () => {
      setupFetchMock(GMP_FETCH_HANDLERS);

      renderWithProviders(<GmpDocumentsDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Status Distribution')).toBeInTheDocument();
      });
    });

    it('should render Documents by Type chart section', async () => {
      setupFetchMock(GMP_FETCH_HANDLERS);

      renderWithProviders(<GmpDocumentsDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Documents by Type')).toBeInTheDocument();
      });
    });
  });

  describe('Tab Navigation', () => {
    it('should render tab buttons', async () => {
      setupFetchMock(GMP_FETCH_HANDLERS);

      renderWithProviders(<GmpDocumentsDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('All Documents')).toBeInTheDocument();
        // Active, Draft appear in both tabs and KPI cards
        expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Draft').length).toBeGreaterThan(0);
        expect(screen.getByText('Pending Review')).toBeInTheDocument();
        expect(screen.getByText('Obsolete/Archived')).toBeInTheDocument();
      });
    });
  });

  describe('Data Fetching', () => {
    it('should fetch documents dashboard on mount', async () => {
      setupFetchMock(GMP_FETCH_HANDLERS);

      renderWithProviders(<GmpDocumentsDashboardPage />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      // Verify the API was called with correct endpoint
      const calls = vi.mocked(fetch).mock.calls;
      const dashboardCall = calls.find(([url]) =>
        typeof url === 'string' && url.includes('/api/documents/dashboard')
      );
      expect(dashboardCall).toBeDefined();
    });

    it('should fetch documents list on mount', async () => {
      setupFetchMock(GMP_FETCH_HANDLERS);

      renderWithProviders(<GmpDocumentsDashboardPage />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      // Verify the API was called with correct endpoint
      const calls = vi.mocked(fetch).mock.calls;
      const docsCall = calls.find(([url]) =>
        typeof url === 'string' && url.includes('/api/documents')
      );
      expect(docsCall).toBeDefined();
    });

    it('should fetch document types on mount', async () => {
      setupFetchMock(GMP_FETCH_HANDLERS);

      renderWithProviders(<GmpDocumentsDashboardPage />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      // Verify the API was called with correct endpoint
      const calls = vi.mocked(fetch).mock.calls;
      const typesCall = calls.find(([url]) =>
        typeof url === 'string' && url.includes('/api/documents/types')
      );
      expect(typesCall).toBeDefined();
    });

    it('should fetch pending approvals on mount', async () => {
      setupFetchMock(GMP_FETCH_HANDLERS);

      renderWithProviders(<GmpDocumentsDashboardPage />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      // Verify the API was called with correct endpoint
      const calls = vi.mocked(fetch).mock.calls;
      const approvalsCall = calls.find(([url]) =>
        typeof url === 'string' && url.includes('/api/documents/approvals')
      );
      expect(approvalsCall).toBeDefined();
    });

    it('should handle empty dashboard data gracefully', async () => {
      setupFetchMock({
        '/api/documents/dashboard': { data: createSingleResponse({
          total: 0,
          byStatus: {},
          byType: {},
          pendingApprovals: 0,
          upForReview: 0,
        }) },
        '/api/documents': { data: createSingleResponse({ documents: [], total: 0 }) },
        '/api/documents/types': { data: createSingleResponse([]) },
        '/api/documents/approvals': { data: createSingleResponse([]) },
      });

      renderWithProviders(<GmpDocumentsDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('GMP Document Control')).toBeInTheDocument();
      });
    });

    it('should handle API error gracefully', async () => {
      setupFetchMock({
        '/api/documents/dashboard': {
          data: { success: false, error: 'Server error' },
          ok: false,
          status: 500,
        },
        '/api/documents': {
          data: { success: false, error: 'Server error' },
          ok: false,
          status: 500,
        },
        '/api/documents/types': {
          data: { success: false, error: 'Server error' },
          ok: false,
          status: 500,
        },
        '/api/documents/approvals': {
          data: { success: false, error: 'Server error' },
          ok: false,
          status: 500,
        },
      });

      renderWithProviders(<GmpDocumentsDashboardPage />);

      // Page should still render even on API error
      await waitFor(() => {
        expect(screen.getByText('GMP Document Control')).toBeInTheDocument();
      });
    });

    it('should correctly parse API response structure (regression)', () => {
      // Documents pages use { documents: [...], total: number } format
      const docsResponse = createSingleResponse({ documents: MOCK_DOCUMENTS, total: MOCK_DOCUMENTS.length });

      // Correct: data returns object with documents array
      expect(docsResponse.data).toHaveProperty('documents');
      expect(Array.isArray(docsResponse.data.documents)).toBe(true);
      expect(docsResponse.data.documents.length).toBe(MOCK_DOCUMENTS.length);

      // Dashboard response
      const dashboardResponse = createSingleResponse(MOCK_DOCUMENTS_DASHBOARD);
      expect(dashboardResponse.data).toHaveProperty('total');
      expect(dashboardResponse.data).toHaveProperty('byStatus');
      expect(dashboardResponse.data).toHaveProperty('byType');
    });
  });

  describe('Pending Approvals Section', () => {
    it('should display pending approvals when available', async () => {
      setupFetchMock(GMP_FETCH_HANDLERS);

      renderWithProviders(<GmpDocumentsDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Documents Awaiting Your Approval')).toBeInTheDocument();
      });
    });

    it('should not display pending approvals when empty', async () => {
      setupFetchMock({
        ...GMP_FETCH_HANDLERS,
        '/api/documents/approvals': { data: createSingleResponse([]) },
      });

      renderWithProviders(<GmpDocumentsDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('GMP Document Control')).toBeInTheDocument();
      });

      // Wait a bit for approvals data to load
      await new Promise(resolve => setTimeout(resolve, 500));

      // Pending approvals section should not appear
      expect(screen.queryByText('Documents Awaiting Your Approval')).not.toBeInTheDocument();
    });
  });

  describe('DataGrid Section', () => {
    it('should render data grid component', async () => {
      setupFetchMock(GMP_FETCH_HANDLERS);

      renderWithProviders(<GmpDocumentsDashboardPage />);

      await waitFor(() => {
        expect(screen.getByTestId('data-grid')).toBeInTheDocument();
      });
    });
  });
});
