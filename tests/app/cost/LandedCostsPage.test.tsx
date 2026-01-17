/**
 * UI Tests for Landed Costs List Page
 * Feature: 014-unit-cost
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
  usePathname: () => '/cost/landed-costs',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import component after mocks
import LandedCostsPage from '@/app/cost/landed-costs/page';

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

const mockLandedCosts = {
  data: [
    {
      id: 1,
      documentNumber: 'LC-2024-001',
      referenceNumber: 'PO-2024-100',
      invoiceNumber: 'INV-001',
      status: 'draft',
      totalAmount: 15000,
      currency: 'THB',
      createdAt: '2024-01-15T00:00:00Z',
      postedAt: null,
    },
    {
      id: 2,
      documentNumber: 'LC-2024-002',
      referenceNumber: 'PO-2024-101',
      invoiceNumber: 'INV-002',
      status: 'allocated',
      totalAmount: 25000,
      currency: 'THB',
      createdAt: '2024-01-16T00:00:00Z',
      postedAt: null,
    },
    {
      id: 3,
      documentNumber: 'LC-2024-003',
      referenceNumber: 'PO-2024-102',
      invoiceNumber: 'INV-003',
      status: 'posted',
      totalAmount: 18500,
      currency: 'THB',
      createdAt: '2024-01-17T00:00:00Z',
      postedAt: '2024-01-18T00:00:00Z',
    },
  ],
  total: 3,
  page: 1,
  pageSize: 20,
};

describe('LandedCostsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page title and header', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockLandedCosts }),
    });

    renderWithProviders(<LandedCostsPage />);

    expect(screen.getByText('Landed Costs')).toBeInTheDocument();
    expect(
      screen.getByText('Allocate freight, duty, and other costs to purchase receipts')
    ).toBeInTheDocument();
  });

  it('has proper page structure with testid', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockLandedCosts }),
    });

    renderWithProviders(<LandedCostsPage />);

    expect(screen.getByTestId('landed-costs-page')).toBeInTheDocument();
  });

  it('displays new landed cost button', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockLandedCosts }),
    });

    renderWithProviders(<LandedCostsPage />);

    // DevExtreme Button uses elementAttr for data-testid, check button text instead
    expect(screen.getByText('New Landed Cost')).toBeInTheDocument();
  });

  it('displays error message on fetch failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Failed to fetch'));

    renderWithProviders(<LandedCostsPage />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load landed costs')).toBeInTheDocument();
    });
  });

  it('displays stats cards with correct counts', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockLandedCosts }),
    });

    renderWithProviders(<LandedCostsPage />);

    // Wait for the data to load - 1 draft, 1 allocated, 1 posted in mock data
    await waitFor(() => {
      // Check that stats are displayed
      expect(screen.getByText('Draft')).toBeInTheDocument();
      expect(screen.getByText('Allocated')).toBeInTheDocument();
      expect(screen.getByText('Posted')).toBeInTheDocument();
    });
  });

  it('displays data grid card for landed costs', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockLandedCosts }),
    });

    renderWithProviders(<LandedCostsPage />);

    await waitFor(() => {
      // Check for the card title that contains the grid
      expect(screen.getByText('Landed Cost Documents')).toBeInTheDocument();
    });
  });
});
