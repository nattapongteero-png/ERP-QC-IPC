/**
 * Packaging Return Service (feature 019, US2 + US3)
 *
 * Operator → Verifier → QA flow with Triple Independence:
 *
 *   1. createReturn   — operator submits, links to issuance, computes variance
 *                       Validates: not exceed issued, lot status, explanation required
 *   2. verifyReturn   — verifier (≠ returner) signs e-sig; status stays pending_qa_approval
 *                       but verified_at is set (gate for QA)
 *   3. approveReturn  — QA (≠ returner AND ≠ verifier) acts. Single atomic transaction:
 *        a. Lock return row
 *        b. Validate Triple Independence + verified
 *        c. Verify QA password → capture signature
 *        d. IF reusable / quarantine → create child inventory_lot (parentLotId)
 *                                    → insert inventory_transaction (positive qty, type=return)
 *        e. IF rejected OR outside_tolerance → create deviation
 *        f. Insert approval row
 *        g. Update return.status
 *      All side-effects roll back together on any failure.
 */

import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { executeDbOperation, getInsertId, isSqlite } from '../db/db-helper';
import { getNow } from '../db/date-utils';
import {
  sqliteWoPackagingReturns,
  sqliteWoPackagingReturnApprovals,
  sqlitePackagingTolerances,
  sqliteWOPackagingMaterials,
  sqliteInventoryLots,
  sqliteInventoryTransactions,
  sqliteElectronicSignatures,
  sqliteUsers,
  sqliteItems,
  sqliteDeviations,
  mysqlWoPackagingReturns,
  mysqlWoPackagingReturnApprovals,
  mysqlPackagingTolerances,
  mysqlWOPackagingMaterials,
  mysqlInventoryLots,
  mysqlInventoryTransactions,
  mysqlElectronicSignatures,
  mysqlUsers,
  mysqlItems,
  mysqlDeviations,
} from '../db/schema';
import {
  PackagingError,
  PACKAGING_ERROR_CODES,
  type CreateReturnInput,
  type ApproveReturnInput,
  type ReturnDetail,
  type ReturnStatus,
  type ProposedReturnStatus,
  type PackagingCategory,
  type PackagingTolerance,
} from '@/types/packaging';

function getTables() {
  if (isSqlite()) {
    return {
      returns: sqliteWoPackagingReturns,
      approvals: sqliteWoPackagingReturnApprovals,
      tolerances: sqlitePackagingTolerances,
      pkgMaterials: sqliteWOPackagingMaterials,
      lots: sqliteInventoryLots,
      transactions: sqliteInventoryTransactions,
      signatures: sqliteElectronicSignatures,
      users: sqliteUsers,
      items: sqliteItems,
      deviations: sqliteDeviations,
    } as const;
  }
  return {
    returns: mysqlWoPackagingReturns,
    approvals: mysqlWoPackagingReturnApprovals,
    tolerances: mysqlPackagingTolerances,
    pkgMaterials: mysqlWOPackagingMaterials,
    lots: mysqlInventoryLots,
    transactions: mysqlInventoryTransactions,
    signatures: mysqlElectronicSignatures,
    users: mysqlUsers,
    items: mysqlItems,
    deviations: mysqlDeviations,
  } as const;
}

function toNumber(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  return Number(v);
}

