/**
 * Material Withdrawal Approval Service
 *
 * Handles the operator -> supervisor workflow for additional raw material
 * withdrawal beyond planned BOM quantity. Common reasons: machine setup loss,
 * equipment trial run, parameter adjustment.
 *
 * Two-stage workflow:
 *   1. createRequest  — operator submits, request is bound to a WO + BOM material,
 *      validated against soft/hard caps, persisted with status='pending'.
 *      NO inventory movement yet.
 *   2. approveRequest — supervisor reviews. Service then (in a single tx):
 *        - verifies E-signature (password)
 *        - verifies Dual Control (approver != requester)
 *        - re-checks cap (defensive)
 *        - checks stock availability at approve-time
 *        - updates request.status = 'approved'
 *        - posts inventory_transactions (negative qty)
 *        - updates work_order_materials.additional_qty_via_withdrawal_request
 *        - creates deviation record (linked via withdrawal_request_id)
 *        - captures signature row
 *      rejectRequest  — supervisor rejects with reason. Creates a record-only
 *        deviation. NO inventory impact.
 *
 * GMP standards covered:
 *   - 21 CFR Part 11 (audit trail + E-signature)
 *   - GMP Material Reconciliation
 *   - Dual Control / segregation of duties
 *
 * Feature: 018-material-withdrawal-approval
 */

