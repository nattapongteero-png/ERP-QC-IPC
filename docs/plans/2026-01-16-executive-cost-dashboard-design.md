# Executive Cost Dashboard Design

**Date**: 2026-01-16
**Feature**: 014-unit-cost enhancement
**Status**: Approved for implementation

## Overview

Redesign the `/cost` dashboard to provide CFO/Finance Director with comprehensive cost management KPIs for monthly close decision-making. The dashboard covers material costs, production costs, and margin analysis with one-level drill-down capability.

**Research Sources**:
- [insightsoftware - Manufacturing KPIs](https://insightsoftware.com/blog/30-manufacturing-kpis-and-metric-examples/)
- [NetSuite - CFO KPIs](https://www.netsuite.com/portal/resource/articles/accounting/cfo-kpis.shtml)
- [CloudZero - CFO Dashboards](https://www.cloudzero.com/blog/cfo-dashboards/)

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Primary Audience | CFO/Finance Director | Focus on cost control, margins, variances |
| Timeframe | Monthly close focus | Period comparisons, budget variance |
| Cost Categories | All three (Material, Production, Margins) | Comprehensive view |
| Drill-down | One-level expandable | Clean UI with quick exploration |
| Total KPIs | 20 | Within recommended 15-25 range |

## Dashboard Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│  HEADER: Period Selector (This Month / Last Month / Custom)        │
├─────────────────────────────────────────────────────────────────────┤
│  SECTION 1: Financial Health KPIs (4 cards)                        │
│  [Inventory Value] [COGS MTD] [Gross Margin %] [Cost Variance]     │
├─────────────────────────────────────────────────────────────────────┤
│  SECTION 2: Material Cost Analysis (expandable)                    │
│  Procurement spend, landed cost %, top supplier costs              │
├─────────────────────────────────────────────────────────────────────┤
│  SECTION 3: Production Cost Analysis (expandable)                  │
│  WIP value, labor efficiency, overhead absorption, unit costs      │
├─────────────────────────────────────────────────────────────────────┤
│  SECTION 4: Margin Analysis (expandable)                           │
│  Revenue vs COGS, margin by product category, margin erosion       │
├─────────────────────────────────────────────────────────────────────┤
│  SECTION 5: Alerts & Trends                                        │
│  Cost increases, variance alerts, 6-month trend chart              │
└─────────────────────────────────────────────────────────────────────┘
```

## Section 1: Financial Health KPIs

Primary KPIs visible immediately upon dashboard load.

| KPI | Formula | Display | Drill-Down |
|-----|---------|---------|------------|
| **Total Inventory Value** | SUM(items.onHand × items.currentWAC) | ฿12.5M (+2.3% vs LM) | By category: Raw Materials, Packaging, WIP, Finished Goods |
| **COGS MTD** | SUM(salesOrderLines.totalCost) for current month | ฿8.2M (95% of budget) | By product category, top 10 products |
| **Gross Margin %** | (Revenue - COGS) / Revenue × 100 | 34.2% (▼1.1% vs LM) | By product category, by customer segment |
| **Net Cost Variance** | Favorable - Unfavorable variances | ฿-125K unfavorable | By variance type: Material, Labor, Overhead |

**Card Design**:
```
┌────────────────────────────────────┐
│ 📦 Total Inventory Value           │
│ ฿12,534,000                        │
│ ▲ +2.3% vs Last Month              │
│ Budget: ฿12.0M (104.5%)            │
│ [Click to expand ▼]                │
└────────────────────────────────────┘
```

## Section 2: Material Cost Analysis

| KPI | Formula | Why It Matters |
|-----|---------|----------------|
| **Purchases MTD** | SUM(PO receipts value) this month | Cash outflow for materials |
| **Landed Cost %** | Total landed costs / Total PO value × 100 | Hidden costs visibility |
| **Avg Material Cost Change** | (Current avg WAC - Prior avg WAC) / Prior × 100 | Price inflation tracking |
| **Inventory Turnover** | COGS (12mo) / Avg Inventory Value | Working capital efficiency |
| **Days Inventory Outstanding** | (Avg Inventory / COGS) × 365 | Cash conversion component |

**Expandable Details**:
1. Purchases by Supplier - Top 10 suppliers by spend
2. Landed Cost Breakdown - Freight vs Duty vs Insurance vs Handling

## Section 3: Production Cost Analysis

| KPI | Formula | Why It Matters |
|-----|---------|----------------|
| **WIP Value** | SUM(open work orders costs) | Capital tied up in production |
| **Production Cost MTD** | SUM(completed WO total costs) | Manufacturing spend tracking |
| **Labor Efficiency %** | (Standard hours / Actual hours) × 100 | Workforce productivity |
| **Overhead Absorption %** | (Applied overhead / Budgeted overhead) × 100 | Fixed cost recovery |
| **Avg Unit Cost** | Total production cost / Total units produced | Cost per unit trend |
| **Production Variance** | Standard cost - Actual cost | Budget adherence |

**Visual Elements**:
- Cost breakdown bar (Material 60% / Labor 25% / Overhead 15%)
- Expandable: By Work Center, Top Variance Work Orders

## Section 4: Margin Analysis

| KPI | Formula | Why It Matters |
|-----|---------|----------------|
| **Revenue MTD** | SUM(shipped SO line revenue) | Top-line reference |
| **COGS MTD** | SUM(shipped SO line costs) | Direct cost of sales |
| **Gross Profit MTD** | Revenue - COGS | Absolute profit dollars |
| **Gross Margin %** | (Gross Profit / Revenue) × 100 | Primary profitability |
| **Margin vs Prior Month** | Current GM% - Prior GM% | Trend direction |
| **Margin vs Budget** | Actual GM% - Budget GM% | Plan adherence |

**Visual Elements**:
- P&L Summary box (Revenue → COGS → Gross Profit)
- Margin by Category table
- Margin Erosion Alert list (products losing margin)
- Top Margin Products list

## Section 5: Alerts & Trends

### Alert Types

| Alert Type | Critical | Warning | Info |
|------------|----------|---------|------|
| Cost Increase | >15% | >5% | >2% |
| Variance | >20% | >10% | >5% |
| Margin Drop | >5% | >3% | >1% |
| Days Inventory | >120 days | >90 days | >60 days |

### Visual Elements
- Active Alerts panel (grouped by severity)
- 6-Month Trend charts (Gross Margin %, Avg Unit Cost)
- Month-over-Month comparison table

## Complete KPI List (20 Total)

### Section 1: Financial Health (4)
1. Total Inventory Value
2. COGS MTD
3. Gross Margin %
4. Net Cost Variance

### Section 2: Material Costs (5)
5. Purchases MTD
6. Landed Cost %
7. Avg Material Cost Change
8. Inventory Turnover
9. Days Inventory Outstanding

### Section 3: Production Costs (6)
10. WIP Value
11. Production Cost MTD
12. Labor Efficiency %
13. Overhead Absorption %
14. Avg Unit Cost
15. Production Variance

### Section 4: Margins (3)
16. Revenue MTD
17. Gross Profit MTD
18. Margin by Category

### Section 5: Alerts & Trends (2)
19. Active Alert Count
20. MoM Trend Indicators

## Data Sources

| KPI | Primary Table | Join Tables |
|-----|---------------|-------------|
| Inventory Value | `items` | - |
| COGS MTD | `salesOrderLines` | `salesOrders` |
| Purchases MTD | `purchaseOrderLines` | `purchaseOrders`, `grns` |
| Landed Cost % | `landedCostAllocations` | `landedCostHeaders` |
| WIP Value | `workOrderCosts` | `workOrders` |
| Labor Efficiency | `workOrderOperations` | `workOrders` |
| Margin by Category | `salesOrderLines` | `items`, `itemCategories` |

## Technical Implementation

### Components to Create/Modify

| Component | Action | Description |
|-----------|--------|-------------|
| `src/app/cost/page.tsx` | MODIFY | Add period selector, restructure layout |
| `src/components/cost/CostDashboard.tsx` | REWRITE | New 5-section layout |
| `src/components/cost/KPICard.tsx` | NEW | Expandable KPI card component |
| `src/components/cost/MaterialCostSection.tsx` | NEW | Section 2 component |
| `src/components/cost/ProductionCostSection.tsx` | NEW | Section 3 component |
| `src/components/cost/MarginAnalysisSection.tsx` | NEW | Section 4 component |
| `src/components/cost/AlertsSection.tsx` | NEW | Section 5 component |
| `src/components/cost/TrendChart.tsx` | NEW | Reusable trend chart |

### API Endpoints to Create/Modify

| Endpoint | Action | Description |
|----------|--------|-------------|
| `GET /api/cost/dashboard` | MODIFY | Return all 20 KPIs with drill-down data |
| `GET /api/cost/dashboard/materials` | NEW | Material cost section data |
| `GET /api/cost/dashboard/production` | NEW | Production cost section data |
| `GET /api/cost/dashboard/margins` | NEW | Margin analysis section data |
| `GET /api/cost/dashboard/alerts` | NEW | Active alerts with thresholds |

### Service Functions to Add

| Function | Location | Description |
|----------|----------|-------------|
| `getExecutiveDashboardKPIs()` | `unit-cost.service.ts` | Master function for all KPIs |
| `getMaterialCostKPIs()` | `unit-cost.service.ts` | Section 2 KPIs |
| `getProductionCostKPIs()` | `unit-cost.service.ts` | Section 3 KPIs |
| `getMarginAnalysisKPIs()` | `unit-cost.service.ts` | Section 4 KPIs |
| `getCostAlerts()` | `unit-cost.service.ts` | Alert detection logic |
| `getInventoryTurnover()` | `unit-cost.service.ts` | Turnover calculation |
| `getLaborEfficiency()` | `unit-cost.service.ts` | Labor efficiency calc |

### Types to Add

```typescript
// Add to src/types/unit-cost.ts

interface ExecutiveDashboardKPIs {
  period: { from: string; to: string; label: string };
  priorPeriod: { from: string; to: string; label: string };

  // Section 1: Financial Health
  financialHealth: {
    inventoryValue: KPIValue;
    cogsMTD: KPIValue;
    grossMarginPercent: KPIValue;
    netCostVariance: KPIValue;
  };

  // Section 2: Material Costs
  materialCosts: {
    purchasesMTD: KPIValue;
    landedCostPercent: KPIValue;
    avgMaterialCostChange: KPIValue;
    inventoryTurnover: KPIValue;
    daysInventoryOutstanding: KPIValue;
    topCostIncreases: ItemCostChange[];
  };

  // Section 3: Production Costs
  productionCosts: {
    wipValue: KPIValue;
    productionCostMTD: KPIValue;
    laborEfficiency: KPIValue;
    overheadAbsorption: KPIValue;
    avgUnitCost: KPIValue;
    productionVariance: KPIValue;
    costBreakdown: { material: number; labor: number; overhead: number };
  };

  // Section 4: Margins
  margins: {
    revenueMTD: KPIValue;
    grossProfitMTD: KPIValue;
    marginByCategory: MarginByCategoryRow[];
    marginErosion: ItemMarginChange[];
    topMarginProducts: ItemMarginRow[];
  };

  // Section 5: Alerts & Trends
  alerts: CostAlert[];
  trends: {
    grossMargin: TrendPoint[];
    avgUnitCost: TrendPoint[];
  };
  momComparison: MoMComparisonRow[];
}

interface KPIValue {
  current: number;
  prior: number;
  budget: number | null;
  changePercent: number;
  changeDirection: 'up' | 'down' | 'flat';
  status: 'good' | 'warning' | 'critical' | 'neutral';
}

interface CostAlert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  category: 'cost' | 'variance' | 'margin' | 'inventory';
  title: string;
  description: string;
  metric: string;
  value: number;
  threshold: number;
  entityType?: string;
  entityId?: number;
  createdAt: string;
}

interface MoMComparisonRow {
  metric: string;
  thisMonth: number;
  lastMonth: number;
  change: number;
  changePercent: number;
  unit: 'currency' | 'percent' | 'number' | 'days';
}
```

## UI/UX Specifications

### Period Selector
- Default: Current month
- Presets: This Month, Last Month, This Quarter, Last Quarter, YTD
- Custom range picker for ad-hoc analysis

### KPI Cards
- Expandable on click (accordion behavior)
- Color-coded change indicators (green up good, red up bad for costs)
- Tooltip with calculation explanation

### Responsive Behavior
- Desktop (1920px): All sections visible, 4 cards per row
- Tablet (768-1024px): 2 cards per row, sections stack
- Mobile (320-767px): 1 card per row, simplified charts

### Performance Targets
- Initial load: < 3 seconds
- Period change: < 1 second (cached data)
- Drill-down expand: < 500ms

## Testing Requirements

### Unit Tests
- KPI calculations (WAC, turnover, efficiency)
- Alert threshold logic
- Period date range calculations

### Integration Tests
- Dashboard API endpoint returns all sections
- Period filtering works correctly
- Drill-down data matches summary

### UI Tests
- All 5 sections render without error
- Expandable cards toggle correctly
- Period selector updates data
- Loading states display properly

## Implementation Order

1. **Phase 1: Types & Service Layer**
   - Add new types to `unit-cost.ts`
   - Implement service functions for each section
   - Write unit tests for calculations

2. **Phase 2: API Endpoints**
   - Modify `/api/cost/dashboard` for new structure
   - Add section-specific endpoints if needed
   - Write integration tests

3. **Phase 3: UI Components**
   - Create KPICard component
   - Create section components
   - Create TrendChart component

4. **Phase 4: Dashboard Page**
   - Integrate all sections
   - Add period selector
   - Add responsive behavior

5. **Phase 5: Polish**
   - Loading states
   - Error handling
   - Performance optimization
   - UI tests
