/**
 * SOP / GMP Assistant (RAG) API
 *
 * POST /api/documents/sop-assistant
 * Body: { question: string, typeId?: number, maxDocs?: number }
 *
 * Retrieves relevant ACTIVE controlled documents and returns a grounded,
 * cited answer. Read-level permission — it only reads documents.
 */
import { NextRequest } from 'next/server';
import { successResponse, errorResponse, serverErrorResponse, withAuth } from '@/lib/api-utils';
import { askSop } from '@/lib/services/sop-assistant.service';

export async function POST(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const body = await request.json().catch(() => ({}));
        const question = typeof body?.question === 'string' ? body.question : '';
        if (!question.trim()) {
          return errorResponse('question is required', 400);
        }

        const result = await askSop(question, {
          typeId: typeof body?.typeId === 'number' ? body.typeId : undefined,
          maxDocs: typeof body?.maxDocs === 'number' ? body.maxDocs : undefined,
        });

        return successResponse(result);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['documents:read']
  );
}
