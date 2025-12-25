/**
 * Recall Service
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * Manages product recalls with distribution tracking, customer notifications,
 * and reconciliation workflow.
 */

import { getDb, isSqlite } from '../db';
import { getNow, toDbDate, getTodayStr } from '../db/date-utils';
import { eq, and, desc, like, sql, count, inArray } from 'drizzle-orm';
import {
  sqliteRecalls,
  sqliteRecallNotifications,
  sqliteRecallReconciliation,
  sqliteItems,
  sqliteInventoryLots,
  sqliteUsers,
  sqliteComplaints,
  sqliteSalesOrders,
  sqliteSalesOrderLines,
  sqliteCustomers,
  mysqlRecalls,
  mysqlRecallNotifications,
  mysqlRecallReconciliation,
  mysqlItems,
  mysqlInventoryLots,
  mysqlUsers,
  mysqlComplaints,
  mysqlSalesOrders,
  mysqlSalesOrderLines,
  mysqlCustomers,
} from '../db/schema';

/**
 * Get database-specific table references
 */
function getTables() {
  if (isSqlite()) {
    return {
      recalls: sqliteRecalls,
      notifications: sqliteRecallNotifications,
      reconciliation: sqliteRecallReconciliation,
      items: sqliteItems,
      lots: sqliteInventoryLots,
      users: sqliteUsers,
      complaints: sqliteComplaints,
      salesOrders: sqliteSalesOrders,
      salesOrderLines: sqliteSalesOrderLines,
      customers: sqliteCustomers,
    };
  }
  return {
    recalls: mysqlRecalls,
    notifications: mysqlRecallNotifications,
    reconciliation: mysqlRecallReconciliation,
    items: mysqlItems,
    lots: mysqlInventoryLots,
    users: mysqlUsers,
    complaints: mysqlComplaints,
    salesOrders: mysqlSalesOrders,
    salesOrderLines: mysqlSalesOrderLines,
    customers: mysqlCustomers,
  };
}
import { createAuditLog } from '../audit';
import type {
  RecallClass,
  RecallStatus,
  NotificationMethod,
  NotificationResponseStatus,
  Recall,
  RecallCreate,
  RecallUpdate,
  RecallDetails,
  RecallNotification,
  RecallNotificationCreate,
  RecallNotificationUpdate,
  RecallReconciliation,
  RecallReconciliationCreate,
  DistributionRecord,
  MockDrillResult,
  MockDrillRequest,
  RecallListParams,
  RecallListResponse,
  RecallCloseRequest,
  RecallReport,
} from '@/types/recalls';

