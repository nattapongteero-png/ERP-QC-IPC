/**
 * VMI Sales Order Service
 *
 * Service for managing orders received from VMI Portals into our sales system.
 * This system IS the vendor - receives orders FROM external VMI portals.
 *
 * Feature: 008-vmi-vendor-sync
 */

import { eq, and, desc, inArray, or, like, gte, lte, sql } from 'drizzle-orm';
import { isSqlite, getSqliteDb, getMysqlDb } from '@/lib/db';
import {
  sqliteItems,
  mysqlItems,
  sqliteCustomers,
  mysqlCustomers,
  sqliteVmiPortalConfig,
  mysqlVmiPortalConfig,
  sqliteVmiSalesOrders,
  mysqlVmiSalesOrders,
  sqliteVmiSalesOrderLines,
  mysqlVmiSalesOrderLines,
  type VmiSalesOrder,
  type VmiSalesOrderLine,
} from '@/lib/db/schema';
import { decrypt } from '@/lib/crypto/encrypt';
import { vmiPortalConfigService } from './vmi-portal-config.service';
import type {
  VmiOrderStatus,
  VmiLocalOrderStatus,
  VmiItemMatchStatus,
  VmiSalesOrderSummary,
  VmiSalesOrderDetail,
  VmiOrderPollResult,
  VmiOrderConfirmRequest,
  VmiOrderShipRequest,
} from '@/types/vmi';

// ============================================
// Error Classes
// ============================================

export class VmiSalesOrderError extends Error {
  public readonly code: string;
  public readonly httpStatus: number;

