/**
 * Executive Dashboard Service
 * Provides KPI calculations and alerts for executive-level accounting dashboard
 * Feature: 014-unit-cost
 */

import { getDb } from '../db';
import { eq, and, sql, gte, lte, lt, desc } from 'drizzle-orm';
import { toQueryDate, getTodayStr, formatDateFromDb } from '../db/date-utils';
import { getAccountingTables } from './accounting.service';
import type {
  ExecutiveKPI,
  ExecutiveMetrics,
  ExecutiveAlert,
  AlertPriority,
  AlertType,
} from '@/types/accounting';

// ============================================
// Formatting Helper Functions
// ============================================

/**
 * Format amount as Thai Baht currency
 * @param amount - The numeric amount to format
 * @returns Formatted string with Thai Baht symbol
 */
export function formatCurrency(amount: number): string {
  const absAmount = Math.abs(amount);
  const formatted = new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(absAmount);
  return amount < 0 ? `-฿${formatted}` : `฿${formatted}`;
}

/**
 * Format value as percentage
 * @param value - The numeric value (already in percentage form, e.g., 25 for 25%)
 * @returns Formatted string with percentage symbol
 */
export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * Format value as days
 * @param value - The number of days
 * @returns Formatted string with "days" suffix
 */
export function formatDays(value: number): string {
  return `${Math.round(value)} days`;
}

/**
 * Format value as ratio (e.g., 1.5:1)
 * @param value - The ratio value
 * @returns Formatted string in ratio format
 */
export function formatRatio(value: number): string {
  return `${value.toFixed(2)}:1`;
}

/**
 * Format value as times (e.g., 4.2x)
 * @param value - The times value
 * @returns Formatted string with "x" suffix
 */
export function formatTimes(value: number): string {
  return `${value.toFixed(1)}x`;
}

// ============================================
// KPI Status and Trend Helpers
// ============================================

interface KPIThresholds {
  good: number;
  warning: number;
}

/**
 * Determine KPI status based on value and thresholds
 * @param value - The current KPI value
 * @param thresholds - Object with good and warning thresholds
 * @param higherIsBetter - Whether higher values indicate better performance
 * @returns 'good', 'warning', or 'danger' status
 */
export function getKPIStatus(
  value: number,
  thresholds: KPIThresholds,
  higherIsBetter: boolean = true
): 'good' | 'warning' | 'danger' {
  if (higherIsBetter) {
    if (value >= thresholds.good) return 'good';
    if (value >= thresholds.warning) return 'warning';
    return 'danger';
  } else {
    // Lower is better (e.g., DSO, DPO)
    if (value <= thresholds.good) return 'good';
    if (value <= thresholds.warning) return 'warning';
    return 'danger';
  }
}

/**
 * Calculate trend direction based on current and previous values
 * @param current - Current period value
 * @param previous - Previous period value
 * @returns 'up', 'down', or 'neutral' trend
 */
export function calculateTrend(
  current: number,
  previous: number
): 'up' | 'down' | 'neutral' {
  const threshold = 0.01; // 1% threshold for neutral
  if (previous === 0) {
    return current > 0 ? 'up' : current < 0 ? 'down' : 'neutral';
  }
  const change = (current - previous) / Math.abs(previous);
  if (change > threshold) return 'up';
  if (change < -threshold) return 'down';
  return 'neutral';
}

// ============================================
// Date Range Helper
// ============================================

export type PeriodType = 'MTD' | 'QTD' | 'YTD' | 'custom';

interface DateRange {
  startDate: string;
  endDate: string;
  daysInPeriod: number;
}

/**
 * Calculate date range based on period type
 * @param period - Period type: MTD, QTD, YTD, or custom
 * @param asOfDate - The reference date (end date)
 * @param customStart - Optional custom start date for 'custom' period
 * @returns Object with startDate, endDate, and daysInPeriod
 */
export function getDateRange(
  period: PeriodType,
  asOfDate: string,
  customStart?: string
): DateRange {
  const endDate = asOfDate;
  const endDateObj = new Date(asOfDate);
  let startDateObj: Date;

  switch (period) {
    case 'MTD':
      // First day of current month
      startDateObj = new Date(endDateObj.getFullYear(), endDateObj.getMonth(), 1);
      break;
    case 'QTD':
      // First day of current quarter
      const quarter = Math.floor(endDateObj.getMonth() / 3);
      startDateObj = new Date(endDateObj.getFullYear(), quarter * 3, 1);
      break;
    case 'YTD':
      // First day of current year
      startDateObj = new Date(endDateObj.getFullYear(), 0, 1);
      break;
    case 'custom':
      if (!customStart) {
        throw new Error('customStart is required for custom period');
      }
      startDateObj = new Date(customStart);
      break;
    default:
      throw new Error(`Invalid period type: ${period}`);
  }

  const startDate = startDateObj.toISOString().split('T')[0];
  const daysInPeriod = Math.ceil(
    (endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24)
  ) + 1;

  return { startDate, endDate, daysInPeriod };
}

