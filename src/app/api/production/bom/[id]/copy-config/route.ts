import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { copyBOMConfiguration } from '@/lib/services/bom-configuration.service';

// POST /api/production/bom/[id]/copy-config - Copy configuration from another BOM
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const targetBomId = Number(id);

      if (isNaN(targetBomId)) {
        return errorResponse('Invalid target BOM ID');
      }

      const data = await request.json();

      if (!data.sourceBomId) {
        return errorResponse('Missing required field: sourceBomId');
      }

      const sourceBomId = Number(data.sourceBomId);
      if (isNaN(sourceBomId)) {
        return errorResponse('Invalid source BOM ID');
      }

      if (sourceBomId === targetBomId) {
        return errorResponse('Source and target BOM cannot be the same');
      }

      const result = await copyBOMConfiguration(sourceBomId, targetBomId);
      return successResponse(result, 'BOM configuration copied successfully');
    } catch (error) {
      console.error('Error copying BOM configuration:', error);
      return serverErrorResponse(error);
    }
  });
}
