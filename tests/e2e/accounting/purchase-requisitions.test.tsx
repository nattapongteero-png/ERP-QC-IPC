/**
 * Purchase Requisitions E2E Test (T154)
 * Feature: 011-accounting-spec-gap
 * User Story 1: Purchase Requisitions with Approval
 *
 * Tests the Purchase Requisitions page rendering and interactions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/purchasing/requisitions',
}));

// Mock lucide-react icons — Proxy returns a stub for ANY icon name,
// so newly-imported icons can never break the mock.
vi.mock('lucide-react', () => {
  const React = require('react');
  const make = (name: string) =>
    Object.assign(
      (props: Record<string, unknown>) =>
        React.createElement('span', { 'data-testid': `icon-${name}`, ...props }),
      { displayName: name }
    );
  return new Proxy(
    {},
    {
      get: (_t: unknown, prop: string | symbol) => {
        if (prop === '__esModule') return true;
        if (prop === 'default') return make('default');
        return make(String(prop));
      },
    }
  );
});

// Mock MainLayout
vi.mock('@/components/layout/main-layout', () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="main-layout">{children}</div>
  ),
}));

// Mock PageHeader
vi.mock('@/components/ui/page-header', () => ({
  PageHeader: ({ title, description, actions }: any) => (
    <div data-testid="page-header">
      <h1 data-testid="page-title">{title}</h1>
      {description && <p>{description}</p>}
      {actions}
    </div>
  ),
}));

// Mock DxDataGrid
vi.mock('@/components/ui/dx-data-grid', () => ({
  DxDataGrid: ({ dataSource, children, noDataText, ...props }: any) => (
    <div data-testid={props['data-testid'] || 'pr-grid'}>
      <table>
        <tbody>
          {Array.isArray(dataSource) && dataSource.map((row: any, i: number) => (
            <tr key={i} data-testid={`grid-row-${i}`}>
              <td>{row.requisitionNumber || row.id}</td>
              <td>{row.status}</td>
              <td>{row.totalAmount}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {children}
    </div>
  ),
  DxDataGridColumn: () => null,
}));

// Mock DxButton
vi.mock('@/components/ui/dx-button', () => ({
  DxButton: ({ text, onClick, hint, ...props }: any) => (
    <button
      onClick={onClick}
      data-testid={props['data-testid']}
      title={hint}
    >
      {text || hint}
    </button>
  ),
}));

// Mock DxTextBox
vi.mock('@/components/ui/dx-text-box', () => ({
  DxTextBox: ({ value, onValueChange, placeholder, ...props }: any) => (
    <input
      type="text"
      value={value || ''}
      onChange={(e) => onValueChange && onValueChange(e.target.value)}
      placeholder={placeholder}
      data-testid={props['data-testid']}
    />
  ),
}));

// Mock Badge
vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant }: any) => (
    <span data-testid={`badge-${variant}`}>{children}</span>
  ),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Sample requisition data
const mockRequisitions = [
  {
    id: 1,
    requisitionNumber: 'PR-2024-0001',
    requestDate: '2024-01-15',
    requestedById: 1,
    requestedByName: 'John Doe',
    departmentId: 1,
    departmentName: 'Production',
    status: 'draft',
    priority: 'normal',
    requiredDate: '2024-01-30',
    justification: 'Monthly supplies',
    totalAmount: 15000,
    lineCount: 3,
    createdAt: '2024-01-15T10:00:00Z',
  },
  {
    id: 2,
    requisitionNumber: 'PR-2024-0002',
    requestDate: '2024-01-16',
    requestedById: 2,
    requestedByName: 'Jane Smith',
    departmentId: 2,
    departmentName: 'QC',
    status: 'submitted',
    priority: 'high',
    requiredDate: '2024-01-25',
    justification: 'Urgent lab supplies',
    totalAmount: 25000,
    lineCount: 5,
    createdAt: '2024-01-16T09:00:00Z',
  },
  {
    id: 3,
    requisitionNumber: 'PR-2024-0003',
    requestDate: '2024-01-17',
    requestedById: 1,
    requestedByName: 'John Doe',
    departmentId: 1,
    departmentName: 'Production',
    status: 'approved',
    priority: 'normal',
    requiredDate: '2024-02-01',
    justification: 'Equipment replacement',
    totalAmount: 50000,
    lineCount: 2,
    createdAt: '2024-01-17T14:00:00Z',
  },
];

describe('Purchase Requisitions Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/purchasing/requisitions')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: mockRequisitions,
            total: mockRequisitions.length,
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
    const RequisitionsPage = (await import('@/app/purchasing/requisitions/page')).default;

    render(<RequisitionsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('page-title')).toHaveTextContent('Purchase Requisitions');
    });
  });

  it('should render requisitions data grid', async () => {
    const RequisitionsPage = (await import('@/app/purchasing/requisitions/page')).default;

    render(<RequisitionsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('pr-grid')).toBeInTheDocument();
    });
  });

  it('should render new requisition button', async () => {
    const RequisitionsPage = (await import('@/app/purchasing/requisitions/page')).default;

    render(<RequisitionsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('new-pr-btn')).toBeInTheDocument();
    });
  });

  it('should display requisition data in grid', async () => {
    const RequisitionsPage = (await import('@/app/purchasing/requisitions/page')).default;

    render(<RequisitionsPage />);

    await waitFor(() => {
      expect(screen.getByText('PR-2024-0001')).toBeInTheDocument();
      expect(screen.getByText('PR-2024-0002')).toBeInTheDocument();
    });
  });

  it('should fetch requisitions on mount', async () => {
    const RequisitionsPage = (await import('@/app/purchasing/requisitions/page')).default;

    render(<RequisitionsPage />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/purchasing/requisitions')
      );
    });
  });

  it('should call API on mount', async () => {
    const RequisitionsPage = (await import('@/app/purchasing/requisitions/page')).default;

    render(<RequisitionsPage />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/purchasing/requisitions?limit=1000');
    });
  });

  it('should handle API error gracefully', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const RequisitionsPage = (await import('@/app/purchasing/requisitions/page')).default;

    render(<RequisitionsPage />);

    await waitFor(() => {
      // Should render page even on error
      expect(screen.getByTestId('page-title')).toBeInTheDocument();
    });
  });
});

describe('Purchase Requisitions Workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/purchasing/requisitions')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: mockRequisitions,
            total: mockRequisitions.length,
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: [] }),
      });
    });
  });

  it('should display different status badges', async () => {
    const RequisitionsPage = (await import('@/app/purchasing/requisitions/page')).default;

    render(<RequisitionsPage />);

    await waitFor(() => {
      // Grid should contain different statuses
      expect(screen.getByText('draft')).toBeInTheDocument();
      expect(screen.getByText('submitted')).toBeInTheDocument();
      expect(screen.getByText('approved')).toBeInTheDocument();
    });
  });
});
