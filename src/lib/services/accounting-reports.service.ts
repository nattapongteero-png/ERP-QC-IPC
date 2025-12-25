/**
 * Accounting Reports Service
 * Financial statement generation following Thai Financial Reporting Standards (TFRS)
 * Feature: 010-accounting-module-integration
 * User Story 5: Generate Financial Statements
 */

import { db } from '../db';
import { eq, and, sql, gte, lte, inArray, lt } from 'drizzle-orm';
import { toQueryDate, formatDateFromDb } from '../db/date-utils';
import { getAccountingTables } from './accounting.service';
import type {
  TrialBalanceReport,
  TrialBalanceEntry,
  BalanceSheetReport,
  IncomeStatementReport,
  CashFlowStatementReport,
  AgingReport,
  AgingReportEntry,
  AgingBucket,
  AccountCategory,
} from '@/types/accounting';

// ============================================
// Trial Balance Report (T121)
// ============================================

/**
 * Generate Trial Balance as of a specific date
 * Shows all GL accounts with their opening, period activity, and closing balances
 * @param asOfDate - Date for the trial balance (YYYY-MM-DD)
 * @param fiscalYearStart - Start of fiscal year for opening balance calculation
 * @returns Trial balance report with account entries and totals
 */
export async function generateTrialBalance(
  asOfDate: string,
  fiscalYearStart?: string
): Promise<TrialBalanceReport> {
  const { glAccounts, glAccountTypes, journalEntries, journalLines } = getAccountingTables();
  const database = db();

  // Default fiscal year start to January 1st of the as-of-date year
  const yearStart = fiscalYearStart || `${asOfDate.substring(0, 4)}-01-01`;

  // Get all active GL accounts with their types
  const accounts = await database
    .select({
      id: glAccounts.id,
      code: glAccounts.code,
      nameTh: glAccounts.nameTh,
      nameEn: glAccounts.nameEn,
      isPostable: glAccounts.isPostable,
      accountTypeId: glAccounts.accountTypeId,
      typeCode: glAccountTypes.code,
      category: glAccountTypes.category,
      normalBalance: glAccountTypes.normalBalance,
    })
    .from(glAccounts)
    .innerJoin(glAccountTypes, eq(glAccounts.accountTypeId, glAccountTypes.id))
    .where(eq(glAccounts.isActive, true))
    .orderBy(glAccounts.code);

  const entries: TrialBalanceEntry[] = [];
  let totalOpeningDebit = 0;
  let totalOpeningCredit = 0;
  let totalPeriodDebit = 0;
  let totalPeriodCredit = 0;
  let totalClosingDebit = 0;
  let totalClosingCredit = 0;

  for (const account of accounts) {
    if (!account.isPostable) continue;

    // Get opening balance (transactions before fiscal year start)
    const openingBalanceResult = await database
      .select({
        debitTotal: sql<number>`COALESCE(SUM(${journalLines.debit}), 0)`,
        creditTotal: sql<number>`COALESCE(SUM(${journalLines.credit}), 0)`,
      })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
      .where(
        and(
          eq(journalLines.glAccountId, account.id),
          eq(journalEntries.status, 'posted'),
          lt(journalEntries.entryDate, toQueryDate(yearStart))
        )
      );

    // Get period activity (transactions from year start to as-of-date)
    const periodActivityResult = await database
      .select({
        debitTotal: sql<number>`COALESCE(SUM(${journalLines.debit}), 0)`,
        creditTotal: sql<number>`COALESCE(SUM(${journalLines.credit}), 0)`,
      })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
      .where(
        and(
          eq(journalLines.glAccountId, account.id),
          eq(journalEntries.status, 'posted'),
          gte(journalEntries.entryDate, toQueryDate(yearStart)),
          lte(journalEntries.entryDate, toQueryDate(asOfDate))
        )
      );

    const openingDebit = Number(openingBalanceResult[0]?.debitTotal || 0);
    const openingCredit = Number(openingBalanceResult[0]?.creditTotal || 0);
    const periodDebit = Number(periodActivityResult[0]?.debitTotal || 0);
    const periodCredit = Number(periodActivityResult[0]?.creditTotal || 0);

    // Calculate net opening balance based on normal balance
    const openingBalance = openingDebit - openingCredit;
    let openingDebitBalance = 0;
    let openingCreditBalance = 0;

    if (account.normalBalance === 'debit') {
      if (openingBalance >= 0) {
        openingDebitBalance = openingBalance;
      } else {
        openingCreditBalance = Math.abs(openingBalance);
      }
    } else {
      if (openingBalance <= 0) {
        openingCreditBalance = Math.abs(openingBalance);
      } else {
        openingDebitBalance = openingBalance;
      }
    }

    // Calculate closing balance
    const closingDebit = openingDebitBalance + periodDebit;
    const closingCredit = openingCreditBalance + periodCredit;
    const netClosingBalance = closingDebit - closingCredit;

    let closingDebitBalance = 0;
    let closingCreditBalance = 0;

    if (netClosingBalance > 0) {
      closingDebitBalance = netClosingBalance;
    } else if (netClosingBalance < 0) {
      closingCreditBalance = Math.abs(netClosingBalance);
    }

    // Only include accounts with activity or balance
    if (
      openingDebitBalance !== 0 ||
      openingCreditBalance !== 0 ||
      periodDebit !== 0 ||
      periodCredit !== 0
    ) {
      entries.push({
        accountCode: account.code,
        accountName: account.nameEn,
        accountType: account.typeCode,
        category: account.category as AccountCategory,
        openingDebit: openingDebitBalance,
        openingCredit: openingCreditBalance,
        periodDebit,
        periodCredit,
        closingDebit: closingDebitBalance,
        closingCredit: closingCreditBalance,
      });

      totalOpeningDebit += openingDebitBalance;
      totalOpeningCredit += openingCreditBalance;
      totalPeriodDebit += periodDebit;
      totalPeriodCredit += periodCredit;
      totalClosingDebit += closingDebitBalance;
      totalClosingCredit += closingCreditBalance;
    }
  }

  return {
    asOfDate,
    fiscalPeriod: yearStart,
    entries,
    totals: {
      openingDebit: totalOpeningDebit,
      openingCredit: totalOpeningCredit,
      periodDebit: totalPeriodDebit,
      periodCredit: totalPeriodCredit,
      closingDebit: totalClosingDebit,
      closingCredit: totalClosingCredit,
    },
  };
}

