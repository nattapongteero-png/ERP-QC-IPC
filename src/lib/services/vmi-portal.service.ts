/**
 * VMI Portal Service
 *
 * Service class for communicating with VMI Portal API.
 * Handles authentication, request/response logging, and error handling.
 */

// API key is stored in plain text (configured via UI settings)
import type {
  VmiVendorConfig,
  VmiItem,
  VmiSyncResult,
  VmiPriceOfferPayload,
  VmiInventoryItem,
  VmiOrderListResponse,
  VmiOrderDetailResponse,
  VmiOrderActionResult,
  VmiReceiptStatus,
  VmiOrderQuery,
  VmiErrorCode,
  VmiTransactionType,
} from '@/types/vmi';

// ============================================
// Error Handling
// ============================================

/**
 * Error class for VMI Portal API errors
 */
export class VmiPortalError extends Error {
  public readonly code: VmiErrorCode;
  public readonly httpStatus: number;
  public readonly details?: Record<string, unknown>;

  constructor(code: VmiErrorCode, message: string, httpStatus: number = 400, details?: Record<string, unknown>) {
    super(message);
    this.name = 'VmiPortalError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(lang: 'th' | 'en' = 'en'): string {
    const messages: Record<VmiErrorCode, { th: string; en: string }> = {
      UNAUTHORIZED: { th: 'API Key ไม่ถูกต้อง', en: 'Invalid API Key' },
      API_KEY_EXPIRED: { th: 'API Key หมดอายุ', en: 'API Key expired' },
      API_KEY_REVOKED: { th: 'API Key ถูกยกเลิก', en: 'API Key revoked' },
      VALIDATION_ERROR: { th: 'ข้อมูลไม่ถูกต้อง', en: 'Invalid data' },
      ORDER_NOT_FOUND: { th: 'ไม่พบคำสั่งซื้อ', en: 'Order not found' },
      INVALID_STATUS_TRANSITION: { th: 'ไม่สามารถเปลี่ยนสถานะได้', en: 'Cannot change status' },
      INTERNAL_ERROR: { th: 'ระบบ VMI Portal มีปัญหา', en: 'VMI Portal system error' },
    };

    return messages[this.code]?.[lang] || this.message;
  }
}

// ============================================
// Transaction Logger Interface
// ============================================

export interface VmiTransactionLogger {
  log(
    vendorId: number,
    transactionType: VmiTransactionType,
    endpoint: string,
    method: string,
    request: unknown,
    response: unknown,
    httpStatus: number,
    durationMs: number,
    error?: string
  ): Promise<void>;
}

// ============================================
// VMI Portal Service
// ============================================

export interface VmiPortalServiceConfig {
  vendorId: number;
  apiKeyEncrypted: string;
  baseUrl?: string;
  vmiVendorId?: string;
}

export class VmiPortalService {
  private readonly vendorId: number;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly vmiVendorId?: string;
  private transactionLogger?: VmiTransactionLogger;

  private static readonly DEFAULT_BASE_URL = 'https://vmi-portal.bmscloud.in.th/api/external/vendor';
  private static readonly DEFAULT_TIMEOUT = 30000; // 30 seconds
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff

  constructor(config: VmiPortalServiceConfig) {
    this.vendorId = config.vendorId;
    this.baseUrl = config.baseUrl || process.env.VMI_PORTAL_BASE_URL || VmiPortalService.DEFAULT_BASE_URL;
    this.apiKey = config.apiKeyEncrypted; // Plain text API key
    this.vmiVendorId = config.vmiVendorId;
  }

  /**
   * Set transaction logger for audit trail
   */
  setTransactionLogger(logger: VmiTransactionLogger): void {
    this.transactionLogger = logger;
  }

  /**
   * Create service instance from vendor config
   */
  static fromConfig(config: VmiVendorConfig): VmiPortalService {
    return new VmiPortalService({
      vendorId: config.vendorId,
      apiKeyEncrypted: config.apiKeyEncrypted,
      baseUrl: config.baseUrl || undefined,
      vmiVendorId: config.vmiVendorId || undefined,
    });
  }

