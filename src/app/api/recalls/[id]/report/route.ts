/**
 * Recall Report API Route
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * GET /api/recalls/[id]/report - Generate comprehensive recall report for regulatory submission
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateRecallReport } from '@/lib/services/recall-service';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const recallId = parseInt(params.id, 10);

    if (isNaN(recallId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid recall ID' },
        { status: 400 }
      );
    }

    const report = await generateRecallReport(recallId);

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate recall report';
    console.error('Error generating recall report:', error);
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
