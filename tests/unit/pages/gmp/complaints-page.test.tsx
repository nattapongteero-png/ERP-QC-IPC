/**
 * Complaints Dashboard Page Tests
 * Feature: 014-unit-cost
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import ComplaintsListPage from '@/app/gmp/complaints/page';
import {
  renderWithProviders,
  setupFetchMock,
  clearFetchMock,
  createSingleResponse,
} from '../../../helpers/ui-test-utils';
import { MOCK_COMPLAINTS, MOCK_COMPLAINTS_DASHBOARD, MOCK_COMPLAINTS_TRENDS, GMP_FETCH_HANDLERS } from '../../../helpers/fetch-mock-handlers';

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

// Mock shared components
vi.mock('@/components/shared', () => ({
  ResponsivePageHeader: ({ title, subtitle, actions }: { title: string; subtitle: string; actions?: React.ReactNode }) => (
    <div data-testid="responsive-header">
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {actions && <div data-testid="header-actions">{actions}</div>}
    </div>
  ),
  StatCard: ({ label, value }: { label: string; value: string | number }) => (
    <div data-testid="stat-card">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  ),
}));

// Mock UI components
vi.mock('@/components/ui/dx-button', () => ({
  DxButton: ({ text }: { text?: string }) => <button>{text}</button>,
}));

vi.mock('@/components/ui/dx-tabs', () => ({
  DxTabs: ({ items }: { items: Array<{ text: string }> }) => (
    <div data-testid="dx-tabs">
      {items.map((item, i) => <span key={i}>{item.text}</span>)}
    </div>
  ),
}));

// Mock complaints components
vi.mock('@/components/complaints', () => ({
  ComplaintList: () => <div data-testid="complaint-list" />,
  ComplaintDataEntryDialog: () => null,
}));

describe('ComplaintsListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFetchMock();
  });

  describe('Page Rendering', () => {
    it('should render page with correct title', async () => {
      setupFetchMock(GMP_FETCH_HANDLERS);

      renderWithProviders(<ComplaintsListPage />);

      await waitFor(() => {
        expect(screen.getByText('Complaint Management')).toBeInTheDocument();
      });
    });

    it('should render page subtitle', async () => {
      setupFetchMock(GMP_FETCH_HANDLERS);

      renderWithProviders(<ComplaintsListPage />);

      await waitFor(() => {
        expect(screen.getByText('Manage customer complaints')).toBeInTheDocument();
      });
    });

    it('should render New Complaint button', async () => {
      setupFetchMock(GMP_FETCH_HANDLERS);

      renderWithProviders(<ComplaintsListPage />);

      await waitFor(() => {
        expect(screen.getByText('New Complaint')).toBeInTheDocument();
      });
    });
  });

  describe('Statistics Display', () => {
    it('should display stat cards', async () => {
      setupFetchMock(GMP_FETCH_HANDLERS);

      renderWithProviders(<ComplaintsListPage />);

      await waitFor(() => {
        expect(screen.getByText('Total Open')).toBeInTheDocument();
        // "Received", "Investigating", "Resolved" appear in both stat cards and tabs
        expect(screen.getAllByText('Received').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Investigating').length).toBeGreaterThan(0);
        expect(screen.getByText('Critical')).toBeInTheDocument();
        expect(screen.getAllByText('Resolved').length).toBeGreaterThan(0);
        expect(screen.getByText('This Month')).toBeInTheDocument();
      });
    });
  });

  describe('Charts Section', () => {
    it('should render By Severity chart section', async () => {
      setupFetchMock(GMP_FETCH_HANDLERS);

      renderWithProviders(<ComplaintsListPage />);

      await waitFor(() => {
        expect(screen.getByText('By Severity')).toBeInTheDocument();
      });
    });

    it('should render By Status chart section', async () => {
      setupFetchMock(GMP_FETCH_HANDLERS);

      renderWithProviders(<ComplaintsListPage />);

      await waitFor(() => {
        expect(screen.getByText('By Status')).toBeInTheDocument();
      });
    });

    it('should render By Category chart section', async () => {
      setupFetchMock(GMP_FETCH_HANDLERS);

      renderWithProviders(<ComplaintsListPage />);

      await waitFor(() => {
        expect(screen.getByText('By Category')).toBeInTheDocument();
      });
    });

    it('should render Quick Summary section', async () => {
      setupFetchMock(GMP_FETCH_HANDLERS);

      renderWithProviders(<ComplaintsListPage />);

      await waitFor(() => {
        expect(screen.getByText('Quick Summary')).toBeInTheDocument();
      });
    });
  });

  describe('Tab Navigation', () => {
    it('should render status tabs', async () => {
      setupFetchMock(GMP_FETCH_HANDLERS);

      renderWithProviders(<ComplaintsListPage />);

      await waitFor(() => {
        expect(screen.getByTestId('dx-tabs')).toBeInTheDocument();
        expect(screen.getByText('All')).toBeInTheDocument();
      });
    });
  });

  describe('Data Fetching', () => {
    it('should fetch complaints dashboard on mount', async () => {
      setupFetchMock(GMP_FETCH_HANDLERS);

      renderWithProviders(<ComplaintsListPage />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      // Verify the API was called with correct endpoint
      const calls = vi.mocked(fetch).mock.calls;
      const dashboardCall = calls.find(([url]) =>
        typeof url === 'string' && url.includes('/api/complaints/dashboard')
      );
      expect(dashboardCall).toBeDefined();
    });

    it('should fetch complaint trends on mount', async () => {
      setupFetchMock(GMP_FETCH_HANDLERS);

      renderWithProviders(<ComplaintsListPage />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      // Verify the API was called with correct endpoint
      const calls = vi.mocked(fetch).mock.calls;
      const trendsCall = calls.find(([url]) =>
        typeof url === 'string' && url.includes('/api/complaints/trends')
      );
      expect(trendsCall).toBeDefined();
    });

    it('should handle empty dashboard data gracefully', async () => {
      setupFetchMock({
        '/api/complaints/dashboard': { data: createSingleResponse({
          totalOpen: 0,
          byStatus: {},
          bySeverity: {},
          pendingInvestigation: 0,
          resolvedThisMonth: 0,
          criticalCount: 0,
        }) },
        '/api/complaints/trends': { data: createSingleResponse({ dataPoints: [], byCategory: {}, period: 'Monthly' }) },
      });

      renderWithProviders(<ComplaintsListPage />);

      await waitFor(() => {
        expect(screen.getByText('Complaint Management')).toBeInTheDocument();
      });
    });

    it('should handle API error gracefully', async () => {
      setupFetchMock({
        '/api/complaints/dashboard': {
          data: { success: false, error: 'Server error' },
          ok: false,
          status: 500,
        },
        '/api/complaints/trends': {
          data: { success: false, error: 'Server error' },
          ok: false,
          status: 500,
        },
      });

      renderWithProviders(<ComplaintsListPage />);

      // Page should still render even on API error
      await waitFor(() => {
        expect(screen.getByText('Complaint Management')).toBeInTheDocument();
      });
    });

    it('should correctly parse API response structure (regression)', () => {
      // Complaints dashboard uses specific format
      const dashboardResponse = createSingleResponse(MOCK_COMPLAINTS_DASHBOARD);

      // Correct: data returns dashboard object
      expect(dashboardResponse.data).toHaveProperty('totalOpen');
      expect(dashboardResponse.data).toHaveProperty('byStatus');
      expect(dashboardResponse.data).toHaveProperty('bySeverity');
    });
  });

  describe('Severity Summary', () => {
    it('should display severity breakdown', async () => {
      setupFetchMock(GMP_FETCH_HANDLERS);

      renderWithProviders(<ComplaintsListPage />);

      await waitFor(() => {
        expect(screen.getByText('Minor Severity')).toBeInTheDocument();
        expect(screen.getByText('Major Severity')).toBeInTheDocument();
        expect(screen.getByText('Critical Severity')).toBeInTheDocument();
      });
    });
  });

  describe('Complaint List Component', () => {
    it('should render complaint list component', async () => {
      setupFetchMock(GMP_FETCH_HANDLERS);

      renderWithProviders(<ComplaintsListPage />);

      await waitFor(() => {
        expect(screen.getByTestId('complaint-list')).toBeInTheDocument();
      });
    });
  });
});
