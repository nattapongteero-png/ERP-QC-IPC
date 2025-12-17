import { NextRequest, NextResponse } from 'next/server';
import { getDb, useSqlite } from '@/lib/db';
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
      const warehouses = useSqlite() ? sqliteWarehouses : mysqlWarehouses;

      const [warehouse] = await db
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
      const warehouses = useSqlite() ? sqliteWarehouses : mysqlWarehouses;

      const [existing] = await db
        .select()
        .from(warehouses)
        .where(eq(warehouses.id, parseInt(id)));

      if (!existing) {
        return NextResponse.json({ success: false, error: 'Warehouse not found' }, { status: 404 });
      }

      const [updated] = await db
        .update(warehouses)
        .set({
          code: body.code,
          name: body.name,
          location: body.location || null,
          type: body.type || 'general',
          isActive: body.isActive ?? true,
          updatedAt: new Date(),
        })
        .where(eq(warehouses.id, parseInt(id)))
        .returning();

      await createAuditLog({
        userId: user.userId,
        action: 'UPDATE',
        tableName: 'warehouses',
        recordId: parseInt(id),
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
      const warehouses = useSqlite() ? sqliteWarehouses : mysqlWarehouses;

      const [existing] = await db
        .select()
        .from(warehouses)
        .where(eq(warehouses.id, parseInt(id)));

      if (!existing) {
        return NextResponse.json({ success: false, error: 'Warehouse not found' }, { status: 404 });
      }

      // Soft delete by setting isActive to false
      await db
        .update(warehouses)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(warehouses.id, parseInt(id)));

      await createAuditLog({
        userId: user.userId,
        action: 'DELETE',
        tableName: 'warehouses',
        recordId: parseInt(id),
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
