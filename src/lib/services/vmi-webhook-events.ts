/**
 * VMI Webhook Event Handlers
 *
 * Processes webhook events from VMI portals
 * Per VMI-VENDOR-API.md specification
 *
 * @module vmi-webhook-events
 */

import { getTableRef, executeDbOperation, getInsertId } from '../db/db-helper';
import { getNow, toDbDate } from '../db/date-utils';
import { eq, and } from 'drizzle-orm';
import { createAuditLog } from '@/lib/audit';
import {
  VmiWebhookEventType,
  VmiOrderCreatedPayload,
  VmiOrderCancelledPayload,
  VmiReceiptCreatedPayload,
  VmiReceiptCompletedPayload,
} from '@/lib/validation/vmi-webhook';
import { VmiWebhookService } from './vmi-webhook.service';
import { ensureVmiCustomerWithDb } from './vmi-customer-sync.service';

export class VmiWebhookEventError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly recoverable: boolean = false
  ) {
    super(message);
    this.name = 'VmiWebhookEventError';
  }
}

export interface EventProcessingResult {
  success: boolean;
  entityType?: 'vmi_sales_order' | 'vmi_sales_order_line';
  entityId?: number;
  action?: 'created' | 'updated' | 'cancelled';
  error?: string;
  needsManualReview?: boolean;
}

interface EventProcessingContext {
  webhookId: number;
  deliveryId: string;
  portalId: number;
  eventType: VmiWebhookEventType;
}

/**
 * Get database tables for VMI operations
 */
function getTables() {
  return {
    orders: getTableRef('vmiSalesOrders'),
    orderLines: getTableRef('vmiSalesOrderLines'),
    portalConfig: getTableRef('vmiPortalConfig'),
  };
}

/**
 * Process order.created event
 *
 * Creates a new VMI sales order record from the webhook payload
 */
export async function processOrderCreated(
  payload: VmiOrderCreatedPayload,
  context: EventProcessingContext
): Promise<EventProcessingResult> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    // Check if order already exists (idempotency via vmiOrderId)
    const [existingOrder] = await db
      .select({ id: tables.orders.id })
      .from(tables.orders)
      .where(
        and(
          eq(tables.orders.portalId, context.portalId),
          eq(tables.orders.vmiOrderId, String(payload.orderId))
        )
      );

    if (existingOrder) {
      return {
        success: true,
        entityType: 'vmi_sales_order',
        entityId: existingOrder.id,
        action: 'created',
        error: 'Order already exists (duplicate webhook)',
      };
    }

    // Sheet item 10: make sure this VMI hospital exists in the customer register.
    const customerId = await ensureVmiCustomerWithDb(db, {
      hospitalCode: payload.hospitalCode,
      hospitalName: payload.hospitalName,
      vmiPortalId: context.portalId,
    });

    // Create the order with full order data JSON
    const orderResult = await db.insert(tables.orders).values({
      portalId: context.portalId,
      vmiOrderId: String(payload.orderId),
      customerId,
      vmiCustomerId: payload.hospitalCode,
      vmiCustomerName: payload.hospitalName,
      vmiStatus: 'submitted',
      localStatus: 'pending',
      orderDate: toDbDate(payload.orderDate),
      totalAmount: parseFloat(payload.totalValue),
      currency: 'THB',
      orderDataJson: JSON.stringify(payload),
      polledAt: getNow(),
      createdAt: getNow(),
      updatedAt: getNow(),
    });

    const orderId = getInsertId(orderResult);

    // Create order lines
    if (payload.items && payload.items.length > 0) {
      for (let i = 0; i < payload.items.length; i++) {
        const item = payload.items[i];
        const unitPrice = parseFloat(item.unitPrice);
        const lineTotal = item.quantity * unitPrice;

        await db.insert(tables.orderLines).values({
          vmiSalesOrderId: orderId,
          vmiLineId: `${payload.orderId}-${i + 1}`,
          localCode: item.localCode,
          itemName: item.name,
          quantity: item.quantity,
          unit: 'EA', // Default unit
          unitPrice: unitPrice,
          lineTotal: lineTotal,
          matchStatus: 'unmatched',
          createdAt: getNow(),
        });
      }
    }

    // Audit log
    await createAuditLog({
      action: 'CREATE',
      tableName: 'vmi_sales_orders',
      recordId: orderId,
      newValue: {
        vmiOrderId: payload.orderId,
        poNumber: payload.poNumber,
        vmiStatus: 'submitted',
        source: 'webhook',
        webhookDeliveryId: context.deliveryId,
      },
    });

    return {
      success: true,
      entityType: 'vmi_sales_order',
      entityId: orderId,
      action: 'created',
    };
  });
}

