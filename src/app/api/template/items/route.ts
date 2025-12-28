// Template Items API
// Feature: Template Module for prototyping

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  listTemplateItems,
  createTemplateItem,
} from '@/lib/services/template.service';
import { templateItemCreateSchema } from '@/lib/validation/template';

// GET /api/template/items - List template items
export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status') as 'draft' | 'active' | 'archived' | null;
        const priority = searchParams.get('priority') as 'low' | 'medium' | 'high' | 'urgent' | null;
        const categoryId = searchParams.get('categoryId');
        const isActive = searchParams.get('isActive');
        const search = searchParams.get('search') || undefined;
        const page = searchParams.get('page');
        const limit = searchParams.get('limit');

        const result = await listTemplateItems({
          status: status || undefined,
          priority: priority || undefined,
          categoryId: categoryId ? Number(categoryId) : undefined,
          isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
          search,
          page: page ? Number(page) : 1,
          limit: limit ? Number(limit) : 50,
        });

        return successResponse(result);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    [] // Empty roles = all authenticated users
  );
}

// POST /api/template/items - Create template item
export async function POST(request: NextRequest) {
  return withAuth(
    request,
    async (session) => {
      try {
        const body = await request.json();

        // Validate input
        const parseResult = templateItemCreateSchema.safeParse(body);
        if (!parseResult.success) {
          const errors = parseResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          }));
          return errorResponse('Validation failed', 400, { errors });
        }

        const item = await createTemplateItem(parseResult.data, session.userId);
        return successResponse(item, 'Item created successfully');
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('already exists')) {
            return errorResponse(error.message, 400);
          }
          if (error.message.includes('not found')) {
            return errorResponse(error.message, 404);
          }
        }
        return serverErrorResponse(error);
      }
    },
    []
  );
}
