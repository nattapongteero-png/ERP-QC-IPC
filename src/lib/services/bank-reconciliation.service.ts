/**
 * Bank Reconciliation Service (T054-T059)
 * Part of 011-accounting-spec-gap - User Story 2
 */

import { eq, and, or, like, gte, lte, desc, asc, sql, isNull } from 'drizzle-orm';
import { getTableRef, getInsertId, executeDbOperation } from '../db/db-helper';
import { getNow, toDbDate, formatDateFromDb } from '../db/date-utils';
import type {
  BankStatement,
  BankStatementLine,
  BankStatementWithLines,
  BankStatementStatus,
  StatementLineStatus,
  AutoMatchResult,
  ReconciliationMatch,
  ReconciliationSummary,
  UnmatchedPayment,
  BankStatementListFilter,
} from '@/types/bank-reconciliation';
import type {
  BankStatementCreateInput,
  BankStatementUpdateInput,
  BankStatementLineImportInput,
  ManualMatchInput,
  BankChargeJournalInput,
  AutoMatchConfigInput,
} from '@/lib/validation/bank-reconciliation';

/**
 * Get table references
 */
function getTables() {
  return {
    statements: getTableRef('bankStatements'),
    lines: getTableRef('bankStatementLines'),
    matches: getTableRef('reconciliationMatches'),
    glAccounts: getTableRef('gLAccounts'),
    payments: getTableRef('payments'),
    journalEntries: getTableRef('journalEntries'),
    journalEntryLines: getTableRef('journalEntryLines'),
    users: getTableRef('users'),
    employees: getTableRef('hREmployees'),
  };
}

/**
 * Generate next statement number
 */
export async function generateStatementNumber(bankAccountId: number): Promise<string> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const year = new Date().getFullYear();
    const prefix = `BS${year}-${bankAccountId.toString().padStart(3, '0')}-`;

    // Get the latest statement number for the current year and bank account
    const result = await db
      .select({ statementNumber: tables.statements.statementNumber })
      .from(tables.statements)
      .where(
        and(
          eq(tables.statements.bankAccountId, bankAccountId),
          like(tables.statements.statementNumber, `${prefix}%`)
        )
      )
      .orderBy(desc(tables.statements.id))
      .limit(1);

    if (result.length === 0) {
      return `${prefix}0001`;
    }

    const lastNumber = result[0].statementNumber;
    const sequence = parseInt(lastNumber.split('-').pop() || '0', 10);
    const nextSequence = (sequence + 1).toString().padStart(4, '0');
    return `${prefix}${nextSequence}`;
  });
}

/**
 * Create a new Bank Statement
 */
export async function createBankStatement(
  data: BankStatementCreateInput,
  createdBy: number
): Promise<number> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const statementNumber = await generateStatementNumber(data.bankAccountId);
    const now = getNow();

    const result = await db.insert(tables.statements).values({
      statementNumber,
      bankAccountId: data.bankAccountId,
      statementDate: toDbDate(data.statementDate),
      openingBalance: data.openingBalance,
      closingBalance: data.closingBalance,
      totalDebits: 0,
      totalCredits: 0,
      status: 'imported',
      importedAt: now,
      createdBy,
      createdAt: now,
      updatedAt: now,
    });

    return getInsertId(result);
  });
}

/**
 * Get Bank Statement by ID
 */
