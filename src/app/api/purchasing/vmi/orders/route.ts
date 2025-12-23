/**
 * VMI Orders API Routes
 *
 * GET /api/purchasing/vmi/orders - List VMI orders from local database
 * POST /api/purchasing/vmi/orders - Poll for new orders from VMI Portal
 */

import { NextRequest } from 'next/server';
import { eq, desc, and, sql, gte, lte, type SQL } from 'drizzle-orm';
import { getTableRef, executeDbOperation, dbDate, isSqlite } from '@/lib/db/db-helper';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
  getPaginationParams,
  createPaginatedResponse,
} from '@/lib/api-utils';
import { VmiPortalService, VmiTransactionLogger } from '@/lib/services/vmi-portal.service';
import type { VmiTransactionType, VmiOrderStatus } from '@/types/vmi';

// GET /api/purchasing/vmi/orders - List VMI orders from local database
export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const pagination = getPaginationParams(searchParams);
      const vendorId = searchParams.get('vendorId');
      const status = searchParams.get('status') as VmiOrderStatus | null;
      const dateFrom = searchParams.get('dateFrom');
      const dateTo = searchParams.get('dateTo');

      const vmiOrders = getTableRef('vMIOrders');
      const vendors = getTableRef('vendors');

      // Build conditions
      const conditions: (SQL | undefined)[] = [];
      if (vendorId) {
        conditions.push(eq(vmiOrders.vendorId, parseInt(vendorId)));
      }
      if (status) {
        conditions.push(eq(vmiOrders.status, status));
      }
      if (dateFrom) {
        conditions.push(gte(vmiOrders.orderDate, dateFrom));
      }
      if (dateTo) {
        conditions.push(lte(vmiOrders.orderDate, dateTo));
      }

      // Get total count
      const total = await executeDbOperation(async (db) => {
        const countResult = await db
          .select({ count: sql<number>`count(*)` })
          .from(vmiOrders)
          .where(conditions.length > 0 ? and(...conditions) : undefined);
        return Number(countResult[0]?.count) || 0;
      });

      // Get orders with vendor info
      const orders = await executeDbOperation(async (db) => {
        return db
          .select({
            id: vmiOrders.id,
            vendorId: vmiOrders.vendorId,
            vendorName: vendors.name,
            vmiOrderId: vmiOrders.vmiOrderId,
            hospitalCode: vmiOrders.hospitalCode,
            hospitalName: vmiOrders.hospitalName,
            poNumber: vmiOrders.poNumber,
            warehouseName: vmiOrders.warehouseName,
            status: vmiOrders.status,
            orderDate: vmiOrders.orderDate,
            expectedDeliveryDate: vmiOrders.expectedDeliveryDate,
            totalValue: vmiOrders.totalValue,
            itemCount: vmiOrders.itemCount,
            localPoId: vmiOrders.localPoId,
            confirmedAt: vmiOrders.confirmedAt,
            shippedAt: vmiOrders.shippedAt,
            receivedAt: vmiOrders.receivedAt,
            createdAt: vmiOrders.createdAt,
          })
          .from(vmiOrders)
          .leftJoin(vendors, eq(vmiOrders.vendorId, vendors.id))
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(desc(vmiOrders.createdAt))
          .limit(pagination.limit)
          .offset((pagination.page - 1) * pagination.limit);
      });

      return successResponse(createPaginatedResponse(orders, total, pagination));
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['purchasing:read']);
}

