/**
 * PQR API Routes
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 1)
 *
 * GET /api/pqr - List PQR reports with filtering and pagination
 * POST /api/pqr - Create a new PQR report
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasPermission } from '@/lib/auth';
import { listPqrReports, createPqrReport } from '@/lib/services/pqr-service';
import type { PqrStatus } from '@/types/pqr';

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

    const searchParams = request.nextUrl.searchParams;
    const params = {
      status: (searchParams.get('status') as PqrStatus) || undefined,
      productId: searchParams.get('productId') ? parseInt(searchParams.get('productId')!) : undefined,
      reviewYear: searchParams.get('reviewYear') ? parseInt(searchParams.get('reviewYear')!) : undefined,
      search: searchParams.get('search') || undefined,
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20,
    };

    const result = await listPqrReports(params);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error listing PQR reports:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list PQR reports' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!hasPermission(session.role as Parameters<typeof hasPermission>[0], 'pqr:write')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Basic validation
    if (!body.productId || !body.reviewYear) {
      return NextResponse.json(
        { success: false, error: 'Product ID and Review Year are required' },
        { status: 400 }
      );
    }

    const report = await createPqrReport(body, session.userId);

    return NextResponse.json(
      { success: true, data: report },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating PQR report:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create PQR report' },
      { status: 500 }
    );
  }
}