export async function getBankStatementById(id: number): Promise<BankStatementWithLines | null> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    const statementResults = await db
      .select()
      .from(tables.statements)
      .where(eq(tables.statements.id, id))
      .limit(1);

    if (statementResults.length === 0) {
      return null;
    }

    const statement = statementResults[0];

    // Get bank account info
    const accountResults = await db
      .select({
        accountName: tables.glAccounts.accountName,
        accountNumber: tables.glAccounts.accountNumber,
      })
      .from(tables.glAccounts)
      .where(eq(tables.glAccounts.id, statement.bankAccountId))
      .limit(1);

    const bankAccount = accountResults[0] || {};

    // Get lines
    const lines = await db
      .select()
      .from(tables.lines)
      .where(eq(tables.lines.statementId, id))
      .orderBy(asc(tables.lines.lineNumber));

    // Count matched/unmatched
    const matchedCount = lines.filter((l: any) =>
      ['manually_matched', 'auto_matched', 'journal_created', 'reconciled'].includes(l.status)
    ).length;
    const unmatchedCount = lines.filter((l: any) =>
      ['imported', 'unmatched', 'suggested'].includes(l.status)
    ).length;

    return {
      ...statement,
      bankAccountName: bankAccount.accountName || '',
      bankAccountNumber: bankAccount.accountNumber || '',
      matchedCount,
      unmatchedCount,
      lines: lines.map((line: any) => ({
        id: line.id,
        statementId: line.statementId,
        lineNumber: line.lineNumber,
        transactionDate: line.transactionDate,
        valueDate: line.valueDate,
        description: line.description,
        reference: line.reference,
        transactionType: line.debitAmount ? 'debit' : 'credit',
        amount: line.debitAmount || line.creditAmount || 0,
        runningBalance: line.runningBalance,
        transactionCode: null,
        status: mapLineStatus(line.status),
        matchedPaymentId: null,
        matchedReceiptId: null,
        matchType: null,
        matchConfidence: line.matchConfidence,
        journalEntryId: null,
        notes: line.notes,
        createdAt: line.createdAt,
        updatedAt: line.createdAt,
      })),
    } as BankStatementWithLines;
  });
}

/**
 * Map internal line status to external status type
 */
function mapLineStatus(status: string): StatementLineStatus {
  const statusMap: Record<string, StatementLineStatus> = {
    imported: 'unmatched',
    unmatched: 'unmatched',
    suggested: 'unmatched',
    auto_matched: 'matched',
    manually_matched: 'matched',
    journal_created: 'journal_created',
    reconciled: 'matched',
  };
  return statusMap[status] || 'unmatched';
}

/**
 * List Bank Statements with filtering
 */
export async function listBankStatements(filter: BankStatementListFilter): Promise<{
  data: BankStatement[];
  total: number;
  page: number;
  limit: number;
}> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const page = filter.page || 1;
    const limit = filter.limit || 20;
    const offset = (page - 1) * limit;

    // Build query conditions
    const conditions: any[] = [];

    if (filter.bankAccountId) {
      conditions.push(eq(tables.statements.bankAccountId, filter.bankAccountId));
    }
    if (filter.status) {
      conditions.push(eq(tables.statements.status, filter.status));
    }
    if (filter.fromDate) {
      conditions.push(gte(tables.statements.statementDate, toDbDate(filter.fromDate)));
    }
    if (filter.toDate) {
      conditions.push(lte(tables.statements.statementDate, toDbDate(filter.toDate)));
    }
    if (filter.search) {
      conditions.push(
        or(
          like(tables.statements.statementNumber, `%${filter.search}%`),
          like(tables.statements.notes, `%${filter.search}%`)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(tables.statements)
      .where(whereClause);
    const total = Number(countResult[0]?.count || 0);

    // Get statements with account info
    const statements = await db
      .select({
        id: tables.statements.id,
        statementNumber: tables.statements.statementNumber,
        bankAccountId: tables.statements.bankAccountId,
        statementDate: tables.statements.statementDate,
        openingBalance: tables.statements.openingBalance,
        closingBalance: tables.statements.closingBalance,
        totalDebits: tables.statements.totalDebits,
        totalCredits: tables.statements.totalCredits,
        status: tables.statements.status,
        importedFileName: tables.statements.importedFileName,
        importedAt: tables.statements.importedAt,
        reconciledBy: tables.statements.reconciledBy,
        reconciledAt: tables.statements.reconciledAt,
        notes: tables.statements.notes,
        createdBy: tables.statements.createdBy,
        createdAt: tables.statements.createdAt,
        updatedAt: tables.statements.updatedAt,
        bankAccountName: tables.glAccounts.accountName,
        bankAccountNumber: tables.glAccounts.accountNumber,
      })
      .from(tables.statements)
      .leftJoin(tables.glAccounts, eq(tables.statements.bankAccountId, tables.glAccounts.id))
      .where(whereClause)
      .orderBy(desc(tables.statements.statementDate))
      .limit(limit)
      .offset(offset);

    // Get line counts for each statement
    const enhancedStatements = await Promise.all(
      statements.map(async (stmt: any) => {
        const lines = await db
          .select({ status: tables.lines.status })
          .from(tables.lines)
          .where(eq(tables.lines.statementId, stmt.id));

        const matchedCount = lines.filter((l: any) =>
          ['manually_matched', 'auto_matched', 'journal_created', 'reconciled'].includes(l.status)
        ).length;
        const unmatchedCount = lines.filter((l: any) =>
          ['imported', 'unmatched', 'suggested'].includes(l.status)
        ).length;

        return {
          ...stmt,
          matchedCount,
          unmatchedCount,
          currency: 'THB',
        };
      })
    );

    return {
      data: enhancedStatements,
      total,
      page,
      limit,
    };
  });
}