// Type for database query result rows
interface DbRecallRow {
  id: number;
  recallNumber: string;
  initiatedDate: string;
  recallClass: string;
  reason: string;
  productId: number | null;
  productName: string | null;
  affectedLots: string | null;
  status: string;
  distributedQuantity: number | null;
  returnedQuantity: number | null;
  reconciledQuantity: number | null;
  effectivenessRate: number | null;
  regulatoryReportDate: string | null;
  closureDate: string | null;
  coordinatorId: number | null;
  coordinatorName: string | null;
  complaintId: number | null;
  complaintNumber: string | null;
  createdBy: number | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DbNotificationRow {
  id: number;
  recallId: number;
  customerId: number | null;
  customerName: string | null;
  contactInfo: string | null;
  quantityDistributed: number | null;
  notificationMethod: string | null;
  notifiedAt: string | null;
  acknowledgedAt: string | null;
  responseStatus: string | null;
  quantityReturned: number | null;
  notes: string | null;
}

interface DbReconciliationRow {
  id: number;
  recallId: number;
  lotId: number | null;
  lotNumber: string | null;
  distributedQty: number | null;
  returnedQty: number | null;
  destroyedQty: number | null;
  accountedQty: number | null;
  unaccountedQty: number | null;
  reconciliationNotes: string | null;
  verifiedBy: number | null;
  verifiedByName: string | null;
  verifiedAt: string | null;
}

// ============================================
// Number Generation
// ============================================

/**
 * Generate next recall number (RCL-YYMM-####)
 */
export async function generateRecallNumber(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const prefix = `RCL-${year}${month}-`;

  const db = await getDb();
  const { recalls } = getTables();

  const result = await (db as any)
    .select({ recallNumber: recalls.recallNumber })
    .from(recalls)
    .where(like(recalls.recallNumber, `${prefix}%`))
    .orderBy(desc(recalls.recallNumber))
    .limit(1);

  if (result.length === 0) {
    return `${prefix}0001`;
  }

  const lastNumber = result[0].recallNumber;
  const sequence = parseInt(lastNumber.slice(-4), 10);
  return `${prefix}${(sequence + 1).toString().padStart(4, '0')}`;
}

// ============================================
// CRUD Operations
// ============================================

/**
 * Create a new recall
 */
export async function createRecall(
  data: RecallCreate,
  userId: number
): Promise<Recall> {
  const recallNumber = await generateRecallNumber();
  const todayStr = getTodayStr();
  const db = await getDb();
  const { recalls } = getTables();

  const values = {
    recallNumber,
    initiatedDate: toDbDate(todayStr),
    recallClass: data.recallClass,
    reason: data.reason,
    productId: data.productId,
    affectedLots: JSON.stringify(data.affectedLots),
    status: 'initiated',
    coordinatorId: data.coordinatorId,
    complaintId: data.complaintId || null,
    createdBy: userId,
    createdAt: getNow(),
    updatedAt: getNow(),
  };

  let recallId: number;

  if (isSqlite()) {
    const [result] = await (db as any)
      .insert(recalls)
      .values(values)
      .returning();
    recallId = result.id;
  } else {
    await (db as any).insert(recalls).values(values);
    const inserted = await (db as any)
      .select({ id: recalls.id })
      .from(recalls)
      .where(eq(recalls.recallNumber, recallNumber))
      .limit(1);
    recallId = inserted[0].id;
  }

  await createAuditLog({
    action: 'CREATE',
    tableName: 'recall',
    recordId: recallId,
    userId,
    newValue: { recallNumber, ...data },
  });

  return getRecallById(recallId) as Promise<Recall>;
}

/**
 * Get recall by ID
 */
export async function getRecallById(id: number): Promise<Recall | null> {
  const db = await getDb();
  const { recalls, items, users, complaints } = getTables();

  const result = await (db as any)
    .select({
      id: recalls.id,
      recallNumber: recalls.recallNumber,
      initiatedDate: recalls.initiatedDate,
      recallClass: recalls.recallClass,
      reason: recalls.reason,
      productId: recalls.productId,
      productName: items.nameTh,
      affectedLots: recalls.affectedLots,
      status: recalls.status,
      distributedQuantity: recalls.distributedQuantity,
      returnedQuantity: recalls.returnedQuantity,
      reconciledQuantity: recalls.reconciledQuantity,
      effectivenessRate: recalls.effectivenessRate,
      regulatoryReportDate: recalls.regulatoryReportDate,
      closureDate: recalls.closureDate,
      coordinatorId: recalls.coordinatorId,
      coordinatorName: users.name,
      complaintId: recalls.complaintId,
      complaintNumber: complaints.complaintNumber,
      createdBy: recalls.createdBy,
      createdAt: recalls.createdAt,
      updatedAt: recalls.updatedAt,
    })
    .from(recalls)
    .leftJoin(items, eq(recalls.productId, items.id))
    .leftJoin(users, eq(recalls.coordinatorId, users.id))
    .leftJoin(complaints, eq(recalls.complaintId, complaints.id))
    .where(eq(recalls.id, id))
    .limit(1);

  if (result.length === 0) return null;

  const row = result[0] as DbRecallRow;
  return mapRowToRecall(row);
}

/**
 * Get recall with full details including notifications and reconciliation
 */
export async function getRecallDetails(id: number): Promise<RecallDetails | null> {
  const recall = await getRecallById(id);
  if (!recall) return null;

  const notifications = await getRecallNotifications(id);
  const reconciliation = await getRecallReconciliation(id);

  let complaint = null;
  if (recall.complaintId) {
    const db = await getDb();
    const { complaints } = getTables();

    const result = await (db as any)
      .select({
        id: complaints.id,
        complaintNumber: complaints.complaintNumber,
        category: complaints.category,
        severity: complaints.severity,
        description: complaints.description,
      })
      .from(complaints)
      .where(eq(complaints.id, recall.complaintId))
      .limit(1);

    complaint = result[0] || null;
  }

  return {
    ...recall,
    notifications,
    reconciliation,
    complaint,
  };
}

/**
 * Update recall
 */
export async function updateRecall(
  id: number,
  data: RecallUpdate,
  userId: number
): Promise<Recall | null> {
  const existing = await getRecallById(id);
  if (!existing) return null;

  const db = await getDb();
  const { recalls } = getTables();

  await (db as any)
    .update(recalls)
    .set({
      ...data,
      updatedAt: getNow(),
    })
    .where(eq(recalls.id, id));

  await createAuditLog({
    action: 'UPDATE',
    tableName: 'recall',
    recordId: id,
    userId,
    oldValue: existing,
    newValue: data,
  });

  return getRecallById(id);
}

/**
 * List recalls with filters
 */
export async function listRecalls(
  params: RecallListParams
): Promise<RecallListResponse> {
  const { status, recallClass, productId, page = 1, limit = 20 } = params;
  const offset = (page - 1) * limit;

  const db = await getDb();
  const { recalls, items, users, complaints } = getTables();

  // Build conditions array
  const conditions = [];
  if (status) conditions.push(eq(recalls.status, status));
  if (recallClass) conditions.push(eq(recalls.recallClass, recallClass));
  if (productId) conditions.push(eq(recalls.productId, productId));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Get total count
  const countResult = await (db as any)
    .select({ count: count() })
    .from(recalls)
    .where(whereClause);

  const total = countResult[0]?.count || 0;

  // Get recalls
  const result = await (db as any)
    .select({
      id: recalls.id,
      recallNumber: recalls.recallNumber,
      initiatedDate: recalls.initiatedDate,
      recallClass: recalls.recallClass,
      reason: recalls.reason,
      productId: recalls.productId,
      productName: items.nameTh,
      affectedLots: recalls.affectedLots,
      status: recalls.status,
      distributedQuantity: recalls.distributedQuantity,
      returnedQuantity: recalls.returnedQuantity,
      reconciledQuantity: recalls.reconciledQuantity,
      effectivenessRate: recalls.effectivenessRate,
      regulatoryReportDate: recalls.regulatoryReportDate,
      closureDate: recalls.closureDate,
      coordinatorId: recalls.coordinatorId,
      coordinatorName: users.name,
      complaintId: recalls.complaintId,
      complaintNumber: complaints.complaintNumber,
      createdBy: recalls.createdBy,
      createdAt: recalls.createdAt,
      updatedAt: recalls.updatedAt,
    })
    .from(recalls)
    .leftJoin(items, eq(recalls.productId, items.id))
    .leftJoin(users, eq(recalls.coordinatorId, users.id))
    .leftJoin(complaints, eq(recalls.complaintId, complaints.id))
    .where(whereClause)
    .orderBy(desc(recalls.createdAt))
    .limit(limit)
    .offset(offset);

  const recallsList = result.map((row: any) => mapRowToRecall(row as DbRecallRow));

  return { recalls: recallsList, total };
}

// ============================================
// Distribution Data
// ============================================

/**
 * Get distribution data for affected lots
 * This aggregates sales orders that shipped the affected lots to identify customers
 */
export async function getDistributionData(
  recallId: number
): Promise<DistributionRecord[]> {
  const recall = await getRecallById(recallId);
  if (!recall) return [];

  const lotIds = recall.affectedLots;
  if (!lotIds || lotIds.length === 0) return [];

  const db = await getDb();
  const { salesOrderLines, salesOrders, lots, customers } = getTables();

  // Get sales orders that shipped these lots
  const result = await (db as any)
    .select({
      customerId: customers.id,
      customerName: customers.name,
      contactInfo: customers.phone,
      lotId: salesOrderLines.lotId,
      lotNumber: lots.lotNumber,
      quantityDistributed: salesOrderLines.shippedQuantity,
      shipDate: salesOrders.shippedDate,
    })
    .from(salesOrderLines)
    .innerJoin(salesOrders, eq(salesOrderLines.soId, salesOrders.id))
    .innerJoin(lots, eq(salesOrderLines.lotId, lots.id))
    .innerJoin(customers, eq(
      sql`CAST(${salesOrders.customerName} AS TEXT)`,
      customers.name
    ))
    .where(
      and(
        inArray(salesOrderLines.lotId, lotIds),
        eq(salesOrders.status, 'delivered')
      )
    );

  return result.map((row: any) => ({
    customerId: row.customerId || 0,
    customerName: row.customerName || 'Unknown',
    contactInfo: row.contactInfo || '',
    lotId: row.lotId || 0,
    lotNumber: row.lotNumber || '',
    quantityDistributed: row.quantityDistributed || 0,
    shipDate: row.shipDate || '',
  }));
}

/**
 * Calculate distributed quantity for a recall
 */
export async function calculateDistributedQuantity(
  lotIds: number[]
): Promise<number> {
  if (lotIds.length === 0) return 0;

  const db = await getDb();
  const { salesOrderLines, salesOrders } = getTables();

  const result = await (db as any)
    .select({
      total: sql<number>`SUM(${salesOrderLines.shippedQuantity})`,
    })
    .from(salesOrderLines)
    .innerJoin(salesOrders, eq(salesOrderLines.soId, salesOrders.id))
    .where(
      and(
        inArray(salesOrderLines.lotId, lotIds),
        eq(salesOrders.status, 'delivered')
      )
    );

  return result[0]?.total || 0;
}

// ============================================
// Notifications
// ============================================

/**
 * Get all notifications for a recall
 */
export async function getRecallNotifications(
  recallId: number
): Promise<RecallNotification[]> {
  const db = await getDb();
  const { notifications } = getTables();

  const result = await (db as any)
    .select({
      id: notifications.id,
      recallId: notifications.recallId,
      customerId: notifications.customerId,
      customerName: notifications.customerName,
      contactInfo: notifications.contactInfo,
      quantityDistributed: notifications.quantityDistributed,
      notificationMethod: notifications.notificationMethod,
      notifiedAt: notifications.notifiedAt,
      acknowledgedAt: notifications.acknowledgedAt,
      responseStatus: notifications.responseStatus,
      quantityReturned: notifications.quantityReturned,
      notes: notifications.notes,
    })
    .from(notifications)
    .where(eq(notifications.recallId, recallId))
    .orderBy(desc(notifications.notifiedAt));

  return result.map((row: any) => mapRowToNotification(row as DbNotificationRow));
}

/**
 * Create notification record for a customer
 */
export async function createNotification(
  recallId: number,
  data: RecallNotificationCreate,
  userId: number
): Promise<RecallNotification> {
  const db = await getDb();
  const { notifications, customers } = getTables();

  // Get customer details
  let customerName = '';
  let contactInfo = '';
  let quantityDistributed = 0;

  const customer = await (db as any)
    .select({
      name: customers.name,
      phone: customers.phone,
      email: customers.email,
    })
    .from(customers)
    .where(eq(customers.id, data.customerId))
    .limit(1);

  if (customer.length > 0) {
    customerName = customer[0].name;
    contactInfo = data.notificationMethod === 'email'
      ? (customer[0].email || '')
      : (customer[0].phone || '');
  }

  // Get quantity distributed to this customer for this recall
  const recall = await getRecallById(recallId);
  if (recall) {
    const distribution = await getDistributionData(recallId);
    const customerDist = distribution.filter(d => d.customerId === data.customerId);
    quantityDistributed = customerDist.reduce((sum, d) => sum + d.quantityDistributed, 0);
  }

  const values = {
    recallId,
    customerId: data.customerId,
    customerName,
    contactInfo,
    quantityDistributed,
    notificationMethod: data.notificationMethod,
    notifiedAt: getNow(),
    responseStatus: 'pending',
    notes: data.notes || null,
    createdAt: getNow(),
  };

  let notificationId: number;

  if (isSqlite()) {
    const [result] = await (db as any)
      .insert(notifications)
      .values(values)
      .returning();
    notificationId = result.id;
  } else {
    await (db as any).insert(notifications).values(values);
    // Look up by recallId + customerId + notifiedAt
    const inserted = await (db as any)
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.recallId, recallId),
          eq(notifications.customerId, data.customerId),
          eq(notifications.notifiedAt, values.notifiedAt)
        )
      )
      .limit(1);
    notificationId = inserted[0].id;
  }

  await createAuditLog({
    action: 'CREATE',
    tableName: 'recall_notification',
    recordId: notificationId,
    userId,
    newValue: { recallId, ...data },
  });

  const allNotifications = await getRecallNotifications(recallId);
  return allNotifications.find(n => n.id === notificationId)!;
}

