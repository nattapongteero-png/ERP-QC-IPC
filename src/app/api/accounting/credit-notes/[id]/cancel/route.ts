/**
 * Credit Note Cancel API (T088)
 * Part of 011-accounting-spec-gap - User Story 3
 */

import { NextRequest, NextResponse } from 'next/server';
import { noteCancelSchema } from '@/lib/validation/credit-debit-notes';
import { cancelNote } from '@/lib/services/credit-debit-notes.service';

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

    const body = await request.json();
    const { reason } = noteCancelSchema.parse(body);

    // TODO: Get user ID from session
    const userId = 1;

    const result = await cancelNote(noteId, reason, userId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error cancelling credit note:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Reason is required' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Failed to cancel credit note' },
      { status: 500 }
    );
  }
}
