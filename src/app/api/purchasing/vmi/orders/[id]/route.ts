/**
 * VMI Order Detail API Routes
 *
 * GET /api/purchasing/vmi/orders/[id] - Get VMI order detail
 * PATCH /api/purchasing/vmi/orders/[id] - Update VMI order (confirm/ship)
 */

import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import {
  sqliteVendors,
  sqliteVMIVendorConfig,
  sqliteVMIOrders,
  sqliteVMIOrderLines,
  sqliteVMITransactions,
  sqlitePurchaseOrders,
  sqlitePurchaseOrderLines,
  mysqlVendors,
  mysqlVMIVendorConfig,
  mysqlVMIOrders,
  mysqlVMIOrderLines,
  mysqlVMITransactions,
  mysqlPurchaseOrders,
  mysqlPurchaseOrderLines,
} from '@/lib/db/schema';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { createAuditLog, getClientIP } from '@/lib/audit';
import { VmiPortalService, VmiPortalError, VmiTransactionLogger } from '@/lib/services/vmi-portal.service';
import type { VmiTransactionType, VmiOrderStatus } from '@/types/vmi';

// GET /api/purchasing/vmi/orders/[id] - Get VMI order detail
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const orderId = parseInt(id);

      if (isNaN(orderId)) {
        return errorResponse('Invalid order ID');
      }

      const db = await getDb();
      const isSqlite = process.env.DB_TYPE === 'sqlite';
      const vmiOrders = isSqlite ? sqliteVMIOrders : mysqlVMIOrders;
      const vmiOrderLines = isSqlite ? sqliteVMIOrderLines : mysqlVMIOrderLines;
      const vendors = isSqlite ? sqliteVendors : mysqlVendors;

      // Get order with vendor info
      const orderResult = await db
        .select({
          id: vmiOrders.id,
          vendorId: vmiOrders.vendorId,
          vendorName: vendors.name,
          vendorCode: vendors.code,
          vmiOrderId: vmiOrders.vmiOrderId,
          hospitalCode: vmiOrders.hospitalCode,
          hospitalName: vmiOrders.hospitalName,
          poNumber: vmiOrders.poNumber,
          warehouseName: vmiOrders.warehouseName,
          status: vmiOrders.status,
          orderDate: vmiOrders.orderDate,
          expectedDate: vmiOrders.expectedDate,
          totalAmount: vmiOrders.totalAmount,
          currency: vmiOrders.currency,
          localPoId: vmiOrders.localPoId,
          confirmedAt: vmiOrders.confirmedAt,
          shippedAt: vmiOrders.shippedAt,
          receivedAt: vmiOrders.receivedAt,
          notes: vmiOrders.notes,
          createdAt: vmiOrders.createdAt,
          updatedAt: vmiOrders.updatedAt,
        })
        .from(vmiOrders)
        .leftJoin(vendors, eq(vmiOrders.vendorId, vendors.id))
        .where(eq(vmiOrders.id, orderId));

      if (orderResult.length === 0) {
        return errorResponse('Order not found', 404);
      }

      // Get order lines
      const lines = await db
        .select()
        .from(vmiOrderLines)
        .where(eq(vmiOrderLines.vmiOrderId, orderId));

      return successResponse({
        ...orderResult[0],
        lines,
      });
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['purchasing:read']);
}

