import { NextRequest, NextResponse } from 'next/server';
import { eq, desc } from 'drizzle-orm';
import { getTableRef, executeDbOperation } from '@/lib/db/db-helper';
import { withAuth, serverErrorResponse } from '@/lib/api-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const soId = parseInt(id);

      const salesDeliveries = getTableRef('salesDeliveries');
      const items = getTableRef('items');

      const deliveries = await executeDbOperation(async (db) => {
        return db
          .select({
            id: salesDeliveries.id,
            deliveryNumber: salesDeliveries.deliveryNumber,
            soLineId: salesDeliveries.soLineId,
            itemId: salesDeliveries.itemId,
            itemCode: items.code,
            itemName: items.nameTh,
            lotId: salesDeliveries.lotId,
            lotNumber: salesDeliveries.lotNumber,
            quantity: salesDeliveries.quantity,
            unit: salesDeliveries.unit,
            deliveryDate: salesDeliveries.deliveryDate,
            status: salesDeliveries.status,
            notes: salesDeliveries.notes,
            createdAt: salesDeliveries.createdAt,
          })
          .from(salesDeliveries)
          .leftJoin(items, eq(salesDeliveries.itemId, items.id))
          .where(eq(salesDeliveries.soId, soId))
          .orderBy(desc(salesDeliveries.createdAt));
      });

      // Calculate summary
      const totalDelivered = deliveries.reduce(
        (sum: number, d: typeof deliveries[0]) => sum + Number(d.quantity || 0),
        0
      );

      return NextResponse.json({
        success: true,
        data: {
          deliveries,
          summary: {
            count: deliveries.length,
            totalDelivered,
          },
        },
      });
    } catch (error) {
      console.error('Error fetching deliveries:', error);
      return serverErrorResponse(error);
    }
  });
}
