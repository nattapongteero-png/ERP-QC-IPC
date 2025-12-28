/**
 * Credit/Debit Note Service (T079-T085)
 * Part of 011-accounting-spec-gap - User Story 3
 */

import { eq, and, or, like, gte, lte, desc, asc, sql } from 'drizzle-orm';
import { getTableRef, getInsertId, executeDbOperation } from '../db/db-helper';
import { getNow, toDbDate, formatDateFromDb } from '../db/date-utils';
import type {
  CreditDebitNote,
  CreditDebitNoteLine,
  CreditDebitNoteWithLines,
  NoteType,
  NoteStatus,
  NoteListFilter,
  NoteListResponse,
  NoteSummary,
  InvoiceReference,
  InvoiceLineReference,
} from '@/types/credit-debit-note';
import type {
  NoteCreateInput,
  NoteUpdateInput,
  NoteLineInput,
} from '@/lib/validation/credit-debit-note';

/**
 * Get table references
 */
function getTables() {
  return {
    notes: getTableRef('creditDebitNotes'),
    lines: getTableRef('creditDebitNoteLines'),
    customers: getTableRef('customers'),
    vendors: getTableRef('vendors'),
    items: getTableRef('items'),
    glAccounts: getTableRef('gLAccounts'),
    arInvoices: getTableRef('aRInvoices'),
    arInvoiceLines: getTableRef('aRInvoiceLines'),
    apInvoices: getTableRef('aPInvoices'),
    apInvoiceLines: getTableRef('aPInvoiceLines'),
    journalEntries: getTableRef('journalEntries'),
    journalEntryLines: getTableRef('journalEntryLines'),
    vatTransactions: getTableRef('vATTransactions'),
    employees: getTableRef('hREmployees'),
  };
}

/**
 * Generate next note number
 */
export async function generateNoteNumber(noteType: NoteType): Promise<string> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const year = new Date().getFullYear();
    const typePrefix = noteType.toUpperCase().replace('_', '-');
    const prefix = `${typePrefix}${year}-`;

    // Get the latest note number for the current year and type
    const result = await db
      .select({ noteNumber: tables.notes.noteNumber })
      .from(tables.notes)
      .where(
        and(
          eq(tables.notes.noteType, noteType),
          like(tables.notes.noteNumber, `${prefix}%`)
        )
      )
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
 * Calculate note totals from lines
 */
function calculateTotals(
  lines: NoteLineInput[],
  vatRate: number
): { subtotal: number; vatAmount: number; totalAmount: number } {
  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  const vatAmount = subtotal * vatRate;
  const totalAmount = subtotal + vatAmount;
  return { subtotal, vatAmount, totalAmount };
}

/**
 * Create a new Credit/Debit Note
 */
