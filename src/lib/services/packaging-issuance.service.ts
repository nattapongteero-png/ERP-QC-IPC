/**
 * Packaging Issuance Service (feature 019, US1)
 *
 * Handles the operator → verifier flow for Primary Packaging issuance:
 *   1. createIssuance  — operator submits, row created with flow_status='pending_verification'
 *   2. verifyIssuance  — verifier (different user) signs e-sig; atomic:
 *        - status → 'issued'
 *        - inventory_transaction (negative qty) created
 *        - lot quantity decremented
 *
 * GMP enforcement:
 *   - Dual Control: verifier ≠ operator (FR-008)
 *   - Container Label required (FR-004); 24h duplicate warning (FR-005)
 *   - Items must be in WO BOM AND items.type='packaging' (FR-002)
 *   - All mutations audited via audit-wrapper
 */

import { and, eq, gte, inArray, sql, desc } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { executeDbOperation, getInsertId, isSqlite } from '../db/db-helper';
import { getNow } from '../db/date-utils';
import {
  sqliteWOPackagingMaterials,
  sqliteWorkOrders,
  sqliteItems,
  sqliteUsers,
  sqliteInventoryLots,
  sqliteInventoryTransactions,
  sqliteElectronicSignatures,
  sqliteWorkOrderMaterials,
  mysqlWOPackagingMaterials,
  mysqlWorkOrders,
  mysqlItems,
  mysqlUsers,
  mysqlInventoryLots,
  mysqlInventoryTransactions,
  mysqlElectronicSignatures,
  mysqlWorkOrderMaterials,
} from '../db/schema';
import {
  PackagingError,
  PACKAGING_ERROR_CODES,
  type CreateIssuanceInput,
  type IssuanceDetail,
  type IssuanceFlowStatus,
} from '@/types/packaging';

const IDEMPOTENCY_WINDOW_SECONDS = 30;

function getTables() {
  if (isSqlite()) {
    return {
      pkgMaterials: sqliteWOPackagingMaterials,
      workOrders: sqliteWorkOrders,
      items: sqliteItems,
      users: sqliteUsers,
      lots: sqliteInventoryLots,
      transactions: sqliteInventoryTransactions,
      signatures: sqliteElectronicSignatures,
      workOrderMaterials: sqliteWorkOrderMaterials,
    } as const;
  }
  return {
    pkgMaterials: mysqlWOPackagingMaterials,
    workOrders: mysqlWorkOrders,
    items: mysqlItems,
    users: mysqlUsers,
    lots: mysqlInventoryLots,
    transactions: mysqlInventoryTransactions,
    signatures: mysqlElectronicSignatures,
    workOrderMaterials: mysqlWorkOrderMaterials,
  } as const;
}

function toNumber(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  return Number(v);
}

async function verifyUserPassword(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  userId: number,
  password: string,
): Promise<{ ok: boolean; user?: { id: number; name?: string; role?: string } }> {
  const tables = getTables();
  const rows = await db
    .select({
      id: tables.users.id,
      password: tables.users.password,
      name: tables.users.name,
      role: tables.users.role,
    })
    .from(tables.users)
    .where(eq(tables.users.id, userId))
    .limit(1);
  const u = rows[0];
  if (!u) return { ok: false };
  const { verifyPassword } = await import('../auth');
  const ok = await verifyPassword(password, u.password as string);
  return { ok, user: ok ? { id: u.id, name: u.name, role: u.role } : undefined };
}

// ---------------------------------------------------------------------------
// Create Issuance
// ---------------------------------------------------------------------------

export interface CreateIssuanceResult {
  issuance: IssuanceDetail;
  containerLabelWarning: boolean;
  duplicateIssuanceIds: number[];
}

