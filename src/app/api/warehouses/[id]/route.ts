import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getTableRef, executeDbOperation, dbDate } from '@/lib/db/db-helper';
import { withAuth } from '@/lib/api-utils';
import { createAuditLog, getClientIP } from '@/lib/audit';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const warehouses = getTableRef('warehouses');

      const result = await executeDbOperation(async (db) => {
        return db
          .select()
          .from(warehouses)
          .where(eq(warehouses.id, parseInt(id)));
      });

      const warehouse = result[0];
      if (!warehouse) {
        return NextResponse.json({ success: false, error: 'Warehouse not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, data: warehouse });
    } catch (error) {
      console.error('Failed to fetch warehouse:', error);
      return NextResponse.json({ success: false, error: 'Failed to fetch warehouse' }, { status: 500 });
    }
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (user) => {
    try {
      const { id } = await params;
      const body = await request.json();
      const warehouses = getTableRef('warehouses');
      const warehouseId = parseInt(id);

      const existingResult = await executeDbOperation(async (db) => {
        return db
          .select()
          .from(warehouses)
          .where(eq(warehouses.id, warehouseId));
      });

      const existing = existingResult[0];
      if (!existing) {
        return NextResponse.json({ success: false, error: 'Warehouse not found' }, { status: 404 });
      }

      const updateData = {
        code: body.code,
        name: body.name,
        location: body.location || null,
        type: body.type || 'general',
        isActive: body.isActive ?? true,
        updatedAt: dbDate(),
      };

      await executeDbOperation(async (db) => {
        return db
          .update(warehouses)
          .set(updateData)
          .where(eq(warehouses.id, warehouseId));
      });

      // Fetch updated record
      const updatedResult = await executeDbOperation(async (db) => {
        return db
          .select()
          .from(warehouses)
          .where(eq(warehouses.id, warehouseId));
      });

      await createAuditLog({
        userId: user.userId,
        action: 'UPDATE',
        tableName: 'warehouses',
        recordId: warehouseId,
        oldValue: existing,
        newValue: updatedResult[0],
        ipAddress: getClientIP(request),
      });

      return NextResponse.json({ success: true, data: updatedResult[0], message: 'Warehouse updated successfully' });
    } catch (error) {
      console.error('Failed to update warehouse:', error);
      return NextResponse.json({ success: false, error: 'Failed to update warehouse' }, { status: 500 });
    }
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (user) => {
    try {
      const { id } = await params;
      const warehouses = getTableRef('warehouses');
      const warehouseId = parseInt(id);

      const existingResult = await executeDbOperation(async (db) => {
        return db
          .select()
          .from(warehouses)
          .where(eq(warehouses.id, warehouseId));
      });

      const existing = existingResult[0];
      if (!existing) {
        return NextResponse.json({ success: false, error: 'Warehouse not found' }, { status: 404 });
      }

      // Soft delete by setting isActive to false
      await executeDbOperation(async (db) => {
        return db
          .update(warehouses)
          .set({ isActive: false, updatedAt: dbDate() })
          .where(eq(warehouses.id, warehouseId));
      });

      await createAuditLog({
        userId: user.userId,
        action: 'DELETE',
        tableName: 'warehouses',
        recordId: warehouseId,
        oldValue: existing,
        ipAddress: getClientIP(request),
      });

      return NextResponse.json({ success: true, message: 'Warehouse deleted successfully' });
    } catch (error) {
      console.error('Failed to delete warehouse:', error);
      return NextResponse.json({ success: false, error: 'Failed to delete warehouse' }, { status: 500 });
    }
  });
}
