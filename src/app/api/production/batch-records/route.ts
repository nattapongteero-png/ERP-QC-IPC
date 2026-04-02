import { NextRequest } from 'next/server';
import { eq, like, or, and, desc, count, inArray, type SQL } from 'drizzle-orm';
import { getTableRef, executeDbOperation, getInsertId } from '@/lib/db/db-helper';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
  getPaginationParams,
  createPaginatedResponse,
} from '@/lib/api-utils';
import { createAuditLog, getClientIP } from '@/lib/audit';

// GET /api/production/batch-records - List WOs with execution data (eBMR registry)
export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const pagination = getPaginationParams(searchParams);
      const search = searchParams.get('search') || '';
      const status = searchParams.get('status') || '';

      const workOrders = getTableRef('workOrders');
      const items = getTableRef('items');
      const woSOPExecution = getTableRef('wOSOPExecution');
      const woCleaningLogs = getTableRef('wOCleaningLogs');
      const woEnvironmentalLogs = getTableRef('wOEnvironmentalLogs');
      const woFinishedInspection = getTableRef('wOFinishedInspection');

      // Step 1: Collect all WO IDs that have execution data
      const [sopWoIds, cleanWoIds, envWoIds, fiWoIds] = await Promise.all([
        executeDbOperation(async (db) =>
          db.selectDistinct({ workOrderId: woSOPExecution.workOrderId }).from(woSOPExecution)
        ),
        executeDbOperation(async (db) =>
          db.selectDistinct({ workOrderId: woCleaningLogs.workOrderId }).from(woCleaningLogs)
        ),
        executeDbOperation(async (db) =>
          db.selectDistinct({ workOrderId: woEnvironmentalLogs.workOrderId }).from(woEnvironmentalLogs)
        ),
        executeDbOperation(async (db) =>
          db.selectDistinct({ workOrderId: woFinishedInspection.workOrderId }).from(woFinishedInspection)
        ),
      ]);

      const woIdSet = new Set<number>();
      for (const row of [...sopWoIds, ...cleanWoIds, ...envWoIds, ...fiWoIds]) {
        woIdSet.add(row.workOrderId);
      }
      const allWoIds = Array.from(woIdSet);

      if (allWoIds.length === 0) {
        return successResponse(createPaginatedResponse([], 0, pagination));
      }

      // Map WO status → eBMR status
      const mapStatus = (woStatus: string): string => {
        if (woStatus === 'completed' || woStatus === 'closed') return 'completed';
        if (woStatus === 'in_progress') return 'in_progress';
        return 'pending';
      };

      // Step 2: Get WO details with conditions
      const conditions: (SQL | undefined)[] = [inArray(workOrders.id, allWoIds)];

      if (search) {
        conditions.push(
          or(
            like(workOrders.woNumber, `%${search}%`),
            like(workOrders.batchNumber, `%${search}%`),
            like(items.nameTh, `%${search}%`),
            like(items.code, `%${search}%`)
          )
        );
      }

      // For status filter, map to WO statuses
      if (status) {
        if (status === 'completed') {
          conditions.push(or(eq(workOrders.status, 'completed'), eq(workOrders.status, 'closed')));
        } else if (status === 'in_progress') {
          conditions.push(eq(workOrders.status, 'in_progress'));
        } else if (status === 'pending') {
          conditions.push(or(eq(workOrders.status, 'planned'), eq(workOrders.status, 'released')));
        }
      }

      // Count
      const total = await executeDbOperation(async (db) => {
        const countResult = await db
          .select({ count: count() })
          .from(workOrders)
          .leftJoin(items, eq(workOrders.productId, items.id))
          .where(and(...conditions));
        return Number(countResult[0]?.count || 0);
      });

      // Paginated data
      const offset = (pagination.page - 1) * pagination.limit;
      const woRecords = await executeDbOperation(async (db) =>
        db
          .select({
            id: workOrders.id,
            woNumber: workOrders.woNumber,
            batchNumber: workOrders.batchNumber,
            productId: workOrders.productId,
            productCode: items.code,
            productName: items.nameTh,
            status: workOrders.status,
            plannedQuantity: workOrders.plannedQuantity,
            actualQuantity: workOrders.actualQuantity,
            unit: workOrders.unit,
            plannedStartDate: workOrders.plannedStartDate,
            plannedEndDate: workOrders.plannedEndDate,
            actualStartDate: workOrders.actualStartDate,
            actualEndDate: workOrders.actualEndDate,
            createdAt: workOrders.createdAt,
            updatedAt: workOrders.updatedAt,
          })
          .from(workOrders)
          .leftJoin(items, eq(workOrders.productId, items.id))
          .where(and(...conditions))
          .orderBy(desc(workOrders.id))
          .limit(pagination.limit)
          .offset(offset)
      );

      if (woRecords.length === 0) {
        return successResponse(createPaginatedResponse([], total, pagination));
      }

      // Step 3: Get execution counts for these WOs
      const recordIds = woRecords.map((r: Record<string, unknown>) => r.id as number);

      const [sopCounts, cleanCounts, envCounts, fiCounts] = await Promise.all([
        executeDbOperation(async (db) =>
          db.select({ workOrderId: woSOPExecution.workOrderId, total: count(), verified: count(woSOPExecution.verifiedAt) })
            .from(woSOPExecution)
            .where(inArray(woSOPExecution.workOrderId, recordIds))
            .groupBy(woSOPExecution.workOrderId)
        ),
        executeDbOperation(async (db) =>
          db.select({ workOrderId: woCleaningLogs.workOrderId, total: count() })
            .from(woCleaningLogs)
            .where(inArray(woCleaningLogs.workOrderId, recordIds))
            .groupBy(woCleaningLogs.workOrderId)
        ),
        executeDbOperation(async (db) =>
          db.select({ workOrderId: woEnvironmentalLogs.workOrderId, total: count() })
            .from(woEnvironmentalLogs)
            .where(inArray(woEnvironmentalLogs.workOrderId, recordIds))
            .groupBy(woEnvironmentalLogs.workOrderId)
        ),
        executeDbOperation(async (db) =>
          db.select({ workOrderId: woFinishedInspection.workOrderId, total: count() })
            .from(woFinishedInspection)
            .where(inArray(woFinishedInspection.workOrderId, recordIds))
            .groupBy(woFinishedInspection.workOrderId)
        ),
      ]);

      // Build count maps
      const sopMap = new Map<number, { total: number; verified: number }>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const r of sopCounts as any[]) {
        sopMap.set(r.workOrderId, { total: Number(r.total), verified: Number(r.verified) });
      }
      const cleanMap = new Map<number, number>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const r of cleanCounts as any[]) cleanMap.set(r.workOrderId, Number(r.total));
      const envMap = new Map<number, number>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const r of envCounts as any[]) envMap.set(r.workOrderId, Number(r.total));
      const fiMap = new Map<number, number>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const r of fiCounts as any[]) fiMap.set(r.workOrderId, Number(r.total));

      // Build final records
      const recordsWithExecution = woRecords.map((wo: Record<string, unknown>) => {
        const woId = wo.id as number;
        const sop = sopMap.get(woId) ?? { total: 0, verified: 0 };
        const clean = cleanMap.get(woId) ?? 0;
        const env = envMap.get(woId) ?? 0;
        const fi = fiMap.get(woId) ?? 0;
        const totalSteps = sop.total + clean + env + fi;

        return {
          id: woId,
          workOrderId: woId,
          woNumber: wo.woNumber,
          batchNumber: wo.batchNumber,
          productCode: wo.productCode,
          productName: wo.productName,
          status: mapStatus(wo.status as string),
          woStatus: wo.status,
          plannedQuantity: wo.plannedQuantity,
          actualQuantity: wo.actualQuantity,
          unit: wo.unit,
          // Execution summary
          sopSteps: sop.total,
          sopVerified: sop.verified,
          cleaningLogs: clean,
          environmentalLogs: env,
          finishedInspection: fi,
          totalExecutionRecords: totalSteps,
          // Dates
          startTime: wo.actualStartDate || wo.plannedStartDate,
          endTime: wo.actualEndDate || wo.plannedEndDate,
          createdAt: wo.createdAt,
          // For UI compatibility
          sequence: 1,
          stepName: `eBMR`,
          operationName: `${totalSteps} records`,
          performerName: null,
        };
      });

      return successResponse(createPaginatedResponse(recordsWithExecution, total, pagination));
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['production:read']);
}