/**
 * Process order.cancelled event
 *
 * Updates order status to cancelled
 */
export async function processOrderCancelled(
  payload: VmiOrderCancelledPayload,
  context: EventProcessingContext
): Promise<EventProcessingResult> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    // Find the order
    const [existingOrder] = await db
      .select({
        id: tables.orders.id,
        vmiStatus: tables.orders.vmiStatus,
        localStatus: tables.orders.localStatus,
      })
      .from(tables.orders)
      .where(
        and(
          eq(tables.orders.portalId, context.portalId),
          eq(tables.orders.vmiOrderId, String(payload.orderId))
        )
      );

    if (!existingOrder) {
      return {
        success: false,
        error: `Order not found: vmiOrderId=${payload.orderId}`,
        needsManualReview: true,
      };
    }

    // Check if already shipped - flag for manual review
    if (existingOrder.localStatus === 'shipped' || existingOrder.localStatus === 'delivered') {
      // Update vmiStatus but keep localStatus
      await db
        .update(tables.orders)
        .set({
          vmiStatus: 'cancelled',
          updatedAt: getNow(),
        })
        .where(eq(tables.orders.id, existingOrder.id));

      await createAuditLog({
        action: 'UPDATE',
        tableName: 'vmi_sales_orders',
        recordId: existingOrder.id,
        oldValue: { vmiStatus: existingOrder.vmiStatus, localStatus: existingOrder.localStatus },
        newValue: {
          vmiStatus: 'cancelled',
          note: 'Order already shipped locally - flagged for manual review',
          cancellationReason: payload.reason,
        },
      });

      return {
        success: true,
        entityType: 'vmi_sales_order',
        entityId: existingOrder.id,
        action: 'updated',
        needsManualReview: true,
        error: 'Order already shipped locally - flagged for manual review',
      };
    }

    // Update order status to cancelled
    const oldVmiStatus = existingOrder.vmiStatus;
    await db
      .update(tables.orders)
      .set({
        vmiStatus: 'cancelled',
        localStatus: 'cancelled',
        updatedAt: getNow(),
      })
      .where(eq(tables.orders.id, existingOrder.id));

    await createAuditLog({
      action: 'UPDATE',
      tableName: 'vmi_sales_orders',
      recordId: existingOrder.id,
      oldValue: { vmiStatus: oldVmiStatus },
      newValue: {
        vmiStatus: 'cancelled',
        localStatus: 'cancelled',
        cancellationReason: payload.reason,
        source: 'webhook',
      },
    });

    return {
      success: true,
      entityType: 'vmi_sales_order',
      entityId: existingOrder.id,
      action: 'cancelled',
    };
  });
}

/**
 * Process receipt.created event
 *
 * Updates order line quantities with received amounts
 * Note: The existing schema doesn't have quantityReceived on lines,
 * so we'll store the receipt info in audit log for now
 */
