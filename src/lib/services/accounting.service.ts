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
