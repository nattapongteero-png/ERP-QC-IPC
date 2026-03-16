/**
 * Sales Service
 * Real-world sales management with ATP calculation and order fulfillment
 */

import { getDb, isSqlite } from '../db';
import { getInsertId } from '../db/db-helper';
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
import { getNow, getTodayStr } from '../db/date-utils';
import { createSOShipmentJournalEntry, createARInvoiceFromSOShipment, calculateVAT } from './accounting.service';
import { calculateCOGS, updateSOLineWithCOGS } from './unit-cost.service';

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
  const database = (await getDb()) as any;

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
  const database = (await getDb()) as any;

  if (!customer.name) throw new Error('Customer name is required');

  const atpResults: ATPResult[] = [];
  for (const line of lines) {
    atpResults.push(await checkATP(line.itemId, line.quantity));
  }

  const totalAmount = lines.reduce((sum: number, l: { quantity: number; unitPrice: number }) => sum + l.quantity * l.unitPrice, 0);

  // Generate SO number and insert inside a transaction to prevent duplicate numbers
  const MAX_RETRIES = 3;
  let newSOId: number = 0;
  let soNumber: string = '';
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await database.transaction(async (tx: any) => {
        const today = new Date();
        const prefix = `SO-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`;
        const lastSO = await tx
          .select({ soNumber: salesOrders.soNumber })
          .from(salesOrders)
          .where(sql`${salesOrders.soNumber} LIKE ${prefix + '%'}`)
          .orderBy(desc(salesOrders.soNumber))
          .limit(1);

        let sequence = 1;
        if (lastSO.length > 0) {
          sequence = parseInt(lastSO[0].soNumber.split('-').pop() || '0') + 1;
        }
        const nextSONumber = `${prefix}-${String(sequence).padStart(4, '0')}`;

        let insertedId: number;
        if (isSqlite()) {
          const [newSO] = await tx
            .insert(salesOrders)
            .values({
              soNumber: nextSONumber,
              customerName: customer.name,
              customerContact: customer.contact,
              customerAddress: customer.address,
              status: 'draft',
              totalAmount,
              currency: 'THB',
              createdBy: userId,
            })
            .returning({ id: salesOrders.id });
          insertedId = newSO.id;
        } else {
          const insertResult = await tx
            .insert(salesOrders)
            .values({
              soNumber: nextSONumber,
              customerName: customer.name,
              customerContact: customer.contact,
              customerAddress: customer.address,
              status: 'draft',
              totalAmount,
              currency: 'THB',
              createdBy: userId,
            });
          insertedId = getInsertId(insertResult);
        }
        return { id: insertedId, soNumber: nextSONumber };
      });
      newSOId = result.id;
      soNumber = result.soNumber;
      break;
    } catch (error: any) {
      if (attempt < MAX_RETRIES - 1 && (error.code === 'ER_DUP_ENTRY' || error.message?.includes('UNIQUE constraint failed'))) {
        continue;
      }
      throw error;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const [item] = await database.select().from(items).where(eq(items.id, line.itemId));
    await database.insert(salesOrderLines).values({
      soId: newSOId,
      itemId: line.itemId,
      quantity: line.quantity,
      unit: item?.primaryUnit || 'EA',
      unitPrice: line.unitPrice,
      totalPrice: line.quantity * line.unitPrice,
    });
  }

  await createAuditLog({ userId, action: 'CREATE', tableName: 'sales_orders', recordId: newSOId, newValue: { soNumber, customerName: customer.name, totalAmount } });
  return { orderId: newSOId, atpResults };
}

/**
 * Create Sales Order from VMI order confirmation.
 * Skips ATP checks (VMI orders are committed by hospitals).
 * Sets status='confirmed', source='vmi', and links vmiSalesOrderId.
 */
