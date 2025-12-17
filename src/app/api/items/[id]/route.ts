import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { createAuditLog, getClientIP } from '@/lib/audit';

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/items/[id]
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const itemId = parseInt(id);
      
      if (isNaN(itemId)) {
        return errorResponse('Invalid item ID');
      }
      
      const db = await getDb();
      const useSqlite = process.env.DB_TYPE === 'sqlite';
      const itemsTable = useSqlite ? schema.sqliteItems : schema.mysqlItems;
      
      const items = await (db as any)
        .select()
        .from(itemsTable)
        .where(eq(itemsTable.id, itemId))
        .limit(1);
      
      if (items.length === 0) {
        return notFoundResponse('Item not found');
      }
      
      return successResponse(items[0]);
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['items:read']);
}

// PUT /api/items/[id]
export async function PUT(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const itemId = parseInt(id);
      
      if (isNaN(itemId)) {
        return errorResponse('Invalid item ID');
      }
      
      const body = await request.json();
      
      const db = await getDb();
      const useSqlite = process.env.DB_TYPE === 'sqlite';
      const itemsTable = useSqlite ? schema.sqliteItems : schema.mysqlItems;
      
      // Get existing item
      const existing = await (db as any)
        .select()
        .from(itemsTable)
        .where(eq(itemsTable.id, itemId))
        .limit(1);
      
      if (existing.length === 0) {
        return notFoundResponse('Item not found');
      }
      
      const oldItem = existing[0];
      
      // Build update object
      const updateData: any = {
        updatedAt: useSqlite ? new Date().toISOString() : new Date(),
      };
      
      const allowedFields = [
        'code', 'nameTh', 'nameEn', 'type', 'category', 'primaryUnit',
        'secondaryUnit', 'conversionRate', 'shelfLifeDays', 'storageCondition',
        'minStock', 'maxStock', 'reorderPoint', 'isLotControlled', 'isFEFO', 'isActive'
      ];
      
      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          updateData[field] = body[field];
        }
      }
      
      // Update item
      await (db as any)
        .update(itemsTable)
        .set(updateData)
        .where(eq(itemsTable.id, itemId));
      
      // Audit log
      await createAuditLog({
        userId: session.userId,
        action: 'UPDATE',
        tableName: 'items',
        recordId: itemId,
        oldValue: { code: oldItem.code, nameTh: oldItem.nameTh, type: oldItem.type },
        newValue: updateData,
        ipAddress: getClientIP(request),
      });
      
      return successResponse({ id: itemId }, 'Item updated successfully');
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['items:write']);
}

// DELETE /api/items/[id]
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const itemId = parseInt(id);
      
      if (isNaN(itemId)) {
        return errorResponse('Invalid item ID');
      }
      
      const db = await getDb();
      const useSqlite = process.env.DB_TYPE === 'sqlite';
      const itemsTable = useSqlite ? schema.sqliteItems : schema.mysqlItems;
      
      // Get existing item
      const existing = await (db as any)
        .select()
        .from(itemsTable)
        .where(eq(itemsTable.id, itemId))
        .limit(1);
      
      if (existing.length === 0) {
        return notFoundResponse('Item not found');
      }
      
      // Soft delete
      await (db as any)
        .update(itemsTable)
        .set({ isActive: false, updatedAt: useSqlite ? new Date().toISOString() : new Date() })
        .where(eq(itemsTable.id, itemId));
      
      // Audit log
      await createAuditLog({
        userId: session.userId,
        action: 'DELETE',
        tableName: 'items',
        recordId: itemId,
        oldValue: { code: existing[0].code, nameTh: existing[0].nameTh },
        ipAddress: getClientIP(request),
      });
      
      return successResponse({ id: itemId }, 'Item deleted successfully');
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['items:delete']);
}
