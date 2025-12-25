/**
 * Accounting Service
 * Core accounting module with double-entry bookkeeping, journal entries,
 * fiscal periods, and Thai tax compliance (VAT 7%, WHT)
 */

import { db, isSqlite } from '../db';
import { getNow, toDbDate, toQueryDate, getTodayStr, formatDateFromDb } from '../db/date-utils';
import { eq, and, sql, desc, asc, gte, lte, or, isNull, between } from 'drizzle-orm';
import {
  // SQLite tables
  sqliteGLAccountTypes,
  sqliteGLAccounts,
  sqliteFiscalYears,
  sqliteFiscalPeriods,
  sqliteJournalEntries,
  sqliteJournalLines,
  sqliteAPInvoices,
  sqliteAPInvoiceLines,
  sqliteARInvoices,
  sqliteARInvoiceLines,
  sqlitePayments,
  sqlitePaymentAllocations,
  sqliteVATTransactions,
  sqliteWHTTransactions,
  sqliteAssetCategories,
  sqliteFixedAssets,
  sqliteAssetDepreciations,
  sqliteAssetDisposals,
  sqliteAssetMovements,
  sqliteAccountingEquipment,
  sqliteAcctMaintenanceSchedules,
  sqliteAcctMaintenanceRecords,
  sqliteWorkOrders,
  // MySQL tables
  mysqlGLAccountTypes,
  mysqlGLAccounts,
  mysqlFiscalYears,
  mysqlFiscalPeriods,
  mysqlJournalEntries,
  mysqlJournalLines,
  mysqlAPInvoices,
  mysqlAPInvoiceLines,
  mysqlARInvoices,
  mysqlARInvoiceLines,
  mysqlPayments,
  mysqlPaymentAllocations,
  mysqlVATTransactions,
  mysqlWHTTransactions,
  mysqlAssetCategories,
  mysqlFixedAssets,
  mysqlAssetDepreciations,
  mysqlAssetDisposals,
  mysqlAssetMovements,
  mysqlAccountingEquipment,
  mysqlAcctMaintenanceSchedules,
  mysqlAcctMaintenanceRecords,
  mysqlWorkOrders,
} from '../db/schema';
import { createAuditLog } from '../audit';
import type {
  JournalEntryStatus,
  JournalSourceType,
  FiscalPeriodStatus,
  JournalLineCreate,
  JournalEntry,
  JournalLine,
  FiscalPeriod,
  FiscalYear,
  GLAccount,
  GLAccountType,
} from '@/types/accounting';

// Thai VAT rate constant
export const THAI_VAT_RATE = 0.07; // 7%

// ============================================
// Table Helper
// ============================================

/**
 * Get table references based on database type (SQLite or MySQL)
 */
export function getAccountingTables() {
  if (isSqlite()) {
    return {
      glAccountTypes: sqliteGLAccountTypes,
      glAccounts: sqliteGLAccounts,
      fiscalYears: sqliteFiscalYears,
      fiscalPeriods: sqliteFiscalPeriods,
      journalEntries: sqliteJournalEntries,
      journalLines: sqliteJournalLines,
      apInvoices: sqliteAPInvoices,
      apInvoiceLines: sqliteAPInvoiceLines,
      arInvoices: sqliteARInvoices,
      arInvoiceLines: sqliteARInvoiceLines,
      payments: sqlitePayments,
      paymentAllocations: sqlitePaymentAllocations,
      vatTransactions: sqliteVATTransactions,
      whtTransactions: sqliteWHTTransactions,
      assetCategories: sqliteAssetCategories,
      fixedAssets: sqliteFixedAssets,
      assetDepreciations: sqliteAssetDepreciations,
      assetDisposals: sqliteAssetDisposals,
      assetMovements: sqliteAssetMovements,
      equipment: sqliteAccountingEquipment,
      maintenanceSchedules: sqliteAcctMaintenanceSchedules,
      maintenanceRecords: sqliteAcctMaintenanceRecords,
      workOrders: sqliteWorkOrders,
    };
  }
  return {
    glAccountTypes: mysqlGLAccountTypes,
    glAccounts: mysqlGLAccounts,
    fiscalYears: mysqlFiscalYears,
    fiscalPeriods: mysqlFiscalPeriods,
    journalEntries: mysqlJournalEntries,
    journalLines: mysqlJournalLines,
    apInvoices: mysqlAPInvoices,
    apInvoiceLines: mysqlAPInvoiceLines,
    arInvoices: mysqlARInvoices,
    arInvoiceLines: mysqlARInvoiceLines,
    payments: mysqlPayments,
    paymentAllocations: mysqlPaymentAllocations,
    vatTransactions: mysqlVATTransactions,
    whtTransactions: mysqlWHTTransactions,
    assetCategories: mysqlAssetCategories,
    fixedAssets: mysqlFixedAssets,
    assetDepreciations: mysqlAssetDepreciations,
    assetDisposals: mysqlAssetDisposals,
    assetMovements: mysqlAssetMovements,
    equipment: mysqlAccountingEquipment,
    maintenanceSchedules: mysqlAcctMaintenanceSchedules,
    maintenanceRecords: mysqlAcctMaintenanceRecords,
    workOrders: mysqlWorkOrders,
  };
}

// ============================================
// Journal Entry Number Generation
// ============================================

/**
 * Generate a unique journal entry number in format JE-YYYYMM-NNNNNN
 * @param entryDate - The date of the journal entry
 * @returns Unique entry number string
 */
export async function generateEntryNumber(entryDate: string | Date): Promise<string> {
  const { journalEntries } = getAccountingTables();
  const database = db();

  // Parse the date to get year and month
  const date = typeof entryDate === 'string' ? new Date(entryDate) : entryDate;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const prefix = `JE-${year}${month}-`;

  // Find the highest sequence number for this prefix
  const result = await database
    .select({ entryNumber: journalEntries.entryNumber })
    .from(journalEntries)
    .where(sql`${journalEntries.entryNumber} LIKE ${prefix + '%'}`)
    .orderBy(desc(journalEntries.entryNumber))
    .limit(1);

  let sequence = 1;
  if (result.length > 0 && result[0].entryNumber) {
    const lastNumber = result[0].entryNumber;
    const lastSequence = parseInt(lastNumber.replace(prefix, ''), 10);
    if (!isNaN(lastSequence)) {
      sequence = lastSequence + 1;
    }
  }

  return `${prefix}${String(sequence).padStart(6, '0')}`;
}

// ============================================
// Fiscal Period Functions
// ============================================

/**
 * Get the current fiscal period (where today falls within start and end dates)
 * @returns Current fiscal period or null if none found
 */
export async function getCurrentFiscalPeriod(): Promise<FiscalPeriod | null> {
  const { fiscalPeriods, fiscalYears } = getAccountingTables();
  const database = db();
  const today = toQueryDate(getTodayStr());

  const result = await database
    .select({
      id: fiscalPeriods.id,
      fiscalYearId: fiscalPeriods.fiscalYearId,
      periodNumber: fiscalPeriods.periodNumber,
      periodName: fiscalPeriods.periodName,
      startDate: fiscalPeriods.startDate,
      endDate: fiscalPeriods.endDate,
      status: fiscalPeriods.status,
      closedBy: fiscalPeriods.closedBy,
      closedAt: fiscalPeriods.closedAt,
      createdAt: fiscalPeriods.createdAt,
      updatedAt: fiscalPeriods.updatedAt,
    })
    .from(fiscalPeriods)
    .innerJoin(fiscalYears, eq(fiscalPeriods.fiscalYearId, fiscalYears.id))
    .where(
      and(
        lte(fiscalPeriods.startDate, today),
        gte(fiscalPeriods.endDate, today),
        eq(fiscalYears.status, 'open')
      )
    )
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  const period = result[0];
  return {
    id: period.id,
    fiscalYearId: period.fiscalYearId,
    periodNumber: period.periodNumber,
    periodName: period.periodName,
    startDate: formatDateFromDb(period.startDate),
    endDate: formatDateFromDb(period.endDate),
    status: period.status as FiscalPeriodStatus,
    closedBy: period.closedBy,
    closedAt: period.closedAt ? formatDateFromDb(period.closedAt) : null,
    createdAt: formatDateFromDb(period.createdAt),
    updatedAt: formatDateFromDb(period.updatedAt),
  };
}

/**
 * Get fiscal period for a specific date
 * @param date - The date to find the period for
 * @returns Fiscal period or null if none found
 */
export async function getPeriodByDate(date: string | Date): Promise<FiscalPeriod | null> {
  const { fiscalPeriods, fiscalYears } = getAccountingTables();
  const database = db();

  const queryDate = toQueryDate(typeof date === 'string' ? date : date.toISOString().split('T')[0]);

  const result = await database
    .select({
      id: fiscalPeriods.id,
      fiscalYearId: fiscalPeriods.fiscalYearId,
      periodNumber: fiscalPeriods.periodNumber,
      periodName: fiscalPeriods.periodName,
      startDate: fiscalPeriods.startDate,
      endDate: fiscalPeriods.endDate,
      status: fiscalPeriods.status,
      closedBy: fiscalPeriods.closedBy,
      closedAt: fiscalPeriods.closedAt,
      createdAt: fiscalPeriods.createdAt,
      updatedAt: fiscalPeriods.updatedAt,
    })
    .from(fiscalPeriods)
    .innerJoin(fiscalYears, eq(fiscalPeriods.fiscalYearId, fiscalYears.id))
    .where(
      and(
        lte(fiscalPeriods.startDate, queryDate),
        gte(fiscalPeriods.endDate, queryDate)
      )
    )
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  const period = result[0];
  return {
    id: period.id,
    fiscalYearId: period.fiscalYearId,
    periodNumber: period.periodNumber,
    periodName: period.periodName,
    startDate: formatDateFromDb(period.startDate),
    endDate: formatDateFromDb(period.endDate),
    status: period.status as FiscalPeriodStatus,
    closedBy: period.closedBy,
    closedAt: period.closedAt ? formatDateFromDb(period.closedAt) : null,
    createdAt: formatDateFromDb(period.createdAt),
    updatedAt: formatDateFromDb(period.updatedAt),
  };
}

/**
 * Check if a fiscal period is open for posting
 * @param periodId - The fiscal period ID to check
 * @returns True if the period is open
 */
export async function isPeriodOpen(periodId: number): Promise<boolean> {
  const { fiscalPeriods, fiscalYears } = getAccountingTables();
  const database = db();

  const result = await database
    .select({
      periodStatus: fiscalPeriods.status,
      yearStatus: fiscalYears.status,
    })
    .from(fiscalPeriods)
    .innerJoin(fiscalYears, eq(fiscalPeriods.fiscalYearId, fiscalYears.id))
    .where(eq(fiscalPeriods.id, periodId))
    .limit(1);

  if (result.length === 0) {
    return false;
  }

  // Period must be 'open' and year must be 'open'
  return result[0].periodStatus === 'open' && result[0].yearStatus === 'open';
}

// ============================================
// Journal Entry CRUD
// ============================================

export interface CreateJournalEntryInput {
  entryDate: string;
  fiscalPeriodId?: number;
  description?: string;
  sourceType?: JournalSourceType;
  sourceId?: number;
  lines: JournalLineCreate[];
  createdBy: number;
}

/**
 * Create a new journal entry with balance validation
 * @param input - Journal entry data with lines
 * @returns Created journal entry with lines
 * @throws Error if debit/credit totals don't balance
 */
export async function createJournalEntry(input: CreateJournalEntryInput): Promise<JournalEntry> {
  const { journalEntries, journalLines } = getAccountingTables();
  const database = db();

  // Validate that lines exist
  if (!input.lines || input.lines.length < 2) {
    throw new Error('Journal entry must have at least 2 lines');
  }

  // Calculate totals and validate balance
  const totalDebit = input.lines.reduce((sum, line) => sum + (line.debit || 0), 0);
  const totalCredit = input.lines.reduce((sum, line) => sum + (line.credit || 0), 0);

  // Allow small rounding difference (0.01)
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(
      `Journal entry is not balanced. Debit: ${totalDebit.toFixed(2)}, Credit: ${totalCredit.toFixed(2)}`
    );
  }

  // Get or determine fiscal period
  let fiscalPeriodId = input.fiscalPeriodId;
  if (!fiscalPeriodId) {
    const period = await getPeriodByDate(input.entryDate);
    if (!period) {
      throw new Error(`No fiscal period found for date ${input.entryDate}`);
    }
    fiscalPeriodId = period.id;
  }

  // Generate entry number
  const entryNumber = await generateEntryNumber(input.entryDate);

  // Insert journal entry
  const entryValues = {
    entryNumber,
    entryDate: toDbDate(input.entryDate),
    fiscalPeriodId,
    description: input.description || null,
    sourceType: input.sourceType || null,
    sourceId: input.sourceId || null,
    status: 'draft' as JournalEntryStatus,
    totalDebit: totalDebit,
    totalCredit: totalCredit,
    createdBy: input.createdBy,
    createdAt: getNow(),
    updatedAt: getNow(),
  };

  const insertResult = await database
    .insert(journalEntries)
    .values(entryValues as any);

  const journalEntryId = isSqlite()
    ? (insertResult as unknown as { lastInsertRowid: number }).lastInsertRowid
    : (insertResult as unknown as [{ insertId: number }])[0].insertId;

  // Insert journal lines
  const lineValues = input.lines.map((line, index) => ({
    journalEntryId,
    lineNumber: index + 1,
    glAccountId: line.glAccountId,
    debit: line.debit || 0,
    credit: line.credit || 0,
    description: line.description || null,
    costCenterId: line.costCenterId || null,
    createdAt: getNow(),
  }));

  await database.insert(journalLines).values(lineValues as any);

  // Create audit log
  await createAuditLog({
    action: 'CREATE',
    tableName: 'journal_entry',
    recordId: journalEntryId,
    userId: input.createdBy,
    newValue: {
      entryNumber,
      totalDebit,
      totalCredit,
      lineCount: input.lines.length,
      sourceType: input.sourceType,
    },
  });

  // Return the created entry
  return await getJournalEntryById(journalEntryId);
}

/**
 * Get a journal entry by ID with its lines
 * @param id - Journal entry ID
 * @returns Journal entry with lines or throws if not found
 */
export async function getJournalEntryById(id: number): Promise<JournalEntry> {
  const { journalEntries, journalLines, glAccounts } = getAccountingTables();
  const database = db();

  // Get journal entry
  const [entry] = await database
    .select()
    .from(journalEntries)
    .where(eq(journalEntries.id, id));

  if (!entry) {
    throw new Error(`Journal entry with ID ${id} not found`);
  }

  // Get journal lines with account info
  const lines = await database
    .select({
      id: journalLines.id,
      journalEntryId: journalLines.journalEntryId,
      lineNumber: journalLines.lineNumber,
      glAccountId: journalLines.glAccountId,
      debit: journalLines.debit,
      credit: journalLines.credit,
      description: journalLines.description,
      costCenterId: journalLines.costCenterId,
      createdAt: journalLines.createdAt,
      accountCode: glAccounts.code,
      accountNameTh: glAccounts.nameTh,
      accountNameEn: glAccounts.nameEn,
    })
    .from(journalLines)
    .leftJoin(glAccounts, eq(journalLines.glAccountId, glAccounts.id))
    .where(eq(journalLines.journalEntryId, id))
    .orderBy(asc(journalLines.lineNumber));

  return {
    id: entry.id,
    entryNumber: entry.entryNumber,
    entryDate: formatDateFromDb(entry.entryDate),
    fiscalPeriodId: entry.fiscalPeriodId,
    description: entry.description,
    sourceType: entry.sourceType as JournalSourceType | null,
    sourceId: entry.sourceId,
    status: entry.status as JournalEntryStatus,
    totalDebit: Number(entry.totalDebit),
    totalCredit: Number(entry.totalCredit),
    postedBy: entry.postedBy,
    postedAt: entry.postedAt ? formatDateFromDb(entry.postedAt) : null,
    reversedBy: entry.reversedBy,
    reversedAt: entry.reversedAt ? formatDateFromDb(entry.reversedAt) : null,
    reversalEntryId: entry.reversalEntryId,
    createdBy: entry.createdBy,
    createdAt: formatDateFromDb(entry.createdAt),
    updatedAt: formatDateFromDb(entry.updatedAt),
    lines: lines.map((line: (typeof lines)[number]) => ({
      id: line.id,
      journalEntryId: line.journalEntryId,
      lineNumber: line.lineNumber,
      glAccountId: line.glAccountId,
      debit: Number(line.debit),
      credit: Number(line.credit),
      description: line.description,
      costCenterId: line.costCenterId,
      createdAt: formatDateFromDb(line.createdAt),
      glAccount: line.accountCode
        ? {
            id: line.glAccountId,
            code: line.accountCode,
            nameTh: line.accountNameTh || '',
            nameEn: line.accountNameEn || '',
          }
        : undefined,
    })) as JournalLine[],
  };
}

