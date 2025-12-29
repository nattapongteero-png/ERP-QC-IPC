/**
 * Cancel Note API (T092)
 */

import { NextRequest, NextResponse } from 'next/server';
import { cancelNote } from '@/lib/services/credit-debit-notes.service';
import { noteCancelSchema } from '@/lib/validation/credit-debit-note';

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

    const body = await request.json();
    const data = noteCancelSchema.parse({ noteId, ...body });

    // TODO: Get actual user ID from session
    const userId = 1;

    const result = await cancelNote(noteId, data.reason, userId);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error cancelling note:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 400 }
    );
  }
}
