// Template Category API (single category operations)
// Feature: Template Module for prototyping

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getTemplateCategory,
  updateTemplateCategory,
  deleteTemplateCategory,
} from '@/lib/services/template.service';
import { templateCategoryUpdateSchema } from '@/lib/validation/template';

// GET /api/template/categories/[id] - Get single template category
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const category = await getTemplateCategory(Number(id));

        if (!category) {
          return errorResponse('Category not found', 404);
        }

        return successResponse(category);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    []
  );
}

// PUT /api/template/categories/[id] - Update template category
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const body = await request.json();

        // Validate input
        const parseResult = templateCategoryUpdateSchema.safeParse(body);
        if (!parseResult.success) {
          const errors = parseResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          }));
          return errorResponse('Validation failed', 400, { errors });
        }

        const category = await updateTemplateCategory(Number(id), parseResult.data);
        return successResponse(category, 'Category updated successfully');
      } catch (error) {
        if (error instanceof Error) {
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

// DELETE /api/template/categories/[id] - Delete template category
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        await deleteTemplateCategory(Number(id));
        return successResponse(null, 'Category deleted successfully');
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            return errorResponse(error.message, 404);
          }
          if (error.message.includes('Cannot delete')) {
            return errorResponse(error.message, 400);
          }
        }
        return serverErrorResponse(error);
      }
    },
    []
  );
}
