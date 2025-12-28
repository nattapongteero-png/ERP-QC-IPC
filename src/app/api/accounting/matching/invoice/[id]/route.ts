/**
 * Run Matching for Invoice API (T111)
 * POST /api/accounting/matching/invoice/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { runMatching } from '@/lib/services/matching.service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const invoiceId = parseInt(id, 10);

    if (isNaN(invoiceId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid invoice ID' },
        { status: 400 }
      );
    }

    // Get optional tolerance overrides from body
    let toleranceOverrides;
    try {
      const body = await request.json();
      toleranceOverrides = body.toleranceOverrides;
    } catch {
      // No body provided, use defaults
    }

    // TODO: Get actual user ID from session
    const userId = 1;

    const result = await runMatching(
      { invoiceId, toleranceOverrides },
      userId
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      matchingResultId: result.matchingResultId,
      status: result.status,
      exceptions: result.exceptions,
    });
  } catch (error) {
    console.error('Error running matching:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
