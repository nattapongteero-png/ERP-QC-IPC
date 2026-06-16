/**
 * Dashboard Card Navigation Links Unit Tests
 *
 * Verifies that each dashboard card links to the page where its data
 * originates (drill-down navigation). next/link renders a plain <a href>
 * in jsdom, so we assert on the rendered anchor's href.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.unmock('next-intl');

import { render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/components/layout/main-layout', () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="main-layout">{children}</div>
  ),
}));

vi.mock('@/components/dashboard/module-kpi-tabs', () => ({
  ModuleKpiTabs: () => <div data-testid="module-kpi-tabs" />,
}));

import DashboardPage from '@/app/dashboard/page';

const messages = {
  title: 'Dashboard',
  description: 'Overview',
  kpis: {
    totalItems: { label: 'Total Items', subtitle: 'Active inventory items' },
    activeWorkOrders: { label: 'Active Work Orders', subtitle: 'In production' },
    openDeviations: {
      label: 'Open Deviations',
      subtitle: 'Requires attention',
      actionNeeded: 'Action needed',
      allClear: 'All clear',
    },
    expiringSoon: {
      label: 'Expiring Soon',
      subtitle: 'Within 30 days',
      monitorClosely: 'Monitor closely',
      lowRisk: 'Low risk',
    },
    lotsInQuarantine: { label: 'Lots in Quarantine', subtitle: 'Awaiting QC' },
    pendingPOs: { label: 'Pending POs', subtitle: 'Awaiting' },
    pendingSOs: { label: 'Pending SOs', subtitle: 'Awaiting' },
    monthlyGrowth: { label: 'Monthly Growth' },
    trend: { up: 'Up', down: 'Down', neutral: 'Neutral' },
  },
  sections: {
    recentWorkOrders: {
      title: 'Recent Work Orders',
      emptyMessage: 'No recent work orders',
      batchPrefix: 'Batch',
      columns: {},
    },
    inventoryByStatus: {
      title: 'Inventory by Status',
      emptyMessage: 'No inventory data',
      lotsUnit: 'lots',
      totalPrefix: 'Total',
    },
    workOrdersByStatus: { title: 'Work Orders by Status', emptyMessage: 'No data' },
    warehouseOverview: {
      title: 'Warehouse Overview',
      emptyMessage: 'No warehouse data',
      emptyDescription: 'No data',
      lotsLabel: 'Lots',
      totalQtyLabel: 'Total Qty',
    },
  },
  warehouseTypes: {
    rawMaterial: 'Raw Material',
    wip: 'WIP',
    finishedGoods: 'Finished Goods',
    quarantine: 'Quarantine',
    rejected: 'Rejected',
    coldStorage: 'Cold Storage',
  },
  moduleKpis: { title: 'Module KPIs', tabs: {} },
};

const apiResponse = {
  success: true,
  data: {
    summary: {
      totalItems: 150,
      lotsInQuarantine: 5,
      lotsExpiringSoon: 10,
      activeWorkOrders: 8,
      pendingPOs: 12,
      pendingSOs: 6,
      openDeviations: 3,
    },
    recentWorkOrders: [
      {
        id: 42,
        woNumber: 'WO-2024-001',
        batchNumber: 'BATCH-001',
        status: 'in_progress',
        plannedQuantity: 1000,
        unit: 'kg',
      },
    ],
    inventoryByStatus: [
      { status: 'available', count: 100, totalQuantity: 50000 },
      { status: 'quarantine', count: 5, totalQuantity: 2500 },
    ],
    workOrdersByStatus: [],
    inventoryByWarehouseType: [
      {
        warehouseType: 'raw_material',
        warehouseName: 'Main Warehouse',
        lotCount: 50,
        totalQuantity: 25000,
      },
    ],
    moduleKpis: null,
  },
};

function renderDashboard() {
  global.fetch = vi.fn().mockResolvedValue({
    json: () => Promise.resolve(apiResponse),
  });

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider
        locale="en"
        messages={{ dashboard: messages }}
        timeZone="Asia/Bangkok"
      >
        <DashboardPage />
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

describe('Dashboard card navigation links', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Primary KPI cards', () => {
    it('Total Items links to inventory items page', async () => {
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByTestId('kpi-link-total-items')).toHaveAttribute(
          'href',
          '/inventory/items'
        );
      });
    });

    it('Active Work Orders links to work orders page', async () => {
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByTestId('kpi-link-active-work-orders')).toHaveAttribute(
          'href',
          '/production/work-orders'
        );
      });
    });

    it('Open Deviations links to deviations page', async () => {
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByTestId('kpi-link-open-deviations')).toHaveAttribute(
          'href',
          '/quality/deviations'
        );
      });
    });

    it('Expiring Soon links to expiry alerts page', async () => {
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByTestId('kpi-link-expiring-soon')).toHaveAttribute(
          'href',
          '/inventory/expiry-alerts'
        );
      });
    });
  });

  describe('Secondary stat cards', () => {
    it('Lots in Quarantine links to quarantine-filtered lots', async () => {
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByTestId('stat-link-lots-in-quarantine')).toHaveAttribute(
          'href',
          '/inventory/lots?status=quarantine'
        );
      });
    });

    it('Pending POs links to purchasing orders page', async () => {
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByTestId('stat-link-pending-pos')).toHaveAttribute(
          'href',
          '/purchasing/orders'
        );
      });
    });

    it('Pending SOs links to sales orders page', async () => {
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByTestId('stat-link-pending-sos')).toHaveAttribute(
          'href',
          '/sales/orders'
        );
      });
    });
  });

  describe('List item links', () => {
    it('Recent work order links to its detail page by id', async () => {
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByTestId('work-order-link-42')).toHaveAttribute(
          'href',
          '/production/work-orders/42'
        );
      });
    });

    it('Inventory-by-status row links to status-filtered lots', async () => {
      renderDashboard();
      await waitFor(() => {
        expect(
          screen.getByTestId('inventory-status-link-quarantine')
        ).toHaveAttribute('href', '/inventory/lots?status=quarantine');
      });
    });

    it('Warehouse card links to type-filtered warehouses', async () => {
      renderDashboard();
      await waitFor(() => {
        expect(
          screen.getByTestId('warehouse-link-raw_material-0')
        ).toHaveAttribute('href', '/inventory/warehouses?type=raw_material');
      });
    });
  });
});
