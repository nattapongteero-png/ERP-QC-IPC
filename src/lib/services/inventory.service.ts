/**
 * Inventory Service
 * Real-world inventory management with FEFO algorithm and lot traceability
 */

import { getDb, isSqlite } from '../db';
import { getInsertId } from '../db/db-helper';
import { toQueryDate, getTodayStr, getNow } from '../db/date-utils';
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
import { recordMaterialCost } from './accounting.service';

// Types

// Options for material issue with cost tracking (US4: Manufacturing Cost Accounting)
export interface MaterialIssueCostOptions {
  workOrderId: number;
  batchNumber: string;
  unitCost?: number; // If not provided, will calculate from item's average cost
}
export interface LotAllocation {
  lotId: number;
  lotNumber: string;
  quantity: number;
  expiryDate: string | null;
}

// Phase 2: Material Receipt Extended Fields (FR-055, FR-056)
export interface MaterialReceiptData {
  itemId: number;
  lotNumber: string;
  quantity: number;
  unit: string;
  warehouseId: number;
  expiryDate?: string | null;
  vendorId?: number | null;
  poNumber?: string | null;
  manufacturingDate?: string | null;
  // FR-055: Manufacturer/Importer fields
  manufacturerName?: string | null;
  manufacturerId?: number | null;
  importerName?: string | null;
  importerId?: number | null;
  countryOfOrigin?: string | null;
  // FR-056: Retest date tracking
  retestDate?: string | null;
  retestIntervalMonths?: number | null;
}

