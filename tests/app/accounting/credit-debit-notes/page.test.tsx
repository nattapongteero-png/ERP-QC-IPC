/**
 * Credit/Debit Notes Page UI Test (T100)
 * Part of 011-accounting-spec-gap - User Story 3
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Mock MainLayout
vi.mock('@/components/layout/main-layout', () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="main-layout">{children}</div>
  ),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/accounting/credit-debit-notes',
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
const mockNotes = [
  {
    id: 1,
    noteNumber: 'CN2024-0001',
    noteType: 'ar_credit',
    referenceType: 'ar_invoice',
    referenceInvoiceId: 1,
    referenceInvoiceNumber: 'INV2024-0001',
    customerId: 1,
    customerName: 'Customer A',
    noteDate: '2024-01-15',
    reasonCode: 'return',
    reasonDescription: 'Goods returned',
    subtotal: 10000,
    vatRate: 0.07,
    vatAmount: 700,
    whtAmount: 0,
    totalAmount: 10700,
    status: 'draft',
    createdAt: '2024-01-15T10:00:00Z',
  },
  {
    id: 2,
    noteNumber: 'DN2024-0001',
    noteType: 'ap_debit',
    referenceType: 'ap_invoice',
    referenceInvoiceId: 2,
    referenceInvoiceNumber: 'PINV2024-0002',
    vendorId: 1,
    vendorName: 'Vendor B',
    noteDate: '2024-01-20',
    reasonCode: 'price_adjustment',
    reasonDescription: 'Price correction',
    subtotal: 5000,
    vatRate: 0.07,
    vatAmount: 350,
    whtAmount: 0,
    totalAmount: 5350,
    status: 'posted',
    createdAt: '2024-01-20T10:00:00Z',
  },
];

const mockSummary = {
  draftCount: 1,
  pendingApprovalCount: 0,
  postedThisMonth: 1,
  totalThisMonth: 16050,
  byType: {
    arCredit: 1,
    apCredit: 0,
    arDebit: 0,
    apDebit: 1,
  },
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
        data: mockNotes,
        total: mockNotes.length,
      }),
  });
});

import CreditDebitNotesPage from '@/app/accounting/credit-debit-notes/page';

describe('Credit/Debit Notes List Page', () => {
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
            data: mockNotes,
            total: mockNotes.length,
          }),
      });
    });
  });

  it('renders the page title', async () => {
    render(<CreditDebitNotesPage />);

    await waitFor(() => {
      expect(screen.getByTestId('page-title')).toBeInTheDocument();
    });

    expect(screen.getByTestId('page-title')).toHaveTextContent('Accounting');
  });

  it('renders the main layout', async () => {
    render(<CreditDebitNotesPage />);

    await waitFor(() => {
      expect(screen.getByTestId('main-layout')).toBeInTheDocument();
    });
  });

  it('renders the notes grid', async () => {
    render(<CreditDebitNotesPage />);

    await waitFor(() => {
      expect(screen.getByTestId('notes-grid')).toBeInTheDocument();
    });
  });

  it('fetches notes on mount', async () => {
    render(<CreditDebitNotesPage />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/accounting/credit-debit-notes');
    });
  });

  it('fetches dashboard summary on mount', async () => {
    render(<CreditDebitNotesPage />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/accounting/credit-debit-notes/dashboard');
    });
  });

  it('displays page description', async () => {
    render(<CreditDebitNotesPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/Create and manage credit notes and debit notes/i)
      ).toBeInTheDocument();
    });
  });

  it('makes correct API calls on mount', async () => {
    render(<CreditDebitNotesPage />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });
});

describe('Credit/Debit Notes Page with empty data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/dashboard')) {
        return Promise.resolve({
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                draftCount: 0,
                pendingApprovalCount: 0,
                postedThisMonth: 0,
                totalThisMonth: 0,
                byType: {
                  arCredit: 0,
                  apCredit: 0,
                  arDebit: 0,
                  apDebit: 0,
                },
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
    render(<CreditDebitNotesPage />);

    await waitFor(() => {
      expect(screen.getByTestId('notes-grid')).toBeInTheDocument();
    });
  });
});

describe('Credit/Debit Notes Page with error', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
  });

  it('handles fetch error gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<CreditDebitNotesPage />);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
    });

    consoleSpy.mockRestore();
  });
});
