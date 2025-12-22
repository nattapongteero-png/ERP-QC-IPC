/**
 * Stability Study Detail API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 7.4)
 *
 * GET /api/stability/studies/[id] - Get study details
 * PATCH /api/stability/studies/[id] - Update study
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getStudyDetails, updateStudy } from '@/lib/services/stability-service';
import { studyUpdateSchema } from '@/lib/validation/stability';

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
    const studyId = parseInt(id, 10);
    if (isNaN(studyId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid study ID' },
        { status: 400 }
      );
    }

    const study = await getStudyDetails(studyId);
    if (!study) {
      return NextResponse.json(
        { success: false, error: 'Study not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: study,
    });
  } catch (error) {
    console.error('Error fetching study:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch study' },
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
    const studyId = parseInt(id, 10);
    if (isNaN(studyId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid study ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validated = studyUpdateSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validated.error.format() },
        { status: 400 }
      );
    }

    const study = await updateStudy(studyId, validated.data, session.userId);
    if (!study) {
      return NextResponse.json(
        { success: false, error: 'Study not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: study,
    });
  } catch (error) {
    console.error('Error updating study:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update study',
      },
      { status: 500 }
    );
  }
}
