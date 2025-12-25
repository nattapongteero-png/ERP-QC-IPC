/**
 * Unit Tests for ModuleKpiTabs Component
 * Tests the tabbed dashboard KPI component with:
 * - Loading skeleton rendering
 * - Null data handling
 * - HR KPIs rendering with mock data
 * - All tab titles visibility
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { DashboardModuleKpis } from '@/lib/services/dashboard.service';

// Mock DevExtreme TabPanel
vi.mock('devextreme-react/tab-panel', () => ({
  default: vi.fn(({ items, itemTitleRender, itemRender, selectedIndex }) => {
    const currentItem = items?.[selectedIndex] || items?.[0];
    return (
      <div data-testid="tab-panel">
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
  }),
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

  it('renders all tab titles', () => {
    render(<ModuleKpiTabs data={mockData} isLoading={false} />);

    // All 5 tabs should be visible
    expect(screen.getByText('HR / Personnel')).toBeInTheDocument();
    expect(screen.getByText('Purchasing')).toBeInTheDocument();
    expect(screen.getByText('Sales')).toBeInTheDocument();
    expect(screen.getByText('VMI')).toBeInTheDocument();
    expect(screen.getByText('GMP Compliance')).toBeInTheDocument();
  });

  it('renders Card with correct title and description', () => {
    render(<ModuleKpiTabs data={mockData} isLoading={false} />);

    expect(screen.getByText('Module KPIs')).toBeInTheDocument();
    expect(screen.getByText('ตัวชี้วัดประสิทธิภาพแยกตามโมดูล')).toBeInTheDocument();
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
});
