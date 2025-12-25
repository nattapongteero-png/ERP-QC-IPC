import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getBOMPackagingQC,
  setBOMPackagingQC,
  removeBOMPackagingQC,
} from '@/lib/services/bom-configuration.service';

// GET /api/production/bom/[id]/packaging-qc - Get packaging QC criteria for BOM
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const bomId = Number(id);

      if (isNaN(bomId)) {
        return errorResponse('Invalid BOM ID');
      }

      const qc = await getBOMPackagingQC(bomId);
      return successResponse(qc);
    } catch (error) {
      console.error('Error fetching BOM packaging QC:', error);
      return serverErrorResponse(error);
    }
  });
}

// POST /api/production/bom/[id]/packaging-qc - Link QC criteria to BOM
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const bomId = Number(id);

      if (isNaN(bomId)) {
        return errorResponse('Invalid BOM ID');
      }

      const data = await request.json();

      // Validate required fields
      if (!data.criteriaId) {
        return errorResponse('Missing required field: criteriaId');
      }

      const qc = await setBOMPackagingQC({
        bomId,
        criteriaId: data.criteriaId,
      });

      return successResponse(qc, 'Packaging QC criteria linked to BOM');
    } catch (error) {
      console.error('Error setting BOM packaging QC:', error);
      return serverErrorResponse(error);
    }
  });
}

// DELETE /api/production/bom/[id]/packaging-qc - Unlink criteria
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const bomId = Number(id);

      if (isNaN(bomId)) {
        return errorResponse('Invalid BOM ID');
      }

      await removeBOMPackagingQC(bomId);
      return successResponse(null, 'Packaging QC criteria unlinked from BOM');
    } catch (error) {
      console.error('Error removing BOM packaging QC:', error);
      return serverErrorResponse(error);
    }
  });
}
