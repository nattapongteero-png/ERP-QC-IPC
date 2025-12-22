/**
 * Link CAPA to Complaint API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * POST /api/complaints/:id/link-capa - Link a CAPA to complaint
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasPermission } from '@/lib/auth';
import { linkCapa } from '@/lib/services/complaint-service';
import { complaintLinkCapaSchema } from '@/lib/validation/complaints';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
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

    const { id } = await params;
    const complaintId = parseInt(id, 10);
    if (isNaN(complaintId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid complaint ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parseResult = complaintLinkCapaSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const complaint = await linkCapa(complaintId, parseResult.data.capaId, session.userId);

    return NextResponse.json({
      success: true,
      data: complaint,
    });
  } catch (error) {
    console.error('Error linking CAPA:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to link CAPA' },
      { status: 500 }
    );
  }
}