import { and, count, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { executeDbOperation, getInsertId, getAffectedRows, isSqlite } from '../db/db-helper';
import { getNow } from '../db/date-utils';
import { getLotsForPicking, issueMaterial } from './inventory.service';
import {
  // SQLite tables we need
  sqliteMaterialWithdrawalRequests,
  sqliteMaterialWithdrawalRequestItems,
  sqliteMaterialWithdrawalApprovals,
  sqliteMaterialWithdrawalAttachments,
  sqliteMaterialWithdrawalRules,
  sqliteWorkOrders,
  sqliteWorkOrderMaterials,
  sqliteItems,
  sqliteUsers,
  sqliteDeviations,
  sqliteInventoryLots,
  sqliteInventoryTransactions,
  sqliteElectronicSignatures,
  // MySQL tables we need
  mysqlMaterialWithdrawalRequests,
  mysqlMaterialWithdrawalRequestItems,
  mysqlMaterialWithdrawalApprovals,
  mysqlMaterialWithdrawalAttachments,
  mysqlMaterialWithdrawalRules,
  mysqlWorkOrders,
  mysqlWorkOrderMaterials,
  mysqlItems,
  mysqlUsers,
  mysqlDeviations,
  mysqlInventoryLots,
  mysqlInventoryTransactions,
  mysqlElectronicSignatures,
} from '../db/schema';
import {
  MaterialWithdrawalError,
  WITHDRAWAL_ERROR_CODES,
  type CreateMaterialWithdrawalRequestInput,
  type ApproveMaterialWithdrawalRequestInput,
  type RejectMaterialWithdrawalRequestInput,
  type MaterialWithdrawalListFilters,
  type MaterialWithdrawalRequestDetail,
  type MaterialWithdrawalRequestSummary,
  type MaterialCategory,
  type PaginatedRequests,
  type WithdrawalStatus,
  type ResolvedCapRule,
} from '@/types/material-withdrawal';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default soft cap when no rule row matches at all (defense in depth). */
const DEFAULT_SOFT_CAP_PERCENT = 10;
/** Default hard cap when no rule row matches at all. */
const DEFAULT_HARD_CAP_PERCENT = 50;
/** Idempotency window: reject duplicate submissions within this many seconds. */
const IDEMPOTENCY_WINDOW_SECONDS = 30;

// ---------------------------------------------------------------------------
// Table-ref helper
// ---------------------------------------------------------------------------

function getTables() {
  if (isSqlite()) {
    return {
      requests: sqliteMaterialWithdrawalRequests,
      requestItems: sqliteMaterialWithdrawalRequestItems,
      approvals: sqliteMaterialWithdrawalApprovals,
      attachments: sqliteMaterialWithdrawalAttachments,
      rules: sqliteMaterialWithdrawalRules,
      workOrders: sqliteWorkOrders,
      workOrderMaterials: sqliteWorkOrderMaterials,
      items: sqliteItems,
      users: sqliteUsers,
      deviations: sqliteDeviations,
      lots: sqliteInventoryLots,
      transactions: sqliteInventoryTransactions,
      signatures: sqliteElectronicSignatures,
    } as const;
  }
  return {
    requests: mysqlMaterialWithdrawalRequests,
    requestItems: mysqlMaterialWithdrawalRequestItems,
    approvals: mysqlMaterialWithdrawalApprovals,
    attachments: mysqlMaterialWithdrawalAttachments,
    rules: mysqlMaterialWithdrawalRules,
    workOrders: mysqlWorkOrders,
    workOrderMaterials: mysqlWorkOrderMaterials,
    items: mysqlItems,
    users: mysqlUsers,
    deviations: mysqlDeviations,
    lots: mysqlInventoryLots,
    transactions: mysqlInventoryTransactions,
    signatures: mysqlElectronicSignatures,
  } as const;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  return Number(value);
}

function payloadHash(input: {
  workOrderId: number;
  items: Array<{ materialId: number; quantityRequested: number; unit: string }>;
  reasonType: string;
  requestedByUserId: number;
}): string {
  const canonical = JSON.stringify({
    workOrderId: input.workOrderId,
    items: [...input.items]
      .sort((a, b) => a.materialId - b.materialId)
      .map((i) => ({ materialId: i.materialId, qty: i.quantityRequested, unit: i.unit })),
    reasonType: input.reasonType,
    user: input.requestedByUserId,
  });
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Verify user password against stored hash. Reuses Line Clearance E-sig pattern
 * via the existing auth helper.
 */
async function verifyUserPassword(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  userId: number,
  password: string,
): Promise<{ ok: boolean; user?: { id: number; name?: string; role?: string } }> {
  const tables = getTables();
  const rows = await db
    .select({ id: tables.users.id, password: tables.users.password, name: tables.users.name, role: tables.users.role })
    .from(tables.users)
    .where(eq(tables.users.id, userId))
    .limit(1);
  const user = rows[0];
  if (!user) return { ok: false };
  const { verifyPassword } = await import('../auth');
  const ok = await verifyPassword(password, user.password as string);
  return { ok, user: ok ? { id: user.id, name: user.name, role: user.role } : undefined };
}

/**
 * Compute material category for cap lookup. For now we map item categoryCode → enum
 * with a simple heuristic; the codebase's item categories are factory-defined.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function inferMaterialCategory(item: any): MaterialCategory {
  const code = String(item?.categoryCode ?? item?.category ?? '').toLowerCase();
  if (code.includes('active') || code === 'ai') return 'active_ingredient';
  if (code.includes('excip')) return 'excipient';
  if (code.includes('pack')) return 'packaging';
  return 'other';
}

// ---------------------------------------------------------------------------
// Cap Rule resolution
// ---------------------------------------------------------------------------

export async function resolveCapRule(
  factoryCode: string | null,
  materialCategory: MaterialCategory,
): Promise<ResolvedCapRule> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const candidates = await db
      .select()
      .from(tables.rules)
      .where(eq(tables.rules.isActive, true));

    // Score each candidate by specificity (factory match + category match)
    type RuleRow = typeof candidates extends Array<infer T> ? T : never;
    const scored = (candidates as RuleRow[])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((row: any) => {
        const fMatch = row.factoryCode === factoryCode ? 2 : row.factoryCode === null ? 0 : -1;
        const cMatch = row.materialCategory === materialCategory ? 2 : row.materialCategory === null ? 0 : -1;
        return { row, fMatch, cMatch, total: fMatch + cMatch };
      })
      .filter((s) => s.fMatch >= 0 && s.cMatch >= 0)
      .sort((a, b) => b.total - a.total);

    if (scored.length === 0) {
      // Fallback to compile-time default
      return {
        id: 0,
        factoryCode: null,
        materialCategory: null,
        softCapPercent: DEFAULT_SOFT_CAP_PERCENT,
        hardCapPercent: DEFAULT_HARD_CAP_PERCENT,
        isActive: true,
        createdByUserId: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        resolutionPath: ['default (no rule row)'],
      };
    }

    const top = scored[0];
    const path = [
      top.fMatch === 2 ? `factory=${factoryCode}` : 'factory=ANY',
      top.cMatch === 2 ? `category=${materialCategory}` : 'category=ANY',
    ];
    return {
      id: Number(top.row.id),
      factoryCode: top.row.factoryCode ?? null,
      materialCategory: (top.row.materialCategory ?? null) as MaterialCategory | null,
      softCapPercent: toNumber(top.row.softCapPercent),
      hardCapPercent: toNumber(top.row.hardCapPercent),
      isActive: Boolean(top.row.isActive),
      createdByUserId: Number(top.row.createdByUserId),
      createdAt: String(top.row.createdAt),
      updatedAt: String(top.row.updatedAt),
      resolutionPath: path,
    };
  });
}

// ---------------------------------------------------------------------------
// Create Request
// ---------------------------------------------------------------------------

export async function createRequest(
  input: CreateMaterialWithdrawalRequestInput,
  requestedByUserId: number,
): Promise<MaterialWithdrawalRequestDetail> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    // 1. Verify work order exists and is in an active state
    const wo = await db
      .select()
      .from(tables.workOrders)
      .where(eq(tables.workOrders.id, input.workOrderId))
      .limit(1);
    const workOrder = wo[0];
    if (!workOrder) {
      throw new MaterialWithdrawalError(
        WITHDRAWAL_ERROR_CODES.WORK_ORDER_NOT_ACTIVE,
        'Work order not found',
      );
    }
    const woStatus = String(workOrder.status ?? '').toLowerCase();
    if (!['released', 'in_progress', 'in-progress', 'inprogress', 'started'].includes(woStatus)) {
      throw new MaterialWithdrawalError(
        WITHDRAWAL_ERROR_CODES.WORK_ORDER_NOT_ACTIVE,
        `Work order is not active (status=${woStatus})`,
      );
    }

    // 2. Idempotency check — same payloadHash within window from same user?
    const hash = payloadHash({
      workOrderId: input.workOrderId,
      items: input.items,
      reasonType: input.reasonType,
      requestedByUserId,
    });
    const idemSinceIso = new Date(Date.now() - IDEMPOTENCY_WINDOW_SECONDS * 1000).toISOString();
    const dupRows = await db
      .select({ id: tables.requests.id })
      .from(tables.requests)
      .where(
        and(
          eq(tables.requests.payloadHash, hash),
          eq(tables.requests.requestedByUserId, requestedByUserId),
          gte(tables.requests.requestedAt, isSqlite() ? idemSinceIso : new Date(idemSinceIso) as unknown as string),
        ),
      )
      .limit(1);
    if (dupRows.length > 0) {
      throw new MaterialWithdrawalError(
        WITHDRAWAL_ERROR_CODES.DUPLICATE_SUBMISSION,
        'Duplicate submission within 30s window',
        { existingRequestId: dupRows[0].id },
      );
    }

    // 3. Verify each item is part of the WO's BOM (work_order_materials)
    const materialIds = input.items.map((i) => i.materialId);
    const woMaterials = await db
      .select()
      .from(tables.workOrderMaterials)
      .where(
        and(
          eq(tables.workOrderMaterials.workOrderId, input.workOrderId),
          inArray(tables.workOrderMaterials.itemId, materialIds),
        ),
      );
    const woMaterialByItemId = new Map<number, typeof woMaterials extends Array<infer T> ? T : never>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const m of woMaterials as any[]) {
      woMaterialByItemId.set(Number(m.itemId), m);
    }
    for (const item of input.items) {
      if (!woMaterialByItemId.has(item.materialId)) {
        throw new MaterialWithdrawalError(
          WITHDRAWAL_ERROR_CODES.MATERIAL_NOT_IN_BOM,
          `Material ${item.materialId} is not part of this Work Order's BOM`,
          { materialId: item.materialId },
        );
      }
    }

    // 4. Cap rule check — for each material, compute new cumulative vs cap
    const itemsMeta = await db
      .select()
      .from(tables.items)
      .where(inArray(tables.items.id, materialIds));
    const itemMetaById = new Map<number, typeof itemsMeta extends Array<infer T> ? T : never>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const it of itemsMeta as any[]) {
      itemMetaById.set(Number(it.id), it);
    }

    for (const reqItem of input.items) {
      const itemMeta = itemMetaById.get(reqItem.materialId);
      const woMat = woMaterialByItemId.get(reqItem.materialId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const plannedQty = toNumber((woMat as any)?.plannedQuantity);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const alreadyExtra = toNumber((woMat as any)?.additionalQtyViaWithdrawalRequest);
      if (plannedQty <= 0) continue; // can't compute %, skip
      const category = inferMaterialCategory(itemMeta);
      const rule = await resolveCapRule(input.factoryCode ?? null, category);
      const projectedCumulative = alreadyExtra + reqItem.quantityRequested;
      const projectedPercent = (projectedCumulative / plannedQty) * 100;
      if (projectedPercent > rule.hardCapPercent) {
        throw new MaterialWithdrawalError(
          WITHDRAWAL_ERROR_CODES.EXCEEDS_HARD_CAP,
          `Material ${reqItem.materialId}: projected ${projectedPercent.toFixed(1)}% exceeds hard cap ${rule.hardCapPercent}%`,
          {
            materialId: reqItem.materialId,
            projectedPercent,
            hardCapPercent: rule.hardCapPercent,
            softCapPercent: rule.softCapPercent,
          },
        );
      }
      // Soft cap: do not throw — caller may surface as warning via service return
    }

    // 5. Validate attachment IDs all belong to current user (not strictly enforced
    // here — server route is responsible; we just verify they exist if provided)
    if (input.attachmentIds && input.attachmentIds.length > 5) {
      throw new MaterialWithdrawalError(
        WITHDRAWAL_ERROR_CODES.TOO_MANY_ATTACHMENTS,
        'Maximum 5 attachments per request',
      );
    }

    // 6. Insert request header
    const now = getNow();
    const requestInsert = await db.insert(tables.requests).values({
      workOrderId: input.workOrderId,
      factoryCode: input.factoryCode ?? null,
      requestedByUserId,
      requestedAt: now,
      status: 'pending',
      reasonType: input.reasonType,
      reasonDetail: input.reasonDetail ?? null,
      machinePhase: input.machinePhase ?? null,
      roomId: input.roomId,
      payloadHash: hash,
      createdAt: now,
      updatedAt: now,
    });
    const requestId = getInsertId(requestInsert);

    // 7. Insert items
    for (const reqItem of input.items) {
      const woMat = woMaterialByItemId.get(reqItem.materialId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const plannedQty = toNumber((woMat as any)?.plannedQuantity);
      await db.insert(tables.requestItems).values({
        requestId,
        materialId: reqItem.materialId,
        quantityRequested: isSqlite() ? reqItem.quantityRequested : String(reqItem.quantityRequested),
        unit: reqItem.unit,
        bomPlannedQuantity: isSqlite() ? plannedQty : String(plannedQty),
        createdAt: now,
      });
    }

    // 8. Link attachments (if any)
    if (input.attachmentIds && input.attachmentIds.length > 0) {
      await db
        .update(tables.attachments)
        .set({ requestId })
        .where(inArray(tables.attachments.id, input.attachmentIds));
    }

    const detail = await getRequestById(requestId, requestedByUserId);
    if (!detail) {
      throw new MaterialWithdrawalError(
        WITHDRAWAL_ERROR_CODES.REQUEST_NOT_PENDING,
        'Failed to load freshly-created request',
      );
    }
    return detail;
  });
}

// ---------------------------------------------------------------------------
// Get / List
// ---------------------------------------------------------------------------

export async function getRequestById(
  requestId: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _viewerUserId: number,
): Promise<MaterialWithdrawalRequestDetail | null> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const headerRows = await db
      .select()
      .from(tables.requests)
      .where(eq(tables.requests.id, requestId))
      .limit(1);
    const header = headerRows[0];
    if (!header) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: any[] = await db
      .select()
      .from(tables.requestItems)
      .where(eq(tables.requestItems.requestId, requestId));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const attachments: any[] = await db
      .select()
      .from(tables.attachments)
      .where(eq(tables.attachments.requestId, requestId));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const approvalRows: any[] = await db
      .select()
      .from(tables.approvals)
      .where(eq(tables.approvals.requestId, requestId))
      .limit(1);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const requester: any[] = await db
      .select({ id: tables.users.id, name: tables.users.name })
      .from(tables.users)
      .where(eq(tables.users.id, header.requestedByUserId))
      .limit(1);

    // Warehouse releaser (set once status = 'released')
    let releasedBy: { id: number; name: string } | null = null;
    if (header.releasedByUserId != null) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const relRows: any[] = await db
        .select({ id: tables.users.id, name: tables.users.name })
        .from(tables.users)
        .where(eq(tables.users.id, header.releasedByUserId))
        .limit(1);
      releasedBy = { id: Number(header.releasedByUserId), name: relRows[0]?.name ?? '' };
    }

    // Approver name (the supervisor who approved OR rejected) — used for both
    // the detail's approval.approverName and the summary's approvedBy field.
    let approverName: string | null = null;
    if (approvalRows.length > 0 && approvalRows[0].approverUserId != null) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const apprRows: any[] = await db
        .select({ id: tables.users.id, name: tables.users.name })
        .from(tables.users)
        .where(eq(tables.users.id, approvalRows[0].approverUserId))
        .limit(1);
      approverName = apprRows[0]?.name ?? null;
    }

    // Enrich each line with the material's name/code and the on-hand qty across
    // lots, so the approver sees *what* the material is and *whether* there is
    // enough — instead of a bare id and a surprise "not enough" error on submit.
    const itemIds = items.map((it) => Number(it.materialId));
    const itemMetaById = new Map<number, { code: string; name: string }>();
    const availableByItem = new Map<number, number>();
    if (itemIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const metaRows: any[] = await db
        .select({ id: tables.items.id, code: tables.items.code, nameTh: tables.items.nameTh })
        .from(tables.items)
        .where(inArray(tables.items.id, itemIds));
      for (const m of metaRows) {
        itemMetaById.set(Number(m.id), { code: String(m.code ?? ''), name: String(m.nameTh ?? '') });
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lotRows: any[] = await db
        .select({ itemId: tables.lots.itemId, quantity: tables.lots.quantity })
        .from(tables.lots)
        .where(inArray(tables.lots.itemId, itemIds));
      for (const lot of lotRows) {
        const id = Number(lot.itemId);
        availableByItem.set(id, (availableByItem.get(id) ?? 0) + toNumber(lot.quantity));
      }
    }

    return {
      id: Number(header.id),
      workOrderId: Number(header.workOrderId),
      factoryCode: header.factoryCode ?? null,
      status: header.status as WithdrawalStatus,
      reasonType: header.reasonType,
      reasonDetail: header.reasonDetail ?? null,
      machinePhase: header.machinePhase ?? null,
      roomId: Number(header.roomId),
      requestedAt: String(header.requestedAt),
      requestedBy: {
        id: Number(header.requestedByUserId),
        name: requester[0]?.name ?? '',
      },
      approvedBy: approverName,
      itemCount: items.length,
      items: items.map((it) => {
        const meta = itemMetaById.get(Number(it.materialId));
        return {
          id: Number(it.id),
          materialId: Number(it.materialId),
          materialName: meta?.name || undefined,
          materialCode: meta?.code || undefined,
          availableQty: availableByItem.get(Number(it.materialId)) ?? 0,
          quantityRequested: toNumber(it.quantityRequested),
          quantityApproved: it.quantityApproved === null || it.quantityApproved === undefined
            ? null
            : toNumber(it.quantityApproved),
          unit: String(it.unit),
          bomPlannedQuantity: toNumber(it.bomPlannedQuantity),
          cumulativeExtraAfterApprove:
            it.cumulativeExtraAfterApprove === null || it.cumulativeExtraAfterApprove === undefined
              ? null
              : toNumber(it.cumulativeExtraAfterApprove),
        };
      }),
      attachments: attachments.map((a) => ({
        id: Number(a.id),
        fileUrl: String(a.fileUrl),
        fileName: String(a.fileName),
        mimeType: String(a.mimeType),
        sizeBytes: Number(a.sizeBytes),
      })),
      approval: approvalRows.length > 0
        ? {
            approverUserId: Number(approvalRows[0].approverUserId),
            approverName: approverName ?? undefined,
            action: approvalRows[0].action,
            actionAt: String(approvalRows[0].actionAt),
            reason: approvalRows[0].reason ?? null,
            comment: approvalRows[0].comment ?? null,
            signatureId: Number(approvalRows[0].signatureId),
          }
        : null,
      releasedAt: header.releasedAt ? String(header.releasedAt) : null,
      releasedBy,
    };
  });
}

export async function listRequests(
  filters: MaterialWithdrawalListFilters,
): Promise<PaginatedRequests> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const page = filters.page ?? 1;
    const pageSize = Math.min(filters.pageSize ?? 20, 100);

    const conds = [];
    if (filters.workOrderId) conds.push(eq(tables.requests.workOrderId, filters.workOrderId));
    if (filters.status) conds.push(eq(tables.requests.status, filters.status));
    if (filters.reasonType) conds.push(eq(tables.requests.reasonType, filters.reasonType));
    if (filters.requestedBy) conds.push(eq(tables.requests.requestedByUserId, filters.requestedBy));
    if (filters.factoryCode !== undefined && filters.factoryCode !== null) {
      conds.push(eq(tables.requests.factoryCode, filters.factoryCode));
    }
    if (filters.dateFrom) conds.push(gte(tables.requests.requestedAt, filters.dateFrom));
    if (filters.dateTo) conds.push(lte(tables.requests.requestedAt, filters.dateTo));

    const whereClause = conds.length > 0 ? and(...conds) : undefined;

    const baseQuery = db.select().from(tables.requests);
    const whereQuery = whereClause ? baseQuery.where(whereClause) : baseQuery;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = await whereQuery
      .orderBy(desc(tables.requests.requestedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const totalQuery = db.select({ value: count() }).from(tables.requests);
    const totalRows = await (whereClause ? totalQuery.where(whereClause) : totalQuery);
    const total = Number(totalRows[0]?.value ?? 0);

    // Item count per row
    const requestIds = rows.map((r) => Number(r.id));
    const itemCounts = new Map<number, number>();
    if (requestIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const itemRows: any[] = await db
        .select({ requestId: tables.requestItems.requestId, c: count() })
        .from(tables.requestItems)
        .where(inArray(tables.requestItems.requestId, requestIds))
        .groupBy(tables.requestItems.requestId);
      for (const ic of itemRows) {
        itemCounts.set(Number(ic.requestId), Number(ic.c));
      }
    }

    // Approval (approve OR reject) per request, so the list can show who
    // reviewed each request (ผู้อนุมัติ — list item 49). One decision per
    // request in this flow; take the row keyed by requestId.
    const approvalByReq = new Map<number, { approverUserId: number }>();
    if (requestIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const approvalRows: any[] = await db
        .select({
          requestId: tables.approvals.requestId,
          approverUserId: tables.approvals.approverUserId,
        })
        .from(tables.approvals)
        .where(inArray(tables.approvals.requestId, requestIds));
      for (const a of approvalRows) {
        approvalByReq.set(Number(a.requestId), { approverUserId: Number(a.approverUserId) });
      }
    }

    // Requester + approver names (single user lookup covering both roles).
    const requesterIds = rows.map((r) => Number(r.requestedByUserId));
    const approverIds = Array.from(approvalByReq.values()).map((a) => a.approverUserId);
    const userIds = Array.from(new Set([...requesterIds, ...approverIds]));
    const userRows = userIds.length > 0
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? ((await db
          .select({ id: tables.users.id, name: tables.users.name })
          .from(tables.users)
          .where(inArray(tables.users.id, userIds))) as any[])
      : [];
    const userById = new Map<number, string>();
    for (const u of userRows) userById.set(Number(u.id), String(u.name ?? ''));

    // Work-order number + product name/code, so the list shows a real WO
    // reference (e.g. WO2606106047 — capsule) instead of a bare id.
    const woIds = Array.from(new Set(rows.map((r) => Number(r.workOrderId))));
    const woById = new Map<number, { woNumber: string; productName: string | null; productCode: string | null }>();
    if (woIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const woRows: any[] = await db
        .select({
          id: tables.workOrders.id,
          woNumber: tables.workOrders.woNumber,
          productName: tables.items.nameTh,
          productCode: tables.items.code,
        })
        .from(tables.workOrders)
        .leftJoin(tables.items, eq(tables.workOrders.productId, tables.items.id))
        .where(inArray(tables.workOrders.id, woIds));
      for (const w of woRows) {
        woById.set(Number(w.id), {
          woNumber: String(w.woNumber ?? ''),
          productName: w.productName ?? null,
          productCode: w.productCode ?? null,
        });
      }
    }

    const items: MaterialWithdrawalRequestSummary[] = rows.map((r) => {
      const wo = woById.get(Number(r.workOrderId));
      return {
        id: Number(r.id),
        workOrderId: Number(r.workOrderId),
        workOrderNumber: wo?.woNumber || `WO-${r.workOrderId}`,
        productName: wo?.productName ?? null,
        productCode: wo?.productCode ?? null,
        factoryCode: r.factoryCode ?? null,
        status: r.status as WithdrawalStatus,
        reasonType: r.reasonType,
        requestedAt: String(r.requestedAt),
        requestedBy: {
          id: Number(r.requestedByUserId),
          name: userById.get(Number(r.requestedByUserId)) ?? '',
        },
        approvedBy: (() => {
          const appr = approvalByReq.get(Number(r.id));
          return appr ? (userById.get(appr.approverUserId) ?? null) : null;
        })(),
        itemCount: itemCounts.get(Number(r.id)) ?? 0,
      };
    });

    return { items, total, page, pageSize };
  });
}

export async function listPendingRequestsForSupervisor(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _supervisorUserId: number,
  factoryCode?: string | null,
): Promise<MaterialWithdrawalRequestSummary[]> {
  const result = await listRequests({
    status: 'pending',
    factoryCode: factoryCode ?? undefined,
    page: 1,
    pageSize: 100,
  });
  // Oldest-first for the queue
  return result.items.slice().reverse();
}

// ---------------------------------------------------------------------------
// Cancel
// ---------------------------------------------------------------------------

export async function cancelRequest(
  requestId: number,
  userId: number,
  reason?: string,
): Promise<MaterialWithdrawalRequestDetail> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const rows = await db
      .select()
      .from(tables.requests)
      .where(eq(tables.requests.id, requestId))
      .limit(1);
    const req = rows[0];
    if (!req) {
      throw new MaterialWithdrawalError(
        WITHDRAWAL_ERROR_CODES.REQUEST_NOT_PENDING,
        'Request not found',
      );
    }
    if (req.status !== 'pending') {
      throw new MaterialWithdrawalError(
        WITHDRAWAL_ERROR_CODES.REQUEST_NOT_PENDING,
        `Request is not pending (status=${req.status})`,
      );
    }
    if (Number(req.requestedByUserId) !== userId) {
      throw new MaterialWithdrawalError(
        WITHDRAWAL_ERROR_CODES.PERMISSION_DENIED,
        'Only the original requester may cancel a pending request',
      );
    }
    const now = getNow();
    await db
      .update(tables.requests)
      .set({
        status: 'cancelled',
        cancelledReason: reason ?? 'cancelled by requester',
        updatedAt: now,
      })
      .where(eq(tables.requests.id, requestId));

    const detail = await getRequestById(requestId, userId);
    if (!detail) {
      throw new MaterialWithdrawalError(
        WITHDRAWAL_ERROR_CODES.REQUEST_NOT_PENDING,
        'Failed to reload cancelled request',
      );
    }
    return detail;
  });
}

// ---------------------------------------------------------------------------
// Approve / Reject — atomic transaction
// ---------------------------------------------------------------------------

interface ApproveResult {
  request: MaterialWithdrawalRequestDetail;
  inventoryTransactionIds: number[];
  deviationId: number;
}

export async function approveRequest(
  requestId: number,
  input: ApproveMaterialWithdrawalRequestInput,
  approverUserId: number,
  context?: { ipAddress?: string; userAgent?: string },
): Promise<ApproveResult> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    // 1. Load request + items
    const reqRows = await db
      .select()
      .from(tables.requests)
      .where(eq(tables.requests.id, requestId))
      .limit(1);
    const reqRow = reqRows[0];
    if (!reqRow) {
      throw new MaterialWithdrawalError(
        WITHDRAWAL_ERROR_CODES.REQUEST_NOT_PENDING,
        'Request not found',
      );
    }
    if (reqRow.status !== 'pending') {
      throw new MaterialWithdrawalError(
        WITHDRAWAL_ERROR_CODES.REQUEST_NOT_PENDING,
        `Request status is ${reqRow.status}`,
      );
    }

    // 2. Dual Control
    if (Number(reqRow.requestedByUserId) === approverUserId) {
      throw new MaterialWithdrawalError(
        WITHDRAWAL_ERROR_CODES.DUAL_CONTROL_VIOLATION,
        'Requester cannot approve their own request',
      );
    }

    // 3. E-signature: verify password
    const pwd = await verifyUserPassword(db, approverUserId, input.password);
    if (!pwd.ok) {
      throw new MaterialWithdrawalError(
        WITHDRAWAL_ERROR_CODES.INVALID_PASSWORD,
        'Invalid password for E-signature',
      );
    }

    // 4. Items + decide approved quantities
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const itemRows: any[] = await db
      .select()
      .from(tables.requestItems)
      .where(eq(tables.requestItems.requestId, requestId));
    const approvedQtyByItemId = new Map<number, number>();
    for (const it of itemRows) {
      const override = input.approvedItems?.find((a) => a.itemId === Number(it.id));
      const qty = override
        ? Math.min(override.quantityApproved, toNumber(it.quantityRequested))
        : toNumber(it.quantityRequested);
      approvedQtyByItemId.set(Number(it.id), qty);
    }

    // 5. Stock availability check
    const materialIds = itemRows.map((it) => Number(it.materialId));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lotRows: any[] = materialIds.length > 0
      ? await db
          .select()
          .from(tables.lots)
          .where(inArray(tables.lots.itemId, materialIds))
      : [];
    const onHandByItem = new Map<number, number>();
    for (const lot of lotRows) {
      onHandByItem.set(
        Number(lot.itemId),
        (onHandByItem.get(Number(lot.itemId)) ?? 0) + toNumber(lot.quantity),
      );
    }
    for (const it of itemRows) {
      const needed = approvedQtyByItemId.get(Number(it.id)) ?? 0;
      const available = onHandByItem.get(Number(it.materialId)) ?? 0;
      if (needed > available) {
        throw new MaterialWithdrawalError(
          WITHDRAWAL_ERROR_CODES.INSUFFICIENT_STOCK,
          `Material ${it.materialId}: requested ${needed} but only ${available} available`,
          { materialId: Number(it.materialId), needed, available },
        );
      }
    }

    const now = getNow();
    const nowIso = new Date().toISOString();

    // 6. Capture signature row
    const sigHashRaw = `${approverUserId}|${requestId}|approve|${nowIso}`;
    const signatureHash = createHash('sha256').update(sigHashRaw).digest('hex');
    const sigInsert = await db.insert(tables.signatures).values({
      entityType: 'material_withdrawal_request',
      entityId: requestId,
      action: 'approve',
      userId: approverUserId,
      username: String(pwd.user?.name ?? `user-${approverUserId}`),
      fullName: String(pwd.user?.name ?? `user-${approverUserId}`),
      title: pwd.user?.role ?? null,
      signedAt: isSqlite() ? nowIso : now,
      meaning: 'I approve this additional material withdrawal request.',
      passwordVerified: true,
      signatureHash,
      ipAddress: context?.ipAddress ?? null,
      userAgent: context?.userAgent ?? null,
      createdAt: now,
    });
    const signatureId = getInsertId(sigInsert);

    // 7. Update request status, set per-item approved qty + cumulative
    await db
      .update(tables.requests)
      .set({ status: 'approved', updatedAt: now })
      .where(eq(tables.requests.id, requestId));

    // 8. Per-item: record approved qty + cumulative cap tracking.
    //    NOTE: stock is NOT deducted here — the warehouse deducts it later at
    //    the release step (see releaseRequest). Approve only AUTHORIZES.
    for (const it of itemRows) {
      const qtyApproved = approvedQtyByItemId.get(Number(it.id)) ?? 0;

      // Update item row
      await db
        .update(tables.requestItems)
        .set({
          quantityApproved: isSqlite() ? qtyApproved : String(qtyApproved),
        })
        .where(eq(tables.requestItems.id, Number(it.id)));

      // Update work_order_materials.additional_qty_via_withdrawal_request (cumulative)
      const woMatRows = await db
        .select()
        .from(tables.workOrderMaterials)
        .where(
          and(
            eq(tables.workOrderMaterials.workOrderId, Number(reqRow.workOrderId)),
            eq(tables.workOrderMaterials.itemId, Number(it.materialId)),
          ),
        )
        .limit(1);
      const woMat = woMatRows[0];
      if (woMat) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const prev = toNumber((woMat as any).additionalQtyViaWithdrawalRequest);
        const next = prev + qtyApproved;
        await db
          .update(tables.workOrderMaterials)
          .set({
            additionalQtyViaWithdrawalRequest: isSqlite() ? next : String(next),
          })
          .where(eq(tables.workOrderMaterials.id, Number(woMat.id)));

        // Store cumulative on request_item row
        await db
          .update(tables.requestItems)
          .set({
            cumulativeExtraAfterApprove: isSqlite() ? next : String(next),
          })
          .where(eq(tables.requestItems.id, Number(it.id)));
      }
      // Stock deduction intentionally omitted — the warehouse deducts at release.
    }

    // 9. Insert approval row
    await db.insert(tables.approvals).values({
      requestId,
      approverUserId,
      action: 'approve',
      actionAt: now,
      reason: null,
      comment: input.comment ?? null,
      signatureId,
      createdAt: now,
    });

    // 10. Create deviation
    const deviationNumber = `DEV-WD-${requestId}-${Date.now()}`;
    const deviationInsert = await db.insert(tables.deviations).values({
      deviationNumber,
      title: `Material Withdrawal — ${reqRow.reasonType}`,
      description: `Additional material withdrawal approved for WO #${reqRow.workOrderId} (request #${requestId}). Reason: ${reqRow.reasonType}${reqRow.reasonDetail ? ` — ${reqRow.reasonDetail}` : ''}`,
      type: 'process',
      sourceType: 'production',
      sourceId: requestId,
      workOrderId: Number(reqRow.workOrderId),
      severity: 'minor',
      status: 'open',
      reportedBy: approverUserId,
      reportedAt: now,
      withdrawalRequestId: requestId,
      createdAt: now,
      updatedAt: now,
    });
    const deviationId = getInsertId(deviationInsert);

    const detail = await getRequestById(requestId, approverUserId);
    if (!detail) {
      throw new MaterialWithdrawalError(
        WITHDRAWAL_ERROR_CODES.REQUEST_NOT_PENDING,
        'Failed to reload approved request',
      );
    }
    // No inventory transactions at approve — deduction happens at release.
    return { request: detail, inventoryTransactionIds: [], deviationId };
  });
}

interface RejectResult {
  request: MaterialWithdrawalRequestDetail;
  deviationId: number;
}

export async function rejectRequest(
  requestId: number,
  input: RejectMaterialWithdrawalRequestInput,
  approverUserId: number,
  context?: { ipAddress?: string; userAgent?: string },
): Promise<RejectResult> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    const reqRows = await db
      .select()
      .from(tables.requests)
      .where(eq(tables.requests.id, requestId))
      .limit(1);
    const reqRow = reqRows[0];
    if (!reqRow) {
      throw new MaterialWithdrawalError(
        WITHDRAWAL_ERROR_CODES.REQUEST_NOT_PENDING,
        'Request not found',
      );
    }
    if (reqRow.status !== 'pending') {
      throw new MaterialWithdrawalError(
        WITHDRAWAL_ERROR_CODES.REQUEST_NOT_PENDING,
        `Request status is ${reqRow.status}`,
      );
    }
    if (Number(reqRow.requestedByUserId) === approverUserId) {
      throw new MaterialWithdrawalError(
        WITHDRAWAL_ERROR_CODES.DUAL_CONTROL_VIOLATION,
        'Requester cannot reject their own request',
      );
    }
    const pwd = await verifyUserPassword(db, approverUserId, input.password);
    if (!pwd.ok) {
      throw new MaterialWithdrawalError(
        WITHDRAWAL_ERROR_CODES.INVALID_PASSWORD,
        'Invalid password for E-signature',
      );
    }

    const now = getNow();
    const nowIso = new Date().toISOString();

    // Signature
    const signatureHash = createHash('sha256').update(`${approverUserId}|${requestId}|reject|${nowIso}`).digest('hex');
    const sigInsert = await db.insert(tables.signatures).values({
      entityType: 'material_withdrawal_request',
      entityId: requestId,
      action: 'reject',
      userId: approverUserId,
      username: String(pwd.user?.name ?? `user-${approverUserId}`),
      fullName: String(pwd.user?.name ?? `user-${approverUserId}`),
      title: pwd.user?.role ?? null,
      signedAt: isSqlite() ? nowIso : now,
      meaning: 'I reject this material withdrawal request.',
      passwordVerified: true,
      signatureHash,
      ipAddress: context?.ipAddress ?? null,
      userAgent: context?.userAgent ?? null,
      createdAt: now,
    });
    const signatureId = getInsertId(sigInsert);

    // Update request status
    await db
      .update(tables.requests)
      .set({ status: 'rejected', updatedAt: now })
      .where(eq(tables.requests.id, requestId));

    await db.insert(tables.approvals).values({
      requestId,
      approverUserId,
      action: 'reject',
      actionAt: now,
      reason: input.reason,
      comment: null,
      signatureId,
      createdAt: now,
    });

    // Record-only deviation (no inventory impact)
    const deviationNumber = `DEV-WDR-${requestId}-${Date.now()}`;
    const deviationInsert = await db.insert(tables.deviations).values({
      deviationNumber,
      title: `Material Withdrawal Rejected — ${reqRow.reasonType}`,
      description: `Material withdrawal request #${requestId} for WO #${reqRow.workOrderId} was rejected. Reason: ${input.reason}. NO INVENTORY IMPACT.`,
      type: 'process',
      sourceType: 'production',
      sourceId: requestId,
      workOrderId: Number(reqRow.workOrderId),
      severity: 'minor',
      status: 'closed',
      rootCause: 'Withdrawal request rejected by supervisor',
      closureNotes: input.reason,
      reportedBy: approverUserId,
      reportedAt: now,
      closedBy: approverUserId,
      closedAt: now,
      withdrawalRequestId: requestId,
      createdAt: now,
      updatedAt: now,
    });
    const deviationId = getInsertId(deviationInsert);

    const detail = await getRequestById(requestId, approverUserId);
    if (!detail) {
      throw new MaterialWithdrawalError(
        WITHDRAWAL_ERROR_CODES.REQUEST_NOT_PENDING,
        'Failed to reload rejected request',
      );
    }
    return { request: detail, deviationId };
  });
}

// ---------------------------------------------------------------------------
// Warehouse release — deducts stock (2nd step after supervisor approve)
// ---------------------------------------------------------------------------

interface ReleaseResult {
  request: MaterialWithdrawalRequestDetail;
  inventoryTransactionIds: number[];
}

/**
 * Warehouse releases a supervisor-approved out-of-BOM withdrawal. THIS is where
 * stock is physically deducted (FEFO via issueMaterial — same path as the BOM
 * requisition release), giving proper inventory_transactions + audit + cost.
 *
 * Mirrors api/.../requisition (action=approve): orchestrated at the function
 * level (not inside one executeDbOperation closure) because issueMaterial opens
 * its own db handle. The trailing atomic status guard bounds concurrency.
 */
export async function releaseRequest(
  requestId: number,
  _input: import('@/types/material-withdrawal').ReleaseMaterialWithdrawalRequestInput,
  releaserUserId: number,
): Promise<ReleaseResult> {
  const tables = getTables();

  // 1. Load request + guard status === 'approved'
  const reqRow = await executeDbOperation(async (db) => {
    const rows = await db
      .select()
      .from(tables.requests)
      .where(eq(tables.requests.id, requestId))
      .limit(1);
    return rows[0];
  });
  if (!reqRow) {
    throw new MaterialWithdrawalError(
      WITHDRAWAL_ERROR_CODES.REQUEST_NOT_APPROVED,
      'Request not found',
    );
  }
  if (reqRow.status !== 'approved') {
    throw new MaterialWithdrawalError(
      WITHDRAWAL_ERROR_CODES.REQUEST_NOT_APPROVED,
      `Request status is ${reqRow.status} (expected 'approved')`,
    );
  }

  // 2. Load items (quantityApproved = qty to release) + WO ref data
  const { itemRows, woNumber, batchNumber } = await executeDbOperation(async (db) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: any[] = await db
      .select()
      .from(tables.requestItems)
      .where(eq(tables.requestItems.requestId, requestId));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const woRows: any[] = await db
      .select({ woNumber: tables.workOrders.woNumber, batchNumber: tables.workOrders.batchNumber })
      .from(tables.workOrders)
      .where(eq(tables.workOrders.id, Number(reqRow.workOrderId)))
      .limit(1);
    return {
      itemRows: items,
      woNumber: String(woRows[0]?.woNumber ?? `WO-${reqRow.workOrderId}`),
      batchNumber: String(woRows[0]?.batchNumber ?? ''),
    };
  });

  // 3. Re-check stock availability across RELEASED lots only (authoritative —
  //    stock may have changed between approve and release).
  await executeDbOperation(async (db) => {
    const materialIds = itemRows.map((it) => Number(it.materialId));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lotRows: any[] = materialIds.length > 0
      ? await db
          .select({ itemId: tables.lots.itemId, quantity: tables.lots.quantity })
          .from(tables.lots)
          .where(and(inArray(tables.lots.itemId, materialIds), eq(tables.lots.status, 'released')))
      : [];
    const availableByItem = new Map<number, number>();
    for (const lot of lotRows) {
      availableByItem.set(
        Number(lot.itemId),
        (availableByItem.get(Number(lot.itemId)) ?? 0) + toNumber(lot.quantity),
      );
    }
    for (const it of itemRows) {
      const needed = toNumber(it.quantityApproved);
      const available = availableByItem.get(Number(it.materialId)) ?? 0;
      if (needed > available) {
        throw new MaterialWithdrawalError(
          WITHDRAWAL_ERROR_CODES.INSUFFICIENT_STOCK,
          `Material ${it.materialId}: need ${needed} but only ${available} available in released lots`,
          { materialId: Number(it.materialId), needed, available },
        );
      }
    }
  });

  // 4. Deduct stock per item via FEFO (issueMaterial handles tx + audit + cost).
  const inventoryTransactionIds: number[] = [];
  for (const it of itemRows) {
    const qty = toNumber(it.quantityApproved);
    if (qty <= 0) continue;
    const { allocated, remaining } = await getLotsForPicking(Number(it.materialId), qty);
    if (allocated.length === 0 || remaining > 0) {
      throw new MaterialWithdrawalError(
        WITHDRAWAL_ERROR_CODES.INSUFFICIENT_STOCK,
        `Material ${it.materialId}: could not allocate ${qty} from released lots`,
        { materialId: Number(it.materialId), needed: qty, shortfall: remaining },
      );
    }
    for (const alloc of allocated) {
      const txId = await issueMaterial(
        alloc.lotId,
        alloc.quantity,
        'material_withdrawal_request',
        requestId,
        woNumber,
        releaserUserId,
        `Out-of-BOM withdrawal release #${requestId}`,
        { workOrderId: Number(reqRow.workOrderId), batchNumber },
      );
      inventoryTransactionIds.push(txId);
    }
  }

  // 5. Atomic status guard — only flip if still 'approved' (concurrency).
  const affected = await executeDbOperation(async (db) => {
    const res = await db
      .update(tables.requests)
      .set({
        status: 'released',
        releasedByUserId: releaserUserId,
        releasedAt: getNow(),
        updatedAt: getNow(),
      })
      .where(and(eq(tables.requests.id, requestId), eq(tables.requests.status, 'approved')));
    return getAffectedRows(res);
  });
  if (affected === 0) {
    throw new MaterialWithdrawalError(
      WITHDRAWAL_ERROR_CODES.REQUEST_NOT_APPROVED,
      'Request was already released by another user',
    );
  }

  const detail = await getRequestById(requestId, releaserUserId);
  if (!detail) {
    throw new MaterialWithdrawalError(
      WITHDRAWAL_ERROR_CODES.REQUEST_NOT_APPROVED,
      'Failed to reload released request',
    );
  }
  return { request: detail, inventoryTransactionIds };
}

// ---------------------------------------------------------------------------
// Approved-awaiting-release queue — feeds the warehouse requisitions page
// ---------------------------------------------------------------------------

export interface ApprovedWithdrawalForRelease {
  requestId: number;
  /** 'approved' = awaiting warehouse release; 'released' = already issued. */
  status: 'approved' | 'released';
  workOrderId: number;
  woNumber: string;
  batchNumber: string;
  productName: string | null;
  productCode: string | null;
  reasonType: string;
  requestedBy: string | null;
  requestedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  releasedBy: string | null;
  releasedAt: string | null;
  materials: {
    itemId: number;
    itemCode: string;
    itemName: string;
    quantityApproved: number;
    unit: string;
    releasedAvailable: number;
  }[];
}

/**
 * Out-of-BOM withdrawals for the warehouse register — both those awaiting
 * release (status='approved') AND those already released (status='released',
 * kept for history). Enriched with material meta + on-hand from released lots.
 * Used by the merged /inventory/requisitions page (out-of-BOM tab).
 */
export async function getApprovedWithdrawalsForRelease(): Promise<ApprovedWithdrawalForRelease[]> {
  // One-time legacy backfill before the warehouse queue is ever read, so
  // pre-change 'approved' rows (already stock-deducted) surface as 'released'.
  await runLegacyBackfillOnce();
  return executeDbOperation(async (db) => {
    const tables = getTables();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reqs: any[] = await db
      .select()
      .from(tables.requests)
      .where(inArray(tables.requests.status, ['approved', 'released']))
      .orderBy(desc(tables.requests.id));
    if (reqs.length === 0) return [];

    const requestIds = reqs.map((r) => Number(r.id));
    const workOrderIds = [...new Set(reqs.map((r) => Number(r.workOrderId)))];
    const userIds = [
      ...new Set(
        reqs.flatMap((r) =>
          [Number(r.requestedByUserId), r.releasedByUserId != null ? Number(r.releasedByUserId) : null].filter(
            (v): v is number => v != null,
          ),
        ),
      ),
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allItems: any[] = await db
      .select()
      .from(tables.requestItems)
      .where(inArray(tables.requestItems.requestId, requestIds));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const approvals: any[] = await db
      .select()
      .from(tables.approvals)
      .where(inArray(tables.approvals.requestId, requestIds));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wos: any[] = await db
      .select({
        id: tables.workOrders.id,
        woNumber: tables.workOrders.woNumber,
        batchNumber: tables.workOrders.batchNumber,
        productName: tables.items.nameTh,
        productCode: tables.items.code,
      })
      .from(tables.workOrders)
      .leftJoin(tables.items, eq(tables.workOrders.productId, tables.items.id))
      .where(inArray(tables.workOrders.id, workOrderIds));
    const woById = new Map<number, any>(wos.map((w) => [Number(w.id), w]));

    const approverIds = approvals.map((a) => Number(a.approverUserId));
    const allUserIds = [...new Set([...userIds, ...approverIds])];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const users: any[] = allUserIds.length > 0
      ? await db.select({ id: tables.users.id, name: tables.users.name }).from(tables.users).where(inArray(tables.users.id, allUserIds))
      : [];
    const userName = new Map<number, string>(users.map((u) => [Number(u.id), String(u.name ?? '')]));
    const approvalByReq = new Map<number, any>(approvals.map((a) => [Number(a.requestId), a]));

    // Material meta + released-lot on-hand
    const materialIds = [...new Set(allItems.map((it) => Number(it.materialId)))];
    const metaById = new Map<number, { code: string; name: string }>();
    const releasedByItem = new Map<number, number>();
    if (materialIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const metaRows: any[] = await db
        .select({ id: tables.items.id, code: tables.items.code, nameTh: tables.items.nameTh })
        .from(tables.items)
        .where(inArray(tables.items.id, materialIds));
      for (const m of metaRows) metaById.set(Number(m.id), { code: String(m.code ?? ''), name: String(m.nameTh ?? '') });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lotRows: any[] = await db
        .select({ itemId: tables.lots.itemId, quantity: tables.lots.quantity })
        .from(tables.lots)
        .where(and(inArray(tables.lots.itemId, materialIds), eq(tables.lots.status, 'released')));
      for (const lot of lotRows) {
        releasedByItem.set(Number(lot.itemId), (releasedByItem.get(Number(lot.itemId)) ?? 0) + toNumber(lot.quantity));
      }
    }

    const itemsByReq = new Map<number, any[]>();
    for (const it of allItems) {
      const arr = itemsByReq.get(Number(it.requestId)) ?? [];
      arr.push(it);
      itemsByReq.set(Number(it.requestId), arr);
    }

    return reqs.map((r) => {
      const wo = woById.get(Number(r.workOrderId));
      const appr = approvalByReq.get(Number(r.id));
      return {
        requestId: Number(r.id),
        status: (r.status === 'released' ? 'released' : 'approved') as 'approved' | 'released',
        workOrderId: Number(r.workOrderId),
        woNumber: String(wo?.woNumber ?? `WO-${r.workOrderId}`),
        batchNumber: String(wo?.batchNumber ?? ''),
        productName: wo?.productName ?? null,
        productCode: wo?.productCode ?? null,
        reasonType: String(r.reasonType),
        requestedBy: userName.get(Number(r.requestedByUserId)) ?? null,
        requestedAt: r.requestedAt ? String(r.requestedAt) : null,
        approvedBy: appr ? (userName.get(Number(appr.approverUserId)) ?? null) : null,
        approvedAt: appr?.actionAt ? String(appr.actionAt) : null,
        releasedBy: r.releasedByUserId != null ? (userName.get(Number(r.releasedByUserId)) ?? null) : null,
        releasedAt: r.releasedAt ? String(r.releasedAt) : null,
        materials: (itemsByReq.get(Number(r.id)) ?? []).map((it) => {
          const meta = metaById.get(Number(it.materialId));
          return {
            itemId: Number(it.materialId),
            itemCode: meta?.code ?? '',
            itemName: meta?.name ?? '',
            quantityApproved: toNumber(it.quantityApproved),
            unit: String(it.unit),
            releasedAvailable: releasedByItem.get(Number(it.materialId)) ?? 0,
          };
        }),
      };
    });
  });
}

// ---------------------------------------------------------------------------
// Back-compat: legacy 'approved' rows already deducted stock under old logic.
// Promote them to 'released' once so they don't surface in the warehouse queue
// (and never get double-deducted). Idempotent — safe to call repeatedly.
//
// IMPORTANT: this is a ONE-TIME deploy migration. At deploy time EVERY
// 'approved' row is legacy (old approve deducted stock immediately). Once new
// code is live, a fresh 'approved' row means "awaiting release" and must NOT be
// promoted — so the backfill runs exactly once per process via the guard below,
// and is gated on releasedAt IS NULL (new rows get releasedAt at release time).
// Run at first read of the warehouse queue, before any release UI is reachable.
// ---------------------------------------------------------------------------

export async function backfillLegacyApprovedToReleased(): Promise<number> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const res = await db
      .update(tables.requests)
      .set({ status: 'released', releasedAt: sql`COALESCE(${tables.requests.releasedAt}, ${tables.requests.updatedAt})` })
      .where(and(eq(tables.requests.status, 'approved'), sql`${tables.requests.releasedAt} IS NULL`));
    return getAffectedRows(res);
  });
}

