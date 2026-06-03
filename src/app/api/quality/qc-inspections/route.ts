/**
 * QC Inspection API (Audit Q5)
 */
import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  createInspection,
  listInspections,
  type InspectionType,
  type OverallResult,
} from '@/lib/services/qc-inspection.service';

const VALID_TYPES: InspectionType[] = ['incoming', 'in_process', 'finished', 'ad_hoc'];
const VALID_RESULTS: OverallResult[] = ['pending', 'pass', 'fail'];

// GET /api/quality/qc-inspections?workOrderId=&inspectionType=&overallResult=&limit=
export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const type = searchParams.get('inspectionType');
      const result = searchParams.get('overallResult');
      const data = await listInspections({
        workOrderId: searchParams.get('workOrderId')
          ? Number(searchParams.get('workOrderId'))
          : undefined,
        inspectionType:
          type && VALID_TYPES.includes(type as InspectionType)
            ? (type as InspectionType)
            : undefined,
        overallResult:
          result && VALID_RESULTS.includes(result as OverallResult)
            ? (result as OverallResult)
            : undefined,
        limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : 200,
      });
      return successResponse(data);
    } catch (error) {
      console.error('QC inspections GET error:', error);
      return serverErrorResponse(error);
    }
  });
}

// POST /api/quality/qc-inspections
// Body: { workOrderId?, batchNumber?, inspectionType, subject, findings?, overallResult?, inspectedAt?, notes? }
export async function POST(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const data = await request.json();
      if (!data?.subject?.trim()) return errorResponse('subject is required');
      if (!data?.inspectionType || !VALID_TYPES.includes(data.inspectionType)) {
        return errorResponse(`inspectionType must be one of: ${VALID_TYPES.join(', ')}`);
      }
      if (
        data.overallResult &&
        !VALID_RESULTS.includes(data.overallResult as OverallResult)
      ) {
        return errorResponse(`overallResult must be one of: ${VALID_RESULTS.join(', ')}`);
      }

      const row = await createInspection({
        workOrderId: data.workOrderId ? Number(data.workOrderId) : null,
        batchNumber: data.batchNumber ?? null,
        inspectionType: data.inspectionType,
        subject: data.subject,
        findings: data.findings ?? null,
        overallResult: data.overallResult ?? 'pending',
        inspectorId: session.userId,
        inspectedAt: data.inspectedAt || undefined,
        notes: data.notes ?? null,
      });
      return successResponse(row, `Inspection ${row.inspectionNumber} created`);
    } catch (error) {
      console.error('QC inspections POST error:', error);
      return serverErrorResponse(error);
    }
  });
}
