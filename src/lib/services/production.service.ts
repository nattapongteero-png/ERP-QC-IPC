/**
 * Production Service
 * Real-world production management with eBMR, work order workflows, and yield calculation
 */

import { getDb, isSqlite } from '../db';
import { getInsertId } from '../db/db-helper';
import { toDateSafe, getNow } from '../db/date-utils';
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
import { canStartProduction } from './line-clearance.service';
import { calculateWorkOrderVariances } from './variance-analysis.service';
import { getItemWAC, updateFinishedGoodsWAC } from './unit-cost.service';

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
  if (isSqlite()) {
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

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
  let newWOId: number;
  if (isSqlite()) {
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
    newWOId = newWO.id;
  } else {
    const result = await database
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
      });
    newWOId = getInsertId(result);
  }

  // Create audit log
  await createAuditLog({
    userId,
    action: 'CREATE',
    tableName: 'work_orders',
    recordId: newWOId,
    newValue: {
      woNumber,
      batchNumber,
      plannedQuantity,
      status: 'planned',
    },
  });

  return newWOId;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

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

  // FR-062: Check line clearance before starting production
  if (newStatus === 'in_progress') {
    const productionCheck = await canStartProduction(workOrderId);
    if (!productionCheck.allowed) {
      throw new Error(
        `Cannot start production: ${productionCheck.reason}. ` +
        `Line clearance status: ${productionCheck.lineClearanceStatus.status}`
      );
    }
  }

  // Update status
  const updateData: Record<string, unknown> = {
    status: newStatus,
    updatedAt: getNow(),
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

  // T135: Calculate manufacturing variances when work order is completed
  if (newStatus === 'completed') {
    try {
      await calculateWorkOrderVariances(workOrderId, userId);
    } catch (varianceError) {
      // Log but don't fail the completion - variance calculation is secondary
      console.error(`Warning: Failed to calculate variances for WO ${workOrderId}:`, varianceError);
    }

    // US3 (014-unit-cost): Update finished goods WAC from production cost
    try {
      await updateFinishedGoodsWAC(workOrderId, userId);
    } catch (costError) {
      // Log but don't fail the completion - cost calculation is secondary
      console.error(`Warning: Failed to update FG WAC for WO ${workOrderId}:`, costError);
    }
  }

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

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

  // Get current WAC for the item before issuing (US3: Production Cost Aggregation)
  const itemWAC = await getItemWAC(lot.itemId);
  const unitCost = itemWAC !== null ? itemWAC : 0;
  const totalCost = Math.round(quantity * unitCost * 10000) / 10000;

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

  // Record in work order lines with cost information
  await database.insert(workOrderLines).values({
    workOrderId,
    itemId: lot.itemId,
    plannedQuantity: requiredQty,
    actualQuantity: quantity,
    unit: bomLine.unit,
    lotId,
    unitCost,   // WAC at time of issue
    totalCost,  // quantity × unitCost
    dispensedBy: userId,
    dispensedAt: getNow(),
  });

  return { success: true, deviationRequired, message };
}

/**
 * Calculate Yield for Work Order
 */
export async function calculateYield(workOrderId: number): Promise<YieldCalculation> {
  const { workOrders, bom } = getTables();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

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
      updatedAt: getNow(),
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

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
        const requiredDate = toDateSafe(demand.requiredDate);
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

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
      clearedAt: getNow(),
      clearedBy: userId,
    },
  });

  return true;
}

// ============================================================================
// BOM COSTING
// ============================================================================

export interface BOMCostBreakdown {
  itemId: number;
  itemCode: string;
  itemName: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  level: number;
  costSource: 'average' | 'last_purchase' | 'no_cost';
}

export interface BOMCostResult {
  bomId: number;
  bomCode: string;
  batchSize: number;
  batchUnit: string;
  totalMaterialCost: number;
  costPerUnit: number;
  breakdown: BOMCostBreakdown[];
  currency: string;
}

/**
 * Calculate BOM cost based on material costs
 * Uses average cost (onHandCost/onHand) or last purchase price
 */