/**
 * Import statement lines from CSV data
 */
export async function importStatementLines(
  statementId: number,
  lines: BankStatementLineImportInput[],
  createdBy: number
): Promise<{ imported: number; errors: string[] }> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const now = getNow();
    const errors: string[] = [];
    let imported = 0;
    let totalDebits = 0;
    let totalCredits = 0;

    // Get current max line number
    const maxLineResult = await db
      .select({ maxLine: sql<number>`COALESCE(MAX(line_number), 0)` })
      .from(tables.lines)
      .where(eq(tables.lines.statementId, statementId));
    let lineNumber = Number(maxLineResult[0]?.maxLine || 0);

    for (const line of lines) {
      try {
        lineNumber++;
        const debitAmount = line.debitAmount || null;
        const creditAmount = line.creditAmount || null;

        await db.insert(tables.lines).values({
          statementId,
          lineNumber,
          transactionDate: toDbDate(line.transactionDate),
          valueDate: line.valueDate ? toDbDate(line.valueDate) : null,
          reference: line.reference || null,
          description: line.description,
          debitAmount,
          creditAmount,
          runningBalance: line.balance || null,
          status: 'imported',
          createdAt: now,
        });

        if (debitAmount) totalDebits += debitAmount;
        if (creditAmount) totalCredits += creditAmount;
        imported++;
      } catch (err) {
        errors.push(`Line ${lineNumber}: ${(err as Error).message}`);
      }
    }

    // Update statement totals
    if (imported > 0) {
      await db
        .update(tables.statements)
        .set({
          totalDebits: sql`total_debits + ${totalDebits}`,
          totalCredits: sql`total_credits + ${totalCredits}`,
          status: 'in_progress',
          updatedAt: now,
        })
        .where(eq(tables.statements.id, statementId));
    }

    return { imported, errors };
  });
}

/**
 * Run auto-matching for a statement
 */
