/**
 * Credit/Debit Notes E2E Test (T156)
 * Feature: 011-accounting-spec-gap
 * User Story 3: Credit and Debit Notes
 *
 * Tests the Credit/Debit Notes page rendering and interactions.
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
  usePathname: () => '/accounting/credit-debit-notes',
}));

// Mock lucide-react icons — Proxy returns a stub for ANY icon name so missing icons never fail
vi.mock('lucide-react', () => {
  const React = require('react');
  const make = (name: string) => Object.assign(
    (props: { className?: string }) =>
      React.createElement('span', { 'data-testid': `icon-${name}`, ...props }),
    { displayName: name }
  );
  return new Proxy({}, {
    get: (_t: unknown, prop: string | symbol) => {
      if (prop === '__esModule') return true;
      if (prop === 'default') return make('default');
      return make(String(prop));
    },
  });
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
              <td>{row.noteNumber || row.id}</td>
              <td>{row.noteType}</td>
              <td>{row.status}</td>
              <td>{row.amount}</td>
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

vi.mock('devextreme-react/select-box', () => ({
  SelectBox: ({ value, onValueChanged, ...props }: any) => (
    <select
      value={value}
      onChange={(e) => onValueChanged?.({ value: e.target.value })}
      data-testid={props['data-testid']}
    >
      <option value="">All</option>
      <option value="credit">Credit Note</option>
      <option value="debit">Debit Note</option>
    </select>
  ),
}));

vi.mock('devextreme-react/load-indicator', () => ({
  LoadIndicator: () => <div data-testid="dx-loadindicator">Loading...</div>,
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Sample credit/debit note data
const mockNotes = [
  {
    id: 1,
    noteNumber: 'CN-2024-0001',
    noteType: 'credit',
    noteDate: '2024-01-15',
    partyType: 'customer',
    partyId: 1,
    partyName: 'ABC Company',
    originalInvoiceId: 101,
    originalInvoiceNumber: 'INV-2024-0050',
    reason: 'goods_return',
    reasonDescription: 'Damaged goods returned',
    amount: 5000,
    taxAmount: 350,
    totalAmount: 5350,
    status: 'draft',
    createdAt: '2024-01-15T10:00:00Z',
  },
  {
    id: 2,
    noteNumber: 'DN-2024-0001',
    noteType: 'debit',
    noteDate: '2024-01-16',
    partyType: 'vendor',
    partyId: 2,
    partyName: 'XYZ Supplier',
    originalInvoiceId: 55,
    originalInvoiceNumber: 'PINV-2024-0030',
    reason: 'price_adjustment',
    reasonDescription: 'Price increase per agreement',
    amount: 2000,
    taxAmount: 140,
    totalAmount: 2140,
    status: 'posted',
    postedAt: '2024-01-17T14:00:00Z',
    createdAt: '2024-01-16T09:00:00Z',
  },
  {
    id: 3,
    noteNumber: 'CN-2024-0002',
    noteType: 'credit',
    noteDate: '2024-01-18',
    partyType: 'customer',
    partyId: 3,
    partyName: 'DEF Corp',
    originalInvoiceId: 102,
    originalInvoiceNumber: 'INV-2024-0055',
    reason: 'allowance',
    reasonDescription: 'Volume discount adjustment',
    amount: 3000,
    taxAmount: 210,
    totalAmount: 3210,
    status: 'approved',
    createdAt: '2024-01-18T11:00:00Z',
  },
];

// Mock dashboard summary
const mockDashboardSummary = {
  draftCount: 1,
  pendingApprovalCount: 1,
  postedThisMonth: 1,
  totalThisMonth: 10700,
};

describe('Credit/Debit Notes Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/accounting/credit-debit-notes/dashboard')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: mockDashboardSummary,
          }),
        });
      }
      if (url.includes('/api/accounting/credit-debit-notes')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: mockNotes,
            total: mockNotes.length,
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
    const CreditDebitNotesPage = (await import('@/app/accounting/credit-debit-notes/page')).default;

    render(<CreditDebitNotesPage />);

    await waitFor(() => {
      expect(screen.getByTestId('page-title')).toBeInTheDocument();
    });
  });

  it('should render notes data grid', async () => {
    const CreditDebitNotesPage = (await import('@/app/accounting/credit-debit-notes/page')).default;

    render(<CreditDebitNotesPage />);

    await waitFor(() => {
      expect(screen.getByTestId('notes-grid')).toBeInTheDocument();
    });
  });

  it('should render new note button', async () => {
    const CreditDebitNotesPage = (await import('@/app/accounting/credit-debit-notes/page')).default;

    render(<CreditDebitNotesPage />);

    await waitFor(() => {
      expect(screen.getByTestId('new-note-btn')).toBeInTheDocument();
    });
  });

  it('should display note data in grid', async () => {
    const CreditDebitNotesPage = (await import('@/app/accounting/credit-debit-notes/page')).default;

    render(<CreditDebitNotesPage />);

    await waitFor(() => {
      expect(screen.getByText('CN-2024-0001')).toBeInTheDocument();
      expect(screen.getByText('DN-2024-0001')).toBeInTheDocument();
    });
  });

  it('should fetch notes on mount', async () => {
    const CreditDebitNotesPage = (await import('@/app/accounting/credit-debit-notes/page')).default;

    render(<CreditDebitNotesPage />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/accounting/credit-debit-notes')
      );
    });
  });

  it('should show loading state initially', async () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));

    const CreditDebitNotesPage = (await import('@/app/accounting/credit-debit-notes/page')).default;

    render(<CreditDebitNotesPage />);

    expect(screen.getByTestId('dx-loadindicator')).toBeInTheDocument();
  });

  it('should display both credit and debit types', async () => {
    const CreditDebitNotesPage = (await import('@/app/accounting/credit-debit-notes/page')).default;

    render(<CreditDebitNotesPage />);

    await waitFor(() => {
      expect(screen.getAllByText('credit').length).toBeGreaterThan(0);
      expect(screen.getByText('debit')).toBeInTheDocument();
    });
  });

  it('should display different status values', async () => {
    const CreditDebitNotesPage = (await import('@/app/accounting/credit-debit-notes/page')).default;

    render(<CreditDebitNotesPage />);

    await waitFor(() => {
      expect(screen.getByText('draft')).toBeInTheDocument();
      expect(screen.getByText('posted')).toBeInTheDocument();
      expect(screen.getByText('approved')).toBeInTheDocument();
    });
  });
});

describe('Credit/Debit Notes Workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/accounting/credit-debit-notes/dashboard')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: mockDashboardSummary,
          }),
        });
      }
      if (url.includes('/api/accounting/credit-debit-notes')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: mockNotes,
            total: mockNotes.length,
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

    const CreditDebitNotesPage = (await import('@/app/accounting/credit-debit-notes/page')).default;

    render(<CreditDebitNotesPage />);

    await waitFor(() => {
      expect(screen.getByTestId('page-title')).toBeInTheDocument();
    });
  });
});
