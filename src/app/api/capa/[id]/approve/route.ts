/**
 * CAPA Approval Action API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 1) - Phase 1 Critical
 *
 * Endpoint for processing CAPA approval actions (approve/reject/request revision).
 * Implements electronic signature requirements per 21 CFR Part 11.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasPermission } from '@/lib/auth';
import { processCapaApproval, getCapaById } from '@/lib/services/capa-service';
import { capaApprovalActionSchema } from '@/lib/validation/capa';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/capa/[id]/approve
 * Process an approval action for a CAPA
 *
 * Actions:
 * - approve: Approve current step, move to next or close if final
 * - reject: Reject the CAPA, end workflow
 * - request_revision: Send back for revision, reset to investigation
 *
 * Requires:
 * - signaturePassword: User's password for electronic signature verification
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

    // Require QA role or higher for approvals
    if (!hasPermission(session.role as Parameters<typeof hasPermission>[0], 'capa:close')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied. Approval requires QA or manager role.' },
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

    const body = await request.json();
    const validation = capaApprovalActionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid parameters', details: validation.error.issues },
        { status: 400 }
      );
    }

    const userId = session.userId;
    const { signaturePassword, ...approvalData } = validation.data;

    await processCapaApproval(capaId, approvalData, userId, signaturePassword);

    // Determine response message based on action
    let message: string;
    switch (validation.data.action) {
      case 'approve':
        message = 'Approval recorded with electronic signature.';
        break;
      case 'reject':
        message = 'CAPA rejected. Workflow ended.';
        break;
      case 'request_revision':
        message = 'Revision requested. CAPA returned to investigation status.';
        break;
      default:
        message = 'Action processed.';
    }

    return NextResponse.json({ success: true, message });
  } catch (error) {
    console.error('Error processing CAPA approval:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to process approval' },
      { status: 500 }
    );
  }
}