export interface RetestAlert {
  lotId: number;
  lotNumber: string;
  itemCode: string;
  itemName: string;
  retestDate: string;
  daysUntilRetest: number;
  retestStatus: string;
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
  if (isSqlite()) {
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
 * Recalculate and update item's onHand and quarantineQty from lots
 * Call this whenever lot quantities or statuses change
 */
export async function recalculateItemOnHand(itemId: number): Promise<{ onHand: number; quarantineQty: number }> {
  const { lots, items } = getTables();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;
  const usingSqlite = isSqlite();

  // Sum quantities from released lots for this item (onHand)
  const [releasedResult] = await (database as any)
    .select({
      totalOnHand: sql`COALESCE(SUM(${lots.quantity}), 0)`,
    })
    .from(lots)
    .where(and(eq(lots.itemId, itemId), eq(lots.status, 'released')));

  // Sum quantities from quarantine/under_test lots (quarantineQty)
  const [quarantineResult] = await (database as any)
    .select({
      totalQuarantine: sql`COALESCE(SUM(${lots.quantity}), 0)`,
    })
    .from(lots)
    .where(and(
      eq(lots.itemId, itemId),
      or(eq(lots.status, 'quarantine'), eq(lots.status, 'under_test'))
    ));

  const onHand = Number(releasedResult?.totalOnHand) || 0;
  const quarantineQty = Number(quarantineResult?.totalQuarantine) || 0;

  // Update item's onHand and quarantineQty fields
  const now = new Date();
  await (database as any)
    .update(items)
    .set({
      onHand,
      quarantineQty,
      updatedAt: usingSqlite ? now.toISOString() : now,
    })
    .where(eq(items.id, itemId));

  return { onHand, quarantineQty };
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

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
  reason?: string,
  costOptions?: MaterialIssueCostOptions
): Promise<number> {
  const { lots, transactions, items } = getTables();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

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
  let txnId: number;
  if (isSqlite()) {
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
        createdAt: getNow(),
      })
      .returning({ id: transactions.id });
    txnId = txn.id;
  } else {
    const result = await database
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
        createdAt: getNow(),
      });
    txnId = getInsertId(result);
  }

  // Create audit log
  await createAuditLog({
    userId,
    action: 'ISSUE',
    tableName: 'inventory_transactions',
    recordId: txnId,
    newValue: {
      lotId,
      lotNumber: lot.lotNumber,
      quantity,
      referenceType,
      referenceNumber,
    },
  });

  // US4: Manufacturing Cost Accounting - Record material cost for work orders
  if (costOptions) {
    // Determine unit cost: use provided value or calculate from item's average cost
    let unitCost = costOptions.unitCost;

    if (unitCost === undefined) {
      // Get item's average cost from onHandCost / onHand
      const [item] = await database
        .select({
          onHand: items.onHand,
          onHandCost: items.onHandCost,
        })
        .from(items)
        .where(eq(items.id, lot.itemId));

      if (item && Number(item.onHand) > 0) {
        unitCost = Number(item.onHandCost) / Number(item.onHand);
      } else {
        unitCost = 0; // No cost available
      }
    }

    // Record material cost in accounting system
    await recordMaterialCost({
      workOrderId: costOptions.workOrderId,
      batchNumber: costOptions.batchNumber,
      materialItemId: lot.itemId,
      lotId: lotId,
      quantity: quantity,
      unitCost: unitCost,
      issueDate: new Date().toISOString().split('T')[0],
      description: `Material issue: ${lot.lotNumber} for WO ${referenceNumber}`,
    }, userId);
  }

  // Sync items.on_hand with lot totals
  await recalculateItemOnHand(lot.itemId);

  return txnId;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  // Create new lot in quarantine status
  let newLotId: number;
  if (isSqlite()) {
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
    newLotId = newLot.id;
  } else {
    const result = await database
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
      });
    newLotId = getInsertId(result);
  }

  // Create transaction record
  if (isSqlite()) {
    await database
      .insert(transactions)
      .values({
        lotId: newLotId,
        transactionType: 'receive',
        quantity,
        unit,
        referenceType: 'PO',
        referenceNumber: poNumber,
        toWarehouseId: warehouseId,
        performedBy: userId,
        createdAt: getNow(),
      })
      .returning({ id: transactions.id });
  } else {
    await database
      .insert(transactions)
      .values({
        lotId: newLotId,
        transactionType: 'receive',
        quantity,
        unit,
        referenceType: 'PO',
        referenceNumber: poNumber,
        toWarehouseId: warehouseId,
        performedBy: userId,
        createdAt: getNow(),
      });
  }

  // Create audit log
  await createAuditLog({
    userId,
    action: 'RECEIVE',
    tableName: 'inventory_lots',
    recordId: newLotId,
    newValue: {
      lotNumber,
      quantity,
      status: 'quarantine',
      poNumber,
    },
  });

  return newLotId;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

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
    updatedAt: getNow(),
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  const todayStr = getTodayStr();
  const todayForQuery = toQueryDate(todayStr);
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);
  const thresholdDateForQuery = toQueryDate(thresholdDate.toISOString().split('T')[0]);

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
        gte(lots.expiryDate, todayForQuery),
        lte(lots.expiryDate, thresholdDateForQuery)
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
        sql`${lots.expiryDate} < ${todayStr}`
      )
    );

  return {
    nearExpiry: nearExpiryLots.map((lot: any) => ({
      ...lot,
      itemName: lot.itemName || '',
      expiryDate: lot.expiryDate || '',
      daysToExpiry: Math.ceil(
        (new Date(lot.expiryDate || '').getTime() - new Date(todayStr).getTime()) / (1000 * 60 * 60 * 24)
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

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
      updatedAt: getNow(),
    })
    .where(eq(lots.id, lotId));

  // Create transaction record
  let txnId: number;
  if (isSqlite()) {
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
        createdAt: getNow(),
      })
      .returning({ id: transactions.id });
    txnId = txn.id;
  } else {
    const result = await database
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
        createdAt: getNow(),
      });
    txnId = getInsertId(result);
  }

  // Create audit log
  await createAuditLog({
    userId,
    action: 'ADJUST',
    tableName: 'inventory_lots',
    recordId: lotId,
    oldValue: { quantity: oldQuantity },
    newValue: { quantity: newQuantity, reason },
  });

  return txnId;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

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
      updatedAt: getNow(),
    })
    .where(eq(lots.id, lotId));

  // Create new lot in destination warehouse
  let newLotId: number;
  if (isSqlite()) {
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
    newLotId = newLot.id;
  } else {
    const result = await database
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
      });
    newLotId = getInsertId(result);
  }

  // Create transaction record
  let txnId: number;
  if (isSqlite()) {
    const [txn] = await database
      .insert(transactions)
      .values({
        lotId: newLotId,
        transactionType: 'transfer',
        quantity,
        unit: lot.unit,
        referenceType: 'TRANSFER',
        fromWarehouseId: lot.warehouseId,
        toWarehouseId,
        reason,
        performedBy: userId,
        createdAt: getNow(),
      })
      .returning({ id: transactions.id });
    txnId = txn.id;
  } else {
    const result = await database
      .insert(transactions)
      .values({
        lotId: newLotId,
        transactionType: 'transfer',
        quantity,
        unit: lot.unit,
        referenceType: 'TRANSFER',
        fromWarehouseId: lot.warehouseId,
        toWarehouseId,
        reason,
        performedBy: userId,
        createdAt: getNow(),
      });
    txnId = getInsertId(result);
  }

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
      newLotId,
    },
  });

  return { newLotId, transactionId: txnId };
}