export async function calculateBOMCost(
  bomId: number,
  quantity?: number
): Promise<BOMCostResult> {
  const { bom, bomLines, items } = getTables();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  // Get BOM header
  const [bomHeader] = await database
    .select({
      id: bom.id,
      code: bom.code,
      batchSize: bom.batchSize,
      batchUnit: bom.batchUnit,
      lossAllowance: bom.lossAllowance,
    })
    .from(bom)
    .where(eq(bom.id, bomId));

  if (!bomHeader) {
    throw new Error(`BOM ${bomId} not found`);
  }

  const targetQuantity = quantity || Number(bomHeader.batchSize);
  const breakdown: BOMCostBreakdown[] = [];
  let totalMaterialCost = 0;

  // Get BOM lines with item details
  const lines = await database
    .select({
      id: bomLines.id,
      itemId: bomLines.itemId,
      quantity: bomLines.quantity,
      unit: bomLines.unit,
      itemCode: items.code,
      itemName: items.nameEn,
      onHand: items.onHand,
      onHandCost: items.onHandCost,
    })
    .from(bomLines)
    .innerJoin(items, eq(bomLines.itemId, items.id))
    .where(eq(bomLines.bomId, bomId))
    .orderBy(asc(bomLines.sequence));

  for (const line of lines) {
    // Calculate required quantity
    let requiredQty = (Number(line.quantity) * targetQuantity) / Number(bomHeader.batchSize);

    // Apply loss allowance if defined
    if (bomHeader.lossAllowance) {
      requiredQty = requiredQty / (1 - Number(bomHeader.lossAllowance) / 100);
    }

    // Calculate unit cost (average cost from inventory)
    let unitCost = 0;
    let costSource: 'average' | 'last_purchase' | 'no_cost' = 'no_cost';

    const onHand = Number(line.onHand) || 0;
    const onHandCost = Number(line.onHandCost) || 0;

    if (onHand > 0 && onHandCost > 0) {
      unitCost = onHandCost / onHand;
      costSource = 'average';
    }

    const lineTotalCost = requiredQty * unitCost;
    totalMaterialCost += lineTotalCost;

    breakdown.push({
      itemId: line.itemId,
      itemCode: line.itemCode,
      itemName: line.itemName || line.itemCode,
      quantity: Math.round(requiredQty * 1000) / 1000,
      unit: line.unit,
      unitCost: Math.round(unitCost * 100) / 100,
      totalCost: Math.round(lineTotalCost * 100) / 100,
      level: 0,
      costSource,
    });
  }

  return {
    bomId,
    bomCode: bomHeader.code,
    batchSize: Number(bomHeader.batchSize),
    batchUnit: bomHeader.batchUnit,
    totalMaterialCost: Math.round(totalMaterialCost * 100) / 100,
    costPerUnit: Math.round((totalMaterialCost / targetQuantity) * 100) / 100,
    breakdown,
    currency: 'THB',
  };
}

// ============================================================================
// WHERE-USED QUERY
// ============================================================================

export interface WhereUsedResult {
  bomId: number;
  bomCode: string;
  bomName: string;
  bomStatus: string;
  productId: number;
  productCode: string;
  productName: string;
  quantityUsed: number;
  unit: string;
  isOptional: boolean;
}

/**
 * Find all BOMs that use a specific item
 */
export async function getWhereUsed(itemId: number): Promise<WhereUsedResult[]> {
  const { bom, bomLines, items } = getTables();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  const results = await database
    .select({
      bomId: bom.id,
      bomCode: bom.code,
      bomName: bom.name,
      bomStatus: bom.status,
      productId: bom.productId,
      productCode: items.code,
      productName: items.nameEn,
      quantityUsed: bomLines.quantity,
      unit: bomLines.unit,
      isOptional: bomLines.isOptional,
    })
    .from(bomLines)
    .innerJoin(bom, eq(bomLines.bomId, bom.id))
    .innerJoin(items, eq(bom.productId, items.id))
    .where(eq(bomLines.itemId, itemId))
    .orderBy(asc(bom.code));

  return results.map((r: typeof results[number]) => ({
    ...r,
    productName: r.productName || r.productCode,
    isOptional: Boolean(r.isOptional),
  }));
}

// ============================================================================
// CIRCULAR REFERENCE DETECTION
// ============================================================================

/**
 * Detect circular references in BOM structure
 * Returns the circular path if found, null otherwise
 */
