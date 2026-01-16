/**
 * Executive Dashboard Components Tests
 * Feature: 014-unit-cost (Tasks 9-14)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders, clearFetchMock } from '../../../helpers/ui-test-utils';
import { KPICard } from '@/components/cost/KPICard';
import { FinancialHealthSection } from '@/components/cost/FinancialHealthSection';
import { MaterialCostSection } from '@/components/cost/MaterialCostSection';
import { ProductionCostSection } from '@/components/cost/ProductionCostSection';
import { MarginAnalysisSection } from '@/components/cost/MarginAnalysisSection';
import { AlertsSection } from '@/components/cost/AlertsSection';
import { Package, DollarSign } from 'lucide-react';
import type {
  KPIValue,
  FinancialHealthKPIs,
  MaterialCostKPIs,
  ProductionCostKPIs,
  MarginKPIs,
  CostAlert,
  TrendDataPoint,
  MoMComparisonRow,
} from '@/types/unit-cost';

// Mock recharts to avoid rendering issues in tests
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

// ============================================
// Mock Data
// ============================================

const mockKPIValue: KPIValue = {
  current: 5000000,
  prior: 4500000,
  budget: 5200000,
  changePercent: 11.1,
  changeDirection: 'up',
  status: 'good',
};

const mockKPIValueWarning: KPIValue = {
  current: 100000,
  prior: 80000,
  budget: 70000,
  changePercent: 25,
  changeDirection: 'up',
  status: 'warning',
};

const mockKPIValueCritical: KPIValue = {
  current: 50000,
  prior: 30000,
  budget: 25000,
  changePercent: 66.7,
  changeDirection: 'up',
  status: 'critical',
};

const mockKPIValueFlat: KPIValue = {
  current: 35,
  prior: 35,
  budget: 35,
  changePercent: 0,
  changeDirection: 'flat',
  status: 'neutral',
};

const mockFinancialHealthData: FinancialHealthKPIs = {
  inventoryValue: mockKPIValue,
  cogsMTD: { ...mockKPIValue, current: 2000000, prior: 1800000, changePercent: 11.1 },
  grossMarginPercent: { current: 35.5, prior: 34.0, budget: 36.0, changePercent: 4.4, changeDirection: 'up', status: 'good' },
  netCostVariance: { current: 10000, prior: 15000, budget: 0, changePercent: -33.3, changeDirection: 'down', status: 'good' },
  inventoryByCategory: [
    { category: 'Raw Materials', value: 2000000, percent: 40, change: 5 },
    { category: 'Finished Goods', value: 2500000, percent: 50, change: 10 },
    { category: 'WIP', value: 500000, percent: 10, change: 2 },
  ],
};

const mockMaterialCostData: MaterialCostKPIs = {
  purchasesMTD: { current: 1500000, prior: 1400000, budget: 1600000, changePercent: 7.1, changeDirection: 'up', status: 'good' },
  landedCostPercent: { current: 8.5, prior: 9.0, budget: 8.0, changePercent: -5.6, changeDirection: 'down', status: 'good' },
  avgMaterialCostChange: { current: 3.2, prior: 2.5, budget: 2.0, changePercent: 28, changeDirection: 'up', status: 'warning' },
  inventoryTurnover: { current: 4.5, prior: 4.2, budget: 5.0, changePercent: 7.1, changeDirection: 'up', status: 'good' },
  daysInventoryOutstanding: { current: 81, prior: 87, budget: 73, changePercent: -6.9, changeDirection: 'down', status: 'good' },
  topCostIncreases: [
    { itemId: 1, itemCode: 'RAW-001', itemName: 'Raw Herb A', previousCost: 45, currentCost: 52, changePercent: 15.5 },
    { itemId: 2, itemCode: 'RAW-002', itemName: 'Raw Herb B', previousCost: 30, currentCost: 33, changePercent: 10.0 },
  ],
  purchasesBySupplier: [
    { supplierId: 1, supplierName: 'Vendor Alpha', amount: 750000, percent: 50 },
    { supplierId: 2, supplierName: 'Vendor Beta', amount: 450000, percent: 30 },
    { supplierId: 3, supplierName: 'Vendor Gamma', amount: 300000, percent: 20 },
  ],
};

const mockProductionCostData: ProductionCostKPIs = {
  wipValue: { current: 750000, prior: 700000, budget: 800000, changePercent: 7.1, changeDirection: 'up', status: 'good' },
  productionCostMTD: { current: 1800000, prior: 1700000, budget: 1900000, changePercent: 5.9, changeDirection: 'up', status: 'good' },
  laborEfficiency: { current: 92, prior: 88, budget: 95, changePercent: 4.5, changeDirection: 'up', status: 'good' },
  overheadAbsorption: { current: 98, prior: 97, budget: 100, changePercent: 1.0, changeDirection: 'up', status: 'good' },
  avgUnitCost: { current: 145.50, prior: 142.00, budget: 140.00, changePercent: 2.5, changeDirection: 'up', status: 'warning' },
  productionVariance: { current: 5000, prior: 8000, budget: 0, changePercent: -37.5, changeDirection: 'down', status: 'good' },
  costBreakdown: { material: 1200000, labor: 400000, overhead: 200000 },
  byWorkCenter: [
    { workCenterId: 1, workCenterName: 'Mixing Station 1', laborCost: 200000, overheadCost: 100000, efficiency: 95 },
    { workCenterId: 2, workCenterName: 'Filling Line A', laborCost: 150000, overheadCost: 80000, efficiency: 88 },
    { workCenterId: 3, workCenterName: 'Packaging Station', laborCost: 50000, overheadCost: 20000, efficiency: 92 },
  ],
};

const mockMarginData: MarginKPIs = {
  revenueMTD: { current: 3500000, prior: 3200000, budget: 3800000, changePercent: 9.4, changeDirection: 'up', status: 'good' },
  grossProfitMTD: { current: 1242500, prior: 1088000, budget: 1368000, changePercent: 14.2, changeDirection: 'up', status: 'good' },
  marginByCategory: [
    { category: 'Herbal Extracts', revenue: 2000000, cogs: 1200000, margin: 800000, marginPercent: 40, change: 5 },
    { category: 'Capsules', revenue: 1000000, cogs: 650000, margin: 350000, marginPercent: 35, change: 3 },
    { category: 'Tablets', revenue: 500000, cogs: 400000, margin: 100000, marginPercent: 20, change: -2 },
  ],
  marginErosion: [
    { itemId: 3, itemCode: 'PROD-003', itemName: 'Product C', previousMargin: 35, currentMargin: 28, changePercent: -20 },
    { itemId: 4, itemCode: 'PROD-004', itemName: 'Product D', previousMargin: 30, currentMargin: 25, changePercent: -16.7 },
  ],
  topMarginProducts: [
    { itemId: 1, itemCode: 'PROD-001', itemName: 'Product A', marginPercent: 45 },
    { itemId: 2, itemCode: 'PROD-002', itemName: 'Product B', marginPercent: 42 },
  ],
};

const mockAlerts: CostAlert[] = [
  { id: 'alert-1', severity: 'critical', category: 'cost', title: 'Material cost spike', description: 'RAW-001 increased 15%', value: 52, threshold: 48 },
  { id: 'alert-2', severity: 'warning', category: 'variance', title: 'Labor variance high', description: 'Mixing Station exceeds budget', value: 12000, threshold: 10000 },
  { id: 'alert-3', severity: 'info', category: 'margin', title: 'Margin opportunity', description: 'Product X margin improved', value: 40, threshold: 35 },
];

const mockTrends: TrendDataPoint[] = [
  { period: '2025-08', grossMargin: 34, avgUnitCost: 142 },
  { period: '2025-09', grossMargin: 34.5, avgUnitCost: 143 },
  { period: '2025-10', grossMargin: 35, avgUnitCost: 144 },
  { period: '2025-11', grossMargin: 35.2, avgUnitCost: 144.5 },
  { period: '2025-12', grossMargin: 35.3, avgUnitCost: 145 },
  { period: '2026-01', grossMargin: 35.5, avgUnitCost: 145.5 },
];

const mockMoMComparison: MoMComparisonRow[] = [
  { metric: 'Inventory Value', thisMonth: 5000000, lastMonth: 4800000, change: 200000, changePercent: 4.2, unit: 'currency' },
  { metric: 'Gross Margin', thisMonth: 35.5, lastMonth: 35.0, change: 0.5, changePercent: 1.4, unit: 'percent' },
  { metric: 'Days Inventory', thisMonth: 81, lastMonth: 87, change: -6, changePercent: -6.9, unit: 'days' },
  { metric: 'Turnover Ratio', thisMonth: 4.5, lastMonth: 4.2, change: 0.3, changePercent: 7.1, unit: 'number' },
];

// ============================================
// Tests
// ============================================

describe('KPICard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFetchMock();
  });

  it('should render with title and value', () => {
    renderWithProviders(
      <KPICard
        title="Inventory Value"
        icon={<Package className="h-6 w-6 text-blue-600" />}
        kpi={mockKPIValue}
        format="currency"
      />
    );

    expect(screen.getByTestId('kpi-card-inventory-value')).toBeInTheDocument();
    expect(screen.getByText('Inventory Value')).toBeInTheDocument();
  });

  it('should format currency correctly', () => {
    renderWithProviders(
      <KPICard
        title="Test Currency"
        icon={<DollarSign className="h-6 w-6" />}
        kpi={mockKPIValue}
        format="currency"
      />
    );

    // Check that currency is displayed (Thai Baht format)
    const card = screen.getByTestId('kpi-card-test-currency');
    expect(card).toBeInTheDocument();
  });

  it('should format percent correctly', () => {
    renderWithProviders(
      <KPICard
        title="Gross Margin"
        icon={<Package className="h-6 w-6" />}
        kpi={{ ...mockKPIValue, current: 35.5 }}
        format="percent"
      />
    );

    expect(screen.getByText('35.5%')).toBeInTheDocument();
  });

  it('should format number correctly', () => {
    renderWithProviders(
      <KPICard
        title="Turnover"
        icon={<Package className="h-6 w-6" />}
        kpi={{ ...mockKPIValue, current: 4.5 }}
        format="number"
      />
    );

    expect(screen.getByText('4.5')).toBeInTheDocument();
  });

  it('should show change percentage and direction', () => {
    renderWithProviders(
      <KPICard
        title="Test KPI"
        icon={<Package className="h-6 w-6" />}
        kpi={mockKPIValue}
        format="currency"
      />
    );

    expect(screen.getByText('+11.1% vs prior')).toBeInTheDocument();
  });

  it('should expand when expandable and clicked', () => {
    renderWithProviders(
      <KPICard
        title="Expandable KPI"
        icon={<Package className="h-6 w-6" />}
        kpi={mockKPIValue}
        format="currency"
        expandable
      >
        <div data-testid="expanded-content">Expanded Content</div>
      </KPICard>
    );

    // Initially expanded content should not be visible
    expect(screen.queryByTestId('expanded-content')).not.toBeInTheDocument();

    // Click to expand
    fireEvent.click(screen.getByTestId('kpi-card-expandable-kpi'));

    // Expanded content should now be visible
    expect(screen.getByTestId('expanded-content')).toBeInTheDocument();
    expect(screen.getByText('Expanded Content')).toBeInTheDocument();
  });

  it('should apply correct status colors', () => {
    const { rerender } = renderWithProviders(
      <KPICard
        title="Good Status"
        icon={<Package className="h-6 w-6" />}
        kpi={mockKPIValue}
        format="currency"
      />
    );

    expect(screen.getByTestId('kpi-card-good-status')).toBeInTheDocument();

    rerender(
      <KPICard
        title="Warning Status"
        icon={<Package className="h-6 w-6" />}
        kpi={mockKPIValueWarning}
        format="currency"
      />
    );

    expect(screen.getByTestId('kpi-card-warning-status')).toBeInTheDocument();
  });
});

describe('FinancialHealthSection Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFetchMock();
  });

  it('should render section with all KPI cards', () => {
    renderWithProviders(<FinancialHealthSection data={mockFinancialHealthData} />);

    expect(screen.getByTestId('financial-health-section')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-card-inventory-value')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-card-cogs-mtd')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-card-gross-margin')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-card-cost-variance')).toBeInTheDocument();
  });

  it('should show inventory by category when expanded', () => {
    renderWithProviders(<FinancialHealthSection data={mockFinancialHealthData} />);

    // Click to expand inventory value card
    fireEvent.click(screen.getByTestId('kpi-card-inventory-value'));

    // Check categories are displayed
    expect(screen.getByText('Raw Materials')).toBeInTheDocument();
    expect(screen.getByText('Finished Goods')).toBeInTheDocument();
    expect(screen.getByText('WIP')).toBeInTheDocument();
  });
});

describe('MaterialCostSection Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFetchMock();
  });

  it('should render section with all KPI cards', () => {
    renderWithProviders(<MaterialCostSection data={mockMaterialCostData} />);

    expect(screen.getByTestId('material-cost-section')).toBeInTheDocument();
    expect(screen.getByText('Material Cost Analysis')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-card-purchases-mtd')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-card-landed-cost-%')).toBeInTheDocument();
  });

  it('should display top cost increases', () => {
    renderWithProviders(<MaterialCostSection data={mockMaterialCostData} />);

    expect(screen.getByText('Top Cost Increases')).toBeInTheDocument();
    expect(screen.getByText('RAW-001')).toBeInTheDocument();
    expect(screen.getByText('+15.5%')).toBeInTheDocument();
  });

  it('should display purchases by supplier', () => {
    renderWithProviders(<MaterialCostSection data={mockMaterialCostData} />);

    expect(screen.getByText('Purchases by Supplier')).toBeInTheDocument();
    expect(screen.getByText('Vendor Alpha')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('should show empty state when no cost increases', () => {
    renderWithProviders(
      <MaterialCostSection
        data={{ ...mockMaterialCostData, topCostIncreases: [] }}
      />
    );

    expect(screen.getByText('No significant increases')).toBeInTheDocument();
  });
});

describe('ProductionCostSection Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFetchMock();
  });

  it('should render section with all KPI cards', () => {
    renderWithProviders(<ProductionCostSection data={mockProductionCostData} />);

    expect(screen.getByTestId('production-cost-section')).toBeInTheDocument();
    expect(screen.getByText('Production Cost Analysis')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-card-wip-value')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-card-labor-eff-%')).toBeInTheDocument();
  });

  it('should display cost breakdown with percentages', () => {
    renderWithProviders(<ProductionCostSection data={mockProductionCostData} />);

    expect(screen.getByText('Cost Breakdown (MTD)')).toBeInTheDocument();
    expect(screen.getByText('Material')).toBeInTheDocument();
    expect(screen.getByText('Labor')).toBeInTheDocument();
    expect(screen.getByText('Overhead')).toBeInTheDocument();
  });

  it('should display work center data with efficiency', () => {
    renderWithProviders(<ProductionCostSection data={mockProductionCostData} />);

    expect(screen.getByText('By Work Center')).toBeInTheDocument();
    expect(screen.getByText('Mixing Station 1')).toBeInTheDocument();
    expect(screen.getByText('95%')).toBeInTheDocument();
    expect(screen.getByText('88%')).toBeInTheDocument();
  });

  it('should show empty state when no work center data', () => {
    renderWithProviders(
      <ProductionCostSection data={{ ...mockProductionCostData, byWorkCenter: [] }} />
    );

    expect(screen.getByText('No work center data')).toBeInTheDocument();
  });
});

describe('MarginAnalysisSection Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFetchMock();
  });

  it('should render section with revenue and profit KPIs', () => {
    renderWithProviders(<MarginAnalysisSection data={mockMarginData} />);

    expect(screen.getByTestId('margin-analysis-section')).toBeInTheDocument();
    expect(screen.getByText('Margin Analysis')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-card-revenue-mtd')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-card-gross-profit-mtd')).toBeInTheDocument();
  });

  it('should display margin by category table', () => {
    renderWithProviders(<MarginAnalysisSection data={mockMarginData} />);

    expect(screen.getByText('Margin by Category')).toBeInTheDocument();
    expect(screen.getByText('Herbal Extracts')).toBeInTheDocument();
    expect(screen.getByText('Capsules')).toBeInTheDocument();
  });

  it('should display margin erosion items', () => {
    renderWithProviders(<MarginAnalysisSection data={mockMarginData} />);

    expect(screen.getByText('Margin Erosion')).toBeInTheDocument();
    expect(screen.getByText('PROD-003')).toBeInTheDocument();
    expect(screen.getByText('-20.0%')).toBeInTheDocument();
  });

  it('should display top margin products', () => {
    renderWithProviders(<MarginAnalysisSection data={mockMarginData} />);

    expect(screen.getByText('Top Margin Products')).toBeInTheDocument();
    expect(screen.getByText('PROD-001')).toBeInTheDocument();
    expect(screen.getByText('45.0%')).toBeInTheDocument();
  });
});

describe('AlertsSection Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFetchMock();
  });

  it('should render section with alerts count', () => {
    renderWithProviders(
      <AlertsSection
        alerts={mockAlerts}
        trends={mockTrends}
        momComparison={mockMoMComparison}
      />
    );

    expect(screen.getByTestId('alerts-section')).toBeInTheDocument();
    expect(screen.getByText('Active Alerts (3)')).toBeInTheDocument();
  });

  it('should display critical alerts', () => {
    renderWithProviders(
      <AlertsSection
        alerts={mockAlerts}
        trends={mockTrends}
        momComparison={mockMoMComparison}
      />
    );

    expect(screen.getByText('Critical (1)')).toBeInTheDocument();
    expect(screen.getByText('Material cost spike')).toBeInTheDocument();
    expect(screen.getByText('RAW-001 increased 15%')).toBeInTheDocument();
  });

  it('should display warning alerts', () => {
    renderWithProviders(
      <AlertsSection
        alerts={mockAlerts}
        trends={mockTrends}
        momComparison={mockMoMComparison}
      />
    );

    expect(screen.getByText('Warning (1)')).toBeInTheDocument();
    expect(screen.getByText('Labor variance high')).toBeInTheDocument();
  });

  it('should render trend chart', () => {
    renderWithProviders(
      <AlertsSection
        alerts={mockAlerts}
        trends={mockTrends}
        momComparison={mockMoMComparison}
      />
    );

    expect(screen.getByText('6-Month Trend')).toBeInTheDocument();
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });

  it('should display MoM comparison table', () => {
    renderWithProviders(
      <AlertsSection
        alerts={mockAlerts}
        trends={mockTrends}
        momComparison={mockMoMComparison}
      />
    );

    expect(screen.getByText('Month-over-Month Comparison')).toBeInTheDocument();
    expect(screen.getByText('Inventory Value')).toBeInTheDocument();
    expect(screen.getByText('Gross Margin')).toBeInTheDocument();
    expect(screen.getByText('Days Inventory')).toBeInTheDocument();
  });

  it('should show empty state when no alerts', () => {
    renderWithProviders(
      <AlertsSection
        alerts={[]}
        trends={mockTrends}
        momComparison={mockMoMComparison}
      />
    );

    expect(screen.getByText('No active alerts')).toBeInTheDocument();
  });

  it('should show empty state when no trends', () => {
    renderWithProviders(
      <AlertsSection
        alerts={mockAlerts}
        trends={[]}
        momComparison={mockMoMComparison}
      />
    );

    expect(screen.getByText('No trend data')).toBeInTheDocument();
  });
});