// ============================================
// Balance Sheet Report (T122)
// ============================================

/**
 * Generate Balance Sheet in TFRS format
 * Assets = Liabilities + Equity
 * @param asOfDate - Date for the balance sheet (YYYY-MM-DD)
 * @returns Balance sheet with current/non-current sections
 */
export async function generateBalanceSheet(asOfDate: string): Promise<BalanceSheetReport> {
  const { glAccounts, glAccountTypes, journalEntries, journalLines } = getAccountingTables();
  const database = db();

  // Helper to get account balance as of date
  async function getAccountBalance(accountId: number, normalBalance: string): Promise<number> {
    const result = await database
      .select({
        debitTotal: sql<number>`COALESCE(SUM(${journalLines.debit}), 0)`,
        creditTotal: sql<number>`COALESCE(SUM(${journalLines.credit}), 0)`,
      })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
      .where(
        and(
          eq(journalLines.glAccountId, accountId),
          eq(journalEntries.status, 'posted'),
          lte(journalEntries.entryDate, toQueryDate(asOfDate))
        )
      );

    const debitTotal = Number(result[0]?.debitTotal || 0);
    const creditTotal = Number(result[0]?.creditTotal || 0);

    // Return positive balance based on normal balance type
    if (normalBalance === 'debit') {
      return debitTotal - creditTotal;
    } else {
      return creditTotal - debitTotal;
    }
  }

  // Get all asset accounts
  const assetAccounts = await database
    .select({
      id: glAccounts.id,
      code: glAccounts.code,
      nameEn: glAccounts.nameEn,
      typeCode: glAccountTypes.code,
      normalBalance: glAccountTypes.normalBalance,
    })
    .from(glAccounts)
    .innerJoin(glAccountTypes, eq(glAccounts.accountTypeId, glAccountTypes.id))
    .where(
      and(eq(glAccounts.isActive, true), eq(glAccounts.isPostable, true), eq(glAccountTypes.category, 'asset'))
    )
    .orderBy(glAccounts.code);

  // Get all liability accounts
  const liabilityAccounts = await database
    .select({
      id: glAccounts.id,
      code: glAccounts.code,
      nameEn: glAccounts.nameEn,
      typeCode: glAccountTypes.code,
      normalBalance: glAccountTypes.normalBalance,
    })
    .from(glAccounts)
    .innerJoin(glAccountTypes, eq(glAccounts.accountTypeId, glAccountTypes.id))
    .where(
      and(
        eq(glAccounts.isActive, true),
        eq(glAccounts.isPostable, true),
        eq(glAccountTypes.category, 'liability')
      )
    )
    .orderBy(glAccounts.code);

  // Get all equity accounts
  const equityAccounts = await database
    .select({
      id: glAccounts.id,
      code: glAccounts.code,
      nameEn: glAccounts.nameEn,
      typeCode: glAccountTypes.code,
      normalBalance: glAccountTypes.normalBalance,
    })
    .from(glAccounts)
    .innerJoin(glAccountTypes, eq(glAccounts.accountTypeId, glAccountTypes.id))
    .where(
      and(eq(glAccounts.isActive, true), eq(glAccounts.isPostable, true), eq(glAccountTypes.category, 'equity'))
    )
    .orderBy(glAccounts.code);

  // Build current assets section (accounts starting with 11)
  const currentAssetsAccounts: Array<{ code: string; name: string; amount: number }> = [];
  let currentAssetsTotal = 0;

  for (const account of assetAccounts) {
    if (account.code.startsWith('11')) {
      const balance = await getAccountBalance(account.id, account.normalBalance);
      if (balance !== 0) {
        currentAssetsAccounts.push({
          code: account.code,
          name: account.nameEn,
          amount: balance,
        });
        currentAssetsTotal += balance;
      }
    }
  }

  // Build non-current assets section (accounts starting with 12, 13, 14, 15, 16, 17, 18, 19)
  const nonCurrentAssetsAccounts: Array<{ code: string; name: string; amount: number }> = [];
  let nonCurrentAssetsTotal = 0;

  for (const account of assetAccounts) {
    if (!account.code.startsWith('11') && account.code.startsWith('1')) {
      const balance = await getAccountBalance(account.id, account.normalBalance);
      if (balance !== 0) {
        nonCurrentAssetsAccounts.push({
          code: account.code,
          name: account.nameEn,
          amount: balance,
        });
        nonCurrentAssetsTotal += balance;
      }
    }
  }

  // Build current liabilities section (accounts starting with 21)
  const currentLiabilitiesAccounts: Array<{ code: string; name: string; amount: number }> = [];
  let currentLiabilitiesTotal = 0;

  for (const account of liabilityAccounts) {
    if (account.code.startsWith('21')) {
      const balance = await getAccountBalance(account.id, account.normalBalance);
      if (balance !== 0) {
        currentLiabilitiesAccounts.push({
          code: account.code,
          name: account.nameEn,
          amount: balance,
        });
        currentLiabilitiesTotal += balance;
      }
    }
  }

  // Build non-current liabilities section (accounts starting with 22, 23, 24, 25)
  const nonCurrentLiabilitiesAccounts: Array<{ code: string; name: string; amount: number }> = [];
  let nonCurrentLiabilitiesTotal = 0;

  for (const account of liabilityAccounts) {
    if (!account.code.startsWith('21') && account.code.startsWith('2')) {
      const balance = await getAccountBalance(account.id, account.normalBalance);
      if (balance !== 0) {
        nonCurrentLiabilitiesAccounts.push({
          code: account.code,
          name: account.nameEn,
          amount: balance,
        });
        nonCurrentLiabilitiesTotal += balance;
      }
    }
  }

  // Build equity section
  const equitySectionAccounts: Array<{ code: string; name: string; amount: number }> = [];
  let equityTotal = 0;

  for (const account of equityAccounts) {
    const balance = await getAccountBalance(account.id, account.normalBalance);
    if (balance !== 0) {
      equitySectionAccounts.push({
        code: account.code,
        name: account.nameEn,
        amount: balance,
      });
      equityTotal += balance;
    }
  }

  // Add retained earnings (net income for the period) - Revenue - Expenses
  const retainedEarnings = await calculateNetIncome(asOfDate);
  if (retainedEarnings !== 0) {
    equitySectionAccounts.push({
      code: 'RE',
      name: 'Retained Earnings (Current Period)',
      amount: retainedEarnings,
    });
    equityTotal += retainedEarnings;
  }

  const totalAssets = currentAssetsTotal + nonCurrentAssetsTotal;
  const totalLiabilities = currentLiabilitiesTotal + nonCurrentLiabilitiesTotal;
  const totalLiabilitiesAndEquity = totalLiabilities + equityTotal;

  return {
    asOfDate,
    assets: {
      currentAssets: {
        title: 'Current Assets',
        accounts: currentAssetsAccounts,
        subtotal: currentAssetsTotal,
      },
      nonCurrentAssets: {
        title: 'Non-Current Assets',
        accounts: nonCurrentAssetsAccounts,
        subtotal: nonCurrentAssetsTotal,
      },
      totalAssets,
    },
    liabilities: {
      currentLiabilities: {
        title: 'Current Liabilities',
        accounts: currentLiabilitiesAccounts,
        subtotal: currentLiabilitiesTotal,
      },
      nonCurrentLiabilities: {
        title: 'Non-Current Liabilities',
        accounts: nonCurrentLiabilitiesAccounts,
        subtotal: nonCurrentLiabilitiesTotal,
      },
      totalLiabilities,
    },
    equity: {
      section: {
        title: "Shareholders' Equity",
        accounts: equitySectionAccounts,
        subtotal: equityTotal,
      },
      totalEquity: equityTotal,
    },
    totalLiabilitiesAndEquity,
    isBalanced: Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01,
  };
}