function mapItemCategoryToTolerance(itemCategory: string | null | undefined): PackagingCategory {
  const c = String(itemCategory ?? '').toLowerCase();
  if (c.includes('caps')) return 'capsule';
  if (c.includes('bottle')) return 'bottle';
  if (c.includes('cap')) return 'cap';
  if (c.includes('label')) return 'label';
  return 'other';
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
// Tolerance lookup
// ---------------------------------------------------------------------------

export async function resolveTolerance(itemCategory: string | null | undefined): Promise<number> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const category = mapItemCategoryToTolerance(itemCategory);
    // Try exact match first
    const rows = await db
      .select()
      .from(tables.tolerances)
      .where(and(eq(tables.tolerances.packagingCategory, category), eq(tables.tolerances.isActive, true)))
      .limit(1);
    if (rows[0]) return toNumber(rows[0].tolerancePercent);
    // Fall back to 'other'
    const otherRows = await db
      .select()
      .from(tables.tolerances)
      .where(and(eq(tables.tolerances.packagingCategory, 'other'), eq(tables.tolerances.isActive, true)))
      .limit(1);
    if (otherRows[0]) return toNumber(otherRows[0].tolerancePercent);
    // Hard default
    return 1.0;
  });
}

// ---------------------------------------------------------------------------
// Create Return
// ---------------------------------------------------------------------------

export async function createReturn(
  workOrderId: number,
  input: CreateReturnInput,
  returnerUserId: number,
): Promise<ReturnDetail> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    // Load the originating issuance
    const issRows = await db
      .select()
      .from(tables.pkgMaterials)
      .where(eq(tables.pkgMaterials.id, input.woPackagingMaterialId))
      .limit(1);
    const iss = issRows[0];
    if (!iss) {
      throw new PackagingError(
        PACKAGING_ERROR_CODES.ISSUANCE_NOT_PENDING,
        'Issuance not found',
      );
    }
    if (iss.flowStatus !== 'issued') {
      throw new PackagingError(
        PACKAGING_ERROR_CODES.ISSUANCE_NOT_PENDING,
        `Issuance flow_status is ${iss.flowStatus}; can only return from 'issued'`,
      );
    }
    if (Number(iss.workOrderId) !== workOrderId) {
      throw new PackagingError(
        PACKAGING_ERROR_CODES.MATERIAL_NOT_IN_BOM,
        'Issuance does not belong to this Work Order',
      );
    }

    const issuedQty = toNumber(iss.qtyRequisitioned);

    // Validate quantities
    if (input.usedQty > issuedQty) {
      throw new PackagingError(
        PACKAGING_ERROR_CODES.USED_EXCEEDS_ISSUED,
        `Used (${input.usedQty}) exceeds issued (${issuedQty})`,
        { used: input.usedQty, issued: issuedQty },
      );
    }
    if (input.returnQty > issuedQty - input.usedQty) {
      throw new PackagingError(
        PACKAGING_ERROR_CODES.USED_EXCEEDS_ISSUED,
        `Return (${input.returnQty}) exceeds remaining after used`,
      );
    }

    // Check source lot status for cross-contamination prevention
    if (iss.sourceLotId) {
      const lotRows = await db
        .select()
        .from(tables.lots)
        .where(eq(tables.lots.id, Number(iss.sourceLotId)))
        .limit(1);
      const lot = lotRows[0];
      if (lot && String(lot.status).toLowerCase() === 'rejected' && input.proposedStatus !== 'rejected') {
        throw new PackagingError(
          PACKAGING_ERROR_CODES.LOT_REJECTED_MUST_REJECT,
          'Source lot is rejected — return must be marked rejected',
        );
      }
    }

    // Compute variance
    const varianceQty = issuedQty - input.usedQty - input.returnQty;
    const variancePercent = issuedQty > 0 ? (varianceQty / issuedQty) * 100 : 0;

    // Tolerance check
    const itemRows = iss.itemId
      ? await db.select().from(tables.items).where(eq(tables.items.id, Number(iss.itemId))).limit(1)
      : [];
    const itemCategory = String(itemRows[0]?.category ?? '');
    const tolerancePercent = await resolveTolerance(itemCategory);
    const outsideTolerance = variancePercent > tolerancePercent;

    if (outsideTolerance && (!input.varianceExplanation || input.varianceExplanation.length < 5)) {
      throw new PackagingError(
        PACKAGING_ERROR_CODES.VARIANCE_EXPLANATION_REQUIRED,
        `Variance ${variancePercent.toFixed(2)}% > tolerance ${tolerancePercent}% — explanation required`,
        { variancePercent, tolerancePercent },
      );
    }

    const now = getNow();

    const insertResult = await db.insert(tables.returns).values({
      woPackagingMaterialId: input.woPackagingMaterialId,
      usedQty: input.usedQty,
      returnQty: input.returnQty,
      varianceQty,
      variancePercent: isSqlite() ? variancePercent : String(variancePercent.toFixed(4)),
      outsideTolerance,
      varianceReason: input.varianceReason,
      varianceExplanation: input.varianceExplanation ?? null,
      returnContainerLabel: input.returnContainerLabel,
      proposedStatus: input.proposedStatus,
      returnerUserId,
      status: 'pending_qa_approval',
      submittedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    const returnId = getInsertId(insertResult);

    const detail = await getReturnById(returnId);
    if (!detail) {
      throw new PackagingError(
        PACKAGING_ERROR_CODES.RETURN_NOT_PENDING_QA,
        'Failed to reload return',
      );
    }
    return detail;
  });
}

