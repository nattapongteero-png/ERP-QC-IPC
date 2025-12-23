/**
 * PQR Dashboard API Route
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 1)
 *
 * GET /api/pqr/dashboard - Get PQR dashboard statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasPermission } from '@/lib/auth';
import { getPqrDashboard } from '@/lib/services/pqr-service';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!hasPermission(session.role as Parameters<typeof hasPermission>[0], 'pqr:read')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const dashboard = await getPqrDashboard();

    return NextResponse.json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    console.error('Error fetching PQR dashboard:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch PQR dashboard' },
      { status: 500 }
    );
  }
}