/**
 * Post a journal entry (change status from draft to posted)
 * @param id - Journal entry ID
 * @param postedBy - User ID performing the post
 * @returns Updated journal entry
 * @throws Error if entry is not in draft status or period is closed
 */
export async function postJournalEntry(id: number, postedBy: number): Promise<JournalEntry> {
  const { journalEntries } = getAccountingTables();
  const database = db();

  // Get current entry
  const [entry] = await database
    .select()
    .from(journalEntries)
    .where(eq(journalEntries.id, id));

  if (!entry) {
    throw new Error(`Journal entry with ID ${id} not found`);
  }

  // Validate status
  if (entry.status !== 'draft') {
    throw new Error(`Cannot post journal entry with status '${entry.status}'. Only draft entries can be posted.`);
  }

  // Check if period is open
  const periodOpen = await isPeriodOpen(entry.fiscalPeriodId);
  if (!periodOpen) {
    throw new Error('Cannot post to a closed fiscal period');
  }

  // Update status to posted
  await database
    .update(journalEntries)
    .set({
      status: 'posted',
      postedBy,
      postedAt: getNow(),
      updatedAt: getNow(),
    })
    .where(eq(journalEntries.id, id));

  // Create audit log
  await createAuditLog({
    action: 'APPROVE',
    tableName: 'journal_entry',
    recordId: id,
    userId: postedBy,
    newValue: {
      entryNumber: entry.entryNumber,
      previousStatus: entry.status,
      newStatus: 'posted',
    },
  });

  return await getJournalEntryById(id);
}

/**
 * Reverse a posted journal entry by creating a reversing entry
 * @param id - Journal entry ID to reverse
 * @param reversedBy - User ID performing the reversal
 * @param reversalDate - Date for the reversing entry (optional, defaults to today)
 * @param reason - Reason for reversal (optional)
 * @returns The new reversing journal entry
 * @throws Error if entry is not posted or period is closed
 */
export async function reverseJournalEntry(
  id: number,
  reversedBy: number,
  reversalDate?: string,
  reason?: string
): Promise<JournalEntry> {
  const { journalEntries, journalLines } = getAccountingTables();
  const database = db();

  // Get original entry with lines
  const originalEntry = await getJournalEntryById(id);

  if (originalEntry.status !== 'posted') {
    throw new Error(`Cannot reverse journal entry with status '${originalEntry.status}'. Only posted entries can be reversed.`);
  }

  if (originalEntry.reversalEntryId) {
    throw new Error('This journal entry has already been reversed');
  }

  // Determine reversal date
  const effectiveReversalDate = reversalDate || getTodayStr();

  // Check if reversal period is open
  const reversalPeriod = await getPeriodByDate(effectiveReversalDate);
  if (!reversalPeriod) {
    throw new Error(`No fiscal period found for reversal date ${effectiveReversalDate}`);
  }

  const periodOpen = await isPeriodOpen(reversalPeriod.id);
  if (!periodOpen) {
    throw new Error('Cannot create reversing entry in a closed fiscal period');
  }

  // Create reversing entry with debits and credits swapped
  const reversalDescription = reason
    ? `Reversal of ${originalEntry.entryNumber}: ${reason}`
    : `Reversal of ${originalEntry.entryNumber}`;

  const reversalLines: JournalLineCreate[] = (originalEntry.lines || []).map((line: JournalLine) => ({
    glAccountId: line.glAccountId,
    debit: line.credit, // Swap: original credit becomes reversal debit
    credit: line.debit, // Swap: original debit becomes reversal credit
    description: `Reversal: ${line.description || ''}`.trim(),
    costCenterId: line.costCenterId ?? undefined,
  }));

  // Create the reversing entry
  const reversalEntry = await createJournalEntry({
    entryDate: effectiveReversalDate,
    fiscalPeriodId: reversalPeriod.id,
    description: reversalDescription,
    sourceType: originalEntry.sourceType || undefined,
    sourceId: originalEntry.sourceId || undefined,
    lines: reversalLines,
    createdBy: reversedBy,
  });

  // Immediately post the reversing entry
  const postedReversalEntry = await postJournalEntry(reversalEntry.id, reversedBy);

  // Update original entry to mark as reversed
  await database
    .update(journalEntries)
    .set({
      status: 'reversed',
      reversedBy,
      reversedAt: getNow(),
      reversalEntryId: postedReversalEntry.id,
      updatedAt: getNow(),
    })
    .where(eq(journalEntries.id, id));

  // Create audit log for the reversal
  await createAuditLog({
    action: 'UPDATE',
    tableName: 'journal_entry',
    recordId: id,
    userId: reversedBy,
    newValue: {
      originalEntryNumber: originalEntry.entryNumber,
      reversalEntryNumber: postedReversalEntry.entryNumber,
      reversalEntryId: postedReversalEntry.id,
      reason,
    },
  });

  return postedReversalEntry;
}

// ============================================
// Thai Tax Calculations
// ============================================

/**
 * Calculate VAT amount (Thai standard rate 7%)
 * @param amount - Base amount (before VAT)
 * @param isInclusive - If true, amount includes VAT; if false, VAT is added
 * @returns Object with base amount, VAT amount, and total
 */
export function calculateVAT(
  amount: number,
  isInclusive: boolean = false
): { baseAmount: number; vatAmount: number; totalAmount: number } {
  if (isInclusive) {
    // Amount includes VAT, need to extract
    const baseAmount = amount / (1 + THAI_VAT_RATE);
    const vatAmount = amount - baseAmount;
    return {
      baseAmount: Math.round(baseAmount * 100) / 100,
      vatAmount: Math.round(vatAmount * 100) / 100,
      totalAmount: amount,
    };
  } else {
    // Amount excludes VAT, need to add
    const vatAmount = amount * THAI_VAT_RATE;
    const totalAmount = amount + vatAmount;
    return {
      baseAmount: amount,
      vatAmount: Math.round(vatAmount * 100) / 100,
      totalAmount: Math.round(totalAmount * 100) / 100,
    };
  }
}

/**
 * Calculate Withholding Tax amount
 * @param amount - Payment amount
 * @param whtRate - WHT rate as percentage (e.g., 3 for 3%)
 * @returns Object with WHT amount and net payment
 */
export function calculateWHT(
  amount: number,
  whtRate: number
): { whtAmount: number; netPayment: number } {
  const whtAmount = (amount * whtRate) / 100;
  return {
    whtAmount: Math.round(whtAmount * 100) / 100,
    netPayment: Math.round((amount - whtAmount) * 100) / 100,
  };
}

// ============================================
// GL Account Functions
// ============================================

/**
 * Get all GL account types
 * @returns List of account types ordered by displayOrder
 */
export async function listGLAccountTypes(): Promise<GLAccountType[]> {
  const { glAccountTypes } = getAccountingTables();
  const database = db();

  const result = await database
    .select()
    .from(glAccountTypes)
    .orderBy(asc(glAccountTypes.displayOrder));

  return result.map((type: (typeof result)[number]) => ({
    id: type.id,
    code: type.code,
    nameTh: type.nameTh,
    nameEn: type.nameEn,
    category: type.category as any,
    normalBalance: type.normalBalance as any,
    displayOrder: type.displayOrder,
    createdAt: formatDateFromDb(type.createdAt),
    updatedAt: formatDateFromDb(type.updatedAt),
  }));
}

/**
 * List GL accounts with optional filters
 * @param filters - Optional filters for querying accounts
 * @returns List of GL accounts
 */
