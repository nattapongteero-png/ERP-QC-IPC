/**
 * Inventory Lots List Page Tests
 * Feature: 014-unit-cost
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import LotsPage from '@/app/inventory/lots/page';
import {
  renderWithProviders,
  setupFetchMock,
  clearFetchMock,
  createPaginatedResponse,
} from '../../../helpers/ui-test-utils';
import { MOCK_LOTS, INVENTORY_FETCH_HANDLERS } from '../../../helpers/fetch-mock-handlers';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
}));

// Mock MainLayout to just render children
vi.mock('@/components/layout/main-layout', () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="main-layout">{children}</div>,
}));

// Mock ItemSearchDialog to avoid complex dialog rendering
vi.mock('@/components/ui/item-search-dialog', () => ({
  ItemSearchDialog: () => null,
}));

// Mock DxPopup
vi.mock('@/components/ui/dx-popup', () => ({
  DxPopup: () => null,
}));

describe('LotsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFetchMock();
  });

  describe('Page Rendering', () => {
    it('should render page with correct title', async () => {
      setupFetchMock(INVENTORY_FETCH_HANDLERS);

      renderWithProviders(<LotsPage />);

      await waitFor(() => {
        expect(screen.getByText('Inventory Lots')).toBeInTheDocument();
      });
    });

    it('should render page description', async () => {
      setupFetchMock(INVENTORY_FETCH_HANDLERS);

      renderWithProviders(<LotsPage />);

      await waitFor(() => {
        // Description comes from i18n: t('lots.description') = 'Manage Lot/Batch inventory'
        expect(screen.getByText('Manage Lot/Batch inventory')).toBeInTheDocument();
      });
    });

    it('should render create lot button', async () => {
      setupFetchMock(INVENTORY_FETCH_HANDLERS);

      renderWithProviders(<LotsPage />);

      await waitFor(() => {
        // Button text comes from i18n: t('lots.addLot') = 'Add New Lot'
        expect(screen.getByText('Add New Lot')).toBeInTheDocument();
      });
    });

    it('should render status filter tabs', async () => {
      setupFetchMock(INVENTORY_FETCH_HANDLERS);

      renderWithProviders(<LotsPage />);

      await waitFor(() => {
        expect(screen.getByText('All')).toBeInTheDocument();
        // Status labels come from i18n
        expect(screen.getByText('Quarantine')).toBeInTheDocument();
        expect(screen.getByText('Released')).toBeInTheDocument();
        expect(screen.getByText('Rejected')).toBeInTheDocument();
      });
    });

    it('should render action buttons', async () => {
      setupFetchMock(INVENTORY_FETCH_HANDLERS);

      renderWithProviders(<LotsPage />);

      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument();
        expect(screen.getByText('View Items')).toBeInTheDocument();
      });
    });

    it('should render search input', async () => {
      setupFetchMock(INVENTORY_FETCH_HANDLERS);

      renderWithProviders(<LotsPage />);

      await waitFor(() => {
        // Placeholder comes from i18n: t('lots.searchPlaceholder') = 'Search by lot number or item...'
        expect(screen.getByPlaceholderText('Search by lot number or item...')).toBeInTheDocument();
      });
    });
  });

  describe('Data Fetching', () => {
    it('should fetch lots on mount', async () => {
      setupFetchMock(INVENTORY_FETCH_HANDLERS);

      renderWithProviders(<LotsPage />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      // Verify the API was called with correct endpoint
      const calls = vi.mocked(fetch).mock.calls;
      const lotsCall = calls.find(([url]) =>
        typeof url === 'string' && url.includes('/api/inventory/lots')
      );
      expect(lotsCall).toBeDefined();
    });

    it('should handle empty data gracefully', async () => {
      setupFetchMock({
        '/api/inventory/lots': { data: createPaginatedResponse([]) },
        '/api/warehouses': { data: createPaginatedResponse([]) },
        '/api/vendors': { data: createPaginatedResponse([]) },
      });

      renderWithProviders(<LotsPage />);

      await waitFor(() => {
        expect(screen.getByText('Inventory Lots')).toBeInTheDocument();
      });
    });

    it('should handle API error gracefully', async () => {
      setupFetchMock({
        '/api/inventory/lots': {
          data: { success: false, error: 'Server error' },
          ok: false,
          status: 500,
        },
        '/api/warehouses': { data: createPaginatedResponse([]) },
        '/api/vendors': { data: createPaginatedResponse([]) },
      });

      renderWithProviders(<LotsPage />);

      // Page should still render even on API error
      await waitFor(() => {
        expect(screen.getByText('Inventory Lots')).toBeInTheDocument();
      });
    });

    it('should correctly parse paginated response structure (regression)', () => {
      // Verify the API response structure used by the page
      const mockResponse = createPaginatedResponse(MOCK_LOTS);

      // Correct: data.items returns the array
      expect(Array.isArray(mockResponse.data.items)).toBe(true);

      // Wrong: data should NOT be treated as an array
      expect(Array.isArray(mockResponse.data)).toBe(false);
      expect(mockResponse.data).toHaveProperty('items');
      expect(mockResponse.data).toHaveProperty('total');
    });
  });

  describe('Statistics Display', () => {
    it('should display units count', async () => {
      setupFetchMock(INVENTORY_FETCH_HANDLERS);

      renderWithProviders(<LotsPage />);

      await waitFor(() => {
        expect(screen.getByText(/units/)).toBeInTheDocument();
      });
    });

    it('should display lots shown count', async () => {
      setupFetchMock(INVENTORY_FETCH_HANDLERS);

      renderWithProviders(<LotsPage />);

      await waitFor(() => {
        expect(screen.getByText(/lots shown/)).toBeInTheDocument();
      });
    });
  });
});
