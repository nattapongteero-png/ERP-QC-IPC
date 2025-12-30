/**
 * Finalize Reconciliation API (T064)
 * POST /api/accounting/bank-reconciliation/statements/[id]/finalize - Finalize reconciliation
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  finalizeReconciliation,
  getReconciliationSummary,
} from '@/lib/services/bank-reconciliation.service';

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
    const forceClose = body.forceClose === true;

    // TODO: Get actual user ID from session
    const userId = 1;

    const result = await finalizeReconciliation(statementId, userId, forceClose);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error finalizing reconciliation:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const statementId = parseInt(id, 10);

    if (isNaN(statementId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid statement ID' },
        { status: 400 }
      );
    }

    const summary = await getReconciliationSummary(statementId);
    if (!summary) {
      return NextResponse.json(
        { success: false, error: 'Statement not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: summary });
  } catch (error) {
    console.error('Error getting reconciliation summary:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
