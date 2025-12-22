import { NextRequest } from 'next/server';
import { eq, desc, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import {
  sqliteVendors, sqlitePurchaseOrders, sqliteApprovedVendorList, sqliteItems,
  mysqlVendors, mysqlPurchaseOrders, mysqlApprovedVendorList, mysqlItems
} from '@/lib/db/schema';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { createAuditLog, getClientIP } from '@/lib/audit';

// GET /api/vendors/[id] - Get vendor details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const vendorId = parseInt(id);

      if (isNaN(vendorId)) {
        return errorResponse('Invalid vendor ID');
      }

      const db = await getDb();
      const isSqlite = process.env.DB_TYPE === 'sqlite';
      const vendors = isSqlite ? sqliteVendors : mysqlVendors;
      const purchaseOrders = isSqlite ? sqlitePurchaseOrders : mysqlPurchaseOrders;
      const approvedVendorList = isSqlite ? sqliteApprovedVendorList : mysqlApprovedVendorList;
      const items = isSqlite ? sqliteItems : mysqlItems;

      // Get vendor details
      const vendorResult = await (db as any)
        .select()
        .from(vendors)
        .where(eq(vendors.id, vendorId));

      if (vendorResult.length === 0) {
        return errorResponse('Vendor not found', 404);
      }

      const vendor = vendorResult[0];

      // Get recent purchase orders for this vendor
      const recentPOs = await (db as any)
        .select({
          id: purchaseOrders.id,
          poNumber: purchaseOrders.poNumber,
          orderDate: purchaseOrders.orderDate,
          expectedDate: purchaseOrders.expectedDate,
          status: purchaseOrders.status,
          totalAmount: purchaseOrders.totalAmount,
          currency: purchaseOrders.currency,
        })
        .from(purchaseOrders)
        .where(eq(purchaseOrders.vendorId, vendorId))
        .orderBy(desc(purchaseOrders.createdAt))
        .limit(10);

      // Get approved items for this vendor (AVL)
      const approvedItems = await (db as any)
        .select({
          id: approvedVendorList.id,
          itemId: approvedVendorList.itemId,
          itemCode: items.code,
          itemName: items.nameTh,
          itemNameEn: items.nameEn,
          approvalDate: approvedVendorList.approvalDate,
          expiryDate: approvedVendorList.expiryDate,
          isPreferred: approvedVendorList.isPreferred,
        })
        .from(approvedVendorList)
        .leftJoin(items, eq(approvedVendorList.itemId, items.id))
        .where(eq(approvedVendorList.vendorId, vendorId));

      // Get summary statistics
      const poStats = await (db as any)
        .select({
          totalOrders: sql<number>`count(*)`,
          totalAmount: sql<number>`sum(${purchaseOrders.totalAmount})`,
        })
        .from(purchaseOrders)
        .where(eq(purchaseOrders.vendorId, vendorId));

      const statusCounts = await (db as any)
        .select({
          status: purchaseOrders.status,
          count: sql<number>`count(*)`,
        })
        .from(purchaseOrders)
        .where(eq(purchaseOrders.vendorId, vendorId))
        .groupBy(purchaseOrders.status);

      const summary = {
        totalOrders: Number(poStats[0]?.totalOrders) || 0,
        totalAmount: Number(poStats[0]?.totalAmount) || 0,
        approvedItemsCount: approvedItems.length,
        statusBreakdown: statusCounts.reduce((acc: Record<string, number>, curr: { status: string | null; count: number | string }) => {
          acc[curr.status || 'unknown'] = Number(curr.count);
          return acc;
        }, {}),
      };

      return successResponse({
        vendor,
        recentPurchaseOrders: recentPOs,
        approvedItems,
        summary,
      });
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['purchasing:read']);
}

