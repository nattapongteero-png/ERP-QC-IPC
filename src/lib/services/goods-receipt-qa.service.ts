/**
 * Goods Receipt QA Service — Release / Reject with Triple Independence
 * Feature: 020-goods-receipt
 *
 * Triple Independence: the user signing the QA action MUST NOT equal the user
 * who signed the receiver checklist. Admin role does NOT bypass this rule.
 */
import { eq } from 'drizzle-orm';
import { createHash } from 'crypto';
import { executeDbOperation, getTableRef, getInsertId } from '../db/db-helper';
import { getNow } from '../db/date-utils';
import {
  GoodsReceiptError,
  GOODS_RECEIPT_ERROR_CODES,
  type GoodsReceiptLine,
} from '@/types/goods-receipt';
import { recomputeHeaderStatus } from './goods-receipt.service';
import {
  listTolerances as listToleranceRows,
  upsertTolerance as upsertToleranceRow,
} from './goods-receipt-tolerance.service';

function getTables() {
  return {
    grns: getTableRef('goodsReceipts'),
    lines: getTableRef('goodsReceiptLines'),
    inventoryLots: getTableRef('inventoryLots'),
    qcSamples: getTableRef('qcSamples'),
    signatures: getTableRef('electronicSignatures'),
    deviations: getTableRef('deviations'),
    users: getTableRef('users'),
  };
}

export interface QaReleaseResult {
  line: GoodsReceiptLine;
  lotStatus: 'released' | 'rejected';
  deviationId: number | null;
}

export async function qaReleaseLine(
  lineId: number,
  signature: { password?: string; pin?: string },
  qaUserId: number,
): Promise<QaReleaseResult> {
  return executeDbOperation(async (db) => {
    const t = getTables();

    const rows = await db.select().from(t.lines).where(eq(t.lines.id, lineId)).limit(1);
    if (rows.length === 0)
      throw new GoodsReceiptError(GOODS_RECEIPT_ERROR_CODES.NOT_FOUND, 'Line not found');
    const line = rows[0];

    // Triple Independence — admin does NOT bypass
    if (line.receiverSignatureId) {
      const sig = await db
        .select()
        .from(t.signatures)
        .where(eq(t.signatures.id, Number(line.receiverSignatureId)))
        .limit(1);
      if (sig.length > 0 && Number(sig[0].userId) === qaUserId) {
        throw new GoodsReceiptError(
          GOODS_RECEIPT_ERROR_CODES.TRIPLE_INDEPENDENCE_VIOLATION,
          'Triple Independence violation: Receiver and QA Approver must be different users (Admin does NOT bypass)',
          { lineId, receiverUserId: Number(sig[0].userId), qaUserId },
        );
      }
    }

    // Require qc_approved status
    if (line.status !== 'qc_approved') {
      throw new GoodsReceiptError(
        GOODS_RECEIPT_ERROR_CODES.QC_NOT_APPROVED,
        `Line must be qc_approved before release (current: ${line.status})`,
      );
    }

    // Verify QC sample status if linked
    if (line.qcSampleId) {
      const qc = await db
        .select({ status: t.qcSamples.status })
        .from(t.qcSamples)
        .where(eq(t.qcSamples.id, Number(line.qcSampleId)))
        .limit(1);
      if (qc.length > 0 && !['approved', 'released'].includes(String(qc[0].status))) {
        throw new GoodsReceiptError(
          GOODS_RECEIPT_ERROR_CODES.QC_NOT_APPROVED,
          'QC sample not approved',
        );
      }
    }

    // User info
    const userRows = await db.select().from(t.users).where(eq(t.users.id, qaUserId)).limit(1);
    if (userRows.length === 0)
      throw new GoodsReceiptError(GOODS_RECEIPT_ERROR_CODES.NOT_FOUND, 'User not found');
    const user = userRows[0];

    // Insert signature
    const sigHash = createHash('sha256')
      .update(`qa-release|${qaUserId}|${lineId}|${Date.now()}`)
      .digest('hex');
    const sigInsert = await db.insert(t.signatures).values({
      entityType: 'goods_receipt_line',
      entityId: lineId,
      action: 'approve',
      userId: qaUserId,
      username: user.username ?? user.email ?? '',
      fullName: user.fullName ?? user.username ?? user.email ?? '',
      title: user.title ?? null,
      signedAt: getNow(),
      meaning: `QA released line ${lineId} to stock`,
      passwordVerified: Boolean(signature.password),
      signatureHash: sigHash,
      createdAt: getNow(),
    });
    const signatureId = getInsertId(sigInsert);

    // Update line
    await db
      .update(t.lines)
      .set({
        status: 'released_to_stock',
        qaSignatureId: signatureId,
        qaDecisionAt: getNow(),
        updatedAt: getNow(),
      })
      .where(eq(t.lines.id, lineId));

    // Update lot status
    if (line.inventoryLotId) {
      await db
        .update(t.inventoryLots)
        .set({ status: 'released', updatedAt: getNow() })
        .where(eq(t.inventoryLots.id, Number(line.inventoryLotId)));
    }

    await recomputeHeaderStatus(Number(line.grnId));

    const fresh = await db.select().from(t.lines).where(eq(t.lines.id, lineId)).limit(1);
    return {
      line: fresh[0] as GoodsReceiptLine,
      lotStatus: 'released',
      deviationId: null,
    };
  });
}

