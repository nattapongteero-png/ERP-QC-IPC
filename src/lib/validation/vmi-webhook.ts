// VMI Webhook Integration - Zod Validation Schemas
// Feature: 012-vmi-webhook
// Webhook-based notifications from VMI Portal

import { z } from 'zod';

// ============================================
// Enums as Zod schemas
// ============================================

export const vmiWebhookEventTypeSchema = z.enum([
  'order.created',
  'order.cancelled',
  'receipt.created',
  'receipt.completed',
]);

export const vmiWebhookDeliveryStatusSchema = z.enum([
  'pending',
  'processed',
  'failed',
]);

export const vmiWebhookHealthStatusSchema = z.enum([
  'active',
  'warning',
  'disabled_by_failures',
  'disabled_manual',
]);

// ============================================
// Webhook Configuration Schemas
// ============================================

export const vmiWebhookCreateSchema = z.object({
  name: z
    .string()
    .min(1, 'Webhook name is required')
    .max(100, 'Webhook name must be at most 100 characters'),
  description: z
    .string()
    .max(500, 'Description must be at most 500 characters')
    .optional(),
  events: z
    .array(vmiWebhookEventTypeSchema)
    .min(1, 'At least one event type is required')
    .max(4, 'At most 4 event types allowed'),
});

export const vmiWebhookUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  events: z
    .array(vmiWebhookEventTypeSchema)
    .min(1, 'At least one event type is required')
    .max(4)
    .optional(),
  isActive: z.boolean().optional(),
  regenerateSecret: z.boolean().optional(),
  reenableWebhook: z.boolean().optional(),
});

// ============================================
// Webhook Receiver Schemas (from VMI Portal)
// ============================================

// Headers from VMI Portal webhook requests
export const vmiWebhookHeadersSchema = z.object({
  'x-webhook-event': vmiWebhookEventTypeSchema,
  'x-webhook-timestamp': z.string().refine(
    (val) => {
      const ts = parseInt(val, 10);
      return !isNaN(ts) && ts > 0;
    },
    { message: 'Timestamp must be a valid unix timestamp' }
  ),
  'x-webhook-delivery-id': z
    .string()
    .min(1, 'Delivery ID is required')
    .max(100, 'Delivery ID must be at most 100 characters'),
  'x-webhook-signature': z
    .string()
    .min(1, 'Signature is required')
    .max(128, 'Signature must be at most 128 characters'),
});

// ============================================
// Event Payload Schemas
// ============================================

const orderItemSchema = z.object({
  localCode: z.string(),
  name: z.string(),
  quantity: z.number().positive(),
  unitPrice: z.string(),
});

export const vmiOrderCreatedPayloadSchema = z.object({
  orderId: z.number().int().positive(),
  poNumber: z.string(),
  hospitalCode: z.string(),
  hospitalName: z.string(),
  orderDate: z.string(),
  totalValue: z.string(),
  itemCount: z.number().int().nonnegative(),
  items: z.array(orderItemSchema),
});

export const vmiOrderCancelledPayloadSchema = z.object({
  orderId: z.number().int().positive(),
  poNumber: z.string(),
  hospitalCode: z.string(),
  reason: z.string().optional(),
  cancelledAt: z.string(),
});

const receiptItemSchema = z.object({
  localCode: z.string(),
  name: z.string(),
  quantityReceived: z.number().nonnegative(),
  quantityOrdered: z.number().positive(),
});

export const vmiReceiptCreatedPayloadSchema = z.object({
  orderId: z.number().int().positive(),
  poNumber: z.string(),
  receiptId: z.number().int().positive(),
  receiptNumber: z.string(),
  receiptDate: z.string(),
  hospitalCode: z.string(),
  items: z.array(receiptItemSchema),
});

export const vmiReceiptCompletedPayloadSchema = z.object({
  orderId: z.number().int().positive(),
  poNumber: z.string(),
  hospitalCode: z.string(),
  completedAt: z.string(),
  totalReceipts: z.number().int().positive(),
});

