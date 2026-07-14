/**
 * Accounting Period Closing Service
 * Feature: 010-accounting-module-integration
 * User Story 9: Perform Period-End Closing
 *
 * Month-end and year-end closing with validation and audit trail.
 */

import { getDb, isSqlite } from '../db';
import { getNow, toDbDate, toQueryDate, getTodayStr, formatDateFromDb } from '../db/date-utils';
import { eq, and, sql, desc, asc, gte, lte, or, isNull, ne, lt } from 'drizzle-orm';
import { getAccountingTables, generateEntryNumber, createJournalEntry, postJournalEntry, getCurrentFiscalPeriod, getPeriodByDate } from './accounting.service';
import { getTableRef, getInsertId } from '../db/db-helper';
import { createAuditLog } from '../audit';
import type {
  FiscalPeriodStatus,
  FiscalYearStatus,
  FiscalPeriod,
  FiscalYear,
  JournalLineCreate,
  AccountCategory,
  NormalBalance,
} from '@/types/accounting';

// ============================================
// Period Close Validation Types
// ============================================

export interface PeriodCloseValidation {
  canClose: boolean;
  periodId: number;
  periodName: string;
  fiscalYearId: number;
  fiscalYearCode: string;
  errors: PeriodCloseError[];
  warnings: PeriodCloseWarning[];
  metrics: PeriodCloseMetrics;
}

export interface PeriodCloseError {
  code: string;
  message: string;
  count?: number;
}

export interface PeriodCloseWarning {
  code: string;
  message: string;
  count?: number;
}

export interface PeriodCloseMetrics {
  unpostedJournalEntries: number;
  draftAPInvoices: number;
  draftARInvoices: number;
  pendingPayments: number;
  unreconciledBankStatements: number;
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
}

// ============================================
// Year Close Types
// ============================================

export interface YearCloseValidation {
  canClose: boolean;
  fiscalYearId: number;
  fiscalYearCode: string;
  errors: PeriodCloseError[];
  warnings: PeriodCloseWarning[];
  netIncome: number;
  periodsToClose: number;
  allPeriodsClosed: boolean;
}

export interface YearCloseResult {
  success: boolean;
  fiscalYearId: number;
  closingJournalEntryId: number | null;
  netIncome: number;
  retainedEarningsAccountId: number;
}

// ============================================
// Period Closing Functions
// ============================================

/**
 * Validate if a fiscal period can be closed
 * Checks for unposted entries, draft invoices, and balance issues
 */
