/**
 * Purchasing Service
 * Real-world purchasing with VMI integration, vendor management, and AVL
 */

import { getDb, isSqlite } from '../db';
import { getInsertId } from '../db/db-helper';
import { toQueryDate, getTodayStr, getNow } from '../db/date-utils';
import { eq, and, sql, desc, asc, gte, lte, or } from 'drizzle-orm';
import {
  sqlitePurchaseOrders,
  sqlitePurchaseOrderLines,
  sqliteVendors,
  sqliteApprovedVendorList,
  sqliteItems,
  sqliteInventoryLots,
  mysqlPurchaseOrders,
  mysqlPurchaseOrderLines,
  mysqlVendors,
  mysqlApprovedVendorList,
  mysqlItems,
  mysqlInventoryLots,
} from '../db/schema';
import { createAuditLog } from '../audit';
import { receiveMaterial } from './inventory.service';
import { createPOReceiptJournalEntry, createAPInvoiceFromPOReceipt, THAI_VAT_RATE } from './accounting.service';
import { recalculateWAC, updateItemLastPurchase } from './unit-cost.service';

// Types
export interface VMISnapshot {
  timestamp: string;
  vendorId: number;
  items: VMIItemSnapshot[];
}

export interface VMIItemSnapshot {
  itemCode: string;
  itemName: string;
  unit: string;
  onHand: number;
  available: number;
  quarantine: number;
  allocated: number;
  minStock: number;
  maxStock: number;
  reorderPoint: number;
  consumption30d: number | null;
  forecast30d: number | null;
  avgDailyUsage: number | null;
}

export interface ASNData {
  asnNumber: string;
  vendorId: number;
  expectedDeliveryDate: string;
  lines: ASNLine[];
}

export interface ASNLine {
  itemCode: string;
  quantity: number;
  lotNumber: string;
  expiryDate?: string;
  coaAttached?: boolean;
}

export interface VendorEvaluation {
  vendorId: number;
  vendorName: string;
  totalOrders: number;
  onTimeDeliveryRate: number;
  qualityAcceptanceRate: number;
  averageLeadTime: number;
  overallScore: number;
  recommendation: 'approved' | 'conditional' | 'not_recommended';
}

// Receipt result with accounting info
export interface ReceiptResult {
  lotId: number;
  lotNumber: string;
  itemId: number;
  itemCode: string;
  quantity: number;
  // Journal entry info
  journalEntryId?: number;
  journalEntryNumber?: string;
  accountingMessage?: string;
  // AP Invoice info
  apInvoiceId?: number;
  apInvoiceNumber?: string;
  apInvoiceMessage?: string;
}

// Get table references based on database type
function getTables() {
  if (isSqlite()) {
    return {
      purchaseOrders: sqlitePurchaseOrders,
      purchaseOrderLines: sqlitePurchaseOrderLines,
      vendors: sqliteVendors,
      avl: sqliteApprovedVendorList,
      items: sqliteItems,
      lots: sqliteInventoryLots,
    };
  }
  return {
    purchaseOrders: mysqlPurchaseOrders,
    purchaseOrderLines: mysqlPurchaseOrderLines,
    vendors: mysqlVendors,
    avl: mysqlApprovedVendorList,
    items: mysqlItems,
    lots: mysqlInventoryLots,
  };
}

/**
 * Purchase Order Status Workflow
 */
const PO_WORKFLOW: Record<string, { canTransitionTo: string[] }> = {
  draft: { canTransitionTo: ['pending_approval', 'cancelled'] },
  pending_approval: { canTransitionTo: ['approved', 'rejected', 'cancelled'] },
  approved: { canTransitionTo: ['sent', 'cancelled'] },
  sent: { canTransitionTo: ['partial_receipt', 'received', 'cancelled'] },
  partial_receipt: { canTransitionTo: ['received', 'cancelled'] },
  received: { canTransitionTo: ['closed'] },
  closed: { canTransitionTo: [] },
  rejected: { canTransitionTo: ['draft'] },
  cancelled: { canTransitionTo: [] },
};

/**
 * Check Vendor Approval Status (AVL)
 */
