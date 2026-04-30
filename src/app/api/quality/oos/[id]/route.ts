/**
 * OOS Investigation — single-resource routes (Phase 3)
 *   GET  /api/quality/oos/[id]  — full detail with linked sample + deviation
 *   PUT  /api/quality/oos/[id]  — update an in-progress investigation
 *   POST /api/quality/oos/[id]  — { action: 'close', conclusion } closes it
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
  getOosInvestigation,
  updateOosInvestigation,
  closeOosInvestigation,
} from '@/lib/services/qc-sample.service';
import {
  updateOosInvestigationSchema,
  closeOosInvestigationSchema,
} from '@/lib/validation/qc-sample';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const oosId = Number(id);
      if (!Number.isFinite(oosId)) {
        return errorResponse('Invalid OOS investigation ID');
      }
      const detail = await getOosInvestigation(oosId);
      if (!detail) return notFoundResponse('OOS investigation not found');
      return successResponse(detail);
    } catch (error) {
      console.error('Error fetching OOS investigation:', error);
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
      const oosId = Number(id);
      if (!Number.isFinite(oosId)) {
        return errorResponse('Invalid OOS investigation ID');
      }
      const body = await request.json();
      const parsed = updateOosInvestigationSchema.safeParse(body);
      if (!parsed.success) {
        return errorResponse(
          'Invalid OOS update payload',
          400,
          { errors: parsed.error.issues },
        );
      }
      const result = await updateOosInvestigation(oosId, parsed.data);
      return successResponse(result, 'OOS investigation updated');
    } catch (error) {
      console.error('Error updating OOS investigation:', error);
      if (error instanceof Error && error.message) {
        return errorResponse(error.message, 400);
      }
      return serverErrorResponse(error);
    }
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const oosId = Number(id);
      if (!Number.isFinite(oosId)) {
        return errorResponse('Invalid OOS investigation ID');
      }
      const body = await request.json();
      const action = body?.action;
      if (action !== 'close') {
        return errorResponse(
          `Unsupported action "${action}" — only 'close' is accepted`,
        );
      }
      const parsed = closeOosInvestigationSchema.safeParse(body);
      if (!parsed.success) {
        return errorResponse(
          'Invalid close payload',
          400,
          { errors: parsed.error.issues },
        );
      }
      const result = await closeOosInvestigation(
        oosId,
        session.userId,
        parsed.data.conclusion,
      );
      return successResponse(result, 'OOS investigation closed');
    } catch (error) {
      console.error('Error closing OOS investigation:', error);
      if (error instanceof Error && error.message) {
        return errorResponse(error.message, 400);
      }
      return serverErrorResponse(error);
    }
  });
}
