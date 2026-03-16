import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ReportsPage from '@/app/accounting/reports/page';
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
  Wrapper.displayName = 'TestWrapper';
  return Wrapper;
};

describe('ReportsPage', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    } as Response);
  });

  it('renders professional page header with bar-chart icon', async () => {
    render(<ReportsPage />, { wrapper: createWrapper() });
    expect(screen.getByText('Accounting')).toBeInTheDocument();
    expect(screen.getByText('Generate TFRS-compliant financial statements')).toBeInTheDocument();
  });

  it('renders navigation links and KPI cards for report types', async () => {
    render(<ReportsPage />, { wrapper: createWrapper() });
    // Check for navigation links to dedicated report pages
    expect(screen.getByTestId('link-trial-balance')).toBeInTheDocument();
    expect(screen.getByTestId('link-balance-sheet')).toBeInTheDocument();
    expect(screen.getByTestId('link-income-statement')).toBeInTheDocument();
    expect(screen.getByTestId('link-cash-flow')).toBeInTheDocument();
    // Check that multiple elements with same text exist (links + KPI cards)
    expect(screen.getAllByText('Trial Balance').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Balance Sheet').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Income Statement').length).toBeGreaterThanOrEqual(2);
  });

  it('renders filter panel with glassmorphism styling', async () => {
    render(<ReportsPage />, { wrapper: createWrapper() });
    const filterPanel = screen.getByTestId('filter-panel');
    expect(filterPanel.className).toMatch(/backdrop-blur/);
  });

  it('renders report content area', async () => {
    render(<ReportsPage />, { wrapper: createWrapper() });
    expect(screen.getByTestId('report-content')).toBeInTheDocument();
  });

  it('displays no report message initially', async () => {
    render(<ReportsPage />, { wrapper: createWrapper() });
    expect(screen.getByTestId('no-report-message')).toBeInTheDocument();
  });
});
