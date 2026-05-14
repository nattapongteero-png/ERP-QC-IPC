/**
 * Debit Notes API - List and Create (T090)
 * Part of 011-accounting-spec-gap - User Story 3
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import {
  creditDebitNoteListFilterSchema,
  creditDebitNoteCreateSchema,
} from '@/lib/validation/credit-debit-notes';
import {
  listNotes,
  createNote,
} from '@/lib/services/credit-debit-notes.service';

export async function GET(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const { searchParams } = new URL(request.url);
      const params = Object.fromEntries(searchParams.entries());

      // Add note type filter for debit notes only
      params.noteType = params.noteType || 'ar_debit';
      if (!['ar_debit', 'ap_debit'].includes(params.noteType)) {
        params.noteType = 'ar_debit';
      }

      const filter = creditDebitNoteListFilterSchema.parse(params);
      const result = await listNotes(filter);

      return NextResponse.json({
        success: true,
        data: result.data,
        total: result.total,
        page: result.page,
        limit: result.limit,
      });
    } catch (error) {
      console.error('Error listing debit notes:', error);
      if (error instanceof Error && error.name === 'ZodError') {
        return NextResponse.json(
          { success: false, error: 'Invalid filter parameters' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { success: false, error: 'Failed to list debit notes' },
        { status: 500 }
      );
    }

  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const body = await request.json();

      // Ensure it's a debit note type
      if (!body.noteType?.includes('debit')) {
        body.noteType = 'ar_debit';
      }

      const data = creditDebitNoteCreateSchema.parse(body);

      // TODO: Get user ID from session
      const userId = session.userId;

      const noteId = await createNote(data, userId);

      return NextResponse.json(
        { success: true, id: noteId },
        { status: 201 }
      );
    } catch (error) {
      console.error('Error creating debit note:', error);
      if (error instanceof Error && error.name === 'ZodError') {
        return NextResponse.json(
          { success: false, error: 'Invalid input data', details: error },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { success: false, error: 'Failed to create debit note' },
        { status: 500 }
      );
    }

  });
}
