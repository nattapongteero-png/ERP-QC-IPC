import { NextRequest, NextResponse } from 'next/server';
import { eq, and, desc } from 'drizzle-orm';
import { withAuth } from '@/lib/api-utils';
import { getDb, isSqlite } from '@/lib/db';
import {
  sqliteInventoryLots, mysqlInventoryLots,
  sqliteItems, mysqlItems,
  sqliteWarehouses, mysqlWarehouses,
  sqliteVendors, mysqlVendors,
  sqliteInventoryTransactions, mysqlInventoryTransactions,
  sqliteQualityTests, mysqlQualityTests,
  sqliteQualitySpecs, mysqlQualitySpecs,
  sqliteUsers, mysqlUsers,
  sqliteWorkOrders, mysqlWorkOrders,
} from '@/lib/db/schema';
import { createAuditLog, getClientIP } from '@/lib/audit';

// GET - Get lot detail with all related information
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (user) => {
    try {
      const { id } = await params;
      const db = await getDb();
      const lots = isSqlite() ? sqliteInventoryLots : mysqlInventoryLots;
      const items = isSqlite() ? sqliteItems : mysqlItems;
      const warehouses = isSqlite() ? sqliteWarehouses : mysqlWarehouses;
      const vendors = isSqlite() ? sqliteVendors : mysqlVendors;
      const transactions = isSqlite() ? sqliteInventoryTransactions : mysqlInventoryTransactions;
      const qualityTests = isSqlite() ? sqliteQualityTests : mysqlQualityTests;
      const qualitySpecs = isSqlite() ? sqliteQualitySpecs : mysqlQualitySpecs;
      const users = isSqlite() ? sqliteUsers : mysqlUsers;
      const workOrders = isSqlite() ? sqliteWorkOrders : mysqlWorkOrders;

      // Get lot with item and warehouse info
      const [lot] = await db
        .select({
          id: lots.id,
          lotNumber: lots.lotNumber,
          batchNumber: lots.batchNumber,
          itemId: lots.itemId,
          warehouseId: lots.warehouseId,
          locationId: lots.locationId,
          quantity: lots.quantity,
          reservedQuantity: lots.reservedQuantity,
          unit: lots.unit,
          status: lots.status,
          manufacturingDate: lots.manufacturingDate,
          expiryDate: lots.expiryDate,
          receivedDate: lots.receivedDate,
          vendorId: lots.vendorId,
          poNumber: lots.poNumber,
          coaNumber: lots.coaNumber,
          createdAt: lots.createdAt,
          updatedAt: lots.updatedAt,
          // Item info
          itemCode: items.code,
          itemNameTh: items.nameTh,
          itemNameEn: items.nameEn,
          itemType: items.type,
          itemCategory: items.category,
          // Warehouse info
          warehouseName: warehouses.name,
          warehouseCode: warehouses.code,
        })
        .from(lots)
        .leftJoin(items, eq(lots.itemId, items.id))
        .leftJoin(warehouses, eq(lots.warehouseId, warehouses.id))
        .where(eq(lots.id, parseInt(id)));

      if (!lot) {
        return NextResponse.json({ success: false, error: 'Lot not found' }, { status: 404 });
      }

      // Get vendor info if exists
      let vendorInfo = null;
      if (lot.vendorId) {
        const [vendor] = await db
          .select({
            id: vendors.id,
            code: vendors.code,
            name: vendors.name,
            contactPerson: vendors.contactPerson,
            phone: vendors.phone,
            email: vendors.email,
          })
          .from(vendors)
          .where(eq(vendors.id, lot.vendorId));
        vendorInfo = vendor;
      }

      // Get transaction history
      const transactionHistory = await db
        .select({
          id: transactions.id,
          transactionType: transactions.transactionType,
          quantity: transactions.quantity,
          unit: transactions.unit,
          referenceType: transactions.referenceType,
          referenceNumber: transactions.referenceNumber,
          reason: transactions.reason,
          performedBy: transactions.performedBy,
          createdAt: transactions.createdAt,
        })
        .from(transactions)
        .where(eq(transactions.lotId, parseInt(id)))
        .orderBy(desc(transactions.createdAt));

      // Get user names for transactions
      const userIds = [...new Set(transactionHistory.map((t: any) => t.performedBy).filter(Boolean))];
      let userMap: Map<number, string> = new Map();
      if (userIds.length > 0) {
        const userList = await (db as any).select({ id: users.id, name: users.name }).from(users);
        userMap = new Map(userList.map((u: any) => [u.id, u.name]));
      }

      const enrichedTransactions = transactionHistory.map((t: any) => ({
        ...t,
        performedByName: t.performedBy ? userMap.get(t.performedBy) || 'Unknown' : null,
      }));

      // Get QC tests for this lot
      const qcTests = await db
        .select({
          id: qualityTests.id,
          sampleNumber: qualityTests.sampleNumber,
          testType: qualityTests.testType,
          status: qualityTests.status,
          result: qualityTests.result,
          testedBy: qualityTests.testedBy,
          testDate: qualityTests.testDate,
          createdAt: qualityTests.createdAt,
        })
        .from(qualityTests)
        .where(eq(qualityTests.lotId, parseInt(id)))
        .orderBy(desc(qualityTests.createdAt));

      // Get tester names
      const testerIds = [...new Set(qcTests.map((t: any) => t.testedBy).filter(Boolean))];
      let testerMap: Map<number, string> = new Map();
      if (testerIds.length > 0) {
        const testerList = await (db as any).select({ id: users.id, name: users.name }).from(users);
        testerMap = new Map(testerList.map((u: any) => [u.id, u.name]));
      }

      const enrichedQcTests = qcTests.map((t: any) => ({
        ...t,
        testedByName: t.testedBy ? testerMap.get(t.testedBy) || 'Unknown' : null,
      }));

      // Get work orders that used this lot (traceability)
      const relatedWorkOrders = await db
        .select({
          id: workOrders.id,
          woNumber: workOrders.woNumber,
          productId: workOrders.productId,
          status: workOrders.status,
          plannedQuantity: workOrders.plannedQuantity,
          actualQuantity: workOrders.actualQuantity,
          plannedStartDate: workOrders.plannedStartDate,
          actualStartDate: workOrders.actualStartDate,
          actualEndDate: workOrders.actualEndDate,
        })
        .from(workOrders)
        .orderBy(desc(workOrders.createdAt))
        .limit(10);

      // Calculate days until expiry
      let daysUntilExpiry = null;
      let expiryStatus = 'normal';
      if (lot.expiryDate) {
        const today = new Date();
        const expiry = new Date(lot.expiryDate);
        daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysUntilExpiry < 0) {
          expiryStatus = 'expired';
        } else if (daysUntilExpiry <= 7) {
          expiryStatus = 'critical';
        } else if (daysUntilExpiry <= 30) {
          expiryStatus = 'warning';
        } else if (daysUntilExpiry <= 60) {
          expiryStatus = 'caution';
        }
      }

      // Calculate available quantity
      const availableQuantity = lot.quantity - (lot.reservedQuantity || 0);

      // Build response
      const response = {
        ...lot,
        vendor: vendorInfo,
        transactions: enrichedTransactions,
        qcTests: enrichedQcTests,
        relatedWorkOrders,
        daysUntilExpiry,
        expiryStatus,
        availableQuantity,
      };

      return NextResponse.json({ success: true, data: response });
    } catch (error) {
      console.error('Failed to fetch lot detail:', error);
      return NextResponse.json({ success: false, error: 'Failed to fetch lot detail' }, { status: 500 });
    }
  });
}

