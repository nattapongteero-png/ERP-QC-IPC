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
  sqliteARInvoices,
  sqliteJournalEntries,
  mysqlSalesOrders,
  mysqlSalesOrderLines,
  mysqlSalesDeliveries,
  mysqlItems,
  mysqlInventoryLots,
  mysqlARInvoices,
  mysqlJournalEntries,
} from '../db/schema';
import { createAuditLog } from '../audit';
import { getLotsForPicking, reserveLots, issueMaterial } from './inventory.service';
import { getNow, getTodayStr, toDbDate } from '../db/date-utils';
import { createSOShipmentJournalEntry, createARInvoiceFromSOShipment, calculateVAT } from './accounting.service';
import { calculateCOGS, updateSOLineWithCOGS } from './unit-cost.service';
import { getInvoicePaymentTermsDays } from './settings.service';

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
      arInvoices: sqliteARInvoices,
      journalEntries: sqliteJournalEntries,
    };
  }
  return {
    salesOrders: mysqlSalesOrders,
    salesOrderLines: mysqlSalesOrderLines,
    salesDeliveries: mysqlSalesDeliveries,
    items: mysqlItems,
    lots: mysqlInventoryLots,
    arInvoices: mysqlARInvoices,
    journalEntries: mysqlJournalEntries,
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
  userId: number,
  // false = line prices are BEFORE VAT (add 7% at shipment); true = prices
  // already INCLUDE VAT (extract 7/107). Stored so the SO/AR/print all agree.
  vatInclusive: boolean = false,
): Promise<{ orderId: number; atpResults: ATPResult[] }> {
  const { salesOrders, salesOrderLines, items } = getTables();
  const database = (await getDb()) as any;

  if (!customer.name) throw new Error('Customer name is required');

  const atpResults: ATPResult[] = [];
  for (const line of lines) {
    atpResults.push(await checkATP(line.itemId, line.quantity));
  }

  const totalAmount = lines.reduce((sum: number, l: { quantity: number; unitPrice: number }) => sum + l.quantity * l.unitPrice, 0);

  // Generate SO number with retry to prevent duplicate numbers under concurrency
  const MAX_RETRIES = 3;
  let newSOId: number = 0;
  let soNumber: string = '';
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
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
      const nextSONumber = `${prefix}-${String(sequence).padStart(4, '0')}`;

      let insertedId: number;
      if (isSqlite()) {
        const [newSO] = await database
          .insert(salesOrders)
          .values({
            soNumber: nextSONumber,
            customerName: customer.name,
            customerContact: customer.contact,
            customerAddress: customer.address,
            // order_date is nullable and was never stamped here, so every SO
            // created through this path (incl. quotation→SO conversion) showed a
            // blank วันที่สั่ง. Default it to today at creation.
            orderDate: getTodayStr(),
            status: 'draft',
            totalAmount,
            vatInclusive,
            currency: 'THB',
            createdBy: userId,
          })
          .returning({ id: salesOrders.id });
        insertedId = newSO.id;
      } else {
        const insertResult = await database
          .insert(salesOrders)
          .values({
            soNumber: nextSONumber,
            customerName: customer.name,
            customerContact: customer.contact,
            customerAddress: customer.address,
            // Stamp today so วันที่สั่ง is never blank (see SQLite branch above).
            // toDbDate, NOT the bare string: sales_orders.order_date is a MySQL
            // datetime, and the driver calls .toISOString() on whatever it is
            // handed — a "YYYY-MM-DD" string has no such method, so converting a
            // quotation died with "a.toISOString is not a function".
            orderDate: toDbDate(getTodayStr()),
            status: 'draft',
            totalAmount,
            vatInclusive,
            currency: 'THB',
            createdBy: userId,
          });
        insertedId = getInsertId(insertResult);
      }
      newSOId = insertedId;
      soNumber = nextSONumber;
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

  // Generate SO number with retry to prevent duplicate numbers under concurrency
  const MAX_SO_RETRIES = 3;
  let newSOId: number = 0;
  let soNumber: string = '';
  for (let attempt = 0; attempt < MAX_SO_RETRIES; attempt++) {
    try {
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
      const nextSONumber = `${prefix}-${String(sequence).padStart(4, '0')}`;

      let insertedId: number;
      if (isSqlite()) {
        const [newSO] = await database
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
        const insertResult = await database
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
      newSOId = insertedId;
      soNumber = nextSONumber;
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
  accountingFailed?: boolean;
  // AR Invoice integration
  arInvoiceId?: number;
  arInvoiceNumber?: string;
  taxInvoiceNumber?: string;
  arInvoiceMessage?: string;
  arInvoiceFailed?: boolean;
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
      const nextDeliveryNumber = `${prefix}-${String(sequence).padStart(4, '0')}`;

      let insertedId: number;
      if (isSqlite()) {
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
            deliveryNumber: nextDeliveryNumber,
            status: 'shipped',
            notes: input.notes,
            createdBy: userId,
          })
          .returning({ id: salesDeliveries.id });
        insertedId = newDelivery.id;
      } else {
        const insertResult = await database
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
      newDeliveryId = insertedId;
      deliveryNumber = nextDeliveryNumber;
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
  let accountingFailed = false;
  let arInvoiceFailed = false;

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
      // Calculate VAT (7%) per the SO's pricing mode. Exclusive → price is net,
      // VAT added at shipment (tax invoice). Inclusive → price already contains
      // VAT, extract 7/107. totalAmount = net + VAT so the sales JE balances
      // (Dr. AR = Cr. Sales + Cr. Output VAT).
      const [soHdr] = await database
        .select({ vatInclusive: salesOrders.vatInclusive })
        .from(salesOrders)
        .where(eq(salesOrders.id, input.soId))
        .limit(1);
      const vatCalc = calculateVAT(lineTotal, soHdr?.vatInclusive === true);
      const vatAmount = vatCalc.vatAmount;
      const netAmount = vatCalc.baseAmount;
      const grossAmount = vatCalc.totalAmount;

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
          totalAmount: grossAmount,
          vatAmount,
          netAmount,
          costOfGoodsSold,
        },
        userId
      );

      cogsJournalEntryId = accountingResult.cogsJournalEntryId;
      cogsJournalEntryNumber = accountingResult.cogsJournalEntryNumber;
      accountingMessage = accountingResult.message;

      // 2. Create AR Invoice (due in 30 days).
      // The AR invoice — not the shipment — books revenue, AR and Output VAT, so its
      // journal entry IS the sales journal entry.
      // Due date = today + the configurable payment-terms days (list item 3),
      // replacing the previously hard-coded 30.
      const termsDays = await getInvoicePaymentTermsDays();
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + termsDays);
      const dueDateStr = dueDate.toISOString().split('T')[0];

      // Get item details for AR invoice
      const { items } = getTables();
      const [itemDetail] = await database.select().from(items).where(eq(items.id, input.itemId));

      try {
        const arResult = await createARInvoiceFromSOShipment(
          {
            soId: input.soId,
            soNumber: so.soNumber,
            // sales_orders.customer_id now links to the customer master, so
            // the invoice no longer has to guess the buyer from a name string.
            customerId: (so as { customerId?: number | null }).customerId ?? undefined,
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
            totalAmount: grossAmount,
            vatAmount,
            netAmount,
            lotId: input.lotId,
            // Order-level freight, billed once on the first invoice for this SO.
            shippingCost: Number(so.shippingCost) || 0,
          },
          userId
        );

        arInvoiceId = arResult.arInvoiceId;
        arInvoiceNumber = arResult.arInvoiceNumber;
        taxInvoiceNumber = arResult.taxInvoiceNumber;
        arInvoiceMessage = arResult.message;
        // The AR invoice's JE is the revenue/AR entry for this shipment
        salesJournalEntryId = arResult.journalEntryId;
        salesJournalEntryNumber = arResult.journalEntryNumber;
      } catch (arError) {
        console.error('Failed to create AR invoice:', arError);
        arInvoiceMessage = `ไม่สามารถสร้างใบแจ้งหนี้ AR ได้: ${arError instanceof Error ? arError.message : 'Unknown error'}`;
        arInvoiceFailed = true;
      }
    } else {
      accountingMessage = 'ไม่มีราคาสินค้า - ข้ามการสร้างรายการบัญชี';
      arInvoiceMessage = 'ไม่มีราคาสินค้า - ข้ามการสร้างใบแจ้งหนี้ AR';
    }
  } catch (accountingError) {
    // Log error but don't fail the fulfillment
    console.error('Failed to create accounting entries:', accountingError);
    accountingMessage = `ไม่สามารถสร้างรายการบัญชีได้: ${accountingError instanceof Error ? accountingError.message : 'Unknown error'}`;
    accountingFailed = true;
    arInvoiceFailed = true;
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
    accountingFailed,
    arInvoiceId,
    arInvoiceNumber,
    taxInvoiceNumber,
    arInvoiceMessage,
    arInvoiceFailed,
  };
}

