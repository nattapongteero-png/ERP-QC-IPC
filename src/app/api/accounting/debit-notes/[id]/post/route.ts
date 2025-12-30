/**
 * Debit Note Post API (T092)
 * Part of 011-accounting-spec-gap - User Story 3
 */

import { NextRequest, NextResponse } from 'next/server';
import { postNote } from '@/lib/services/credit-debit-notes.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const noteId = parseInt(id, 10);

    if (isNaN(noteId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid note ID' },
        { status: 400 }
      );
    }

    // TODO: Get user ID from session
    const userId = 1;

    const result = await postNote(noteId, userId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      journalEntryId: result.journalEntryId,
      journalEntryNumber: result.journalEntryNumber,
      vatTransactionId: result.vatTransactionId,
      invoiceNewBalance: result.invoiceNewBalance,
    });
  } catch (error) {
    console.error('Error posting debit note:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to post debit note' },
      { status: 500 }
    );
  }
}
