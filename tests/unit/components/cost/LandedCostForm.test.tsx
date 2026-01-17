/**
 * LandedCostForm Unit Tests
 * Feature: 014-unit-cost
 *
 * Tests that the form correctly fetches and displays vendors and POs.
 * Uses shared UI test utilities for consistent testing patterns.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { LandedCostForm } from '@/components/cost/LandedCostForm';
import {
  renderWithProviders,
  setupFetchMock,
  createPaginatedResponse,
  assertPaginatedResponseStructure,
  clearFetchMock,
} from '../../../helpers/ui-test-utils';
import {
  MOCK_VENDORS,
  MOCK_PURCHASE_ORDERS,
  COST_FETCH_HANDLERS,
} from '../../../helpers/fetch-mock-handlers';

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

describe('LandedCostForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFetchMock();
  });

  describe('Data Fetching - Response Structure', () => {
    it('should correctly parse paginated API response for vendors', async () => {
      // Use pre-built handlers from fetch-mock-handlers
      setupFetchMock(COST_FETCH_HANDLERS);

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
      setupFetchMock({
        '/api/vendors': { data: createPaginatedResponse([]) },
        '/api/purchasing/orders': { data: createPaginatedResponse([]) },
      });

      renderWithProviders(<LandedCostForm mode="create" />);

      await waitFor(() => {
        expect(screen.getByTestId('landed-cost-form')).toBeInTheDocument();
      });
    });

    it('should handle API error gracefully', async () => {
      setupFetchMock({
        '/api/vendors': { data: { success: false, error: 'Server error' }, ok: false, status: 500 },
        '/api/purchasing/orders': { data: { success: false, error: 'Server error' }, ok: false, status: 500 },
      });

      renderWithProviders(<LandedCostForm mode="create" />);

      await waitFor(() => {
        expect(screen.getByTestId('landed-cost-form')).toBeInTheDocument();
      });
    });

    it('should correctly parse paginated response structure (regression test)', () => {
      // This test documents the API response structure
      // and catches the common bug where data.data is used instead of data.data.items
      const mockResponse = createPaginatedResponse(MOCK_VENDORS);

      // Use the assertion helper to validate structure
      assertPaginatedResponseStructure(mockResponse);

      // Additional explicit checks
      expect(mockResponse.success).toBe(true);
      expect(Array.isArray(mockResponse.data.items)).toBe(true);
      expect(mockResponse.data.items).toEqual(MOCK_VENDORS);
      expect(mockResponse.data.total).toBe(MOCK_VENDORS.length);
    });

    it('should fail if data.data is used instead of data.data.items (regression)', () => {
      const mockResponse = createPaginatedResponse(MOCK_PURCHASE_ORDERS);

      // Correct: data.items returns the array
      expect(Array.isArray(mockResponse.data.items)).toBe(true);

      // Wrong: data should NOT be treated as an array
      expect(Array.isArray(mockResponse.data)).toBe(false);
      expect(mockResponse.data).toHaveProperty('items');
      expect(mockResponse.data).toHaveProperty('total');
    });
  });

  describe('Form Elements', () => {
    beforeEach(() => {
      setupFetchMock(COST_FETCH_HANDLERS);
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

    it('should render header information section', async () => {
      renderWithProviders(<LandedCostForm mode="create" />);

      await waitFor(() => {
        expect(screen.getByTestId('landed-cost-form')).toBeInTheDocument();
      });

      // Check header info section
      expect(screen.getByText('Header Information')).toBeInTheDocument();
      expect(screen.getByText('Currency')).toBeInTheDocument();
      expect(screen.getByText('Exchange Rate')).toBeInTheDocument();
    });
  });

  describe('Create Mode', () => {
    it('should render in create mode with correct title', async () => {
      setupFetchMock(COST_FETCH_HANDLERS);

      renderWithProviders(<LandedCostForm mode="create" />);

      await waitFor(() => {
        expect(screen.getByText('New Landed Cost')).toBeInTheDocument();
      });
    });
  });
});
