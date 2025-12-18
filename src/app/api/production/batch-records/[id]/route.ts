import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb, useSqlite } from '@/lib/db';
import {
  sqliteBatchRecords,
  sqliteWorkOrders,
  sqliteOperations,
  sqliteItems,
  sqliteUsers,
  sqliteWorkOrderMaterials,
  sqliteQualityTests,
  mysqlBatchRecords,
  mysqlWorkOrders,
  mysqlOperations,
  mysqlItems,
  mysqlUsers,
  mysqlWorkOrderMaterials,
  mysqlQualityTests,
} from '@/lib/db/schema';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { createAuditLog, getClientIP } from '@/lib/audit';

// GET /api/production/batch-records/[id] - Get batch record details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const recordId = parseInt(id);

      const db = await getDb();
      const isSqlite = useSqlite();
      const batchRecords = isSqlite ? sqliteBatchRecords : mysqlBatchRecords;
      const workOrders = isSqlite ? sqliteWorkOrders : mysqlWorkOrders;
      const operations = isSqlite ? sqliteOperations : mysqlOperations;
      const items = isSqlite ? sqliteItems : mysqlItems;
      const users = isSqlite ? sqliteUsers : mysqlUsers;
      const workOrderMaterials = isSqlite ? sqliteWorkOrderMaterials : mysqlWorkOrderMaterials;
      const qualityTests = isSqlite ? sqliteQualityTests : mysqlQualityTests;

      // Get batch record with joins
      const [record] = await (db as any)
        .select({
          id: batchRecords.id,
          workOrderId: batchRecords.workOrderId,
          woNumber: workOrders.woNumber,
          batchNumber: workOrders.batchNumber,
          woStatus: workOrders.status,
          productId: workOrders.productId,
          productCode: items.code,
          productName: items.nameTh,
          productUnit: items.primaryUnit,
          plannedQuantity: workOrders.plannedQuantity,
          actualQuantity: workOrders.actualQuantity,
          operationId: batchRecords.operationId,
          operationName: operations.name,
          operationDescription: operations.description,
          standardTime: operations.standardTime,
          sequence: batchRecords.sequence,
          stepName: batchRecords.stepName,
          instructions: batchRecords.instructions,
          parameters: batchRecords.parameters,
          actualValues: batchRecords.actualValues,
          status: batchRecords.status,
          startTime: batchRecords.startTime,
          endTime: batchRecords.endTime,
          performedBy: batchRecords.performedBy,
          verifiedBy: batchRecords.verifiedBy,
          verifiedAt: batchRecords.verifiedAt,
          notes: batchRecords.notes,
          attachments: batchRecords.attachments,
          createdAt: batchRecords.createdAt,
          updatedAt: batchRecords.updatedAt,
        })
        .from(batchRecords)
        .leftJoin(workOrders, eq(batchRecords.workOrderId, workOrders.id))
        .leftJoin(items, eq(workOrders.productId, items.id))
        .leftJoin(operations, eq(batchRecords.operationId, operations.id))
        .where(eq(batchRecords.id, recordId));

      if (!record) {
        return errorResponse('Batch record not found', 404);
      }

      // Get performer name
      let performerName = null;
      if (record.performedBy) {
        const [performer] = await (db as any)
          .select({ name: users.name })
          .from(users)
          .where(eq(users.id, record.performedBy));
        performerName = performer?.name;
      }

      // Get verifier name
      let verifierName = null;
      if (record.verifiedBy) {
        const [verifier] = await (db as any)
          .select({ name: users.name })
          .from(users)
          .where(eq(users.id, record.verifiedBy));
        verifierName = verifier?.name;
      }

      // Get all batch records for this work order
      const allRecords = await (db as any)
        .select({
          id: batchRecords.id,
          sequence: batchRecords.sequence,
          stepName: batchRecords.stepName,
          status: batchRecords.status,
          startTime: batchRecords.startTime,
          endTime: batchRecords.endTime,
        })
        .from(batchRecords)
        .where(eq(batchRecords.workOrderId, record.workOrderId))
        .orderBy(batchRecords.sequence);

      // Get materials for this work order
      const materials = await (db as any)
        .select({
          id: workOrderMaterials.id,
          itemId: workOrderMaterials.itemId,
          itemCode: items.code,
          itemName: items.nameTh,
          plannedQuantity: workOrderMaterials.plannedQuantity,
          actualQuantity: workOrderMaterials.actualQuantity,
          unit: workOrderMaterials.unit,
          status: workOrderMaterials.status,
        })
        .from(workOrderMaterials)
        .leftJoin(items, eq(workOrderMaterials.itemId, items.id))
        .where(eq(workOrderMaterials.workOrderId, record.workOrderId));

      // Parse JSON fields
      let parameters = null;
      let actualValues = null;
      let attachments = null;

      try {
        if (record.parameters) parameters = JSON.parse(record.parameters);
        if (record.actualValues) actualValues = JSON.parse(record.actualValues);
        if (record.attachments) attachments = JSON.parse(record.attachments);
      } catch (e) {
        // Keep as strings if parsing fails
      }

      return successResponse({
        ...record,
        performerName,
        verifierName,
        parameters,
        actualValues,
        attachments,
        allRecords,
        materials,
      });
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['production:read']);
}

// PUT /api/production/batch-records/[id] - Update batch record
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const recordId = parseInt(id);
      const body = await request.json();
      const {
        status,
        actualValues,
        notes,
        startTime,
        endTime,
        performedBy,
        verifiedBy,
      } = body;

      const db = await getDb();
      const isSqlite = useSqlite();
      const batchRecords = isSqlite ? sqliteBatchRecords : mysqlBatchRecords;

      // Check if record exists
      const [existing] = await (db as any)
        .select()
        .from(batchRecords)
        .where(eq(batchRecords.id, recordId));

      if (!existing) {
        return errorResponse('Batch record not found', 404);
      }

      // Build update object
      const updateData: Record<string, any> = {
        updatedAt: isSqlite ? new Date().toISOString() : new Date(),
      };

      if (status !== undefined) updateData.status = status;
      if (actualValues !== undefined) {
        updateData.actualValues = typeof actualValues === 'object'
          ? JSON.stringify(actualValues)
          : actualValues;
      }
      if (notes !== undefined) updateData.notes = notes;
      if (startTime !== undefined) updateData.startTime = startTime;
      if (endTime !== undefined) updateData.endTime = endTime;
      if (performedBy !== undefined) updateData.performedBy = performedBy;
      if (verifiedBy !== undefined) {
        updateData.verifiedBy = verifiedBy;
        updateData.verifiedAt = isSqlite ? new Date().toISOString() : new Date();
      }

      // Auto-set times based on status
      if (status === 'in_progress' && !existing.startTime && !startTime) {
        updateData.startTime = isSqlite ? new Date().toISOString() : new Date();
      }
      if (status === 'completed' && !existing.endTime && !endTime) {
        updateData.endTime = isSqlite ? new Date().toISOString() : new Date();
      }
      if (status === 'in_progress' && !existing.performedBy && !performedBy) {
        updateData.performedBy = session.userId;
      }

      // Update record
      await (db as any)
        .update(batchRecords)
        .set(updateData)
        .where(eq(batchRecords.id, recordId));

      // Audit log
      await createAuditLog({
        userId: session.userId,
        action: 'UPDATE',
        tableName: 'batch_records',
        recordId,
        oldValue: existing,
        newValue: updateData,
        ipAddress: getClientIP(request),
      });

      return successResponse({ id: recordId }, 'Batch record updated successfully');
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['production:write']);
}
