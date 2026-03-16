/**
 * Customers Page Tests
 * Feature: 014-unit-cost
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import CustomersPage from '@/app/sales/customers/page';
import {
  renderWithProviders,
  setupFetchMock,
  clearFetchMock,
  createPaginatedResponse,
} from '../../../helpers/ui-test-utils';
import { SALES_FETCH_HANDLERS, MOCK_CUSTOMERS } from '../../../helpers/fetch-mock-handlers';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Users: () => <span data-testid="icon-users" />,
  Building2: () => <span data-testid="icon-building" />,
  Hospital: () => <span data-testid="icon-hospital" />,
  Pill: () => <span data-testid="icon-pill" />,
  Truck: () => <span data-testid="icon-truck" />,
  Leaf: () => <span data-testid="icon-leaf" />,
  Sparkles: () => <span data-testid="icon-sparkles" />,
  Landmark: () => <span data-testid="icon-landmark" />,
  Globe: () => <span data-testid="icon-globe" />,
  HelpCircle: () => <span data-testid="icon-help" />,
  UserCheck: () => <span data-testid="icon-user-check" />,
  UserX: () => <span data-testid="icon-user-x" />,
  CreditCard: () => <span data-testid="icon-credit" />,
  TrendingUp: () => <span data-testid="icon-trending" />,
  BarChart3: () => <span data-testid="icon-barchart" />,
  LayoutGrid: () => <span data-testid="icon-grid" />,
  List: () => <span data-testid="icon-list" />,
  RefreshCw: () => <span data-testid="icon-refresh" />,
  Phone: () => <span data-testid="icon-phone" />,
  Mail: () => <span data-testid="icon-mail" />,
  Calendar: () => <span data-testid="icon-calendar" />,
  Inbox: () => <span data-testid="icon-inbox" />,
  Star: () => <span data-testid="icon-star" />,
  Award: () => <span data-testid="icon-award" />,
}));

// Mock DevExtreme PieChart
vi.mock('devextreme-react/pie-chart', () => ({
  default: () => <div data-testid="dx-pie-chart" />,
  Series: () => null,
  Legend: () => null,
  Tooltip: () => null,
  Label: () => null,
}));

// Mock MainLayout
vi.mock('@/components/layout/main-layout', () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="main-layout">{children}</div>,
}));

// Mock Card components
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className, onClick }: { children?: React.ReactNode; className?: string; onClick?: () => void }) => (
    <div data-testid="card" className={className} onClick={onClick}>{children}</div>
  ),
  CardHeader: ({ children }: { children?: React.ReactNode }) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: { children?: React.ReactNode }) => <h3 data-testid="card-title">{children}</h3>,
  CardContent: ({ children }: { children?: React.ReactNode }) => <div data-testid="card-content">{children}</div>,
}));

// Mock DxDataGrid
vi.mock('@/components/ui/dx-data-grid', () => ({
  DxDataGrid: ({ children, ...props }: { children?: React.ReactNode; 'data-testid'?: string }) => (
    <div data-testid={props['data-testid'] || 'dx-data-grid'}>{children}</div>
  ),
  DxDataGridColumn: () => null,
}));

// Mock DxButton
vi.mock('@/components/ui/dx-button', () => ({
  DxButton: ({ text, onClick }: { text?: string; onClick?: () => void }) => (
    <button onClick={onClick} data-testid={`dx-button-${text?.replace(/\s+/g, '-')?.toLowerCase() || 'unnamed'}`}>{text}</button>
  ),
}));

// Mock DxTextBox
vi.mock('@/components/ui/dx-text-box', () => ({
  DxTextBox: () => <input data-testid="dx-text-box" />,
}));

// Mock DxSelectBox
vi.mock('@/components/ui/dx-select-box', () => ({
  DxSelectBox: () => <select data-testid="dx-select-box" />,
}));

// Mock Badge
vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children?: React.ReactNode }) => <span data-testid="badge">{children}</span>,
}));

// Mock EmptyState
vi.mock('@/components/ui/empty-state', () => ({
  EmptyState: () => <div data-testid="empty-state" />,
}));

// Mock cn utility
vi.mock('@/lib/utils/cn', () => ({
  cn: (...args: string[]) => args.filter(Boolean).join(' '),
}));

describe('CustomersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFetchMock();
  });

  describe('Page Rendering', () => {
    it('should render page with correct title', async () => {
      setupFetchMock(SALES_FETCH_HANDLERS);

      renderWithProviders(<CustomersPage />);

      await waitFor(() => {
        // Title from i18n: t('customers.pageTitle') = 'Customers'
        expect(screen.getByText('Customers')).toBeInTheDocument();
      });
    });

    it('should render page subtitle', async () => {
      setupFetchMock(SALES_FETCH_HANDLERS);

      renderWithProviders(<CustomersPage />);

      await waitFor(() => {
        // Subtitle from i18n: t('customers.description') = 'Manage customer information and sales analytics'
        expect(screen.getByText(/Manage customer information and sales analytics/)).toBeInTheDocument();
      });
    });

    it('should render main layout wrapper', async () => {
      setupFetchMock(SALES_FETCH_HANDLERS);

      renderWithProviders(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByTestId('main-layout')).toBeInTheDocument();
      });
    });

    it('should render add customer button', async () => {
      setupFetchMock(SALES_FETCH_HANDLERS);

      renderWithProviders(<CustomersPage />);

      await waitFor(() => {
        // Button text from i18n: t('customers.actions.addCustomer') = 'Add Customer'
        expect(screen.getByTestId('dx-button-add-customer')).toBeInTheDocument();
      });
    });
  });

  describe('View Mode Toggle', () => {
    it('should render Grid View button', async () => {
      setupFetchMock(SALES_FETCH_HANDLERS);

      renderWithProviders(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByTitle('Grid View')).toBeInTheDocument();
      });
    });

    it('should render Cards View button', async () => {
      setupFetchMock(SALES_FETCH_HANDLERS);

      renderWithProviders(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByTitle('Cards View')).toBeInTheDocument();
      });
    });

    it('should render Analytics View button', async () => {
      setupFetchMock(SALES_FETCH_HANDLERS);

      renderWithProviders(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByTitle('Analytics View')).toBeInTheDocument();
      });
    });
  });

  describe('Status Tabs', () => {
    it('should render All status label', async () => {
      setupFetchMock(SALES_FETCH_HANDLERS);

      renderWithProviders(<CustomersPage />);

      // Status labels from i18n: t('customers.status.all') = 'All'
      await waitFor(() => {
        expect(screen.getAllByText('All').length).toBeGreaterThanOrEqual(1);
      });
    });

    it('should render Active status label', async () => {
      setupFetchMock(SALES_FETCH_HANDLERS);

      renderWithProviders(<CustomersPage />);

      // Status labels from i18n
      await waitFor(() => {
        // Status label from i18n: t('customers.status.active') = 'Active'
        expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1);
      });
    });

    it('should render Inactive status label', async () => {
      setupFetchMock(SALES_FETCH_HANDLERS);

      renderWithProviders(<CustomersPage />);

      await waitFor(() => {
        // Status label from i18n: t('customers.status.inactive') = 'Inactive'
        expect(screen.getByText('Inactive')).toBeInTheDocument();
      });
    });
  });

  describe('Quick Stats in Header', () => {
    it('should render Total header stat', async () => {
      setupFetchMock(SALES_FETCH_HANDLERS);

      renderWithProviders(<CustomersPage />);

      // Stats in header - from i18n: t('customers.stats.total') = 'Total'
      await waitFor(() => {
        expect(screen.getAllByText('Total').length).toBeGreaterThan(0);
      });
    });

    it('should render Active header stat', async () => {
      setupFetchMock(SALES_FETCH_HANDLERS);

      renderWithProviders(<CustomersPage />);

      await waitFor(() => {
        // Stat label from i18n: t('customers.stats.active') = 'Active'
        expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
      });
    });

    it('should render Total Credit header stat', async () => {
      setupFetchMock(SALES_FETCH_HANDLERS);

      renderWithProviders(<CustomersPage />);

      await waitFor(() => {
        // Stat label from i18n: t('customers.stats.totalCreditLimit') = 'Total Credit'
        expect(screen.getByText('Total Credit')).toBeInTheDocument();
      });
    });

    it('should render Top Type header stat', async () => {
      setupFetchMock(SALES_FETCH_HANDLERS);

      renderWithProviders(<CustomersPage />);

      await waitFor(() => {
        // Stat label from i18n: t('customers.stats.mainType') = 'Main Type'
        expect(screen.getByText('Main Type')).toBeInTheDocument();
      });
    });
  });

  describe('Search and Filters', () => {
    it('should render search input', async () => {
      setupFetchMock(SALES_FETCH_HANDLERS);

      renderWithProviders(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByTestId('dx-text-box')).toBeInTheDocument();
      });
    });

    it('should render type filter', async () => {
      setupFetchMock(SALES_FETCH_HANDLERS);

      renderWithProviders(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByTestId('dx-select-box')).toBeInTheDocument();
      });
    });
  });

  describe('Data Fetching', () => {
    it('should fetch customers on mount', async () => {
      setupFetchMock(SALES_FETCH_HANDLERS);

      renderWithProviders(<CustomersPage />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      const calls = vi.mocked(fetch).mock.calls;
      const customersCall = calls.find(([url]) =>
        typeof url === 'string' && url.includes('/api/customers')
      );
      expect(customersCall).toBeDefined();
    });

    it('should handle empty customers gracefully', async () => {
      setupFetchMock({
        '/api/customers': { data: createPaginatedResponse([]) },
      });

      renderWithProviders(<CustomersPage />);

      await waitFor(() => {
        // Title from i18n: t('customers.pageTitle') = 'Customers'
        expect(screen.getByText('Customers')).toBeInTheDocument();
      });
    });

    it('should handle API error gracefully', async () => {
      setupFetchMock({
        '/api/customers': {
          data: { success: false, error: 'Server error' },
          ok: false,
          status: 500,
        },
      });

      renderWithProviders(<CustomersPage />);

      // Page should still render even on API error
      await waitFor(() => {
        // Title from i18n: t('customers.pageTitle') = 'Customers'
        expect(screen.getByText('Customers')).toBeInTheDocument();
      });
    });

    it('should correctly parse API response structure (regression)', () => {
      const customersResponse = createPaginatedResponse(MOCK_CUSTOMERS);

      // Paginated responses have items array
      expect(customersResponse.data.items).toBeDefined();
      expect(customersResponse.data.items.length).toBe(MOCK_CUSTOMERS.length);
    });
  });

  describe('DataGrid', () => {
    it('should render data grid component', async () => {
      setupFetchMock(SALES_FETCH_HANDLERS);

      renderWithProviders(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByTestId('dx-data-grid')).toBeInTheDocument();
      });
    });
  });
});
