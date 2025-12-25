/**
 * Documents Dashboard API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 5)
 *
 * GET /api/documents/dashboard - Get document statistics and metrics
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { getDocumentStatistics } from '@/lib/services/document-service';

// GET /api/documents/dashboard - Get dashboard statistics
export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const stats = await getDocumentStatistics();
        return successResponse(stats);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['documents:read']
  );
}
