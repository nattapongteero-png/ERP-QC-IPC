/**
 * Stability Sample Detail API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 7.4)
 *
 * GET /api/stability/samples/[id] - Get sample details
 * PATCH /api/stability/samples/[id] - Update sample
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSampleById, updateSample } from '@/lib/services/stability-service';
import { sampleUpdateSchema } from '@/lib/validation/stability';

export async function GET(
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

    const sample = await getSampleById(sampleId);
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
    console.error('Error fetching sample:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch sample' },
      { status: 500 }
    );
  }
}

export async function PATCH(
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
    const validated = sampleUpdateSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validated.error.format() },
        { status: 400 }
      );
    }

    const sample = await updateSample(sampleId, validated.data, session.userId);
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
    console.error('Error updating sample:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update sample',
      },
      { status: 500 }
    );
  }
}
