/**
 * Inventory Service
 * Real-world inventory management with FEFO algorithm and lot traceability
 */

import { getDb, useSqlite } from '../db';
import { eq, and, gte, lte, desc, asc, sql, or } from 'drizzle-orm';
import {
  sqliteInventoryLots,
  sqliteInventoryTransactions,
  sqliteItems,
  sqliteWarehouses,
  mysqlInventoryLots,
  mysqlInventoryTransactions,
  mysqlItems,
  mysqlWarehouses,
} from '../db/schema';
import { createAuditLog } from '../audit';

// Types
export interface LotAllocation {
  lotId: number;
  lotNumber: string;
  quantity: number;
  expiryDate: string | null;
}

export interface StockSummary {
  itemId: number;
  itemCode: string;
  itemName: string;
  onHand: number;
  available: number;
  reserved: number;
  quarantine: number;
  blocked: number;
  unit: string;
}

export interface TraceabilityResult {
  level: number;
  direction: 'forward' | 'backward';
  workOrderNumber?: string;
  itemCode: string;
  itemName: string;
  lotNumber: string;
  batchNumber?: string;
  quantity: number;
  date?: string;
  vendor?: string;
  coaNumber?: string;
}

// Get table references based on database type
function getTables() {
  if (useSqlite()) {
    return {
      lots: sqliteInventoryLots,
      transactions: sqliteInventoryTransactions,
      items: sqliteItems,
      warehouses: sqliteWarehouses,
    };
  }
  return {
    lots: mysqlInventoryLots,
    transactions: mysqlInventoryTransactions,
    items: mysqlItems,
    warehouses: mysqlWarehouses,
  };
}

/**
 * Recalculate and update item's onHand quantity from released lots
 * Call this whenever lot quantities or statuses change
 */
export async function recalculateItemOnHand(itemId: number): Promise<number> {
  const { lots, items } = getTables();
  const database = await getDb();
  const isSqlite = useSqlite();

  // Sum quantities from released lots for this item
  const [result] = await (database as any)
    .select({
      totalOnHand: sql`COALESCE(SUM(${lots.quantity}), 0)`,
    })
    .from(lots)
    .where(and(eq(lots.itemId, itemId), eq(lots.status, 'released')));

  const onHand = Number(result?.totalOnHand) || 0;

  // Update item's onHand field
  const now = new Date();
  await (database as any)
    .update(items)
    .set({
      onHand,
      updatedAt: isSqlite ? now.toISOString() : now,
    })
    .where(eq(items.id, itemId));

  return onHand;
}

/**
 * FEFO Algorithm - First Expiry First Out
 * Returns lots ordered by expiry date for picking
 */
export async function getLotsForPicking(
  itemId: number,
  requiredQuantity: number,
  warehouseId?: number
): Promise<{ allocated: LotAllocation[]; remaining: number }> {
  const { lots } = getTables();
  const database = await getDb();

  // Build query conditions
  const conditions = [
    eq(lots.itemId, itemId),
    eq(lots.status, 'released'),
    sql`${lots.quantity} - ${lots.reservedQuantity} > 0`,
  ];

  if (warehouseId) {
    conditions.push(eq(lots.warehouseId, warehouseId));
  }

  // Get all released lots ordered by expiry date (FEFO)
  const availableLots = await database
    .select({
      id: lots.id,
      lotNumber: lots.lotNumber,
      quantity: lots.quantity,
      reservedQuantity: lots.reservedQuantity,
      expiryDate: lots.expiryDate,
    })
    .from(lots)
    .where(and(...conditions))
    .orderBy(asc(lots.expiryDate), asc(lots.id));

  // Allocate from earliest expiry first
  const allocated: LotAllocation[] = [];
  let remaining = requiredQuantity;

  for (const lot of availableLots) {
    if (remaining <= 0) break;

    const available = (lot.quantity || 0) - (lot.reservedQuantity || 0);
    if (available > 0) {
      const allocateQty = Math.min(available, remaining);
      allocated.push({
        lotId: lot.id,
        lotNumber: lot.lotNumber,
        quantity: allocateQty,
        expiryDate: lot.expiryDate,
      });
      remaining -= allocateQty;
    }
  }

  return { allocated, remaining };
}

/**
 * Reserve lots for an order/work order
 */