export async function listGLAccounts(filters?: {
  accountTypeId?: number;
  parentId?: number | null;
  isActive?: boolean;
  isPostable?: boolean;
  isBankAccount?: boolean;
  search?: string;
}): Promise<GLAccount[]> {
  const { glAccounts, glAccountTypes } = getAccountingTables();
  const database = db();

  const conditions: any[] = [];

  if (filters?.accountTypeId) {
    conditions.push(eq(glAccounts.accountTypeId, filters.accountTypeId));
  }

  if (filters?.parentId !== undefined) {
    if (filters.parentId === null) {
      conditions.push(isNull(glAccounts.parentId));
    } else {
      conditions.push(eq(glAccounts.parentId, filters.parentId));
    }
  }

  if (filters?.isActive !== undefined) {
    conditions.push(eq(glAccounts.isActive, filters.isActive));
  }

  if (filters?.isPostable !== undefined) {
    conditions.push(eq(glAccounts.isPostable, filters.isPostable));
  }

  if (filters?.isBankAccount !== undefined) {
    conditions.push(eq(glAccounts.isBankAccount, filters.isBankAccount));
  }

  if (filters?.search) {
    const searchTerm = `%${filters.search}%`;
    conditions.push(
      or(
        sql`${glAccounts.code} LIKE ${searchTerm}`,
        sql`${glAccounts.nameTh} LIKE ${searchTerm}`,
        sql`${glAccounts.nameEn} LIKE ${searchTerm}`
      )
    );
  }

  const result = await database
    .select({
      id: glAccounts.id,
      code: glAccounts.code,
      nameTh: glAccounts.nameTh,
      nameEn: glAccounts.nameEn,
      accountTypeId: glAccounts.accountTypeId,
      parentId: glAccounts.parentId,
      level: glAccounts.level,
      isActive: glAccounts.isActive,
      isPostable: glAccounts.isPostable,
      isBankAccount: glAccounts.isBankAccount,
      bankName: glAccounts.bankName,
      bankAccountNumber: glAccounts.bankAccountNumber,
      description: glAccounts.description,
      createdBy: glAccounts.createdBy,
      createdAt: glAccounts.createdAt,
      updatedAt: glAccounts.updatedAt,
      typeCode: glAccountTypes.code,
      typeNameTh: glAccountTypes.nameTh,
      typeNameEn: glAccountTypes.nameEn,
      typeCategory: glAccountTypes.category,
      typeNormalBalance: glAccountTypes.normalBalance,
    })
    .from(glAccounts)
    .leftJoin(glAccountTypes, eq(glAccounts.accountTypeId, glAccountTypes.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(glAccounts.code));

  return result.map((acc: (typeof result)[number]) => ({
    id: acc.id,
    code: acc.code,
    nameTh: acc.nameTh,
    nameEn: acc.nameEn,
    accountTypeId: acc.accountTypeId,
    parentId: acc.parentId,
    level: acc.level,
    isActive: Boolean(acc.isActive),
    isPostable: Boolean(acc.isPostable),
    isBankAccount: Boolean(acc.isBankAccount),
    bankName: acc.bankName,
    bankAccountNumber: acc.bankAccountNumber,
    description: acc.description,
    createdBy: acc.createdBy,
    createdAt: formatDateFromDb(acc.createdAt),
    updatedAt: formatDateFromDb(acc.updatedAt),
    accountType: acc.typeCode
      ? {
          id: acc.accountTypeId,
          code: acc.typeCode,
          nameTh: acc.typeNameTh || '',
          nameEn: acc.typeNameEn || '',
          category: acc.typeCategory as any,
          normalBalance: acc.typeNormalBalance as any,
          displayOrder: 0,
          createdAt: '',
          updatedAt: '',
        }
      : undefined,
  }));
}

/**
 * Create a new GL account
 * @param input - Account data
 * @param createdBy - User ID creating the account
 * @returns Created account
 */
export async function createGLAccount(
  input: {
    code: string;
    nameTh: string;
    nameEn: string;
    accountTypeId: number;
    parentId?: number | null;
    isPostable?: boolean;
    isBankAccount?: boolean;
    bankName?: string;
    bankAccountNumber?: string;
    description?: string;
  },
  createdBy: number
): Promise<GLAccount> {
  const { glAccounts } = getAccountingTables();
  const database = db();

  // Calculate level based on parent
  let level = 1;
  if (input.parentId) {
    const [parent] = await database
      .select({ level: glAccounts.level })
      .from(glAccounts)
      .where(eq(glAccounts.id, input.parentId));

    if (parent) {
      level = parent.level + 1;
    }
  }

  const values = {
    code: input.code,
    nameTh: input.nameTh,
    nameEn: input.nameEn,
    accountTypeId: input.accountTypeId,
    parentId: input.parentId || null,
    level,
    isActive: true,
    isPostable: input.isPostable ?? true,
    isBankAccount: input.isBankAccount ?? false,
    bankName: input.bankName || null,
    bankAccountNumber: input.bankAccountNumber || null,
    description: input.description || null,
    createdBy,
    createdAt: getNow(),
    updatedAt: getNow(),
  };

  const insertResult = await database
    .insert(glAccounts)
    .values(values as any);

  const insertedId = isSqlite()
    ? (insertResult as unknown as { lastInsertRowid: number }).lastInsertRowid
    : (insertResult as unknown as [{ insertId: number }])[0].insertId;

  await createAuditLog({
    action: 'CREATE',
    tableName: 'gl_account',
    recordId: insertedId,
    userId: createdBy,
    newValue: { code: input.code, nameTh: input.nameTh },
  });

  const accounts = await listGLAccounts({ search: input.code });
  return accounts.find((a) => a.id === insertedId)!;
}

// ============================================
// Fiscal Year/Period Management
// ============================================

/**
 * Create a new fiscal year with 12 monthly periods
 * @param input - Fiscal year data
 * @param createdBy - User ID creating the year
 * @returns Created fiscal year with periods
 */
export async function createFiscalYear(
  input: {
    yearCode: string;
    startDate: string;
    endDate: string;
    isCurrent?: boolean;
  },
  createdBy: number
): Promise<FiscalYear> {
  const { fiscalYears, fiscalPeriods } = getAccountingTables();
  const database = db();

  // If this is set as current, unset any existing current year
  if (input.isCurrent) {
    await database
      .update(fiscalYears)
      .set({ isCurrent: false, updatedAt: getNow() })
      .where(eq(fiscalYears.isCurrent, true));
  }

  // Create fiscal year
  const yearValues = {
    yearCode: input.yearCode,
    startDate: toDbDate(input.startDate),
    endDate: toDbDate(input.endDate),
    isCurrent: input.isCurrent ?? false,
    status: 'open' as const,
    createdAt: getNow(),
    updatedAt: getNow(),
  };

  const insertResult = await database
    .insert(fiscalYears)
    .values(yearValues as any);

  const insertedYearId = isSqlite()
    ? (insertResult as unknown as { lastInsertRowid: number }).lastInsertRowid
    : (insertResult as unknown as [{ insertId: number }])[0].insertId;

  // Generate 12 monthly periods
  const startDate = new Date(input.startDate);
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  for (let i = 0; i < 12; i++) {
    const periodStart = new Date(startDate);
    periodStart.setMonth(startDate.getMonth() + i);

    const periodEnd = new Date(periodStart);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    periodEnd.setDate(periodEnd.getDate() - 1);

    const periodValues = {
      fiscalYearId: insertedYearId,
      periodNumber: i + 1,
      periodName: monthNames[periodStart.getMonth()],
      startDate: toDbDate(periodStart.toISOString().split('T')[0]),
      endDate: toDbDate(periodEnd.toISOString().split('T')[0]),
      status: 'open' as const,
      createdAt: getNow(),
      updatedAt: getNow(),
    };

    await database.insert(fiscalPeriods).values(periodValues as any);
  }

  await createAuditLog({
    action: 'CREATE',
    tableName: 'fiscal_year',
    recordId: insertedYearId,
    userId: createdBy,
    newValue: { yearCode: input.yearCode, startDate: input.startDate, endDate: input.endDate },
  });

  // Return the created year
  return await getFiscalYearById(insertedYearId);
}

/**
 * Get a fiscal year by ID with its periods
 * @param id - Fiscal year ID
 * @returns Fiscal year with periods
 */
export async function getFiscalYearById(id: number): Promise<FiscalYear> {
  const { fiscalYears, fiscalPeriods } = getAccountingTables();
  const database = db();

  const [year] = await database
    .select()
    .from(fiscalYears)
    .where(eq(fiscalYears.id, id));

  if (!year) {
    throw new Error(`Fiscal year with ID ${id} not found`);
  }

  const periods = await database
    .select()
    .from(fiscalPeriods)
    .where(eq(fiscalPeriods.fiscalYearId, id))
    .orderBy(asc(fiscalPeriods.periodNumber));

  return {
    id: year.id,
    yearCode: year.yearCode,
    startDate: formatDateFromDb(year.startDate),
    endDate: formatDateFromDb(year.endDate),
    isCurrent: Boolean(year.isCurrent),
    status: year.status as any,
    closedBy: year.closedBy,
    closedAt: year.closedAt ? formatDateFromDb(year.closedAt) : null,
    createdAt: formatDateFromDb(year.createdAt),
    updatedAt: formatDateFromDb(year.updatedAt),
    periods: periods.map((p: (typeof periods)[number]) => ({
      id: p.id,
      fiscalYearId: p.fiscalYearId,
      periodNumber: p.periodNumber,
      periodName: p.periodName,
      startDate: formatDateFromDb(p.startDate),
      endDate: formatDateFromDb(p.endDate),
      status: p.status as FiscalPeriodStatus,
      closedBy: p.closedBy,
      closedAt: p.closedAt ? formatDateFromDb(p.closedAt) : null,
      createdAt: formatDateFromDb(p.createdAt),
      updatedAt: formatDateFromDb(p.updatedAt),
    })),
  };
}

/**
 * List all fiscal years
 * @returns List of fiscal years
 */
export async function listFiscalYears(): Promise<FiscalYear[]> {
  const { fiscalYears } = getAccountingTables();
  const database = db();

  const years = await database
    .select()
    .from(fiscalYears)
    .orderBy(desc(fiscalYears.startDate));

  return years.map((year: (typeof years)[number]) => ({
    id: year.id,
    yearCode: year.yearCode,
    startDate: formatDateFromDb(year.startDate),
    endDate: formatDateFromDb(year.endDate),
    isCurrent: Boolean(year.isCurrent),
    status: year.status as any,
    closedBy: year.closedBy,
    closedAt: year.closedAt ? formatDateFromDb(year.closedAt) : null,
    createdAt: formatDateFromDb(year.createdAt),
    updatedAt: formatDateFromDb(year.updatedAt),
  }));
}

// ============================================
// GL Account Management (User Story 1)
// ============================================

/**
 * Get a GL account by ID
 * @param id - GL account ID
 * @returns GL account or null
 */
export async function getGLAccountById(id: number): Promise<GLAccount | null> {
  const { glAccounts, glAccountTypes } = getAccountingTables();
  const database = db();

  const [account] = await database
    .select({
      id: glAccounts.id,
      code: glAccounts.code,
      nameTh: glAccounts.nameTh,
      nameEn: glAccounts.nameEn,
      accountTypeId: glAccounts.accountTypeId,
      parentId: glAccounts.parentId,
      level: glAccounts.level,
      isPostable: glAccounts.isPostable,
      isBankAccount: glAccounts.isBankAccount,
      bankName: glAccounts.bankName,
      bankAccountNumber: glAccounts.bankAccountNumber,
      description: glAccounts.description,
      isActive: glAccounts.isActive,
      createdBy: glAccounts.createdBy,
      createdAt: glAccounts.createdAt,
      updatedAt: glAccounts.updatedAt,
    })
    .from(glAccounts)
    .where(eq(glAccounts.id, id))
    .limit(1);

  if (!account) return null;

  return {
    id: account.id,
    code: account.code,
    nameTh: account.nameTh,
    nameEn: account.nameEn,
    accountTypeId: account.accountTypeId,
    parentId: account.parentId,
    level: account.level,
    isPostable: Boolean(account.isPostable),
    isBankAccount: Boolean(account.isBankAccount),
    bankName: account.bankName,
    bankAccountNumber: account.bankAccountNumber,
    description: account.description,
    isActive: Boolean(account.isActive),
    createdBy: account.createdBy!,
    createdAt: formatDateFromDb(account.createdAt),
    updatedAt: formatDateFromDb(account.updatedAt),
  };
}

interface UpdateGLAccountInput {
  nameTh?: string;
  nameEn?: string;
  description?: string;
  isActive?: boolean;
  isBankAccount?: boolean;
  bankName?: string | null;
  bankAccountNumber?: string | null;
}

/**
 * Update a GL account
 * @param id - GL account ID
 * @param input - Update data
 * @param updatedBy - User ID making the update
 * @returns Updated GL account
 */
export async function updateGLAccount(
  id: number,
  input: UpdateGLAccountInput,
  updatedBy: number
): Promise<GLAccount> {
  const { glAccounts } = getAccountingTables();
  const database = db();

  // Check if account exists
  const existing = await getGLAccountById(id);
  if (!existing) {
    throw new Error('GL account not found');
  }

  // Cannot change code or type after creation
  const updateValues: Record<string, unknown> = {
    updatedAt: getNow(),
  };

  if (input.nameTh !== undefined) updateValues.nameTh = input.nameTh;
  if (input.nameEn !== undefined) updateValues.nameEn = input.nameEn;
  if (input.description !== undefined) updateValues.description = input.description;
  if (input.isActive !== undefined) updateValues.isActive = input.isActive;
  if (input.isBankAccount !== undefined) updateValues.isBankAccount = input.isBankAccount;
  if (input.bankName !== undefined) updateValues.bankName = input.bankName;
  if (input.bankAccountNumber !== undefined) updateValues.bankAccountNumber = input.bankAccountNumber;

  await database
    .update(glAccounts)
    .set(updateValues)
    .where(eq(glAccounts.id, id));

  await createAuditLog({
    action: 'UPDATE',
    tableName: 'gl_account',
    recordId: id,
    userId: updatedBy,
    newValue: { code: existing.code, changes: input },
  });

  return (await getGLAccountById(id))!;
}

/**
 * Deactivate a GL account (soft delete)
 * @param id - GL account ID
 * @param deactivatedBy - User ID making the deactivation
 * @returns Deactivated GL account
 */
export async function deactivateGLAccount(
  id: number,
  deactivatedBy: number
): Promise<GLAccount> {
  const { glAccounts, journalLines } = getAccountingTables();
  const database = db();

  // Check if account exists
  const existing = await getGLAccountById(id);
  if (!existing) {
    throw new Error('GL account not found');
  }

  // Check for balance - if there's any transaction, check if balanced
  const [balanceResult] = await database
    .select({
      totalDebit: sql<number>`COALESCE(SUM(${journalLines.debit}), 0)`,
      totalCredit: sql<number>`COALESCE(SUM(${journalLines.credit}), 0)`,
    })
    .from(journalLines)
    .where(eq(journalLines.glAccountId, id));

  const balance = Number(balanceResult?.totalDebit || 0) - Number(balanceResult?.totalCredit || 0);
  if (Math.abs(balance) > 0.01) {
    throw new Error(`Cannot deactivate account with non-zero balance: ${balance.toFixed(2)}`);
  }

  // Check for child accounts
  const [childCount] = await database
    .select({ count: sql<number>`COUNT(*)` })
    .from(glAccounts)
    .where(and(eq(glAccounts.parentId, id), eq(glAccounts.isActive, true)));

  if (Number(childCount?.count || 0) > 0) {
    throw new Error('Cannot deactivate account with active child accounts');
  }

  await database
    .update(glAccounts)
    .set({ isActive: false, updatedAt: getNow() })
    .where(eq(glAccounts.id, id));

  await createAuditLog({
    action: 'UPDATE',
    tableName: 'gl_account',
    recordId: id,
    userId: deactivatedBy,
    newValue: { code: existing.code },
  });

  return (await getGLAccountById(id))!;
}

/**
 * Delete a GL account (hard delete - only if no transactions)
 * @param id - GL account ID
 * @param deletedBy - User ID making the deletion
 */
export async function deleteGLAccount(
  id: number,
  deletedBy: number
): Promise<void> {
  const { glAccounts, journalLines } = getAccountingTables();
  const database = db();

  // Check if account exists
  const existing = await getGLAccountById(id);
  if (!existing) {
    throw new Error('GL account not found');
  }

  // Check for any transactions
  const [txCount] = await database
    .select({ count: sql<number>`COUNT(*)` })
    .from(journalLines)
    .where(eq(journalLines.glAccountId, id));

  if (Number(txCount?.count || 0) > 0) {
    throw new Error('Cannot delete account with existing transactions. Use deactivate instead.');
  }

  // Check for child accounts
  const [childCount] = await database
    .select({ count: sql<number>`COUNT(*)` })
    .from(glAccounts)
    .where(eq(glAccounts.parentId, id));

  if (Number(childCount?.count || 0) > 0) {
    throw new Error('Cannot delete account with child accounts');
  }

  await database
    .delete(glAccounts)
    .where(eq(glAccounts.id, id));

  await createAuditLog({
    action: 'DELETE',
    tableName: 'gl_account',
    recordId: id,
    userId: deletedBy,
    newValue: { code: existing.code, nameTh: existing.nameTh },
  });
}

interface GLAccountTreeNode extends GLAccount {
  children: GLAccountTreeNode[];
}

/**
 * Get GL accounts as a hierarchical tree
 * @returns Tree structure of GL accounts
 */
export async function getGLAccountTree(): Promise<GLAccountTreeNode[]> {
  const accounts = await listGLAccounts({ isActive: true });

  // Build a map for quick lookup
  const accountMap = new Map<number, GLAccountTreeNode>();
  accounts.forEach((account) => {
    accountMap.set(account.id, { ...account, children: [] });
  });

  // Build the tree
  const rootNodes: GLAccountTreeNode[] = [];
  accountMap.forEach((node) => {
    if (node.parentId) {
      const parent = accountMap.get(node.parentId);
      if (parent) {
        parent.children.push(node);
      } else {
        // Parent not found or inactive, treat as root
        rootNodes.push(node);
      }
    } else {
      rootNodes.push(node);
    }
  });

  // Sort children by code at each level
  const sortChildren = (nodes: GLAccountTreeNode[]) => {
    nodes.sort((a, b) => a.code.localeCompare(b.code));
    nodes.forEach((node) => sortChildren(node.children));
  };
  sortChildren(rootNodes);

  return rootNodes;
}

interface GLAccountBalance {
  accountId: number;
  accountCode: string;
  accountName: string;
  debitTotal: number;
  creditTotal: number;
  balance: number;
  normalBalance: 'debit' | 'credit';
  asOfDate: string;
}

/**
 * Get GL account balance as of a specific date
 * @param accountId - GL account ID
 * @param asOfDate - Date to calculate balance as of (defaults to today)
 * @returns Account balance information
 */
export async function getGLAccountBalance(
  accountId: number,
  asOfDate?: string
): Promise<GLAccountBalance> {
  const { journalEntries, journalLines, glAccounts, glAccountTypes } = getAccountingTables();
  const database = db();

  // Get account details
  const [account] = await database
    .select({
      id: glAccounts.id,
      code: glAccounts.code,
      nameTh: glAccounts.nameTh,
      normalBalance: glAccountTypes.normalBalance,
    })
    .from(glAccounts)
    .leftJoin(glAccountTypes, eq(glAccounts.accountTypeId, glAccountTypes.id))
    .where(eq(glAccounts.id, accountId))
    .limit(1);

  if (!account) {
    throw new Error('GL account not found');
  }

  const effectiveDate = asOfDate || getTodayStr();

  // Calculate totals from posted journal entries up to the date
  const [totals] = await database
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
        lte(journalEntries.entryDate, toQueryDate(effectiveDate))
      )
    );

  const debitTotal = Number(totals?.debitTotal || 0);
  const creditTotal = Number(totals?.creditTotal || 0);
  const normalBalance = (account.normalBalance as 'debit' | 'credit') || 'debit';

  // Calculate balance based on normal balance
  const balance = normalBalance === 'debit'
    ? debitTotal - creditTotal
    : creditTotal - debitTotal;

  return {
    accountId: account.id,
    accountCode: account.code,
    accountName: account.nameTh,
    debitTotal: Math.round(debitTotal * 100) / 100,
    creditTotal: Math.round(creditTotal * 100) / 100,
    balance: Math.round(balance * 100) / 100,
    normalBalance,
    asOfDate: effectiveDate,
  };
}

interface ExportCOAOptions {
  includeInactive?: boolean;
  format?: 'json' | 'csv';
}

interface ExportedCOAAccount {
  code: string;
  nameTh: string;
  nameEn: string | null;
  typeCode: string | undefined;
  typeName: string | undefined;
  parentCode: string | null;
  level: number;
  isPostable: boolean;
  isActive: boolean;
  description: string | null;
}

/**
 * Export Chart of Accounts for auditor review
 * @param options - Export options
 * @returns Exported COA data
 */
export async function exportChartOfAccounts(
  options: ExportCOAOptions = {}
): Promise<{ accounts: ExportedCOAAccount[]; exportedAt: string; count: number }> {
  const accounts = await listGLAccounts({
    isActive: options.includeInactive ? undefined : true,
  });

  // Build a code lookup for parent references
  const codeMap = new Map<number, string>();
  accounts.forEach((account) => {
    codeMap.set(account.id, account.code);
  });

  const exportedAccounts: ExportedCOAAccount[] = accounts.map((account) => ({
    code: account.code,
    nameTh: account.nameTh,
    nameEn: account.nameEn,
    typeCode: account.accountType?.code,
    typeName: account.accountType?.nameTh,
    parentCode: account.parentId ? (codeMap.get(account.parentId) || null) : null,
    level: account.level,
    isPostable: account.isPostable,
    isActive: account.isActive,
    description: account.description,
  }));

  // Sort by code
  exportedAccounts.sort((a, b) => a.code.localeCompare(b.code));

  return {
    accounts: exportedAccounts,
    exportedAt: new Date().toISOString(),
    count: exportedAccounts.length,
  };
}

// ============================================
// AP Invoice Service Functions (User Story 2)
// ============================================

export interface APInvoice {
  id: number;
  invoiceNumber: string;
  vendorId: number;
  purchaseOrderId: number | null;
  invoiceDate: string;
  dueDate: string;
  receivedDate: string;
  description: string | null;
  subtotal: number;
  vatAmount: number;
  whtAmount: number;
  totalAmount: number;
  paidAmount: number;
  currency: string;
  exchangeRate: number;
  status: 'draft' | 'approved' | 'posted' | 'partial' | 'paid' | 'cancelled';
  approvedBy: number | null;
  approvedAt: string | null;
  journalEntryId: number | null;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
  lines?: APInvoiceLine[];
  vendor?: { id: number; name: string; taxId?: string; };
}

export interface APInvoiceLine {
  id: number;
  apInvoiceId: number;
  lineNumber: number;
  description: string;
  itemId: number | null;
  glAccountId: number;
  quantity: number;
  unitPrice: number;
  amount: number;
  vatAmount: number;
  isCapitalizable: boolean;
  createdAt: string;
}

export interface CreateAPInvoiceInput {
  invoiceNumber: string;
  vendorId: number;
  purchaseOrderId?: number | null;
  invoiceDate: string;
  dueDate: string;
  receivedDate: string;
  description?: string | null;
  currency?: string;
  exchangeRate?: number;
  lines: {
    description: string;
    itemId?: number | null;
    glAccountId: number;
    quantity: number;
    unitPrice: number;
    isCapitalizable?: boolean;
  }[];
}

/**
 * Generate AP invoice number in format AP-YYYYMM-NNNNNN
 * @param invoiceDate - The date of the invoice
 * @returns Unique invoice number string
 */
export async function generateAPInvoiceNumber(invoiceDate: string | Date): Promise<string> {
  const { apInvoices } = getAccountingTables();
  const database = db();

  const date = typeof invoiceDate === 'string' ? new Date(invoiceDate) : invoiceDate;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const prefix = `AP-${year}${month}-`;

  const result = await database
    .select({ invoiceNumber: apInvoices.invoiceNumber })
    .from(apInvoices)
    .where(sql`${apInvoices.invoiceNumber} LIKE ${prefix + '%'}`)
    .orderBy(desc(apInvoices.invoiceNumber))
    .limit(1);

  let sequence = 1;
  if (result.length > 0 && result[0].invoiceNumber) {
    const lastNumber = result[0].invoiceNumber;
    const lastSequence = parseInt(lastNumber.replace(prefix, ''), 10);
    if (!isNaN(lastSequence)) {
      sequence = lastSequence + 1;
    }
  }

  return `${prefix}${String(sequence).padStart(6, '0')}`;
}

/**
 * Create a new AP invoice manually
 * @param input - Invoice data with lines
 * @param createdBy - User ID creating the invoice
 * @returns Created AP invoice with lines
 */
