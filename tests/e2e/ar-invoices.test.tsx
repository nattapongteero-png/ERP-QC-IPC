/**
 * AR Invoices E2E Test
 * Feature: 010-accounting-module-integration
 * User Story 3: Record Order-to-Cash Transactions
 *
 * Tests the AR Invoices page rendering and interactions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ARInvoicesPage from '@/app/accounting/ar/invoices/page';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => '/accounting/ar/invoices',
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Sample test data
const mockCustomers = [
  { id: 1, code: 'CUS-001', name: 'Test Customer Co., Ltd.' },
  { id: 2, code: 'CUS-002', name: 'Sample Customer Inc.' },
];

const mockGLAccounts = [
  { id: 1, code: '4110', nameTh: 'รายได้จากการขาย', nameEn: 'Sales Revenue' },
  { id: 2, code: '4120', nameTh: 'รายได้จากบริการ', nameEn: 'Service Revenue' },
  { id: 3, code: '1111', nameTh: 'เงินสด', nameEn: 'Cash' },
  { id: 4, code: '1112', nameTh: 'เงินฝากธนาคาร', nameEn: 'Bank Account' },
];

const mockARInvoices = [
  {
    id: 1,
    invoiceNumber: 'AR-202506-000001',
    taxInvoiceNumber: 'T-202506-000001',
    customerId: 1,
    customerName: 'Test Customer Co., Ltd.',
    invoiceDate: '2025-06-15',
    dueDate: '2025-06-30',
    description: 'Product sale',
    subtotal: 10000,
    vatAmount: 700,
    totalAmount: 10700,
    paidAmount: 0,
    currency: 'THB',
    status: 'draft',
    journalEntryId: null,
  },
  {
    id: 2,
    invoiceNumber: 'AR-202506-000002',
    taxInvoiceNumber: 'T-202506-000002',
    customerId: 1,
    customerName: 'Test Customer Co., Ltd.',
    invoiceDate: '2025-06-10',
    dueDate: '2025-06-25',
    description: 'Service invoice',
    subtotal: 5000,
    vatAmount: 350,
    totalAmount: 5350,
    paidAmount: 5350,
    currency: 'THB',
    status: 'paid',
    journalEntryId: 1,
  },
  {
    id: 3,
    invoiceNumber: 'AR-202506-000003',
    taxInvoiceNumber: 'T-202506-000003',
    customerId: 2,
    customerName: 'Sample Customer Inc.',
    invoiceDate: '2025-06-05',
    dueDate: '2025-06-20',
    description: 'Consulting service',
    subtotal: 20000,
    vatAmount: 1400,
    totalAmount: 21400,
    paidAmount: 10000,
    currency: 'THB',
    status: 'partial',
    journalEntryId: 2,
  },
];

describe('AR Invoices Page', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: 0,
        },
      },
    });

    // Reset mock
    mockFetch.mockReset();

    // Setup default mock responses
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/accounting/ar-invoices')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockARInvoices }),
        });
      }
      if (url.includes('/api/customers')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockCustomers }),
        });
      }
      if (url.includes('/api/accounting/gl-accounts')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockGLAccounts }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: [] }),
      });
    });
  });

  const renderPage = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ARInvoicesPage />
      </QueryClientProvider>
    );
  };

  it('should render page header correctly', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Invoices')).toBeInTheDocument();
    });
    expect(screen.getByText('Accounts Receivable')).toBeInTheDocument();
  });

  it('should render stat cards', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('รายการทั้งหมด')).toBeInTheDocument();
    });
    expect(screen.getByText('รอดำเนินการ')).toBeInTheDocument();
    expect(screen.getByText('ค้างรับ')).toBeInTheDocument();
    expect(screen.getByText('ชำระแล้ว')).toBeInTheDocument();
  });

  it('should display correct stat values', async () => {
    renderPage();

    await waitFor(() => {
      // Total invoices: 3
      const threeElements = screen.getAllByText('3');
      expect(threeElements.length).toBeGreaterThan(0);
    });

    // Draft (รอดำเนินการ): 1
    const oneElements = screen.getAllByText('1');
    expect(oneElements.length).toBeGreaterThan(0);
  });

  it('should fetch AR invoices on mount', async () => {
    renderPage();

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/accounting/ar-invoices')
      );
    });
  });

  it('should fetch customers on mount', async () => {
    renderPage();

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/customers')
      );
    });
  });

  it('should fetch GL accounts on mount', async () => {
    renderPage();

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/accounting/gl-accounts')
      );
    });
  });

  it('should render add invoice button', async () => {
    renderPage();

    await waitFor(() => {
      const addButton = screen.getByRole('button', { name: /เพิ่มใบแจ้งหนี้/i });
      expect(addButton).toBeInTheDocument();
    });
  });

  it('should render invoice grid with data', async () => {
    renderPage();

    await waitFor(() => {
      // Check for invoice numbers
      expect(screen.getByText('AR-202506-000001')).toBeInTheDocument();
    });

    expect(screen.getByText('AR-202506-000002')).toBeInTheDocument();
    expect(screen.getByText('AR-202506-000003')).toBeInTheDocument();
  });

  it('should render tax invoice numbers', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('T-202506-000001')).toBeInTheDocument();
    });

    expect(screen.getByText('T-202506-000002')).toBeInTheDocument();
  });

  it('should render status badges', async () => {
    renderPage();

    await waitFor(() => {
      // Status badge for draft
      expect(screen.getByText('ร่าง')).toBeInTheDocument();
    });

    // Status badge for paid (may appear multiple times - in stat card and grid)
    const paidElements = screen.getAllByText('ชำระแล้ว');
    expect(paidElements.length).toBeGreaterThan(0);

    expect(screen.getByText('บางส่วน')).toBeInTheDocument();
  });

  it('should render confirm button for draft invoices', async () => {
    renderPage();

    await waitFor(() => {
      const confirmButton = screen.getByRole('button', { name: /ยืนยัน/i });
      expect(confirmButton).toBeInTheDocument();
    }, { timeout: 10000 });
  }, 15000);

  it('should render receive payment button for partial invoices', async () => {
    renderPage();

    await waitFor(() => {
      const payButtons = screen.getAllByRole('button', { name: /รับชำระ/i });
      expect(payButtons.length).toBeGreaterThan(0);
    }, { timeout: 10000 });
  }, 15000);

  it('should handle API error gracefully', async () => {
    mockFetch.mockImplementation(() => {
      return Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ error: 'Failed to fetch' }),
      });
    });

    renderPage();

    // Should not crash - page should still render
    await waitFor(() => {
      expect(screen.getByText('Invoices')).toBeInTheDocument();
    });
  });

  it('should render status filter dropdown', async () => {
    renderPage();

    await waitFor(() => {
      // DevExtreme SelectBox is rendered
      const selectBoxes = document.querySelectorAll('.dx-selectbox');
      expect(selectBoxes.length).toBeGreaterThan(0);
    });
  });

  it('should render data grid with columns', async () => {
    renderPage();

    await waitFor(() => {
      // Check for column headers
      const gridContainer = document.querySelector('.dx-datagrid');
      expect(gridContainer).toBeInTheDocument();
    });
  });
});
