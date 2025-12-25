// Template Item API (single item operations)
// Feature: Template Module for prototyping

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getTemplateItem,
  updateTemplateItem,
  deleteTemplateItem,
} from '@/lib/services/template.service';
import { templateItemUpdateSchema } from '@/lib/validation/template';

// GET /api/template/items/[id] - Get single template item
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const item = await getTemplateItem(Number(id));

        if (!item) {
          return errorResponse('Item not found', 404);
        }

        return successResponse(item);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    []
  );
}

// PUT /api/template/items/[id] - Update template item
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(
    request,
    async (session) => {
      try {
        const { id } = await params;
        const body = await request.json();

        // Validate input
        const parseResult = templateItemUpdateSchema.safeParse(body);
        if (!parseResult.success) {
          const errors = parseResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          }));
          return errorResponse('Validation failed', 400, { errors });
        }

        const item = await updateTemplateItem(Number(id), parseResult.data, session.userId);
        return successResponse(item, 'Item updated successfully');
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

// DELETE /api/template/items/[id] - Delete template item
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        await deleteTemplateItem(Number(id));
        return successResponse(null, 'Item deleted successfully');
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