/**
 * Update notification status/response
 */
export async function updateNotification(
  id: number,
  data: RecallNotificationUpdate,
  userId: number
): Promise<RecallNotification | null> {
  const db = await getDb();
  const { notifications } = getTables();

  const existing = await (db as any)
    .select()
    .from(notifications)
    .where(eq(notifications.id, id))
    .limit(1);

  if (existing.length === 0) return null;

  const updateData: Record<string, unknown> = {};
  if (data.responseStatus) updateData.responseStatus = data.responseStatus;
  if (data.quantityReturned !== undefined) updateData.quantityReturned = data.quantityReturned;
  if (data.notes !== undefined) updateData.notes = data.notes;

  if (data.responseStatus === 'acknowledged') {
    updateData.acknowledgedAt = getNow();
  }

  await (db as any)
    .update(notifications)
    .set(updateData)
    .where(eq(notifications.id, id));

  // Update recall totals
  const notification = existing[0];
  await updateRecallTotals(notification.recallId);

  await createAuditLog({
    action: 'UPDATE',
    tableName: 'recall_notification',
    recordId: id,
    userId,
    oldValue: existing[0],
    newValue: data,
  });

  const allNotifications = await getRecallNotifications(notification.recallId);
  return allNotifications.find(n => n.id === id) || null;
}

