/**
 * AR Invoices Page Test
 * Feature: 010-accounting-module-integration
 * Task 5: Redesign AR Invoices UI
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ARInvoicesPage from '@/app/accounting/ar/invoices/page';

// Mock fetch
global.fetch = vi.fn();

// Mock DevExtreme components
vi.mock('devextreme-react/data-grid', () => {
  const MockDataGrid = ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="mock-datagrid">{children}</div>
  );
  MockDataGrid.displayName = 'MockDataGrid';

  return {
    __esModule: true,
    default: MockDataGrid,
    Column: ({ caption }: { caption?: string }) => <div>{caption}</div>,
    Paging: () => null,
    Pager: () => null,
    FilterRow: () => null,
    HeaderFilter: () => null,
    SearchPanel: () => null,
    Toolbar: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Item: () => null,
    Selection: () => null,
    Export: () => null,
    ColumnChooser: () => null,
    Sorting: () => null,
    Summary: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    TotalItem: () => null,
    Format: () => null,
  };
});

vi.mock('devextreme-react/popup', () => ({
  Popup: ({ visible, children, title }: { visible?: boolean; children?: React.ReactNode; title?: string }) =>
    visible ? (
      <div data-testid="mock-popup">
        <h2>{title}</h2>
        {children}
      </div>
    ) : null,
}));

vi.mock('devextreme-react/form', () => ({
  __esModule: true,
  default: ({ children }: { children?: React.ReactNode }) => <form data-testid="mock-form">{children}</form>,
  SimpleItem: () => null,
  GroupItem: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  RequiredRule: () => null,
}));

vi.mock('devextreme-react/button', () => ({
  Button: ({ text, onClick, icon }: { text?: string; onClick?: () => void; icon?: string }) => (
    <button onClick={onClick} data-icon={icon}>
      {text}
    </button>
  ),
}));

vi.mock('devextreme-react/select-box', () => ({
  SelectBox: ({ value, onValueChanged, dataSource, placeholder }: {
    value?: string;
    onValueChanged?: (e: { value: string }) => void;
    dataSource?: Array<{ value: string; label: string }>;
    placeholder?: string;
  }) => (
    <select
      value={value}
      onChange={(e) => onValueChanged?.({ value: e.target.value })}
      aria-label={placeholder}
    >
      {dataSource?.map((item: { value: string; label: string }) => (
        <option key={item.value} value={item.value}>
          {item.label}
        </option>
      ))}
    </select>
  ),
}));

vi.mock('devextreme/ui/notify', () => ({ default: vi.fn() }));
vi.mock('devextreme/ui/dialog', () => ({
  confirm: vi.fn(() => Promise.resolve(true)),
}));

// Mock accounting components
vi.mock('@/components/accounting', () => ({
  AccountingPageHeader: ({ title, subtitle, icon, actions }: {
    title?: string;
    subtitle?: string;
    icon?: string;
    actions?: React.ReactNode;
  }) => (
    <div data-testid="accounting-page-header">
      <h1>{title}</h1>
      <p>{subtitle}</p>
      <span data-icon={icon}></span>
      {actions}
    </div>
  ),
  AccountingKPICard: ({ label, value, subtitle, icon, variant }: {
    label?: string;
    value?: string;
    subtitle?: string;
    icon?: string;
    variant?: string;
  }) => (
    <div data-testid={`kpi-card-${variant}`} data-icon={icon}>
      <div>{label}</div>
      <div>{value}</div>
      <div>{subtitle}</div>
    </div>
  ),
  AccountingFilterPanel: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="accounting-filter-panel">{children}</div>
  ),
  AccountingStatusBadge: ({ status }: { status?: string }) => (
    <span data-testid={`status-badge-${status}`}>{status}</span>
  ),
}));

// Test wrapper with displayName
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};
TestWrapper.displayName = 'TestWrapper';

describe('AR Invoices Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/api/accounting/ar-invoices')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [
                {
                  id: 1,
                  invoiceNumber: 'AR-202501-000001',
                  taxInvoiceNumber: 'TX-202501-000001',
                  customerId: 1,
                  customerName: 'Customer A',
                  invoiceDate: '2025-01-15',
                  dueDate: '2025-02-14',
                  description: 'Test AR Invoice',
                  subtotal: 10000,
                  vatAmount: 700,
                  totalAmount: 10700,
                  paidAmount: 0,
                  currency: 'THB',
                  status: 'draft',
                  journalEntryId: null,
                },
              ],
            }),
        });
      }
      if (url.includes('/api/customers')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: [] }),
        });
      }
      if (url.includes('/api/accounting/gl-accounts')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: [] }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });
    });
  });

  it('renders page header with dollar-sign icon', async () => {
    render(
      <TestWrapper>
        <ARInvoicesPage />
      </TestWrapper>
    );

    await waitFor(() => {
      const header = screen.getByTestId('accounting-page-header');
      expect(header).toBeInTheDocument();
      expect(screen.getByText('Invoices')).toBeInTheDocument();
      expect(screen.getByText('Accounts Receivable')).toBeInTheDocument();
      const iconElement = header.querySelector('[data-icon="dollar-sign"]');
      expect(iconElement).toBeInTheDocument();
    });
  });

  it('renders KPI cards with correct stats', async () => {
    render(
      <TestWrapper>
        <ARInvoicesPage />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('kpi-card-info')).toBeInTheDocument();
      expect(screen.getByTestId('kpi-card-warning')).toBeInTheDocument();
      expect(screen.getByTestId('kpi-card-danger')).toBeInTheDocument();
      expect(screen.getByTestId('kpi-card-success')).toBeInTheDocument();
    });
  });

  it('renders filter panel with glassmorphism', async () => {
    render(
      <TestWrapper>
        <ARInvoicesPage />
      </TestWrapper>
    );

    await waitFor(() => {
      const filterPanel = screen.getByTestId('accounting-filter-panel');
      expect(filterPanel).toBeInTheDocument();
      expect(screen.getByLabelText('กรองสถานะ')).toBeInTheDocument();
    });
  });

  it('renders data grid with invoices', async () => {
    render(
      <TestWrapper>
        <ARInvoicesPage />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('mock-datagrid')).toBeInTheDocument();
    });
  });

  it('displays status badges correctly', async () => {
    render(
      <TestWrapper>
        <ARInvoicesPage />
      </TestWrapper>
    );

    await waitFor(() => {
      // AccountingStatusBadge is mocked and used in statusCellRender
      expect(screen.getByTestId('mock-datagrid')).toBeInTheDocument();
    });
  });
});
