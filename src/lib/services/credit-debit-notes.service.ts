/**
 * Credit/Debit Notes Service (T079-T082)
 * Part of 011-accounting-spec-gap - User Story 3
 */

import { eq, and, or, like, gte, lte, desc, asc, sql, isNull } from 'drizzle-orm';
import { getTableRef, getInsertId, executeDbOperation } from '../db/db-helper';
import { getNow, toDbDate, formatDateFromDb } from '../db/date-utils';
import { submitForApproval } from './approval-workflow.service';
import type {
  CreditDebitNote,
  CreditDebitNoteLine,
  CreditDebitNoteWithLines,
  NoteType,
  NoteStatus,
  ReasonCode,
  CreditDebitNoteListFilter,
  CreditDebitNoteListResponse,
  InvoiceAvailableForCredit,
  InvoiceLineAvailableForCredit,
  NotePostResult,
  NoteSubmitResponse,
  CreditDebitNoteDashboardSummary,
  InvoiceReference,
  InvoiceLineReference,
  NoteSummary,
} from '@/types/credit-debit-notes';
import type {
  CreditDebitNoteCreateInput,
  CreditDebitNoteUpdateInput,
  NoteLineCreateInput,
} from '@/lib/validation/credit-debit-notes';

/**
 * Get table references
 */
function getTables() {
  return {
    notes: getTableRef('creditDebitNotes'),
    lines: getTableRef('creditDebitNoteLines'),
    arInvoices: getTableRef('aRInvoices'),
    arInvoiceLines: getTableRef('aRInvoiceLines'),
    apInvoices: getTableRef('aPInvoices'),
    apInvoiceLines: getTableRef('aPInvoiceLines'),
    customers: getTableRef('customers'),
    vendors: getTableRef('vendors'),
    glAccounts: getTableRef('gLAccounts'),
    journalEntries: getTableRef('journalEntries'),
    journalEntryLines: getTableRef('journalEntryLines'),
    vatTransactions: getTableRef('vATTransactions'),
    users: getTableRef('users'),
    employees: getTableRef('hREmployees'),
    items: getTableRef('items'),
  };
}

/**
 * Generate next note number
 */
export async function generateNoteNumber(noteType: NoteType): Promise<string> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const year = new Date().getFullYear();

    // Prefix based on note type
    let prefix: string;
    if (noteType === 'ar_credit') prefix = `CN-AR-${year}-`;
    else if (noteType === 'ap_credit') prefix = `CN-AP-${year}-`;
    else if (noteType === 'ar_debit') prefix = `DN-AR-${year}-`;
    else prefix = `DN-AP-${year}-`;

    // Get the latest note number
    const result = await db
      .select({ noteNumber: tables.notes.noteNumber })
      .from(tables.notes)
      .where(like(tables.notes.noteNumber, `${prefix}%`))
      .orderBy(desc(tables.notes.id))
      .limit(1);

    if (result.length === 0) {
      return `${prefix}0001`;
    }

    const lastNumber = result[0].noteNumber;
    const sequence = parseInt(lastNumber.split('-').pop() || '0', 10);
    const nextSequence = (sequence + 1).toString().padStart(4, '0');
    return `${prefix}${nextSequence}`;
  });
}

/**
 * Create a new Credit/Debit Note
 */
export async function createNote(
  data: CreditDebitNoteCreateInput,
  createdBy: number
): Promise<number> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const noteNumber = await generateNoteNumber(data.noteType);
    const now = getNow();

    // Determine reference type and get invoice details
    const isAR = data.noteType.startsWith('ar_');
    const referenceType = isAR ? 'ar_invoice' : 'ap_invoice';

    // Get invoice details to populate customer/vendor
    let customerId: number | null = null;
    let vendorId: number | null = null;

    if (isAR) {
      const invoiceResults = await db
        .select({ customerId: tables.arInvoices.customerId })
        .from(tables.arInvoices)
        .where(eq(tables.arInvoices.id, data.referenceInvoiceId))
        .limit(1);
      if (invoiceResults.length > 0) {
        customerId = invoiceResults[0].customerId;
      }
    } else {
      const invoiceResults = await db
        .select({ vendorId: tables.apInvoices.vendorId })
        .from(tables.apInvoices)
        .where(eq(tables.apInvoices.id, data.referenceInvoiceId))
        .limit(1);
      if (invoiceResults.length > 0) {
        vendorId = invoiceResults[0].vendorId;
      }
    }

    // Calculate totals from lines
    let subtotal = 0;
    for (const line of data.lines) {
      subtotal += line.quantity * line.unitPrice;
    }

    const vatRate = 0.07; // 7% VAT
    const vatAmount = subtotal * vatRate;
    const totalAmount = subtotal + vatAmount;

    // Create note header
    const result = await db.insert(tables.notes).values({
      noteNumber,
      noteType: data.noteType,
      referenceType,
      referenceInvoiceId: data.referenceInvoiceId,
      customerId,
      vendorId,
      noteDate: toDbDate(data.noteDate),
      reasonCode: data.reasonCode,
      reasonDescription: data.reasonDescription || null,
      subtotal,
      vatRate,
      vatAmount,
      whtAmount: 0,
      totalAmount,
      status: 'draft',
      notes: data.notes || null,
      createdBy,
      createdAt: now,
      updatedAt: now,
    });

    const noteId = getInsertId(result);

    // Create lines
    for (let i = 0; i < data.lines.length; i++) {
      const line = data.lines[i];
      await db.insert(tables.lines).values({
        noteId,
        lineNumber: i + 1,
        referenceInvoiceLineId: line.referenceInvoiceLineId || null,
        itemId: line.itemId || null,
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        lineTotal: line.quantity * line.unitPrice,
        glAccountId: line.glAccountId,
        createdAt: now,
      });
    }

    return noteId;
  });
}

