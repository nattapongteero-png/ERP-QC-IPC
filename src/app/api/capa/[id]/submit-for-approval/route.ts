/**
 * CAPA Submit for Approval API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 1) - Phase 1 Critical
 *
 * Endpoint for submitting a CAPA for approval workflow.
 * Initiates the multi-level approval process required for GMP compliance.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasPermission } from '@/lib/auth';
import { submitCapaForApproval } from '@/lib/services/capa-service';
import { capaSubmitForApprovalSchema } from '@/lib/validation/capa';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/capa/[id]/submit-for-approval
 * Submit a CAPA for approval workflow
 *
 * Prerequisites:
 * - All actions must be completed
 * - At least one effectiveness check must show "effective"
 * - CAPA must not be closed or cancelled
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!hasPermission(session.role as Parameters<typeof hasPermission>[0], 'capa:write')) {
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

    const body = await request.json();
    const validation = capaSubmitForApprovalSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid parameters', details: validation.error.issues },
        { status: 400 }
      );
    }

    const userId = session.userId;
    await submitCapaForApproval(capaId, validation.data, userId);

    return NextResponse.json({
      success: true,
      message: 'CAPA submitted for approval. Awaiting QA reviewer approval.',
    });
  } catch (error) {
    console.error('Error submitting CAPA for approval:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to submit for approval' },
      { status: 500 }
    );
  }
}
