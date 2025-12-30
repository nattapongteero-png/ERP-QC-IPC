/**
 * Bank Reconciliation E2E Test (T155)
 * Feature: 011-accounting-spec-gap
 * User Story 2: Bank Statement Reconciliation
 *
 * Tests the Bank Reconciliation page rendering and interactions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/accounting/bank-reconciliation',
}));

// Mock lucide-react icons
vi.mock('lucide-react', async (importOriginal) => {
  const MockIcon = ({ className }: { className?: string }) => <span className={className}>Icon</span>;
  MockIcon.displayName = 'MockIcon';

  return {
    ...(await importOriginal<typeof import('lucide-react')>()),
    Plus: MockIcon,
    FileText: MockIcon,
    Upload: MockIcon,
    CheckCircle: MockIcon,
    XCircle: MockIcon,
    Search: MockIcon,
    Filter: MockIcon,
    ChevronDown: MockIcon,
    RefreshCw: MockIcon,
    Download: MockIcon,
    AlertCircle: MockIcon,
    Loader2: MockIcon,
    Link: MockIcon,
    Unlink: MockIcon,
    DollarSign: MockIcon,
    Calendar: MockIcon,
  };
});

// Mock MainLayout
vi.mock('@/components/layout/main-layout', () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="main-layout">{children}</div>
  ),
}));

// Mock DevExtreme components
vi.mock('devextreme-react/data-grid', () => ({
  default: ({ dataSource, children, ...props }: any) => (
    <div data-testid={props['data-testid'] || 'data-grid'}>
      <table>
        <tbody>
          {Array.isArray(dataSource) && dataSource.map((row: any, i: number) => (
            <tr key={i} data-testid={`grid-row-${i}`}>
              <td>{row.statementNumber || row.id}</td>
              <td>{row.status}</td>
              <td>{row.endingBalance}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {children}
    </div>
  ),
  Column: () => null,
  Paging: () => null,
  FilterRow: () => null,
  SearchPanel: () => null,
  HeaderFilter: () => null,
  Scrolling: () => null,
  Selection: () => null,
  Toolbar: ({ children }: any) => <div data-testid="grid-toolbar">{children}</div>,
  Item: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('devextreme-react/button', () => ({
  Button: ({ text, onClick, ...props }: any) => (
    <button onClick={onClick} data-testid={props['data-testid']}>{text}</button>
  ),
}));

vi.mock('devextreme-react/load-indicator', () => ({
  LoadIndicator: () => <div data-testid="dx-loadindicator">Loading...</div>,
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Sample bank statement data
const mockStatements = [
  {
    id: 1,
    bankAccountId: 1,
    bankAccountName: 'Main Operating Account',
    statementNumber: 'BS-2024-001',
    statementDate: '2024-01-31',
    startDate: '2024-01-01',
    endDate: '2024-01-31',
    openingBalance: 100000,
    endingBalance: 125000,
    totalDebits: 50000,
    totalCredits: 75000,
    status: 'pending',
    matchedCount: 0,
    unmatchedCount: 15,
    createdAt: '2024-01-31T10:00:00Z',
  },
  {
    id: 2,
    bankAccountId: 1,
    bankAccountName: 'Main Operating Account',
    statementNumber: 'BS-2024-002',
    statementDate: '2024-02-29',
    startDate: '2024-02-01',
    endDate: '2024-02-29',
    openingBalance: 125000,
    endingBalance: 140000,
    totalDebits: 60000,
    totalCredits: 75000,
    status: 'in_progress',
    matchedCount: 10,
    unmatchedCount: 5,
    createdAt: '2024-02-29T10:00:00Z',
  },
  {
    id: 3,
    bankAccountId: 2,
    bankAccountName: 'Petty Cash',
    statementNumber: 'BS-2024-003',
    statementDate: '2024-01-31',
    startDate: '2024-01-01',
    endDate: '2024-01-31',
    openingBalance: 5000,
    endingBalance: 4500,
    totalDebits: 2000,
    totalCredits: 1500,
    status: 'reconciled',
    matchedCount: 12,
    unmatchedCount: 0,
    reconciledAt: '2024-02-01T14:00:00Z',
    createdAt: '2024-01-31T10:00:00Z',
  },
];

// Sample bank accounts
const mockBankAccounts = [
  { id: 1, accountName: 'Main Operating Account', accountNumber: '123-456-789', bankName: 'Bangkok Bank' },
  { id: 2, accountName: 'Petty Cash', accountNumber: '987-654-321', bankName: 'Kasikorn Bank' },
];

// Mock dashboard summary
const mockDashboardSummary = {
  totalStatements: 3,
  pendingReconciliation: 2,
  reconciledThisMonth: 1,
  unmatchedLines: 20,
};

describe('Bank Reconciliation Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/accounting/bank-reconciliation/dashboard')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: mockDashboardSummary,
          }),
        });
      }
      if (url.includes('/api/accounting/bank-reconciliation/statements')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: mockStatements,
            total: mockStatements.length,
          }),
        });
      }
      if (url.includes('/api/accounting/bank-accounts')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: mockBankAccounts,
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: [] }),
      });
    });
  });

  it('should render page title', async () => {
    const BankReconciliationPage = (await import('@/app/accounting/bank-reconciliation/page')).default;

    render(<BankReconciliationPage />);

    await waitFor(() => {
      expect(screen.getByTestId('page-title')).toHaveTextContent('Bank Reconciliation');
    });
  });

  it('should render statements data grid', async () => {
    const BankReconciliationPage = (await import('@/app/accounting/bank-reconciliation/page')).default;

    render(<BankReconciliationPage />);

    await waitFor(() => {
      expect(screen.getByTestId('statements-grid')).toBeInTheDocument();
    });
  });

  it('should render import statement button', async () => {
    const BankReconciliationPage = (await import('@/app/accounting/bank-reconciliation/page')).default;

    render(<BankReconciliationPage />);

    await waitFor(() => {
      expect(screen.getByTestId('import-btn')).toBeInTheDocument();
    });
  });

  it('should display statement data in grid', async () => {
    const BankReconciliationPage = (await import('@/app/accounting/bank-reconciliation/page')).default;

    render(<BankReconciliationPage />);

    await waitFor(() => {
      expect(screen.getByText('BS-2024-001')).toBeInTheDocument();
      expect(screen.getByText('BS-2024-002')).toBeInTheDocument();
    });
  });

  it('should fetch statements on mount', async () => {
    const BankReconciliationPage = (await import('@/app/accounting/bank-reconciliation/page')).default;

    render(<BankReconciliationPage />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/accounting/bank-reconciliation')
      );
    });
  });

  it('should show loading state initially', async () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));

    const BankReconciliationPage = (await import('@/app/accounting/bank-reconciliation/page')).default;

    render(<BankReconciliationPage />);

    expect(screen.getByTestId('dx-loadindicator')).toBeInTheDocument();
  });

  it('should display different status values', async () => {
    const BankReconciliationPage = (await import('@/app/accounting/bank-reconciliation/page')).default;

    render(<BankReconciliationPage />);

    await waitFor(() => {
      expect(screen.getByText('pending')).toBeInTheDocument();
      expect(screen.getByText('in_progress')).toBeInTheDocument();
      expect(screen.getByText('reconciled')).toBeInTheDocument();
    });
  });
});

describe('Bank Reconciliation Workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/accounting/bank-reconciliation/dashboard')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: mockDashboardSummary,
          }),
        });
      }
      if (url.includes('/api/accounting/bank-reconciliation/statements')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: mockStatements,
            total: mockStatements.length,
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: [] }),
      });
    });
  });

  it('should handle API error gracefully', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const BankReconciliationPage = (await import('@/app/accounting/bank-reconciliation/page')).default;

    render(<BankReconciliationPage />);

    await waitFor(() => {
      expect(screen.getByTestId('page-title')).toBeInTheDocument();
    });
  });
});