/**
 * Get Credit/Debit Note by ID
 */
export async function getNoteById(id: number): Promise<CreditDebitNoteWithLines | null> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    const noteResults = await db
      .select()
      .from(tables.notes)
      .where(eq(tables.notes.id, id))
      .limit(1);

    if (noteResults.length === 0) {
      return null;
    }

    const note = noteResults[0];

    // Get customer/vendor info
    let customerName: string | null = null;
    let vendorName: string | null = null;

    if (note.customerId) {
      const customerResults = await db
        .select({ name: tables.customers.name })
        .from(tables.customers)
        .where(eq(tables.customers.id, note.customerId))
        .limit(1);
      customerName = customerResults[0]?.name || null;
    }

    if (note.vendorId) {
      const vendorResults = await db
        .select({ name: tables.vendors.name })
        .from(tables.vendors)
        .where(eq(tables.vendors.id, note.vendorId))
        .limit(1);
      vendorName = vendorResults[0]?.name || null;
    }

    // Get reference invoice number
    let referenceInvoiceNumber: string | null = null;
    if (note.referenceType === 'ar_invoice') {
      const invoiceResults = await db
        .select({ invoiceNumber: tables.arInvoices.invoiceNumber })
        .from(tables.arInvoices)
        .where(eq(tables.arInvoices.id, note.referenceInvoiceId))
        .limit(1);
      referenceInvoiceNumber = invoiceResults[0]?.invoiceNumber || null;
    } else {
      const invoiceResults = await db
        .select({ invoiceNumber: tables.apInvoices.invoiceNumber })
        .from(tables.apInvoices)
        .where(eq(tables.apInvoices.id, note.referenceInvoiceId))
        .limit(1);
      referenceInvoiceNumber = invoiceResults[0]?.invoiceNumber || null;
    }

    // Get journal entry number if posted
    let journalEntryNumber: string | null = null;
    if (note.journalEntryId) {
      const jeResults = await db
        .select({ entryNumber: tables.journalEntries.entryNumber })
        .from(tables.journalEntries)
        .where(eq(tables.journalEntries.id, note.journalEntryId))
        .limit(1);
      journalEntryNumber = jeResults[0]?.entryNumber || null;
    }

    // Get lines with account info
    const lineResults = await db
      .select()
      .from(tables.lines)
      .where(eq(tables.lines.noteId, id))
      .orderBy(asc(tables.lines.lineNumber));

    const lines = await Promise.all(
      lineResults.map(async (line: any) => {
        // Get GL account info
        const accountResults = await db
          .select({
            accountCode: tables.glAccounts.accountNumber,
            accountName: tables.glAccounts.accountName,
          })
          .from(tables.glAccounts)
          .where(eq(tables.glAccounts.id, line.glAccountId))
          .limit(1);
        const account = accountResults[0] || {};

        // Get item info
        let itemCode: string | null = null;
        if (line.itemId) {
          const itemResults = await db
            .select({ code: tables.items.code })
            .from(tables.items)
            .where(eq(tables.items.id, line.itemId))
            .limit(1);
          itemCode = itemResults[0]?.code || null;
        }

        return {
          id: line.id,
          noteId: line.noteId,
          lineNumber: line.lineNumber,
          referenceInvoiceLineId: line.referenceInvoiceLineId,
          itemId: line.itemId,
          itemCode,
          description: line.description,
          quantity: Number(line.quantity),
          unitPrice: Number(line.unitPrice),
          lineTotal: Number(line.lineTotal),
          glAccountId: line.glAccountId,
          glAccountCode: account.accountCode || null,
          glAccountName: account.accountName || null,
          createdAt: line.createdAt,
        };
      })
    );

    return {
      id: note.id,
      noteNumber: note.noteNumber,
      noteType: note.noteType as NoteType,
      referenceType: note.referenceType as 'ar_invoice' | 'ap_invoice',
      referenceInvoiceId: note.referenceInvoiceId,
      referenceInvoiceNumber,
      customerId: note.customerId,
      customerName,
      vendorId: note.vendorId,
      vendorName,
      noteDate: note.noteDate,
      reasonCode: note.reasonCode as ReasonCode,
      reasonDescription: note.reasonDescription,
      subtotal: Number(note.subtotal),
      vatRate: Number(note.vatRate),
      vatAmount: Number(note.vatAmount),
      whtAmount: Number(note.whtAmount),
      totalAmount: Number(note.totalAmount),
      status: note.status as NoteStatus,
      journalEntryId: note.journalEntryId,
      journalEntryNumber,
      vatTransactionId: note.vatTransactionId,
      approvedBy: note.approvedBy,
      approvedAt: note.approvedAt,
      postedAt: note.postedAt,
      notes: note.notes,
      createdBy: note.createdBy,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      lines,
    } as CreditDebitNoteWithLines;
  });
}

/**
 * List Credit/Debit Notes with filtering
 */
