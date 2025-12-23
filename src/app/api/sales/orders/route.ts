import { NextRequest } from 'next/server';
import { eq, like, and, type SQL } from 'drizzle-orm';
import { getTableRef, executeDbOperation, dbDate, getInsertId } from '@/lib/db/db-helper';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
  getPaginationParams,
  createPaginatedResponse,
} from '@/lib/api-utils';
import { createAuditLog, getClientIP } from '@/lib/audit';
import { sql } from 'drizzle-orm';

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
  return withAuth(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const pagination = getPaginationParams(searchParams);
      const search = searchParams.get('search') || '';
      const status = searchParams.get('status') || '';

      const soTable = getTableRef('salesOrders');

      const conditions: (SQL | undefined)[] = [];
      if (search) {
        conditions.push(like(soTable.soNumber, `%${search}%`));
      }
      if (status) {
        conditions.push(eq(soTable.status, status));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Get total count
      const total = await executeDbOperation(async (db) => {
        let countQuery = db.select({ count: sql`count(*)` }).from(soTable);
        if (whereClause) {
          countQuery = countQuery.where(whereClause);
        }
        const countResult = await countQuery;
        return Number(countResult[0]?.count || 0);
      });

      // Get paginated results
      const offset = (pagination.page - 1) * pagination.limit;
      const orders = await executeDbOperation(async (db) => {
        let query = db.select().from(soTable);
        if (whereClause) {
          query = query.where(whereClause);
        }
        return query.limit(pagination.limit).offset(offset);
      });

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

      const soTable = getTableRef('salesOrders');
      const soLinesTable = getTableRef('salesOrderLines');

      const soNumber = generateSONumber();

      // Calculate total
      const totalAmount = lines.reduce((sum: number, line: { quantity: number; unitPrice: number }) => {
        return sum + (line.quantity * line.unitPrice);
      }, 0);

      // Parse dates
      const parsedRequiredDate = requiredDate ? dbDate(new Date(requiredDate)) : null;

      // Create SO
      const result = await executeDbOperation(async (db) => {
        return db.insert(soTable).values({
          soNumber,
          customerName,
          customerContact,
          customerAddress,
          status: 'draft',
          orderDate: dbDate(),
          requiredDate: parsedRequiredDate,
          totalAmount,
          currency: 'THB',
          paymentTerms,
          notes,
          createdBy: session.userId,
          createdAt: dbDate(),
          updatedAt: dbDate(),
        });
      });

      const soId = getInsertId(result);

      // Create SO lines
      for (const line of lines) {
        await executeDbOperation(async (db) => {
          return db.insert(soLinesTable).values({
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
