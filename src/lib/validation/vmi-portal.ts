// VMI Portal Integration - Zod Validation Schemas
// Feature: 008-vmi-vendor-sync
// This system IS the vendor - syncs TO VMI portals, receives orders FROM portals

import { z } from 'zod';

// ============================================
// Enums as Zod schemas
// ============================================

export const vmiConnectionStatusSchema = z.enum(['connected', 'disconnected', 'error']);

export const vmiSyncTypeSchema = z.enum(['inventory', 'items', 'prices', 'orders']);

export const vmiSyncTriggerTypeSchema = z.enum(['manual', 'scheduled', 'threshold']);

export const vmiSyncStatusSchema = z.enum(['running', 'completed', 'failed', 'partial']);

export const vmiOrderStatusSchema = z.enum([
  'submitted',
  'confirmed',
  'shipped',
  'received',
  'cancelled',
]);

export const vmiLocalOrderStatusSchema = z.enum([
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
]);

export const vmiItemMatchStatusSchema = z.enum([
  'unmatched',
  'matched',
  'multiple_matches',
  'manual_mapped',
]);

// ============================================
// VMI Portal Configuration Schemas
// ============================================

export const vmiPortalConfigCreateSchema = z.object({
  name: z
    .string()
    .min(1, 'Portal name is required')
    .max(100, 'Portal name must be at most 100 characters'),
  portalUrl: z
    .string()
    .min(1, 'Portal URL is required')
    .url('Portal URL must be a valid URL')
    .refine((url) => url.startsWith('https://'), {
      message: 'Portal URL must use HTTPS',
    }),
  apiKey: z
    .string()
    .min(1, 'API key is required')
    .max(500, 'API key must be at most 500 characters'),
  vendorId: z
    .string()
    .min(1, 'Vendor ID is required')
    .max(50, 'Vendor ID must be at most 50 characters'),
  isEnabled: z.boolean().default(true),
  syncInventoryEnabled: z.boolean().default(true),
  syncInventoryInterval: z
    .number()
    .int()
    .min(5, 'Sync interval must be at least 5 minutes')
    .max(1440, 'Sync interval must be at most 1440 minutes (24 hours)')
    .default(60),
  syncItemsEnabled: z.boolean().default(true),
  syncItemsInterval: z
    .number()
    .int()
    .min(5)
    .max(1440)
    .default(60),
  syncPricesEnabled: z.boolean().default(true),
  syncPricesInterval: z
    .number()
    .int()
    .min(5)
    .max(1440)
    .default(60),
  orderPollingEnabled: z.boolean().default(true),
  orderPollingInterval: z
    .number()
    .int()
    .min(5, 'Order polling interval must be at least 5 minutes')
    .max(1440)
    .default(15),
});

export const vmiPortalConfigUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  portalUrl: z
    .string()
    .url()
    .refine((url) => url.startsWith('https://'), {
      message: 'Portal URL must use HTTPS',
    })
    .optional(),
  apiKey: z.string().min(1).max(500).optional(),
  vendorId: z.string().min(1).max(50).optional(),
  isEnabled: z.boolean().optional(),
  syncInventoryEnabled: z.boolean().optional(),
  syncInventoryInterval: z.number().int().min(5).max(1440).optional(),
  syncItemsEnabled: z.boolean().optional(),
  syncItemsInterval: z.number().int().min(5).max(1440).optional(),
  syncPricesEnabled: z.boolean().optional(),
  syncPricesInterval: z.number().int().min(5).max(1440).optional(),
  orderPollingEnabled: z.boolean().optional(),
  orderPollingInterval: z.number().int().min(5).max(1440).optional(),
});

// ============================================
// VMI Sync Request Schemas
// ============================================

export const vmiSyncRequestSchema = z.object({
  portalId: z.number().int().positive().optional(),
  itemIds: z.array(z.number().int().positive()).optional(),
  async: z.boolean().default(false),
});

export const vmiInventorySyncRequestSchema = z.object({
  portalId: z.number().int().positive().optional(),
  itemIds: z.array(z.number().int().positive()).optional(),
});