export async function listNotes(filter: CreditDebitNoteListFilter): Promise<CreditDebitNoteListResponse> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const page = filter.page || 1;
    const limit = filter.limit || 20;
    const offset = (page - 1) * limit;

    // Build query conditions
    const conditions: any[] = [];

    if (filter.noteType) {
      conditions.push(eq(tables.notes.noteType, filter.noteType));
    }
    if (filter.status) {
      conditions.push(eq(tables.notes.status, filter.status));
    }
    if (filter.customerId) {
      conditions.push(eq(tables.notes.customerId, filter.customerId));
    }
    if (filter.vendorId) {
      conditions.push(eq(tables.notes.vendorId, filter.vendorId));
    }
    if (filter.dateFrom) {
      conditions.push(gte(tables.notes.noteDate, toDbDate(filter.dateFrom)));
    }
    if (filter.dateTo) {
      conditions.push(lte(tables.notes.noteDate, toDbDate(filter.dateTo)));
    }
    if (filter.search) {
      conditions.push(
        or(
          like(tables.notes.noteNumber, `%${filter.search}%`),
          like(tables.notes.reasonDescription, `%${filter.search}%`)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(tables.notes)
      .where(whereClause);
    const total = Number(countResult[0]?.count || 0);

    // Get notes
    const notes = await db
      .select()
      .from(tables.notes)
      .where(whereClause)
      .orderBy(desc(tables.notes.noteDate), desc(tables.notes.id))
      .limit(limit)
      .offset(offset);

    // Enhance with names
    const enhancedNotes = await Promise.all(
      notes.map(async (note: any) => {
        let customerName: string | null = null;
        let vendorName: string | null = null;

        if (note.customerId) {
          const customerResults = await db
            .select({ name: tables.customers.name })
            .from(tables.customers)
            .where(eq(tables.customers.id, note.customerId))
            .limit(1);
          customerName = customerResults[0]?.name || null;
        }

        if (note.vendorId) {
          const vendorResults = await db
            .select({ name: tables.vendors.name })
            .from(tables.vendors)
            .where(eq(tables.vendors.id, note.vendorId))
            .limit(1);
          vendorName = vendorResults[0]?.name || null;
        }

        return {
          ...note,
          customerName,
          vendorName,
          subtotal: Number(note.subtotal),
          vatAmount: Number(note.vatAmount),
          totalAmount: Number(note.totalAmount),
        };
      })
    );

    return {
      data: enhancedNotes,
      total,
      page,
      limit,
    };
  });
}

/**
 * Update Credit/Debit Note
 */
export async function updateNote(
  id: number,
  data: CreditDebitNoteUpdateInput
): Promise<{ success: boolean; error?: string }> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const now = getNow();

    // Check status
    const noteResults = await db
      .select({ status: tables.notes.status })
      .from(tables.notes)
      .where(eq(tables.notes.id, id))
      .limit(1);

    if (noteResults.length === 0) {
      return { success: false, error: 'Note not found' };
    }

    if (noteResults[0].status !== 'draft') {
      return { success: false, error: 'Can only update draft notes' };
    }

    const updateData: any = { updatedAt: now };

    if (data.noteDate) updateData.noteDate = toDbDate(data.noteDate);
    if (data.reasonCode) updateData.reasonCode = data.reasonCode;
    if (data.reasonDescription !== undefined) updateData.reasonDescription = data.reasonDescription;
    if (data.notes !== undefined) updateData.notes = data.notes;

    await db
      .update(tables.notes)
      .set(updateData)
      .where(eq(tables.notes.id, id));

    return { success: true };
  });
}

/**
 * Add line to note
 */
export async function addNoteLine(
  noteId: number,
  line: NoteLineCreateInput
): Promise<{ success: boolean; lineId?: number; error?: string }> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const now = getNow();

    // Check status
    const noteResults = await db
      .select({ status: tables.notes.status })
      .from(tables.notes)
      .where(eq(tables.notes.id, noteId))
      .limit(1);

    if (noteResults.length === 0) {
      return { success: false, error: 'Note not found' };
    }

    if (noteResults[0].status !== 'draft') {
      return { success: false, error: 'Can only modify draft notes' };
    }

    // Get max line number
    const maxLineResult = await db
      .select({ maxLine: sql<number>`COALESCE(MAX(line_number), 0)` })
      .from(tables.lines)
      .where(eq(tables.lines.noteId, noteId));
    const lineNumber = Number(maxLineResult[0]?.maxLine || 0) + 1;

    // Insert line
    const result = await db.insert(tables.lines).values({
      noteId,
      lineNumber,
      referenceInvoiceLineId: line.referenceInvoiceLineId || null,
      itemId: line.itemId || null,
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      lineTotal: line.quantity * line.unitPrice,
      glAccountId: line.glAccountId,
      createdAt: now,
    });

    // Update totals
    await recalculateNoteTotals(noteId);

    return { success: true, lineId: getInsertId(result) };
  });
}

/**
 * Delete line from note
 */
export async function deleteNoteLine(
  noteId: number,
  lineId: number
): Promise<{ success: boolean; error?: string }> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    // Check status
    const noteResults = await db
      .select({ status: tables.notes.status })
      .from(tables.notes)
      .where(eq(tables.notes.id, noteId))
      .limit(1);

    if (noteResults.length === 0) {
      return { success: false, error: 'Note not found' };
    }

    if (noteResults[0].status !== 'draft') {
      return { success: false, error: 'Can only modify draft notes' };
    }

    // Delete line
    await db
      .delete(tables.lines)
      .where(and(eq(tables.lines.noteId, noteId), eq(tables.lines.id, lineId)));

    // Renumber remaining lines
    const remainingLines = await db
      .select({ id: tables.lines.id })
      .from(tables.lines)
      .where(eq(tables.lines.noteId, noteId))
      .orderBy(asc(tables.lines.lineNumber));

    for (let i = 0; i < remainingLines.length; i++) {
      await db
        .update(tables.lines)
        .set({ lineNumber: i + 1 })
        .where(eq(tables.lines.id, remainingLines[i].id));
    }

    // Update totals
    await recalculateNoteTotals(noteId);

    return { success: true };
  });
}

/**
 * Recalculate note totals
 */
