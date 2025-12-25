/**
 * Manufacturing Contracts Service
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 8)
 *
 * Manages manufacturing contracts, quality agreements, and contract batches.
 */

import { getDb } from '../db';
import { getNow, toDbDate, toDateSafe, formatDateFromDb } from '../db/date-utils';
import { eq, and, desc, like, or, count, lte, gte } from 'drizzle-orm';
import {
  sqliteManufacturingContracts,
  sqliteContractBatches,
  sqliteInventoryLots,
  sqliteItems,
  sqliteUsers,
} from '../db/schema';
import { createAuditLog } from '../audit';
import type {
  ContractorType,
  ContractStatus,
  ContractActivityType,
  ManufacturingContract,
  ContractCreate,
  ContractUpdate,
  ContractBatch,
  ContractBatchCreate,
  ContractBatchUpdate,
  ContractDashboard,
  ContractListParams,
  ContractListResponse,
  ContractBatchListParams,
  ContractBatchListResponse,
} from '@/types/contracts';

// Type for database query result rows
interface DbContractRow {
  id: number;
  contractNumber: string;
  contractorName: string;
  contractorType: string;
  scope: string | null;
  effectiveDate: string | null;
  expirationDate: string | null;
  status: string;
  qualityAgreementPath: string | null;
  lastAuditDate: string | null;
  nextAuditDue: string | null;
  contactPerson: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  notes: string | null;
  createdAt: string;
}

interface DbBatchRow {
  id: number;
  contractId: number;
  contractNumber: string | null;
  contractorName: string | null;
  lotId: number | null;
  lotNumber: string | null;
  productName: string | null;
  activityType: string;
  activityDescription: string | null;
  performedDate: string | null;
  certificatePath: string | null;
  verifiedBy: number | null;
  verifiedByName: string | null;
  createdAt: string;
}

// ============================================
// Contract Number Generation
// ============================================

export async function generateContractNumber(): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;
  const now = new Date();
  const year = now.getFullYear();

  // Get highest contract number this year
  const prefix = `CON-${year}-`;
  const result = await database
    .select({ contractNumber: sqliteManufacturingContracts.contractNumber })
    .from(sqliteManufacturingContracts)
    .where(like(sqliteManufacturingContracts.contractNumber, `${prefix}%`))
    .orderBy(desc(sqliteManufacturingContracts.id))
    .limit(1);

  let nextNum = 1;
  if (result.length > 0) {
    const match = result[0].contractNumber.match(/CON-\d{4}-(\d+)/);
    if (match) {
      nextNum = parseInt(match[1], 10) + 1;
    }
  }

  return `${prefix}${String(nextNum).padStart(4, '0')}`;
}

// ============================================
// Contract CRUD
// ============================================

export async function createContract(
  data: ContractCreate,
  userId: number
): Promise<ManufacturingContract> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;
  const contractNumber = await generateContractNumber();

  const insertResult = await database.insert(sqliteManufacturingContracts).values({
    contractNumber,
    contractorName: data.contractorName,
    contractorType: data.contractorType,
    scope: data.scope || null,
    effectiveDate: data.effectiveDate ? toDbDate(data.effectiveDate) : null,
    expirationDate: data.expirationDate ? toDbDate(data.expirationDate) : null,
    status: 'active',
    qualityAgreementPath: data.qualityAgreementPath || null,
    contactPerson: data.contactPerson || null,
    contactEmail: data.contactEmail || null,
    contactPhone: data.contactPhone || null,
    notes: data.notes || null,
    createdAt: getNow(),
  });

  const contractId = Number(insertResult.lastInsertRowid);

  await createAuditLog({
    userId,
    action: 'CREATE',
    tableName: 'manufacturing_contracts',
    recordId: contractId,
    newValue: { contractNumber, ...data },
  });

  const contract = await getContractById(contractId);
  if (!contract) {
    throw new Error('Failed to create contract');
  }
  return contract;
}

export async function getContractById(id: number): Promise<ManufacturingContract | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  const result = await database
    .select()
    .from(sqliteManufacturingContracts)
    .where(eq(sqliteManufacturingContracts.id, id))
    .limit(1);

  if (result.length === 0) return null;

  const contract = mapContractRow(result[0] as DbContractRow);

  // Get batch count
  const batchResult = await database
    .select({ count: count() })
    .from(sqliteContractBatches)
    .where(eq(sqliteContractBatches.contractId, id));

  contract.batchCount = batchResult[0]?.count || 0;

  return contract;
}

