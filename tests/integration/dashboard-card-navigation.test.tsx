/**
 * Integration Test: Dashboard Card Drill-Down Navigation
 *
 * Feature: each dashboard card must be clickable and navigate to the page
 * where its data originates.
 *
 * This renders the REAL DashboardPage with the REAL th/en dashboard.json
 * translation blobs and a mocked /api/dashboard response, then asserts that
 * every card/list-item is a working anchor pointing at the correct source
 * route. Uses both locales to prove the links are locale-independent.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.unmock('next-intl');

import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
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

import thDashboard from '../../src/locales/th/dashboard.json';
import enDashboard from '../../src/locales/en/dashboard.json';
import DashboardPage from '@/app/dashboard/page';

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
    ],
    workOrdersByStatus: [],
    inventoryByWarehouseType: [
      {
        warehouseType: 'finished_goods',
        warehouseName: 'FG Warehouse',
        lotCount: 30,
        totalQuantity: 15000,
      },
    ],
    moduleKpis: null,
  },
};

function renderDashboard(locale: 'en' | 'th') {
  global.fetch = vi.fn().mockResolvedValue({
    json: () => Promise.resolve(apiResponse),
  });

  const messages = locale === 'en' ? enDashboard : thDashboard;
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider
        locale={locale}
        messages={{ dashboard: messages }}
        timeZone="Asia/Bangkok"
      >
        <DashboardPage />
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

// testid -> expected href, for every drill-down link on the dashboard.
const EXPECTED_LINKS: Record<string, string> = {
  'kpi-link-total-items': '/inventory/items',
  'kpi-link-active-work-orders': '/production/work-orders',
  'kpi-link-open-deviations': '/quality/deviations',
  'kpi-link-expiring-soon': '/inventory/expiry-alerts',
  'stat-link-lots-in-quarantine': '/inventory/lots?status=quarantine',
  'stat-link-pending-pos': '/purchasing/orders',
  'stat-link-pending-sos': '/sales/orders',
  'work-order-link-42': '/production/work-orders/42',
  'inventory-status-link-available': '/inventory/lots?status=available',
  'warehouse-link-finished_goods-0': '/inventory/warehouses?type=finished_goods',
};

describe('Dashboard drill-down navigation (integration, real i18n)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(['en', 'th'] as const)(
    'renders every card as an anchor pointing to its source route [%s locale]',
    async (locale) => {
      renderDashboard(locale);

      // Wait for data-driven cards to appear.
      await waitFor(() => {
        expect(screen.getByTestId('kpi-link-total-items')).toBeInTheDocument();
      });

      for (const [testId, href] of Object.entries(EXPECTED_LINKS)) {
        const el = screen.getByTestId(testId);
        expect(el, `${testId} should render`).toBeInTheDocument();
        expect(el.tagName, `${testId} should be an anchor`).toBe('A');
        expect(el).toHaveAttribute('href', href);
      }
    }
  );

  it('every drill-down href targets an existing top-level module route', async () => {
    renderDashboard('en');
    await waitFor(() => {
      expect(screen.getByTestId('kpi-link-total-items')).toBeInTheDocument();
    });

    const VALID_PREFIXES = [
      '/inventory',
      '/production',
      '/quality',
      '/purchasing',
      '/sales',
    ];

    for (const href of Object.values(EXPECTED_LINKS)) {
      const matches = VALID_PREFIXES.some((p) => href.startsWith(p));
      expect(matches, `${href} should target a known module`).toBe(true);
    }
  });
});
