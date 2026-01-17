# Accounting Dashboard Executive Redesign

**Date:** 2026-01-17
**Feature:** 014-unit-cost (branch)
**Target:** `/accounting` dashboard page
**Audience:** Mixed executives (CFO, CEO, Operations Manager, C-suite meetings)

---

## Overview

Redesign the accounting dashboard to provide executive-level insights with actionable metrics, industry-specific KPIs for herbal medicine business, and real-time alerts. The current dashboard shows basic financial data; the new design will support strategic decision-making.

---

## Section 1: Executive Summary KPIs

### Row 1 - Financial Health (CFO Focus)

| KPI | Calculation | Target/Benchmark | Color Coding |
|-----|-------------|------------------|--------------|
| **Working Capital** | Current Assets - Current Liabilities | Positive | Green: >0, Red: <0 |
| **Current Ratio** | Current Assets / Current Liabilities | 1.5 - 2.0 | Green: >1.5, Yellow: 1.0-1.5, Red: <1.0 |
| **Quick Ratio** | (Cash + AR) / Current Liabilities | >1.0 | Green: >1.0, Yellow: 0.7-1.0, Red: <0.7 |
| **DSO (Days Sales Outstanding)** | (AR / Revenue) × 365 | <45 days | Green: <30, Yellow: 30-60, Red: >60 |

### Row 2 - Business Performance (CEO/Ops Focus)

| KPI | Calculation | Target/Benchmark | Color Coding |
|-----|-------------|------------------|--------------|
| **Gross Profit Margin %** | (Revenue - COGS) / Revenue × 100 | >40% | Green: >40%, Yellow: 30-40%, Red: <30% |
| **Operating Cash Flow** | Net cash from operations (YTD) | Positive | Green: >0, Red: <0 |
| **DPO (Days Payable Outstanding)** | (AP / COGS) × 365 | 30-45 days | Green: 30-45, Yellow: 45-60, Red: >60 |
| **Inventory Turnover** | COGS / Average Inventory | >4x annually | Green: >4, Yellow: 2-4, Red: <2 |

### KPI Card Features
- Current value with currency/percentage formatting
- Trend arrow (up/down vs last month)
- Percentage change vs prior period
- Sparkline showing 6-month trend
- Click to drill down to detailed report

---

## Section 2: Executive Charts & Visualizations

### Chart 1: Revenue vs Expenses Trend (Full Width)
- **Type:** Dual-line area chart with bands
- **Data:** 12-month rolling view
- **Series:** Revenue (green), COGS (orange), Operating Expenses (blue), Net Income (purple line)
- **Features:** Hover tooltips, click month to drill down

### Chart 2: Cash Flow Waterfall
- **Type:** Waterfall chart
- **Data:** Current month cash movement
- **Categories:** Opening Cash → Operating Activities → Investing Activities → Financing Activities → Closing Cash
- **Colors:** Green for inflows, Red for outflows, Blue for totals

### Chart 3: Profitability by Product Category
- **Type:** Horizontal bar chart
- **Data:** Gross margin % by product line
- **Categories:** Capsules, Extracts, Teas, Topicals, Other (from item categories)
- **Features:** Sort by margin %, show revenue contribution %

### Chart 4: AP/AR Aging Summary
- **Type:** Grouped bar chart
- **Data:** Current, 1-30, 31-60, 61-90, 90+ days
- **Series:** AR (blue), AP (orange)
- **Features:** Show totals, highlight overdue amounts

### Chart 5: Expense Breakdown
- **Type:** Donut chart with legend
- **Data:** Top expense categories YTD
- **Categories:** Raw Materials, Labor, Utilities, Quality/Compliance, Maintenance, Other
- **Features:** Click segment to view GL details

---

## Section 3: Executive Alerts & Action Items

### Alert Priority Levels

| Priority | Icon | Condition | Auto-Dismiss |
|----------|------|-----------|--------------|
| Critical | 🔴 | Requires immediate action | Never |
| Warning | 🟠 | Needs attention within 7 days | After 30 days |
| Info | 🟡 | Informational | After 7 days |

### Alert Types

