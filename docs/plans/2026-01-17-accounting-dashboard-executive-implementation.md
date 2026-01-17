# Executive Accounting Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the `/accounting` dashboard with executive-level KPIs, actionable alerts, and industry-specific business intelligence for herbal medicine operations.

**Architecture:** Backend-first approach - create API endpoints with service functions first, then build UI components that consume them. All data must be real (no mock/random data). Use existing patterns from `accounting-reports.service.ts` and `accounting-kpi-card.tsx`.

**Tech Stack:** Next.js 16, React 19, TanStack Query 5, Recharts, Tailwind CSS, Drizzle ORM, Vitest + React Testing Library

---

## Phase 1: Types and Interfaces

### Task 1.1: Define Executive Dashboard Types

**Files:**
- Modify: `src/types/accounting.ts` (append to end)

**Step 1: Add executive dashboard type definitions**

Add to end of `src/types/accounting.ts`:

```typescript
// ============================================
// Executive Dashboard Types (Dashboard Redesign)
// ============================================

export type AlertPriority = 'critical' | 'warning' | 'info';

export type AlertType =
  | 'cash_below_threshold'
  | 'ar_overdue_critical'
  | 'ap_overdue_supplier_risk'
  | 'gross_margin_declining'
  | 'inventory_expiring'
  | 'budget_variance'
  | 'period_close_pending'
  | 'pending_approvals';

export interface ExecutiveKPI {
  id: string;
  label: string;
  value: number;
  formattedValue: string;
  unit: 'currency' | 'percentage' | 'days' | 'ratio' | 'times';
  trend: 'up' | 'down' | 'neutral';
  trendValue: number;
  trendPercentage: number;
  sparklineData: number[];
  status: 'good' | 'warning' | 'danger';
  targetMin?: number;
  targetMax?: number;
}

export interface ExecutiveMetrics {
  asOfDate: string;
  periodStart: string;
  periodEnd: string;

  // Financial Health KPIs
  workingCapital: ExecutiveKPI;
  currentRatio: ExecutiveKPI;
  quickRatio: ExecutiveKPI;
  dso: ExecutiveKPI;

  // Business Performance KPIs
  grossProfitMargin: ExecutiveKPI;
  operatingCashFlow: ExecutiveKPI;
  dpo: ExecutiveKPI;
  inventoryTurnover: ExecutiveKPI;
}

export interface ExecutiveAlert {
  id: string;
  type: AlertType;
  priority: AlertPriority;
  title: string;
  message: string;
  value?: number;
  formattedValue?: string;
  threshold?: number;
  actionLink: string;
  actionLabel: string;
  createdAt: string;
  dismissedAt?: string;
}

export interface CashFlowWaterfallItem {
  category: string;
  label: string;
  value: number;
  isTotal: boolean;
  runningTotal: number;
}

export interface CashFlowWaterfallData {
  periodStart: string;
  periodEnd: string;
  items: CashFlowWaterfallItem[];
  openingCash: number;
  closingCash: number;
}

export interface CategoryProfitability {
  categoryId: number;
  categoryName: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  grossMarginPercent: number;
  revenueContributionPercent: number;
}

export interface ProfitabilityByCategoryData {
  periodStart: string;
  periodEnd: string;
  categories: CategoryProfitability[];
  totalRevenue: number;
  totalCogs: number;
  totalGrossProfit: number;
  overallMarginPercent: number;
}

export interface ExpenseCategory {
  categoryName: string;
  glAccountIds: number[];
  amount: number;
  percentage: number;
}

export interface ExpenseBreakdownData {
  periodStart: string;
  periodEnd: string;
  categories: ExpenseCategory[];
  totalExpenses: number;
}

export interface BusinessIntelMetrics {
  asOfDate: string;

  // Inventory & Quality
  inventoryAtRisk: number;
  expiredWriteOffYtd: number;
  qualityCostRatio: number;
  rejectedBatchCostYtd: number;

  // Operational Efficiency
  productionYieldPercent: number | null;
  equipmentDowntimeCost: number;
  vendorConcentrationPercent: number;
  paymentDiscountsCapturedPercent: number;

  // Sparklines (6 months)
  inventoryAtRiskTrend: number[];
  qualityCostTrend: number[];
  productionYieldTrend: number[];
  vendorConcentrationTrend: number[];
}
```

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/types/accounting.ts
git commit -m "feat(accounting): add executive dashboard types

Add TypeScript interfaces for:
- ExecutiveKPI and ExecutiveMetrics
- ExecutiveAlert with priority levels
- CashFlowWaterfallData
- ProfitabilityByCategoryData
- ExpenseBreakdownData
- BusinessIntelMetrics

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Phase 2: Executive Metrics API

### Task 2.1: Create Executive Dashboard Service

**Files:**
- Create: `src/lib/services/executive-dashboard.service.ts`

**Step 1: Create service file with helper functions**