// ---------------------------------------------------------------------------
// Verify Return — Dual Control
// ---------------------------------------------------------------------------

export async function verifyReturn(
  returnId: number,
  password: string,
  verifierUserId: number,
  context?: { ipAddress?: string; userAgent?: string },
): Promise<ReturnDetail> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const rows = await db
      .select()
      .from(tables.returns)
      .where(eq(tables.returns.id, returnId))
      .limit(1);
    const ret = rows[0];
    if (!ret) {
      throw new PackagingError(
        PACKAGING_ERROR_CODES.RETURN_NOT_PENDING_QA,
        'Return not found',
      );
    }
    if (ret.status !== 'pending_qa_approval') {
      throw new PackagingError(
        PACKAGING_ERROR_CODES.RETURN_NOT_PENDING_QA,
        `Status is ${ret.status}`,
      );
    }
    if (ret.verifiedAt) {
      throw new PackagingError(
        PACKAGING_ERROR_CODES.RETURN_NOT_PENDING_QA,
        'Return already verified',
      );
    }
    if (Number(ret.returnerUserId) === verifierUserId) {
      throw new PackagingError(
        PACKAGING_ERROR_CODES.DUAL_CONTROL_VIOLATION,
        'Verifier cannot be the returner',
      );
    }

    const pwd = await verifyUserPassword(db, verifierUserId, password);
    if (!pwd.ok) {
      throw new PackagingError(
        PACKAGING_ERROR_CODES.INVALID_PASSWORD,
        'Invalid password',
      );
    }

    const now = getNow();
    const nowIso = new Date().toISOString();
    const signatureHash = createHash('sha256')
      .update(`${verifierUserId}|pkg-return-verify|${returnId}|${nowIso}`)
      .digest('hex');
    const sigInsert = await db.insert(tables.signatures).values({
      entityType: 'packaging_return',
      entityId: returnId,
      action: 'verify',
      userId: verifierUserId,
      username: String(pwd.user?.name ?? `user-${verifierUserId}`),
      fullName: String(pwd.user?.name ?? `user-${verifierUserId}`),
      title: pwd.user?.role ?? null,
      signedAt: isSqlite() ? nowIso : now,
      meaning: 'I verify this packaging return (Dual Control).',
      passwordVerified: true,
      signatureHash,
      ipAddress: context?.ipAddress ?? null,
      userAgent: context?.userAgent ?? null,
      createdAt: now,
    });
    const signatureId = getInsertId(sigInsert);

    await db
      .update(tables.returns)
      .set({
        verifierUserId,
        verifierSignatureId: signatureId,
        verifiedAt: now,
        updatedAt: now,
      })
      .where(eq(tables.returns.id, returnId));

    const detail = await getReturnById(returnId);
    if (!detail) {
      throw new PackagingError(
        PACKAGING_ERROR_CODES.RETURN_NOT_PENDING_QA,
        'Failed to reload',
      );
    }
    return detail;
  });
}