export async function detectCircularReference(
  bomId: number,
  visited: Set<number> = new Set(),
  path: number[] = []
): Promise<number[] | null> {
  const { bom, bomLines } = getTables();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  // Check if we've already visited this BOM
  if (visited.has(bomId)) {
    return [...path, bomId];
  }

  visited.add(bomId);
  path.push(bomId);

  // Get BOM lines
  const lines = await database
    .select({
      itemId: bomLines.itemId,
    })
    .from(bomLines)
    .where(eq(bomLines.bomId, bomId));

  // For each line item, check if it has a BOM (sub-assembly)
  for (const line of lines) {
    const [subBom] = await database
      .select({ id: bom.id })
      .from(bom)
      .where(eq(bom.productId, line.itemId));

    if (subBom) {
      const circularPath = await detectCircularReference(
        subBom.id,
        new Set(visited),
        [...path]
      );
      if (circularPath) {
        return circularPath;
      }
    }
  }

  return null;
}

/**
 * Validate BOM for circular references before saving
 */
export async function validateBOMCircularReference(
  productId: number,
  lineItemIds: number[]
): Promise<{ valid: boolean; message?: string; path?: string[] }> {
  const { bom, items } = getTables();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  // Check if any line item eventually leads back to the product
  for (const itemId of lineItemIds) {
    // Find BOM for this item
    const [itemBom] = await database
      .select({ id: bom.id })
      .from(bom)
      .where(eq(bom.productId, itemId));

    if (itemBom) {
      // Check if this item's BOM uses the product we're creating
      const whereUsed = await getWhereUsedRecursive(productId, new Set());

      if (whereUsed.has(itemId)) {
        // Get item names for error message
        const [product] = await database
          .select({ code: items.code })
          .from(items)
          .where(eq(items.id, productId));
        const [item] = await database
          .select({ code: items.code })
          .from(items)
          .where(eq(items.id, itemId));

        return {
          valid: false,
          message: `Circular reference detected: ${item?.code} eventually uses ${product?.code}`,
          path: [product?.code || '', item?.code || ''],
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Get all items that eventually use a given item (recursive where-used)
 */
async function getWhereUsedRecursive(
  itemId: number,
  visited: Set<number>
): Promise<Set<number>> {
  if (visited.has(itemId)) {
    return visited;
  }
  visited.add(itemId);

  const whereUsed = await getWhereUsed(itemId);

  for (const usage of whereUsed) {
    await getWhereUsedRecursive(usage.productId, visited);
  }

  return visited;
}

// ============================================================================
// BOM COPY / DUPLICATE
// ============================================================================

export interface CopyBOMOptions {
  newCode: string;
  newVersion?: string;
  newName?: string;
  copyAsStatus?: 'draft' | 'active';
}

/**
 * Copy/duplicate a BOM with a new code
 */
export async function copyBOM(
  sourceBomId: number,
  options: CopyBOMOptions,
  userId: number
): Promise<number> {
  const { bom, bomLines } = getTables();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  // Get source BOM
  const [sourceBom] = await database
    .select()
    .from(bom)
    .where(eq(bom.id, sourceBomId));

  if (!sourceBom) {
    throw new Error(`BOM ${sourceBomId} not found`);
  }

  // Check if new code already exists
  const [existing] = await database
    .select()
    .from(bom)
    .where(eq(bom.code, options.newCode));

  if (existing) {
    throw new Error(`BOM code ${options.newCode} already exists`);
  }

  // Get source BOM lines
  const sourceLines = await database
    .select()
    .from(bomLines)
    .where(eq(bomLines.bomId, sourceBomId))
    .orderBy(asc(bomLines.sequence));

  const now = getNow();
  const useSqlite = process.env.DB_TYPE === 'sqlite';

  // Create new BOM
  const newBomValues: Record<string, unknown> = {
    code: options.newCode,
    name: options.newName || `${sourceBom.name} (Copy)`,
    productId: sourceBom.productId,
    version: options.newVersion || '1.0',
    status: options.copyAsStatus || 'draft',
    batchSize: sourceBom.batchSize,
    batchUnit: sourceBom.batchUnit,
    yieldTarget: sourceBom.yieldTarget,
    lossAllowance: sourceBom.lossAllowance,
    effectiveDate: null,
    expiryDate: null,
    createdAt: now,
    updatedAt: now,
  };

  const result = await (database as any).insert(bom).values(newBomValues);
  const newBomId = useSqlite ? result.lastInsertRowid : result[0].insertId;

  // Copy BOM lines
  for (const line of sourceLines) {
    await (database as any).insert(bomLines).values({
      bomId: Number(newBomId),
      itemId: line.itemId,
      quantity: line.quantity,
      unit: line.unit,
      sequence: line.sequence,
      isOptional: line.isOptional,
      notes: line.notes,
      createdAt: now,
    });
  }

  // Create audit log
  await createAuditLog({
    userId,
    action: 'CREATE',
    tableName: 'bom',
    recordId: Number(newBomId),
    newValue: {
      action: 'copy',
      sourceId: sourceBomId,
      sourceCode: sourceBom.code,
      newCode: options.newCode,
    },
  });

  return Number(newBomId);
}

// ============================================================================
// BOM LINE MANAGEMENT
// ============================================================================

/**
 * Add a single line to an existing BOM
 */
export async function addBOMLine(
  bomId: number,
  line: {
    itemId: number;
    quantity: number;
    unit: string;
    sequence?: number;
    isOptional?: boolean;
    notes?: string;
  },
  userId: number
): Promise<number> {
  const { bom, bomLines } = getTables();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  // Verify BOM exists
  const [bomHeader] = await database
    .select()
    .from(bom)
    .where(eq(bom.id, bomId));

  if (!bomHeader) {
    throw new Error(`BOM ${bomId} not found`);
  }

  // Check if item already exists in BOM
  const [existingLine] = await database
    .select()
    .from(bomLines)
    .where(and(eq(bomLines.bomId, bomId), eq(bomLines.itemId, line.itemId)));

  if (existingLine) {
    throw new Error('Item already exists in this BOM');
  }

  // Validate circular reference
  const circularCheck = await validateBOMCircularReference(
    bomHeader.productId,
    [line.itemId]
  );

  if (!circularCheck.valid) {
    throw new Error(circularCheck.message);
  }

  // Get max sequence if not provided
  let sequence = line.sequence;
  if (!sequence) {
    const maxSeqResult = await database
      .select({ maxSeq: sql<number>`MAX(${bomLines.sequence})` })
      .from(bomLines)
      .where(eq(bomLines.bomId, bomId));
    sequence = (maxSeqResult[0]?.maxSeq || 0) + 1;
  }

  const useSqlite = process.env.DB_TYPE === 'sqlite';
  const now = getNow();

  // Insert new line
  const result = await (database as any).insert(bomLines).values({
    bomId,
    itemId: line.itemId,
    quantity: line.quantity,
    unit: line.unit,
    sequence,
    isOptional: line.isOptional || false,
    notes: line.notes || null,
    createdAt: now,
  });

  const newLineId = useSqlite ? result.lastInsertRowid : result[0].insertId;

  // Update BOM timestamp
  await database
    .update(bom)
    .set({ updatedAt: now })
    .where(eq(bom.id, bomId));

  // Audit log
  await createAuditLog({
    userId,
    action: 'UPDATE',
    tableName: 'bom_lines',
    recordId: Number(newLineId),
    newValue: { bomId, itemId: line.itemId, quantity: line.quantity },
  });

  return Number(newLineId);
}

/**
 * Update a single BOM line
 */
export async function updateBOMLine(
  lineId: number,
  updates: {
    quantity?: number;
    unit?: string;
    sequence?: number;
    isOptional?: boolean;
    notes?: string;
  },
  userId: number
): Promise<void> {
  const { bom, bomLines } = getTables();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  // Get existing line
  const [existingLine] = await database
    .select()
    .from(bomLines)
    .where(eq(bomLines.id, lineId));

  if (!existingLine) {
    throw new Error(`BOM line ${lineId} not found`);
  }

  const useSqlite = process.env.DB_TYPE === 'sqlite';
  const now = getNow();

  // Update line
  await database
    .update(bomLines)
    .set({
      quantity: updates.quantity ?? existingLine.quantity,
      unit: updates.unit ?? existingLine.unit,
      sequence: updates.sequence ?? existingLine.sequence,
      isOptional: updates.isOptional ?? existingLine.isOptional,
      notes: updates.notes !== undefined ? updates.notes : existingLine.notes,
    })
    .where(eq(bomLines.id, lineId));

  // Update BOM timestamp
  await database
    .update(bom)
    .set({ updatedAt: now })
    .where(eq(bom.id, existingLine.bomId));

  // Audit log
  await createAuditLog({
    userId,
    action: 'UPDATE',
    tableName: 'bom_lines',
    recordId: lineId,
    oldValue: existingLine,
    newValue: updates,
  });
}

/**
 * Remove a single line from a BOM
 */
export async function removeBOMLine(
  lineId: number,
  userId: number
): Promise<void> {
  const { bom, bomLines } = getTables();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  // Get existing line
  const [existingLine] = await database
    .select()
    .from(bomLines)
    .where(eq(bomLines.id, lineId));

  if (!existingLine) {
    throw new Error(`BOM line ${lineId} not found`);
  }

  // Delete line
  await database.delete(bomLines).where(eq(bomLines.id, lineId));

  // Update BOM timestamp
  const useSqlite = process.env.DB_TYPE === 'sqlite';
  const now = getNow();
  await database
    .update(bom)
    .set({ updatedAt: now })
    .where(eq(bom.id, existingLine.bomId));

  // Audit log
  await createAuditLog({
    userId,
    action: 'DELETE',
    tableName: 'bom_lines',
    recordId: lineId,
    oldValue: existingLine,
  });
}

// ============================================================================
// CONSOLIDATED BOM EXPLOSION
// ============================================================================

export interface ConsolidatedBOMResult {
  itemId: number;
  itemCode: string;
  itemName: string;
  totalRequiredQuantity: number;
  unit: string;
  availableStock: number;
  shortage: number;
  usedInLevels: number[];
  unitCost: number;
  totalCost: number;
}

/**
 * Explode BOM and consolidate duplicate items across all levels
 */
export async function explodeBOMConsolidated(
  bomId: number,
  quantity: number
): Promise<{
  items: ConsolidatedBOMResult[];
  totalCost: number;
  canProduce: boolean;
  summary: {
    totalItems: number;
    itemsWithShortage: number;
    totalRequiredValue: number;
  };
}> {
  // First check for circular references
  const circularPath = await detectCircularReference(bomId);
  if (circularPath) {
    throw new Error(`Circular reference detected in BOM: ${circularPath.join(' -> ')}`);
  }

  // Get standard explosion
  const explosionResults = await explodeBOM(bomId, quantity);

  // Consolidate by itemId
  const consolidated = new Map<number, ConsolidatedBOMResult>();
  const { items } = getTables();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  for (const result of explosionResults) {
    const existing = consolidated.get(result.itemId);

    // Get unit cost
    const [itemData] = await database
      .select({ onHand: items.onHand, onHandCost: items.onHandCost })
      .from(items)
      .where(eq(items.id, result.itemId));

    const onHand = Number(itemData?.onHand) || 0;
    const onHandCost = Number(itemData?.onHandCost) || 0;
    const unitCost = onHand > 0 ? onHandCost / onHand : 0;

    if (existing) {
      existing.totalRequiredQuantity += result.requiredQuantity;
      existing.shortage = Math.max(0, existing.totalRequiredQuantity - existing.availableStock);
      existing.totalCost = existing.totalRequiredQuantity * unitCost;
      if (!existing.usedInLevels.includes(result.level)) {
        existing.usedInLevels.push(result.level);
      }
    } else {
      consolidated.set(result.itemId, {
        itemId: result.itemId,
        itemCode: result.itemCode,
        itemName: result.itemName,
        totalRequiredQuantity: result.requiredQuantity,
        unit: result.unit,
        availableStock: result.availableStock,
        shortage: result.shortage,
        usedInLevels: [result.level],
        unitCost: Math.round(unitCost * 100) / 100,
        totalCost: Math.round(result.requiredQuantity * unitCost * 100) / 100,
      });
    }
  }

  const consolidatedItems = Array.from(consolidated.values());
  const totalCost = consolidatedItems.reduce((sum, item) => sum + item.totalCost, 0);
  const itemsWithShortage = consolidatedItems.filter((item) => item.shortage > 0).length;
  const canProduce = itemsWithShortage === 0;

  return {
    items: consolidatedItems,
    totalCost: Math.round(totalCost * 100) / 100,
    canProduce,
    summary: {
      totalItems: consolidatedItems.length,
      itemsWithShortage,
      totalRequiredValue: Math.round(totalCost * 100) / 100,
    },
  };
}
