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

// Generate PO number
function generatePONumber(): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `PO${year}${month}${day}${random}`;
}

// GET /api/purchasing/orders - List purchase orders
export async function GET(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const { searchParams } = new URL(request.url);
      const pagination = getPaginationParams(searchParams);
      const search = searchParams.get('search') || '';
      const status = searchParams.get('status') || '';
      const vendorId = searchParams.get('vendorId') || '';
      
      const db = await getDb();
      const useSqlite = process.env.DB_TYPE === 'sqlite';
      const poTable = useSqlite ? schema.sqlitePurchaseOrders : schema.mysqlPurchaseOrders;
      const vendorsTable = useSqlite ? schema.sqliteVendors : schema.mysqlVendors;
      
      const conditions = [];
      if (search) {
        conditions.push(like(poTable.poNumber, `%${search}%`));
      }
      if (status) {
        conditions.push(eq(poTable.status, status));
      }
      if (vendorId) {
        conditions.push(eq(poTable.vendorId, parseInt(vendorId)));
      }
      
      let countQuery = (db as any).select({ count: sql`count(*)` }).from(poTable);
      if (conditions.length > 0) {
        countQuery = countQuery.where(and(...conditions));
      }
      const countResult = await countQuery;
      const total = Number(countResult[0]?.count || 0);
      
      let query = (db as any)
        .select({
          id: poTable.id,
          poNumber: poTable.poNumber,
          status: poTable.status,
          orderDate: poTable.orderDate,
          expectedDate: poTable.expectedDate,
          totalAmount: poTable.totalAmount,
          currency: poTable.currency,
          vendorId: poTable.vendorId,
          vendorName: vendorsTable.name,
          createdAt: poTable.createdAt,
        })
        .from(poTable)
        .leftJoin(vendorsTable, eq(poTable.vendorId, vendorsTable.id));
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
      
      const offset = (pagination.page - 1) * pagination.limit;
      const orders = await query.limit(pagination.limit).offset(offset);
      
      return successResponse(createPaginatedResponse(orders, total, pagination));
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['purchasing:read']);
}

// POST /api/purchasing/orders - Create purchase order
export async function POST(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const body = await request.json();
      const {
        vendorId,
        expectedDate,
        paymentTerms,
        shippingAddress,
        notes,
        lines,
      } = body;
      
      if (!vendorId) {
        return errorResponse('Vendor ID is required');
      }
      
      if (!lines || !Array.isArray(lines) || lines.length === 0) {
        return errorResponse('At least one line item is required');
      }
      
      const db = await getDb();
      const useSqlite = process.env.DB_TYPE === 'sqlite';
      const poTable = useSqlite ? schema.sqlitePurchaseOrders : schema.mysqlPurchaseOrders;
      const poLinesTable = useSqlite ? schema.sqlitePurchaseOrderLines : schema.mysqlPurchaseOrderLines;
      
      const poNumber = generatePONumber();

      // Calculate total
      const totalAmount = lines.reduce((sum: number, line: any) => {
        return sum + (line.quantity * line.unitPrice);
      }, 0);

      // Parse dates for MySQL (needs Date objects) vs SQLite (needs strings)
      const now = new Date();
      const parsedExpectedDate = expectedDate
        ? (useSqlite ? expectedDate : new Date(expectedDate))
        : null;

      // Create PO
      const result = await (db as any).insert(poTable).values({
        poNumber,
        vendorId,
        status: 'draft',
        orderDate: useSqlite ? now.toISOString() : now,
        expectedDate: parsedExpectedDate,
        totalAmount,
        currency: 'THB',
        paymentTerms,
        shippingAddress,
        notes,
        createdBy: session.userId,
        createdAt: useSqlite ? now.toISOString() : now,
        updatedAt: useSqlite ? now.toISOString() : now,
      });
      
      const poId = useSqlite ? result.lastInsertRowid : result[0].insertId;
      
      // Create PO lines
      for (const line of lines) {
        const lineExpectedDate = line.expectedDate
          ? (useSqlite ? line.expectedDate : new Date(line.expectedDate))
          : null;
        await (db as any).insert(poLinesTable).values({
          poId: Number(poId),
          itemId: line.itemId,
          quantity: line.quantity,
          receivedQuantity: 0,
          unit: line.unit,
          unitPrice: line.unitPrice,
          totalPrice: line.quantity * line.unitPrice,
          expectedDate: lineExpectedDate,
          notes: line.notes,
        });
      }
      
      await createAuditLog({
        userId: session.userId,
        action: 'CREATE',
        tableName: 'purchase_orders',
        recordId: Number(poId),
        newValue: { poNumber, vendorId, totalAmount, linesCount: lines.length },
        ipAddress: getClientIP(request),
      });
      
      return successResponse({ id: Number(poId), poNumber }, 'Purchase order created successfully');
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['purchasing:write']);
}
