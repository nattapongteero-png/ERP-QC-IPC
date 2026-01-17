/**
 * Issue Dashboard API Route
 * Feature: Issue Tracker
 *
 * GET /api/issues/dashboard - Get dashboard metrics and analytics
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasPermission } from '@/lib/auth';
import { getIssueDashboardMetrics } from '@/lib/services/issues-dashboard.service';

export async function GET(_request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!hasPermission(session.role as Parameters<typeof hasPermission>[0], 'issues:read')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const metrics = await getIssueDashboardMetrics();

    return NextResponse.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    console.error('Error getting dashboard metrics:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get dashboard metrics' },
      { status: 500 }
    );
  }
}