// ---------------------------------------------------------------------------
// QA Approve — atomic 7-side-effect transaction
// ---------------------------------------------------------------------------

export interface ApproveReturnResult {
  return: ReturnDetail;
  newLotId: number | null;
  inventoryTransactionId: number | null;
  deviationId: number | null;
}

export async function approveReturn(
  returnId: number,
  input: ApproveReturnInput,
  qaUserId: number,
  context?: { ipAddress?: string; userAgent?: string },
): Promise<ApproveReturnResult> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    // 1. Load return
    const rows = await db
      .select()
      .from(tables.returns)
      .where(eq(tables.returns.id, returnId))
      .limit(1);
    const ret = rows[0];
    if (!ret) {
      throw new PackagingError(
        PACKAGING_ERROR_CODES.RETURN_NOT_PENDING_QA,
        'Return not found',
      );
    }
    if (ret.status !== 'pending_qa_approval') {
      throw new PackagingError(
        PACKAGING_ERROR_CODES.RETURN_NOT_PENDING_QA,
        `Status is ${ret.status}`,
      );
    }
    if (!ret.verifiedAt) {
      throw new PackagingError(
        PACKAGING_ERROR_CODES.RETURN_NOT_VERIFIED,
        'Return must be verified before QA approval',
      );
    }

    // 2. Triple Independence — admin does NOT bypass this
    if (Number(ret.returnerUserId) === qaUserId) {
      throw new PackagingError(
        PACKAGING_ERROR_CODES.TRIPLE_INDEPENDENCE_VIOLATION,
        'QA must not be the returner',
      );
    }
    if (Number(ret.verifierUserId) === qaUserId) {
      throw new PackagingError(
        PACKAGING_ERROR_CODES.TRIPLE_INDEPENDENCE_VIOLATION,
        'QA must not be the verifier',
      );
    }

    // 3. E-signature
    const pwd = await verifyUserPassword(db, qaUserId, input.password);
    if (!pwd.ok) {
      throw new PackagingError(
        PACKAGING_ERROR_CODES.INVALID_PASSWORD,
        'Invalid password',
      );
    }

    // 4. Validate override reason if final differs from proposed
    const mappedProposed: Record<ProposedReturnStatus, string> = {
      reusable: 'approved_reusable',
      quarantine: 'approved_quarantine',
      rejected: 'rejected',
    };
    const proposedFinal = mappedProposed[ret.proposedStatus as ProposedReturnStatus];
    if (input.finalStatus !== proposedFinal && !input.overrideReason) {
      throw new PackagingError(
        PACKAGING_ERROR_CODES.OVERRIDE_REASON_REQUIRED,
        `Final status differs from proposed; override_reason required`,
      );
    }

    const now = getNow();
    const nowIso = new Date().toISOString();

    // 5. Capture QA signature
    const sigHash = createHash('sha256')
      .update(`${qaUserId}|pkg-return-${input.finalStatus}|${returnId}|${nowIso}`)
      .digest('hex');
    const sigInsert = await db.insert(tables.signatures).values({
      entityType: 'packaging_return',
      entityId: returnId,
      action: input.finalStatus === 'rejected' ? 'reject' : 'approve',
      userId: qaUserId,
      username: String(pwd.user?.name ?? `user-${qaUserId}`),
      fullName: String(pwd.user?.name ?? `user-${qaUserId}`),
      title: pwd.user?.role ?? null,
      signedAt: isSqlite() ? nowIso : now,
      meaning: `I ${input.finalStatus === 'rejected' ? 'reject' : 'approve'} this packaging return (QA, Triple Independence).`,
      passwordVerified: true,
      signatureHash: sigHash,
      ipAddress: context?.ipAddress ?? null,
      userAgent: context?.userAgent ?? null,
      createdAt: now,
    });
    const signatureId = getInsertId(sigInsert);

    // 6. Update return status
    await db
      .update(tables.returns)
      .set({ status: input.finalStatus as ReturnStatus, updatedAt: now })
      .where(eq(tables.returns.id, returnId));

    let newLotId: number | null = null;
    let inventoryTransactionId: number | null = null;
    let deviationId: number | null = null;

    // 7. Side effects per final status
    if (input.finalStatus === 'approved_reusable' || input.finalStatus === 'approved_quarantine') {
      // Load source lot
      const issRows = await db
        .select()
        .from(tables.pkgMaterials)
        .where(eq(tables.pkgMaterials.id, Number(ret.woPackagingMaterialId)))
        .limit(1);
      const iss = issRows[0];
      const sourceLotRows = iss?.sourceLotId
        ? await db.select().from(tables.lots).where(eq(tables.lots.id, Number(iss.sourceLotId))).limit(1)
        : [];
      const sourceLot = sourceLotRows[0];

      if (sourceLot) {
        const newLotInsert = await db.insert(tables.lots).values({
          itemId: Number(sourceLot.itemId),
          lotNumber: `${String(sourceLot.lotNumber ?? `LOT-${sourceLot.id}`)}-RTN-${returnId}`,
          parentLotId: Number(sourceLot.id),
          warehouseId: Number(sourceLot.warehouseId),
          quantity: isSqlite() ? toNumber(ret.returnQty) : String(toNumber(ret.returnQty)),
          unit: String(sourceLot.unit ?? 'pcs'),
          status: input.finalStatus === 'approved_quarantine' ? 'quarantine' : 'available',
          receivedAt: now,
          createdAt: now,
        });
        newLotId = getInsertId(newLotInsert);

        const txInsert = await db.insert(tables.transactions).values({
          lotId: newLotId,
          transactionType: 'return',
          quantity: isSqlite() ? toNumber(ret.returnQty) : String(toNumber(ret.returnQty)),
          referenceType: 'packaging_return',
          referenceId: returnId,
          performedBy: qaUserId,
          performedAt: now,
          notes: `Packaging return #${returnId} (${input.finalStatus})`,
          createdAt: now,
        });
        inventoryTransactionId = getInsertId(txInsert);
      }
    }

    // 8. Deviation when outside_tolerance OR rejected
    if (ret.outsideTolerance || input.finalStatus === 'rejected') {
      const devNumber = `DEV-PKG-${returnId}-${Date.now()}`;
      const devInsert = await db.insert(tables.deviations).values({
        deviationNumber: devNumber,
        title:
          input.finalStatus === 'rejected'
            ? `Packaging Return Rejected #${returnId}`
            : `Packaging Variance Exceeds Tolerance #${returnId}`,
        description: `Packaging return #${returnId}. Final status: ${input.finalStatus}. Variance: ${ret.varianceQty} (${toNumber(ret.variancePercent).toFixed(2)}%). ${ret.varianceExplanation ?? ''}`,
        type: 'process',
        sourceType: 'production',
        sourceId: returnId,
        severity: input.finalStatus === 'rejected' ? 'major' : 'minor',
        status: input.finalStatus === 'rejected' ? 'closed' : 'open',
        reportedBy: qaUserId,
        reportedAt: now,
        closedBy: input.finalStatus === 'rejected' ? qaUserId : null,
        closedAt: input.finalStatus === 'rejected' ? now : null,
        closureNotes: input.qaNotes ?? input.overrideReason ?? null,
        createdAt: now,
        updatedAt: now,
      });
      deviationId = getInsertId(devInsert);
    }

    // 9. Insert approval row
    await db.insert(tables.approvals).values({
      returnId,
      qaUserId,
      qaSignatureId: signatureId,
      finalStatus: input.finalStatus,
      overrideReason: input.overrideReason ?? null,
      qaNotes: input.qaNotes ?? null,
      newLotId,
      deviationId,
      actionAt: now,
      createdAt: now,
    });

    const detail = await getReturnById(returnId);
    if (!detail) {
      throw new PackagingError(
        PACKAGING_ERROR_CODES.RETURN_NOT_PENDING_QA,
        'Failed to reload',
      );
    }
    return { return: detail, newLotId, inventoryTransactionId, deviationId };
  });
}

