/**
 * CAPA Approvals List API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 1) - Phase 1 Critical
 *
 * Endpoint for getting all approval records for a CAPA.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasPermission } from '@/lib/auth';
import { getCapaApprovals, getCapaById } from '@/lib/services/capa-service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/capa/[id]/approvals
 * Get all approval records for a CAPA
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    const { id } = await params;
    const capaId = parseInt(id, 10);

    if (isNaN(capaId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid CAPA ID' },
        { status: 400 }
      );
    }

    // Verify CAPA exists
    const capa = await getCapaById(capaId);
    if (!capa) {
      return NextResponse.json(
        { success: false, error: 'CAPA not found' },
        { status: 404 }
      );
    }

    const approvals = await getCapaApprovals(capaId);

    return NextResponse.json({ success: true, data: approvals });
  } catch (error) {
    console.error('Error fetching CAPA approvals:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch approvals' },
      { status: 500 }
    );
  }
}
