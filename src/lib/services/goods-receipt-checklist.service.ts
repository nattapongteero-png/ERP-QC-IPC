/**
 * Goods Receipt Checklist Service
 * - Fetch current template per category
 * - Sign checklist (atomic: snapshot + signature + lot creation + QC sample)
 * Feature: 020-goods-receipt
 */
import { eq, and, desc, sql } from 'drizzle-orm';
import { createHash } from 'crypto';
import { executeDbOperation, getTableRef, getInsertId } from '../db/db-helper';
import { getNow, toDbDate } from '../db/date-utils';
import {
  GoodsReceiptError,
  GOODS_RECEIPT_ERROR_CODES,
  type ChecklistCategory,
  type ChecklistItemDefinition,
  type ChecklistTemplate,
  type SignChecklistInput,
} from '@/types/goods-receipt';
import { recomputeHeaderStatus } from './goods-receipt.service';

function getTables() {
  return {
    grns: getTableRef('goodsReceipts'),
    lines: getTableRef('goodsReceiptLines'),
    checklists: getTableRef('goodsReceiptChecklists'),
    templates: getTableRef('receiptChecklistTemplates'),
    inventoryLots: getTableRef('inventoryLots'),
    qcSamples: getTableRef('qcSamples'),
    signatures: getTableRef('electronicSignatures'),
    users: getTableRef('users'),
    items: getTableRef('items'),
  };
}

// ============================================
// Default template seed (used on first call when DB has none)
// ============================================

const DEFAULT_RAW_MATERIAL_ITEMS: ChecklistItemDefinition[] = [
  { id: 1, label: 'Certificate of Analysis (COA) ตรงกับล็อตที่รับ', isMandatory: true, sortOrder: 1 },
  { id: 2, label: 'วันหมดอายุ ≥ Shelf life ขั้นต่ำ', isMandatory: true, sortOrder: 2 },
  { id: 3, label: 'บรรจุภัณฑ์ภายนอกสมบูรณ์ ไม่เสียหาย', isMandatory: true, sortOrder: 3 },
  { id: 4, label: 'น้ำหนัก/จำนวน ±2%', isMandatory: true, sortOrder: 4 },
];

const DEFAULT_FINISHED_GOODS_ITEMS: ChecklistItemDefinition[] = [
  { id: 1, label: 'ฉลากผลิตภัณฑ์ถูกต้อง อ่านได้ชัดเจน', isMandatory: true, sortOrder: 1 },
  { id: 2, label: 'บรรจุภัณฑ์สมบูรณ์ ไม่มีจุดบกพร่อง', isMandatory: true, sortOrder: 2 },
  { id: 3, label: 'น้ำหนักต่อหน่วยอยู่ในเกณฑ์', isMandatory: true, sortOrder: 3 },
  { id: 4, label: 'จำนวนต่อแพ็คตรงตามสเปค', isMandatory: true, sortOrder: 4 },
  { id: 5, label: 'ปริมาณจริงเทียบกับทฤษฎี ±5%', isMandatory: true, sortOrder: 5 },
];

export async function getCurrentTemplate(
  category: ChecklistCategory,
  userIdForAutoSeed: number = 1,
): Promise<ChecklistTemplate> {
  return executeDbOperation(async (db) => {
    const t = getTables();
    const rows = await db
      .select()
      .from(t.templates)
      .where(and(eq(t.templates.category, category), eq(t.templates.isCurrent, true)))
      .orderBy(desc(t.templates.version))
      .limit(1);

    if (rows.length === 0) {
      // Self-seed default v1
      const defaultItems =
        category === 'raw_material' ? DEFAULT_RAW_MATERIAL_ITEMS : DEFAULT_FINISHED_GOODS_ITEMS;
      const ins = await db.insert(t.templates).values({
        category,
        version: 1,
        isCurrent: true,
        itemsJson: JSON.stringify(defaultItems),
        createdByUserId: userIdForAutoSeed,
        createdAt: getNow(),
      });
      const id = getInsertId(ins);
      return {
        id,
        category,
        version: 1,
        isCurrent: true,
        items: defaultItems,
        createdByUserId: userIdForAutoSeed,
        createdAt: String(getNow()),
      };
    }

    const row = rows[0];
    return {
      id: Number(row.id),
      category: row.category as ChecklistCategory,
      version: Number(row.version),
      isCurrent: Boolean(row.isCurrent),
      items: parseItemsJson(row.itemsJson),
      createdByUserId: Number(row.createdByUserId),
      createdAt: String(row.createdAt),
    };
  });
}

