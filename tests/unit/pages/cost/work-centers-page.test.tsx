/**
 * Work Centers List Page Tests
 * Feature: 014-unit-cost
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import WorkCentersPage from '@/app/cost/work-centers/page';
import {
  renderWithProviders,
  setupFetchMock,
  clearFetchMock,
} from '../../../helpers/ui-test-utils';
import { COST_FETCH_HANDLERS } from '../../../helpers/fetch-mock-handlers';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
}));

describe('WorkCentersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFetchMock();
  });

  describe('Page Rendering', () => {
    it('should render page with correct title', async () => {
      setupFetchMock(COST_FETCH_HANDLERS);

      renderWithProviders(<WorkCentersPage />);

      await waitFor(() => {
        expect(screen.getByTestId('work-centers-page')).toBeInTheDocument();
      });

      expect(screen.getByText('Work Centers')).toBeInTheDocument();
      expect(screen.getByText('Configure production work centers with labor and overhead rates')).toBeInTheDocument();
    });

    it('should render new work center button', async () => {
      setupFetchMock(COST_FETCH_HANDLERS);

      renderWithProviders(<WorkCentersPage />);

      await waitFor(() => {
        // DevExtreme Button renders text in a nested span
        expect(screen.getByText('New Work Center')).toBeInTheDocument();
      });
    });

    it('should render status cards', async () => {
      setupFetchMock(COST_FETCH_HANDLERS);

      renderWithProviders(<WorkCentersPage />);

      await waitFor(() => {
        expect(screen.getByText('Active')).toBeInTheDocument();
        expect(screen.getByText('Inactive')).toBeInTheDocument();
        expect(screen.getByText('Avg Total Rate/hr')).toBeInTheDocument();
      });
    });

    it('should display correct counts in stat cards', async () => {
      setupFetchMock(COST_FETCH_HANDLERS);

      renderWithProviders(<WorkCentersPage />);

      await waitFor(() => {
        // 2 active, 1 inactive based on mock data
        expect(screen.getByTestId('active-count')).toHaveTextContent('2');
        expect(screen.getByTestId('inactive-count')).toHaveTextContent('1');
      });
    });
  });

  describe('Data Fetching', () => {
    it('should fetch work centers on mount', async () => {
      setupFetchMock(COST_FETCH_HANDLERS);

      renderWithProviders(<WorkCentersPage />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      // Verify the API was called with correct endpoint
      const calls = vi.mocked(fetch).mock.calls;
      const workCentersCall = calls.find(([url]) =>
        typeof url === 'string' && url.includes('/api/cost/work-centers')
      );
      expect(workCentersCall).toBeDefined();
    });

    it('should handle empty data gracefully', async () => {
      setupFetchMock({
        '/api/cost/work-centers': {
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

      renderWithProviders(<WorkCentersPage />);

      await waitFor(() => {
        expect(screen.getByTestId('work-centers-page')).toBeInTheDocument();
      });
    });

    it('should handle API error', async () => {
      setupFetchMock({
        '/api/cost/work-centers': {
          data: { success: false, error: 'Server error' },
          ok: false,
          status: 500,
        },
      });

      renderWithProviders(<WorkCentersPage />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load work centers')).toBeInTheDocument();
      });
    });
  });

  describe('Grid Display', () => {
    it('should render data grid with correct title', async () => {
      setupFetchMock(COST_FETCH_HANDLERS);

      renderWithProviders(<WorkCentersPage />);

      await waitFor(() => {
        expect(screen.getByText('Work Center List')).toBeInTheDocument();
      });
    });
  });
});
