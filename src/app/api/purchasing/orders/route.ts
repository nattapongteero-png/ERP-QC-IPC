import { NextRequest } from 'next/server';
import { eq, like, sql, and, type SQL } from 'drizzle-orm';
import { getTableRef, executeDbOperation, dbDate, getInsertId, parseDbDate } from '@/lib/db/db-helper';
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
  return withAuth(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const pagination = getPaginationParams(searchParams);
      const search = searchParams.get('search') || '';
      const status = searchParams.get('status') || '';
      const vendorId = searchParams.get('vendorId') || '';

      const poTable = getTableRef('purchaseOrders');
      const vendorsTable = getTableRef('vendors');

      const conditions: (SQL | undefined)[] = [];
      if (search) {
        conditions.push(like(poTable.poNumber, `%${search}%`));
      }
      if (status) {
        conditions.push(eq(poTable.status, status));
      }
      if (vendorId) {
        conditions.push(eq(poTable.vendorId, parseInt(vendorId)));
      }

      // Count query
      const total = await executeDbOperation(async (db) => {
        let countQuery = db.select({ count: sql`count(*)` }).from(poTable);
        if (conditions.length > 0) {
          countQuery = countQuery.where(and(...conditions));
        }
        const countResult = await countQuery;
        return Number(countResult[0]?.count || 0);
      });

      // Data query
      const offset = (pagination.page - 1) * pagination.limit;
      const orders = await executeDbOperation(async (db) => {
        let query = db
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
            vendorCode: vendorsTable.code,
            // Metaherb dual-approval state, so the list can show both sides'
            // status without opening the PO. Null = non-Metaherb PO.
            metaherbApproval: poTable.metaherbApproval,
            erpOwnerApproval: poTable.erpOwnerApproval,
            createdAt: poTable.createdAt,
          })
          .from(poTable)
          .leftJoin(vendorsTable, eq(poTable.vendorId, vendorsTable.id));

        if (conditions.length > 0) {
          query = query.where(and(...conditions));
        }

        return query.limit(pagination.limit).offset(offset);
      });

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
        shippingCost,
        otherCharges,
      } = body;

      if (!vendorId) {
        return errorResponse('Vendor ID is required');
      }

      if (!lines || !Array.isArray(lines) || lines.length === 0) {
        return errorResponse('At least one line item is required');
      }

      const poTable = getTableRef('purchaseOrders');
      const poLinesTable = getTableRef('purchaseOrderLines');

      const poNumber = generatePONumber();

      // Compute amounts server-side (don't trust client totals): goods subtotal
      // + extra charges, then 7% VAT on the sum, then the grand total.
      const VAT_RATE = 0.07;
      const subtotalAmount = lines.reduce((sum: number, line: Record<string, unknown>) => {
        return sum + ((line.quantity as number) * (line.unitPrice as number));
      }, 0);
      const charges = (Number(shippingCost) || 0) + (Number(otherCharges) || 0);
      const vatAmount = (subtotalAmount + charges) * VAT_RATE;
      const totalAmount = subtotalAmount + charges + vatAmount;

      // Create PO
      const result = await executeDbOperation(async (db) => {
        return db.insert(poTable).values({
          poNumber,
          vendorId,
          status: 'draft',
          orderDate: dbDate(),
          expectedDate: parseDbDate(expectedDate),
          totalAmount,
          subtotalAmount,
          shippingCost: Number(shippingCost) || 0,
          otherCharges: Number(otherCharges) || 0,
          vatAmount,
          currency: 'THB',
          paymentTerms,
          shippingAddress,
          notes,
          createdBy: session.userId,
          createdAt: dbDate(),
          updatedAt: dbDate(),
        });
      });

      const poId = getInsertId(result);

      // Create PO lines
      for (const line of lines) {
        await executeDbOperation(async (db) => {
          return db.insert(poLinesTable).values({
            poId: Number(poId),
            itemId: line.itemId,
            quantity: line.quantity,
            receivedQuantity: 0,
            unit: line.unit,
            unitPrice: line.unitPrice,
            totalPrice: (line.quantity as number) * (line.unitPrice as number),
            expectedDate: parseDbDate(line.expectedDate as string | null | undefined),
            notes: line.notes,
          });
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