export async function createAPInvoice(
  input: CreateAPInvoiceInput,
  createdBy: number
): Promise<APInvoice> {
  const { apInvoices, apInvoiceLines } = getAccountingTables();
  const database = db();

  // Calculate line amounts and totals
  const processedLines = input.lines.map((line, index) => {
    const amount = line.quantity * line.unitPrice;
    const vatCalc = calculateVAT(amount);
    return {
      ...line,
      lineNumber: index + 1,
      amount,
      vatAmount: vatCalc.vatAmount,
    };
  });

  const subtotal = processedLines.reduce((sum, line) => sum + line.amount, 0);
  const vatAmount = processedLines.reduce((sum, line) => sum + line.vatAmount, 0);
  const totalAmount = subtotal + vatAmount;

  // Insert invoice
  const invoiceValues = {
    invoiceNumber: input.invoiceNumber,
    vendorId: input.vendorId,
    purchaseOrderId: input.purchaseOrderId || null,
    invoiceDate: toDbDate(input.invoiceDate),
    dueDate: toDbDate(input.dueDate),
    receivedDate: toDbDate(input.receivedDate),
    description: input.description || null,
    subtotal,
    vatAmount,
    whtAmount: 0,
    totalAmount,
    paidAmount: 0,
    currency: input.currency || 'THB',
    exchangeRate: input.exchangeRate || 1,
    status: 'draft' as const,
    createdBy,
    createdAt: getNow(),
    updatedAt: getNow(),
  };

  const insertResult = await database
    .insert(apInvoices)
    .values(invoiceValues as any);

  const apInvoiceId = isSqlite()
    ? (insertResult as unknown as { lastInsertRowid: number }).lastInsertRowid
    : (insertResult as unknown as [{ insertId: number }])[0].insertId;

  // Insert invoice lines
  const lineValues = processedLines.map((line) => ({
    apInvoiceId,
    lineNumber: line.lineNumber,
    description: line.description,
    itemId: line.itemId || null,
    glAccountId: line.glAccountId,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    amount: line.amount,
    vatAmount: line.vatAmount,
    isCapitalizable: line.isCapitalizable || false,
    createdAt: getNow(),
  }));

  await database.insert(apInvoiceLines).values(lineValues as any);

  await createAuditLog({
    action: 'CREATE',
    tableName: 'ap_invoice',
    recordId: apInvoiceId,
    userId: createdBy,
    newValue: {
      invoiceNumber: input.invoiceNumber,
      vendorId: input.vendorId,
      totalAmount,
    },
  });

  return await getAPInvoiceById(apInvoiceId);
}

/**
 * Get AP invoice by ID with lines
 * @param id - AP invoice ID
 * @returns AP invoice with lines
 */
export async function getAPInvoiceById(id: number): Promise<APInvoice> {
  const { apInvoices, apInvoiceLines } = getAccountingTables();
  const database = db();

  const [invoice] = await database
    .select()
    .from(apInvoices)
    .where(eq(apInvoices.id, id));

  if (!invoice) {
    throw new Error(`AP invoice with ID ${id} not found`);
  }

  const lines = await database
    .select()
    .from(apInvoiceLines)
    .where(eq(apInvoiceLines.apInvoiceId, id))
    .orderBy(asc(apInvoiceLines.lineNumber));

  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    vendorId: invoice.vendorId,
    purchaseOrderId: invoice.purchaseOrderId,
    invoiceDate: formatDateFromDb(invoice.invoiceDate),
    dueDate: formatDateFromDb(invoice.dueDate),
    receivedDate: formatDateFromDb(invoice.receivedDate),
    description: invoice.description,
    subtotal: Number(invoice.subtotal),
    vatAmount: Number(invoice.vatAmount),
    whtAmount: Number(invoice.whtAmount),
    totalAmount: Number(invoice.totalAmount),
    paidAmount: Number(invoice.paidAmount),
    currency: invoice.currency,
    exchangeRate: Number(invoice.exchangeRate),
    status: invoice.status as APInvoice['status'],
    approvedBy: invoice.approvedBy,
    approvedAt: invoice.approvedAt ? formatDateFromDb(invoice.approvedAt) : null,
    journalEntryId: invoice.journalEntryId,
    createdBy: invoice.createdBy,
    createdAt: formatDateFromDb(invoice.createdAt),
    updatedAt: formatDateFromDb(invoice.updatedAt),
    lines: lines.map((line: (typeof lines)[number]) => ({
      id: line.id,
      apInvoiceId: line.apInvoiceId,
      lineNumber: line.lineNumber,
      description: line.description,
      itemId: line.itemId,
      glAccountId: line.glAccountId,
      quantity: Number(line.quantity),
      unitPrice: Number(line.unitPrice),
      amount: Number(line.amount),
      vatAmount: Number(line.vatAmount),
      isCapitalizable: Boolean(line.isCapitalizable),
      createdAt: formatDateFromDb(line.createdAt),
    })),
  };
}

/**
 * List AP invoices with optional filters
 * @param filters - Query filters
 * @returns List of AP invoices
 */
export async function listAPInvoices(filters?: {
  vendorId?: number;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}): Promise<APInvoice[]> {
  const { apInvoices } = getAccountingTables();
  const database = db();

  const conditions: any[] = [];

  if (filters?.vendorId) {
    conditions.push(eq(apInvoices.vendorId, filters.vendorId));
  }

  if (filters?.status) {
    conditions.push(eq(apInvoices.status, filters.status));
  }

  if (filters?.dateFrom) {
    conditions.push(gte(apInvoices.invoiceDate, toQueryDate(filters.dateFrom)));
  }

  if (filters?.dateTo) {
    conditions.push(lte(apInvoices.invoiceDate, toQueryDate(filters.dateTo)));
  }

  if (filters?.search) {
    const searchTerm = `%${filters.search}%`;
    conditions.push(
      or(
        sql`${apInvoices.invoiceNumber} LIKE ${searchTerm}`,
        sql`${apInvoices.description} LIKE ${searchTerm}`
      )
    );
  }

  const result = await database
    .select()
    .from(apInvoices)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(apInvoices.invoiceDate));

  return result.map((inv: (typeof result)[number]) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    vendorId: inv.vendorId,
    purchaseOrderId: inv.purchaseOrderId,
    invoiceDate: formatDateFromDb(inv.invoiceDate),
    dueDate: formatDateFromDb(inv.dueDate),
    receivedDate: formatDateFromDb(inv.receivedDate),
    description: inv.description,
    subtotal: Number(inv.subtotal),
    vatAmount: Number(inv.vatAmount),
    whtAmount: Number(inv.whtAmount),
    totalAmount: Number(inv.totalAmount),
    paidAmount: Number(inv.paidAmount),
    currency: inv.currency,
    exchangeRate: Number(inv.exchangeRate),
    status: inv.status as APInvoice['status'],
    approvedBy: inv.approvedBy,
    approvedAt: inv.approvedAt ? formatDateFromDb(inv.approvedAt) : null,
    journalEntryId: inv.journalEntryId,
    createdBy: inv.createdBy,
    createdAt: formatDateFromDb(inv.createdAt),
    updatedAt: formatDateFromDb(inv.updatedAt),
  }));
}

/**
 * Update AP invoice (only draft status)
 * @param id - AP invoice ID
 * @param input - Update data
 * @param updatedBy - User ID making the update
 * @returns Updated AP invoice
 */
export async function updateAPInvoice(
  id: number,
  input: {
    invoiceNumber?: string;
    invoiceDate?: string;
    dueDate?: string;
    description?: string | null;
  },
  updatedBy: number
): Promise<APInvoice> {
  const { apInvoices } = getAccountingTables();
  const database = db();

  const existing = await getAPInvoiceById(id);
  if (existing.status !== 'draft') {
    throw new Error('Can only update draft invoices');
  }

  const updateValues: Record<string, unknown> = {
    updatedAt: getNow(),
  };

  if (input.invoiceNumber !== undefined) updateValues.invoiceNumber = input.invoiceNumber;
  if (input.invoiceDate !== undefined) updateValues.invoiceDate = toDbDate(input.invoiceDate);
  if (input.dueDate !== undefined) updateValues.dueDate = toDbDate(input.dueDate);
  if (input.description !== undefined) updateValues.description = input.description;

  await database
    .update(apInvoices)
    .set(updateValues)
    .where(eq(apInvoices.id, id));

  await createAuditLog({
    action: 'UPDATE',
    tableName: 'ap_invoice',
    recordId: id,
    userId: updatedBy,
    newValue: { invoiceNumber: existing.invoiceNumber, changes: input },
  });

  return await getAPInvoiceById(id);
}

/**
 * Approve AP invoice and create journal entry
 * @param id - AP invoice ID
 * @param approvedBy - User ID approving the invoice
 * @returns Approved AP invoice with journal entry
 */
export async function approveAPInvoice(
  id: number,
  approvedBy: number
): Promise<APInvoice> {
  const { apInvoices, apInvoiceLines, glAccounts } = getAccountingTables();
  const database = db();

  const invoice = await getAPInvoiceById(id);
  if (invoice.status !== 'draft') {
    throw new Error(`Cannot approve invoice with status '${invoice.status}'`);
  }

  if (!invoice.lines || invoice.lines.length === 0) {
    throw new Error('Invoice has no lines');
  }

  // Find AP liability account (code 2111 - Accounts Payable)
  const [apAccount] = await database
    .select({ id: glAccounts.id })
    .from(glAccounts)
    .where(eq(glAccounts.code, '2111'))
    .limit(1);

  if (!apAccount) {
    throw new Error('Accounts Payable GL account (2111) not found');
  }

  // Find Input VAT account (code 1141 - Input VAT Receivable)
  const [vatAccount] = await database
    .select({ id: glAccounts.id })
    .from(glAccounts)
    .where(eq(glAccounts.code, '1141'))
    .limit(1);

  // Build journal entry lines
  const journalLines: JournalLineCreate[] = [];

  // Debit expense/asset accounts from invoice lines
  for (const line of invoice.lines) {
    journalLines.push({
      glAccountId: line.glAccountId,
      debit: line.amount,
      credit: 0,
      description: line.description,
    });
  }

  // Debit Input VAT account if VAT amount exists and account exists
  if (invoice.vatAmount > 0 && vatAccount) {
    journalLines.push({
      glAccountId: vatAccount.id,
      debit: invoice.vatAmount,
      credit: 0,
      description: 'Input VAT',
    });
  }

  // Credit AP account for total amount
  journalLines.push({
    glAccountId: apAccount.id,
    debit: 0,
    credit: invoice.totalAmount,
    description: `AP Invoice ${invoice.invoiceNumber}`,
  });

  // Create and post journal entry
  const journalEntry = await createJournalEntry({
    entryDate: invoice.invoiceDate,
    description: `AP Invoice: ${invoice.invoiceNumber}`,
    sourceType: 'PO_RECEIPT',
    sourceId: invoice.id,
    lines: journalLines,
    createdBy: approvedBy,
  });

  // Post the journal entry
  await postJournalEntry(journalEntry.id, approvedBy);

  // Update invoice status
  await database
    .update(apInvoices)
    .set({
      status: 'posted',
      approvedBy,
      approvedAt: getNow(),
      journalEntryId: journalEntry.id,
      updatedAt: getNow(),
    })
    .where(eq(apInvoices.id, id));

  // Create VAT transaction for Input VAT
  if (invoice.vatAmount > 0) {
    await createVATTransaction({
      transactionType: 'input',
      apInvoiceId: invoice.id,
      vendorId: invoice.vendorId,
      taxInvoiceNumber: invoice.invoiceNumber,
      taxInvoiceDate: invoice.invoiceDate,
      taxableAmount: invoice.subtotal,
      vatAmount: invoice.vatAmount,
    });
  }

  await createAuditLog({
    action: 'APPROVE',
    tableName: 'ap_invoice',
    recordId: id,
    userId: approvedBy,
    newValue: {
      invoiceNumber: invoice.invoiceNumber,
      journalEntryId: journalEntry.id,
      previousStatus: 'draft',
      newStatus: 'posted',
    },
  });

  return await getAPInvoiceById(id);
}

/**
 * Record payment for AP invoice (supports partial payments)
 * @param apInvoiceId - AP invoice ID
 * @param input - Payment data
 * @param recordedBy - User ID recording the payment
 * @returns Payment info and updated invoice
 */
export async function recordAPPayment(
  apInvoiceId: number,
  input: {
    paymentDate: string;
    bankAccountId: number;
    paymentMethod: 'cash' | 'check' | 'transfer' | 'other';
    referenceNumber?: string;
    amount: number;
    whtRate?: number; // WHT percentage if applicable
    description?: string;
  },
  recordedBy: number
): Promise<{ payment: any; invoice: APInvoice }> {
  const { apInvoices, payments, paymentAllocations, glAccounts } = getAccountingTables();
  const database = db();

  const invoice = await getAPInvoiceById(apInvoiceId);

  if (!['posted', 'partial'].includes(invoice.status)) {
    throw new Error(`Cannot record payment for invoice with status '${invoice.status}'`);
  }

  const outstandingAmount = invoice.totalAmount - invoice.paidAmount;
  if (input.amount > outstandingAmount) {
    throw new Error(`Payment amount ${input.amount} exceeds outstanding amount ${outstandingAmount}`);
  }

  // Calculate WHT if applicable
  let whtAmount = 0;
  let netPayment = input.amount;
  if (input.whtRate && input.whtRate > 0) {
    const whtCalc = calculateWHT(input.amount, input.whtRate);
    whtAmount = whtCalc.whtAmount;
    netPayment = whtCalc.netPayment;
  }

  // Generate payment number
  const paymentDate = new Date(input.paymentDate);
  const year = paymentDate.getFullYear();
  const month = String(paymentDate.getMonth() + 1).padStart(2, '0');
  const paymentPrefix = `PY-${year}${month}-`;

  const [lastPayment] = await database
    .select({ paymentNumber: payments.paymentNumber })
    .from(payments)
    .where(sql`${payments.paymentNumber} LIKE ${paymentPrefix + '%'}`)
    .orderBy(desc(payments.paymentNumber))
    .limit(1);

  let sequence = 1;
  if (lastPayment?.paymentNumber) {
    const lastSeq = parseInt(lastPayment.paymentNumber.replace(paymentPrefix, ''), 10);
    if (!isNaN(lastSeq)) sequence = lastSeq + 1;
  }
  const paymentNumber = `${paymentPrefix}${String(sequence).padStart(6, '0')}`;

  // Insert payment record
  const paymentValues = {
    paymentNumber,
    paymentType: 'ap' as const,
    paymentDate: toDbDate(input.paymentDate),
    vendorId: invoice.vendorId,
    customerId: null,
    bankAccountId: input.bankAccountId,
    paymentMethod: input.paymentMethod,
    referenceNumber: input.referenceNumber || null,
    amount: netPayment,
    whtAmount,
    description: input.description || `Payment for ${invoice.invoiceNumber}`,
    status: 'completed' as const,
    createdBy: recordedBy,
    createdAt: getNow(),
    updatedAt: getNow(),
  };

  const insertResult = await database
    .insert(payments)
    .values(paymentValues as any);

  const paymentId = isSqlite()
    ? (insertResult as unknown as { lastInsertRowid: number }).lastInsertRowid
    : (insertResult as unknown as [{ insertId: number }])[0].insertId;

  // Create payment allocation
  await database
    .insert(paymentAllocations)
    .values({
      paymentId,
      apInvoiceId,
      arInvoiceId: null,
      allocatedAmount: input.amount,
      createdAt: getNow(),
    } as any);

  // Find AP account
  const [apAccount] = await database
    .select({ id: glAccounts.id })
    .from(glAccounts)
    .where(eq(glAccounts.code, '2111'))
    .limit(1);

  // Find WHT payable account if WHT applied
  let whtAccountId = null;
  if (whtAmount > 0) {
    const [whtAccount] = await database
      .select({ id: glAccounts.id })
      .from(glAccounts)
      .where(eq(glAccounts.code, '2143')) // WHT Payable
      .limit(1);
    whtAccountId = whtAccount?.id;
  }

  // Create journal entry for payment
  const journalLines: JournalLineCreate[] = [
    // Debit AP (reduce liability)
    {
      glAccountId: apAccount!.id,
      debit: input.amount,
      credit: 0,
      description: `Payment for ${invoice.invoiceNumber}`,
    },
    // Credit Bank (cash out)
    {
      glAccountId: input.bankAccountId,
      debit: 0,
      credit: netPayment,
      description: `Payment to vendor`,
    },
  ];

  // If WHT, credit WHT payable
  if (whtAmount > 0 && whtAccountId) {
    journalLines.push({
      glAccountId: whtAccountId,
      debit: 0,
      credit: whtAmount,
      description: 'Withholding tax',
    });
  }

  const paymentJE = await createJournalEntry({
    entryDate: input.paymentDate,
    description: `Payment: ${paymentNumber} for ${invoice.invoiceNumber}`,
    sourceType: 'AP_PAYMENT',
    sourceId: paymentId,
    lines: journalLines,
    createdBy: recordedBy,
  });

  await postJournalEntry(paymentJE.id, recordedBy);

  // Update payment with journal entry ID
  await database
    .update(payments)
    .set({ journalEntryId: paymentJE.id })
    .where(eq(payments.id, paymentId));

  // Update invoice paid amount and status
  const newPaidAmount = invoice.paidAmount + input.amount;
  const newStatus = newPaidAmount >= invoice.totalAmount ? 'paid' : 'partial';

  await database
    .update(apInvoices)
    .set({
      paidAmount: newPaidAmount,
      whtAmount: invoice.whtAmount + whtAmount,
      status: newStatus,
      updatedAt: getNow(),
    })
    .where(eq(apInvoices.id, apInvoiceId));

  await createAuditLog({
    action: 'CREATE',
    tableName: 'payment',
    recordId: paymentId,
    userId: recordedBy,
    newValue: {
      paymentNumber,
      apInvoiceId,
      amount: input.amount,
      whtAmount,
      netPayment,
    },
  });

  const updatedInvoice = await getAPInvoiceById(apInvoiceId);

  return {
    payment: {
      id: paymentId,
      paymentNumber,
      amount: input.amount,
      whtAmount,
      netPayment,
      journalEntryId: paymentJE.id,
    },
    invoice: updatedInvoice,
  };
}

