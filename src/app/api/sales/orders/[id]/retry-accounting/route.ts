import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { withAuth, serverErrorResponse } from '@/lib/api-utils';
import { getDb, isSqlite } from '@/lib/db';
import { sqliteSalesDeliveries, mysqlSalesDeliveries } from '@/lib/db/schema';
import { retryAccountingForDelivery } from '@/lib/services/sales.service';

// POST /api/sales/orders/[id]/retry-accounting
//
// Retroactively creates the sales JE / COGS JE / AR invoice for any
// already-shipped deliveries on this SO that are missing those artifacts.
// Idempotent — calls into the same accounting integration as fulfillment
// but skips deliveries whose books are already consistent.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(request, async (user) => {
    try {
      const { id } = await params;
      const soId = parseInt(id);
      if (isNaN(soId)) {
        return NextResponse.json(
          { success: false, error: 'Invalid order ID' },
          { status: 400 },
        );
      }

      const db = (await getDb()) as any;
      const deliveriesTable = isSqlite() ? sqliteSalesDeliveries : mysqlSalesDeliveries;
      const deliveries = await db
        .select({ id: deliveriesTable.id })
        .from(deliveriesTable)
        .where(eq(deliveriesTable.soId, soId));

      if (deliveries.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'ไม่พบรายการส่งของของ SO นี้',
        }, { status: 404 });
      }

      const results = [];
      for (const d of deliveries) {
        try {
          const r = await retryAccountingForDelivery(d.id, user.userId);
          results.push(r);
        } catch (e) {
          results.push({
            deliveryId: d.id,
            error: e instanceof Error ? e.message : 'unknown',
          });
        }
      }

      return NextResponse.json({ success: true, data: { results } });
    } catch (error) {
      console.error('Retry accounting error:', error);
      return serverErrorResponse(error);
    }
  });
}
