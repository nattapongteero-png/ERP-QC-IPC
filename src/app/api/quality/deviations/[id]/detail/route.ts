import { NextRequest, NextResponse } from 'next/server';
import { getTableRef, executeDbOperation } from '@/lib/db/db-helper';
import { eq } from 'drizzle-orm';
import { withAuth, serverErrorResponse } from '@/lib/api-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const deviations = getTableRef('deviations');
      const items = getTableRef('items');
      const inventoryLots = getTableRef('inventoryLots');
      const workOrders = getTableRef('workOrders');
      const users = getTableRef('users');

      // Get deviation details
      const deviationResult = await executeDbOperation(async (db) => {
        return db
          .select()
          .from(deviations)
          .where(eq(deviations.id, parseInt(id)));
      });

      if (deviationResult.length === 0) {
        return NextResponse.json({ success: false, error: 'Deviation not found' }, { status: 404 });
      }

      const deviation = deviationResult[0];

      // Get item details
      let itemInfo = null;
      if (deviation.itemId) {
        const itemResult = await executeDbOperation(async (db) => {
          return db
            .select({
              id: items.id,
              code: items.code,
              nameTh: items.nameTh,
              nameEn: items.nameEn,
              type: items.type,
              unit: items.primaryUnit,
            })
            .from(items)
            .where(eq(items.id, deviation.itemId));
        });
        itemInfo = itemResult[0] || null;
      }

      // Get lot details
      let lotInfo = null;
      if (deviation.lotId) {
        const lotResult = await executeDbOperation(async (db) => {
          return db
            .select({
              id: inventoryLots.id,
              lotNumber: inventoryLots.lotNumber,
              quantity: inventoryLots.quantity,
              status: inventoryLots.status,
              expiryDate: inventoryLots.expiryDate,
            })
            .from(inventoryLots)
            .where(eq(inventoryLots.id, deviation.lotId));
        });
        lotInfo = lotResult[0] || null;
      }

      // Get work order details
      let woInfo = null;
      if (deviation.workOrderId) {
        const woResult = await executeDbOperation(async (db) => {
          return db
            .select({
              id: workOrders.id,
              woNumber: workOrders.woNumber,
              batchNumber: workOrders.batchNumber,
              status: workOrders.status,
            })
            .from(workOrders)
            .where(eq(workOrders.id, deviation.workOrderId));
        });
        woInfo = woResult[0] || null;
      }

      // Get reporter info
      let reporterInfo = null;
      if (deviation.reportedBy) {
        const reporterResult = await executeDbOperation(async (db) => {
          return db
            .select({
              id: users.id,
              name: users.name,
              email: users.email,
            })
            .from(users)
            .where(eq(users.id, deviation.reportedBy));
        });
        reporterInfo = reporterResult[0] || null;
      }

      // Get assignee info
      let assigneeInfo = null;
      if (deviation.assignedTo) {
        const assigneeResult = await executeDbOperation(async (db) => {
          return db
            .select({
              id: users.id,
              name: users.name,
              email: users.email,
            })
            .from(users)
            .where(eq(users.id, deviation.assignedTo));
        });
        assigneeInfo = assigneeResult[0] || null;
      }

      // Calculate days open
      const createdDate = new Date(deviation.createdAt);
      const now = new Date();
      const daysOpen = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

      return NextResponse.json({
        success: true,
        data: {
          deviation,
          item: itemInfo,
          lot: lotInfo,
          workOrder: woInfo,
          reporter: reporterInfo,
          assignee: assigneeInfo,
          metrics: {
            daysOpen,
            isOverdue: deviation.dueDate ? new Date(deviation.dueDate) < now : false,
          },
        },
      });
    } catch (error) {
      console.error('Error fetching deviation details:', error);
      return serverErrorResponse(error);
    }
  });
}