export async function qaRejectLine(
  lineId: number,
  reason: string,
  signature: { password?: string; pin?: string },
  qaUserId: number,
): Promise<QaReleaseResult> {
  return executeDbOperation(async (db) => {
    const t = getTables();

    const rows = await db.select().from(t.lines).where(eq(t.lines.id, lineId)).limit(1);
    if (rows.length === 0)
      throw new GoodsReceiptError(GOODS_RECEIPT_ERROR_CODES.NOT_FOUND, 'Line not found');
    const line = rows[0];

    // Triple Independence — even reject must be by different user
    if (line.receiverSignatureId) {
      const sig = await db
        .select()
        .from(t.signatures)
        .where(eq(t.signatures.id, Number(line.receiverSignatureId)))
        .limit(1);
      if (sig.length > 0 && Number(sig[0].userId) === qaUserId) {
        throw new GoodsReceiptError(
          GOODS_RECEIPT_ERROR_CODES.TRIPLE_INDEPENDENCE_VIOLATION,
          'Triple Independence violation',
          { lineId },
        );
      }
    }

    // Allowed from qc_pending or qc_approved (or checklist_done if QC failed)
    if (!['qc_pending', 'qc_approved', 'checklist_done'].includes(String(line.status))) {
      throw new GoodsReceiptError(
        GOODS_RECEIPT_ERROR_CODES.INVALID_TRANSITION,
        `Cannot reject from ${line.status}`,
      );
    }

    const userRows = await db.select().from(t.users).where(eq(t.users.id, qaUserId)).limit(1);
    const user = userRows[0];
    if (!user)
      throw new GoodsReceiptError(GOODS_RECEIPT_ERROR_CODES.NOT_FOUND, 'User not found');

    const sigHash = createHash('sha256')
      .update(`qa-reject|${qaUserId}|${lineId}|${Date.now()}`)
      .digest('hex');
    const sigInsert = await db.insert(t.signatures).values({
      entityType: 'goods_receipt_line',
      entityId: lineId,
      action: 'approve',
      userId: qaUserId,
      username: user.username ?? user.email ?? '',
      fullName: user.fullName ?? user.username ?? user.email ?? '',
      title: user.title ?? null,
      signedAt: getNow(),
      meaning: `QA rejected line ${lineId}: ${reason}`,
      passwordVerified: Boolean(signature.password),
      signatureHash: sigHash,
      createdAt: getNow(),
    });
    const signatureId = getInsertId(sigInsert);

    // Create deviation
    let deviationId: number | null = null;
    try {
      const grnRow = await db
        .select({ grnNumber: t.grns.grnNumber })
        .from(t.grns)
        .where(eq(t.grns.id, Number(line.grnId)))
        .limit(1);
      const grnNumber = grnRow[0]?.grnNumber ?? '';
      const devNumber = `DEV-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
      const devIns = await db.insert(t.deviations).values({
        deviationNumber: devNumber,
        deviationType: 'incoming_inspection',
        severity: 'major',
        title: `Rejected incoming receipt: ${grnNumber} line ${line.lineNumber}`,
        description: reason,
        reportedBy: qaUserId,
        reportedAt: getNow(),
        status: 'open',
        createdAt: getNow(),
        updatedAt: getNow(),
      });
      deviationId = getInsertId(devIns);
    } catch (err) {
      console.warn('[goods-receipt-qa] deviation creation failed (non-fatal)', err);
    }

    // Update line
    await db
      .update(t.lines)
      .set({
        status: 'rejected',
        qaSignatureId: signatureId,
        qaDecisionAt: getNow(),
        rejectionReason: reason,
        updatedAt: getNow(),
      })
      .where(eq(t.lines.id, lineId));

    // Update lot
    if (line.inventoryLotId) {
      await db
        .update(t.inventoryLots)
        .set({ status: 'rejected', updatedAt: getNow() })
        .where(eq(t.inventoryLots.id, Number(line.inventoryLotId)));
    }

    await recomputeHeaderStatus(Number(line.grnId));

    const fresh = await db.select().from(t.lines).where(eq(t.lines.id, lineId)).limit(1);
    return {
      line: fresh[0] as GoodsReceiptLine,
      lotStatus: 'rejected',
      deviationId,
    };
  });
}

// Re-export tolerance helpers for API routes
export const listTolerances = listToleranceRows;
export const upsertTolerance = upsertToleranceRow;
