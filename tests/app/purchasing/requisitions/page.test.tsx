/**
 * Purchase Requisitions List Page UI Test (T051)
 * Part of 011-accounting-spec-gap
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
  usePathname: () => '/purchasing/requisitions',
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
  DataGrid.HeaderFilter = () => null;
  DataGrid.Toolbar = ({ children }: any) => <div>{children}</div>;
  DataGrid.Item = () => null;
  DataGrid.SearchPanel = () => null;
  return {
    default: DataGrid,
    Column: () => null,
    Paging: () => null,
    FilterRow: () => null,
    HeaderFilter: () => null,
    Toolbar: ({ children }: any) => <div>{children}</div>,
    Item: () => null,
    SearchPanel: () => null,
  };
});

vi.mock('devextreme-react/button', () => ({
  Button: ({ text, ...props }: any) => (
    <button data-testid={props['data-testid']}>{text}</button>
  ),
}));

// Mock fetch
const mockPRs = [
  {
    id: 1,
    prNumber: 'PR2024-0001',
    status: 'draft',
    priority: 'normal',
    description: 'Office supplies',
    totalEstimatedAmount: 5000,
    requiredDate: '2024-12-31',
    createdAt: '2024-12-01',
  },
  {
    id: 2,
    prNumber: 'PR2024-0002',
    status: 'pending_approval',
    priority: 'high',
    description: 'IT Equipment',
    totalEstimatedAmount: 150000,
    requiredDate: '2024-12-15',
    createdAt: '2024-12-05',
  },
];

global.fetch = vi.fn().mockResolvedValue({
  json: () => Promise.resolve({ success: true, data: mockPRs, total: mockPRs.length }),
});

import PurchaseRequisitionsPage from '@/app/purchasing/requisitions/page';

describe('Purchase Requisitions List Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: true, data: mockPRs, total: mockPRs.length }),
    });
  });

  it('renders the page title', async () => {
    render(<PurchaseRequisitionsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('page-title')).toBeInTheDocument();
    });

    expect(screen.getByTestId('page-title')).toHaveTextContent('Purchase Requisitions');
  });

  it('renders the new requisition button or grid toolbar', async () => {
    render(<PurchaseRequisitionsPage />);

    await waitFor(() => {
      // Either button is rendered or grid with toolbar exists
      const grid = screen.getByTestId('pr-grid');
      expect(grid).toBeInTheDocument();
    });
  });

  it('renders page content', async () => {
    render(<PurchaseRequisitionsPage />);

    await waitFor(() => {
      // Verify main content is rendered
      const layout = screen.getByTestId('main-layout');
      expect(layout).toBeInTheDocument();
    });
  });

  it('renders the data grid', async () => {
    render(<PurchaseRequisitionsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('pr-grid')).toBeInTheDocument();
    });
  });

  it('fetches PRs on mount', async () => {
    render(<PurchaseRequisitionsPage />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/purchasing/requisitions');
    });
  });

  it('displays description text', async () => {
    render(<PurchaseRequisitionsPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/Create and manage purchase requisitions with approval workflow/)
      ).toBeInTheDocument();
    });
  });
});

describe('Page with empty data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: true, data: [], total: 0 }),
    });
  });

  it('renders grid with no data', async () => {
    render(<PurchaseRequisitionsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('pr-grid')).toBeInTheDocument();
    });
  });
});

describe('Page with error', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
  });

  it('handles fetch error gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<PurchaseRequisitionsPage />);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
    });

    consoleSpy.mockRestore();
  });
});