export async function createNote(
  data: NoteCreateInput,
  createdBy: number
): Promise<number> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const noteNumber = await generateNoteNumber(data.noteType);
    const now = getNow();
    const vatRate = data.vatRate ?? 0.07;
    const totals = calculateTotals(data.lines, vatRate);

    // Create note header
    const noteResult = await db.insert(tables.notes).values({
      noteNumber,
      noteType: data.noteType,
      referenceType: data.referenceType,
      referenceInvoiceId: data.referenceInvoiceId,
      customerId: data.customerId || null,
      vendorId: data.vendorId || null,
      noteDate: toDbDate(data.noteDate),
      reasonCode: data.reasonCode,
      reasonDescription: data.reasonDescription || null,
      subtotal: totals.subtotal,
      vatRate,
      vatAmount: totals.vatAmount,
      whtAmount: 0,
      totalAmount: totals.totalAmount,
      status: 'draft',
      notes: data.notes || null,
      createdBy,
      createdAt: now,
      updatedAt: now,
    });

    const noteId = getInsertId(noteResult);

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
 * Get Note by ID
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

    // Get customer/vendor name
    let customerName = '';
    let vendorName = '';
    let referenceInvoiceNumber = '';

    if (note.customerId) {
      const custResult = await db
        .select({ name: tables.customers.name })
        .from(tables.customers)
        .where(eq(tables.customers.id, note.customerId))
        .limit(1);
      if (custResult.length > 0) {
        customerName = custResult[0].name || '';
      }
    }

    if (note.vendorId) {
      const vendResult = await db
        .select({ name: tables.vendors.name })
        .from(tables.vendors)
        .where(eq(tables.vendors.id, note.vendorId))
        .limit(1);
      if (vendResult.length > 0) {
        vendorName = vendResult[0].name || '';
      }
    }

    // Get reference invoice number
    if (note.referenceType === 'ar_invoice') {
      const invResult = await db
        .select({ invoiceNumber: tables.arInvoices.invoiceNumber })
        .from(tables.arInvoices)
        .where(eq(tables.arInvoices.id, note.referenceInvoiceId))
        .limit(1);
      if (invResult.length > 0) {
        referenceInvoiceNumber = invResult[0].invoiceNumber || '';
      }
    } else {
      const invResult = await db
        .select({ invoiceNumber: tables.apInvoices.invoiceNumber })
        .from(tables.apInvoices)
        .where(eq(tables.apInvoices.id, note.referenceInvoiceId))
        .limit(1);
      if (invResult.length > 0) {
        referenceInvoiceNumber = invResult[0].invoiceNumber || '';
      }
    }

    // Get approver name
    let approvedByName = '';
    if (note.approvedBy) {
      const empResult = await db
        .select({ nameEn: tables.employees.nameEn })
        .from(tables.employees)
        .where(eq(tables.employees.id, note.approvedBy))
        .limit(1);
      if (empResult.length > 0) {
        approvedByName = empResult[0].nameEn || '';
      }
    }

    // Get lines with item and account info
    const linesResults = await db
      .select({
        id: tables.lines.id,
        noteId: tables.lines.noteId,
        lineNumber: tables.lines.lineNumber,
        referenceInvoiceLineId: tables.lines.referenceInvoiceLineId,
        itemId: tables.lines.itemId,
        description: tables.lines.description,
        quantity: tables.lines.quantity,
        unitPrice: tables.lines.unitPrice,
        lineTotal: tables.lines.lineTotal,
        glAccountId: tables.lines.glAccountId,
        createdAt: tables.lines.createdAt,
        itemCode: tables.items.itemCode,
        itemName: tables.items.name,
        glAccountNumber: tables.glAccounts.accountNumber,
        glAccountName: tables.glAccounts.accountName,
      })
      .from(tables.lines)
      .leftJoin(tables.items, eq(tables.lines.itemId, tables.items.id))
      .leftJoin(tables.glAccounts, eq(tables.lines.glAccountId, tables.glAccounts.id))
      .where(eq(tables.lines.noteId, id))
      .orderBy(asc(tables.lines.lineNumber));

    return {
      ...note,
      customerName,
      vendorName,
      referenceInvoiceNumber,
      approvedByName,
      lines: linesResults as CreditDebitNoteLine[],
    } as CreditDebitNoteWithLines;
  });
}

/**
 * List Notes with filtering
 */