// PATCH /api/purchasing/vmi/orders/[id] - Update VMI order (confirm/ship)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const orderId = parseInt(id);

      if (isNaN(orderId)) {
        return errorResponse('Invalid order ID');
      }

      const body = await request.json();
      const { action, expectedDeliveryDate } = body;

      if (!action || !['confirm', 'ship'].includes(action)) {
        return errorResponse('Invalid action. Must be "confirm" or "ship"');
      }

      if (action === 'ship' && !expectedDeliveryDate) {
        return errorResponse('Expected delivery date is required for shipping');
      }

      const db = await getDb();
      const isSqlite = process.env.DB_TYPE === 'sqlite';
      const vmiOrders = isSqlite ? sqliteVMIOrders : mysqlVMIOrders;
      const vmiOrderLines = isSqlite ? sqliteVMIOrderLines : mysqlVMIOrderLines;
      const vmiConfig = isSqlite ? sqliteVMIVendorConfig : mysqlVMIVendorConfig;
      const vmiTransactions = isSqlite ? sqliteVMITransactions : mysqlVMITransactions;
      const purchaseOrders = isSqlite ? sqlitePurchaseOrders : mysqlPurchaseOrders;
      const purchaseOrderLines = isSqlite ? sqlitePurchaseOrderLines : mysqlPurchaseOrderLines;

      // Get order
      const orderResult = await db
        .select()
        .from(vmiOrders)
        .where(eq(vmiOrders.id, orderId));

      if (orderResult.length === 0) {
        return errorResponse('Order not found', 404);
      }

      const order = orderResult[0];

      // Validate status transition
      if (action === 'confirm' && order.status !== 'submitted') {
        return errorResponse(`Cannot confirm order with status "${order.status}". Order must be in "submitted" status.`);
      }

      if (action === 'ship' && order.status !== 'confirmed') {
        return errorResponse(`Cannot ship order with status "${order.status}". Order must be in "confirmed" status.`);
      }

      // Get vendor config
      const configResult = await db
        .select()
        .from(vmiConfig)
        .where(eq(vmiConfig.vendorId, order.vendorId));

      if (configResult.length === 0) {
        return errorResponse('VMI configuration not found');
      }

      const config = configResult[0];

      // Create transaction logger
      const transactionLogger: VmiTransactionLogger = {
        async log(
          logVendorId: number,
          transactionType: VmiTransactionType,
          endpoint: string,
          method: string,
          requestPayload: unknown,
          responsePayload: unknown,
          httpStatus: number,
          durationMs: number,
          error?: string
        ) {
          const now = new Date();
          await db.insert(vmiTransactions).values({
            vendorId: logVendorId,
            transactionType,
            endpoint,
            method,
            requestPayload: requestPayload ? JSON.stringify(requestPayload) : null,
            responsePayload: responsePayload ? JSON.stringify(responsePayload) : null,
            httpStatus,
            durationMs,
            status: error ? 'error' : 'success',
            errorMessage: error || null,
            createdAt: isSqlite ? now.toISOString() : now,
          });
        },
      };

      // Create service
      const service = new VmiPortalService({
        vendorId: config.vendorId,
        apiKeyEncrypted: config.apiKeyEncrypted,
        baseUrl: config.baseUrl || undefined,
        vmiVendorId: config.vmiVendorId || undefined,
      });
      service.setTransactionLogger(transactionLogger);

      const now = new Date();
      let newStatus: VmiOrderStatus;
      let localPoId: number | null = null;

      try {
        if (action === 'confirm') {
          // Confirm order in VMI Portal
          await service.confirmOrder(order.vmiOrderId);
          newStatus = 'confirmed';

          // Create local purchase order (T036)
          const lines = await db
            .select()
            .from(vmiOrderLines)
            .where(eq(vmiOrderLines.vmiOrderId, orderId));

          // Generate PO number
          const poNumber = `VMI-${order.hospitalCode}-${order.poNumber}`;

          // Insert purchase order
          const poResult = await db.insert(purchaseOrders).values({
            vendorId: order.vendorId,
            poNumber,
            orderDate: isSqlite ? now.toISOString().split('T')[0] : now,
            expectedDate: order.expectedDate || null,
            status: 'approved',
            totalAmount: order.totalAmount,
            currency: order.currency,
            notes: `VMI Order from ${order.hospitalName} (${order.hospitalCode}). Original PO: ${order.poNumber}`,
            createdBy: session.userId,
            createdAt: isSqlite ? now.toISOString() : now,
            updatedAt: isSqlite ? now.toISOString() : now,
          });

          localPoId = isSqlite
            ? (poResult as { lastInsertRowid: number }).lastInsertRowid
            : (poResult as unknown as [{ insertId: number }])[0].insertId;

          // Insert purchase order lines
          for (const line of lines) {
            await db.insert(purchaseOrderLines).values({
              purchaseOrderId: localPoId,
              itemId: null, // Will be linked later when items are synced
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              totalPrice: line.totalPrice,
              notes: `${line.itemName} (TPP: ${line.tppCode || 'N/A'}, TTMT: ${line.ttmtCode || 'N/A'})`,
              createdAt: isSqlite ? now.toISOString() : now,
            });
          }

          // Update VMI order with local PO ID
          await db
            .update(vmiOrders)
            .set({
              status: newStatus,
              localPoId,
              confirmedAt: isSqlite ? now.toISOString() : now,
              updatedAt: isSqlite ? now.toISOString() : now,
            })
            .where(eq(vmiOrders.id, orderId));

        } else if (action === 'ship') {
          // Ship order in VMI Portal
          await service.shipOrder(order.vmiOrderId, expectedDeliveryDate);
          newStatus = 'shipped';

          await db
            .update(vmiOrders)
            .set({
              status: newStatus,
              expectedDate: expectedDeliveryDate,
              shippedAt: isSqlite ? now.toISOString() : now,
              updatedAt: isSqlite ? now.toISOString() : now,
            })
            .where(eq(vmiOrders.id, orderId));
        } else {
          return errorResponse('Invalid action');
        }
      } catch (err) {
        if (err instanceof VmiPortalError) {
          return errorResponse(
            `VMI Portal error: ${err.getUserMessage('en')}`,
            err.httpStatus
          );
        }
        throw err;
      }

      // Create audit log
      await createAuditLog({
        userId: session.userId,
        action: 'UPDATE',
        tableName: 'vmi_orders',
        recordId: orderId,
        oldValue: { status: order.status },
        newValue: {
          status: newStatus!,
          action,
          localPoId: action === 'confirm' ? localPoId : undefined,
        },
        ipAddress: getClientIP(request),
      });

      return successResponse({
        orderId,
        vmiOrderId: order.vmiOrderId,
        previousStatus: order.status,
        newStatus: newStatus!,
        localPoId: action === 'confirm' ? localPoId : order.localPoId,
        updatedAt: now.toISOString(),
      }, `Order ${action === 'confirm' ? 'confirmed' : 'shipped'} successfully`);
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['purchasing:write']);
}
