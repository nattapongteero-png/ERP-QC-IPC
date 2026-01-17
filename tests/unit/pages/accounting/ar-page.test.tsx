/**
 * AR Dashboard Page Tests
 * Feature: 014-unit-cost
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import ARDashboardPage from '@/app/accounting/ar/page';
import {
  renderWithProviders,
  setupFetchMock,
  clearFetchMock,
  createSingleResponse,
} from '../../../helpers/ui-test-utils';
import { ACCOUNTING_FETCH_HANDLERS } from '../../../helpers/fetch-mock-handlers';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
}));

// Mock recharts
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  BarChart: ({ children }: { children?: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  FileText: () => <span data-testid="icon-file-text" />,
  AlertTriangle: () => <span data-testid="icon-alert" />,
  TrendingUp: () => <span data-testid="icon-trending" />,
  BarChart3: () => <span data-testid="icon-barchart" />,
  ChevronRight: () => <span data-testid="icon-chevron" />,
  Users: () => <span data-testid="icon-users" />,
  Banknote: () => <span data-testid="icon-banknote" />,
}));

// Mock accounting components
vi.mock('@/components/accounting', () => ({
  AccountingPageHeader: ({ title, subtitle, onRefresh }: { title: string; subtitle: string; onRefresh?: () => void }) => (
    <div data-testid="accounting-header">
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {onRefresh && <button onClick={onRefresh}>Refresh</button>}
    </div>
  ),
  AccountingKPICard: ({ label, value, subtitle }: { label: string; value: string | number; subtitle?: string }) => (
    <div data-testid={`kpi-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <span>{label}</span>
      <span>{value}</span>
      {subtitle && <span>{subtitle}</span>}
    </div>
  ),
  AccountingKPICardSkeleton: () => <div data-testid="kpi-skeleton">Loading...</div>,
  AccountingStatusBadge: ({ status }: { status: string }) => <span data-testid="status-badge">{status}</span>,
}));

// Mock Card components
vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children?: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }: { children?: React.ReactNode }) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: { children?: React.ReactNode }) => <h3 data-testid="card-title">{children}</h3>,
  CardContent: ({ children }: { children?: React.ReactNode }) => <div data-testid="card-content">{children}</div>,
}));

describe('ARDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFetchMock();
  });

  describe('Page Rendering', () => {
    it('should render page with correct title', async () => {
      setupFetchMock(ACCOUNTING_FETCH_HANDLERS);

      renderWithProviders(<ARDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Accounts Receivable Dashboard')).toBeInTheDocument();
      });
    });

    it('should render page subtitle', async () => {
      setupFetchMock(ACCOUNTING_FETCH_HANDLERS);

      renderWithProviders(<ARDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Manage customer invoices and collections')).toBeInTheDocument();
      });
    });

    it('should render the AR dashboard container', async () => {
      setupFetchMock(ACCOUNTING_FETCH_HANDLERS);

      renderWithProviders(<ARDashboardPage />);

      await waitFor(() => {
        expect(screen.getByTestId('ar-dashboard')).toBeInTheDocument();
      });
    });
  });

  describe('KPI Cards', () => {
    it('should display Total Receivables KPI', async () => {
      setupFetchMock(ACCOUNTING_FETCH_HANDLERS);

      renderWithProviders(<ARDashboardPage />);

      await waitFor(() => {
        expect(screen.getByTestId('kpi-total-receivables')).toBeInTheDocument();
      });
    });

    it('should display Pending Invoices KPI', async () => {
      setupFetchMock(ACCOUNTING_FETCH_HANDLERS);

      renderWithProviders(<ARDashboardPage />);

      await waitFor(() => {
        expect(screen.getByTestId('kpi-pending-invoices')).toBeInTheDocument();
      });
    });

    it('should display Overdue Amount KPI', async () => {
      setupFetchMock(ACCOUNTING_FETCH_HANDLERS);

      renderWithProviders(<ARDashboardPage />);

      await waitFor(() => {
        expect(screen.getByTestId('kpi-overdue-amount')).toBeInTheDocument();
      });
    });

    it('should display Collected This Month KPI', async () => {
      setupFetchMock(ACCOUNTING_FETCH_HANDLERS);

      renderWithProviders(<ARDashboardPage />);

      await waitFor(() => {
        expect(screen.getByTestId('kpi-collected-this-month')).toBeInTheDocument();
      });
    });
  });

  describe('Quick Navigation', () => {
    it('should render Quick Access section', async () => {
      setupFetchMock(ACCOUNTING_FETCH_HANDLERS);

      renderWithProviders(<ARDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Quick Access')).toBeInTheDocument();
      });
    });

    it('should render AR Invoices link', async () => {
      setupFetchMock(ACCOUNTING_FETCH_HANDLERS);

      renderWithProviders(<ARDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('AR Invoices')).toBeInTheDocument();
        expect(screen.getByText('Manage customer invoices and billing')).toBeInTheDocument();
      });
    });

    it('should render Receipts link', async () => {
      setupFetchMock(ACCOUNTING_FETCH_HANDLERS);

      renderWithProviders(<ARDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Receipts')).toBeInTheDocument();
        expect(screen.getByText('Record and track customer payments')).toBeInTheDocument();
      });
    });

    it('should render Aging Report link', async () => {
      setupFetchMock(ACCOUNTING_FETCH_HANDLERS);

      renderWithProviders(<ARDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Aging Report')).toBeInTheDocument();
        expect(screen.getByText('View receivables aging analysis')).toBeInTheDocument();
      });
    });
  });

  describe('Charts Section', () => {
    it('should render AR Aging Summary chart', async () => {
      setupFetchMock(ACCOUNTING_FETCH_HANDLERS);

      renderWithProviders(<ARDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('AR Aging Summary')).toBeInTheDocument();
      });
    });

    it('should render bar chart component', async () => {
      setupFetchMock(ACCOUNTING_FETCH_HANDLERS);

      renderWithProviders(<ARDashboardPage />);

      await waitFor(() => {
        expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
      });
    });
  });

  describe('Recent Invoices', () => {
    it('should render Recent AR Invoices section', async () => {
      setupFetchMock(ACCOUNTING_FETCH_HANDLERS);

      renderWithProviders(<ARDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Recent AR Invoices')).toBeInTheDocument();
      });
    });
  });

  describe('Data Fetching', () => {
    it('should fetch AR invoices on mount', async () => {
      setupFetchMock(ACCOUNTING_FETCH_HANDLERS);

      renderWithProviders(<ARDashboardPage />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      const calls = vi.mocked(fetch).mock.calls;
      const arCall = calls.find(([url]) =>
        typeof url === 'string' && url.includes('/api/accounting/ar-invoices')
      );
      expect(arCall).toBeDefined();
    });

    it('should handle empty invoices gracefully', async () => {
      setupFetchMock({
        '/api/accounting/ar-invoices': { data: createSingleResponse([]) },
        '/api/accounting/reports/aging': { data: createSingleResponse({ totals: {} }) },
      });

      renderWithProviders(<ARDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Accounts Receivable Dashboard')).toBeInTheDocument();
      });
    });

    it('should handle API error gracefully', async () => {
      setupFetchMock({
        '/api/accounting/ar-invoices': {
          data: { success: false, error: 'Server error' },
          ok: false,
          status: 500,
        },
        '/api/accounting/reports/aging': {
          data: { success: false, error: 'Server error' },
          ok: false,
          status: 500,
        },
      });

      renderWithProviders(<ARDashboardPage />);

      // Page should still render even on API error
      await waitFor(() => {
        expect(screen.getByText('Accounts Receivable Dashboard')).toBeInTheDocument();
      });
    });
  });

  describe('Summary Footer', () => {
    it('should display Total Outstanding', async () => {
      setupFetchMock(ACCOUNTING_FETCH_HANDLERS);

      renderWithProviders(<ARDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Total Outstanding')).toBeInTheDocument();
      });
    });

    it('should display Overdue amount', async () => {
      setupFetchMock(ACCOUNTING_FETCH_HANDLERS);

      renderWithProviders(<ARDashboardPage />);

      await waitFor(() => {
        // "Overdue" appears in KPI and footer
        expect(screen.getAllByText('Overdue').length).toBeGreaterThan(0);
      });
    });

    it('should display Collected This Month', async () => {
      setupFetchMock(ACCOUNTING_FETCH_HANDLERS);

      renderWithProviders(<ARDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Collected This Month')).toBeInTheDocument();
      });
    });
  });
});
