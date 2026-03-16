/**
 * Cost Summary Report Page Tests
 * Feature: 014-unit-cost
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import CostSummaryReportPage from '@/app/cost/reports/cost-summary/page';
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

describe('CostSummaryReportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFetchMock();
  });

  describe('Page Rendering', () => {
    it('should render page with correct title', async () => {
      setupFetchMock(COST_FETCH_HANDLERS);

      renderWithProviders(<CostSummaryReportPage />);

      await waitFor(() => {
        expect(screen.getByTestId('cost-summary-report-page')).toBeInTheDocument();
      });

      expect(screen.getByText('Cost Summary')).toBeInTheDocument();
      expect(screen.getByText('Detailed cost summary report')).toBeInTheDocument();
    });

    it('should render filter section', async () => {
      setupFetchMock(COST_FETCH_HANDLERS);

      renderWithProviders(<CostSummaryReportPage />);

      await waitFor(() => {
        expect(screen.getByText('Filters')).toBeInTheDocument();
        expect(screen.getByText('Item Type')).toBeInTheDocument();
        expect(screen.getByText('Search')).toBeInTheDocument();
      });
    });

    it('should render data grid section', async () => {
      setupFetchMock(COST_FETCH_HANDLERS);

      renderWithProviders(<CostSummaryReportPage />);

      await waitFor(() => {
        expect(screen.getByText('Item Cost Summary')).toBeInTheDocument();
      });
    });
  });

  describe('Data Fetching', () => {
    it('should fetch cost summary on mount', async () => {
      setupFetchMock(COST_FETCH_HANDLERS);

      renderWithProviders(<CostSummaryReportPage />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
      });

      // Verify the API was called with correct endpoint
      const calls = vi.mocked(fetch).mock.calls;
      const reportCall = calls.find(([url]) =>
        typeof url === 'string' && url.includes('/api/cost/reports/cost-summary')
      );
      expect(reportCall).toBeDefined();
    });

    it('should handle empty data gracefully', async () => {
      setupFetchMock({
        '/api/cost/reports/cost-summary': {
          data: {
            success: true,
            data: {
              data: [],
              total: 0,
            },
          },
        },
      });

      renderWithProviders(<CostSummaryReportPage />);

      await waitFor(() => {
        expect(screen.getByTestId('cost-summary-report-page')).toBeInTheDocument();
      });
    });

    it('should handle API error', async () => {
      setupFetchMock({
        '/api/cost/reports/cost-summary': {
          data: { success: false, error: 'Server error' },
          ok: false,
          status: 500,
        },
      });

      renderWithProviders(<CostSummaryReportPage />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load report data')).toBeInTheDocument();
      });
    });
  });
});
