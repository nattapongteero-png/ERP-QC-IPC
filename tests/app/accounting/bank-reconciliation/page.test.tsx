/**
 * Bank Reconciliation Page UI Test (T076)
 * Part of 011-accounting-spec-gap - User Story 2
 * Updated to use TanStack Query pattern from template tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/accounting/bank-reconciliation',
}));

// Mock next-auth
vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { id: 1, name: 'Test User', role: 'admin' } },
    status: 'authenticated',
  }),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock DevExtreme components
vi.mock('devextreme-react/data-grid', () => {
  const DataGrid = ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <div data-testid={(props['data-testid'] as string) || 'data-grid'}>{children}</div>
  );
  return {
    default: DataGrid,
    Column: () => null,
    Paging: () => null,
    Pager: () => null,
    FilterRow: () => null,
    HeaderFilter: () => null,
    Sorting: () => null,
    Toolbar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Item: () => null,
    SearchPanel: () => null,
    Selection: () => null,
  };
});

vi.mock('devextreme-react/button', () => ({
  Button: ({ text, ...props }: Record<string, unknown>) => (
    <button data-testid={props['data-testid'] as string}>{text as string}</button>
  ),
}));

vi.mock('devextreme-react/load-indicator', () => ({
  LoadIndicator: () => <div data-testid="loading">Loading...</div>,
}));

vi.mock('devextreme/ui/notify', () => ({
  default: vi.fn(),
}));

// Mock data
const mockStatements = [
  {
    id: 1,
    statementNumber: 'BS2024-001-0001',
    bankAccountId: 1,
    bankAccountName: 'Main Bank',
    bankAccountNumber: '1234567890',
    statementDate: '2024-01-15',
    startDate: '2024-01-01',
    endDate: '2024-01-15',
    openingBalance: 100000,
    closingBalance: 150000,
    totalDebits: 20000,
    totalCredits: 70000,
    status: 'in_progress',
    matchedCount: 5,
    unmatchedCount: 3,
    currency: 'THB',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
  },
  {
    id: 2,
    statementNumber: 'BS2024-001-0002',
    bankAccountId: 1,
    bankAccountName: 'Main Bank',
    bankAccountNumber: '1234567890',
    statementDate: '2024-02-15',
    startDate: '2024-02-01',
    endDate: '2024-02-15',
    openingBalance: 150000,
    closingBalance: 200000,
    totalDebits: 30000,
    totalCredits: 80000,
    status: 'reconciled',
    matchedCount: 10,
    unmatchedCount: 0,
    currency: 'THB',
    createdAt: '2024-02-15T10:00:00Z',
    updatedAt: '2024-02-15T10:00:00Z',
  },
];

const mockSummary = {
  totalStatements: 2,
  pendingReconciliation: 1,
  reconciledThisMonth: 1,
  unmatchedLines: 3,
};

// Create a fresh QueryClient for each test
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
}

// Wrapper component for tests
function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

const mockFetch = vi.fn();

describe('Bank Reconciliation Page', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    global.fetch = mockFetch;

    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/dashboard')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockSummary }),
        });
      }
      if (url.includes('/statements')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockStatements }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: [] }),
      });
    });
  });

  it('renders the page title', async () => {
    const BankReconciliationPage = (await import('@/app/accounting/bank-reconciliation/page')).default;

    render(
      <TestWrapper>
        <BankReconciliationPage />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Accounting')).toBeInTheDocument();
    });
  });

  it('renders the statements grid', async () => {
    const BankReconciliationPage = (await import('@/app/accounting/bank-reconciliation/page')).default;

    render(
      <TestWrapper>
        <BankReconciliationPage />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('statements-grid')).toBeInTheDocument();
    });
  });

  it('fetches statements on mount', async () => {
    const BankReconciliationPage = (await import('@/app/accounting/bank-reconciliation/page')).default;

    render(
      <TestWrapper>
        <BankReconciliationPage />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/accounting/bank-reconciliation/statements'
      );
    });
  });

  it('fetches dashboard summary on mount', async () => {
    const BankReconciliationPage = (await import('@/app/accounting/bank-reconciliation/page')).default;

    render(
      <TestWrapper>
        <BankReconciliationPage />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/accounting/bank-reconciliation/dashboard'
      );
    });
  });

  it('displays page description', async () => {
    const BankReconciliationPage = (await import('@/app/accounting/bank-reconciliation/page')).default;

    render(
      <TestWrapper>
        <BankReconciliationPage />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Manage general ledger/i)
      ).toBeInTheDocument();
    });
  });

  it('renders KPI cards', async () => {
    const BankReconciliationPage = (await import('@/app/accounting/bank-reconciliation/page')).default;

    render(
      <TestWrapper>
        <BankReconciliationPage />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Total Statements')).toBeInTheDocument();
      expect(screen.getByText('Pending Reconciliation')).toBeInTheDocument();
      expect(screen.getByText('Reconciled This Month')).toBeInTheDocument();
      expect(screen.getByText('Unmatched Lines')).toBeInTheDocument();
    });
  });
});

describe('Bank Reconciliation Page with empty data', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    global.fetch = mockFetch;

    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/dashboard')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                totalStatements: 0,
                pendingReconciliation: 0,
                reconciledThisMonth: 0,
                unmatchedLines: 0,
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

  it('renders grid with no data', async () => {
    const BankReconciliationPage = (await import('@/app/accounting/bank-reconciliation/page')).default;

    render(
      <TestWrapper>
        <BankReconciliationPage />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('statements-grid')).toBeInTheDocument();
    });
  });
});

describe('Bank Reconciliation Page with error', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    global.fetch = mockFetch;
    mockFetch.mockRejectedValue(new Error('Network error'));
  });

  it('handles fetch error gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const BankReconciliationPage = (await import('@/app/accounting/bank-reconciliation/page')).default;

    render(
      <TestWrapper>
        <BankReconciliationPage />
      </TestWrapper>
    );

    // Page should still render even with errors
    await waitFor(() => {
      expect(screen.getByTestId('statements-grid')).toBeInTheDocument();
    });

    consoleSpy.mockRestore();
  });
});
