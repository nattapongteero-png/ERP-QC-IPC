/**
 * Stability Studies API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 7.4)
 *
 * GET /api/stability/studies - List studies
 * POST /api/stability/studies - Create new study (enroll batch)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createStudy, listStudies } from '@/lib/services/stability-service';
import { studyCreateSchema, studyListParamsSchema } from '@/lib/validation/stability';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const params = Object.fromEntries(searchParams.entries());

    const validatedParams = studyListParamsSchema.safeParse(params);
    if (!validatedParams.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid parameters', details: validatedParams.error.format() },
        { status: 400 }
      );
    }

    const result = await listStudies(validatedParams.data);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error fetching studies:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch studies' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validated = studyCreateSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validated.error.format() },
        { status: 400 }
      );
    }

    const study = await createStudy(validated.data, session.userId);

    return NextResponse.json(
      { success: true, data: study },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating study:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create study',
      },
      { status: 500 }
    );
  }
}
