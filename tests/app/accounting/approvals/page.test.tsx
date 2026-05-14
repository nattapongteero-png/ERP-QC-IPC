/**
 * Approval Dashboard Page UI Test (T128)
 * Part of 011-accounting-spec-gap - User Story 5
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
  usePathname: () => '/accounting/approvals',
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
  DataGrid.Item = ({ children }: any) => <div>{children}</div>;
  return {
    default: DataGrid,
    Column: () => null,
    Paging: () => null,
    FilterRow: () => null,
    Toolbar: ({ children }: any) => <div>{children}</div>,
    Item: ({ children }: any) => <div>{children}</div>,
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

vi.mock('devextreme-react/popup', () => ({
  Popup: ({ children, visible }: any) =>
    visible ? <div data-testid="action-popup">{children}</div> : null,
}));

vi.mock('devextreme-react/text-area', () => ({
  TextArea: ({ ...props }: any) => (
    <textarea data-testid={props['data-testid'] || 'text-area'} />
  ),
}));

// Mock data
const mockDashboard = {
  pendingApprovals: [
    {
      id: 1,
      documentType: 'purchase_requisition',
      documentId: 100,
      flowId: 1,
      flowName: 'PR Approval Flow',
      currentStepOrder: 1,
      requestedBy: 2,
      requestedByName: 'John Doe',
      requestedAt: '2024-12-20T10:00:00Z',
      amount: 50000,
      description: 'Office supplies',
    },
    {
      id: 2,
      documentType: 'ap_invoice',
      documentId: 200,
      flowId: 2,
      flowName: 'AP Invoice Flow',
      currentStepOrder: 2,
      requestedBy: 3,
      requestedByName: 'Jane Smith',
      requestedAt: '2024-12-21T09:00:00Z',
      amount: 150000,
      description: 'Vendor payment',
    },
  ],
  recentActions: [
    {
      id: 1,
      documentType: 'purchase_order',
      documentId: 50,
      action: 'approved',
      actionBy: 1,
      actionByName: 'Admin User',
      actionAt: '2024-12-19T14:00:00Z',
      comments: 'Approved as requested',
    },
    {
      id: 2,
      documentType: 'payment',
      documentId: 75,
      action: 'rejected',
      actionBy: 1,
      actionByName: 'Admin User',
      actionAt: '2024-12-18T11:00:00Z',
      comments: 'Missing documentation',
    },
  ],
  stats: {
    pendingCount: 2,
    approvedToday: 5,
    rejectedToday: 1,
  },
};

global.fetch = vi.fn().mockImplementation((url: string) => {
  if (url.includes('/dashboard')) {
    return Promise.resolve({
      json: () => Promise.resolve({ success: true, data: mockDashboard }),
    });
  }
  return Promise.resolve({
    json: () => Promise.resolve({ success: true }),
  });
});

import ApprovalDashboardPage from '@/app/accounting/approvals/page';

describe('Approval Dashboard Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/dashboard')) {
        return Promise.resolve({
          json: () => Promise.resolve({ success: true, data: mockDashboard }),
        });
      }
      return Promise.resolve({
        json: () => Promise.resolve({ success: true }),
      });
    });
  });

  it('renders the page title', async () => {
    render(<ApprovalDashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId('page-title')).toBeInTheDocument();
    });

    expect(screen.getByTestId('page-title')).toHaveTextContent('Accounting');
  });

  it('renders the main layout', async () => {
    render(<ApprovalDashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId('main-layout')).toBeInTheDocument();
    });
  });

  it('renders the pending approvals grid', async () => {
    render(<ApprovalDashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId('pending-approvals-grid')).toBeInTheDocument();
    });
  });

  it('renders the recent actions grid', async () => {
    render(<ApprovalDashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId('recent-actions-grid')).toBeInTheDocument();
    });
  });

  it('fetches dashboard data on mount', async () => {
    render(<ApprovalDashboardPage />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/accounting/approvals/dashboard'
      );
    });
  });

  it('displays page description', async () => {
    render(<ApprovalDashboardPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/Manage general ledger/i)
      ).toBeInTheDocument();
    });
  });

  it('displays pending approvals count in stats', async () => {
    render(<ApprovalDashboardPage />);

    await waitFor(() => {
      // Use getAllByText since "Pending Approvals" appears in both stats card and grid toolbar
      const elements = screen.getAllByText('Pending Approvals');
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });

    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('displays approved today count in stats', async () => {
    render(<ApprovalDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Approved Today')).toBeInTheDocument();
    });

    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('displays rejected today count in stats', async () => {
    render(<ApprovalDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Rejected Today')).toBeInTheDocument();
    });

    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('renders refresh button', async () => {
    render(<ApprovalDashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId('refresh-btn')).toBeInTheDocument();
    });
  });
});

describe('Approval Dashboard Page with empty data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/dashboard')) {
        return Promise.resolve({
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                pendingApprovals: [],
                recentActions: [],
                stats: {
                  pendingCount: 0,
                  approvedToday: 0,
                  rejectedToday: 0,
                },
              },
            }),
        });
      }
      return Promise.resolve({
        json: () => Promise.resolve({ success: true }),
      });
    });
  });

  it('renders grids with no data', async () => {
    render(<ApprovalDashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId('pending-approvals-grid')).toBeInTheDocument();
      expect(screen.getByTestId('recent-actions-grid')).toBeInTheDocument();
    });
  });

  it('shows zero counts in stats', async () => {
    render(<ApprovalDashboardPage />);

    await waitFor(() => {
      const zeros = screen.getAllByText('0');
      expect(zeros.length).toBeGreaterThanOrEqual(3);
    });
  });
});

describe('Approval Dashboard Page with error', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
  });

  it('handles fetch error gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<ApprovalDashboardPage />);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
    });

    consoleSpy.mockRestore();
  });
});