// POST /api/production/batch-records - Create batch record (kept for compatibility)
export async function POST(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const body = await request.json();
      const {
        workOrderId,
        operationId,
        sequence,
        stepName,
        instructions,
        parameters,
      } = body;

      if (!workOrderId || !operationId || !stepName) {
        return errorResponse('Work order ID, operation ID, and step name are required');
      }

      const batchRecords = getTableRef('batchRecords');
      const workOrders = getTableRef('workOrders');

      // Verify work order exists
      const woResult = await executeDbOperation(async (db) => {
        return db
          .select()
          .from(workOrders)
          .where(eq(workOrders.id, workOrderId));
      });

      if (woResult.length === 0) {
        return errorResponse('Work order not found', 404);
      }

      // Get max sequence if not provided
      let recordSequence = sequence;
      if (!recordSequence) {
        const { sql } = await import('drizzle-orm');
        const maxSeqResult = await executeDbOperation(async (db) => {
          return db
            .select({ maxSeq: sql`MAX(${batchRecords.sequence})` })
            .from(batchRecords)
            .where(eq(batchRecords.workOrderId, workOrderId));
        });
        recordSequence = (maxSeqResult[0]?.maxSeq || 0) + 1;
      }

      // Create batch record
      const result = await executeDbOperation(async (db) => {
        return db.insert(batchRecords).values({
          workOrderId,
          operationId,
          sequence: recordSequence,
          stepName,
          instructions: instructions || null,
          parameters: parameters ? JSON.stringify(parameters) : null,
          status: 'pending',
        });
      });

      const recordId = getInsertId(result);

      // Audit log
      await createAuditLog({
        userId: session.userId,
        action: 'CREATE',
        tableName: 'batch_records',
        recordId: Number(recordId),
        newValue: { workOrderId, operationId, stepName },
        ipAddress: getClientIP(request),
      });

      return successResponse({ id: Number(recordId) }, 'Batch record created successfully');
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['production:write']);
}