export async function listNotes(filter: NoteListFilter): Promise<NoteListResponse> {
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
    if (filter.referenceType) {
      conditions.push(eq(tables.notes.referenceType, filter.referenceType));
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
    if (filter.fromDate) {
      conditions.push(gte(tables.notes.noteDate, toDbDate(filter.fromDate)));
    }
    if (filter.toDate) {
      conditions.push(lte(tables.notes.noteDate, toDbDate(filter.toDate)));
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
      .select({
        id: tables.notes.id,
        noteNumber: tables.notes.noteNumber,
        noteType: tables.notes.noteType,
        referenceType: tables.notes.referenceType,
        referenceInvoiceId: tables.notes.referenceInvoiceId,
        customerId: tables.notes.customerId,
        vendorId: tables.notes.vendorId,
        noteDate: tables.notes.noteDate,
        reasonCode: tables.notes.reasonCode,
        reasonDescription: tables.notes.reasonDescription,
        subtotal: tables.notes.subtotal,
        vatRate: tables.notes.vatRate,
        vatAmount: tables.notes.vatAmount,
        whtAmount: tables.notes.whtAmount,
        totalAmount: tables.notes.totalAmount,
        status: tables.notes.status,
        approvedBy: tables.notes.approvedBy,
        approvedAt: tables.notes.approvedAt,
        postedAt: tables.notes.postedAt,
        createdBy: tables.notes.createdBy,
        createdAt: tables.notes.createdAt,
        updatedAt: tables.notes.updatedAt,
        customerName: tables.customers.name,
        vendorName: tables.vendors.name,
      })
      .from(tables.notes)
      .leftJoin(tables.customers, eq(tables.notes.customerId, tables.customers.id))
      .leftJoin(tables.vendors, eq(tables.notes.vendorId, tables.vendors.id))
      .where(whereClause)
      .orderBy(desc(tables.notes.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      data: notes as CreditDebitNote[],
      total,
      page,
      limit,
    };
  });
}

/**
 * Update Note (draft only)
 */
export async function updateNote(
  id: number,
  data: NoteUpdateInput
): Promise<{ success: boolean; error?: string }> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const now = getNow();

    // Check status
    const noteResult = await db
      .select({ status: tables.notes.status, vatRate: tables.notes.vatRate })
      .from(tables.notes)
      .where(eq(tables.notes.id, id))
      .limit(1);

    if (noteResult.length === 0) {
      return { success: false, error: 'Note not found' };
    }

    if (noteResult[0].status !== 'draft') {
      return { success: false, error: 'Can only update draft notes' };
    }

    const vatRate = data.vatRate ?? Number(noteResult[0].vatRate);

    // Update header
    const updateData: any = { updatedAt: now };

    if (data.noteDate) updateData.noteDate = toDbDate(data.noteDate);
    if (data.reasonCode) updateData.reasonCode = data.reasonCode;
    if (data.reasonDescription !== undefined) updateData.reasonDescription = data.reasonDescription;
    if (data.vatRate !== undefined) updateData.vatRate = data.vatRate;
    if (data.notes !== undefined) updateData.notes = data.notes;

    // If lines are provided, update totals
    if (data.lines && data.lines.length > 0) {
      const totals = calculateTotals(data.lines, vatRate);
      updateData.subtotal = totals.subtotal;
      updateData.vatAmount = totals.vatAmount;
      updateData.totalAmount = totals.totalAmount;

      // Delete existing lines
      await db.delete(tables.lines).where(eq(tables.lines.noteId, id));

      // Insert new lines
      for (let i = 0; i < data.lines.length; i++) {
        const line = data.lines[i];
        await db.insert(tables.lines).values({
          noteId: id,
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
    }

    await db.update(tables.notes).set(updateData).where(eq(tables.notes.id, id));

    return { success: true };
  });
}

/**
 * Submit Note for Approval
 */
export async function submitNote(id: number): Promise<{ success: boolean; error?: string }> {
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

    if (noteResult[0].status !== 'draft') {
      return { success: false, error: 'Can only submit draft notes' };
    }

    await db
      .update(tables.notes)
      .set({ status: 'submitted', updatedAt: now })
      .where(eq(tables.notes.id, id));

    return { success: true };
  });
}

/**
 * Approve Note
 */
export async function approveNote(
  id: number,
  approvedBy: number
): Promise<{ success: boolean; error?: string }> {
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
      return { success: false, error: 'Can only approve submitted notes' };
    }

    await db
      .update(tables.notes)
      .set({
        status: 'approved',
        approvedBy,
        approvedAt: now,
        updatedAt: now,
      })
      .where(eq(tables.notes.id, id));

    return { success: true };
  });
}

