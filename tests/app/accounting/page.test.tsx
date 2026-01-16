import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AccountingDashboardPage from '@/app/accounting/page';

// Mock fetch
global.fetch = vi.fn();

// Mock ResizeObserver for Recharts
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverMock;

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = 'QueryClientWrapper';
  return Wrapper;
};

// Mock executive metrics data
const mockExecutiveMetrics = {
  asOfDate: '2026-01-17',
  periodStart: '2026-01-01',
  periodEnd: '2026-01-17',
  workingCapital: {
    id: 'working-capital',
    label: 'Working Capital',
    value: 500000,
    formattedValue: '฿500,000',
    unit: 'currency',
    trend: 'up',
    trendValue: 50000,
    trendPercentage: 11.1,
    sparklineData: [400000, 420000, 450000, 480000, 490000, 500000],
    status: 'good',
  },
  currentRatio: {
    id: 'current-ratio',
    label: 'Current Ratio',
    value: 1.8,
    formattedValue: '1.80',
    unit: 'ratio',
    trend: 'up',
    trendValue: 0.2,
    trendPercentage: 12.5,
    sparklineData: [1.5, 1.6, 1.65, 1.7, 1.75, 1.8],
    status: 'good',
    targetMin: 1.5,
    targetMax: 2.0,
  },
  quickRatio: {
    id: 'quick-ratio',
    label: 'Quick Ratio',
    value: 1.2,
    formattedValue: '1.20',
    unit: 'ratio',
    trend: 'neutral',
    trendValue: 0,
    trendPercentage: 0,
    sparklineData: [1.1, 1.15, 1.18, 1.2, 1.2, 1.2],
    status: 'good',
    targetMin: 1.0,
  },
  dso: {
    id: 'dso',
    label: 'DSO (Days)',
    value: 35,
    formattedValue: '35 days',
    unit: 'days',
    trend: 'down',
    trendValue: -5,
    trendPercentage: -12.5,
    sparklineData: [45, 42, 40, 38, 36, 35],
    status: 'good',
    targetMax: 45,
  },
  grossProfitMargin: {
    id: 'gross-profit-margin',
    label: 'Gross Margin %',
    value: 42.5,
    formattedValue: '42.5%',
    unit: 'percentage',
    trend: 'up',
    trendValue: 2.5,
    trendPercentage: 6.25,
    sparklineData: [38, 39, 40, 41, 42, 42.5],
    status: 'good',
    targetMin: 40,
  },
  operatingCashFlow: {
    id: 'operating-cash-flow',
    label: 'Operating Cash Flow',
    value: 250000,
    formattedValue: '฿250,000',
    unit: 'currency',
    trend: 'up',
    trendValue: 30000,
    trendPercentage: 13.6,
    sparklineData: [180000, 200000, 210000, 230000, 240000, 250000],
    status: 'good',
  },
  dpo: {
    id: 'dpo',
    label: 'DPO (Days)',
    value: 38,
    formattedValue: '38 days',
    unit: 'days',
    trend: 'neutral',
    trendValue: 0,
    trendPercentage: 0,
    sparklineData: [35, 36, 37, 38, 38, 38],
    status: 'good',
    targetMin: 30,
    targetMax: 45,
  },
  inventoryTurnover: {
    id: 'inventory-turnover',
    label: 'Inventory Turnover',
    value: 4.5,
    formattedValue: '4.5x',
    unit: 'times',
    trend: 'up',
    trendValue: 0.5,
    trendPercentage: 12.5,
    sparklineData: [3.8, 4.0, 4.1, 4.2, 4.4, 4.5],
    status: 'good',
    targetMin: 4,
  },
};

// Mock alerts data
const mockAlerts = [
  {
    id: 'alert-1',
    type: 'ar_overdue_critical',
    priority: 'critical',
    title: 'AR Overdue Critical',
    message: 'Accounts receivable over 90 days exceeds threshold',
    value: 600000,
    formattedValue: '฿600,000',
    threshold: 500000,
    actionLink: '/accounting/ar/invoices?status=overdue',
    actionLabel: 'View AR Aging',
    createdAt: '2026-01-17T00:00:00Z',
  },
  {
    id: 'alert-2',
    type: 'gross_margin_declining',
    priority: 'warning',
    title: 'Gross Margin Declining',
    message: 'Gross margin dropped more than 2% vs prior period',
    value: 2.5,
    formattedValue: '-2.5%',
    threshold: 2,
    actionLink: '/accounting/reports/profitability',
    actionLabel: 'View Profitability Report',
    createdAt: '2026-01-17T00:00:00Z',
  },
];