export async function checkVendorApproval(
  vendorId: number,
  itemId: number
): Promise<{ approved: boolean; message: string; isPreferred: boolean }> {
  const { avl, vendors } = getTables();
  const database = (await getDb()) as any;

  // Check if vendor exists and is active
  const [vendor] = await database
    .select()
    .from(vendors)
    .where(eq(vendors.id, vendorId));

  if (!vendor) {
    return { approved: false, message: 'Vendor not found', isPreferred: false };
  }

  if (!vendor.isActive) {
    return { approved: false, message: 'Vendor is inactive', isPreferred: false };
  }

  if (!vendor.isApproved) {
    return { approved: false, message: 'Vendor is not approved', isPreferred: false };
  }

  // Check AVL entry
  const [avlEntry] = await database
    .select()
    .from(avl)
    .where(
      and(
        eq(avl.vendorId, vendorId),
        eq(avl.itemId, itemId)
      )
    );

  if (!avlEntry) {
    return { approved: false, message: 'Vendor not approved for this item', isPreferred: false };
  }

  // Check expiry
  if (avlEntry.expiryDate) {
    const today = new Date().toISOString().split('T')[0];
    if (avlEntry.expiryDate < today) {
      return { approved: false, message: 'Vendor approval expired', isPreferred: false };
    }
  }

  return { 
    approved: true, 
    message: 'Approved', 
    isPreferred: avlEntry.isPreferred || false 
  };
}

/**
 * Get Preferred Vendor for Item
 */
export async function getPreferredVendor(itemId: number): Promise<number | null> {
  const { avl, vendors } = getTables();
  const database = (await getDb()) as any;

  const todayForQuery = toQueryDate(getTodayStr());

  // Find preferred vendor from AVL
  const [preferred] = await database
    .select({ vendorId: avl.vendorId })
    .from(avl)
    .innerJoin(vendors, eq(avl.vendorId, vendors.id))
    .where(
      and(
        eq(avl.itemId, itemId),
        eq(avl.isPreferred, true),
        eq(vendors.isActive, true),
        eq(vendors.isApproved, true),
        or(
          sql`${avl.expiryDate} IS NULL`,
          gte(avl.expiryDate, todayForQuery)
        )
      )
    );

  if (preferred) {
    return preferred.vendorId;
  }

  // If no preferred, get any approved vendor
  const [anyApproved] = await database
    .select({ vendorId: avl.vendorId })
    .from(avl)
    .innerJoin(vendors, eq(avl.vendorId, vendors.id))
    .where(
      and(
        eq(avl.itemId, itemId),
        eq(vendors.isActive, true),
        eq(vendors.isApproved, true),
        or(
          sql`${avl.expiryDate} IS NULL`,
          gte(avl.expiryDate, todayForQuery)
        )
      )
    )
    .limit(1);

  return anyApproved?.vendorId || null;
}

/**
 * Create Purchase Order
 */
export async function createPurchaseOrder(
  vendorId: number,
  lines: Array<{ itemId: number; quantity: number; unitPrice: number; requiredDate: string }>,
  userId: number
): Promise<number> {
  const { purchaseOrders, purchaseOrderLines, items } = getTables();
  const database = (await getDb()) as any;

  // Validate vendor approval for all items
  for (const line of lines) {
    const approval = await checkVendorApproval(vendorId, line.itemId);
    if (!approval.approved) {
      const [item] = await database.select().from(items).where(eq(items.id, line.itemId));
      throw new Error(`Vendor not approved for item ${item?.code || line.itemId}: ${approval.message}`);
    }
  }

  // Generate PO number
  const today = new Date();
  const prefix = `PO-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`;
  
  const lastPO = await database
    .select({ poNumber: purchaseOrders.poNumber })
    .from(purchaseOrders)
    .where(sql`${purchaseOrders.poNumber} LIKE ${prefix + '%'}`)
    .orderBy(desc(purchaseOrders.poNumber))
    .limit(1);

  let sequence = 1;
  if (lastPO.length > 0) {
    const lastNum = parseInt(lastPO[0].poNumber.split('-').pop() || '0');
    sequence = lastNum + 1;
  }

  const poNumber = `${prefix}-${String(sequence).padStart(4, '0')}`;

  // Calculate totals
  const totalAmount = lines.reduce((sum: number, line) => sum + (line.quantity * line.unitPrice), 0);

  // Create PO header
  let newPOId: number;
  if (isSqlite()) {
    const [newPO] = await database
      .insert(purchaseOrders)
      .values({
        poNumber,
        vendorId,
        status: 'draft',
        totalAmount,
        currency: 'THB',
        createdBy: userId,
      })
      .returning({ id: purchaseOrders.id });
    newPOId = newPO.id;
  } else {
    const result = await database
      .insert(purchaseOrders)
      .values({
        poNumber,
        vendorId,
        status: 'draft',
        totalAmount,
        currency: 'THB',
        createdBy: userId,
      });
    newPOId = getInsertId(result);
  }

  // Create PO lines
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const [item] = await database.select().from(items).where(eq(items.id, line.itemId));

    await database.insert(purchaseOrderLines).values({
      poId: newPOId,
      itemId: line.itemId,
      quantity: line.quantity,
      unit: item?.primaryUnit || 'EA',
      unitPrice: line.unitPrice,
      totalPrice: line.quantity * line.unitPrice,
      expectedDate: line.requiredDate,
    });
  }

  // Create audit log
  await createAuditLog({
    userId,
    action: 'CREATE',
    tableName: 'purchase_orders',
    recordId: newPOId,
    newValue: {
      poNumber,
      vendorId,
      totalAmount,
      lineCount: lines.length,
    },
  });

  return newPOId;
}