| Alert | Priority | Trigger | Threshold | Action Link |
|-------|----------|---------|-----------|-------------|
| Cash Below Threshold | Critical | Cash < X days operating expenses | 30 days | Cash Flow Forecast |
| AR Overdue Critical | Critical | AR > 90 days exceeds amount | ฿500,000 | AR Aging Report |
| AP Overdue (Supplier Risk) | Critical | AP > 60 days with strategic vendors | Any | AP Payment Queue |
| Gross Margin Declining | Warning | GM% dropped vs prior month | >2% drop | Profitability Report |
| Inventory Expiring | Warning | Inventory value expiring soon | 60 days | Expiry Alerts |
| Budget Variance | Warning | GL account over budget | >10% | Variance Report |
| Period Close Pending | Info | Period open past month-end | 5 days | Period Close |
| Pending Approvals | Info | Items awaiting approval | Any | Approvals Queue |

### Quick Actions Bar

| Action | Icon | Description |
|--------|------|-------------|
| Generate Statements | 📄 | One-click financial statement generation |
| Process Payments | 💰 | Jump to AP payment batch |
| Export to Excel | 📊 | Download dashboard data |
| Refresh Data | 🔄 | Manual refresh with timestamp |

---

## Section 4: Herbal Medicine Business Intelligence

### Inventory & Quality Cost Panel

| Metric | Calculation | Data Source |
|--------|-------------|-------------|
| **Inventory at Risk (฿)** | Sum of inventory value expiring in 90 days | `/api/inventory/expiry-alerts` |
| **Expired Write-off YTD** | Total write-offs from expired goods | Journal entries with source type |
| **Quality Cost Ratio** | (CAPA + Complaints + Testing) / Revenue × 100 | Quality module + GL accounts |
| **Rejected Batch Cost YTD** | Value of QC-failed batches | Production/quality records |

### Operational Efficiency Panel

| Metric | Calculation | Data Source |
|--------|-------------|-------------|
| **Production Yield %** | Actual output / Expected output × 100 | `/api/production/yield` |
| **Equipment Downtime Cost** | Maintenance cost + estimated lost production | Equipment maintenance records |
| **Vendor Concentration** | Top 3 vendors / Total purchases × 100 | AP invoices by vendor |
| **Payment Discounts Captured** | Discounts taken / Available discounts × 100 | Payment records |

### Visual Treatment
- Each metric shows current value + 6-month sparkline
- Color coding based on business thresholds
- Click to view detailed breakdown

---

## Section 5: Layout & Navigation

### Page Structure

```
┌─────────────────────────────────────────────────────────────────┐
│ HEADER                                                          │
│ Title: "Executive Accounting Dashboard"                         │
│ Period: [MTD] [QTD] [YTD] [Custom] | Compare: [vs Prior Period] │
│ Last Updated: 5 min ago | [🔄 Refresh]                          │
├─────────────────────────────────────────────────────────────────┤
│ ALERTS BAR (Collapsible)                                        │
│ 🔴 2 Critical | 🟠 3 Warnings | 🟡 1 Info        [View All →]   │
├─────────────────────────────────────────────────────────────────┤
│ KPI ROW 1                                                       │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│ │ Working  │ │ Current  │ │ Quick    │ │ DSO      │            │
│ │ Capital  │ │ Ratio    │ │ Ratio    │ │ (Days)   │            │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘            │
├─────────────────────────────────────────────────────────────────┤
│ KPI ROW 2                                                       │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│ │ Gross    │ │ Operating│ │ DPO      │ │ Inventory│            │
│ │ Margin % │ │ Cash Flow│ │ (Days)   │ │ Turnover │            │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘            │
├─────────────────────────────────────────────────────────────────┤
│ CHART: Revenue vs Expenses Trend (12 months)                    │
│ [Full Width Area Chart]                                         │
├────────────────────────────┬────────────────────────────────────┤
│ CHART: Cash Flow Waterfall │ CHART: Profitability by Category  │
│ [Waterfall]                │ [Horizontal Bar]                   │
├────────────────────────────┼────────────────────────────────────┤
│ CHART: AP/AR Aging         │ CHART: Expense Breakdown           │
│ [Grouped Bar]              │ [Donut]                            │
├────────────────────────────┴────────────────────────────────────┤
│ BUSINESS INTELLIGENCE                                           │
│ ┌─────────────────────────┐ ┌─────────────────────────────────┐ │
│ │ Inventory & Quality     │ │ Operational Efficiency          │ │
│ │ • Inventory at Risk     │ │ • Production Yield %            │ │
│ │ • Write-off YTD         │ │ • Equipment Downtime            │ │
│ │ • Quality Cost Ratio    │ │ • Vendor Concentration          │ │
│ │ • Rejected Batch Cost   │ │ • Discounts Captured            │ │
│ └─────────────────────────┘ └─────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│ QUICK ACTIONS                                                   │
│ [📄 Statements] [💰 Payments] [📊 Export] [📈 Reports]          │
├─────────────────────────────────────────────────────────────────┤
│ QUICK LINKS (Grouped)                                           │
│ Financial Statements | Receivables | Payables | Assets | Comply │
└─────────────────────────────────────────────────────────────────┘
```

