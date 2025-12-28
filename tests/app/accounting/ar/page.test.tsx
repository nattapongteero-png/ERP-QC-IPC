/**
 * AR Dashboard Page Test
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
  usePathname: () => '/accounting/ar',
}));

// Mock lucide-react icons
vi.mock('lucide-react', async (importOriginal) => {
  const MockIcon = ({ className }: { className?: string }) => <span className={className}>Icon</span>;
  MockIcon.displayName = 'MockIcon';

  return {
    ...(await importOriginal<typeof import('lucide-react')>()),
    FileText: MockIcon,
    AlertTriangle: MockIcon,
    TrendingUp: MockIcon,
    TrendingDown: MockIcon,
    Minus: MockIcon,
    BarChart3: MockIcon,
    ChevronRight: MockIcon,
    Users: MockIcon,
    Banknote: MockIcon,
    Wallet: MockIcon,
    ArrowUpRight: MockIcon,
    ArrowDownRight: MockIcon,
    Activity: MockIcon,
    CreditCard: MockIcon,
    PiggyBank: MockIcon,
    Clock: MockIcon,
    Package: MockIcon,
    Wrench: MockIcon,
    CheckCircle2: MockIcon,
    RefreshCw: MockIcon,
    RotateCcw: MockIcon,
  };
});

// Mock recharts
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="chart-container">{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
  Legend: () => <div />,
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockInvoices = [
  {
    id: 1,
    invoiceNumber: 'AR-001',
    customerId: 1,
    customerName: 'Customer A',
    invoiceDate: '2025-01-15',
    dueDate: '2025-02-15',
    description: 'Product sale',
    subtotal: 10000,
    vatAmount: 700,
    whtAmount: 0,
    totalAmount: 10700,
    paidAmount: 0,
    currency: 'THB',
    status: 'posted',
    journalEntryId: 1,
  },
];

describe('AR Dashboard Page', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    mockFetch.mockReset();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/accounting/ar-invoices')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockInvoices }),
        });
      }
      if (url.includes('/api/accounting/reports/aging')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: {
              totals: { current: 10700, days30: 0, days60: 0, days90: 0, over90: 0 },
            },
          }),
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
    const ARDashboardPage = (await import('@/app/accounting/ar/page')).default;
    return render(
      <Wrapper>
        <ARDashboardPage />
      </Wrapper>
    );
  };

  it('renders page header with correct title', async () => {
    await renderPage();

    await waitFor(() => {
      expect(screen.getByText('Accounts Receivable Dashboard')).toBeInTheDocument();
    });
  });

  it('renders KPI cards', async () => {
    await renderPage();

    await waitFor(() => {
      // These labels may appear multiple times (KPI cards + summary footer)
      expect(screen.getAllByText('Total Receivables').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Pending Invoices').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Overdue Amount').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Collected This Month').length).toBeGreaterThan(0);
    });
  });

  it('renders quick navigation cards', async () => {
    await renderPage();

    await waitFor(() => {
      expect(screen.getByText('AR Invoices')).toBeInTheDocument();
      expect(screen.getByText('Receipts')).toBeInTheDocument();
      expect(screen.getByText('Aging Report')).toBeInTheDocument();
    });
  });

  it('renders recent AR invoices section', async () => {
    await renderPage();

    await waitFor(() => {
      expect(screen.getByText('Recent AR Invoices')).toBeInTheDocument();
    });
  });

  it('renders AR aging summary chart section', async () => {
    await renderPage();

    await waitFor(() => {
      expect(screen.getByText('AR Aging Summary')).toBeInTheDocument();
    });
  });

  it('calls AR invoices API on load', async () => {
    await renderPage();

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/accounting/ar-invoices')
      );
    });
  });
});