/**
 * Update Purchase Order Status
 */
export async function updatePurchaseOrderStatus(
  poId: number,
  newStatus: string,
  userId: number,
  reason?: string
): Promise<boolean> {
  const { purchaseOrders } = getTables();
  const database = (await getDb()) as any;

  // Get current PO
  const [po] = await database
    .select()
    .from(purchaseOrders)
    .where(eq(purchaseOrders.id, poId));

  if (!po) {
    throw new Error(`Purchase Order ${poId} not found`);
  }

  const currentStatus = po.status;
  const workflow = PO_WORKFLOW[currentStatus];

  if (!workflow) {
    throw new Error(`Invalid current status: ${currentStatus}`);
  }

  if (!workflow.canTransitionTo.includes(newStatus)) {
    throw new Error(
      `Cannot transition from ${currentStatus} to ${newStatus}. Allowed: ${workflow.canTransitionTo.join(', ')}`
    );
  }

  // Update status
  const updateData: Record<string, unknown> = {
    status: newStatus,
    updatedAt: getNow(),
  };

  if (newStatus === 'approved') {
    updateData.approvedBy = userId;
    updateData.approvedAt = getNow();
  }

  await database
    .update(purchaseOrders)
    .set(updateData)
    .where(eq(purchaseOrders.id, poId));

  // Create audit log
  await createAuditLog({
    userId,
    action: 'UPDATE',
    tableName: 'purchase_orders',
    recordId: poId,
    oldValue: { status: currentStatus },
    newValue: { status: newStatus, reason  },
  });

  return true;
}

/**
 * Receive PO Items
 */
