/**
 * Debit Note Detail API - Get, Update (T091)
 * Part of 011-accounting-spec-gap - User Story 3
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import {
  creditDebitNoteUpdateSchema,
} from '@/lib/validation/credit-debit-notes';
import {
  getNoteById,
  updateNote,
} from '@/lib/services/credit-debit-notes.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
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

      const note = await getNoteById(noteId);

      if (!note) {
        return NextResponse.json(
          { success: false, error: 'Note not found' },
          { status: 404 }
        );
      }

      // Verify it's a debit note
      if (!note.noteType.includes('debit')) {
        return NextResponse.json(
          { success: false, error: 'Not a debit note' },
          { status: 400 }
        );
      }

      return NextResponse.json({ success: true, data: note });
    } catch (error) {
      console.error('Error getting debit note:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to get debit note' },
        { status: 500 }
      );
    }

  });
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
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

      const body = await request.json();
      const data = creditDebitNoteUpdateSchema.parse(body);

      const result = await updateNote(noteId, data);

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        );
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Error updating debit note:', error);
      if (error instanceof Error && error.name === 'ZodError') {
        return NextResponse.json(
          { success: false, error: 'Invalid input data' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { success: false, error: 'Failed to update debit note' },
        { status: 500 }
      );
    }

  });
}
