/**
 * API Route: Approval Flow Rules (T015)
 * POST /api/settings/approval-flows/[id]/rules - Add/replace rules for a flow
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import {
  replaceApprovalRules,
  getApprovalFlowById,
} from '@/lib/services/approval-workflow.service';
import { approvalRuleBulkCreateSchema } from '@/lib/validation/approval-workflow';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const flowId = parseInt(id, 10);

      if (isNaN(flowId)) {
        return NextResponse.json(
          { success: false, error: 'Invalid flow ID' },
          { status: 400 }
        );
      }

      // Verify flow exists
      const flow = await getApprovalFlowById(flowId);
      if (!flow) {
        return NextResponse.json(
          { success: false, error: 'Approval flow not found' },
          { status: 404 }
        );
      }

      const body = await request.json();
      const data = approvalRuleBulkCreateSchema.parse({
        flowId,
        rules: body.rules,
      });

      await replaceApprovalRules(flowId, data.rules);

      return NextResponse.json({
        success: true,
        message: 'Approval rules updated successfully',
      });
    } catch (error) {
      console.error('Error updating approval rules:', error);
      if (error instanceof Error && error.name === 'ZodError') {
        return NextResponse.json(
          { success: false, error: 'Validation error', details: error },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { success: false, error: 'Failed to update approval rules' },
        { status: 500 }
      );
    }

  });
}
