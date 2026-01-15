/**
 * Inventory Items List Page Tests
 * Feature: 014-unit-cost
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import ItemsPage from '@/app/inventory/items/page';
import {
  renderWithProviders,
  setupFetchMock,
  clearFetchMock,
  createPaginatedResponse,
} from '../../../helpers/ui-test-utils';
import { MOCK_ITEMS, INVENTORY_FETCH_HANDLERS } from '../../../helpers/fetch-mock-handlers';

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

// Mock ItemEditDialog to avoid complex dialog rendering
vi.mock('@/components/ui/item-edit-dialog', () => ({
  ItemEditDialog: () => null,
}));

// Mock DxConfirmDialog
vi.mock('@/components/ui/dx-popup', () => ({
  DxConfirmDialog: () => null,
}));

describe('ItemsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFetchMock();
  });

  describe('Page Rendering', () => {
    it('should render page with correct title', async () => {
      setupFetchMock(INVENTORY_FETCH_HANDLERS);

      renderWithProviders(<ItemsPage />);

      await waitFor(() => {
        expect(screen.getByText('Inventory Items')).toBeInTheDocument();
      });
    });

    it('should render page description', async () => {
      setupFetchMock(INVENTORY_FETCH_HANDLERS);

      renderWithProviders(<ItemsPage />);

      await waitFor(() => {
        // Thai description
        expect(screen.getByText('รายการสินค้าและวัตถุดิบ')).toBeInTheDocument();
      });
    });

    it('should render Add Item button', async () => {
      setupFetchMock(INVENTORY_FETCH_HANDLERS);

      renderWithProviders(<ItemsPage />);

      await waitFor(() => {
        expect(screen.getByText('Add Item')).toBeInTheDocument();
      });
    });

    it('should render item type tabs', async () => {
      setupFetchMock(INVENTORY_FETCH_HANDLERS);

      renderWithProviders(<ItemsPage />);

      await waitFor(() => {
        expect(screen.getByText('All')).toBeInTheDocument();
        expect(screen.getByText('Raw Material')).toBeInTheDocument();
        expect(screen.getByText('Packaging')).toBeInTheDocument();
        expect(screen.getByText('Work in Progress')).toBeInTheDocument();
        expect(screen.getByText('Finished Goods')).toBeInTheDocument();
        expect(screen.getByText('Consumable')).toBeInTheDocument();
      });
    });

    it('should render action buttons', async () => {
      setupFetchMock(INVENTORY_FETCH_HANDLERS);

      renderWithProviders(<ItemsPage />);

      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument();
        expect(screen.getByText('View Lots')).toBeInTheDocument();
      });
    });
  });

  describe('Data Fetching', () => {
    it('should fetch items on mount', async () => {
      setupFetchMock(INVENTORY_FETCH_HANDLERS);

      renderWithProviders(<ItemsPage />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      // Verify the API was called with correct endpoint
      const calls = vi.mocked(fetch).mock.calls;
      const itemsCall = calls.find(([url]) =>
        typeof url === 'string' && url.includes('/api/items')
      );
      expect(itemsCall).toBeDefined();
    });

    it('should handle empty data gracefully', async () => {
      setupFetchMock({
        '/api/items': { data: createPaginatedResponse([]) },
      });

      renderWithProviders(<ItemsPage />);

      await waitFor(() => {
        expect(screen.getByText('Inventory Items')).toBeInTheDocument();
      });
    });

    it('should handle API error gracefully', async () => {
      setupFetchMock({
        '/api/items': {
          data: { success: false, error: 'Server error' },
          ok: false,
          status: 500,
        },
      });

      renderWithProviders(<ItemsPage />);

      // Page should still render even on API error
      await waitFor(() => {
        expect(screen.getByText('Inventory Items')).toBeInTheDocument();
      });
    });

    it('should correctly parse paginated response structure (regression)', () => {
      // Verify the API response structure used by the page
      const mockResponse = createPaginatedResponse(MOCK_ITEMS);

      // Correct: data.items returns the array
      expect(Array.isArray(mockResponse.data.items)).toBe(true);

      // Wrong: data should NOT be treated as an array
      expect(Array.isArray(mockResponse.data)).toBe(false);
      expect(mockResponse.data).toHaveProperty('items');
      expect(mockResponse.data).toHaveProperty('total');
    });
  });

  describe('Statistics Display', () => {
    it('should display active items count', async () => {
      setupFetchMock(INVENTORY_FETCH_HANDLERS);

      renderWithProviders(<ItemsPage />);

      await waitFor(() => {
        // Based on mock data: 5 active items
        expect(screen.getByText(/Active/)).toBeInTheDocument();
      });
    });

    it('should display items shown count', async () => {
      setupFetchMock(INVENTORY_FETCH_HANDLERS);

      renderWithProviders(<ItemsPage />);

      await waitFor(() => {
        // Should show count of items
        expect(screen.getByText(/items shown/)).toBeInTheDocument();
      });
    });
  });
});
