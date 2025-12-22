/**
 * Complaints Dashboard API Route
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * GET /api/complaints/dashboard - Get complaint statistics dashboard
 */

import { NextResponse } from 'next/server';
import { getSession, hasPermission } from '@/lib/auth';
import { getComplaintDashboard } from '@/lib/services/complaint-service';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!hasPermission(session.role as Parameters<typeof hasPermission>[0], 'complaints:read')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const dashboard = await getComplaintDashboard();

    return NextResponse.json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    console.error('Error fetching complaints dashboard:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dashboard' },
      { status: 500 }
    );
  }
}