// ============================================
// Balance Calculation Functions
// ============================================

/**
 * Get cash balance as of a specific date
 * Cash accounts start with '11' (current assets - cash and cash equivalents)
 * @param asOfDate - The date to calculate balance as of
 * @returns Cash balance amount
 */
export async function getCashBalance(asOfDate: string): Promise<number> {
  const { glAccounts, glAccountTypes, journalEntries, journalLines } = getAccountingTables();
  const database = (await getDb()) as any;

  const result = await database
    .select({
      debitTotal: sql<number>`COALESCE(SUM(${journalLines.debit}), 0)`,
      creditTotal: sql<number>`COALESCE(SUM(${journalLines.credit}), 0)`,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
    .innerJoin(glAccounts, eq(journalLines.glAccountId, glAccounts.id))
    .where(
      and(
        sql`${glAccounts.code} LIKE '11%'`,
        eq(journalEntries.status, 'posted'),
        lte(journalEntries.entryDate, toQueryDate(asOfDate))
      )
    );

  const debitTotal = Number(result[0]?.debitTotal || 0);
  const creditTotal = Number(result[0]?.creditTotal || 0);

  // Cash is a debit-balance account
  return debitTotal - creditTotal;
}

/**
 * Get accounts receivable balance as of a specific date
 * AR accounts start with '12' (current assets - receivables)
 * @param asOfDate - The date to calculate balance as of
 * @returns AR balance amount
 */
export async function getARBalance(asOfDate: string): Promise<number> {
  const { glAccounts, journalEntries, journalLines } = getAccountingTables();
  const database = (await getDb()) as any;

  const result = await database
    .select({
      debitTotal: sql<number>`COALESCE(SUM(${journalLines.debit}), 0)`,
      creditTotal: sql<number>`COALESCE(SUM(${journalLines.credit}), 0)`,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
    .innerJoin(glAccounts, eq(journalLines.glAccountId, glAccounts.id))
    .where(
      and(
        sql`${glAccounts.code} LIKE '12%'`,
        eq(journalEntries.status, 'posted'),
        lte(journalEntries.entryDate, toQueryDate(asOfDate))
      )
    );

  const debitTotal = Number(result[0]?.debitTotal || 0);
  const creditTotal = Number(result[0]?.creditTotal || 0);

  // AR is a debit-balance account
  return debitTotal - creditTotal;
}

/**
 * Get accounts payable balance as of a specific date
 * AP accounts start with '21' (current liabilities)
 * @param asOfDate - The date to calculate balance as of
 * @returns AP balance amount
 */
export async function getAPBalance(asOfDate: string): Promise<number> {
  const { glAccounts, journalEntries, journalLines } = getAccountingTables();
  const database = (await getDb()) as any;

  const result = await database
    .select({
      debitTotal: sql<number>`COALESCE(SUM(${journalLines.debit}), 0)`,
      creditTotal: sql<number>`COALESCE(SUM(${journalLines.credit}), 0)`,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
    .innerJoin(glAccounts, eq(journalLines.glAccountId, glAccounts.id))
    .where(
      and(
        sql`${glAccounts.code} LIKE '21%'`,
        eq(journalEntries.status, 'posted'),
        lte(journalEntries.entryDate, toQueryDate(asOfDate))
      )
    );

  const debitTotal = Number(result[0]?.debitTotal || 0);
  const creditTotal = Number(result[0]?.creditTotal || 0);

  // AP is a credit-balance account
  return creditTotal - debitTotal;
}

/**
 * Get inventory balance as of a specific date
 * Inventory accounts start with '14' or '15' (current assets - inventory)
 * @param asOfDate - The date to calculate balance as of
 * @returns Inventory balance amount
 */
export async function getInventoryBalance(asOfDate: string): Promise<number> {
  const { glAccounts, journalEntries, journalLines } = getAccountingTables();
  const database = (await getDb()) as any;

  const result = await database
    .select({
      debitTotal: sql<number>`COALESCE(SUM(${journalLines.debit}), 0)`,
      creditTotal: sql<number>`COALESCE(SUM(${journalLines.credit}), 0)`,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
    .innerJoin(glAccounts, eq(journalLines.glAccountId, glAccounts.id))
    .where(
      and(
        sql`(${glAccounts.code} LIKE '14%' OR ${glAccounts.code} LIKE '15%')`,
        eq(journalEntries.status, 'posted'),
        lte(journalEntries.entryDate, toQueryDate(asOfDate))
      )
    );

  const debitTotal = Number(result[0]?.debitTotal || 0);
  const creditTotal = Number(result[0]?.creditTotal || 0);

  // Inventory is a debit-balance account
  return debitTotal - creditTotal;
}

/**
 * Get current assets balance as of a specific date
 * Current asset accounts start with '11', '12', '13', '14', '15'
 * @param asOfDate - The date to calculate balance as of
 * @returns Current assets balance
 */
export async function getCurrentAssets(asOfDate: string): Promise<number> {
  const { glAccounts, journalEntries, journalLines } = getAccountingTables();
  const database = (await getDb()) as any;

  const result = await database
    .select({
      debitTotal: sql<number>`COALESCE(SUM(${journalLines.debit}), 0)`,
      creditTotal: sql<number>`COALESCE(SUM(${journalLines.credit}), 0)`,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
    .innerJoin(glAccounts, eq(journalLines.glAccountId, glAccounts.id))
    .where(
      and(
        sql`(${glAccounts.code} LIKE '11%' OR ${glAccounts.code} LIKE '12%' OR ${glAccounts.code} LIKE '13%' OR ${glAccounts.code} LIKE '14%' OR ${glAccounts.code} LIKE '15%')`,
        eq(journalEntries.status, 'posted'),
        lte(journalEntries.entryDate, toQueryDate(asOfDate))
      )
    );

  const debitTotal = Number(result[0]?.debitTotal || 0);
  const creditTotal = Number(result[0]?.creditTotal || 0);

  return debitTotal - creditTotal;
}

/**
 * Get current liabilities balance as of a specific date
 * Current liability accounts start with '21'
 * @param asOfDate - The date to calculate balance as of
 * @returns Current liabilities balance
 */
export async function getCurrentLiabilities(asOfDate: string): Promise<number> {
  const { glAccounts, journalEntries, journalLines } = getAccountingTables();
  const database = (await getDb()) as any;

  const result = await database
    .select({
      debitTotal: sql<number>`COALESCE(SUM(${journalLines.debit}), 0)`,
      creditTotal: sql<number>`COALESCE(SUM(${journalLines.credit}), 0)`,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
    .innerJoin(glAccounts, eq(journalLines.glAccountId, glAccounts.id))
    .where(
      and(
        sql`${glAccounts.code} LIKE '21%'`,
        eq(journalEntries.status, 'posted'),
        lte(journalEntries.entryDate, toQueryDate(asOfDate))
      )
    );

  const debitTotal = Number(result[0]?.debitTotal || 0);
  const creditTotal = Number(result[0]?.creditTotal || 0);

  // Liabilities have credit balance
  return creditTotal - debitTotal;
}

/**
 * Get period totals for revenue or expense accounts
 * @param startDate - Period start date
 * @param endDate - Period end date
 * @param category - 'revenue' or 'expense'
 * @returns Total amount for the category in the period
 */
export async function getPeriodTotals(
  startDate: string,
  endDate: string,
  category: 'revenue' | 'expense'
): Promise<number> {
  const { glAccounts, glAccountTypes, journalEntries, journalLines } = getAccountingTables();
  const database = (await getDb()) as any;

  const result = await database
    .select({
      debitTotal: sql<number>`COALESCE(SUM(${journalLines.debit}), 0)`,
      creditTotal: sql<number>`COALESCE(SUM(${journalLines.credit}), 0)`,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
    .innerJoin(glAccounts, eq(journalLines.glAccountId, glAccounts.id))
    .innerJoin(glAccountTypes, eq(glAccounts.accountTypeId, glAccountTypes.id))
    .where(
      and(
        eq(glAccountTypes.category, category),
        eq(journalEntries.status, 'posted'),
        gte(journalEntries.entryDate, toQueryDate(startDate)),
        lte(journalEntries.entryDate, toQueryDate(endDate))
      )
    );

  const debitTotal = Number(result[0]?.debitTotal || 0);
  const creditTotal = Number(result[0]?.creditTotal || 0);

  // Revenue is credit balance, expenses are debit balance
  if (category === 'revenue') {
    return creditTotal - debitTotal;
  }
  return debitTotal - creditTotal;
}

/**
 * Get Cost of Goods Sold for a period
 * COGS accounts start with '51' (cost of sales)
 * @param startDate - Period start date
 * @param endDate - Period end date
 * @returns COGS amount for the period
 */
export async function getCOGS(startDate: string, endDate: string): Promise<number> {
  const { glAccounts, journalEntries, journalLines } = getAccountingTables();
  const database = (await getDb()) as any;

  const result = await database
    .select({
      debitTotal: sql<number>`COALESCE(SUM(${journalLines.debit}), 0)`,
      creditTotal: sql<number>`COALESCE(SUM(${journalLines.credit}), 0)`,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
    .innerJoin(glAccounts, eq(journalLines.glAccountId, glAccounts.id))
    .where(
      and(
        sql`${glAccounts.code} LIKE '51%'`,
        eq(journalEntries.status, 'posted'),
        gte(journalEntries.entryDate, toQueryDate(startDate)),
        lte(journalEntries.entryDate, toQueryDate(endDate))
      )
    );

  const debitTotal = Number(result[0]?.debitTotal || 0);
  const creditTotal = Number(result[0]?.creditTotal || 0);

  // COGS is a debit-balance account (expense type)
  return debitTotal - creditTotal;
}

// ============================================
// Sparkline Data Generation
// ============================================

/**
 * Generate sparkline data for a KPI over the past 6 months
 * @param calculateValue - Function to calculate the KPI value for a given date
 * @param asOfDate - Reference date
 * @returns Array of 6 values representing monthly data
 */
async function generateSparklineData(
  calculateValue: (date: string) => Promise<number>,
  asOfDate: string
): Promise<number[]> {
  const data: number[] = [];
  const endDateObj = new Date(asOfDate);

  for (let i = 5; i >= 0; i--) {
    const monthDate = new Date(endDateObj);
    monthDate.setMonth(monthDate.getMonth() - i);
    // Get last day of the month
    const lastDay = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
    const dateStr = lastDay.toISOString().split('T')[0];

    try {
      const value = await calculateValue(dateStr);
      data.push(value);
    } catch {
      data.push(0);
    }
  }

  return data;
}

// ============================================
// Main KPI Functions
// ============================================

/**
 * Get all executive metrics/KPIs for the dashboard
 * @param asOfDate - The reference date for calculations
 * @param period - Period type: MTD, QTD, YTD, or custom
 * @param customStart - Optional custom start date
 * @returns ExecutiveMetrics object with all KPIs
 */
export async function getExecutiveMetrics(
  asOfDate: string = getTodayStr(),
  period: PeriodType = 'MTD',
  customStart?: string
): Promise<ExecutiveMetrics> {
  const dateRange = getDateRange(period, asOfDate, customStart);
  const { startDate, endDate, daysInPeriod } = dateRange;

  // Get current period balances
  const [
    cashBalance,
    arBalance,
    apBalance,
    inventoryBalance,
    currentAssets,
    currentLiabilities,
    revenue,
    expenses,
    cogs,
  ] = await Promise.all([
    getCashBalance(asOfDate),
    getARBalance(asOfDate),
    getAPBalance(asOfDate),
    getInventoryBalance(asOfDate),
    getCurrentAssets(asOfDate),
    getCurrentLiabilities(asOfDate),
    getPeriodTotals(startDate, endDate, 'revenue'),
    getPeriodTotals(startDate, endDate, 'expense'),
    getCOGS(startDate, endDate),
  ]);

  // Calculate previous period for trend comparison
  const prevEndDate = new Date(startDate);
  prevEndDate.setDate(prevEndDate.getDate() - 1);
  const prevEndDateStr = prevEndDate.toISOString().split('T')[0];
  const prevStartDate = new Date(prevEndDate);

  // Match the period length
  switch (period) {
    case 'MTD':
      prevStartDate.setDate(1);
      break;
    case 'QTD':
      const quarter = Math.floor(prevEndDate.getMonth() / 3);
      prevStartDate.setMonth(quarter * 3);
      prevStartDate.setDate(1);
      break;
    case 'YTD':
      prevStartDate.setMonth(0);
      prevStartDate.setDate(1);
      break;
    case 'custom':
      prevStartDate.setTime(prevEndDate.getTime() - (daysInPeriod - 1) * 24 * 60 * 60 * 1000);
      break;
  }
  const prevStartDateStr = prevStartDate.toISOString().split('T')[0];

  // Get previous period values for trend comparison
  const [
    prevCashBalance,
    prevArBalance,
    prevApBalance,
    prevInventoryBalance,
    prevCurrentAssets,
    prevCurrentLiabilities,
    prevRevenue,
    prevExpenses,
    prevCogs,
  ] = await Promise.all([
    getCashBalance(prevEndDateStr),
    getARBalance(prevEndDateStr),
    getAPBalance(prevEndDateStr),
    getInventoryBalance(prevEndDateStr),
    getCurrentAssets(prevEndDateStr),
    getCurrentLiabilities(prevEndDateStr),
    getPeriodTotals(prevStartDateStr, prevEndDateStr, 'revenue'),
    getPeriodTotals(prevStartDateStr, prevEndDateStr, 'expense'),
    getCOGS(prevStartDateStr, prevEndDateStr),
  ]);

  // Calculate KPIs
  // 1. Working Capital = Current Assets - Current Liabilities
  const workingCapital = currentAssets - currentLiabilities;
  const prevWorkingCapital = prevCurrentAssets - prevCurrentLiabilities;

  // 2. Current Ratio = Current Assets / Current Liabilities
  const currentRatio = currentLiabilities > 0 ? currentAssets / currentLiabilities : 0;
  const prevCurrentRatio = prevCurrentLiabilities > 0 ? prevCurrentAssets / prevCurrentLiabilities : 0;

  // 3. Quick Ratio = (Cash + AR) / Current Liabilities
  const quickRatio = currentLiabilities > 0 ? (cashBalance + arBalance) / currentLiabilities : 0;
  const prevQuickRatio = prevCurrentLiabilities > 0 ? (prevCashBalance + prevArBalance) / prevCurrentLiabilities : 0;

  // 4. DSO = (AR / Revenue) x Days in period
  const dso = revenue > 0 ? (arBalance / revenue) * daysInPeriod : 0;
  const prevDaysInPeriod = Math.ceil(
    (prevEndDate.getTime() - prevStartDate.getTime()) / (1000 * 60 * 60 * 24)
  ) + 1;
  const prevDso = prevRevenue > 0 ? (prevArBalance / prevRevenue) * prevDaysInPeriod : 0;

  // 5. Gross Profit Margin = (Revenue - COGS) / Revenue x 100
  const grossProfitMargin = revenue > 0 ? ((revenue - cogs) / revenue) * 100 : 0;
  const prevGrossProfitMargin = prevRevenue > 0 ? ((prevRevenue - prevCogs) / prevRevenue) * 100 : 0;

  // 6. Operating Cash Flow = Revenue - Expenses (simplified)
  const operatingCashFlow = revenue - expenses;
  const prevOperatingCashFlow = prevRevenue - prevExpenses;

  // 7. DPO = (AP / COGS) x Days in period
  const dpo = cogs > 0 ? (apBalance / cogs) * daysInPeriod : 0;
  const prevDpo = prevCogs > 0 ? (prevApBalance / prevCogs) * prevDaysInPeriod : 0;

  // 8. Inventory Turnover = (COGS / Avg Inventory) x annualization factor
  const avgInventory = (inventoryBalance + prevInventoryBalance) / 2;
  const annualizationFactor = 365 / daysInPeriod;
  const inventoryTurnover = avgInventory > 0 ? (cogs / avgInventory) * annualizationFactor : 0;
  const prevAvgInventory = prevInventoryBalance; // Simplified for previous period
  const prevInventoryTurnover = prevAvgInventory > 0 ? (prevCogs / prevAvgInventory) * annualizationFactor : 0;

  // Generate sparkline data
  const [
    workingCapitalSparkline,
    currentRatioSparkline,
    quickRatioSparkline,
    dsoSparkline,
    grossMarginSparkline,
    cashFlowSparkline,
    dpoSparkline,
    inventoryTurnoverSparkline,
  ] = await Promise.all([
    generateSparklineData(async (date) => {
      const ca = await getCurrentAssets(date);
      const cl = await getCurrentLiabilities(date);
      return ca - cl;
    }, asOfDate),
    generateSparklineData(async (date) => {
      const ca = await getCurrentAssets(date);
      const cl = await getCurrentLiabilities(date);
      return cl > 0 ? ca / cl : 0;
    }, asOfDate),
    generateSparklineData(async (date) => {
      const cash = await getCashBalance(date);
      const ar = await getARBalance(date);
      const cl = await getCurrentLiabilities(date);
      return cl > 0 ? (cash + ar) / cl : 0;
    }, asOfDate),
    generateSparklineData(async (date) => {
      const endDateObj = new Date(date);
      const startDateObj = new Date(endDateObj.getFullYear(), endDateObj.getMonth(), 1);
      const startStr = startDateObj.toISOString().split('T')[0];
      const days = Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const ar = await getARBalance(date);
      const rev = await getPeriodTotals(startStr, date, 'revenue');
      return rev > 0 ? (ar / rev) * days : 0;
    }, asOfDate),
    generateSparklineData(async (date) => {
      const endDateObj = new Date(date);
      const startDateObj = new Date(endDateObj.getFullYear(), endDateObj.getMonth(), 1);
      const startStr = startDateObj.toISOString().split('T')[0];
      const rev = await getPeriodTotals(startStr, date, 'revenue');
      const cogsVal = await getCOGS(startStr, date);
      return rev > 0 ? ((rev - cogsVal) / rev) * 100 : 0;
    }, asOfDate),
    generateSparklineData(async (date) => {
      const endDateObj = new Date(date);
      const startDateObj = new Date(endDateObj.getFullYear(), endDateObj.getMonth(), 1);
      const startStr = startDateObj.toISOString().split('T')[0];
      const rev = await getPeriodTotals(startStr, date, 'revenue');
      const exp = await getPeriodTotals(startStr, date, 'expense');
      return rev - exp;
    }, asOfDate),
    generateSparklineData(async (date) => {
      const endDateObj = new Date(date);
      const startDateObj = new Date(endDateObj.getFullYear(), endDateObj.getMonth(), 1);
      const startStr = startDateObj.toISOString().split('T')[0];
      const days = Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const ap = await getAPBalance(date);
      const cogsVal = await getCOGS(startStr, date);
      return cogsVal > 0 ? (ap / cogsVal) * days : 0;
    }, asOfDate),
    generateSparklineData(async (date) => {
      const endDateObj = new Date(date);
      const startDateObj = new Date(endDateObj.getFullYear(), endDateObj.getMonth(), 1);
      const startStr = startDateObj.toISOString().split('T')[0];
      const days = Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const inv = await getInventoryBalance(date);
      const cogsVal = await getCOGS(startStr, date);
      const annFactor = 365 / days;
      return inv > 0 ? (cogsVal / inv) * annFactor : 0;
    }, asOfDate),
  ]);

  // Helper to calculate trend values
  const calcTrendPercentage = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : current < 0 ? -100 : 0;
    return ((current - previous) / Math.abs(previous)) * 100;
  };

  // Build KPI objects
  const workingCapitalKPI: ExecutiveKPI = {
    id: 'working-capital',
    label: 'Working Capital',
    value: workingCapital,
    formattedValue: formatCurrency(workingCapital),
    unit: 'currency',
    trend: calculateTrend(workingCapital, prevWorkingCapital),
    trendValue: workingCapital - prevWorkingCapital,
    trendPercentage: calcTrendPercentage(workingCapital, prevWorkingCapital),
    sparklineData: workingCapitalSparkline,
    status: getKPIStatus(workingCapital, { good: 1000000, warning: 500000 }, true),
    targetMin: 500000,
  };

  const currentRatioKPI: ExecutiveKPI = {
    id: 'current-ratio',
    label: 'Current Ratio',
    value: currentRatio,
    formattedValue: formatRatio(currentRatio),
    unit: 'ratio',
    trend: calculateTrend(currentRatio, prevCurrentRatio),
    trendValue: currentRatio - prevCurrentRatio,
    trendPercentage: calcTrendPercentage(currentRatio, prevCurrentRatio),
    sparklineData: currentRatioSparkline,
    status: getKPIStatus(currentRatio, { good: 2.0, warning: 1.5 }, true),
    targetMin: 1.5,
    targetMax: 3.0,
  };

  const quickRatioKPI: ExecutiveKPI = {
    id: 'quick-ratio',
    label: 'Quick Ratio',
    value: quickRatio,
    formattedValue: formatRatio(quickRatio),
    unit: 'ratio',
    trend: calculateTrend(quickRatio, prevQuickRatio),
    trendValue: quickRatio - prevQuickRatio,
    trendPercentage: calcTrendPercentage(quickRatio, prevQuickRatio),
    sparklineData: quickRatioSparkline,
    status: getKPIStatus(quickRatio, { good: 1.0, warning: 0.75 }, true),
    targetMin: 1.0,
  };

  const dsoKPI: ExecutiveKPI = {
    id: 'dso',
    label: 'Days Sales Outstanding',
    value: dso,
    formattedValue: formatDays(dso),
    unit: 'days',
    trend: calculateTrend(dso, prevDso),
    trendValue: dso - prevDso,
    trendPercentage: calcTrendPercentage(dso, prevDso),
    sparklineData: dsoSparkline,
    status: getKPIStatus(dso, { good: 30, warning: 45 }, false), // Lower is better
    targetMax: 45,
  };

  const grossProfitMarginKPI: ExecutiveKPI = {
    id: 'gross-profit-margin',
    label: 'Gross Profit Margin',
    value: grossProfitMargin,
    formattedValue: formatPercentage(grossProfitMargin),
    unit: 'percentage',
    trend: calculateTrend(grossProfitMargin, prevGrossProfitMargin),
    trendValue: grossProfitMargin - prevGrossProfitMargin,
    trendPercentage: calcTrendPercentage(grossProfitMargin, prevGrossProfitMargin),
    sparklineData: grossMarginSparkline,
    status: getKPIStatus(grossProfitMargin, { good: 30, warning: 20 }, true),
    targetMin: 25,
  };

  const operatingCashFlowKPI: ExecutiveKPI = {
    id: 'operating-cash-flow',
    label: 'Operating Cash Flow',
    value: operatingCashFlow,
    formattedValue: formatCurrency(operatingCashFlow),
    unit: 'currency',
    trend: calculateTrend(operatingCashFlow, prevOperatingCashFlow),
    trendValue: operatingCashFlow - prevOperatingCashFlow,
    trendPercentage: calcTrendPercentage(operatingCashFlow, prevOperatingCashFlow),
    sparklineData: cashFlowSparkline,
    status: getKPIStatus(operatingCashFlow, { good: 0, warning: -100000 }, true),
    targetMin: 0,
  };

  const dpoKPI: ExecutiveKPI = {
    id: 'dpo',
    label: 'Days Payable Outstanding',
    value: dpo,
    formattedValue: formatDays(dpo),
    unit: 'days',
    trend: calculateTrend(dpo, prevDpo),
    trendValue: dpo - prevDpo,
    trendPercentage: calcTrendPercentage(dpo, prevDpo),
    sparklineData: dpoSparkline,
    // DPO: higher can be good (better cash management) but too high is bad (supplier risk)
    status: dpo > 60 ? 'warning' : dpo >= 30 ? 'good' : 'warning',
    targetMin: 30,
    targetMax: 60,
  };

  const inventoryTurnoverKPI: ExecutiveKPI = {
    id: 'inventory-turnover',
    label: 'Inventory Turnover',
    value: inventoryTurnover,
    formattedValue: formatTimes(inventoryTurnover),
    unit: 'times',
    trend: calculateTrend(inventoryTurnover, prevInventoryTurnover),
    trendValue: inventoryTurnover - prevInventoryTurnover,
    trendPercentage: calcTrendPercentage(inventoryTurnover, prevInventoryTurnover),
    sparklineData: inventoryTurnoverSparkline,
    status: getKPIStatus(inventoryTurnover, { good: 6, warning: 4 }, true),
    targetMin: 4,
  };

  return {
    asOfDate,
    periodStart: startDate,
    periodEnd: endDate,
    workingCapital: workingCapitalKPI,
    currentRatio: currentRatioKPI,
    quickRatio: quickRatioKPI,
    dso: dsoKPI,
    grossProfitMargin: grossProfitMarginKPI,
    operatingCashFlow: operatingCashFlowKPI,
    dpo: dpoKPI,
    inventoryTurnover: inventoryTurnoverKPI,
  };
}

// ============================================
// Executive Alerts Function
// ============================================

/**
 * Generate priority-based alerts for executive dashboard
 * @param asOfDate - The reference date for calculations
 * @returns Array of ExecutiveAlert objects sorted by priority
 */
export async function getExecutiveAlerts(
  asOfDate: string = getTodayStr()
): Promise<ExecutiveAlert[]> {
  const alerts: ExecutiveAlert[] = [];
  const now = new Date().toISOString();

  // Get necessary data
  const dateRange = getDateRange('MTD', asOfDate);
  const { startDate, endDate, daysInPeriod } = dateRange;

  const [
    cashBalance,
    expenses,
    revenue,
    cogs,
  ] = await Promise.all([
    getCashBalance(asOfDate),
    getPeriodTotals(startDate, endDate, 'expense'),
    getPeriodTotals(startDate, endDate, 'revenue'),
    getCOGS(startDate, endDate),
  ]);

  // Get previous period for comparison
  const prevEndDate = new Date(startDate);
  prevEndDate.setDate(prevEndDate.getDate() - 1);
  const prevEndDateStr = prevEndDate.toISOString().split('T')[0];
  const prevStartDate = new Date(prevEndDate.getFullYear(), prevEndDate.getMonth(), 1);
  const prevStartDateStr = prevStartDate.toISOString().split('T')[0];

  const [prevRevenue, prevCogs] = await Promise.all([
    getPeriodTotals(prevStartDateStr, prevEndDateStr, 'revenue'),
    getCOGS(prevStartDateStr, prevEndDateStr),
  ]);

  // Alert 1: Low cash reserve (< 30 days expenses)
  const dailyExpenses = expenses / daysInPeriod;
  const cashReserveDays = dailyExpenses > 0 ? cashBalance / dailyExpenses : 999;

  if (cashReserveDays < 30) {
    const priority: AlertPriority = cashReserveDays < 15 ? 'critical' : 'warning';
    alerts.push({
      id: `cash-reserve-${Date.now()}`,
      type: 'cash_below_threshold',
      priority,
      title: 'Low Cash Reserve',
      message: `Cash reserve covers only ${Math.round(cashReserveDays)} days of operating expenses. Consider improving collections or securing credit line.`,
      value: cashReserveDays,
      formattedValue: formatDays(cashReserveDays),
      threshold: 30,
      actionLink: '/accounting/cash-flow',
      actionLabel: 'View Cash Flow',
      createdAt: now,
    });
  }

  // Alert 2: Declining gross margin (> 2% drop)
  const currentGrossMargin = revenue > 0 ? ((revenue - cogs) / revenue) * 100 : 0;
  const prevGrossMargin = prevRevenue > 0 ? ((prevRevenue - prevCogs) / prevRevenue) * 100 : 0;
  const marginDrop = prevGrossMargin - currentGrossMargin;

  if (marginDrop > 2) {
    const priority: AlertPriority = marginDrop > 5 ? 'critical' : 'warning';
    alerts.push({
      id: `gross-margin-${Date.now()}`,
      type: 'gross_margin_declining',
      priority,
      title: 'Gross Margin Declining',
      message: `Gross margin dropped ${marginDrop.toFixed(1)}% from ${prevGrossMargin.toFixed(1)}% to ${currentGrossMargin.toFixed(1)}%. Review pricing and COGS.`,
      value: marginDrop,
      formattedValue: formatPercentage(marginDrop),
      threshold: 2,
      actionLink: '/accounting/profitability',
      actionLabel: 'Analyze Profitability',
      createdAt: now,
    });
  }

  // Alert 3: Period close pending (> 5 days past end)
  const { fiscalPeriods } = getAccountingTables();
  const database = (await getDb()) as any;

  const pendingPeriods = await database
    .select()
    .from(fiscalPeriods)
    .where(
      and(
        eq(fiscalPeriods.status, 'open'),
        lt(fiscalPeriods.endDate, toQueryDate(asOfDate))
      )
    );

  for (const period of pendingPeriods) {
    const periodEndDate = new Date(formatDateFromDb(period.endDate));
    const currentDate = new Date(asOfDate);
    const daysPastEnd = Math.floor(
      (currentDate.getTime() - periodEndDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysPastEnd > 5) {
      const priority: AlertPriority = daysPastEnd > 15 ? 'critical' : daysPastEnd > 10 ? 'warning' : 'info';
      alerts.push({
        id: `period-close-${period.id}`,
        type: 'period_close_pending',
        priority,
        title: 'Period Close Pending',
        message: `Fiscal period "${period.periodName}" ended ${daysPastEnd} days ago and is still open. Please review and close.`,
        value: daysPastEnd,
        formattedValue: formatDays(daysPastEnd),
        threshold: 5,
        actionLink: '/accounting/fiscal-periods',
        actionLabel: 'Manage Periods',
        createdAt: now,
      });
    }
  }

  // Sort alerts by priority (critical first, then warning, then info)
  const priorityOrder: Record<AlertPriority, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };

  alerts.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return alerts;
}
