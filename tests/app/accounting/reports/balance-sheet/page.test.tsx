/**
 * @vitest-environment jsdom
 */
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import BalanceSheetPage from '@/app/accounting/reports/balance-sheet/page';

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
  PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => null,
  Cell: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

const mockBalanceSheet = {
  data: {
    asOfDate: '2026-01-17',
    assets: {
      currentAssets: {
        title: 'Current Assets',
        accounts: [
          { code: '1110', name: 'Cash', amount: 500000 },
          { code: '1120', name: 'Accounts Receivable', amount: 300000 },
        ],
        subtotal: 800000,
      },
      nonCurrentAssets: {
        title: 'Non-Current Assets',
        accounts: [
          { code: '1510', name: 'Equipment', amount: 1000000 },
        ],
        subtotal: 1000000,
      },
      totalAssets: 1800000,
    },
    liabilities: {
      currentLiabilities: {
        title: 'Current Liabilities',
        accounts: [
          { code: '2110', name: 'Accounts Payable', amount: 200000 },
        ],
        subtotal: 200000,
      },
      nonCurrentLiabilities: {
        title: 'Non-Current Liabilities',
        accounts: [
          { code: '2510', name: 'Long-term Loan', amount: 500000 },
        ],
        subtotal: 500000,
      },
      totalLiabilities: 700000,
    },
    equity: {
      section: {
        title: 'Equity',
        accounts: [
          { code: '3110', name: 'Common Stock', amount: 500000 },
          { code: '3210', name: 'Retained Earnings', amount: 600000 },
        ],
        subtotal: 1100000,
      },
      totalEquity: 1100000,
    },
    totalLiabilitiesAndEquity: 1800000,
    isBalanced: true,
  },
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <BalanceSheetPage />
    </QueryClientProvider>
  );
}

describe('Balance Sheet Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockBalanceSheet),
    });
  });

  it('renders page title', () => {
    renderPage();
    expect(screen.getByText('Balance Sheet')).toBeInTheDocument();
  });

  it('shows KPI cards after loading', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('kpi-totalAssets')).toBeInTheDocument();
      expect(screen.getByTestId('kpi-currentRatio')).toBeInTheDocument();
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

  it('shows balance status after loading', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('✓ Balanced')).toBeInTheDocument();
    });
  });
});
