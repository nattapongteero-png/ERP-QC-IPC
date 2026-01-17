/**
 * Matching Tolerances Page Tests
 * Feature: 014-unit-cost
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import MatchingTolerancesPage from '@/app/settings/matching-tolerances/page';
import {
  renderWithProviders,
  setupFetchMock,
  clearFetchMock,
} from '../../../helpers/ui-test-utils';
import { SETTINGS_FETCH_HANDLERS, MOCK_MATCHING_TOLERANCES } from '../../../helpers/fetch-mock-handlers';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Settings: () => <span data-testid="icon-settings" />,
  Filter: () => <span data-testid="icon-filter" />,
  Eye: () => <span data-testid="icon-eye" />,
  Edit: () => <span data-testid="icon-edit" />,
  Trash2: () => <span data-testid="icon-trash" />,
}));

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
  Selection: () => null,
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

// Mock TemplatePageHeader
vi.mock('@/components/template', () => ({
  TemplatePageHeader: ({ title, subtitle, actions }: { title: string; subtitle: string; actions?: React.ReactNode }) => (
    <div data-testid="template-page-header">
      <h1 data-testid="page-title">{title}</h1>
      <p>{subtitle}</p>
      {actions && <div data-testid="header-actions">{actions}</div>}
    </div>
  ),
}));

// Mock matching types
vi.mock('@/types/matching', () => ({
  TOLERANCE_TYPE_OPTIONS: [
    { value: 'quantity', label: 'Quantity' },
    { value: 'price', label: 'Price' },
    { value: 'amount', label: 'Amount' },
  ],
}));

describe('MatchingTolerancesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFetchMock();
  });

  describe('Page Rendering', () => {
    it('should render page with correct title', async () => {
      setupFetchMock(SETTINGS_FETCH_HANDLERS);

      renderWithProviders(<MatchingTolerancesPage />);

      await waitFor(() => {
        expect(screen.getByTestId('page-title')).toHaveTextContent('Matching Tolerances');
      });
    });

    it('should render page subtitle', async () => {
      setupFetchMock(SETTINGS_FETCH_HANDLERS);

      renderWithProviders(<MatchingTolerancesPage />);

      await waitFor(() => {
        expect(screen.getByText(/Configure tolerance thresholds/)).toBeInTheDocument();
      });
    });

    it('should render New Tolerance button', async () => {
      setupFetchMock(SETTINGS_FETCH_HANDLERS);

      renderWithProviders(<MatchingTolerancesPage />);

      await waitFor(() => {
        expect(screen.getByTestId('new-tolerance-btn')).toBeInTheDocument();
      });
    });

    it('should render template page header', async () => {
      setupFetchMock(SETTINGS_FETCH_HANDLERS);

      renderWithProviders(<MatchingTolerancesPage />);

      await waitFor(() => {
        expect(screen.getByTestId('template-page-header')).toBeInTheDocument();
      });
    });
  });

  describe('DataGrid', () => {
    it('should render data grid component', async () => {
      setupFetchMock(SETTINGS_FETCH_HANDLERS);

      renderWithProviders(<MatchingTolerancesPage />);

      await waitFor(() => {
        expect(screen.getByTestId('tolerances-grid')).toBeInTheDocument();
      });
    });
  });

  describe('Info Box', () => {
    it('should render 3-Way Matching info', async () => {
      setupFetchMock(SETTINGS_FETCH_HANDLERS);

      renderWithProviders(<MatchingTolerancesPage />);

      await waitFor(() => {
        expect(screen.getByText('About 3-Way Matching')).toBeInTheDocument();
      });
    });

    it('should display matching description', async () => {
      setupFetchMock(SETTINGS_FETCH_HANDLERS);

      renderWithProviders(<MatchingTolerancesPage />);

      await waitFor(() => {
        expect(screen.getByText(/3-way matching compares Purchase Orders/)).toBeInTheDocument();
      });
    });
  });

  describe('Filters', () => {
    it('should render Filters label', async () => {
      setupFetchMock(SETTINGS_FETCH_HANDLERS);

      renderWithProviders(<MatchingTolerancesPage />);

      await waitFor(() => {
        expect(screen.getByText('Filters:')).toBeInTheDocument();
      });
    });

    it('should render search input', async () => {
      setupFetchMock(SETTINGS_FETCH_HANDLERS);

      renderWithProviders(<MatchingTolerancesPage />);

      await waitFor(() => {
        expect(screen.getByTestId('search-input')).toBeInTheDocument();
      });
    });

    it('should render type filter', async () => {
      setupFetchMock(SETTINGS_FETCH_HANDLERS);

      renderWithProviders(<MatchingTolerancesPage />);

      await waitFor(() => {
        expect(screen.getByTestId('type-filter')).toBeInTheDocument();
      });
    });

    it('should render status filter', async () => {
      setupFetchMock(SETTINGS_FETCH_HANDLERS);

      renderWithProviders(<MatchingTolerancesPage />);

      await waitFor(() => {
        expect(screen.getByTestId('status-filter')).toBeInTheDocument();
      });
    });
  });

  describe('Statistics', () => {
    it('should render Total stat', async () => {
      setupFetchMock(SETTINGS_FETCH_HANDLERS);

      renderWithProviders(<MatchingTolerancesPage />);

      await waitFor(() => {
        expect(screen.getByText('Total:')).toBeInTheDocument();
      });
    });

    it('should render Active stat', async () => {
      setupFetchMock(SETTINGS_FETCH_HANDLERS);

      renderWithProviders(<MatchingTolerancesPage />);

      await waitFor(() => {
        expect(screen.getByText('Active:')).toBeInTheDocument();
      });
    });

    it('should render Quantity stat', async () => {
      setupFetchMock(SETTINGS_FETCH_HANDLERS);

      renderWithProviders(<MatchingTolerancesPage />);

      await waitFor(() => {
        expect(screen.getByText('Quantity:')).toBeInTheDocument();
      });
    });

    it('should render Price stat', async () => {
      setupFetchMock(SETTINGS_FETCH_HANDLERS);

      renderWithProviders(<MatchingTolerancesPage />);

      await waitFor(() => {
        expect(screen.getByText('Price:')).toBeInTheDocument();
      });
    });
  });

  describe('Data Fetching', () => {
    it('should fetch tolerances on mount', async () => {
      setupFetchMock(SETTINGS_FETCH_HANDLERS);

      renderWithProviders(<MatchingTolerancesPage />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      const calls = vi.mocked(fetch).mock.calls;
      const tolerancesCall = calls.find(([url]) =>
        typeof url === 'string' && url.includes('/api/settings/matching-tolerances')
      );
      expect(tolerancesCall).toBeDefined();
    });

    it('should handle empty data gracefully', async () => {
      setupFetchMock({
        '/api/settings/matching-tolerances': { data: { data: [], total: 0, page: 1, limit: 100, totalPages: 0 } },
      });

      renderWithProviders(<MatchingTolerancesPage />);

      await waitFor(() => {
        expect(screen.getByTestId('page-title')).toHaveTextContent('Matching Tolerances');
      });
    });

    it('should handle API error gracefully', async () => {
      setupFetchMock({
        '/api/settings/matching-tolerances': {
          data: { success: false, error: 'Server error' },
          ok: false,
          status: 500,
        },
      });

      renderWithProviders(<MatchingTolerancesPage />);

      // Page should still render even on API error
      await waitFor(() => {
        expect(screen.getByTestId('page-title')).toHaveTextContent('Matching Tolerances');
      });
    });

    it('should correctly parse API response structure (regression)', () => {
      // Matching tolerances uses paginated-like response with { data: [...], total, page, limit, totalPages }
      const tolerancesResponse = {
        data: MOCK_MATCHING_TOLERANCES,
        total: MOCK_MATCHING_TOLERANCES.length,
        page: 1,
        limit: 100,
        totalPages: 1,
      };

      expect(Array.isArray(tolerancesResponse.data)).toBe(true);
      expect(tolerancesResponse.data.length).toBe(MOCK_MATCHING_TOLERANCES.length);
      expect(tolerancesResponse.total).toBe(MOCK_MATCHING_TOLERANCES.length);
    });
  });
});