// POST /api/purchasing/vmi/orders - Poll for new orders from VMI Portal
export async function POST(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const body = await request.json();
      const { vendorId } = body;

      if (!vendorId) {
        return errorResponse('Vendor ID is required');
      }

      const vmiConfig = getTableRef('vMIVendorConfig');
      const vmiOrders = getTableRef('vMIOrders');
      const vmiOrderLines = getTableRef('vMIOrderLines');
      const vmiTransactions = getTableRef('vMITransactions');

      // Get vendor config
      const configResult = await executeDbOperation(async (db) => {
        return db
          .select()
          .from(vmiConfig)
          .where(eq(vmiConfig.vendorId, vendorId));
      });

      if (configResult.length === 0) {
        return errorResponse('VMI configuration not found for this vendor');
      }

      const config = configResult[0];

      if (!config.isConnected) {
        return errorResponse('VMI Portal is not connected. Please test the connection first.');
      }

      // Create transaction logger
      const usingSqlite = isSqlite();
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
          await executeDbOperation(async (db) => {
            return db.insert(vmiTransactions).values({
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
              createdAt: dbDate(),
            });
          });
        },
      };

      // Create service and fetch orders
      const service = new VmiPortalService({
        vendorId: config.vendorId,
        apiKeyEncrypted: config.apiKeyEncrypted,
        baseUrl: config.baseUrl || undefined,
        vmiVendorId: config.vmiVendorId || undefined,
      });
      service.setTransactionLogger(transactionLogger);

      // Fetch new orders (submitted status)
      const ordersResponse = await service.getOrders({ status: 'submitted' });

      // Get existing VMI order IDs to avoid duplicates
      const existingOrderIds = await executeDbOperation(async (db) => {
        return db
          .select({ vmiOrderId: vmiOrders.vmiOrderId })
          .from(vmiOrders)
          .where(eq(vmiOrders.vendorId, vendorId));
      });

      const existingIds = new Set(existingOrderIds.map((o: { vmiOrderId: number }) => o.vmiOrderId));

      // Filter out existing orders
      const newOrders = ordersResponse.orders.filter(o => !existingIds.has(o.id));

      // Insert new orders
      let insertedCount = 0;
      for (const order of newOrders) {
        // Insert order
        const orderInsert = await executeDbOperation(async (db) => {
          return db.insert(vmiOrders).values({
            vendorId,
            vmiOrderId: order.id,
            hospitalCode: order.hospitalCode,
            hospitalName: order.hospitalName,
            poNumber: order.poNumber,
            warehouseName: order.warehouseName || null,
            status: order.status as VmiOrderStatus,
            orderDate: order.orderDate,
            expectedDeliveryDate: order.expectedDeliveryDate || null,
            totalValue: order.totalValue,
            itemCount: order.itemCount,
            createdAt: dbDate(),
            updatedAt: dbDate(),
          });
        });

        const orderId = usingSqlite
          ? (orderInsert as { lastInsertRowid: number }).lastInsertRowid
          : (orderInsert as unknown as [{ insertId: number }])[0].insertId;

        // Fetch order detail for lines
        try {
          const orderDetail = await service.getOrderDetail(order.id);

          // Insert order lines
          for (const line of orderDetail.order?.items || []) {
            await executeDbOperation(async (db) => {
              return db.insert(vmiOrderLines).values({
                vmiOrderId: orderId,
                localCode: line.localCode,
                tppCode: line.tppCode || null,
                ttmtCode: line.ttmtCode || null,
                itemName: line.name,
                quantityOrdered: line.quantity,
                quantityReceived: 0,
                unit: line.unit,
                unitPrice: line.unitPrice,
                lineTotal: line.totalPrice || line.quantity * line.unitPrice,
                createdAt: dbDate(),
              });
            });
          }
        } catch {
          // Continue even if detail fetch fails
          console.error(`Failed to fetch detail for order ${order.id}`);
        }

        insertedCount++;
      }

      // Update last poll time
      const now = new Date();
      await executeDbOperation(async (db) => {
        return db
          .update(vmiConfig)
          .set({
            lastOrdersPollAt: dbDate(),
            updatedAt: dbDate(),
          })
          .where(eq(vmiConfig.vendorId, vendorId));
      });

      return successResponse({
        vendorId,
        polledAt: now.toISOString(),
        totalFromPortal: ordersResponse.orders.length,
        newOrdersInserted: insertedCount,
        existingOrdersSkipped: ordersResponse.orders.length - insertedCount,
      }, `Polled ${ordersResponse.orders.length} orders, inserted ${insertedCount} new orders`);
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['purchasing:write']);
}
