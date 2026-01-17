/**
 * @vitest-environment jsdom
 */
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import IncomeStatementPage from '@/app/accounting/reports/income-statement/page';

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
  AreaChart: ({ children }: { children: React.ReactNode }) => <div data-testid="area-chart">{children}</div>,
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

const mockIncomeStatement = {
  data: {
    periodStart: '2026-01-01',
    periodEnd: '2026-01-17',
    revenue: {
      title: 'Revenue',
      accounts: [
        { code: '4110', name: 'Product Sales', amount: 1000000 },
        { code: '4120', name: 'Service Revenue', amount: 200000 },
      ],
      subtotal: 1200000,
    },
    costOfGoodsSold: {
      title: 'Cost of Goods Sold',
      accounts: [
        { code: '5110', name: 'Raw Materials', amount: 400000 },
        { code: '5120', name: 'Direct Labor', amount: 200000 },
      ],
      subtotal: 600000,
    },
    grossProfit: 600000,
    operatingExpenses: {
      title: 'Operating Expenses',
      accounts: [
        { code: '6110', name: 'Salaries', amount: 200000 },
        { code: '6120', name: 'Rent', amount: 50000 },
      ],
      subtotal: 250000,
    },
    operatingIncome: 350000,
    otherIncomeExpenses: {
      title: 'Other Income/Expenses',
      accounts: [
        { code: '7110', name: 'Interest Income', amount: 10000 },
      ],
      subtotal: 10000,
    },
    netIncomeBeforeTax: 360000,
    incomeTax: 72000,
    netIncome: 288000,
  },
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <IncomeStatementPage />
    </QueryClientProvider>
  );
}

describe('Income Statement Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockIncomeStatement),
    });
  });

  it('renders page title', () => {
    renderPage();
    expect(screen.getByText('Income Statement')).toBeInTheDocument();
  });

  it('shows KPI cards after loading', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('kpi-revenue')).toBeInTheDocument();
      expect(screen.getByTestId('kpi-grossProfit')).toBeInTheDocument();
      expect(screen.getByTestId('kpi-netIncome')).toBeInTheDocument();
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

  it('shows area chart after loading', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('area-chart')).toBeInTheDocument();
    });
  });

  it('shows gross profit section after loading', async () => {
    renderPage();
    await waitFor(() => {
      // Check for gross profit KPI card which has specific test id
      expect(screen.getByTestId('kpi-grossProfit')).toBeInTheDocument();
    });
  });

  it('shows net income section after loading', async () => {
    renderPage();
    await waitFor(() => {
      // Check for net income KPI card which has specific test id
      expect(screen.getByTestId('kpi-netIncome')).toBeInTheDocument();
    });
  });
});