async function recalculateNoteTotals(noteId: number): Promise<void> {
  await executeDbOperation(async (db) => {
    const tables = getTables();
    const now = getNow();

    // Get all lines
    const lines = await db
      .select({ lineTotal: tables.lines.lineTotal })
      .from(tables.lines)
      .where(eq(tables.lines.noteId, noteId));

    let subtotal = 0;
    for (const line of lines) {
      subtotal += Number(line.lineTotal || 0);
    }

    // Get VAT rate
    const noteResults = await db
      .select({ vatRate: tables.notes.vatRate })
      .from(tables.notes)
      .where(eq(tables.notes.id, noteId))
      .limit(1);

    const vatRate = Number(noteResults[0]?.vatRate || 0.07);
    const vatAmount = subtotal * vatRate;
    const totalAmount = subtotal + vatAmount;

    await db
      .update(tables.notes)
      .set({
        subtotal,
        vatAmount,
        totalAmount,
        updatedAt: now,
      })
      .where(eq(tables.notes.id, noteId));
  });
}

/**
 * Submit note for approval
 */
export async function submitNote(
  id: number,
  userId: number
): Promise<NoteSubmitResponse> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const now = getNow();

    // Get note
    const noteResults = await db
      .select()
      .from(tables.notes)
      .where(eq(tables.notes.id, id))
      .limit(1);

    if (noteResults.length === 0) {
      return { success: false, noteId: id, noteNumber: '', error: 'Note not found' };
    }

    const note = noteResults[0];

    if (note.status !== 'draft') {
      return { success: false, noteId: id, noteNumber: note.noteNumber, error: 'Can only submit draft notes' };
    }

    // Check if has lines
    const lineCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(tables.lines)
      .where(eq(tables.lines.noteId, id));

    if (Number(lineCount[0]?.count || 0) === 0) {
      return { success: false, noteId: id, noteNumber: note.noteNumber, error: 'Note must have at least one line' };
    }

    // Update status
    await db
      .update(tables.notes)
      .set({
        status: 'submitted',
        updatedAt: now,
      })
      .where(eq(tables.notes.id, id));

    // Submit for approval
    try {
      const approvalResult = await submitForApproval({
        documentType: note.noteType === 'ar_credit' || note.noteType === 'ap_credit' ? 'credit_note' : 'debit_note',
        documentId: id,
        totalAmount: Number(note.subtotal || 0) + Number(note.vatAmount || 0),
        requesterId: userId,
      });

      return {
        success: true,
        noteId: id,
        noteNumber: note.noteNumber,
        approvalRequestId: approvalResult.requestId,
        flowName: approvalResult.flowName,
      };
    } catch {
      // If no approval workflow, auto-approve
      await db
        .update(tables.notes)
        .set({
          status: 'approved',
          approvedBy: userId,
          approvedAt: now,
          updatedAt: now,
        })
        .where(eq(tables.notes.id, id));

      return {
        success: true,
        noteId: id,
        noteNumber: note.noteNumber,
      };
    }
  });
}

/**
 * Approve note
 */
export async function approveNote(
  id: number,
  userId: number
): Promise<{ success: boolean; error?: string }> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const now = getNow();

    // Get note
    const noteResults = await db
      .select({ status: tables.notes.status, createdBy: tables.notes.createdBy })
      .from(tables.notes)
      .where(eq(tables.notes.id, id))
      .limit(1);

    if (noteResults.length === 0) {
      return { success: false, error: 'Note not found' };
    }

    if (noteResults[0].status !== 'submitted') {
      return { success: false, error: 'Can only approve submitted notes' };
    }

    if (noteResults[0].createdBy === userId) {
      return { success: false, error: 'Cannot approve own document' };
    }

    await db
      .update(tables.notes)
      .set({
        status: 'approved',
        approvedBy: userId,
        approvedAt: now,
        updatedAt: now,
      })
      .where(eq(tables.notes.id, id));

    return { success: true };
  });
}

/**
 * Post note (create journal entry and update invoice)
 */
