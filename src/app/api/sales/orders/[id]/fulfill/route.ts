import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth, serverErrorResponse } from '@/lib/api-utils';
import { fulfillSalesOrderLine } from '@/lib/services/sales.service';

const fulfillSchema = z.object({
  soLineId: z.number().int().positive(),
  itemId: z.number().int().positive(),
  lotId: z.number().int().positive(),
  quantity: z.number().positive(),
  notes: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (user) => {
    try {
      const { id } = await params;
      const soId = parseInt(id);

      if (isNaN(soId)) {
        return NextResponse.json(
          { success: false, error: 'Invalid order ID' },
          { status: 400 }
        );
      }

      const body = await request.json();
      const parsed = fulfillSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: 'Invalid request', details: parsed.error.issues },
          { status: 400 }
        );
      }

      const result = await fulfillSalesOrderLine(
        {
          soId,
          soLineId: parsed.data.soLineId,
          itemId: parsed.data.itemId,
          lotId: parsed.data.lotId,
          quantity: parsed.data.quantity,
          notes: parsed.data.notes,
        },
        user.id
      );

      return NextResponse.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Fulfillment error:', error);
      return serverErrorResponse(error);
    }
  });
}