export async function createSalesOrderFromVmi(data: {
  vmiSalesOrderId: number;
  customerName: string;
  orderDate: Date | string;
  requiredDate?: Date | string | null;
  totalAmount: number;
  lines: Array<{
    itemId: number;
    quantity: number;
    unit: string;
    unitPrice: number;
  }>;
  userId: number;
  notes?: string;
}): Promise<{ orderId: number; soNumber: string }> {
  const { salesOrders, salesOrderLines } = getTables();
  const database = (await getDb()) as any;

  const now = getNow();
  const totalAmount = data.lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);

  // Generate SO number and insert inside a transaction to prevent duplicate numbers
  const MAX_SO_RETRIES = 3;
  let newSOId: number = 0;
  let soNumber: string = '';
  for (let attempt = 0; attempt < MAX_SO_RETRIES; attempt++) {
    try {
      const result = await database.transaction(async (tx: any) => {
        const today = new Date();
        const prefix = `SO-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`;
        const lastSO = await tx
          .select({ soNumber: salesOrders.soNumber })
          .from(salesOrders)
          .where(sql`${salesOrders.soNumber} LIKE ${prefix + '%'}`)
          .orderBy(desc(salesOrders.soNumber))
          .limit(1);

        let sequence = 1;
        if (lastSO.length > 0) {
          sequence = parseInt(lastSO[0].soNumber.split('-').pop() || '0') + 1;
        }
        const nextSONumber = `${prefix}-${String(sequence).padStart(4, '0')}`;

        let insertedId: number;
        if (isSqlite()) {
          const [newSO] = await tx
            .insert(salesOrders)
            .values({
              soNumber: nextSONumber,
              customerName: data.customerName,
              status: 'confirmed',
              orderDate: data.orderDate,
              requiredDate: data.requiredDate || null,
              totalAmount,
              currency: 'THB',
              source: 'vmi',
              vmiSalesOrderId: data.vmiSalesOrderId,
              notes: data.notes || null,
              createdBy: data.userId,
              createdAt: now,
              updatedAt: now,
            })
            .returning({ id: salesOrders.id });
          insertedId = newSO.id;
        } else {
          const insertResult = await tx
            .insert(salesOrders)
            .values({
              soNumber: nextSONumber,
              customerName: data.customerName,
              status: 'confirmed',
              orderDate: data.orderDate,
              requiredDate: data.requiredDate || null,
              totalAmount,
              currency: 'THB',
              source: 'vmi',
              vmiSalesOrderId: data.vmiSalesOrderId,
              notes: data.notes || null,
              createdBy: data.userId,
              createdAt: now,
              updatedAt: now,
            });
          insertedId = getInsertId(insertResult);
        }
        return { id: insertedId, soNumber: nextSONumber };
      });
      newSOId = result.id;
      soNumber = result.soNumber;
      break;
    } catch (error: any) {
      if (attempt < MAX_SO_RETRIES - 1 && (error.code === 'ER_DUP_ENTRY' || error.message?.includes('UNIQUE constraint failed'))) {
        continue;
      }
      throw error;
    }
  }

  // Create order lines
  for (const line of data.lines) {
    await database.insert(salesOrderLines).values({
      soId: newSOId,
      itemId: line.itemId,
      quantity: line.quantity,
      unit: line.unit,
      unitPrice: line.unitPrice,
      totalPrice: line.quantity * line.unitPrice,
      createdAt: now,
    });
  }

  await createAuditLog({
    userId: data.userId,
    action: 'CREATE',
    tableName: 'sales_orders',
    recordId: newSOId,
    newValue: { soNumber, source: 'vmi', vmiSalesOrderId: data.vmiSalesOrderId, totalAmount },
  });

  return { orderId: newSOId, soNumber };
}

/**
 * Allocate Lots for Sales Order (FEFO)
 */
export async function allocateLotsForOrder(soId: number, userId: number) {
  const { salesOrders, salesOrderLines, items } = getTables();
  const database = (await getDb()) as any;

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
  // Accounting integration - Journal entries
  salesJournalEntryId?: number;
  salesJournalEntryNumber?: string;
  cogsJournalEntryId?: number;
  cogsJournalEntryNumber?: string;
  accountingMessage?: string;
  // AR Invoice integration
  arInvoiceId?: number;
  arInvoiceNumber?: string;
  taxInvoiceNumber?: string;
  arInvoiceMessage?: string;
}

/**
 * Fulfill a sales order line by shipping from a specific lot
 */
