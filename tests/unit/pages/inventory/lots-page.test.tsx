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
        // Thai description
        expect(screen.getByText('จัดการ Lot/Batch สินค้าคงคลัง')).toBeInTheDocument();
      });
    });

    it('should render create lot button', async () => {
      setupFetchMock(INVENTORY_FETCH_HANDLERS);

      renderWithProviders(<LotsPage />);

      await waitFor(() => {
        // Thai text for "Create New Lot"
        expect(screen.getByText('รับ Lot ใหม่')).toBeInTheDocument();
      });
    });

    it('should render status filter tabs', async () => {
      setupFetchMock(INVENTORY_FETCH_HANDLERS);

      renderWithProviders(<LotsPage />);

      await waitFor(() => {
        expect(screen.getByText('All')).toBeInTheDocument();
        // Thai status labels
        expect(screen.getByText('กักกัน')).toBeInTheDocument(); // Quarantine
        expect(screen.getByText('ปล่อยแล้ว')).toBeInTheDocument(); // Released
        expect(screen.getByText('ปฏิเสธ')).toBeInTheDocument(); // Rejected
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
        // Thai placeholder text
        expect(screen.getByPlaceholderText('ค้นหาด้วยเลขที่ Lot หรือสินค้า...')).toBeInTheDocument();
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