/**
 * Create VAT transaction record for tax reporting
 * @param input - VAT transaction data
 * @returns Created VAT transaction
 */
export async function createVATTransaction(input: {
  transactionType: 'input' | 'output';
  apInvoiceId?: number | null;
  arInvoiceId?: number | null;
  vendorId?: number | null;
  customerId?: number | null;
  taxInvoiceNumber: string;
  taxInvoiceDate: string;
  taxableAmount: number;
  vatAmount: number;
  partyName?: string;
  partyTaxId?: string;
  branchCode?: string;
}): Promise<{ id: number }> {
  const { vatTransactions } = getAccountingTables();
  const database = db();

  // Determine tax period from invoice date
  const invoiceDate = new Date(input.taxInvoiceDate);
  const taxPeriod = `${invoiceDate.getFullYear()}${String(invoiceDate.getMonth() + 1).padStart(2, '0')}`;

  const vatValues = {
    transactionType: input.transactionType,
    taxInvoiceNumber: input.taxInvoiceNumber,
    taxInvoiceDate: toDbDate(input.taxInvoiceDate),
    taxPeriod,
    vendorId: input.vendorId || null,
    customerId: input.customerId || null,
    partyName: input.partyName || 'Unknown',
    partyTaxId: input.partyTaxId || '0000000000000',
    branchCode: input.branchCode || '00000',
    taxableAmount: input.taxableAmount,
    vatRate: THAI_VAT_RATE * 100, // Store as percentage
    vatAmount: input.vatAmount,
    totalAmount: input.taxableAmount + input.vatAmount,
    apInvoiceId: input.apInvoiceId || null,
    arInvoiceId: input.arInvoiceId || null,
    createdAt: getNow(),
  };

  const insertResult = await database
    .insert(vatTransactions)
    .values(vatValues as any);

  const vatId = isSqlite()
    ? (insertResult as unknown as { lastInsertRowid: number }).lastInsertRowid
    : (insertResult as unknown as [{ insertId: number }])[0].insertId;

  return { id: vatId };
}

/**
 * List journal entries with optional filters
 * @param filters - Query filters
 * @returns List of journal entries
 */
export async function listJournalEntries(filters?: {
  fiscalPeriodId?: number;
  status?: string;
  sourceType?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}): Promise<JournalEntry[]> {
  const { journalEntries } = getAccountingTables();
  const database = db();

  const conditions: any[] = [];

  if (filters?.fiscalPeriodId) {
    conditions.push(eq(journalEntries.fiscalPeriodId, filters.fiscalPeriodId));
  }

  if (filters?.status) {
    conditions.push(eq(journalEntries.status, filters.status));
  }

  if (filters?.sourceType) {
    conditions.push(eq(journalEntries.sourceType, filters.sourceType));
  }

  if (filters?.dateFrom) {
    conditions.push(gte(journalEntries.entryDate, toQueryDate(filters.dateFrom)));
  }

  if (filters?.dateTo) {
    conditions.push(lte(journalEntries.entryDate, toQueryDate(filters.dateTo)));
  }

  if (filters?.search) {
    const searchTerm = `%${filters.search}%`;
    conditions.push(
      or(
        sql`${journalEntries.entryNumber} LIKE ${searchTerm}`,
        sql`${journalEntries.description} LIKE ${searchTerm}`
      )
    );
  }

  const result = await database
    .select()
    .from(journalEntries)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(journalEntries.entryDate), desc(journalEntries.entryNumber));

  return result.map((entry: (typeof result)[number]) => ({
    id: entry.id,
    entryNumber: entry.entryNumber,
    entryDate: formatDateFromDb(entry.entryDate),
    fiscalPeriodId: entry.fiscalPeriodId,
    description: entry.description,
    sourceType: entry.sourceType as JournalSourceType | null,
    sourceId: entry.sourceId,
    status: entry.status as JournalEntryStatus,
    totalDebit: Number(entry.totalDebit),
    totalCredit: Number(entry.totalCredit),
    postedBy: entry.postedBy,
    postedAt: entry.postedAt ? formatDateFromDb(entry.postedAt) : null,
    reversedBy: entry.reversedBy,
    reversedAt: entry.reversedAt ? formatDateFromDb(entry.reversedAt) : null,
    reversalEntryId: entry.reversalEntryId,
    createdBy: entry.createdBy,
    createdAt: formatDateFromDb(entry.createdAt),
    updatedAt: formatDateFromDb(entry.updatedAt),
    lines: [],
  }));
}

// ============================================
// AR Invoice Service Functions (User Story 3)
// ============================================

export interface ARInvoice {
  id: number;
  invoiceNumber: string;
  taxInvoiceNumber: string;
  customerId: number;
  salesOrderId: number | null;
  invoiceDate: string;
  dueDate: string;
  description: string | null;
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  paidAmount: number;
  currency: string;
  exchangeRate: number;
  status: 'draft' | 'confirmed' | 'posted' | 'partial' | 'paid' | 'cancelled';
  confirmedBy: number | null;
  confirmedAt: string | null;
  journalEntryId: number | null;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
  lines?: ARInvoiceLine[];
  customer?: { id: number; name: string; taxId?: string; };
}

export interface ARInvoiceLine {
  id: number;
  arInvoiceId: number;
  lineNumber: number;
  description: string;
  itemId: number | null;
  glAccountId: number;
  quantity: number;
  unitPrice: number;
  amount: number;
  vatAmount: number;
  lotId: number | null;
  createdAt: string;
}

export interface CreateARInvoiceInput {
  invoiceNumber: string;
  taxInvoiceNumber: string;
  customerId: number;
  salesOrderId?: number | null;
  invoiceDate: string;
  dueDate: string;
  description?: string | null;
  currency?: string;
  exchangeRate?: number;
  lines: {
    description: string;
    itemId?: number | null;
    glAccountId: number;
    quantity: number;
    unitPrice: number;
    lotId?: number | null;
  }[];
}

/**
 * Generate Thai Tax Invoice Number in format T-YYYYMM-NNNNNN
 * @param invoiceDate - The date of the invoice
 * @returns Unique tax invoice number string
 */
export async function generateTaxInvoiceNumber(invoiceDate: string | Date): Promise<string> {
  const { arInvoices } = getAccountingTables();
  const database = db();

  const date = typeof invoiceDate === 'string' ? new Date(invoiceDate) : invoiceDate;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const prefix = `T-${year}${month}-`;

  const result = await database
    .select({ taxInvoiceNumber: arInvoices.taxInvoiceNumber })
    .from(arInvoices)
    .where(sql`${arInvoices.taxInvoiceNumber} LIKE ${prefix + '%'}`)
    .orderBy(desc(arInvoices.taxInvoiceNumber))
    .limit(1);

  let sequence = 1;
  if (result.length > 0 && result[0].taxInvoiceNumber) {
    const lastNumber = result[0].taxInvoiceNumber;
    const lastSequence = parseInt(lastNumber.replace(prefix, ''), 10);
    if (!isNaN(lastSequence)) {
      sequence = lastSequence + 1;
    }
  }

  return `${prefix}${String(sequence).padStart(6, '0')}`;
}

/**
 * Generate AR invoice number in format AR-YYYYMM-NNNNNN
 * @param invoiceDate - The date of the invoice
 * @returns Unique invoice number string
 */
export async function generateARInvoiceNumber(invoiceDate: string | Date): Promise<string> {
  const { arInvoices } = getAccountingTables();
  const database = db();

  const date = typeof invoiceDate === 'string' ? new Date(invoiceDate) : invoiceDate;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const prefix = `AR-${year}${month}-`;

  const result = await database
    .select({ invoiceNumber: arInvoices.invoiceNumber })
    .from(arInvoices)
    .where(sql`${arInvoices.invoiceNumber} LIKE ${prefix + '%'}`)
    .orderBy(desc(arInvoices.invoiceNumber))
    .limit(1);

  let sequence = 1;
  if (result.length > 0 && result[0].invoiceNumber) {
    const lastNumber = result[0].invoiceNumber;
    const lastSequence = parseInt(lastNumber.replace(prefix, ''), 10);
    if (!isNaN(lastSequence)) {
      sequence = lastSequence + 1;
    }
  }

  return `${prefix}${String(sequence).padStart(6, '0')}`;
}

/**
 * Create a new AR invoice manually
 * @param input - Invoice data with lines
 * @param createdBy - User ID creating the invoice
 * @returns Created AR invoice with lines
 */
export async function createARInvoice(
  input: CreateARInvoiceInput,
  createdBy: number
): Promise<ARInvoice> {
  const { arInvoices, arInvoiceLines } = getAccountingTables();
  const database = db();

  // Calculate line amounts and totals
  const processedLines = input.lines.map((line, index) => {
    const amount = line.quantity * line.unitPrice;
    const vatCalc = calculateVAT(amount);
    return {
      ...line,
      lineNumber: index + 1,
      amount,
      vatAmount: vatCalc.vatAmount,
    };
  });

  const subtotal = processedLines.reduce((sum, line) => sum + line.amount, 0);
  const vatAmount = processedLines.reduce((sum, line) => sum + line.vatAmount, 0);
  const totalAmount = subtotal + vatAmount;

  // Insert invoice
  const invoiceValues = {
    invoiceNumber: input.invoiceNumber,
    taxInvoiceNumber: input.taxInvoiceNumber,
    customerId: input.customerId,
    salesOrderId: input.salesOrderId || null,
    invoiceDate: toDbDate(input.invoiceDate),
    dueDate: toDbDate(input.dueDate),
    description: input.description || null,
    subtotal,
    vatAmount,
    totalAmount,
    paidAmount: 0,
    currency: input.currency || 'THB',
    exchangeRate: input.exchangeRate || 1,
    status: 'draft' as const,
    createdBy,
    createdAt: getNow(),
    updatedAt: getNow(),
  };

  const insertResult = await database
    .insert(arInvoices)
    .values(invoiceValues as any);

  const arInvoiceId = isSqlite()
    ? (insertResult as unknown as { lastInsertRowid: number }).lastInsertRowid
    : (insertResult as unknown as [{ insertId: number }])[0].insertId;

  // Insert invoice lines
  const lineValues = processedLines.map((line) => ({
    arInvoiceId,
    lineNumber: line.lineNumber,
    description: line.description,
    itemId: line.itemId || null,
    glAccountId: line.glAccountId,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    amount: line.amount,
    vatAmount: line.vatAmount,
    lotId: line.lotId || null,
    createdAt: getNow(),
  }));

  await database.insert(arInvoiceLines).values(lineValues as any);

  await createAuditLog({
    action: 'CREATE',
    tableName: 'ar_invoice',
    recordId: arInvoiceId,
    userId: createdBy,
    newValue: {
      invoiceNumber: input.invoiceNumber,
      taxInvoiceNumber: input.taxInvoiceNumber,
      customerId: input.customerId,
      totalAmount,
    },
  });

  return await getARInvoiceById(arInvoiceId);
}

/**
 * Get AR invoice by ID with lines
 * @param id - AR invoice ID
 * @returns AR invoice with lines
 */
export async function getARInvoiceById(id: number): Promise<ARInvoice> {
  const { arInvoices, arInvoiceLines } = getAccountingTables();
  const database = db();

  const [invoice] = await database
    .select()
    .from(arInvoices)
    .where(eq(arInvoices.id, id));

  if (!invoice) {
    throw new Error(`AR invoice with ID ${id} not found`);
  }

  const lines = await database
    .select()
    .from(arInvoiceLines)
    .where(eq(arInvoiceLines.arInvoiceId, id))
    .orderBy(asc(arInvoiceLines.lineNumber));

  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    taxInvoiceNumber: invoice.taxInvoiceNumber,
    customerId: invoice.customerId,
    salesOrderId: invoice.salesOrderId,
    invoiceDate: formatDateFromDb(invoice.invoiceDate),
    dueDate: formatDateFromDb(invoice.dueDate),
    description: invoice.description,
    subtotal: Number(invoice.subtotal),
    vatAmount: Number(invoice.vatAmount),
    totalAmount: Number(invoice.totalAmount),
    paidAmount: Number(invoice.paidAmount),
    currency: invoice.currency,
    exchangeRate: Number(invoice.exchangeRate),
    status: invoice.status as ARInvoice['status'],
    confirmedBy: invoice.confirmedBy,
    confirmedAt: invoice.confirmedAt ? formatDateFromDb(invoice.confirmedAt) : null,
    journalEntryId: invoice.journalEntryId,
    createdBy: invoice.createdBy,
    createdAt: formatDateFromDb(invoice.createdAt),
    updatedAt: formatDateFromDb(invoice.updatedAt),
    lines: lines.map((line: (typeof lines)[number]) => ({
      id: line.id,
      arInvoiceId: line.arInvoiceId,
      lineNumber: line.lineNumber,
      description: line.description,
      itemId: line.itemId,
      glAccountId: line.glAccountId,
      quantity: Number(line.quantity),
      unitPrice: Number(line.unitPrice),
      amount: Number(line.amount),
      vatAmount: Number(line.vatAmount),
      lotId: line.lotId,
      createdAt: formatDateFromDb(line.createdAt),
    })),
  };
}

/**
 * List AR invoices with optional filters
 * @param filters - Query filters
 * @returns List of AR invoices
 */
export async function listARInvoices(filters?: {
  customerId?: number;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}): Promise<ARInvoice[]> {
  const { arInvoices } = getAccountingTables();
  const database = db();

  const conditions: any[] = [];

  if (filters?.customerId) {
    conditions.push(eq(arInvoices.customerId, filters.customerId));
  }

  if (filters?.status) {
    conditions.push(eq(arInvoices.status, filters.status));
  }

  if (filters?.dateFrom) {
    conditions.push(gte(arInvoices.invoiceDate, toQueryDate(filters.dateFrom)));
  }

  if (filters?.dateTo) {
    conditions.push(lte(arInvoices.invoiceDate, toQueryDate(filters.dateTo)));
  }

  if (filters?.search) {
    const searchTerm = `%${filters.search}%`;
    conditions.push(
      or(
        sql`${arInvoices.invoiceNumber} LIKE ${searchTerm}`,
        sql`${arInvoices.taxInvoiceNumber} LIKE ${searchTerm}`,
        sql`${arInvoices.description} LIKE ${searchTerm}`
      )
    );
  }

  const result = await database
    .select()
    .from(arInvoices)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(arInvoices.invoiceDate));

  return result.map((inv: (typeof result)[number]) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    taxInvoiceNumber: inv.taxInvoiceNumber,
    customerId: inv.customerId,
    salesOrderId: inv.salesOrderId,
    invoiceDate: formatDateFromDb(inv.invoiceDate),
    dueDate: formatDateFromDb(inv.dueDate),
    description: inv.description,
    subtotal: Number(inv.subtotal),
    vatAmount: Number(inv.vatAmount),
    totalAmount: Number(inv.totalAmount),
    paidAmount: Number(inv.paidAmount),
    currency: inv.currency,
    exchangeRate: Number(inv.exchangeRate),
    status: inv.status as ARInvoice['status'],
    confirmedBy: inv.confirmedBy,
    confirmedAt: inv.confirmedAt ? formatDateFromDb(inv.confirmedAt) : null,
    journalEntryId: inv.journalEntryId,
    createdBy: inv.createdBy,
    createdAt: formatDateFromDb(inv.createdAt),
    updatedAt: formatDateFromDb(inv.updatedAt),
  }));
}