export async function reserveLots(
  allocations: LotAllocation[],
  referenceType: string,
  referenceId: number,
  userId: number
): Promise<boolean> {
  const { lots } = getTables();
  const database = await getDb();

  for (const alloc of allocations) {
    // Update reserved quantity
    await database
      .update(lots)
      .set({
        reservedQuantity: sql`${lots.reservedQuantity} + ${alloc.quantity}`,
      })
      .where(eq(lots.id, alloc.lotId));

    // Create audit log
    await createAuditLog({
      userId,
      action: 'RESERVE',
      tableName: 'inventory_lots',
      recordId: alloc.lotId,
      newValue: {
        quantity: alloc.quantity,
        referenceType,
        referenceId,
      },
    });
  }

  return true;
}

/**
 * Issue materials from inventory (deduct stock)
 */
export async function issueMaterial(
  lotId: number,
  quantity: number,
  referenceType: string,
  referenceId: number,
  referenceNumber: string,
  userId: number,
  reason?: string
): Promise<number> {
  const { lots, transactions } = getTables();
  const database = await getDb();

  // Get current lot
  const [lot] = await database
    .select()
    .from(lots)
    .where(eq(lots.id, lotId));

  if (!lot) {
    throw new Error(`Lot ${lotId} not found`);
  }

  if (lot.status !== 'released') {
    throw new Error(`Lot ${lot.lotNumber} is not released (status: ${lot.status})`);
  }

  const available = (lot.quantity || 0) - (lot.reservedQuantity || 0);
  if (available < quantity) {
    throw new Error(`Insufficient quantity. Available: ${available}, Requested: ${quantity}`);
  }

  // Deduct quantity
  await database
    .update(lots)
    .set({
      quantity: sql`${lots.quantity} - ${quantity}`,
      reservedQuantity: sql`CASE WHEN ${lots.reservedQuantity} >= ${quantity} THEN ${lots.reservedQuantity} - ${quantity} ELSE 0 END`,
    })
    .where(eq(lots.id, lotId));

  // Create transaction record
  const [txn] = await database
    .insert(transactions)
    .values({
      lotId,
      transactionType: 'issue',
      quantity: -quantity, // Negative for issue
      unit: lot.unit,
      referenceType,
      referenceId,
      referenceNumber,
      fromWarehouseId: lot.warehouseId,
      reason,
      performedBy: userId,
    })
    .returning({ id: transactions.id });

  // Create audit log
  await createAuditLog({
    userId,
    action: 'ISSUE',
    tableName: 'inventory_transactions',
    recordId: txn.id,
    newValue: {
      lotId,
      lotNumber: lot.lotNumber,
      quantity,
      referenceType,
      referenceNumber,
    },
  });

  return txn.id;
}

/**
 * Receive materials into inventory
 */
export async function receiveMaterial(
  itemId: number,
  lotNumber: string,
  quantity: number,
  unit: string,
  warehouseId: number,
  expiryDate: string | null,
  vendorId: number | null,
  poNumber: string | null,
  userId: number
): Promise<number> {
  const { lots, transactions } = getTables();
  const database = await getDb();

  // Create new lot in quarantine status
  const [newLot] = await database
    .insert(lots)
    .values({
      itemId,
      lotNumber,
      warehouseId,
      quantity,
      reservedQuantity: 0,
      unit,
      status: 'quarantine', // Always start in quarantine
      expiryDate,
      receivedDate: new Date().toISOString().split('T')[0],
      vendorId,
      poNumber,
    })
    .returning({ id: lots.id });

  // Create transaction record
  const [txn] = await database
    .insert(transactions)
    .values({
      lotId: newLot.id,
      transactionType: 'receive',
      quantity,
      unit,
      referenceType: 'PO',
      referenceNumber: poNumber,
      toWarehouseId: warehouseId,
      performedBy: userId,
    })
    .returning({ id: transactions.id });

  // Create audit log
  await createAuditLog({
    userId,
    action: 'RECEIVE',
    tableName: 'inventory_lots',
    recordId: newLot.id,
    newValue: {
      lotNumber,
      quantity,
      status: 'quarantine',
      poNumber,
    },
  });

  return newLot.id;
}

/**
 * Release or reject a lot after QC
 */
