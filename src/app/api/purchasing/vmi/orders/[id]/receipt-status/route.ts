/**
 * VMI Order Receipt Status API Route
 *
 * GET /api/purchasing/vmi/orders/[id]/receipt-status - Get receipt status from VMI Portal
 */

import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getTableRef, executeDbOperation, dbDate } from '@/lib/db/db-helper';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { VmiPortalService, VmiPortalError, VmiTransactionLogger } from '@/lib/services/vmi-portal.service';
import type { VmiTransactionType } from '@/types/vmi';

// GET /api/purchasing/vmi/orders/[id]/receipt-status - Get receipt status
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

      const vmiOrders = getTableRef('vMIOrders');
      const vmiConfig = getTableRef('vMIVendorConfig');
      const vmiTransactions = getTableRef('vMITransactions');

      // Get order
      const orderResult = await executeDbOperation(async (db) => {
        return db
          .select()
          .from(vmiOrders)
          .where(eq(vmiOrders.id, orderId));
      });

      if (orderResult.length === 0) {
        return errorResponse('Order not found', 404);
      }

      const order = orderResult[0];

      // Only check receipt status for shipped orders
      if (order.status !== 'shipped') {
        return successResponse({
          orderId,
          vmiOrderId: order.vmiOrderId,
          orderStatus: order.status,
          receiptStatus: order.status === 'received' ? 'received' : 'pending',
          receivedAt: order.receivedAt,
          message: order.status === 'received'
            ? 'Order has been received'
            : `Order is in "${order.status}" status. Receipt check only applies to shipped orders.`,
        });
      }

      // Get vendor config
      const configResult = await executeDbOperation(async (db) => {
        return db
          .select()
          .from(vmiConfig)
          .where(eq(vmiConfig.vendorId, order.vendorId));
      });

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

      // Create service
      const service = new VmiPortalService({
        vendorId: config.vendorId,
        apiKeyEncrypted: config.apiKeyEncrypted,
        baseUrl: config.baseUrl || undefined,
        vmiVendorId: config.vmiVendorId || undefined,
      });
      service.setTransactionLogger(transactionLogger);

      try {
        // Fetch receipt status from VMI Portal
        const receiptStatus = await service.getReceiptStatus(order.vmiOrderId);

        // If received (complete receipt), update local order
        if (receiptStatus.receiptStatus === 'complete' && order.status !== 'received') {
          await executeDbOperation(async (db) => {
            return db
              .update(vmiOrders)
              .set({
                status: 'received',
                receivedAt: dbDate(),
                updatedAt: dbDate(),
              })
              .where(eq(vmiOrders.id, orderId));
          });
        }

        return successResponse({
          orderId,
          vmiOrderId: order.vmiOrderId,
          orderStatus: receiptStatus.receiptStatus === 'complete' ? 'received' : order.status,
          receiptStatus: receiptStatus.receiptStatus,
          items: receiptStatus.items,
          receipts: receiptStatus.receipts,
          checkedAt: new Date().toISOString(),
        });
      } catch (err) {
        if (err instanceof VmiPortalError) {
          return errorResponse(
            `VMI Portal error: ${err.getUserMessage('en')}`,
            err.httpStatus
          );
        }
        throw err;
      }
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['purchasing:read']);
}
