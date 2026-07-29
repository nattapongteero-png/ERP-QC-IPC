/**
 * VMI Sales Order Service
 *
 * Service for managing orders received from VMI Portals into our sales system.
 * This system IS the vendor - receives orders FROM external VMI portals.
 *
 * Feature: 008-vmi-vendor-sync
 */

import { eq, and, desc, inArray, or, gte, lte } from 'drizzle-orm';
import { isSqlite, getSqliteDb, getMysqlDb } from '@/lib/db';
import { getNow, toDbDate, toQueryDate } from '@/lib/db/date-utils';
import { createSalesOrderFromVmi } from './sales.service';
import { ensureVmiCustomerWithDb } from './vmi-customer-sync.service';
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
import { createAuditLog } from '@/lib/audit';
import { vmiPortalConfigService } from './vmi-portal-config.service';
import { VmiPortalService, VmiPortalError } from './vmi-portal.service';
import type {
  VmiOrderStatus,
  VmiLocalOrderStatus,
  VmiItemMatchStatus,
  VmiSalesOrderSummary,
  VmiSalesOrderDetail,
  VmiOrderPollResult,
  VmiOrderConfirmRequest,
  VmiOrderShipRequest,
  VmiCancelReasonCode,
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

/** Summary from GET /api/external/vendor/orders?status=submitted */
interface PortalOrderSummary {
  id: number;
  hospitalCode: string;
  hospitalName: string;
  poNumber: string;
  status: string;
  orderDate: string;
  expectedDeliveryDate: string | null;
  totalValue: string;
  itemCount: number;
}

/** Detail from GET /api/external/vendor/orders/{id} */
interface PortalOrderDetail {
  id: number;
  hospitalCode: string;
  hospitalName: string;
  poNumber: string;
  status: string;
  orderDate: string;
  expectedDeliveryDate: string | null;
  totalValue: string;
  itemCount: number;
  warehouseName?: string;
  notes?: string;
  items: Array<{
    id: number;
    localCode: string;
    name: string;
    unit: string;
    tppCode: string | null;
    ttmtCode: string | null;
    quantityOrdered: string;
    unitPrice: string;
    lineTotal: string;
  }>;
}

/**
 * PATCH an order action to the VMI Portal and report honestly whether it
 * landed.
 *
 * The point of this helper is the `response.ok` check. `fetch` only rejects on
 * a network-level failure, so an HTTP 401/404/500 resolves like a success —
 * awaiting it inside a try/catch (which is what confirm and ship used to do)
 * silently treats a rejected call as done. UAT's portal answers
 * 401 {"code":"UNAUTHORIZED"} to exactly these calls, and nothing was ever
 * logged or surfaced.
 *
 * Never throws: the local transaction is already committed by the time this
 * runs, so the caller decides what to tell the user.
 */
async function notifyPortal(
  portal: { portalUrl: string; apiKeyEncrypted: string },
  vmiOrderId: string | number,
  body: Record<string, unknown>,
  action: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const apiKey = decrypt(portal.apiKeyEncrypted);
    const response = await fetch(
      `${portal.portalUrl}/api/external/vendor/orders/${vmiOrderId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      },
    );

    if (!response.ok) {
      // Portal errors are a flat { code, message } envelope.
      let detail = `HTTP ${response.status}`;
      try {
        const payload = await response.json();
        if (payload?.message) detail = `${payload.code || response.status}: ${payload.message}`;
      } catch {
        // Non-JSON body — the status alone is the best we have.
      }
      console.error(`[VMI Sales Order] Portal rejected "${action}" for order ${vmiOrderId}: ${detail}`);
      return { ok: false, error: detail };
    }

    return { ok: true };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`[VMI Sales Order] Could not reach portal for "${action}" on order ${vmiOrderId}: ${detail}`);
    return { ok: false, error: detail };
  }
}

// ============================================
// VMI Sales Order Service
// ============================================

export class VmiSalesOrderService {
  // Bug L2: use getter instead of caching isSqlite at construction time
  private get isSqliteDb(): boolean {
    return isSqlite();
  }

  /**
   * Get the appropriate database connection
   */
  private async getDb() {
    return this.isSqliteDb ? getSqliteDb() : await getMysqlDb();
  }

  /**
   * Get the appropriate schema tables
   */
  private getTables() {
    return {
      items: this.isSqliteDb ? sqliteItems : mysqlItems,
      customers: this.isSqliteDb ? sqliteCustomers : mysqlCustomers,
      portals: this.isSqliteDb ? sqliteVmiPortalConfig : mysqlVmiPortalConfig,
      orders: this.isSqliteDb ? sqliteVmiSalesOrders : mysqlVmiSalesOrders,
      lines: this.isSqliteDb ? sqliteVmiSalesOrderLines : mysqlVmiSalesOrderLines,
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
      conditions.push(gte(orders.orderDate, toQueryDate(query.fromDate)));
    }
    if (query.toDate) {
      conditions.push(lte(orders.orderDate, toQueryDate(query.toDate)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // INNER join, not LEFT: rows whose portal config was deleted are orphans —
    // they can never be polled, cancelled or synced again because every one of
    // those paths needs the portal's URL and API key. Listing them only invited
    // operators to act on records the system cannot honour (UAT had 6 such rows
    // duplicating live orders under an old portal id). The rows stay in the
    // database — their linked sales orders and AR invoices are real — they are
    // simply not offered as actionable VMI orders.
    const orderRecords = await db
      .select({
        order: orders,
        portalName: portals.name,
      })
      .from(orders)
      .innerJoin(portals, eq(orders.portalId, portals.id))
      .where(whereClause)
      .orderBy(query.sortOrder === 'asc' ? orders.polledAt : desc(orders.polledAt))
      .limit(limit)
      .offset(offset);

    // Get line counts for each order
    const orderIds = orderRecords.map((r: any) => r.order.id);
    const lineCounts: Record<number, { total: number; unmatched: number }> = {};

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
        // `multiple_matches` counts as NOT matched. Auto-matching stores the
        // first candidate's itemId but flags the line for review, so the row
        // looks linked while a human still has to pick the right item. Counting
        // it as matched made the list show "1/1 100%" on an order that
        // confirmOrder would happily accept with a possibly wrong item.
        if (line.matchStatus === 'unmatched' || line.matchStatus === 'multiple_matches') {
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

    // Count with the SAME inner join as the page query — otherwise the total
    // counts orphaned rows the list will never show, and the pager advertises
    // pages that come back empty.
    const allOrders = await db
      .select({ id: orders.id })
      .from(orders)
      .innerJoin(portals, eq(orders.portalId, portals.id))
      .where(whereClause);
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
      // Same rule as listOrders: a line flagged `multiple_matches` still needs
      // a human to choose, so it is not "matched".
      unmatchedLineCount: orderLines.filter(
        (l: any) => l.matchStatus === 'unmatched' || l.matchStatus === 'multiple_matches',
      ).length,
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
      rejectedAt: orderRecord.order.rejectedAt
        ? new Date(orderRecord.order.rejectedAt as string)
        : null,
      rejectionReason: orderRecord.order.rejectionReason ?? null,
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
      // No enabled portals - return empty result without error
      return {
        portalsPolled: 0,
        ordersReceived: 0,
        orders: [],
        errors: [],
      };
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
      const response = await fetch(`${portal.portalUrl}/api/external/vendor/orders?status=submitted`, {
        method: 'GET',
        headers: {
          'X-API-Key': apiKey,
        },
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const orderSummaries: PortalOrderSummary[] = data.orders || [];

      const createdOrders: VmiSalesOrderSummary[] = [];

      // Reconcile statuses the portal changed behind our back (cancelled by the
      // hospital, or cancelled from another client). Polling only asks for
      // `submitted`, so those orders silently drop out of the feed and our row
      // would keep its stale status forever — the divergence users actually
      // hit. Do this BEFORE importing so a status fix never depends on new
      // orders existing.
      await this.reconcileStatusesFromPortal(portal, apiKey);

      for (const summary of orderSummaries) {
        // Check if order already exists.
        //
        // Scoped by portal id AND by portal URL + vendor: deleting a portal
        // config and re-adding it mints a new id, and a portal-id-only check
        // then re-imports every order under that new id. UAT ended up with the
        // same PO stored twice — once per portal id — with the two copies
        // drifting to different statuses. Same portal address means same order,
        // whatever row id the config happens to have now.
        const existing = await this.findExistingPortalOrder(
          portal.id,
          portal.portalUrl,
          portal.vendorId,
          String(summary.id),
        );
        if (existing) {
          continue; // Skip already imported orders
        }

        // Fetch order detail to get line items
        const detailResponse = await fetch(
          `${portal.portalUrl}/api/external/vendor/orders/${summary.id}`,
          {
            method: 'GET',
            headers: { 'X-API-Key': apiKey },
            signal: AbortSignal.timeout(30000),
          }
        );

        if (!detailResponse.ok) {
          console.error(`[VMI Poll] Failed to fetch detail for order ${summary.id}: HTTP ${detailResponse.status}`);
          continue;
        }

        const detailData = await detailResponse.json();
        const orderDetail: PortalOrderDetail = detailData.order;

        // Create order and lines
        const order = await this.createOrderFromPortal(portal.id, orderDetail);
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
   * Pull the portal's authoritative status for orders we already hold and fix
   * any that drifted.
   *
   * Why this is needed: `pollPortalOrders` only asks the portal for
   * `status=submitted`, so an order cancelled on the portal simply vanishes
   * from the feed and our row keeps whatever status it had — which is how UAT
   * ended up with 11 of 14 rows disagreeing with the portal.
   *
   * Deliberately conservative:
   * - Only ever moves a local row TO `cancelled`. Confirm/ship are driven by us
   *   and carry side effects (sales orders, stock), so we never rewrite those
   *   from a poll.
   * - Never touches a row already cancelled locally, so an operator's reason
   *   code and audit trail are preserved.
   */
  private async reconcileStatusesFromPortal(
    portal: { id: number; portalUrl: string },
    apiKey: string,
  ): Promise<number> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await this.getDb()) as any;
    const { orders } = this.getTables();

    // Rows still considered "live" on our side are the only ones that can drift
    // in a way we care about.
    const openRows = await db
      .select({
        id: orders.id,
        vmiOrderId: orders.vmiOrderId,
        localStatus: orders.localStatus,
      })
      .from(orders)
      .where(
        and(
          eq(orders.portalId, portal.id),
          inArray(orders.localStatus, ['pending', 'confirmed', 'processing', 'shipped']),
        ),
      );

    let reconciled = 0;

    for (const row of openRows) {
      try {
        const res = await fetch(
          `${portal.portalUrl}/api/external/vendor/orders/${row.vmiOrderId}`,
          { headers: { 'X-API-Key': apiKey }, signal: AbortSignal.timeout(30000) },
        );
        if (!res.ok) continue;

        const body = await res.json();
        const portalStatus: string | undefined = body?.order?.status;
        if (portalStatus !== 'cancelled') continue;

        const now = getNow();
        await db
          .update(orders)
          .set({
            vmiStatus: 'cancelled',
            localStatus: 'cancelled',
            rejectedAt: now,
            rejectionReason: 'ยกเลิกจาก VMI Portal (ซิงค์อัตโนมัติ)',
            cancelSyncedAt: now,
            updatedAt: now,
          } as Record<string, unknown>)
          .where(eq(orders.id, row.id));

        await createAuditLog({
          action: 'CANCEL',
          tableName: 'vmi_sales_orders',
          recordId: row.id,
          oldValue: { localStatus: row.localStatus },
          newValue: { localStatus: 'cancelled', source: 'portal_reconcile' },
        });

        reconciled++;
      } catch (error) {
        // One unreachable order must not abort the whole reconcile pass.
        console.error(
          `[VMI Poll] Status reconcile failed for order ${row.vmiOrderId}:`,
          error,
        );
      }
    }

    if (reconciled > 0) {
      console.warn(`[VMI Poll] Reconciled ${reconciled} order(s) to cancelled from portal`);
    }
    return reconciled;
  }

  /**
   * Has this portal order already been imported — under this portal config OR
   * under any earlier config pointing at the same portal address?
   *
   * Matching on (portalUrl, vendorId) as well as portal id is what stops a
   * deleted-and-recreated portal from duplicating its entire order history.
   */
  private async findExistingPortalOrder(
    portalId: number,
    portalUrl: string,
    vendorId: string,
    vmiOrderId: string,
  ): Promise<VmiSalesOrder | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await this.getDb()) as any;
    const { orders, portals } = this.getTables();

    // Every portal config — current or superseded — that addresses the same
    // portal as the one we are polling.
    const sameAddress = await db
      .select({ id: portals.id })
      .from(portals)
      .where(and(eq(portals.portalUrl, portalUrl), eq(portals.vendorId, vendorId)));

    const portalIds = Array.from(
      new Set<number>([portalId, ...sameAddress.map((p: { id: number }) => p.id)]),
    );

    const [record] = await db
      .select()
      .from(orders)
      .where(and(inArray(orders.portalId, portalIds), eq(orders.vmiOrderId, vmiOrderId)));

    return record || null;
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
    orderDetail: PortalOrderDetail
  ): Promise<VmiSalesOrderSummary> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await this.getDb()) as any;
    const { orders, lines } = this.getTables();

    const now = getNow();

    // Sheet item 10: make sure this VMI hospital exists in the customer register.
    const customerId = await ensureVmiCustomerWithDb(db, {
      hospitalCode: orderDetail.hospitalCode,
      hospitalName: orderDetail.hospitalName,
      vmiPortalId: portalId,
    });

    // Create order (map API fields to DB fields)
    const orderValues = {
      portalId,
      vmiOrderId: String(orderDetail.id),
      customerId,
      vmiStatus: 'submitted',
      localStatus: 'pending',
      vmiCustomerId: orderDetail.hospitalCode,
      vmiCustomerName: orderDetail.hospitalName,
      orderDate: toDbDate(orderDetail.orderDate),
      requiredDate: orderDetail.expectedDeliveryDate ? toDbDate(orderDetail.expectedDeliveryDate) : null,
      totalAmount: orderDetail.totalValue,
      currency: 'THB',
      orderDataJson: JSON.stringify(orderDetail),
      polledAt: now,
      createdAt: now,
      updatedAt: now,
    } as Record<string, unknown>;

    let orderId: number;
    if (this.isSqliteDb) {
      const [inserted] = await db
        .insert(orders)
        .values(orderValues)
        .returning({ id: orders.id });
      orderId = inserted.id;
    } else {
      const [inserted] = await db
        .insert(orders)
        .values(orderValues)
        .$returningId();
      orderId = inserted.id;
    }

    // Create order lines with item matching
    let unmatchedCount = 0;
    for (const item of orderDetail.items || []) {
      const matchResult = await this.matchItem(
        item.tppCode || undefined,
        item.ttmtCode || undefined,
        item.localCode || undefined
      );

      if (matchResult.status === 'unmatched') unmatchedCount++;

      await db.insert(lines).values({
        vmiSalesOrderId: orderId,
        vmiLineId: String(item.id),
        itemId: matchResult.itemId,
        tppCode: item.tppCode || null,
        ttmtCode: item.ttmtCode || null,
        localCode: item.localCode || null,
        itemName: item.name,
        quantity: item.quantityOrdered,
        unit: item.unit,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
        matchStatus: matchResult.status,
      } as Record<string, unknown>);
    }

    // Bug L1: Audit log for order creation
    await createAuditLog({
      userId: 1,
      action: 'CREATE',
      tableName: 'vmi_sales_orders',
      recordId: orderId,
      newValue: {
        portalId,
        vmiOrderId: String(orderDetail.id),
        vmiStatus: 'submitted',
        localStatus: 'pending',
        vmiCustomerName: orderDetail.hospitalName,
        lineCount: (orderDetail.items || []).length,
      },
    });

    return {
      id: orderId,
      portalId,
      vmiOrderId: String(orderDetail.id),
      vmiStatus: 'submitted',
      localStatus: 'pending',
      customerId,
      vmiCustomerId: orderDetail.hospitalCode,
      vmiCustomerName: orderDetail.hospitalName,
      orderDate: new Date(orderDetail.orderDate),
      requiredDate: orderDetail.expectedDeliveryDate ? new Date(orderDetail.expectedDeliveryDate) : null,
      totalAmount: Number(orderDetail.totalValue),
      currency: 'THB',
      lineCount: (orderDetail.items || []).length,
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

    // Bug L1: Audit log for line match update
    await createAuditLog({
      userId: 1,
      action: 'UPDATE',
      tableName: 'vmi_sales_order_lines',
      recordId: lineId,
      oldValue: { itemId: line.itemId, matchStatus: line.matchStatus },
      newValue: { itemId, localCode: item.code, matchStatus: 'manual_mapped' },
    });

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

    const now = getNow();

    // Build update data
    const updateData: Record<string, unknown> = {
      updatedAt: now,
    };
    if (data.customerId !== undefined) updateData.customerId = data.customerId;
    if (data.localStatus !== undefined) updateData.localStatus = data.localStatus;
    if (data.notes !== undefined) updateData.notes = data.notes;

    await db.update(orders).set(updateData).where(eq(orders.id, orderId));

    // Bug L1: Audit log for order update
    await createAuditLog({
      userId: 1,
      action: 'UPDATE',
      tableName: 'vmi_sales_orders',
      recordId: orderId,
      oldValue: {
        customerId: existing.customerId,
        localStatus: existing.localStatus,
      },
      newValue: updateData,
    });

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
    /** False when the portal refused or was unreachable. The local order is
     *  still confirmed/shipped, so callers must surface this rather than
     *  assume the portal agrees. */
    portalSynced: boolean;
    portalSyncError?: string;
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

    // Every line must be resolved before we turn this into a sales order.
    // `multiple_matches` is included deliberately: auto-matching picked the
    // FIRST of several candidates, so confirming would ship a guess. Requiring
    // an explicit choice is the whole point of the flag.
    const unmatchedLines = order.lines.filter(
      (l: any) => l.matchStatus === 'unmatched' || l.matchStatus === 'multiple_matches',
    );
    if (unmatchedLines.length > 0) {
      const ambiguous = unmatchedLines.filter(
        (l: any) => l.matchStatus === 'multiple_matches',
      ).length;
      throw new VmiSalesOrderError(
        'UNMATCHED_ITEMS',
        ambiguous > 0
          ? `ยืนยันคำสั่งซื้อไม่ได้: มี ${unmatchedLines.length} รายการที่ยังไม่ได้จับคู่ (${ambiguous} รายการพบสินค้าที่ตรงกันหลายตัว ต้องเลือกเอง)`
          : `ยืนยันคำสั่งซื้อไม่ได้: มี ${unmatchedLines.length} รายการที่ยังไม่ได้จับคู่`,
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

    // Create actual sales order from VMI order
    const matchedLines = order.lines
      .filter((l: any) => l.matchStatus !== 'unmatched' && l.itemId)
      .map((l: any) => ({
        itemId: l.itemId,
        quantity: l.quantity,
        unit: l.unit || 'EA',
        unitPrice: l.unitPrice,
      }));

    const salesResult = await createSalesOrderFromVmi({
      vmiSalesOrderId: orderId,
      customerName: order.vmiCustomerName || 'Unknown',
      orderDate: toDbDate(order.orderDate instanceof Date ? order.orderDate.toISOString().split('T')[0] : String(order.orderDate)),
      requiredDate: order.requiredDate ? toDbDate(order.requiredDate instanceof Date ? order.requiredDate.toISOString().split('T')[0] : String(order.requiredDate)) : null,
      totalAmount: order.totalAmount,
      lines: matchedLines,
      userId: request.userId || 1,
      notes: `VMI Order #${order.vmiOrderId} from ${order.portalName || 'VMI Portal'}`,
    });

    const salesOrderId = salesResult.orderId;
    const soNumber = salesResult.soNumber;

    const now = getNow();

    // Update VMI order with real sales order ID
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

    // Notify VMI Portal.
    //
    // fetch() only rejects on a network-level failure — an HTTP 401/404/500
    // RESOLVES. The previous version awaited it without inspecting the
    // response, so a portal that answered 401 "Invalid API key" looked
    // identical to success: nothing was logged, and the caller was still told
    // "synced to VMI Portal". Verified against UAT, where this endpoint does
    // in fact answer 401. Check the status explicitly.
    const portalSync = await notifyPortal(
      portal,
      order.vmiOrderId,
      { action: 'confirm' },
      'confirm',
    );

    const updatedOrder = await this.getOrderById(orderId);

    return {
      vmiOrder: updatedOrder!,
      salesOrder: {
        id: salesOrderId,
        soNumber,
        status: 'confirmed',
      },
      // The sales order is already committed, so a portal failure must not
      // roll the confirmation back — but it must not be reported as a success
      // either. Say what actually happened.
      portalSynced: portalSync.ok,
      portalSyncError: portalSync.error,
      message: portalSync.ok
        ? 'Order confirmed and synced to VMI Portal'
        : `Order confirmed locally, but the VMI Portal was NOT updated: ${portalSync.error}`,
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
    /** False when the portal refused or was unreachable. The local order is
     *  still confirmed/shipped, so callers must surface this rather than
     *  assume the portal agrees. */
    portalSynced: boolean;
    portalSyncError?: string;
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

    const now = getNow();

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

    // Bug L1: Audit log for ship operation
    await createAuditLog({
      userId: 1,
      action: 'SHIP',
      tableName: 'vmi_sales_orders',
      recordId: orderId,
      oldValue: { localStatus: order.localStatus, vmiStatus: order.vmiStatus },
      newValue: { localStatus: 'shipped', vmiStatus: 'shipped' },
    });

    // Same unchecked-response bug as confirm: an HTTP error resolved and was
    // reported as a successful sync. See notifyPortal().
    const portalSync = await notifyPortal(
      portal,
      order.vmiOrderId,
      { action: 'ship', expectedDeliveryDate: request.expectedDeliveryDate },
      'ship',
    );

    const updatedOrder = await this.getOrderById(orderId);

    return {
      vmiOrder: updatedOrder!,
      portalSynced: portalSync.ok,
      portalSyncError: portalSync.error,
      message: portalSync.ok
        ? 'Order marked as shipped and synced to VMI Portal'
        : `Order marked as shipped locally, but the VMI Portal was NOT updated: ${portalSync.error}`,
    };
  }

  /**
   * Cancel a VMI order and push the cancellation to the portal
   * (CANCEL-PO-VENDOR-GUIDE).
   *
   * Ordering matters: the portal is called FIRST and the local row is only
   * written once it accepts. The previous implementation committed locally and
   * treated the portal push as best-effort, which meant a rejected or
   * unreachable portal left us showing "cancelled" while the hospital still saw
   * a live PO — a silent divergence nobody could see. If the portal refuses
   * (already shipped, bad reason code, revoked key) the local order is left
   * untouched and the error surfaces to the operator.
   *
   * The portal accepts cancellation of both `submitted` and `confirmed` orders.
   * A confirmed order already has a local sales order attached; we do NOT
   * silently cancel that SO here — it is reported back so the caller can decide,
   * because voiding a sales order can touch stock reservations and invoicing.
   *
   * @param reasonCode one of the portal's six enum values
   * @param reasonText free text, 1–500 chars, shown to the hospital
   */
  async cancelOrder(
    orderId: number,
    reasonCode: VmiCancelReasonCode,
    reasonText: string,
    userId: number,
  ): Promise<{ vmiOrder: VmiSalesOrderDetail; message: string; linkedSalesOrderId?: number }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await this.getDb()) as any;
    const { orders, portals } = this.getTables();

    const trimmed = (reasonText || '').trim();
    if (!trimmed) {
      throw new VmiSalesOrderError('INVALID_REASON', 'ต้องระบุเหตุผลในการยกเลิกคำสั่งซื้อ', 400);
    }
    // The portal caps reason_text at 500 characters and answers VALIDATION_ERROR
    // beyond that — fail here with a Thai message instead of a round trip.
    if (trimmed.length > 500) {
      throw new VmiSalesOrderError(
        'INVALID_REASON',
        'เหตุผลในการยกเลิกต้องไม่เกิน 500 ตัวอักษร',
        400,
      );
    }

    const order = await this.getOrderById(orderId);
    if (!order) {
      throw new VmiSalesOrderError('ORDER_NOT_FOUND', 'Order not found', 404);
    }

    // Mirror the portal's own rule: submitted/confirmed may be cancelled,
    // anything shipped onward must go through returns instead.
    if (order.localStatus === 'cancelled') {
      throw new VmiSalesOrderError('ALREADY_CANCELLED', 'คำสั่งซื้อนี้ถูกยกเลิกไปแล้ว', 400);
    }
    if (!['pending', 'confirmed'].includes(order.localStatus)) {
      throw new VmiSalesOrderError(
        'INVALID_STATUS',
        `ยกเลิกคำสั่งซื้อไม่ได้: สถานะปัจจุบันคือ "${order.localStatus}" (ยกเลิกได้เฉพาะ "pending" หรือ "confirmed")`,
        400,
      );
    }

    const [portal] = await db.select().from(portals).where(eq(portals.id, order.portalId));
    if (!portal) {
      throw new VmiSalesOrderError('PORTAL_NOT_FOUND', 'ไม่พบการตั้งค่า VMI Portal', 404);
    }

    // Stable per (order, attempt-day) so a retry after a network timeout replays
    // the portal's cached response rather than being treated as a new request.
    const idempotencyKey = `herb-cancel-${order.portalId}-${order.vmiOrderId}-${reasonCode}`;

    const portalService = new VmiPortalService({
      vendorId: order.portalId,
      apiKeyEncrypted: decrypt(portal.apiKeyEncrypted),
      baseUrl: `${portal.portalUrl}/api/external/vendor`,
    });

    try {
      await portalService.cancelOrder(
        Number(order.vmiOrderId),
        { reason_code: reasonCode, reason_text: trimmed },
        idempotencyKey,
      );
    } catch (error) {
      const now = getNow();
      const message =
        error instanceof VmiPortalError
          ? error.getUserMessage('th')
          : error instanceof Error
            ? error.message
            : 'ไม่ทราบสาเหตุ';

      // Record the failed attempt so operators can see why the portal refused
      // rather than only finding it in server logs.
      await db
        .update(orders)
        .set({ cancelSyncError: message.slice(0, 500), updatedAt: now } as Record<string, unknown>)
        .where(eq(orders.id, orderId));

      if (error instanceof VmiPortalError) {
        throw new VmiSalesOrderError(
          error.code,
          `VMI Portal ปฏิเสธการยกเลิก: ${message}`,
          error.httpStatus,
        );
      }
      throw new VmiSalesOrderError(
        'PORTAL_UNREACHABLE',
        `ติดต่อ VMI Portal ไม่ได้ จึงยังไม่ยกเลิกคำสั่งซื้อ: ${message}`,
        502,
      );
    }

    // Portal accepted — now it is safe to commit locally.
    const now = getNow();
    await db
      .update(orders)
      .set({
        vmiStatus: 'cancelled',
        localStatus: 'cancelled',
        rejectedAt: now,
        rejectionReason: trimmed,
        cancelReasonCode: reasonCode,
        cancelIdempotencyKey: idempotencyKey,
        cancelSyncedAt: now,
        cancelSyncError: null,
        updatedAt: now,
      } as Record<string, unknown>)
      .where(eq(orders.id, orderId));

    await createAuditLog({
      userId,
      action: 'CANCEL',
      tableName: 'vmi_sales_orders',
      recordId: orderId,
      oldValue: { localStatus: order.localStatus, vmiStatus: order.vmiStatus },
      newValue: {
        localStatus: 'cancelled',
        vmiStatus: 'cancelled',
        cancelReasonCode: reasonCode,
        rejectionReason: trimmed,
        syncedToPortal: true,
      },
    });

    const updatedOrder = await this.getOrderById(orderId);

    // A confirmed order carries a real sales order. Surface it rather than
    // voiding it behind the operator's back.
    const linkedSalesOrderId = order.salesOrderId ?? undefined;
    const message = linkedSalesOrderId
      ? 'ยกเลิกคำสั่งซื้อและแจ้ง VMI Portal แล้ว — กรุณาตรวจสอบใบสั่งขายที่ผูกอยู่ด้วย'
      : 'ยกเลิกคำสั่งซื้อและแจ้ง VMI Portal แล้ว';

    return { vmiOrder: updatedOrder!, message, linkedSalesOrderId };
  }

  /**
   * @deprecated Use {@link cancelOrder}. Kept so existing callers keep working;
   * maps the old free-text reason onto the portal's OTHER reason code.
   */
  async rejectOrder(
    orderId: number,
    reason: string,
    userId: number,
  ): Promise<{ vmiOrder: VmiSalesOrderDetail; message: string }> {
    return this.cancelOrder(orderId, 'OTHER', reason, userId);
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
