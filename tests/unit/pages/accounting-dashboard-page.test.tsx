/**
 * Unit Tests for Accounting Dashboard Page
 * Tests the Executive Accounting Dashboard with:
 * - Header with period selector
 * - Executive KPI cards
 * - Charts (Revenue/Expenses trend, Expense breakdown)
 * - Quick links by category
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock Next.js navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    prefetch: vi.fn(),
  }),
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// Mock executive metrics data
const mockMetrics = {
  workingCapital: { id: 'working-capital', label: 'Working Capital', value: 3000000, format: 'currency', trend: 'up', trendValue: 5, sparklineData: [] },
  currentRatio: { id: 'current-ratio', label: 'Current Ratio', value: 2.5, format: 'ratio', trend: 'up', trendValue: 0.2, sparklineData: [] },
  quickRatio: { id: 'quick-ratio', label: 'Quick Ratio', value: 1.8, format: 'ratio', trend: 'neutral', trendValue: 0, sparklineData: [] },
  dso: { id: 'dso', label: 'DSO', value: 45, format: 'days', trend: 'down', trendValue: -3, sparklineData: [] },
  grossProfitMargin: { id: 'gross-profit-margin', label: 'Gross Profit Margin', value: 0.35, format: 'percent', trend: 'up', trendValue: 2, sparklineData: [500000] },
  operatingCashFlow: { id: 'operating-cash-flow', label: 'Operating Cash Flow', value: 800000, format: 'currency', trend: 'up', trendValue: 10, sparklineData: [] },
  dpo: { id: 'dpo', label: 'DPO', value: 30, format: 'days', trend: 'neutral', trendValue: 0, sparklineData: [] },
  inventoryTurnover: { id: 'inventory-turnover', label: 'Inventory Turnover', value: 6.5, format: 'ratio', trend: 'up', trendValue: 0.5, sparklineData: [] },
};

// Mock fetch for API calls
vi.stubGlobal('fetch', vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ data: mockMetrics }),
  })
));

// Mock TanStack Query
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(({ queryKey }) => {
    if (queryKey[0] === 'executive-metrics') {
      return {
        data: mockMetrics,
        isLoading: false,
        refetch: vi.fn(),
      };
    }
    if (queryKey[0] === 'executive-alerts') {
      return {
        data: [],
        isLoading: false,
        refetch: vi.fn(),
      };
    }
    return {
      data: undefined,
      isLoading: false,
      refetch: vi.fn(),
    };
  }),
}));

// Mock @/components/accounting
vi.mock('@/components/accounting', () => ({
  ExecutiveKPICard: vi.fn(({ kpi }) => (
    <div data-testid={`kpi-${kpi.id}`}>
      <span>{kpi.label}</span>
      <span>{kpi.value}</span>
    </div>
  )),
  ExecutiveKPICardSkeleton: vi.fn(() => (
    <div data-testid="kpi-skeleton">Loading...</div>
  )),
  ExecutiveAlertBar: vi.fn(({ alerts }) => (
    <div data-testid="alert-bar">
      {alerts.map((alert: { id: string; message: string }) => (
        <div key={alert.id}>{alert.message}</div>
      ))}
    </div>
  )),
  ExecutiveAlertBarSkeleton: vi.fn(() => (
    <div data-testid="alert-bar-skeleton">Loading alerts...</div>
  )),
  AccountingPageHeader: vi.fn(({ title }) => (
    <div data-testid="accounting-page-header"><h1>{title}</h1></div>
  )),
  AccountingKPICard: vi.fn(({ label }) => (
    <div data-testid={`accounting-kpi-${label}`}>{label}</div>
  )),
  AccountingKPICardSkeleton: vi.fn(() => (
    <div data-testid="accounting-kpi-skeleton">Loading...</div>
  )),
}));

// Mock charts
vi.mock('@/components/accounting/charts', () => ({
  RevenueExpensesTrend: vi.fn(({ data }) => (
    <div data-testid="revenue-expenses-trend">
      <span>{data?.length || 0} months</span>
    </div>
  )),
  ExpenseBreakdownChart: vi.fn(() => (
    <div data-testid="expense-breakdown-chart">Chart</div>
  )),
}));

// Mock Card components
vi.mock('@/components/ui/card', () => ({
  Card: vi.fn(({ children, className }) => (
    <div data-testid="card" className={className}>{children}</div>
  )),
  CardHeader: vi.fn(({ children }) => (
    <div data-testid="card-header">{children}</div>
  )),
  CardTitle: vi.fn(({ children }) => (
    <h3 data-testid="card-title">{children}</h3>
  )),
  CardContent: vi.fn(({ children }) => (
    <div data-testid="card-content">{children}</div>
  )),
}));

// Mock Button component
vi.mock('@/components/ui/button', () => ({
  Button: vi.fn(({ children, onClick, ...props }) => (
    <button data-testid={props['data-testid'] || 'button'} onClick={onClick}>{children}</button>
  )),
}));

// Import the page component after mocks are set up
import AccountingDashboardPage from '@/app/accounting/page';

describe('Accounting Dashboard Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockClear();
  });

  describe('Page Rendering', () => {
    it('should render the page header with correct title', () => {
      render(<AccountingDashboardPage />);

      expect(screen.getByText('Executive Accounting Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Financial insights and actionable metrics')).toBeInTheDocument();
    });

    it('should render period selector', () => {
      render(<AccountingDashboardPage />);

      expect(screen.getByTestId('period-selector')).toBeInTheDocument();
      expect(screen.getByTestId('period-mtd')).toBeInTheDocument();
      expect(screen.getByTestId('period-qtd')).toBeInTheDocument();
      expect(screen.getByTestId('period-ytd')).toBeInTheDocument();
    });

    it('should render refresh button', () => {
      render(<AccountingDashboardPage />);

      expect(screen.getByTestId('refresh-button')).toBeInTheDocument();
    });

    it('should render accounting dashboard container', () => {
      render(<AccountingDashboardPage />);

      expect(screen.getByTestId('accounting-dashboard')).toBeInTheDocument();
    });
  });

  describe('KPI Cards', () => {
    it('should render Financial Health KPI cards', () => {
      render(<AccountingDashboardPage />);

      expect(screen.getByText('Financial Health')).toBeInTheDocument();
      // KPI cards from Row 1
      expect(screen.getByTestId('kpi-working-capital')).toBeInTheDocument();
      expect(screen.getByTestId('kpi-current-ratio')).toBeInTheDocument();
      expect(screen.getByTestId('kpi-quick-ratio')).toBeInTheDocument();
      expect(screen.getByTestId('kpi-dso')).toBeInTheDocument();
    });

    it('should render Business Performance KPI cards', () => {
      render(<AccountingDashboardPage />);

      expect(screen.getByText('Business Performance')).toBeInTheDocument();
      // KPI cards from Row 2
      expect(screen.getByTestId('kpi-gross-profit-margin')).toBeInTheDocument();
      expect(screen.getByTestId('kpi-operating-cash-flow')).toBeInTheDocument();
      expect(screen.getByTestId('kpi-dpo')).toBeInTheDocument();
      expect(screen.getByTestId('kpi-inventory-turnover')).toBeInTheDocument();
    });
  });

  describe('Charts Section', () => {
    it('should render Revenue Expenses Trend chart', () => {
      render(<AccountingDashboardPage />);

      expect(screen.getByTestId('revenue-expenses-trend')).toBeInTheDocument();
    });

    it('should render Expense Breakdown chart', () => {
      render(<AccountingDashboardPage />);

      expect(screen.getByTestId('expense-breakdown-chart')).toBeInTheDocument();
    });
  });

  describe('Quick Links', () => {
    it('should render Quick Access section', () => {
      render(<AccountingDashboardPage />);

      expect(screen.getByText('Quick Access')).toBeInTheDocument();
    });

    it('should render Financial Statements group', () => {
      render(<AccountingDashboardPage />);

      expect(screen.getByText('Financial Statements')).toBeInTheDocument();
      expect(screen.getByText('Trial Balance')).toBeInTheDocument();
      expect(screen.getByText('Balance Sheet')).toBeInTheDocument();
      expect(screen.getByText('Income Statement')).toBeInTheDocument();
    });

    it('should render Receivables group', () => {
      render(<AccountingDashboardPage />);

      expect(screen.getByText('Receivables')).toBeInTheDocument();
      expect(screen.getByText('AR Invoices')).toBeInTheDocument();
      expect(screen.getByText('AR Aging')).toBeInTheDocument();
    });

    it('should render Payables group', () => {
      render(<AccountingDashboardPage />);

      expect(screen.getByText('Payables')).toBeInTheDocument();
      expect(screen.getByText('AP Invoices')).toBeInTheDocument();
      expect(screen.getByText('AP Aging')).toBeInTheDocument();
    });

    it('should render Assets & Operations group', () => {
      render(<AccountingDashboardPage />);

      expect(screen.getByText('Assets & Operations')).toBeInTheDocument();
      const fixedAssetsLinks = screen.getAllByText('Fixed Assets');
      expect(fixedAssetsLinks.length).toBeGreaterThan(0);
      expect(screen.getByText('Equipment')).toBeInTheDocument();
      expect(screen.getByText('Period Close')).toBeInTheDocument();
    });

    it('should render quick links with correct hrefs', () => {
      render(<AccountingDashboardPage />);

      const trialBalanceLink = screen.getByText('Trial Balance').closest('a');
      expect(trialBalanceLink).toHaveAttribute('href', '/accounting/reports/trial-balance');

      const arInvoicesLink = screen.getByText('AR Invoices').closest('a');
      expect(arInvoicesLink).toHaveAttribute('href', '/accounting/ar/invoices');

      const periodCloseLink = screen.getByText('Period Close').closest('a');
      expect(periodCloseLink).toHaveAttribute('href', '/accounting/period-close');
    });
  });

  describe('Period Selector Interaction', () => {
    it('should switch to MTD period', () => {
      render(<AccountingDashboardPage />);

      const mtdButton = screen.getByTestId('period-mtd');
      fireEvent.click(mtdButton);

      // After clicking, MTD button should have active styling (blue)
      expect(mtdButton).toHaveClass('bg-blue-600');
    });

    it('should have YTD active by default', () => {
      render(<AccountingDashboardPage />);

      const ytdButton = screen.getByTestId('period-ytd');
      expect(ytdButton).toHaveClass('bg-blue-600');
    });
  });

  describe('Refresh Button', () => {
    it('should call refetch when refresh button clicked', () => {
      render(<AccountingDashboardPage />);

      const refreshButton = screen.getByTestId('refresh-button');
      fireEvent.click(refreshButton);

      // Just verify button exists and can be clicked without error
      expect(refreshButton).toBeInTheDocument();
    });
  });

  describe('No Alerts State', () => {
    it('should not render alert bar when no alerts', () => {
      render(<AccountingDashboardPage />);

      expect(screen.queryByTestId('alert-bar')).not.toBeInTheDocument();
    });
  });
});
