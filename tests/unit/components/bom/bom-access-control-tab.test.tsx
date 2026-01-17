/**
 * BOMAccessControlTab Component Tests
 * Feature: 014-unit-cost - BOM Confidentiality Protection
 *
 * Note: These tests focus on verifiable behavior.
 * DevExtreme DataGrid interactions are tested via E2E tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock DevExtreme notify
vi.mock('devextreme/ui/notify', () => ({
  default: vi.fn(),
}));

// Mock DevExtreme DataGrid to simplify testing
vi.mock('devextreme-react/data-grid', () => ({
  default: ({ noDataText }: { noDataText?: string; children?: React.ReactNode }) => (
    <div data-testid="mock-datagrid">{noDataText}</div>
  ),
  Column: () => null,
  Paging: () => null,
  Pager: () => null,
  FilterRow: () => null,
  Sorting: () => null,
  HeaderFilter: () => null,
  LoadPanel: () => null,
}));

// Mock DevExtreme Button with data-testid passthrough
vi.mock('devextreme-react/button', () => ({
  Button: ({ text, onClick, disabled, 'data-testid': testId }: { text: string; onClick?: () => void; disabled?: boolean; 'data-testid'?: string }) => (
    <button onClick={onClick} disabled={disabled} data-testid={testId || `dx-button-${text?.toLowerCase().replace(/\s+/g, '-')}`}>
      {text}
    </button>
  ),
}));

// Mock DevExtreme SelectBox
vi.mock('devextreme-react/select-box', () => ({
  default: () => <div data-testid="mock-selectbox">SelectBox</div>,
}));

// Mock DxPopup and DxConfirmDialog
vi.mock('@/components/ui/dx-popup', () => ({
  DxPopup: () => null,
  DxConfirmDialog: () => null,
}));

// Create wrapper with query client
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

// Setup fetch mock
function setupFetchMock(accessGrants: unknown[] = []) {
  global.fetch = vi.fn().mockImplementation((url: string) => {
    const urlStr = url.toString();

    if (urlStr.includes('/api/bom/') && urlStr.includes('/access')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: accessGrants }),
      });
    }
    if (urlStr.includes('/api/users')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          data: [
            { id: 10, name: 'John Doe', email: 'john@example.com' },
            { id: 11, name: 'Jane Smith', email: 'jane@example.com' },
          ],
        }),
      });
    }
    if (urlStr.includes('/api/admin/confidential-groups')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          data: [
            { id: 5, code: 'RND_TEAM', name: 'R&D Team' },
          ],
        }),
      });
    }

    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });
  });
}

describe('BOMAccessControlTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Component Structure', () => {
    it('should render access control header', async () => {
      setupFetchMock([]);

      const { BOMAccessControlTab } = await import('@/components/bom/BOMAccessControlTab');

      render(<BOMAccessControlTab bomId={1} canManage={true} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByText('Access Control')).toBeInTheDocument();
      });
    });

    it('should render add user button when canManage is true', async () => {
      setupFetchMock([]);

      const { BOMAccessControlTab } = await import('@/components/bom/BOMAccessControlTab');

      render(<BOMAccessControlTab bomId={1} canManage={true} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByTestId('add-user-access-btn')).toBeInTheDocument();
      });
    });

    it('should render add group button when canManage is true', async () => {
      setupFetchMock([]);

      const { BOMAccessControlTab } = await import('@/components/bom/BOMAccessControlTab');

      render(<BOMAccessControlTab bomId={1} canManage={true} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByTestId('add-group-access-btn')).toBeInTheDocument();
      });
    });

    it('should hide add buttons when canManage is false', async () => {
      setupFetchMock([]);

      const { BOMAccessControlTab } = await import('@/components/bom/BOMAccessControlTab');

      render(<BOMAccessControlTab bomId={1} canManage={false} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByText('Access Control')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('add-user-access-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('add-group-access-btn')).not.toBeInTheDocument();
    });

    it('should show read-only message when canManage is false', async () => {
      setupFetchMock([]);

      const { BOMAccessControlTab } = await import('@/components/bom/BOMAccessControlTab');

      render(<BOMAccessControlTab bomId={1} canManage={false} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByText(/cannot modify/i)).toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('should show no access grants message when empty', async () => {
      setupFetchMock([]);

      const { BOMAccessControlTab } = await import('@/components/bom/BOMAccessControlTab');

      render(<BOMAccessControlTab bomId={1} canManage={true} />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(screen.getByText(/No access grants configured/i)).toBeInTheDocument();
      });
    });
  });

  describe('Props Validation', () => {
    it('should accept bomId and canManage props', async () => {
      setupFetchMock([]);

      const { BOMAccessControlTab } = await import('@/components/bom/BOMAccessControlTab');

      // Should not throw
      const { unmount } = render(
        <BOMAccessControlTab bomId={123} canManage={true} />,
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(screen.getByText('Access Control')).toBeInTheDocument();
      });

      unmount();
    });
  });
});
