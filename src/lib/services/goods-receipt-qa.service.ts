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
import { getNow, toDbDate } from '../db/date-utils';
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
import { resolveDestinationWarehouseByItemType } from './warehouse-resolver.service';
import { checkLotCostUnit } from '../utils/lot-cost-unit';

function getTables() {
  return {
    grns: getTableRef('goodsReceipts'),
    lines: getTableRef('goodsReceiptLines'),
    inventoryLots: getTableRef('inventoryLots'),
    qcSamples: getTableRef('qcSamples'),
    signatures: getTableRef('electronicSignatures'),
    deviations: getTableRef('deviations'),
    users: getTableRef('users'),
    items: getTableRef('items'),
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
  options?: { actualQuantity?: number; warehouseId?: number },
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

    // The warehouse may only release once QC has signed the incoming checklist
    // (which sets the line to 'qc_approved'). That QC checklist IS the quality
    // gate — we do not additionally block on the qc_sample lab status here, so
    // the warehouse can release as soon as QC has recorded the checklist.
    if (line.status !== 'qc_approved') {
      throw new GoodsReceiptError(
        GOODS_RECEIPT_ERROR_CODES.QC_NOT_APPROVED,
        'ยังปล่อยเข้าคลังไม่ได้: ต้องให้ QC ตรวจและบันทึก checklist ก่อน',
      );
    }

    // The warehouse counts the total received quantity at release. It must be
    // ≥ what QC already drew as a sample (otherwise the remainder is negative).
    const sampleQuantity = Number(line.sampleQuantity ?? 0);
    const actualQuantity = Number(options?.actualQuantity);
    if (!Number.isFinite(actualQuantity) || actualQuantity <= 0) {
      throw new GoodsReceiptError(
        GOODS_RECEIPT_ERROR_CODES.VARIANCE_NOT_JUSTIFIED,
        'กรุณากรอกจำนวนที่นับได้จริง (มากกว่า 0) ก่อนปล่อยเข้าคลัง',
      );
    }
    if (actualQuantity < sampleQuantity) {
      throw new GoodsReceiptError(
        GOODS_RECEIPT_ERROR_CODES.VARIANCE_NOT_JUSTIFIED,
        `จำนวนที่นับได้ (${actualQuantity}) ต้องไม่น้อยกว่าจำนวนที่ QC สุ่มไป (${sampleQuantity})`,
      );
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

    // Create the remainder lot (total counted − QC sample) into RM/FG, status
    // released. Backward-compat: if a lot already exists on the line (old flow
    // created it at QC-sign), just release that instead of creating a second.
    const remainder = actualQuantity - sampleQuantity;
    let remainderLotId: number | null = line.inventoryLotId
      ? Number(line.inventoryLotId)
      : null;

    if (remainderLotId) {
      // Pre-existing lot (legacy) — release it in place.
      await db
        .update(t.inventoryLots)
        .set({ status: 'released', updatedAt: getNow() })
        .where(eq(t.inventoryLots.id, remainderLotId));
    } else if (remainder > 0) {
      const grnRows = await db
        .select()
        .from(t.grns)
        .where(eq(t.grns.id, Number(line.grnId)))
        .limit(1);
      const grn = grnRows[0];
      const itemRows = await db
        .select()
        .from(t.items)
        .where(eq(t.items.id, Number(line.itemId)))
        .limit(1);
      const lotNumber =
        line.vendorLotNumber ??
        line.batchNumber ??
        `${grn?.grnNumber ?? 'GRN'}-L${line.lineNumber}`;
      // Destination warehouse resolution (item 40 fix). Priority:
      //   1. explicit override passed by the caller;
      //   2. the warehouse mapped by the ITEM'S TYPE (finished_goods → FG
      //      warehouse, raw_material/packaging/consumable → RM warehouse) — this
      //      is what makes a Finished Goods PO land in the FG warehouse instead
      //      of the raw-material default the auto-created GRN header carried;
      //   3. the warehouse chosen on the GRN header (legacy fallback).
      // We resolve by item type rather than trusting grn.warehouseId because
      // autoCreateGrnForSource() always stamped PO-sourced GRNs with the
      // raw-material warehouse regardless of what was actually received.
      let destWarehouseId = options?.warehouseId;
      if (destWarehouseId == null) {
        const itemType = itemRows[0]?.type as string | undefined;
        if (itemType) {
          destWarehouseId = await resolveDestinationWarehouseByItemType(db, itemType);
        } else if (grn?.warehouseId != null) {
          destWarehouseId = Number(grn.warehouseId);
        }
      }
      if (destWarehouseId == null) destWarehouseId = Number(grn?.warehouseId);

      // Unit sanity check. Inventory value is quantity * cost everywhere, which
      // is only meaningful when both are in the same unit. A lot received in
      // grams while the item is costed per kilogram overstates its value 1000x —
      // that is how the expiry dashboard came to report ฿35,610,750 for a lot
      // worth about ฿35,610. We log rather than reject: the receipt itself is
      // legitimate, and we cannot tell whether the quantity or the cost is the
      // one that was entered wrong. The record makes it findable.
      {
        const itemUnit = itemRows[0]?.primaryUnit;
        const check = checkLotCostUnit({
          quantity: remainder,
          lotUnit: line.unit,
          cost: (line as { unitCost?: number | null }).unitCost ?? null,
          costUnit: itemUnit,
        });
        if (check.mismatch) {
          console.warn(
            `[goods-receipt] lot unit/cost mismatch on GRN line ${lineId}: ${check.reason}. ` +
              `Stored value ${check.storedValue}, expected ~${check.correctedValue}.`,
          );
        }
      }

      const lotInsert = await db.insert(t.inventoryLots).values({
        itemId: Number(line.itemId),
        lotNumber,
        batchNumber: line.batchNumber ?? null,
        warehouseId: destWarehouseId,
        quantity: remainder,
        reservedQuantity: 0,
        unit: String(line.unit),
        status: 'released',
        manufacturingDate: line.manufacturingDate ?? null,
        expiryDate: line.expiryDate ?? null,
        receivedDate: line.manufacturingDate ?? toDbDate(new Date()),
        vendorId: grn?.vendorId ?? null,
        vendorLotNumber: line.vendorLotNumber ?? null,
        sourceGrnLineId: lineId,
        createdAt: getNow(),
        updatedAt: getNow(),
      });
      remainderLotId = Number(getInsertId(lotInsert));
    }

    // Update line — record the counted total and link the remainder lot.
    await db
      .update(t.lines)
      .set({
        status: 'released_to_stock',
        actualQuantity,
        inventoryLotId: remainderLotId,
        qaSignatureId: signatureId,
        qaDecisionAt: getNow(),
        updatedAt: getNow(),
      })
      .where(eq(t.lines.id, lineId));

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
        // Column is `type`, not `deviationType` — wrong key threw + was swallowed,
        // so rejecting an incoming receipt never created its deviation.
        type: 'incoming_inspection',
        sourceType: 'warehouse',
        sourceId: Number(line.id),
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