export async function receivePurchaseOrder(
  poId: number,
  receivedLines: Array<{
    lineId: number;
    receivedQuantity: number;
    lotNumber: string;
    expiryDate?: string;
  }>,
  warehouseId: number,
  userId: number
): Promise<ReceiptResult[]> {
  const { purchaseOrders, purchaseOrderLines, items, vendors } = getTables();
  const database = (await getDb()) as any;

  // Get PO with vendor info
  const [po] = await database
    .select({
      id: purchaseOrders.id,
      poNumber: purchaseOrders.poNumber,
      vendorId: purchaseOrders.vendorId,
      status: purchaseOrders.status,
    })
    .from(purchaseOrders)
    .where(eq(purchaseOrders.id, poId));

  if (!po) {
    throw new Error(`Purchase Order ${poId} not found`);
  }

  if (po.status !== 'sent' && po.status !== 'partial_receipt') {
    throw new Error(`Purchase Order must be Sent or Partial Receipt to receive items`);
  }

  // Get vendor name
  const [vendor] = await database
    .select({ name: vendors.name })
    .from(vendors)
    .where(eq(vendors.id, po.vendorId));

  const vendorName = vendor?.name || 'Unknown Vendor';

  const results: ReceiptResult[] = [];

  for (const received of receivedLines) {
    // Get PO line with item info
    const [poLine] = await database
      .select({
        id: purchaseOrderLines.id,
        itemId: purchaseOrderLines.itemId,
        quantity: purchaseOrderLines.quantity,
        receivedQuantity: purchaseOrderLines.receivedQuantity,
        unit: purchaseOrderLines.unit,
        unitPrice: purchaseOrderLines.unitPrice,
      })
      .from(purchaseOrderLines)
      .where(eq(purchaseOrderLines.id, received.lineId));

    if (!poLine) {
      throw new Error(`PO Line ${received.lineId} not found`);
    }

    // Get item info
    const [item] = await database
      .select({ code: items.code })
      .from(items)
      .where(eq(items.id, poLine.itemId));

    const itemCode = item?.code || 'Unknown';

    // Create inventory lot (in quarantine)
    const lotId = await receiveMaterial(
      poLine.itemId,
      received.lotNumber,
      received.receivedQuantity,
      poLine.unit,
      warehouseId,
      received.expiryDate || null,
      po.vendorId,
      po.poNumber,
      userId
    );

    // ============================================
    // Unit Cost Integration - Recalculate WAC on receipt
    // ============================================
    const unitPrice = Number(poLine.unitPrice) || 0;
    if (unitPrice > 0 && received.receivedQuantity > 0) {
      try {
        // Recalculate WAC with the received quantity and cost
        await recalculateWAC({
          itemId: poLine.itemId,
          transactionType: 'receipt',
          transactionId: lotId, // Use lot ID as transaction reference
          quantity: received.receivedQuantity,
          unitCost: unitPrice,
          transactionDate: getTodayStr(),
          notes: `PO Receipt: ${po.poNumber}, Lot: ${received.lotNumber}`,
          createdBy: userId,
        });

        // Update item's last purchase info
        await updateItemLastPurchase(
          poLine.itemId,
          unitPrice,
          poId
        );
      } catch (costError) {
        // Log error but don't fail the receipt
        console.error('WAC calculation error:', costError);
      }
    }

    // Update PO line received quantity
    const newReceivedQty = (Number(poLine.receivedQuantity) || 0) + received.receivedQuantity;
    await database
      .update(purchaseOrderLines)
      .set({
        receivedQuantity: newReceivedQty,
        updatedAt: getNow(),
      })
      .where(eq(purchaseOrderLines.id, received.lineId));

    // ============================================
    // Accounting Integration - Create Journal Entry & AP Invoice
    // ============================================
    let journalEntryId: number | undefined;
    let journalEntryNumber: string | undefined;
    let accountingMessage: string | undefined;
    let apInvoiceId: number | undefined;
    let apInvoiceNumber: string | undefined;
    let apInvoiceMessage: string | undefined;

    // Get item name
    const [itemDetail] = await database
      .select({ nameTh: items.nameTh })
      .from(items)
      .where(eq(items.id, poLine.itemId));
    const itemName = itemDetail?.nameTh || itemCode;

    try {
      const unitPrice = Number(poLine.unitPrice) || 0;
      const lineTotal = unitPrice * received.receivedQuantity;

      // Only create journal entry and AP invoice if there's a price
      if (lineTotal > 0) {
        // Calculate VAT (7%) - assuming prices include VAT
        const vatAmount = Math.round(lineTotal * THAI_VAT_RATE * 100) / 100;
        const netAmount = lineTotal - vatAmount;

        const receiptDate = getTodayStr();

        // 1. Create Journal Entry for inventory receipt
        const accountingResult = await createPOReceiptJournalEntry(
          {
            poId,
            poNumber: po.poNumber,
            vendorId: po.vendorId,
            vendorName,
            receiptDate,
            lotId,
            lotNumber: received.lotNumber,
            itemId: poLine.itemId,
            itemCode,
            quantity: received.receivedQuantity,
            unitPrice,
            totalAmount: lineTotal,
            vatAmount,
            netAmount,
          },
          userId
        );

        journalEntryId = accountingResult.journalEntryId;
        journalEntryNumber = accountingResult.journalEntryNumber;
        accountingMessage = accountingResult.message;

        // 2. Create AP Invoice (due in 30 days)
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);
        const dueDateStr = dueDate.toISOString().split('T')[0];

        try {
          const apResult = await createAPInvoiceFromPOReceipt(
            {
              poId,
              poNumber: po.poNumber,
              vendorId: po.vendorId,
              vendorName,
              receiptDate,
              dueDate: dueDateStr,
              lotId,
              lotNumber: received.lotNumber,
              itemId: poLine.itemId,
              itemCode,
              itemName,
              quantity: received.receivedQuantity,
              unitPrice,
              totalAmount: lineTotal,
              vatAmount,
              netAmount,
            },
            userId
          );

          apInvoiceId = apResult.apInvoiceId;
          apInvoiceNumber = apResult.apInvoiceNumber;
          apInvoiceMessage = apResult.message;
        } catch (apError) {
          console.error('Failed to create AP invoice:', apError);
          apInvoiceMessage = `ไม่สามารถสร้างใบแจ้งหนี้ AP ได้: ${apError instanceof Error ? apError.message : 'Unknown error'}`;
        }
      } else {
        accountingMessage = 'ไม่มีราคาสินค้า - ข้ามการสร้างรายการบัญชี';
        apInvoiceMessage = 'ไม่มีราคาสินค้า - ข้ามการสร้างใบแจ้งหนี้ AP';
      }
    } catch (accountingError) {
      // Log error but don't fail the receipt
      console.error('Failed to create accounting entries:', accountingError);
      accountingMessage = `ไม่สามารถสร้างรายการบัญชีได้: ${accountingError instanceof Error ? accountingError.message : 'Unknown error'}`;
    }

    results.push({
      lotId,
      lotNumber: received.lotNumber,
      itemId: poLine.itemId,
      itemCode,
      quantity: received.receivedQuantity,
      journalEntryId,
      journalEntryNumber,
      accountingMessage,
      apInvoiceId,
      apInvoiceNumber,
      apInvoiceMessage,
    });
  }

  // Check all lines to determine PO status
  const allLines = await database
    .select({
      quantity: purchaseOrderLines.quantity,
      receivedQuantity: purchaseOrderLines.receivedQuantity,
    })
    .from(purchaseOrderLines)
    .where(eq(purchaseOrderLines.poId, poId));

  const totalOrdered = allLines.reduce((sum: number, l: { quantity: number | string | null; receivedQuantity: number | string | null }) => sum + (Number(l.quantity) || 0), 0);
  const totalReceived = allLines.reduce((sum: number, l: { quantity: number | string | null; receivedQuantity: number | string | null }) => sum + (Number(l.receivedQuantity) || 0), 0);

  // Update PO status
  let newStatus = 'partial_receipt';
  if (totalReceived >= totalOrdered) {
    newStatus = 'received';
  }

  await updatePurchaseOrderStatus(poId, newStatus, userId);

  return results;
}