export async function listContracts(
  params?: ContractListParams
): Promise<ContractListResponse> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;
  const page = params?.page || 1;
  const limit = params?.limit || 20;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (params?.status) {
    conditions.push(eq(sqliteManufacturingContracts.status, params.status));
  }
  if (params?.contractorType) {
    conditions.push(eq(sqliteManufacturingContracts.contractorType, params.contractorType));
  }
  if (params?.search) {
    conditions.push(
      or(
        like(sqliteManufacturingContracts.contractorName, `%${params.search}%`),
        like(sqliteManufacturingContracts.contractNumber, `%${params.search}%`)
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Get total count
  const countResult = await database
    .select({ count: count() })
    .from(sqliteManufacturingContracts)
    .where(whereClause);

  const total = countResult[0]?.count || 0;

  // Get contracts
  const result = await database
    .select()
    .from(sqliteManufacturingContracts)
    .where(whereClause)
    .orderBy(desc(sqliteManufacturingContracts.id))
    .limit(limit)
    .offset(offset);

  const contracts = await Promise.all(
    result.map(async (row: DbContractRow) => {
      const contract = mapContractRow(row);

      // Get batch count for each contract
      const batchResult = await database
        .select({ count: count() })
        .from(sqliteContractBatches)
        .where(eq(sqliteContractBatches.contractId, contract.id));

      contract.batchCount = batchResult[0]?.count || 0;

      return contract;
    })
  );

  return { contracts, total };
}

export async function updateContract(
  id: number,
  data: ContractUpdate,
  userId: number
): Promise<ManufacturingContract | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  const existing = await getContractById(id);
  if (!existing) return null;

  const updateData: Record<string, unknown> = {};
  if (data.contractorName !== undefined) updateData.contractorName = data.contractorName;
  if (data.contractorType !== undefined) updateData.contractorType = data.contractorType;
  if (data.scope !== undefined) updateData.scope = data.scope;
  if (data.effectiveDate !== undefined)
    updateData.effectiveDate = data.effectiveDate ? toDbDate(data.effectiveDate) : null;
  if (data.expirationDate !== undefined)
    updateData.expirationDate = data.expirationDate ? toDbDate(data.expirationDate) : null;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.qualityAgreementPath !== undefined)
    updateData.qualityAgreementPath = data.qualityAgreementPath;
  if (data.lastAuditDate !== undefined)
    updateData.lastAuditDate = data.lastAuditDate ? toDbDate(data.lastAuditDate) : null;
  if (data.nextAuditDue !== undefined)
    updateData.nextAuditDue = data.nextAuditDue ? toDbDate(data.nextAuditDue) : null;
  if (data.contactPerson !== undefined) updateData.contactPerson = data.contactPerson;
  if (data.contactEmail !== undefined) updateData.contactEmail = data.contactEmail;
  if (data.contactPhone !== undefined) updateData.contactPhone = data.contactPhone;
  if (data.notes !== undefined) updateData.notes = data.notes;

  await database
    .update(sqliteManufacturingContracts)
    .set(updateData)
    .where(eq(sqliteManufacturingContracts.id, id));

  await createAuditLog({
    userId,
    action: 'UPDATE',
    tableName: 'manufacturing_contracts',
    recordId: id,
    oldValue: existing,
    newValue: data,
  });

  return getContractById(id);
}

// ============================================
// Contract Batch CRUD
// ============================================

export async function createContractBatch(
  data: ContractBatchCreate,
  userId: number
): Promise<ContractBatch> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  const insertResult = await database.insert(sqliteContractBatches).values({
    contractId: data.contractId,
    lotId: data.lotId || null,
    activityType: data.activityType,
    activityDescription: data.activityDescription || null,
    performedDate: data.performedDate ? toDbDate(data.performedDate) : null,
    certificatePath: data.certificatePath || null,
    createdAt: getNow(),
  });

  const batchId = Number(insertResult.lastInsertRowid);

  await createAuditLog({
    userId,
    action: 'CREATE',
    tableName: 'contract_batches',
    recordId: batchId,
    newValue: data,
  });

  const batch = await getContractBatchById(batchId);
  if (!batch) {
    throw new Error('Failed to create contract batch');
  }
  return batch;
}

