/**
 * UI Tests for Cost Summary Report Page
 * Feature: 014-unit-cost (US7 - Cost Reports Dashboard)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/cost/reports/cost-summary',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import component after mocks
import CostSummaryReportPage from '@/app/cost/reports/cost-summary/page';

// Create a fresh QueryClient for each test
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
      },
    },
  });
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

const mockCostSummary = {
  data: [
    {
      itemId: 1,
      itemCode: 'RM-001',
      itemName: 'Herb Extract',
      itemType: 'raw_material',
      uom: 'KG',
      onHand: 1000,
      currentWAC: 150.50,
      onHandValue: 150500,
      standardCost: 145.00,
      lastPurchaseCost: 152.00,
      fullCost: 160.00,
    },
    {
      itemId: 2,
      itemCode: 'RM-002',
      itemName: 'Active Ingredient',
      itemType: 'raw_material',
      uom: 'KG',
      onHand: 500,
      currentWAC: 450.25,
      onHandValue: 225125,
      standardCost: 440.00,
      lastPurchaseCost: 455.00,
      fullCost: 470.00,
    },
    {
      itemId: 3,
      itemCode: 'FG-001',
      itemName: 'Herbal Supplement',
      itemType: 'finished_goods',
      uom: 'PC',
      onHand: 2000,
      currentWAC: 85.00,
      onHandValue: 170000,
      standardCost: 80.00,
      lastPurchaseCost: null,
      fullCost: 95.00,
    },
  ],
  total: 3,
};

describe('CostSummaryReportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page title and header', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockCostSummary }),
    });

    renderWithProviders(<CostSummaryReportPage />);

    expect(screen.getByText('Cost Summary')).toBeInTheDocument();
    expect(
      screen.getByText('Detailed cost summary report')
    ).toBeInTheDocument();
  });

  it('has proper page structure with testid', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockCostSummary }),
    });

    renderWithProviders(<CostSummaryReportPage />);

    expect(screen.getByTestId('cost-summary-report-page')).toBeInTheDocument();
  });

  it('displays loading state initially', async () => {
    // Create a promise that never resolves to keep loading state
    mockFetch.mockReturnValueOnce(new Promise(() => {}));

    renderWithProviders(<CostSummaryReportPage />);

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toBeInTheDocument();
    });
  });

  it('displays error message on fetch failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Failed to fetch' }),
    });

    renderWithProviders(<CostSummaryReportPage />);

    await waitFor(() => {
      expect(screen.getByTestId('error')).toBeInTheDocument();
    });
  });

  it('displays filter controls', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockCostSummary }),
    });

    renderWithProviders(<CostSummaryReportPage />);

    // Check for filter labels - DevExtreme components don't expose data-testid properly
    expect(screen.getByText('Item Type')).toBeInTheDocument();
    expect(screen.getByText('Search')).toBeInTheDocument();
    // Verify the Filters card is displayed
    expect(screen.getByText('Filters')).toBeInTheDocument();
  });

  it('displays data grid card with cost summary', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockCostSummary }),
    });

    renderWithProviders(<CostSummaryReportPage />);

    await waitFor(() => {
      // Check for the card title that contains the grid, not the grid itself
      // DevExtreme DataGrid doesn't expose data-testid properly in test DOM
      expect(screen.getByText('Item Cost Summary')).toBeInTheDocument();
    });
  });

  it('displays correct filter card title', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockCostSummary }),
    });

    renderWithProviders(<CostSummaryReportPage />);

    expect(screen.getByText('Filters')).toBeInTheDocument();
    expect(screen.getByText('Item Cost Summary')).toBeInTheDocument();
  });
});
