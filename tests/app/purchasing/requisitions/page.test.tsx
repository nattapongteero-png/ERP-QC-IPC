/**
 * Purchase Requisitions List Page UI Test (T051)
 * Part of 011-accounting-spec-gap
 * Updated for redesigned UI matching PO list pattern
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

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

// Mock UI components
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => <div className={className} data-testid="card">{children}</div>,
  CardHeader: ({ children, className }: any) => <div className={className} data-testid="card-header">{children}</div>,
  CardContent: ({ children, className }: any) => <div className={className} data-testid="card-content">{children}</div>,
}));

vi.mock('@/components/ui/page-header', () => ({
  PageHeader: ({ title, description, actions }: any) => (
    <div data-testid="page-header">
      <h1 data-testid="page-title">{title}</h1>
      <p data-testid="page-description">{description}</p>
      <div data-testid="page-actions">{actions}</div>
    </div>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant }: any) => (
    <span data-testid="badge" data-variant={variant}>{children}</span>
  ),
}));

vi.mock('@/components/ui/dx-button', () => ({
  DxButton: ({ text, onClick, ...props }: any) => (
    <button onClick={onClick} data-testid={props['data-testid']} data-icon={props.icon}>
      {text}
    </button>
  ),
}));

vi.mock('@/components/ui/dx-text-box', () => ({
  DxTextBox: ({ value, onValueChange, placeholder, ...props }: any) => (
    <input
      value={value || ''}
      onChange={(e) => onValueChange?.(e.target.value)}
      placeholder={placeholder}
      data-testid={props['data-testid'] || 'text-box'}
    />
  ),
}));

vi.mock('@/components/ui/dx-data-grid', () => ({
  DxDataGrid: ({ dataSource, onRowClick, loading, ...props }: any) => (
    <div data-testid={props['data-testid'] || 'data-grid'} data-loading={loading}>
      {dataSource?.map((item: any) => (
        <div
          key={item.id}
          data-testid={`grid-row-${item.id}`}
          onClick={() => onRowClick?.({ data: item })}
        >
          {item.prNumber} - {item.status}
        </div>
      ))}
      {dataSource?.length === 0 && <div>{props.noDataText}</div>}
    </div>
  ),
  DxDataGridColumn: () => null,
}));

// Mock lucide-react icons (Proxy returns a stub for ANY icon name)
vi.mock('lucide-react', () => {
  const React = require('react');
  const make = (name: string) => Object.assign(
    (props: any) => React.createElement('span', { 'data-testid': `icon-${name}`, ...props }),
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

// Mock cn utility
vi.mock('@/lib/utils/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

// Mock data
const mockPRs = [
  {
    id: 1,
    prNumber: 'PR2024-0001',
    status: 'draft',
    priority: 'normal',
    description: 'Office supplies',
    totalAmount: 5000,
    requiredDate: '2024-12-31',
    createdAt: '2024-12-01',
  },
  {
    id: 2,
    prNumber: 'PR2024-0002',
    status: 'pending_approval',
    priority: 'high',
    description: 'IT Equipment',
    totalAmount: 150000,
    requiredDate: '2024-12-15',
    createdAt: '2024-12-05',
  },
  {
    id: 3,
    prNumber: 'PR2024-0003',
    status: 'approved',
    priority: 'urgent',
    description: 'Emergency parts',
    totalAmount: 25000,
    requiredDate: '2024-12-10',
    createdAt: '2024-12-06',
  },
];

global.fetch = vi.fn();

import PurchaseRequisitionsPage from '@/app/purchasing/requisitions/page';

describe('Purchase Requisitions List Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: true, data: mockPRs }),
    });
  });

  it('renders the page header with Thai title', async () => {
    render(<PurchaseRequisitionsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('page-header')).toBeInTheDocument();
    });

    expect(screen.getByTestId('page-title')).toHaveTextContent('Purchase Requisitions');
    expect(screen.getByTestId('page-description')).toHaveTextContent('Create and manage purchase requisitions with approval workflow');
  });

  it('renders the new PR button and refresh button', async () => {
    render(<PurchaseRequisitionsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('new-pr-btn')).toBeInTheDocument();
      expect(screen.getByTestId('refresh-btn')).toBeInTheDocument();
    });

    expect(screen.getByTestId('new-pr-btn')).toHaveTextContent('Create PR');
  });

  it('renders the data grid', async () => {
    render(<PurchaseRequisitionsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('pr-grid')).toBeInTheDocument();
    });
  });

  it('fetches PRs on mount with limit parameter', async () => {
    render(<PurchaseRequisitionsPage />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/purchasing/requisitions?limit=1000');
    });
  });

  it('renders status filter tabs', async () => {
    render(<PurchaseRequisitionsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('status-tab-all')).toBeInTheDocument();
      expect(screen.getByTestId('status-tab-draft')).toBeInTheDocument();
      expect(screen.getByTestId('status-tab-pending_approval')).toBeInTheDocument();
      expect(screen.getByTestId('status-tab-approved')).toBeInTheDocument();
    });
  });

  it('renders search input', async () => {
    render(<PurchaseRequisitionsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('search-input')).toBeInTheDocument();
    });
  });

  it('displays correct count in tabs', async () => {
    render(<PurchaseRequisitionsPage />);

    await waitFor(() => {
      // Total should be 3
      const allTab = screen.getByTestId('status-tab-all');
      expect(allTab).toHaveTextContent('3');

      // Draft should be 1
      const draftTab = screen.getByTestId('status-tab-draft');
      expect(draftTab).toHaveTextContent('1');
    });
  });

  it('filters data when status tab clicked', async () => {
    render(<PurchaseRequisitionsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('status-tab-draft')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('status-tab-draft'));

    await waitFor(() => {
      // Only draft PR should be shown
      expect(screen.getByTestId('grid-row-1')).toBeInTheDocument();
      expect(screen.queryByTestId('grid-row-2')).not.toBeInTheDocument();
    });
  });

  it('filters data by search text', async () => {
    render(<PurchaseRequisitionsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('search-input')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'IT Equipment' } });

    await waitFor(() => {
      expect(screen.getByTestId('grid-row-2')).toBeInTheDocument();
      expect(screen.queryByTestId('grid-row-1')).not.toBeInTheDocument();
    });
  });

  it('renders card with proper structure', async () => {
    render(<PurchaseRequisitionsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('card')).toBeInTheDocument();
      expect(screen.getByTestId('card-header')).toBeInTheDocument();
      expect(screen.getByTestId('card-content')).toBeInTheDocument();
    });
  });
});

describe('Page with empty data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: true, data: [] }),
    });
  });

  it('renders grid with no data message', async () => {
    render(<PurchaseRequisitionsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('pr-grid')).toBeInTheDocument();
      expect(screen.getByText('No purchase requisitions found')).toBeInTheDocument();
    });
  });

  it('shows zero counts in tabs', async () => {
    render(<PurchaseRequisitionsPage />);

    await waitFor(() => {
      const allTab = screen.getByTestId('status-tab-all');
      expect(allTab).toHaveTextContent('0');
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

    // Should still render grid (empty)
    expect(screen.getByTestId('pr-grid')).toBeInTheDocument();

    consoleSpy.mockRestore();
  });
});