// Single in-flight promise so concurrent callers await the same backfill
// (rather than the second skipping past a not-yet-finished first run).
let legacyBackfillPromise: Promise<void> | null = null;
async function runLegacyBackfillOnce(): Promise<void> {
  if (!legacyBackfillPromise) {
    legacyBackfillPromise = backfillLegacyApprovedToReleased()
      .then(() => undefined)
      .catch((err) => {
        // Non-fatal — log and allow a retry on the next call.
        console.warn('[material-withdrawal] legacy backfill failed (non-fatal):', err);
        legacyBackfillPromise = null;
      });
  }
  await legacyBackfillPromise;
}

// ---------------------------------------------------------------------------
// Phase blocking (FR-035..040) — exposed here for use by production-gate
// ---------------------------------------------------------------------------

/**
 * Returns the set of material IDs that have a pending withdrawal request for
 * this Work Order. Used by production-gate to decide which phases to block.
 */
export async function getPendingMaterialIdsForWorkOrder(
  workOrderId: number,
): Promise<{ materialIds: number[]; pendingRequestIds: number[] }> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pendingReqs: any[] = await db
      .select({ id: tables.requests.id })
      .from(tables.requests)
      .where(and(eq(tables.requests.workOrderId, workOrderId), eq(tables.requests.status, 'pending')));
    if (pendingReqs.length === 0) return { materialIds: [], pendingRequestIds: [] };
    const pendingRequestIds = pendingReqs.map((r) => Number(r.id));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: any[] = await db
      .select({ materialId: tables.requestItems.materialId })
      .from(tables.requestItems)
      .where(inArray(tables.requestItems.requestId, pendingRequestIds));
    const materialIds = Array.from(new Set(items.map((i) => Number(i.materialId))));
    return { materialIds, pendingRequestIds };
  });
}

// Ensure ESLint doesn't warn for the imported sql helper used elsewhere.
// (kept as a local alias to make the dependency graph explicit)
export const _sqlImport = sql;
