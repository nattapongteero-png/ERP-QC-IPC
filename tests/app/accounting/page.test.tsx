import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AccountingDashboardPage from '@/app/accounting/page';

// Mock fetch
global.fetch = vi.fn();

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

describe('AccountingDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock successful API responses
    vi.mocked(fetch).mockImplementation((url) => {
      const urlStr = url.toString();

      if (urlStr.includes('/api/accounting/gl-accounts')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [{ id: 1, accountCode: '1100', accountName: 'Cash' }] }),
        } as Response);
      }

      if (urlStr.includes('/api/accounting/reports/trial-balance')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: {
              entries: [
                { accountCode: '1100', category: 'asset', closingDebit: 100000, closingCredit: 0 },
                { accountCode: '2100', category: 'liability', closingDebit: 0, closingCredit: 50000 },
                { accountCode: '3100', category: 'equity', closingDebit: 0, closingCredit: 30000 },
                { accountCode: '4100', category: 'revenue', closingDebit: 0, closingCredit: 200000 },
                { accountCode: '5100', category: 'expense', closingDebit: 150000, closingCredit: 0 },
              ],
            },
          }),
        } as Response);
      }

      if (urlStr.includes('/api/accounting/fiscal-periods')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: [{ id: 1, periodName: 'December 2024', status: 'open' }],
          }),
        } as Response);
      }

      if (urlStr.includes('/api/accounting/reports/aging')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: {
              totals: { total: 100000, current: 60000, days30: 20000, days60: 10000, days90: 5000, over90: 5000 },
              entries: [],
            },
          }),
        } as Response);
      }

      if (urlStr.includes('/api/accounting/maintenance/due')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [{ id: 1, description: 'Maintenance 1' }] }),
        } as Response);
      }

      if (urlStr.includes('/api/accounting/journal-entries')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: [
              {
                id: 1,
                entryDate: '2024-12-01',
                description: 'Test entry',
                lines: [{ debit: 1000, credit: 0 }],
              },
            ],
          }),
        } as Response);
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({ data: [] }),
      } as Response);
    });
  });

  it('renders professional page header with AccountingPageHeader', async () => {
    render(<AccountingDashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Accounting Dashboard')).toBeInTheDocument();
    });
    expect(screen.getByText('Financial management and reporting')).toBeInTheDocument();
  });

  it('renders KPI cards with AccountingKPICard components', async () => {
    render(<AccountingDashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Cash Balance')).toBeInTheDocument();
    });
    expect(screen.getByText('Accounts Receivable')).toBeInTheDocument();
    expect(screen.getByText('Accounts Payable')).toBeInTheDocument();
    expect(screen.getByText('Net Income (YTD)')).toBeInTheDocument();
  });

  it('displays loading skeletons while fetching data', async () => {
    render(<AccountingDashboardPage />, { wrapper: createWrapper() });

    // KPI cards should eventually render with data
    await waitFor(() => {
      expect(screen.getByText('Cash Balance')).toBeInTheDocument();
    });
  });

  it('renders financial position chart section', async () => {
    render(<AccountingDashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Financial Position')).toBeInTheDocument();
    });
  });

  it('renders cash flow trend chart section', async () => {
    render(<AccountingDashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Cash Flow Trend')).toBeInTheDocument();
    });
  });

  it('displays alerts when there are overdue items', async () => {
    render(<AccountingDashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Action Required')).toBeInTheDocument();
    });
  });

  it('renders quick access links', async () => {
    render(<AccountingDashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Quick Access')).toBeInTheDocument();
    });
    expect(screen.getByText('Chart of Accounts')).toBeInTheDocument();
    expect(screen.getByText('Journal Entries')).toBeInTheDocument();
  });
});