/**
 * Update AR invoice (only draft status)
 * @param id - AR invoice ID
 * @param input - Update data
 * @param updatedBy - User ID making the update
 * @returns Updated AR invoice
 */
export async function updateARInvoice(
  id: number,
  input: {
    invoiceNumber?: string;
    taxInvoiceNumber?: string;
    invoiceDate?: string;
    dueDate?: string;
    description?: string | null;
  },
  updatedBy: number
): Promise<ARInvoice> {
  const { arInvoices } = getAccountingTables();
  const database = db();

  const existing = await getARInvoiceById(id);
  if (existing.status !== 'draft') {
    throw new Error('Can only update draft invoices');
  }

  const updateValues: Record<string, unknown> = {
    updatedAt: getNow(),
  };

  if (input.invoiceNumber !== undefined) updateValues.invoiceNumber = input.invoiceNumber;
  if (input.taxInvoiceNumber !== undefined) updateValues.taxInvoiceNumber = input.taxInvoiceNumber;
  if (input.invoiceDate !== undefined) updateValues.invoiceDate = toDbDate(input.invoiceDate);
  if (input.dueDate !== undefined) updateValues.dueDate = toDbDate(input.dueDate);
  if (input.description !== undefined) updateValues.description = input.description;

  await database
    .update(arInvoices)
    .set(updateValues)
    .where(eq(arInvoices.id, id));

  await createAuditLog({
    action: 'UPDATE',
    tableName: 'ar_invoice',
    recordId: id,
    userId: updatedBy,
    newValue: { invoiceNumber: existing.invoiceNumber, changes: input },
  });

  return await getARInvoiceById(id);
}

/**
 * Confirm AR invoice and create journal entry
 * @param id - AR invoice ID
 * @param confirmedBy - User ID confirming the invoice
 * @returns Confirmed AR invoice with journal entry
 */
export async function confirmARInvoice(
  id: number,
  confirmedBy: number
): Promise<ARInvoice> {
  const { arInvoices, glAccounts } = getAccountingTables();
  const database = db();

  const invoice = await getARInvoiceById(id);
  if (invoice.status !== 'draft') {
    throw new Error(`Cannot confirm invoice with status '${invoice.status}'`);
  }

  if (!invoice.lines || invoice.lines.length === 0) {
    throw new Error('Invoice has no lines');
  }

  // Find AR receivable account (code 1121 - Accounts Receivable)
  const [arAccount] = await database
    .select({ id: glAccounts.id })
    .from(glAccounts)
    .where(eq(glAccounts.code, '1121'))
    .limit(1);

  if (!arAccount) {
    throw new Error('Accounts Receivable GL account (1121) not found');
  }

  // Find Output VAT account (code 2131 - Output VAT Payable)
  const [vatAccount] = await database
    .select({ id: glAccounts.id })
    .from(glAccounts)
    .where(eq(glAccounts.code, '2131'))
    .limit(1);

  // Build journal entry lines
  const journalLines: JournalLineCreate[] = [];

  // Debit AR account for total amount
  journalLines.push({
    glAccountId: arAccount.id,
    debit: invoice.totalAmount,
    credit: 0,
    description: `AR Invoice ${invoice.invoiceNumber}`,
  });

  // Credit revenue accounts from invoice lines
  for (const line of invoice.lines) {
    journalLines.push({
      glAccountId: line.glAccountId,
      debit: 0,
      credit: line.amount,
      description: line.description,
    });
  }

  // Credit Output VAT account if VAT amount exists and account exists
  if (invoice.vatAmount > 0 && vatAccount) {
    journalLines.push({
      glAccountId: vatAccount.id,
      debit: 0,
      credit: invoice.vatAmount,
      description: 'Output VAT',
    });
  }

  // Create and post journal entry
  const journalEntry = await createJournalEntry({
    entryDate: invoice.invoiceDate,
    description: `AR Invoice: ${invoice.invoiceNumber}`,
    sourceType: 'SO_SHIPMENT',
    sourceId: invoice.id,
    lines: journalLines,
    createdBy: confirmedBy,
  });

  // Post the journal entry
  await postJournalEntry(journalEntry.id, confirmedBy);

  // Update invoice status
  await database
    .update(arInvoices)
    .set({
      status: 'posted',
      confirmedBy,
      confirmedAt: getNow(),
      journalEntryId: journalEntry.id,
      updatedAt: getNow(),
    })
    .where(eq(arInvoices.id, id));

  // Create VAT transaction for Output VAT
  if (invoice.vatAmount > 0) {
    await createVATTransaction({
      transactionType: 'output',
      arInvoiceId: invoice.id,
      customerId: invoice.customerId,
      taxInvoiceNumber: invoice.taxInvoiceNumber,
      taxInvoiceDate: invoice.invoiceDate,
      taxableAmount: invoice.subtotal,
      vatAmount: invoice.vatAmount,
    });
  }

  await createAuditLog({
    action: 'CONFIRM',
    tableName: 'ar_invoice',
    recordId: id,
    userId: confirmedBy,
    newValue: {
      invoiceNumber: invoice.invoiceNumber,
      journalEntryId: journalEntry.id,
      previousStatus: 'draft',
      newStatus: 'posted',
    },
  });

  return await getARInvoiceById(id);
}

/**
 * Record payment received for AR invoice (supports partial payments)
 * @param arInvoiceId - AR invoice ID
 * @param input - Payment data
 * @param recordedBy - User ID recording the payment
 * @returns Payment info and updated invoice
 */
export async function recordARPayment(
  arInvoiceId: number,
  input: {
    paymentDate: string;
    bankAccountId: number;
    paymentMethod: 'cash' | 'check' | 'transfer' | 'other';
    referenceNumber?: string;
    amount: number;
    description?: string;
  },
  recordedBy: number
): Promise<{ payment: any; invoice: ARInvoice }> {
  const { arInvoices, payments, paymentAllocations, glAccounts } = getAccountingTables();
  const database = db();

  const invoice = await getARInvoiceById(arInvoiceId);

  if (!['posted', 'partial'].includes(invoice.status)) {
    throw new Error(`Cannot record payment for invoice with status '${invoice.status}'`);
  }

  const outstandingAmount = invoice.totalAmount - invoice.paidAmount;
  if (input.amount > outstandingAmount) {
    throw new Error(`Payment amount ${input.amount} exceeds outstanding amount ${outstandingAmount}`);
  }

  // Generate receipt/payment number
  const paymentDate = new Date(input.paymentDate);
  const year = paymentDate.getFullYear();
  const month = String(paymentDate.getMonth() + 1).padStart(2, '0');
  const paymentPrefix = `RC-${year}${month}-`;

  const [lastPayment] = await database
    .select({ paymentNumber: payments.paymentNumber })
    .from(payments)
    .where(sql`${payments.paymentNumber} LIKE ${paymentPrefix + '%'}`)
    .orderBy(desc(payments.paymentNumber))
    .limit(1);

  let sequence = 1;
  if (lastPayment?.paymentNumber) {
    const lastSeq = parseInt(lastPayment.paymentNumber.replace(paymentPrefix, ''), 10);
    if (!isNaN(lastSeq)) sequence = lastSeq + 1;
  }
  const paymentNumber = `${paymentPrefix}${String(sequence).padStart(6, '0')}`;

  // Insert payment record
  const paymentValues = {
    paymentNumber,
    paymentType: 'ar' as const,
    paymentDate: toDbDate(input.paymentDate),
    vendorId: null,
    customerId: invoice.customerId,
    bankAccountId: input.bankAccountId,
    paymentMethod: input.paymentMethod,
    referenceNumber: input.referenceNumber || null,
    amount: input.amount,
    whtAmount: 0,
    description: input.description || `Receipt for ${invoice.invoiceNumber}`,
    status: 'completed' as const,
    createdBy: recordedBy,
    createdAt: getNow(),
    updatedAt: getNow(),
  };

  const insertResult = await database
    .insert(payments)
    .values(paymentValues as any);

  const paymentId = isSqlite()
    ? (insertResult as unknown as { lastInsertRowid: number }).lastInsertRowid
    : (insertResult as unknown as [{ insertId: number }])[0].insertId;

  // Create payment allocation
  await database
    .insert(paymentAllocations)
    .values({
      paymentId,
      apInvoiceId: null,
      arInvoiceId,
      allocatedAmount: input.amount,
      createdAt: getNow(),
    } as any);

  // Find AR account
  const [arAccount] = await database
    .select({ id: glAccounts.id })
    .from(glAccounts)
    .where(eq(glAccounts.code, '1121'))
    .limit(1);

  // Create journal entry for receipt
  const journalLines: JournalLineCreate[] = [
    // Debit Bank (cash in)
    {
      glAccountId: input.bankAccountId,
      debit: input.amount,
      credit: 0,
      description: `Receipt from customer`,
    },
    // Credit AR (reduce receivable)
    {
      glAccountId: arAccount!.id,
      debit: 0,
      credit: input.amount,
      description: `Receipt for ${invoice.invoiceNumber}`,
    },
  ];

  const receiptJE = await createJournalEntry({
    entryDate: input.paymentDate,
    description: `Receipt: ${paymentNumber} for ${invoice.invoiceNumber}`,
    sourceType: 'AR_RECEIPT',
    sourceId: paymentId,
    lines: journalLines,
    createdBy: recordedBy,
  });

  await postJournalEntry(receiptJE.id, recordedBy);

  // Update payment with journal entry ID
  await database
    .update(payments)
    .set({ journalEntryId: receiptJE.id })
    .where(eq(payments.id, paymentId));

  // Update invoice paid amount and status
  const newPaidAmount = invoice.paidAmount + input.amount;
  const newStatus = newPaidAmount >= invoice.totalAmount ? 'paid' : 'partial';

  await database
    .update(arInvoices)
    .set({
      paidAmount: newPaidAmount,
      status: newStatus,
      updatedAt: getNow(),
    })
    .where(eq(arInvoices.id, arInvoiceId));

  await createAuditLog({
    action: 'CREATE',
    tableName: 'payment',
    recordId: paymentId,
    userId: recordedBy,
    newValue: {
      paymentNumber,
      arInvoiceId,
      amount: input.amount,
      type: 'receipt',
    },
  });

  const updatedInvoice = await getARInvoiceById(arInvoiceId);

  return {
    payment: {
      id: paymentId,
      paymentNumber,
      amount: input.amount,
      journalEntryId: receiptJE.id,
    },
    invoice: updatedInvoice,
  };
}

// ============================================
// User Story 4: Manufacturing Cost Accounting
// ============================================

/**
 * Material cost allocation input
 */
export interface MaterialCostInput {
  workOrderId: number;
  batchNumber: string;
  materialItemId: number;
  lotId?: number;
  quantity: number;
  unitCost: number;
  issueDate: string;
  description?: string;
}

/**
 * Labor cost allocation input
 */
export interface LaborCostInput {
  workOrderId: number;
  batchNumber: string;
  laborHours: number;
  hourlyRate: number;
  allocationDate: string;
  description?: string;
  costCenterId?: number;
}

/**
 * Overhead allocation input
 */
export interface OverheadAllocationInput {
  workOrderId: number;
  batchNumber: string;
  overheadType: 'fixed' | 'variable' | 'mixed';
  allocationBasis: 'labor_hours' | 'machine_hours' | 'units' | 'direct_labor_cost';
  basisAmount: number;
  overheadRate: number;
  allocationDate: string;
  description?: string;
}

/**
 * Transfer to finished goods input
 */
export interface TransferToFGInput {
  workOrderId: number;
  batchNumber: string;
  finishedGoodsItemId: number;
  quantity: number;
  lotNumber: string;
  transferDate: string;
  description?: string;
}

/**
 * Batch cost breakdown result
 */
export interface BatchCostBreakdown {
  workOrderId: number;
  batchNumber: string;
  materialCost: number;
  laborCost: number;
  overheadCost: number;
  totalCost: number;
  unitCost: number;
  producedQuantity: number;
  status: 'in_progress' | 'completed';
  journalEntries: {
    id: number;
    entryNumber: string;
    entryDate: string;
    description: string;
    amount: number;
    type: 'material' | 'labor' | 'overhead' | 'transfer';
  }[];
}

/**
 * Record material cost - Debit WIP, Credit Raw Materials
 * When raw materials are issued to production
 * @param input - Material cost details
 * @param recordedBy - User ID who recorded
 * @returns Journal entry created
 */
export async function recordMaterialCost(
  input: MaterialCostInput,
  recordedBy: number
): Promise<{ journalEntry: JournalEntry; totalCost: number }> {
  const { glAccounts } = getAccountingTables();
  const database = db();

  const totalCost = input.quantity * input.unitCost;

  // Find WIP and Raw Materials accounts
  const [wipAccount] = await database
    .select({ id: glAccounts.id })
    .from(glAccounts)
    .where(eq(glAccounts.code, '1132')) // WIP account
    .limit(1);

  const [rawMaterialAccount] = await database
    .select({ id: glAccounts.id })
    .from(glAccounts)
    .where(eq(glAccounts.code, '1131')) // Raw Materials
    .limit(1);

  if (!wipAccount || !rawMaterialAccount) {
    throw new Error('WIP or Raw Materials account not found');
  }

  const journalLines: JournalLineCreate[] = [
    // Debit WIP (increase WIP inventory)
    {
      glAccountId: wipAccount.id,
      debit: totalCost,
      credit: 0,
      description: `Material issue: ${input.description || `Item ${input.materialItemId}`}`,
    },
    // Credit Raw Materials (reduce raw material inventory)
    {
      glAccountId: rawMaterialAccount.id,
      debit: 0,
      credit: totalCost,
      description: `Material issue: ${input.description || `Item ${input.materialItemId}`}`,
    },
  ];

  const journalEntry = await createJournalEntry({
    entryDate: input.issueDate,
    description: `Material cost for WO ${input.workOrderId} Batch ${input.batchNumber}`,
    sourceType: 'COST_ALLOCATION',
    sourceId: input.workOrderId,
    lines: journalLines,
    createdBy: recordedBy,
  });

  await postJournalEntry(journalEntry.id, recordedBy);

  await createAuditLog({
    action: 'CREATE',
    tableName: 'cost_allocation',
    recordId: journalEntry.id,
    userId: recordedBy,
    newValue: {
      type: 'material',
      workOrderId: input.workOrderId,
      batchNumber: input.batchNumber,
      totalCost,
    },
  });

  return {
    journalEntry,
    totalCost,
  };
}

/**
 * Allocate labor cost - Debit WIP, Credit Manufacturing Labor (or Wages Payable)
 * When labor hours are recorded for a production batch
 * @param input - Labor cost details
 * @param recordedBy - User ID who recorded
 * @returns Journal entry created
 */
export async function allocateLaborCost(
  input: LaborCostInput,
  recordedBy: number
): Promise<{ journalEntry: JournalEntry; totalCost: number }> {
  const { glAccounts } = getAccountingTables();
  const database = db();

  const totalCost = input.laborHours * input.hourlyRate;

  // Find WIP and Manufacturing Labor accounts
  const [wipAccount] = await database
    .select({ id: glAccounts.id })
    .from(glAccounts)
    .where(eq(glAccounts.code, '1132')) // WIP account
    .limit(1);

  const [laborAccount] = await database
    .select({ id: glAccounts.id })
    .from(glAccounts)
    .where(eq(glAccounts.code, '5210')) // Manufacturing Labor
    .limit(1);

  if (!wipAccount || !laborAccount) {
    throw new Error('WIP or Manufacturing Labor account not found');
  }

  const journalLines: JournalLineCreate[] = [
    // Debit WIP (increase WIP for labor absorbed)
    {
      glAccountId: wipAccount.id,
      debit: totalCost,
      credit: 0,
      description: `Labor: ${input.laborHours} hrs @ ${input.hourlyRate}/hr`,
    },
    // Credit Manufacturing Labor (labor applied)
    {
      glAccountId: laborAccount.id,
      debit: 0,
      credit: totalCost,
      description: `Labor: ${input.laborHours} hrs @ ${input.hourlyRate}/hr`,
    },
  ];

  const journalEntry = await createJournalEntry({
    entryDate: input.allocationDate,
    description: `Labor cost for WO ${input.workOrderId} Batch ${input.batchNumber}`,
    sourceType: 'COST_ALLOCATION',
    sourceId: input.workOrderId,
    lines: journalLines,
    createdBy: recordedBy,
  });

  await postJournalEntry(journalEntry.id, recordedBy);

  await createAuditLog({
    action: 'CREATE',
    tableName: 'cost_allocation',
    recordId: journalEntry.id,
    userId: recordedBy,
    newValue: {
      type: 'labor',
      workOrderId: input.workOrderId,
      batchNumber: input.batchNumber,
      laborHours: input.laborHours,
      totalCost,
    },
  });

  return {
    journalEntry,
    totalCost,
  };
}

