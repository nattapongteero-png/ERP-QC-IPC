/**
 * COA Templates — collection routes
 *   GET  /api/quality/coa/templates   — list (filters: isActive, productCategory)
 *   POST /api/quality/coa/templates   — create
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  listCoaTemplates,
  createCoaTemplate,
} from '@/lib/services/coa.service';
import { createCoaTemplateSchema } from '@/lib/validation/coa';

export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const isActive = searchParams.get('isActive');
      const productCategory = searchParams.get('productCategory');

      const templates = await listCoaTemplates({
        isActive: isActive == null ? undefined : isActive === 'true',
        productCategory: productCategory ?? undefined,
      });
      return successResponse({ items: templates });
    } catch (error) {
      console.error('Error listing COA templates:', error);
      return serverErrorResponse(error);
    }
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const body = await request.json();
      const parsed = createCoaTemplateSchema.safeParse(body);
      if (!parsed.success) {
        return errorResponse('Invalid template payload', 400, {
          errors: parsed.error.issues,
        });
      }
      const result = await createCoaTemplate(parsed.data);
      return successResponse(result, 'Template created');
    } catch (error) {
      console.error('Error creating COA template:', error);
      if (error instanceof Error && error.message) {
        return errorResponse(error.message, 400);
      }
      return serverErrorResponse(error);
    }
  });
}
