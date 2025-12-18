import { NextRequest } from 'next/server';
import { eq, like, or, sql, and, desc } from 'drizzle-orm';
import { getDb, useSqlite } from '@/lib/db';
import {
  sqliteBatchRecords,
  sqliteWorkOrders,
  sqliteOperations,
  sqliteItems,
  sqliteUsers,
  mysqlBatchRecords,
  mysqlWorkOrders,
  mysqlOperations,
  mysqlItems,
  mysqlUsers,
} from '@/lib/db/schema';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
  getPaginationParams,
  createPaginatedResponse,
} from '@/lib/api-utils';
import { createAuditLog, getClientIP } from '@/lib/audit';

// GET /api/production/batch-records - List batch records
export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const pagination = getPaginationParams(searchParams);
      const search = searchParams.get('search') || '';
      const status = searchParams.get('status') || '';
      const workOrderId = searchParams.get('workOrderId');

      const db = await getDb();
      const isSqlite = useSqlite();
      const batchRecords = isSqlite ? sqliteBatchRecords : mysqlBatchRecords;
      const workOrders = isSqlite ? sqliteWorkOrders : mysqlWorkOrders;
      const operations = isSqlite ? sqliteOperations : mysqlOperations;
      const items = isSqlite ? sqliteItems : mysqlItems;
      const users = isSqlite ? sqliteUsers : mysqlUsers;

      const conditions = [];
      if (search) {
        conditions.push(
          or(
            like(batchRecords.stepName, `%${search}%`),
            like(workOrders.woNumber, `%${search}%`),
            like(workOrders.batchNumber, `%${search}%`)
          )
        );
      }
      if (status) {
        conditions.push(eq(batchRecords.status, status));
      }
      if (workOrderId) {
        conditions.push(eq(batchRecords.workOrderId, parseInt(workOrderId)));
      }

      // Count query
      let countQuery = (db as any)
        .select({ count: sql`count(*)` })
        .from(batchRecords)
        .leftJoin(workOrders, eq(batchRecords.workOrderId, workOrders.id));

      if (conditions.length > 0) {
        countQuery = countQuery.where(and(...conditions));
      }
      const countResult = await countQuery;
      const total = Number(countResult[0]?.count || 0);

      // Data query with joins
      let query = (db as any)
        .select({
          id: batchRecords.id,
          workOrderId: batchRecords.workOrderId,
          woNumber: workOrders.woNumber,
          batchNumber: workOrders.batchNumber,
          productId: workOrders.productId,
          productCode: items.code,
          productName: items.nameTh,
          operationId: batchRecords.operationId,
          operationName: operations.name,
          sequence: batchRecords.sequence,
          stepName: batchRecords.stepName,
          instructions: batchRecords.instructions,
          status: batchRecords.status,
          startTime: batchRecords.startTime,
          endTime: batchRecords.endTime,
          performedBy: batchRecords.performedBy,
          verifiedBy: batchRecords.verifiedBy,
          verifiedAt: batchRecords.verifiedAt,
          createdAt: batchRecords.createdAt,
        })
        .from(batchRecords)
        .leftJoin(workOrders, eq(batchRecords.workOrderId, workOrders.id))
        .leftJoin(items, eq(workOrders.productId, items.id))
        .leftJoin(operations, eq(batchRecords.operationId, operations.id));

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      const offset = (pagination.page - 1) * pagination.limit;
      const records = await query
        .orderBy(desc(batchRecords.createdAt))
        .limit(pagination.limit)
        .offset(offset);

      // Get performer and verifier names
      const recordsWithUsers = await Promise.all(
        records.map(async (record: any) => {
          let performerName = null;
          let verifierName = null;

          if (record.performedBy) {
            const [performer] = await (db as any)
              .select({ name: users.name })
              .from(users)
              .where(eq(users.id, record.performedBy));
            performerName = performer?.name;
          }

          if (record.verifiedBy) {
            const [verifier] = await (db as any)
              .select({ name: users.name })
              .from(users)
              .where(eq(users.id, record.verifiedBy));
            verifierName = verifier?.name;
          }

          return {
            ...record,
            performerName,
            verifierName,
          };
        })
      );

      return successResponse(createPaginatedResponse(recordsWithUsers, total, pagination));
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['production:read']);
}

// POST /api/production/batch-records - Create batch record
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

      const db = await getDb();
      const isSqlite = useSqlite();
      const batchRecords = isSqlite ? sqliteBatchRecords : mysqlBatchRecords;
      const workOrders = isSqlite ? sqliteWorkOrders : mysqlWorkOrders;

      // Verify work order exists
      const [wo] = await (db as any)
        .select()
        .from(workOrders)
        .where(eq(workOrders.id, workOrderId));

      if (!wo) {
        return errorResponse('Work order not found', 404);
      }

      // Get max sequence if not provided
      let recordSequence = sequence;
      if (!recordSequence) {
        const [maxSeq] = await (db as any)
          .select({ maxSeq: sql`MAX(${batchRecords.sequence})` })
          .from(batchRecords)
          .where(eq(batchRecords.workOrderId, workOrderId));
        recordSequence = (maxSeq?.maxSeq || 0) + 1;
      }

      // Create batch record
      const result = await (db as any).insert(batchRecords).values({
        workOrderId,
        operationId,
        sequence: recordSequence,
        stepName,
        instructions: instructions || null,
        parameters: parameters ? JSON.stringify(parameters) : null,
        status: 'pending',
      });

      const recordId = isSqlite ? result.lastInsertRowid : result[0].insertId;

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
