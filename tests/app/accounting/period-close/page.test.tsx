import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PeriodClosePage from '@/app/accounting/period-close/page';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock fetch
global.fetch = vi.fn();

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = 'TestQueryWrapper';
  return Wrapper;
};

describe('PeriodClosePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    } as Response);
  });

  it('renders professional page header with calendar icon', async () => {
    render(<PeriodClosePage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Period Close')).toBeInTheDocument();
    });
    expect(screen.getByText('Month-end and year-end closing procedures')).toBeInTheDocument();
  });

  it('renders KPI cards with period status', async () => {
    render(<PeriodClosePage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Open Periods')).toBeInTheDocument();
    });
    expect(screen.getByText('Soft Closed')).toBeInTheDocument();
    expect(screen.getByText('Closed Periods')).toBeInTheDocument();
    expect(screen.getByText('Total Periods')).toBeInTheDocument();
  });

  it('renders filter panel with glassmorphism styling', async () => {
    render(<PeriodClosePage />, { wrapper: createWrapper() });

    await waitFor(() => {
      const filterPanel = screen.getByTestId('filter-panel');
      expect(filterPanel).toBeInTheDocument();
      expect(filterPanel).toHaveClass('backdrop-blur');
    });
  });

  it('renders data grid for periods', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 1,
            periodName: 'January 2024',
            startDate: '2024-01-01',
            endDate: '2024-01-31',
            status: 'open',
            fiscalYear: { yearCode: '2024' },
          },
        ],
      }),
    } as Response);

    render(<PeriodClosePage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Fiscal Periods')).toBeInTheDocument();
    });
  });

  it('shows validation panel when period is selected', async () => {
    vi.mocked(fetch).mockImplementation((url) => {
      if (typeof url === 'string' && url.includes('validate')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: {
              canClose: true,
              periodId: 1,
              periodName: 'January 2024',
              fiscalYearCode: '2024',
              errors: [],
              warnings: [],
              metrics: {
                unpostedJournalEntries: 0,
                draftAPInvoices: 0,
                draftARInvoices: 0,
                pendingPayments: 0,
                totalDebits: 0,
                totalCredits: 0,
                isBalanced: true,
              },
            },
          }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: [] }),
      } as Response);
    });

    render(<PeriodClosePage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Select a Period')).toBeInTheDocument();
    });
  });
});