export async function postNote(
  id: number,
  userId: number
): Promise<NotePostResult> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const now = getNow();

    // Get note with lines
    const note = await getNoteById(id);
    if (!note) {
      return { success: false, error: 'Note not found' };
    }

    if (note.status !== 'approved') {
      return { success: false, error: 'Can only post approved notes' };
    }

    // Generate journal entry number
    const year = new Date().getFullYear();
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(tables.journalEntries);
    const count = Number(countResult[0]?.count || 0) + 1;
    const entryNumber = `JE${year}-${count.toString().padStart(6, '0')}`;

    // Create journal entry
    const isAR = note.noteType.startsWith('ar_');
    const isCredit = note.noteType.includes('credit');

    // Determine accounts
    // For AR Credit Note: Dr Revenue, Dr VAT Output, Cr AR
    // For AP Credit Note: Dr AP, Cr Expense, Cr VAT Input
    // For AR Debit Note: Dr AR, Cr Revenue, Cr VAT Output
    // For AP Debit Note: Dr Expense, Dr VAT Input, Cr AP

    const jeResult = await db.insert(tables.journalEntries).values({
      entryNumber,
      entryDate: note.noteDate,
      description: `${isCredit ? 'Credit Note' : 'Debit Note'}: ${note.noteNumber}`,
      reference: note.noteNumber,
      totalDebit: note.totalAmount,
      totalCredit: note.totalAmount,
      status: 'posted',
      sourceType: note.noteType,
      sourceId: note.id,
      postedBy: userId,
      postedAt: now,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });

    const journalEntryId = getInsertId(jeResult);

    // Create journal entry lines
    let lineNumber = 0;

    if (isAR && isCredit) {
      // AR Credit Note: reduces AR and Revenue
      // Dr Revenue (reduce revenue)
      for (const line of note.lines) {
        lineNumber++;
        await db.insert(tables.journalEntryLines).values({
          journalEntryId,
          lineNumber,
          accountId: line.glAccountId, // Revenue account
          description: line.description,
          debitAmount: line.lineTotal,
          creditAmount: 0,
          createdAt: now,
        });
      }

      // Dr VAT Output (reduce VAT liability)
      if (note.vatAmount > 0) {
        lineNumber++;
        const vatOutputAccountId = 211; // VAT Output account - should be configured
        await db.insert(tables.journalEntryLines).values({
          journalEntryId,
          lineNumber,
          accountId: vatOutputAccountId,
          description: 'VAT adjustment',
          debitAmount: note.vatAmount,
          creditAmount: 0,
          createdAt: now,
        });
      }

      // Cr AR (reduce receivable)
      lineNumber++;
      const arAccountId = 103; // AR account - should be configured
      await db.insert(tables.journalEntryLines).values({
        journalEntryId,
        lineNumber,
        accountId: arAccountId,
        description: `Credit Note for ${note.referenceInvoiceNumber}`,
        debitAmount: 0,
        creditAmount: note.totalAmount,
        createdAt: now,
      });
    } else if (!isAR && isCredit) {
      // AP Credit Note: reduces AP and Expense
      // Dr AP (reduce payable)
      lineNumber++;
      const apAccountId = 201; // AP account - should be configured
      await db.insert(tables.journalEntryLines).values({
        journalEntryId,
        lineNumber,
        accountId: apAccountId,
        description: `Credit Note for ${note.referenceInvoiceNumber}`,
        debitAmount: note.totalAmount,
        creditAmount: 0,
        createdAt: now,
      });

      // Cr Expense (reduce expense)
      for (const line of note.lines) {
        lineNumber++;
        await db.insert(tables.journalEntryLines).values({
          journalEntryId,
          lineNumber,
          accountId: line.glAccountId, // Expense account
          description: line.description,
          debitAmount: 0,
          creditAmount: line.lineTotal,
          createdAt: now,
        });
      }

      // Cr VAT Input (reduce VAT asset)
      if (note.vatAmount > 0) {
        lineNumber++;
        const vatInputAccountId = 107; // VAT Input account - should be configured
        await db.insert(tables.journalEntryLines).values({
          journalEntryId,
          lineNumber,
          accountId: vatInputAccountId,
          description: 'VAT adjustment',
          debitAmount: 0,
          creditAmount: note.vatAmount,
          createdAt: now,
        });
      }
    }

    // Create VAT transaction
    const vatTransactionResult = await db.insert(tables.vatTransactions).values({
      transactionType: isAR ? 'output' : 'input',
      transactionDate: note.noteDate,
      documentType: note.noteType,
      documentId: note.id,
      documentNumber: note.noteNumber,
      vendorId: note.vendorId,
      customerId: note.customerId,
      taxableAmount: isCredit ? -note.subtotal : note.subtotal,
      vatRate: note.vatRate,
      vatAmount: isCredit ? -note.vatAmount : note.vatAmount,
      journalEntryId,
      createdBy: userId,
      createdAt: now,
    });

    const vatTransactionId = getInsertId(vatTransactionResult);

    // Update invoice balance
    let invoiceNewBalance = 0;
    if (isAR) {
      const invoiceResults = await db
        .select({ balanceDue: tables.arInvoices.balanceDue })
        .from(tables.arInvoices)
        .where(eq(tables.arInvoices.id, note.referenceInvoiceId))
        .limit(1);

      if (invoiceResults.length > 0) {
        const currentBalance = Number(invoiceResults[0].balanceDue || 0);
        invoiceNewBalance = isCredit
          ? currentBalance - note.totalAmount
          : currentBalance + note.totalAmount;

        await db
          .update(tables.arInvoices)
          .set({ balanceDue: invoiceNewBalance, updatedAt: now })
          .where(eq(tables.arInvoices.id, note.referenceInvoiceId));
      }
    } else {
      const invoiceResults = await db
        .select({ balanceDue: tables.apInvoices.balanceDue })
        .from(tables.apInvoices)
        .where(eq(tables.apInvoices.id, note.referenceInvoiceId))
        .limit(1);

      if (invoiceResults.length > 0) {
        const currentBalance = Number(invoiceResults[0].balanceDue || 0);
        invoiceNewBalance = isCredit
          ? currentBalance - note.totalAmount
          : currentBalance + note.totalAmount;

        await db
          .update(tables.apInvoices)
          .set({ balanceDue: invoiceNewBalance, updatedAt: now })
          .where(eq(tables.apInvoices.id, note.referenceInvoiceId));
      }
    }

    // Update note status
    await db
      .update(tables.notes)
      .set({
        status: 'posted',
        journalEntryId,
        vatTransactionId,
        postedAt: now,
        updatedAt: now,
      })
      .where(eq(tables.notes.id, id));

    return {
      success: true,
      journalEntryId,
      journalEntryNumber: entryNumber,
      vatTransactionId,
      invoiceNewBalance,
    };
  });
}

/**
 * Cancel note
 */
export async function cancelNote(
  id: number,
  reason: string,
  userId: number
): Promise<{ success: boolean; error?: string }> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const now = getNow();

    // Get note
    const noteResults = await db
      .select({ status: tables.notes.status })
      .from(tables.notes)
      .where(eq(tables.notes.id, id))
      .limit(1);

    if (noteResults.length === 0) {
      return { success: false, error: 'Note not found' };
    }

    if (noteResults[0].status === 'posted') {
      return { success: false, error: 'Cannot cancel posted notes' };
    }

    if (noteResults[0].status === 'cancelled') {
      return { success: false, error: 'Note is already cancelled' };
    }

    await db
      .update(tables.notes)
      .set({
        status: 'cancelled',
        notes: sql`CONCAT(COALESCE(notes, ''), '\n[CANCELLED] ', ${reason})`,
        updatedAt: now,
      })
      .where(eq(tables.notes.id, id));

    return { success: true };
  });
}

