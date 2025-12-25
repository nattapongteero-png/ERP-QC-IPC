import { NextRequest } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { getTableRef, executeDbOperation, dbDate, getInsertId, parseDbDate } from '@/lib/db/db-helper';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { createAuditLog, getClientIP } from '@/lib/audit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/purchasing/orders/[id]/lines - Get all lines for a PO
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const poId = parseInt(id);

      if (isNaN(poId)) {
        return errorResponse('Invalid PO ID');
      }

      const poLinesTable = getTableRef('purchaseOrderLines');
      const itemsTable = getTableRef('items');

      const lines = await executeDbOperation(async (db) => {
        return db
          .select({
            id: poLinesTable.id,
            poId: poLinesTable.poId,
            itemId: poLinesTable.itemId,
            itemCode: itemsTable.code,
            itemName: itemsTable.nameTh,
            itemNameEn: itemsTable.nameEn,
            itemUnit: itemsTable.unitName,
            quantity: poLinesTable.quantity,
            receivedQuantity: poLinesTable.receivedQuantity,
            unit: poLinesTable.unit,
            unitPrice: poLinesTable.unitPrice,
            totalPrice: poLinesTable.totalPrice,
            expectedDate: poLinesTable.expectedDate,
            notes: poLinesTable.notes,
          })
          .from(poLinesTable)
          .leftJoin(itemsTable, eq(poLinesTable.itemId, itemsTable.id))
          .where(eq(poLinesTable.poId, poId));
      });

      return successResponse(lines);
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['purchasing:read']);
}

// POST /api/purchasing/orders/[id]/lines - Add a new line to PO
export async function POST(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const poId = parseInt(id);

      if (isNaN(poId)) {
        return errorResponse('Invalid PO ID');
      }

      const body = await request.json();
      const { itemId, quantity, unit, unitPrice, expectedDate, notes } = body;

      if (!itemId || !quantity || !unitPrice) {
        return errorResponse('Item ID, quantity, and unit price are required');
      }

      const poTable = getTableRef('purchaseOrders');
      const poLinesTable = getTableRef('purchaseOrderLines');

      // Check if PO exists and is editable
      const po = await executeDbOperation(async (db) => {
        const result = await db
          .select({ id: poTable.id, status: poTable.status })
          .from(poTable)
          .where(eq(poTable.id, poId))
          .limit(1);
        return result[0] || null;
      });

      if (!po) {
        return errorResponse('Purchase order not found', 404);
      }

      if (!['draft', 'pending_approval'].includes(po.status)) {
        return errorResponse('Cannot add lines to a PO that is not in draft or pending approval status');
      }

      // Create the line
      const totalPrice = quantity * unitPrice;
      const result = await executeDbOperation(async (db) => {
        return db.insert(poLinesTable).values({
          poId,
          itemId,
          quantity,
          receivedQuantity: 0,
          unit,
          unitPrice,
          totalPrice,
          expectedDate: parseDbDate(expectedDate),
          notes,
        });
      });

      const lineId = getInsertId(result);

      // Update PO total amount
      await updatePOTotal(poId);

      await createAuditLog({
        userId: session.userId,
        action: 'CREATE',
        tableName: 'purchase_order_lines',
        recordId: Number(lineId),
        newValue: { poId, itemId, quantity, unitPrice, totalPrice },
        ipAddress: getClientIP(request),
      });

      return successResponse({ id: Number(lineId) }, 'Line added successfully');
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['purchasing:write']);
}