export async function getContractBatchById(id: number): Promise<ContractBatch | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  const result = await database
    .select({
      id: sqliteContractBatches.id,
      contractId: sqliteContractBatches.contractId,
      contractNumber: sqliteManufacturingContracts.contractNumber,
      contractorName: sqliteManufacturingContracts.contractorName,
      lotId: sqliteContractBatches.lotId,
      lotNumber: sqliteInventoryLots.lotNumber,
      productName: sqliteItems.nameTh,
      activityType: sqliteContractBatches.activityType,
      activityDescription: sqliteContractBatches.activityDescription,
      performedDate: sqliteContractBatches.performedDate,
      certificatePath: sqliteContractBatches.certificatePath,
      verifiedBy: sqliteContractBatches.verifiedBy,
      verifiedByName: sqliteUsers.name,
      createdAt: sqliteContractBatches.createdAt,
    })
    .from(sqliteContractBatches)
    .leftJoin(
      sqliteManufacturingContracts,
      eq(sqliteContractBatches.contractId, sqliteManufacturingContracts.id)
    )
    .leftJoin(sqliteInventoryLots, eq(sqliteContractBatches.lotId, sqliteInventoryLots.id))
    .leftJoin(sqliteItems, eq(sqliteInventoryLots.itemId, sqliteItems.id))
    .leftJoin(sqliteUsers, eq(sqliteContractBatches.verifiedBy, sqliteUsers.id))
    .where(eq(sqliteContractBatches.id, id))
    .limit(1);

  if (result.length === 0) return null;

  return mapBatchRow(result[0] as DbBatchRow);
}

export async function listContractBatches(
  params?: ContractBatchListParams
): Promise<ContractBatchListResponse> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;
  const page = params?.page || 1;
  const limit = params?.limit || 20;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (params?.contractId) {
    conditions.push(eq(sqliteContractBatches.contractId, params.contractId));
  }
  if (params?.activityType) {
    conditions.push(eq(sqliteContractBatches.activityType, params.activityType));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Get total count
  const countResult = await database
    .select({ count: count() })
    .from(sqliteContractBatches)
    .where(whereClause);

  const total = countResult[0]?.count || 0;

  // Get batches
  const result = await database
    .select({
      id: sqliteContractBatches.id,
      contractId: sqliteContractBatches.contractId,
      contractNumber: sqliteManufacturingContracts.contractNumber,
      contractorName: sqliteManufacturingContracts.contractorName,
      lotId: sqliteContractBatches.lotId,
      lotNumber: sqliteInventoryLots.lotNumber,
      productName: sqliteItems.nameTh,
      activityType: sqliteContractBatches.activityType,
      activityDescription: sqliteContractBatches.activityDescription,
      performedDate: sqliteContractBatches.performedDate,
      certificatePath: sqliteContractBatches.certificatePath,
      verifiedBy: sqliteContractBatches.verifiedBy,
      verifiedByName: sqliteUsers.name,
      createdAt: sqliteContractBatches.createdAt,
    })
    .from(sqliteContractBatches)
    .leftJoin(
      sqliteManufacturingContracts,
      eq(sqliteContractBatches.contractId, sqliteManufacturingContracts.id)
    )
    .leftJoin(sqliteInventoryLots, eq(sqliteContractBatches.lotId, sqliteInventoryLots.id))
    .leftJoin(sqliteItems, eq(sqliteInventoryLots.itemId, sqliteItems.id))
    .leftJoin(sqliteUsers, eq(sqliteContractBatches.verifiedBy, sqliteUsers.id))
    .where(whereClause)
    .orderBy(desc(sqliteContractBatches.id))
    .limit(limit)
    .offset(offset);

  const batches = result.map((row: DbBatchRow) => mapBatchRow(row));

  return { batches, total };
}

export async function updateContractBatch(
  id: number,
  data: ContractBatchUpdate,
  userId: number
): Promise<ContractBatch | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  const existing = await getContractBatchById(id);
  if (!existing) return null;

  const updateData: Record<string, unknown> = {};
  if (data.lotId !== undefined) updateData.lotId = data.lotId;
  if (data.activityType !== undefined) updateData.activityType = data.activityType;
  if (data.activityDescription !== undefined)
    updateData.activityDescription = data.activityDescription;
  if (data.performedDate !== undefined)
    updateData.performedDate = data.performedDate ? toDbDate(data.performedDate) : null;
  if (data.certificatePath !== undefined) updateData.certificatePath = data.certificatePath;
  if (data.verifiedBy !== undefined) updateData.verifiedBy = data.verifiedBy;

  await database
    .update(sqliteContractBatches)
    .set(updateData)
    .where(eq(sqliteContractBatches.id, id));

  await createAuditLog({
    userId,
    action: 'UPDATE',
    tableName: 'contract_batches',
    recordId: id,
    oldValue: existing,
    newValue: data,
  });

  return getContractBatchById(id);
}

