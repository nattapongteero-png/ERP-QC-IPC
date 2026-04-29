/**
 * Material Returns — single-resource routes
 *   GET  /api/inventory/returns/[id] — full detail (header + lines + lots + deviation)
 *   POST /api/inventory/returns/[id] — action endpoint (approve | reject)
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
  approveMaterialReturn,
  getMaterialReturnDetail,
  rejectMaterialReturn,
} from '@/lib/services/material-return.service';
import { approveActionSchema } from '@/lib/validation/material-return';

// GET — full return detail.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const returnId = Number(id);
      if (!Number.isFinite(returnId)) {
        return errorResponse('Invalid return ID');
      }

      const detail = await getMaterialReturnDetail(returnId);
      if (!detail) return notFoundResponse('Material return not found');

      return successResponse(detail);
    } catch (error) {
      console.error('Error fetching material return detail:', error);
      return serverErrorResponse(error);
    }
  });
}

// POST — action endpoint. Body: { action: 'approve' | 'reject', reason?: string }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const returnId = Number(id);
      if (!Number.isFinite(returnId)) {
        return errorResponse('Invalid return ID');
      }

      const body = await request.json();
      const parsed = approveActionSchema.safeParse(body);
      if (!parsed.success) {
        return errorResponse(
          'Invalid action payload',
          400,
          { errors: parsed.error.issues },
        );
      }
      const { action, reason } = parsed.data;

      if (action === 'approve') {
        const result = await approveMaterialReturn(returnId, session.userId);
        return successResponse(
          result,
          `Return approved — ${result.newLots.length} lot(s) created, ${result.deviationsCreated.length} deviation(s) opened`,
        );
      }

      // action === 'reject' — reason is required
      if (!reason || reason.trim().length === 0) {
        return errorResponse('Rejection reason is required when action="reject"', 400);
      }
      const result = await rejectMaterialReturn(returnId, session.userId, reason);
      return successResponse(result, 'Return rejected');
    } catch (error) {
      console.error('Error processing material return action:', error);
      if (error instanceof Error && error.message) {
        return errorResponse(error.message, 400);
      }
      return serverErrorResponse(error);
    }
  });
}