export async function createIssuance(
  workOrderId: number,
  input: CreateIssuanceInput,
  operatorUserId: number,
): Promise<CreateIssuanceResult> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    // 1. Validate work order active
    const woRows = await db
      .select()
      .from(tables.workOrders)
      .where(eq(tables.workOrders.id, workOrderId))
      .limit(1);
    const wo = woRows[0];
    if (!wo) {
      throw new PackagingError(PACKAGING_ERROR_CODES.WORK_ORDER_NOT_ACTIVE, 'Work order not found');
    }
    const status = String(wo.status ?? '').toLowerCase();
    if (!['released', 'in_progress', 'in-progress', 'inprogress', 'started'].includes(status)) {
      throw new PackagingError(
        PACKAGING_ERROR_CODES.WORK_ORDER_NOT_ACTIVE,
        `Work order status is ${status}`,
      );
    }

    // 2. Validate item is in WO BOM AND items.type='packaging'
    const itemRows = await db
      .select()
      .from(tables.items)
      .where(eq(tables.items.id, input.itemId))
      .limit(1);
    const item = itemRows[0];
    if (!item) {
      throw new PackagingError(
        PACKAGING_ERROR_CODES.MATERIAL_NOT_IN_BOM,
        'Item not found',
      );
    }
    if (String(item.type) !== 'packaging') {
      throw new PackagingError(
        PACKAGING_ERROR_CODES.NOT_PACKAGING_TYPE,
        `Item type is ${item.type}, not packaging`,
      );
    }

    // Check WO BOM membership (via work_order_materials)
    const bomRows = await db
      .select()
      .from(tables.workOrderMaterials)
      .where(
        and(
          eq(tables.workOrderMaterials.workOrderId, workOrderId),
          eq(tables.workOrderMaterials.itemId, input.itemId),
        ),
      )
      .limit(1);
    if (bomRows.length === 0) {
      throw new PackagingError(
        PACKAGING_ERROR_CODES.MATERIAL_NOT_IN_BOM,
        'Item is not in this Work Order BOM',
      );
    }

    // 3. Check stock sufficiency
    const lotRows = await db
      .select()
      .from(tables.lots)
      .where(eq(tables.lots.id, input.sourceLotId))
      .limit(1);
    const lot = lotRows[0];
    if (!lot) {
      throw new PackagingError(
        PACKAGING_ERROR_CODES.INSUFFICIENT_STOCK,
        'Source lot not found',
      );
    }
    const onHand = toNumber(lot.quantity);
    if (onHand < input.quantity) {
      throw new PackagingError(
        PACKAGING_ERROR_CODES.INSUFFICIENT_STOCK,
        `Lot has ${onHand} but ${input.quantity} requested`,
        { available: onHand, requested: input.quantity },
      );
    }

    // 4. 24h Container Label duplicate check (warning, not block)
    const sinceIso = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dupRows: any[] = await db
      .select({ id: tables.pkgMaterials.id })
      .from(tables.pkgMaterials)
      .where(
        and(
          eq(tables.pkgMaterials.workOrderId, workOrderId),
          eq(tables.pkgMaterials.containerLabel, input.containerLabel),
          gte(tables.pkgMaterials.createdAt, sinceIso),
        ),
      );
    const containerLabelWarning = dupRows.length > 0;
    const duplicateIssuanceIds = dupRows.map((r) => Number(r.id));

    // 5. Insert row
    const now = getNow();
    const insertResult = await db.insert(tables.pkgMaterials).values({
      workOrderId,
      itemId: input.itemId,
      materialName: String(item.nameTh ?? item.name ?? `Item ${input.itemId}`),
      qtyRequisitioned: isSqlite() ? input.quantity : String(input.quantity),
      unit: String(item.primaryUnit ?? 'pcs'),
      operatorId: operatorUserId,
      sourceLotId: input.sourceLotId,
      containerLabel: input.containerLabel,
      flowStatus: 'pending_verification',
      roomId: input.roomId,
      createdAt: now,
      updatedAt: now,
    });
    const issuanceId = getInsertId(insertResult);

    const detail = await getIssuanceById(issuanceId);
    if (!detail) {
      throw new PackagingError(
        PACKAGING_ERROR_CODES.ISSUANCE_NOT_PENDING,
        'Failed to reload issuance',
      );
    }
    return { issuance: detail, containerLabelWarning, duplicateIssuanceIds };
  });
}

// ---------------------------------------------------------------------------
// Verify Issuance — Dual Control + stock deduction
// ---------------------------------------------------------------------------

export interface VerifyIssuanceResult {
  issuance: IssuanceDetail;
  inventoryTransactionId: number;
}

