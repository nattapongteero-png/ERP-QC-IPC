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

/**
 * Freight charged to the customer, as a number we are willing to post.
 *
 * Returns null when the caller sent something that is not a non-negative
 * number — the route turns that into a 400. Omitted/null/'' means "no freight"
 * and is 0, which is different from "0.00 was typed" only in intent, not in
 * money, so both collapse to 0 safely.
 */
function normalizeShippingCost(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === '') return 0;
  const n = typeof raw === 'string' ? Number(raw) : raw;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return null;
  return n;
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
        customerId,
        customerName,
        customerContact,
        customerAddress,
        requiredDate,
        paymentTerms,
        notes,
        shippingCost,
        carrier,
        trackingNumber,
        lines,
        status: requestedStatus,
        vatInclusive,
      } = body;

      // Honour the status chosen on the form (list items 50/58/59: it was
      // hard-coded to 'draft', so "ยืนยันแล้ว" was silently ignored). Only these
      // two are valid at creation — later states are reached via fulfilment.
      const status =
        requestedStatus === 'confirmed' ? 'confirmed' : 'draft';

      if (!customerName) {
        return errorResponse('Customer name is required');
      }

      if (!lines || !Array.isArray(lines) || lines.length === 0) {
        return errorResponse('At least one line item is required');
      }

      // Freight is money and it posts to the GL. A negative or non-numeric
      // value would be a credit note nobody approved, so it is rejected here
      // rather than quietly coerced to 0.
      const freight = normalizeShippingCost(shippingCost);
      if (freight === null) {
        return errorResponse('ค่าขนส่งต้องเป็นตัวเลขและไม่ติดลบ');
      }

      const soTable = getTableRef('salesOrders');
      const soLinesTable = getTableRef('salesOrderLines');

      // Resolve the customer master link. Prefer the id the form sends; fall
      // back to an exact name match so older clients still link correctly.
      // Storing this is what lets the AR invoice carry a real buyer (and its
      // tax ID) instead of the customer_id = 0 sentinel that made every tax
      // invoice in UAT incomplete under มาตรา 86/4.
      let resolvedCustomerId: number | null =
        Number.isInteger(customerId) && customerId > 0 ? Number(customerId) : null;
      if (resolvedCustomerId === null) {
        const customersTable = getTableRef('customers');
        const [match] = await executeDbOperation(async (db) =>
          db
            .select({ id: (customersTable as { id: unknown }).id })
            .from(customersTable)
            .where(eq((customersTable as { name: unknown }).name as never, customerName))
            .limit(1),
        );
        resolvedCustomerId = match?.id ?? null;
      }

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
          customerId: resolvedCustomerId,
          customerName,
          customerContact,
          customerAddress,
          // Was hard-coded 'draft', which silently discarded a "ยืนยันแล้ว"
          // choice on the form even though `status` was computed above.
          status,
          orderDate: dbDate(),
          requiredDate: parsedRequiredDate,
          totalAmount,
          vatInclusive: vatInclusive === true,
          currency: 'THB',
          paymentTerms,
          notes,
          shippingCost: freight,
          carrier: carrier || null,
          trackingNumber: trackingNumber || null,
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
        newValue: { soNumber, customerName, totalAmount, shippingCost: freight, carrier: carrier || null, trackingNumber: trackingNumber || null, linesCount: lines.length },
        ipAddress: getClientIP(request),
      });

      return successResponse({ id: Number(soId), soNumber }, 'Sales order created successfully');
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['sales:write']);
}
