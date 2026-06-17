/**
 * Approval Workflows Page Tests
 * Feature: 014-unit-cost
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import ApprovalWorkflowsPage from '@/app/settings/approval-workflows/page';
import {
  renderWithProviders,
  setupFetchMock,
  clearFetchMock,
  createSingleResponse,
} from '../../../helpers/ui-test-utils';
import { SETTINGS_FETCH_HANDLERS, MOCK_APPROVAL_WORKFLOWS } from '../../../helpers/fetch-mock-handlers';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
}));

// Mock lucide-react icons (Proxy returns a stub for ANY icon name)
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

// Mock DevExtreme DataGrid - pass through data-testid
vi.mock('devextreme-react/data-grid', () => ({
  default: ({ children, ...props }: { children?: React.ReactNode; 'data-testid'?: string }) => (
    <div data-testid={props['data-testid'] || 'dx-data-grid'}>{children}</div>
  ),
  Column: () => null,
  Paging: () => null,
  Pager: () => null,
  FilterRow: () => null,
  Sorting: () => null,
  HeaderFilter: () => null,
  LoadPanel: () => null,
}));

// Mock DevExtreme Button - pass through data-testid
vi.mock('devextreme-react/button', () => ({
  Button: ({ text, onClick, icon, ...props }: { text?: string; onClick?: () => void; icon?: string; 'data-testid'?: string }) => (
    <button onClick={onClick} data-testid={props['data-testid'] || `dx-button-${text?.replace(/\s+/g, '-')?.toLowerCase() || icon || 'unnamed'}`}>{text}</button>
  ),
}));

// Mock DevExtreme SelectBox - pass through data-testid
vi.mock('devextreme-react/select-box', () => ({
  default: (props: { 'data-testid'?: string }) => <select data-testid={props['data-testid'] || 'dx-select-box'} />,
}));

// Mock DevExtreme TextBox - pass through data-testid
vi.mock('devextreme-react/text-box', () => ({
  default: (props: { 'data-testid'?: string }) => <input data-testid={props['data-testid'] || 'dx-text-box'} />,
}));

// Mock DevExtreme notify
vi.mock('devextreme/ui/notify', () => ({
  default: vi.fn(),
}));

// Mock Card components
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
  CardContent: ({ children }: { children?: React.ReactNode }) => <div data-testid="card-content">{children}</div>,
}));

describe('ApprovalWorkflowsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFetchMock();
  });

  describe('Page Rendering', () => {
    it('should render page with correct title', async () => {
      setupFetchMock(SETTINGS_FETCH_HANDLERS);

      renderWithProviders(<ApprovalWorkflowsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('page-title')).toHaveTextContent('Approval Workflows');
      });
    });

    it('should render page subtitle', async () => {
      setupFetchMock(SETTINGS_FETCH_HANDLERS);

      renderWithProviders(<ApprovalWorkflowsPage />);

      await waitFor(() => {
        expect(screen.getByText(/Manage approval workflows/)).toBeInTheDocument();
      });
    });

    it('should render New Workflow button', async () => {
      setupFetchMock(SETTINGS_FETCH_HANDLERS);

      renderWithProviders(<ApprovalWorkflowsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('new-workflow-btn')).toBeInTheDocument();
      });
    });

    it('should render Refresh button', async () => {
      setupFetchMock(SETTINGS_FETCH_HANDLERS);

      renderWithProviders(<ApprovalWorkflowsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('refresh-btn')).toBeInTheDocument();
      });
    });
  });

  describe('DataGrid', () => {
    it('should render data grid component', async () => {
      setupFetchMock(SETTINGS_FETCH_HANDLERS);

      renderWithProviders(<ApprovalWorkflowsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('workflows-grid')).toBeInTheDocument();
      });
    });
  });

  describe('Filters', () => {
    it('should render Filters label', async () => {
      setupFetchMock(SETTINGS_FETCH_HANDLERS);

      renderWithProviders(<ApprovalWorkflowsPage />);

      await waitFor(() => {
        expect(screen.getByText('Filters:')).toBeInTheDocument();
      });
    });

    it('should render search input', async () => {
      setupFetchMock(SETTINGS_FETCH_HANDLERS);

      renderWithProviders(<ApprovalWorkflowsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('search-input')).toBeInTheDocument();
      });
    });

    it('should render document type filter', async () => {
      setupFetchMock(SETTINGS_FETCH_HANDLERS);

      renderWithProviders(<ApprovalWorkflowsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('document-type-filter')).toBeInTheDocument();
      });
    });

    it('should render status filter', async () => {
      setupFetchMock(SETTINGS_FETCH_HANDLERS);

      renderWithProviders(<ApprovalWorkflowsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('status-filter')).toBeInTheDocument();
      });
    });
  });

  describe('Statistics', () => {
    it('should render Total stat', async () => {
      setupFetchMock(SETTINGS_FETCH_HANDLERS);

      renderWithProviders(<ApprovalWorkflowsPage />);

      await waitFor(() => {
        expect(screen.getByText('Total:')).toBeInTheDocument();
      });
    });

    it('should render Active stat', async () => {
      setupFetchMock(SETTINGS_FETCH_HANDLERS);

      renderWithProviders(<ApprovalWorkflowsPage />);

      await waitFor(() => {
        expect(screen.getByText('Active:')).toBeInTheDocument();
      });
    });

    it('should render Inactive stat', async () => {
      setupFetchMock(SETTINGS_FETCH_HANDLERS);

      renderWithProviders(<ApprovalWorkflowsPage />);

      await waitFor(() => {
        expect(screen.getByText('Inactive:')).toBeInTheDocument();
      });
    });
  });

  describe('Data Fetching', () => {
    it('should fetch approval workflows on mount', async () => {
      setupFetchMock(SETTINGS_FETCH_HANDLERS);

      renderWithProviders(<ApprovalWorkflowsPage />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      const calls = vi.mocked(fetch).mock.calls;
      const workflowsCall = calls.find(([url]) =>
        typeof url === 'string' && url.includes('/api/settings/approval-flows')
      );
      expect(workflowsCall).toBeDefined();
    });

    it('should handle empty data gracefully', async () => {
      setupFetchMock({
        '/api/settings/approval-flows': { data: createSingleResponse([]) },
      });

      renderWithProviders(<ApprovalWorkflowsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('page-title')).toHaveTextContent('Approval Workflows');
      });
    });

    it('should handle API error gracefully', async () => {
      setupFetchMock({
        '/api/settings/approval-flows': {
          data: { success: false, error: 'Server error' },
          ok: false,
          status: 500,
        },
      });

      renderWithProviders(<ApprovalWorkflowsPage />);

      // Page should still render even on API error
      await waitFor(() => {
        expect(screen.getByTestId('page-title')).toHaveTextContent('Approval Workflows');
      });
    });

    it('should correctly parse API response structure (regression)', () => {
      const workflowsResponse = createSingleResponse(MOCK_APPROVAL_WORKFLOWS);

      // Single response returns array directly
      expect(Array.isArray(workflowsResponse.data)).toBe(true);
      expect(workflowsResponse.data.length).toBe(MOCK_APPROVAL_WORKFLOWS.length);
    });
  });
});