// ============================================
// Dashboard
// ============================================

export async function getContractDashboard(): Promise<ContractDashboard> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = (await getDb()) as any;

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const ninetyDaysLater = new Date();
  ninetyDaysLater.setDate(ninetyDaysLater.getDate() + 90);
  const ninetyDaysLaterStr = ninetyDaysLater.toISOString().split('T')[0];
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthStartStr = monthStart.toISOString().split('T')[0];

  // Get contract counts by status
  const statusResult = await database
    .select({
      status: sqliteManufacturingContracts.status,
      count: count(),
    })
    .from(sqliteManufacturingContracts)
    .groupBy(sqliteManufacturingContracts.status);

  const byStatus: Record<string, number> = {
    active: 0,
    expired: 0,
    terminated: 0,
    pending: 0,
  };
  let totalContracts = 0;
  let activeContracts = 0;
  let expiredContracts = 0;
  let terminatedContracts = 0;
  let pendingContracts = 0;

  for (const row of statusResult) {
    byStatus[row.status] = row.count;
    totalContracts += row.count;
    if (row.status === 'active') activeContracts = row.count;
    if (row.status === 'expired') expiredContracts = row.count;
    if (row.status === 'terminated') terminatedContracts = row.count;
    if (row.status === 'pending') pendingContracts = row.count;
  }

  // Get contract counts by contractor type
  const typeResult = await database
    .select({
      contractorType: sqliteManufacturingContracts.contractorType,
      count: count(),
    })
    .from(sqliteManufacturingContracts)
    .where(eq(sqliteManufacturingContracts.status, 'active'))
    .groupBy(sqliteManufacturingContracts.contractorType);

  const byContractorType: Record<ContractorType, number> = {
    manufacturer: 0,
    laboratory: 0,
    both: 0,
  };
  for (const row of typeResult) {
    byContractorType[row.contractorType as ContractorType] = row.count;
  }

  // Get expiring soon (within 90 days)
  const expiringSoonResult = await database
    .select({ count: count() })
    .from(sqliteManufacturingContracts)
    .where(
      and(
        eq(sqliteManufacturingContracts.status, 'active'),
        gte(sqliteManufacturingContracts.expirationDate, todayStr),
        lte(sqliteManufacturingContracts.expirationDate, ninetyDaysLaterStr)
      )
    );
  const expiringSoon = expiringSoonResult[0]?.count || 0;

  // Get audits overdue
  const auditsOverdueResult = await database
    .select({ count: count() })
    .from(sqliteManufacturingContracts)
    .where(
      and(
        eq(sqliteManufacturingContracts.status, 'active'),
        lte(sqliteManufacturingContracts.nextAuditDue, todayStr)
      )
    );
  const auditsOverdue = auditsOverdueResult[0]?.count || 0;

  // Get total batches and batches this month
  const totalBatchesResult = await database.select({ count: count() }).from(sqliteContractBatches);
  const totalBatches = totalBatchesResult[0]?.count || 0;

  const batchesThisMonthResult = await database
    .select({ count: count() })
    .from(sqliteContractBatches)
    .where(gte(sqliteContractBatches.performedDate, monthStartStr));
  const batchesThisMonth = batchesThisMonthResult[0]?.count || 0;

  // Get batches by activity type
  const activityTypeResult = await database
    .select({
      activityType: sqliteContractBatches.activityType,
      count: count(),
    })
    .from(sqliteContractBatches)
    .groupBy(sqliteContractBatches.activityType);

  const byActivityType: Record<ContractActivityType, number> = {
    manufacturing: 0,
    testing: 0,
    packaging: 0,
  };
  for (const row of activityTypeResult) {
    byActivityType[row.activityType as ContractActivityType] = row.count;
  }

  // Get top contractors
  const topContractorsResult = await database
    .select({
      contractorName: sqliteManufacturingContracts.contractorName,
      contractId: sqliteManufacturingContracts.id,
      status: sqliteManufacturingContracts.status,
      batchCount: count(sqliteContractBatches.id),
    })
    .from(sqliteManufacturingContracts)
    .leftJoin(
      sqliteContractBatches,
      eq(sqliteManufacturingContracts.id, sqliteContractBatches.contractId)
    )
    .groupBy(sqliteManufacturingContracts.id)
    .orderBy(desc(count(sqliteContractBatches.id)))
    .limit(5);

  const topContractors = topContractorsResult.map((row: {
    contractorName: string;
    contractId: number;
    status: string;
    batchCount: number;
  }) => ({
    contractorName: row.contractorName,
    contractId: row.contractId,
    batchCount: row.batchCount,
    status: row.status as ContractStatus,
  }));

  // Get expiring contracts list
  const expiringContractsResult = await database
    .select()
    .from(sqliteManufacturingContracts)
    .where(
      and(
        eq(sqliteManufacturingContracts.status, 'active'),
        gte(sqliteManufacturingContracts.expirationDate, todayStr),
        lte(sqliteManufacturingContracts.expirationDate, ninetyDaysLaterStr)
      )
    )
    .orderBy(sqliteManufacturingContracts.expirationDate)
    .limit(5);

  const expiringContracts = expiringContractsResult.map((row: DbContractRow) =>
    mapContractRow(row)
  );

  // Get overdue audits list
  const overdueAuditsResult = await database
    .select()
    .from(sqliteManufacturingContracts)
    .where(
      and(
        eq(sqliteManufacturingContracts.status, 'active'),
        lte(sqliteManufacturingContracts.nextAuditDue, todayStr)
      )
    )
    .orderBy(sqliteManufacturingContracts.nextAuditDue)
    .limit(5);

  const overdueAudits = overdueAuditsResult.map((row: DbContractRow) => mapContractRow(row));

  // Get recent activity (last 6 months)
  const recentActivity: Array<{ date: string; count: number }> = [];
  for (let i = 5; i >= 0; i--) {
    const monthDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() - i + 1, 0);
    const monthLabel = monthDate.toLocaleString('en-US', { month: 'short', year: '2-digit' });

    const monthResult = await database
      .select({ count: count() })
      .from(sqliteContractBatches)
      .where(
        and(
          gte(sqliteContractBatches.performedDate, monthDate.toISOString().split('T')[0]),
          lte(sqliteContractBatches.performedDate, monthEnd.toISOString().split('T')[0])
        )
      );

    recentActivity.push({
      date: monthLabel,
      count: monthResult[0]?.count || 0,
    });
  }

  return {
    totalContracts,
    activeContracts,
    expiredContracts,
    terminatedContracts,
    pendingContracts,
    expiringSoon,
    auditsOverdue,
    totalBatches,
    batchesThisMonth,
    byContractorType,
    byActivityType,
    topContractors,
    expiringContracts,
    overdueAudits,
    recentActivity,
  };
}