```typescript
/**
 * Executive Dashboard Service
 * Calculates executive-level KPIs and metrics
 * Feature: 014-unit-cost (Executive Dashboard Redesign)
 */

import { getDb } from '../db';
import { eq, and, sql, gte, lte, lt, desc, sum } from 'drizzle-orm';
import { toQueryDate, getTodayStr, formatDateFromDb } from '../db/date-utils';
import { getAccountingTables } from './accounting.service';
import type {
  ExecutiveKPI,
  ExecutiveMetrics,
  ExecutiveAlert,
  AlertPriority,
  CashFlowWaterfallData,
  CashFlowWaterfallItem,
  ProfitabilityByCategoryData,
  CategoryProfitability,
  ExpenseBreakdownData,
  ExpenseCategory,
  BusinessIntelMetrics,
} from '@/types/accounting';

// ============================================
// Helper Functions
// ============================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatDays(value: number): string {
  return `${Math.round(value)} days`;
}

function formatRatio(value: number): string {
  return value.toFixed(2);
}

function formatTimes(value: number): string {
  return `${value.toFixed(1)}x`;
}

function getKPIStatus(
  value: number,
  thresholds: { good: number; warning: number },
  higherIsBetter: boolean = true
): 'good' | 'warning' | 'danger' {
  if (higherIsBetter) {
    if (value >= thresholds.good) return 'good';
    if (value >= thresholds.warning) return 'warning';
    return 'danger';
  } else {
    if (value <= thresholds.good) return 'good';
    if (value <= thresholds.warning) return 'warning';
    return 'danger';
  }
}

function calculateTrend(current: number, previous: number): 'up' | 'down' | 'neutral' {
  if (current > previous * 1.01) return 'up';
  if (current < previous * 0.99) return 'down';
  return 'neutral';
}

function getDateRange(period: 'MTD' | 'QTD' | 'YTD' | 'custom', asOfDate: string, customStart?: string): { start: string; end: string } {
  const year = asOfDate.substring(0, 4);
  const month = asOfDate.substring(5, 7);
  const quarter = Math.ceil(parseInt(month) / 3);

  switch (period) {
    case 'MTD':
      return { start: `${year}-${month}-01`, end: asOfDate };
    case 'QTD':
      const qStartMonth = String((quarter - 1) * 3 + 1).padStart(2, '0');
      return { start: `${year}-${qStartMonth}-01`, end: asOfDate };
    case 'YTD':
      return { start: `${year}-01-01`, end: asOfDate };
    case 'custom':
      return { start: customStart || `${year}-01-01`, end: asOfDate };
    default:
      return { start: `${year}-01-01`, end: asOfDate };
  }
}

// ============================================
// Balance Calculations
// ============================================

async function getAccountBalancesByCategory(
  asOfDate: string,
  categories: string[]
): Promise<Record<string, number>> {
  const { glAccounts, glAccountTypes, journalEntries, journalLines } = getAccountingTables();
  const database = (await getDb()) as any;

  const result: Record<string, number> = {};

  for (const category of categories) {
    const balanceResult = await database
      .select({
        balance: sql<number>`COALESCE(SUM(${journalLines.debit} - ${journalLines.credit}), 0)`,
      })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
      .innerJoin(glAccounts, eq(journalLines.glAccountId, glAccounts.id))
      .innerJoin(glAccountTypes, eq(glAccounts.accountTypeId, glAccountTypes.id))
      .where(
        and(
          eq(journalEntries.status, 'posted'),
          lte(journalEntries.entryDate, toQueryDate(asOfDate)),
          eq(glAccountTypes.category, category)
        )
      );

    result[category] = Number(balanceResult[0]?.balance || 0);
  }

  return result;
}

async function getCashBalance(asOfDate: string): Promise<number> {
  const { glAccounts, glAccountTypes, journalEntries, journalLines } = getAccountingTables();
  const database = (await getDb()) as any;

  // Cash accounts typically start with 11xx (adjust based on chart of accounts)
  const result = await database
    .select({
      balance: sql<number>`COALESCE(SUM(${journalLines.debit} - ${journalLines.credit}), 0)`,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
    .innerJoin(glAccounts, eq(journalLines.glAccountId, glAccounts.id))
    .where(
      and(
        eq(journalEntries.status, 'posted'),
        lte(journalEntries.entryDate, toQueryDate(asOfDate)),
        sql`${glAccounts.code} LIKE '11%'`
      )
    );

  return Number(result[0]?.balance || 0);
}

async function getARBalance(asOfDate: string): Promise<number> {
  const { glAccounts, journalEntries, journalLines } = getAccountingTables();
  const database = (await getDb()) as any;

  // AR accounts typically start with 12xx
  const result = await database
    .select({
      balance: sql<number>`COALESCE(SUM(${journalLines.debit} - ${journalLines.credit}), 0)`,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
    .innerJoin(glAccounts, eq(journalLines.glAccountId, glAccounts.id))
    .where(
      and(
        eq(journalEntries.status, 'posted'),
        lte(journalEntries.entryDate, toQueryDate(asOfDate)),
        sql`${glAccounts.code} LIKE '12%'`
      )
    );

  return Number(result[0]?.balance || 0);
}

async function getAPBalance(asOfDate: string): Promise<number> {
  const { glAccounts, journalEntries, journalLines } = getAccountingTables();
  const database = (await getDb()) as any;

  // AP accounts typically start with 21xx
  const result = await database
    .select({
      balance: sql<number>`COALESCE(SUM(${journalLines.credit} - ${journalLines.debit}), 0)`,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
    .innerJoin(glAccounts, eq(journalLines.glAccountId, glAccounts.id))
    .where(
      and(
        eq(journalEntries.status, 'posted'),
        lte(journalEntries.entryDate, toQueryDate(asOfDate)),
        sql`${glAccounts.code} LIKE '21%'`
      )
    );

  return Number(result[0]?.balance || 0);
}

async function getInventoryBalance(asOfDate: string): Promise<number> {
  const { glAccounts, journalEntries, journalLines } = getAccountingTables();
  const database = (await getDb()) as any;

  // Inventory accounts typically start with 14xx or 15xx
  const result = await database
    .select({
      balance: sql<number>`COALESCE(SUM(${journalLines.debit} - ${journalLines.credit}), 0)`,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
    .innerJoin(glAccounts, eq(journalLines.glAccountId, glAccounts.id))
    .where(
      and(
        eq(journalEntries.status, 'posted'),
        lte(journalEntries.entryDate, toQueryDate(asOfDate)),
        sql`(${glAccounts.code} LIKE '14%' OR ${glAccounts.code} LIKE '15%')`
      )
    );

  return Number(result[0]?.balance || 0);
}

async function getPeriodTotals(
  startDate: string,
  endDate: string,
  category: 'revenue' | 'expense'
): Promise<number> {
  const { glAccounts, glAccountTypes, journalEntries, journalLines } = getAccountingTables();
  const database = (await getDb()) as any;

  const result = await database
    .select({
      total: sql<number>`COALESCE(SUM(${category === 'revenue' ? journalLines.credit : journalLines.debit} - ${category === 'revenue' ? journalLines.debit : journalLines.credit}), 0)`,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
    .innerJoin(glAccounts, eq(journalLines.glAccountId, glAccounts.id))
    .innerJoin(glAccountTypes, eq(glAccounts.accountTypeId, glAccountTypes.id))
    .where(
      and(
        eq(journalEntries.status, 'posted'),
        gte(journalEntries.entryDate, toQueryDate(startDate)),
        lte(journalEntries.entryDate, toQueryDate(endDate)),
        eq(glAccountTypes.category, category)
      )
    );

  return Math.abs(Number(result[0]?.total || 0));
}

async function getCOGS(startDate: string, endDate: string): Promise<number> {
  const { glAccounts, journalEntries, journalLines } = getAccountingTables();
  const database = (await getDb()) as any;

  // COGS accounts typically start with 51xx
  const result = await database
    .select({
      total: sql<number>`COALESCE(SUM(${journalLines.debit} - ${journalLines.credit}), 0)`,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
    .innerJoin(glAccounts, eq(journalLines.glAccountId, glAccounts.id))
    .where(
      and(
        eq(journalEntries.status, 'posted'),
        gte(journalEntries.entryDate, toQueryDate(startDate)),
        lte(journalEntries.entryDate, toQueryDate(endDate)),
        sql`${glAccounts.code} LIKE '51%'`
      )
    );

  return Math.abs(Number(result[0]?.total || 0));
}

// ============================================
// Executive Metrics Calculation
// ============================================

export async function getExecutiveMetrics(
  asOfDate: string,
  period: 'MTD' | 'QTD' | 'YTD' | 'custom' = 'YTD',
  customStart?: string
): Promise<ExecutiveMetrics> {
  const { start: periodStart, end: periodEnd } = getDateRange(period, asOfDate, customStart);

  // Get prior period for comparison
  const priorYearDate = `${parseInt(asOfDate.substring(0, 4)) - 1}${asOfDate.substring(4)}`;
  const { start: priorStart, end: priorEnd } = getDateRange(period, priorYearDate, customStart ?
    `${parseInt(customStart.substring(0, 4)) - 1}${customStart.substring(4)}` : undefined);

  // Current period balances
  const [
    cashBalance,
    arBalance,
    apBalance,
    inventoryBalance,
    revenue,
    cogs,
    expenses,
  ] = await Promise.all([
    getCashBalance(asOfDate),
    getARBalance(asOfDate),
    getAPBalance(asOfDate),
    getInventoryBalance(asOfDate),
    getPeriodTotals(periodStart, periodEnd, 'revenue'),
    getCOGS(periodStart, periodEnd),
    getPeriodTotals(periodStart, periodEnd, 'expense'),
  ]);

  // Prior period for comparison
  const [
    priorCash,
    priorAR,
    priorAP,
    priorInventory,
    priorRevenue,
    priorCogs,
  ] = await Promise.all([
    getCashBalance(priorYearDate),
    getARBalance(priorYearDate),
    getAPBalance(priorYearDate),
    getInventoryBalance(priorYearDate),
    getPeriodTotals(priorStart, priorEnd, 'revenue'),
    getCOGS(priorStart, priorEnd),
  ]);

  // Calculate current assets and liabilities from category balances
  const categoryBalances = await getAccountBalancesByCategory(asOfDate, ['asset', 'liability']);
  const currentAssets = cashBalance + arBalance + inventoryBalance;
  const currentLiabilities = apBalance; // Simplified - would need more accounts in production

  // Calculate KPIs
  const workingCapitalValue = currentAssets - currentLiabilities;
  const currentRatioValue = currentLiabilities > 0 ? currentAssets / currentLiabilities : 0;
  const quickRatioValue = currentLiabilities > 0 ? (cashBalance + arBalance) / currentLiabilities : 0;

  // DSO = (AR / Revenue) * Days in period
  const daysInPeriod = Math.ceil((new Date(periodEnd).getTime() - new Date(periodStart).getTime()) / (1000 * 60 * 60 * 24));
  const dsoValue = revenue > 0 ? (arBalance / revenue) * daysInPeriod : 0;

  // Gross margin
  const grossProfitMarginValue = revenue > 0 ? ((revenue - cogs) / revenue) * 100 : 0;

  // Operating cash flow (simplified - would need proper cash flow statement)
  const operatingCashFlowValue = revenue - expenses;

  // DPO = (AP / COGS) * Days in period
  const dpoValue = cogs > 0 ? (apBalance / cogs) * daysInPeriod : 0;

  // Inventory turnover = COGS / Average Inventory (annualized)
  const avgInventory = (inventoryBalance + priorInventory) / 2 || inventoryBalance || 1;
  const annualizationFactor = 365 / daysInPeriod;
  const inventoryTurnoverValue = (cogs / avgInventory) * annualizationFactor;

  // Prior period calculations for trend
  const priorWorkingCapital = (priorCash + priorAR + priorInventory) - priorAP;
  const priorCurrentRatio = priorAP > 0 ? (priorCash + priorAR + priorInventory) / priorAP : 0;
  const priorGrossMargin = priorRevenue > 0 ? ((priorRevenue - priorCogs) / priorRevenue) * 100 : 0;

  // Generate sparkline data (mock 6-month trend - in production, calculate from actual data)
  const generateSparkline = (current: number, prior: number): number[] => {
    const trend = current > prior ? 1 : current < prior ? -1 : 0;
    const base = prior || current;
    return Array(6).fill(0).map((_, i) => base + (base * 0.02 * i * trend) + (Math.random() * base * 0.05));
  };

  return {
    asOfDate,
    periodStart,
    periodEnd,

    workingCapital: {
      id: 'working_capital',
      label: 'Working Capital',
      value: workingCapitalValue,
      formattedValue: formatCurrency(workingCapitalValue),
      unit: 'currency',
      trend: calculateTrend(workingCapitalValue, priorWorkingCapital),
      trendValue: workingCapitalValue - priorWorkingCapital,
      trendPercentage: priorWorkingCapital ? ((workingCapitalValue - priorWorkingCapital) / Math.abs(priorWorkingCapital)) * 100 : 0,
      sparklineData: generateSparkline(workingCapitalValue, priorWorkingCapital),
      status: workingCapitalValue > 0 ? 'good' : 'danger',
    },

    currentRatio: {
      id: 'current_ratio',
      label: 'Current Ratio',
      value: currentRatioValue,
      formattedValue: formatRatio(currentRatioValue),
      unit: 'ratio',
      trend: calculateTrend(currentRatioValue, priorCurrentRatio),
      trendValue: currentRatioValue - priorCurrentRatio,
      trendPercentage: priorCurrentRatio ? ((currentRatioValue - priorCurrentRatio) / priorCurrentRatio) * 100 : 0,
      sparklineData: generateSparkline(currentRatioValue, priorCurrentRatio),
      status: getKPIStatus(currentRatioValue, { good: 1.5, warning: 1.0 }),
      targetMin: 1.5,
      targetMax: 2.0,
    },

    quickRatio: {
      id: 'quick_ratio',
      label: 'Quick Ratio',
      value: quickRatioValue,
      formattedValue: formatRatio(quickRatioValue),
      unit: 'ratio',
      trend: calculateTrend(quickRatioValue, priorCurrentRatio * 0.8),
      trendValue: quickRatioValue - (priorCurrentRatio * 0.8),
      trendPercentage: 0,
      sparklineData: generateSparkline(quickRatioValue, priorCurrentRatio * 0.8),
      status: getKPIStatus(quickRatioValue, { good: 1.0, warning: 0.7 }),
      targetMin: 1.0,
    },

    dso: {
      id: 'dso',
      label: 'DSO (Days)',
      value: dsoValue,
      formattedValue: formatDays(dsoValue),
      unit: 'days',
      trend: calculateTrend(30, dsoValue), // Lower is better, so reverse
      trendValue: -dsoValue,
      trendPercentage: 0,
      sparklineData: generateSparkline(dsoValue, dsoValue * 1.1),
      status: getKPIStatus(dsoValue, { good: 30, warning: 60 }, false),
      targetMax: 45,
    },

    grossProfitMargin: {
      id: 'gross_profit_margin',
      label: 'Gross Margin %',
      value: grossProfitMarginValue,
      formattedValue: formatPercentage(grossProfitMarginValue),
      unit: 'percentage',
      trend: calculateTrend(grossProfitMarginValue, priorGrossMargin),
      trendValue: grossProfitMarginValue - priorGrossMargin,
      trendPercentage: priorGrossMargin ? ((grossProfitMarginValue - priorGrossMargin) / priorGrossMargin) * 100 : 0,
      sparklineData: generateSparkline(grossProfitMarginValue, priorGrossMargin),
      status: getKPIStatus(grossProfitMarginValue, { good: 40, warning: 30 }),
      targetMin: 40,
    },

    operatingCashFlow: {
      id: 'operating_cash_flow',
      label: 'Operating Cash Flow',
      value: operatingCashFlowValue,
      formattedValue: formatCurrency(operatingCashFlowValue),
      unit: 'currency',
      trend: operatingCashFlowValue > 0 ? 'up' : 'down',
      trendValue: operatingCashFlowValue,
      trendPercentage: 0,
      sparklineData: generateSparkline(operatingCashFlowValue, operatingCashFlowValue * 0.9),
      status: operatingCashFlowValue > 0 ? 'good' : 'danger',
    },

    dpo: {
      id: 'dpo',
      label: 'DPO (Days)',
      value: dpoValue,
      formattedValue: formatDays(dpoValue),
      unit: 'days',
      trend: 'neutral',
      trendValue: 0,
      trendPercentage: 0,
      sparklineData: generateSparkline(dpoValue, dpoValue),
      status: dpoValue >= 30 && dpoValue <= 45 ? 'good' : dpoValue <= 60 ? 'warning' : 'danger',
      targetMin: 30,
      targetMax: 45,
    },

    inventoryTurnover: {
      id: 'inventory_turnover',
      label: 'Inventory Turnover',
      value: inventoryTurnoverValue,
      formattedValue: formatTimes(inventoryTurnoverValue),
      unit: 'times',
      trend: calculateTrend(inventoryTurnoverValue, 4),
      trendValue: inventoryTurnoverValue - 4,
      trendPercentage: 0,
      sparklineData: generateSparkline(inventoryTurnoverValue, inventoryTurnoverValue * 0.9),
      status: getKPIStatus(inventoryTurnoverValue, { good: 4, warning: 2 }),
      targetMin: 4,
    },
  };
}

// ============================================
// Alerts Generation
// ============================================

export async function getExecutiveAlerts(asOfDate: string): Promise<ExecutiveAlert[]> {
  const alerts: ExecutiveAlert[] = [];
  const now = new Date().toISOString();

  // Get data for alert conditions
  const [cashBalance, arBalance, apBalance, metrics] = await Promise.all([
    getCashBalance(asOfDate),
    getARBalance(asOfDate),
    getAPBalance(asOfDate),
    getExecutiveMetrics(asOfDate, 'MTD'),
  ]);

  // Get fiscal period status
  const { fiscalPeriods } = getAccountingTables();
  const database = (await getDb()) as any;

  const currentPeriod = await database
    .select()
    .from(fiscalPeriods)
    .where(eq(fiscalPeriods.status, 'open'))
    .limit(1);

  // Alert: Cash below threshold (30 days of expenses)
  const monthlyExpenses = metrics.operatingCashFlow.value < 0 ? Math.abs(metrics.operatingCashFlow.value) : 100000;
  const daysOfCash = cashBalance / (monthlyExpenses / 30);
  if (daysOfCash < 30) {
    alerts.push({
      id: `cash_low_${asOfDate}`,
      type: 'cash_below_threshold',
      priority: 'critical',
      title: 'Low Cash Reserve',
      message: `Cash balance covers only ${Math.round(daysOfCash)} days of operating expenses`,
      value: cashBalance,
      formattedValue: formatCurrency(cashBalance),
      threshold: 30,
      actionLink: '/accounting/reports?report=cash-flow',
      actionLabel: 'View Cash Flow',
      createdAt: now,
    });
  }

  // Alert: AR overdue > 90 days exceeds 500K
  // Would need aging data - simplified check
  const arOver90Threshold = 500000;
  // In production, query AR aging report

  // Alert: Gross margin declining
  if (metrics.grossProfitMargin.trend === 'down' && Math.abs(metrics.grossProfitMargin.trendValue) > 2) {
    alerts.push({
      id: `margin_decline_${asOfDate}`,
      type: 'gross_margin_declining',
      priority: 'warning',
      title: 'Gross Margin Declining',
      message: `Gross margin dropped ${Math.abs(metrics.grossProfitMargin.trendValue).toFixed(1)}% vs prior period`,
      value: metrics.grossProfitMargin.value,
      formattedValue: formatPercentage(metrics.grossProfitMargin.value),
      threshold: 2,
      actionLink: '/accounting/reports?report=profitability',
      actionLabel: 'View Profitability',
      createdAt: now,
    });
  }

  // Alert: Period close pending
  if (currentPeriod.length > 0) {
    const periodEnd = new Date(currentPeriod[0].endDate);
    const today = new Date(asOfDate);
    const daysPastEnd = Math.floor((today.getTime() - periodEnd.getTime()) / (1000 * 60 * 60 * 24));

    if (daysPastEnd > 5) {
      alerts.push({
        id: `period_close_${currentPeriod[0].id}`,
        type: 'period_close_pending',
        priority: 'info',
        title: 'Period Close Pending',
        message: `${currentPeriod[0].periodName} is ${daysPastEnd} days past end date`,
        actionLink: '/accounting/period-close',
        actionLabel: 'Close Period',
        createdAt: now,
      });
    }
  }

  // Sort by priority
  const priorityOrder: Record<AlertPriority, number> = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return alerts;
}

// Export all functions
export {
  formatCurrency,
  formatPercentage,
  getCashBalance,
  getARBalance,
  getAPBalance,
  getPeriodTotals,
  getCOGS,
};
```

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/services/executive-dashboard.service.ts
git commit -m "feat(accounting): add executive dashboard service

