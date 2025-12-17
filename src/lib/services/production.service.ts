/**
 * Production Service
 * Real-world production management with eBMR, work order workflows, and yield calculation
 */

import { db, useSqlite } from '../db';
import { eq, and, sql, desc, asc, gte, lte } from 'drizzle-orm';
import {
  sqliteWorkOrders,
  sqliteWorkOrderMaterials,
  sqliteBOM,
  sqliteBOMLines,
  sqliteItems,
  sqliteInventoryLots,
  sqliteInventoryTransactions,
  mysqlWorkOrders,
  mysqlWorkOrderMaterials,
  mysqlBOM,
  mysqlBOMLines,
  mysqlItems,
  mysqlInventoryLots,
  mysqlInventoryTransactions,
} from '../db/schema';
import { createAuditLog } from '../audit';
import { getLotsForPicking, issueMaterial, receiveMaterial } from './inventory.service';

// Types
export interface BOMExplosionResult {
  itemId: number;
  itemCode: string;
  itemName: string;
  requiredQuantity: number;
  unit: string;
  level: number;
  availableStock: number;
  shortage: number;
}

export interface YieldCalculation {
  theoretical: number;
  actualGood: number;
  actualReject: number;
  yieldPercent: number;
  rejectPercent: number;
  lossPercent: number;
  status: 'normal' | 'low_yield' | 'high_yield';
}

export interface MaterialDispensing {
  bomLineId: number;
  itemId: number;
  itemCode: string;
  itemName: string;
  requiredQuantity: number;
  tolerance: number;
  unit: string;
  dispensedQuantity: number;
  lotNumber: string;
  status: 'pending' | 'dispensed' | 'verified';
}

export interface WorkOrderStatus {
  status: string;
  canTransitionTo: string[];
  requiredConditions: string[];
}

// Get table references based on database type
function getTables() {
  if (useSqlite()) {
    return {
      workOrders: sqliteWorkOrders,
      workOrderLines: sqliteWorkOrderMaterials,
      bom: sqliteBOM,
      bomLines: sqliteBOMLines,
      items: sqliteItems,
      lots: sqliteInventoryLots,
      transactions: sqliteInventoryTransactions,
    };
  }
  return {
    workOrders: mysqlWorkOrders,
    workOrderLines: mysqlWorkOrderMaterials,
    bom: mysqlBOM,
    bomLines: mysqlBOMLines,
    items: mysqlItems,
    lots: mysqlInventoryLots,
    transactions: mysqlInventoryTransactions,
  };
}

/**
 * Work Order Status Workflow
 */
const WORK_ORDER_WORKFLOW: Record<string, WorkOrderStatus> = {
  draft: {
    status: 'draft',
    canTransitionTo: ['planned', 'cancelled'],
    requiredConditions: [],
  },
  planned: {
    status: 'planned',
    canTransitionTo: ['released', 'cancelled'],
    requiredConditions: ['BOM assigned', 'Quantity > 0'],
  },
  released: {
    status: 'released',
    canTransitionTo: ['in_progress', 'cancelled'],
    requiredConditions: ['Materials available', 'Equipment available'],
  },
  in_progress: {
    status: 'in_progress',
    canTransitionTo: ['completed', 'on_hold'],
    requiredConditions: ['Materials issued', 'Line clearance done'],
  },
  on_hold: {
    status: 'on_hold',
    canTransitionTo: ['in_progress', 'cancelled'],
    requiredConditions: ['Hold reason documented'],
  },
  completed: {
    status: 'completed',
    canTransitionTo: ['closed'],
    requiredConditions: ['All operations done', 'Yield recorded'],
  },
  closed: {
    status: 'closed',
    canTransitionTo: [],
    requiredConditions: ['QC released', 'Batch record reviewed'],
  },
  cancelled: {
    status: 'cancelled',
    canTransitionTo: [],
    requiredConditions: ['Cancellation reason documented'],
  },
};

/**
 * BOM Explosion - Calculate all required materials recursively
 */