function parseItemsJson(raw: unknown): ChecklistItemDefinition[] {
  if (Array.isArray(raw)) return raw as ChecklistItemDefinition[];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

// ============================================
// Sign checklist — atomic flow
// ============================================

export interface SignChecklistResult {
  lineId: number;
  checklistId: number;
  signatureId: number;
  inventoryLotId: number | null;
  qcSampleId: number | null;
  qcSampleCreationFailed: boolean;
}

export async function signChecklist(
  lineId: number,
  input: SignChecklistInput,
  userId: number,
): Promise<SignChecklistResult> {
  return executeDbOperation(async (db) => {
    const t = getTables();

    // Load line + grn
    const lineRows = await db.select().from(t.lines).where(eq(t.lines.id, lineId)).limit(1);
    if (lineRows.length === 0)
      throw new GoodsReceiptError(GOODS_RECEIPT_ERROR_CODES.NOT_FOUND, 'Line not found');
    const line = lineRows[0];

    if (line.status !== 'created')
      throw new GoodsReceiptError(
        GOODS_RECEIPT_ERROR_CODES.INVALID_TRANSITION,
        `Line must be in 'created' status (current: ${line.status})`,
      );

    // QC-first flow: the warehouse count (actualQuantity) is captured later at
    // release. What QC must provide here is the sample quantity it draws into
    // the QC warehouse — required, positive, and not exceeding the expected qty.
    const sampleQuantity = Number(input.sampleQuantity);
    if (!Number.isFinite(sampleQuantity) || sampleQuantity <= 0)
      throw new GoodsReceiptError(
        GOODS_RECEIPT_ERROR_CODES.VARIANCE_NOT_JUSTIFIED,
        'จำนวนที่ QC สุ่มตรวจต้องมากกว่า 0',
      );
    if (line.expectedQuantity != null && sampleQuantity > Number(line.expectedQuantity))
      throw new GoodsReceiptError(
        GOODS_RECEIPT_ERROR_CODES.VARIANCE_NOT_JUSTIFIED,
        'จำนวนที่สุ่มตรวจมากกว่าจำนวนที่คาดว่าจะรับ',
      );

    const grnRows = await db.select().from(t.grns).where(eq(t.grns.id, line.grnId)).limit(1);
    if (grnRows.length === 0)
      throw new GoodsReceiptError(GOODS_RECEIPT_ERROR_CODES.NOT_FOUND, 'GRN not found');
    const grn = grnRows[0];

    const category: ChecklistCategory =
      grn.sourceType === 'wo' ? 'finished_goods' : 'raw_material';

    // Fetch current template
    const template = await getCurrentTemplate(category, userId);

    // Validate every mandatory item is checked + passed
    const itemsById = new Map(template.items.map((it) => [it.id, it]));
    const submittedById = new Map(input.items.map((s) => [s.templateItemId, s]));

    const missing: number[] = [];
    const failed: number[] = [];
    for (const tmpl of template.items) {
      if (!tmpl.isMandatory) continue;
      const sub = submittedById.get(tmpl.id);
      if (!sub) missing.push(tmpl.id);
      else if (!sub.isPass) failed.push(tmpl.id);
    }
    // Every mandatory item must be answered — an incomplete checklist still
    // blocks signing outright.
    if (missing.length > 0)
      throw new GoodsReceiptError(
        GOODS_RECEIPT_ERROR_CODES.CHECKLIST_INCOMPLETE,
        'Checklist incomplete',
        { missingItemIds: missing },
      );
    // A failed mandatory item does NOT abort: the sample is still drawn and the
    // lot recorded, but quarantined so the warehouse cannot release it into
    // RM/FG. (QC fail → ของเข้าคลังแต่ล็อกไว้)
    const checklistFailed = failed.length > 0;

    // User info for signature
    const userRows = await db.select().from(t.users).where(eq(t.users.id, userId)).limit(1);
    if (userRows.length === 0)
      throw new GoodsReceiptError(GOODS_RECEIPT_ERROR_CODES.NOT_FOUND, 'User not found');
    const user = userRows[0];

    // Capture snapshot
    const captured = input.items.map((s) => ({
      templateItemId: s.templateItemId,
      label: itemsById.get(s.templateItemId)?.label ?? '',
      isPass: s.isPass,
      remarks: s.remarks ?? null,
    }));

    // Insert signature
    const sigHash = createHash('sha256')
      .update(`${userId}|${lineId}|${JSON.stringify(captured)}|${Date.now()}`)
      .digest('hex');
    const sigInsert = await db.insert(t.signatures).values({
      entityType: 'goods_receipt_line',
      entityId: lineId,
      action: 'perform',
      userId,
      username: user.username ?? user.email ?? '',
      fullName: user.fullName ?? user.username ?? user.email ?? '',
      title: user.title ?? null,
      signedAt: getNow(),
      meaning: `Receiver verified and signed checklist for GRN line ${lineId}`,
      passwordVerified: Boolean(input.signature.password),
      signatureHash: sigHash,
      ipAddress: null,
      userAgent: null,
      createdAt: getNow(),
    });
    const signatureId = getInsertId(sigInsert);

    // Insert checklist row
    const chkInsert = await db.insert(t.checklists).values({
      lineId,
      templateId: template.id,
      templateVersion: template.version,
      category,
      capturedItemsJson: JSON.stringify(captured),
      signedAt: getNow(),
      signatureId,
      createdAt: getNow(),
    });
    const checklistId = getInsertId(chkInsert);

    // Create the QC-sample lot in the QC warehouse (the "ชั้นวาง/คลังตัวอย่าง
    // QC"). Only the sampled quantity is drawn here; the remainder goes to RM/FG
    // when the warehouse counts and releases. Always quarantine — the sample is
    // awaiting lab results regardless of the checklist pass/fail.
    const itemRow = await db.select().from(t.items).where(eq(t.items.id, line.itemId)).limit(1);
    const lotNumber =
      line.vendorLotNumber ??
      line.batchNumber ??
      `${grn.grnNumber}-L${line.lineNumber}`;

    const { getOrCreateQcWarehouse } = await import('./warehouse-resolver.service');
    const qcWarehouseId = await getOrCreateQcWarehouse(db);

    const qcLotInsert = await db.insert(t.inventoryLots).values({
      itemId: Number(line.itemId),
      lotNumber: `${lotNumber}-QC`,
      batchNumber: line.batchNumber ?? null,
      warehouseId: qcWarehouseId,
      quantity: sampleQuantity,
      reservedQuantity: 0,
      unit: String(line.unit),
      status: 'quarantine',
      manufacturingDate: line.manufacturingDate ?? null,
      expiryDate: line.expiryDate ?? null,
      receivedDate: line.manufacturingDate ?? toDbDate(new Date()),
      vendorId: grn.vendorId ?? null,
      vendorLotNumber: line.vendorLotNumber ?? null,
      sourceGrnLineId: lineId,
      createdAt: getNow(),
      updatedAt: getNow(),
    });
    const qcLotId = getInsertId(qcLotInsert);
    // The remainder lot (RM/FG) is created later at release.
    const inventoryLotId: number | null = null;
    const actualQty = sampleQuantity;

    // Create QC sample
    let qcSampleId: number | null = null;
    let qcSampleCreationFailed = false;
    let createdSampleNumber: string | null = null;
    try {
      const sampleNumber = await generateQcSampleNumber(db);
      createdSampleNumber = sampleNumber;
      const flagForQc = !itemRow[0]?.defaultTestPanelId;

      const qcInsert = await db.insert(t.qcSamples).values({
        sampleNumber,
        sourceType: category === 'raw_material' ? 'raw_material_lot' : 'work_order_batch',
        sourceRefId: qcLotId,
        sourceRefText: `GRN ${grn.grnNumber} line ${line.lineNumber}`,
        productId: Number(line.itemId),
        lotNumber,
        manufactureDate: line.manufacturingDate ?? null,
        expiryDate: line.expiryDate ?? null,
        quantityReceived: actualQty,
        unit: String(line.unit),
        receivedDate: getNow(),
        receivedBy: userId,
        status: 'registered',
        sourceGrnLineId: lineId,
        flagForQcManager: flagForQc,
        createdAt: getNow(),
        updatedAt: getNow(),
      });
      qcSampleId = getInsertId(qcInsert);
    } catch (err) {
      qcSampleCreationFailed = true;
      console.warn('[goods-receipt] QC sample creation failed', err);
    }

    // Line status after signing:
    //  - mandatory item failed  → 'checklist_done' (quarantined, blocks release)
    //  - QC sample failed to create → 'checklist_done' (blocks release too)
    //  - all passed → 'qc_pending' (awaiting lab test result — the warehouse
    //    can only release once the linked qc_sample is approved/released; that
    //    propagation flips the line to 'qc_approved'. See
    //    qc-sample.service.updateSampleStatus → syncGrnLineFromSample.)
    const newStatus =
      checklistFailed || qcSampleCreationFailed ? 'checklist_done' : 'qc_pending';
    await db
      .update(t.lines)
      .set({
        status: newStatus,
        receiverSignatureId: signatureId,
        // The RM/FG remainder lot is created at release; only the QC sample lot
        // exists now.
        inventoryLotId,
        qcLotId,
        sampleQuantity,
        qcSampleId,
        qcSampleCreationFailed,
        updatedAt: getNow(),
      })
      .where(eq(t.lines.id, lineId));

    // The QC sample quantity is now whatever QC drew (sampleQuantity), already
    // materialised as the QC-warehouse lot above — no separate sampling-plan
    // draw. Record it on the qcSample so the lab sees the on-hand sample qty.
    if (qcSampleId) {
      try {
        await db
          .update(t.qcSamples)
          .set({ sourceLotId: qcLotId, sampleQty: sampleQuantity, updatedAt: getNow() })
          .where(eq(t.qcSamples.id, qcSampleId));
      } catch (err) {
        console.warn('[goods-receipt] QC sample qty update failed (non-fatal)', err);
      }
    }

    // Recompute header
    await recomputeHeaderStatus(Number(line.grnId));

    // QC Flow item 7 — notify QC that a lot was received via GRN and needs
    // sampling/testing. Best-effort: never fail the receipt on notify error.
    try {
      const { notifyLotReceived } = await import('./qc-notification.service');
      await notifyLotReceived({
        lotId: qcLotId,
        lotNumber,
        itemCode: (itemRow[0]?.code as string | null) ?? null,
        itemName: (itemRow[0]?.nameTh as string | null) ?? null,
        quantity: actualQty,
        unit: String(line.unit),
        warehouseName: null,
      });
    } catch (err) {
      console.warn('[goods-receipt] lot-received notification failed (non-fatal)', err);
    }

    return {
      lineId,
      checklistId,
      signatureId,
      inventoryLotId,
      qcSampleId,
      qcSampleCreationFailed,
    };
  });
}

async function generateQcSampleNumber(db: any): Promise<string> {
  const year = new Date().getFullYear();
  const t = getTables();
  const recent = await db
    .select({ sampleNumber: t.qcSamples.sampleNumber })
    .from(t.qcSamples)
    .where(sql`${t.qcSamples.sampleNumber} LIKE ${`QC-${year}-%`}`)
    .orderBy(desc(t.qcSamples.id))
    .limit(1);

  const next = recent.length > 0
    ? Number(String(recent[0].sampleNumber).split('-')[2]) + 1
    : 1;
  return `QC-${year}-${String(next).padStart(4, '0')}`;
}

// ============================================
// List templates (admin)
// ============================================

export async function listTemplates(
  category?: ChecklistCategory,
  includeHistorical = false,
): Promise<ChecklistTemplate[]> {
  return executeDbOperation(async (db) => {
    const t = getTables();
    const conds: any[] = [];
    if (category) conds.push(eq(t.templates.category, category));
    if (!includeHistorical) conds.push(eq(t.templates.isCurrent, true));

    const rows = await db
      .select()
      .from(t.templates)
      .where(conds.length > 0 ? and(...conds) : undefined)
      .orderBy(desc(t.templates.version));

    return rows.map((r: any) => ({
      id: Number(r.id),
      category: r.category as ChecklistCategory,
      version: Number(r.version),
      isCurrent: Boolean(r.isCurrent),
      items: parseItemsJson(r.itemsJson),
      createdByUserId: Number(r.createdByUserId),
      createdAt: String(r.createdAt),
    }));
  });
}

// ============================================
// Create new template version (admin)
// ============================================

export async function createTemplateVersion(
  category: ChecklistCategory,
  items: Array<{ label: string; isMandatory: boolean; sortOrder: number }>,
  userId: number,
): Promise<ChecklistTemplate> {
  return executeDbOperation(async (db) => {
    const t = getTables();

    // Get max version
    const max = await db
      .select({ v: sql<number>`MAX(${t.templates.version})` })
      .from(t.templates)
      .where(eq(t.templates.category, category));
    const nextVersion = Number(max[0]?.v ?? 0) + 1;

    // Mark previous as non-current
    await db
      .update(t.templates)
      .set({ isCurrent: false })
      .where(and(eq(t.templates.category, category), eq(t.templates.isCurrent, true)));

    const itemsWithIds: ChecklistItemDefinition[] = items.map((it, idx) => ({
      id: idx + 1,
      label: it.label,
      isMandatory: it.isMandatory,
      sortOrder: it.sortOrder,
    }));

    const ins = await db.insert(t.templates).values({
      category,
      version: nextVersion,
      isCurrent: true,
      itemsJson: JSON.stringify(itemsWithIds),
      createdByUserId: userId,
      createdAt: getNow(),
    });
    const id = getInsertId(ins);

    return {
      id,
      category,
      version: nextVersion,
      isCurrent: true,
      items: itemsWithIds,
      createdByUserId: userId,
      createdAt: String(getNow()),
    };
  });
}