// ============================================
// Reconciliation
// ============================================

/**
 * Get reconciliation records for a recall
 */
export async function getRecallReconciliation(
  recallId: number
): Promise<RecallReconciliation[]> {
  const db = await getDb();
  const { reconciliation, lots, users } = getTables();

  const result = await (db as any)
    .select({
      id: reconciliation.id,
      recallId: reconciliation.recallId,
      lotId: reconciliation.lotId,
      lotNumber: lots.lotNumber,
      distributedQty: reconciliation.distributedQty,
      returnedQty: reconciliation.returnedQty,
      destroyedQty: reconciliation.destroyedQty,
      accountedQty: reconciliation.accountedQty,
      unaccountedQty: reconciliation.unaccountedQty,
      reconciliationNotes: reconciliation.reconciliationNotes,
      verifiedBy: reconciliation.verifiedBy,
      verifiedByName: users.name,
      verifiedAt: reconciliation.verifiedAt,
    })
    .from(reconciliation)
    .leftJoin(lots, eq(reconciliation.lotId, lots.id))
    .leftJoin(users, eq(reconciliation.verifiedBy, users.id))
    .where(eq(reconciliation.recallId, recallId));

  return result.map((row: any) => mapRowToReconciliation(row as DbReconciliationRow));
}

/**
 * Create or update reconciliation record
 */