export async function rejectReturn(
  returnId: number,
  reason: string,
  qaUserId: number,
  password: string,
  context?: { ipAddress?: string; userAgent?: string },
): Promise<ApproveReturnResult> {
  return approveReturn(
    returnId,
    {
      finalStatus: 'rejected',
      overrideReason: reason,
      qaNotes: reason,
      password,
    },
    qaUserId,
    context,
  );
}

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

export async function getReturnById(returnId: number): Promise<ReturnDetail | null> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const rows = await db
      .select()
      .from(tables.returns)
      .where(eq(tables.returns.id, returnId))
      .limit(1);
    const r = rows[0];
    if (!r) return null;

    // Returner + verifier
    const retRows = await db
      .select({ id: tables.users.id, name: tables.users.name })
      .from(tables.users)
      .where(eq(tables.users.id, Number(r.returnerUserId)))
      .limit(1);
    const verRows = r.verifierUserId
      ? await db
          .select({ id: tables.users.id, name: tables.users.name })
          .from(tables.users)
          .where(eq(tables.users.id, Number(r.verifierUserId)))
          .limit(1)
      : [];

    // Issuance for cross-references
    const issRows = await db
      .select()
      .from(tables.pkgMaterials)
      .where(eq(tables.pkgMaterials.id, Number(r.woPackagingMaterialId)))
      .limit(1);
    const iss = issRows[0];

    // Approval
    const apvRows = await db
      .select()
      .from(tables.approvals)
      .where(eq(tables.approvals.returnId, returnId))
      .limit(1);
    const apv = apvRows[0];

    return {
      id: Number(r.id),
      woPackagingMaterialId: Number(r.woPackagingMaterialId),
      workOrderId: iss ? Number(iss.workOrderId) : undefined,
      itemId: iss?.itemId ? Number(iss.itemId) : undefined,
      itemName: iss ? String(iss.materialName) : undefined,
      usedQty: toNumber(r.usedQty),
      returnQty: toNumber(r.returnQty),
      varianceQty: toNumber(r.varianceQty),
      variancePercent: toNumber(r.variancePercent),
      outsideTolerance: Boolean(r.outsideTolerance),
      status: r.status as ReturnStatus,
      proposedStatus: r.proposedStatus as ProposedReturnStatus,
      returner: { id: Number(r.returnerUserId), name: retRows[0]?.name ?? '' },
      verifier: verRows[0] ? { id: Number(verRows[0].id), name: String(verRows[0].name ?? '') } : null,
      submittedAt: String(r.submittedAt),
      varianceReason: r.varianceReason,
      varianceExplanation: r.varianceExplanation ?? null,
      returnContainerLabel: String(r.returnContainerLabel),
      verifiedAt: r.verifiedAt ?? null,
      approval: apv
        ? {
            qaUserId: Number(apv.qaUserId),
            finalStatus: apv.finalStatus,
            overrideReason: apv.overrideReason ?? null,
            qaNotes: apv.qaNotes ?? null,
            newLotId: apv.newLotId ?? null,
            deviationId: apv.deviationId ?? null,
            actionAt: String(apv.actionAt),
          }
        : null,
    };
  });
}

