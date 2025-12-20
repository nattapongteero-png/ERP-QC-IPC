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
