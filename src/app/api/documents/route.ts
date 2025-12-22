/**
 * Documents API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 5)
 *
 * GET /api/documents - List documents with pagination and filters
 * POST /api/documents - Create a new document
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { createDocument, getDocuments } from '@/lib/services/document-service';
import { documentCreateSchema, documentListQuerySchema } from '@/lib/validation/documents';

// GET /api/documents - List documents
export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async (session) => {
      try {
        const { searchParams } = new URL(request.url);

        // Parse and validate query params
        const parseResult = documentListQuerySchema.safeParse({
          status: searchParams.get('status') || undefined,
          typeId: searchParams.get('typeId') || undefined,
          departmentId: searchParams.get('departmentId') || undefined,
          search: searchParams.get('search') || undefined,
          page: searchParams.get('page') || undefined,
          limit: searchParams.get('limit') || undefined,
        });

        if (!parseResult.success) {
          const errors = parseResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          }));
          return errorResponse('Invalid query parameters', 400, { errors });
        }

        const result = await getDocuments(parseResult.data);
        return successResponse(result);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['documents:read']
  );
}

// POST /api/documents - Create document
export async function POST(request: NextRequest) {
  return withAuth(
    request,
    async (session) => {
      try {
        const body = await request.json();

        // Validate input
        const parseResult = documentCreateSchema.safeParse(body);
        if (!parseResult.success) {
          const errors = parseResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          }));
          return errorResponse('Validation failed', 400, { errors });
        }

        const document = await createDocument(parseResult.data, session.userId);
        return successResponse(document, 'Document created successfully');
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            return errorResponse(error.message, 404);
          }
          if (error.message.includes('Invalid')) {
            return errorResponse(error.message, 400);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['documents:write']
  );
}
