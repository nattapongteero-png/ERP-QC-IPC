/**
 * Credit/Debit Note Detail API (T087)
 * GET /api/accounting/credit-debit-notes/[id] - Get note with lines
 * PUT /api/accounting/credit-debit-notes/[id] - Update note
 * DELETE /api/accounting/credit-debit-notes/[id] - Delete note
 */

import { NextRequest, NextResponse } from 'next/server';
import { getNoteById, updateNote, deleteNote } from '@/lib/services/credit-debit-notes.service';
import { noteUpdateSchema } from '@/lib/validation/credit-debit-note';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
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

    return NextResponse.json({ success: true, data: note });
  } catch (error) {
    console.error('Error getting credit/debit note:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
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
    const data = noteUpdateSchema.parse(body);

    const result = await updateNote(noteId, data);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating credit/debit note:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 400 }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const noteId = parseInt(id, 10);

    if (isNaN(noteId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid note ID' },
        { status: 400 }
      );
    }

    const result = await deleteNote(noteId);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting credit/debit note:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