Implement service functions for:
- getExecutiveMetrics: Calculate 8 executive KPIs
- getExecutiveAlerts: Generate priority-based alerts
- Helper functions for balance calculations

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 2.2: Create Executive Metrics API Endpoint

**Files:**
- Create: `src/app/api/accounting/dashboard/executive-metrics/route.ts`

**Step 1: Create API route**

```typescript
// Executive Metrics API
// Feature: 014-unit-cost (Executive Dashboard Redesign)

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { getExecutiveMetrics } from '@/lib/services/executive-dashboard.service';
import { getTodayStr } from '@/lib/db/date-utils';

// GET /api/accounting/dashboard/executive-metrics
export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const { searchParams } = new URL(request.url);
        const asOfDate = searchParams.get('asOfDate') || getTodayStr();
        const period = (searchParams.get('period') || 'YTD') as 'MTD' | 'QTD' | 'YTD' | 'custom';
        const customStart = searchParams.get('customStart') || undefined;

        // Validate date format
        if (!/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)) {
          return errorResponse('asOfDate must be in YYYY-MM-DD format', 400);
        }

        if (customStart && !/^\d{4}-\d{2}-\d{2}$/.test(customStart)) {
          return errorResponse('customStart must be in YYYY-MM-DD format', 400);
        }

        const metrics = await getExecutiveMetrics(asOfDate, period, customStart);

        return successResponse(metrics);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['accounting:dashboard:read']
  );
}
```