export async function runAutoMatch(config: AutoMatchConfigInput): Promise<AutoMatchResult> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const now = getNow();
    const matches: AutoMatchResult['matches'] = [];
    let matchedCount = 0;
    let totalProcessed = 0;

    // Get unmatched lines
    const lines = await db
      .select()
      .from(tables.lines)
      .where(
        and(
          eq(tables.lines.statementId, config.statementId),
          or(
            eq(tables.lines.status, 'imported'),
            eq(tables.lines.status, 'unmatched')
          )
        )
      );

    totalProcessed = lines.length;

    // Get unmatched payments for matching
    const payments = await db
      .select()
      .from(tables.payments)
      .where(
        and(
          eq(tables.payments.paymentStatus, 'paid'),
          isNull(tables.payments.reconciledAt)
        )
      );

    for (const line of lines) {
      const lineAmount = Math.abs(line.debitAmount || line.creditAmount || 0);
      const lineRef = (line.reference || '').toLowerCase().trim();
      const lineDate = new Date(line.transactionDate);

      let bestMatch: { payment: any; confidence: number; type: 'ap_payment' | 'ar_receipt' } | null = null;

      for (const payment of payments) {
        const paymentAmount = Number(payment.paymentAmount || 0);
        let confidence = 0;

        // Amount matching
        if (config.matchByAmount !== false) {
          const tolerance = (config.amountTolerancePercent || 0) / 100;
          const amountDiff = Math.abs(lineAmount - paymentAmount);
          const maxAllowedDiff = lineAmount * tolerance;

          if (amountDiff <= maxAllowedDiff + 0.01) {
            confidence += 40;
            if (amountDiff < 0.01) confidence += 10; // Exact match bonus
          }
        }

        // Reference matching
        if (config.matchByReference !== false && lineRef) {
          const paymentRef = (payment.paymentReference || payment.paymentNumber || '').toLowerCase().trim();
          if (paymentRef && lineRef.includes(paymentRef)) {
            confidence += 30;
          } else if (paymentRef && paymentRef.includes(lineRef)) {
            confidence += 25;
          }
        }

        // Date matching
        if (config.matchByDate !== false) {
          const paymentDate = new Date(payment.paymentDate);
          const daysDiff = Math.abs((lineDate.getTime() - paymentDate.getTime()) / (1000 * 60 * 60 * 24));
          const tolerance = config.dateToleranceDays || 3;

          if (daysDiff <= tolerance) {
            confidence += 20 - (daysDiff * 5);
          }
        }

        // Check if this is the best match so far
        if (confidence >= 50 && (!bestMatch || confidence > bestMatch.confidence)) {
          bestMatch = {
            payment,
            confidence,
            type: line.debitAmount ? 'ap_payment' : 'ar_receipt',
          };
        }
      }

      // Apply best match if found
      if (bestMatch) {
        await db
          .update(tables.lines)
          .set({
            status: 'auto_matched',
            matchConfidence: bestMatch.confidence,
          })
          .where(eq(tables.lines.id, line.id));

        // Create match record
        await db.insert(tables.matches).values({
          statementLineId: line.id,
          paymentId: bestMatch.payment.id,
          journalEntryId: null,
          matchType: 'auto',
          matchAmount: Math.abs(line.debitAmount || line.creditAmount || 0),
          varianceAmount: 0,
          createdBy: 1, // System user
          createdAt: now,
        });

        matches.push({
          lineId: line.id,
          matchedToId: bestMatch.payment.id,
          matchedToType: bestMatch.type,
          confidence: bestMatch.confidence,
        });
        matchedCount++;
      }
    }

    return {
      totalProcessed,
      matchedCount,
      unmatchedCount: totalProcessed - matchedCount,
      matches,
    };
  });
}

/**
 * Manually match a statement line
 */
export async function manualMatch(
  input: ManualMatchInput,
  userId: number
): Promise<{ success: boolean; error?: string }> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const now = getNow();

    // Get the line
    const lineResults = await db
      .select()
      .from(tables.lines)
      .where(eq(tables.lines.id, input.statementLineId))
      .limit(1);

    if (lineResults.length === 0) {
      return { success: false, error: 'Statement line not found' };
    }

    const line = lineResults[0];

    // Update line status
    await db
      .update(tables.lines)
      .set({
        status: 'manually_matched',
        matchConfidence: 100,
        matchedBy: userId,
        matchedAt: now,
        notes: input.notes || null,
      })
      .where(eq(tables.lines.id, input.statementLineId));

    // Create match record
    await db.insert(tables.matches).values({
      statementLineId: input.statementLineId,
      paymentId: input.matchedEntityType !== 'journal_entry' ? input.matchedEntityId : null,
      journalEntryId: input.matchedEntityType === 'journal_entry' ? input.matchedEntityId : null,
      matchType: 'manual',
      matchAmount: Math.abs(line.debitAmount || line.creditAmount || 0),
      varianceAmount: 0,
      createdBy: userId,
      createdAt: now,
    });

    return { success: true };
  });
}

