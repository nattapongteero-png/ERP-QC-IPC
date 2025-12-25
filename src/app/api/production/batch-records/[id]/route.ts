import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getTableRef, executeDbOperation, dbDate } from '@/lib/db/db-helper';
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

      const batchRecords = getTableRef('batchRecords');
      const workOrders = getTableRef('workOrders');
      const operations = getTableRef('operations');
      const items = getTableRef('items');
      const users = getTableRef('users');
      const workOrderMaterials = getTableRef('workOrderMaterials');

      // Get batch record with joins
      const recordResult = await executeDbOperation(async (db) => {
        return db
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
      });

      if (recordResult.length === 0) {
        return errorResponse('Batch record not found', 404);
      }

      const record = recordResult[0];

      // Get performer name
      let performerName = null;
      if (record.performedBy) {
        const performer = await executeDbOperation(async (db) => {
          return db
            .select({ name: users.name })
            .from(users)
            .where(eq(users.id, record.performedBy as number));
        });
        performerName = performer[0]?.name;
      }

      // Get verifier name
      let verifierName = null;
      if (record.verifiedBy) {
        const verifier = await executeDbOperation(async (db) => {
          return db
            .select({ name: users.name })
            .from(users)
            .where(eq(users.id, record.verifiedBy as number));
        });
        verifierName = verifier[0]?.name;
      }

      // Get all batch records for this work order
      const allRecords = await executeDbOperation(async (db) => {
        return db
          .select({
            id: batchRecords.id,
            sequence: batchRecords.sequence,
            stepName: batchRecords.stepName,
            status: batchRecords.status,
            startTime: batchRecords.startTime,
            endTime: batchRecords.endTime,
          })
          .from(batchRecords)
          .where(eq(batchRecords.workOrderId, record.workOrderId as number))
          .orderBy(batchRecords.sequence);
      });

      // Get materials for this work order
      const materials = await executeDbOperation(async (db) => {
        return db
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
          .where(eq(workOrderMaterials.workOrderId, record.workOrderId as number));
      });

      // Parse JSON fields
      let parameters = null;
      let actualValues = null;
      let attachments = null;

      try {
        if (record.parameters) parameters = JSON.parse(record.parameters as string);
        if (record.actualValues) actualValues = JSON.parse(record.actualValues as string);
        if (record.attachments) attachments = JSON.parse(record.attachments as string);
      } catch {
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

      const batchRecords = getTableRef('batchRecords');

      // Check if record exists
      const existing = await executeDbOperation(async (db) => {
        return db
          .select()
          .from(batchRecords)
          .where(eq(batchRecords.id, recordId));
      });

      if (existing.length === 0) {
        return errorResponse('Batch record not found', 404);
      }

      const oldRecord = existing[0];

      // Build update object
      const updateData: Record<string, unknown> = {
        updatedAt: dbDate(),
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
        updateData.verifiedAt = dbDate();
      }

      // Auto-set times based on status
      if (status === 'in_progress' && !oldRecord.startTime && !startTime) {
        updateData.startTime = dbDate();
      }
      if (status === 'completed' && !oldRecord.endTime && !endTime) {
        updateData.endTime = dbDate();
      }
      if (status === 'in_progress' && !oldRecord.performedBy && !performedBy) {
        updateData.performedBy = session.userId;
      }

      // Update record
      await executeDbOperation(async (db) => {
        return db
          .update(batchRecords)
          .set(updateData)
          .where(eq(batchRecords.id, recordId));
      });

      // Audit log
      await createAuditLog({
        userId: session.userId,
        action: 'UPDATE',
        tableName: 'batch_records',
        recordId,
        oldValue: oldRecord,
        newValue: updateData,
        ipAddress: getClientIP(request),
      });

      return successResponse({ id: recordId }, 'Batch record updated successfully');
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['production:write']);
}