export async function updateLotStatus(
  lotId: number,
  newStatus: 'released' | 'rejected' | 'blocked',
  userId: number,
  reason?: string,
  coaNumber?: string
): Promise<boolean> {
  const { lots } = getTables();
  const database = await getDb();

  // Get current lot
  const [lot] = await database
    .select()
    .from(lots)
    .where(eq(lots.id, lotId));

  if (!lot) {
    throw new Error(`Lot ${lotId} not found`);
  }

  const oldStatus = lot.status;

  // Update status
  const updateData: Record<string, unknown> = {
    status: newStatus,
    updatedAt: new Date().toISOString(),
  };

  if (coaNumber) {
    updateData.coaNumber = coaNumber;
  }

  await database
    .update(lots)
    .set(updateData)
    .where(eq(lots.id, lotId));

  // Create audit log
  await createAuditLog({
    userId,
    action: 'UPDATE',
    tableName: 'inventory_lots',
    recordId: lotId,
    oldValue: { status: oldStatus },
    newValue: { status: newStatus, reason, coaNumber },
  });

  return true;
}

/**
 * Get stock summary for an item
 */
export async function getStockSummary(itemId: number): Promise<StockSummary | null> {
  const { lots, items } = getTables();
  const database = await getDb();

  // Get item info
  const [item] = await database
    .select()
    .from(items)
    .where(eq(items.id, itemId));

  if (!item) return null;

  // Get stock by status
  const stockData = await database
    .select({
      status: lots.status,
      totalQuantity: sql<number>`COALESCE(SUM(${lots.quantity}), 0)`,
      totalReserved: sql<number>`COALESCE(SUM(${lots.reservedQuantity}), 0)`,
    })
    .from(lots)
    .where(eq(lots.itemId, itemId))
    .groupBy(lots.status);

  let onHand = 0;
  let reserved = 0;
  let quarantine = 0;
  let blocked = 0;

  for (const row of stockData) {
    const qty = Number(row.totalQuantity) || 0;
    const res = Number(row.totalReserved) || 0;

    if (row.status === 'released') {
      onHand += qty;
      reserved += res;
    } else if (row.status === 'quarantine' || row.status === 'under_test') {
      quarantine += qty;
    } else if (row.status === 'blocked' || row.status === 'rejected') {
      blocked += qty;
    }
  }

  return {
    itemId,
    itemCode: item.code,
    itemName: item.nameEn || item.nameTh,
    onHand,
    available: onHand - reserved,
    reserved,
    quarantine,
    blocked,
    unit: item.primaryUnit,
  };
}

/**
 * Check expiry alerts
 */
export async function checkExpiryAlerts(daysThreshold: number = 30): Promise<{
  nearExpiry: Array<{ lotId: number; lotNumber: string; itemName: string; expiryDate: string; daysToExpiry: number }>;
  expired: Array<{ lotId: number; lotNumber: string; itemName: string; expiryDate: string }>;
}> {
  const { lots, items } = getTables();
  const database = await getDb();

  const today = new Date().toISOString().split('T')[0];
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);
  const thresholdDateStr = thresholdDate.toISOString().split('T')[0];

  // Get near expiry lots
  const nearExpiryLots = await database
    .select({
      lotId: lots.id,
      lotNumber: lots.lotNumber,
      itemName: items.nameEn,
      expiryDate: lots.expiryDate,
    })
    .from(lots)
    .innerJoin(items, eq(lots.itemId, items.id))
    .where(
      and(
        eq(lots.status, 'released'),
        gte(lots.expiryDate, today),
        lte(lots.expiryDate, thresholdDateStr)
      )
    )
    .orderBy(asc(lots.expiryDate));

  // Get expired lots
  const expiredLots = await database
    .select({
      lotId: lots.id,
      lotNumber: lots.lotNumber,
      itemName: items.nameEn,
      expiryDate: lots.expiryDate,
    })
    .from(lots)
    .innerJoin(items, eq(lots.itemId, items.id))
    .where(
      and(
        or(eq(lots.status, 'released'), eq(lots.status, 'quarantine')),
        sql`${lots.expiryDate} < ${today}`
      )
    );

  return {
    nearExpiry: nearExpiryLots.map((lot: any) => ({
      ...lot,
      itemName: lot.itemName || '',
      expiryDate: lot.expiryDate || '',
      daysToExpiry: Math.ceil(
        (new Date(lot.expiryDate || '').getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24)
      ),
    })),
    expired: expiredLots.map((lot: any) => ({
      ...lot,
      itemName: lot.itemName || '',
      expiryDate: lot.expiryDate || '',
    })),
  };
}