/**
 * Unmatch a statement line
 */
export async function unmatchLine(
  statementLineId: number
): Promise<{ success: boolean; error?: string }> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    // Delete match records
    await db
      .delete(tables.matches)
      .where(eq(tables.matches.statementLineId, statementLineId));

    // Reset line status
    await db
      .update(tables.lines)
      .set({
        status: 'unmatched',
        matchConfidence: null,
        matchedBy: null,
        matchedAt: null,
      })
      .where(eq(tables.lines.id, statementLineId));

    return { success: true };
  });
}

/**
 * Create bank charge journal entry
 */
export async function createBankChargeJournal(
  input: BankChargeJournalInput,
  userId: number
): Promise<{ success: boolean; journalEntryId?: number; error?: string }> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const now = getNow();

    // Get the statement line
    const lineResults = await db
      .select()
      .from(tables.lines)
      .where(eq(tables.lines.id, input.statementLineId))
      .limit(1);

    if (lineResults.length === 0) {
      return { success: false, error: 'Statement line not found' };
    }

    const line = lineResults[0];

    // Get statement to find bank account
    const stmtResults = await db
      .select()
      .from(tables.statements)
      .where(eq(tables.statements.id, line.statementId))
      .limit(1);

    if (stmtResults.length === 0) {
      return { success: false, error: 'Statement not found' };
    }

    const stmt = stmtResults[0];
    const amount = Math.abs(line.debitAmount || line.creditAmount || 0);

    // Generate journal entry number
    const year = new Date().getFullYear();
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(tables.journalEntries);
    const count = Number(countResult[0]?.count || 0) + 1;
    const entryNumber = `JE${year}-${count.toString().padStart(6, '0')}`;

    // Create journal entry
    const jeResult = await db.insert(tables.journalEntries).values({
      entryNumber,
      entryDate: line.transactionDate,
      description: input.description || `Bank charge: ${input.chargeType}`,
      reference: line.reference || null,
      totalDebit: amount,
      totalCredit: amount,
      status: 'posted',
      sourceType: 'bank_reconciliation',
      sourceId: line.statementId,
      postedBy: userId,
      postedAt: now,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });

    const journalEntryId = getInsertId(jeResult);

    // Create journal entry lines
    // Debit the expense account
    await db.insert(tables.journalEntryLines).values({
      journalEntryId,
      lineNumber: 1,
      accountId: input.accountId,
      description: input.description || `Bank charge: ${input.chargeType}`,
      debitAmount: amount,
      creditAmount: 0,
      createdAt: now,
    });

    // Credit the bank account
    await db.insert(tables.journalEntryLines).values({
      journalEntryId,
      lineNumber: 2,
      accountId: stmt.bankAccountId,
      description: input.description || `Bank charge: ${input.chargeType}`,
      debitAmount: 0,
      creditAmount: amount,
      createdAt: now,
    });

    // Update statement line
    await db
      .update(tables.lines)
      .set({
        status: 'journal_created',
        matchedBy: userId,
        matchedAt: now,
      })
      .where(eq(tables.lines.id, input.statementLineId));

    // Create match record
    await db.insert(tables.matches).values({
      statementLineId: input.statementLineId,
      paymentId: null,
      journalEntryId,
      matchType: 'journal',
      matchAmount: amount,
      varianceAmount: 0,
      createdBy: userId,
      createdAt: now,
    });

    return { success: true, journalEntryId };
  });
}

/**
 * Ignore a statement line
 */
export async function ignoreLine(
  statementLineId: number,
  notes: string | undefined,
  userId: number
): Promise<{ success: boolean }> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const now = getNow();

    await db
      .update(tables.lines)
      .set({
        status: 'reconciled', // Mark as reconciled but ignored
        notes: notes ? `[IGNORED] ${notes}` : '[IGNORED]',
        matchedBy: userId,
        matchedAt: now,
      })
      .where(eq(tables.lines.id, statementLineId));

    return { success: true };
  });
}

/**
 * Get reconciliation summary for a statement
 */
