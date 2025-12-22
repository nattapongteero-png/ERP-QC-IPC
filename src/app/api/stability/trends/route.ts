/**
 * Stability Trends API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 7.4)
 *
 * GET /api/stability/trends - Get overall stability trends
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getStabilityTrends } from '@/lib/services/stability-service';
import { trendsParamsSchema } from '@/lib/validation/stability';

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

    const validatedParams = trendsParamsSchema.safeParse(params);
    if (!validatedParams.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid parameters', details: validatedParams.error.format() },
        { status: 400 }
      );
    }

    const trends = await getStabilityTrends(validatedParams.data?.productId);

    return NextResponse.json({
      success: true,
      data: trends,
    });
  } catch (error) {
    console.error('Error fetching trends:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch trends' },
      { status: 500 }
    );
  }
}