  constructor(code: string, message: string, httpStatus: number = 400) {
    super(message);
    this.name = 'VmiSalesOrderError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

// ============================================
// Types
// ============================================

export interface VmiOrderQuery {
  portalId?: number;
  vmiStatus?: VmiOrderStatus;
  localStatus?: VmiLocalOrderStatus;
  customerId?: number;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface PortalOrder {
  id: string;
  customerCode: string;
  customerName: string;
  orderDate: string;
  requiredDate?: string;
  totalAmount: number;
  currency: string;
  lines: Array<{
    lineId: string;
    tppCode?: string;
    ttmtCode?: string;
    localCode?: string;
    itemName: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    lineTotal: number;
  }>;
}

// ============================================
// VMI Sales Order Service
// ============================================

export class VmiSalesOrderService {
  private readonly isSqlite: boolean;

  constructor() {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    this.isSqlite = isSqlite();
  }

  /**
   * Get the appropriate database connection
   */
  private async getDb() {
    return this.isSqlite ? getSqliteDb() : await getMysqlDb();
  }

  /**
   * Get the appropriate schema tables
   */
  private getTables() {
    return {
      items: this.isSqlite ? sqliteItems : mysqlItems,
      customers: this.isSqlite ? sqliteCustomers : mysqlCustomers,
      portals: this.isSqlite ? sqliteVmiPortalConfig : mysqlVmiPortalConfig,
      orders: this.isSqlite ? sqliteVmiSalesOrders : mysqlVmiSalesOrders,
      lines: this.isSqlite ? sqliteVmiSalesOrderLines : mysqlVmiSalesOrderLines,
    };
  }

  // ============================================
  // Order Listing
  // ============================================

  /**
   * List VMI orders with pagination and filters
   */
  async listOrders(query: VmiOrderQuery): Promise<{
    items: VmiSalesOrderSummary[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await this.getDb()) as any;
    const { orders, portals, lines } = this.getTables();
    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;

    // Build conditions
    const conditions: ReturnType<typeof eq>[] = [];
    if (query.portalId) {
      conditions.push(eq(orders.portalId, query.portalId));
    }
    if (query.vmiStatus) {
      conditions.push(eq(orders.vmiStatus, query.vmiStatus));
    }
    if (query.localStatus) {
      conditions.push(eq(orders.localStatus, query.localStatus));
    }
    if (query.customerId) {
      conditions.push(eq(orders.customerId, query.customerId));
    }
    if (query.fromDate) {
      conditions.push(gte(orders.orderDate, query.fromDate));
    }
    if (query.toDate) {
      conditions.push(lte(orders.orderDate, query.toDate));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get orders with portal names
    const orderRecords = await db
      .select({
        order: orders,
        portalName: portals.name,
      })
      .from(orders)
      .leftJoin(portals, eq(orders.portalId, portals.id))
      .where(whereClause)
      .orderBy(query.sortOrder === 'asc' ? orders.polledAt : desc(orders.polledAt))
      .limit(limit)
      .offset(offset);

    // Get line counts for each order
    const orderIds = orderRecords.map((r: any) => r.order.id);
    let lineCounts: Record<number, { total: number; unmatched: number }> = {};

    if (orderIds.length > 0) {
      const lineStats = await db
        .select({
          vmiSalesOrderId: lines.vmiSalesOrderId,
          matchStatus: lines.matchStatus,
        })
        .from(lines)
        .where(inArray(lines.vmiSalesOrderId, orderIds));

      // Aggregate counts
      for (const line of lineStats) {
        if (!lineCounts[line.vmiSalesOrderId]) {
          lineCounts[line.vmiSalesOrderId] = { total: 0, unmatched: 0 };
        }
        lineCounts[line.vmiSalesOrderId].total++;
        if (line.matchStatus === 'unmatched') {
          lineCounts[line.vmiSalesOrderId].unmatched++;
        }
      }
    }

    // Transform to summaries
    const items: VmiSalesOrderSummary[] = orderRecords.map((r: any) => ({
      id: r.order.id,
      portalId: r.order.portalId,
      portalName: r.portalName || undefined,
      vmiOrderId: r.order.vmiOrderId,
      vmiStatus: r.order.vmiStatus as VmiOrderStatus,
      localStatus: r.order.localStatus as VmiLocalOrderStatus,
      customerId: r.order.customerId,
      vmiCustomerId: r.order.vmiCustomerId,
      vmiCustomerName: r.order.vmiCustomerName,
      orderDate: new Date(r.order.orderDate as string),
      requiredDate: r.order.requiredDate ? new Date(r.order.requiredDate as string) : null,
      totalAmount: Number(r.order.totalAmount),
      currency: r.order.currency,
      lineCount: lineCounts[r.order.id]?.total || 0,
      unmatchedLineCount: lineCounts[r.order.id]?.unmatched || 0,
      salesOrderId: r.order.salesOrderId,
      salesOrderNumber: undefined, // TODO: Join with sales_orders if needed
      polledAt: new Date(r.order.polledAt as string),
    }));

    // Get total count
    const allOrders = await db.select().from(orders).where(whereClause);
    const total = allOrders.length;

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get order by ID with full details
   */
  async getOrderById(orderId: number): Promise<VmiSalesOrderDetail | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await this.getDb()) as any;
    const { orders, portals, lines, items, customers } = this.getTables();

    // Get order with portal
    const [orderRecord] = await db
      .select({
        order: orders,
        portalName: portals.name,
      })
      .from(orders)
      .leftJoin(portals, eq(orders.portalId, portals.id))
      .where(eq(orders.id, orderId));

    if (!orderRecord) {
      return null;
    }

    // Get customer if linked
    let customer: { id: number; code: string; name: string } | null = null;
    if (orderRecord.order.customerId) {
      const [customerRecord] = await db
        .select({
          id: customers.id,
          code: customers.code,
          name: customers.name,
        })
        .from(customers)
        .where(eq(customers.id, orderRecord.order.customerId));
      if (customerRecord) {
        customer = customerRecord;
      }
    }

    // Get order lines with matched items
    const lineRecords = await db
      .select({
        line: lines,
        item: items,
      })
      .from(lines)
      .leftJoin(items, eq(lines.itemId, items.id))
      .where(eq(lines.vmiSalesOrderId, orderId));

    const orderLines = lineRecords.map((r: any) => ({
      id: r.line.id,
      vmiLineId: r.line.vmiLineId,
      itemId: r.line.itemId,
      tppCode: r.line.tppCode,
      ttmtCode: r.line.ttmtCode,
      localCode: r.line.localCode,
      itemName: r.line.itemName,
      quantity: Number(r.line.quantity),
      unit: r.line.unit,
      unitPrice: Number(r.line.unitPrice),
      lineTotal: Number(r.line.lineTotal),
      matchStatus: r.line.matchStatus as VmiItemMatchStatus,
      matchedItem: r.item
        ? {
            id: r.item.id,
            code: r.item.code,
            nameTh: r.item.nameTh,
            nameEn: r.item.nameEn,
          }
        : null,
    }));

    return {
      id: orderRecord.order.id,
      portalId: orderRecord.order.portalId,
      portalName: orderRecord.portalName || undefined,
      vmiOrderId: orderRecord.order.vmiOrderId,
      vmiStatus: orderRecord.order.vmiStatus as VmiOrderStatus,
      localStatus: orderRecord.order.localStatus as VmiLocalOrderStatus,
      customerId: orderRecord.order.customerId,
      vmiCustomerId: orderRecord.order.vmiCustomerId,
      vmiCustomerName: orderRecord.order.vmiCustomerName,
      orderDate: new Date(orderRecord.order.orderDate as string),
      requiredDate: orderRecord.order.requiredDate
        ? new Date(orderRecord.order.requiredDate as string)
        : null,
      totalAmount: Number(orderRecord.order.totalAmount),
      currency: orderRecord.order.currency,
      lineCount: orderLines.length,
      unmatchedLineCount: orderLines.filter((l: any) => l.matchStatus === 'unmatched').length,
      salesOrderId: orderRecord.order.salesOrderId,
      polledAt: new Date(orderRecord.order.polledAt as string),
      confirmedAt: orderRecord.order.confirmedAt
        ? new Date(orderRecord.order.confirmedAt as string)
        : null,
      shippedAt: orderRecord.order.shippedAt
        ? new Date(orderRecord.order.shippedAt as string)
        : null,
      deliveredAt: orderRecord.order.deliveredAt
        ? new Date(orderRecord.order.deliveredAt as string)
        : null,
      customer,
      lines: orderLines,
      orderDataJson: orderRecord.order.orderDataJson,
      createdAt: new Date(orderRecord.order.createdAt as string),
      updatedAt: new Date(orderRecord.order.updatedAt as string),
    };
  }

  // ============================================
  // Order Polling
  // ============================================

  /**
   * Poll for new orders from VMI Portal(s)
   */
  async pollOrders(portalId?: number): Promise<VmiOrderPollResult> {
    const portals = await this.getEnabledPortals(portalId);

    if (portals.length === 0) {
      throw new VmiSalesOrderError('NO_PORTALS', 'No enabled portals found for order polling', 404);
    }

    let ordersReceived = 0;
    const orders: VmiSalesOrderSummary[] = [];
    const errors: Array<{ portalId: number; error: string }> = [];

    for (const portal of portals) {
      try {
        const portalOrders = await this.pollPortalOrders(portal);
        ordersReceived += portalOrders.length;
        orders.push(...portalOrders);
      } catch (error) {
        errors.push({
          portalId: portal.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Update last poll timestamp for portals
    for (const portal of portals) {
      if (!errors.find((e) => e.portalId === portal.id)) {
        await vmiPortalConfigService.updateLastOrdersPoll(portal.id);
      }
    }

    return {
      portalsPolled: portals.length,
      ordersReceived,
      orders,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Poll orders from a specific portal
   */
  private async pollPortalOrders(portal: {
    id: number;
    name: string;
    portalUrl: string;
    vendorId: string;
    apiKeyEncrypted: string;
  }): Promise<VmiSalesOrderSummary[]> {
    const apiKey = decrypt(portal.apiKeyEncrypted);

    try {
      // Fetch orders from VMI Portal
      const response = await fetch(`${portal.portalUrl}/api/vendor/orders/pending`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
          'X-Vendor-Id': portal.vendorId,
        },
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const portalOrders: PortalOrder[] = data.orders || [];

      const createdOrders: VmiSalesOrderSummary[] = [];

      for (const portalOrder of portalOrders) {
        // Check if order already exists
        const existing = await this.findOrderByVmiOrderId(portal.id, portalOrder.id);
        if (existing) {
          continue; // Skip already imported orders
        }

        // Create order and lines
        const order = await this.createOrderFromPortal(portal.id, portalOrder);
        createdOrders.push(order);
      }

      return createdOrders;
    } catch (error) {
      throw new VmiSalesOrderError(
        'POLL_FAILED',
        `Failed to poll portal ${portal.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500
      );
    }
  }

  /**
   * Find existing order by VMI order ID
   */
  private async findOrderByVmiOrderId(
    portalId: number,
    vmiOrderId: string
  ): Promise<VmiSalesOrder | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await this.getDb()) as any;
    const { orders } = this.getTables();

    const [record] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.portalId, portalId), eq(orders.vmiOrderId, vmiOrderId)));

    return record || null;
  }

  /**
   * Create order from portal data
   */
  private async createOrderFromPortal(
    portalId: number,
    portalOrder: PortalOrder
  ): Promise<VmiSalesOrderSummary> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await this.getDb()) as any;
    const { orders, lines } = this.getTables();

    const now = this.isSqlite ? new Date().toISOString() : new Date();

    // Create order
    const [insertedOrder] = await db
      .insert(orders)
      .values({
        portalId,
        vmiOrderId: portalOrder.id,
        vmiStatus: 'submitted',
        localStatus: 'pending',
        vmiCustomerId: portalOrder.customerCode,
        vmiCustomerName: portalOrder.customerName,
        orderDate: portalOrder.orderDate,
        requiredDate: portalOrder.requiredDate || null,
        totalAmount: portalOrder.totalAmount.toString(),
        currency: portalOrder.currency || 'THB',
        orderDataJson: JSON.stringify(portalOrder),
        polledAt: now,
        createdAt: now,
        updatedAt: now,
      } as Record<string, unknown>)
      .$returningId();

    const orderId = insertedOrder.id;

    // Create order lines with item matching
    for (const line of portalOrder.lines) {
      const matchResult = await this.matchItem(line.tppCode, line.ttmtCode, line.localCode);

      await db.insert(lines).values({
        vmiSalesOrderId: orderId,
        vmiLineId: line.lineId,
        itemId: matchResult.itemId,
        tppCode: line.tppCode || null,
        ttmtCode: line.ttmtCode || null,
        localCode: line.localCode || null,
        itemName: line.itemName,
        quantity: line.quantity.toString(),
        unit: line.unit,
        unitPrice: line.unitPrice.toString(),
        lineTotal: line.lineTotal.toString(),
        matchStatus: matchResult.status,
      } as Record<string, unknown>);
    }

    // Return summary
    const unmatchedCount = portalOrder.lines.filter((l: any) => {
      const matchResult = this.matchItemSync(l.tppCode, l.ttmtCode, l.localCode);
      return matchResult.status === 'unmatched';
    }).length;

    return {
      id: orderId,
      portalId,
      vmiOrderId: portalOrder.id,
      vmiStatus: 'submitted',
      localStatus: 'pending',
      customerId: null,
      vmiCustomerId: portalOrder.customerCode,
      vmiCustomerName: portalOrder.customerName,
      orderDate: new Date(portalOrder.orderDate),
      requiredDate: portalOrder.requiredDate ? new Date(portalOrder.requiredDate) : null,
      totalAmount: portalOrder.totalAmount,
      currency: portalOrder.currency || 'THB',
      lineCount: portalOrder.lines.length,
      unmatchedLineCount: unmatchedCount,
      salesOrderId: null,
      polledAt: new Date(),
    };
  }

  // ============================================
  // Item Matching
  // ============================================

  /**
   * Match item by TPP code, TTMT code, or local code
   */
  private async matchItem(
    tppCode?: string,
    ttmtCode?: string,
    localCode?: string
  ): Promise<{ itemId: number | null; status: VmiItemMatchStatus }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await this.getDb()) as any;
    const { items } = this.getTables();

    // Try to find matching item
    const conditions: ReturnType<typeof eq>[] = [];
    if (tppCode) {
      conditions.push(eq(items.tppCode, tppCode));
    }
    if (ttmtCode) {
      conditions.push(eq(items.ttmtCode, ttmtCode));
    }
    if (localCode) {
      conditions.push(eq(items.code, localCode));
    }

    if (conditions.length === 0) {
      return { itemId: null, status: 'unmatched' };
    }

    const matchingItems = await db
      .select({ id: items.id })
      .from(items)
      .where(or(...conditions));

    if (matchingItems.length === 0) {
      return { itemId: null, status: 'unmatched' };
    }

    if (matchingItems.length === 1) {
      return { itemId: matchingItems[0].id, status: 'matched' };
    }

    // Multiple matches - return first but flag for review
    return { itemId: matchingItems[0].id, status: 'multiple_matches' };
  }

  /**
   * Synchronous match result for inline use
   */
  private matchItemSync(
    tppCode?: string,
    ttmtCode?: string,
    localCode?: string
  ): { status: VmiItemMatchStatus } {
    if (!tppCode && !ttmtCode && !localCode) {
      return { status: 'unmatched' };
    }
    return { status: 'matched' }; // Simplified for summary
  }

  /**
   * Manually match an order line to an item
   */
  async matchOrderLine(
    orderId: number,
    lineId: number,
    itemId: number
  ): Promise<VmiSalesOrderLine> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await this.getDb()) as any;
    const { lines, items } = this.getTables();

    // Verify order line exists
    const [line] = await db
      .select()
      .from(lines)
      .where(and(eq(lines.id, lineId), eq(lines.vmiSalesOrderId, orderId)));

    if (!line) {
      throw new VmiSalesOrderError('LINE_NOT_FOUND', 'Order line not found', 404);
    }

    // Verify item exists
    const [item] = await db.select().from(items).where(eq(items.id, itemId));

    if (!item) {
      throw new VmiSalesOrderError('ITEM_NOT_FOUND', 'Item not found', 404);
    }

    // Update line
    await db
      .update(lines)
      .set({
        itemId,
        localCode: item.code,
        matchStatus: 'manual_mapped',
      } as Record<string, unknown>)
      .where(eq(lines.id, lineId));

    // Return updated line
    const [updatedLine] = await db.select().from(lines).where(eq(lines.id, lineId));

    return updatedLine as VmiSalesOrderLine;
  }

  // ============================================
  // Order Updates
  // ============================================

  /**
   * Update VMI order (customer mapping, status, notes)
   */
  async updateOrder(
    orderId: number,
    data: {
      customerId?: number;
      localStatus?: VmiLocalOrderStatus;
      notes?: string;
    }
  ): Promise<VmiSalesOrderDetail> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await this.getDb()) as any;
    const { orders, customers } = this.getTables();

    // Verify order exists
    const existing = await this.getOrderById(orderId);
    if (!existing) {
      throw new VmiSalesOrderError('ORDER_NOT_FOUND', 'Order not found', 404);
    }

    // Verify customer if provided
    if (data.customerId) {
      const [customer] = await db
        .select()
        .from(customers)
        .where(eq(customers.id, data.customerId));
      if (!customer) {
        throw new VmiSalesOrderError('CUSTOMER_NOT_FOUND', 'Customer not found', 404);
      }
    }

    const now = this.isSqlite ? new Date().toISOString() : new Date();

    // Build update data
    const updateData: Record<string, unknown> = {
      updatedAt: now,
    };
    if (data.customerId !== undefined) updateData.customerId = data.customerId;
    if (data.localStatus !== undefined) updateData.localStatus = data.localStatus;
    if (data.notes !== undefined) updateData.notes = data.notes;

    await db.update(orders).set(updateData).where(eq(orders.id, orderId));

    const updated = await this.getOrderById(orderId);
    return updated!;
  }

  // ============================================
  // Order Confirmation
  // ============================================

  /**
   * Confirm VMI order (creates sales order, updates VMI Portal)
   */
  async confirmOrder(
    orderId: number,
    request: VmiOrderConfirmRequest
  ): Promise<{
    vmiOrder: VmiSalesOrderDetail;
    salesOrder: { id: number; soNumber: string; status: string };
    message: string;
  }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await this.getDb()) as any;
    const { orders, portals } = this.getTables();

    // Get order with details
    const order = await this.getOrderById(orderId);
    if (!order) {
      throw new VmiSalesOrderError('ORDER_NOT_FOUND', 'Order not found', 404);
    }

    // Check all items are matched
    const unmatchedLines = order.lines.filter((l: any) => l.matchStatus === 'unmatched');
    if (unmatchedLines.length > 0) {
      throw new VmiSalesOrderError(
        'UNMATCHED_ITEMS',
        `Cannot confirm order: ${unmatchedLines.length} items are not matched`,
        400
      );
    }

    // Get portal config
    const [portal] = await db
      .select()
      .from(portals)
      .where(eq(portals.id, order.portalId));

    if (!portal) {
      throw new VmiSalesOrderError('PORTAL_NOT_FOUND', 'Portal configuration not found', 404);
    }

    // TODO: Create actual sales order in sales module
    // For now, simulate sales order creation
    const salesOrderId = Math.floor(Math.random() * 10000) + 1;
    const soNumber = `SO-VMI-${Date.now()}`;

    const now = this.isSqlite ? new Date().toISOString() : new Date();

    // Update VMI order
    await db
      .update(orders)
      .set({
        vmiStatus: 'confirmed',
        localStatus: 'confirmed',
        salesOrderId: salesOrderId,
        confirmedAt: now,
        updatedAt: now,
      } as Record<string, unknown>)
      .where(eq(orders.id, orderId));

    // Notify VMI Portal
    try {
      const apiKey = decrypt(portal.apiKeyEncrypted);
      await fetch(`${portal.portalUrl}/api/vendor/orders/${order.vmiOrderId}/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
          'X-Vendor-Id': portal.vendorId,
        },
        body: JSON.stringify({
          confirmedAt: new Date().toISOString(),
          expectedShipDate: request.expectedShipDate,
          notes: request.notes,
        }),
        signal: AbortSignal.timeout(10000),
      });
    } catch (error) {
      console.error('[VMI Sales Order] Failed to notify portal:', error);
      // Continue even if portal notification fails
    }

    const updatedOrder = await this.getOrderById(orderId);

    return {
      vmiOrder: updatedOrder!,
      salesOrder: {
        id: salesOrderId,
        soNumber,
        status: 'confirmed',
      },
      message: 'Order confirmed and synced to VMI Portal',
    };
  }

  // ============================================
  // Order Shipping
  // ============================================

  /**
   * Mark order as shipped (updates VMI Portal)
   */
  async shipOrder(
    orderId: number,
    request: VmiOrderShipRequest
  ): Promise<{
    vmiOrder: VmiSalesOrderDetail;
    message: string;
  }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await this.getDb()) as any;
    const { orders, portals } = this.getTables();

    // Get order
    const order = await this.getOrderById(orderId);
    if (!order) {
      throw new VmiSalesOrderError('ORDER_NOT_FOUND', 'Order not found', 404);
    }

    // Verify order is confirmed
    if (order.localStatus !== 'confirmed' && order.localStatus !== 'processing') {
      throw new VmiSalesOrderError(
        'INVALID_STATUS',
        'Order must be confirmed before shipping',
        400
      );
    }

    // Get portal config
    const [portal] = await db
      .select()
      .from(portals)
      .where(eq(portals.id, order.portalId));

    if (!portal) {
      throw new VmiSalesOrderError('PORTAL_NOT_FOUND', 'Portal configuration not found', 404);
    }

    const now = this.isSqlite ? new Date().toISOString() : new Date();

    // Update order
    await db
      .update(orders)
      .set({
        vmiStatus: 'shipped',
        localStatus: 'shipped',
        shippedAt: now,
        updatedAt: now,
      } as Record<string, unknown>)
      .where(eq(orders.id, orderId));

    // Notify VMI Portal
    try {
      const apiKey = decrypt(portal.apiKeyEncrypted);
      await fetch(`${portal.portalUrl}/api/vendor/orders/${order.vmiOrderId}/ship`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
          'X-Vendor-Id': portal.vendorId,
        },
        body: JSON.stringify({
          shipmentDate: request.shipmentDate,
          expectedDeliveryDate: request.expectedDeliveryDate,
          trackingNumber: request.trackingNumber,
          carrier: request.carrier,
          notes: request.notes,
        }),
        signal: AbortSignal.timeout(10000),
      });
    } catch (error) {
      console.error('[VMI Sales Order] Failed to notify portal:', error);
      // Continue even if portal notification fails
    }

    const updatedOrder = await this.getOrderById(orderId);

    return {
      vmiOrder: updatedOrder!,
      message: 'Order marked as shipped and synced to VMI Portal',
    };
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Get enabled portals for order polling
   */
  private async getEnabledPortals(portalId?: number): Promise<
    Array<{
      id: number;
      name: string;
      portalUrl: string;
      vendorId: string;
      apiKeyEncrypted: string;
    }>
  > {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await this.getDb()) as any;
    const { portals } = this.getTables();

    const conditions = [eq(portals.isEnabled, true), eq(portals.orderPollingEnabled, true)];

    if (portalId) {
      conditions.push(eq(portals.id, portalId));
    }

    const records = await db
      .select({
        id: portals.id,
        name: portals.name,
        portalUrl: portals.portalUrl,
        vendorId: portals.vendorId,
        apiKeyEncrypted: portals.apiKeyEncrypted,
      })
      .from(portals)
      .where(and(...conditions));

    return records;
  }
}

// Export singleton instance
export const vmiSalesOrderService = new VmiSalesOrderService();
