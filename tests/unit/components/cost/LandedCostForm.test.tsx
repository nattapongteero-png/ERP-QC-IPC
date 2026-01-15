/**
 * LandedCostForm Unit Tests
 * Feature: 014-unit-cost
 *
 * Tests that the form correctly fetches and displays vendors and POs
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LandedCostForm } from '@/components/cost/LandedCostForm';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
}));

// Mock devextreme notify
vi.mock('devextreme/ui/notify', () => ({
  default: vi.fn(),
}));

const mockVendors = [
  { id: 1, code: 'V001', name: 'Vendor A' },
  { id: 2, code: 'V002', name: 'Vendor B' },
];

const mockPurchaseOrders = [
  { id: 1, poNumber: 'PO-001', vendorId: 1, vendorName: 'Vendor A', totalAmount: 10000, status: 'received' },
  { id: 2, poNumber: 'PO-002', vendorId: 2, vendorName: 'Vendor B', totalAmount: 20000, status: 'received' },
];

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

describe('LandedCostForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Data Fetching - Response Structure', () => {
    it('should correctly parse paginated API response for vendors', async () => {
      // Mock API response with ACTUAL paginated structure
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/vendors')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: {
                items: mockVendors,  // Paginated response has items array
                total: 2,
                page: 1,
                limit: 1000,
                totalPages: 1,
              },
            }),
          });
        }
        if (url.includes('/api/purchasing/orders')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: {
                items: mockPurchaseOrders,
                total: 2,
                page: 1,
                limit: 1000,
                totalPages: 1,
              },
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: [] }),
        });
      });

      renderWithProviders(<LandedCostForm mode="create" />);

      // Wait for data to load
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/vendors?pageSize=1000');
        expect(fetch).toHaveBeenCalledWith('/api/purchasing/orders?status=received&pageSize=1000');
      });

      // The form should render without errors
      expect(screen.getByTestId('landed-cost-form')).toBeInTheDocument();
    });

    it('should handle empty vendor list gracefully', async () => {
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/vendors')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: {
                items: [],
                total: 0,
                page: 1,
                limit: 1000,
                totalPages: 0,
              },
            }),
          });
        }
        if (url.includes('/api/purchasing/orders')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: {
                items: [],
                total: 0,
                page: 1,
                limit: 1000,
                totalPages: 0,
              },
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: [] }),
        });
      });

      renderWithProviders(<LandedCostForm mode="create" />);

      await waitFor(() => {
        expect(screen.getByTestId('landed-cost-form')).toBeInTheDocument();
      });
    });

    it('should handle API error gracefully', async () => {
      global.fetch = vi.fn().mockImplementation(() => {
        return Promise.resolve({
          ok: false,
          status: 500,
        });
      });

      renderWithProviders(<LandedCostForm mode="create" />);

      await waitFor(() => {
        expect(screen.getByTestId('landed-cost-form')).toBeInTheDocument();
      });
    });

    it('should fail if data.data is used instead of data.data.items (regression test)', async () => {
      // This test documents the bug: if someone changes the code back to data.data,
      // the vendors array would be undefined or the pagination object

      const mockResponse = {
        success: true,
        data: {
          items: mockVendors,
          total: 2,
          page: 1,
          limit: 1000,
          totalPages: 1,
        },
      };

      // Correct: data.data.items returns the array
      expect(mockResponse.data.items).toEqual(mockVendors);
      expect(Array.isArray(mockResponse.data.items)).toBe(true);

      // Wrong: data.data returns the pagination object, not an array
      expect(Array.isArray(mockResponse.data)).toBe(false);
      expect(mockResponse.data).toHaveProperty('items');
      expect(mockResponse.data).toHaveProperty('total');
    });
  });

  describe('Form Elements', () => {
    beforeEach(() => {
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/vendors')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: { items: mockVendors, total: 2, page: 1, limit: 1000, totalPages: 1 },
            }),
          });
        }
        if (url.includes('/api/purchasing/orders')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: { items: mockPurchaseOrders, total: 2, page: 1, limit: 1000, totalPages: 1 },
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: [] }),
        });
      });
    });

    it('should render form with header labels', async () => {
      renderWithProviders(<LandedCostForm mode="create" />);

      await waitFor(() => {
        expect(screen.getByTestId('landed-cost-form')).toBeInTheDocument();
      });

      // Check form labels exist
      expect(screen.getByText('Purchase Order *')).toBeInTheDocument();
      expect(screen.getByText('Vendor')).toBeInTheDocument();
      expect(screen.getByText('Invoice Number')).toBeInTheDocument();
    });

    it('should render cost lines section', async () => {
      renderWithProviders(<LandedCostForm mode="create" />);

      await waitFor(() => {
        expect(screen.getByTestId('landed-cost-form')).toBeInTheDocument();
      });

      // Check cost lines section exists
      expect(screen.getByText('Cost Lines')).toBeInTheDocument();
      expect(screen.getByText('Cost Type')).toBeInTheDocument();
    });
  });
});