/**
 * Allocate overhead cost - Debit WIP, Credit Manufacturing Overhead
 * Applies overhead based on configured allocation basis
 * @param input - Overhead allocation details
 * @param recordedBy - User ID who recorded
 * @returns Journal entry created
 */
export async function allocateOverhead(
  input: OverheadAllocationInput,
  recordedBy: number
): Promise<{ journalEntry: JournalEntry; totalCost: number }> {
  const { glAccounts } = getAccountingTables();
  const database = db();

  const totalCost = input.basisAmount * input.overheadRate;

  // Find WIP and Manufacturing Overhead accounts
  const [wipAccount] = await database
    .select({ id: glAccounts.id })
    .from(glAccounts)
    .where(eq(glAccounts.code, '1132')) // WIP account
    .limit(1);

  const [overheadAccount] = await database
    .select({ id: glAccounts.id })
    .from(glAccounts)
    .where(eq(glAccounts.code, '5220')) // Manufacturing Overhead
    .limit(1);

  if (!wipAccount || !overheadAccount) {
    throw new Error('WIP or Manufacturing Overhead account not found');
  }

  const basisLabel = {
    labor_hours: 'labor hours',
    machine_hours: 'machine hours',
    units: 'units',
    direct_labor_cost: 'direct labor cost',
  }[input.allocationBasis];

  const journalLines: JournalLineCreate[] = [
    // Debit WIP (increase WIP for overhead absorbed)
    {
      glAccountId: wipAccount.id,
      debit: totalCost,
      credit: 0,
      description: `Overhead: ${input.basisAmount} ${basisLabel} @ ${input.overheadRate}`,
    },
    // Credit Manufacturing Overhead (overhead applied)
    {
      glAccountId: overheadAccount.id,
      debit: 0,
      credit: totalCost,
      description: `Overhead: ${input.basisAmount} ${basisLabel} @ ${input.overheadRate}`,
    },
  ];

  const journalEntry = await createJournalEntry({
    entryDate: input.allocationDate,
    description: `Overhead (${input.overheadType}) for WO ${input.workOrderId} Batch ${input.batchNumber}`,
    sourceType: 'COST_ALLOCATION',
    sourceId: input.workOrderId,
    lines: journalLines,
    createdBy: recordedBy,
  });

  await postJournalEntry(journalEntry.id, recordedBy);

  await createAuditLog({
    action: 'CREATE',
    tableName: 'cost_allocation',
    recordId: journalEntry.id,
    userId: recordedBy,
    newValue: {
      type: 'overhead',
      workOrderId: input.workOrderId,
      batchNumber: input.batchNumber,
      overheadType: input.overheadType,
      allocationBasis: input.allocationBasis,
      totalCost,
    },
  });

  return {
    journalEntry,
    totalCost,
  };
}

/**
 * Transfer to Finished Goods - Debit FG Inventory, Credit WIP
 * When production is completed and goods are transferred
 * @param input - Transfer details
 * @param recordedBy - User ID who recorded
 * @returns Journal entry created with total cost transferred
 */
export async function transferToFinishedGoods(
  input: TransferToFGInput,
  recordedBy: number
): Promise<{ journalEntry: JournalEntry; totalCost: number; unitCost: number }> {
  const { glAccounts, journalEntries, journalLines } = getAccountingTables();
  const database = db();

  // Calculate total WIP cost for this work order by summing all journal entries
  const costEntries = await database
    .select({
      totalDebit: journalEntries.totalDebit,
    })
    .from(journalEntries)
    .where(
      and(
        eq(journalEntries.sourceType, 'COST_ALLOCATION'),
        eq(journalEntries.sourceId, input.workOrderId),
        eq(journalEntries.status, 'posted')
      )
    );

  const totalCost = costEntries.reduce((sum, entry) => sum + (entry.totalDebit || 0), 0);

  // Also need to calculate from WIP debit lines for accuracy
  const wipAccountResult = await database
    .select({ id: glAccounts.id })
    .from(glAccounts)
    .where(eq(glAccounts.code, '1132'))
    .limit(1);

  let wipTotalCost = totalCost;
  if (wipAccountResult.length > 0) {
    const wipLines = await database
      .select({
        debit: journalLines.debit,
      })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
      .where(
        and(
          eq(journalLines.glAccountId, wipAccountResult[0].id),
          eq(journalEntries.sourceType, 'COST_ALLOCATION'),
          eq(journalEntries.sourceId, input.workOrderId),
          eq(journalEntries.status, 'posted')
        )
      );

    const totalWipDebit = wipLines.reduce((sum, line) => sum + (line.debit || 0), 0);
    if (totalWipDebit > 0) {
      wipTotalCost = totalWipDebit;
    }
  }

  const unitCost = input.quantity > 0 ? wipTotalCost / input.quantity : 0;

  // Find FG and WIP accounts
  const [fgAccount] = await database
    .select({ id: glAccounts.id })
    .from(glAccounts)
    .where(eq(glAccounts.code, '1133')) // Finished Goods
    .limit(1);

  const [wipAccount] = await database
    .select({ id: glAccounts.id })
    .from(glAccounts)
    .where(eq(glAccounts.code, '1132')) // WIP
    .limit(1);

  if (!fgAccount || !wipAccount) {
    throw new Error('Finished Goods or WIP account not found');
  }

  const journalLinesList: JournalLineCreate[] = [
    // Debit Finished Goods (increase FG inventory)
    {
      glAccountId: fgAccount.id,
      debit: wipTotalCost,
      credit: 0,
      description: `Transfer ${input.quantity} units to FG - Lot ${input.lotNumber}`,
    },
    // Credit WIP (reduce WIP)
    {
      glAccountId: wipAccount.id,
      debit: 0,
      credit: wipTotalCost,
      description: `Transfer ${input.quantity} units to FG - Lot ${input.lotNumber}`,
    },
  ];

  const journalEntry = await createJournalEntry({
    entryDate: input.transferDate,
    description: `FG Transfer for WO ${input.workOrderId} Batch ${input.batchNumber} - ${input.quantity} units`,
    sourceType: 'COST_ALLOCATION',
    sourceId: input.workOrderId,
    lines: journalLinesList,
    createdBy: recordedBy,
  });

  await postJournalEntry(journalEntry.id, recordedBy);

  await createAuditLog({
    action: 'CREATE',
    tableName: 'cost_allocation',
    recordId: journalEntry.id,
    userId: recordedBy,
    newValue: {
      type: 'transfer_fg',
      workOrderId: input.workOrderId,
      batchNumber: input.batchNumber,
      quantity: input.quantity,
      totalCost: wipTotalCost,
      unitCost,
    },
  });

  return {
    journalEntry,
    totalCost: wipTotalCost,
    unitCost,
  };
}

/**
 * Get batch cost breakdown
 * Retrieves all costs associated with a work order/batch
 * @param workOrderId - Work order ID
 * @returns Cost breakdown with material, labor, overhead details
 */
export async function getBatchCostBreakdown(
  workOrderId: number
): Promise<BatchCostBreakdown> {
  const { journalEntries, journalLines, glAccounts, workOrders } = getAccountingTables();
  const database = db();

  // Get work order details
  const [workOrder] = await database
    .select({
      id: workOrders.id,
      batchNumber: workOrders.batchNumber,
      status: workOrders.status,
      actualQuantity: workOrders.actualQuantity,
      plannedQuantity: workOrders.plannedQuantity,
    })
    .from(workOrders)
    .where(eq(workOrders.id, workOrderId))
    .limit(1);

  if (!workOrder) {
    throw new Error(`Work order ${workOrderId} not found`);
  }

  // Get all cost allocation journal entries for this work order
  const entries = await database
    .select({
      id: journalEntries.id,
      entryNumber: journalEntries.entryNumber,
      entryDate: journalEntries.entryDate,
      description: journalEntries.description,
      totalDebit: journalEntries.totalDebit,
    })
    .from(journalEntries)
    .where(
      and(
        eq(journalEntries.sourceType, 'COST_ALLOCATION'),
        eq(journalEntries.sourceId, workOrderId),
        eq(journalEntries.status, 'posted')
      )
    )
    .orderBy(journalEntries.entryDate);

  // Get WIP account
  const [wipAccount] = await database
    .select({ id: glAccounts.id })
    .from(glAccounts)
    .where(eq(glAccounts.code, '1132'))
    .limit(1);

  // Get account IDs for categorization
  const accounts = await database
    .select({ id: glAccounts.id, code: glAccounts.code })
    .from(glAccounts)
    .where(
      sql`${glAccounts.code} IN ('1131', '5210', '5220', '1133')`
    );

  const accountMap = new Map(accounts.map((a) => [a.code, a.id]));
  const rawMaterialId = accountMap.get('1131');
  const laborId = accountMap.get('5210');
  const overheadId = accountMap.get('5220');
  const fgId = accountMap.get('1133');

  let materialCost = 0;
  let laborCost = 0;
  let overheadCost = 0;
  let transferredCost = 0;

  const journalEntriesDetails: BatchCostBreakdown['journalEntries'] = [];

  for (const entry of entries) {
    // Get lines for this entry
    const lines = await database
      .select({
        glAccountId: journalLines.glAccountId,
        debit: journalLines.debit,
        credit: journalLines.credit,
      })
      .from(journalLines)
      .where(eq(journalLines.journalEntryId, entry.id));

    let entryType: 'material' | 'labor' | 'overhead' | 'transfer' = 'material';
    let amount = entry.totalDebit || 0;

    // Determine entry type based on credited account
    for (const line of lines) {
      if (line.credit && line.credit > 0) {
        if (line.glAccountId === rawMaterialId) {
          entryType = 'material';
          materialCost += line.credit;
        } else if (line.glAccountId === laborId) {
          entryType = 'labor';
          laborCost += line.credit;
        } else if (line.glAccountId === overheadId) {
          entryType = 'overhead';
          overheadCost += line.credit;
        } else if (line.glAccountId === wipAccount?.id) {
          entryType = 'transfer';
          transferredCost += line.credit;
        }
        amount = line.credit;
      }
    }

    journalEntriesDetails.push({
      id: entry.id,
      entryNumber: entry.entryNumber,
      entryDate: formatDateFromDb(entry.entryDate),
      description: entry.description || '',
      amount,
      type: entryType,
    });
  }

  const totalCost = materialCost + laborCost + overheadCost;
  const producedQuantity = workOrder.actualQuantity || workOrder.plannedQuantity || 0;
  const unitCost = producedQuantity > 0 ? totalCost / producedQuantity : 0;

  return {
    workOrderId,
    batchNumber: workOrder.batchNumber,
    materialCost,
    laborCost,
    overheadCost,
    totalCost,
    unitCost,
    producedQuantity,
    status: transferredCost >= totalCost ? 'completed' : 'in_progress',
    journalEntries: journalEntriesDetails,
  };
}

// ============================================
// Withholding Tax (WHT) Transactions (US6)
// ============================================

/**
 * Input for creating a WHT transaction
 */
export interface CreateWHTTransactionInput {
  certificateType: 'pnd3' | 'pnd53';
  paymentId: number;
  vendorId: number;
  paymentDate: string;
  whtType: string;
  whtDescription: string;
  paymentAmount: number;
  whtRate: number;
}

/**
 * Generate WHT certificate number in format WHT-YYYYMM-NNNNNN
 * @param certificateType - PND 3 or PND 53
 * @param paymentDate - Date of the payment
 * @returns Unique certificate number
 */
export async function generateWHTCertificateNumber(
  certificateType: 'pnd3' | 'pnd53',
  paymentDate: string
): Promise<string> {
  const { whtTransactions } = getAccountingTables();
  const database = db();

  const date = new Date(paymentDate);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const typePrefix = certificateType === 'pnd3' ? '3' : '53';
  const prefix = `WHT${typePrefix}-${year}${month}-`;

  // Find the highest sequence number for this prefix
  const result = await database
    .select({ certificateNumber: whtTransactions.certificateNumber })
    .from(whtTransactions)
    .where(sql`${whtTransactions.certificateNumber} LIKE ${prefix + '%'}`)
    .orderBy(desc(whtTransactions.certificateNumber))
    .limit(1);

  let sequence = 1;
  if (result.length > 0) {
    const lastNumber = result[0].certificateNumber;
    const lastSequence = parseInt(lastNumber.slice(-6), 10);
    sequence = lastSequence + 1;
  }

  return prefix + String(sequence).padStart(6, '0');
}

/**
 * Create a WHT transaction record
 * Called when making an AP payment with withholding tax
 * @param input - WHT transaction details
 * @returns Created WHT transaction
 */
export async function createWHTTransaction(
  input: CreateWHTTransactionInput
): Promise<{ id: number; certificateNumber: string }> {
  const { whtTransactions } = getAccountingTables();
  const database = db();

  // Generate certificate number
  const certificateNumber = await generateWHTCertificateNumber(
    input.certificateType,
    input.paymentDate
  );

  // Calculate WHT amount and net payment
  const whtAmount = (input.paymentAmount * input.whtRate) / 100;
  const netAmount = input.paymentAmount - whtAmount;

  // Determine tax period (YYYY-MM format)
  const taxPeriod = input.paymentDate.substring(0, 7);

  const values = {
    certificateNumber,
    certificateType: input.certificateType,
    paymentId: input.paymentId,
    vendorId: input.vendorId,
    paymentDate: toDbDate(input.paymentDate),
    taxPeriod,
    whtType: input.whtType,
    whtDescription: input.whtDescription,
    paymentAmount: input.paymentAmount,
    whtRate: input.whtRate,
    whtAmount,
    netAmount,
    createdAt: getNow(),
  };

  const [inserted] = await database
    .insert(whtTransactions)
    .values(values)
    .$returningId();

  return {
    id: inserted.id,
    certificateNumber,
  };
}

/**
 * WHT transaction with vendor details
 */
export interface WHTTransactionWithVendor {
  id: number;
  certificateNumber: string;
  certificateType: 'pnd3' | 'pnd53';
  paymentId: number;
  vendorId: number;
  vendorName: string;
  vendorTaxId: string | null;
  paymentDate: string;
  taxPeriod: string;
  whtType: string;
  whtDescription: string;
  paymentAmount: number;
  whtRate: number;
  whtAmount: number;
  netAmount: number;
  createdAt: string;
}

/**
 * List WHT certificates/transactions with filters
 * @param filters - Optional filters
 * @returns List of WHT transactions with vendor details
 */
