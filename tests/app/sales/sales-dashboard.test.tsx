/**
 * Sales dashboard render test (sheet items 46-47).
 *
 * Asserts the /sales landing renders as a real dashboard (stat cards + charts)
 * without a runtime error, driven off a mocked sales-summary payload shaped
 * exactly like getSalesReport's output (summary / byStatus / byParty / rows).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

// MainLayout pulls in sidebar/notifications/network — render children only.
vi.mock('@/components/layout/main-layout', () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/sales',
  useSearchParams: () => new URLSearchParams(),
}));

// DevExtreme charts render to canvas/SVG and are noisy under jsdom; stub them to
// simple markers so the test focuses on the page wiring, not the chart engine.
vi.mock('devextreme-react/pie-chart', () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    PieChart: ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="mock-pie">{children}</div>
    ),
    Series: Passthrough,
    Label: Passthrough,
    Legend: Passthrough,
    Tooltip: Passthrough,
    Connector: Passthrough,
  };
});
vi.mock('devextreme-react/chart', () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    Chart: ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="mock-chart">{children}</div>
    ),
    CommonSeriesSettings: Passthrough,
    Series: Passthrough,
    ArgumentAxis: Passthrough,
    ValueAxis: Passthrough,
    Legend: Passthrough,
    Tooltip: Passthrough,
    Size: Passthrough,
    Grid: Passthrough,
  };
});

const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const salesSummaryPayload = {
  success: true,
  data: {
    summary: {
      orders: 3,
      value: 250000,
      avgOrderValue: 250000 / 3,
      voidedOrders: 1,
      voidedValue: 15000,
      parties: 2,
    },
    byStatus: [
      { status: 'delivered', count: 1, value: 150000 },
      { status: 'confirmed', count: 2, value: 100000 },
      { status: 'cancelled', count: 1, value: 15000 },
    ],
    byParty: [
      { name: 'ลูกค้า ก', code: null, orders: 2, value: 180000 },
      { name: 'ลูกค้า ข', code: null, orders: 1, value: 70000 },
    ],
    byMonth: [{ month: '2026-01', orders: 3, value: 250000 }],
    rows: [
      {
        id: 1,
        soNumber: 'SO-2026-001',
        orderDate: '2026-01-15',
        requiredDate: '2026-01-30',
        shippedDate: null,
        customerName: 'ลูกค้า ก',
        status: 'confirmed',
        totalAmount: 100000,
      },
      {
        id: 2,
        soNumber: 'SO-2026-002',
        orderDate: '2026-01-10',
        requiredDate: null,
        shippedDate: '2026-01-20',
        customerName: 'ลูกค้า ข',
        status: 'delivered',
        totalAmount: 150000,
      },
    ],
    generatedAt: new Date().toISOString(),
  },
};

import SalesDashboardPage from '@/app/sales/page';

describe('Sales dashboard page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => salesSummaryPayload,
    });
  });

  it('renders the dashboard with stat cards and charts without crashing', async () => {
    render(<SalesDashboardPage />);

    // Header
    expect(await screen.findByText('แดชบอร์ดขาย')).toBeInTheDocument();

    // Stat cards container + individual cards
    await waitFor(() => {
      expect(screen.getByTestId('sales-stat-cards')).toBeInTheDocument();
    });
    expect(screen.getByTestId('stat-total-value')).toBeInTheDocument();
    expect(screen.getByTestId('stat-order-count')).toBeInTheDocument();
    expect(screen.getByTestId('stat-avg-value')).toBeInTheDocument();

    // Chart containers
    expect(screen.getByTestId('chart-value-by-status')).toBeInTheDocument();
    expect(screen.getByTestId('chart-top-customers')).toBeInTheDocument();

    // Fetched the sales-summary endpoint
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
    expect(mockFetch.mock.calls[0][0]).toContain('/api/sales/reports/sales-summary');
  });

  it('shows the total sales value from the summary', async () => {
    render(<SalesDashboardPage />);
    // 250000 → "250,000" via formatNumber
    expect(await screen.findByText('250,000')).toBeInTheDocument();
  });
});
