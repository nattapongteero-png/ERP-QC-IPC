/**
 * API Route: Submit for Approval (T017)
 * POST /api/approval/submit - Submit a document for approval
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import { submitForApproval } from '@/lib/services/approval-workflow.service';
import { approvalSubmitSchema } from '@/lib/validation/approval-workflow';
import type { DocumentContext } from '@/types/approval-workflow';

export async function POST(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const body = await request.json();
      const data = approvalSubmitSchema.parse(body);

      // Build document context for rule evaluation
      const context: DocumentContext = {
        documentType: data.documentType,
        documentId: data.documentId,
        requesterId: data.requestedBy,
        ...(data.context || {}),
      };

      const result = await submitForApproval(context);

      return NextResponse.json({
        success: true,
        data: result,
        message: `Document submitted for approval via "${result.flowName}" workflow`,
      });
    } catch (error) {
      console.error('Error submitting for approval:', error);

      if (error instanceof Error) {
        if (error.message.startsWith('NO_MATCHING_FLOW')) {
          return NextResponse.json(
            { success: false, error: error.message.split(': ')[1] },
            { status: 400 }
          );
        }
        if (error.name === 'ZodError') {
          return NextResponse.json(
            { success: false, error: 'Validation error', details: error },
            { status: 400 }
          );
        }
      }

      return NextResponse.json(
        { success: false, error: 'Failed to submit for approval' },
        { status: 500 }
      );
    }

  });
}