/**
 * Get invoice available for credit
 */
export async function getInvoiceAvailableForCredit(
  invoiceId: number,
  invoiceType: 'ar' | 'ap'
): Promise<InvoiceAvailableForCredit | null> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    if (invoiceType === 'ar') {
      // Get AR Invoice
      const invoiceResults = await db
        .select()
        .from(tables.arInvoices)
        .where(eq(tables.arInvoices.id, invoiceId))
        .limit(1);

      if (invoiceResults.length === 0) {
        return null;
      }

      const invoice = invoiceResults[0];

      // Get customer name
      let customerName: string | null = null;
      if (invoice.customerId) {
        const customerResults = await db
          .select({ name: tables.customers.name })
          .from(tables.customers)
          .where(eq(tables.customers.id, invoice.customerId))
          .limit(1);
        customerName = customerResults[0]?.name || null;
      }

      // Get credited amount from posted credit notes
      const creditedResult = await db
        .select({ sum: sql<number>`COALESCE(SUM(total_amount), 0)` })
        .from(tables.notes)
        .where(
          and(
            eq(tables.notes.referenceInvoiceId, invoiceId),
            eq(tables.notes.noteType, 'ar_credit'),
            eq(tables.notes.status, 'posted')
          )
        );
      const creditedAmount = Number(creditedResult[0]?.sum || 0);

      // Get invoice lines
      const lineResults = await db
        .select()
        .from(tables.arInvoiceLines)
        .where(eq(tables.arInvoiceLines.invoiceId, invoiceId))
        .orderBy(asc(tables.arInvoiceLines.lineNumber));

      const lines: InvoiceLineAvailableForCredit[] = await Promise.all(
        lineResults.map(async (line: any) => {
          // Get credited quantity for this line
          const creditedQtyResult = await db
            .select({ sum: sql<number>`COALESCE(SUM(quantity), 0)` })
            .from(tables.lines)
            .innerJoin(tables.notes, eq(tables.lines.noteId, tables.notes.id))
            .where(
              and(
                eq(tables.lines.referenceInvoiceLineId, line.id),
                eq(tables.notes.status, 'posted')
              )
            );
          const creditedQuantity = Number(creditedQtyResult[0]?.sum || 0);

          return {
            lineId: line.id,
            itemId: line.itemId,
            description: line.description,
            originalQuantity: Number(line.quantity),
            creditedQuantity,
            availableQuantity: Number(line.quantity) - creditedQuantity,
            unitPrice: Number(line.unitPrice),
            glAccountId: line.glAccountId || 400, // Default revenue account
          };
        })
      );

      return {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.invoiceDate,
        originalAmount: Number(invoice.totalAmount),
        paidAmount: Number(invoice.totalAmount) - Number(invoice.balanceDue),
        creditedAmount,
        availableForCredit: Number(invoice.balanceDue) - creditedAmount,
        customerId: invoice.customerId,
        customerName,
        vendorId: null,
        vendorName: null,
        lines,
      };
    } else {
      // Get AP Invoice
      const invoiceResults = await db
        .select()
        .from(tables.apInvoices)
        .where(eq(tables.apInvoices.id, invoiceId))
        .limit(1);

      if (invoiceResults.length === 0) {
        return null;
      }

      const invoice = invoiceResults[0];

      // Get vendor name
      let vendorName: string | null = null;
      if (invoice.vendorId) {
        const vendorResults = await db
          .select({ name: tables.vendors.name })
          .from(tables.vendors)
          .where(eq(tables.vendors.id, invoice.vendorId))
          .limit(1);
        vendorName = vendorResults[0]?.name || null;
      }

      // Get credited amount from posted credit notes
      const creditedResult = await db
        .select({ sum: sql<number>`COALESCE(SUM(total_amount), 0)` })
        .from(tables.notes)
        .where(
          and(
            eq(tables.notes.referenceInvoiceId, invoiceId),
            eq(tables.notes.noteType, 'ap_credit'),
            eq(tables.notes.status, 'posted')
          )
        );
      const creditedAmount = Number(creditedResult[0]?.sum || 0);

      // Get invoice lines
      const lineResults = await db
        .select()
        .from(tables.apInvoiceLines)
        .where(eq(tables.apInvoiceLines.invoiceId, invoiceId))
        .orderBy(asc(tables.apInvoiceLines.lineNumber));

      const lines: InvoiceLineAvailableForCredit[] = await Promise.all(
        lineResults.map(async (line: any) => {
          // Get credited quantity for this line
          const creditedQtyResult = await db
            .select({ sum: sql<number>`COALESCE(SUM(quantity), 0)` })
            .from(tables.lines)
            .innerJoin(tables.notes, eq(tables.lines.noteId, tables.notes.id))
            .where(
              and(
                eq(tables.lines.referenceInvoiceLineId, line.id),
                eq(tables.notes.status, 'posted')
              )
            );
          const creditedQuantity = Number(creditedQtyResult[0]?.sum || 0);

          return {
            lineId: line.id,
            itemId: line.itemId,
            description: line.description,
            originalQuantity: Number(line.quantity),
            creditedQuantity,
            availableQuantity: Number(line.quantity) - creditedQuantity,
            unitPrice: Number(line.unitPrice),
            glAccountId: line.glAccountId || 500, // Default expense account
          };
        })
      );

      return {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.invoiceDate,
        originalAmount: Number(invoice.totalAmount),
        paidAmount: Number(invoice.totalAmount) - Number(invoice.balanceDue),
        creditedAmount,
        availableForCredit: Number(invoice.balanceDue) - creditedAmount,
        customerId: null,
        customerName: null,
        vendorId: invoice.vendorId,
        vendorName,
        lines,
      };
    }
  });
}