export async function listReturnsForWO(
  workOrderId: number,
  status?: ReturnStatus,
): Promise<ReturnDetail[]> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    // Join through pkgMaterials to filter by workOrderId
    const issRows = await db
      .select({ id: tables.pkgMaterials.id })
      .from(tables.pkgMaterials)
      .where(eq(tables.pkgMaterials.workOrderId, workOrderId));
    const pkgIds = issRows.map((r: { id: number }) => Number(r.id));
    if (pkgIds.length === 0) return [];

    const conds = [
      sql`${tables.returns.woPackagingMaterialId} IN (${sql.join(
        pkgIds.map((id: number) => sql`${id}`),
        sql.raw(', '),
      )})`,
    ];
    if (status) conds.push(eq(tables.returns.status, status));

    const rRows = await db
      .select({ id: tables.returns.id })
      .from(tables.returns)
      .where(and(...conds))
      .orderBy(desc(tables.returns.submittedAt))
      .limit(500);
    const results: ReturnDetail[] = [];
    for (const r of rRows) {
      const detail = await getReturnById(Number(r.id));
      if (detail) results.push(detail);
    }
    return results;
  });
}

export async function listPendingApprovalsForQA(): Promise<ReturnDetail[]> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const rows = await db
      .select({ id: tables.returns.id })
      .from(tables.returns)
      .where(eq(tables.returns.status, 'pending_qa_approval'))
      .orderBy(asc(tables.returns.submittedAt))
      .limit(200);
    const results: ReturnDetail[] = [];
    for (const r of rows) {
      const detail = await getReturnById(Number(r.id));
      // Only returns that are verified are actionable
      if (detail && detail.verifiedAt) results.push(detail);
    }
    return results;
  });
}

