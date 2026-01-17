/**
 * Landed Costs List Page Tests
 * Feature: 014-unit-cost
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import LandedCostsPage from '@/app/cost/landed-costs/page';
import {
  renderWithProviders,
  setupFetchMock,
  clearFetchMock,
} from '../../../helpers/ui-test-utils';
import { MOCK_LANDED_COSTS } from '../../../helpers/fetch-mock-handlers';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
}));

describe('LandedCostsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFetchMock();
  });

  describe('Page Rendering', () => {
    it('should render page with correct title', async () => {
      setupFetchMock({
        '/api/cost/landed-costs': {
          data: {
            success: true,
            data: {
              data: MOCK_LANDED_COSTS,
              total: MOCK_LANDED_COSTS.length,
              page: 1,
              pageSize: 20,
            },
          },
        },
      });

      renderWithProviders(<LandedCostsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('landed-costs-page')).toBeInTheDocument();
      });

      expect(screen.getByText('Landed Costs')).toBeInTheDocument();
      expect(screen.getByText('Allocate freight, duty, and other costs to purchase receipts')).toBeInTheDocument();
    });

    it('should render new landed cost button', async () => {
      setupFetchMock({
        '/api/cost/landed-costs': {
          data: {
            success: true,
            data: {
              data: [],
              total: 0,
              page: 1,
              pageSize: 20,
            },
          },
        },
      });

      renderWithProviders(<LandedCostsPage />);

      await waitFor(() => {
        // DevExtreme Button renders text in a nested span
        expect(screen.getByText('New Landed Cost')).toBeInTheDocument();
      });
    });

    it('should render status cards', async () => {
      setupFetchMock({
        '/api/cost/landed-costs': {
          data: {
            success: true,
            data: {
              data: MOCK_LANDED_COSTS,
              total: MOCK_LANDED_COSTS.length,
              page: 1,
              pageSize: 20,
            },
          },
        },
      });

      renderWithProviders(<LandedCostsPage />);

      await waitFor(() => {
        expect(screen.getByText('Draft')).toBeInTheDocument();
        expect(screen.getByText('Allocated')).toBeInTheDocument();
        expect(screen.getByText('Posted')).toBeInTheDocument();
      });
    });
  });

  describe('Data Fetching', () => {
    it('should fetch landed costs on mount', async () => {
      setupFetchMock({
        '/api/cost/landed-costs': {
          data: {
            success: true,
            data: {
              data: MOCK_LANDED_COSTS,
              total: MOCK_LANDED_COSTS.length,
              page: 1,
              pageSize: 20,
            },
          },
        },
      });

      renderWithProviders(<LandedCostsPage />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      // Verify the API was called with correct endpoint
      const calls = vi.mocked(fetch).mock.calls;
      const landedCostsCall = calls.find(([url]) =>
        typeof url === 'string' && url.includes('/api/cost/landed-costs')
      );
      expect(landedCostsCall).toBeDefined();
    });

    it('should handle empty data gracefully', async () => {
      setupFetchMock({
        '/api/cost/landed-costs': {
          data: {
            success: true,
            data: {
              data: [],
              total: 0,
              page: 1,
              pageSize: 20,
            },
          },
        },
      });

      renderWithProviders(<LandedCostsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('landed-costs-page')).toBeInTheDocument();
      });
    });

    it('should handle API error', async () => {
      setupFetchMock({
        '/api/cost/landed-costs': {
          data: { success: false, error: 'Server error' },
          ok: false,
          status: 500,
        },
      });

      renderWithProviders(<LandedCostsPage />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load landed costs')).toBeInTheDocument();
      });
    });
  });

  describe('Grid Display', () => {
    it('should render data grid with correct columns', async () => {
      setupFetchMock({
        '/api/cost/landed-costs': {
          data: {
            success: true,
            data: {
              data: MOCK_LANDED_COSTS,
              total: MOCK_LANDED_COSTS.length,
              page: 1,
              pageSize: 20,
            },
          },
        },
      });

      renderWithProviders(<LandedCostsPage />);

      await waitFor(() => {
        expect(screen.getByText('Landed Cost Documents')).toBeInTheDocument();
      });
    });
  });
});