export async function explodeBOM(
  bomId: number,
  quantity: number,
  level: number = 0
): Promise<BOMExplosionResult[]> {
  const { bom, bomLines, items, lots } = getTables();
  const database = db();

  const results: BOMExplosionResult[] = [];

  // Get BOM header
  const [bomHeader] = await database
    .select()
    .from(bom)
    .where(eq(bom.id, bomId));

  if (!bomHeader) {
    throw new Error(`BOM ${bomId} not found`);
  }

  // Get BOM lines
  const lines = await database
    .select({
      id: bomLines.id,
      itemId: bomLines.itemId,
      quantity: bomLines.quantity,
      unit: bomLines.unit,
      itemCode: items.code,
      itemName: items.nameEn,
      itemType: items.type,
    })
    .from(bomLines)
    .innerJoin(items, eq(bomLines.itemId, items.id))
    .where(eq(bomLines.bomId, bomId))
    .orderBy(asc(bomLines.sequence));

  for (const line of lines) {
    // Calculate required quantity based on batch size ratio
    let requiredQty = (Number(line.quantity) * quantity) / Number(bomHeader.batchSize);

    // Apply loss allowance if defined
    if (bomHeader.lossAllowance) {
      requiredQty = requiredQty / (1 - Number(bomHeader.lossAllowance) / 100);
    }

    // Get available stock
    const stockResult = await database
      .select({
        totalAvailable: sql<number>`COALESCE(SUM(${lots.quantity} - ${lots.reservedQuantity}), 0)`,
      })
      .from(lots)
      .where(
        and(
          eq(lots.itemId, line.itemId),
          eq(lots.status, 'released')
        )
      );

    const availableStock = Number(stockResult[0]?.totalAvailable) || 0;
    const shortage = Math.max(0, requiredQty - availableStock);

    results.push({
      itemId: line.itemId,
      itemCode: line.itemCode,
      itemName: line.itemName || line.itemCode,
      requiredQuantity: Math.round(requiredQty * 1000) / 1000,
      unit: line.unit,
      level,
      availableStock: Math.round(availableStock * 1000) / 1000,
      shortage: Math.round(shortage * 1000) / 1000,
    });

    // Recursive explosion for WIP/semi-finished items
    if (line.itemType === 'wip' || line.itemType === 'extract') {
      // Find BOM for this item
      const [subBom] = await database
        .select()
        .from(bom)
        .where(
          and(
            eq(bom.productId, line.itemId),
            eq(bom.status, 'approved')
          )
        );

      if (subBom) {
        const subResults = await explodeBOM(subBom.id, requiredQty, level + 1);
        results.push(...subResults);
      }
    }
  }

  return results;
}

/**
 * Create Work Order from BOM
 */
export async function createWorkOrder(
  bomId: number,
  plannedQuantity: number,
  plannedStartDate: string,
  userId: number
): Promise<number> {
  const { workOrders, bom, items } = getTables();
  const database = db();

  // Get BOM details
  const [bomHeader] = await database
    .select({
      id: bom.id,
      productId: bom.productId,
      batchUnit: bom.batchUnit,
      productCode: items.code,
    })
    .from(bom)
    .innerJoin(items, eq(bom.productId, items.id))
    .where(eq(bom.id, bomId));

  if (!bomHeader) {
    throw new Error(`BOM ${bomId} not found`);
  }

  // Generate WO number
  const today = new Date();
  const prefix = `WO-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`;
  
  const lastWO = await database
    .select({ woNumber: workOrders.woNumber })
    .from(workOrders)
    .where(sql`${workOrders.woNumber} LIKE ${prefix + '%'}`)
    .orderBy(desc(workOrders.woNumber))
    .limit(1);

  let sequence = 1;
  if (lastWO.length > 0) {
    const lastNum = parseInt(lastWO[0].woNumber.split('-').pop() || '0');
    sequence = lastNum + 1;
  }

  const woNumber = `${prefix}-${String(sequence).padStart(4, '0')}`;
  const batchNumber = `BATCH-${woNumber.replace('WO-', '')}`;

  // Create work order
  const [newWO] = await database
    .insert(workOrders)
    .values({
      woNumber,
      bomId,
      productId: bomHeader.productId,
      batchNumber,
      plannedQuantity,
      unit: bomHeader.batchUnit,
      status: 'planned',
      plannedStartDate,
      createdBy: userId,
    })
    .returning({ id: workOrders.id });

  // Create audit log
  await createAuditLog({
    userId,
    action: 'CREATE',
    tableName: 'work_orders',
    recordId: newWO.id,
    newValue: {
      woNumber,
      batchNumber,
      plannedQuantity,
      status: 'planned',
    },
  });

  return newWO.id;
}

