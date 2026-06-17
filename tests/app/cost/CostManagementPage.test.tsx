/**
 * UI Tests for Cost Management Dashboard Page
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
  usePathname: () => '/cost',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock lucide-react icons — Proxy returns a stub for ANY icon name so a newly
// imported icon can never fail the mock.
vi.mock('lucide-react', () => {
  const React = require('react');
  const make = (name: string) => Object.assign(
    (props: any) => React.createElement('span', { 'data-testid': `icon-${name}`, ...props }),
    { displayName: name }
  );
  return new Proxy({}, {
    get: (_t: unknown, prop: string | symbol) => {
      if (prop === '__esModule') return true;
      if (prop === 'default') return make('default');
      return make(String(prop));
    },
  });
});

// Mock devextreme select-box
vi.mock('devextreme-react/select-box', () => ({
  default: ({ value, onValueChanged, dataSource }: any) => (
    <select
      value={value || ''}
      onChange={(e) => onValueChanged?.({ value: e.target.value })}
      data-testid="period-select"
    >
      {(dataSource || []).map((item: any) => (
        <option key={item.value} value={item.value}>{item.label}</option>
      ))}
    </select>
  ),
}));

// Mock @/components/shared
vi.mock('@/components/shared', () => ({
  ResponsivePageHeader: ({ title, subtitle }: any) => (
    <div data-testid="page-header">
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </div>
  ),
  StatCard: ({ label, value }: any) => (
    <div data-testid={`stat-${label}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  ),
}));

// Mock @/components/cost/CostDashboard - renders based on fetch result
vi.mock('@/components/cost/CostDashboard', () => ({
  CostDashboard: function MockCostDashboard({ periodType }: any) {
    const { useState, useEffect } = require('react');
    const [state, setState] = useState('loading' as 'loading' | 'error' | 'done');

    useEffect(() => {
      fetch(`/api/cost/dashboard?period=${periodType || 'this_month'}`)
        .then(r => {
          if (!r.ok) { setState('error'); return; }
          return r.json().then(() => setState('done'));
        })
        .catch(() => setState('error'));
    }, [periodType]);

    if (state === 'loading') return <div data-testid="cost-dashboard-loading">Loading...</div>;
    if (state === 'error') return <div data-testid="cost-dashboard-error">Error loading</div>;
    return <div data-testid="cost-dashboard">Dashboard loaded</div>;
  },
}));

// Mock ui/card
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => <div className={className}>{children}</div>,
  CardContent: ({ children, className }: any) => <div className={className}>{children}</div>,
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import component after mocks
import CostManagementPage from '@/app/cost/page';

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

const mockDashboardKPIs = {
  inventoryValue: 5000000,
  inventoryValueChange: 2.5,
  wipValue: 500000,
  wipValueChange: 1.2,
  avgMaterialCostChange: 3.1,
  grossMarginPercent: 35.5,
  grossMarginPercentPrior: 34.0,
  favorableVariance: 25000,
  unfavorableVariance: 15000,
  topCostIncreases: [
    { itemId: 1, itemCode: 'RM-001', itemName: 'Herb Extract', changePercent: 15.5, previousCost: 100, currentCost: 115.5 },
    { itemId: 2, itemCode: 'RM-002', itemName: 'Active Ingredient', changePercent: 8.2, previousCost: 200, currentCost: 216.4 },
  ],
  topMarginErosion: [],
  costTrend: [
    { period: '2024-01', avgMaterialCost: 4500000 },
    { period: '2024-02', avgMaterialCost: 4700000 },
    { period: '2024-03', avgMaterialCost: 5000000 },
  ],
};

describe('CostManagementPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page title and header', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockDashboardKPIs }),
    });

    renderWithProviders(<CostManagementPage />);

    expect(screen.getByText('Cost Management')).toBeInTheDocument();
    expect(
      screen.getByText('Executive dashboard for cost control and margin analysis')
    ).toBeInTheDocument();
  });

  it('has proper page structure with testid', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockDashboardKPIs }),
    });

    renderWithProviders(<CostManagementPage />);

    expect(screen.getByTestId('cost-management-page')).toBeInTheDocument();
  });

  it('displays quick link cards', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockDashboardKPIs }),
    });

    renderWithProviders(<CostManagementPage />);

    expect(screen.getByText('Landed Costs')).toBeInTheDocument();
    expect(screen.getByText('Work Centers')).toBeInTheDocument();
    expect(screen.getByText('Cost Reports')).toBeInTheDocument();
  });

  it('displays CostDashboard loading state initially', async () => {
    // Create a promise that never resolves to keep loading state
    mockFetch.mockReturnValueOnce(new Promise(() => {}));

    renderWithProviders(<CostManagementPage />);

    await waitFor(() => {
      expect(screen.getByTestId('cost-dashboard-loading')).toBeInTheDocument();
    });
  });

  it('displays CostDashboard error on fetch failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Failed to fetch' }),
    });

    renderWithProviders(<CostManagementPage />);

    await waitFor(() => {
      expect(screen.getByTestId('cost-dashboard-error')).toBeInTheDocument();
    });
  });

  it('displays CostDashboard with data on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockDashboardKPIs }),
    });

    renderWithProviders(<CostManagementPage />);

    await waitFor(() => {
      expect(screen.getByTestId('cost-dashboard')).toBeInTheDocument();
    });
  });
});