export async function recordReconciliation(
  recallId: number,
  data: RecallReconciliationCreate,
  userId: number
): Promise<RecallReconciliation> {
  const db = await getDb();
  const { reconciliation } = getTables();

  // Check if reconciliation exists for this lot
  const existing = await (db as any)
    .select()
    .from(reconciliation)
    .where(
      and(
        eq(reconciliation.recallId, recallId),
        eq(reconciliation.lotId, data.lotId)
      )
    )
    .limit(1);

  // Get distributed quantity for this lot
  const distribution = await getDistributionData(recallId);
  const lotDistribution = distribution.filter(d => d.lotId === data.lotId);
  const distributedQty = lotDistribution.reduce((sum, d) => sum + d.quantityDistributed, 0);

  const returnedQty = data.returnedQty || 0;
  const destroyedQty = data.destroyedQty || 0;
  const accountedQty = data.accountedQty || 0;
  const totalAccounted = returnedQty + destroyedQty + accountedQty;
  const unaccountedQty = Math.max(0, distributedQty - totalAccounted);

  if (existing.length > 0) {
    // Update existing
    await (db as any)
      .update(reconciliation)
      .set({
        returnedQty,
        destroyedQty,
        accountedQty,
        unaccountedQty,
        reconciliationNotes: data.reconciliationNotes || null,
        verifiedBy: userId,
        verifiedAt: getNow(),
      })
      .where(eq(reconciliation.id, existing[0].id));

    await createAuditLog({
      action: 'UPDATE',
      tableName: 'recall_reconciliation',
      recordId: existing[0].id,
      userId,
      oldValue: existing[0],
      newValue: data,
    });
  } else {
    // Create new
    const values = {
      recallId,
      lotId: data.lotId,
      distributedQty,
      returnedQty,
      destroyedQty,
      accountedQty,
      unaccountedQty,
      reconciliationNotes: data.reconciliationNotes || null,
      verifiedBy: userId,
      verifiedAt: getNow(),
      createdAt: getNow(),
    };

    let recordId: number;

    if (isSqlite()) {
      const [result] = await (db as any)
        .insert(reconciliation)
        .values(values)
        .returning();
      recordId = result.id;
    } else {
      await (db as any).insert(reconciliation).values(values);
      const inserted = await (db as any)
        .select({ id: reconciliation.id })
        .from(reconciliation)
        .where(
          and(
            eq(reconciliation.recallId, recallId),
            eq(reconciliation.lotId, data.lotId)
          )
        )
        .limit(1);
      recordId = inserted[0].id;
    }

    await createAuditLog({
      action: 'CREATE',
      tableName: 'recall_reconciliation',
      recordId,
      userId,
      newValue: { recallId, ...data },
    });
  }

  // Update recall totals
  await updateRecallTotals(recallId);

  const allReconciliation = await getRecallReconciliation(recallId);
  return allReconciliation.find(r => r.lotId === data.lotId)!;
}

// ============================================
// Workflow Operations
// ============================================

/**
 * Start recall execution - transition from initiated to in_progress
 */
export async function startRecall(
  id: number,
  userId: number
): Promise<Recall | null> {
  const recall = await getRecallById(id);
  if (!recall) return null;

  if (recall.status !== 'initiated') {
    throw new Error('Can only start recalls in initiated status');
  }

  // Calculate initial distributed quantity
  const distributedQty = await calculateDistributedQuantity(recall.affectedLots);

  const db = await getDb();
  const { recalls } = getTables();

  await (db as any)
    .update(recalls)
    .set({
      status: 'in_progress',
      distributedQuantity: distributedQty,
      updatedAt: getNow(),
    })
    .where(eq(recalls.id, id));

  await createAuditLog({
    action: 'UPDATE',
    tableName: 'recall',
    recordId: id,
    userId,
    oldValue: { status: 'initiated' },
    newValue: { status: 'in_progress', distributedQuantity: distributedQty },
  });

  return getRecallById(id);
}

/**
 * Complete recall - transition from in_progress to completed
 */
export async function completeRecall(
  id: number,
  userId: number
): Promise<Recall | null> {
  const recall = await getRecallById(id);
  if (!recall) return null;

  if (recall.status !== 'in_progress') {
    throw new Error('Can only complete recalls in in_progress status');
  }

  const db = await getDb();
  const { recalls } = getTables();

  await (db as any)
    .update(recalls)
    .set({
      status: 'completed',
      updatedAt: getNow(),
    })
    .where(eq(recalls.id, id));

  await createAuditLog({
    action: 'UPDATE',
    tableName: 'recall',
    recordId: id,
    userId,
    oldValue: { status: 'in_progress' },
    newValue: { status: 'completed' },
  });

  return getRecallById(id);
}

/**
 * Close recall - final closure with effectiveness assessment
 */
export async function closeRecall(
  id: number,
  data: RecallCloseRequest,
  userId: number
): Promise<Recall | null> {
  const recall = await getRecallById(id);
  if (!recall) return null;

  if (recall.status !== 'completed') {
    throw new Error('Can only close recalls in completed status');
  }

  const db = await getDb();
  const { recalls } = getTables();

  const todayStr = getTodayStr();
  await (db as any)
    .update(recalls)
    .set({
      status: 'closed',
      closureDate: toDbDate(todayStr),
      regulatoryReportDate: data.regulatoryReportPath
        ? toDbDate(todayStr)
        : null,
      updatedAt: getNow(),
    })
    .where(eq(recalls.id, id));

  await createAuditLog({
    action: 'UPDATE',
    tableName: 'recall',
    recordId: id,
    userId,
    oldValue: { status: 'completed' },
    newValue: { status: 'closed', ...data },
  });

  return getRecallById(id);
}

/**
 * Update recall totals (returned quantity, reconciled quantity, effectiveness rate)
 */
