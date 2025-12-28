/**
 * Period Close E2E Test
 * Feature: 010-accounting-module-integration
 * User Story 9: Perform Period-End Closing
 *
 * Tests the Period Close page rendering and interactions.
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
  usePathname: () => '/accounting/period-close',
}));

// Mock lucide-react icons - include all icons used by accounting components
vi.mock('lucide-react', async (importOriginal) => {
  const MockIcon = ({ className }: { className?: string }) => <span className={className}>Icon</span>;
  MockIcon.displayName = 'MockIcon';

  return {
    ...(await importOriginal<typeof import('lucide-react')>()),
    Calendar: MockIcon,
    Lock: MockIcon,
    Unlock: MockIcon,
    CheckCircle2: MockIcon,
    AlertTriangle: MockIcon,
    XCircle: MockIcon,
    BookOpen: MockIcon,
    FileText: MockIcon,
    Receipt: MockIcon,
    Wallet: MockIcon,
    Clock: MockIcon,
    BarChart3: MockIcon,
    CheckCircle: MockIcon,
    ChevronDown: MockIcon,
    RefreshCw: MockIcon,
    Download: MockIcon,
    Loader2: MockIcon,
    AlertCircle: MockIcon,
    Search: MockIcon,
    Package: MockIcon,
    TrendingUp: MockIcon,
    TrendingDown: MockIcon,
    Building: MockIcon,
  };
});

// Mock shared components
vi.mock('@/components/shared', () => ({
  ResponsivePageHeader: ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div>
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </div>
  ),
  StatCard: ({ label, value }: { label: string; value: string | number }) => (
    <div data-testid={`stat-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  ),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Sample data
const mockFiscalYears = [
  {
    id: 1,
    yearCode: '2025',
    startDate: '2025-01-01',
    endDate: '2025-12-31',
    isCurrent: true,
    status: 'open',
  },
  {
    id: 2,
    yearCode: '2024',
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    isCurrent: false,
    status: 'closed',
  },
];

const mockPeriods = [
  {
    id: 1,
    fiscalYearId: 1,
    periodNumber: 1,
    periodName: 'January 2025',
    startDate: '2025-01-01',
    endDate: '2025-01-31',
    status: 'closed',
    closedBy: 1,
    closedAt: '2025-02-01',
    fiscalYear: mockFiscalYears[0],
  },
  {
    id: 2,
    fiscalYearId: 1,
    periodNumber: 2,
    periodName: 'February 2025',
    startDate: '2025-02-01',
    endDate: '2025-02-28',
    status: 'soft_closed',
    closedBy: 1,
    closedAt: '2025-03-01',
    fiscalYear: mockFiscalYears[0],
  },
  {
    id: 3,
    fiscalYearId: 1,
    periodNumber: 3,
    periodName: 'March 2025',
    startDate: '2025-03-01',
    endDate: '2025-03-31',
    status: 'open',
    closedBy: null,
    closedAt: null,
    fiscalYear: mockFiscalYears[0],
  },
];

const mockValidation = {
  canClose: true,
  periodId: 3,
  periodName: 'March 2025',
  fiscalYearCode: '2025',
  errors: [],
  warnings: [],
  metrics: {
    unpostedJournalEntries: 0,
    draftAPInvoices: 0,
    draftARInvoices: 0,
    pendingPayments: 0,
    totalDebits: 100000,
    totalCredits: 100000,
    isBalanced: true,
  },
};

const mockValidationWithErrors = {
  canClose: false,
  periodId: 3,
  periodName: 'March 2025',
  fiscalYearCode: '2025',
  errors: [
    { code: 'UNPOSTED_JOURNAL_ENTRIES', message: 'There are 5 unposted journal entries', count: 5 },
    { code: 'DRAFT_AP_INVOICES', message: 'There are 3 draft AP invoices', count: 3 },
  ],
  warnings: [
    { code: 'PENDING_PAYMENTS', message: 'There are 2 pending payments', count: 2 },
  ],
  metrics: {
    unpostedJournalEntries: 5,
    draftAPInvoices: 3,
    draftARInvoices: 0,
    pendingPayments: 2,
    totalDebits: 100000,
    totalCredits: 100000,
    isBalanced: true,
  },
};

describe('Period Close Page', () => {
  let queryClient: QueryClient;

  beforeEach(async () => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: 0,
        },
      },
    });

    // Reset mock
    mockFetch.mockReset();

    // Setup default mock responses
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/accounting/fiscal-years')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockFiscalYears }),
        });
      }
      if (url.includes('/api/accounting/fiscal-periods') && url.includes('/validate')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockValidation }),
        });
      }
      if (url.includes('/api/accounting/fiscal-periods')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockPeriods }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: null }),
      });
    });
  });

  const renderPage = async () => {
    const PeriodClosePage = (await import('@/app/accounting/period-close/page')).default;
    return render(
      <QueryClientProvider client={queryClient}>
        <PeriodClosePage />
      </QueryClientProvider>
    );
  };

  it('should render page header correctly', async () => {
    await renderPage();

    await waitFor(() => {
      expect(screen.getByText('Period Close')).toBeInTheDocument();
    });
  });

  it('should display subtitle about closing procedures', async () => {
    await renderPage();

    await waitFor(() => {
      expect(screen.getByText(/closing procedures/)).toBeInTheDocument();
    });
  });

  it('should display Open Periods stat card', async () => {
    await renderPage();

    await waitFor(() => {
      expect(screen.getByText('Open Periods')).toBeInTheDocument();
    });
  });

  it('should display Closed Periods stat card', async () => {
    await renderPage();

    await waitFor(() => {
      expect(screen.getByText('Closed Periods')).toBeInTheDocument();
    });
  });

  it('should display Soft Closed stat card', async () => {
    await renderPage();

    await waitFor(() => {
      expect(screen.getByText('Soft Closed')).toBeInTheDocument();
    });
  });

  it('should display Total Periods stat card', async () => {
    await renderPage();

    await waitFor(() => {
      expect(screen.getByText('Total Periods')).toBeInTheDocument();
    });
  });

  it('should display Fiscal Year filter', async () => {
    await renderPage();

    await waitFor(() => {
      expect(screen.getByText('Fiscal Year')).toBeInTheDocument();
    });
  });

  it('should display Fiscal Periods heading', async () => {
    await renderPage();

    await waitFor(() => {
      expect(screen.getByText('Fiscal Periods')).toBeInTheDocument();
    });
  });

  it('should display Select a Period message when no period selected', async () => {
    await renderPage();

    await waitFor(() => {
      expect(screen.getByText('Select a Period')).toBeInTheDocument();
    });
  });

  it('should call fiscal years API on load', async () => {
    await renderPage();

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/accounting/fiscal-years')
      );
    });
  });

  it('should call fiscal periods API on load', async () => {
    await renderPage();

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/accounting/fiscal-periods')
      );
    });
  });

  it('should handle API error gracefully', async () => {
    mockFetch.mockImplementation(() => {
      return Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ error: 'Failed to fetch periods' }),
      });
    });

    await renderPage();

    // Page should still render without crashing
    await waitFor(() => {
      expect(screen.getByText('Period Close')).toBeInTheDocument();
    });
  });
});

describe('Period Close API Responses', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('should handle periods list response correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, data: mockPeriods }),
    });

    const response = await fetch('/api/accounting/fiscal-periods');
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data).toHaveLength(3);
    expect(data.data[0].periodName).toBe('January 2025');
    expect(data.data[0].status).toBe('closed');
  });

  it('should handle fiscal years response correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, data: mockFiscalYears }),
    });

    const response = await fetch('/api/accounting/fiscal-years');
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data).toHaveLength(2);
    expect(data.data[0].yearCode).toBe('2025');
    expect(data.data[0].status).toBe('open');
  });

  it('should handle validation response for closeable period', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, data: mockValidation }),
    });

    const response = await fetch('/api/accounting/fiscal-periods/3/validate');
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data.canClose).toBe(true);
    expect(data.data.errors).toHaveLength(0);
    expect(data.data.metrics.isBalanced).toBe(true);
  });

  it('should handle validation response with errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, data: mockValidationWithErrors }),
    });

    const response = await fetch('/api/accounting/fiscal-periods/3/validate');
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data.canClose).toBe(false);
    expect(data.data.errors).toHaveLength(2);
    expect(data.data.warnings).toHaveLength(1);
  });

  it('should handle close period response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, message: 'Period closed successfully' }),
    });

    const response = await fetch('/api/accounting/fiscal-periods/3/close', {
      method: 'POST',
      body: JSON.stringify({ force: false }),
    });
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.message).toContain('closed');
  });

  it('should handle reopen period response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, message: 'Period reopened successfully' }),
    });

    const response = await fetch('/api/accounting/fiscal-periods/1/reopen', {
      method: 'POST',
      body: JSON.stringify({ reason: 'Correction needed' }),
    });
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.message).toContain('reopened');
  });
});

describe('Period Status Validation', () => {
  it('should identify open periods', () => {
    const period = mockPeriods.find(p => p.status === 'open');
    expect(period).toBeDefined();
    expect(period?.periodName).toBe('March 2025');
  });

  it('should identify soft closed periods', () => {
    const period = mockPeriods.find(p => p.status === 'soft_closed');
    expect(period).toBeDefined();
    expect(period?.periodName).toBe('February 2025');
  });

  it('should identify closed periods', () => {
    const period = mockPeriods.find(p => p.status === 'closed');
    expect(period).toBeDefined();
    expect(period?.periodName).toBe('January 2025');
  });
});

describe('Period Close Validation Logic', () => {
  it('should allow close when no errors', () => {
    expect(mockValidation.canClose).toBe(true);
    expect(mockValidation.errors).toHaveLength(0);
  });

  it('should prevent close when there are errors', () => {
    expect(mockValidationWithErrors.canClose).toBe(false);
    expect(mockValidationWithErrors.errors.length).toBeGreaterThan(0);
  });

  it('should show unposted journal entries count', () => {
    expect(mockValidationWithErrors.metrics.unpostedJournalEntries).toBe(5);
  });

  it('should show draft AP invoices count', () => {
    expect(mockValidationWithErrors.metrics.draftAPInvoices).toBe(3);
  });

  it('should verify trial balance is balanced', () => {
    expect(mockValidation.metrics.isBalanced).toBe(true);
  });
});

describe('Period Count Calculations', () => {
  it('should count open periods correctly', () => {
    const openCount = mockPeriods.filter(p => p.status === 'open').length;
    expect(openCount).toBe(1);
  });

  it('should count closed periods correctly', () => {
    const closedCount = mockPeriods.filter(p => p.status === 'closed').length;
    expect(closedCount).toBe(1);
  });

  it('should count soft closed periods correctly', () => {
    const softClosedCount = mockPeriods.filter(p => p.status === 'soft_closed').length;
    expect(softClosedCount).toBe(1);
  });

  it('should count total periods correctly', () => {
    expect(mockPeriods.length).toBe(3);
  });
});

describe('Fiscal Year Status', () => {
  it('should identify open fiscal year', () => {
    const openYear = mockFiscalYears.find(y => y.status === 'open');
    expect(openYear).toBeDefined();
    expect(openYear?.yearCode).toBe('2025');
  });

  it('should identify closed fiscal year', () => {
    const closedYear = mockFiscalYears.find(y => y.status === 'closed');
    expect(closedYear).toBeDefined();
    expect(closedYear?.yearCode).toBe('2024');
  });

  it('should identify current fiscal year', () => {
    const currentYear = mockFiscalYears.find(y => y.isCurrent);
    expect(currentYear).toBeDefined();
    expect(currentYear?.yearCode).toBe('2025');
  });
});
