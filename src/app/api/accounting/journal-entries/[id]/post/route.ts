// Journal Entry Post API
// Feature: 010-accounting-module-integration

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { postJournalEntry } from '@/lib/services/accounting.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/accounting/journal-entries/[id]/post - Post journal entry
export async function POST(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async (session) => {
      try {
        const { id } = await params;
        const entryId = Number(id);

        if (isNaN(entryId)) {
          return errorResponse('Invalid journal entry ID', 400);
        }

        const entry = await postJournalEntry(entryId, session.userId);
        return successResponse(entry, 'Journal entry posted successfully');
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            return notFoundResponse(error.message);
          }
          if (
            error.message.includes('Cannot post') ||
            error.message.includes('closed fiscal period')
          ) {
            return errorResponse(error.message, 400);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['accounting:journal_entries:post']
  );
}