async function updateRecallTotals(recallId: number): Promise<void> {
  const db = await getDb();
  const { recalls, notifications, reconciliation } = getTables();

  // Sum returned quantities from notifications
  const notificationResult = await (db as any)
    .select({
      totalReturned: sql<number>`SUM(${notifications.quantityReturned})`,
    })
    .from(notifications)
    .where(eq(notifications.recallId, recallId));

  // Sum reconciled quantities
  const reconciliationResult = await (db as any)
    .select({
      totalReconciled: sql<number>`SUM(${reconciliation.returnedQty} + ${reconciliation.destroyedQty} + ${reconciliation.accountedQty})`,
    })
    .from(reconciliation)
    .where(eq(reconciliation.recallId, recallId));

  const returnedQuantity = notificationResult[0]?.totalReturned || 0;
  const reconciledQuantity = reconciliationResult[0]?.totalReconciled || 0;

  // Get distributed quantity
  const recall = await getRecallById(recallId);
  const distributedQuantity = recall?.distributedQuantity || 0;

  // Calculate effectiveness rate
  const effectivenessRate = distributedQuantity > 0
    ? (reconciledQuantity / distributedQuantity) * 100
    : 0;

  await (db as any)
    .update(recalls)
    .set({
      returnedQuantity,
      reconciledQuantity,
      effectivenessRate,
      updatedAt: getNow(),
    })
    .where(eq(recalls.id, recallId));
}

// ============================================
// Mock Drill
// ============================================

/**
 * Execute a mock recall drill to test traceability
 * Returns time to identify affected customers and distribution data
 */
export async function executeMockDrill(
  data: MockDrillRequest,
  userId: number
): Promise<MockDrillResult> {
  const startTime = Date.now();
  const drillId = `DRILL-${Date.now()}`;

  const db = await getDb();
  const { lots, salesOrderLines, salesOrders, customers } = getTables();

  // Get lot information
  const lot = await (db as any)
    .select({
      id: lots.id,
      lotNumber: lots.lotNumber,
    })
    .from(lots)
    .where(eq(lots.id, data.lotId))
    .limit(1);

  if (lot.length === 0) {
    throw new Error(`Lot ID ${data.lotId} not found`);
  }

  // Get distribution data
  const distribution = await (db as any)
    .select({
      customerId: customers.id,
      customerName: customers.name,
      contactInfo: customers.phone,
      lotId: salesOrderLines.lotId,
      lotNumber: lots.lotNumber,
      quantityDistributed: salesOrderLines.shippedQuantity,
      shipDate: salesOrders.shippedDate,
    })
    .from(salesOrderLines)
    .innerJoin(salesOrders, eq(salesOrderLines.soId, salesOrders.id))
    .innerJoin(lots, eq(salesOrderLines.lotId, lots.id))
    .leftJoin(customers, eq(
      sql`${salesOrders.customerName}`,
      customers.name
    ))
    .where(
      and(
        eq(salesOrderLines.lotId, data.lotId),
        eq(salesOrders.status, 'delivered')
      )
    );

  const endTime = Date.now();
  const timeToIdentify = (endTime - startTime) / 1000; // Convert to seconds

  const distributionReport: DistributionRecord[] = distribution.map((row: any) => ({
    customerId: row.customerId || 0,
    customerName: row.customerName || 'Unknown',
    contactInfo: row.contactInfo || '',
    lotId: row.lotId || 0,
    lotNumber: row.lotNumber || '',
    quantityDistributed: row.quantityDistributed || 0,
    shipDate: row.shipDate || '',
  }));

  const totalDistributed = distributionReport.reduce(
    (sum, d) => sum + d.quantityDistributed,
    0
  );

  // Unique customers
  const uniqueCustomers = new Set(distributionReport.map(d => d.customerId)).size;

  // FDA requires 4-hour target for traceability
  const passedTarget = timeToIdentify < (4 * 60 * 60); // 4 hours in seconds

  await createAuditLog({
    action: 'CREATE',
    tableName: 'mock_drill',
    userId,
    newValue: {
      drillId,
      lotId: data.lotId,
      customersIdentified: uniqueCustomers,
      timeToIdentify,
      passedTarget,
    },
  });

  return {
    drillId,
    lotId: data.lotId,
    lotNumber: lot[0].lotNumber,
    executedAt: new Date().toISOString(),
    customersIdentified: uniqueCustomers,
    totalDistributed,
    timeToIdentify,
    passedTarget,
    distributionReport,
  };
}

// ============================================
// Recall Report Generation
// ============================================

/**
 * Generate a comprehensive recall report for regulatory submission
 * Compiles all recall data including distribution, notifications, and reconciliation
 */
