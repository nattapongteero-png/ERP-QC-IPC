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

/**
 * The KPI/urgency cards must show BOTH how many PRs are in a band and how much
 * money sits behind them. Dates are relative to today so each urgency band is
 * actually exercised (fixed dates would all drift into "urgent" over time).
 */
describe('Stat cards show count and value', () => {
  const daysFromNow = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };

  // 2 urgent (฿5,000 + ฿1,000 = ฿6,000), 1 normal (฿150,000), 1 low (฿25,000).
  // The cancelled row is deliberately urgent-dated and must NOT be counted:
  // it waits on no one.
  const datedPRs = [
    { id: 1, prNumber: 'PR2026-0001', status: 'draft', priority: 'normal', description: 'Office supplies', totalAmount: 5000, requiredDate: daysFromNow(3), createdAt: daysFromNow(-1) },
    { id: 2, prNumber: 'PR2026-0002', status: 'pending_approval', priority: 'high', description: 'IT Equipment', totalAmount: 150000, requiredDate: daysFromNow(20), createdAt: daysFromNow(-2) },
    { id: 3, prNumber: 'PR2026-0003', status: 'approved', priority: 'urgent', description: 'Emergency parts', totalAmount: 25000, requiredDate: daysFromNow(45), createdAt: daysFromNow(-3) },
    { id: 4, prNumber: 'PR2026-0004', status: 'draft', priority: 'normal', description: 'Packaging', totalAmount: 1000, requiredDate: daysFromNow(1), createdAt: daysFromNow(-4) },
    { id: 5, prNumber: 'PR2026-0005', status: 'cancelled', priority: 'normal', description: 'Scrapped order', totalAmount: 99000, requiredDate: daysFromNow(2), createdAt: daysFromNow(-5) },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: true, data: datedPRs }),
    });
  });

  it('shows count and total value on each urgency card', async () => {
    render(<PurchaseRequisitionsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('urgency-urgent')).toBeInTheDocument();
    });

    const urgent = screen.getByTestId('urgency-urgent');
    expect(urgent).toHaveTextContent('2 PRs');
    expect(urgent).toHaveTextContent('฿6,000.00');

    const normal = screen.getByTestId('urgency-normal');
    expect(normal).toHaveTextContent('1 PRs');
    expect(normal).toHaveTextContent('฿150,000.00');

    const low = screen.getByTestId('urgency-low');
    expect(low).toHaveTextContent('1 PRs');
    expect(low).toHaveTextContent('฿25,000.00');
  });

  it('excludes cancelled PRs from urgency value, not just from the count', async () => {
    render(<PurchaseRequisitionsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('urgency-urgent')).toBeInTheDocument();
    });

    // The ฿99,000 cancelled PR is urgent-dated but closed — it must not inflate
    // the urgent band in either figure.
    expect(screen.getByTestId('urgency-urgent')).not.toHaveTextContent('99,000');
    expect(screen.getByTestId('urgency-urgent')).not.toHaveTextContent('105,000');
  });

  it('shows count and total value on each KPI card', async () => {
    render(<PurchaseRequisitionsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('kpi-total')).toBeInTheDocument();
    });

    // All 5 PRs, ฿280,000 in total (closed ones included here — this is the
    // whole book, not the open workload).
    const total = screen.getByTestId('kpi-total');
    expect(total).toHaveTextContent('5 PRs');
    expect(total).toHaveTextContent('฿280,000.00');

    const pending = screen.getByTestId('kpi-pending');
    expect(pending).toHaveTextContent('1 PRs');
    expect(pending).toHaveTextContent('฿150,000.00');

    const approved = screen.getByTestId('kpi-approved');
    expect(approved).toHaveTextContent('1 PRs');
    expect(approved).toHaveTextContent('฿25,000.00');

    // Closed = converted + cancelled + rejected → just the ฿99,000 cancelled PR.
    const closed = screen.getByTestId('kpi-closed');
    expect(closed).toHaveTextContent('1 PRs');
    expect(closed).toHaveTextContent('฿99,000.00');
  });

  it('shows thousands separators, not raw digits', async () => {
    render(<PurchaseRequisitionsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('kpi-total')).toBeInTheDocument();
    });

    expect(screen.getByTestId('kpi-total')).not.toHaveTextContent('280000');
  });

  it('renders a zero band as 0 with a zero amount, never a dash', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: true, data: [] }),
    });

    render(<PurchaseRequisitionsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('urgency-urgent')).toBeInTheDocument();
    });

    expect(screen.getByTestId('urgency-urgent')).toHaveTextContent('0 PRs');
    expect(screen.getByTestId('urgency-urgent')).toHaveTextContent('฿0.00');
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