export async function validatePeriodClose(periodId: number): Promise<PeriodCloseValidation> {
  const { fiscalPeriods, fiscalYears, journalEntries, apInvoices, arInvoices, payments, journalLines, glAccounts } = getAccountingTables();
  const database = (await getDb()) as any;

  // Get period and year info
  const periodResult = await database
    .select({
      period: fiscalPeriods,
      year: fiscalYears,
    })
    .from(fiscalPeriods)
    .innerJoin(fiscalYears, eq(fiscalPeriods.fiscalYearId, fiscalYears.id))
    .where(eq(fiscalPeriods.id, periodId))
    .limit(1);

  if (periodResult.length === 0) {
    throw new Error('Fiscal period not found');
  }

  const period = periodResult[0].period as unknown as FiscalPeriod;
  const year = periodResult[0].year as unknown as FiscalYear;

  const errors: PeriodCloseError[] = [];
  const warnings: PeriodCloseWarning[] = [];

  // Check if period is already closed
  if (period.status === 'closed') {
    errors.push({
      code: 'PERIOD_ALREADY_CLOSED',
      message: 'This period is already closed',
    });
  }

  // Check for unposted journal entries
  const unpostedJEResult = await database
    .select({ count: sql<number>`count(*)` })
    .from(journalEntries)
    .where(and(
      eq(journalEntries.fiscalPeriodId, periodId),
      eq(journalEntries.status, 'draft')
    ));
  const unpostedJournalEntries = Number(unpostedJEResult[0]?.count || 0);

  if (unpostedJournalEntries > 0) {
    errors.push({
      code: 'UNPOSTED_JOURNAL_ENTRIES',
      message: `There are ${unpostedJournalEntries} unposted journal entries`,
      count: unpostedJournalEntries,
    });
  }

  // Check for draft AP invoices in period
  const startDate = formatDateFromDb(period.startDate);
  const endDate = formatDateFromDb(period.endDate);

  const draftAPResult = await database
    .select({ count: sql<number>`count(*)` })
    .from(apInvoices)
    .where(and(
      eq(apInvoices.status, 'draft'),
      gte(apInvoices.invoiceDate, toQueryDate(startDate)),
      lte(apInvoices.invoiceDate, toQueryDate(endDate))
    ));
  const draftAPInvoices = Number(draftAPResult[0]?.count || 0);

  if (draftAPInvoices > 0) {
    errors.push({
      code: 'DRAFT_AP_INVOICES',
      message: `There are ${draftAPInvoices} draft AP invoices`,
      count: draftAPInvoices,
    });
  }

  // Check for draft AR invoices in period
  const draftARResult = await database
    .select({ count: sql<number>`count(*)` })
    .from(arInvoices)
    .where(and(
      eq(arInvoices.status, 'draft'),
      gte(arInvoices.invoiceDate, toQueryDate(startDate)),
      lte(arInvoices.invoiceDate, toQueryDate(endDate))
    ));
  const draftARInvoices = Number(draftARResult[0]?.count || 0);

  if (draftARInvoices > 0) {
    errors.push({
      code: 'DRAFT_AR_INVOICES',
      message: `There are ${draftARInvoices} draft AR invoices`,
      count: draftARInvoices,
    });
  }

  // Check for pending payments
  const pendingPaymentsResult = await database
    .select({ count: sql<number>`count(*)` })
    .from(payments)
    .where(and(
      eq(payments.status, 'pending'),
      gte(payments.paymentDate, toQueryDate(startDate)),
      lte(payments.paymentDate, toQueryDate(endDate))
    ));
  const pendingPayments = Number(pendingPaymentsResult[0]?.count || 0);

  if (pendingPayments > 0) {
    warnings.push({
      code: 'PENDING_PAYMENTS',
      message: `There are ${pendingPayments} pending payments`,
      count: pendingPayments,
    });
  }

  // Check for unreconciled bank statements in period (T076.1)
  // Bank statements that are not in 'reconciled' or 'closed' status
  const bankStatements = getTableRef('bankStatements');
  const unreconciledBankResult = await database
    .select({ count: sql<number>`count(*)` })
    .from(bankStatements)
    .where(and(
      gte(bankStatements.statementDate, toQueryDate(startDate)),
      lte(bankStatements.statementDate, toQueryDate(endDate)),
      sql`${bankStatements.status} NOT IN ('reconciled', 'closed')`
    ));
  const unreconciledBankStatements = Number(unreconciledBankResult[0]?.count || 0);

  if (unreconciledBankStatements > 0) {
    errors.push({
      code: 'UNRECONCILED_BANK_STATEMENTS',
      message: `There are ${unreconciledBankStatements} unreconciled bank statements. Bank reconciliation must be completed before period close.`,
      count: unreconciledBankStatements,
    });
  }

  // Calculate trial balance for the period
  const postedJEs = await database
    .select({ id: journalEntries.id })
    .from(journalEntries)
    .where(and(
      eq(journalEntries.fiscalPeriodId, periodId),
      eq(journalEntries.status, 'posted')
    ));

  const jeIds = postedJEs.map((je: { id: number }) => je.id);

  let totalDebits = 0;
  let totalCredits = 0;

  if (jeIds.length > 0) {
    // Get totals for the period
    const totalsResult = await database
      .select({
        totalDebit: sql<number>`COALESCE(SUM(debit), 0)`,
        totalCredit: sql<number>`COALESCE(SUM(credit), 0)`,
      })
      .from(journalLines)
      .where(sql`${journalLines.journalEntryId} IN (${jeIds.join(',')})`);

    totalDebits = Number(totalsResult[0]?.totalDebit || 0);
    totalCredits = Number(totalsResult[0]?.totalCredit || 0);
  }

  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

  if (!isBalanced) {
    errors.push({
      code: 'TRIAL_BALANCE_NOT_BALANCED',
      message: `Trial balance is not balanced. Debits: ${totalDebits.toFixed(2)}, Credits: ${totalCredits.toFixed(2)}`,
    });
  }

  // Check previous periods are closed (if not first period of year)
  if (period.periodNumber > 1) {
    const previousPeriodResult = await database
      .select()
      .from(fiscalPeriods)
      .where(and(
        eq(fiscalPeriods.fiscalYearId, period.fiscalYearId),
        lt(fiscalPeriods.periodNumber, period.periodNumber),
        ne(fiscalPeriods.status, 'closed')
      ))
      .limit(1);

    if (previousPeriodResult.length > 0) {
      warnings.push({
        code: 'PREVIOUS_PERIOD_OPEN',
        message: 'Previous periods are still open. It is recommended to close periods in sequence.',
      });
    }
  }

  const canClose = errors.length === 0;

  return {
    canClose,
    periodId,
    periodName: period.periodName,
    fiscalYearId: period.fiscalYearId,
    fiscalYearCode: year.yearCode,
    errors,
    warnings,
    metrics: {
      unpostedJournalEntries,
      draftAPInvoices,
      draftARInvoices,
      pendingPayments,
      unreconciledBankStatements,
      totalDebits,
      totalCredits,
      isBalanced,
    },
  };
}

