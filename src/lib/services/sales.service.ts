/**
 * Sales Service
 * Real-world sales management with ATP calculation and order fulfillment
 */

import { db, isSqlite } from '../db';
import { eq, and, sql, desc, asc, gte, lte, or } from 'drizzle-orm';
import {
  sqliteSalesOrders,
  sqliteSalesOrderLines,
  sqliteItems,
  sqliteInventoryLots,
  mysqlSalesOrders,
  mysqlSalesOrderLines,
  mysqlItems,
  mysqlInventoryLots,
} from '../db/schema';
import { createAuditLog } from '../audit';
import { getLotsForPicking, reserveLots, issueMaterial } from './inventory.service';

// Types
export interface ATPResult {
  itemId: number;
  itemCode: string;
  requestedQuantity: number;
  availableNow: number;
  canFulfill: boolean;
  shortfall: number;
  breakdown: { onHand: number; reserved: number; incoming: number; committed: number };
}

// Customer details interface (schema uses denormalized customer info)
export interface CustomerDetails {
  name: string;
  contact?: string;
  address?: string;
}

// Get table references
function getTables() {
  if (isSqlite()) {
    return {
      salesOrders: sqliteSalesOrders,
      salesOrderLines: sqliteSalesOrderLines,
      items: sqliteItems,
      lots: sqliteInventoryLots,
    };
  }
  return {
    salesOrders: mysqlSalesOrders,
    salesOrderLines: mysqlSalesOrderLines,
    items: mysqlItems,
    lots: mysqlInventoryLots,
  };
}

/**
 * Available to Promise (ATP) Calculation
 */
export async function checkATP(
  itemId: number,
  requestedQuantity: number
): Promise<ATPResult> {
  const { items, lots } = getTables();
  const database = db();

  const [item] = await database.select().from(items).where(eq(items.id, itemId));
  if (!item) throw new Error(`Item ${itemId} not found`);

  const onHandResult = await database
    .select({
      total: sql<number>`COALESCE(SUM(${lots.quantity}), 0)`,
      reserved: sql<number>`COALESCE(SUM(${lots.reservedQuantity}), 0)`,
    })
    .from(lots)
    .where(and(eq(lots.itemId, itemId), eq(lots.status, 'released')));

  const onHand = Number(onHandResult[0]?.total) || 0;
  const reserved = Number(onHandResult[0]?.reserved) || 0;
  const availableNow = onHand - reserved;

  return {
    itemId,
    itemCode: item.code,
    requestedQuantity,
    availableNow,
    canFulfill: availableNow >= requestedQuantity,
    shortfall: Math.max(0, requestedQuantity - availableNow),
    breakdown: { onHand, reserved, incoming: 0, committed: reserved },
  };
}

/**
 * Create Sales Order
 */
export async function createSalesOrder(
  customer: CustomerDetails,
  lines: Array<{ itemId: number; quantity: number; unitPrice: number; requiredDate: string }>,
  userId: number
): Promise<{ orderId: number; atpResults: ATPResult[] }> {
  const { salesOrders, salesOrderLines, items } = getTables();
  const database = db();

  if (!customer.name) throw new Error('Customer name is required');

  const atpResults: ATPResult[] = [];
  for (const line of lines) {
    atpResults.push(await checkATP(line.itemId, line.quantity));
  }

  const today = new Date();
  const prefix = `SO-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`;
  const lastSO = await database
    .select({ soNumber: salesOrders.soNumber })
    .from(salesOrders)
    .where(sql`${salesOrders.soNumber} LIKE ${prefix + '%'}`)
    .orderBy(desc(salesOrders.soNumber))
    .limit(1);

  let sequence = 1;
  if (lastSO.length > 0) {
    sequence = parseInt(lastSO[0].soNumber.split('-').pop() || '0') + 1;
  }
  const soNumber = `${prefix}-${String(sequence).padStart(4, '0')}`;
  const totalAmount = lines.reduce((sum: number, l: { quantity: number; unitPrice: number }) => sum + l.quantity * l.unitPrice, 0);

  const [newSO] = await database
    .insert(salesOrders)
    .values({
      soNumber,
      customerName: customer.name,
      customerContact: customer.contact,
      customerAddress: customer.address,
      status: 'draft',
      totalAmount,
      currency: 'THB',
      createdBy: userId,
    })
    .returning({ id: salesOrders.id });

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const [item] = await database.select().from(items).where(eq(items.id, line.itemId));
    await database.insert(salesOrderLines).values({
      soId: newSO.id,
      itemId: line.itemId,
      quantity: line.quantity,
      unit: item?.primaryUnit || 'EA',
      unitPrice: line.unitPrice,
      totalPrice: line.quantity * line.unitPrice,
    });
  }

  await createAuditLog({ userId, action: 'CREATE', tableName: 'sales_orders', recordId: newSO.id, newValue: { soNumber, customerName: customer.name, totalAmount } });
  return { orderId: newSO.id, atpResults };
}

/**
 * Allocate Lots for Sales Order (FEFO)
 */
export async function allocateLotsForOrder(soId: number, userId: number) {
  const { salesOrders, salesOrderLines, items } = getTables();
  const database = db();

  const [so] = await database.select().from(salesOrders).where(eq(salesOrders.id, soId));
  if (!so) throw new Error(`Sales Order ${soId} not found`);
  if (so.status !== 'confirmed') throw new Error(`Sales Order must be Confirmed`);

  const soLines = await database
    .select({ id: salesOrderLines.id, itemId: salesOrderLines.itemId, quantity: salesOrderLines.quantity, itemCode: items.code })
    .from(salesOrderLines)
    .innerJoin(items, eq(salesOrderLines.itemId, items.id))
    .where(eq(salesOrderLines.soId, soId));

  const allocations = [];
  for (const line of soLines) {
    const { allocated, remaining } = await getLotsForPicking(line.itemId, Number(line.quantity));
    if (remaining > 0) throw new Error(`Insufficient stock for ${line.itemCode}`);
    await reserveLots(allocated, 'SO', soId, userId);
    allocations.push({ lineId: line.id, itemId: line.itemId, allocations: allocated });
    await database.update(salesOrderLines).set({ allocatedQuantity: Number(line.quantity) }).where(eq(salesOrderLines.id, line.id));
  }

  await database.update(salesOrders).set({ status: 'processing' }).where(eq(salesOrders.id, soId));
  return allocations;
}
