/**
 * Fixed Assets Service
 * Feature: 010-accounting-module-integration
 * User Story 7: Manage Fixed Assets and Depreciation
 *
 * Thai Revenue Code compliant fixed asset management including:
 * - Asset registration and tracking
 * - Depreciation calculation (straight line and declining balance)
 * - Asset disposal with gain/loss
 * - Asset transfers between locations
 */

import { getDb, isSqlite } from '../db';
import { getNow, toDbDate, toQueryDate, getTodayStr, formatDateFromDb } from '../db/date-utils';
import { eq, and, sql, desc, asc, gte, lte, or, isNull, between, count, sum } from 'drizzle-orm';
import { getAccountingTables, createJournalEntry, postJournalEntry } from './accounting.service';
import { auditedDelete } from '../db/audit-wrapper';
import { executeDbOperation } from '../db/db-helper';
import {
  calculateStraightLineDepreciation,
  calculateDecliningBalanceDepreciation,
} from '../db/seeds/asset-categories';
import type {
  AssetCategoryCreateInput,
  AssetCategoryUpdateInput,
  FixedAssetCreateInput,
  FixedAssetUpdateInput,
  FixedAssetQueryInput,
} from '../validation/accounting';
import type {
  AssetCategory,
  FixedAsset,
  AssetDepreciation,
  AssetDisposal,
  AssetMovement,
} from '@/lib/db/schema';

// ============================================
// Asset Category Functions
// ============================================

/**
 * List all asset categories
 */
export async function listAssetCategories(): Promise<AssetCategory[]> {
  const { assetCategories } = getAccountingTables();
  const database = (await getDb()) as any;

  const result = await database
    .select()
    .from(assetCategories)
    .orderBy(asc(assetCategories.code));

  return result as AssetCategory[];
}

/**
 * Get asset category by ID
 */
export async function getAssetCategoryById(id: number): Promise<AssetCategory | null> {
  const { assetCategories } = getAccountingTables();
  const database = (await getDb()) as any;

  const result = await database
    .select()
    .from(assetCategories)
    .where(eq(assetCategories.id, id))
    .limit(1);

  return (result[0] as AssetCategory) || null;
}

/**
 * Create a new asset category
 */
export async function createAssetCategory(
  input: AssetCategoryCreateInput
): Promise<{ id: number }> {
  const { assetCategories } = getAccountingTables();
  const database = (await getDb()) as any;

  const result = await database.insert(assetCategories).values({
    code: input.code,
    nameTh: input.nameTh,
    nameEn: input.nameEn,
    defaultUsefulLifeMonths: input.defaultUsefulLifeMonths,
    defaultDepreciationMethod: input.defaultDepreciationMethod,
    maxDepreciationRate: input.maxDepreciationRate,
    assetGLAccountId: input.assetGLAccountId,
    depreciationExpenseGLAccountId: input.depreciationExpenseGLAccountId,
    accumulatedDepreciationGLAccountId: input.accumulatedDepreciationGLAccountId,
    isActive: true,
    createdAt: getNow(),
    updatedAt: getNow(),
  } as Record<string, unknown>);

  // Handle different DB return types
  const insertedId = isSqlite()
    ? (result as { lastInsertRowid: number }).lastInsertRowid
    : (result as unknown as [{ insertId: number }])[0].insertId;

  return { id: Number(insertedId) };
}

/**
 * Update an asset category
 */
export async function updateAssetCategory(
  id: number,
  input: AssetCategoryUpdateInput
): Promise<void> {
  const { assetCategories } = getAccountingTables();
  const database = (await getDb()) as any;

  await database
    .update(assetCategories)
    .set({
      ...input,
      updatedAt: getNow(),
    } as Record<string, unknown>)
    .where(eq(assetCategories.id, id));
}

// ============================================
// Fixed Asset Functions
// ============================================

/**
 * Generate unique asset code in format FA-YYYYMM-NNNNNN
 */
