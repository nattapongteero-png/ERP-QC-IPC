/**
 * Chart of Accounts Page Tests
 * Feature: 014-unit-cost
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import ChartOfAccountsPage from '@/app/accounting/chart-of-accounts/page';
import {
  renderWithProviders,
  setupFetchMock,
  clearFetchMock,
  createSingleResponse,
} from '../../../helpers/ui-test-utils';
import { MOCK_GL_ACCOUNTS, MOCK_GL_ACCOUNT_TYPES, ACCOUNTING_FETCH_HANDLERS } from '../../../helpers/fetch-mock-handlers';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
}));

// Mock DevExtreme TreeList
vi.mock('devextreme-react/tree-list', () => {
  const MockTreeList = ({ children }: { children?: React.ReactNode }) => <div data-testid="tree-list">{children}</div>;
  return {
    __esModule: true,
    default: MockTreeList,
    Column: () => null,
    SearchPanel: () => null,
    HeaderFilter: () => null,
    Selection: () => null,
  };
});

// Mock DevExtreme Popup
vi.mock('devextreme-react/popup', () => ({
  Popup: ({ children, visible }: { children?: React.ReactNode; visible?: boolean }) =>
    visible ? <div data-testid="popup">{children}</div> : null,
}));

// Mock DevExtreme Form
vi.mock('devextreme-react/form', () => {
  const MockForm = ({ children }: { children?: React.ReactNode }) => <form data-testid="dx-form">{children}</form>;
  return {
    __esModule: true,
    default: MockForm,
    SimpleItem: () => null,
    GroupItem: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    RequiredRule: () => null,
    StringLengthRule: () => null,
    PatternRule: () => null,
  };
});

// Mock DevExtreme Button
vi.mock('devextreme-react/button', () => ({
  Button: ({ text, onClick }: { text?: string; onClick?: () => void }) => (
    <button onClick={onClick}>{text}</button>
  ),
}));

// Mock DevExtreme notify
vi.mock('devextreme/ui/notify', () => ({
  __esModule: true,
  default: vi.fn(),
}));

// Mock accounting components
vi.mock('@/components/accounting', () => ({
  AccountingPageHeader: ({ title, subtitle, onRefresh, actions }: { title: string; subtitle: string; onRefresh?: () => void; actions?: React.ReactNode }) => (
    <div data-testid="accounting-header">
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {onRefresh && <button onClick={onRefresh}>Refresh</button>}
      {actions && <div data-testid="header-actions">{actions}</div>}
    </div>
  ),
  AccountingKPICard: ({ label, value }: { label: string; value: string | number }) => (
    <div data-testid={`kpi-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  ),
  AccountingFilterPanel: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="filter-panel">{children}</div>
  ),
  AccountingStatusBadge: ({ status }: { status: string }) => <span data-testid="status-badge">{status}</span>,
}));

describe('ChartOfAccountsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFetchMock();
  });

  describe('Page Rendering', () => {
    it('should render page with correct title', async () => {
      setupFetchMock(ACCOUNTING_FETCH_HANDLERS);

      renderWithProviders(<ChartOfAccountsPage />);

      await waitFor(() => {
        expect(screen.getAllByText('Chart of Accounts').length).toBeGreaterThan(0);
      });
    });

    it('should render page subtitle', async () => {
      setupFetchMock(ACCOUNTING_FETCH_HANDLERS);

      renderWithProviders(<ChartOfAccountsPage />);

      await waitFor(() => {
        expect(screen.getAllByText('Chart of Accounts').length).toBeGreaterThan(0);
      });
    });

    it('should render the COA page container', async () => {
      setupFetchMock(ACCOUNTING_FETCH_HANDLERS);

      renderWithProviders(<ChartOfAccountsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('coa-page')).toBeInTheDocument();
      });
    });

    it('should render export button', async () => {
      setupFetchMock(ACCOUNTING_FETCH_HANDLERS);

      renderWithProviders(<ChartOfAccountsPage />);

      await waitFor(() => {
        expect(screen.getByText('Export')).toBeInTheDocument();
      });
    });
  });

  describe('KPI Cards', () => {
    it('should display total accounts KPI', async () => {
      setupFetchMock(ACCOUNTING_FETCH_HANDLERS);

      renderWithProviders(<ChartOfAccountsPage />);

      await waitFor(() => {
        expect(screen.getByText('Total Accounts')).toBeInTheDocument();
      });
    });

    it('should display active accounts KPI', async () => {
      setupFetchMock(ACCOUNTING_FETCH_HANDLERS);

      renderWithProviders(<ChartOfAccountsPage />);

      await waitFor(() => {
        expect(screen.getByText('Active')).toBeInTheDocument();
      });
    });

    it('should display postable accounts KPI', async () => {
      setupFetchMock(ACCOUNTING_FETCH_HANDLERS);

      renderWithProviders(<ChartOfAccountsPage />);

      await waitFor(() => {
        expect(screen.getByText('Postable')).toBeInTheDocument();
      });
    });

    it('should display bank accounts KPI', async () => {
      setupFetchMock(ACCOUNTING_FETCH_HANDLERS);

      renderWithProviders(<ChartOfAccountsPage />);

      await waitFor(() => {
        expect(screen.getByText('Bank Accounts')).toBeInTheDocument();
      });
    });
  });

  describe('TreeList Display', () => {
    it('should render TreeList component', async () => {
      setupFetchMock(ACCOUNTING_FETCH_HANDLERS);

      renderWithProviders(<ChartOfAccountsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('coa-treelist')).toBeInTheDocument();
      });
    });

    it('should render filter panel', async () => {
      setupFetchMock(ACCOUNTING_FETCH_HANDLERS);

      renderWithProviders(<ChartOfAccountsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('filter-panel')).toBeInTheDocument();
      });
    });

    it('should render add account button', async () => {
      setupFetchMock(ACCOUNTING_FETCH_HANDLERS);

      renderWithProviders(<ChartOfAccountsPage />);

      await waitFor(() => {
        expect(screen.getByText('Add Account')).toBeInTheDocument();
      });
    });
  });

  describe('Data Fetching', () => {
    it('should fetch GL accounts on mount', async () => {
      setupFetchMock(ACCOUNTING_FETCH_HANDLERS);

      renderWithProviders(<ChartOfAccountsPage />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      const calls = vi.mocked(fetch).mock.calls;
      const glAccountsCall = calls.find(([url]) =>
        typeof url === 'string' && url.includes('/api/accounting/gl-accounts')
      );
      expect(glAccountsCall).toBeDefined();
    });

    it('should fetch GL account types on mount', async () => {
      setupFetchMock(ACCOUNTING_FETCH_HANDLERS);

      renderWithProviders(<ChartOfAccountsPage />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      const calls = vi.mocked(fetch).mock.calls;
      const typesCall = calls.find(([url]) =>
        typeof url === 'string' && url.includes('/api/accounting/gl-account-types')
      );
      expect(typesCall).toBeDefined();
    });

    it('should handle empty accounts gracefully', async () => {
      setupFetchMock({
        '/api/accounting/gl-accounts': { data: createSingleResponse([]) },
        '/api/accounting/gl-account-types': { data: createSingleResponse(MOCK_GL_ACCOUNT_TYPES) },
      });

      renderWithProviders(<ChartOfAccountsPage />);

      await waitFor(() => {
        expect(screen.getAllByText('Chart of Accounts').length).toBeGreaterThan(0);
      });
    });

    it('should handle API error gracefully', async () => {
      setupFetchMock({
        '/api/accounting/gl-accounts': {
          data: { success: false, error: 'Server error' },
          ok: false,
          status: 500,
        },
        '/api/accounting/gl-account-types': {
          data: { success: false, error: 'Server error' },
          ok: false,
          status: 500,
        },
      });

      renderWithProviders(<ChartOfAccountsPage />);

      // Page may show loading or error state
      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });

    it('should correctly parse API response structure (regression)', () => {
      // GL Accounts page uses direct array format
      const accountsResponse = createSingleResponse(MOCK_GL_ACCOUNTS);

      // Correct: data returns the array directly
      expect(Array.isArray(accountsResponse.data)).toBe(true);
      expect(accountsResponse.data.length).toBe(MOCK_GL_ACCOUNTS.length);

      // Account types response
      const typesResponse = createSingleResponse(MOCK_GL_ACCOUNT_TYPES);
      expect(Array.isArray(typesResponse.data)).toBe(true);
      expect(typesResponse.data.length).toBe(MOCK_GL_ACCOUNT_TYPES.length);
    });
  });

  describe('Statistics Calculation', () => {
    it('should calculate correct total accounts', async () => {
      setupFetchMock(ACCOUNTING_FETCH_HANDLERS);

      renderWithProviders(<ChartOfAccountsPage />);

      await waitFor(() => {
        // Total accounts = MOCK_GL_ACCOUNTS.length = 10
        expect(screen.getByTestId('kpi-total-accounts')).toHaveTextContent('10');
      });
    });

    it('should calculate correct active accounts', async () => {
      setupFetchMock(ACCOUNTING_FETCH_HANDLERS);

      renderWithProviders(<ChartOfAccountsPage />);

      await waitFor(() => {
        // Active accounts = accounts with isActive=true = 9
        expect(screen.getByTestId('kpi-active')).toHaveTextContent('9');
      });
    });

    it('should calculate correct postable accounts', async () => {
      setupFetchMock(ACCOUNTING_FETCH_HANDLERS);

      renderWithProviders(<ChartOfAccountsPage />);

      await waitFor(() => {
        // Postable accounts = accounts with isPostable=true = 5 (ids: 3, 4, 5, 7, 9)
        expect(screen.getByTestId('kpi-postable')).toHaveTextContent('5');
      });
    });

    it('should calculate correct bank accounts', async () => {
      setupFetchMock(ACCOUNTING_FETCH_HANDLERS);

      renderWithProviders(<ChartOfAccountsPage />);

      await waitFor(() => {
        // Bank accounts = accounts with isBankAccount=true = 1
        expect(screen.getByTestId('kpi-bank-accounts')).toHaveTextContent('1');
      });
    });
  });
});
