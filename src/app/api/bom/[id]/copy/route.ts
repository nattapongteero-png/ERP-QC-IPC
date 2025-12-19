import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { copyBOM } from '@/lib/services/production.service';

// POST /api/bom/[id]/copy - Copy/duplicate a BOM
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const sourceBomId = parseInt(id);

      if (isNaN(sourceBomId)) {
        return errorResponse('Invalid BOM ID');
      }

      const body = await request.json();
      const { newCode, newVersion, newName, copyAsStatus } = body;

      if (!newCode) {
        return errorResponse('New BOM code is required');
      }

      const newBomId = await copyBOM(
        sourceBomId,
        {
          newCode,
          newVersion,
          newName,
          copyAsStatus,
        },
        session.userId
      );

      return successResponse(
        { id: newBomId, code: newCode },
        'BOM copied successfully'
      );
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return errorResponse(error.message, 404);
        }
        if (error.message.includes('already exists')) {
          return errorResponse(error.message, 400);
        }
      }
      return serverErrorResponse(error);
    }
  }, ['production:write']);
}
