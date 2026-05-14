/**
 * GET /api/quality/coa/product-categories — Phase 5
 *
 * Returns the distinct, non-null product categories from the items master.
 * Used by the COA template editor to populate the "Product Category" picker
 * (admins can also free-type, but the dropdown reduces typo-driven category
 * fragmentation).
 */
import { NextRequest } from 'next/server';
import {
  successResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { listProductCategories } from '@/lib/services/coa.service';

export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const items = await listProductCategories();
      return successResponse({ items });
    } catch (error) {
      console.error('Error listing product categories:', error);
      return serverErrorResponse(error);
    }
  });
}
