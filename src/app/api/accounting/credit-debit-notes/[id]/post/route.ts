/**
 * Post Note to GL API (T091)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import { postNote } from '@/lib/services/credit-debit-notes.service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await context.params;
      const noteId = parseInt(id, 10);

      if (isNaN(noteId)) {
        return NextResponse.json(
          { success: false, error: 'Invalid note ID' },
          { status: 400 }
        );
      }

      // TODO: Get actual user ID from session
      const userId = session.userId;

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
      });
    } catch (error) {
      console.error('Error posting note:', error);
      return NextResponse.json(
        { success: false, error: (error as Error).message },
        { status: 500 }
      );
    }

  });
}
