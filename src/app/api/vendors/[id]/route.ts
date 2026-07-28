import { NextRequest } from 'next/server';
import { eq, desc, sql } from 'drizzle-orm';
import { getTableRef, executeDbOperation, dbDate } from '@/lib/db/db-helper';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { createAuditLog, getClientIP } from '@/lib/audit';
import { normalizeTaxId } from '@/lib/utils/tax-id';

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

      const vendorsTable = getTableRef('vendors');
      const purchaseOrdersTable = getTableRef('purchaseOrders');
      const approvedVendorListTable = getTableRef('approvedVendorList');
      const itemsTable = getTableRef('items');

      // Get vendor details
      const vendorResult = await executeDbOperation(async (db) => {
        return db.select().from(vendorsTable).where(eq(vendorsTable.id, vendorId));
      });

      if (vendorResult.length === 0) {
        return errorResponse('Vendor not found', 404);
      }

      const vendor = vendorResult[0];

      // Get recent purchase orders for this vendor
      const recentPOs = await executeDbOperation(async (db) => {
        return db
          .select({
            id: purchaseOrdersTable.id,
            poNumber: purchaseOrdersTable.poNumber,
            orderDate: purchaseOrdersTable.orderDate,
            expectedDate: purchaseOrdersTable.expectedDate,
            status: purchaseOrdersTable.status,
            totalAmount: purchaseOrdersTable.totalAmount,
            currency: purchaseOrdersTable.currency,
          })
          .from(purchaseOrdersTable)
          .where(eq(purchaseOrdersTable.vendorId, vendorId))
          .orderBy(desc(purchaseOrdersTable.createdAt))
          .limit(10);
      });

      // Get approved items for this vendor (AVL)
      const approvedItems = await executeDbOperation(async (db) => {
        return db
          .select({
            id: approvedVendorListTable.id,
            itemId: approvedVendorListTable.itemId,
            itemCode: itemsTable.code,
            itemName: itemsTable.nameTh,
            itemNameEn: itemsTable.nameEn,
            approvalDate: approvedVendorListTable.approvalDate,
            expiryDate: approvedVendorListTable.expiryDate,
            isPreferred: approvedVendorListTable.isPreferred,
          })
          .from(approvedVendorListTable)
          .leftJoin(itemsTable, eq(approvedVendorListTable.itemId, itemsTable.id))
          .where(eq(approvedVendorListTable.vendorId, vendorId));
      });

      // Get summary statistics
      const poStats = await executeDbOperation(async (db) => {
        return db
          .select({
            totalOrders: sql<number>`count(*)`,
            totalAmount: sql<number>`sum(${purchaseOrdersTable.totalAmount})`,
          })
          .from(purchaseOrdersTable)
          .where(eq(purchaseOrdersTable.vendorId, vendorId));
      });

      const statusCounts = await executeDbOperation(async (db) => {
        return db
          .select({
            status: purchaseOrdersTable.status,
            count: sql<number>`count(*)`,
          })
          .from(purchaseOrdersTable)
          .where(eq(purchaseOrdersTable.vendorId, vendorId))
          .groupBy(purchaseOrdersTable.status);
      });

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

      // A Thai tax ID is exactly 13 digits — not "at most 13", which let a
      // 5-digit value through and onto the WHT certificate. Blank stays
      // allowed; malformed is rejected.
      const normalizedTaxId = normalizeTaxId(taxId);
      if (normalizedTaxId === null) {
        return errorResponse('เลขประจำตัวผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก');
      }

      const vendorsTable = getTableRef('vendors');

      // Check if vendor exists
      const existing = await executeDbOperation(async (db) => {
        return db.select().from(vendorsTable).where(eq(vendorsTable.id, vendorId));
      });

      if (existing.length === 0) {
        return errorResponse('Vendor not found', 404);
      }

      // Check if code is unique (excluding current vendor)
      const codeCheck = await executeDbOperation(async (db) => {
        return db.select().from(vendorsTable).where(eq(vendorsTable.code, code));
      });

      if (codeCheck.length > 0 && codeCheck[0].id !== vendorId) {
        return errorResponse('Vendor code already exists');
      }

      await executeDbOperation(async (db) => {
        return db
          .update(vendorsTable)
          .set({
            code,
            name,
            contactPerson,
            phone,
            email,
            address,
            taxId: normalizedTaxId,
            isApproved: isApproved ?? existing[0].isApproved,
            isVMI: isVMI ?? existing[0].isVMI,
            leadTimeDays,
            paymentTerms,
            isActive: isActive ?? existing[0].isActive,
            updatedAt: dbDate(),
          })
          .where(eq(vendorsTable.id, vendorId));
      });

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

      const vendorsTable = getTableRef('vendors');
      const purchaseOrdersTable = getTableRef('purchaseOrders');

      // Check if vendor exists
      const existing = await executeDbOperation(async (db) => {
        return db.select().from(vendorsTable).where(eq(vendorsTable.id, vendorId));
      });

      if (existing.length === 0) {
        return errorResponse('Vendor not found', 404);
      }

      // Check if vendor has any purchase orders
      const poCount = await executeDbOperation(async (db) => {
        return db
          .select({ count: sql<number>`count(*)` })
          .from(purchaseOrdersTable)
          .where(eq(purchaseOrdersTable.vendorId, vendorId));
      });

      if (Number(poCount[0]?.count) > 0) {
        // Soft delete - deactivate instead of hard delete
        await executeDbOperation(async (db) => {
          return db
            .update(vendorsTable)
            .set({
              isActive: false,
              updatedAt: dbDate(),
            })
            .where(eq(vendorsTable.id, vendorId));
        });

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
      await executeDbOperation(async (db) => {
        return db.delete(vendorsTable).where(eq(vendorsTable.id, vendorId));
      });

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