/**
 * Update Work Order Status with validation
 */
export async function updateWorkOrderStatus(
  workOrderId: number,
  newStatus: string,
  userId: number,
  reason?: string
): Promise<boolean> {
  const { workOrders } = getTables();
  const database = db();

  // Get current work order
  const [wo] = await database
    .select()
    .from(workOrders)
    .where(eq(workOrders.id, workOrderId));

  if (!wo) {
    throw new Error(`Work Order ${workOrderId} not found`);
  }

  const currentStatus = wo.status;
  const workflow = WORK_ORDER_WORKFLOW[currentStatus];

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
    updatedAt: new Date().toISOString(),
  };

  // Set timestamps based on status
  if (newStatus === 'in_progress' && !wo.actualStartDate) {
    updateData.actualStartDate = new Date().toISOString().split('T')[0];
  }
  if (newStatus === 'completed') {
    updateData.actualEndDate = new Date().toISOString().split('T')[0];
  }

  await database
    .update(workOrders)
    .set(updateData)
    .where(eq(workOrders.id, workOrderId));

  // Create audit log
  await createAuditLog({
    userId,
    action: 'UPDATE',
    tableName: 'work_orders',
    recordId: workOrderId,
    oldValue: { status: currentStatus },
    newValue: { status: newStatus, reason  },
  });

  return true;
}

/**
 * Dispense Material with Barcode Verification
 */
export async function dispenseMaterial(
  workOrderId: number,
  lotId: number,
  quantity: number,
  userId: number,
  tolerancePercent: number = 2
): Promise<{ success: boolean; deviationRequired: boolean; message: string }> {
  const { workOrders, workOrderLines, bomLines, lots, items } = getTables();
  const database = db();

  // Get work order
  const [wo] = await database
    .select()
    .from(workOrders)
    .where(eq(workOrders.id, workOrderId));

  if (!wo) {
    throw new Error(`Work Order ${workOrderId} not found`);
  }

  if (wo.status !== 'released' && wo.status !== 'in_progress') {
    throw new Error(`Work Order must be Released or In Progress to dispense materials`);
  }

  // Get lot details
  const [lot] = await database
    .select({
      id: lots.id,
      lotNumber: lots.lotNumber,
      itemId: lots.itemId,
      status: lots.status,
      quantity: lots.quantity,
      reservedQuantity: lots.reservedQuantity,
      itemCode: items.code,
    })
    .from(lots)
    .innerJoin(items, eq(lots.itemId, items.id))
    .where(eq(lots.id, lotId));

  if (!lot) {
    throw new Error(`Lot ${lotId} not found`);
  }

  // Validate lot status
  if (lot.status !== 'released') {
    throw new Error(`Lot ${lot.lotNumber} is not released (status: ${lot.status})`);
  }

  // Find BOM line for this item
  const [bomLine] = await database
    .select()
    .from(bomLines)
    .where(
      and(
        eq(bomLines.bomId, wo.bomId),
        eq(bomLines.itemId, lot.itemId)
      )
    );

  if (!bomLine) {
    throw new Error(`Item ${lot.itemCode} is not in the BOM for this work order`);
  }

  // Calculate required quantity
  const requiredQty = (Number(bomLine.quantity) * Number(wo.plannedQuantity)) / 
    (await getBOMBatchSize(wo.bomId));

  // Check tolerance
  const minQty = requiredQty * (1 - tolerancePercent / 100);
  const maxQty = requiredQty * (1 + tolerancePercent / 100);
  
  let deviationRequired = false;
  let message = '';

  if (quantity < minQty || quantity > maxQty) {
    deviationRequired = true;
    message = `Quantity ${quantity} is outside tolerance (${minQty.toFixed(3)} - ${maxQty.toFixed(3)}). Deviation required.`;
  } else {
    message = `Material dispensed successfully`;
  }

  // Issue material from inventory
  await issueMaterial(
    lotId,
    quantity,
    'WO',
    workOrderId,
    wo.woNumber,
    userId,
    deviationRequired ? `Out of tolerance: ${quantity} vs required ${requiredQty}` : undefined
  );

  // Record in work order lines
  await database.insert(workOrderLines).values({
    workOrderId,
    itemId: lot.itemId,
    plannedQuantity: requiredQty,
    actualQuantity: quantity,
    unit: bomLine.unit,
    lotId,
    dispensedBy: userId,
    dispensedAt: new Date().toISOString(),
  });

  return { success: true, deviationRequired, message };
}