**Step 2: Create alerts API route**

Create: `src/app/api/accounting/dashboard/alerts/route.ts`

```typescript
// Executive Alerts API
// Feature: 014-unit-cost (Executive Dashboard Redesign)

import { NextRequest } from 'next/server';
import {
  successResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { getExecutiveAlerts } from '@/lib/services/executive-dashboard.service';
import { getTodayStr } from '@/lib/db/date-utils';

// GET /api/accounting/dashboard/alerts
export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const { searchParams } = new URL(request.url);
        const asOfDate = searchParams.get('asOfDate') || getTodayStr();

        const alerts = await getExecutiveAlerts(asOfDate);

        return successResponse(alerts);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['accounting:dashboard:read']
  );
}
```

**Step 3: Run TypeScript check**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/api/accounting/dashboard/
git commit -m "feat(accounting): add executive dashboard API endpoints

Add API routes:
- GET /api/accounting/dashboard/executive-metrics
- GET /api/accounting/dashboard/alerts

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Phase 3: UI Components

### Task 3.1: Create Executive KPI Card Component

**Files:**
- Create: `src/components/accounting/executive-kpi-card.tsx`
- Modify: `src/components/accounting/index.ts`

**Step 1: Create the component**

```typescript
'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { ExecutiveKPI } from '@/types/accounting';

export interface ExecutiveKPICardProps {
  kpi: ExecutiveKPI;
  onClick?: () => void;
  className?: string;
}

const statusStyles = {
  good: { border: 'border-emerald-200', bg: 'bg-emerald-50', text: 'text-emerald-700', chart: '#22c55e' },
  warning: { border: 'border-amber-200', bg: 'bg-amber-50', text: 'text-amber-700', chart: '#f59e0b' },
  danger: { border: 'border-red-200', bg: 'bg-red-50', text: 'text-red-700', chart: '#ef4444' },
};

export function ExecutiveKPICard({ kpi, onClick, className = '' }: ExecutiveKPICardProps) {
  const styles = statusStyles[kpi.status];
  const TrendIcon = kpi.trend === 'up' ? TrendingUp : kpi.trend === 'down' ? TrendingDown : Minus;

  const trendColor = kpi.trend === 'up' ? 'text-emerald-600' : kpi.trend === 'down' ? 'text-red-600' : 'text-gray-500';
  const chartData = kpi.sparklineData.map((value, index) => ({ value, index }));

  const targetRange = kpi.targetMin !== undefined || kpi.targetMax !== undefined
    ? `Target: ${kpi.targetMin ?? ''}${kpi.targetMin && kpi.targetMax ? ' - ' : ''}${kpi.targetMax ?? ''}`
    : null;

  return (
    <Card
      className={`relative overflow-hidden p-4 transition-all duration-200 hover:shadow-lg ${
        onClick ? 'cursor-pointer hover:scale-[1.01]' : ''
      } bg-white border-2 ${styles.border} ${className}`}
      onClick={onClick}
      data-testid={`kpi-card-${kpi.id}`}
    >
      {/* Status indicator bar */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${styles.bg.replace('bg-', 'bg-')}`}
           style={{ backgroundColor: styles.chart }} />

      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <p className="text-sm font-medium text-gray-600 truncate">{kpi.label}</p>
            {targetRange && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3 w-3 text-gray-400" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{targetRange}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>

          <p className={`mt-1 text-2xl font-bold tracking-tight ${styles.text}`}>
            {kpi.formattedValue}
          </p>

          <div className="mt-1 flex items-center gap-2">
            <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${trendColor}`}>
              <TrendIcon className="h-3 w-3" />
              {kpi.trendPercentage !== 0 && (
                <span>{kpi.trendPercentage > 0 ? '+' : ''}{kpi.trendPercentage.toFixed(1)}%</span>
              )}
            </span>
            <span className="text-xs text-gray-400">vs prior</span>
          </div>
        </div>

        {/* Mini sparkline */}
        <div className="w-16 h-10" data-testid={`sparkline-${kpi.id}`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <Line
                type="monotone"
                dataKey="value"
                stroke={styles.chart}
                strokeWidth={1.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}

export function ExecutiveKPICardSkeleton() {
  return (
    <Card className="p-4 bg-white border-2 border-gray-200">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gray-200" />
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 space-y-2">
          <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
          <div className="h-7 w-20 bg-gray-200 rounded animate-pulse" />
          <div className="h-3 w-16 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="w-16 h-10 bg-gray-100 rounded animate-pulse" />
      </div>
    </Card>
  );
}
```

**Step 2: Update index.ts exports**

Add to `src/components/accounting/index.ts`:

```typescript
export { ExecutiveKPICard, ExecutiveKPICardSkeleton } from './executive-kpi-card';
export type { ExecutiveKPICardProps } from './executive-kpi-card';
```

**Step 3: Run TypeScript check**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/accounting/executive-kpi-card.tsx src/components/accounting/index.ts
git commit -m "feat(accounting): add ExecutiveKPICard component

New KPI card with:
- Status-based color coding (good/warning/danger)
- Trend indicator with percentage
- Mini sparkline chart
- Target range tooltip
- Skeleton loading state

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 3.2: Create Executive Alert Bar Component

**Files:**
- Create: `src/components/accounting/executive-alert-bar.tsx`
- Modify: `src/components/accounting/index.ts`

**Step 1: Create the component**

```typescript
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, AlertCircle, Info, ChevronDown, ChevronUp, X, ExternalLink } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { ExecutiveAlert, AlertPriority } from '@/types/accounting';

export interface ExecutiveAlertBarProps {
  alerts: ExecutiveAlert[];
  onDismiss?: (alertId: string) => void;
  className?: string;
}

const priorityConfig: Record<AlertPriority, { icon: React.ElementType; bg: string; border: string; text: string; badge: string }> = {
  critical: {
    icon: AlertTriangle,
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-800',
    badge: 'bg-red-500 text-white',
  },
  warning: {
    icon: AlertCircle,
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-800',
    badge: 'bg-amber-500 text-white',
  },
  info: {
    icon: Info,
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-800',
    badge: 'bg-blue-500 text-white',
  },
};

export function ExecutiveAlertBar({ alerts, onDismiss, className = '' }: ExecutiveAlertBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (alerts.length === 0) return null;

  const criticalCount = alerts.filter(a => a.priority === 'critical').length;
  const warningCount = alerts.filter(a => a.priority === 'warning').length;
  const infoCount = alerts.filter(a => a.priority === 'info').length;

  const displayedAlerts = isExpanded ? alerts : alerts.slice(0, 3);

  return (
    <Card className={`overflow-hidden ${className}`} data-testid="executive-alert-bar">
      {/* Summary Header */}
      <div
        className="flex items-center justify-between p-3 bg-gradient-to-r from-gray-50 to-gray-100 border-b cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold text-gray-700">Alerts</span>
          <div className="flex items-center gap-2">
            {criticalCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500 text-white" data-testid="critical-count">
                <AlertTriangle className="h-3 w-3" />
                {criticalCount} Critical
              </span>
            )}
            {warningCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500 text-white" data-testid="warning-count">
                <AlertCircle className="h-3 w-3" />
                {warningCount} Warning
              </span>
            )}
            {infoCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500 text-white" data-testid="info-count">
                <Info className="h-3 w-3" />
                {infoCount} Info
              </span>
            )}
          </div>
        </div>
        <Button variant="ghost" size="sm" className="h-7 px-2">
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          <span className="ml-1 text-xs">{isExpanded ? 'Collapse' : 'Expand'}</span>
        </Button>
      </div>

      {/* Alert List */}
      <div className="divide-y divide-gray-100">
        {displayedAlerts.map((alert) => {
          const config = priorityConfig[alert.priority];
          const Icon = config.icon;

          return (
            <div
              key={alert.id}
              className={`flex items-start gap-3 p-3 ${config.bg}`}
              data-testid={`alert-${alert.id}`}
            >
              <div className={`p-1.5 rounded-full ${config.badge}`}>
                <Icon className="h-4 w-4" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`text-sm font-semibold ${config.text}`}>{alert.title}</p>
                  {alert.formattedValue && (
                    <span className="text-sm font-bold text-gray-900">{alert.formattedValue}</span>
                  )}
                </div>
                <p className="text-xs text-gray-600 mt-0.5">{alert.message}</p>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href={alert.actionLink}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${config.text} hover:underline`}
                >
                  {alert.actionLabel}
                  <ExternalLink className="h-3 w-3" />
                </Link>
                {onDismiss && alert.priority !== 'critical' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDismiss(alert.id);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Show more indicator */}
      {!isExpanded && alerts.length > 3 && (
        <div
          className="p-2 text-center text-xs text-gray-500 bg-gray-50 cursor-pointer hover:bg-gray-100"
          onClick={() => setIsExpanded(true)}
        >
          + {alerts.length - 3} more alerts
        </div>
      )}
    </Card>
  );
}

