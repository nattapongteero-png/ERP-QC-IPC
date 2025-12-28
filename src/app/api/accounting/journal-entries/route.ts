// Journal Entries API
// Feature: 010-accounting-module-integration

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  listJournalEntries,
  createJournalEntry,
} from '@/lib/services/accounting.service';
import { journalEntryCreateSchema } from '@/lib/validation/accounting';

// GET /api/accounting/journal-entries - List journal entries
export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const { searchParams } = new URL(request.url);
        const fiscalPeriodId = searchParams.get('fiscalPeriodId');
        const status = searchParams.get('status');
        const sourceType = searchParams.get('sourceType');
        const dateFrom = searchParams.get('dateFrom') || undefined;
        const dateTo = searchParams.get('dateTo') || undefined;
        const search = searchParams.get('search') || undefined;

        const entries = await listJournalEntries({
          fiscalPeriodId: fiscalPeriodId ? Number(fiscalPeriodId) : undefined,
          status: status || undefined,
          sourceType: sourceType || undefined,
          dateFrom,
          dateTo,
          search,
        });

        return successResponse(entries);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['accounting:journal_entries:read']
  );
}

// POST /api/accounting/journal-entries - Create journal entry
export async function POST(request: NextRequest) {
  return withAuth(
    request,
    async (session) => {
      try {
        const body = await request.json();

        // Validate input
        const parseResult = journalEntryCreateSchema.safeParse(body);
        if (!parseResult.success) {
          const errors = parseResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          }));
          return errorResponse('Validation failed', 400, { errors });
        }

        const entry = await createJournalEntry({
          entryDate: parseResult.data.entryDate,
          fiscalPeriodId: parseResult.data.fiscalPeriodId,
          description: parseResult.data.description || undefined,
          sourceType: parseResult.data.sourceType || undefined,
          sourceId: parseResult.data.sourceId || undefined,
          lines: parseResult.data.lines.map((line) => ({
            glAccountId: line.glAccountId,
            debit: line.debit,
            credit: line.credit,
            description: line.description || undefined,
            costCenterId: line.costCenterId || undefined,
          })),
          createdBy: session.userId,
        });
        return successResponse(entry, 'Journal entry created successfully');
      } catch (error) {
        if (error instanceof Error) {
          if (
            error.message.includes('not balanced') ||
            error.message.includes('at least 2 lines') ||
            error.message.includes('No fiscal period')
          ) {
            return errorResponse(error.message, 400);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['accounting:journal_entries:write']
  );
}