export async function verifyIssuance(
  issuanceId: number,
  password: string,
  verifierUserId: number,
  context?: { ipAddress?: string; userAgent?: string },
): Promise<VerifyIssuanceResult> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    const rows = await db
      .select()
      .from(tables.pkgMaterials)
      .where(eq(tables.pkgMaterials.id, issuanceId))
      .limit(1);
    const issuance = rows[0];
    if (!issuance) {
      throw new PackagingError(
        PACKAGING_ERROR_CODES.ISSUANCE_NOT_PENDING,
        'Issuance not found',
      );
    }
    if (issuance.flowStatus !== 'pending_verification') {
      throw new PackagingError(
        PACKAGING_ERROR_CODES.ISSUANCE_NOT_PENDING,
        `Status is ${issuance.flowStatus}`,
      );
    }

    // Dual Control
    if (Number(issuance.operatorId) === verifierUserId) {
      throw new PackagingError(
        PACKAGING_ERROR_CODES.DUAL_CONTROL_VIOLATION,
        'Verifier cannot be the same as operator',
      );
    }

    // E-signature
    const pwd = await verifyUserPassword(db, verifierUserId, password);
    if (!pwd.ok) {
      throw new PackagingError(
        PACKAGING_ERROR_CODES.INVALID_PASSWORD,
        'Invalid password',
      );
    }

    // Re-check stock at verify-time
    const lotRows = await db
      .select()
      .from(tables.lots)
      .where(eq(tables.lots.id, Number(issuance.sourceLotId)))
      .limit(1);
    const lot = lotRows[0];
    const onHand = toNumber(lot?.quantity);
    const needed = toNumber(issuance.qtyRequisitioned);
    if (!lot || onHand < needed) {
      throw new PackagingError(
        PACKAGING_ERROR_CODES.INSUFFICIENT_STOCK,
        `Stock at verify-time: ${onHand} but ${needed} required`,
        { available: onHand, requested: needed },
      );
    }

    const now = getNow();
    const nowIso = new Date().toISOString();

    // Signature
    const signatureHash = createHash('sha256')
      .update(`${verifierUserId}|pkg-issue|${issuanceId}|${nowIso}`)
      .digest('hex');
    const sigInsert = await db.insert(tables.signatures).values({
      entityType: 'packaging_issuance',
      entityId: issuanceId,
      action: 'verify',
      userId: verifierUserId,
      username: String(pwd.user?.name ?? `user-${verifierUserId}`),
      fullName: String(pwd.user?.name ?? `user-${verifierUserId}`),
      title: pwd.user?.role ?? null,
      signedAt: isSqlite() ? nowIso : now,
      meaning: 'I verify this packaging issuance (Dual Control).',
      passwordVerified: true,
      signatureHash,
      ipAddress: context?.ipAddress ?? null,
      userAgent: context?.userAgent ?? null,
      createdAt: now,
    });
    const signatureId = getInsertId(sigInsert);

    // Update issuance
    await db
      .update(tables.pkgMaterials)
      .set({
        verifierUserId,
        verifierSignatureId: signatureId,
        verifiedAt: now,
        flowStatus: 'issued',
        updatedAt: now,
      })
      .where(eq(tables.pkgMaterials.id, issuanceId));

    // Inventory transaction (negative qty = issue)
    const txInsert = await db.insert(tables.transactions).values({
      lotId: Number(issuance.sourceLotId),
      transactionType: 'issue',
      quantity: isSqlite() ? -needed : String(-needed),
      referenceType: 'packaging_issuance',
      referenceId: issuanceId,
      performedBy: verifierUserId,
      performedAt: now,
      notes: `Packaging issuance #${issuanceId}`,
      createdAt: now,
    });
    const inventoryTransactionId = getInsertId(txInsert);

    // Decrement lot quantity
    await db
      .update(tables.lots)
      .set({ quantity: isSqlite() ? onHand - needed : String(onHand - needed) })
      .where(eq(tables.lots.id, Number(issuance.sourceLotId)));

    const detail = await getIssuanceById(issuanceId);
    if (!detail) {
      throw new PackagingError(
        PACKAGING_ERROR_CODES.ISSUANCE_NOT_PENDING,
        'Failed to reload',
      );
    }
    return { issuance: detail, inventoryTransactionId };
  });
}

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

