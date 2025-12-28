// Journal Entry Single Item API
// Feature: 010-accounting-module-integration

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { getJournalEntryById } from '@/lib/services/accounting.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/accounting/journal-entries/[id] - Get journal entry by ID
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const entryId = Number(id);

        if (isNaN(entryId)) {
          return errorResponse('Invalid journal entry ID', 400);
        }

        const entry = await getJournalEntryById(entryId);
        return successResponse(entry);
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          return notFoundResponse('Journal entry not found');
        }
        return serverErrorResponse(error);
      }
    },
    ['accounting:journal_entries:read']
  );
}