/**
 * Reject Note (back to draft)
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
 * Post Note to GL
 */
export async function postNote(
  id: number,
  postedBy: number
): Promise<{ success: boolean; journalEntryId?: number; error?: string }> {
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
    const jeResult = await db.insert(tables.journalEntries).values({
      entryNumber,
      entryDate: note.noteDate,
      description: `${note.noteType.toUpperCase()} ${note.noteNumber}: ${note.reasonDescription || note.reasonCode}`,
      reference: note.noteNumber,
      totalDebit: note.totalAmount,
      totalCredit: note.totalAmount,
      status: 'posted',
      sourceType: 'credit_debit_note',
      sourceId: id,
      postedBy,
      postedAt: now,
      createdBy: postedBy,
      createdAt: now,
      updatedAt: now,
    });

    const journalEntryId = getInsertId(jeResult);

    // Create journal entry lines based on note type
    let lineNumber = 0;

    if (note.noteType === 'ar_credit' || note.noteType === 'ap_debit') {
      // Credit AR/Debit AP - reduce AR, or increase AP
      // Debit: Revenue/Expense accounts (from lines)
      // Credit: AR/AP control account
      for (const line of note.lines) {
        lineNumber++;
        await db.insert(tables.journalEntryLines).values({
          journalEntryId,
          lineNumber,
          accountId: line.glAccountId,
          description: line.description,
          debitAmount: line.lineTotal,
          creditAmount: 0,
          createdAt: now,
        });
      }

      // Credit AR/AP control account (need to get from settings or config)
      lineNumber++;
      const arApAccountId = note.noteType === 'ar_credit' ? 1100 : 2100; // Placeholder
      await db.insert(tables.journalEntryLines).values({
        journalEntryId,
        lineNumber,
        accountId: arApAccountId,
        description: `${note.noteNumber} - ${note.customerName || note.vendorName}`,
        debitAmount: 0,
        creditAmount: note.subtotal,
        createdAt: now,
      });
    } else {
      // Debit AR/Credit AP - increase AR, or reduce AP
      // Debit: AR/AP control account
      // Credit: Revenue/Expense accounts (from lines)
      const arApAccountId = note.noteType === 'ar_debit' ? 1100 : 2100; // Placeholder
      lineNumber++;
      await db.insert(tables.journalEntryLines).values({
        journalEntryId,
        lineNumber,
        accountId: arApAccountId,
        description: `${note.noteNumber} - ${note.customerName || note.vendorName}`,
        debitAmount: note.subtotal,
        creditAmount: 0,
        createdAt: now,
      });

      for (const line of note.lines) {
        lineNumber++;
        await db.insert(tables.journalEntryLines).values({
          journalEntryId,
          lineNumber,
          accountId: line.glAccountId,
          description: line.description,
          debitAmount: 0,
          creditAmount: line.lineTotal,
          createdAt: now,
        });
      }
    }

    // Update note status
    await db
      .update(tables.notes)
      .set({
        status: 'posted',
        journalEntryId,
        postedAt: now,
        updatedAt: now,
      })
      .where(eq(tables.notes.id, id));

    return { success: true, journalEntryId };
  });
}

/**
 * Cancel Note
 */
export async function cancelNote(
  id: number,
  reason: string
): Promise<{ success: boolean; error?: string }> {
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

    if (noteResult[0].status === 'posted') {
      return { success: false, error: 'Cannot cancel posted notes' };
    }

    await db
      .update(tables.notes)
      .set({
        status: 'cancelled',
        notes: reason,
        updatedAt: now,
      })
      .where(eq(tables.notes.id, id));

    return { success: true };
  });
}

/**
 * Delete Note (draft only)
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
 * Get Note Summary for Dashboard
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
