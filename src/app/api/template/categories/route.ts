// Template Categories API
// Feature: Template Module for prototyping

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  listTemplateCategories,
  createTemplateCategory,
} from '@/lib/services/template.service';
import { templateCategoryCreateSchema } from '@/lib/validation/template';

// GET /api/template/categories - List template categories
export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const { searchParams } = new URL(request.url);
        const isActive = searchParams.get('isActive');
        const search = searchParams.get('search') || undefined;

        const categories = await listTemplateCategories({
          isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
          search,
        });

        return successResponse(categories);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    []
  );
}

// POST /api/template/categories - Create template category
export async function POST(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const body = await request.json();

        // Validate input
        const parseResult = templateCategoryCreateSchema.safeParse(body);
        if (!parseResult.success) {
          const errors = parseResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          }));
          return errorResponse('Validation failed', 400, { errors });
        }

        const category = await createTemplateCategory(parseResult.data);
        return successResponse(category, 'Category created successfully');
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('already exists')) {
            return errorResponse(error.message, 400);
          }
        }
        return serverErrorResponse(error);
      }
    },
    []
  );
}