/**
 * Generate VMI Snapshot for Vendor
 */
export async function generateVMISnapshot(vendorId: number): Promise<VMISnapshot> {
  const { vendors, avl, items, lots } = getTables();
  const database = (await getDb()) as any;

  // Get vendor
  const [vendor] = await database
    .select()
    .from(vendors)
    .where(eq(vendors.id, vendorId));

  if (!vendor) {
    throw new Error(`Vendor ${vendorId} not found`);
  }

  if (!vendor.isVMI) {
    throw new Error(`Vendor ${vendor.name} is not a VMI vendor`);
  }

  // Get all items for this vendor from AVL
  const vendorItems = await database
    .select({
      itemId: avl.itemId,
      itemCode: items.code,
      itemName: items.nameEn,
      unit: items.primaryUnit,
      minStock: items.minStock,
      maxStock: items.maxStock,
      reorderPoint: items.reorderPoint,
    })
    .from(avl)
    .innerJoin(items, eq(avl.itemId, items.id))
    .where(eq(avl.vendorId, vendorId));

  const snapshot: VMISnapshot = {
    timestamp: new Date().toISOString(),
    vendorId,
    items: [],
  };

  for (const item of vendorItems) {
    // Get stock levels
    const stockData = await database
      .select({
        status: lots.status,
        totalQuantity: sql<number>`COALESCE(SUM(${lots.quantity}), 0)`,
        totalReserved: sql<number>`COALESCE(SUM(${lots.reservedQuantity}), 0)`,
      })
      .from(lots)
      .where(eq(lots.itemId, item.itemId))
      .groupBy(lots.status);

    let onHand = 0;
    let reserved = 0;
    let quarantine = 0;

    for (const row of stockData) {
      const qty = Number(row.totalQuantity) || 0;
      const res = Number(row.totalReserved) || 0;

      if (row.status === 'released') {
        onHand += qty;
        reserved += res;
      } else if (row.status === 'quarantine' || row.status === 'under_test') {
        quarantine += qty;
      }
    }

    // TODO: Query actual consumption from inventory_transactions where type='issue' or 'shipment'
    // Requires join: inventory_transactions -> inventory_lots (by lotId) -> items (by itemId)
    // Until consumption tracking is wired up, leave as null rather than misleading 0
    const consumption30d: number | null = null; // No consumption tracking available yet

    const avgDailyUsage = consumption30d !== null ? consumption30d / 30 : null;
    const forecast30d = avgDailyUsage !== null ? avgDailyUsage * 30 : null;

    snapshot.items.push({
      itemCode: item.itemCode,
      itemName: item.itemName || item.itemCode,
      unit: item.unit,
      onHand,
      available: onHand - reserved,
      quarantine,
      allocated: reserved,
      minStock: Number(item.minStock) || 0,
      maxStock: Number(item.maxStock) || 0,
      reorderPoint: Number(item.reorderPoint) || 0,
      consumption30d,
      forecast30d,
      avgDailyUsage,
    });
  }

  return snapshot;
}