/**
 * Calculate Yield for Work Order
 */
export async function calculateYield(workOrderId: number): Promise<YieldCalculation> {
  const { workOrders, bom } = getTables();
  const database = db();

  // Get work order with BOM
  const [wo] = await database
    .select({
      plannedQuantity: workOrders.plannedQuantity,
      actualQuantity: workOrders.actualQuantity,
      yieldTarget: bom.yieldTarget,
    })
    .from(workOrders)
    .innerJoin(bom, eq(workOrders.bomId, bom.id))
    .where(eq(workOrders.id, workOrderId));

  if (!wo) {
    throw new Error(`Work Order ${workOrderId} not found`);
  }

  const theoretical = Number(wo.plannedQuantity) || 0;
  const actualGood = Number(wo.actualQuantity) || 0;
  const actualReject = Number(wo.rejectQuantity) || 0;
  const actualTotal = actualGood + actualReject;
  const yieldTarget = Number(wo.yieldTarget) || 95;

  // Calculate percentages
  const yieldPercent = theoretical > 0 ? (actualGood / theoretical) * 100 : 0;
  const rejectPercent = actualTotal > 0 ? (actualReject / actualTotal) * 100 : 0;
  const lossPercent = theoretical > 0 ? ((theoretical - actualTotal) / theoretical) * 100 : 0;

  // Determine status
  let status: 'normal' | 'low_yield' | 'high_yield' = 'normal';
  if (yieldPercent < yieldTarget - 5) {
    status = 'low_yield';
  } else if (yieldPercent > 105) {
    status = 'high_yield'; // Unusual, may indicate measurement error
  }

  return {
    theoretical,
    actualGood,
    actualReject,
    yieldPercent: Math.round(yieldPercent * 100) / 100,
    rejectPercent: Math.round(rejectPercent * 100) / 100,
    lossPercent: Math.round(lossPercent * 100) / 100,
    status,
  };
}

/**
 * Record Production Output
 */
export async function recordProductionOutput(
  workOrderId: number,
  actualQuantity: number,
  rejectQuantity: number,
  warehouseId: number,
  userId: number
): Promise<number> {
  const { workOrders, items } = getTables();
  const database = db();

  // Get work order
  const [wo] = await database
    .select({
      id: workOrders.id,
      woNumber: workOrders.woNumber,
      productId: workOrders.productId,
      batchNumber: workOrders.batchNumber,
      unit: workOrders.unit,
      status: workOrders.status,
    })
    .from(workOrders)
    .where(eq(workOrders.id, workOrderId));

  if (!wo) {
    throw new Error(`Work Order ${workOrderId} not found`);
  }

  if (wo.status !== 'in_progress') {
    throw new Error(`Work Order must be In Progress to record output`);
  }

  // Get product details for shelf life
  const [product] = await database
    .select()
    .from(items)
    .where(eq(items.id, wo.productId));

  // Calculate expiry date
  let expiryDate: string | null = null;
  if (product?.shelfLifeDays) {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + product.shelfLifeDays);
    expiryDate = expiry.toISOString().split('T')[0];
  }

  // Update work order
  await database
    .update(workOrders)
    .set({
      actualQuantity,
      rejectQuantity,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(workOrders.id, workOrderId));

  // Create output lot
  const lotId = await receiveMaterial(
    wo.productId,
    wo.batchNumber,
    actualQuantity,
    wo.unit,
    warehouseId,
    expiryDate,
    null, // No vendor for produced items
    wo.woNumber, // Reference WO number
    userId
  );

  // Calculate and check yield
  const yieldResult = await calculateYield(workOrderId);
  
  if (yieldResult.status === 'low_yield') {
    // Create deviation for low yield
    await createAuditLog({
      userId,
      action: 'CREATE',
      tableName: 'work_orders',
      recordId: workOrderId,
      newValue: {
        type: 'LOW_YIELD',
        expected: 95,
        actual: yieldResult.yieldPercent,
      },
    });
  }

  return lotId;
}

/**
 * Get BOM batch size helper
 */
