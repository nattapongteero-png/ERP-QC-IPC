import { NextRequest, NextResponse } from 'next/server';
import { eq, desc } from 'drizzle-orm';
import { withAuth } from '@/lib/api-utils';
import { getTableRef, executeDbOperation, dbDate, parseDbDate } from '@/lib/db/db-helper';
import { createAuditLog, getClientIP } from '@/lib/audit';

// GET - Get lot detail with all related information
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const lots = getTableRef('inventoryLots');
      const items = getTableRef('items');
      const warehouses = getTableRef('warehouses');
      const vendors = getTableRef('vendors');
      const transactions = getTableRef('inventoryTransactions');
      const qualityTests = getTableRef('qualityTests');
      const users = getTableRef('users');
      const workOrders = getTableRef('workOrders');

      // Get lot with item and warehouse info
      const lotResult = await executeDbOperation(async (db) => {
        return db
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
            qcDisposition: lots.qcDisposition,
            qcDispositionReason: lots.qcDispositionReason,
            countedQuantity: lots.countedQuantity,
            countVarianceReason: lots.countVarianceReason,
            manufacturingDate: lots.manufacturingDate,
            expiryDate: lots.expiryDate,
            receivedDate: lots.receivedDate,
            vendorId: lots.vendorId,
            vendorLotNumber: lots.vendorLotNumber,
            cost: lots.cost,
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
      });

      const lot = lotResult[0];
      if (!lot) {
        return NextResponse.json({ success: false, error: 'Lot not found' }, { status: 404 });
      }

      // Get vendor info if exists
      let vendorInfo = null;
      if (lot.vendorId) {
        const vendorResult = await executeDbOperation(async (db) => {
          return db
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
        });
        vendorInfo = vendorResult[0] || null;
      }

      // Get transaction history
      const transactionHistory = await executeDbOperation(async (db) => {
        return db
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
      });

      // Get user names for transactions
      const userIds = [...new Set(transactionHistory.map((t: { performedBy: number | null }) => t.performedBy).filter(Boolean))] as number[];
      let userMap: Map<number, string> = new Map();
      if (userIds.length > 0) {
        const userList = await executeDbOperation(async (db) => {
          return db.select({ id: users.id, name: users.name }).from(users);
        });
        userMap = new Map(userList.map((u: { id: number; name: string }) => [u.id, u.name]));
      }

      const enrichedTransactions = transactionHistory.map((t: { performedBy: number | null; [key: string]: unknown }) => ({
        ...t,
        performedByName: t.performedBy ? userMap.get(t.performedBy) || 'Unknown' : null,
      }));

      // Get QC tests for this lot (full detail)
      const qcTests = await executeDbOperation(async (db) => {
        return db
          .select({
            id: qualityTests.id,
            specId: qualityTests.specId,
            sampleNumber: qualityTests.sampleNumber,
            testType: qualityTests.testType,
            status: qualityTests.status,
            result: qualityTests.result,
            numericResult: qualityTests.numericResult,
            specMinValue: qualityTests.specMinValue,
            specMaxValue: qualityTests.specMaxValue,
            specSpecification: qualityTests.specSpecification,
            specUnit: qualityTests.specUnit,
            disposition: qualityTests.disposition,
            notes: qualityTests.notes,
            testedBy: qualityTests.testedBy,
            approvedBy: qualityTests.approvedBy,
            approvedAt: qualityTests.approvedAt,
            testDate: qualityTests.testDate,
            createdAt: qualityTests.createdAt,
          })
          .from(qualityTests)
          .where(eq(qualityTests.lotId, parseInt(id)))
          .orderBy(desc(qualityTests.createdAt));
      });

      // Resolve user names for tester and approver
      const qcUserIds = new Set<number>();
      qcTests.forEach((t: any) => {
        if (t.testedBy) qcUserIds.add(t.testedBy);
        if (t.approvedBy) qcUserIds.add(t.approvedBy);
      });
      let qcUserMap: Map<number, string> = new Map();
      if (qcUserIds.size > 0) {
        const qcUserList = await executeDbOperation(async (db) => {
          return db.select({ id: users.id, name: users.name }).from(users);
        });
        qcUserMap = new Map(qcUserList.map((u: { id: number; name: string }) => [u.id, u.name]));
      }

      // Also join with quality_specs to get test name
      const qualitySpecs = getTableRef('qualitySpecs');
      const specMap = new Map<number, string>();
      const specIds = [...new Set(qcTests.map((t: any) => t.specId).filter(Boolean))] as number[];
      if (specIds.length > 0) {
        const specList = await executeDbOperation(async (db) => {
          return db.select({ id: qualitySpecs.id, testName: qualitySpecs.testName }).from(qualitySpecs);
        });
        specList.forEach((s: any) => specMap.set(s.id, s.testName));
      }

      const enrichedQcTests = qcTests.map((t: any) => ({
        ...t,
        testName: t.specId ? specMap.get(t.specId) || null : null,
        testedByName: t.testedBy ? qcUserMap.get(t.testedBy) || null : null,
        approvedByName: t.approvedBy ? qcUserMap.get(t.approvedBy) || null : null,
      }));

      // Get work orders that used this lot (traceability)
      const relatedWorkOrders = await executeDbOperation(async (db) => {
        return db
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
      });

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
      const lots = getTableRef('inventoryLots');
      const body = await request.json();

      // Get current lot for audit
      const currentLotResult = await executeDbOperation(async (db) => {
        return db.select().from(lots).where(eq(lots.id, parseInt(id)));
      });

      const currentLot = currentLotResult[0];
      if (!currentLot) {
        return NextResponse.json({ success: false, error: 'Lot not found' }, { status: 404 });
      }

      // Update lot
      const updateData: Record<string, unknown> = {
        updatedAt: dbDate(),
      };

      // Only update fields that are provided
      if (body.batchNumber !== undefined) updateData.batchNumber = body.batchNumber || null;
      if (body.warehouseId !== undefined) updateData.warehouseId = body.warehouseId;
      if (body.locationId !== undefined) updateData.locationId = body.locationId;
      if (body.manufacturingDate !== undefined) updateData.manufacturingDate = parseDbDate(body.manufacturingDate);
      if (body.expiryDate !== undefined) updateData.expiryDate = parseDbDate(body.expiryDate);
      if (body.coaNumber !== undefined) updateData.coaNumber = body.coaNumber || null;
      if (body.vendorLotNumber !== undefined) updateData.vendorLotNumber = body.vendorLotNumber || null;
      if (body.quantity !== undefined) updateData.quantity = parseFloat(body.quantity) || 0;
      if (body.cost !== undefined) updateData.cost = body.cost ? parseFloat(body.cost) : null;

      await executeDbOperation(async (db) => {
        return db.update(lots).set(updateData).where(eq(lots.id, parseInt(id)));
      });

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
      const updatedLotResult = await executeDbOperation(async (db) => {
        return db.select().from(lots).where(eq(lots.id, parseInt(id)));
      });

      return NextResponse.json({ success: true, data: updatedLotResult[0], message: 'Lot updated successfully' });
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
      const lots = getTableRef('inventoryLots');

      // Get current lot
      const currentLotResult = await executeDbOperation(async (db) => {
        return db.select().from(lots).where(eq(lots.id, parseInt(id)));
      });

      const currentLot = currentLotResult[0];
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
      await executeDbOperation(async (db) => {
        return db.delete(lots).where(eq(lots.id, parseInt(id)));
      });

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
