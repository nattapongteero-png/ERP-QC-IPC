/**
 * QC Samples — single-resource routes
 *   GET    /api/quality/qc-samples/[id] — full detail (header + tests + signatures + oos + linked COA)
 *   PUT    /api/quality/qc-samples/[id] — update metadata (rejected when status='approved'/'released')
 *   DELETE /api/quality/qc-samples/[id] — delete (only when draft/registered + no results)
 *   POST   /api/quality/qc-samples/[id] — status transition action
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
  getQcSampleById,
  updateQcSample,
  deleteQcSample,
  updateSampleStatus,
} from '@/lib/services/qc-sample.service';
import {
  updateQcSampleSchema,
  updateStatusSchema,
} from '@/lib/validation/qc-sample';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const sampleId = Number(id);
      if (!Number.isFinite(sampleId)) {
        return errorResponse('Invalid sample ID');
      }
      const detail = await getQcSampleById(sampleId);
      if (!detail) return notFoundResponse('QC sample not found');
      return successResponse(detail);
    } catch (error) {
      console.error('Error fetching QC sample detail:', error);
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
      const sampleId = Number(id);
      if (!Number.isFinite(sampleId)) {
        return errorResponse('Invalid sample ID');
      }
      const body = await request.json();
      const parsed = updateQcSampleSchema.safeParse(body);
      if (!parsed.success) {
        return errorResponse(
          'Invalid sample update payload',
          400,
          { errors: parsed.error.issues },
        );
      }
      const result = await updateQcSample(sampleId, parsed.data);
      return successResponse(result, 'Sample updated');
    } catch (error) {
      console.error('Error updating QC sample:', error);
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
      const sampleId = Number(id);
      if (!Number.isFinite(sampleId)) {
        return errorResponse('Invalid sample ID');
      }
      const result = await deleteQcSample(sampleId);
      return successResponse(result, 'Sample deleted');
    } catch (error) {
      console.error('Error deleting QC sample:', error);
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
      const sampleId = Number(id);
      if (!Number.isFinite(sampleId)) {
        return errorResponse('Invalid sample ID');
      }
      const body = await request.json();
      const parsed = updateStatusSchema.safeParse(body);
      if (!parsed.success) {
        return errorResponse(
          'Invalid status action payload',
          400,
          { errors: parsed.error.issues },
        );
      }
      const result = await updateSampleStatus(
        sampleId,
        parsed.data.action,
        session.userId,
        parsed.data.reason,
      );
      return successResponse(
        result,
        `Sample transitioned: ${result.fromStatus} → ${result.toStatus}`,
      );
    } catch (error) {
      console.error('Error transitioning QC sample status:', error);
      if (error instanceof Error && error.message) {
        return errorResponse(error.message, 400);
      }
      return serverErrorResponse(error);
    }
  });
}
