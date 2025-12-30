/**
 * Reject Note API (T090)
 */

import { NextRequest, NextResponse } from 'next/server';
import { rejectNote } from '@/lib/services/credit-debit-notes.service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const noteId = parseInt(id, 10);

    if (isNaN(noteId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid note ID' },
        { status: 400 }
      );
    }

    const result = await rejectNote(noteId);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error rejecting note:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
