import { NextRequest, NextResponse } from 'next/server';
import { getDb, isSqlite } from '@/lib/db';
import { 
  sqliteDeviations, sqliteItems, sqliteInventoryLots, sqliteWorkOrders, sqliteUsers,
  mysqlDeviations, mysqlItems, mysqlInventoryLots, mysqlWorkOrders, mysqlUsers
} from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { withAuth, serverErrorResponse } from '@/lib/api-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (user) => {
    try {
      const { id } = await params;
      const db = await getDb();
      const deviations = isSqlite() ? sqliteDeviations : mysqlDeviations;
      const items = isSqlite() ? sqliteItems : mysqlItems;
      const inventoryLots = isSqlite() ? sqliteInventoryLots : mysqlInventoryLots;
      const workOrders = isSqlite() ? sqliteWorkOrders : mysqlWorkOrders;
      const users = isSqlite() ? sqliteUsers : mysqlUsers;

      // Get deviation details
      const deviationResult = await (db as any)
        .select()
        .from(deviations)
        .where(eq(deviations.id, parseInt(id)));

      if (deviationResult.length === 0) {
        return NextResponse.json({ success: false, error: 'Deviation not found' }, { status: 404 });
      }

      const deviation = deviationResult[0];

      // Get item details
      let itemInfo = null;
      if (deviation.itemId) {
        const itemResult = await (db as any)
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
        itemInfo = itemResult[0] || null;
      }

      // Get lot details
      let lotInfo = null;
      if (deviation.lotId) {
        const lotResult = await (db as any)
          .select({
            id: inventoryLots.id,
            lotNumber: inventoryLots.lotNumber,
            quantity: inventoryLots.quantity,
            status: inventoryLots.status,
            expiryDate: inventoryLots.expiryDate,
          })
          .from(inventoryLots)
          .where(eq(inventoryLots.id, deviation.lotId));
        lotInfo = lotResult[0] || null;
      }

      // Get work order details
      let woInfo = null;
      if (deviation.woId) {
        const woResult = await (db as any)
          .select({
            id: workOrders.id,
            woNumber: workOrders.woNumber,
            batchNumber: workOrders.batchNumber,
            status: workOrders.status,
          })
          .from(workOrders)
          .where(eq(workOrders.id, deviation.woId));
        woInfo = woResult[0] || null;
      }

      // Get reporter info
      let reporterInfo = null;
      if (deviation.reportedBy) {
        const reporterResult = await (db as any)
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
          })
          .from(users)
          .where(eq(users.id, deviation.reportedBy));
        reporterInfo = reporterResult[0] || null;
      }

      // Get assignee info
      let assigneeInfo = null;
      if (deviation.assignedTo) {
        const assigneeResult = await (db as any)
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
          })
          .from(users)
          .where(eq(users.id, deviation.assignedTo));
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
