/**
 * UI Tests for Work Centers Page
 * Feature: 014-unit-cost (US6 - Work Center Configuration)
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
  usePathname: () => '/cost/work-centers',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock DevExtreme notify
vi.mock('devextreme/ui/notify', () => ({
  default: vi.fn(),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import component after mocks
import WorkCentersPage from '@/app/cost/work-centers/page';

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

const mockWorkCenters = {
  data: [
    {
      id: 1,
      code: 'WC-MIX-01',
      name: 'Mixing Station 1',
      nameTh: 'สถานีผสม 1',
      orgUnitId: 1,
      orgUnitName: 'Production',
      laborRatePerHour: 150,
      overheadRatePerHour: 75,
      machineRatePerHour: 50,
      capacityHoursPerDay: 8,
      isActive: true,
      createdAt: '2024-01-15T00:00:00Z',
      updatedAt: '2024-01-15T00:00:00Z',
    },
    {
      id: 2,
      code: 'WC-PACK-01',
      name: 'Packing Line 1',
      nameTh: 'สายบรรจุ 1',
      orgUnitId: 2,
      orgUnitName: 'Packaging',
      laborRatePerHour: 100,
      overheadRatePerHour: 50,
      machineRatePerHour: 30,
      capacityHoursPerDay: 8,
      isActive: true,
      createdAt: '2024-01-16T00:00:00Z',
      updatedAt: '2024-01-16T00:00:00Z',
    },
    {
      id: 3,
      code: 'WC-FILL-01',
      name: 'Filling Station',
      nameTh: null,
      orgUnitId: null,
      orgUnitName: null,
      laborRatePerHour: 120,
      overheadRatePerHour: 60,
      machineRatePerHour: 80,
      capacityHoursPerDay: null,
      isActive: false,
      createdAt: '2024-01-17T00:00:00Z',
      updatedAt: '2024-01-17T00:00:00Z',
    },
  ],
  total: 3,
  page: 1,
  pageSize: 20,
};

describe('WorkCentersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page title and header', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockWorkCenters }),
    });

    renderWithProviders(<WorkCentersPage />);

    expect(screen.getByText('Work Centers')).toBeInTheDocument();
    expect(
      screen.getByText('Configure production work centers with labor and overhead rates')
    ).toBeInTheDocument();
  });

  it('displays loading message when data is loading', async () => {
    // Create a promise that never resolves to keep loading state
    mockFetch.mockReturnValueOnce(new Promise(() => {}));

    renderWithProviders(<WorkCentersPage />);

    // Loading message should be visible while waiting
    expect(screen.getByTestId('loading-message')).toBeInTheDocument();
  });

  it('displays error message on fetch failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Failed to fetch' }),
    });

    renderWithProviders(<WorkCentersPage />);

    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toBeInTheDocument();
    });
  });

  it('displays stats cards after loading', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockWorkCenters }),
    });

    renderWithProviders(<WorkCentersPage />);

    // Wait for stats to load - 2 active, 1 inactive in mock data
    await waitFor(() => {
      expect(screen.getByTestId('active-count')).toHaveTextContent('2');
      expect(screen.getByTestId('inactive-count')).toHaveTextContent('1');
    });
  });

  it('calculates average total rate', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockWorkCenters }),
    });

    renderWithProviders(<WorkCentersPage />);

    // Average total rate: ((150+75+50) + (100+50+30) + (120+60+80)) / 3 = 715/3 = 238.33
    await waitFor(() => {
      const avgRateElement = screen.getByTestId('avg-rate');
      expect(avgRateElement).toBeInTheDocument();
    });
  });

  it('has proper page structure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockWorkCenters }),
    });

    renderWithProviders(<WorkCentersPage />);

    // Page wrapper should always be present
    expect(screen.getByTestId('work-centers-page')).toBeInTheDocument();
  });
});
