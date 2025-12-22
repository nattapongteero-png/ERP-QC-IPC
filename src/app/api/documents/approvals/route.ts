/**
 * Document Pending Approvals API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 5)
 *
 * GET /api/documents/approvals - List pending approvals for current user
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { getPendingApprovals } from '@/lib/services/document-service';

// GET /api/documents/approvals - List pending approvals for current user
export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async (session) => {
      try {
        const approvals = await getPendingApprovals(session.userId);
        return successResponse(approvals);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['documents:read']
  );
}
