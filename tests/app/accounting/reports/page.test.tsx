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
    expect(screen.getByText('Financial Reports')).toBeInTheDocument();
    expect(screen.getByText('Generate TFRS-compliant financial statements')).toBeInTheDocument();
  });

  it('renders KPI cards for report types', async () => {
    render(<ReportsPage />, { wrapper: createWrapper() });
    expect(screen.getByText('Trial Balance')).toBeInTheDocument();
    expect(screen.getByText('Balance Sheet')).toBeInTheDocument();
    expect(screen.getByText('Income Statement')).toBeInTheDocument();
    expect(screen.getByText('Aging Reports')).toBeInTheDocument();
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
