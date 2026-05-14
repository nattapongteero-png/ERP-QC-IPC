/**
 * Unit Tests for ModuleKpiTabs Component
 * Tests the tabbed dashboard KPI component with:
 * - Loading skeleton rendering
 * - Null data handling
 * - HR KPIs rendering with mock data
 * - All tab titles visibility (using i18n translations)
 *
 * NOTE: The global next-intl mock in tests/setup.ts feeds real English
 * translations from src/locales/en/*.json so assertions use English labels.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { DashboardModuleKpis } from '@/lib/services/dashboard.service';

// Mock DevExtreme TabPanel — mirror relevant flicker-related props onto
// DOM attributes so tests can assert on them (animationEnabled, deferRendering).
vi.mock('devextreme-react/tab-panel', () => ({
  default: vi.fn(
    ({
      items,
      itemTitleRender,
      itemRender,
      selectedIndex,
      animationEnabled,
      deferRendering,
    }) => {
      const currentItem = items?.[selectedIndex] || items?.[0];
      return (
        <div
          data-testid="tab-panel"
          data-animation-enabled={String(animationEnabled)}
          data-defer-rendering={String(deferRendering)}
        >
          {/* Tab headers */}
          <div data-testid="tab-headers" className="tab-headers">
            {items?.map((item: { id: string; title: string }) => (
              <div key={item.id} data-testid={`tab-header-${item.id}`}>
                {itemTitleRender ? itemTitleRender(item) : item.title}
              </div>
            ))}
          </div>
          {/* Tab content */}
          <div data-testid="tab-content">
            {currentItem && itemRender ? itemRender(currentItem) : null}
          </div>
        </div>
      );
    },
  ),
  Item: vi.fn(() => null),
}));

// Mock section components
vi.mock('@/components/dashboard/hr-kpi-section', () => ({
  HRKpiSection: vi.fn(({ data }) => (
    <div data-testid="hr-kpi-section">
      <span>Total Employees</span>
      <span>{data.totalEmployees}</span>
    </div>
  )),
}));

vi.mock('@/components/dashboard/purchase-kpi-section', () => ({
  PurchaseKpiSection: vi.fn(() => <div data-testid="purchase-kpi-section">Purchase KPIs</div>),
}));

vi.mock('@/components/dashboard/sales-kpi-section', () => ({
  SalesKpiSection: vi.fn(() => <div data-testid="sales-kpi-section">Sales KPIs</div>),
}));

vi.mock('@/components/dashboard/vmi-kpi-section', () => ({
  VMIKpiSection: vi.fn(() => <div data-testid="vmi-kpi-section">VMI KPIs</div>),
}));

vi.mock('@/components/dashboard/gmp-kpi-section', () => ({
  GMPKpiSection: vi.fn(() => <div data-testid="gmp-kpi-section">GMP KPIs</div>),
}));

// Mock UI components
vi.mock('@/components/ui/card', () => ({
  Card: vi.fn(({ children, title, description }) => (
    <div data-testid="card">
      {title && <h2>{title}</h2>}
      {description && <p>{description}</p>}
      {children}
    </div>
  )),
  CardContent: vi.fn(({ children, className }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  )),
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: vi.fn(({ width, height }) => (
    <div data-testid="skeleton" style={{ width, height }} className="skeleton" />
  )),
}));

// Import component after mocks
import { ModuleKpiTabs } from '@/components/dashboard/module-kpi-tabs';

// Mock data
const mockData: DashboardModuleKpis = {
  hr: {
    totalEmployees: 50,
    activeEmployees: 45,
    trainingCompliance: 85,
    healthRecordsDue: 3,
    gmpAuthorized: 20,
    pendingNotifications: 5,
  },
  purchase: {
    pendingPOs: 10,
    approvedPOs: 25,
    poValueMtd: 500000,
    activeVendors: 15,
    onTimeDeliveryRate: 92,
    avlCoverage: 75,
  },
  sales: {
    pendingSOs: 8,
    soValueMtd: 750000,
    ordersFulfilledMtd: 42,
    atpShortages: 2,
    fulfillmentRate: 88,
  },
  vmi: {
    vmiItems: 30,
    lastSyncTime: '2025-12-25T10:00:00Z',
    stockBelowReorder: 5,
    pendingAsns: 3,
    outstandingOrderValue: 150000,
  },
  gmp: {
    overallScore: 92,
    openDeviations: 2,
    openCapas: 1,
    openAuditFindings: 3,
    trainingGaps: 4,
  },
  generatedAt: '2025-12-25T12:00:00Z',
};

