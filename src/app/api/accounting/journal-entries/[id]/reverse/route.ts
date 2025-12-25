// Journal Entry Reverse API
// Feature: 010-accounting-module-integration

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { reverseJournalEntry } from '@/lib/services/accounting.service';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const reverseSchema = z.object({
  reversalDate: z.string().optional(),
  reason: z.string().optional(),
});

// POST /api/accounting/journal-entries/[id]/reverse - Reverse journal entry
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

        const body = await request.json().catch(() => ({}));
        const parseResult = reverseSchema.safeParse(body);

        const reversalDate = parseResult.success ? parseResult.data.reversalDate : undefined;
        const reason = parseResult.success ? parseResult.data.reason : undefined;

        const reversalEntry = await reverseJournalEntry(
          entryId,
          session.userId,
          reversalDate,
          reason
        );

        return successResponse(reversalEntry, 'Journal entry reversed successfully');
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            return notFoundResponse(error.message);
          }
          if (
            error.message.includes('Cannot reverse') ||
            error.message.includes('already been reversed') ||
            error.message.includes('closed fiscal period')
          ) {
            return errorResponse(error.message, 400);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['accounting:journal_entries:reverse']
  );
}