  /**
   * Make authenticated request to VMI Portal
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    transactionType?: VmiTransactionType
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const startTime = Date.now();

    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
    };

    let response: Response;
    let responseData: unknown;
    let error: string | undefined;

    try {
      response = await fetch(url, options);
      const durationMs = Date.now() - startTime;

      // Try to parse response
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      // Log transaction
      if (this.transactionLogger && transactionType) {
        await this.transactionLogger.log(
          this.vendorId,
          transactionType,
          path,
          method,
          body,
          responseData,
          response.status,
          durationMs,
          response.ok ? undefined : String(responseData)
        );
      }

      // Handle errors
      if (!response.ok) {
        const errorResponse = responseData as { error?: { code?: string; message?: string }; message?: string };
        const errorCode = (errorResponse.error?.code || 'INTERNAL_ERROR') as VmiErrorCode;
        const errorMessage = errorResponse.error?.message || errorResponse.message || 'Unknown error';

        throw new VmiPortalError(errorCode, errorMessage, response.status);
      }

      return responseData as T;
    } catch (err) {
      if (err instanceof VmiPortalError) {
        throw err;
      }

      // Network or other errors
      const durationMs = Date.now() - startTime;
      error = err instanceof Error ? err.message : 'Unknown error';

      if (this.transactionLogger && transactionType) {
        await this.transactionLogger.log(
          this.vendorId,
          transactionType,
          path,
          method,
          body,
          null,
          0,
          durationMs,
          error
        );
      }

      throw new VmiPortalError('INTERNAL_ERROR', `Network error: ${error}`, 500);
    }
  }

  // ============================================
  // Connection Test
  // ============================================

  /**
   * Test connection to VMI Portal
   */
  async testConnection(): Promise<boolean> {
    try {
      // Use a simple GET request to test connectivity
      // The exact endpoint depends on VMI Portal API - using a health check or items endpoint
      await this.request<{ success: boolean }>('GET', '/health', undefined, 'connection_test');
      return true;
    } catch (err) {
      if (err instanceof VmiPortalError) {
        // If we get an auth error, the connection works but credentials are wrong
        if (err.code === 'UNAUTHORIZED' || err.code === 'API_KEY_EXPIRED' || err.code === 'API_KEY_REVOKED') {
          throw err;
        }
      }
      return false;
    }
  }

  // ============================================
  // Item Sync
  // ============================================

  /**
   * Sync items to VMI Portal
   */
  async syncItems(items: VmiItem[]): Promise<VmiSyncResult> {
    return this.request<VmiSyncResult>('POST', '/items', { items }, 'item_sync');
  }

  // ============================================
  // Price Sync
  // ============================================

  /**
   * Sync price offers to VMI Portal
   */
  async syncPrices(offers: VmiPriceOfferPayload[]): Promise<VmiSyncResult> {
    return this.request<VmiSyncResult>('POST', '/prices', { offers }, 'price_sync');
  }

  // ============================================
  // Inventory Sync
  // ============================================

  /**
   * Sync inventory to VMI Portal
   */
  async syncInventory(inventory: VmiInventoryItem[]): Promise<VmiSyncResult> {
    return this.request<VmiSyncResult>('POST', '/inventory', { inventory }, 'inventory_sync');
  }

  // ============================================
  // Order Management
  // ============================================

  /**
   * Get orders from VMI Portal
   */
  async getOrders(params?: VmiOrderQuery): Promise<VmiOrderListResponse> {
    const searchParams = new URLSearchParams();
    if (params) {
      if (params.status) searchParams.set('status', params.status);
      if (params.orderDateFrom) searchParams.set('orderDateFrom', params.orderDateFrom);
      if (params.orderDateTo) searchParams.set('orderDateTo', params.orderDateTo);
      if (params.page) searchParams.set('page', String(params.page));
      if (params.pageSize) searchParams.set('pageSize', String(params.pageSize));
    }

    const query = searchParams.toString();
    const path = query ? `/orders?${query}` : '/orders';

    return this.request<VmiOrderListResponse>('GET', path, undefined, 'order_poll');
  }

  /**
   * Get order detail from VMI Portal
   */
  async getOrderDetail(orderId: number): Promise<VmiOrderDetailResponse> {
    return this.request<VmiOrderDetailResponse>('GET', `/orders/${orderId}`, undefined, 'order_poll');
  }

  /**
   * Confirm an order
   */
  async confirmOrder(orderId: number): Promise<VmiOrderActionResult> {
    return this.request<VmiOrderActionResult>(
      'PATCH',
      `/orders/${orderId}`,
      { action: 'confirm' },
      'order_confirm'
    );
  }

  /**
   * Ship an order
   */
  async shipOrder(orderId: number, expectedDeliveryDate: string): Promise<VmiOrderActionResult> {
    return this.request<VmiOrderActionResult>(
      'PATCH',
      `/orders/${orderId}`,
      { action: 'ship', expectedDeliveryDate },
      'order_ship'
    );
  }

  /**
   * Get receipt status for an order
   */
  async getReceiptStatus(orderId: number): Promise<VmiReceiptStatus> {
    return this.request<VmiReceiptStatus>('GET', `/orders/${orderId}/receipt-status`, undefined, 'receipt_check');
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Map VMI error code to HTTP status code
 */
export function getHttpStatusForVmiError(code: VmiErrorCode): number {
  const statusMap: Record<VmiErrorCode, number> = {
    UNAUTHORIZED: 401,
    API_KEY_EXPIRED: 401,
    API_KEY_REVOKED: 401,
    VALIDATION_ERROR: 400,
    ORDER_NOT_FOUND: 404,
    INVALID_STATUS_TRANSITION: 409,
    INTERNAL_ERROR: 500,
  };
  return statusMap[code] || 500;
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: VmiPortalError): boolean {
  // Only retry on server errors, not client errors
  return error.httpStatus >= 500;
}