export async function processReceiptCreated(
  payload: VmiReceiptCreatedPayload,
  context: EventProcessingContext
): Promise<EventProcessingResult> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    // Find the order
    const [existingOrder] = await db
      .select({
        id: tables.orders.id,
        vmiStatus: tables.orders.vmiStatus,
      })
      .from(tables.orders)
      .where(
        and(
          eq(tables.orders.portalId, context.portalId),
          eq(tables.orders.vmiOrderId, String(payload.orderId))
        )
      );

    if (!existingOrder) {
      return {
        success: false,
        error: `Order not found: vmiOrderId=${payload.orderId}`,
        needsManualReview: true,
      };
    }

    // Update order with partial receipt info
    // The VMI portal is telling us they received goods
    await db
      .update(tables.orders)
      .set({
        vmiStatus: 'received', // Partially or fully received
        updatedAt: getNow(),
      })
      .where(eq(tables.orders.id, existingOrder.id));

    // Log the receipt details
    await createAuditLog({
      action: 'UPDATE',
      tableName: 'vmi_sales_orders',
      recordId: existingOrder.id,
      oldValue: { vmiStatus: existingOrder.vmiStatus },
      newValue: {
        vmiStatus: 'received',
        receiptId: payload.receiptId,
        receiptNumber: payload.receiptNumber,
        receiptDate: payload.receiptDate,
        itemsReceived: payload.items.map(item => ({
          localCode: item.localCode,
          quantityReceived: item.quantityReceived,
          quantityOrdered: item.quantityOrdered,
        })),
        source: 'webhook',
      },
    });

    return {
      success: true,
      entityType: 'vmi_sales_order',
      entityId: existingOrder.id,
      action: 'updated',
    };
  });
}

/**
 * Process receipt.completed event
 *
 * Updates order status to fully received
 */
export async function processReceiptCompleted(
  payload: VmiReceiptCompletedPayload,
  context: EventProcessingContext
): Promise<EventProcessingResult> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    // Find the order
    const [existingOrder] = await db
      .select({
        id: tables.orders.id,
        vmiStatus: tables.orders.vmiStatus,
      })
      .from(tables.orders)
      .where(
        and(
          eq(tables.orders.portalId, context.portalId),
          eq(tables.orders.vmiOrderId, String(payload.orderId))
        )
      );

    if (!existingOrder) {
      return {
        success: false,
        error: `Order not found: vmiOrderId=${payload.orderId}`,
        needsManualReview: true,
      };
    }

    const oldVmiStatus = existingOrder.vmiStatus;

    // Update order status to received
    await db
      .update(tables.orders)
      .set({
        vmiStatus: 'received',
        deliveredAt: toDbDate(payload.completedAt),
        updatedAt: getNow(),
      })
      .where(eq(tables.orders.id, existingOrder.id));

    await createAuditLog({
      action: 'UPDATE',
      tableName: 'vmi_sales_orders',
      recordId: existingOrder.id,
      oldValue: { vmiStatus: oldVmiStatus },
      newValue: {
        vmiStatus: 'received',
        totalReceipts: payload.totalReceipts,
        completedAt: payload.completedAt,
        source: 'webhook',
      },
    });

    return {
      success: true,
      entityType: 'vmi_sales_order',
      entityId: existingOrder.id,
      action: 'updated',
    };
  });
}

/**
 * Route and process webhook event based on event type
 */
export async function processWebhookEvent(
  eventType: VmiWebhookEventType,
  payload: unknown,
  context: EventProcessingContext
): Promise<EventProcessingResult> {
  const webhookService = new VmiWebhookService();
  const startTime = Date.now();

  try {
    let result: EventProcessingResult;

    switch (eventType) {
      case 'order.created':
        result = await processOrderCreated(payload as VmiOrderCreatedPayload, context);
        break;
      case 'order.cancelled':
        result = await processOrderCancelled(payload as VmiOrderCancelledPayload, context);
        break;
      case 'receipt.created':
        result = await processReceiptCreated(payload as VmiReceiptCreatedPayload, context);
        break;
      case 'receipt.completed':
        result = await processReceiptCompleted(payload as VmiReceiptCompletedPayload, context);
        break;
      default:
        throw new VmiWebhookEventError(`Unknown event type: ${eventType}`, 'UNKNOWN_EVENT_TYPE');
    }

    const durationMs = Date.now() - startTime;

    // Update delivery status
    await webhookService.updateDeliveryStatus(
      context.deliveryId,
      result.success ? 'processed' : 'failed',
      result.success ? 200 : 500,
      durationMs,
      result.error
    );

    // Record success/failure for webhook health tracking
    if (result.success && !result.needsManualReview) {
      await webhookService.recordSuccess(context.webhookId);
    }

    return result;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Update delivery as failed
    await webhookService.updateDeliveryStatus(
      context.deliveryId,
      'failed',
      500,
      durationMs,
      errorMessage
    );

    await webhookService.recordFailure(context.webhookId, errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
}