describe('AccountingDashboardPage - Executive Design', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock successful API responses for new endpoints
    vi.mocked(fetch).mockImplementation((url) => {
      const urlStr = url.toString();

      if (urlStr.includes('/api/accounting/dashboard/executive-metrics')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: mockExecutiveMetrics }),
        } as Response);
      }

      if (urlStr.includes('/api/accounting/dashboard/alerts')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: mockAlerts }),
        } as Response);
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({ data: [] }),
      } as Response);
    });
  });

  it('renders the executive dashboard header', async () => {
    render(<AccountingDashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Executive Accounting Dashboard')).toBeInTheDocument();
    });
    expect(screen.getByText('Financial insights and actionable metrics')).toBeInTheDocument();
  });

  it('renders period selector with MTD, QTD, YTD options', async () => {
    render(<AccountingDashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('period-selector')).toBeInTheDocument();
    });
    expect(screen.getByTestId('period-mtd')).toBeInTheDocument();
    expect(screen.getByTestId('period-qtd')).toBeInTheDocument();
    expect(screen.getByTestId('period-ytd')).toBeInTheDocument();
  });

  it('renders financial health KPIs (row 1)', async () => {
    render(<AccountingDashboardPage />, { wrapper: createWrapper() });

    // Wait for section header (always present)
    await waitFor(() => {
      expect(screen.getByText('Financial Health')).toBeInTheDocument();
    });

    // Wait for KPI data to load (from API response)
    await waitFor(() => {
      expect(screen.getByText('Working Capital')).toBeInTheDocument();
    }, { timeout: 3000 });

    expect(screen.getByText('Current Ratio')).toBeInTheDocument();
    expect(screen.getByText('Quick Ratio')).toBeInTheDocument();
    expect(screen.getByText('DSO (Days)')).toBeInTheDocument();
  });

  it('renders business performance KPIs (row 2)', async () => {
    render(<AccountingDashboardPage />, { wrapper: createWrapper() });

    // Wait for section header (always present)
    await waitFor(() => {
      expect(screen.getByText('Business Performance')).toBeInTheDocument();
    });

    // Wait for KPI data to load (from API response)
    await waitFor(() => {
      expect(screen.getByText('Gross Margin %')).toBeInTheDocument();
    }, { timeout: 3000 });

    expect(screen.getByText('Operating Cash Flow')).toBeInTheDocument();
    expect(screen.getByText('DPO (Days)')).toBeInTheDocument();
    expect(screen.getByText('Inventory Turnover')).toBeInTheDocument();
  });

  it('renders executive alert bar with priority badges', async () => {
    render(<AccountingDashboardPage />, { wrapper: createWrapper() });

    // Wait for alert bar to load (not skeleton)
    await waitFor(() => {
      expect(screen.getByTestId('executive-alert-bar')).toBeInTheDocument();
    }, { timeout: 3000 });

    expect(screen.getByTestId('critical-count')).toBeInTheDocument();
    expect(screen.getByTestId('warning-count')).toBeInTheDocument();
  });

  it('renders chart components', async () => {
    render(<AccountingDashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('revenue-expenses-trend')).toBeInTheDocument();
    });
    expect(screen.getByTestId('expense-breakdown-chart')).toBeInTheDocument();
  });

  it('renders quick links organized by category', async () => {
    render(<AccountingDashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Quick Access')).toBeInTheDocument();
    });
    expect(screen.getByText('Financial Statements')).toBeInTheDocument();
    expect(screen.getByText('Receivables')).toBeInTheDocument();
    expect(screen.getByText('Payables')).toBeInTheDocument();
    expect(screen.getByText('Assets & Operations')).toBeInTheDocument();
  });

  it('changes period when clicking period selector', async () => {
    const user = userEvent.setup();
    render(<AccountingDashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('period-ytd')).toBeInTheDocument();
    });

    // Click MTD button
    await user.click(screen.getByTestId('period-mtd'));

    // Should refetch with new period
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('period=MTD')
      );
    });
  });

  it('calls refetch when clicking refresh button', async () => {
    const user = userEvent.setup();
    render(<AccountingDashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('refresh-button')).toBeInTheDocument();
    });

    // Clear previous calls
    vi.mocked(fetch).mockClear();

    // Click refresh button
    await user.click(screen.getByTestId('refresh-button'));

    // Should trigger refetch
    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });
  });

  it('renders KPI cards with correct data-testid attributes', async () => {
    render(<AccountingDashboardPage />, { wrapper: createWrapper() });

    // Wait for KPI cards to load (after API response)
    await waitFor(() => {
      expect(screen.getByTestId('kpi-card-working-capital')).toBeInTheDocument();
    }, { timeout: 3000 });

    expect(screen.getByTestId('kpi-card-current-ratio')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-card-quick-ratio')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-card-dso')).toBeInTheDocument();
  });
});