async function getBOMBatchSize(bomId: number): Promise<number> {
  const { bom } = getTables();
  const database = db();

  const [bomHeader] = await database
    .select({ batchSize: bom.batchSize })
    .from(bom)
    .where(eq(bom.id, bomId));

  return Number(bomHeader?.batchSize) || 1;
}

/**
 * MRP Calculation - Material Requirements Planning
 */
export async function calculateMRP(
  demandList: Array<{ itemId: number; quantity: number; requiredDate: string }>,
  planningHorizonDays: number = 30
): Promise<Array<{
  itemId: number;
  itemCode: string;
  itemName: string;
  requiredQuantity: number;
  availableStock: number;
  netRequirement: number;
  orderQuantity: number;
  orderDate: string;
  requiredDate: string;
}>> {
  const { items, lots, bom } = getTables();
  const database = db();

  const requirements: Array<{
    itemId: number;
    itemCode: string;
    itemName: string;
    requiredQuantity: number;
    availableStock: number;
    netRequirement: number;
    orderQuantity: number;
    orderDate: string;
    requiredDate: string;
  }> = [];

  for (const demand of demandList) {
    // Find BOM for this item
    const [itemBom] = await database
      .select()
      .from(bom)
      .where(
        and(
          eq(bom.productId, demand.itemId),
          eq(bom.status, 'approved')
        )
      );

    if (!itemBom) continue;

    // Explode BOM
    const bomRequirements = await explodeBOM(itemBom.id, demand.quantity);

    for (const req of bomRequirements) {
      // Get item details
      const [item] = await database
        .select()
        .from(items)
        .where(eq(items.id, req.itemId));

      if (!item) continue;

      // Calculate net requirement
      const netRequirement = Math.max(0, req.requiredQuantity - req.availableStock);

      if (netRequirement > 0) {
        // Apply MOQ
        let orderQty = Math.max(netRequirement, Number(item.minStock) || 0);

        // Round to reorder point if defined
        if (item.reorderPoint && Number(item.reorderPoint) > 0) {
          orderQty = Math.ceil(orderQty / Number(item.reorderPoint)) * Number(item.reorderPoint);
        }

        // Calculate order date (required date - lead time)
        const requiredDate = new Date(demand.requiredDate);
        const leadTimeDays = 7; // Default lead time, should come from vendor
        const orderDate = new Date(requiredDate);
        orderDate.setDate(orderDate.getDate() - leadTimeDays);

        requirements.push({
          itemId: req.itemId,
          itemCode: req.itemCode,
          itemName: req.itemName,
          requiredQuantity: req.requiredQuantity,
          availableStock: req.availableStock,
          netRequirement,
          orderQuantity: Math.round(orderQty * 1000) / 1000,
          orderDate: orderDate.toISOString().split('T')[0],
          requiredDate: demand.requiredDate,
        });
      }
    }
  }

  // Consolidate requirements by item
  const consolidated = new Map<number, typeof requirements[0]>();
  
  for (const req of requirements) {
    const existing = consolidated.get(req.itemId);
    if (existing) {
      existing.requiredQuantity += req.requiredQuantity;
      existing.netRequirement += req.netRequirement;
      existing.orderQuantity = Math.max(existing.orderQuantity, req.orderQuantity);
      if (req.orderDate < existing.orderDate) {
        existing.orderDate = req.orderDate;
      }
    } else {
      consolidated.set(req.itemId, { ...req });
    }
  }

  return Array.from(consolidated.values());
}

/**
 * Line Clearance Check
 */
export async function performLineClearance(
  workOrderId: number,
  checklist: Array<{ item: string; checked: boolean; notes?: string }>,
  userId: number
): Promise<boolean> {
  const { workOrders } = getTables();
  const database = db();

  // Validate all items are checked
  const uncheckedItems = checklist.filter((item: any) => !item.checked);
  if (uncheckedItems.length > 0) {
    throw new Error(`Line clearance incomplete. Unchecked items: ${uncheckedItems.map(i => i.item).join(', ')}`);
  }

  // Record line clearance
  await createAuditLog({
    userId,
    action: 'UPDATE',
    tableName: 'work_orders',
    recordId: workOrderId,
    newValue: {
      checklist,
      clearedAt: new Date().toISOString(),
      clearedBy: userId,
    },
  });

  return true;
}