/**
 * Process ASN (Advance Shipping Notice) from VMI Vendor
 */
export async function processVMIASN(
  asn: ASNData,
  userId: number
): Promise<{ poId: number; lotIds: number[] }> {
  const { items, vendors } = getTables();
  const database = (await getDb()) as any;

  // Validate vendor
  const [vendor] = await database
    .select()
    .from(vendors)
    .where(eq(vendors.id, asn.vendorId));

  if (!vendor) {
    throw new Error(`Vendor ${asn.vendorId} not found`);
  }

  if (!vendor.isVMI) {
    throw new Error(`Vendor ${vendor.name} is not a VMI vendor`);
  }

  // Create PO from ASN
  const poLines: Array<{ itemId: number; quantity: number; unitPrice: number; requiredDate: string }> = [];

  for (const line of asn.lines) {
    const [item] = await database
      .select()
      .from(items)
      .where(eq(items.code, line.itemCode));

    if (!item) {
      throw new Error(`Item ${line.itemCode} not found`);
    }

    poLines.push({
      itemId: item.id,
      quantity: line.quantity,
      unitPrice: 0, // VMI pricing handled separately
      requiredDate: asn.expectedDeliveryDate,
    });
  }

  // Create PO
  const poId = await createPurchaseOrder(asn.vendorId, poLines, userId);

  // Auto-approve VMI PO
  await updatePurchaseOrderStatus(poId, 'pending_approval', userId);
  await updatePurchaseOrderStatus(poId, 'approved', userId, 'VMI Auto-Approval');
  await updatePurchaseOrderStatus(poId, 'sent', userId);

  // Create audit log for ASN
  await createAuditLog({
    userId,
    action: 'CREATE',
    tableName: 'purchase_orders',
    recordId: poId,
    newValue: {
      asnNumber: asn.asnNumber,
      vendorId: asn.vendorId,
      expectedDeliveryDate: asn.expectedDeliveryDate,
      lineCount: asn.lines.length,
    },
  });

  return { poId, lotIds: [] }; // Lots created when actually received
}

/**
 * Evaluate Vendor Performance
 */
