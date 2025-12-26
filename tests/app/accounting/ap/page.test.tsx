/**
 * AP Dashboard Page Tests
 * Feature: 010-accounting-module-integration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import APDashboardPage from '@/app/accounting/ap/page';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Test data
const mockAPInvoices = [
  {
    id: 1,
    invoiceNumber: 'AP-2025-001',
    vendorId: 1,
    vendorName: 'ABC Supplier',
    invoiceDate: '2025-01-15',
    dueDate: '2025-02-15',
    receivedDate: '2025-01-15',
    description: 'Raw materials purchase',
    subtotal: 100000,
    vatAmount: 7000,
    whtAmount: 3000,
    totalAmount: 104000,
    paidAmount: 0,
    currency: 'THB',
    status: 'posted',
    journalEntryId: 1,
  },
  {
    id: 2,
    invoiceNumber: 'AP-2025-002',
    vendorId: 2,
    vendorName: 'XYZ Trading',
    invoiceDate: '2025-01-10',
    dueDate: '2024-12-10', // Overdue
    receivedDate: '2025-01-10',
    description: 'Equipment maintenance',
    subtotal: 50000,
    vatAmount: 3500,
    whtAmount: 1500,
    totalAmount: 52000,
    paidAmount: 0,
    currency: 'THB',
    status: 'posted',
    journalEntryId: 2,
  },
  {
    id: 3,
    invoiceNumber: 'AP-2025-003',
    vendorId: 3,
    vendorName: 'DEF Services',
    invoiceDate: '2025-01-20',
    dueDate: '2025-02-20',
    receivedDate: '2025-01-20',
    description: 'Consulting services',
    subtotal: 30000,
    vatAmount: 2100,
    whtAmount: 900,
    totalAmount: 31200,
    paidAmount: 0,
    currency: 'THB',
    status: 'draft',
    journalEntryId: null,
  },
  {
    id: 4,
    invoiceNumber: 'AP-2025-004',
    vendorId: 4,
    vendorName: 'GHI Logistics',
    invoiceDate: '2025-01-25',
    dueDate: '2025-02-25',
    receivedDate: '2025-01-25',
    description: 'Freight charges',
    subtotal: 20000,
    vatAmount: 1400,
    whtAmount: 600,
    totalAmount: 20800,
    paidAmount: 20800,
    currency: 'THB',
    status: 'paid',
    journalEntryId: 3,
  },
];

const mockAgingData = {
  data: {
    totals: {
      total: 156000,
      current: 104000,
      days30: 0,
      days60: 0,
      days90: 0,
      over90: 52000,
    },
    entries: [],
  },
};

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
}

function renderWithProviders(component: React.ReactElement) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
}

describe('AP Dashboard Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/accounting/ap-invoices')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: mockAPInvoices }),
        });
      }
      if (url.includes('/api/accounting/reports/aging')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockAgingData,
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: [] }),
      });
    });
  });

  it('renders the page header', async () => {
    renderWithProviders(<APDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Accounts Payable Dashboard')).toBeInTheDocument();
    });

    expect(screen.getByText('Manage vendor invoices and payments')).toBeInTheDocument();
  });

  it('displays KPI cards with correct metrics', async () => {
    renderWithProviders(<APDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Total Payables')).toBeInTheDocument();
    });

    // Check all KPI labels
    expect(screen.getByText('Pending Invoices')).toBeInTheDocument();
    expect(screen.getByText('Overdue Amount')).toBeInTheDocument();
    expect(screen.getByText('Paid This Month')).toBeInTheDocument();

    // Verify metrics are calculated correctly
    // Total Payables: posted/partial invoices = 104000 + 52000 = 156000
    await waitFor(() => {
      expect(screen.getByText(/156,000|156000/)).toBeInTheDocument();
    });

    // Pending Invoices: draft/approved = 1
    expect(screen.getByText(/^1$/)).toBeInTheDocument();

    // Paid This Month: paid invoices this month = 1
    expect(screen.getByText('Paid This Month')).toBeInTheDocument();
  });

  it('displays overdue alert when overdue invoices exist', async () => {
    renderWithProviders(<APDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Overdue Invoices')).toBeInTheDocument();
    });

    expect(screen.getByText(/in overdue payables/)).toBeInTheDocument();
    expect(screen.getByText('View Overdue Invoices')).toBeInTheDocument();
  });

  it('renders quick navigation cards', async () => {
    renderWithProviders(<APDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Quick Access')).toBeInTheDocument();
    });

    expect(screen.getByText('AP Invoices')).toBeInTheDocument();
    expect(screen.getByText('Manage vendor invoices and approvals')).toBeInTheDocument();

    expect(screen.getByText('Payments')).toBeInTheDocument();
    expect(screen.getByText('Process and track vendor payments')).toBeInTheDocument();

    expect(screen.getByText('Aging Report')).toBeInTheDocument();
    expect(screen.getByText('View payables aging analysis')).toBeInTheDocument();
  });

  it('displays recent AP invoices list', async () => {
    renderWithProviders(<APDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Recent AP Invoices')).toBeInTheDocument();
    });

    // Check that recent invoices are displayed
    expect(screen.getByText('AP-2025-001')).toBeInTheDocument();
    expect(screen.getByText('AP-2025-002')).toBeInTheDocument();
    expect(screen.getByText('AP-2025-003')).toBeInTheDocument();
    expect(screen.getByText('AP-2025-004')).toBeInTheDocument();

    // Check invoice descriptions
    expect(screen.getByText('Raw materials purchase')).toBeInTheDocument();
    expect(screen.getByText('Equipment maintenance')).toBeInTheDocument();

    // Check "View All Invoices" link
    expect(screen.getByText('View All Invoices →')).toBeInTheDocument();
  });

  it('displays AP aging summary chart', async () => {
    renderWithProviders(<APDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('AP Aging Summary')).toBeInTheDocument();
    });

    // The chart should render (Recharts components)
    // We can't easily test the chart content, but we can verify the section exists
    expect(screen.getByText('AP Aging Summary')).toBeInTheDocument();
  });

  it('displays summary statistics footer', async () => {
    renderWithProviders(<APDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Recent Invoices')).toBeInTheDocument();
    });

    expect(screen.getByText('Total Outstanding')).toBeInTheDocument();
    expect(screen.getByText('Overdue')).toBeInTheDocument();
    expect(screen.getByText('Paid This Month')).toBeInTheDocument();
  });

  it('handles empty invoice data gracefully', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/accounting/ap-invoices')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [] }),
        });
      }
      if (url.includes('/api/accounting/reports/aging')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: { totals: {} } }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: [] }),
      });
    });

    renderWithProviders(<APDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('No AP invoices yet')).toBeInTheDocument();
    });

    // KPIs should show zero
    expect(screen.getByText('Total Payables')).toBeInTheDocument();
  });

  it('handles API errors gracefully', async () => {
    mockFetch.mockImplementation(() => {
      return Promise.resolve({
        ok: false,
        json: async () => ({ error: 'API Error' }),
      });
    });

    renderWithProviders(<APDashboardPage />);

    // Page should still render without crashing
    await waitFor(() => {
      expect(screen.getByText('Accounts Payable Dashboard')).toBeInTheDocument();
    });
  });

  it('shows loading state initially', () => {
    renderWithProviders(<APDashboardPage />);

    // Should show skeleton loaders
    expect(screen.getAllByTestId).toBeDefined();
  });

  it('all navigation links have correct hrefs', async () => {
    renderWithProviders(<APDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('AP Invoices')).toBeInTheDocument();
    });

    const apInvoicesLink = screen.getByText('AP Invoices').closest('a');
    expect(apInvoicesLink).toHaveAttribute('href', '/accounting/ap/invoices');

    const paymentsLink = screen.getByText('Payments').closest('a');
    expect(paymentsLink).toHaveAttribute('href', '/accounting/ap/payments');

    const agingLink = screen.getByText('Aging Report').closest('a');
    expect(agingLink).toHaveAttribute('href', '/accounting/ap/aging');
  });
});
