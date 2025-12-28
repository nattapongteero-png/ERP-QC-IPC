/**
 * Auto Match API (T063)
 * POST /api/accounting/bank-reconciliation/statements/[id]/auto-match - Run auto-matching
 */

import { NextRequest, NextResponse } from 'next/server';
import { runAutoMatch } from '@/lib/services/bank-reconciliation.service';
import { autoMatchConfigSchema } from '@/lib/validation/bank-reconciliation';

interface RouteContext {
  params: Promise<{ id: string }>;
}

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

    const body = await request.json().catch(() => ({}));
    const config = autoMatchConfigSchema.parse({
      statementId,
      ...body,
    });

    const result = await runAutoMatch(config);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Error running auto-match:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 400 }
    );
  }
}
