/**
 * Packaging QC Criteria Page Tests
 * Feature: 014-unit-cost
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import PackagingQCCriteriaPage from '@/app/master-data/packaging-qc-criteria/page';
import {
  renderWithProviders,
  setupFetchMock,
  clearFetchMock,
  createSingleResponse,
} from '../../../helpers/ui-test-utils';
import { MOCK_PACKAGING_QC_CRITERIA, MASTER_DATA_FETCH_HANDLERS } from '../../../helpers/fetch-mock-handlers';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Scale: () => <span data-testid="icon-scale" />,
  Package: () => <span data-testid="icon-package" />,
  Eye: () => <span data-testid="icon-eye" />,
  Edit: () => <span data-testid="icon-edit" />,
  Trash2: () => <span data-testid="icon-trash" />,
}));

// Mock shared components
vi.mock('@/components/shared', () => ({
  ResponsivePageHeader: ({ title, subtitle, actions }: { title: string; subtitle: string; actions?: React.ReactNode }) => (
    <div data-testid="responsive-header">
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {actions && <div data-testid="header-actions">{actions}</div>}
    </div>
  ),
}));

// Mock DevExtreme components
vi.mock('@/components/ui/dx-data-grid', () => ({
  DxDataGrid: ({ children }: { children?: React.ReactNode }) => <div data-testid="dx-data-grid">{children}</div>,
  DxColumn: () => null,
  DxPaging: () => null,
  DxSearchPanel: () => null,
}));

vi.mock('@/components/ui/dx-button', () => ({
  DxButton: ({ text, onClick }: { text?: string; onClick?: () => void }) => (
    <button onClick={onClick}>{text}</button>
  ),
}));

// Mock useToast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('PackagingQCCriteriaPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFetchMock();
  });

  describe('Page Rendering', () => {
    it('should render page with correct title', async () => {
      setupFetchMock(MASTER_DATA_FETCH_HANDLERS);

      renderWithProviders(<PackagingQCCriteriaPage />);

      await waitFor(() => {
        expect(screen.getByText('Packaging QC Criteria')).toBeInTheDocument();
      });
    });

    it('should render page subtitle', async () => {
      setupFetchMock(MASTER_DATA_FETCH_HANDLERS);

      renderWithProviders(<PackagingQCCriteriaPage />);

      await waitFor(() => {
        expect(screen.getByText(/packaging quality control criteria/)).toBeInTheDocument();
      });
    });

    it('should render page header component', async () => {
      setupFetchMock(MASTER_DATA_FETCH_HANDLERS);

      renderWithProviders(<PackagingQCCriteriaPage />);

      await waitFor(() => {
        expect(screen.getByTestId('responsive-header')).toBeInTheDocument();
      });
    });

    it('should render Add Criteria button', async () => {
      setupFetchMock(MASTER_DATA_FETCH_HANDLERS);

      renderWithProviders(<PackagingQCCriteriaPage />);

      await waitFor(() => {
        expect(screen.getByText('Add Criteria')).toBeInTheDocument();
      });
    });
  });

  describe('DataGrid', () => {
    it('should render data grid component', async () => {
      setupFetchMock(MASTER_DATA_FETCH_HANDLERS);

      renderWithProviders(<PackagingQCCriteriaPage />);

      await waitFor(() => {
        expect(screen.getByTestId('dx-data-grid')).toBeInTheDocument();
      });
    });
  });

  describe('Data Fetching', () => {
    it('should fetch packaging QC criteria on mount', async () => {
      setupFetchMock(MASTER_DATA_FETCH_HANDLERS);

      renderWithProviders(<PackagingQCCriteriaPage />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      const calls = vi.mocked(fetch).mock.calls;
      const criteriaCall = calls.find(([url]) =>
        typeof url === 'string' && url.includes('/api/master-data/packaging-qc-criteria')
      );
      expect(criteriaCall).toBeDefined();
    });

    it('should handle empty criteria data gracefully', async () => {
      setupFetchMock({
        '/api/master-data/packaging-qc-criteria': { data: createSingleResponse([]) },
      });

      renderWithProviders(<PackagingQCCriteriaPage />);

      await waitFor(() => {
        expect(screen.getByText('Packaging QC Criteria')).toBeInTheDocument();
      });
    });

    it('should handle API error gracefully', async () => {
      setupFetchMock({
        '/api/master-data/packaging-qc-criteria': {
          data: { success: false, error: 'Server error' },
          ok: false,
          status: 500,
        },
      });

      renderWithProviders(<PackagingQCCriteriaPage />);

      // Page should still render header even on API error
      await waitFor(() => {
        expect(screen.getByText('Packaging QC Criteria')).toBeInTheDocument();
      });
    });

    it('should correctly parse API response structure (regression)', () => {
      const criteriaResponse = createSingleResponse(MOCK_PACKAGING_QC_CRITERIA);

      // Correct: data returns the array directly
      expect(Array.isArray(criteriaResponse.data)).toBe(true);
      expect(criteriaResponse.data.length).toBe(MOCK_PACKAGING_QC_CRITERIA.length);
    });
  });
});
