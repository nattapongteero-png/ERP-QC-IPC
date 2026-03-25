import { NextRequest } from 'next/server';
import { eq, sql, and } from 'drizzle-orm';
import { getTableRef, executeDbOperation, dbDate, parseDbDate } from '@/lib/db/db-helper';
import { successResponse, errorResponse, notFoundResponse, serverErrorResponse, withAuth } from '@/lib/api-utils';
import { createAuditLog, getClientIP } from '@/lib/audit';

type RouteParams = { params: Promise<{ id: string }> };

const EDITABLE_STATUSES = ['draft', 'planned'];

// PUT /api/production/work-orders/[id] - Update work order (draft/planned only)
export async function PUT(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const workOrderId = parseInt(id);

      if (isNaN(workOrderId)) {
        return errorResponse('Invalid work order ID');
      }

      const body = await request.json();
      const { batchNumber, plannedQuantity, priority, plannedStartDate, plannedEndDate, deliveryDate, notes } = body;

      const workOrdersTable = getTableRef('workOrders');
      const workOrderMaterialsTable = getTableRef('workOrderMaterials');
      const bomTable = getTableRef('bOM');
      const bomLinesTable = getTableRef('bOMLines');

      // Fetch existing work order
      const existing = await executeDbOperation(async (db) => {
        return db
          .select()
          .from(workOrdersTable)
          .where(eq(workOrdersTable.id, workOrderId))
          .limit(1);
      });

      if (existing.length === 0) {
        return notFoundResponse('Work order not found');
      }

      const oldWO = existing[0];

      // Only draft/planned work orders can be edited
      if (!EDITABLE_STATUSES.includes(oldWO.status as string)) {
        return errorResponse(
          `Cannot edit work order with status '${oldWO.status}'. Only draft or planned work orders can be edited.`
        );
      }

      // Build update data with only provided fields
      const updateData: Record<string, unknown> = {
        updatedAt: dbDate(),
      };

      if (batchNumber !== undefined) updateData.batchNumber = batchNumber;
      if (priority !== undefined) updateData.priority = priority;
      if (plannedStartDate !== undefined) updateData.plannedStartDate = parseDbDate(plannedStartDate);
      if (plannedEndDate !== undefined) updateData.plannedEndDate = parseDbDate(plannedEndDate);
      if (deliveryDate !== undefined) updateData.deliveryDate = parseDbDate(deliveryDate);
      if (notes !== undefined) updateData.notes = notes;

      // Track if quantity changed for material recalculation
      const quantityChanged = plannedQuantity !== undefined && Number(plannedQuantity) !== Number(oldWO.plannedQuantity);

      if (plannedQuantity !== undefined) {
        updateData.plannedQuantity = plannedQuantity;
      }

      // Update the work order
      await executeDbOperation(async (db) => {
        return db
          .update(workOrdersTable)
          .set(updateData)
          .where(eq(workOrdersTable.id, workOrderId));
      });

      // If quantity changed, recalculate pending material quantities from BOM
      let materialsUpdated = 0;
      if (quantityChanged) {
        // Fetch BOM to get batch size
        const bomResult = await executeDbOperation(async (db) => {
          return db
            .select({
              id: bomTable.id,
              batchSize: bomTable.batchSize,
            })
            .from(bomTable)
            .where(eq(bomTable.id, oldWO.bomId as number));
        });

        if (bomResult.length > 0) {
          const bomBatchSize = Number(bomResult[0].batchSize) || 1;
          const newScalingFactor = Number(plannedQuantity) / bomBatchSize;

          // Fetch BOM lines for recalculation
          const bomLines = await executeDbOperation(async (db) => {
            return db
              .select({
                id: bomLinesTable.id,
                itemId: bomLinesTable.itemId,
                quantity: bomLinesTable.quantity,
              })
              .from(bomLinesTable)
              .where(eq(bomLinesTable.bomId, oldWO.bomId as number));
          });

          // Build a map of BOM line itemId -> scaled quantity
          const bomLineMap = new Map<number, number>();
          for (const line of bomLines) {
            const scaledQuantity = Number(line.quantity) * newScalingFactor;
            bomLineMap.set(line.itemId as number, scaledQuantity);
          }

          // Fetch pending materials for this work order
          const pendingMaterials = await executeDbOperation(async (db) => {
            return db
              .select({
                id: workOrderMaterialsTable.id,
                itemId: workOrderMaterialsTable.itemId,
              })
              .from(workOrderMaterialsTable)
              .where(
                and(
                  eq(workOrderMaterialsTable.workOrderId, workOrderId),
                  eq(workOrderMaterialsTable.status, 'pending')
                )
              );
          });

          // Update each pending material with recalculated quantity
          for (const material of pendingMaterials) {
            const newPlannedQty = bomLineMap.get(material.itemId as number);
            if (newPlannedQty !== undefined) {
              await executeDbOperation(async (db) => {
                return db
                  .update(workOrderMaterialsTable)
                  .set({ plannedQuantity: newPlannedQty })
                  .where(eq(workOrderMaterialsTable.id, material.id as number));
              });
              materialsUpdated++;
            }
          }
        }
      }

      // Build audit old/new values
      const oldValue: Record<string, unknown> = {};
      const newValue: Record<string, unknown> = {};
      const auditFields = ['batchNumber', 'plannedQuantity', 'priority', 'plannedStartDate', 'plannedEndDate', 'notes'];
      for (const field of auditFields) {
        if (body[field] !== undefined) {
          oldValue[field] = oldWO[field as keyof typeof oldWO];
          newValue[field] = body[field];
        }
      }
      if (materialsUpdated > 0) {
        newValue.materialsRecalculated = materialsUpdated;
      }

      await createAuditLog({
        userId: session.userId,
        action: 'UPDATE',
        tableName: 'work_orders',
        recordId: workOrderId,
        oldValue,
        newValue,
        ipAddress: getClientIP(request),
      });

      return successResponse(
        { id: workOrderId, materialsUpdated },
        `Work order updated successfully${materialsUpdated > 0 ? ` (${materialsUpdated} materials recalculated)` : ''}`
      );
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['production:write']);
}

