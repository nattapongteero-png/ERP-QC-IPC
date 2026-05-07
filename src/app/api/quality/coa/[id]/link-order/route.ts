/**
 * POST /api/quality/coa/[id]/link-order — Phase 8
 *
 * Link an issued COA to a customer + sales-order ref so it can be:
 *   - found from the Sales Order detail page
 *   - emailed to the customer's recorded email address
 *
 * Body: { customerId?: number|null, salesOrderRef?: string|null }
 * Both fields are optional but at least one must be present (otherwise
 * the link call is a no-op).
 */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { linkCoaToOrder } from '@/lib/services/coa.service';

const linkSchema = z
  .object({
    customerId: z.number().int().positive().nullable().optional(),
    salesOrderRef: z.string().max(50).nullable().optional(),
  })
  .refine(
    (v) =>
      (v.customerId != null && v.customerId > 0) ||
      (v.salesOrderRef != null && String(v.salesOrderRef).trim().length > 0),
    { message: 'Provide at least one of customerId or salesOrderRef' },
  );

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const coaId = Number(id);
      if (!Number.isFinite(coaId)) return errorResponse('Invalid COA ID');

      const body = await request.json();
      const parsed = linkSchema.safeParse(body);
      if (!parsed.success) {
        return errorResponse('Invalid link payload', 400, {
          errors: parsed.error.issues,
        });
      }

      const result = await linkCoaToOrder(
        coaId,
        parsed.data.customerId ?? null,
        parsed.data.salesOrderRef
          ? String(parsed.data.salesOrderRef).trim()
          : null,
      );
      return successResponse(result, 'COA linked to order');
    } catch (error) {
      console.error('Error linking COA to order:', error);
      if (error instanceof Error && error.message) {
        return errorResponse(error.message, 400);
      }
      return serverErrorResponse(error);
    }
  });
}