// PUT /api/vendors/[id] - Update vendor
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const vendorId = parseInt(id);

      if (isNaN(vendorId)) {
        return errorResponse('Invalid vendor ID');
      }

      const body = await request.json();
      const {
        code,
        name,
        contactPerson,
        phone,
        email,
        address,
        taxId,
        isApproved,
        isVMI,
        leadTimeDays,
        paymentTerms,
        isActive,
      } = body;

      if (!code || !name) {
        return errorResponse('Code and name are required');
      }

      const db = await getDb();
      const isSqlite = process.env.DB_TYPE === 'sqlite';
      const vendors = isSqlite ? sqliteVendors : mysqlVendors;

      // Check if vendor exists
      const existing = await (db as any)
        .select()
        .from(vendors)
        .where(eq(vendors.id, vendorId));

      if (existing.length === 0) {
        return errorResponse('Vendor not found', 404);
      }

      // Check if code is unique (excluding current vendor)
      const codeCheck = await (db as any)
        .select()
        .from(vendors)
        .where(eq(vendors.code, code));

      if (codeCheck.length > 0 && codeCheck[0].id !== vendorId) {
        return errorResponse('Vendor code already exists');
      }

      const now = new Date();
      await (db as any)
        .update(vendors)
        .set({
          code,
          name,
          contactPerson,
          phone,
          email,
          address,
          taxId,
          isApproved: isApproved ?? existing[0].isApproved,
          isVMI: isVMI ?? existing[0].isVMI,
          leadTimeDays,
          paymentTerms,
          isActive: isActive ?? existing[0].isActive,
          updatedAt: isSqlite ? now.toISOString() : now,
        })
        .where(eq(vendors.id, vendorId));

      await createAuditLog({
        userId: session.userId,
        action: 'UPDATE',
        tableName: 'vendors',
        recordId: vendorId,
        oldValue: existing[0],
        newValue: { code, name, isApproved, isVMI, isActive },
        ipAddress: getClientIP(request),
      });

      return successResponse({ id: vendorId }, 'Vendor updated successfully');
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['purchasing:write']);
}

// DELETE /api/vendors/[id] - Delete (deactivate) vendor
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const vendorId = parseInt(id);

      if (isNaN(vendorId)) {
        return errorResponse('Invalid vendor ID');
      }

      const db = await getDb();
      const isSqlite = process.env.DB_TYPE === 'sqlite';
      const vendors = isSqlite ? sqliteVendors : mysqlVendors;
      const purchaseOrders = isSqlite ? sqlitePurchaseOrders : mysqlPurchaseOrders;

      // Check if vendor exists
      const existing = await (db as any)
        .select()
        .from(vendors)
        .where(eq(vendors.id, vendorId));

      if (existing.length === 0) {
        return errorResponse('Vendor not found', 404);
      }

      // Check if vendor has any purchase orders
      const poCount = await (db as any)
        .select({ count: sql<number>`count(*)` })
        .from(purchaseOrders)
        .where(eq(purchaseOrders.vendorId, vendorId));

      if (Number(poCount[0]?.count) > 0) {
        // Soft delete - deactivate instead of hard delete
        const now = new Date();
        await (db as any)
          .update(vendors)
          .set({
            isActive: false,
            updatedAt: isSqlite ? now.toISOString() : now,
          })
          .where(eq(vendors.id, vendorId));

        await createAuditLog({
          userId: session.userId,
          action: 'DELETE',
          tableName: 'vendors',
          recordId: vendorId,
          oldValue: existing[0],
          newValue: { isActive: false },
          ipAddress: getClientIP(request),
        });

        return successResponse({ id: vendorId }, 'Vendor deactivated (has related records)');
      }

      // Hard delete if no related records
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as any).delete(vendors).where(eq(vendors.id, vendorId));

      await createAuditLog({
        userId: session.userId,
        action: 'DELETE',
        tableName: 'vendors',
        recordId: vendorId,
        oldValue: existing[0],
        ipAddress: getClientIP(request),
      });

      return successResponse({ id: vendorId }, 'Vendor deleted successfully');
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['purchasing:write']);
}