### Quick Links Groups

| Group | Links |
|-------|-------|
| **Financial Statements** | Trial Balance, Balance Sheet, Income Statement, Cash Flow |
| **Receivables** | AR Invoices, AR Aging, Receipts, Credit Notes |
| **Payables** | AP Invoices, AP Aging, Payments, Debit Notes |
| **Assets & Operations** | Fixed Assets, Equipment, Maintenance |
| **Compliance** | VAT Report, WHT Certificates, Period Close |

### Responsive Behavior

| Breakpoint | Layout |
|------------|--------|
| Desktop (>1200px) | Full layout as designed |
| Tablet (768-1200px) | 2 KPIs per row, charts 2-column |
| Mobile (<768px) | Single column, collapsible sections |

---

## Technical Implementation

### New API Endpoints Required

| Endpoint | Purpose |
|----------|---------|
| `GET /api/accounting/dashboard/executive-metrics` | All KPIs in single call |
| `GET /api/accounting/dashboard/alerts` | Active alerts with priorities |
| `GET /api/accounting/dashboard/cash-flow-waterfall` | Waterfall chart data |
| `GET /api/accounting/dashboard/profitability-by-category` | Product category margins |
| `GET /api/accounting/dashboard/expense-breakdown` | Expense categories YTD |
| `GET /api/accounting/dashboard/business-intel` | Industry-specific metrics |

### Data Refresh Strategy

| Data Type | Refresh Interval | Cache Duration |
|-----------|------------------|----------------|
| KPIs | 5 minutes | 5 minutes |
| Charts | 15 minutes | 15 minutes |
| Alerts | 1 minute | 1 minute |
| Business Intel | 30 minutes | 30 minutes |

### Component Structure

```
src/app/accounting/page.tsx (main dashboard)
src/components/accounting/
  ├── ExecutiveKPICard.tsx
  ├── ExecutiveAlertBar.tsx
  ├── charts/
  │   ├── RevenueExpensesTrend.tsx
  │   ├── CashFlowWaterfall.tsx
  │   ├── ProfitabilityByCategory.tsx
  │   ├── AgingSummaryChart.tsx
  │   └── ExpenseBreakdownChart.tsx
  ├── BusinessIntelPanel.tsx
  ├── QuickActionsBar.tsx
  └── QuickLinksGrid.tsx
```

---

## Success Criteria

1. Dashboard loads in <3 seconds on desktop
2. All KPIs calculate correctly from real GL data
3. Alerts trigger based on actual thresholds
4. Charts display real data (no random/mock data)
5. Responsive on tablet and mobile
6. Export to Excel works for all visible data
7. Period comparison shows accurate YoY/MoM changes

---

## Out of Scope

- Budgeting module integration (future enhancement)
- Custom dashboard builder/widget arrangement
- Real-time WebSocket updates
- Multi-currency consolidated view
- Predictive analytics / forecasting

---

## Revision History

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-17 | 1.0 | Initial design document |