/**
 * Calculate net income for the period (Revenue - Expenses)
 */
async function calculateNetIncome(asOfDate: string, periodStart?: string): Promise<number> {
  const { glAccounts, glAccountTypes, journalEntries, journalLines } = getAccountingTables();
  const database = db();

  const yearStart = periodStart || `${asOfDate.substring(0, 4)}-01-01`;

  // Get total revenue
  const revenueResult = await database
    .select({
      total: sql<number>`COALESCE(SUM(${journalLines.credit} - ${journalLines.debit}), 0)`,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
    .innerJoin(glAccounts, eq(journalLines.glAccountId, glAccounts.id))
    .innerJoin(glAccountTypes, eq(glAccounts.accountTypeId, glAccountTypes.id))
    .where(
      and(
        eq(journalEntries.status, 'posted'),
        eq(glAccountTypes.category, 'revenue'),
        gte(journalEntries.entryDate, toQueryDate(yearStart)),
        lte(journalEntries.entryDate, toQueryDate(asOfDate))
      )
    );

  // Get total expenses
  const expenseResult = await database
    .select({
      total: sql<number>`COALESCE(SUM(${journalLines.debit} - ${journalLines.credit}), 0)`,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
    .innerJoin(glAccounts, eq(journalLines.glAccountId, glAccounts.id))
    .innerJoin(glAccountTypes, eq(glAccounts.accountTypeId, glAccountTypes.id))
    .where(
      and(
        eq(journalEntries.status, 'posted'),
        eq(glAccountTypes.category, 'expense'),
        gte(journalEntries.entryDate, toQueryDate(yearStart)),
        lte(journalEntries.entryDate, toQueryDate(asOfDate))
      )
    );

  const totalRevenue = Number(revenueResult[0]?.total || 0);
  const totalExpenses = Number(expenseResult[0]?.total || 0);

  return totalRevenue - totalExpenses;
}

// ============================================
// Income Statement Report (T123)
// ============================================

/**
 * Generate Income Statement for a period
 * Revenue - COGS = Gross Profit - Operating Expenses = Net Income
 * @param periodStart - Start date of period (YYYY-MM-DD)
 * @param periodEnd - End date of period (YYYY-MM-DD)
 * @returns Income statement report
 */
export async function generateIncomeStatement(
  periodStart: string,
  periodEnd: string
): Promise<IncomeStatementReport> {
  const { glAccounts, glAccountTypes, journalEntries, journalLines } = getAccountingTables();
  const database = db();

  // Helper to get account totals for a period
  async function getAccountTotals(
    accountId: number,
    normalBalance: string
  ): Promise<number> {
    const result = await database
      .select({
        debitTotal: sql<number>`COALESCE(SUM(${journalLines.debit}), 0)`,
        creditTotal: sql<number>`COALESCE(SUM(${journalLines.credit}), 0)`,
      })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
      .where(
        and(
          eq(journalLines.glAccountId, accountId),
          eq(journalEntries.status, 'posted'),
          gte(journalEntries.entryDate, toQueryDate(periodStart)),
          lte(journalEntries.entryDate, toQueryDate(periodEnd))
        )
      );

    const debitTotal = Number(result[0]?.debitTotal || 0);
    const creditTotal = Number(result[0]?.creditTotal || 0);

    if (normalBalance === 'credit') {
      return creditTotal - debitTotal;
    }
    return debitTotal - creditTotal;
  }

  // Get all revenue accounts
  const revenueAccounts = await database
    .select({
      id: glAccounts.id,
      code: glAccounts.code,
      nameEn: glAccounts.nameEn,
      normalBalance: glAccountTypes.normalBalance,
    })
    .from(glAccounts)
    .innerJoin(glAccountTypes, eq(glAccounts.accountTypeId, glAccountTypes.id))
    .where(
      and(
        eq(glAccounts.isActive, true),
        eq(glAccounts.isPostable, true),
        eq(glAccountTypes.category, 'revenue')
      )
    )
    .orderBy(glAccounts.code);

  // Get all expense accounts
  const expenseAccounts = await database
    .select({
      id: glAccounts.id,
      code: glAccounts.code,
      nameEn: glAccounts.nameEn,
      typeCode: glAccountTypes.code,
      normalBalance: glAccountTypes.normalBalance,
    })
    .from(glAccounts)
    .innerJoin(glAccountTypes, eq(glAccounts.accountTypeId, glAccountTypes.id))
    .where(
      and(
        eq(glAccounts.isActive, true),
        eq(glAccounts.isPostable, true),
        eq(glAccountTypes.category, 'expense')
      )
    )
    .orderBy(glAccounts.code);

  // Build revenue section
  const revenueItems: Array<{ code: string; name: string; amount: number }> = [];
  let revenueTotal = 0;

  for (const account of revenueAccounts) {
    const amount = await getAccountTotals(account.id, account.normalBalance);
    if (amount !== 0) {
      revenueItems.push({
        code: account.code,
        name: account.nameEn,
        amount,
      });
      revenueTotal += amount;
    }
  }

  // Build COGS section (expense accounts with code starting with 5)
  const cogsItems: Array<{ code: string; name: string; amount: number }> = [];
  let cogsTotal = 0;

  // Build Operating Expenses section (expense accounts with code starting with 6)
  const opexItems: Array<{ code: string; name: string; amount: number }> = [];
  let opexTotal = 0;

  // Build Other Income/Expenses section (expense accounts with code starting with 7, 8)
  const otherItems: Array<{ code: string; name: string; amount: number }> = [];
  let otherTotal = 0;

  for (const account of expenseAccounts) {
    const amount = await getAccountTotals(account.id, account.normalBalance);
    if (amount !== 0) {
      if (account.code.startsWith('5')) {
        cogsItems.push({
          code: account.code,
          name: account.nameEn,
          amount,
        });
        cogsTotal += amount;
      } else if (account.code.startsWith('6')) {
        opexItems.push({
          code: account.code,
          name: account.nameEn,
          amount,
        });
        opexTotal += amount;
      } else {
        otherItems.push({
          code: account.code,
          name: account.nameEn,
          amount,
        });
        otherTotal += amount;
      }
    }
  }

  const grossProfit = revenueTotal - cogsTotal;
  const operatingIncome = grossProfit - opexTotal;
  const netIncomeBeforeTax = operatingIncome - otherTotal;

  // For simplicity, assume no income tax calculation here
  // In a real implementation, this would calculate based on tax rates
  const incomeTax = 0;
  const netIncome = netIncomeBeforeTax - incomeTax;

  return {
    periodStart,
    periodEnd,
    revenue: {
      title: 'Revenue',
      accounts: revenueItems,
      subtotal: revenueTotal,
    },
    costOfGoodsSold: {
      title: 'Cost of Goods Sold',
      accounts: cogsItems,
      subtotal: cogsTotal,
    },
    grossProfit,
    operatingExpenses: {
      title: 'Operating Expenses',
      accounts: opexItems,
      subtotal: opexTotal,
    },
    operatingIncome,
    otherIncomeExpenses: {
      title: 'Other Income and Expenses',
      accounts: otherItems,
      subtotal: otherTotal,
    },
    netIncomeBeforeTax,
    incomeTax,
    netIncome,
  };
}

// ============================================
// Cash Flow Statement Report (T124)
// ============================================

/**
 * Generate Cash Flow Statement using the indirect method
 * Starts with net income and adjusts for non-cash items and working capital changes
 * @param periodStart - Start date of period (YYYY-MM-DD)
 * @param periodEnd - End date of period (YYYY-MM-DD)
 * @returns Cash flow statement report
 */
export async function generateCashFlowStatement(
  periodStart: string,
  periodEnd: string
): Promise<CashFlowStatementReport> {
  const { glAccounts, glAccountTypes, journalEntries, journalLines } = getAccountingTables();
  const database = db();

  // Helper to get balance change for an account between two dates
  async function getBalanceChange(accountCode: string): Promise<number> {
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
          sql`${glAccounts.code} LIKE ${accountCode + '%'}`,
          eq(journalEntries.status, 'posted'),
          gte(journalEntries.entryDate, toQueryDate(periodStart)),
          lte(journalEntries.entryDate, toQueryDate(periodEnd))
        )
      );

    const debitTotal = Number(result[0]?.debitTotal || 0);
    const creditTotal = Number(result[0]?.creditTotal || 0);

    return debitTotal - creditTotal;
  }

  // Helper to get balance at a specific date for cash accounts
  async function getCashBalance(asOfDate: string): Promise<number> {
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
          eq(glAccountTypes.code, 'CASH'),
          eq(journalEntries.status, 'posted'),
          lte(journalEntries.entryDate, toQueryDate(asOfDate))
        )
      );

    const debitTotal = Number(result[0]?.debitTotal || 0);
    const creditTotal = Number(result[0]?.creditTotal || 0);

    return debitTotal - creditTotal;
  }

  // Get net income for the period
  const netIncome = await calculateNetIncome(periodEnd, periodStart);

  // Operating Activities Adjustments (non-cash items)
  const adjustmentItems: Array<{ description: string; amount: number }> = [];
  let adjustmentsTotal = 0;

  // Add back depreciation (typically account code 6200 or similar expense)
  const depreciationChange = await getBalanceChange('62');
  if (depreciationChange !== 0) {
    adjustmentItems.push({
      description: 'Depreciation Expense',
      amount: depreciationChange,
    });
    adjustmentsTotal += depreciationChange;
  }

  // Working Capital Changes
  const wcItems: Array<{ description: string; amount: number }> = [];
  let wcTotal = 0;

  // Accounts Receivable change (1120)
  const arChange = await getBalanceChange('1120');
  if (arChange !== 0) {
    wcItems.push({
      description: 'Change in Accounts Receivable',
      amount: -arChange, // Increase in AR reduces cash
    });
    wcTotal -= arChange;
  }

  // Inventory change (1130)
  const invChange = await getBalanceChange('1130');
  if (invChange !== 0) {
    wcItems.push({
      description: 'Change in Inventory',
      amount: -invChange, // Increase in inventory reduces cash
    });
    wcTotal -= invChange;
  }

  // Accounts Payable change (2110)
  const apChange = await getBalanceChange('2110');
  if (apChange !== 0) {
    wcItems.push({
      description: 'Change in Accounts Payable',
      amount: -apChange, // Decrease in AP (credit balance decreases) reduces cash
    });
    wcTotal -= apChange;
  }

  // Accrued expenses change (2120)
  const accrChange = await getBalanceChange('2120');
  if (accrChange !== 0) {
    wcItems.push({
      description: 'Change in Accrued Expenses',
      amount: -accrChange,
    });
    wcTotal -= accrChange;
  }

  const netCashFromOperating = netIncome + adjustmentsTotal + wcTotal;

  // Investing Activities
  const investingItems: Array<{ description: string; amount: number }> = [];
  let investingTotal = 0;

  // Fixed assets (15xx accounts)
  const fixedAssetChange = await getBalanceChange('15');
  if (fixedAssetChange !== 0) {
    investingItems.push({
      description: 'Purchase of Fixed Assets',
      amount: -fixedAssetChange, // Increase in assets is cash outflow
    });
    investingTotal -= fixedAssetChange;
  }

  // Financing Activities
  const financingItems: Array<{ description: string; amount: number }> = [];
  let financingTotal = 0;

  // Long-term debt (22xx accounts)
  const ltDebtChange = await getBalanceChange('22');
  if (ltDebtChange !== 0) {
    financingItems.push({
      description: 'Change in Long-term Debt',
      amount: -ltDebtChange, // Credit balance increase is cash inflow
    });
    financingTotal -= ltDebtChange;
  }

  // Equity changes (3xxx accounts)
  const equityChange = await getBalanceChange('31');
  if (equityChange !== 0) {
    financingItems.push({
      description: 'Changes in Share Capital',
      amount: -equityChange, // Credit balance increase is cash inflow
    });
    financingTotal -= equityChange;
  }

  // Get beginning and ending cash balances
  const periodStartDate = new Date(periodStart);
  periodStartDate.setDate(periodStartDate.getDate() - 1);
  const beginningDate = periodStartDate.toISOString().split('T')[0];

  const beginningCashBalance = await getCashBalance(beginningDate);
  const endingCashBalance = await getCashBalance(periodEnd);
  const netChangeInCash = netCashFromOperating + investingTotal + financingTotal;

  return {
    periodStart,
    periodEnd,
    operatingActivities: {
      netIncome,
      adjustments: {
        title: 'Adjustments for Non-Cash Items',
        items: adjustmentItems,
        subtotal: adjustmentsTotal,
      },
      workingCapitalChanges: {
        title: 'Changes in Working Capital',
        items: wcItems,
        subtotal: wcTotal,
      },
      netCashFromOperating,
    },
    investingActivities: {
      section: {
        title: 'Investing Activities',
        items: investingItems,
        subtotal: investingTotal,
      },
      netCashFromInvesting: investingTotal,
    },
    financingActivities: {
      section: {
        title: 'Financing Activities',
        items: financingItems,
        subtotal: financingTotal,
      },
      netCashFromFinancing: financingTotal,
    },
    netChangeInCash,
    beginningCashBalance,
    endingCashBalance,
  };
}