// ============================================================================
// Retry accounting for an existing shipment
// ============================================================================
//
// Usable when the original fulfill call shipped the goods but the accounting
// integration failed silently (e.g. the VAT-unbalanced JE bug fixed in
// 2026-05). Idempotent: skips deliveries that already have a posted sales JE
// or AR invoice so it's safe to run as a recovery sweep.

export interface RetryAccountingResult {
  deliveryId: number;
  deliveryNumber: string;
  alreadyHadJournal: boolean;
  alreadyHadInvoice: boolean;
  salesJournalEntryId?: number;
  salesJournalEntryNumber?: string;
  cogsJournalEntryId?: number;
  cogsJournalEntryNumber?: string;
  arInvoiceId?: number;
  arInvoiceNumber?: string;
  taxInvoiceNumber?: string;
  message: string;
}

export async function retryAccountingForDelivery(
  deliveryId: number,
  userId: number,
): Promise<RetryAccountingResult> {
  const database = (await getDb()) as any;
  const { salesOrders, salesOrderLines, salesDeliveries, items, arInvoices, journalEntries } =
    getTables();

  const [delivery] = await database
    .select()
    .from(salesDeliveries)
    .where(eq(salesDeliveries.id, deliveryId));
  if (!delivery) throw new Error(`Delivery ${deliveryId} not found`);

  const [so] = await database
    .select()
    .from(salesOrders)
    .where(eq(salesOrders.id, delivery.soId));
  if (!so) throw new Error(`Sales order ${delivery.soId} not found`);

  const [soLine] = await database
    .select()
    .from(salesOrderLines)
    .where(eq(salesOrderLines.id, delivery.soLineId));
  if (!soLine) throw new Error(`SO line ${delivery.soLineId} not found`);

  const [item] = await database
    .select()
    .from(items)
    .where(eq(items.id, delivery.itemId));

  const existingJournals = await database
    .select({ id: journalEntries.id })
    .from(journalEntries)
    .where(
      and(
        eq(journalEntries.sourceType, 'SO_SHIPMENT'),
        eq(journalEntries.sourceId, deliveryId),
      ),
    );
  const alreadyHadJournal = existingJournals.length > 0;

  const existingInvoices = await database
    .select({ id: arInvoices.id, invoiceNumber: arInvoices.invoiceNumber })
    .from(arInvoices)
    .where(eq(arInvoices.salesOrderId, delivery.soId));
  const alreadyHadInvoice = existingInvoices.length > 0;

  if (alreadyHadJournal && alreadyHadInvoice) {
    return {
      deliveryId,
      deliveryNumber: delivery.deliveryNumber,
      alreadyHadJournal,
      alreadyHadInvoice,
      message: 'รายการบัญชีและใบกำกับภาษีถูกสร้างไว้แล้ว — ข้าม',
    };
  }

  const unitPrice = Number(soLine.unitPrice) || 0;
  const quantity = Number(delivery.quantity) || 0;
  const lineTotal = unitPrice * quantity;
  if (lineTotal <= 0) {
    return {
      deliveryId,
      deliveryNumber: delivery.deliveryNumber,
      alreadyHadJournal,
      alreadyHadInvoice,
      message: 'ไม่มีราคาสินค้า — ไม่ต้องสร้างรายการบัญชี',
    };
  }

  const cogsResult = await calculateCOGS(delivery.itemId, quantity, unitPrice);
  await updateSOLineWithCOGS(delivery.soLineId, cogsResult);

  const vatCalc = calculateVAT(lineTotal, so.vatInclusive === true);

  let salesJournalEntryId: number | undefined;
  let salesJournalEntryNumber: string | undefined;
  let cogsJournalEntryId: number | undefined;
  let cogsJournalEntryNumber: string | undefined;
  if (!alreadyHadJournal) {
    const accountingResult = await createSOShipmentJournalEntry(
      {
        deliveryId,
        deliveryNumber: delivery.deliveryNumber,
        soId: delivery.soId,
        soNumber: so.soNumber,
        customerName: so.customerName,
        shipmentDate: getTodayStr(),
        totalAmount: vatCalc.totalAmount,
        vatAmount: vatCalc.vatAmount,
        netAmount: vatCalc.baseAmount,
        costOfGoodsSold: cogsResult.totalCost,
      },
      userId,
    );
    cogsJournalEntryId = accountingResult.cogsJournalEntryId;
    cogsJournalEntryNumber = accountingResult.cogsJournalEntryNumber;
  }

  let arInvoiceId: number | undefined;
  let arInvoiceNumber: string | undefined;
  let taxInvoiceNumber: string | undefined;
  if (!alreadyHadInvoice) {
    // Configurable payment terms (list item 3), was hard-coded 30.
    const termsDays = await getInvoicePaymentTermsDays();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + termsDays);
    const arResult = await createARInvoiceFromSOShipment(
      {
        soId: delivery.soId,
        soNumber: so.soNumber,
        customerId: (so as { customerId?: number | null }).customerId ?? undefined,
        customerName: so.customerName,
        shipmentDate: getTodayStr(),
        dueDate: dueDate.toISOString().split('T')[0],
        deliveryId,
        deliveryNumber: delivery.deliveryNumber,
        itemId: delivery.itemId,
        itemCode: item?.code || 'Unknown',
        itemName: item?.nameTh || item?.nameEn || 'Unknown',
        quantity,
        unitPrice,
        totalAmount: vatCalc.totalAmount,
        vatAmount: vatCalc.vatAmount,
        netAmount: vatCalc.baseAmount,
        lotId: delivery.lotId,
        // Order-level freight, billed once on the first invoice for this SO.
        shippingCost: Number(so.shippingCost) || 0,
      },
      userId,
    );
    arInvoiceId = arResult.arInvoiceId;
    arInvoiceNumber = arResult.arInvoiceNumber;
    taxInvoiceNumber = arResult.taxInvoiceNumber;
    // The AR invoice's JE is the revenue/AR entry for this shipment
    salesJournalEntryId = arResult.journalEntryId;
    salesJournalEntryNumber = arResult.journalEntryNumber;
  }

  return {
    deliveryId,
    deliveryNumber: delivery.deliveryNumber,
    alreadyHadJournal,
    alreadyHadInvoice,
    salesJournalEntryId,
    salesJournalEntryNumber,
    cogsJournalEntryId,
    cogsJournalEntryNumber,
    arInvoiceId,
    arInvoiceNumber,
    taxInvoiceNumber,
    message: alreadyHadJournal || alreadyHadInvoice
      ? 'สร้างรายการบัญชีที่ขาดเรียบร้อย'
      : 'สร้างรายการบัญชีและใบกำกับภาษีย้อนหลังเรียบร้อย',
  };
}

