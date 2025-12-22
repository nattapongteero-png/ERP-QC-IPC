import { NextRequest, NextResponse } from 'next/server';
import { getDb, isSqlite } from '@/lib/db';
import { sqliteWarehouses, mysqlWarehouses } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { withAuth } from '@/lib/api-utils';
import { createAuditLog, getClientIP } from '@/lib/audit';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (user) => {
    try {
      const { id } = await params;
      const db = await getDb();
      const warehouses = isSqlite() ? sqliteWarehouses : mysqlWarehouses;

      const [warehouse] = await (db as any)
        .select()
        .from(warehouses)
        .where(eq(warehouses.id, parseInt(id)));

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
      const db = await getDb();
      const body = await request.json();
      const isSqlite = isSqlite();
      const warehouses = isSqlite ? sqliteWarehouses : mysqlWarehouses;
      const warehouseId = parseInt(id);

      const [existing] = await (db as any)
        .select()
        .from(warehouses)
        .where(eq(warehouses.id, warehouseId));

      if (!existing) {
        return NextResponse.json({ success: false, error: 'Warehouse not found' }, { status: 404 });
      }

      const now = new Date();
      const updateData = {
        code: body.code,
        name: body.name,
        location: body.location || null,
        type: body.type || 'general',
        isActive: body.isActive ?? true,
        updatedAt: isSqlite ? now.toISOString() : now,
      };

      await (db as any)
        .update(warehouses)
        .set(updateData)
        .where(eq(warehouses.id, warehouseId));

      // Fetch updated record
      const [updated] = await (db as any)
        .select()
        .from(warehouses)
        .where(eq(warehouses.id, warehouseId));

      await createAuditLog({
        userId: user.userId,
        action: 'UPDATE',
        tableName: 'warehouses',
        recordId: warehouseId,
        oldValue: existing,
        newValue: updated,
        ipAddress: getClientIP(request),
      });

      return NextResponse.json({ success: true, data: updated, message: 'Warehouse updated successfully' });
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
      const db = await getDb();
      const isSqlite = isSqlite();
      const warehouses = isSqlite ? sqliteWarehouses : mysqlWarehouses;
      const warehouseId = parseInt(id);

      const [existing] = await (db as any)
        .select()
        .from(warehouses)
        .where(eq(warehouses.id, warehouseId));

      if (!existing) {
        return NextResponse.json({ success: false, error: 'Warehouse not found' }, { status: 404 });
      }

      const now = new Date();

      // Soft delete by setting isActive to false
      await (db as any)
        .update(warehouses)
        .set({ isActive: false, updatedAt: isSqlite ? now.toISOString() : now })
        .where(eq(warehouses.id, warehouseId));

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