// PUT /api/purchasing/orders/[id]/lines - Update a line (with lineId in body)
export async function PUT(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const poId = parseInt(id);

      if (isNaN(poId)) {
        return errorResponse('Invalid PO ID');
      }

      const body = await request.json();
      const { lineId, itemId, quantity, unit, unitPrice, expectedDate, notes } = body;

      if (!lineId) {
        return errorResponse('Line ID is required');
      }

      const poTable = getTableRef('purchaseOrders');
      const poLinesTable = getTableRef('purchaseOrderLines');

      // Check if PO exists and is editable
      const po = await executeDbOperation(async (db) => {
        const result = await db
          .select({ id: poTable.id, status: poTable.status })
          .from(poTable)
          .where(eq(poTable.id, poId))
          .limit(1);
        return result[0] || null;
      });

      if (!po) {
        return errorResponse('Purchase order not found', 404);
      }

      if (!['draft', 'pending_approval'].includes(po.status)) {
        return errorResponse('Cannot update lines of a PO that is not in draft or pending approval status');
      }

      // Build update object
      const updateData: Record<string, unknown> = {};
      if (itemId !== undefined) updateData.itemId = itemId;
      if (quantity !== undefined) updateData.quantity = quantity;
      if (unit !== undefined) updateData.unit = unit;
      if (unitPrice !== undefined) updateData.unitPrice = unitPrice;
      if (expectedDate !== undefined) updateData.expectedDate = parseDbDate(expectedDate);
      if (notes !== undefined) updateData.notes = notes;

      // Calculate total if quantity or price changed
      if (quantity !== undefined || unitPrice !== undefined) {
        const existingLine = await executeDbOperation(async (db) => {
          const result = await db
            .select({ quantity: poLinesTable.quantity, unitPrice: poLinesTable.unitPrice })
            .from(poLinesTable)
            .where(eq(poLinesTable.id, lineId))
            .limit(1);
          return result[0] || null;
        });

        if (existingLine) {
          const newQty = quantity !== undefined ? quantity : existingLine.quantity;
          const newPrice = unitPrice !== undefined ? unitPrice : existingLine.unitPrice;
          updateData.totalPrice = Number(newQty) * Number(newPrice);
        }
      }

      await executeDbOperation(async (db) => {
        return db.update(poLinesTable).set(updateData).where(eq(poLinesTable.id, lineId));
      });

      // Update PO total amount
      await updatePOTotal(poId);

      await createAuditLog({
        userId: session.userId,
        action: 'UPDATE',
        tableName: 'purchase_order_lines',
        recordId: lineId,
        newValue: updateData,
        ipAddress: getClientIP(request),
      });

      return successResponse({ id: lineId }, 'Line updated successfully');
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['purchasing:write']);
}

// DELETE /api/purchasing/orders/[id]/lines - Delete a line (with lineId in query)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const poId = parseInt(id);
      const { searchParams } = new URL(request.url);
      const lineId = parseInt(searchParams.get('lineId') || '');

      if (isNaN(poId)) {
        return errorResponse('Invalid PO ID');
      }

      if (isNaN(lineId)) {
        return errorResponse('Invalid line ID');
      }

      const poTable = getTableRef('purchaseOrders');
      const poLinesTable = getTableRef('purchaseOrderLines');

      // Check if PO exists and is editable
      const po = await executeDbOperation(async (db) => {
        const result = await db
          .select({ id: poTable.id, status: poTable.status })
          .from(poTable)
          .where(eq(poTable.id, poId))
          .limit(1);
        return result[0] || null;
      });

      if (!po) {
        return errorResponse('Purchase order not found', 404);
      }

      if (!['draft', 'pending_approval'].includes(po.status)) {
        return errorResponse('Cannot delete lines from a PO that is not in draft or pending approval status');
      }

      // Check if line has received quantity
      const line = await executeDbOperation(async (db) => {
        const result = await db
          .select({ receivedQuantity: poLinesTable.receivedQuantity })
          .from(poLinesTable)
          .where(eq(poLinesTable.id, lineId))
          .limit(1);
        return result[0] || null;
      });

      if (line && Number(line.receivedQuantity) > 0) {
        return errorResponse('Cannot delete a line that has already received goods');
      }

      await executeDbOperation(async (db) => {
        return db.delete(poLinesTable).where(eq(poLinesTable.id, lineId));
      });

      // Update PO total amount
      await updatePOTotal(poId);

      await createAuditLog({
        userId: session.userId,
        action: 'DELETE',
        tableName: 'purchase_order_lines',
        recordId: lineId,
        ipAddress: getClientIP(request),
      });

      return successResponse({ id: lineId }, 'Line deleted successfully');
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['purchasing:write']);
}

// Helper function to update PO total
async function updatePOTotal(poId: number) {
  const poTable = getTableRef('purchaseOrders');
  const poLinesTable = getTableRef('purchaseOrderLines');

  const total = await executeDbOperation(async (db) => {
    const result = await db
      .select({ total: sql`COALESCE(SUM(${poLinesTable.totalPrice}), 0)` })
      .from(poLinesTable)
      .where(eq(poLinesTable.poId, poId));
    return Number(result[0]?.total || 0);
  });

  await executeDbOperation(async (db) => {
    return db.update(poTable).set({ totalAmount: total, updatedAt: dbDate() }).where(eq(poTable.id, poId));
  });
}