// Sweep recovery: scan all shipped deliveries that are missing accounting
// artifacts and retry. Returns per-delivery results so the caller can audit.
export async function retryAccountingForAllPendingDeliveries(
  userId: number,
): Promise<{ scanned: number; fixed: number; results: RetryAccountingResult[] }> {
  const database = (await getDb()) as any;
  const { salesDeliveries, journalEntries, arInvoices } = getTables();

  const allDeliveries = await database
    .select({
      id: salesDeliveries.id,
      soId: salesDeliveries.soId,
      status: salesDeliveries.status,
    })
    .from(salesDeliveries)
    .where(eq(salesDeliveries.status, 'shipped'));

  const results: RetryAccountingResult[] = [];
  let fixed = 0;
  for (const d of allDeliveries) {
    const hasJE = await database
      .select({ id: journalEntries.id })
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.sourceType, 'SO_SHIPMENT'),
          eq(journalEntries.sourceId, d.id),
        ),
      )
      .limit(1);
    const hasAR = await database
      .select({ id: arInvoices.id })
      .from(arInvoices)
      .where(eq(arInvoices.salesOrderId, d.soId))
      .limit(1);
    if (hasJE.length > 0 && hasAR.length > 0) continue;

    try {
      const r = await retryAccountingForDelivery(d.id, userId);
      results.push(r);
      if (!r.alreadyHadJournal || !r.alreadyHadInvoice) fixed += 1;
    } catch (e) {
      results.push({
        deliveryId: d.id,
        deliveryNumber: '?',
        alreadyHadJournal: false,
        alreadyHadInvoice: false,
        message: `ผิดพลาด: ${e instanceof Error ? e.message : 'unknown'}`,
      });
    }
  }

  return { scanned: allDeliveries.length, fixed, results };
}