export async function generateAssetCode(acquisitionDate: string): Promise<string> {
  const { fixedAssets } = getAccountingTables();
  const database = (await getDb()) as any;

  const date = new Date(acquisitionDate);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const prefix = `FA-${year}${month}-`;

  const result = await database
    .select({ assetCode: fixedAssets.assetCode })
    .from(fixedAssets)
    .where(sql`${fixedAssets.assetCode} LIKE ${prefix + '%'}`)
    .orderBy(desc(fixedAssets.assetCode))
    .limit(1);

  let sequence = 1;
  if (result.length > 0 && result[0].assetCode) {
    const lastCode = result[0].assetCode;
    const lastSequence = parseInt(lastCode.replace(prefix, ''), 10);
    if (!isNaN(lastSequence)) {
      sequence = lastSequence + 1;
    }
  }

  return `${prefix}${String(sequence).padStart(6, '0')}`;
}

/**
 * Create a new fixed asset
 */
export async function createFixedAsset(
  input: FixedAssetCreateInput,
  createdBy?: number
): Promise<{ id: number; assetCode: string }> {
  const { fixedAssets } = getAccountingTables();
  const database = (await getDb()) as any;

  // Get category for defaults
  const category = await getAssetCategoryById(input.categoryId);
  if (!category) {
    throw new Error('Invalid asset category');
  }

  // Generate asset code
  const assetCode = await generateAssetCode(input.acquisitionDate);

  // Calculate net book value
  const netBookValue = input.acquisitionCost - (input.salvageValue || 0);

  const result = await database.insert(fixedAssets).values({
    assetCode,
    nameTh: input.nameTh,
    nameEn: input.nameEn,
    categoryId: input.categoryId,
    acquisitionDate: toDbDate(input.acquisitionDate),
    acquisitionCost: input.acquisitionCost,
    salvageValue: input.salvageValue || 0,
    usefulLifeMonths: input.usefulLifeMonths || category.defaultUsefulLifeMonths,
    depreciationMethod: input.depreciationMethod || category.defaultDepreciationMethod,
    depreciationStartDate: toDbDate(input.depreciationStartDate || input.acquisitionDate),
    accumulatedDepreciation: 0,
    netBookValue,
    location: input.location,
    departmentId: input.departmentId,
    responsiblePersonId: input.responsiblePersonId,
    purchaseOrderId: input.purchaseOrderId,
    apInvoiceId: input.apInvoiceId,
    status: 'active',
    createdBy,
    createdAt: getNow(),
    updatedAt: getNow(),
  } as Record<string, unknown>);

  const insertedId = isSqlite()
    ? (result as { lastInsertRowid: number }).lastInsertRowid
    : (result as unknown as [{ insertId: number }])[0].insertId;

  return { id: Number(insertedId), assetCode };
}

/**
 * Capitalize asset from AP Invoice (create fixed asset from purchase)
 */
export async function capitalizeFromAPInvoice(
  apInvoiceId: number,
  input: Omit<FixedAssetCreateInput, 'apInvoiceId'>,
  createdBy?: number
): Promise<{ id: number; assetCode: string }> {
  return createFixedAsset(
    { ...input, apInvoiceId },
    createdBy
  );
}

/**
 * List fixed assets with filters
 */
