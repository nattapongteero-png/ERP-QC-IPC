/**
 * COA Template — single-resource routes
 *   GET   /api/quality/coa/templates/[id]
 *   PUT   /api/quality/coa/templates/[id]
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  notFoundResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getCoaTemplate,
  updateCoaTemplate,
} from '@/lib/services/coa.service';
import { updateCoaTemplateSchema } from '@/lib/validation/coa';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const tplId = Number(id);
      if (!Number.isFinite(tplId)) return errorResponse('Invalid template ID');
      const tpl = await getCoaTemplate(tplId);
      if (!tpl) return notFoundResponse('Template not found');
      return successResponse(tpl);
    } catch (error) {
      console.error('Error fetching COA template:', error);
      return serverErrorResponse(error);
    }
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const tplId = Number(id);
      if (!Number.isFinite(tplId)) return errorResponse('Invalid template ID');
      const body = await request.json();
      const parsed = updateCoaTemplateSchema.safeParse(body);
      if (!parsed.success) {
        return errorResponse('Invalid template update payload', 400, {
          errors: parsed.error.issues,
        });
      }
      const result = await updateCoaTemplate(tplId, parsed.data);
      return successResponse(result, 'Template updated');
    } catch (error) {
      console.error('Error updating COA template:', error);
      if (error instanceof Error && error.message) {
        return errorResponse(error.message, 400);
      }
      return serverErrorResponse(error);
    }
  });
}