// Union schema for all webhook payloads
export const vmiWebhookPayloadSchema = z.union([
  vmiOrderCreatedPayloadSchema,
  vmiOrderCancelledPayloadSchema,
  vmiReceiptCreatedPayloadSchema,
  vmiReceiptCompletedPayloadSchema,
]);

// ============================================
// Delivery History Query Schema
// ============================================

export const vmiWebhookDeliveryQuerySchema = z.object({
  status: vmiWebhookDeliveryStatusSchema.optional(),
  eventType: vmiWebhookEventTypeSchema.optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(50),
});

// ============================================
// Internal Processing Schemas
// ============================================

export const webhookReceiverInputSchema = z.object({
  portalId: z.number().int().positive(),
  eventType: vmiWebhookEventTypeSchema,
  timestamp: z.string(),
  deliveryId: z.string(),
  signature: z.string(),
  payload: z.string(), // Raw JSON string
});

export const webhookProcessingContextSchema = z.object({
  webhookId: z.number().int().positive(),
  deliveryId: z.string(),
  eventType: vmiWebhookEventTypeSchema,
  payload: z.string(),
  signature: z.string(),
  receivedAt: z.date(),
});

// ============================================
// Type Exports (inferred from schemas)
// ============================================

export type VmiWebhookEventType = z.infer<typeof vmiWebhookEventTypeSchema>;
export type VmiWebhookDeliveryStatus = z.infer<typeof vmiWebhookDeliveryStatusSchema>;
export type VmiWebhookHealthStatus = z.infer<typeof vmiWebhookHealthStatusSchema>;

export type VmiWebhookCreateInput = z.infer<typeof vmiWebhookCreateSchema>;
export type VmiWebhookUpdateInput = z.infer<typeof vmiWebhookUpdateSchema>;
export type VmiWebhookHeaders = z.infer<typeof vmiWebhookHeadersSchema>;

export type VmiOrderCreatedPayload = z.infer<typeof vmiOrderCreatedPayloadSchema>;
export type VmiOrderCancelledPayload = z.infer<typeof vmiOrderCancelledPayloadSchema>;
export type VmiReceiptCreatedPayload = z.infer<typeof vmiReceiptCreatedPayloadSchema>;
export type VmiReceiptCompletedPayload = z.infer<typeof vmiReceiptCompletedPayloadSchema>;
export type VmiWebhookPayload = z.infer<typeof vmiWebhookPayloadSchema>;

export type VmiWebhookDeliveryQueryInput = z.infer<typeof vmiWebhookDeliveryQuerySchema>;
export type WebhookReceiverInput = z.infer<typeof webhookReceiverInputSchema>;
export type WebhookProcessingContext = z.infer<typeof webhookProcessingContextSchema>;

// ============================================
// Validation Helper Functions
// ============================================

/**
 * Parse and validate webhook payload based on event type
 */
export function parseWebhookPayload(
  eventType: VmiWebhookEventType,
  payload: string
): VmiWebhookPayload {
  const parsed = JSON.parse(payload);

  switch (eventType) {
    case 'order.created':
      return vmiOrderCreatedPayloadSchema.parse(parsed);
    case 'order.cancelled':
      return vmiOrderCancelledPayloadSchema.parse(parsed);
    case 'receipt.created':
      return vmiReceiptCreatedPayloadSchema.parse(parsed);
    case 'receipt.completed':
      return vmiReceiptCompletedPayloadSchema.parse(parsed);
    default:
      throw new Error(`Unknown event type: ${eventType}`);
  }
}

/**
 * Safely parse webhook payload, returning null on error
 */
export function safeParseWebhookPayload(
  eventType: VmiWebhookEventType,
  payload: string
): VmiWebhookPayload | null {
  try {
    return parseWebhookPayload(eventType, payload);
  } catch {
    return null;
  }
}
