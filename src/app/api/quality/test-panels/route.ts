/**
 * QC Test Panels — collection routes
 *   GET  /api/quality/test-panels  — list (filters: productId, productCategory, isActive)
 *   POST /api/quality/test-panels  — create a panel row
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  listTestPanels,
  createTestPanel,
  type ListTestPanelsFilters,
} from '@/lib/services/qc-sample.service';
import { createTestPanelSchema } from '@/lib/validation/qc-sample';

export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const filters: ListTestPanelsFilters = {};
      const productId = searchParams.get('productId');
      if (productId) {
        const n = Number(productId);
        if (!Number.isFinite(n)) return errorResponse('productId must be a number');
        filters.productId = n;
      }
      const productCategory = searchParams.get('productCategory');
      if (productCategory) filters.productCategory = productCategory;
      const isActive = searchParams.get('isActive');
      if (isActive != null && isActive !== '') {
        filters.isActive = isActive === 'true';
      }
      const items = await listTestPanels(filters);
      return successResponse({ items });
    } catch (error) {
      console.error('Error listing test panels:', error);
      return serverErrorResponse(error);
    }
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const body = await request.json();
      const parsed = createTestPanelSchema.safeParse(body);
      if (!parsed.success) {
        return errorResponse(
          'Invalid test panel payload',
          400,
          { errors: parsed.error.issues },
        );
      }
      const result = await createTestPanel(parsed.data);
      return successResponse(result, 'Test panel row created');
    } catch (error) {
      console.error('Error creating test panel:', error);
      if (error instanceof Error && error.message) {
        return errorResponse(error.message, 400);
      }
      return serverErrorResponse(error);
    }
  });
}
