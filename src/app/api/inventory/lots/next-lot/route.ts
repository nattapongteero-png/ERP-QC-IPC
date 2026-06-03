/**
 * GET /api/inventory/lots/next-lot
 * Generates the next system lot number using the configured pattern
 * (falls back to legacy LOT-YYYYMMDD-NNN if nothing configured).
 */
import { NextRequest } from 'next/server';
import { successResponse, withAuth, serverErrorResponse } from '@/lib/api-utils';
import { generateSystemLot } from '@/lib/services/lot-pattern.service';

export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const lotNumber = await generateSystemLot();
      return successResponse({ lotNumber });
    } catch (err) {
      return serverErrorResponse(err);
    }
  });
}
