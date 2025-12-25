/**
 * Sales Service
 * Real-world sales management with ATP calculation and order fulfillment
 */

import { getDb, isSqlite } from '../db';
import { eq, and, sql, desc, asc, gte, lte, or } from 'drizzle-orm';
import {
  sqliteSalesOrders,
  sqliteSalesOrderLines,
  sqliteSalesDeliveries,
  sqliteItems,
  sqliteInventoryLots,
  mysqlSalesOrders,
  mysqlSalesOrderLines,
  mysqlSalesDeliveries,
  mysqlItems,
  mysqlInventoryLots,
} from '../db/schema';
import { createAuditLog } from '../audit';
import { getLotsForPicking, reserveLots, issueMaterial } from './inventory.service';
import { getNow } from '../db/date-utils';

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
      salesDeliveries: sqliteSalesDeliveries,
      items: sqliteItems,
      lots: sqliteInventoryLots,
    };
  }
  return {
    salesOrders: mysqlSalesOrders,
    salesOrderLines: mysqlSalesOrderLines,
    salesDeliveries: mysqlSalesDeliveries,
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
  const database = await getDb();

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
  const database = await getDb();

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
  const database = await getDb();

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

/**
 * Fulfillment Types
 */
export interface FulfillmentInput {
  soId: number;
  soLineId: number;
  itemId: number;
  lotId: number;
  quantity: number;
  notes?: string;
}

export interface FulfillmentResult {
  deliveryId: number;
  deliveryNumber: string;
  shippedQuantity: number;
}

/**
 * Fulfill a sales order line by shipping from a specific lot
 */
export async function fulfillSalesOrderLine(
  input: FulfillmentInput,
  userId: number
): Promise<FulfillmentResult> {
  const { salesOrders, salesOrderLines, salesDeliveries, lots } = getTables();
  const database = await getDb();

  // Get SO line
  const [soLine] = await database
    .select()
    .from(salesOrderLines)
    .where(
      and(
        eq(salesOrderLines.id, input.soLineId),
        eq(salesOrderLines.soId, input.soId)
      )
    );

  if (!soLine) throw new Error(`Sales order line ${input.soLineId} not found for order ${input.soId}`);

  // Calculate pending quantity
  const pendingQty = Number(soLine.quantity) - Number(soLine.shippedQuantity || 0);
  if (input.quantity > pendingQty) {
    throw new Error(`Quantity ${input.quantity} exceeds pending quantity ${pendingQty}`);
  }

  // Get lot info
  const [lot] = await database.select().from(lots).where(eq(lots.id, input.lotId));
  if (!lot) throw new Error(`Lot ${input.lotId} not found`);

  // Get SO for delivery number generation
  const [so] = await database.select().from(salesOrders).where(eq(salesOrders.id, input.soId));
  if (!so) throw new Error(`Sales order ${input.soId} not found`);

  // Generate delivery number
  const today = new Date();
  const prefix = `DL-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`;
  const lastDL = await database
    .select({ deliveryNumber: salesDeliveries.deliveryNumber })
    .from(salesDeliveries)
    .where(sql`${salesDeliveries.deliveryNumber} LIKE ${prefix + '%'}`)
    .orderBy(desc(salesDeliveries.deliveryNumber))
    .limit(1);

  let sequence = 1;
  if (lastDL.length > 0) {
    sequence = parseInt(lastDL[0].deliveryNumber.split('-').pop() || '0') + 1;
  }
  const deliveryNumber = `${prefix}-${String(sequence).padStart(4, '0')}`;

  // Issue material from inventory (deducts lot quantity)
  await issueMaterial(
    input.lotId,
    input.quantity,
    'SO',
    input.soId,
    so.soNumber,
    userId,
    `Delivery for SO Line ${input.soLineId}`
  );

  // Create delivery record
  const [newDelivery] = await database
    .insert(salesDeliveries)
    .values({
      soId: input.soId,
      soLineId: input.soLineId,
      itemId: input.itemId,
      lotId: input.lotId,
      lotNumber: lot.lotNumber,
      quantity: input.quantity,
      unit: soLine.unit,
      deliveryDate: getNow(),
      deliveryNumber,
      status: 'shipped',
      notes: input.notes,
      createdBy: userId,
    })
    .returning({ id: salesDeliveries.id });

  // Update SO line shipped quantity
  const newShippedQty = Number(soLine.shippedQuantity || 0) + input.quantity;
  await database
    .update(salesOrderLines)
    .set({ shippedQuantity: newShippedQty })
    .where(eq(salesOrderLines.id, input.soLineId));

  // Check if all lines are fully shipped
  const allLines = await database
    .select({
      quantity: salesOrderLines.quantity,
      shippedQuantity: salesOrderLines.shippedQuantity,
    })
    .from(salesOrderLines)
    .where(eq(salesOrderLines.soId, input.soId));

  const allShipped = allLines.every(
    (line) => Number(line.shippedQuantity || 0) >= Number(line.quantity)
  );

  if (allShipped) {
    await database
      .update(salesOrders)
      .set({ status: 'shipped', shippedDate: getNow() })
      .where(eq(salesOrders.id, input.soId));
  } else if (so.status === 'confirmed') {
    // Move to processing if first shipment
    await database
      .update(salesOrders)
      .set({ status: 'processing' })
      .where(eq(salesOrders.id, input.soId));
  }

  await createAuditLog({
    userId,
    action: 'SHIP',
    tableName: 'sales_deliveries',
    recordId: newDelivery.id,
    newValue: { deliveryNumber, soId: input.soId, lotNumber: lot.lotNumber, quantity: input.quantity },
  });

  return {
    deliveryId: newDelivery.id,
    deliveryNumber,
    shippedQuantity: input.quantity,
  };
}