/**
 * Close a fiscal period
 * Creates audit log and updates period status
 */
export async function closeFiscalPeriod(
  periodId: number,
  closedBy: number,
  force: boolean = false
): Promise<{ success: boolean; message: string }> {
  const { fiscalPeriods } = getAccountingTables();
  const database = (await getDb()) as any;

  // Validate first
  const validation = await validatePeriodClose(periodId);

  if (!validation.canClose && !force) {
    return {
      success: false,
      message: `Cannot close period: ${validation.errors.map(e => e.message).join('; ')}`,
    };
  }

  // Close the period
  await database
    .update(fiscalPeriods)
    .set({
      status: 'closed' as FiscalPeriodStatus,
      closedBy,
      closedAt: getNow(),
      updatedAt: getNow(),
    } as Record<string, unknown>)
    .where(eq(fiscalPeriods.id, periodId));

  // Create audit log
  try {
    await createAuditLog({
      userId: closedBy,
      action: 'PERIOD_CLOSE',
      entity: 'fiscal_period',
      entityId: periodId,
      details: JSON.stringify({
        periodName: validation.periodName,
        fiscalYearCode: validation.fiscalYearCode,
        forced: force,
        metrics: validation.metrics,
      }),
    });
  } catch {
    // Audit log failure should not prevent close
    console.warn('Failed to create audit log for period close');
  }

  return {
    success: true,
    message: `Period "${validation.periodName}" has been closed successfully`,
  };
}

/**
 * Soft close a fiscal period (allows limited edits)
 */
export async function softCloseFiscalPeriod(
  periodId: number,
  closedBy: number
): Promise<{ success: boolean; message: string }> {
  const { fiscalPeriods } = getAccountingTables();
  const database = (await getDb()) as any;

  // Get period info
  const periodResult = await database
    .select()
    .from(fiscalPeriods)
    .where(eq(fiscalPeriods.id, periodId))
    .limit(1);

  if (periodResult.length === 0) {
    throw new Error('Fiscal period not found');
  }

  const period = periodResult[0] as unknown as FiscalPeriod;

  if (period.status === 'closed') {
    return {
      success: false,
      message: 'Period is already hard closed and cannot be soft closed',
    };
  }

  // Soft close the period
  await database
    .update(fiscalPeriods)
    .set({
      status: 'soft_closed' as FiscalPeriodStatus,
      closedBy,
      closedAt: getNow(),
      updatedAt: getNow(),
    } as Record<string, unknown>)
    .where(eq(fiscalPeriods.id, periodId));

  // Create audit log
  try {
    await createAuditLog({
      userId: closedBy,
      action: 'PERIOD_SOFT_CLOSE',
      entity: 'fiscal_period',
      entityId: periodId,
      details: JSON.stringify({ periodName: period.periodName }),
    });
  } catch {
    console.warn('Failed to create audit log for period soft close');
  }

  return {
    success: true,
    message: `Period "${period.periodName}" has been soft closed`,
  };
}

/**
 * Reopen a closed fiscal period
 * Requires authorization check
 */
export async function reopenFiscalPeriod(
  periodId: number,
  reopenedBy: number,
  reason: string
): Promise<{ success: boolean; message: string }> {
  const { fiscalPeriods, fiscalYears } = getAccountingTables();
  const database = (await getDb()) as any;

  // Get period info
  const periodResult = await database
    .select({
      period: fiscalPeriods,
      year: fiscalYears,
    })
    .from(fiscalPeriods)
    .innerJoin(fiscalYears, eq(fiscalPeriods.fiscalYearId, fiscalYears.id))
    .where(eq(fiscalPeriods.id, periodId))
    .limit(1);

  if (periodResult.length === 0) {
    throw new Error('Fiscal period not found');
  }

  const period = periodResult[0].period as unknown as FiscalPeriod;
  const year = periodResult[0].year as unknown as FiscalYear;

  // Check if year is closed
  if (year.status === 'closed') {
    return {
      success: false,
      message: 'Cannot reopen period: The fiscal year is closed',
    };
  }

  // Check if period is already open
  if (period.status === 'open') {
    return {
      success: false,
      message: 'Period is already open',
    };
  }

  // Reopen the period
  await database
    .update(fiscalPeriods)
    .set({
      status: 'open' as FiscalPeriodStatus,
      closedBy: null,
      closedAt: null,
      updatedAt: getNow(),
    } as Record<string, unknown>)
    .where(eq(fiscalPeriods.id, periodId));

  // Create audit log
  try {
    await createAuditLog({
      userId: reopenedBy,
      action: 'PERIOD_REOPEN',
      entity: 'fiscal_period',
      entityId: periodId,
      details: JSON.stringify({
        periodName: period.periodName,
        fiscalYearCode: year.yearCode,
        reason,
      }),
    });
  } catch {
    console.warn('Failed to create audit log for period reopen');
  }

  return {
    success: true,
    message: `Period "${period.periodName}" has been reopened`,
  };
}

