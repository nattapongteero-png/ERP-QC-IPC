/**
 * BOM (Bill of Materials) Dashboard Page Tests
 * Feature: 014-unit-cost
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import BOMDashboardPage from '@/app/production/bom/page';
import {
  renderWithProviders,
  setupFetchMock,
  clearFetchMock,
  createPaginatedResponse,
  createSingleResponse,
} from '../../../helpers/ui-test-utils';
import { MOCK_BOMS, MOCK_BOM_DASHBOARD, PRODUCTION_FETCH_HANDLERS } from '../../../helpers/fetch-mock-handlers';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
}));

// Mock MainLayout
vi.mock('@/components/layout/main-layout', () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="main-layout">{children}</div>,
}));

// Mock DevExtreme PieChart
vi.mock('devextreme-react/pie-chart', () => ({
  __esModule: true,
  default: ({ children }: { children?: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  Series: () => null,
  Label: () => null,
  Legend: () => null,
  Tooltip: () => null,
  Connector: () => null,
}));

describe('BOMDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFetchMock();
  });

  describe('Page Rendering', () => {
    it('should render page with correct title', async () => {
      setupFetchMock(PRODUCTION_FETCH_HANDLERS);

      renderWithProviders(<BOMDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Bill of Materials (BOM)')).toBeInTheDocument();
      });
    });

    it('should render page subtitle', async () => {
      setupFetchMock(PRODUCTION_FETCH_HANDLERS);

      renderWithProviders(<BOMDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Manufacturing recipes and component management')).toBeInTheDocument();
      });
    });

    it('should render Create New BOM button', async () => {
      setupFetchMock(PRODUCTION_FETCH_HANDLERS);

      renderWithProviders(<BOMDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Create New BOM')).toBeInTheDocument();
      });
    });

    it('should render status tabs', async () => {
      setupFetchMock(PRODUCTION_FETCH_HANDLERS);

      renderWithProviders(<BOMDashboardPage />);

      await waitFor(() => {
        // Tab labels include counts in format "All (X)"
        expect(screen.getByRole('tab', { name: /All/ })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /Approved/ })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /Draft/ })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /Obsolete/ })).toBeInTheDocument();
      });
    });
  });

  describe('Statistics Display', () => {
    it('should display stat cards', async () => {
      setupFetchMock(PRODUCTION_FETCH_HANDLERS);

      renderWithProviders(<BOMDashboardPage />);

      await waitFor(() => {
        // Primary KPI cards (soft-tinted, clickable to filter the registry).
        // The "active" card is now labelled "Approved" (matches the tab/status).
        expect(screen.getByText('Total BOMs')).toBeInTheDocument();
        expect(screen.getAllByText('Approved').length).toBeGreaterThan(0);
        expect(screen.getByText('Draft BOMs')).toBeInTheDocument();
        // "Obsolete" appears both as a KPI card and a filter tab.
        expect(screen.getAllByText('Obsolete').length).toBeGreaterThan(0);
      });
    });

    it('should display secondary stat cards', async () => {
      setupFetchMock(PRODUCTION_FETCH_HANDLERS);

      renderWithProviders(<BOMDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Materials')).toBeInTheDocument();
        expect(screen.getByText('Avg/BOM')).toBeInTheDocument();
        expect(screen.getByText('Obsolete')).toBeInTheDocument();
      });
    });
  });

  describe('Data Fetching', () => {
    it('should fetch BOM dashboard on mount', async () => {
      setupFetchMock(PRODUCTION_FETCH_HANDLERS);

      renderWithProviders(<BOMDashboardPage />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      // Verify the API was called with correct endpoint
      const calls = vi.mocked(fetch).mock.calls;
      const dashboardCall = calls.find(([url]) =>
        typeof url === 'string' && url.includes('/api/bom/dashboard')
      );
      expect(dashboardCall).toBeDefined();
    });

    it('should fetch BOM list on mount', async () => {
      setupFetchMock(PRODUCTION_FETCH_HANDLERS);

      renderWithProviders(<BOMDashboardPage />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      // Verify the API was called with correct endpoint
      const calls = vi.mocked(fetch).mock.calls;
      const bomCall = calls.find(([url]) =>
        typeof url === 'string' && url.includes('/api/bom')
      );
      expect(bomCall).toBeDefined();
    });

    it('should handle empty dashboard data gracefully', async () => {
      setupFetchMock({
        '/api/bom/dashboard': { data: createSingleResponse({
          totalBOMs: 0,
          activeBOMs: 0,
          draftBOMs: 0,
          obsoleteBOMs: 0,
          activeWorkOrders: 0,
          totalMaterials: 0,
          avgMaterialsPerBOM: 0,
          byStatus: {},
          topProducts: [],
          recentBOMs: [],
        }) },
        '/api/bom': { data: createPaginatedResponse([]) },
      });

      renderWithProviders(<BOMDashboardPage />);

      await waitFor(() => {
        // Multiple elements may contain BOM text
        expect(screen.getAllByText('Bill of Materials (BOM)').length).toBeGreaterThan(0);
      });
    });

    it('should handle API error gracefully', async () => {
      setupFetchMock({
        '/api/bom/dashboard': {
          data: { success: false, error: 'Server error' },
          ok: false,
          status: 500,
        },
        '/api/bom': {
          data: { success: false, error: 'Server error' },
          ok: false,
          status: 500,
        },
      });

      renderWithProviders(<BOMDashboardPage />);

      // Page should still render even on API error
      await waitFor(() => {
        expect(screen.getAllByText('Bill of Materials (BOM)').length).toBeGreaterThan(0);
      });
    });

    it('should correctly parse paginated response structure (regression)', () => {
      // Verify the API response structure used by the page
      const mockResponse = createPaginatedResponse(MOCK_BOMS);

      // Correct: data.items returns the array
      expect(Array.isArray(mockResponse.data.items)).toBe(true);

      // Wrong: data should NOT be treated as an array
      expect(Array.isArray(mockResponse.data)).toBe(false);
      expect(mockResponse.data).toHaveProperty('items');
      expect(mockResponse.data).toHaveProperty('total');
    });
  });

  describe('Dashboard Sections', () => {
    it('should render Status Distribution chart section', async () => {
      setupFetchMock(PRODUCTION_FETCH_HANDLERS);

      renderWithProviders(<BOMDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Status Distribution')).toBeInTheDocument();
      });
    });

    it('should render Top Products section', async () => {
      setupFetchMock(PRODUCTION_FETCH_HANDLERS);

      renderWithProviders(<BOMDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Top Products')).toBeInTheDocument();
      });
    });

    it('should render Recent BOMs section', async () => {
      setupFetchMock(PRODUCTION_FETCH_HANDLERS);

      renderWithProviders(<BOMDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Recent BOMs')).toBeInTheDocument();
      });
    });

    it('should render BOM Registry section', async () => {
      setupFetchMock(PRODUCTION_FETCH_HANDLERS);

      renderWithProviders(<BOMDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('BOM Registry')).toBeInTheDocument();
      });
    });
  });

  describe('Alerts Section', () => {
    it('should conditionally show pending review alert based on draft BOMs', async () => {
      // Test with data that has draft BOMs
      setupFetchMock({
        '/api/bom/dashboard': { data: createSingleResponse({
          ...MOCK_BOM_DASHBOARD,
          draftBOMs: 2, // Ensure there are draft BOMs
        }) },
        '/api/bom': { data: createPaginatedResponse(MOCK_BOMS) },
      });

      renderWithProviders(<BOMDashboardPage />);

      // Wait for page to load
      await waitFor(() => {
        expect(screen.getAllByText('Bill of Materials (BOM)').length).toBeGreaterThan(0);
      });

      // Check if Pending Review appears (may take time for dashboard data to load)
      await waitFor(() => {
        expect(screen.queryByText('Pending Review')).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should not show alert when no draft BOMs', async () => {
      setupFetchMock({
        '/api/bom/dashboard': { data: createSingleResponse({
          ...MOCK_BOM_DASHBOARD,
          draftBOMs: 0,
        }) },
        '/api/bom': { data: createPaginatedResponse(MOCK_BOMS) },
      });

      renderWithProviders(<BOMDashboardPage />);

      await waitFor(() => {
        expect(screen.getAllByText('Bill of Materials (BOM)').length).toBeGreaterThan(0);
      });

      // Wait a bit for dashboard data to load then verify
      await new Promise(resolve => setTimeout(resolve, 500));

      // Pending Review should not appear
      expect(screen.queryByText('Pending Review')).not.toBeInTheDocument();
    });
  });
});
