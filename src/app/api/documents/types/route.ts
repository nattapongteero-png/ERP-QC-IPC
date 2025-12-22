/**
 * Document Types API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 5)
 *
 * GET /api/documents/types - List available document types
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { getDocumentTypes } from '@/lib/services/document-service';

// GET /api/documents/types - List document types
export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const types = await getDocumentTypes();
        return successResponse(types);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['documents:read']
  );
}
