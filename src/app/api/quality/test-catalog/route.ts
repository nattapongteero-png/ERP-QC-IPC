import { NextRequest } from 'next/server';
import { successResponse, errorResponse, serverErrorResponse, withAuth } from '@/lib/api-utils';
import { listQcTestCatalog, createQcTestCatalog, countQcTestCatalog } from '@/lib/services/qc-test-catalog.service';
import { qcTestCatalogCreateSchema, QC_TEST_CATEGORIES, type QcTestCategory } from '@/lib/validation/qc-test-catalog';

// GET /api/quality/test-catalog
export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const search = searchParams.get('search') ?? undefined;
      const categoryParam = searchParams.get('category') as QcTestCategory | null;
      const category = categoryParam && QC_TEST_CATEGORIES.includes(categoryParam) ? categoryParam : undefined;

      const isActiveParam = searchParams.get('isActive');
      const isActive = isActiveParam === null || isActiveParam === '' ? undefined : isActiveParam === 'true';

      const limit = Number(searchParams.get('limit') ?? 500);
      const offset = Number(searchParams.get('offset') ?? 0);

      const [rows, total] = await Promise.all([
        listQcTestCatalog({ search, category, isActive, limit, offset }),
        countQcTestCatalog({ search, category, isActive }),
      ]);

      return successResponse({ data: rows, total });
    } catch (error) {
      console.error('GET /api/quality/test-catalog error:', error);
      return serverErrorResponse(error);
    }
  }, ['quality:test_catalog:read']);
}

// POST /api/quality/test-catalog
export async function POST(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const body = await request.json();
      const parsed = qcTestCatalogCreateSchema.safeParse(body);
      if (!parsed.success) {
        const msg = parsed.error.issues.map((i) => i.message).join(', ');
        return errorResponse(`VALIDATION_ERROR: ${msg}`, 400);
      }
      const id = await createQcTestCatalog(parsed.data, session.userId);
      return successResponse({ id }, 'Created');
    } catch (error: unknown) {
      const err = error as { message?: string; code?: string };
      if (err?.message?.includes('UNIQUE') || err?.code === 'ER_DUP_ENTRY') {
        return errorResponse('DUPLICATE_CODE: รหัสนี้ถูกใช้ไปแล้ว', 409);
      }
      console.error('POST /api/quality/test-catalog error:', error);
      return serverErrorResponse(error);
    }
  }, ['quality:test_catalog:write']);
}