/**
 * Extended Receive Material with Manufacturer/Importer fields (FR-055) and Retest tracking (FR-056)
 * Phase 2: GMP Compliance Gap Analysis
 */
export async function receiveMaterialExtended(
  data: MaterialReceiptData,
  userId: number
): Promise<number> {
  const { lots, transactions } = getTables();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  // Calculate retest status based on retest date
  let retestStatus: string | null = null;
  if (data.retestDate) {
    const retestDateObj = new Date(data.retestDate);
    const today = new Date();
    const daysUntilRetest = Math.ceil((retestDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilRetest < 0) {
      retestStatus = 'overdue';
    } else if (daysUntilRetest <= 30) {
      retestStatus = 'pending';
    } else {
      retestStatus = 'scheduled';
    }
  }

  // Create new lot in quarantine status with extended fields
  const insertData: Record<string, unknown> = {
    itemId: data.itemId,
    lotNumber: data.lotNumber,
    warehouseId: data.warehouseId,
    quantity: data.quantity,
    reservedQuantity: 0,
    unit: data.unit,
    status: 'quarantine', // Always start in quarantine
    expiryDate: data.expiryDate || null,
    manufacturingDate: data.manufacturingDate || null,
    receivedDate: new Date().toISOString().split('T')[0],
    vendorId: data.vendorId || null,
    poNumber: data.poNumber || null,
    // FR-055: Manufacturer/Importer fields
    manufacturerName: data.manufacturerName || null,
    manufacturerId: data.manufacturerId || null,
    importerName: data.importerName || null,
    importerId: data.importerId || null,
    countryOfOrigin: data.countryOfOrigin || null,
    // FR-056: Retest tracking
    retestDate: data.retestDate || null,
    retestIntervalMonths: data.retestIntervalMonths || null,
    retestStatus,
  };

  let newLotId: number;
  if (isSqlite()) {
    const [newLot] = await database
      .insert(lots)
      .values(insertData)
      .returning({ id: lots.id });
    newLotId = newLot.id;
  } else {
    const result = await database
      .insert(lots)
      .values(insertData);
    newLotId = getInsertId(result);
  }

  // Create transaction record
  await database
    .insert(transactions)
    .values({
      lotId: newLotId,
      transactionType: 'receive',
      quantity: data.quantity,
      unit: data.unit,
      referenceType: 'PO',
      referenceNumber: data.poNumber,
      toWarehouseId: data.warehouseId,
      performedBy: userId,
      createdAt: getNow(),
    });

  // Create audit log with extended fields
  await createAuditLog({
    userId,
    action: 'RECEIVE',
    tableName: 'inventory_lots',
    recordId: newLotId,
    newValue: {
      lotNumber: data.lotNumber,
      quantity: data.quantity,
      status: 'quarantine',
      poNumber: data.poNumber,
      manufacturerName: data.manufacturerName,
      importerName: data.importerName,
      countryOfOrigin: data.countryOfOrigin,
      retestDate: data.retestDate,
    },
  });

  return newLotId;
}

/**
 * Update lot with manufacturer/importer information (FR-055)
 */
export async function updateLotManufacturerInfo(
  lotId: number,
  manufacturerName: string | null,
  manufacturerId: number | null,
  importerName: string | null,
  importerId: number | null,
  countryOfOrigin: string | null,
  userId: number
): Promise<boolean> {
  const { lots } = getTables();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  // Get current lot
  const [lot] = await database
    .select()
    .from(lots)
    .where(eq(lots.id, lotId));

  if (!lot) {
    throw new Error(`Lot ${lotId} not found`);
  }

  const oldValue = {
    manufacturerName: lot.manufacturerName,
    manufacturerId: lot.manufacturerId,
    importerName: lot.importerName,
    importerId: lot.importerId,
    countryOfOrigin: lot.countryOfOrigin,
  };

  await database
    .update(lots)
    .set({
      manufacturerName,
      manufacturerId,
      importerName,
      importerId,
      countryOfOrigin,
      updatedAt: getNow(),
    })
    .where(eq(lots.id, lotId));

  await createAuditLog({
    userId,
    action: 'UPDATE',
    tableName: 'inventory_lots',
    recordId: lotId,
    oldValue,
    newValue: {
      manufacturerName,
      manufacturerId,
      importerName,
      importerId,
      countryOfOrigin,
    },
  });

  return true;
}

/**
 * Update lot retest tracking information (FR-056)
 */
export async function updateLotRetestInfo(
  lotId: number,
  retestDate: string | null,
  retestIntervalMonths: number | null,
  userId: number
): Promise<boolean> {
  const { lots } = getTables();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  // Get current lot
  const [lot] = await database
    .select()
    .from(lots)
    .where(eq(lots.id, lotId));

  if (!lot) {
    throw new Error(`Lot ${lotId} not found`);
  }

  // Calculate retest status
  let retestStatus: string | null = null;
  if (retestDate) {
    const retestDateObj = new Date(retestDate);
    const today = new Date();
    const daysUntilRetest = Math.ceil((retestDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilRetest < 0) {
      retestStatus = 'overdue';
    } else if (daysUntilRetest <= 30) {
      retestStatus = 'pending';
    } else {
      retestStatus = 'scheduled';
    }
  }

  const oldValue = {
    retestDate: lot.retestDate,
    retestIntervalMonths: lot.retestIntervalMonths,
    retestStatus: lot.retestStatus,
  };

  await database
    .update(lots)
    .set({
      retestDate,
      retestIntervalMonths,
      retestStatus,
      updatedAt: getNow(),
    })
    .where(eq(lots.id, lotId));

  await createAuditLog({
    userId,
    action: 'UPDATE',
    tableName: 'inventory_lots',
    recordId: lotId,
    oldValue,
    newValue: {
      retestDate,
      retestIntervalMonths,
      retestStatus,
    },
  });

  return true;
}

/**
 * Record retest completion and schedule next retest (FR-056)
 */
export async function recordRetestCompletion(
  lotId: number,
  userId: number
): Promise<{ nextRetestDate: string | null }> {
  const { lots } = getTables();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  // Get current lot
  const [lot] = await database
    .select()
    .from(lots)
    .where(eq(lots.id, lotId));

  if (!lot) {
    throw new Error(`Lot ${lotId} not found`);
  }

  const today = new Date();
  let nextRetestDate: string | null = null;

  // Calculate next retest date if interval is set
  if (lot.retestIntervalMonths) {
    const nextDate = new Date(today);
    nextDate.setMonth(nextDate.getMonth() + lot.retestIntervalMonths);
    nextRetestDate = nextDate.toISOString().split('T')[0];
  }

  await database
    .update(lots)
    .set({
      lastRetestDate: today.toISOString().split('T')[0],
      retestDate: nextRetestDate,
      retestStatus: nextRetestDate ? 'scheduled' : 'completed',
      updatedAt: today.toISOString(),
    })
    .where(eq(lots.id, lotId));

  await createAuditLog({
    userId,
    action: 'UPDATE',
    tableName: 'inventory_lots',
    recordId: lotId,
    oldValue: {
      retestDate: lot.retestDate,
      lastRetestDate: lot.lastRetestDate,
    },
    newValue: {
      lastRetestDate: today.toISOString().split('T')[0],
      retestDate: nextRetestDate,
      retestStatus: nextRetestDate ? 'scheduled' : 'completed',
    },
  });

  return { nextRetestDate };
}

/**
 * Check retest alerts - lots that need retesting (FR-056, FR-061)
 */
export async function checkRetestAlerts(daysThreshold: number = 30): Promise<{
  overdue: RetestAlert[];
  upcoming: RetestAlert[];
}> {
  const { lots, items } = getTables();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  const todayStr = getTodayStr();
  const todayForQuery = toQueryDate(todayStr);
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);
  const thresholdDateForQuery = toQueryDate(thresholdDate.toISOString().split('T')[0]);

  // Get overdue retest lots
  const overdueLots = await database
    .select({
      lotId: lots.id,
      lotNumber: lots.lotNumber,
      itemCode: items.code,
      itemName: items.nameTh,
      retestDate: lots.retestDate,
      retestStatus: lots.retestStatus,
    })
    .from(lots)
    .innerJoin(items, eq(lots.itemId, items.id))
    .where(
      and(
        or(eq(lots.status, 'released'), eq(lots.status, 'quarantine')),
        sql`${lots.retestDate} IS NOT NULL`,
        sql`${lots.retestDate} < ${todayStr}`
      )
    )
    .orderBy(asc(lots.retestDate));

  // Get upcoming retest lots (within threshold days)
  const upcomingLots = await database
    .select({
      lotId: lots.id,
      lotNumber: lots.lotNumber,
      itemCode: items.code,
      itemName: items.nameTh,
      retestDate: lots.retestDate,
      retestStatus: lots.retestStatus,
    })
    .from(lots)
    .innerJoin(items, eq(lots.itemId, items.id))
    .where(
      and(
        or(eq(lots.status, 'released'), eq(lots.status, 'quarantine')),
        sql`${lots.retestDate} IS NOT NULL`,
        gte(lots.retestDate, todayForQuery),
        lte(lots.retestDate, thresholdDateForQuery)
      )
    )
    .orderBy(asc(lots.retestDate));

  const today = new Date(todayStr);

  return {
    overdue: overdueLots.map((lot: any) => ({
      lotId: lot.lotId,
      lotNumber: lot.lotNumber,
      itemCode: lot.itemCode,
      itemName: lot.itemName || lot.itemCode,
      retestDate: lot.retestDate || '',
      daysUntilRetest: Math.ceil(
        (new Date(lot.retestDate || '').getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      ),
      retestStatus: lot.retestStatus || 'overdue',
    })),
    upcoming: upcomingLots.map((lot: any) => ({
      lotId: lot.lotId,
      lotNumber: lot.lotNumber,
      itemCode: lot.itemCode,
      itemName: lot.itemName || lot.itemCode,
      retestDate: lot.retestDate || '',
      daysUntilRetest: Math.ceil(
        (new Date(lot.retestDate || '').getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      ),
      retestStatus: lot.retestStatus || 'pending',
    })),
  };
}

/**
 * Get lot details with all Phase 2 fields
 */
export async function getLotDetails(lotId: number): Promise<{
  id: number;
  lotNumber: string;
  itemId: number;
  itemCode: string;
  itemName: string;
  quantity: number;
  unit: string;
  status: string;
  expiryDate: string | null;
  manufacturerName: string | null;
  manufacturerId: number | null;
  importerName: string | null;
  importerId: number | null;
  countryOfOrigin: string | null;
  retestDate: string | null;
  retestIntervalMonths: number | null;
  lastRetestDate: string | null;
  retestStatus: string | null;
  vendorId: number | null;
  poNumber: string | null;
  coaNumber: string | null;
  createdAt: string;
  updatedAt: string;
} | null> {
  const { lots, items } = getTables();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  const [lot] = await database
    .select({
      id: lots.id,
      lotNumber: lots.lotNumber,
      itemId: lots.itemId,
      itemCode: items.code,
      itemName: items.nameTh,
      quantity: lots.quantity,
      unit: lots.unit,
      status: lots.status,
      expiryDate: lots.expiryDate,
      manufacturerName: lots.manufacturerName,
      manufacturerId: lots.manufacturerId,
      importerName: lots.importerName,
      importerId: lots.importerId,
      countryOfOrigin: lots.countryOfOrigin,
      retestDate: lots.retestDate,
      retestIntervalMonths: lots.retestIntervalMonths,
      lastRetestDate: lots.lastRetestDate,
      retestStatus: lots.retestStatus,
      vendorId: lots.vendorId,
      poNumber: lots.poNumber,
      coaNumber: lots.coaNumber,
      createdAt: lots.createdAt,
      updatedAt: lots.updatedAt,
    })
    .from(lots)
    .innerJoin(items, eq(lots.itemId, items.id))
    .where(eq(lots.id, lotId));

  if (!lot) return null;

  return {
    ...lot,
    itemName: lot.itemName || lot.itemCode,
  };
}
