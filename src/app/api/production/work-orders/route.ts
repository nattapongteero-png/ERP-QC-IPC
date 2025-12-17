import { NextRequest } from 'next/server';
import { eq, like, or, sql, and } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
  getPaginationParams,
  createPaginatedResponse,
} from '@/lib/api-utils';
import { createAuditLog, getClientIP } from '@/lib/audit';

// Generate work order number
function generateWONumber(): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `WO${year}${month}${day}${random}`;
}

// GET /api/production/work-orders - List work orders
export async function GET(request: NextRequest) {
  return withAuth(async (session) => {
    try {
      const { searchParams } = new URL(request.url);
      const pagination = getPaginationParams(searchParams);
      const search = searchParams.get('search') || '';
      const status = searchParams.get('status') || '';
      
      const db = await getDb();
      const useSqlite = process.env.DB_TYPE === 'sqlite';
      const workOrdersTable = useSqlite ? schema.sqliteWorkOrders : schema.mysqlWorkOrders;
      const itemsTable = useSqlite ? schema.sqliteItems : schema.mysqlItems;
      
      const conditions = [];
      if (search) {
        conditions.push(
          or(
            like(workOrdersTable.woNumber, `%${search}%`),
            like(workOrdersTable.batchNumber, `%${search}%`)
          )
        );
      }
      if (status) {
        conditions.push(eq(workOrdersTable.status, status));
      }
      
      let countQuery = (db as any).select({ count: sql`count(*)` }).from(workOrdersTable);
      if (conditions.length > 0) {
        countQuery = countQuery.where(and(...conditions));
      }
      const countResult = await countQuery;
      const total = Number(countResult[0]?.count || 0);
      
      let query = (db as any)
        .select({
          id: workOrdersTable.id,
          woNumber: workOrdersTable.woNumber,
          batchNumber: workOrdersTable.batchNumber,
          plannedQuantity: workOrdersTable.plannedQuantity,
          actualQuantity: workOrdersTable.actualQuantity,
          unit: workOrdersTable.unit,
          status: workOrdersTable.status,
          priority: workOrdersTable.priority,
          plannedStartDate: workOrdersTable.plannedStartDate,
          plannedEndDate: workOrdersTable.plannedEndDate,
          actualStartDate: workOrdersTable.actualStartDate,
          actualEndDate: workOrdersTable.actualEndDate,
          yieldPercentage: workOrdersTable.yieldPercentage,
          productId: workOrdersTable.productId,
          productCode: itemsTable.code,
          productName: itemsTable.nameTh,
          createdAt: workOrdersTable.createdAt,
        })
        .from(workOrdersTable)
        .leftJoin(itemsTable, eq(workOrdersTable.productId, itemsTable.id));
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
      
      const offset = (pagination.page - 1) * pagination.limit;
      const workOrders = await query.limit(pagination.limit).offset(offset);
      
      return successResponse(createPaginatedResponse(workOrders, total, pagination));
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['production:read']);
}

// POST /api/production/work-orders - Create work order
export async function POST(request: NextRequest) {
  return withAuth(async (session) => {
    try {
      const body = await request.json();
      const {
        bomId,
        productId,
        batchNumber,
        plannedQuantity,
        unit,
        priority,
        plannedStartDate,
        plannedEndDate,
        notes,
      } = body;
      
      if (!bomId || !productId || !batchNumber || !plannedQuantity || !unit) {
        return errorResponse('BOM ID, product ID, batch number, planned quantity, and unit are required');
      }
      
      const db = await getDb();
      const useSqlite = process.env.DB_TYPE === 'sqlite';
      const workOrdersTable = useSqlite ? schema.sqliteWorkOrders : schema.mysqlWorkOrders;
      
      const woNumber = generateWONumber();
      
      const result = await (db as any).insert(workOrdersTable).values({
        woNumber,
        bomId,
        productId,
        batchNumber,
        plannedQuantity,
        unit,
        status: 'planned',
        priority: priority || 5,
        plannedStartDate,
        plannedEndDate,
        notes,
        createdBy: session.userId,
      });
      
      const workOrderId = useSqlite ? result.lastInsertRowid : result[0].insertId;
      
      await createAuditLog({
        userId: session.userId,
        action: 'CREATE',
        tableName: 'work_orders',
        recordId: Number(workOrderId),
        newValue: { woNumber, batchNumber, plannedQuantity, status: 'planned' },
        ipAddress: getClientIP(request),
      });
      
      return successResponse({ id: Number(workOrderId), woNumber }, 'Work order created successfully');
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['production:write']);
}