/**
 * Get dashboard summary
 */
export async function getCreditDebitNoteDashboard(): Promise<CreditDebitNoteDashboardSummary> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    // Draft count
    const draftResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(tables.notes)
      .where(eq(tables.notes.status, 'draft'));
    const draftCount = Number(draftResult[0]?.count || 0);

    // Pending approval count
    const pendingResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(tables.notes)
      .where(eq(tables.notes.status, 'submitted'));
    const pendingApprovalCount = Number(pendingResult[0]?.count || 0);

    // Posted this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const postedResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(tables.notes)
      .where(
        and(
          eq(tables.notes.status, 'posted'),
          gte(tables.notes.postedAt, toDbDate(startOfMonth.toISOString().split('T')[0]))
        )
      );
    const postedThisMonth = Number(postedResult[0]?.count || 0);

    // Total credited/debited this month
    const creditedResult = await db
      .select({ sum: sql<number>`COALESCE(SUM(total_amount), 0)` })
      .from(tables.notes)
      .where(
        and(
          eq(tables.notes.status, 'posted'),
          or(eq(tables.notes.noteType, 'ar_credit'), eq(tables.notes.noteType, 'ap_credit')),
          gte(tables.notes.postedAt, toDbDate(startOfMonth.toISOString().split('T')[0]))
        )
      );
    const totalCreditedThisMonth = Number(creditedResult[0]?.sum || 0);

    const debitedResult = await db
      .select({ sum: sql<number>`COALESCE(SUM(total_amount), 0)` })
      .from(tables.notes)
      .where(
        and(
          eq(tables.notes.status, 'posted'),
          or(eq(tables.notes.noteType, 'ar_debit'), eq(tables.notes.noteType, 'ap_debit')),
          gte(tables.notes.postedAt, toDbDate(startOfMonth.toISOString().split('T')[0]))
        )
      );
    const totalDebitedThisMonth = Number(debitedResult[0]?.sum || 0);

    // Recent notes
    const recentNotes = await db
      .select()
      .from(tables.notes)
      .orderBy(desc(tables.notes.createdAt))
      .limit(5);

    return {
      draftCount,
      pendingApprovalCount,
      postedThisMonth,
      totalCreditedThisMonth,
      totalDebitedThisMonth,
      recentNotes: recentNotes.map((note: any) => ({
        ...note,
        subtotal: Number(note.subtotal),
        vatAmount: Number(note.vatAmount),
        totalAmount: Number(note.totalAmount),
      })),
    };
  });
}

/**
 * Reject Note (return to draft status)
 */
export async function rejectNote(id: number): Promise<{ success: boolean; error?: string }> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const now = getNow();

    // Check status
    const noteResult = await db
      .select({ status: tables.notes.status })
      .from(tables.notes)
      .where(eq(tables.notes.id, id))
      .limit(1);

    if (noteResult.length === 0) {
      return { success: false, error: 'Note not found' };
    }

    if (noteResult[0].status !== 'submitted') {
      return { success: false, error: 'Can only reject submitted notes' };
    }

    await db
      .update(tables.notes)
      .set({ status: 'draft', updatedAt: now })
      .where(eq(tables.notes.id, id));

    return { success: true };
  });
}

/**
 * Delete Note (only draft notes)
 */
export async function deleteNote(id: number): Promise<{ success: boolean; error?: string }> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    // Check status
    const noteResult = await db
      .select({ status: tables.notes.status })
      .from(tables.notes)
      .where(eq(tables.notes.id, id))
      .limit(1);

    if (noteResult.length === 0) {
      return { success: false, error: 'Note not found' };
    }

    if (noteResult[0].status !== 'draft') {
      return { success: false, error: 'Can only delete draft notes' };
    }

    // Delete lines first
    await db.delete(tables.lines).where(eq(tables.lines.noteId, id));

    // Delete note
    await db.delete(tables.notes).where(eq(tables.notes.id, id));

    return { success: true };
  });
}

/**
 * Get Note Summary for Dashboard Widget
 */
export async function getNoteSummary(): Promise<NoteSummary> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    // Get counts by status
    const draftResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(tables.notes)
      .where(eq(tables.notes.status, 'draft'));
    const draftCount = Number(draftResult[0]?.count || 0);

    const pendingResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(tables.notes)
      .where(eq(tables.notes.status, 'submitted'));
    const pendingApprovalCount = Number(pendingResult[0]?.count || 0);

    // Posted this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const postedResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(tables.notes)
      .where(
        and(
          eq(tables.notes.status, 'posted'),
          gte(tables.notes.postedAt, toDbDate(startOfMonth.toISOString().split('T')[0]))
        )
      );
    const postedThisMonth = Number(postedResult[0]?.count || 0);

    // Total amount this month
    const totalResult = await db
      .select({ total: sql<number>`COALESCE(SUM(total_amount), 0)` })
      .from(tables.notes)
      .where(
        and(
          eq(tables.notes.status, 'posted'),
          gte(tables.notes.postedAt, toDbDate(startOfMonth.toISOString().split('T')[0]))
        )
      );
    const totalThisMonth = Number(totalResult[0]?.total || 0);

    // Counts by type
    const arCreditResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(tables.notes)
      .where(eq(tables.notes.noteType, 'ar_credit'));
    const arCredit = Number(arCreditResult[0]?.count || 0);

    const apCreditResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(tables.notes)
      .where(eq(tables.notes.noteType, 'ap_credit'));
    const apCredit = Number(apCreditResult[0]?.count || 0);

    const arDebitResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(tables.notes)
      .where(eq(tables.notes.noteType, 'ar_debit'));
    const arDebit = Number(arDebitResult[0]?.count || 0);

    const apDebitResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(tables.notes)
      .where(eq(tables.notes.noteType, 'ap_debit'));
    const apDebit = Number(apDebitResult[0]?.count || 0);

    return {
      draftCount,
      pendingApprovalCount,
      postedThisMonth,
      totalThisMonth,
      byType: {
        arCredit,
        apCredit,
        arDebit,
        apDebit,
      },
    };
  });
}

