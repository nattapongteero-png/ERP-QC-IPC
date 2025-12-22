/**
 * Stability Sample Test Recording API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 7.4)
 *
 * POST /api/stability/samples/[id]/test - Record test result for sample
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { recordTest } from '@/lib/services/stability-service';
import { recordTestSchema } from '@/lib/validation/stability';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const sampleId = parseInt(id, 10);
    if (isNaN(sampleId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid sample ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validated = recordTestSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validated.error.format() },
        { status: 400 }
      );
    }

    const sample = await recordTest(sampleId, validated.data, session.userId);
    if (!sample) {
      return NextResponse.json(
        { success: false, error: 'Sample not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: sample,
    });
  } catch (error) {
    console.error('Error recording test:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to record test',
      },
      { status: 500 }
    );
  }
}