// DELETE /api/production/work-orders/[id] - Delete work order (draft/planned only)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const workOrderId = parseInt(id);

      if (isNaN(workOrderId)) {
        return errorResponse('Invalid work order ID');
      }

      const workOrdersTable = getTableRef('workOrders');
      const workOrderMaterialsTable = getTableRef('workOrderMaterials');

      // Fetch existing work order
      const existing = await executeDbOperation(async (db) => {
        return db
          .select()
          .from(workOrdersTable)
          .where(eq(workOrdersTable.id, workOrderId))
          .limit(1);
      });

      if (existing.length === 0) {
        return notFoundResponse('Work order not found');
      }

      const oldWO = existing[0];

      // Only draft/planned work orders can be deleted
      if (!EDITABLE_STATUSES.includes(oldWO.status as string)) {
        return errorResponse(
          `Cannot delete work order with status '${oldWO.status}'. Only draft or planned work orders can be deleted.`
        );
      }

      // Safety check: reject deletion if any materials have been issued
      const issuedCount = await executeDbOperation(async (db) => {
        const result = await db
          .select({ count: sql`count(*)` })
          .from(workOrderMaterialsTable)
          .where(
            and(
              eq(workOrderMaterialsTable.workOrderId, workOrderId),
              eq(workOrderMaterialsTable.status, 'issued')
            )
          );
        return Number(result[0]?.count || 0);
      });

      if (issuedCount > 0) {
        return errorResponse(
          `Cannot delete work order: ${issuedCount} material(s) have already been issued. Cancel the work order instead.`,
          409
        );
      }

      // Delete work order materials first (FK constraint)
      await executeDbOperation(async (db) => {
        return db
          .delete(workOrderMaterialsTable)
          .where(eq(workOrderMaterialsTable.workOrderId, workOrderId));
      });

      // Delete the work order
      await executeDbOperation(async (db) => {
        return db
          .delete(workOrdersTable)
          .where(eq(workOrdersTable.id, workOrderId));
      });

      // Audit log
      await createAuditLog({
        userId: session.userId,
        action: 'DELETE',
        tableName: 'work_orders',
        recordId: workOrderId,
        oldValue: {
          woNumber: oldWO.woNumber,
          batchNumber: oldWO.batchNumber,
          status: oldWO.status,
          plannedQuantity: oldWO.plannedQuantity,
        },
        ipAddress: getClientIP(request),
      });

      return successResponse(
        { id: workOrderId },
        'Work order deleted successfully'
      );
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['production:write']);
}