// ============================================
// Year-End Closing Functions
// ============================================

/**
 * Validate if a fiscal year can be closed
 */
export async function validateYearClose(fiscalYearId: number): Promise<YearCloseValidation> {
  const { fiscalYears, fiscalPeriods, journalEntries, journalLines, glAccounts, glAccountTypes } = getAccountingTables();
  const database = (await getDb()) as any;

  // Get year info
  const yearResult = await database
    .select()
    .from(fiscalYears)
    .where(eq(fiscalYears.id, fiscalYearId))
    .limit(1);

  if (yearResult.length === 0) {
    throw new Error('Fiscal year not found');
  }

  const year = yearResult[0] as unknown as FiscalYear;

  const errors: PeriodCloseError[] = [];
  const warnings: PeriodCloseWarning[] = [];

  // Check if year is already closed
  if (year.status === 'closed') {
    errors.push({
      code: 'YEAR_ALREADY_CLOSED',
      message: 'This fiscal year is already closed',
    });
  }

  // Check all periods are closed
  const openPeriodsResult = await database
    .select({ count: sql<number>`count(*)` })
    .from(fiscalPeriods)
    .where(and(
      eq(fiscalPeriods.fiscalYearId, fiscalYearId),
      ne(fiscalPeriods.status, 'closed')
    ));

  const periodsToClose = Number(openPeriodsResult[0]?.count || 0);
  const allPeriodsClosed = periodsToClose === 0;

  if (!allPeriodsClosed) {
    errors.push({
      code: 'PERIODS_NOT_CLOSED',
      message: `There are ${periodsToClose} periods that are not closed`,
      count: periodsToClose,
    });
  }

  // Calculate net income for the year
  // Get all revenue and expense accounts
  const incomeStatementAccounts = await database
    .select({
      accountId: glAccounts.id,
      category: glAccountTypes.category,
      normalBalance: glAccountTypes.normalBalance,
    })
    .from(glAccounts)
    .innerJoin(glAccountTypes, eq(glAccounts.accountTypeId, glAccountTypes.id))
    .where(or(
      eq(glAccountTypes.category, 'revenue'),
      eq(glAccountTypes.category, 'expense')
    ));

  // Get all periods for the year
  const periods = await database
    .select({ id: fiscalPeriods.id })
    .from(fiscalPeriods)
    .where(eq(fiscalPeriods.fiscalYearId, fiscalYearId));

  const periodIds = periods.map((p: { id: number }) => p.id);

  // Get all posted journal entries for the year
  let netIncome = 0;

  if (periodIds.length > 0 && incomeStatementAccounts.length > 0) {
    const accountIds = incomeStatementAccounts.map((a: { accountId: number }) => a.accountId);

    // Calculate net income (Revenue - Expenses)
    for (const account of incomeStatementAccounts) {
      const lineResult = await database
        .select({
          totalDebit: sql<number>`COALESCE(SUM(${journalLines.debit}), 0)`,
          totalCredit: sql<number>`COALESCE(SUM(${journalLines.credit}), 0)`,
        })
        .from(journalLines)
        .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
        .where(and(
          eq(journalLines.glAccountId, account.accountId),
          eq(journalEntries.status, 'posted'),
          sql`${journalEntries.fiscalPeriodId} IN (${periodIds.join(',')})`
        ));

      const debit = Number(lineResult[0]?.totalDebit || 0);
      const credit = Number(lineResult[0]?.totalCredit || 0);

      if (account.category === 'revenue') {
        // Revenue has credit normal balance
        netIncome += credit - debit;
      } else {
        // Expense has debit normal balance
        netIncome -= debit - credit;
      }
    }
  }

  // Check for retained earnings account
  const retainedEarningsResult = await database
    .select()
    .from(glAccounts)
    .where(and(
      sql`LOWER(${glAccounts.code}) LIKE '%retained%' OR LOWER(${glAccounts.nameEn}) LIKE '%retained earnings%'`,
      eq(glAccounts.isActive, true)
    ))
    .limit(1);

  if (retainedEarningsResult.length === 0) {
    warnings.push({
      code: 'NO_RETAINED_EARNINGS_ACCOUNT',
      message: 'No retained earnings account found. You may need to create one for year-end closing.',
    });
  }

  const canClose = errors.length === 0;

  return {
    canClose,
    fiscalYearId,
    fiscalYearCode: year.yearCode,
    errors,
    warnings,
    netIncome,
    periodsToClose,
    allPeriodsClosed,
  };
}

