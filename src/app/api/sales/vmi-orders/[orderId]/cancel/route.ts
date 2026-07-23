/**
 * VMI Order Cancel API Route (CANCEL-PO-VENDOR-GUIDE)
 *
 * POST - Cancel a hospital PO that reached us through the VMI Portal and push
 * the cancellation back to the portal.
 *
 * Unlike the older reject route this sends a structured reason_code and only
 * marks the order cancelled locally once the portal accepts, so the two systems
 * cannot silently disagree about whether the PO is still live.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import { VmiSalesOrderService, VmiSalesOrderError } from '@/lib/services/vmi-sales-order.service';
import { VMI_CANCEL_REASON_CODES } from '@/types/vmi';
import { z } from 'zod';

const cancelOrderSchema = z.object({
  // Must match the portal's enum exactly — any other value is rejected upstream
  // with VALIDATION_ERROR, so catch it here with a Thai message instead.
  reasonCode: z.enum(VMI_CANCEL_REASON_CODES, {
    message: 'กรุณาเลือกเหตุผลในการยกเลิกให้ถูกต้อง',
  }),
  reasonText: z
    .string()
    .min(1, 'ต้องระบุรายละเอียดเหตุผลในการยกเลิก')
    .max(500, 'เหตุผลในการยกเลิกต้องไม่เกิน 500 ตัวอักษร'),
});

/**
 * Build marker so a deploy can be PROVEN live without authenticating: a stale
 * image 404s here, the new one returns this contract summary. Read-only.
 */
export async function GET() {
  return NextResponse.json({
    route: 'vmi-cancel-po',
    marker: 'VMI_CANCEL_PO_V1_20260723',
    method: 'POST',
    portalEndpoint: 'POST /api/external/vendor/orders/{id}/cancel',
    reasonCodes: VMI_CANCEL_REASON_CODES,
    cancellableLocalStatuses: ['pending', 'confirmed'],
  });
}

/**
 * POST /api/sales/vmi-orders/[orderId]/cancel
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> },
) {
  return withAuth(request, async (session) => {
    try {
      const { orderId } = await context.params;
      const id = parseInt(orderId, 10);
      if (isNaN(id)) {
        return NextResponse.json({ success: false, error: 'Invalid order ID' }, { status: 400 });
      }

      const body = await request.json();
      const data = cancelOrderSchema.parse(body);

      const service = new VmiSalesOrderService();
      const result = await service.cancelOrder(
        id,
        data.reasonCode,
        data.reasonText,
        session.userId,
      );

      return NextResponse.json({
        success: true,
        data: {
          vmiOrderId: id,
          status: result.vmiOrder.localStatus,
          linkedSalesOrderId: result.linkedSalesOrderId,
          message: result.message,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { success: false, error: error.issues[0]?.message || 'Invalid request body' },
          { status: 400 },
        );
      }
      if (error instanceof VmiSalesOrderError) {
        return NextResponse.json(
          { success: false, error: error.message, code: error.code },
          { status: error.httpStatus },
        );
      }
      console.error('Failed to cancel VMI order:', error);
      return NextResponse.json(
        { success: false, error: error instanceof Error ? error.message : 'Failed to cancel VMI order' },
        { status: 500 },
      );
    }
  });
}
