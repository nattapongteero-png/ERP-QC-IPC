/**
 * QC Inspection detail / update API (Audit Q5)
 */
import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getInspection,
  updateInspection,
  type OverallResult,
} from '@/lib/services/qc-inspection.service';

const VALID_RESULTS: OverallResult[] = ['pending', 'pass', 'fail'];

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(_request, async () => {
    try {
      const { id } = await params;
      const row = await getInspection(Number(id));
      if (!row) return errorResponse('Inspection not found', 404);
      return successResponse(row);
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
      const data = await request.json();
      if (
        data.overallResult &&
        !VALID_RESULTS.includes(data.overallResult as OverallResult)
      ) {
        return errorResponse(`overallResult must be one of: ${VALID_RESULTS.join(', ')}`);
      }
      const row = await updateInspection(Number(id), {
        findings: data.findings,
        overallResult: data.overallResult,
        subject: data.subject,
        notes: data.notes,
      });
      return successResponse(row, 'Inspection updated');
    } catch (error) {
      return serverErrorResponse(error);
    }
  });
}