/**
 * Close the fiscal year with net income transfer to retained earnings
 */
export async function closeYearEnd(
  fiscalYearId: number,
  retainedEarningsAccountId: number,
  closedBy: number
): Promise<YearCloseResult> {
  const { fiscalYears, fiscalPeriods, glAccounts, glAccountTypes, journalEntries, journalLines } = getAccountingTables();
  const database = (await getDb()) as any;

  // Validate first
  const validation = await validateYearClose(fiscalYearId);

  if (!validation.canClose) {
    throw new Error(`Cannot close year: ${validation.errors.map(e => e.message).join('; ')}`);
  }

  // Get year info
  const yearResult = await database
    .select()
    .from(fiscalYears)
    .where(eq(fiscalYears.id, fiscalYearId))
    .limit(1);

  const year = yearResult[0] as unknown as FiscalYear;

  // Get last period of the year for the closing entry
  const lastPeriodResult = await database
    .select()
    .from(fiscalPeriods)
    .where(eq(fiscalPeriods.fiscalYearId, fiscalYearId))
    .orderBy(desc(fiscalPeriods.periodNumber))
    .limit(1);

  if (lastPeriodResult.length === 0) {
    throw new Error('No periods found for the fiscal year');
  }

  const lastPeriod = lastPeriodResult[0] as unknown as FiscalPeriod;

  // Get all periods for the year
  const periods = await database
    .select({ id: fiscalPeriods.id })
    .from(fiscalPeriods)
    .where(eq(fiscalPeriods.fiscalYearId, fiscalYearId));

  const periodIds = periods.map((p: { id: number }) => p.id);

  // Get all revenue and expense accounts with their balances
  const incomeStatementAccounts = await database
    .select({
      accountId: glAccounts.id,
      accountCode: glAccounts.code,
      category: glAccountTypes.category,
      normalBalance: glAccountTypes.normalBalance,
    })
    .from(glAccounts)
    .innerJoin(glAccountTypes, eq(glAccounts.accountTypeId, glAccountTypes.id))
    .where(or(
      eq(glAccountTypes.category, 'revenue'),
      eq(glAccountTypes.category, 'expense')
    ));

  // Create closing journal entry lines
  const closingLines: JournalLineCreate[] = [];
  let totalRevenueCredit = 0;
  let totalExpenseDebit = 0;

  for (const account of incomeStatementAccounts) {
    const lineResult = await database
      .select({
        totalDebit: sql<number>`COALESCE(SUM(${journalLines.debit}), 0)`,
        totalCredit: sql<number>`COALESCE(SUM(${journalLines.credit}), 0)`,
      })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
      .where(and(
        eq(journalLines.glAccountId, account.accountId),
        eq(journalEntries.status, 'posted'),
        sql`${journalEntries.fiscalPeriodId} IN (${periodIds.join(',')})`
      ));

    const debit = Number(lineResult[0]?.totalDebit || 0);
    const credit = Number(lineResult[0]?.totalCredit || 0);
    const balance = credit - debit;

    if (Math.abs(balance) > 0.01) {
      if (account.category === 'revenue') {
        // Close revenue: Debit revenue, Credit retained earnings
        closingLines.push({
          glAccountId: account.accountId,
          debit: Math.abs(balance),
          credit: 0,
          description: `Year-end close - ${account.accountCode}`,
        });
        totalRevenueCredit += Math.abs(balance);
      } else {
        // Close expense: Credit expense, Debit retained earnings
        closingLines.push({
          glAccountId: account.accountId,
          debit: 0,
          credit: Math.abs(debit - credit),
          description: `Year-end close - ${account.accountCode}`,
        });
        totalExpenseDebit += Math.abs(debit - credit);
      }
    }
  }

  // Add retained earnings line
  const netIncome = totalRevenueCredit - totalExpenseDebit;
  if (netIncome > 0) {
    // Net profit - Credit retained earnings
    closingLines.push({
      glAccountId: retainedEarningsAccountId,
      debit: 0,
      credit: netIncome,
      description: 'Net income transferred to retained earnings',
    });
  } else if (netIncome < 0) {
    // Net loss - Debit retained earnings
    closingLines.push({
      glAccountId: retainedEarningsAccountId,
      debit: Math.abs(netIncome),
      credit: 0,
      description: 'Net loss transferred to retained earnings',
    });
  }

  let closingJournalEntryId: number | null = null;

  // Create and post closing journal entry if there are lines
  if (closingLines.length > 0) {
    // Need to reopen last period temporarily if it's closed
    const wasLastPeriodClosed = lastPeriod.status === 'closed';
    if (wasLastPeriodClosed) {
      await database
        .update(fiscalPeriods)
        .set({ status: 'open' as FiscalPeriodStatus })
        .where(eq(fiscalPeriods.id, lastPeriod.id));
    }

    try {
      const closingEntry = await createJournalEntry({
        entryDate: formatDateFromDb(lastPeriod.endDate),
        fiscalPeriodId: lastPeriod.id,
        description: `Year-end closing entry for FY ${year.yearCode}`,
        sourceType: 'PERIOD_CLOSE',
        lines: closingLines,
        createdBy: closedBy,
      });

      closingJournalEntryId = closingEntry.id;

      // Post the closing entry
      await postJournalEntry(closingEntry.id, closedBy);
    } finally {
      // Re-close the period if it was closed
      if (wasLastPeriodClosed) {
        await database
          .update(fiscalPeriods)
          .set({
            status: 'closed' as FiscalPeriodStatus,
            closedAt: getNow(),
          })
          .where(eq(fiscalPeriods.id, lastPeriod.id));
      }
    }
  }

  // Close the fiscal year
  await database
    .update(fiscalYears)
    .set({
      status: 'closed' as FiscalYearStatus,
      closedBy,
      closedAt: getNow(),
      updatedAt: getNow(),
    } as Record<string, unknown>)
    .where(eq(fiscalYears.id, fiscalYearId));

  // Create audit log
  try {
    await createAuditLog({
      userId: closedBy,
      action: 'YEAR_CLOSE',
      entity: 'fiscal_year',
      entityId: fiscalYearId,
      details: JSON.stringify({
        fiscalYearCode: year.yearCode,
        netIncome,
        closingJournalEntryId,
        retainedEarningsAccountId,
      }),
    });
  } catch {
    console.warn('Failed to create audit log for year close');
  }

  return {
    success: true,
    fiscalYearId,
    closingJournalEntryId,
    netIncome,
    retainedEarningsAccountId,
  };
}