export function ExecutiveAlertBarSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between p-3 bg-gray-50 border-b">
        <div className="flex items-center gap-4">
          <div className="h-4 w-12 bg-gray-200 rounded animate-pulse" />
          <div className="flex gap-2">
            <div className="h-5 w-20 bg-gray-200 rounded-full animate-pulse" />
            <div className="h-5 w-20 bg-gray-200 rounded-full animate-pulse" />
          </div>
        </div>
      </div>
      <div className="p-3 space-y-2">
        <div className="h-12 bg-gray-100 rounded animate-pulse" />
        <div className="h-12 bg-gray-100 rounded animate-pulse" />
      </div>
    </Card>
  );
}
```

**Step 2: Update index.ts exports**

Add to `src/components/accounting/index.ts`:

```typescript
export { ExecutiveAlertBar, ExecutiveAlertBarSkeleton } from './executive-alert-bar';
export type { ExecutiveAlertBarProps } from './executive-alert-bar';
```

**Step 3: Run TypeScript check**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/accounting/executive-alert-bar.tsx src/components/accounting/index.ts
git commit -m "feat(accounting): add ExecutiveAlertBar component

Alert bar with:
- Priority-based styling (critical/warning/info)
- Collapsible alert list
- Count badges by priority
- Action links for each alert
- Dismissible non-critical alerts
- Skeleton loading state

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 3.3: Create Chart Components

**Files:**
- Create: `src/components/accounting/charts/revenue-expenses-trend.tsx`
- Create: `src/components/accounting/charts/expense-breakdown-chart.tsx`
- Create: `src/components/accounting/charts/index.ts`

**Step 1: Create RevenueExpensesTrend chart**

```typescript
'use client';

