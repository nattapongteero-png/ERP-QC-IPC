/**
 * Credit Note Submit API (T085)
 * Part of 011-accounting-spec-gap - User Story 3
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import { submitNote } from '@/lib/services/credit-debit-notes.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (session) => {
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
      const userId = session.userId;

      const result = await submitNote(noteId, userId);

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        noteId: result.noteId,
        noteNumber: result.noteNumber,
        approvalRequestId: result.approvalRequestId,
        flowName: result.flowName,
      });
    } catch (error) {
      console.error('Error submitting credit note:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to submit credit note' },
        { status: 500 }
      );
    }

  });
}
