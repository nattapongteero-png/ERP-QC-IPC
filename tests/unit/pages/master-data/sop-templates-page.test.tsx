/**
 * SOP Templates Page Tests
 * Feature: 014-unit-cost
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import SOPTemplatesPage from '@/app/master-data/sop-templates/page';
import {
  renderWithProviders,
  setupFetchMock,
  clearFetchMock,
  createSingleResponse,
} from '../../../helpers/ui-test-utils';
import { MOCK_SOP_TEMPLATES, MASTER_DATA_FETCH_HANDLERS } from '../../../helpers/fetch-mock-handlers';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  FileText: () => <span data-testid="icon-filetext" />,
  ClipboardList: () => <span data-testid="icon-clipboard" />,
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

describe('SOPTemplatesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFetchMock();
  });

  describe('Page Rendering', () => {
    it('should render page with correct title', async () => {
      setupFetchMock(MASTER_DATA_FETCH_HANDLERS);

      renderWithProviders(<SOPTemplatesPage />);

      await waitFor(() => {
        expect(screen.getByText('SOP Templates')).toBeInTheDocument();
      });
    });

    it('should render page subtitle', async () => {
      setupFetchMock(MASTER_DATA_FETCH_HANDLERS);

      renderWithProviders(<SOPTemplatesPage />);

      await waitFor(() => {
        expect(screen.getByText(/SOP step templates/)).toBeInTheDocument();
      });
    });

    it('should render page header component', async () => {
      setupFetchMock(MASTER_DATA_FETCH_HANDLERS);

      renderWithProviders(<SOPTemplatesPage />);

      await waitFor(() => {
        expect(screen.getByTestId('responsive-header')).toBeInTheDocument();
      });
    });

    it('should render Add Template button', async () => {
      setupFetchMock(MASTER_DATA_FETCH_HANDLERS);

      renderWithProviders(<SOPTemplatesPage />);

      await waitFor(() => {
        expect(screen.getByText('Add Template')).toBeInTheDocument();
      });
    });
  });

  describe('DataGrid', () => {
    it('should render data grid component', async () => {
      setupFetchMock(MASTER_DATA_FETCH_HANDLERS);

      renderWithProviders(<SOPTemplatesPage />);

      await waitFor(() => {
        expect(screen.getByTestId('dx-data-grid')).toBeInTheDocument();
      });
    });
  });

  describe('Data Fetching', () => {
    it('should fetch SOP templates on mount', async () => {
      setupFetchMock(MASTER_DATA_FETCH_HANDLERS);

      renderWithProviders(<SOPTemplatesPage />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      const calls = vi.mocked(fetch).mock.calls;
      const templatesCall = calls.find(([url]) =>
        typeof url === 'string' && url.includes('/api/master-data/sop-templates')
      );
      expect(templatesCall).toBeDefined();
    });

    it('should handle empty templates data gracefully', async () => {
      setupFetchMock({
        '/api/master-data/sop-templates': { data: createSingleResponse([]) },
      });

      renderWithProviders(<SOPTemplatesPage />);

      await waitFor(() => {
        expect(screen.getByText('SOP Templates')).toBeInTheDocument();
      });
    });

    it('should handle API error gracefully', async () => {
      setupFetchMock({
        '/api/master-data/sop-templates': {
          data: { success: false, error: 'Server error' },
          ok: false,
          status: 500,
        },
      });

      renderWithProviders(<SOPTemplatesPage />);

      // Page should still render header even on API error
      await waitFor(() => {
        expect(screen.getByText('SOP Templates')).toBeInTheDocument();
      });
    });

    it('should correctly parse API response structure (regression)', () => {
      const templatesResponse = createSingleResponse(MOCK_SOP_TEMPLATES);

      // Correct: data returns the array directly
      expect(Array.isArray(templatesResponse.data)).toBe(true);
      expect(templatesResponse.data.length).toBe(MOCK_SOP_TEMPLATES.length);
    });
  });
});
