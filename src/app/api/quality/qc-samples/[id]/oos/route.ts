/**
 * QC Sample OOS Investigations (collection) — Phase 3
 *   GET  /api/quality/qc-samples/[id]/oos — list OOS investigations for sample
 *   POST /api/quality/qc-samples/[id]/oos — initiate a new investigation
 *
 * On classification === 'manufacturing_error', the service auto-creates a
 * Deviation record (sourceType='qc_oos') and cross-links it via the
 * qc_oos_investigations.capa_id column.
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  listOosInvestigationsBySample,
  createOosInvestigation,
} from '@/lib/services/qc-sample.service';
import { createOosInvestigationSchema } from '@/lib/validation/qc-sample';

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
      const items = await listOosInvestigationsBySample(sampleId);
      return successResponse({ items });
    } catch (error) {
      console.error('Error listing OOS investigations:', error);
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
      const parsed = createOosInvestigationSchema.safeParse(body);
      if (!parsed.success) {
        return errorResponse(
          'Invalid OOS investigation payload',
          400,
          { errors: parsed.error.issues },
        );
      }
      const result = await createOosInvestigation({
        ...parsed.data,
        initiatedBy: session.userId,
      });
      const msg = result.deviationNumber
        ? `OOS #${result.oosId} opened — auto-created deviation ${result.deviationNumber}`
        : `OOS #${result.oosId} opened`;
      return successResponse(result, msg);
    } catch (error) {
      console.error('Error creating OOS investigation:', error);
      if (error instanceof Error && error.message) {
        return errorResponse(error.message, 400);
      }
      return serverErrorResponse(error);
    }
  });
}
