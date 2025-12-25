/**
 * CAPA Dashboard API Route
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 1)
 *
 * GET /api/capa/dashboard - Get CAPA dashboard statistics
 */

import { NextResponse } from 'next/server';
import { getSession, hasPermission } from '@/lib/auth';
import { getCapaDashboard } from '@/lib/services/capa-service';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!hasPermission(session.role as Parameters<typeof hasPermission>[0], 'capa:read')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const dashboard = await getCapaDashboard();

    return NextResponse.json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    console.error('Error fetching CAPA dashboard:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch dashboard',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined,
      },
      { status: 500 }
    );
  }
}