/**
 * Forward Traceability - Trace from raw material lot to finished products
 */
export async function traceForward(lotId: number, level: number = 0): Promise<TraceabilityResult[]> {
  const { lots, transactions, items } = getTables();
  const database = await getDb();

  const results: TraceabilityResult[] = [];

  // Find all transactions where this lot was issued
  const issueTxns = await database
    .select({
      referenceType: transactions.referenceType,
      referenceId: transactions.referenceId,
      referenceNumber: transactions.referenceNumber,
      quantity: transactions.quantity,
      createdAt: transactions.createdAt,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.lotId, lotId),
        eq(transactions.transactionType, 'issue')
      )
    );

  for (const txn of issueTxns) {
    if (txn.referenceType === 'WO' && txn.referenceId) {
      // Find output lots from this work order
      const outputLots = await database
        .select({
          lotId: lots.id,
          lotNumber: lots.lotNumber,
          batchNumber: lots.batchNumber,
          quantity: lots.quantity,
          itemId: lots.itemId,
          itemCode: items.code,
          itemName: items.nameEn,
          itemType: items.type,
        })
        .from(lots)
        .innerJoin(items, eq(lots.itemId, items.id))
        .innerJoin(transactions, eq(lots.id, transactions.lotId))
        .where(
          and(
            eq(transactions.referenceType, 'WO'),
            eq(transactions.referenceId, txn.referenceId),
            eq(transactions.transactionType, 'receive')
          )
        );

      for (const output of outputLots) {
        results.push({
          level: level + 1,
          direction: 'forward',
          workOrderNumber: txn.referenceNumber || undefined,
          itemCode: output.itemCode,
          itemName: output.itemName || output.itemCode,
          lotNumber: output.lotNumber,
          batchNumber: output.batchNumber || undefined,
          quantity: Math.abs(Number(txn.quantity) || 0),
          date: txn.createdAt || undefined,
        });

        // Recursive trace for WIP items
        if (output.itemType === 'wip' || output.itemType === 'extract') {
          const subResults = await traceForward(output.lotId, level + 1);
          results.push(...subResults);
        }
      }
    }
  }

  return results;
}

/**
 * Backward Traceability - Trace from finished product to raw materials
 */
export async function traceBackward(lotId: number, level: number = 0): Promise<TraceabilityResult[]> {
  const { lots, transactions, items } = getTables();
  const database = await getDb();

  const results: TraceabilityResult[] = [];

  // Get the lot info
  const [lot] = await database
    .select()
    .from(lots)
    .where(eq(lots.id, lotId));

  if (!lot) return results;

  // Find the work order that produced this lot
  const [produceTxn] = await database
    .select({
      referenceType: transactions.referenceType,
      referenceId: transactions.referenceId,
      referenceNumber: transactions.referenceNumber,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.lotId, lotId),
        eq(transactions.transactionType, 'receive'),
        eq(transactions.referenceType, 'WO')
      )
    );

  if (!produceTxn || !produceTxn.referenceId) {
    // This is a purchased lot, not produced
    return results;
  }

  // Find all materials issued to this work order
  const issueTxns = await database
    .select({
      lotId: transactions.lotId,
      quantity: transactions.quantity,
      createdAt: transactions.createdAt,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.referenceType, 'WO'),
        eq(transactions.referenceId, produceTxn.referenceId),
        eq(transactions.transactionType, 'issue')
      )
    );

  for (const txn of issueTxns) {
    // Get input lot details
    const [inputLot] = await database
      .select({
        lotId: lots.id,
        lotNumber: lots.lotNumber,
        batchNumber: lots.batchNumber,
        coaNumber: lots.coaNumber,
        itemId: lots.itemId,
        itemCode: items.code,
        itemName: items.nameEn,
        itemType: items.type,
        vendorId: lots.vendorId,
      })
      .from(lots)
      .innerJoin(items, eq(lots.itemId, items.id))
      .where(eq(lots.id, txn.lotId));

    if (inputLot) {
      results.push({
        level: level + 1,
        direction: 'backward',
        workOrderNumber: produceTxn.referenceNumber || undefined,
        itemCode: inputLot.itemCode,
        itemName: inputLot.itemName || inputLot.itemCode,
        lotNumber: inputLot.lotNumber,
        batchNumber: inputLot.batchNumber || undefined,
        quantity: Math.abs(Number(txn.quantity) || 0),
        date: txn.createdAt || undefined,
        coaNumber: inputLot.coaNumber || undefined,
      });

      // Recursive trace for WIP items
      if (inputLot.itemType === 'wip' || inputLot.itemType === 'extract') {
        const subResults = await traceBackward(inputLot.lotId, level + 1);
        results.push(...subResults);
      }
    }
  }

  return results;
}

