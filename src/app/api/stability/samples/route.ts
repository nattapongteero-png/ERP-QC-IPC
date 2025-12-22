/**
 * Stability Samples API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 7.4)
 *
 * GET /api/stability/samples - List samples with filters
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSamples } from '@/lib/services/stability-service';
import { sampleListParamsSchema } from '@/lib/validation/stability';

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

    const validatedParams = sampleListParamsSchema.safeParse(params);
    if (!validatedParams.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid parameters', details: validatedParams.error.format() },
        { status: 400 }
      );
    }

    const result = await getSamples(validatedParams.data);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error fetching samples:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch samples' },
      { status: 500 }
    );
  }
}
