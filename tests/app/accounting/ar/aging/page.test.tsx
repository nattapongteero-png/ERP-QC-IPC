/**
 * AR Aging Report Page Test
 * Feature: 010-accounting-module-integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => '/accounting/ar/aging',
}));

// Mock lucide-react icons
vi.mock('lucide-react', async (importOriginal) => {
  const MockIcon = ({ className }: { className?: string }) => <span className={className}>Icon</span>;
  MockIcon.displayName = 'MockIcon';

  return {
    ...(await importOriginal<typeof import('lucide-react')>()),
    Clock: MockIcon,
    Users: MockIcon,
    TrendingUp: MockIcon,
    AlertTriangle: MockIcon,
    Calendar: MockIcon,
  };
});

// Mock recharts
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="chart-container">{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
  Legend: () => <div />,
  Cell: () => <div />,
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockAgingReport = {
  reportType: 'AR',
  asOfDate: '2025-01-26',
  entries: [
    {
      entityId: 1,
      entityName: 'Customer A',
      current: 10700,
      days1to30: 0,
      days31to60: 0,
      days61to90: 0,
      over90: 0,
      total: 10700,
    },
  ],
  buckets: [
    { range: 'Current', count: 1, amount: 10700 },
    { range: '1-30 Days', count: 0, amount: 0 },
    { range: '31-60 Days', count: 0, amount: 0 },
    { range: '61-90 Days', count: 0, amount: 0 },
    { range: '90+ Days', count: 0, amount: 0 },
  ],
  totals: {
    current: 10700,
    days1to30: 0,
    days31to60: 0,
    days61to90: 0,
    over90: 0,
    total: 10700,
  },
};

describe('AR Aging Report Page', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    mockFetch.mockReset();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/accounting/reports/aging')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockAgingReport }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: [] }),
      });
    });
  });

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = 'QueryClientWrapper';

  const renderPage = async () => {
    const ARAgingPage = (await import('@/app/accounting/ar/aging/page')).default;
    return render(
      <Wrapper>
        <ARAgingPage />
      </Wrapper>
    );
  };

  it('renders page header with correct title', async () => {
    await renderPage();

    await waitFor(() => {
      expect(screen.getByText('Aging Report')).toBeInTheDocument();
    }, { timeout: 10000 });
  }, 15000);

  it('renders aging KPI cards', async () => {
    await renderPage();

    await waitFor(() => {
      // These labels may appear multiple times (KPI cards + summary table)
      expect(screen.getAllByText('Current').length).toBeGreaterThan(0);
      expect(screen.getAllByText('1-30 Days').length).toBeGreaterThan(0);
      expect(screen.getAllByText('31-60 Days').length).toBeGreaterThan(0);
      expect(screen.getAllByText('61-90 Days').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Over 90 Days').length).toBeGreaterThan(0);
      expect(screen.getByText('Total AR')).toBeInTheDocument();
    });
  });

  it('renders date filter', async () => {
    await renderPage();

    await waitFor(() => {
      expect(screen.getByText('As of Date')).toBeInTheDocument();
    });
  });

  it('renders aging distribution chart', async () => {
    await renderPage();

    await waitFor(() => {
      expect(screen.getByText('Aging Distribution')).toBeInTheDocument();
    });
  });

  it('renders aging summary section', async () => {
    await renderPage();

    await waitFor(() => {
      expect(screen.getByText('Aging Summary')).toBeInTheDocument();
    });
  });

  it('renders AR aging by customer grid', async () => {
    await renderPage();

    await waitFor(() => {
      expect(screen.getByText('AR Aging by Customer')).toBeInTheDocument();
    });
  });

  it('calls aging report API on load', async () => {
    await renderPage();

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/accounting/reports/aging')
      );
    });
  });
});
