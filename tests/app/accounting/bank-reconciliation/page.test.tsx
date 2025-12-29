/**
 * Bank Reconciliation Page UI Test (T076)
 * Part of 011-accounting-spec-gap - User Story 2
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
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
  const DataGrid = ({ children, ...props }: any) => (
    <div data-testid={props['data-testid'] || 'data-grid'}>{children}</div>
  );
  DataGrid.Column = () => null;
  DataGrid.Paging = () => null;
  DataGrid.FilterRow = () => null;
  DataGrid.Toolbar = ({ children }: any) => <div>{children}</div>;
  DataGrid.Item = () => null;
  DataGrid.SearchPanel = () => null;
  DataGrid.Selection = () => null;
  return {
    default: DataGrid,
    Column: () => null,
    Paging: () => null,
    FilterRow: () => null,
    Toolbar: ({ children }: any) => <div>{children}</div>,
    Item: () => null,
    SearchPanel: () => null,
    Selection: () => null,
  };
});

vi.mock('devextreme-react/button', () => ({
  Button: ({ text, ...props }: any) => (
    <button data-testid={props['data-testid']}>{text}</button>
  ),
}));

vi.mock('devextreme-react/load-indicator', () => ({
  LoadIndicator: () => <div data-testid="loading">Loading...</div>,
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
    openingBalance: 100000,
    closingBalance: 150000,
    totalDebits: 20000,
    totalCredits: 70000,
    status: 'in_progress',
    matchedCount: 5,
    unmatchedCount: 3,
    currency: 'THB',
  },
  {
    id: 2,
    statementNumber: 'BS2024-001-0002',
    bankAccountId: 1,
    bankAccountName: 'Main Bank',
    bankAccountNumber: '1234567890',
    statementDate: '2024-02-15',
    openingBalance: 150000,
    closingBalance: 200000,
    totalDebits: 30000,
    totalCredits: 80000,
    status: 'reconciled',
    matchedCount: 10,
    unmatchedCount: 0,
    currency: 'THB',
  },
];

const mockSummary = {
  totalStatements: 2,
  pendingReconciliation: 1,
  reconciledThisMonth: 1,
  unmatchedLines: 3,
};

global.fetch = vi.fn().mockImplementation((url: string) => {
  if (url.includes('/dashboard')) {
    return Promise.resolve({
      json: () => Promise.resolve({ success: true, data: mockSummary }),
    });
  }
  return Promise.resolve({
    json: () =>
      Promise.resolve({
        success: true,
        data: mockStatements,
        total: mockStatements.length,
      }),
  });
});

import BankReconciliationPage from '@/app/accounting/bank-reconciliation/page';

describe('Bank Reconciliation Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/dashboard')) {
        return Promise.resolve({
          json: () => Promise.resolve({ success: true, data: mockSummary }),
        });
      }
      return Promise.resolve({
        json: () =>
          Promise.resolve({
            success: true,
            data: mockStatements,
            total: mockStatements.length,
          }),
      });
    });
  });

  it('renders the page title', async () => {
    render(<BankReconciliationPage />);

    await waitFor(() => {
      expect(screen.getByTestId('page-title')).toBeInTheDocument();
    });

    expect(screen.getByTestId('page-title')).toHaveTextContent('Bank Reconciliation');
  });

  it('renders the statements grid', async () => {
    render(<BankReconciliationPage />);

    await waitFor(() => {
      expect(screen.getByTestId('statements-grid')).toBeInTheDocument();
    });
  });

  it('fetches statements on mount', async () => {
    render(<BankReconciliationPage />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/accounting/bank-reconciliation/statements'
      );
    });
  });

  it('fetches dashboard summary on mount', async () => {
    render(<BankReconciliationPage />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/accounting/bank-reconciliation/dashboard'
      );
    });
  });

  it('displays page description', async () => {
    render(<BankReconciliationPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/Import bank statements and reconcile transactions/i)
      ).toBeInTheDocument();
    });
  });
});

describe('Bank Reconciliation Page with empty data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/dashboard')) {
        return Promise.resolve({
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
        json: () => Promise.resolve({ success: true, data: [], total: 0 }),
      });
    });
  });

  it('renders grid with no data', async () => {
    render(<BankReconciliationPage />);

    await waitFor(() => {
      expect(screen.getByTestId('statements-grid')).toBeInTheDocument();
    });
  });
});

describe('Bank Reconciliation Page with error', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
  });

  it('handles fetch error gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<BankReconciliationPage />);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
    });

    consoleSpy.mockRestore();
  });
});
