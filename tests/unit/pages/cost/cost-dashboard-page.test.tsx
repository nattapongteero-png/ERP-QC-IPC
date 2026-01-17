/**
 * Cost Dashboard Page Tests
 * Feature: 014-unit-cost
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import CostManagementPage from '@/app/cost/page';
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

// Mock recharts to avoid rendering issues in tests
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}));

describe('CostManagementPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFetchMock();
  });

  describe('Page Rendering', () => {
    it('should render page with correct title', async () => {
      setupFetchMock(COST_FETCH_HANDLERS);

      renderWithProviders(<CostManagementPage />);

      await waitFor(() => {
        expect(screen.getByTestId('cost-management-page')).toBeInTheDocument();
      });

      expect(screen.getByText('Cost Management')).toBeInTheDocument();
      expect(screen.getByText('Monitor costs, margins, and variances across your operations')).toBeInTheDocument();
    });

    it('should render quick link cards', async () => {
      setupFetchMock(COST_FETCH_HANDLERS);

      renderWithProviders(<CostManagementPage />);

      await waitFor(() => {
        expect(screen.getByText('Landed Costs')).toBeInTheDocument();
        expect(screen.getByText('Work Centers')).toBeInTheDocument();
        expect(screen.getByText('Cost Reports')).toBeInTheDocument();
      });
    });

    it('should render quick link descriptions', async () => {
      setupFetchMock(COST_FETCH_HANDLERS);

      renderWithProviders(<CostManagementPage />);

      await waitFor(() => {
        expect(screen.getByText('Allocate freight and duties')).toBeInTheDocument();
        expect(screen.getByText('Configure labor rates')).toBeInTheDocument();
        expect(screen.getByText('View detailed reports')).toBeInTheDocument();
      });
    });
  });

  describe('Dashboard Component', () => {
    it('should render cost dashboard component', async () => {
      setupFetchMock(COST_FETCH_HANDLERS);

      renderWithProviders(<CostManagementPage />);

      await waitFor(() => {
        expect(screen.getByTestId('cost-dashboard')).toBeInTheDocument();
      });
    });

    it('should display KPI cards', async () => {
      setupFetchMock(COST_FETCH_HANDLERS);

      renderWithProviders(<CostManagementPage />);

      await waitFor(() => {
        expect(screen.getByTestId('inventory-value-card')).toBeInTheDocument();
        expect(screen.getByTestId('wip-value-card')).toBeInTheDocument();
        expect(screen.getByTestId('gross-margin-card')).toBeInTheDocument();
        expect(screen.getByTestId('variance-card')).toBeInTheDocument();
      });
    });

    it('should display trend chart card', async () => {
      setupFetchMock(COST_FETCH_HANDLERS);

      renderWithProviders(<CostManagementPage />);

      await waitFor(() => {
        expect(screen.getByTestId('cost-trend-card')).toBeInTheDocument();
      });
    });

    it('should display cost increases card', async () => {
      setupFetchMock(COST_FETCH_HANDLERS);

      renderWithProviders(<CostManagementPage />);

      await waitFor(() => {
        expect(screen.getByTestId('cost-increases-card')).toBeInTheDocument();
      });
    });

    it('should handle API error gracefully', async () => {
      setupFetchMock({
        '/api/cost/dashboard': {
          data: { success: false, error: 'Server error' },
          ok: false,
          status: 500,
        },
      });

      renderWithProviders(<CostManagementPage />);

      await waitFor(() => {
        expect(screen.getByTestId('cost-dashboard-error')).toBeInTheDocument();
        expect(screen.getByText('Failed to load dashboard data')).toBeInTheDocument();
      });
    });
  });
});