export async function listWHTCertificates(filters?: {
  certificateType?: 'pnd3' | 'pnd53';
  taxPeriod?: string;
  vendorId?: number;
  startDate?: string;
  endDate?: string;
}): Promise<WHTTransactionWithVendor[]> {
  const { whtTransactions } = getAccountingTables();
  const database = db();

  // Get vendors table
  const vendorsTable = isSqlite()
    ? (await import('../db/schema')).sqliteVendors
    : (await import('../db/schema')).mysqlVendors;

  // Build query
  let query = database
    .select({
      id: whtTransactions.id,
      certificateNumber: whtTransactions.certificateNumber,
      certificateType: whtTransactions.certificateType,
      paymentId: whtTransactions.paymentId,
      vendorId: whtTransactions.vendorId,
      vendorName: vendorsTable.name,
      vendorTaxId: vendorsTable.taxId,
      paymentDate: whtTransactions.paymentDate,
      taxPeriod: whtTransactions.taxPeriod,
      whtType: whtTransactions.whtType,
      whtDescription: whtTransactions.whtDescription,
      paymentAmount: whtTransactions.paymentAmount,
      whtRate: whtTransactions.whtRate,
      whtAmount: whtTransactions.whtAmount,
      netAmount: whtTransactions.netAmount,
      createdAt: whtTransactions.createdAt,
    })
    .from(whtTransactions)
    .innerJoin(vendorsTable, eq(whtTransactions.vendorId, vendorsTable.id));

  // Apply filters
  const conditions: ReturnType<typeof eq>[] = [];

  if (filters?.certificateType) {
    conditions.push(eq(whtTransactions.certificateType, filters.certificateType));
  }

  if (filters?.taxPeriod) {
    conditions.push(eq(whtTransactions.taxPeriod, filters.taxPeriod));
  }

  if (filters?.vendorId) {
    conditions.push(eq(whtTransactions.vendorId, filters.vendorId));
  }

  if (filters?.startDate) {
    conditions.push(gte(whtTransactions.paymentDate, toQueryDate(filters.startDate)));
  }

  if (filters?.endDate) {
    conditions.push(lte(whtTransactions.paymentDate, toQueryDate(filters.endDate)));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  const results = await query.orderBy(desc(whtTransactions.paymentDate));

  return results.map((r) => ({
    id: r.id,
    certificateNumber: r.certificateNumber,
    certificateType: r.certificateType as 'pnd3' | 'pnd53',
    paymentId: r.paymentId,
    vendorId: r.vendorId,
    vendorName: r.vendorName,
    vendorTaxId: r.vendorTaxId,
    paymentDate: formatDateFromDb(r.paymentDate),
    taxPeriod: r.taxPeriod,
    whtType: r.whtType,
    whtDescription: r.whtDescription,
    paymentAmount: Number(r.paymentAmount),
    whtRate: Number(r.whtRate),
    whtAmount: Number(r.whtAmount),
    netAmount: Number(r.netAmount),
    createdAt: formatDateFromDb(r.createdAt),
  }));
}

/**
 * Get a single WHT certificate by ID
 * @param id - WHT transaction ID
 * @returns WHT transaction with vendor details
 */
export async function getWHTCertificateById(
  id: number
): Promise<WHTTransactionWithVendor | null> {
  const { whtTransactions } = getAccountingTables();
  const database = db();

  const vendorsTable = isSqlite()
    ? (await import('../db/schema')).sqliteVendors
    : (await import('../db/schema')).mysqlVendors;

  const [result] = await database
    .select({
      id: whtTransactions.id,
      certificateNumber: whtTransactions.certificateNumber,
      certificateType: whtTransactions.certificateType,
      paymentId: whtTransactions.paymentId,
      vendorId: whtTransactions.vendorId,
      vendorName: vendorsTable.name,
      vendorTaxId: vendorsTable.taxId,
      paymentDate: whtTransactions.paymentDate,
      taxPeriod: whtTransactions.taxPeriod,
      whtType: whtTransactions.whtType,
      whtDescription: whtTransactions.whtDescription,
      paymentAmount: whtTransactions.paymentAmount,
      whtRate: whtTransactions.whtRate,
      whtAmount: whtTransactions.whtAmount,
      netAmount: whtTransactions.netAmount,
      createdAt: whtTransactions.createdAt,
    })
    .from(whtTransactions)
    .innerJoin(vendorsTable, eq(whtTransactions.vendorId, vendorsTable.id))
    .where(eq(whtTransactions.id, id))
    .limit(1);

  if (!result) return null;

  return {
    id: result.id,
    certificateNumber: result.certificateNumber,
    certificateType: result.certificateType as 'pnd3' | 'pnd53',
    paymentId: result.paymentId,
    vendorId: result.vendorId,
    vendorName: result.vendorName,
    vendorTaxId: result.vendorTaxId,
    paymentDate: formatDateFromDb(result.paymentDate),
    taxPeriod: result.taxPeriod,
    whtType: result.whtType,
    whtDescription: result.whtDescription,
    paymentAmount: Number(result.paymentAmount),
    whtRate: Number(result.whtRate),
    whtAmount: Number(result.whtAmount),
    netAmount: Number(result.netAmount),
    createdAt: formatDateFromDb(result.createdAt),
  };
}

// ============================================
// Payroll Accounting (US10)
// ============================================

import type {
  PayrollEntry,
  PayrollBatch,
  PayrollJournalResult,
  StatutoryLiabilitiesResult,
  PayrollAccountConfig,
} from '@/types/accounting';

/**
 * Create a journal entry from payroll data
 * Creates debit entries for salary/wage expenses and employer SSO
 * Creates credit entries for SSO payable, WHT payable, and net pay (cash or payable)
 */
export async function createPayrollJournalEntry(
  payrollBatch: PayrollBatch,
  accountConfig: PayrollAccountConfig,
  createdBy: number
): Promise<PayrollJournalResult> {
  const tables = getAccountingTables();
  const database = db();

  // Calculate totals
  let totalGrossPay = 0;
  let totalNetPay = 0;
  let totalSSOEmployee = 0;
  let totalSSOEmployer = 0;
  let totalWHT = 0;
  let totalOtherDeductions = 0;

  // Group by cost center for allocation
  const costCenterMap = new Map<number, {
    costCenterId: number;
    costCenterCode: string | null;
    salaryExpense: number;
    ssoEmployerExpense: number;
  }>();

  for (const entry of payrollBatch.entries) {
    totalGrossPay += entry.grossPay;
    totalNetPay += entry.netPay;
    totalSSOEmployee += entry.ssoEmployee;
    totalSSOEmployer += entry.ssoEmployer;
    totalWHT += entry.whtAmount;
    totalOtherDeductions += entry.otherDeductions;

    // Aggregate by cost center
    const ccId = entry.costCenterId || 0;
    const existing = costCenterMap.get(ccId);
    if (existing) {
      existing.salaryExpense += entry.grossPay;
      existing.ssoEmployerExpense += entry.ssoEmployer;
    } else {
      costCenterMap.set(ccId, {
        costCenterId: ccId,
        costCenterCode: entry.costCenterCode || null,
        salaryExpense: entry.grossPay,
        ssoEmployerExpense: entry.ssoEmployer,
      });
    }
  }

  // Calculate total expense (salary + employer SSO)
  const totalSalaryExpense = totalGrossPay;
  const totalEmployerExpense = totalSSOEmployer;

  // Prepare journal lines
  const journalLines: JournalLineCreate[] = [];

  // DEBIT: Salary/Wages Expense - one line per cost center for proper allocation
  for (const [ccId, allocation] of costCenterMap) {
    if (allocation.salaryExpense > 0) {
      journalLines.push({
        accountId: accountConfig.salaryExpenseAccountId,
        debit: allocation.salaryExpense,
        credit: 0,
        description: `Salary expense - ${allocation.costCenterCode || 'General'}`,
        costCenterId: ccId > 0 ? ccId : undefined,
      });
    }

    // DEBIT: SSO Employer Expense per cost center
    if (allocation.ssoEmployerExpense > 0) {
      journalLines.push({
        accountId: accountConfig.ssoEmployerExpenseAccountId,
        debit: allocation.ssoEmployerExpense,
        credit: 0,
        description: `SSO employer contribution - ${allocation.costCenterCode || 'General'}`,
        costCenterId: ccId > 0 ? ccId : undefined,
      });
    }
  }

  // CREDIT: SSO Payable (employee + employer)
  const totalSSOPayable = totalSSOEmployee + totalSSOEmployer;
  if (totalSSOPayable > 0) {
    journalLines.push({
      accountId: accountConfig.ssoPayableAccountId,
      debit: 0,
      credit: totalSSOPayable,
      description: `Social Security payable - ${payrollBatch.payrollPeriod}`,
    });
  }

  // CREDIT: WHT Payable
  if (totalWHT > 0) {
    journalLines.push({
      accountId: accountConfig.whtPayableAccountId,
      debit: 0,
      credit: totalWHT,
      description: `Withholding tax payable - ${payrollBatch.payrollPeriod}`,
    });
  }

  // CREDIT: Net pay - to Cash or Salary Payable
  if (totalNetPay > 0) {
    journalLines.push({
      accountId: accountConfig.cashAccountId,
      debit: 0,
      credit: totalNetPay,
      description: `Net salary payment - ${payrollBatch.payrollPeriod}`,
    });
  }

  // Verify the entry balances
  const totalDebits = journalLines.reduce((sum, l) => sum + l.debit, 0);
  const totalCredits = journalLines.reduce((sum, l) => sum + l.credit, 0);

  if (Math.abs(totalDebits - totalCredits) > 0.01) {
    return {
      success: false,
      journalEntryId: null,
      entryNumber: null,
      message: `Journal entry does not balance. Debits: ${totalDebits}, Credits: ${totalCredits}`,
      totals: {
        totalGrossPay,
        totalNetPay,
        totalSSOEmployee,
        totalSSOEmployer,
        totalWHT,
        totalOtherDeductions,
      },
      costCenterAllocations: [],
    };
  }

  // Create the journal entry
  const description = payrollBatch.description ||
    `Payroll for ${payrollBatch.payrollPeriod}${payrollBatch.payrollNumber ? ` (${payrollBatch.payrollNumber})` : ''}`;

  const journalEntry = await createJournalEntry(
    {
      entryDate: payrollBatch.payrollDate,
      description,
      reference: payrollBatch.payrollNumber || `PAYROLL-${payrollBatch.payrollPeriod}`,
      source: 'PAYROLL' as JournalSourceType,
      sourceId: null,
      lines: journalLines,
    },
    createdBy
  );

  // Convert cost center map to array
  const costCenterAllocations = Array.from(costCenterMap.values()).map(cc => ({
    costCenterId: cc.costCenterId,
    costCenterCode: cc.costCenterCode,
    salaryExpense: cc.salaryExpense,
    ssoEmployerExpense: cc.ssoEmployerExpense,
    totalExpense: cc.salaryExpense + cc.ssoEmployerExpense,
  }));

  return {
    success: true,
    journalEntryId: journalEntry.id,
    entryNumber: journalEntry.entryNumber,
    message: `Created payroll journal entry for ${payrollBatch.entries.length} employees`,
    totals: {
      totalGrossPay,
      totalNetPay,
      totalSSOEmployee,
      totalSSOEmployer,
      totalWHT,
      totalOtherDeductions,
    },
    costCenterAllocations,
  };
}

/**
 * Allocate payroll costs to cost centers
 * Returns a breakdown of payroll expenses by cost center/department
 */
export async function allocatePayrollToCostCenters(
  payrollBatch: PayrollBatch
): Promise<Array<{
  costCenterId: number | null;
  costCenterCode: string | null;
  employeeCount: number;
  baseSalary: number;
  overtime: number;
  bonuses: number;
  allowances: number;
  grossPay: number;
  ssoEmployee: number;
  ssoEmployer: number;
  whtAmount: number;
  netPay: number;
  totalCost: number;
}>> {
  // Group entries by cost center
  const allocationMap = new Map<number | null, {
    costCenterId: number | null;
    costCenterCode: string | null;
    employeeCount: number;
    baseSalary: number;
    overtime: number;
    bonuses: number;
    allowances: number;
    grossPay: number;
    ssoEmployee: number;
    ssoEmployer: number;
    whtAmount: number;
    netPay: number;
  }>();

  for (const entry of payrollBatch.entries) {
    const ccId = entry.costCenterId ?? null;
    const existing = allocationMap.get(ccId);

    if (existing) {
      existing.employeeCount += 1;
      existing.baseSalary += entry.baseSalary;
      existing.overtime += entry.overtime;
      existing.bonuses += entry.bonuses;
      existing.allowances += entry.allowances;
      existing.grossPay += entry.grossPay;
      existing.ssoEmployee += entry.ssoEmployee;
      existing.ssoEmployer += entry.ssoEmployer;
      existing.whtAmount += entry.whtAmount;
      existing.netPay += entry.netPay;
    } else {
      allocationMap.set(ccId, {
        costCenterId: ccId,
        costCenterCode: entry.costCenterCode || null,
        employeeCount: 1,
        baseSalary: entry.baseSalary,
        overtime: entry.overtime,
        bonuses: entry.bonuses,
        allowances: entry.allowances,
        grossPay: entry.grossPay,
        ssoEmployee: entry.ssoEmployee,
        ssoEmployer: entry.ssoEmployer,
        whtAmount: entry.whtAmount,
        netPay: entry.netPay,
      });
    }
  }

  // Convert to array with total cost calculation
  return Array.from(allocationMap.values()).map(allocation => ({
    ...allocation,
    // Total cost = Gross pay + Employer SSO
    totalCost: allocation.grossPay + allocation.ssoEmployer,
  }));
}

/**
 * Record statutory liabilities from payroll (SSO and WHT)
 * Creates or updates the liability journal entries for the period
 */
export async function recordStatutoryLiabilities(
  payrollPeriod: string,
  payrollBatch: PayrollBatch,
  accountConfig: PayrollAccountConfig,
  createdBy: number
): Promise<StatutoryLiabilitiesResult> {
  // Calculate total statutory liabilities
  let totalSSOEmployee = 0;
  let totalSSOEmployer = 0;
  let totalWHT = 0;

  for (const entry of payrollBatch.entries) {
    totalSSOEmployee += entry.ssoEmployee;
    totalSSOEmployer += entry.ssoEmployer;
    totalWHT += entry.whtAmount;
  }

  const totalSSOPayable = totalSSOEmployee + totalSSOEmployer;
  const totalPayable = totalSSOPayable + totalWHT;

  // Check if there are any liabilities to record
  if (totalPayable === 0) {
    return {
      success: true,
      journalEntryId: null,
      message: 'No statutory liabilities to record',
      ssoPayable: 0,
      whtPayable: 0,
      totalPayable: 0,
    };
  }

  // The liabilities are already recorded in createPayrollJournalEntry
  // This function returns a summary for tracking purposes
  return {
    success: true,
    journalEntryId: null, // Liabilities are part of the main payroll JE
    message: `Statutory liabilities for ${payrollPeriod}: SSO ${totalSSOPayable.toFixed(2)} THB, WHT ${totalWHT.toFixed(2)} THB`,
    ssoPayable: totalSSOPayable,
    whtPayable: totalWHT,
    totalPayable,
  };
}

/**
 * Calculate Thai Social Security contribution
 * Rate: 5% of salary, capped at maximum wage base of 15,000 THB (max 750 THB)
 */
export function calculateThaiSSO(salary: number): {
  employeeContribution: number;
  employerContribution: number;
  total: number;
} {
  // Import constants from types
  const SSO_RATE = 0.05;
  const MAX_WAGE_BASE = 15000;
  const MAX_CONTRIBUTION = MAX_WAGE_BASE * SSO_RATE; // 750 THB

  // Apply the cap
  const wageBase = Math.min(salary, MAX_WAGE_BASE);
  const contribution = wageBase * SSO_RATE;

  return {
    employeeContribution: Math.min(contribution, MAX_CONTRIBUTION),
    employerContribution: Math.min(contribution, MAX_CONTRIBUTION),
    total: Math.min(contribution * 2, MAX_CONTRIBUTION * 2),
  };
}

/**
 * Get payroll summary for a fiscal period
 */
export async function getPayrollSummary(
  fiscalPeriodId: number
): Promise<{
  periodId: number;
  periodName: string | null;
  totalGrossPay: number;
  totalNetPay: number;
  totalSSOPayable: number;
  totalWHTPayable: number;
  totalEmployerCost: number;
  journalEntryCount: number;
}> {
  const tables = getAccountingTables();
  const database = db();

  // Get the fiscal period
  const [period] = await database
    .select()
    .from(tables.fiscalPeriods)
    .where(eq(tables.fiscalPeriods.id, fiscalPeriodId))
    .limit(1);

  if (!period) {
    return {
      periodId: fiscalPeriodId,
      periodName: null,
      totalGrossPay: 0,
      totalNetPay: 0,
      totalSSOPayable: 0,
      totalWHTPayable: 0,
      totalEmployerCost: 0,
      journalEntryCount: 0,
    };
  }

  // Get payroll journal entries for this period
  const payrollEntries = await database
    .select({
      id: tables.journalEntries.id,
      totalDebits: sql<number>`SUM(${tables.journalLines.debit})`,
      totalCredits: sql<number>`SUM(${tables.journalLines.credit})`,
    })
    .from(tables.journalEntries)
    .innerJoin(tables.journalLines, eq(tables.journalEntries.id, tables.journalLines.journalEntryId))
    .where(
      and(
        eq(tables.journalEntries.fiscalPeriodId, fiscalPeriodId),
        eq(tables.journalEntries.source, 'PAYROLL')
      )
    )
    .groupBy(tables.journalEntries.id);

  // Calculate totals from journal entries
  const journalEntryCount = payrollEntries.length;
  let totalGrossPay = 0;

  for (const entry of payrollEntries) {
    // Gross pay is approximated from total debits (salary expenses)
    totalGrossPay += Number(entry.totalDebits) || 0;
  }

  return {
    periodId: fiscalPeriodId,
    periodName: period.periodName,
    totalGrossPay,
    totalNetPay: 0, // Would need more detail tracking
    totalSSOPayable: 0, // Would need account-specific tracking
    totalWHTPayable: 0, // Would need account-specific tracking
    totalEmployerCost: totalGrossPay,
    journalEntryCount,
  };
}
