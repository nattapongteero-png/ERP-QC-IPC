/**
 * UI Tests for CostViewsPanel Component
 * Feature: 014-unit-cost (US4 - Multiple Cost View Access)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CostViewsPanel } from '@/components/cost/CostViewsPanel';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

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
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

const mockCostViews = {
  itemId: 1,
  itemCode: 'RM001',
  itemName: 'Test Raw Material',
  itemType: 'raw_material',
  uom: 'kg',
  onHand: 100,
  inventoryCost: 250.5,
  standardCost: 245.0,
  lastPurchaseCost: 255.0,
  lastPurchaseDate: '2024-01-15',
  lastProductionCost: null,
  lastProductionDate: null,
  fullCost: 275.55, // WAC + 10% SG&A
  onHandValue: 25050.0,
  sgaAllocationRate: 10,
  suggestedPrice: 393.64, // Full cost / (1 - 30%)
};

describe('CostViewsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', async () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

    renderWithProviders(<CostViewsPanel itemId={1} />);

    // Wait for the loading state to render
    await waitFor(() => {
      expect(screen.getByTestId('cost-views-panel-loading')).toBeInTheDocument();
    });
    // Check for skeleton loading
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders all 5 cost views when data is loaded', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockCostViews),
    });

    renderWithProviders(<CostViewsPanel itemId={1} />);

    await waitFor(() => {
      expect(screen.getByTestId('cost-card-weighted-avg-cost-(wac)')).toBeInTheDocument();
    });

    // Verify all cost cards are present
    expect(screen.getByTestId('cost-card-standard-cost')).toBeInTheDocument();
    expect(screen.getByTestId('cost-card-last-purchase')).toBeInTheDocument();
    expect(screen.getByTestId('cost-card-last-production')).toBeInTheDocument();
    expect(screen.getByTestId('cost-card-full-absorption-cost')).toBeInTheDocument();
  });

  it('displays suggested price section with margin input', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockCostViews),
    });

    renderWithProviders(<CostViewsPanel itemId={1} showSuggestedPrice={true} />);

    await waitFor(() => {
      expect(screen.getByTestId('suggested-price-section')).toBeInTheDocument();
    });

    // Verify suggested price elements
    expect(screen.getByTestId('margin-input-container')).toBeInTheDocument();
    expect(screen.getByTestId('suggested-price-value')).toBeInTheDocument();
    expect(screen.getByText('Suggested Selling Price')).toBeInTheDocument();
    expect(screen.getByText('at 30% margin')).toBeInTheDocument();
  });

  it('hides suggested price section when showSuggestedPrice is false', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockCostViews),
    });

    renderWithProviders(<CostViewsPanel itemId={1} showSuggestedPrice={false} />);

    await waitFor(() => {
      expect(screen.getByTestId('cost-card-weighted-avg-cost-(wac)')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('suggested-price-section')).not.toBeInTheDocument();
  });

  it('displays on-hand quantity and total value', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockCostViews),
    });

    renderWithProviders(<CostViewsPanel itemId={1} />);

    await waitFor(() => {
      expect(screen.getByText(/On Hand:/)).toBeInTheDocument();
    });

    expect(screen.getByText(/100 units/)).toBeInTheDocument();
  });

  it('displays error state when fetch fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
    });

    renderWithProviders(<CostViewsPanel itemId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load cost views')).toBeInTheDocument();
    });
  });

  it('displays no data state when item not found', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(null),
    });

    renderWithProviders(<CostViewsPanel itemId={999} />);

    await waitFor(() => {
      expect(screen.getByText('No cost data available')).toBeInTheDocument();
    });
  });

  it('uses default margin of 30%', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockCostViews),
    });

    renderWithProviders(<CostViewsPanel itemId={1} />);

    await waitFor(() => {
      expect(screen.getByTestId('suggested-price-section')).toBeInTheDocument();
    });

    expect(screen.getByText('at 30% margin')).toBeInTheDocument();
  });

  it('accepts custom default margin', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockCostViews),
    });

    renderWithProviders(<CostViewsPanel itemId={1} defaultMarginPercent={25} />);

    await waitFor(() => {
      expect(screen.getByTestId('suggested-price-section')).toBeInTheDocument();
    });

    expect(screen.getByText('at 25% margin')).toBeInTheDocument();
  });

  it('displays formatted currency values in THB', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockCostViews),
    });

    renderWithProviders(<CostViewsPanel itemId={1} />);

    await waitFor(() => {
      expect(screen.getByTestId('cost-card-weighted-avg-cost-(wac)')).toBeInTheDocument();
    });

    // Check that THB formatting is applied (contains ฿ symbol)
    const wacCard = screen.getByTestId('cost-card-weighted-avg-cost-(wac)');
    expect(wacCard.textContent).toContain('฿');
  });

  it('displays formatted date for last purchase', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockCostViews),
    });

    renderWithProviders(<CostViewsPanel itemId={1} />);

    await waitFor(() => {
      expect(screen.getByTestId('cost-card-last-purchase')).toBeInTheDocument();
    });

    // Check that the purchase card has a date (Thai locale)
    const purchaseCard = screen.getByTestId('cost-card-last-purchase');
    // Should contain formatted date like "15 ม.ค. 2024" (Thai format)
    expect(purchaseCard.textContent).toMatch(/2567|2024/); // Thai or Gregorian year
  });

  it('displays Never for missing production date', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockCostViews),
    });

    renderWithProviders(<CostViewsPanel itemId={1} />);

    await waitFor(() => {
      expect(screen.getByTestId('cost-card-last-production')).toBeInTheDocument();
    });

    const productionCard = screen.getByTestId('cost-card-last-production');
    expect(productionCard.textContent).toContain('Never');
  });
});