/**
 * Create opening balances for a new fiscal year
 * Copies balance sheet account balances from previous year
 */
export async function createOpeningBalances(
  newFiscalYearId: number,
  previousFiscalYearId: number,
  createdBy: number
): Promise<{ success: boolean; journalEntryId: number | null }> {
  const { fiscalYears, fiscalPeriods, glAccounts, glAccountTypes, journalEntries, journalLines } = getAccountingTables();
  const database = (await getDb()) as any;

  // Validate new year exists and is open
  const newYearResult = await database
    .select()
    .from(fiscalYears)
    .where(eq(fiscalYears.id, newFiscalYearId))
    .limit(1);

  if (newYearResult.length === 0) {
    throw new Error('New fiscal year not found');
  }

  const newYear = newYearResult[0] as unknown as FiscalYear;

  // Validate previous year is closed
  const prevYearResult = await database
    .select()
    .from(fiscalYears)
    .where(eq(fiscalYears.id, previousFiscalYearId))
    .limit(1);

  if (prevYearResult.length === 0) {
    throw new Error('Previous fiscal year not found');
  }

  const prevYear = prevYearResult[0] as unknown as FiscalYear;

  if (prevYear.status !== 'closed') {
    throw new Error('Previous fiscal year must be closed before creating opening balances');
  }

  // Get first period of new year
  const firstPeriodResult = await database
    .select()
    .from(fiscalPeriods)
    .where(eq(fiscalPeriods.fiscalYearId, newFiscalYearId))
    .orderBy(asc(fiscalPeriods.periodNumber))
    .limit(1);

  if (firstPeriodResult.length === 0) {
    throw new Error('No periods found for the new fiscal year');
  }

  const firstPeriod = firstPeriodResult[0] as unknown as FiscalPeriod;

  // Get all periods from previous year
  const prevPeriods = await database
    .select({ id: fiscalPeriods.id })
    .from(fiscalPeriods)
    .where(eq(fiscalPeriods.fiscalYearId, previousFiscalYearId));

  const prevPeriodIds = prevPeriods.map((p: { id: number }) => p.id);

  if (prevPeriodIds.length === 0) {
    throw new Error('No periods found in previous fiscal year');
  }

  // Get all balance sheet accounts (Asset, Liability, Equity)
  const balanceSheetAccounts = await database
    .select({
      accountId: glAccounts.id,
      accountCode: glAccounts.code,
      category: glAccountTypes.category,
      normalBalance: glAccountTypes.normalBalance,
    })
    .from(glAccounts)
    .innerJoin(glAccountTypes, eq(glAccounts.accountTypeId, glAccountTypes.id))
    .where(and(
      eq(glAccounts.isActive, true),
      eq(glAccounts.isPostable, true),
      or(
        eq(glAccountTypes.category, 'asset'),
        eq(glAccountTypes.category, 'liability'),
        eq(glAccountTypes.category, 'equity')
      )
    ));

  // Calculate closing balances for each account
  const openingLines: JournalLineCreate[] = [];

  for (const account of balanceSheetAccounts) {
    const balanceResult = await database
      .select({
        totalDebit: sql<number>`COALESCE(SUM(${journalLines.debit}), 0)`,
        totalCredit: sql<number>`COALESCE(SUM(${journalLines.credit}), 0)`,
      })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
      .where(and(
        eq(journalLines.glAccountId, account.accountId),
        eq(journalEntries.status, 'posted'),
        sql`${journalEntries.fiscalPeriodId} IN (${prevPeriodIds.join(',')})`
      ));

    const debit = Number(balanceResult[0]?.totalDebit || 0);
    const credit = Number(balanceResult[0]?.totalCredit || 0);
    const balance = debit - credit;

    if (Math.abs(balance) > 0.01) {
      if (balance > 0) {
        openingLines.push({
          glAccountId: account.accountId,
          debit: balance,
          credit: 0,
          description: `Opening balance - ${account.accountCode}`,
        });
      } else {
        openingLines.push({
          glAccountId: account.accountId,
          debit: 0,
          credit: Math.abs(balance),
          description: `Opening balance - ${account.accountCode}`,
        });
      }
    }
  }

  if (openingLines.length === 0) {
    return { success: true, journalEntryId: null };
  }

  // Create opening balance journal entry
  const openingEntry = await createJournalEntry({
    entryDate: formatDateFromDb(firstPeriod.startDate),
    fiscalPeriodId: firstPeriod.id,
    description: `Opening balances for FY ${newYear.yearCode} (from FY ${prevYear.yearCode})`,
    sourceType: 'PERIOD_CLOSE',
    lines: openingLines,
    createdBy,
  });

  // Post the opening entry
  await postJournalEntry(openingEntry.id, createdBy);

  // Create audit log
  try {
    await createAuditLog({
      userId: createdBy,
      action: 'OPENING_BALANCES_CREATED',
      entity: 'fiscal_year',
      entityId: newFiscalYearId,
      details: JSON.stringify({
        newFiscalYear: newYear.yearCode,
        previousFiscalYear: prevYear.yearCode,
        journalEntryId: openingEntry.id,
        accountsCount: openingLines.length,
      }),
    });
  } catch {
    console.warn('Failed to create audit log for opening balances');
  }

  return {
    success: true,
    journalEntryId: openingEntry.id,
  };
}