/**
 * Get Reference Invoices for Selection
 */
export async function getReferenceInvoices(
  type: 'ar' | 'ap',
  customerId?: number,
  vendorId?: number
): Promise<InvoiceReference[]> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    if (type === 'ar') {
      const conditions: any[] = [eq(tables.arInvoices.status, 'posted')];
      if (customerId) {
        conditions.push(eq(tables.arInvoices.customerId, customerId));
      }

      const invoices = await db
        .select({
          id: tables.arInvoices.id,
          invoiceNumber: tables.arInvoices.invoiceNumber,
          invoiceDate: tables.arInvoices.invoiceDate,
          totalAmount: tables.arInvoices.totalAmount,
          customerName: tables.customers.name,
        })
        .from(tables.arInvoices)
        .leftJoin(tables.customers, eq(tables.arInvoices.customerId, tables.customers.id))
        .where(and(...conditions))
        .orderBy(desc(tables.arInvoices.invoiceDate))
        .limit(100);

      return invoices.map((inv: any) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate,
        totalAmount: Number(inv.totalAmount || 0),
        currency: 'THB',
        customerOrVendorName: inv.customerName || '',
        type: 'ar' as const,
      }));
    } else {
      const conditions: any[] = [eq(tables.apInvoices.status, 'posted')];
      if (vendorId) {
        conditions.push(eq(tables.apInvoices.vendorId, vendorId));
      }

      const invoices = await db
        .select({
          id: tables.apInvoices.id,
          invoiceNumber: tables.apInvoices.invoiceNumber,
          invoiceDate: tables.apInvoices.invoiceDate,
          totalAmount: tables.apInvoices.totalAmount,
          vendorName: tables.vendors.name,
        })
        .from(tables.apInvoices)
        .leftJoin(tables.vendors, eq(tables.apInvoices.vendorId, tables.vendors.id))
        .where(and(...conditions))
        .orderBy(desc(tables.apInvoices.invoiceDate))
        .limit(100);

      return invoices.map((inv: any) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate,
        totalAmount: Number(inv.totalAmount || 0),
        currency: 'THB',
        customerOrVendorName: inv.vendorName || '',
        type: 'ap' as const,
      }));
    }
  });
}

/**
 * Get Invoice Lines for Selection
 */
export async function getInvoiceLines(
  type: 'ar' | 'ap',
  invoiceId: number
): Promise<InvoiceLineReference[]> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    if (type === 'ar') {
      const lines = await db
        .select({
          id: tables.arInvoiceLines.id,
          lineNumber: tables.arInvoiceLines.lineNumber,
          itemId: tables.arInvoiceLines.itemId,
          description: tables.arInvoiceLines.description,
          quantity: tables.arInvoiceLines.quantity,
          unitPrice: tables.arInvoiceLines.unitPrice,
          lineTotal: tables.arInvoiceLines.lineTotal,
          itemCode: tables.items.itemCode,
          itemName: tables.items.name,
        })
        .from(tables.arInvoiceLines)
        .leftJoin(tables.items, eq(tables.arInvoiceLines.itemId, tables.items.id))
        .where(eq(tables.arInvoiceLines.invoiceId, invoiceId))
        .orderBy(asc(tables.arInvoiceLines.lineNumber));

      return lines.map((line: any) => ({
        id: line.id,
        lineNumber: line.lineNumber,
        itemId: line.itemId,
        itemCode: line.itemCode,
        itemName: line.itemName,
        description: line.description,
        quantity: Number(line.quantity || 0),
        unitPrice: Number(line.unitPrice || 0),
        lineTotal: Number(line.lineTotal || 0),
      }));
    } else {
      const lines = await db
        .select({
          id: tables.apInvoiceLines.id,
          lineNumber: tables.apInvoiceLines.lineNumber,
          itemId: tables.apInvoiceLines.itemId,
          description: tables.apInvoiceLines.description,
          quantity: tables.apInvoiceLines.quantity,
          unitPrice: tables.apInvoiceLines.unitPrice,
          lineTotal: tables.apInvoiceLines.lineTotal,
          itemCode: tables.items.itemCode,
          itemName: tables.items.name,
        })
        .from(tables.apInvoiceLines)
        .leftJoin(tables.items, eq(tables.apInvoiceLines.itemId, tables.items.id))
        .where(eq(tables.apInvoiceLines.invoiceId, invoiceId))
        .orderBy(asc(tables.apInvoiceLines.lineNumber));

      return lines.map((line: any) => ({
        id: line.id,
        lineNumber: line.lineNumber,
        itemId: line.itemId,
        itemCode: line.itemCode,
        itemName: line.itemName,
        description: line.description,
        quantity: Number(line.quantity || 0),
        unitPrice: Number(line.unitPrice || 0),
        lineTotal: Number(line.lineTotal || 0),
      }));
    }
  });
}
