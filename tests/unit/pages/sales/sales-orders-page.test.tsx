/**
 * Sales Orders Page Tests
 * Feature: 014-unit-cost
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import SalesOrdersPage from '@/app/sales/orders/page';
import {
  renderWithProviders,
  setupFetchMock,
  clearFetchMock,
  createPaginatedResponse,
} from '../../../helpers/ui-test-utils';
import { SALES_FETCH_HANDLERS, MOCK_SALES_ORDERS } from '../../../helpers/fetch-mock-handlers';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(''),
}));

// Mock lucide-react icons — Proxy returns a stub for ANY icon name so a newly
// imported icon can never throw "No <Icon> export is defined on the mock".
vi.mock('lucide-react', () => {
  const React = require('react');
  const make = (name: string) =>
    Object.assign(
      (props: Record<string, unknown>) =>
        React.createElement('span', { 'data-testid': `icon-${name}`, ...props }),
      { displayName: name }
    );
  return new Proxy(
    {},
    {
      get: (_t: unknown, prop: string | symbol) => {
        if (prop === '__esModule') return true;
        if (prop === 'default') return make('default');
        return make(String(prop));
      },
    }
  );
});

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
  DxDataGrid: ({ children, ...props }: { children?: React.ReactNode; 'data-testid'?: string; elementAttr?: { 'data-testid': string } }) => (
    <div data-testid={props.elementAttr?.['data-testid'] || 'dx-data-grid'}>{children}</div>
  ),
  DxDataGridColumn: () => null,
}));

// Mock DxButton
vi.mock('@/components/ui/dx-button', () => ({
  DxButton: ({ text, onClick, ...props }: { text?: string; onClick?: () => void; elementAttr?: { 'data-testid': string } }) => (
    <button onClick={onClick} data-testid={props.elementAttr?.['data-testid'] || `dx-button-${text?.replace(/\s+/g, '-')?.toLowerCase() || 'unnamed'}`}>{text}</button>
  ),
}));

// Mock DxTextBox
vi.mock('@/components/ui/dx-text-box', () => ({
  DxTextBox: ({ ...props }: { elementAttr?: { 'data-testid': string } }) => (
    <input data-testid={props.elementAttr?.['data-testid'] || 'dx-text-box'} />
  ),
}));

// Mock Badge
vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children?: React.ReactNode }) => <span data-testid="badge">{children}</span>,
}));

// Mock cn utility
vi.mock('@/lib/utils/cn', () => ({
  cn: (...args: string[]) => args.filter(Boolean).join(' '),
}));

describe('SalesOrdersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFetchMock();
  });

  describe('Page Rendering', () => {
    it('should render page with correct title', async () => {
      setupFetchMock(SALES_FETCH_HANDLERS);

      renderWithProviders(<SalesOrdersPage />);

      await waitFor(() => {
        // Title from i18n: t('orders.pageTitle') = 'Sales Orders'
        expect(screen.getByText('Sales Orders')).toBeInTheDocument();
      });
    });

    it('should render page subtitle', async () => {
      setupFetchMock(SALES_FETCH_HANDLERS);

      renderWithProviders(<SalesOrdersPage />);

      await waitFor(() => {
        // Subtitle from i18n: t('orders.description') = 'Manage sales orders and track delivery status'
        expect(screen.getByText(/Manage sales orders and track delivery status/)).toBeInTheDocument();
      });
    });

    it('should render main layout wrapper', async () => {
      setupFetchMock(SALES_FETCH_HANDLERS);

      renderWithProviders(<SalesOrdersPage />);

      await waitFor(() => {
        expect(screen.getByTestId('main-layout')).toBeInTheDocument();
      });
    });

    it('should render create order button', async () => {
      setupFetchMock(SALES_FETCH_HANDLERS);

      renderWithProviders(<SalesOrdersPage />);

      await waitFor(() => {
        expect(screen.getByTestId('so-add-btn')).toBeInTheDocument();
      });
    });

    it('should render refresh button', async () => {
      setupFetchMock(SALES_FETCH_HANDLERS);

      renderWithProviders(<SalesOrdersPage />);

      await waitFor(() => {
        expect(screen.getByTestId('so-refresh-btn')).toBeInTheDocument();
      });
    });
  });

  describe('View Mode Toggle', () => {
    it('should render Grid View button', async () => {
      setupFetchMock(SALES_FETCH_HANDLERS);

      renderWithProviders(<SalesOrdersPage />);

      await waitFor(() => {
        expect(screen.getByTitle('Grid View')).toBeInTheDocument();
      });
    });

    it('should render Cards View button', async () => {
      setupFetchMock(SALES_FETCH_HANDLERS);

      renderWithProviders(<SalesOrdersPage />);

      await waitFor(() => {
        expect(screen.getByTitle('Cards View')).toBeInTheDocument();
      });
    });

    it('should render Analytics View button', async () => {
      setupFetchMock(SALES_FETCH_HANDLERS);

      renderWithProviders(<SalesOrdersPage />);

      await waitFor(() => {
        expect(screen.getByTitle('Analytics View')).toBeInTheDocument();
      });
    });
  });

  describe('Status Tabs', () => {
    it('should render All status tab', async () => {
      setupFetchMock(SALES_FETCH_HANDLERS);

      renderWithProviders(<SalesOrdersPage />);

      await waitFor(() => {
        expect(screen.getByTestId('so-status-tab-all')).toBeInTheDocument();
      });
    });

    it('should render Draft status tab', async () => {
      setupFetchMock(SALES_FETCH_HANDLERS);

      renderWithProviders(<SalesOrdersPage />);

      await waitFor(() => {
        expect(screen.getByTestId('so-status-tab-draft')).toBeInTheDocument();
      });
    });

    it('should render Confirmed status tab', async () => {
      setupFetchMock(SALES_FETCH_HANDLERS);

      renderWithProviders(<SalesOrdersPage />);

      await waitFor(() => {
        expect(screen.getByTestId('so-status-tab-confirmed')).toBeInTheDocument();
      });
    });

    it('should render Delivered status tab', async () => {
      setupFetchMock(SALES_FETCH_HANDLERS);

      renderWithProviders(<SalesOrdersPage />);

      await waitFor(() => {
        expect(screen.getByTestId('so-status-tab-delivered')).toBeInTheDocument();
      });
    });
  });

  describe('KPI Stats Cards', () => {
    it('should render Total stat', async () => {
      setupFetchMock(SALES_FETCH_HANDLERS);

      renderWithProviders(<SalesOrdersPage />);

      // Text appears in both status tab and stats card
      await waitFor(() => {
        expect(screen.getAllByText('Total').length).toBeGreaterThanOrEqual(1);
      });
    });

    it('should render Processing stat', async () => {
      setupFetchMock(SALES_FETCH_HANDLERS);

      renderWithProviders(<SalesOrdersPage />);

      // Text appears in both status tab and stats card
      await waitFor(() => {
        expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1);
      });
    });

    it('should render Ready stat', async () => {
      setupFetchMock(SALES_FETCH_HANDLERS);

      renderWithProviders(<SalesOrdersPage />);

      // Text appears in both status tab and stats card
      await waitFor(() => {
        expect(screen.getAllByText('Ready to Ship').length).toBeGreaterThanOrEqual(1);
      });
    });

    it('should render Delivered stat', async () => {
      setupFetchMock(SALES_FETCH_HANDLERS);

      renderWithProviders(<SalesOrdersPage />);

      // Text appears in both status tab and stats card
      await waitFor(() => {
        expect(screen.getAllByText('Delivered').length).toBeGreaterThanOrEqual(1);
      });
    });

    it('should render Overdue stat', async () => {
      setupFetchMock(SALES_FETCH_HANDLERS);

      renderWithProviders(<SalesOrdersPage />);

      await waitFor(() => {
        expect(screen.getByText('Overdue')).toBeInTheDocument();
      });
    });

    it('should render Pending Value stat', async () => {
      setupFetchMock(SALES_FETCH_HANDLERS);

      renderWithProviders(<SalesOrdersPage />);

      await waitFor(() => {
        expect(screen.getByText('Pending Value')).toBeInTheDocument();
      });
    });
  });

  describe('Search', () => {
    it('should render search container', async () => {
      setupFetchMock(SALES_FETCH_HANDLERS);

      renderWithProviders(<SalesOrdersPage />);

      await waitFor(() => {
        expect(screen.getByTestId('so-search-container')).toBeInTheDocument();
      });
    });

    it('should render search input', async () => {
      setupFetchMock(SALES_FETCH_HANDLERS);

      renderWithProviders(<SalesOrdersPage />);

      await waitFor(() => {
        expect(screen.getByTestId('so-search-input')).toBeInTheDocument();
      });
    });
  });

  describe('Data Fetching', () => {
    it('should fetch sales orders on mount', async () => {
      setupFetchMock(SALES_FETCH_HANDLERS);

      renderWithProviders(<SalesOrdersPage />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      const calls = vi.mocked(fetch).mock.calls;
      const ordersCall = calls.find(([url]) =>
        typeof url === 'string' && url.includes('/api/sales/orders')
      );
      expect(ordersCall).toBeDefined();
    });

    it('should handle empty orders gracefully', async () => {
      setupFetchMock({
        '/api/sales/orders': { data: createPaginatedResponse([]) },
      });

      renderWithProviders(<SalesOrdersPage />);

      await waitFor(() => {
        // Title from i18n: t('orders.pageTitle') = 'Sales Orders'
        expect(screen.getByText('Sales Orders')).toBeInTheDocument();
      });
    });

    it('should handle API error gracefully', async () => {
      setupFetchMock({
        '/api/sales/orders': {
          data: { success: false, error: 'Server error' },
          ok: false,
          status: 500,
        },
      });

      renderWithProviders(<SalesOrdersPage />);

      // Page should still render even on API error
      await waitFor(() => {
        // Title from i18n: t('orders.pageTitle') = 'Sales Orders'
        expect(screen.getByText('Sales Orders')).toBeInTheDocument();
      });
    });

    it('should correctly parse API response structure (regression)', () => {
      const ordersResponse = createPaginatedResponse(MOCK_SALES_ORDERS);

      // Paginated responses have items array
      expect(ordersResponse.data.items).toBeDefined();
      expect(ordersResponse.data.items.length).toBe(MOCK_SALES_ORDERS.length);
    });
  });

  describe('DataGrid', () => {
    it('should render data grid component', async () => {
      setupFetchMock(SALES_FETCH_HANDLERS);

      renderWithProviders(<SalesOrdersPage />);

      await waitFor(() => {
        expect(screen.getByTestId('so-data-grid')).toBeInTheDocument();
      });
    });
  });
});
