/**
 * @vitest-environment jsdom
 */
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CashFlowPage from '@/app/accounting/reports/cash-flow/page';

// Mock fetch
global.fetch = vi.fn();

// Mock DevExtreme DateBox
vi.mock('devextreme-react/date-box', () => ({
  DateBox: ({ 'data-testid': testId }: { 'data-testid': string }) => (
    <input data-testid={testId} type="date" />
  ),
}));

// Mock Recharts
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Cell: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  ReferenceLine: () => null,
}));

const mockCashFlow = {
  data: {
    periodStart: '2026-01-01',
    periodEnd: '2026-01-17',
    operatingActivities: {
      netIncome: 288000,
      adjustments: {
        title: 'Adjustments',
        items: [
          { description: 'Depreciation', amount: 50000 },
          { description: 'Amortization', amount: 10000 },
        ],
        subtotal: 60000,
      },
      workingCapitalChanges: {
        title: 'Working Capital Changes',
        items: [
          { description: 'Increase in Receivables', amount: -30000 },
          { description: 'Decrease in Payables', amount: -20000 },
        ],
        subtotal: -50000,
      },
      netCashFromOperating: 298000,
    },
    investingActivities: {
      section: {
        title: 'Investing',
        items: [
          { description: 'Purchase of Equipment', amount: -150000 },
          { description: 'Sale of Investments', amount: 50000 },
        ],
        subtotal: -100000,
      },
      netCashFromInvesting: -100000,
    },
    financingActivities: {
      section: {
        title: 'Financing',
        items: [
          { description: 'Loan Repayment', amount: -50000 },
          { description: 'Dividend Paid', amount: -20000 },
        ],
        subtotal: -70000,
      },
      netCashFromFinancing: -70000,
    },
    netChangeInCash: 128000,
    beginningCashBalance: 500000,
    endingCashBalance: 628000,
  },
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <CashFlowPage />
    </QueryClientProvider>
  );
}

describe('Cash Flow Statement Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockCashFlow),
    });
  });

  it('renders page title', () => {
    renderPage();
    expect(screen.getByText('Cash Flow Statement')).toBeInTheDocument();
  });

  it('shows KPI cards after loading', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('kpi-operatingCashFlow')).toBeInTheDocument();
      expect(screen.getByTestId('kpi-netChangeInCash')).toBeInTheDocument();
    });
  });

  it('shows export toolbar', () => {
    renderPage();
    expect(screen.getByTestId('export-pdf')).toBeInTheDocument();
    expect(screen.getByTestId('export-excel')).toBeInTheDocument();
    expect(screen.getByTestId('export-csv')).toBeInTheDocument();
  });

  it('shows period selector with date range', () => {
    renderPage();
    expect(screen.getByTestId('period-start-picker')).toBeInTheDocument();
    expect(screen.getByTestId('period-end-picker')).toBeInTheDocument();
  });

  it('shows bar chart after loading', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    });
  });

  it('shows operating activities section', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Operating Activities')).toBeInTheDocument();
    });
  });

  it('shows investing activities section', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Investing Activities')).toBeInTheDocument();
    });
  });

  it('shows financing activities section', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Financing Activities')).toBeInTheDocument();
    });
  });

  it('shows cash reconciliation section', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Cash Reconciliation')).toBeInTheDocument();
    });
  });

  it('shows reconciled status when balances match', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('✓ Reconciled')).toBeInTheDocument();
    });
  });
});
