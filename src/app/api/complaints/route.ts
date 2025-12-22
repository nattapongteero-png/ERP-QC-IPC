/**
 * Complaints API Routes
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * GET /api/complaints - List complaints with filtering and pagination
 * POST /api/complaints - Create a new complaint
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasPermission } from '@/lib/auth';
import { listComplaints, createComplaint } from '@/lib/services/complaint-service';
import { complaintListParamsSchema, complaintCreateSchema } from '@/lib/validation/complaints';

export async function GET(request: NextRequest) {
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

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const params = {
      status: searchParams.get('status') || undefined,
      category: searchParams.get('category') || undefined,
      severity: searchParams.get('severity') || undefined,
      productId: searchParams.get('productId') || undefined,
      fromDate: searchParams.get('fromDate') || undefined,
      toDate: searchParams.get('toDate') || undefined,
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined,
    };

    // Validate parameters
    const parseResult = complaintListParamsSchema.safeParse(params);
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid parameters', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const result = await listComplaints(parseResult.data);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error listing complaints:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list complaints' },
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

    if (!hasPermission(session.role as Parameters<typeof hasPermission>[0], 'complaints:write')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parseResult = complaintCreateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const complaint = await createComplaint(parseResult.data, session.userId);

    return NextResponse.json({
      success: true,
      data: complaint,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating complaint:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create complaint' },
      { status: 500 }
    );
  }
}
