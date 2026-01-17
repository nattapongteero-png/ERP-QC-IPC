/**
 * Warehouses List Page Tests
 * Feature: 014-unit-cost
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import WarehousesPage from '@/app/inventory/warehouses/page';
import {
  renderWithProviders,
  setupFetchMock,
  clearFetchMock,
  createPaginatedResponse,
} from '../../../helpers/ui-test-utils';
import { MOCK_WAREHOUSES, INVENTORY_FETCH_HANDLERS } from '../../../helpers/fetch-mock-handlers';

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

// Mock WarehouseEditDialog to avoid complex dialog rendering
vi.mock('@/components/ui/warehouse-edit-dialog', () => ({
  WarehouseEditDialog: () => null,
}));

// Mock DxConfirmDialog
vi.mock('@/components/ui/dx-popup', () => ({
  DxConfirmDialog: () => null,
}));

describe('WarehousesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFetchMock();
  });

  describe('Page Rendering', () => {
    it('should render page with correct title', async () => {
      setupFetchMock(INVENTORY_FETCH_HANDLERS);

      renderWithProviders(<WarehousesPage />);

      await waitFor(() => {
        expect(screen.getByText('Warehouses')).toBeInTheDocument();
      });
    });

    it('should render page description', async () => {
      setupFetchMock(INVENTORY_FETCH_HANDLERS);

      renderWithProviders(<WarehousesPage />);

      await waitFor(() => {
        // Thai description
        expect(screen.getByText('จัดการคลังสินค้าและสถานที่จัดเก็บ')).toBeInTheDocument();
      });
    });

    it('should render add warehouse button', async () => {
      setupFetchMock(INVENTORY_FETCH_HANDLERS);

      renderWithProviders(<WarehousesPage />);

      await waitFor(() => {
        // Thai text for "Add Warehouse"
        expect(screen.getByText('เพิ่มคลัง')).toBeInTheDocument();
      });
    });

    it('should render warehouse type tabs', async () => {
      setupFetchMock(INVENTORY_FETCH_HANDLERS);

      renderWithProviders(<WarehousesPage />);

      await waitFor(() => {
        expect(screen.getByText('All')).toBeInTheDocument();
        // Thai type labels
        expect(screen.getByText('วัตถุดิบ')).toBeInTheDocument(); // Raw Material
        expect(screen.getByText('สินค้าสำเร็จรูป')).toBeInTheDocument(); // Finished Goods
        expect(screen.getByText('กักกัน')).toBeInTheDocument(); // Quarantine
        expect(screen.getByText('ห้องเย็น')).toBeInTheDocument(); // Cold Storage
      });
    });

    it('should render action buttons', async () => {
      setupFetchMock(INVENTORY_FETCH_HANDLERS);

      renderWithProviders(<WarehousesPage />);

      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument();
        expect(screen.getByText('View Lots')).toBeInTheDocument();
      });
    });

    it('should render search input', async () => {
      setupFetchMock(INVENTORY_FETCH_HANDLERS);

      renderWithProviders(<WarehousesPage />);

      await waitFor(() => {
        // Thai placeholder text
        expect(screen.getByPlaceholderText('ค้นหาด้วยรหัส ชื่อ หรือที่ตั้ง...')).toBeInTheDocument();
      });
    });
  });

  describe('Data Fetching', () => {
    it('should fetch warehouses on mount', async () => {
      setupFetchMock(INVENTORY_FETCH_HANDLERS);

      renderWithProviders(<WarehousesPage />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      // Verify the API was called with correct endpoint
      const calls = vi.mocked(fetch).mock.calls;
      const warehousesCall = calls.find(([url]) =>
        typeof url === 'string' && url.includes('/api/warehouses')
      );
      expect(warehousesCall).toBeDefined();
    });

    it('should handle empty data gracefully', async () => {
      setupFetchMock({
        '/api/warehouses': { data: createPaginatedResponse([]) },
      });

      renderWithProviders(<WarehousesPage />);

      await waitFor(() => {
        expect(screen.getByText('Warehouses')).toBeInTheDocument();
      });
    });

    it('should handle API error gracefully', async () => {
      setupFetchMock({
        '/api/warehouses': {
          data: { success: false, error: 'Server error' },
          ok: false,
          status: 500,
        },
      });

      renderWithProviders(<WarehousesPage />);

      // Page should still render even on API error
      await waitFor(() => {
        expect(screen.getByText('Warehouses')).toBeInTheDocument();
      });
    });

    it('should correctly parse paginated response structure (regression)', () => {
      // Verify the API response structure used by the page
      const mockResponse = createPaginatedResponse(MOCK_WAREHOUSES);

      // Correct: data.items returns the array
      expect(Array.isArray(mockResponse.data.items)).toBe(true);

      // Wrong: data should NOT be treated as an array
      expect(Array.isArray(mockResponse.data)).toBe(false);
      expect(mockResponse.data).toHaveProperty('items');
      expect(mockResponse.data).toHaveProperty('total');
    });
  });

  describe('Statistics Display', () => {
    it('should display active warehouse count', async () => {
      setupFetchMock(INVENTORY_FETCH_HANDLERS);

      renderWithProviders(<WarehousesPage />);

      await waitFor(() => {
        expect(screen.getByText(/Active/)).toBeInTheDocument();
      });
    });

    it('should display inactive warehouse count', async () => {
      setupFetchMock(INVENTORY_FETCH_HANDLERS);

      renderWithProviders(<WarehousesPage />);

      await waitFor(() => {
        expect(screen.getByText(/Inactive/)).toBeInTheDocument();
      });
    });

    it('should display cold storage count', async () => {
      setupFetchMock(INVENTORY_FETCH_HANDLERS);

      renderWithProviders(<WarehousesPage />);

      await waitFor(() => {
        expect(screen.getByText(/Cold Storage/)).toBeInTheDocument();
      });
    });

    it('should display warehouses shown count', async () => {
      setupFetchMock(INVENTORY_FETCH_HANDLERS);

      renderWithProviders(<WarehousesPage />);

      await waitFor(() => {
        expect(screen.getByText(/warehouses shown/)).toBeInTheDocument();
      });
    });
  });
});