export async function listFixedAssets(
  filters?: FixedAssetQueryInput
): Promise<FixedAsset[]> {
  const { fixedAssets, assetCategories } = getAccountingTables();
  const database = (await getDb()) as any;

  let query = database
    .select()
    .from(fixedAssets);

  // Apply filters
  const conditions = [];

  if (filters?.categoryId) {
    conditions.push(eq(fixedAssets.categoryId, filters.categoryId));
  }

  if (filters?.status) {
    conditions.push(eq(fixedAssets.status, filters.status));
  }

  if (filters?.departmentId) {
    conditions.push(eq(fixedAssets.departmentId, filters.departmentId));
  }

  if (filters?.acquisitionDateFrom) {
    conditions.push(gte(fixedAssets.acquisitionDate, toQueryDate(filters.acquisitionDateFrom)));
  }

  if (filters?.acquisitionDateTo) {
    conditions.push(lte(fixedAssets.acquisitionDate, toQueryDate(filters.acquisitionDateTo)));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  const result = await query.orderBy(desc(fixedAssets.createdAt));

  return result as FixedAsset[];
}

/**
 * Get fixed asset by ID
 */
export async function getFixedAssetById(id: number): Promise<FixedAsset | null> {
  const { fixedAssets } = getAccountingTables();
  const database = (await getDb()) as any;

  const result = await database
    .select()
    .from(fixedAssets)
    .where(eq(fixedAssets.id, id))
    .limit(1);

  return (result[0] as FixedAsset) || null;
}

/**
 * Update fixed asset
 */
export async function updateFixedAsset(
  id: number,
  input: FixedAssetUpdateInput
): Promise<void> {
  const { fixedAssets } = getAccountingTables();
  const database = (await getDb()) as any;

  await database
    .update(fixedAssets)
    .set({
      ...input,
      updatedAt: getNow(),
    } as Record<string, unknown>)
    .where(eq(fixedAssets.id, id));
}

/**
 * Delete fixed asset
 * Validates no disposal records exist before deletion
 * Cascades to delete related movements and depreciation records
 */
export async function deleteFixedAsset(id: number, userId?: number): Promise<void> {
  const { fixedAssets, assetDisposals, assetMovements, assetDepreciations } = getAccountingTables();

  // Validate and cascade delete related records within executeDbOperation
  await executeDbOperation(async (db) => {
    // Check if asset exists
    const asset = await db
      .select()
      .from(fixedAssets)
      .where(eq(fixedAssets.id, id))
      .limit(1);

    if (asset.length === 0) {
      throw new Error('Fixed asset not found');
    }

    // Check if asset has disposal records
    const disposals = await db
      .select()
      .from(assetDisposals)
      .where(eq(assetDisposals.fixedAssetId, id))
      .limit(1);

    if (disposals.length > 0) {
      throw new Error('Cannot delete asset with disposal records');
    }

    // Delete related records first
    await db.delete(assetMovements).where(eq(assetMovements.fixedAssetId, id));
    await db.delete(assetDepreciations).where(eq(assetDepreciations.fixedAssetId, id));
  });

  // Use audited delete for the main asset (with audit logging)
  await auditedDelete({
    table: 'fixedAssets',
    id,
    userId,
  });
}

// ============================================
// Depreciation Functions
// ============================================

/**
 * Calculate monthly depreciation for a single asset
 */
export function calculateMonthlyDepreciation(asset: FixedAsset): number {
  if (asset.status !== 'active' || asset.usefulLifeMonths <= 0) {
    return 0;
  }

  const remainingValue = asset.netBookValue - (asset.salvageValue || 0);
  if (remainingValue <= 0) {
    return 0;
  }

  if (asset.depreciationMethod === 'declining_balance') {
    // Calculate annual rate from useful life
    const annualRate = (1 / (asset.usefulLifeMonths / 12)) * 100;
    return calculateDecliningBalanceDepreciation(asset.netBookValue, annualRate);
  }

  // Default to straight line
  return calculateStraightLineDepreciation(
    asset.acquisitionCost,
    asset.salvageValue || 0,
    asset.usefulLifeMonths
  );
}

/**
 * Run monthly depreciation for all active assets
 */
export async function runMonthlyDepreciation(
  depreciationMonth: string, // YYYY-MM format
  createdBy?: number
): Promise<{
  processedCount: number;
  totalDepreciation: number;
  journalEntryId: number | null;
}> {
  const { fixedAssets, assetDepreciations, assetCategories } = getAccountingTables();
  const database = (await getDb()) as any;

  // Get all active assets
  const activeAssets = await database
    .select()
    .from(fixedAssets)
    .where(and(
      eq(fixedAssets.status, 'active'),
      lte(fixedAssets.depreciationStartDate, toQueryDate(`${depreciationMonth}-01`))
    ));

  if (activeAssets.length === 0) {
    return { processedCount: 0, totalDepreciation: 0, journalEntryId: null };
  }

  let totalDepreciation = 0;
  const depreciationRecords: Array<{
    fixedAssetId: number;
    depreciationMonth: string;
    depreciationAmount: number;
    accumulatedDepreciation: number;
    netBookValue: number;
  }> = [];

  for (const asset of activeAssets) {
    const typedAsset = asset as FixedAsset;
    const monthlyDepreciation = calculateMonthlyDepreciation(typedAsset);

    if (monthlyDepreciation > 0) {
      const newAccumulatedDepreciation = (typedAsset.accumulatedDepreciation || 0) + monthlyDepreciation;
      const newNetBookValue = typedAsset.acquisitionCost - newAccumulatedDepreciation;

      depreciationRecords.push({
        fixedAssetId: typedAsset.id,
        depreciationMonth,
        depreciationAmount: monthlyDepreciation,
        accumulatedDepreciation: newAccumulatedDepreciation,
        netBookValue: Math.max(newNetBookValue, typedAsset.salvageValue || 0),
      });

      totalDepreciation += monthlyDepreciation;
    }
  }

  if (depreciationRecords.length === 0) {
    return { processedCount: 0, totalDepreciation: 0, journalEntryId: null };
  }

  // Insert depreciation records and update assets
  for (const record of depreciationRecords) {
    // Insert depreciation record
    await database.insert(assetDepreciations).values({
      fixedAssetId: record.fixedAssetId,
      depreciationMonth: record.depreciationMonth,
      depreciationAmount: record.depreciationAmount,
      accumulatedDepreciation: record.accumulatedDepreciation,
      netBookValue: record.netBookValue,
      createdAt: getNow(),
    } as Record<string, unknown>);

    // Update asset accumulated depreciation and net book value
    await database
      .update(fixedAssets)
      .set({
        accumulatedDepreciation: record.accumulatedDepreciation,
        netBookValue: record.netBookValue,
        status: record.netBookValue <= (activeAssets.find((a: FixedAsset) => a.id === record.fixedAssetId)?.salvageValue || 0)
          ? 'fully_depreciated'
          : 'active',
        updatedAt: getNow(),
      } as Record<string, unknown>)
      .where(eq(fixedAssets.id, record.fixedAssetId));
  }

  // Post the depreciation journal entry.
  //
  // This used to be a TODO returning null, which meant `asset_depreciations`
  // and the asset's NBV moved while the GL did not — a guaranteed
  // subledger-to-GL divergence the moment the module was used. Depreciation
  // must be recognised in the GL each period, and the asset register must
  // reconcile to its control accounts.
  //
  // Accounts come from the asset's category (asset_categories already carries
  // depreciation_expense_gl_account_id and accumulated_depreciation_gl_account_id),
  // so different asset classes hit their own expense / accumulated accounts.
  // Amounts are grouped per account pair to keep the entry compact rather than
  // emitting two lines per asset.
  const categories = await database.select().from(assetCategories);
  const categoryById = new Map<number, AssetCategory>(
    (categories as AssetCategory[]).map((c) => [c.id, c]),
  );
  const assetById = new Map<number, FixedAsset>(
    (activeAssets as FixedAsset[]).map((a) => [a.id, a]),
  );

  // key: `${expenseAccountId}:${accumulatedAccountId}` → summed amount
  const byAccountPair = new Map<string, number>();
  const unmappedAssetIds: number[] = [];

  for (const record of depreciationRecords) {
    const asset = assetById.get(record.fixedAssetId);
    const category = asset?.categoryId != null ? categoryById.get(asset.categoryId) : undefined;
    const expenseAccountId = category?.depreciationExpenseGLAccountId;
    const accumulatedAccountId = category?.accumulatedDepreciationGLAccountId;

    if (!expenseAccountId || !accumulatedAccountId) {
      unmappedAssetIds.push(record.fixedAssetId);
      continue;
    }

    const key = `${expenseAccountId}:${accumulatedAccountId}`;
    byAccountPair.set(key, (byAccountPair.get(key) || 0) + record.depreciationAmount);
  }

  // An asset whose category has no GL mapping cannot be posted. Failing loudly
  // beats silently under-posting depreciation and leaving the GL short.
  if (unmappedAssetIds.length > 0) {
    throw new Error(
      `ไม่สามารถบันทึกบัญชีค่าเสื่อมราคาได้: สินทรัพย์รหัส ${unmappedAssetIds.join(', ')} ` +
        'ไม่ได้กำหนดผังบัญชีค่าเสื่อมราคา/ค่าเสื่อมราคาสะสมในประเภทสินทรัพย์',
    );
  }

  const journalLines: { glAccountId: number; debit: number; credit: number; description: string }[] = [];
  for (const [key, amount] of byAccountPair) {
    const [expenseAccountId, accumulatedAccountId] = key.split(':').map(Number);
    const rounded = Math.round(amount * 100) / 100;
    if (rounded <= 0) continue;
    journalLines.push({
      glAccountId: expenseAccountId,
      debit: rounded,
      credit: 0,
      description: `ค่าเสื่อมราคาประจำงวด ${depreciationMonth}`,
    });
    journalLines.push({
      glAccountId: accumulatedAccountId,
      debit: 0,
      credit: rounded,
      description: `ค่าเสื่อมราคาสะสม ${depreciationMonth}`,
    });
  }

  let journalEntryId: number | null = null;
  if (journalLines.length >= 2) {
    const je = await createJournalEntry({
      // Depreciation is recognised on the last day of the month it belongs to.
      entryDate: getMonthEndDate(depreciationMonth),
      description: `ค่าเสื่อมราคาประจำงวด ${depreciationMonth}`,
      sourceType: 'DEPRECIATION',
      lines: journalLines,
      createdBy: createdBy ?? 0,
    });
    journalEntryId = je.id;

    // Depreciation is a period-end recognition, not a draft proposal — post it
    // so it reaches the trial balance and financial statements.
    if (createdBy != null) {
      await postJournalEntry(je.id, createdBy);
    }
  }

  return {
    processedCount: depreciationRecords.length,
    totalDepreciation,
    journalEntryId,
  };
}

/** Last calendar day of a YYYY-MM month, as YYYY-MM-DD. */
function getMonthEndDate(month: string): string {
  const [y, m] = month.split('-').map(Number);
  // Day 0 of the NEXT month is the last day of this one.
  const d = new Date(Date.UTC(y, m, 0));
  return d.toISOString().split('T')[0];
}

/**
 * Get depreciation history for an asset
 */
export async function getAssetDepreciationHistory(
  fixedAssetId: number
): Promise<AssetDepreciation[]> {
  const { assetDepreciations } = getAccountingTables();
  const database = (await getDb()) as any;

  const result = await database
    .select()
    .from(assetDepreciations)
    .where(eq(assetDepreciations.fixedAssetId, fixedAssetId))
    .orderBy(desc(assetDepreciations.depreciationDate));

  return result as AssetDepreciation[];
}

// ============================================
// Asset Disposal Functions
// ============================================

export interface DisposeAssetInput {
  disposalDate: string;
  disposalType: 'sale' | 'scrap' | 'write_off' | 'donation';
  salePrice?: number;
  notes?: string;
}

/**
 * Dispose of a fixed asset
 * Calculates gain/loss and updates asset status
 */
export async function disposeAsset(
  fixedAssetId: number,
  input: DisposeAssetInput,
  createdBy?: number
): Promise<{
  disposalId: number;
  gainLoss: number;
  journalEntryId: number | null;
}> {
  const { fixedAssets, assetDisposals } = getAccountingTables();
  const database = (await getDb()) as any;

  // Get the asset
  const asset = await getFixedAssetById(fixedAssetId);
  if (!asset) {
    throw new Error('Asset not found');
  }

  if (asset.status === 'disposed') {
    throw new Error('Asset is already disposed');
  }

  // Calculate gain/loss
  const salePrice = input.salePrice || 0;
  const gainLoss = salePrice - asset.netBookValue;

  // Create disposal record
  const result = await database.insert(assetDisposals).values({
    fixedAssetId,
    disposalDate: toDbDate(input.disposalDate),
    disposalType: input.disposalType,
    netBookValueAtDisposal: asset.netBookValue,
    salePrice,
    gainLoss,
    notes: input.notes,
    createdBy,
    createdAt: getNow(),
  } as Record<string, unknown>);

  const disposalId = isSqlite()
    ? (result as { lastInsertRowid: number }).lastInsertRowid
    : (result as unknown as [{ insertId: number }])[0].insertId;

  // Update asset status
  await database
    .update(fixedAssets)
    .set({
      status: 'disposed',
      disposalDate: toDbDate(input.disposalDate),
      updatedAt: getNow(),
    } as Record<string, unknown>)
    .where(eq(fixedAssets.id, fixedAssetId));

  // TODO: Create journal entry for disposal
  // Debit: Cash/Bank (sale price)
  // Debit: Accumulated Depreciation
  // Debit/Credit: Gain/Loss on Disposal
  // Credit: Fixed Asset (acquisition cost)
  const journalEntryId = null;

  return {
    disposalId: Number(disposalId),
    gainLoss,
    journalEntryId,
  };
}

/**
 * Get disposal record for an asset
 */
export async function getAssetDisposal(
  fixedAssetId: number
): Promise<AssetDisposal | null> {
  const { assetDisposals } = getAccountingTables();
  const database = (await getDb()) as any;

  const result = await database
    .select()
    .from(assetDisposals)
    .where(eq(assetDisposals.fixedAssetId, fixedAssetId))
    .limit(1);

  return (result[0] as AssetDisposal) || null;
}

// ============================================
// Asset Movement Functions
// ============================================

export interface TransferAssetInput {
  transferDate: string;
  fromLocation?: string;
  toLocation: string;
  fromDepartmentId?: number;
  toDepartmentId?: number;
  reason?: string;
}

/**
 * Transfer asset to a new location or department
 */
export async function transferAsset(
  fixedAssetId: number,
  input: TransferAssetInput,
  createdBy?: number
): Promise<{ movementId: number }> {
  const { fixedAssets, assetMovements } = getAccountingTables();
  const database = (await getDb()) as any;

  // Get the asset
  const asset = await getFixedAssetById(fixedAssetId);
  if (!asset) {
    throw new Error('Asset not found');
  }

  // Create movement record
  const result = await database.insert(assetMovements).values({
    fixedAssetId,
    movementDate: toDbDate(input.transferDate),
    movementType: 'transfer',
    fromLocation: input.fromLocation || asset.location,
    toLocation: input.toLocation,
    fromDepartmentId: input.fromDepartmentId || asset.departmentId,
    toDepartmentId: input.toDepartmentId,
    reason: input.reason,
    createdBy,
    createdAt: getNow(),
  } as Record<string, unknown>);

  const movementId = isSqlite()
    ? (result as { lastInsertRowid: number }).lastInsertRowid
    : (result as unknown as [{ insertId: number }])[0].insertId;

  // Update asset location and department
  await database
    .update(fixedAssets)
    .set({
      location: input.toLocation,
      departmentId: input.toDepartmentId || asset.departmentId,
      updatedAt: getNow(),
    } as Record<string, unknown>)
    .where(eq(fixedAssets.id, fixedAssetId));

  return { movementId: Number(movementId) };
}

/**
 * Get movement history for an asset
 */
export async function getAssetMovementHistory(
  fixedAssetId: number
): Promise<AssetMovement[]> {
  const { assetMovements } = getAccountingTables();
  const database = (await getDb()) as any;

  const result = await database
    .select()
    .from(assetMovements)
    .where(eq(assetMovements.fixedAssetId, fixedAssetId))
    .orderBy(desc(assetMovements.movementDate));

  return result as AssetMovement[];
}

// ============================================
// Asset Summary Functions
// ============================================

/**
 * Get asset summary statistics
 */
export async function getAssetSummary(): Promise<{
  totalAssets: number;
  activeAssets: number;
  disposedAssets: number;
  fullyDepreciatedAssets: number;
  totalAcquisitionCost: number;
  totalAccumulatedDepreciation: number;
  totalNetBookValue: number;
}> {
  const { fixedAssets } = getAccountingTables();
  const database = (await getDb()) as any;

  const result = await database
    .select({
      totalAssets: sql<number>`count(*)`,
      activeAssets: sql<number>`sum(case when ${fixedAssets.status} = 'active' then 1 else 0 end)`,
      disposedAssets: sql<number>`sum(case when ${fixedAssets.status} = 'disposed' then 1 else 0 end)`,
      fullyDepreciatedAssets: sql<number>`sum(case when ${fixedAssets.status} = 'fully_depreciated' then 1 else 0 end)`,
      totalAcquisitionCost: sql<number>`coalesce(sum(${fixedAssets.acquisitionCost}), 0)`,
      totalAccumulatedDepreciation: sql<number>`coalesce(sum(${fixedAssets.accumulatedDepreciation}), 0)`,
      totalNetBookValue: sql<number>`coalesce(sum(${fixedAssets.netBookValue}), 0)`,
    })
    .from(fixedAssets);

  return {
    totalAssets: Number(result[0]?.totalAssets || 0),
    activeAssets: Number(result[0]?.activeAssets || 0),
    disposedAssets: Number(result[0]?.disposedAssets || 0),
    fullyDepreciatedAssets: Number(result[0]?.fullyDepreciatedAssets || 0),
    totalAcquisitionCost: Number(result[0]?.totalAcquisitionCost || 0),
    totalAccumulatedDepreciation: Number(result[0]?.totalAccumulatedDepreciation || 0),
    totalNetBookValue: Number(result[0]?.totalNetBookValue || 0),
  };
}

/**
 * Get assets by category for reporting
 */
export async function getAssetsByCategory(): Promise<Array<{
  categoryId: number;
  categoryCode: string;
  categoryNameTh: string;
  categoryNameEn: string;
  assetCount: number;
  totalAcquisitionCost: number;
  totalAccumulatedDepreciation: number;
  totalNetBookValue: number;
}>> {
  const { fixedAssets, assetCategories } = getAccountingTables();
  const database = (await getDb()) as any;

  const result = await database
    .select({
      categoryId: assetCategories.id,
      categoryCode: assetCategories.code,
      categoryNameTh: assetCategories.nameTh,
      categoryNameEn: assetCategories.nameEn,
      assetCount: sql<number>`count(${fixedAssets.id})`,
      totalAcquisitionCost: sql<number>`coalesce(sum(${fixedAssets.acquisitionCost}), 0)`,
      totalAccumulatedDepreciation: sql<number>`coalesce(sum(${fixedAssets.accumulatedDepreciation}), 0)`,
      totalNetBookValue: sql<number>`coalesce(sum(${fixedAssets.netBookValue}), 0)`,
    })
    .from(assetCategories)
    .leftJoin(fixedAssets, eq(fixedAssets.categoryId, assetCategories.id))
    .groupBy(assetCategories.id)
    .orderBy(asc(assetCategories.code));

  return result.map((row: {
    categoryId: number;
    categoryCode: string;
    categoryNameTh: string;
    categoryNameEn: string | null;
    assetCount: number;
    totalAcquisitionCost: number;
    totalAccumulatedDepreciation: number;
    totalNetBookValue: number;
  }) => ({
    categoryId: Number(row.categoryId),
    categoryCode: row.categoryCode,
    categoryNameTh: row.categoryNameTh,
    categoryNameEn: row.categoryNameEn,
    assetCount: Number(row.assetCount || 0),
    totalAcquisitionCost: Number(row.totalAcquisitionCost || 0),
    totalAccumulatedDepreciation: Number(row.totalAccumulatedDepreciation || 0),
    totalNetBookValue: Number(row.totalNetBookValue || 0),
  }));
}