export async function getIssuanceById(issuanceId: number): Promise<IssuanceDetail | null> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const rows = await db
      .select()
      .from(tables.pkgMaterials)
      .where(eq(tables.pkgMaterials.id, issuanceId))
      .limit(1);
    const r = rows[0];
    if (!r) return null;

    // Operator name
    const opRows = r.operatorId
      ? await db
          .select({ id: tables.users.id, name: tables.users.name })
          .from(tables.users)
          .where(eq(tables.users.id, Number(r.operatorId)))
          .limit(1)
      : [];
    // Verifier name
    const vRows = r.verifierUserId
      ? await db
          .select({ id: tables.users.id, name: tables.users.name })
          .from(tables.users)
          .where(eq(tables.users.id, Number(r.verifierUserId)))
          .limit(1)
      : [];

    // Item info
    const itemRows = r.itemId
      ? await db
          .select()
          .from(tables.items)
          .where(eq(tables.items.id, Number(r.itemId)))
          .limit(1)
      : [];
    const item = itemRows[0];

    return {
      id: Number(r.id),
      workOrderId: Number(r.workOrderId),
      itemId: Number(r.itemId ?? 0),
      itemName: item ? String(item.nameTh ?? item.name ?? r.materialName) : r.materialName,
      itemCode: item ? String(item.code ?? '') : '',
      quantity: toNumber(r.qtyRequisitioned),
      unit: String(r.unit),
      containerLabel: r.containerLabel ?? null,
      flowStatus: (r.flowStatus as IssuanceFlowStatus) ?? 'pending_verification',
      operator: { id: Number(r.operatorId ?? 0), name: opRows[0]?.name ?? '' },
      verifier: vRows[0] ? { id: Number(vRows[0].id), name: String(vRows[0].name ?? '') } : null,
      verifiedAt: r.verifiedAt ?? null,
      sourceLotId: r.sourceLotId ?? null,
      roomId: r.roomId ?? null,
      plannedQuantity: toNumber(r.qtyRequisitioned),
      createdAt: String(r.createdAt),
    };
  });
}

export async function listIssuancesForWO(
  workOrderId: number,
  flowStatus?: IssuanceFlowStatus,
): Promise<IssuanceDetail[]> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const conds = [eq(tables.pkgMaterials.workOrderId, workOrderId)];
    if (flowStatus) conds.push(eq(tables.pkgMaterials.flowStatus, flowStatus));
    const rows = await db
      .select({ id: tables.pkgMaterials.id })
      .from(tables.pkgMaterials)
      .where(and(...conds))
      .orderBy(desc(tables.pkgMaterials.createdAt))
      .limit(500);
    const results: IssuanceDetail[] = [];
    for (const r of rows) {
      const detail = await getIssuanceById(Number(r.id));
      if (detail) results.push(detail);
    }
    return results;
  });
}

export async function cancelIssuance(
  issuanceId: number,
  userId: number,
): Promise<void> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const rows = await db
      .select()
      .from(tables.pkgMaterials)
      .where(eq(tables.pkgMaterials.id, issuanceId))
      .limit(1);
    const r = rows[0];
    if (!r) {
      throw new PackagingError(
        PACKAGING_ERROR_CODES.ISSUANCE_NOT_PENDING,
        'Issuance not found',
      );
    }
    if (r.flowStatus !== 'pending_verification') {
      throw new PackagingError(
        PACKAGING_ERROR_CODES.ISSUANCE_NOT_PENDING,
        'Only pending issuances can be cancelled',
      );
    }
    if (Number(r.operatorId) !== userId) {
      throw new PackagingError(
        PACKAGING_ERROR_CODES.PERMISSION_DENIED,
        'Only the operator can cancel',
      );
    }
    await db
      .update(tables.pkgMaterials)
      .set({ flowStatus: 'cancelled', updatedAt: getNow() })
      .where(eq(tables.pkgMaterials.id, issuanceId));
  });
}

// Avoid unused import warnings
export const _imports = { inArray, sql, IDEMPOTENCY_WINDOW_SECONDS };