describe('ModuleKpiTabs', () => {
  it('renders loading skeleton when isLoading is true', () => {
    render(<ModuleKpiTabs data={null} isLoading={true} />);

    // Should show skeleton elements
    const skeletons = screen.getAllByTestId('skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('returns null when data is null and not loading', () => {
    const { container } = render(<ModuleKpiTabs data={null} isLoading={false} />);

    // Container should be empty
    expect(container.firstChild).toBeNull();
  });

  it('renders HR KPIs correctly with mock data', () => {
    render(<ModuleKpiTabs data={mockData} isLoading={false} />);

    // Should render HR KPI section with correct data
    expect(screen.getByTestId('hr-kpi-section')).toBeInTheDocument();
    expect(screen.getByText('Total Employees')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
  });

  it('renders all 5 tab titles from translations', () => {
    render(<ModuleKpiTabs data={mockData} isLoading={false} />);

    // All 5 tabs should be visible (English translations from locale JSON)
    expect(screen.getByText('HR / Personnel')).toBeInTheDocument();
    expect(screen.getByText('Purchasing')).toBeInTheDocument();
    expect(screen.getByText('Sales')).toBeInTheDocument();
    expect(screen.getByText('VMI')).toBeInTheDocument();
    expect(screen.getByText('GMP Compliance')).toBeInTheDocument();
  });

  it('renders Card with translated title and description', () => {
    render(<ModuleKpiTabs data={mockData} isLoading={false} />);

    // Card title + description come from dashboard.moduleKpis.cardTitle/cardDescription
    expect(screen.getByText('Module KPIs')).toBeInTheDocument();
    expect(
      screen.getByText('Performance indicators broken down by module'),
    ).toBeInTheDocument();
  });

  it('renders TabPanel when data is available', () => {
    render(<ModuleKpiTabs data={mockData} isLoading={false} />);

    expect(screen.getByTestId('tab-panel')).toBeInTheDocument();
    expect(screen.getByTestId('tab-headers')).toBeInTheDocument();
    expect(screen.getByTestId('tab-content')).toBeInTheDocument();
  });

  it('renders correct number of tab headers', () => {
    render(<ModuleKpiTabs data={mockData} isLoading={false} />);

    // Should have 5 tabs (HR, Purchase, Sales, VMI, GMP)
    expect(screen.getByTestId('tab-header-hr')).toBeInTheDocument();
    expect(screen.getByTestId('tab-header-purchase')).toBeInTheDocument();
    expect(screen.getByTestId('tab-header-sales')).toBeInTheDocument();
    expect(screen.getByTestId('tab-header-vmi')).toBeInTheDocument();
    expect(screen.getByTestId('tab-header-gmp')).toBeInTheDocument();
  });

  describe('Flicker/ghost regression (tab switching)', () => {
    // User reported visual ghosting when clicking a new tab (e.g. clicking
    // "Sales" caused the previous tab body to flash over the new one). Root
    // causes were (a) DevExtreme's cross-fade animation, and (b) render
    // callbacks being recreated every render. These tests lock in the fix.

    it('disables TabPanel cross-fade animation to prevent visual overlap', () => {
      render(<ModuleKpiTabs data={mockData} isLoading={false} />);
      const panel = screen.getByTestId('tab-panel');
      expect(panel).toHaveAttribute('data-animation-enabled', 'false');
    });

    it('enables deferred rendering so inactive tab bodies stay unmounted', () => {
      render(<ModuleKpiTabs data={mockData} isLoading={false} />);
      const panel = screen.getByTestId('tab-panel');
      expect(panel).toHaveAttribute('data-defer-rendering', 'true');
    });

    it('keeps TabPanel render-prop references stable across re-renders', async () => {
      // When renderTabTitle / renderItem are recreated on every parent render,
      // DevExtreme re-renders all 5 tabs → ghost overlay. Asserting the mock
      // was called with the SAME function reference across renders proves
      // the useCallback fix holds.
      const mod = await import('devextreme-react/tab-panel');
      const TabPanelMock = mod.default as unknown as ReturnType<typeof vi.fn>;
      TabPanelMock.mockClear();

      const { rerender } = render(
        <ModuleKpiTabs data={mockData} isLoading={false} />,
      );
      const firstCallProps = TabPanelMock.mock.calls[0]?.[0] as {
        itemRender: unknown;
        itemTitleRender: unknown;
      };

      // Re-render with same props — render callbacks should be memoized.
      rerender(<ModuleKpiTabs data={mockData} isLoading={false} />);
      const secondCallProps = TabPanelMock.mock.calls.at(-1)?.[0] as {
        itemRender: unknown;
        itemTitleRender: unknown;
      };

      expect(secondCallProps.itemRender).toBe(firstCallProps.itemRender);
      expect(secondCallProps.itemTitleRender).toBe(
        firstCallProps.itemTitleRender,
      );
    });
  });
});