export const vmiItemsSyncRequestSchema = z.object({
  portalId: z.number().int().positive().optional(),
  itemIds: z.array(z.number().int().positive()).optional(),
});

export const vmiPricesSyncRequestSchema = z.object({
  portalId: z.number().int().positive().optional(),
  itemIds: z.array(z.number().int().positive()).optional(),
});

// ============================================
// VMI Order Schemas
// ============================================

export const vmiOrderQuerySchema = z.object({
  portalId: z.coerce.number().int().positive().optional(),
  vmiStatus: vmiOrderStatusSchema.optional(),
  localStatus: vmiLocalOrderStatusSchema.optional(),
  customerId: z.coerce.number().int().positive().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().default('polledAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const vmiOrderPollRequestSchema = z.object({
  portalId: z.number().int().positive().optional(),
});

export const vmiOrderUpdateSchema = z.object({
  customerId: z.number().int().positive().optional(),
  localStatus: vmiLocalOrderStatusSchema.optional(),
  notes: z.string().max(1000).optional(),
});

export const vmiOrderConfirmRequestSchema = z.object({
  expectedShipDate: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'Expected ship date must be a valid date',
    })
    .optional(),
  notes: z.string().max(1000).optional(),
});

export const vmiOrderShipRequestSchema = z.object({
  shipmentDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Shipment date must be a valid date',
  }),
  expectedDeliveryDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Expected delivery date must be a valid date',
  }),
  trackingNumber: z.string().max(100).optional(),
  carrier: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
});

export const vmiOrderLineMatchRequestSchema = z.object({
  itemId: z.number().int().positive('Item ID is required'),
});

// ============================================
// VMI Transaction/History Query Schemas
// ============================================

export const vmiSyncHistoryQuerySchema = z.object({
  portalId: z.coerce.number().int().positive().optional(),
  syncType: vmiSyncTypeSchema.optional(),
  status: vmiSyncStatusSchema.optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// ============================================
// Type Exports (inferred from schemas)
// ============================================

export type VmiConnectionStatus = z.infer<typeof vmiConnectionStatusSchema>;
export type VmiSyncType = z.infer<typeof vmiSyncTypeSchema>;
export type VmiSyncTriggerType = z.infer<typeof vmiSyncTriggerTypeSchema>;
export type VmiSyncStatus = z.infer<typeof vmiSyncStatusSchema>;
export type VmiOrderStatus = z.infer<typeof vmiOrderStatusSchema>;
export type VmiLocalOrderStatus = z.infer<typeof vmiLocalOrderStatusSchema>;
export type VmiItemMatchStatus = z.infer<typeof vmiItemMatchStatusSchema>;

export type VmiPortalConfigCreateInput = z.infer<typeof vmiPortalConfigCreateSchema>;
export type VmiPortalConfigUpdateInput = z.infer<typeof vmiPortalConfigUpdateSchema>;
export type VmiSyncRequestInput = z.infer<typeof vmiSyncRequestSchema>;
export type VmiInventorySyncRequestInput = z.infer<typeof vmiInventorySyncRequestSchema>;
export type VmiItemsSyncRequestInput = z.infer<typeof vmiItemsSyncRequestSchema>;
export type VmiPricesSyncRequestInput = z.infer<typeof vmiPricesSyncRequestSchema>;
export type VmiOrderQueryInput = z.infer<typeof vmiOrderQuerySchema>;
export type VmiOrderPollRequestInput = z.infer<typeof vmiOrderPollRequestSchema>;
export type VmiOrderUpdateInput = z.infer<typeof vmiOrderUpdateSchema>;
export type VmiOrderConfirmRequestInput = z.infer<typeof vmiOrderConfirmRequestSchema>;
export type VmiOrderShipRequestInput = z.infer<typeof vmiOrderShipRequestSchema>;
export type VmiOrderLineMatchRequestInput = z.infer<typeof vmiOrderLineMatchRequestSchema>;
export type VmiSyncHistoryQueryInput = z.infer<typeof vmiSyncHistoryQuerySchema>;
