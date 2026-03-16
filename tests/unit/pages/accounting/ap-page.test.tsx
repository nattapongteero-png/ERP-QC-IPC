/**
 * AP Dashboard Page Tests
 * Feature: 014-unit-cost
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import APDashboardPage from '@/app/accounting/ap/page';
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
  Receipt: () => <span data-testid="icon-receipt" />,
  FileText: () => <span data-testid="icon-file-text" />,
  CreditCard: () => <span data-testid="icon-credit-card" />,
  AlertTriangle: () => <span data-testid="icon-alert" />,
  TrendingUp: () => <span data-testid="icon-trending" />,
  BarChart3: () => <span data-testid="icon-barchart" />,
  ChevronRight: () => <span data-testid="icon-chevron" />,
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

describe('APDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFetchMock();
  });

  describe('Page Rendering', () => {
    it('should render page with correct title', async () => {
      setupFetchMock(ACCOUNTING_FETCH_HANDLERS);

      renderWithProviders(<APDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Accounts Payable')).toBeInTheDocument();
      });
    });

    it('should render page subtitle', async () => {
      setupFetchMock(ACCOUNTING_FETCH_HANDLERS);

      renderWithProviders(<APDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Manage supplier bills and payments')).toBeInTheDocument();
      });
    });

    it('should render the AP dashboard container', async () => {
      setupFetchMock(ACCOUNTING_FETCH_HANDLERS);

      renderWithProviders(<APDashboardPage />);

      await waitFor(() => {
        expect(screen.getByTestId('ap-dashboard')).toBeInTheDocument();
      });
    });
  });

  describe('KPI Cards', () => {
    it('should display Total Payables KPI', async () => {
      setupFetchMock(ACCOUNTING_FETCH_HANDLERS);

      renderWithProviders(<APDashboardPage />);

      await waitFor(() => {
        expect(screen.getByTestId('kpi-total-payables')).toBeInTheDocument();
      });
    });

    it('should display Pending Invoices KPI', async () => {
      setupFetchMock(ACCOUNTING_FETCH_HANDLERS);

      renderWithProviders(<APDashboardPage />);

      await waitFor(() => {
        expect(screen.getByTestId('kpi-pending-invoices')).toBeInTheDocument();
      });
    });

    it('should display Overdue Amount KPI', async () => {
      setupFetchMock(ACCOUNTING_FETCH_HANDLERS);

      renderWithProviders(<APDashboardPage />);

      await waitFor(() => {
        expect(screen.getByTestId('kpi-overdue-amount')).toBeInTheDocument();
      });
    });

    it('should display Paid This Month KPI', async () => {
      setupFetchMock(ACCOUNTING_FETCH_HANDLERS);

      renderWithProviders(<APDashboardPage />);

      await waitFor(() => {
        expect(screen.getByTestId('kpi-paid-this-month')).toBeInTheDocument();
      });
    });
  });

  describe('Quick Navigation', () => {
    it('should render Quick Access section', async () => {
      setupFetchMock(ACCOUNTING_FETCH_HANDLERS);

      renderWithProviders(<APDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Quick Access')).toBeInTheDocument();
      });
    });

    it('should render AP Invoices link', async () => {
      setupFetchMock(ACCOUNTING_FETCH_HANDLERS);

      renderWithProviders(<APDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('AP Invoices')).toBeInTheDocument();
        expect(screen.getByText('Manage vendor invoices and approvals')).toBeInTheDocument();
      });
    });

    it('should render Payments link', async () => {
      setupFetchMock(ACCOUNTING_FETCH_HANDLERS);

      renderWithProviders(<APDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Payments')).toBeInTheDocument();
        expect(screen.getByText('Process and track vendor payments')).toBeInTheDocument();
      });
    });

    it('should render Aging Report link', async () => {
      setupFetchMock(ACCOUNTING_FETCH_HANDLERS);

      renderWithProviders(<APDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Aging Report')).toBeInTheDocument();
        expect(screen.getByText('View payables aging analysis')).toBeInTheDocument();
      });
    });
  });

  describe('Charts Section', () => {
    it('should render AP Aging Summary chart', async () => {
      setupFetchMock(ACCOUNTING_FETCH_HANDLERS);

      renderWithProviders(<APDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('AP Aging Summary')).toBeInTheDocument();
      });
    });

    it('should render bar chart component', async () => {
      setupFetchMock(ACCOUNTING_FETCH_HANDLERS);

      renderWithProviders(<APDashboardPage />);

      await waitFor(() => {
        expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
      });
    });
  });

  describe('Recent Invoices', () => {
    it('should render Recent AP Invoices section', async () => {
      setupFetchMock(ACCOUNTING_FETCH_HANDLERS);

      renderWithProviders(<APDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Recent AP Invoices')).toBeInTheDocument();
      });
    });
  });

  describe('Data Fetching', () => {
    it('should fetch AP invoices on mount', async () => {
      setupFetchMock(ACCOUNTING_FETCH_HANDLERS);

      renderWithProviders(<APDashboardPage />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      const calls = vi.mocked(fetch).mock.calls;
      const apCall = calls.find(([url]) =>
        typeof url === 'string' && url.includes('/api/accounting/ap-invoices')
      );
      expect(apCall).toBeDefined();
    });

    it('should handle empty invoices gracefully', async () => {
      setupFetchMock({
        '/api/accounting/ap-invoices': { data: createSingleResponse([]) },
        '/api/accounting/reports/aging': { data: createSingleResponse({ totals: {} }) },
      });

      renderWithProviders(<APDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Accounts Payable')).toBeInTheDocument();
      });
    });

    it('should handle API error gracefully', async () => {
      setupFetchMock({
        '/api/accounting/ap-invoices': {
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

      renderWithProviders(<APDashboardPage />);

      // Page should still render even on API error
      await waitFor(() => {
        expect(screen.getByText('Accounts Payable')).toBeInTheDocument();
      });
    });
  });

  describe('Summary Footer', () => {
    it('should display Total Outstanding', async () => {
      setupFetchMock(ACCOUNTING_FETCH_HANDLERS);

      renderWithProviders(<APDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Total Outstanding')).toBeInTheDocument();
      });
    });

    it('should display Overdue amount', async () => {
      setupFetchMock(ACCOUNTING_FETCH_HANDLERS);

      renderWithProviders(<APDashboardPage />);

      await waitFor(() => {
        // "Overdue" appears in KPI and footer
        expect(screen.getAllByText('Overdue').length).toBeGreaterThan(0);
      });
    });
  });
});
