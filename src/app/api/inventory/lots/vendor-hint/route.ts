/**
 * GET /api/inventory/lots/vendor-hint?locale=th|en
 * Returns the vendor-lot placeholder hint + optional validation regex,
 * for the lot-entry form to render the Vendor Lot Number input.
 */
import { NextRequest } from 'next/server';
import { successResponse, withAuth, serverErrorResponse } from '@/lib/api-utils';
import { getVendorHint } from '@/lib/services/lot-pattern.service';

export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const locale = searchParams.get('locale') === 'en' ? 'en' : 'th';
      const result = await getVendorHint(locale);
      return successResponse(result);
    } catch (err) {
      return serverErrorResponse(err);
    }
  });
}
