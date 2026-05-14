/**
 * QC Test Panels — single-resource routes
 *   GET    /api/quality/test-panels/[id]
 *   PUT    /api/quality/test-panels/[id]
 *   DELETE /api/quality/test-panels/[id] — hard delete
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
  getTestPanel,
  updateTestPanel,
  deleteTestPanel,
} from '@/lib/services/qc-sample.service';
import { updateTestPanelSchema } from '@/lib/validation/qc-sample';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const panelId = Number(id);
      if (!Number.isFinite(panelId)) {
        return errorResponse('Invalid panel ID');
      }
      const detail = await getTestPanel(panelId);
      if (!detail) return notFoundResponse('Test panel not found');
      return successResponse(detail);
    } catch (error) {
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
      const panelId = Number(id);
      if (!Number.isFinite(panelId)) {
        return errorResponse('Invalid panel ID');
      }
      const body = await request.json();
      const parsed = updateTestPanelSchema.safeParse(body);
      if (!parsed.success) {
        return errorResponse(
          'Invalid update payload',
          400,
          { errors: parsed.error.issues },
        );
      }
      const result = await updateTestPanel(panelId, parsed.data);
      return successResponse(result, 'Test panel updated');
    } catch (error) {
      if (error instanceof Error && error.message) {
        return errorResponse(error.message, 400);
      }
      return serverErrorResponse(error);
    }
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const panelId = Number(id);
      if (!Number.isFinite(panelId)) {
        return errorResponse('Invalid panel ID');
      }
      const result = await deleteTestPanel(panelId);
      return successResponse(result, 'Test panel deleted');
    } catch (error) {
      if (error instanceof Error && error.message) {
        return errorResponse(error.message, 400);
      }
      return serverErrorResponse(error);
    }
  });
}