export async function generateRecallReport(recallId: number): Promise<RecallReport> {
  // Get full recall details
  const recallDetails = await getRecallDetails(recallId);
  if (!recallDetails) {
    throw new Error(`Recall ID ${recallId} not found`);
  }

  const db = await getDb();
  const { lots, items } = getTables();

  // Get product details with code
  let productCode = '';
  if (recallDetails.productId) {
    const productResult = await (db as any)
      .select({
        code: items.code,
      })
      .from(items)
      .where(eq(items.id, recallDetails.productId))
      .limit(1);

    productCode = productResult[0]?.code || '';
  }

  // Get affected lot details
  const affectedLotDetails = [];
  if (recallDetails.affectedLots.length > 0) {
    const lotResults = await (db as any)
      .select({
        id: lots.id,
        lotNumber: lots.lotNumber,
        quantity: lots.quantity,
        expiryDate: lots.expiryDate,
      })
      .from(lots)
      .where(inArray(lots.id, recallDetails.affectedLots));

    for (const lot of lotResults) {
      affectedLotDetails.push({
        lotNumber: lot.lotNumber || '',
        quantity: lot.quantity || 0,
        expiryDate: lot.expiryDate || '',
      });
    }
  }

  // Get distribution data
  const distributionData = await getDistributionData(recallId);

  // Group distribution by customer
  const customerMap = new Map<number, { name: string; contact: string; quantity: number; shipDate: string }>();
  for (const dist of distributionData) {
    const existing = customerMap.get(dist.customerId);
    if (existing) {
      existing.quantity += dist.quantityDistributed;
      // Keep earliest ship date
      if (dist.shipDate < existing.shipDate) {
        existing.shipDate = dist.shipDate;
      }
    } else {
      customerMap.set(dist.customerId, {
        name: dist.customerName,
        contact: dist.contactInfo,
        quantity: dist.quantityDistributed,
        shipDate: dist.shipDate,
      });
    }
  }

  const customerList = Array.from(customerMap.values());

  // Process notifications
  const notifications = recallDetails.notifications;
  const notificationStats = {
    totalSent: notifications.length,
    acknowledged: notifications.filter(n => n.responseStatus === 'acknowledged' || n.responseStatus === 'returning' || n.responseStatus === 'returned').length,
    pending: notifications.filter(n => n.responseStatus === 'pending').length,
    unresponsive: notifications.filter(n => n.responseStatus === 'unresponsive').length,
  };

  const notificationTimeline = notifications.map(n => {
    let action = 'Notified';
    if (n.responseStatus === 'acknowledged') action = 'Acknowledged';
    if (n.responseStatus === 'returning') action = 'Returning product';
    if (n.responseStatus === 'returned') action = 'Returned product';
    if (n.responseStatus === 'unresponsive') action = 'No response';

    return {
      date: n.notifiedAt || '',
      action,
      customer: n.customerName,
    };
  }).sort((a, b) => a.date.localeCompare(b.date));

  // Process reconciliation
  const reconciliation = recallDetails.reconciliation;
  const reconciliationTotals = {
    totalDistributed: recallDetails.distributedQuantity,
    returned: reconciliation.reduce((sum, r) => sum + r.returnedQty, 0),
    destroyed: reconciliation.reduce((sum, r) => sum + r.destroyedQty, 0),
    accounted: reconciliation.reduce((sum, r) => sum + r.accountedQty, 0),
    unaccounted: reconciliation.reduce((sum, r) => sum + r.unaccountedQty, 0),
    effectivenessRate: recallDetails.effectivenessRate,
  };

  // Build timeline of key events
  const timeline = [];

  // Recall initiated
  timeline.push({
    date: recallDetails.initiatedDate,
    event: 'Recall Initiated',
    details: `${recallDetails.recallClass.replace('_', ' ').toUpperCase()} - ${recallDetails.reason}`,
  });

  // Status changes
  if (recallDetails.status === 'in_progress' || recallDetails.status === 'completed' || recallDetails.status === 'closed') {
    timeline.push({
      date: recallDetails.updatedAt,
      event: 'Recall Execution Started',
      details: `Distributed quantity calculated: ${recallDetails.distributedQuantity} units`,
    });
  }

  // Notifications sent
  if (notifications.length > 0) {
    const firstNotification = notifications.reduce((earliest, n) => {
      return (n.notifiedAt || '') < (earliest.notifiedAt || '') ? n : earliest;
    });
    timeline.push({
      date: firstNotification.notifiedAt || '',
      event: 'Customer Notifications Began',
      details: `${notifications.length} customers notified`,
    });
  }

  // Reconciliation started
  if (reconciliation.length > 0) {
    const firstReconciliation = reconciliation.reduce((earliest, r) => {
      return (r.verifiedAt || '') < (earliest.verifiedAt || '') ? r : earliest;
    });
    timeline.push({
      date: firstReconciliation.verifiedAt || '',
      event: 'Reconciliation Started',
      details: `Lot-by-lot reconciliation initiated`,
    });
  }

  // Recall completed
  if (recallDetails.status === 'completed' || recallDetails.status === 'closed') {
    timeline.push({
      date: recallDetails.updatedAt,
      event: 'Recall Completed',
      details: `Effectiveness rate: ${recallDetails.effectivenessRate.toFixed(1)}%`,
    });
  }

  // Recall closed
  if (recallDetails.closureDate) {
    timeline.push({
      date: recallDetails.closureDate,
      event: 'Recall Closed',
      details: `Final effectiveness: ${recallDetails.effectivenessRate.toFixed(1)}%`,
    });
  }

  // Sort timeline
  timeline.sort((a, b) => a.date.localeCompare(b.date));

  // Generate regulatory notes
  let regulatoryNotes = '';

  if (recallDetails.recallClass === 'class_i') {
    regulatoryNotes += 'CLASS I RECALL: This recall involves a product that may cause serious adverse health consequences or death. ';
  } else if (recallDetails.recallClass === 'class_ii') {
    regulatoryNotes += 'CLASS II RECALL: This recall involves a product that may cause temporary or medically reversible adverse health consequences. ';
  } else {
    regulatoryNotes += 'CLASS III RECALL: This recall involves a product that is not likely to cause adverse health consequences. ';
  }

  if (recallDetails.complaintNumber) {
    regulatoryNotes += `This recall was initiated in response to complaint ${recallDetails.complaintNumber}. `;
  }

  regulatoryNotes += `\n\nDistribution: ${recallDetails.distributedQuantity} units distributed to ${customerList.length} customers. `;
  regulatoryNotes += `Notifications sent to all affected customers via multiple methods. `;
  regulatoryNotes += `\n\nReconciliation: ${reconciliationTotals.returned} units returned, `;
  regulatoryNotes += `${reconciliationTotals.destroyed} units destroyed, `;
  regulatoryNotes += `${reconciliationTotals.accounted} units accounted for in stock. `;
  regulatoryNotes += `Total accounted: ${reconciliationTotals.returned + reconciliationTotals.destroyed + reconciliationTotals.accounted} units. `;
  regulatoryNotes += `Unaccounted: ${reconciliationTotals.unaccounted} units. `;
  regulatoryNotes += `\n\nEffectiveness Rate: ${recallDetails.effectivenessRate.toFixed(1)}% - `;

  if (recallDetails.effectivenessRate >= 95) {
    regulatoryNotes += 'Excellent recall effectiveness.';
  } else if (recallDetails.effectivenessRate >= 90) {
    regulatoryNotes += 'Good recall effectiveness.';
  } else if (recallDetails.effectivenessRate >= 75) {
    regulatoryNotes += 'Acceptable recall effectiveness.';
  } else {
    regulatoryNotes += 'Below target recall effectiveness. Additional follow-up actions may be required.';
  }

  // Build and return report
  return {
    generatedAt: new Date().toISOString(),
    recall: {
      recallNumber: recallDetails.recallNumber,
      recallClass: recallDetails.recallClass.replace('_', ' ').toUpperCase(),
      initiatedDate: recallDetails.initiatedDate,
      reason: recallDetails.reason,
      status: recallDetails.status,
      coordinatorName: recallDetails.coordinatorName || 'Unassigned',
    },
    product: {
      name: recallDetails.productName || 'Unknown',
      code: productCode,
      affectedLots: affectedLotDetails,
    },
    distribution: {
      totalDistributed: recallDetails.distributedQuantity,
      customerCount: customerList.length,
      customers: customerList,
    },
    notifications: {
      ...notificationStats,
      timeline: notificationTimeline,
    },
    reconciliation: reconciliationTotals,
    timeline,
    regulatoryNotes,
  };
}