export async function getReconciliationSummary(statementId: number): Promise<ReconciliationSummary | null> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    // Get statement
    const stmtResults = await db
      .select()
      .from(tables.statements)
      .where(eq(tables.statements.id, statementId))
      .limit(1);

    if (stmtResults.length === 0) {
      return null;
    }

    const stmt = stmtResults[0];

    // Get all lines
    const lines = await db
      .select()
      .from(tables.lines)
      .where(eq(tables.lines.statementId, statementId));

    let matchedDebits = 0;
    let matchedCredits = 0;
    let unmatchedDebits = 0;
    let unmatchedCredits = 0;

    for (const line of lines) {
      const isMatched = ['manually_matched', 'auto_matched', 'journal_created', 'reconciled'].includes(line.status);
      const debit = Number(line.debitAmount || 0);
      const credit = Number(line.creditAmount || 0);

      if (isMatched) {
        matchedDebits += debit;
        matchedCredits += credit;
      } else {
        unmatchedDebits += debit;
        unmatchedCredits += credit;
      }
    }

    const openingBalance = Number(stmt.openingBalance);
    const closingBalance = Number(stmt.closingBalance);
    const totalDebits = Number(stmt.totalDebits);
    const totalCredits = Number(stmt.totalCredits);

    // Calculate expected closing balance
    const expectedClosing = openingBalance - totalDebits + totalCredits;
    const difference = closingBalance - expectedClosing;

    return {
      openingBalance,
      closingBalance,
      totalDebits,
      totalCredits,
      matchedDebits,
      matchedCredits,
      unmatchedDebits,
      unmatchedCredits,
      difference,
      isBalanced: Math.abs(difference) < 0.01 && unmatchedDebits < 0.01 && unmatchedCredits < 0.01,
    };
  });
}

/**
 * Get unmatched payments for matching UI
 */
export async function getUnmatchedPayments(
  bankAccountId: number,
  fromDate?: string,
  toDate?: string
): Promise<UnmatchedPayment[]> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const vendors = getTableRef('vendors');

    const conditions: any[] = [
      eq(tables.payments.paymentStatus, 'paid'),
      isNull(tables.payments.reconciledAt),
    ];

    if (fromDate) {
      conditions.push(gte(tables.payments.paymentDate, toDbDate(fromDate)));
    }
    if (toDate) {
      conditions.push(lte(tables.payments.paymentDate, toDbDate(toDate)));
    }

    const payments = await db
      .select({
        id: tables.payments.id,
        documentNumber: tables.payments.paymentNumber,
        date: tables.payments.paymentDate,
        amount: tables.payments.paymentAmount,
        reference: tables.payments.paymentReference,
        vendorName: vendors.name,
      })
      .from(tables.payments)
      .leftJoin(vendors, eq(tables.payments.vendorId, vendors.id))
      .where(and(...conditions))
      .orderBy(desc(tables.payments.paymentDate));

    return payments.map((p: any) => ({
      id: p.id,
      type: 'payment' as const,
      documentNumber: p.documentNumber || '',
      date: p.date,
      amount: Number(p.amount || 0),
      vendorOrCustomerName: p.vendorName || '',
      reference: p.reference || undefined,
    }));
  });
}

/**
 * Finalize reconciliation
 */
export async function finalizeReconciliation(
  statementId: number,
  userId: number,
  forceClose: boolean = false
): Promise<{ success: boolean; error?: string }> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const now = getNow();

    // Check summary
    const summary = await getReconciliationSummary(statementId);
    if (!summary) {
      return { success: false, error: 'Statement not found' };
    }

    if (!forceClose && !summary.isBalanced) {
      return {
        success: false,
        error: `Reconciliation not balanced. Unmatched debits: ${summary.unmatchedDebits}, Unmatched credits: ${summary.unmatchedCredits}, Difference: ${summary.difference}`,
      };
    }

    // Update statement status
    await db
      .update(tables.statements)
      .set({
        status: 'reconciled',
        reconciledBy: userId,
        reconciledAt: now,
        updatedAt: now,
      })
      .where(eq(tables.statements.id, statementId));

    // Mark all lines as reconciled
    await db
      .update(tables.lines)
      .set({ status: 'reconciled' })
      .where(eq(tables.lines.statementId, statementId));

    return { success: true };
  });
}

