/**
 * Credit Notes Page UI Test (T099)
 * Part of 011-accounting-spec-gap - User Story 3
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    replace: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn().mockReturnValue('ar_credit'),
  }),
  usePathname: () => '/accounting/credit-notes',
}));

// Mock devextreme-react components
vi.mock('devextreme-react/button', () => ({
  Button: ({ text, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>{text}</button>
  ),
}));

vi.mock('devextreme-react/load-indicator', () => ({
  LoadIndicator: () => <div data-testid="loading">Loading...</div>,
}));

vi.mock('devextreme-react/select-box', () => ({
  SelectBox: ({ value, onValueChanged, ...props }: any) => (
    <select value={value} onChange={(e) => onValueChanged?.({ value: e.target.value })} {...props}>
      <option value="ar_credit">AR Credit Notes</option>
      <option value="ap_credit">AP Credit Notes</option>
    </select>
  ),
}));

vi.mock('devextreme-react/data-grid', () => {
  const DataGrid = ({ dataSource, children, ...props }: any) => (
    <table data-testid="notes-grid" {...props}>
      <tbody>
        {dataSource?.map((item: any, idx: number) => (
          <tr key={idx}>
            <td>{item.noteNumber}</td>
            <td>{item.status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
  DataGrid.Column = () => null;
  DataGrid.Paging = () => null;
  DataGrid.FilterRow = () => null;
  DataGrid.Toolbar = () => null;
  DataGrid.Item = () => null;
  DataGrid.SearchPanel = () => null;
  return {
    __esModule: true,
    default: DataGrid,
    Column: () => null,
    Paging: () => null,
    FilterRow: () => null,
    Toolbar: () => null,
    Item: () => null,
    SearchPanel: () => null,
  };
});

// Mock MainLayout
vi.mock('@/components/layout/main-layout', () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock fetch
const mockNotes = [
  {
    id: 1,
    noteNumber: 'CN-AR-2024-0001',
    noteType: 'ar_credit',
    noteDate: '2024-01-15',
    status: 'draft',
    totalAmount: 10700,
    customerName: 'Test Customer',
  },
  {
    id: 2,
    noteNumber: 'CN-AR-2024-0002',
    noteType: 'ar_credit',
    noteDate: '2024-01-16',
    status: 'posted',
    totalAmount: 21400,
    customerName: 'Another Customer',
  },
];

const mockDashboard = {
  draftCount: 5,
  pendingApprovalCount: 2,
  postedThisMonth: 10,
  totalCreditedThisMonth: 150000,
  totalDebitedThisMonth: 50000,
};

global.fetch = vi.fn().mockImplementation((url: string) => {
  if (url.includes('/api/accounting/credit-notes/dashboard')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ success: true, data: mockDashboard }),
    });
  }
  if (url.includes('/api/accounting/credit-notes')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ success: true, data: mockNotes }),
    });
  }
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ success: true, data: [] }),
  });
});

describe('Credit Notes List Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page title', async () => {
    const CreditNotesPage = (await import('@/app/accounting/credit-notes/page')).default;
    render(<CreditNotesPage />);

    await waitFor(() => {
      expect(screen.getByTestId('page-title')).toHaveTextContent('Credit Notes');
    });
  });

  it('renders credit notes grid', async () => {
    const CreditNotesPage = (await import('@/app/accounting/credit-notes/page')).default;
    render(<CreditNotesPage />);

    await waitFor(() => {
      expect(screen.getByTestId('notes-grid')).toBeInTheDocument();
    });
  });

  it('renders notes grid when data is loaded', async () => {
    const CreditNotesPage = (await import('@/app/accounting/credit-notes/page')).default;
    render(<CreditNotesPage />);

    // Verify grid is rendered with note data
    await waitFor(() => {
      expect(screen.getByTestId('notes-grid')).toBeInTheDocument();
      expect(screen.getByText('CN-AR-2024-0001')).toBeInTheDocument();
    });
  });

  it('fetches credit notes on mount', async () => {
    const CreditNotesPage = (await import('@/app/accounting/credit-notes/page')).default;
    render(<CreditNotesPage />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/accounting/credit-notes')
      );
    });
  });

  it('fetches dashboard data on mount', async () => {
    const CreditNotesPage = (await import('@/app/accounting/credit-notes/page')).default;
    render(<CreditNotesPage />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/accounting/credit-notes/dashboard')
      );
    });
  });
});

describe('Credit Note Status Display', () => {
  it('displays draft status correctly', async () => {
    const CreditNotesPage = (await import('@/app/accounting/credit-notes/page')).default;
    render(<CreditNotesPage />);

    await waitFor(() => {
      expect(screen.getByText('draft')).toBeInTheDocument();
    });
  });

  it('displays posted status correctly', async () => {
    const CreditNotesPage = (await import('@/app/accounting/credit-notes/page')).default;
    render(<CreditNotesPage />);

    await waitFor(() => {
      expect(screen.getByText('posted')).toBeInTheDocument();
    });
  });
});

describe('Dashboard Summary', () => {
  it('displays dashboard summary cards', async () => {
    const CreditNotesPage = (await import('@/app/accounting/credit-notes/page')).default;
    render(<CreditNotesPage />);

    await waitFor(() => {
      expect(screen.getByText('Draft Notes')).toBeInTheDocument();
      expect(screen.getByText('Pending Approval')).toBeInTheDocument();
      expect(screen.getByText('Posted This Month')).toBeInTheDocument();
      expect(screen.getByText('Total Credited (Month)')).toBeInTheDocument();
    });
  });
});