// PUT - Update lot information
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (user) => {
    try {
      const { id } = await params;
      const db = await getDb();
      const lots = isSqlite() ? sqliteInventoryLots : mysqlInventoryLots;
      const body = await request.json();

      // Get current lot for audit
      const [currentLot] = await (db as any).select().from(lots).where(eq(lots.id, parseInt(id)));
      if (!currentLot) {
        return NextResponse.json({ success: false, error: 'Lot not found' }, { status: 404 });
      }

      // Update lot
      const updateData: any = {
        updatedAt: new Date().toISOString(),
      };

      // Only update fields that are provided
      if (body.batchNumber !== undefined) updateData.batchNumber = body.batchNumber;
      if (body.warehouseId !== undefined) updateData.warehouseId = body.warehouseId;
      if (body.locationId !== undefined) updateData.locationId = body.locationId;
      if (body.manufacturingDate !== undefined) updateData.manufacturingDate = body.manufacturingDate;
      if (body.expiryDate !== undefined) updateData.expiryDate = body.expiryDate;
      if (body.coaNumber !== undefined) updateData.coaNumber = body.coaNumber;

      await (db as any).update(lots).set(updateData).where(eq(lots.id, parseInt(id)));

      // Log audit
      await createAuditLog({
        userId: user.userId,
        action: 'UPDATE',
        tableName: 'inventory_lots',
        recordId: parseInt(id),
        oldValue: currentLot,
        newValue: { ...currentLot, ...updateData },
        ipAddress: getClientIP(request),
      });

      // Get updated lot
      const [updatedLot] = await (db as any).select().from(lots).where(eq(lots.id, parseInt(id)));

      return NextResponse.json({ success: true, data: updatedLot, message: 'Lot updated successfully' });
    } catch (error) {
      console.error('Failed to update lot:', error);
      return NextResponse.json({ success: false, error: 'Failed to update lot' }, { status: 500 });
    }
  });
}

// DELETE - Delete lot (only if quantity is 0)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (user) => {
    try {
      const { id } = await params;
      const db = await getDb();
      const lots = isSqlite() ? sqliteInventoryLots : mysqlInventoryLots;

      // Get current lot
      const [currentLot] = await (db as any).select().from(lots).where(eq(lots.id, parseInt(id)));
      if (!currentLot) {
        return NextResponse.json({ success: false, error: 'Lot not found' }, { status: 404 });
      }

      // Check if lot has quantity
      if (currentLot.quantity > 0) {
        return NextResponse.json({ 
          success: false, 
          error: 'Cannot delete lot with remaining quantity. Please issue or scrap the inventory first.' 
        }, { status: 400 });
      }

      // Delete lot
      await (db as any).delete(lots).where(eq(lots.id, parseInt(id)));

      // Log audit
      await createAuditLog({
        userId: user.userId,
        action: 'DELETE',
        tableName: 'inventory_lots',
        recordId: parseInt(id),
        oldValue: currentLot,
        newValue: undefined,
        ipAddress: getClientIP(request),
      });

      return NextResponse.json({ success: true, message: 'Lot deleted successfully' });
    } catch (error) {
      console.error('Failed to delete lot:', error);
      return NextResponse.json({ success: false, error: 'Failed to delete lot' }, { status: 500 });
    }
  });
}