// ============================================
// Helper Functions
// ============================================

function mapRowToRecall(row: DbRecallRow): Recall {
  let affectedLots: number[] = [];
  const affectedLotNumbers: string[] = [];

  if (row.affectedLots) {
    try {
      affectedLots = JSON.parse(row.affectedLots);
    } catch {
      affectedLots = [];
    }
  }

  return {
    id: row.id,
    recallNumber: row.recallNumber,
    initiatedDate: row.initiatedDate,
    recallClass: row.recallClass as RecallClass,
    reason: row.reason,
    productId: row.productId || 0,
    productName: row.productName || undefined,
    affectedLots,
    affectedLotNumbers,
    status: row.status as RecallStatus,
    distributedQuantity: row.distributedQuantity || 0,
    returnedQuantity: row.returnedQuantity || 0,
    reconciledQuantity: row.reconciledQuantity || 0,
    effectivenessRate: row.effectivenessRate || 0,
    regulatoryReportDate: row.regulatoryReportDate,
    closureDate: row.closureDate,
    coordinatorId: row.coordinatorId || 0,
    coordinatorName: row.coordinatorName || undefined,
    complaintId: row.complaintId,
    complaintNumber: row.complaintNumber || undefined,
    createdBy: row.createdBy || 0,
    createdByName: row.createdByName || undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapRowToNotification(row: DbNotificationRow): RecallNotification {
  return {
    id: row.id,
    recallId: row.recallId,
    customerId: row.customerId || 0,
    customerName: row.customerName || '',
    contactInfo: row.contactInfo || '',
    quantityDistributed: row.quantityDistributed || 0,
    notificationMethod: (row.notificationMethod || 'phone') as NotificationMethod,
    notifiedAt: row.notifiedAt,
    acknowledgedAt: row.acknowledgedAt,
    responseStatus: (row.responseStatus || 'pending') as NotificationResponseStatus,
    quantityReturned: row.quantityReturned || 0,
    notes: row.notes,
  };
}

function mapRowToReconciliation(row: DbReconciliationRow): RecallReconciliation {
  return {
    id: row.id,
    recallId: row.recallId,
    lotId: row.lotId || 0,
    lotNumber: row.lotNumber || undefined,
    distributedQty: row.distributedQty || 0,
    returnedQty: row.returnedQty || 0,
    destroyedQty: row.destroyedQty || 0,
    accountedQty: row.accountedQty || 0,
    unaccountedQty: row.unaccountedQty || 0,
    reconciliationNotes: row.reconciliationNotes,
    verifiedBy: row.verifiedBy,
    verifiedByName: row.verifiedByName || undefined,
    verifiedAt: row.verifiedAt,
  };
}