/**
 * Inventory Adjustment
 */
export async function adjustInventory(
  lotId: number,
  newQuantity: number,
  reason: string,
  userId: number,
  approvedBy?: number
): Promise<number> {
  const { lots, transactions } = getTables();
  const database = await getDb();

  // Get current lot
  const [lot] = await database
    .select()
    .from(lots)
    .where(eq(lots.id, lotId));

  if (!lot) {
    throw new Error(`Lot ${lotId} not found`);
  }

  const oldQuantity = lot.quantity || 0;
  const adjustmentQty = newQuantity - oldQuantity;

  // Update lot quantity
  await database
    .update(lots)
    .set({
      quantity: newQuantity,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(lots.id, lotId));

  // Create transaction record
  const [txn] = await database
    .insert(transactions)
    .values({
      lotId,
      transactionType: 'adjust',
      quantity: adjustmentQty,
      unit: lot.unit,
      referenceType: 'ADJUST',
      reason,
      performedBy: userId,
      approvedBy,
    })
    .returning({ id: transactions.id });

  // Create audit log
  await createAuditLog({
    userId,
    action: 'ADJUST',
    tableName: 'inventory_lots',
    recordId: lotId,
    oldValue: { quantity: oldQuantity },
    newValue: { quantity: newQuantity, reason },
  });

  return txn.id;
}

/**
 * Transfer between warehouses
 */
export async function transferInventory(
  lotId: number,
  toWarehouseId: number,
  quantity: number,
  userId: number,
  reason?: string
): Promise<{ newLotId: number; transactionId: number }> {
  const { lots, transactions } = getTables();
  const database = await getDb();

  // Get current lot
  const [lot] = await database
    .select()
    .from(lots)
    .where(eq(lots.id, lotId));

  if (!lot) {
    throw new Error(`Lot ${lotId} not found`);
  }

  const available = (lot.quantity || 0) - (lot.reservedQuantity || 0);
  if (available < quantity) {
    throw new Error(`Insufficient quantity. Available: ${available}, Requested: ${quantity}`);
  }

  // Deduct from source lot
  await database
    .update(lots)
    .set({
      quantity: sql`${lots.quantity} - ${quantity}`,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(lots.id, lotId));

  // Create new lot in destination warehouse
  const [newLot] = await database
    .insert(lots)
    .values({
      itemId: lot.itemId,
      lotNumber: lot.lotNumber,
      batchNumber: lot.batchNumber,
      warehouseId: toWarehouseId,
      quantity,
      reservedQuantity: 0,
      unit: lot.unit,
      status: lot.status,
      manufacturingDate: lot.manufacturingDate,
      expiryDate: lot.expiryDate,
      receivedDate: lot.receivedDate,
      vendorId: lot.vendorId,
      poNumber: lot.poNumber,
      coaNumber: lot.coaNumber,
    })
    .returning({ id: lots.id });

  // Create transaction record
  const [txn] = await database
    .insert(transactions)
    .values({
      lotId: newLot.id,
      transactionType: 'transfer',
      quantity,
      unit: lot.unit,
      referenceType: 'TRANSFER',
      fromWarehouseId: lot.warehouseId,
      toWarehouseId,
      reason,
      performedBy: userId,
    })
    .returning({ id: transactions.id });

  // Create audit log
  await createAuditLog({
    userId,
    action: 'TRANSFER',
    tableName: 'inventory_lots',
    recordId: lotId,
    newValue: {
      fromWarehouse: lot.warehouseId,
      toWarehouse: toWarehouseId,
      quantity,
      newLotId: newLot.id,
    },
  });

  return { newLotId: newLot.id, transactionId: txn.id };
}
