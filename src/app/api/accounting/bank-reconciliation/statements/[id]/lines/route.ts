/**
 * Bank Statement Lines API (T062)
 * POST /api/accounting/bank-reconciliation/statements/[id]/lines - Import lines
 */

import { NextRequest, NextResponse } from 'next/server';
import { importStatementLines } from '@/lib/services/bank-reconciliation.service';
import { z } from 'zod';
import { bankStatementLineImportSchema } from '@/lib/validation/bank-reconciliation';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const importLinesSchema = z.object({
  lines: z.array(bankStatementLineImportSchema).min(1, 'At least one line is required'),
});

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const statementId = parseInt(id, 10);

    if (isNaN(statementId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid statement ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const data = importLinesSchema.parse(body);

    // TODO: Get actual user ID from session
    const createdBy = 1;

    const result = await importStatementLines(statementId, data.lines, createdBy);
    return NextResponse.json({
      success: true,
      imported: result.imported,
      errors: result.errors,
    });
  } catch (error) {
    console.error('Error importing statement lines:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 400 }
    );
  }
}
