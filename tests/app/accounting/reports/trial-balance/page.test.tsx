/**
 * @vitest-environment jsdom
 */
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TrialBalancePage from '@/app/accounting/reports/trial-balance/page';

// Mock fetch
global.fetch = vi.fn();

// Mock DevExtreme DataGrid
vi.mock('devextreme-react/data-grid', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="data-grid">{children}</div>,
  Column: () => null,
  Summary: () => null,
  TotalItem: () => null,
  ColumnChooser: () => null,
  Export: () => null,
  Grouping: () => null,
  GroupPanel: () => null,
}));

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
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

const mockTrialBalance = {
  data: {
    asOfDate: '2026-01-17',
    fiscalPeriod: '2026-01-01',
    entries: [
      { accountCode: '1110', accountName: 'Cash', category: 'asset', accountType: 'Current Asset', openingDebit: 100000, openingCredit: 0, periodDebit: 50000, periodCredit: 20000, closingDebit: 130000, closingCredit: 0 },
      { accountCode: '2110', accountName: 'Accounts Payable', category: 'liability', accountType: 'Current Liability', openingDebit: 0, openingCredit: 50000, periodDebit: 10000, periodCredit: 30000, closingDebit: 0, closingCredit: 70000 },
    ],
    totals: { openingDebit: 100000, openingCredit: 50000, periodDebit: 60000, periodCredit: 50000, closingDebit: 130000, closingCredit: 70000 },
  },
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <TrialBalancePage />
    </QueryClientProvider>
  );
}

describe('Trial Balance Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTrialBalance),
    });
  });

  it('renders page title', () => {
    renderPage();
    expect(screen.getByText('Trial Balance')).toBeInTheDocument();
  });

  it('shows KPI cards after loading', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('kpi-totalDebits')).toBeInTheDocument();
    });
  });

  it('shows export toolbar', () => {
    renderPage();
    expect(screen.getByTestId('export-pdf')).toBeInTheDocument();
    expect(screen.getByTestId('export-excel')).toBeInTheDocument();
    expect(screen.getByTestId('export-csv')).toBeInTheDocument();
  });

  it('shows period selector', () => {
    renderPage();
    expect(screen.getByTestId('as-of-date-picker')).toBeInTheDocument();
  });

  it('shows data grid', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('data-grid')).toBeInTheDocument();
    });
  });
});
