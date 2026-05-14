import { NextRequest } from 'next/server';
import { successResponse, errorResponse, serverErrorResponse, withAuth } from '@/lib/api-utils';
import { getQcTestCatalogById, updateQcTestCatalog, deleteQcTestCatalog } from '@/lib/services/qc-test-catalog.service';
import { qcTestCatalogUpdateSchema } from '@/lib/validation/qc-test-catalog';

// GET /api/quality/test-catalog/[id]
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withAuth(request, async () => {
    try {
      const { id } = await context.params;
      const row = await getQcTestCatalogById(Number(id));
      if (!row) return errorResponse('NOT_FOUND: Test catalog entry not found', 404);
      return successResponse(row);
    } catch (error) {
      console.error('GET /api/quality/test-catalog/[id] error:', error);
      return serverErrorResponse(error);
    }
  }, ['quality:test_catalog:read']);
}

// PUT /api/quality/test-catalog/[id]
export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await context.params;
      const body = await request.json();
      const parsed = qcTestCatalogUpdateSchema.safeParse(body);
      if (!parsed.success) {
        const msg = parsed.error.issues.map((i) => i.message).join(', ');
        return errorResponse(`VALIDATION_ERROR: ${msg}`, 400);
      }
      await updateQcTestCatalog(Number(id), parsed.data, session.userId);
      return successResponse({ ok: true });
    } catch (error: unknown) {
      const err = error as { message?: string; code?: string };
      if (err?.message?.includes('UNIQUE') || err?.code === 'ER_DUP_ENTRY') {
        return errorResponse('DUPLICATE_CODE: รหัสนี้ถูกใช้ไปแล้ว', 409);
      }
      console.error('PUT /api/quality/test-catalog/[id] error:', error);
      return serverErrorResponse(error);
    }
  }, ['quality:test_catalog:write']);
}

// DELETE /api/quality/test-catalog/[id]  (soft delete)
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await context.params;
      await deleteQcTestCatalog(Number(id), session.userId);
      return successResponse({ ok: true });
    } catch (error) {
      console.error('DELETE /api/quality/test-catalog/[id] error:', error);
      return serverErrorResponse(error);
    }
  }, ['quality:test_catalog:delete']);
}
