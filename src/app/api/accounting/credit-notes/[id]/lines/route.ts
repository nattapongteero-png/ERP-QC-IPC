/**
 * Credit Note Lines API (T089)
 * Part of 011-accounting-spec-gap - User Story 3
 */

import { NextRequest, NextResponse } from 'next/server';
import { noteLineCreateSchema } from '@/lib/validation/credit-debit-notes';
import {
  addNoteLine,
  deleteNoteLine,
} from '@/lib/services/credit-debit-notes.service';

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
    const line = noteLineCreateSchema.parse(body);

    const result = await addNoteLine(noteId, line);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: true, lineId: result.lineId },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error adding credit note line:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Invalid line data' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Failed to add line' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const noteId = parseInt(id, 10);

    if (isNaN(noteId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid note ID' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const lineId = parseInt(searchParams.get('lineId') || '', 10);

    if (isNaN(lineId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid line ID' },
        { status: 400 }
      );
    }

    const result = await deleteNoteLine(noteId, lineId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting credit note line:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete line' },
      { status: 500 }
    );
  }
}