// ============================================
// Aging Report (T125)
// ============================================

/**
 * Generate Aging Report for AP or AR
 * Shows amounts by age buckets: Current, 1-30, 31-60, 61-90, 90+ days
 * @param reportType - 'AP' for Accounts Payable or 'AR' for Accounts Receivable
 * @param asOfDate - Date for aging calculation (YYYY-MM-DD)
 * @returns Aging report with entries by customer/vendor
 */
export async function generateAgingReport(
  reportType: 'AP' | 'AR',
  asOfDate: string
): Promise<AgingReport> {
  const { apInvoices, arInvoices } = getAccountingTables();
  const database = db();

  const asOfDateObj = new Date(asOfDate);
  const entries: AgingReportEntry[] = [];

  if (reportType === 'AP') {
    // Get all unpaid AP invoices
    const invoices = await database
      .select()
      .from(apInvoices)
      .where(
        and(
          inArray(apInvoices.status, ['approved', 'posted', 'partial']),
          lte(apInvoices.invoiceDate, toQueryDate(asOfDate))
        )
      );

    // Group by vendor
    const vendorMap = new Map<
      number,
      {
        vendorId: number;
        current: number;
        days1to30: number;
        days31to60: number;
        days61to90: number;
        over90: number;
        total: number;
      }
    >();

    for (const invoice of invoices) {
      const outstandingAmount = Number(invoice.totalAmount) - Number(invoice.paidAmount);
      if (outstandingAmount <= 0) continue;

      const dueDateStr = formatDateFromDb(invoice.dueDate);
      const dueDate = new Date(dueDateStr);
      const daysPastDue = Math.floor(
        (asOfDateObj.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      const vendorId = invoice.vendorId;
      if (!vendorMap.has(vendorId)) {
        vendorMap.set(vendorId, {
          vendorId,
          current: 0,
          days1to30: 0,
          days31to60: 0,
          days61to90: 0,
          over90: 0,
          total: 0,
        });
      }

      const vendorData = vendorMap.get(vendorId)!;

      if (daysPastDue <= 0) {
        vendorData.current += outstandingAmount;
      } else if (daysPastDue <= 30) {
        vendorData.days1to30 += outstandingAmount;
      } else if (daysPastDue <= 60) {
        vendorData.days31to60 += outstandingAmount;
      } else if (daysPastDue <= 90) {
        vendorData.days61to90 += outstandingAmount;
      } else {
        vendorData.over90 += outstandingAmount;
      }
      vendorData.total += outstandingAmount;
    }

    // Convert map to entries
    for (const [vendorId, data] of vendorMap) {
      entries.push({
        entityId: vendorId,
        entityName: `Vendor ${vendorId}`, // In real implementation, join with vendors table
        ...data,
      });
    }
  } else {
    // Get all unpaid AR invoices
    const invoices = await database
      .select()
      .from(arInvoices)
      .where(
        and(
          inArray(arInvoices.status, ['confirmed', 'posted', 'partial']),
          lte(arInvoices.invoiceDate, toQueryDate(asOfDate))
        )
      );

    // Group by customer
    const customerMap = new Map<
      number,
      {
        customerId: number;
        current: number;
        days1to30: number;
        days31to60: number;
        days61to90: number;
        over90: number;
        total: number;
      }
    >();

    for (const invoice of invoices) {
      const outstandingAmount = Number(invoice.totalAmount) - Number(invoice.paidAmount);
      if (outstandingAmount <= 0) continue;

      const dueDateStr = formatDateFromDb(invoice.dueDate);
      const dueDate = new Date(dueDateStr);
      const daysPastDue = Math.floor(
        (asOfDateObj.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      const customerId = invoice.customerId;
      if (!customerMap.has(customerId)) {
        customerMap.set(customerId, {
          customerId,
          current: 0,
          days1to30: 0,
          days31to60: 0,
          days61to90: 0,
          over90: 0,
          total: 0,
        });
      }

      const customerData = customerMap.get(customerId)!;

      if (daysPastDue <= 0) {
        customerData.current += outstandingAmount;
      } else if (daysPastDue <= 30) {
        customerData.days1to30 += outstandingAmount;
      } else if (daysPastDue <= 60) {
        customerData.days31to60 += outstandingAmount;
      } else if (daysPastDue <= 90) {
        customerData.days61to90 += outstandingAmount;
      } else {
        customerData.over90 += outstandingAmount;
      }
      customerData.total += outstandingAmount;
    }

    // Convert map to entries
    for (const [customerId, data] of customerMap) {
      entries.push({
        entityId: customerId,
        entityName: `Customer ${customerId}`, // In real implementation, join with customers table
        current: data.current,
        days1to30: data.days1to30,
        days31to60: data.days31to60,
        days61to90: data.days61to90,
        over90: data.over90,
        total: data.total,
      });
    }
  }

  // Calculate totals
  const totals = entries.reduce(
    (acc, entry) => ({
      current: acc.current + entry.current,
      days1to30: acc.days1to30 + entry.days1to30,
      days31to60: acc.days31to60 + entry.days31to60,
      days61to90: acc.days61to90 + entry.days61to90,
      over90: acc.over90 + entry.over90,
      total: acc.total + entry.total,
    }),
    { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, over90: 0, total: 0 }
  );

  // Build buckets summary
  const buckets: AgingBucket[] = [
    {
      range: 'Current',
      count: entries.filter((e) => e.current > 0).length,
      amount: totals.current,
    },
    {
      range: '1-30 Days',
      count: entries.filter((e) => e.days1to30 > 0).length,
      amount: totals.days1to30,
    },
    {
      range: '31-60 Days',
      count: entries.filter((e) => e.days31to60 > 0).length,
      amount: totals.days31to60,
    },
    {
      range: '61-90 Days',
      count: entries.filter((e) => e.days61to90 > 0).length,
      amount: totals.days61to90,
    },
    {
      range: '90+ Days',
      count: entries.filter((e) => e.over90 > 0).length,
      amount: totals.over90,
    },
  ];

  return {
    reportType,
    asOfDate,
    entries,
    buckets,
    totals,
  };
}
