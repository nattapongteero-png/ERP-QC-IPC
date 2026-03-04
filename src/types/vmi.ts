/**
 * VMI Portal Integration Types
 *
 * Type definitions for VMI Portal vendor integration following
 * the VMI-VENDOR-API.md specification v1.2
 */

// ============================================
// VMI Vendor Configuration
// ============================================

export interface VmiVendorConfig {
  id: number;
  vendorId: number;
  apiKeyEncrypted: string;
  vmiVendorId?: string;
  baseUrl?: string;
  isConnected: boolean;
  lastConnectionAt?: Date;
  syncItemsEnabled: boolean;
  syncPricesEnabled: boolean;
  syncInventoryEnabled: boolean;
  orderPollIntervalMinutes: number;
  lastItemsSyncAt?: Date;
  lastPricesSyncAt?: Date;
  lastInventorySyncAt?: Date;
  lastOrdersPollAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface VmiVendorConfigInput {
  apiKey?: string;
  vmiVendorId?: string;
  baseUrl?: string;
  syncItemsEnabled?: boolean;
  syncPricesEnabled?: boolean;
  syncInventoryEnabled?: boolean;
  orderPollIntervalMinutes?: number;
}

// ============================================
// VMI Item Sync
// ============================================

export interface VmiItem {
  localCode: string;
  name: string;
  unit: string;
  packSize?: number;
  packUnit?: string;
  tppCode?: string;
  ttmtCode?: string;
}

export interface VmiSyncResult {
  success: boolean;
  summary: {
    total: number;
    inserted: number;
    updated: number;
    failed: number;
  };
  errors?: Array<{
    localCode: string;
    message: string;
  }>;
  syncedAt: string;
}

// ============================================
// VMI Price Offers
// ============================================

export interface VmiPriceOffer {
  id?: number;
  vendorId: number;
  itemId: number;
  localCode: string;
  unitPrice: number;
  packPrice?: number;
  moq?: number;
  leadTimeDays?: number;
  effectiveDate: string;
  expiryDate?: string;
  isActive: boolean;
  lastSyncedAt?: Date;
  syncStatus: 'pending' | 'synced' | 'error';
  syncError?: string;
}

export interface VmiPriceOfferPayload {
  localCode: string;
  unitPrice: number;
  packPrice?: number;
  moq?: number;
  leadTimeDays?: number;
  effectiveDate: string;
  expiryDate?: string;
}

// ============================================
// VMI Inventory
// ============================================

export interface VmiInventoryItem {
  localCode: string;
  quantityAvailable: number;
  unit: string;
}

// ============================================
// VMI Orders
// ============================================

export type VmiOrderStatus = 'submitted' | 'confirmed' | 'shipped' | 'received' | 'cancelled';

export interface VmiOrder {
  id: number;
  vendorId: number;
  vmiOrderId: number;
  hospitalCode: string;
  hospitalName: string;
  poNumber: string;
  warehouseName?: string;
  status: VmiOrderStatus;
  orderDate: string;
  expectedDeliveryDate?: string;
  totalValue: number;
  itemCount: number;
  notes?: string;
  localPoId?: number;
  confirmedAt?: Date;
  shippedAt?: Date;
  receivedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface VmiOrderLine {
  id: number;
  vmiOrderId: number;
  itemId?: number;
  localCode: string;
  itemName: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitPrice: number;
  lineTotal: number;
  unit: string;
  tppCode?: string;
  ttmtCode?: string;
  createdAt: Date;
}

export interface VmiOrderDetail extends VmiOrder {
  items: VmiOrderLine[];
  vendorName?: string;
  localPoNumber?: string;
}

// ============================================
// VMI Portal API Responses
// ============================================

export interface VmiOrderListResponse {
  success: boolean;
  orders: Array<{
    id: number;
    hospitalCode: string;
    hospitalName: string;
    poNumber: string;
    warehouseName?: string;
    status: VmiOrderStatus;
    orderDate: string;
    expectedDeliveryDate?: string;
    totalValue: number;
    itemCount: number;
    notes?: string;
    createdAt: string;
  }>;
  pagination?: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface VmiOrderDetailResponse {
  success: boolean;
  order: {
    id: number;
    hospitalCode: string;
    hospitalName: string;
    poNumber: string;
    warehouseName?: string;
    status: VmiOrderStatus;
    orderDate: string;
    expectedDeliveryDate?: string;
    totalValue: number;
    notes?: string;
    items: Array<{
      localCode: string;
      name: string;
      quantity: number;
      unit: string;
      unitPrice: number;
      totalPrice: number;
      tppCode?: string;
      ttmtCode?: string;
    }>;
  };
}

export interface VmiOrderActionResult {
  success: boolean;
  orderId: number;
  previousStatus: VmiOrderStatus;
  newStatus: VmiOrderStatus;
  message?: string;
}

export interface VmiReceiptStatus {
  success: boolean;
  orderId: number;
  status: VmiOrderStatus;
  receiptStatus: 'none' | 'partial' | 'complete';
  items: Array<{
    localCode: string;
    name: string;
    quantityOrdered: number;
    quantityReceived: number;
    pendingQuantity: number;
  }>;
  receipts?: Array<{
    id: number;
    receiptNumber: string;
    receiptDate: string;
    receivedBy: string;
  }>;
}

// ============================================
// VMI Transaction Logging
// ============================================

export type VmiTransactionType =
  | 'item_sync'
  | 'price_sync'
  | 'inventory_sync'
  | 'order_poll'
  | 'order_confirm'
  | 'order_ship'
  | 'receipt_check'
  | 'connection_test';

export type VmiTransactionStatus = 'pending' | 'sent' | 'received' | 'processed' | 'error';

export interface VmiTransaction {
  id: number;
  vendorId: number;
  transactionType: VmiTransactionType;
  itemId?: number;
  quantity?: number;
  unit?: string;
  data?: string;
  status: VmiTransactionStatus;
  requestPayload?: string;
  responsePayload?: string;
  httpStatus?: number;
  durationMs?: number;
  endpoint?: string;
  method?: string;
  sentAt?: Date;
  receivedAt?: Date;
  errorMessage?: string;
  createdAt: Date;
}

// ============================================
// VMI Portal Error Codes
// ============================================

export type VmiErrorCode =
  | 'UNAUTHORIZED'
  | 'API_KEY_EXPIRED'
  | 'API_KEY_REVOKED'
  | 'VALIDATION_ERROR'
  | 'ORDER_NOT_FOUND'
  | 'INVALID_STATUS_TRANSITION'
  | 'INTERNAL_ERROR';

export interface VmiErrorResponse {
  success: false;
  error: {
    code: VmiErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

// ============================================
// VMI Dashboard
// ============================================

export interface VmiDashboardData {
  vendors: Array<{
    id: number;
    name: string;
    isConnected: boolean;
    lastConnectionAt?: string;
  }>;
  orders: {
    submitted: number;
    confirmed: number;
    shipped: number;
    totalValue: number;
  };
  sync: {
    lastItemsSync?: string;
    lastPricesSync?: string;
    lastInventorySync?: string;
    lastOrdersPoll?: string;
  };
  errors: Array<{
    timestamp: string;
    vendorName: string;
    transactionType: string;
    errorMessage: string;
  }>;
}

// ============================================
// API Request/Response Types
// ============================================

export interface VmiConfigResponse {
  success: boolean;
  data: {
    id: number;
    vendorId: number;
    vmiVendorId?: string;
    baseUrl?: string;
    hasApiKey: boolean;
    isConnected: boolean;
    lastConnectionAt?: string;
    syncItemsEnabled: boolean;
    syncPricesEnabled: boolean;
    syncInventoryEnabled: boolean;
    orderPollIntervalMinutes: number;
    lastItemsSyncAt?: string;
    lastPricesSyncAt?: string;
    lastInventorySyncAt?: string;
    lastOrdersPollAt?: string;
  };
}

export interface ConnectionTestResponse {
  success: boolean;
  connected: boolean;
  message: string;
  testedAt: string;
  error?: {
    code: string;
    message: string;
  };
}

export interface PollResultResponse {
  success: boolean;
  vendorId: number;
  polledAt: string;
  newOrders: number;
  updatedOrders: number;
  orders: VmiOrder[];
}

// ============================================
// Query Parameters
// ============================================

export interface VmiOrderQuery {
  vendorId?: number;
  status?: VmiOrderStatus;
  orderDateFrom?: string;
  orderDateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface VmiTransactionQuery {
  vendorId?: number;
  transactionType?: VmiTransactionType;
  status?: VmiTransactionStatus;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

// ============================================
// VMI Portal Configuration (Vendor Side)
// This system IS the vendor - connects TO VMI portals
// ============================================

export type VmiConnectionStatus = 'connected' | 'disconnected' | 'error';

export interface VmiPortalConfig {
  id: number;
  name: string;
  portalUrl: string;
  apiKeyEncrypted: string;
  vendorId: string; // Our vendor ID in this portal
  isEnabled: boolean;
  syncInventoryEnabled: boolean;
  syncInventoryInterval: number; // minutes
  syncItemsEnabled: boolean;
  syncItemsInterval: number; // minutes
  syncPricesEnabled: boolean;
  syncPricesInterval: number; // minutes
  orderPollingEnabled: boolean;
  orderPollingInterval: number; // minutes
  lastInventorySyncAt?: Date | null;
  lastItemsSyncAt?: Date | null;
  lastPricesSyncAt?: Date | null;
  lastOrdersPollAt?: Date | null;
  connectionStatus: VmiConnectionStatus;
  lastErrorMessage?: string | null;
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface VmiPortalConfigInput {
  name: string;
  portalUrl: string;
  apiKey: string; // Plain text, will be encrypted
  vendorId: string;
  isEnabled?: boolean;
  syncInventoryEnabled?: boolean;
  syncInventoryInterval?: number;
  syncItemsEnabled?: boolean;
  syncItemsInterval?: number;
  syncPricesEnabled?: boolean;
  syncPricesInterval?: number;
  orderPollingEnabled?: boolean;
  orderPollingInterval?: number;
}

export interface VmiPortalConfigUpdate {
  name?: string;
  portalUrl?: string;
  apiKey?: string; // Optional - only update if provided
  vendorId?: string;
  isEnabled?: boolean;
  syncInventoryEnabled?: boolean;
  syncInventoryInterval?: number;
  syncItemsEnabled?: boolean;
  syncItemsInterval?: number;
  syncPricesEnabled?: boolean;
  syncPricesInterval?: number;
  orderPollingEnabled?: boolean;
  orderPollingInterval?: number;
}

export interface VmiPortalTestResult {
  connected: boolean;
  latencyMs: number;
  vendorInfo?: {
    vendorId: string;
    vendorName: string;
  };
  error?: string;
}

// ============================================
// VMI Sync History (Vendor Side)
// ============================================

export type VmiSyncType = 'inventory' | 'items' | 'prices' | 'orders';
export type VmiSyncTriggerType = 'manual' | 'scheduled' | 'threshold';
export type VmiSyncStatus = 'running' | 'completed' | 'failed' | 'partial';

export interface VmiSyncHistory {
  id: number;
  portalId: number;
  syncType: VmiSyncType;
  triggerType: VmiSyncTriggerType;
  status: VmiSyncStatus;
  itemsTotal: number;
  itemsProcessed: number;
  itemsFailed: number;
  errorDetails?: Array<{ itemId: number; itemCode?: string; error: string }>;
  triggeredBy?: number | null;
  startedAt: Date;
  completedAt?: Date | null;
}

export interface VmiSyncRequest {
  portalId?: number; // Specific portal or all enabled
  itemIds?: number[]; // Specific items or all VMI-enabled
  async?: boolean;
}

export interface VmiSyncResponse {
  syncId: number;
  portalId: number;
  syncType: VmiSyncType;
  status: VmiSyncStatus;
  itemsTotal: number;
  itemsProcessed: number;
  itemsFailed: number;
  duration?: number; // milliseconds
  errors?: Array<{ itemId: number; itemCode?: string; error: string }>;
}

// ============================================
// VMI Sales Orders (Vendor Side)
// Orders received FROM VMI Portal INTO our sales system
// ============================================

export type VmiLocalOrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
// Alias for component usage
export type VmiSalesOrderStatus = VmiLocalOrderStatus;
export type VmiItemMatchStatus = 'unmatched' | 'matched' | 'multiple_matches' | 'manual_mapped';

export interface VmiSalesOrder {
  id: number;
  portalId: number;
  vmiOrderId: string;
  salesOrderId?: number | null;
  customerId?: number | null;
  vmiStatus: VmiOrderStatus;
  localStatus: VmiLocalOrderStatus;
  vmiCustomerId: string;
  vmiCustomerName: string;
  orderDate: Date;
  requiredDate?: Date | null;
  totalAmount: number;
  currency: string;
  orderDataJson: string; // Full order data from VMI Portal
  polledAt: Date;
  confirmedAt?: Date | null;
  shippedAt?: Date | null;
  deliveredAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface VmiSalesOrderLine {
  id: number;
  vmiSalesOrderId: number;
  itemId?: number | null;
  vmiLineId: string;
  tppCode?: string | null;
  ttmtCode?: string | null;
  localCode?: string | null;
  itemName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
  matchStatus: VmiItemMatchStatus;
}

export interface VmiSalesOrderDetail extends VmiSalesOrder {
  portalName?: string;
  lineCount?: number;
  unmatchedLineCount?: number;
  customer?: {
    id: number;
    code: string;
    name: string;
  } | null;
  salesOrder?: {
    id: number;
    soNumber: string;
    status: string;
  } | null;
  lines: VmiSalesOrderLine[];
}

export interface VmiSalesOrderSummary {
  id: number;
  portalId: number;
  portalName?: string;
  vmiOrderId: string;
  vmiStatus: VmiOrderStatus;
  localStatus: VmiLocalOrderStatus;
  customerId?: number | null;
  vmiCustomerId: string;
  vmiCustomerName: string;
  orderDate: Date;
  requiredDate?: Date | null;
  totalAmount: number;
  currency: string;
  lineCount: number;
  unmatchedLineCount: number;
  salesOrderId?: number | null;
  salesOrderNumber?: string | null;
  polledAt: Date;
}

export interface VmiOrderPollResult {
  portalsPolled: number;
  ordersReceived: number;
  orders: VmiSalesOrderSummary[];
  errors?: Array<{ portalId: number; error: string }>;
}

export interface VmiOrderConfirmRequest {
  expectedShipDate?: string;
  notes?: string;
}

export interface VmiOrderShipRequest {
  shipmentDate: string;
  expectedDeliveryDate: string;
  trackingNumber?: string;
  carrier?: string;
  notes?: string;
}

// ============================================
// VMI Dashboard (Vendor Side)
// ============================================

export interface VmiVendorDashboardData {
  portals: Array<{
    id: number;
    name: string;
    connectionStatus: VmiConnectionStatus;
    lastSyncAt?: string;
    pendingOrders: number;
  }>;
  sync: {
    lastInventorySync?: string;
    lastItemsSync?: string;
    lastPricesSync?: string;
    lastOrdersPoll?: string;
    itemsSynced: number;
    inventorySynced: number;
  };
  orders: {
    pending: number;
    confirmed: number;
    shipped: number;
    delivered: number;
    totalValue: number;
  };
  recentErrors: Array<{
    timestamp: string;
    portalName: string;
    operation: string;
    error: string;
  }>;
}

// ============================================
// VMI Webhook Integration (012-vmi-webhook)
// Webhook-based notifications from VMI Portal
// ============================================

/**
 * Webhook event types from VMI Portal
 * Per VMI-VENDOR-API.md section 10
 */
export type VmiWebhookEventType =
  | 'order.created'
  | 'order.cancelled'
  | 'receipt.created'
  | 'receipt.completed';

/**
 * Webhook health status (computed from isActive, isDisabledByFailures, consecutiveFailures)
 */
export type VmiWebhookHealthStatus =
  | 'active'
  | 'warning'
  | 'disabled_by_failures'
  | 'disabled_manual';

/**
 * Webhook delivery status
 */
export type VmiWebhookDeliveryStatus = 'pending' | 'processed' | 'failed';

/**
 * Webhook configuration stored in database
 */
export interface VmiWebhook {
  id: number;
  portalId: number;
  vmiWebhookId: number | null;
  name: string;
  description: string | null;
  url: string;
  events: VmiWebhookEventType[];
  isActive: boolean;
  isDisabledByFailures: boolean;
  consecutiveFailures: number;
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  lastErrorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: number | null;
}

/**
 * Input for creating a webhook
 */
export interface VmiWebhookCreate {
  name: string;
  description?: string;
  events: VmiWebhookEventType[];
}

/**
 * Input for updating a webhook
 */
export interface VmiWebhookUpdate {
  name?: string;
  description?: string;
  events?: VmiWebhookEventType[];
  isActive?: boolean;
  regenerateSecret?: boolean;
  reenableWebhook?: boolean;
}

/**
 * Webhook configuration response (without secret)
 */
export interface VmiWebhookResponse {
  id: number;
  portalId: number;
  vmiWebhookId: number | null;
  name: string;
  description: string | null;
  url: string;
  events: VmiWebhookEventType[];
  isActive: boolean;
  isDisabledByFailures: boolean;
  consecutiveFailures: number;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastErrorMessage: string | null;
  healthStatus: VmiWebhookHealthStatus;
  createdAt: string;
}

/**
 * Webhook delivery record
 */
export interface VmiWebhookDelivery {
  id: number;
  webhookId: number;
  deliveryId: string;
  eventType: VmiWebhookEventType;
  eventId: string | null;
  payload: string; // JSON string
  signature: string;
  signatureValid: boolean;
  status: VmiWebhookDeliveryStatus;
  responseCode: number | null;
  errorMessage: string | null;
  processingDurationMs: number | null;
  receivedAt: Date;
  processedAt: Date | null;
}

/**
 * Webhook delivery response for API
 */
export interface VmiWebhookDeliveryResponse {
  id: number;
  deliveryId: string;
  eventType: VmiWebhookEventType;
  eventId: string | null;
  signatureValid: boolean;
  status: VmiWebhookDeliveryStatus;
  responseCode: number | null;
  errorMessage: string | null;
  processingDurationMs: number | null;
  receivedAt: string;
  processedAt: string | null;
}

// ============================================
// Webhook Event Payloads (from VMI Portal)
// ============================================

/**
 * order.created event payload
 */
export interface VmiOrderCreatedPayload {
  orderId: number;
  poNumber: string;
  hospitalCode: string;
  hospitalName: string;
  orderDate: string;
  totalValue: string;
  itemCount: number;
  items: Array<{
    localCode: string;
    name: string;
    quantity: number;
    unitPrice: string;
  }>;
}

/**
 * order.cancelled event payload
 */
export interface VmiOrderCancelledPayload {
  orderId: number;
  poNumber: string;
  hospitalCode: string;
  reason?: string;
  cancelledAt: string;
}

/**
 * receipt.created event payload
 */
export interface VmiReceiptCreatedPayload {
  orderId: number;
  poNumber: string;
  receiptId: number;
  receiptNumber: string;
  receiptDate: string;
  hospitalCode: string;
  items: Array<{
    localCode: string;
    name: string;
    quantityReceived: number;
    quantityOrdered: number;
  }>;
}

/**
 * receipt.completed event payload
 */
export interface VmiReceiptCompletedPayload {
  orderId: number;
  poNumber: string;
  hospitalCode: string;
  completedAt: string;
  totalReceipts: number;
}

/**
 * Union type for all webhook payloads
 */
export type VmiWebhookPayload =
  | VmiOrderCreatedPayload
  | VmiOrderCancelledPayload
  | VmiReceiptCreatedPayload
  | VmiReceiptCompletedPayload;

/**
 * Helper to compute webhook health status
 */
export function computeWebhookHealthStatus(
  isActive: boolean,
  isDisabledByFailures: boolean,
  consecutiveFailures: number
): VmiWebhookHealthStatus {
  if (isDisabledByFailures) return 'disabled_by_failures';
  if (!isActive) return 'disabled_manual';
  if (consecutiveFailures >= 3) return 'warning';
  return 'active';
}
