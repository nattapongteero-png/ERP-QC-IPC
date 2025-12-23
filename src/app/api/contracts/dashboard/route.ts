/**
 * Manufacturing Contracts Dashboard API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 8)
 *
 * GET /api/contracts/dashboard - Get comprehensive dashboard data
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getContractDashboard } from '@/lib/services/contracts-service';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const dashboard = await getContractDashboard();

    return NextResponse.json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    console.error('Error fetching contracts dashboard:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dashboard' },
      { status: 500 }
    );
  }
}
