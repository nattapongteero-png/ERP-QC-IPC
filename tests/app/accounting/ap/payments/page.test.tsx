/**
 * AP Payments Page Tests
 * Feature: 010-accounting-module-integration
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import APPaymentsPage from '@/app/accounting/ap/payments/page';

// Mock fetch globally
global.fetch = vi.fn();

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn(),
  }),
  usePathname: () => '/accounting/ap/payments',
}));

// Mock DevExtreme components
vi.mock('devextreme-react/data-grid', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="data-grid">{children}</div>,
  Column: () => null,
  Paging: () => null,
  Pager: () => null,
  FilterRow: () => null,
  HeaderFilter: () => null,
  SearchPanel: () => null,
  Toolbar: () => null,
  Item: () => null,
  Selection: () => null,
  Export: () => null,
  ColumnChooser: () => null,
  Sorting: () => null,
  Summary: () => null,
  TotalItem: () => null,
  Format: () => null,
}));

vi.mock('devextreme-react/popup', () => ({
  Popup: ({ visible, children }: any) =>
    visible ? <div data-testid="payment-popup">{children}</div> : null,
}));

vi.mock('devextreme-react/form', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="dx-form">{children}</div>,
  SimpleItem: () => null,
  GroupItem: ({ children }: any) => <div>{children}</div>,
  RequiredRule: () => null,
}));

vi.mock('devextreme-react/button', () => ({
  Button: ({ text, onClick, testId }: any) => (
    <button onClick={onClick} data-testid={testId}>
      {text}
    </button>
  ),
}));

vi.mock('devextreme-react/select-box', () => ({
  SelectBox: ({ dataSource, onValueChanged, value }: any) => (
    <select
      data-testid="select-box"
      value={value}
      onChange={(e) => onValueChanged?.({ value: e.target.value })}
    >
      {dataSource?.map((item: any) => (
        <option key={item.value} value={item.value}>
          {item.label}
        </option>
      ))}
    </select>
  ),
}));

vi.mock('devextreme-react/date-box', () => ({
  DateBox: ({ value, onValueChanged }: any) => (
    <input
      type="date"
      data-testid="date-box"
      value={value ? value.toISOString().split('T')[0] : ''}
      onChange={(e) => onValueChanged?.({ value: new Date(e.target.value) })}
    />
  ),
}));

vi.mock('devextreme/ui/notify', () => ({
  __esModule: true,
  default: vi.fn(),
}));

// Mock accounting components
vi.mock('@/components/accounting', () => ({
  AccountingPageHeader: ({ title, subtitle, onRefresh, actions }: any) => (
    <div data-testid="page-header">
      <h1>{title}</h1>
      <p>{subtitle}</p>
      <button onClick={onRefresh} data-testid="refresh-button">
        Refresh
      </button>
      {actions}
    </div>
  ),
  AccountingKPICard: ({ label, value, subtitle }: any) => (
    <div data-testid="kpi-card">
      <div>{label}</div>
      <div data-testid="kpi-value">{value}</div>
      <div>{subtitle}</div>
    </div>
  ),
  AccountingFilterPanel: ({ children }: any) => (
    <div data-testid="filter-panel">{children}</div>
  ),
  AccountingStatusBadge: ({ status }: any) => (
    <span data-testid="status-badge">{status}</span>
  ),
}));

describe('APPaymentsPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.mocked(global.fetch).mockClear();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const renderPage = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <APPaymentsPage />
      </QueryClientProvider>
    );
  };

  const mockPaymentsData = [
    {
      id: 1,
      paymentNumber: 'PY-202401-000001',
      paymentType: 'ap',
      paymentDate: '2024-01-15',
      vendorId: 1,
      vendorName: 'Test Vendor 1',
      customerId: null,
      customerName: null,
      bankAccountId: 1,
      bankAccountCode: '1101',
      bankAccountName: 'Cash',
      paymentMethod: 'transfer',
      referenceNumber: 'REF001',
      amount: 10000,
      whtAmount: 300,
      description: 'Payment for AP-202401-000001',
      status: 'completed',
      invoiceNumber: 'AP-202401-000001',
      apInvoiceId: 1,
    },
    {
      id: 2,
      paymentNumber: 'PY-202401-000002',
      paymentType: 'ap',
      paymentDate: '2024-01-20',
      vendorId: 2,
      vendorName: 'Test Vendor 2',
      customerId: null,
      customerName: null,
      bankAccountId: 1,
      bankAccountCode: '1101',
      bankAccountName: 'Cash',
      paymentMethod: 'check',
      referenceNumber: 'CHK123',
      amount: 5000,
      whtAmount: 0,
      description: 'Payment for AP-202401-000002',
      status: 'completed',
      invoiceNumber: 'AP-202401-000002',
      apInvoiceId: 2,
    },
  ];

  it('should render page header with title and subtitle', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] }),
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('AP Payments')).toBeInTheDocument();
      expect(screen.getByText('Vendor Payment Records')).toBeInTheDocument();
    });
  });

  it('should display KPI cards with payment stats', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockPaymentsData }),
    });

    renderPage();

    await waitFor(() => {
      const kpiCards = screen.getAllByTestId('kpi-card');
      expect(kpiCards).toHaveLength(4);

      // Check for Total Payments
      expect(screen.getByText('Total Payments')).toBeInTheDocument();

      // Check for Paid This Month
      expect(screen.getByText('Paid This Month')).toBeInTheDocument();

      // Check for Pending Payments
      expect(screen.getByText('Pending Payments')).toBeInTheDocument();

      // Check for Outstanding to Pay
      expect(screen.getByText('Outstanding to Pay')).toBeInTheDocument();
    });
  });

  it('should fetch and display payment records', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockPaymentsData }),
    });

    renderPage();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/accounting/payments?paymentType=ap')
      );
      expect(screen.getByTestId('data-grid')).toBeInTheDocument();
    });
  });

  it('should show filter panel with payment method and date range filters', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] }),
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('filter-panel')).toBeInTheDocument();
      expect(screen.getByText('Payment Method')).toBeInTheDocument();
      expect(screen.getByText('Date From')).toBeInTheDocument();
      expect(screen.getByText('Date To')).toBeInTheDocument();
    });
  });

  it('should handle empty payment list gracefully', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] }),
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('data-grid')).toBeInTheDocument();
      // Should still show KPI cards with zero values
      const kpiCards = screen.getAllByTestId('kpi-card');
      expect(kpiCards).toHaveLength(4);
    });
  });

  it('should handle API error gracefully', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(
      new Error('Network error')
    );

    renderPage();

    await waitFor(() => {
      // Page should still render with error state
      expect(screen.getByTestId('page-header')).toBeInTheDocument();
    });
  });
});
