import { NextRequest } from 'next/server';
import { eq, like, sql, and } from 'drizzle-orm';
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

// Generate SO number
function generateSONumber(): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `SO${year}${month}${day}${random}`;
}

// GET /api/sales/orders - List sales orders
export async function GET(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const { searchParams } = new URL(request.url);
      const pagination = getPaginationParams(searchParams);
      const search = searchParams.get('search') || '';
      const status = searchParams.get('status') || '';
      
      const db = await getDb();
      const useSqlite = process.env.DB_TYPE === 'sqlite';
      const soTable = useSqlite ? schema.sqliteSalesOrders : schema.mysqlSalesOrders;
      
      const conditions = [];
      if (search) {
        conditions.push(
          like(soTable.soNumber, `%${search}%`)
        );
      }
      if (status) {
        conditions.push(eq(soTable.status, status));
      }
      
      let countQuery = (db as any).select({ count: sql`count(*)` }).from(soTable);
      if (conditions.length > 0) {
        countQuery = countQuery.where(and(...conditions));
      }
      const countResult = await countQuery;
      const total = Number(countResult[0]?.count || 0);
      
      let query = (db as any).select().from(soTable);
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
      
      const offset = (pagination.page - 1) * pagination.limit;
      const orders = await query.limit(pagination.limit).offset(offset);
      
      return successResponse(createPaginatedResponse(orders, total, pagination));
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['sales:read']);
}

// POST /api/sales/orders - Create sales order
export async function POST(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const body = await request.json();
      const {
        customerName,
        customerContact,
        customerAddress,
        requiredDate,
        paymentTerms,
        notes,
        lines,
      } = body;
      
      if (!customerName) {
        return errorResponse('Customer name is required');
      }
      
      if (!lines || !Array.isArray(lines) || lines.length === 0) {
        return errorResponse('At least one line item is required');
      }
      
      const db = await getDb();
      const useSqlite = process.env.DB_TYPE === 'sqlite';
      const soTable = useSqlite ? schema.sqliteSalesOrders : schema.mysqlSalesOrders;
      const soLinesTable = useSqlite ? schema.sqliteSalesOrderLines : schema.mysqlSalesOrderLines;
      
      const soNumber = generateSONumber();
      
      // Calculate total
      const totalAmount = lines.reduce((sum: number, line: any) => {
        return sum + (line.quantity * line.unitPrice);
      }, 0);
      
      // Create SO
      const result = await (db as any).insert(soTable).values({
        soNumber,
        customerName,
        customerContact,
        customerAddress,
        status: 'draft',
        orderDate: useSqlite ? new Date().toISOString() : new Date(),
        requiredDate,
        totalAmount,
        currency: 'THB',
        paymentTerms,
        notes,
        createdBy: session.userId,
      });
      
      const soId = useSqlite ? result.lastInsertRowid : result[0].insertId;
      
      // Create SO lines
      for (const line of lines) {
        await (db as any).insert(soLinesTable).values({
          soId: Number(soId),
          itemId: line.itemId,
          lotId: line.lotId,
          quantity: line.quantity,
          shippedQuantity: 0,
          unit: line.unit,
          unitPrice: line.unitPrice,
          totalPrice: line.quantity * line.unitPrice,
          notes: line.notes,
        });
      }
      
      await createAuditLog({
        userId: session.userId,
        action: 'CREATE',
        tableName: 'sales_orders',
        recordId: Number(soId),
        newValue: { soNumber, customerName, totalAmount, linesCount: lines.length },
        ipAddress: getClientIP(request),
      });
      
      return successResponse({ id: Number(soId), soNumber }, 'Sales order created successfully');
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['sales:write']);
}