// ============================================
// Row Mapping Helpers
// ============================================

function mapContractRow(row: DbContractRow): ManufacturingContract {
  const today = new Date();
  const expirationDate = row.expirationDate ? toDateSafe(row.expirationDate) : null;
  const nextAuditDue = row.nextAuditDue ? toDateSafe(row.nextAuditDue) : null;

  const daysUntilExpiry = expirationDate
    ? Math.floor((expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry <= 90 && daysUntilExpiry >= 0;
  const isAuditOverdue = nextAuditDue !== null && nextAuditDue.getTime() < today.getTime();

  return {
    id: row.id,
    contractNumber: row.contractNumber,
    contractorName: row.contractorName,
    contractorType: row.contractorType as ContractorType,
    scope: row.scope,
    effectiveDate: formatDateFromDb(row.effectiveDate),
    expirationDate: formatDateFromDb(row.expirationDate),
    status: row.status as ContractStatus,
    qualityAgreementPath: row.qualityAgreementPath,
    lastAuditDate: formatDateFromDb(row.lastAuditDate),
    nextAuditDue: formatDateFromDb(row.nextAuditDue),
    contactPerson: row.contactPerson,
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
    notes: row.notes,
    createdAt: row.createdAt,
    daysUntilExpiry: daysUntilExpiry ?? undefined,
    isExpiringSoon,
    isAuditOverdue,
  };
}

function mapBatchRow(row: DbBatchRow): ContractBatch {
  return {
    id: row.id,
    contractId: row.contractId,
    contractNumber: row.contractNumber || undefined,
    contractorName: row.contractorName || undefined,
    lotId: row.lotId,
    lotNumber: row.lotNumber || undefined,
    productName: row.productName || undefined,
    activityType: row.activityType as ContractActivityType,
    activityDescription: row.activityDescription,
    performedDate: formatDateFromDb(row.performedDate),
    certificatePath: row.certificatePath,
    verifiedBy: row.verifiedBy,
    verifiedByName: row.verifiedByName || undefined,
    createdAt: row.createdAt,
  };
}