/**
 * Get bank accounts for dropdown
 */
export async function getBankAccounts(): Promise<{ id: number; name: string; accountNumber: string }[]> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    const accounts = await db
      .select({
        id: tables.glAccounts.id,
        name: tables.glAccounts.accountName,
        accountNumber: tables.glAccounts.accountNumber,
      })
      .from(tables.glAccounts)
      .where(eq(tables.glAccounts.isBankAccount, true))
      .orderBy(asc(tables.glAccounts.accountNumber));

    return accounts;
  });
}

/**
 * Update bank statement
 */
export async function updateBankStatement(
  id: number,
  data: BankStatementUpdateInput
): Promise<{ success: boolean; error?: string }> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const now = getNow();

    const updateData: any = { updatedAt: now };

    if (data.statementDate) updateData.statementDate = toDbDate(data.statementDate);
    if (data.openingBalance !== undefined) updateData.openingBalance = data.openingBalance;
    if (data.closingBalance !== undefined) updateData.closingBalance = data.closingBalance;
    if (data.reference !== undefined) updateData.reference = data.reference;

    await db
      .update(tables.statements)
      .set(updateData)
      .where(eq(tables.statements.id, id));

    return { success: true };
  });
}

/**
 * Delete bank statement (only if draft/imported)
 */
export async function deleteBankStatement(id: number): Promise<{ success: boolean; error?: string }> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    // Check status
    const stmtResults = await db
      .select({ status: tables.statements.status })
      .from(tables.statements)
      .where(eq(tables.statements.id, id))
      .limit(1);

    if (stmtResults.length === 0) {
      return { success: false, error: 'Statement not found' };
    }

    if (!['imported', 'in_progress'].includes(stmtResults[0].status)) {
      return { success: false, error: 'Cannot delete reconciled or closed statements' };
    }

    // Delete matches first
    const lines = await db
      .select({ id: tables.lines.id })
      .from(tables.lines)
      .where(eq(tables.lines.statementId, id));

    for (const line of lines) {
      await db.delete(tables.matches).where(eq(tables.matches.statementLineId, line.id));
    }

    // Delete lines
    await db.delete(tables.lines).where(eq(tables.lines.statementId, id));

    // Delete statement
    await db.delete(tables.statements).where(eq(tables.statements.id, id));

    return { success: true };
  });
}

/**
 * Get dashboard summary
 */
export async function getBankReconciliationDashboard(): Promise<{
  totalStatements: number;
  pendingReconciliation: number;
  reconciledThisMonth: number;
  unmatchedLines: number;
}> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    // Total statements
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(tables.statements);
    const totalStatements = Number(totalResult[0]?.count || 0);

    // Pending reconciliation
    const pendingResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(tables.statements)
      .where(
        or(
          eq(tables.statements.status, 'imported'),
          eq(tables.statements.status, 'in_progress')
        )
      );
    const pendingReconciliation = Number(pendingResult[0]?.count || 0);

    // Reconciled this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const reconciledResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(tables.statements)
      .where(
        and(
          eq(tables.statements.status, 'reconciled'),
          gte(tables.statements.reconciledAt, toDbDate(startOfMonth.toISOString().split('T')[0]))
        )
      );
    const reconciledThisMonth = Number(reconciledResult[0]?.count || 0);

    // Unmatched lines
    const unmatchedResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(tables.lines)
      .where(
        or(
          eq(tables.lines.status, 'imported'),
          eq(tables.lines.status, 'unmatched')
        )
      );
    const unmatchedLines = Number(unmatchedResult[0]?.count || 0);

    return {
      totalStatements,
      pendingReconciliation,
      reconciledThisMonth,
      unmatchedLines,
    };
  });
}