// ============================================
// Period Query Functions
// ============================================

/**
 * List all fiscal periods for a year
 */
export async function listFiscalPeriods(
  fiscalYearId?: number,
  status?: FiscalPeriodStatus
): Promise<(FiscalPeriod & { fiscalYear?: FiscalYear })[]> {
  const { fiscalPeriods, fiscalYears } = getAccountingTables();
  const database = (await getDb()) as any;

  const conditions = [];

  if (fiscalYearId) {
    conditions.push(eq(fiscalPeriods.fiscalYearId, fiscalYearId));
  }

  if (status) {
    conditions.push(eq(fiscalPeriods.status, status));
  }

  let query = database
    .select({
      period: fiscalPeriods,
      year: fiscalYears,
    })
    .from(fiscalPeriods)
    .innerJoin(fiscalYears, eq(fiscalPeriods.fiscalYearId, fiscalYears.id));

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  const results = await query.orderBy(desc(fiscalYears.startDate), asc(fiscalPeriods.periodNumber));

  return results.map((row: { period: FiscalPeriod; year: FiscalYear }) => ({
    ...(row.period as unknown as FiscalPeriod),
    fiscalYear: row.year as unknown as FiscalYear,
  }));
}

/**
 * Get a fiscal period by ID
 */
export async function getFiscalPeriodById(id: number): Promise<(FiscalPeriod & { fiscalYear?: FiscalYear }) | null> {
  const { fiscalPeriods, fiscalYears } = getAccountingTables();
  const database = (await getDb()) as any;

  const result = await database
    .select({
      period: fiscalPeriods,
      year: fiscalYears,
    })
    .from(fiscalPeriods)
    .innerJoin(fiscalYears, eq(fiscalPeriods.fiscalYearId, fiscalYears.id))
    .where(eq(fiscalPeriods.id, id))
    .limit(1);

  if (result.length === 0) return null;

  return {
    ...(result[0].period as unknown as FiscalPeriod),
    fiscalYear: result[0].year as unknown as FiscalYear,
  };
}

