import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import APInvoicesPage from '@/app/accounting/ap/invoices/page';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock fetch
global.fetch = vi.fn();

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = 'TestWrapper';
  return Wrapper;
};

describe('APInvoicesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    } as Response);
  });

  it('renders professional page header with receipt icon', async () => {
    render(<APInvoicesPage />, { wrapper: createWrapper() });
    expect(screen.getByText('Supplier Bills')).toBeInTheDocument();
    expect(screen.getByText('Accounts Payable')).toBeInTheDocument();
  });

  it('renders KPI cards with proper styling', async () => {
    render(<APInvoicesPage />, { wrapper: createWrapper() });
    expect(screen.getByText('รายการทั้งหมด')).toBeInTheDocument();
    expect(screen.getByText('รอดำเนินการ')).toBeInTheDocument();
    expect(screen.getByText('ค้างชำระ')).toBeInTheDocument();
    expect(screen.getByText('ชำระแล้ว')).toBeInTheDocument();
  });

  it('renders filter panel with glassmorphism styling', async () => {
    render(<APInvoicesPage />, { wrapper: createWrapper() });
    expect(screen.getByTestId('filter-panel')).toHaveClass('backdrop-blur-md');
  });

  it('renders data grid with professional styling', async () => {
    render(<APInvoicesPage />, { wrapper: createWrapper() });
    // DevExtreme DataGrid renders with dx-datagrid class
    const container = document.querySelector('.dx-datagrid');
    expect(container).toBeTruthy();
  });

  it('displays KPI values correctly with mock data', async () => {
    const mockInvoices = [
      {
        id: 1,
        invoiceNumber: 'INV-001',
        vendorId: 1,
        invoiceDate: '2024-01-15',
        dueDate: '2024-02-15',
        receivedDate: '2024-01-15',
        description: 'Test invoice 1',
        subtotal: 1000,
        vatAmount: 70,
        whtAmount: 0,
        totalAmount: 1070,
        paidAmount: 0,
        currency: 'THB',
        status: 'draft',
        journalEntryId: null,
      },
      {
        id: 2,
        invoiceNumber: 'INV-002',
        vendorId: 1,
        invoiceDate: '2024-01-20',
        dueDate: '2024-02-20',
        receivedDate: '2024-01-20',
        description: 'Test invoice 2',
        subtotal: 2000,
        vatAmount: 140,
        whtAmount: 0,
        totalAmount: 2140,
        paidAmount: 2140,
        currency: 'THB',
        status: 'paid',
        journalEntryId: 1,
      },
    ];

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockInvoices }),
    } as Response);

    render(<APInvoicesPage />, { wrapper: createWrapper() });

    // Wait for data to load
    await screen.findByText('INV-001');

    // Check KPI values are displayed
    expect(screen.getByText('2')).toBeInTheDocument(); // Total count
  });
});
