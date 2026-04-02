import { NextRequest } from 'next/server';
import { eq, or, inArray, desc } from 'drizzle-orm';
import { getTableRef, executeDbOperation } from '@/lib/db/db-helper';
import { successResponse, serverErrorResponse, withAuth } from '@/lib/api-utils';

interface WORequisitionRow {
  workOrderId: number;
  woNumber: string;
  batchNumber: string;
  productName: string | null;
  productCode: string | null;
  plannedQuantity: number;
  unit: string;
  requisitionStatus: string;
  requestedById: number | null;
  requestedAt: string | Date | null;
  approvedById: number | null;
  approvedAt: string | Date | null;
}

// GET /api/inventory/requisitions?status=requested|approved|all
export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const statusFilter = searchParams.get('status') || 'requested';

      const workOrdersTable = getTableRef('workOrders');
      const itemsTable = getTableRef('items');
      const usersTable = getTableRef('users');
      const workOrderMaterialsTable = getTableRef('workOrderMaterials');

      // Build requisitionStatus filter condition
      let statusCondition;
      if (statusFilter === 'all') {
        statusCondition = or(
          eq(workOrdersTable.requisitionStatus, 'requested'),
          eq(workOrdersTable.requisitionStatus, 'approved')
        );
      } else if (statusFilter === 'approved') {
        statusCondition = eq(workOrdersTable.requisitionStatus, 'approved');
      } else {
        // Default: 'requested'
        statusCondition = eq(workOrdersTable.requisitionStatus, 'requested');
      }

      // Query work orders with product info
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const workOrders: WORequisitionRow[] = (await executeDbOperation(async (db) => {
        return db
          .select({
            workOrderId: workOrdersTable.id,
            woNumber: workOrdersTable.woNumber,
            batchNumber: workOrdersTable.batchNumber,
            productName: itemsTable.nameTh,
            productCode: itemsTable.code,
            plannedQuantity: workOrdersTable.plannedQuantity,
            unit: workOrdersTable.unit,
            requisitionStatus: workOrdersTable.requisitionStatus,
            requestedById: workOrdersTable.requisitionRequestedBy,
            requestedAt: workOrdersTable.requisitionRequestedAt,
            approvedById: workOrdersTable.requisitionApprovedBy,
            approvedAt: workOrdersTable.requisitionApprovedAt,
          })
          .from(workOrdersTable)
          .leftJoin(itemsTable, eq(workOrdersTable.productId, itemsTable.id))
          .where(statusCondition)
          .orderBy(desc(workOrdersTable.requisitionRequestedAt));
      })) as WORequisitionRow[];

      if (workOrders.length === 0) {
        return successResponse([]);
      }

      // Collect all user IDs to resolve names in a single query
      const userIdSet = new Set<number>();
      for (const wo of workOrders) {
        if (wo.requestedById) userIdSet.add(wo.requestedById as number);
        if (wo.approvedById) userIdSet.add(wo.approvedById as number);
      }

      const userIds = Array.from(userIdSet);
      const userMap = new Map<number, string>();

      if (userIds.length > 0) {
        const users = await executeDbOperation(async (db) => {
          return db
            .select({ id: usersTable.id, name: usersTable.name })
            .from(usersTable)
            .where(inArray(usersTable.id, userIds));
        });
        for (const u of users) {
          userMap.set(u.id as number, u.name as string);
        }
      }

      // Collect all work order IDs for bulk materials query
      const woIds = workOrders.map((wo) => wo.workOrderId as number);

      // Fetch materials for all matching work orders in one query
      const allMaterials = await executeDbOperation(async (db) => {
        return db
          .select({
            workOrderId: workOrderMaterialsTable.workOrderId,
            materialId: workOrderMaterialsTable.id,
            itemId: workOrderMaterialsTable.itemId,
            itemCode: itemsTable.code,
            itemName: itemsTable.nameTh,
            plannedQuantity: workOrderMaterialsTable.plannedQuantity,
            actualQuantity: workOrderMaterialsTable.actualQuantity,
            unit: workOrderMaterialsTable.unit,
            status: workOrderMaterialsTable.status,
          })
          .from(workOrderMaterialsTable)
          .leftJoin(itemsTable, eq(workOrderMaterialsTable.itemId, itemsTable.id))
          .where(inArray(workOrderMaterialsTable.workOrderId, woIds));
      });

      // Group materials by workOrderId
      const materialsMap = new Map<number, typeof allMaterials>();
      for (const mat of allMaterials) {
        const woId = mat.workOrderId as number;
        if (!materialsMap.has(woId)) {
          materialsMap.set(woId, []);
        }
        materialsMap.get(woId)!.push(mat);
      }

      // Build final response
      const result = workOrders.map((wo) => ({
        workOrderId: wo.workOrderId,
        woNumber: wo.woNumber,
        batchNumber: wo.batchNumber,
        productName: wo.productName,
        productCode: wo.productCode,
        plannedQuantity: wo.plannedQuantity,
        unit: wo.unit,
        requisitionStatus: wo.requisitionStatus,
        requestedBy: wo.requestedById ? (userMap.get(wo.requestedById as number) ?? null) : null,
        requestedAt: wo.requestedAt,
        approvedBy: wo.approvedById ? (userMap.get(wo.approvedById as number) ?? null) : null,
        approvedAt: wo.approvedAt,
        materials: materialsMap.get(wo.workOrderId as number) ?? [],
      }));

      return successResponse(result);
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['inventory:read']);
}
