/**
 * Stability Sample Alerts API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 7.4)
 *
 * GET /api/stability/samples/alerts - Get due/overdue sample alerts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSampleAlerts } from '@/lib/services/stability-service';
import { sampleAlertsParamsSchema } from '@/lib/validation/stability';

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

    const validatedParams = sampleAlertsParamsSchema.safeParse(params);
    if (!validatedParams.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid parameters', details: validatedParams.error.format() },
        { status: 400 }
      );
    }

    const daysAhead = validatedParams.data?.daysAhead || 30;
    const alerts = await getSampleAlerts(daysAhead);

    return NextResponse.json({
      success: true,
      data: alerts,
    });
  } catch (error) {
    console.error('Error fetching sample alerts:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch sample alerts' },
      { status: 500 }
    );
  }
}
