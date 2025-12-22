/**
 * Recall Service
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * Manages product recalls with distribution tracking, customer notifications,
 * and reconciliation workflow.
 */

import { getDb, isSqlite } from '../db';
import { eq, and, desc, like, or, sql, count, inArray } from 'drizzle-orm';
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
} from '../db/schema';
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

  if (isSqlite()) {
    const result = await (await getDb())
      .select({ recallNumber: sqliteRecalls.recallNumber })
      .from(sqliteRecalls)
      .where(like(sqliteRecalls.recallNumber, `${prefix}%`))
      .orderBy(desc(sqliteRecalls.recallNumber))
      .limit(1);

    if (result.length === 0) {
      return `${prefix}0001`;
    }

    const lastNumber = result[0].recallNumber;
    const sequence = parseInt(lastNumber.slice(-4), 10);
    return `${prefix}${(sequence + 1).toString().padStart(4, '0')}`;
  }

  // MySQL implementation would go here
  return `${prefix}0001`;
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
  const now = new Date().toISOString().split('T')[0];

  if (isSqlite()) {
    const [result] = await (await getDb())
      .insert(sqliteRecalls)
      .values({
        recallNumber,
        initiatedDate: now,
        recallClass: data.recallClass,
        reason: data.reason,
        productId: data.productId,
        affectedLots: JSON.stringify(data.affectedLots),
        status: 'initiated',
        coordinatorId: data.coordinatorId,
        complaintId: data.complaintId || null,
        createdBy: userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning();

    await createAuditLog({
      action: 'CREATE',
      entityType: 'recall',
      entityId: result.id.toString(),
      userId,
      newValue: JSON.stringify({ recallNumber, ...data }),
    });

    return getRecallById(result.id) as Promise<Recall>;
  }

  throw new Error('MySQL not implemented');
}

/**
 * Get recall by ID
 */
export async function getRecallById(id: number): Promise<Recall | null> {
  if (isSqlite()) {
    const result = await (await getDb())
      .select({
        id: sqliteRecalls.id,
        recallNumber: sqliteRecalls.recallNumber,
        initiatedDate: sqliteRecalls.initiatedDate,
        recallClass: sqliteRecalls.recallClass,
        reason: sqliteRecalls.reason,
        productId: sqliteRecalls.productId,
        productName: sqliteItems.name,
        affectedLots: sqliteRecalls.affectedLots,
        status: sqliteRecalls.status,
        distributedQuantity: sqliteRecalls.distributedQuantity,
        returnedQuantity: sqliteRecalls.returnedQuantity,
        reconciledQuantity: sqliteRecalls.reconciledQuantity,
        effectivenessRate: sqliteRecalls.effectivenessRate,
        regulatoryReportDate: sqliteRecalls.regulatoryReportDate,
        closureDate: sqliteRecalls.closureDate,
        coordinatorId: sqliteRecalls.coordinatorId,
        coordinatorName: sqliteUsers.name,
        complaintId: sqliteRecalls.complaintId,
        complaintNumber: sqliteComplaints.complaintNumber,
        createdBy: sqliteRecalls.createdBy,
        createdAt: sqliteRecalls.createdAt,
        updatedAt: sqliteRecalls.updatedAt,
      })
      .from(sqliteRecalls)
      .leftJoin(sqliteItems, eq(sqliteRecalls.productId, sqliteItems.id))
      .leftJoin(sqliteUsers, eq(sqliteRecalls.coordinatorId, sqliteUsers.id))
      .leftJoin(sqliteComplaints, eq(sqliteRecalls.complaintId, sqliteComplaints.id))
      .where(eq(sqliteRecalls.id, id))
      .limit(1);

    if (result.length === 0) return null;

    const row = result[0] as DbRecallRow;
    return mapRowToRecall(row);
  }

  return null;
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
    // Get basic complaint info
    if (isSqlite()) {
      const result = await (await getDb())
        .select({
          id: sqliteComplaints.id,
          complaintNumber: sqliteComplaints.complaintNumber,
          category: sqliteComplaints.category,
          severity: sqliteComplaints.severity,
          description: sqliteComplaints.description,
        })
        .from(sqliteComplaints)
        .where(eq(sqliteComplaints.id, recall.complaintId))
        .limit(1);

      complaint = result[0] || null;
    }
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

  if (isSqlite()) {
    await (await getDb())
      .update(sqliteRecalls)
      .set({
        ...data,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(sqliteRecalls.id, id));

    await createAuditLog({
      action: 'UPDATE',
      entityType: 'recall',
      entityId: id.toString(),
      userId,
      oldValue: JSON.stringify(existing),
      newValue: JSON.stringify(data),
    });

    return getRecallById(id);
  }

  return null;
}

/**
 * List recalls with filters
 */
export async function listRecalls(
  params: RecallListParams
): Promise<RecallListResponse> {
  const { status, recallClass, productId, page = 1, limit = 20 } = params;
  const offset = (page - 1) * limit;

  if (isSqlite()) {
    // Build conditions array
    const conditions = [];
    if (status) conditions.push(eq(sqliteRecalls.status, status));
    if (recallClass) conditions.push(eq(sqliteRecalls.recallClass, recallClass));
    if (productId) conditions.push(eq(sqliteRecalls.productId, productId));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const countResult = await (await getDb())
      .select({ count: count() })
      .from(sqliteRecalls)
      .where(whereClause);

    const total = countResult[0]?.count || 0;

    // Get recalls
    const result = await (await getDb())
      .select({
        id: sqliteRecalls.id,
        recallNumber: sqliteRecalls.recallNumber,
        initiatedDate: sqliteRecalls.initiatedDate,
        recallClass: sqliteRecalls.recallClass,
        reason: sqliteRecalls.reason,
        productId: sqliteRecalls.productId,
        productName: sqliteItems.name,
        affectedLots: sqliteRecalls.affectedLots,
        status: sqliteRecalls.status,
        distributedQuantity: sqliteRecalls.distributedQuantity,
        returnedQuantity: sqliteRecalls.returnedQuantity,
        reconciledQuantity: sqliteRecalls.reconciledQuantity,
        effectivenessRate: sqliteRecalls.effectivenessRate,
        regulatoryReportDate: sqliteRecalls.regulatoryReportDate,
        closureDate: sqliteRecalls.closureDate,
        coordinatorId: sqliteRecalls.coordinatorId,
        coordinatorName: sqliteUsers.name,
        complaintId: sqliteRecalls.complaintId,
        complaintNumber: sqliteComplaints.complaintNumber,
        createdBy: sqliteRecalls.createdBy,
        createdAt: sqliteRecalls.createdAt,
        updatedAt: sqliteRecalls.updatedAt,
      })
      .from(sqliteRecalls)
      .leftJoin(sqliteItems, eq(sqliteRecalls.productId, sqliteItems.id))
      .leftJoin(sqliteUsers, eq(sqliteRecalls.coordinatorId, sqliteUsers.id))
      .leftJoin(sqliteComplaints, eq(sqliteRecalls.complaintId, sqliteComplaints.id))
      .where(whereClause)
      .orderBy(desc(sqliteRecalls.createdAt))
      .limit(limit)
      .offset(offset);

    const recalls = result.map((row) => mapRowToRecall(row as DbRecallRow));

    return { recalls, total };
  }

  return { recalls: [], total: 0 };
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

  if (isSqlite()) {
    // Get sales orders that shipped these lots
    const result = await (await getDb())
      .select({
        customerId: sqliteCustomers.id,
        customerName: sqliteCustomers.name,
        contactInfo: sqliteCustomers.phone,
        lotId: sqliteSalesOrderLines.lotId,
        lotNumber: sqliteInventoryLots.lotNumber,
        quantityDistributed: sqliteSalesOrderLines.shippedQuantity,
        shipDate: sqliteSalesOrders.shippedDate,
      })
      .from(sqliteSalesOrderLines)
      .innerJoin(sqliteSalesOrders, eq(sqliteSalesOrderLines.soId, sqliteSalesOrders.id))
      .innerJoin(sqliteInventoryLots, eq(sqliteSalesOrderLines.lotId, sqliteInventoryLots.id))
      .innerJoin(sqliteCustomers, eq(
        sql`CAST(${sqliteSalesOrders.customerName} AS TEXT)`,
        sqliteCustomers.name
      ))
      .where(
        and(
          inArray(sqliteSalesOrderLines.lotId, lotIds),
          eq(sqliteSalesOrders.status, 'delivered')
        )
      );

    return result.map((row) => ({
      customerId: row.customerId || 0,
      customerName: row.customerName || 'Unknown',
      contactInfo: row.contactInfo || '',
      lotId: row.lotId || 0,
      lotNumber: row.lotNumber || '',
      quantityDistributed: row.quantityDistributed || 0,
      shipDate: row.shipDate || '',
    }));
  }

  return [];
}

/**
 * Calculate distributed quantity for a recall
 */
export async function calculateDistributedQuantity(
  lotIds: number[]
): Promise<number> {
  if (lotIds.length === 0) return 0;

  if (isSqlite()) {
    const result = await (await getDb())
      .select({
        total: sql<number>`SUM(${sqliteSalesOrderLines.shippedQuantity})`,
      })
      .from(sqliteSalesOrderLines)
      .innerJoin(sqliteSalesOrders, eq(sqliteSalesOrderLines.soId, sqliteSalesOrders.id))
      .where(
        and(
          inArray(sqliteSalesOrderLines.lotId, lotIds),
          eq(sqliteSalesOrders.status, 'delivered')
        )
      );

    return result[0]?.total || 0;
  }

  return 0;
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
  if (isSqlite()) {
    const result = await (await getDb())
      .select({
        id: sqliteRecallNotifications.id,
        recallId: sqliteRecallNotifications.recallId,
        customerId: sqliteRecallNotifications.customerId,
        customerName: sqliteRecallNotifications.customerName,
        contactInfo: sqliteRecallNotifications.contactInfo,
        quantityDistributed: sqliteRecallNotifications.quantityDistributed,
        notificationMethod: sqliteRecallNotifications.notificationMethod,
        notifiedAt: sqliteRecallNotifications.notifiedAt,
        acknowledgedAt: sqliteRecallNotifications.acknowledgedAt,
        responseStatus: sqliteRecallNotifications.responseStatus,
        quantityReturned: sqliteRecallNotifications.quantityReturned,
        notes: sqliteRecallNotifications.notes,
      })
      .from(sqliteRecallNotifications)
      .where(eq(sqliteRecallNotifications.recallId, recallId))
      .orderBy(desc(sqliteRecallNotifications.notifiedAt));

    return result.map((row) => mapRowToNotification(row as DbNotificationRow));
  }

  return [];
}

/**
 * Create notification record for a customer
 */
export async function createNotification(
  recallId: number,
  data: RecallNotificationCreate,
  userId: number
): Promise<RecallNotification> {
  // Get customer details
  let customerName = '';
  let contactInfo = '';
  let quantityDistributed = 0;

  if (isSqlite()) {
    const customer = await (await getDb())
      .select({
        name: sqliteCustomers.name,
        phone: sqliteCustomers.phone,
        email: sqliteCustomers.email,
      })
      .from(sqliteCustomers)
      .where(eq(sqliteCustomers.id, data.customerId))
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

    const [result] = await (await getDb())
      .insert(sqliteRecallNotifications)
      .values({
        recallId,
        customerId: data.customerId,
        customerName,
        contactInfo,
        quantityDistributed,
        notificationMethod: data.notificationMethod,
        notifiedAt: new Date().toISOString(),
        responseStatus: 'pending',
        notes: data.notes || null,
        createdAt: new Date().toISOString(),
      })
      .returning();

    await createAuditLog({
      action: 'CREATE',
      entityType: 'recall_notification',
      entityId: result.id.toString(),
      userId,
      newValue: JSON.stringify({ recallId, ...data }),
    });

    const notifications = await getRecallNotifications(recallId);
    return notifications.find(n => n.id === result.id)!;
  }

  throw new Error('MySQL not implemented');
}

/**
 * Update notification status/response
 */
export async function updateNotification(
  id: number,
  data: RecallNotificationUpdate,
  userId: number
): Promise<RecallNotification | null> {
  if (isSqlite()) {
    const existing = await (await getDb())
      .select()
      .from(sqliteRecallNotifications)
      .where(eq(sqliteRecallNotifications.id, id))
      .limit(1);

    if (existing.length === 0) return null;

    const updateData: Record<string, unknown> = {};
    if (data.responseStatus) updateData.responseStatus = data.responseStatus;
    if (data.quantityReturned !== undefined) updateData.quantityReturned = data.quantityReturned;
    if (data.notes !== undefined) updateData.notes = data.notes;

    if (data.responseStatus === 'acknowledged') {
      updateData.acknowledgedAt = new Date().toISOString();
    }

    await (await getDb())
      .update(sqliteRecallNotifications)
      .set(updateData)
      .where(eq(sqliteRecallNotifications.id, id));

    // Update recall totals
    const notification = existing[0];
    await updateRecallTotals(notification.recallId);

    await createAuditLog({
      action: 'UPDATE',
      entityType: 'recall_notification',
      entityId: id.toString(),
      userId,
      oldValue: JSON.stringify(existing[0]),
      newValue: JSON.stringify(data),
    });

    const notifications = await getRecallNotifications(notification.recallId);
    return notifications.find(n => n.id === id) || null;
  }

  return null;
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
  if (isSqlite()) {
    const result = await (await getDb())
      .select({
        id: sqliteRecallReconciliation.id,
        recallId: sqliteRecallReconciliation.recallId,
        lotId: sqliteRecallReconciliation.lotId,
        lotNumber: sqliteInventoryLots.lotNumber,
        distributedQty: sqliteRecallReconciliation.distributedQty,
        returnedQty: sqliteRecallReconciliation.returnedQty,
        destroyedQty: sqliteRecallReconciliation.destroyedQty,
        accountedQty: sqliteRecallReconciliation.accountedQty,
        unaccountedQty: sqliteRecallReconciliation.unaccountedQty,
        reconciliationNotes: sqliteRecallReconciliation.reconciliationNotes,
        verifiedBy: sqliteRecallReconciliation.verifiedBy,
        verifiedByName: sqliteUsers.name,
        verifiedAt: sqliteRecallReconciliation.verifiedAt,
      })
      .from(sqliteRecallReconciliation)
      .leftJoin(sqliteInventoryLots, eq(sqliteRecallReconciliation.lotId, sqliteInventoryLots.id))
      .leftJoin(sqliteUsers, eq(sqliteRecallReconciliation.verifiedBy, sqliteUsers.id))
      .where(eq(sqliteRecallReconciliation.recallId, recallId));

    return result.map((row) => mapRowToReconciliation(row as DbReconciliationRow));
  }

  return [];
}

/**
 * Create or update reconciliation record
 */
export async function recordReconciliation(
  recallId: number,
  data: RecallReconciliationCreate,
  userId: number
): Promise<RecallReconciliation> {
  if (isSqlite()) {
    // Check if reconciliation exists for this lot
    const existing = await (await getDb())
      .select()
      .from(sqliteRecallReconciliation)
      .where(
        and(
          eq(sqliteRecallReconciliation.recallId, recallId),
          eq(sqliteRecallReconciliation.lotId, data.lotId)
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
      await (await getDb())
        .update(sqliteRecallReconciliation)
        .set({
          returnedQty,
          destroyedQty,
          accountedQty,
          unaccountedQty,
          reconciliationNotes: data.reconciliationNotes || null,
          verifiedBy: userId,
          verifiedAt: new Date().toISOString(),
        })
        .where(eq(sqliteRecallReconciliation.id, existing[0].id));

      await createAuditLog({
        action: 'UPDATE',
        entityType: 'recall_reconciliation',
        entityId: existing[0].id.toString(),
        userId,
        oldValue: JSON.stringify(existing[0]),
        newValue: JSON.stringify(data),
      });
    } else {
      // Create new
      const [result] = await (await getDb())
        .insert(sqliteRecallReconciliation)
        .values({
          recallId,
          lotId: data.lotId,
          distributedQty,
          returnedQty,
          destroyedQty,
          accountedQty,
          unaccountedQty,
          reconciliationNotes: data.reconciliationNotes || null,
          verifiedBy: userId,
          verifiedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        })
        .returning();

      await createAuditLog({
        action: 'CREATE',
        entityType: 'recall_reconciliation',
        entityId: result.id.toString(),
        userId,
        newValue: JSON.stringify({ recallId, ...data }),
      });
    }

    // Update recall totals
    await updateRecallTotals(recallId);

    const reconciliation = await getRecallReconciliation(recallId);
    return reconciliation.find(r => r.lotId === data.lotId)!;
  }

  throw new Error('MySQL not implemented');
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

  if (isSqlite()) {
    await (await getDb())
      .update(sqliteRecalls)
      .set({
        status: 'in_progress',
        distributedQuantity: distributedQty,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(sqliteRecalls.id, id));

    await createAuditLog({
      action: 'UPDATE',
      entityType: 'recall',
      entityId: id.toString(),
      userId,
      oldValue: JSON.stringify({ status: 'initiated' }),
      newValue: JSON.stringify({ status: 'in_progress', distributedQuantity: distributedQty }),
    });

    return getRecallById(id);
  }

  return null;
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

  if (isSqlite()) {
    await (await getDb())
      .update(sqliteRecalls)
      .set({
        status: 'completed',
        updatedAt: new Date().toISOString(),
      })
      .where(eq(sqliteRecalls.id, id));

    await createAuditLog({
      action: 'UPDATE',
      entityType: 'recall',
      entityId: id.toString(),
      userId,
      oldValue: JSON.stringify({ status: 'in_progress' }),
      newValue: JSON.stringify({ status: 'completed' }),
    });

    return getRecallById(id);
  }

  return null;
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

  if (isSqlite()) {
    await (await getDb())
      .update(sqliteRecalls)
      .set({
        status: 'closed',
        closureDate: new Date().toISOString().split('T')[0],
        regulatoryReportDate: data.regulatoryReportPath
          ? new Date().toISOString().split('T')[0]
          : null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(sqliteRecalls.id, id));

    await createAuditLog({
      action: 'UPDATE',
      entityType: 'recall',
      entityId: id.toString(),
      userId,
      oldValue: JSON.stringify({ status: 'completed' }),
      newValue: JSON.stringify({ status: 'closed', ...data }),
    });

    return getRecallById(id);
  }

  return null;
}

/**
 * Update recall totals (returned quantity, reconciled quantity, effectiveness rate)
 */
async function updateRecallTotals(recallId: number): Promise<void> {
  if (isSqlite()) {
    // Sum returned quantities from notifications
    const notificationResult = await (await getDb())
      .select({
        totalReturned: sql<number>`SUM(${sqliteRecallNotifications.quantityReturned})`,
      })
      .from(sqliteRecallNotifications)
      .where(eq(sqliteRecallNotifications.recallId, recallId));

    // Sum reconciled quantities
    const reconciliationResult = await (await getDb())
      .select({
        totalReconciled: sql<number>`SUM(${sqliteRecallReconciliation.returnedQty} + ${sqliteRecallReconciliation.destroyedQty} + ${sqliteRecallReconciliation.accountedQty})`,
      })
      .from(sqliteRecallReconciliation)
      .where(eq(sqliteRecallReconciliation.recallId, recallId));

    const returnedQuantity = notificationResult[0]?.totalReturned || 0;
    const reconciledQuantity = reconciliationResult[0]?.totalReconciled || 0;

    // Get distributed quantity
    const recall = await getRecallById(recallId);
    const distributedQuantity = recall?.distributedQuantity || 0;

    // Calculate effectiveness rate
    const effectivenessRate = distributedQuantity > 0
      ? (reconciledQuantity / distributedQuantity) * 100
      : 0;

    await (await getDb())
      .update(sqliteRecalls)
      .set({
        returnedQuantity,
        reconciledQuantity,
        effectivenessRate,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(sqliteRecalls.id, recallId));
  }
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

  if (isSqlite()) {
    // Get lot information
    const lot = await (await getDb())
      .select({
        id: sqliteInventoryLots.id,
        lotNumber: sqliteInventoryLots.lotNumber,
      })
      .from(sqliteInventoryLots)
      .where(eq(sqliteInventoryLots.id, data.lotId))
      .limit(1);

    if (lot.length === 0) {
      throw new Error(`Lot ID ${data.lotId} not found`);
    }

    // Get distribution data
    const distribution = await (await getDb())
      .select({
        customerId: sqliteCustomers.id,
        customerName: sqliteCustomers.name,
        contactInfo: sqliteCustomers.phone,
        lotId: sqliteSalesOrderLines.lotId,
        lotNumber: sqliteInventoryLots.lotNumber,
        quantityDistributed: sqliteSalesOrderLines.shippedQuantity,
        shipDate: sqliteSalesOrders.shippedDate,
      })
      .from(sqliteSalesOrderLines)
      .innerJoin(sqliteSalesOrders, eq(sqliteSalesOrderLines.soId, sqliteSalesOrders.id))
      .innerJoin(sqliteInventoryLots, eq(sqliteSalesOrderLines.lotId, sqliteInventoryLots.id))
      .leftJoin(sqliteCustomers, eq(
        sql`${sqliteSalesOrders.customerName}`,
        sqliteCustomers.name
      ))
      .where(
        and(
          eq(sqliteSalesOrderLines.lotId, data.lotId),
          eq(sqliteSalesOrders.status, 'delivered')
        )
      );

    const endTime = Date.now();
    const timeToIdentify = (endTime - startTime) / 1000; // Convert to seconds

    const distributionReport: DistributionRecord[] = distribution.map((row) => ({
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
      entityType: 'mock_drill',
      entityId: drillId,
      userId,
      newValue: JSON.stringify({
        drillId,
        lotId: data.lotId,
        customersIdentified: uniqueCustomers,
        timeToIdentify,
        passedTarget,
      }),
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

  throw new Error('MySQL not implemented');
}

// ============================================
// Helper Functions
// ============================================

function mapRowToRecall(row: DbRecallRow): Recall {
  let affectedLots: number[] = [];
  let affectedLotNumbers: string[] = [];

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