export async function evaluateVendorPerformance(
  vendorId: number,
  dateFrom?: string,
  dateTo?: string
): Promise<VendorEvaluation> {
  const { vendors, purchaseOrders, purchaseOrderLines, lots } = getTables();
  const database = (await getDb()) as any;

  // Get vendor
  const [vendor] = await database
    .select()
    .from(vendors)
    .where(eq(vendors.id, vendorId));

  if (!vendor) {
    throw new Error(`Vendor ${vendorId} not found`);
  }

  // Get completed POs
  const conditions = [
    eq(purchaseOrders.vendorId, vendorId),
    or(eq(purchaseOrders.status, 'received'), eq(purchaseOrders.status, 'closed')),
  ];

  if (dateFrom) {
    conditions.push(gte(purchaseOrders.createdAt, toQueryDate(dateFrom)));
  }
  if (dateTo) {
    conditions.push(lte(purchaseOrders.createdAt, toQueryDate(dateTo)));
  }

  const completedPOs = await database
    .select()
    .from(purchaseOrders)
    .where(and(...conditions));

  // Calculate metrics
  let onTimeCount = 0;
  let totalLeadTime = 0;

  for (const po of completedPOs) {
    // Check if PO was delivered by expected date
    const receivedDate = po.updatedAt;
    const expectedDate = po.expectedDate || po.orderDate;
    if (receivedDate && expectedDate && receivedDate <= expectedDate) {
      onTimeCount++;
    } else if (!receivedDate || !expectedDate) {
      // If dates missing, assume on-time to avoid penalizing incomplete data
      onTimeCount++;
    }
    totalLeadTime += vendor.leadTimeDays || 7;
  }

  // Get quality acceptance rate from lots
  const vendorLots = await database
    .select({
      status: lots.status,
    })
    .from(lots)
    .where(eq(lots.vendorId, vendorId));

  const totalLots = vendorLots.length;
  const releasedLots = vendorLots.filter((l: any) => l.status === 'released').length;
  const rejectedLots = vendorLots.filter((l: any) => l.status === 'rejected').length;

  const decidedLots = releasedLots + rejectedLots;
  const qualityAcceptanceRate = decidedLots > 0
    ? (releasedLots / decidedLots) * 100
    : 100;

  const onTimeDeliveryRate = completedPOs.length > 0 
    ? (onTimeCount / completedPOs.length) * 100 
    : 100;

  const averageLeadTime = completedPOs.length > 0 
    ? totalLeadTime / completedPOs.length 
    : vendor.leadTimeDays || 7;

  // Calculate overall score (weighted average)
  const overallScore = (
    onTimeDeliveryRate * 0.3 +
    qualityAcceptanceRate * 0.5 +
    (100 - Math.min(averageLeadTime, 30) / 30 * 100) * 0.2
  );

  // Determine recommendation
  let recommendation: 'approved' | 'conditional' | 'not_recommended' = 'approved';
  if (overallScore < 60) {
    recommendation = 'not_recommended';
  } else if (overallScore < 80) {
    recommendation = 'conditional';
  }

  return {
    vendorId,
    vendorName: vendor.name,
    totalOrders: completedPOs.length,
    onTimeDeliveryRate: Math.round(onTimeDeliveryRate * 10) / 10,
    qualityAcceptanceRate: Math.round(qualityAcceptanceRate * 10) / 10,
    averageLeadTime: Math.round(averageLeadTime * 10) / 10,
    overallScore: Math.round(overallScore * 10) / 10,
    recommendation,
  };
}

/**
 * Add Vendor to AVL
 */
export async function addToAVL(
  vendorId: number,
  itemId: number,
  isPreferred: boolean,
  expiryDate: string | null,
  userId: number
): Promise<number> {
  const { avl } = getTables();
  const database = (await getDb()) as any;

  // Check if already exists
  const [existing] = await database
    .select()
    .from(avl)
    .where(
      and(
        eq(avl.vendorId, vendorId),
        eq(avl.itemId, itemId)
      )
    );

  if (existing) {
    // Update existing
    await database
      .update(avl)
      .set({
        isPreferred,
        expiryDate,
        approvalDate: new Date().toISOString().split('T')[0],
      })
      .where(eq(avl.id, existing.id));

    await createAuditLog({
      userId,
      action: 'UPDATE',
      tableName: 'approved_vendor_list',
      recordId: existing.id,
      newValue: { isPreferred, expiryDate  },
    });

    return existing.id;
  }

  // Create new AVL entry
  let newAVLId: number;
  if (isSqlite()) {
    const [newAVL] = await database
      .insert(avl)
      .values({
        vendorId,
        itemId,
        isPreferred,
        approvalDate: new Date().toISOString().split('T')[0],
        expiryDate,
      })
      .returning({ id: avl.id });
    newAVLId = newAVL.id;
  } else {
    const result = await database
      .insert(avl)
      .values({
        vendorId,
        itemId,
        isPreferred,
        approvalDate: new Date().toISOString().split('T')[0],
        expiryDate,
      });
    newAVLId = getInsertId(result);
  }

  await createAuditLog({
    userId,
    action: 'CREATE',
    tableName: 'approved_vendor_list',
    recordId: newAVLId,
    newValue: { vendorId, itemId, isPreferred  },
  });

  return newAVLId;
}