export async function fulfillSalesOrderLine(
  input: FulfillmentInput,
  userId: number
): Promise<FulfillmentResult> {
  const { salesOrders, salesOrderLines, salesDeliveries, lots } = getTables();
  const database = (await getDb()) as any;

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

  // Generate delivery number and insert inside a transaction to prevent duplicate numbers
  const MAX_DL_RETRIES = 3;
  let newDeliveryId: number = 0;
  let deliveryNumber: string = '';
  for (let attempt = 0; attempt < MAX_DL_RETRIES; attempt++) {
    try {
      const result = await database.transaction(async (tx: any) => {
        const today = new Date();
        const prefix = `DL-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`;
        const lastDL = await tx
          .select({ deliveryNumber: salesDeliveries.deliveryNumber })
          .from(salesDeliveries)
          .where(sql`${salesDeliveries.deliveryNumber} LIKE ${prefix + '%'}`)
          .orderBy(desc(salesDeliveries.deliveryNumber))
          .limit(1);

        let sequence = 1;
        if (lastDL.length > 0) {
          sequence = parseInt(lastDL[0].deliveryNumber.split('-').pop() || '0') + 1;
        }
        const nextDeliveryNumber = `${prefix}-${String(sequence).padStart(4, '0')}`;

        let insertedId: number;
        if (isSqlite()) {
          const [newDelivery] = await tx
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
              deliveryNumber: nextDeliveryNumber,
              status: 'shipped',
              notes: input.notes,
              createdBy: userId,
            })
            .returning({ id: salesDeliveries.id });
          insertedId = newDelivery.id;
        } else {
          const insertResult = await tx
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
              deliveryNumber: nextDeliveryNumber,
              status: 'shipped',
              notes: input.notes,
              createdBy: userId,
            });
          insertedId = getInsertId(insertResult);
        }
        return { id: insertedId, deliveryNumber: nextDeliveryNumber };
      });
      newDeliveryId = result.id;
      deliveryNumber = result.deliveryNumber;
      break;
    } catch (error: any) {
      if (attempt < MAX_DL_RETRIES - 1 && (error.code === 'ER_DUP_ENTRY' || error.message?.includes('UNIQUE constraint failed'))) {
        continue;
      }
      throw error;
    }
  }

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
    (line: { quantity: number | string | null; shippedQuantity: number | string | null }) => Number(line.shippedQuantity || 0) >= Number(line.quantity)
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
    recordId: newDeliveryId,
    newValue: { deliveryNumber, soId: input.soId, lotNumber: lot.lotNumber, quantity: input.quantity },
  });

  // ============================================
  // Accounting Integration - Create Journal Entry & AR Invoice
  // ============================================
  let salesJournalEntryId: number | undefined;
  let salesJournalEntryNumber: string | undefined;
  let cogsJournalEntryId: number | undefined;
  let cogsJournalEntryNumber: string | undefined;
  let accountingMessage: string | undefined;
  let arInvoiceId: number | undefined;
  let arInvoiceNumber: string | undefined;
  let taxInvoiceNumber: string | undefined;
  let arInvoiceMessage: string | undefined;

  try {
    // Get unit price from SO line
    const unitPrice = Number(soLine.unitPrice) || 0;
    const lineTotal = unitPrice * input.quantity;

    // ============================================
    // US5: COGS Calculation - Calculate and store cost/margin data
    // ============================================
    const cogsResult = await calculateCOGS(input.itemId, input.quantity, unitPrice);

    // Update SO line with COGS and margin data
    await updateSOLineWithCOGS(input.soLineId, cogsResult);

    // Only create journal entries if there's a price
    if (lineTotal > 0) {
      // Calculate VAT (7%)
      const vatCalc = calculateVAT(lineTotal, false);
      const vatAmount = vatCalc.vatAmount;
      const netAmount = vatCalc.baseAmount;

      // Use COGS from the calculated result
      const costOfGoodsSold = cogsResult.totalCost;

      // Create and post journal entries
      const accountingResult = await createSOShipmentJournalEntry(
        {
          deliveryId: newDeliveryId,
          deliveryNumber,
          soId: input.soId,
          soNumber: so.soNumber,
          customerName: so.customerName,
          shipmentDate: getTodayStr(),
          totalAmount: lineTotal,
          vatAmount,
          netAmount,
          costOfGoodsSold,
        },
        userId
      );

      salesJournalEntryId = accountingResult.salesJournalEntryId;
      salesJournalEntryNumber = accountingResult.salesJournalEntryNumber;
      cogsJournalEntryId = accountingResult.cogsJournalEntryId;
      cogsJournalEntryNumber = accountingResult.cogsJournalEntryNumber;
      accountingMessage = accountingResult.message;

      // 2. Create AR Invoice (due in 30 days)
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);
      const dueDateStr = dueDate.toISOString().split('T')[0];

      // Get item details for AR invoice
      const { items } = getTables();
      const [itemDetail] = await database.select().from(items).where(eq(items.id, input.itemId));

      try {
        const arResult = await createARInvoiceFromSOShipment(
          {
            soId: input.soId,
            soNumber: so.soNumber,
            customerId: undefined, // Customer ID not available in denormalized schema
            customerName: so.customerName,
            shipmentDate: getTodayStr(),
            dueDate: dueDateStr,
            deliveryId: newDeliveryId,
            deliveryNumber,
            itemId: input.itemId,
            itemCode: itemDetail?.code || 'Unknown',
            itemName: itemDetail?.nameTh || itemDetail?.nameEn || 'Unknown',
            quantity: input.quantity,
            unitPrice,
            totalAmount: lineTotal,
            vatAmount,
            netAmount,
            lotId: input.lotId,
          },
          userId
        );

        arInvoiceId = arResult.arInvoiceId;
        arInvoiceNumber = arResult.arInvoiceNumber;
        taxInvoiceNumber = arResult.taxInvoiceNumber;
        arInvoiceMessage = arResult.message;
      } catch (arError) {
        console.error('Failed to create AR invoice:', arError);
        arInvoiceMessage = `ไม่สามารถสร้างใบแจ้งหนี้ AR ได้: ${arError instanceof Error ? arError.message : 'Unknown error'}`;
      }
    } else {
      accountingMessage = 'ไม่มีราคาสินค้า - ข้ามการสร้างรายการบัญชี';
      arInvoiceMessage = 'ไม่มีราคาสินค้า - ข้ามการสร้างใบแจ้งหนี้ AR';
    }
  } catch (accountingError) {
    // Log error but don't fail the fulfillment
    console.error('Failed to create accounting entries:', accountingError);
    accountingMessage = `ไม่สามารถสร้างรายการบัญชีได้: ${accountingError instanceof Error ? accountingError.message : 'Unknown error'}`;
  }

  return {
    deliveryId: newDeliveryId,
    deliveryNumber,
    shippedQuantity: input.quantity,
    salesJournalEntryId,
    salesJournalEntryNumber,
    cogsJournalEntryId,
    cogsJournalEntryNumber,
    accountingMessage,
    arInvoiceId,
    arInvoiceNumber,
    taxInvoiceNumber,
    arInvoiceMessage,
  };
}