/**
 * Create a fiscal year together with its 12 monthly periods.
 *
 * Journal entries cannot be created for a date with no fiscal period — createJournalEntry
 * throws. So a year whose periods were never generated silently blocks ALL posting from
 * the first missing month onward. This creates the year and every period in one step.
 *
 * @param year - Calendar year, e.g. 2026
 * @param createdBy - User ID performing the action
 * @param options.setCurrent - Mark this year as the current one (clears the flag on others)
 * @returns The created fiscal year with its periods
 * @throws If the fiscal year already exists
 */
export async function createFiscalYear(
  year: number,
  createdBy: number,
  options: { setCurrent?: boolean } = {}
): Promise<FiscalYear & { periods: FiscalPeriod[] }> {
  const { fiscalYears, fiscalPeriods } = getAccountingTables();
  const database = (await getDb()) as any;

  const yearCode = `FY${year}`;

  const existing = await database
    .select({ id: fiscalYears.id })
    .from(fiscalYears)
    .where(eq(fiscalYears.yearCode, yearCode))
    .limit(1);

  if (existing.length > 0) {
    throw new Error(`ปีบัญชี ${yearCode} มีอยู่แล้ว`);
  }

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  // Build the 12 monthly periods. Local Date arithmetic (not UTC) so the boundaries land
  // on the intended calendar days; day 0 of month N+1 is the last day of month N.
  const pad = (n: number) => String(n).padStart(2, '0');
  const periodSpecs = MONTH_NAMES.map((name, index) => {
    const lastDay = new Date(year, index + 1, 0).getDate();
    return {
      periodNumber: index + 1,
      periodName: `${name} ${year}`,
      startDate: `${year}-${pad(index + 1)}-01`,
      endDate: `${year}-${pad(index + 1)}-${pad(lastDay)}`,
    };
  });

  const setCurrent = options.setCurrent ?? false;

  // Only one year may be flagged current
  if (setCurrent) {
    await database
      .update(fiscalYears)
      .set({ isCurrent: false, updatedAt: getNow() })
      .where(eq(fiscalYears.isCurrent, true));
  }

  const yearResult = await database.insert(fiscalYears).values({
    yearCode,
    startDate: toDbDate(`${year}-01-01`),
    endDate: toDbDate(`${year}-12-31`),
    isCurrent: setCurrent,
    status: 'open',
    createdAt: getNow(),
    updatedAt: getNow(),
  });

  const fiscalYearId = getInsertId(yearResult);

  await database.insert(fiscalPeriods).values(
    periodSpecs.map((spec) => ({
      fiscalYearId,
      periodNumber: spec.periodNumber,
      periodName: spec.periodName,
      startDate: toDbDate(spec.startDate),
      endDate: toDbDate(spec.endDate),
      status: 'open' as const,
      createdAt: getNow(),
      updatedAt: getNow(),
    }))
  );

  await createAuditLog({
    action: 'CREATE',
    tableName: 'fiscal_years',
    recordId: fiscalYearId,
    userId: createdBy,
    newValue: { yearCode, periodsCreated: periodSpecs.length },
  });

  const created = await getFiscalYearById(fiscalYearId);
  if (!created) {
    throw new Error(`สร้างปีบัญชี ${yearCode} ไม่สำเร็จ`);
  }

  return { ...created, periods: created.periods ?? [] };
}

/**
 * List all fiscal years
 */
export async function listFiscalYears(status?: FiscalYearStatus): Promise<FiscalYear[]> {
  const { fiscalYears } = getAccountingTables();
  const database = (await getDb()) as any;

  let query = database.select().from(fiscalYears);

  if (status) {
    query = query.where(eq(fiscalYears.status, status)) as typeof query;
  }

  const results = await query.orderBy(desc(fiscalYears.startDate));

  return results.map((row: FiscalYear) => ({
    ...(row as unknown as FiscalYear),
  }));
}

/**
 * Get a fiscal year by ID with periods
 */
export async function getFiscalYearById(id: number): Promise<(FiscalYear & { periods?: FiscalPeriod[] }) | null> {
  const { fiscalYears, fiscalPeriods } = getAccountingTables();
  const database = (await getDb()) as any;

  const yearResult = await database
    .select()
    .from(fiscalYears)
    .where(eq(fiscalYears.id, id))
    .limit(1);

  if (yearResult.length === 0) return null;

  const year = yearResult[0] as unknown as FiscalYear;

  const periodsResult = await database
    .select()
    .from(fiscalPeriods)
    .where(eq(fiscalPeriods.fiscalYearId, id))
    .orderBy(asc(fiscalPeriods.periodNumber));

  return {
    ...year,
    periods: periodsResult.map((p: FiscalPeriod) => p as unknown as FiscalPeriod),
  };
}
