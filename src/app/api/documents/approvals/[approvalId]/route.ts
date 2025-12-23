/**
 * Document Approval Decision API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 5)
 *
 * POST /api/documents/approvals/[approvalId] - Process approval decision (approve/reject)
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { processApproval } from '@/lib/services/document-service';
import { approvalDecisionInputSchema } from '@/lib/validation/documents';

interface RouteParams {
  params: Promise<{ approvalId: string }>;
}

// POST /api/documents/approvals/[approvalId] - Process approval decision
export async function POST(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async (session) => {
      try {
        const { approvalId: approvalIdStr } = await params;
        const approvalId = parseInt(approvalIdStr, 10);

        if (isNaN(approvalId) || approvalId <= 0) {
          return errorResponse('Invalid approval ID', 400);
        }

        const body = await request.json();

        // Validate input
        const parseResult = approvalDecisionInputSchema.safeParse(body);
        if (!parseResult.success) {
          const errors = parseResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          }));
          return errorResponse('Validation failed', 400, { errors });
        }

        const result = await processApproval(
          approvalId,
          parseResult.data.decision,
          parseResult.data.comments || null,
          session.userId
        );

        const message = parseResult.data.decision === 'approved'
          ? 'Document approved successfully'
          : 'Document rejected';

        return successResponse(result, message);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            return errorResponse(error.message, 404);
          }
          if (error.message.includes('not authorized') || error.message.includes('already been processed')) {
            return errorResponse(error.message, 400);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['documents:write']
  );
}