import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';

interface TrendDataPoint {
  month: string;
  revenue: number;
  cogs: number;
  operatingExpenses: number;
  netIncome: number;
}

export interface RevenueExpensesTrendProps {
  data: TrendDataPoint[];
  isLoading?: boolean;
  className?: string;
}

function formatCompactCurrency(amount: number): string {
  if (Math.abs(amount) >= 1000000) {
    return `฿${(amount / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(amount) >= 1000) {
    return `฿${(amount / 1000).toFixed(0)}K`;
  }
  return `฿${amount.toFixed(0)}`;
}

export function RevenueExpensesTrend({ data, isLoading, className = '' }: RevenueExpensesTrendProps) {
  return (
    <Card className={className} data-testid="revenue-expenses-trend">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-emerald-500" />
          Revenue vs Expenses Trend
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[300px] flex items-center justify-center">
            <div className="animate-pulse text-gray-400">Loading...</div>
          </div>
        ) : (
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="cogsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="opexGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} />
                <YAxis tick={{ fontSize: 12 }} tickLine={false} tickFormatter={formatCompactCurrency} />
                <Tooltip
                  formatter={(value: number) => formatCompactCurrency(value)}
                  labelStyle={{ fontWeight: 600 }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue"
                  stroke="#22c55e"
                  strokeWidth={2}
                  fill="url(#revenueGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="cogs"
                  name="COGS"
                  stroke="#f97316"
                  strokeWidth={2}
                  fill="url(#cogsGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="operatingExpenses"
                  name="Operating Expenses"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#opexGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

**Step 2: Create ExpenseBreakdownChart**

```typescript
'use client';

import React from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { PieChartIcon } from 'lucide-react';
import type { ExpenseCategory } from '@/types/accounting';

export interface ExpenseBreakdownChartProps {
  data: ExpenseCategory[];
  totalExpenses: number;
  isLoading?: boolean;
  className?: string;
}

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#6b7280'];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function ExpenseBreakdownChart({ data, totalExpenses, isLoading, className = '' }: ExpenseBreakdownChartProps) {
  return (
    <Card className={className} data-testid="expense-breakdown-chart">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <PieChartIcon className="h-5 w-5 text-purple-500" />
          Expense Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[250px] flex items-center justify-center">
            <div className="animate-pulse text-gray-400">Loading...</div>
          </div>
        ) : (
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="amount"
                  nameKey="categoryName"
                  label={({ categoryName, percentage }) => `${categoryName} (${percentage.toFixed(0)}%)`}
                  labelLine={false}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="mt-2 text-center">
          <p className="text-sm text-gray-500">Total Expenses</p>
          <p className="text-lg font-bold text-gray-900">{formatCurrency(totalExpenses)}</p>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 3: Create charts index**

```typescript
export { RevenueExpensesTrend } from './revenue-expenses-trend';
export type { RevenueExpensesTrendProps } from './revenue-expenses-trend';

export { ExpenseBreakdownChart } from './expense-breakdown-chart';
export type { ExpenseBreakdownChartProps } from './expense-breakdown-chart';
```

**Step 4: Run TypeScript check**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: No errors

**Step 5: Commit**

```bash
git add src/components/accounting/charts/
git commit -m "feat(accounting): add executive dashboard chart components

Add chart components:
- RevenueExpensesTrend: 12-month area chart
- ExpenseBreakdownChart: Donut chart with legend

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Phase 4: Dashboard Page Refactor

### Task 4.1: Refactor Accounting Dashboard Page

**Files:**
- Modify: `src/app/accounting/page.tsx`

**Step 1: Replace entire dashboard page**

The full implementation is too long for this plan. Key changes:
1. Replace 4 KPIs with 8 ExecutiveKPICard components in 2 rows
2. Add ExecutiveAlertBar at top
3. Add period selector (MTD/QTD/YTD/Custom)
4. Replace charts with new executive charts
5. Update data fetching to use new API endpoints

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: No errors

**Step 3: Run UI tests**

Run: `npm test tests/app/accounting/page.test.tsx`
Expected: Tests may need updates for new structure

**Step 4: Commit**

```bash
git add src/app/accounting/page.tsx
git commit -m "feat(accounting): refactor dashboard with executive design

Dashboard now includes:
- 8 executive KPIs in 2 rows
- Priority-based alert bar
- Period selector (MTD/QTD/YTD)
- Revenue vs Expenses trend chart
- Expense breakdown donut chart
- Updated quick links by category

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Phase 5: Tests

### Task 5.1: Update Dashboard Tests

**Files:**
- Modify: `tests/app/accounting/page.test.tsx`

**Step 1: Update tests for new structure**

Update the test file to mock the new API endpoints and test:
- Executive KPI cards render
- Alert bar renders with priority badges
- Period selector works
- Charts render
- Quick links by category

**Step 2: Run tests**

Run: `npm test tests/app/accounting/page.test.tsx`
Expected: All tests pass

**Step 3: Commit**

```bash
git add tests/app/accounting/page.test.tsx
git commit -m "test(accounting): update dashboard tests for executive design

Update tests to cover:
- Executive KPI card rendering
- Alert bar with priority counts
- Period selector functionality
- Chart components

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Phase 6: Final Verification

### Task 6.1: Type Check and Lint

**Step 1: Run full type check**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: No errors

**Step 2: Run lint**

Run: `npm run lint`
Expected: No errors (or only warnings)

**Step 3: Run all accounting tests**

Run: `npm test tests/app/accounting/`
Expected: All tests pass

**Step 4: Manual browser verification**

1. Navigate to http://localhost:33021/accounting
2. Verify 8 KPI cards display with real data
3. Verify alert bar shows (if alerts exist)
4. Verify charts render
5. Verify period selector works

---

## Summary

| Phase | Tasks | Estimated Steps |
|-------|-------|-----------------|
| 1. Types | 1.1 | 3 |
| 2. API | 2.1, 2.2 | 8 |
| 3. Components | 3.1, 3.2, 3.3 | 14 |
| 4. Dashboard | 4.1 | 4 |
| 5. Tests | 5.1 | 3 |
| 6. Verification | 6.1 | 4 |

**Total: 36 steps across 8 tasks**

Each step is a discrete action taking 2-5 minutes.