// ---------------------------------------------------------------------------
// Tolerance admin
// ---------------------------------------------------------------------------

export async function listTolerances(includeInactive = false): Promise<PackagingTolerance[]> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const query = db.select().from(tables.tolerances);
    const rows = await (includeInactive ? query : query.where(eq(tables.tolerances.isActive, true)));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (rows as any[]).map((r) => ({
      id: Number(r.id),
      packagingCategory: r.packagingCategory,
      tolerancePercent: toNumber(r.tolerancePercent),
      isActive: Boolean(r.isActive),
      notes: r.notes ?? null,
      createdByUserId: Number(r.createdByUserId),
      createdAt: String(r.createdAt),
      updatedAt: String(r.updatedAt),
    }));
  });
}

export async function createTolerance(
  input: { packagingCategory: PackagingCategory; tolerancePercent: number; notes?: string },
  userId: number,
): Promise<PackagingTolerance> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const now = getNow();
    const result = await db.insert(tables.tolerances).values({
      packagingCategory: input.packagingCategory,
      tolerancePercent: isSqlite() ? input.tolerancePercent : String(input.tolerancePercent),
      isActive: true,
      notes: input.notes ?? null,
      createdByUserId: userId,
      createdAt: now,
      updatedAt: now,
    });
    const id = getInsertId(result);
    const rows = await db.select().from(tables.tolerances).where(eq(tables.tolerances.id, id)).limit(1);
    const r = rows[0];
    return {
      id: Number(r.id),
      packagingCategory: r.packagingCategory,
      tolerancePercent: toNumber(r.tolerancePercent),
      isActive: Boolean(r.isActive),
      notes: r.notes ?? null,
      createdByUserId: Number(r.createdByUserId),
      createdAt: String(r.createdAt),
      updatedAt: String(r.updatedAt),
    };
  });
}

export async function updateTolerance(
  id: number,
  patch: { tolerancePercent?: number; isActive?: boolean; notes?: string },
): Promise<void> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates: Record<string, any> = { updatedAt: getNow() };
    if (patch.tolerancePercent !== undefined) {
      updates.tolerancePercent = isSqlite() ? patch.tolerancePercent : String(patch.tolerancePercent);
    }
    if (patch.isActive !== undefined) updates.isActive = patch.isActive;
    if (patch.notes !== undefined) updates.notes = patch.notes;
    await db.update(tables.tolerances).set(updates).where(eq(tables.tolerances.id, id));
  });
}
