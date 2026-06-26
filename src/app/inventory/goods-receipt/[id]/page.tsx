'use client';

/**
 * Goods Receipt — Detail (lines + checklist sign + QA actions)
 * Feature: 020-goods-receipt
 */
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  DataGrid,
  Column,
  Paging,
} from 'devextreme-react/data-grid';
import { Button } from 'devextreme-react/button';
import { Popup } from 'devextreme-react/popup';
import { TextArea } from 'devextreme-react/text-area';
import { CheckBox } from 'devextreme-react/check-box';
import {
  ClipboardCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Pencil,
  Trash2,
} from 'lucide-react';
import { StatusStepper } from '@/components/shared';
import type {
  GoodsReceipt,
  GoodsReceiptLine,
  ChecklistTemplate,
} from '@/types/goods-receipt';

/**
 * Pharmacopoeial √n+1 sampling plan — the default QC sample size to draw from
 * a received lot of size `n`: ⌈√n + 1⌉, never more than the lot itself.
 * Returns 0 for an empty/zero lot.
 */
function sqrtSamplePlan(lotQty: number | null | undefined): number {
  const n = Number(lotQty);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(n, Math.ceil(Math.sqrt(n) + 1));
}

export default function GrnDetailPage() {
  const params = useParams<{ id: string }>();
  const grnId = Number(params.id);
  const router = useRouter();
  const qc = useQueryClient();
  const t = useTranslations('goodsReceipt');

  const [activeLineId, setActiveLineId] = useState<number | null>(null);
  const [checklistOpen, setChecklistOpen] = useState(false);
  // Edit-line popup: the line currently being edited + its draft field values.
  // Replaces the old DevExtreme inline row-edit (cramped per-cell inputs) with a
  // proper form the user fills in and saves.
  const [editLine, setEditLine] = useState<GoodsReceiptLine | null>(null);
  const [editForm, setEditForm] = useState<{
    actualQuantity: string;
    vendorLotNumber: string;
    batchNumber: string;
    manufacturingDate: string;
    expiryDate: string;
    varianceReason: string;
  }>({
    actualQuantity: '',
    vendorLotNumber: '',
    batchNumber: '',
    manufacturingDate: '',
    expiryDate: '',
    varianceReason: '',
  });
  const [qaActionOpen, setQaActionOpen] = useState<{ lineId: number; action: 'release' | 'reject' } | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [sigPassword, setSigPassword] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Local state for current checklist editing
  const [checklistAnswers, setChecklistAnswers] = useState<Record<number, { isPass: boolean; remarks?: string }>>({});
  // QC-first flow:
  //  - sample qty: how much QC draws into the QC warehouse (set at checklist sign)
  //  - release qty: total the warehouse counts at release (remainder → RM/FG)
  const [checklistSampleQty, setChecklistSampleQty] = useState<string>('');
  const [releaseActualQty, setReleaseActualQty] = useState<string>('');

  // GRN data
  const { data, refetch } = useQuery<{ grn: GoodsReceipt; lines: GoodsReceiptLine[] }>({
    queryKey: ['grn-detail', grnId],
    queryFn: async () => {
      const res = await fetch(`/api/inventory/goods-receipts/${grnId}`);
      if (!res.ok) throw new Error('Failed to load');
      return res.json();
    },
    enabled: !!grnId,
  });

  const category = data?.grn.sourceType === 'wo' ? 'finished_goods' : 'raw_material';

  // Current user's permissions — gate the per-role actions:
  //  - QC records/signs the incoming checklist (and rejects)
  //  - the warehouse releases QC-approved lines into stock
  const { data: session } = useQuery<{ permissions: string[]; role: string }>({
    queryKey: ['auth-session'],
    queryFn: async () => {
      const res = await fetch('/api/auth/session');
      const j = await res.json();
      return {
        permissions: (j?.data?.user?.permissions as string[]) ?? [],
        role: String(j?.data?.user?.role ?? ''),
      };
    },
  });
  const isAdmin = (session?.role ?? '').toLowerCase() === 'admin';
  const canChecklist = isAdmin || (session?.permissions ?? []).includes('quality:incoming:approve');
  const canRelease = isAdmin || (session?.permissions ?? []).includes('inventory:goods_receipt:receive');

  // Current checklist template
  const { data: template } = useQuery<ChecklistTemplate[]>({
    queryKey: ['grn-template', category],
    queryFn: async () => {
      const res = await fetch(`/api/master-data/receipt-checklist-templates?category=${category}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!category,
  });

  const currentTemplate: ChecklistTemplate | undefined = template?.[0];

  // Mutations
  const updateLineMut = useMutation({
    mutationFn: async ({ lineId, patch }: { lineId: number; patch: Partial<GoodsReceiptLine> }) => {
      const res = await fetch(`/api/inventory/goods-receipts/${grnId}/lines/${lineId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? 'Update failed');
      return body;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['grn-detail', grnId] });
      setEditLine(null);
    },
  });

  // Open the edit popup for a line, pre-filling the form with its current values.
  // Dates come from the DB as YYYY-MM-DD strings (or with a time part) — slice to
  // the date portion so the native date input accepts them.
  function openEditLine(line: GoodsReceiptLine) {
    setEditLine(line);
    setEditForm({
      actualQuantity: line.actualQuantity != null ? String(line.actualQuantity) : '',
      vendorLotNumber: line.vendorLotNumber ?? '',
      batchNumber: line.batchNumber ?? '',
      manufacturingDate: line.manufacturingDate ? String(line.manufacturingDate).slice(0, 10) : '',
      expiryDate: line.expiryDate ? String(line.expiryDate).slice(0, 10) : '',
      varianceReason: line.varianceReason ?? '',
    });
  }

  // Save the edit form → PATCH the line. Empty optional fields are sent as null
  // so the user can clear a value; actualQuantity is only sent when numeric.
  function saveEditLine() {
    if (!editLine) return;
    const qtyTrim = editForm.actualQuantity.trim();
    const qtyNum = Number(qtyTrim);
    const patch: Partial<GoodsReceiptLine> = {
      vendorLotNumber: editForm.vendorLotNumber.trim() || null,
      batchNumber: editForm.batchNumber.trim() || null,
      manufacturingDate: editForm.manufacturingDate || null,
      expiryDate: editForm.expiryDate || null,
      varianceReason: editForm.varianceReason.trim() || null,
    };
    if (qtyTrim && Number.isFinite(qtyNum)) {
      patch.actualQuantity = qtyNum;
    }
    updateLineMut.mutate({ lineId: editLine.id, patch });
  }

  const signChecklistMut = useMutation({
    mutationFn: async () => {
      if (!activeLineId || !currentTemplate) throw new Error('Missing data');
      // QC-first flow: QC supplies the quantity it draws as a sample into the
      // QC warehouse. The warehouse counts the total later at release.
      const sampleQty = Number(checklistSampleQty);
      if (!checklistSampleQty.trim() || !Number.isFinite(sampleQty) || sampleQty <= 0) {
        throw new Error('กรุณากรอกจำนวนที่ QC สุ่มตรวจ (มากกว่า 0) ก่อนลงนาม');
      }
      const items = currentTemplate.items.map((tmpl) => ({
        templateItemId: tmpl.id,
        isPass: checklistAnswers[tmpl.id]?.isPass ?? false,
        remarks: checklistAnswers[tmpl.id]?.remarks ?? null,
      }));
      const res = await fetch(`/api/inventory/goods-receipts/${grnId}/lines/${activeLineId}/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          sampleQuantity: sampleQty,
          signature: { password: sigPassword || 'verify' },
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? 'Sign failed');
      return body;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['grn-detail', grnId] });
      qc.invalidateQueries({ queryKey: ['grn-dashboard'] });
      setChecklistOpen(false);
      setChecklistAnswers({});
      setChecklistSampleQty('');
      setSigPassword('');
    },
  });

  const qaActionMut = useMutation({
    mutationFn: async () => {
      if (!qaActionOpen) throw new Error('No action');
      const body: Record<string, unknown> = {
        action: qaActionOpen.action,
        signature: { password: sigPassword || 'verify' },
      };
      if (qaActionOpen.action === 'reject') body.rejectionReason = rejectionReason;
      if (qaActionOpen.action === 'release') {
        const qty = Number(releaseActualQty);
        if (!releaseActualQty.trim() || !Number.isFinite(qty) || qty <= 0) {
          throw new Error('กรุณากรอกจำนวนรวมที่นับได้จริง (มากกว่า 0) ก่อนปล่อยเข้าคลัง');
        }
        body.actualQuantity = qty;
      }
      const res = await fetch(
        `/api/inventory/goods-receipts/${grnId}/lines/${qaActionOpen.lineId}/qa`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      const resBody = await res.json();
      if (!res.ok) throw new Error(resBody?.error ?? 'QA action failed');
      return resBody;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['grn-detail', grnId] });
      qc.invalidateQueries({ queryKey: ['grn-dashboard'] });
      setQaActionOpen(null);
      setRejectionReason('');
      setReleaseActualQty('');
      setSigPassword('');
    },
  });

  // Cancel (void) a GRN that has not been released yet — lines all 'created',
  // nothing has entered stock. Backend (DELETE) enforces creator + 24h window.
  const cancelGrnMut = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/inventory/goods-receipts/${grnId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? 'ยกเลิกใบรับของไม่สำเร็จ');
      return body;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['grn-detail', grnId] });
      qc.invalidateQueries({ queryKey: ['grn-dashboard'] });
      qc.invalidateQueries({ queryKey: ['grn-list'] });
      setCancelOpen(false);
      setCancelReason('');
    },
  });

  if (!data) {
    return <div className="p-6 text-gray-500">กำลังโหลด…</div>;
  }

  const { grn, lines } = data;
  // A GRN can be cancelled only while no line has advanced past 'created'
  // (i.e. nothing has gone to QC sampling / stock) and it isn't already
  // released/rejected/cancelled. Matches the backend cancelGrn() guard.
  const canCancelGrn =
    !['released', 'partially_released', 'rejected', 'cancelled'].includes(grn.status) &&
    lines.length > 0 &&
    lines.every((l) => l.status === 'created');

  return (
    <div className="p-6 space-y-4">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button icon="back" stylingMode="text" onClick={() => router.push('/inventory/goods-receipt')} />
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ClipboardCheck className="w-6 h-6" />
              {grn.grnNumber}
            </h1>
            <div className="text-sm text-gray-500 mt-1">
              {t(`sourceType.${grn.sourceType}`)} • {grn.receivedDate}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex px-3 py-1 rounded text-xs font-medium bg-gray-100">
            {t(`status.header.${grn.status}`)}
          </span>
          {canCancelGrn && (
            <Button
              text={t('actions.cancelGrn')}
              type="danger"
              stylingMode="outlined"
              icon="trash"
              onClick={() => setCancelOpen(true)}
              data-testid="cancel-grn-btn"
            />
          )}
        </div>
      </header>

      {/* Workflow status — สถานะการดำเนินงาน */}
      <StatusStepper
        title="สถานะการดำเนินงาน"
        current={grn.status}
        steps={[
          { key: 'in_progress', label: 'กำลังดำเนินการ' },
          { key: 'released', label: 'ผ่านแล้ว (ปล่อยเข้าคลัง)' },
        ]}
      />

      <DataGrid
        dataSource={lines}
        keyExpr="id"
        showBorders
        showRowLines
        rowAlternationEnabled
        wordWrapEnabled
        width="100%"
        columnResizingMode="widget"
        allowColumnResizing
        data-testid="grn-lines-grid"
      >
        <Paging pageSize={20} />
        <Column dataField="lineNumber" caption="#" width={44} alignment="center" />
        <Column
          dataField="itemCode"
          caption={t('table.columns.item')}
          minWidth={150}
          cellRender={(cell) => (
            <div className="min-w-0">
              <p className="font-medium font-mono">{cell.data.itemCode || `#${cell.data.itemId}`}</p>
              {cell.data.itemName && (
                <p className="text-xs text-gray-500">{cell.data.itemName}</p>
              )}
            </div>
          )}
        />
        <Column
          dataField="expectedQuantity"
          caption={t('table.columns.expectedQty')}
          dataType="number"
          width={80}
        />
        <Column
          dataField="actualQuantity"
          caption={t('table.columns.actualQty')}
          dataType="number"
          width={80}
        />
        <Column dataField="unit" caption="หน่วย" width={60} />
        <Column dataField="vendorLotNumber" caption={t('form.vendorLotNumber.label')} minWidth={90} />
        <Column dataField="batchNumber" caption={t('form.batchNumber.label')} minWidth={90} />
        <Column dataField="manufacturingDate" caption={t('form.manufacturingDate.label')} dataType="date" width={100} />
        <Column dataField="expiryDate" caption={t('form.expiryDate.label')} dataType="date" width={100} />
        <Column
          dataField="variancePercent"
          caption={t('table.columns.variance')}
          width={80}
          cellRender={(c) => {
            const v = c.value as number | null;
            if (v == null) return '—';
            const isWarn = Math.abs(v) > 2;
            return (
              <span className={isWarn ? 'text-rose-600 font-medium' : 'text-gray-700'}>
                {v.toFixed(2)}%
              </span>
            );
          }}
        />
        <Column dataField="varianceReason" caption={t('form.varianceReason.label')} minWidth={90} />
        <Column
          dataField="status"
          caption={t('table.columns.status')}
          width={110}
          cellRender={(c) => (
            <span className="inline-flex px-2 py-1 rounded text-xs bg-gray-100">
              {t(`status.line.${c.value as string}`)}
            </span>
          )}
        />
        <Column
          caption="การดำเนินการ"
          minWidth={140}
          cellRender={(c) => {
            const line = c.data as GoodsReceiptLine;
            return (
              <div className="flex flex-wrap gap-1 items-center">
                {/* Edit the line's actuals — opens a form popup (Save inside).
                    Only while the line is still editable (status=created). */}
                {line.status === 'created' && canRelease && (
                  <Button
                    type="default"
                    stylingMode="outlined"
                    onClick={() => openEditLine(line)}
                    data-testid={`edit-line-${line.id}`}
                  >
                    <span className="flex items-center gap-1">
                      <Pencil className="w-4 h-4" />
                      {t('actions.edit')}
                    </span>
                  </Button>
                )}
                {/* QC records the incoming checklist (warehouse cannot) */}
                {line.status === 'created' && canChecklist && (
                  <Button
                    text={t('actions.signChecklist')}
                    type="default"
                    stylingMode="outlined"
                    onClick={() => {
                      setActiveLineId(line.id);
                      const initial: Record<number, { isPass: boolean; remarks?: string }> = {};
                      (currentTemplate?.items ?? []).forEach((it) => {
                        initial[it.id] = { isPass: false };
                      });
                      setChecklistAnswers(initial);
                      // Pre-fill the QC sample qty with the pharmacopoeial
                      // √n+1 plan (⌈√expectedQty + 1⌉), capped at the line qty.
                      // QC can still override before signing.
                      setChecklistSampleQty(String(sqrtSamplePlan(line.expectedQuantity)));
                      setChecklistOpen(true);
                    }}
                  />
                )}
                {/* Warehouse view of a line still awaiting QC checklist */}
                {line.status === 'created' && !canChecklist && (
                  <span className="text-xs text-amber-600">รอ QC ตรวจ checklist</span>
                )}
                {/* Warehouse releases a QC-approved line into stock */}
                {line.status === 'qc_approved' && canRelease && (
                  <Button
                    text={t('actions.release')}
                    type="success"
                    onClick={() => {
                      // Default the counted-quantity to the expected (received)
                      // quantity so "เข้าคลัง" shows expected − QC sample from the
                      // start; the warehouse can still adjust it to the real count.
                      const exp = Number(line.expectedQuantity);
                      setReleaseActualQty(Number.isFinite(exp) && exp > 0 ? String(exp) : '');
                      setQaActionOpen({ lineId: line.id, action: 'release' });
                    }}
                  />
                )}
                {line.status === 'qc_approved' && !canRelease && (
                  <span className="text-xs text-emerald-600">QC อนุมัติแล้ว — รอคลังปล่อยเข้าคลัง</span>
                )}
                {/* QC may reject an incoming line */}
                {['qc_pending', 'qc_approved', 'checklist_done'].includes(line.status) && canChecklist && (
                  <Button
                    text={t('actions.reject')}
                    type="danger"
                    stylingMode="outlined"
                    onClick={() => setQaActionOpen({ lineId: line.id, action: 'reject' })}
                  />
                )}
              </div>
            );
          }}
        />
      </DataGrid>

      {/* Edit line popup — replaces inline row-edit with a proper save form.
          Also hosts the delete control, which voids the whole GRN (returning the
          PO to the "create GRN" dropdown — see canCancelGrn / cancelGrnMut). */}
      <Popup
        visible={!!editLine}
        onHiding={() => setEditLine(null)}
        showCloseButton
        dragEnabled={false}
        title={`${t('actions.edit')} — ${editLine?.itemCode ?? editLine?.itemName ?? ''}`}
        width={560}
        height="auto"
        data-testid="edit-line-popup"
      >
        <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">{t('form.actualQuantity.label')}</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  name="edit-actual-qty"
                  autoComplete="off"
                  data-lpignore="true"
                  data-form-type="other"
                  min={0}
                  step="any"
                  value={editForm.actualQuantity}
                  onChange={(e) => setEditForm((f) => ({ ...f, actualQuantity: e.target.value }))}
                  className="w-full rounded-[11px] border border-[#D9EFE4] bg-[#FBFEFC] px-3 py-2 text-[#0F2E22] placeholder:text-[#8AA79B] shadow-[0_1px_2px_rgba(6,78,59,0.04)] focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/15"
                  placeholder={t('form.actualQuantity.label')}
                  data-testid="edit-actual-qty"
                />
                <span className="text-sm text-gray-500 whitespace-nowrap">{editLine?.unit}</span>
              </div>
              {editLine && (
                <p className="text-xs text-gray-500 mt-1">
                  {t('table.columns.expectedQty')}: <b>{Number(editLine.expectedQuantity).toLocaleString()}</b> {editLine.unit}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('form.vendorLotNumber.label')}</label>
              <input
                type="text"
                name="edit-vendor-lot"
                autoComplete="off"
                value={editForm.vendorLotNumber}
                onChange={(e) => setEditForm((f) => ({ ...f, vendorLotNumber: e.target.value }))}
                className="w-full rounded-[11px] border border-[#D9EFE4] bg-[#FBFEFC] px-3 py-2 text-[#0F2E22] placeholder:text-[#8AA79B] shadow-[0_1px_2px_rgba(6,78,59,0.04)] focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/15"
                data-testid="edit-vendor-lot"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('form.batchNumber.label')}</label>
              <input
                type="text"
                name="edit-batch"
                autoComplete="off"
                value={editForm.batchNumber}
                onChange={(e) => setEditForm((f) => ({ ...f, batchNumber: e.target.value }))}
                className="w-full rounded-[11px] border border-[#D9EFE4] bg-[#FBFEFC] px-3 py-2 text-[#0F2E22] placeholder:text-[#8AA79B] shadow-[0_1px_2px_rgba(6,78,59,0.04)] focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/15"
                data-testid="edit-batch"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('form.manufacturingDate.label')}</label>
              <input
                type="date"
                name="edit-mfg-date"
                value={editForm.manufacturingDate}
                onChange={(e) => setEditForm((f) => ({ ...f, manufacturingDate: e.target.value }))}
                className="w-full rounded-[11px] border border-[#D9EFE4] bg-[#FBFEFC] px-3 py-2 text-[#0F2E22] shadow-[0_1px_2px_rgba(6,78,59,0.04)] focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/15"
                data-testid="edit-mfg-date"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('form.expiryDate.label')}</label>
              <input
                type="date"
                name="edit-expiry-date"
                value={editForm.expiryDate}
                onChange={(e) => setEditForm((f) => ({ ...f, expiryDate: e.target.value }))}
                className="w-full rounded-[11px] border border-[#D9EFE4] bg-[#FBFEFC] px-3 py-2 text-[#0F2E22] shadow-[0_1px_2px_rgba(6,78,59,0.04)] focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/15"
                data-testid="edit-expiry-date"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">{t('form.varianceReason.label')}</label>
              <TextArea
                value={editForm.varianceReason}
                height={60}
                onValueChanged={(e) => setEditForm((f) => ({ ...f, varianceReason: String(e.value ?? '') }))}
                placeholder={t('form.varianceReason.label')}
                inputAttr={{ autoComplete: 'off', name: 'grn-variance-reason', 'data-lpignore': 'true', 'data-form-type': 'other' }}
              />
            </div>
          </div>

          {updateLineMut.error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-900 rounded p-3 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {String((updateLineMut.error as Error).message)}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-2 border-t">
            {/* Delete the line → voids the GRN so its PO returns to the dropdown.
                Only offered when the GRN as a whole is still cancellable. */}
            {canCancelGrn ? (
              <Button
                type="danger"
                stylingMode="outlined"
                onClick={() => {
                  setEditLine(null);
                  setCancelOpen(true);
                }}
                data-testid="delete-line-btn"
              >
                <span className="flex items-center gap-1">
                  <Trash2 className="w-4 h-4" />
                  {t('actions.cancelGrn')}
                </span>
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button text={t('actions.cancel')} stylingMode="text" onClick={() => setEditLine(null)} />
              <Button
                type="success"
                stylingMode="contained"
                text={t('actions.save')}
                disabled={updateLineMut.isPending}
                onClick={saveEditLine}
                data-testid="save-line-btn"
              />
            </div>
          </div>
        </div>
      </Popup>

      {/* Checklist Popup */}
      <Popup
        visible={checklistOpen}
        onHiding={() => setChecklistOpen(false)}
        showCloseButton
        title={t('checklist.title')}
        width={640}
        height="auto"
      >
        <div className="flex flex-col max-h-[78vh]">
          <div className="p-4 space-y-3 overflow-y-auto flex-1 min-h-0">
          {/* QC sample quantity — how much QC physically draws into the QC
              warehouse for testing. The warehouse counts the remaining total
              and releases it into RM/FG later. */}
          <div className="border rounded p-3 bg-amber-50 border-amber-200">
            <label className="block text-sm font-medium mb-1">
              จำนวนที่ QC สุ่มตรวจ (เข้าคลัง QC) <span className="text-rose-600">*</span>
            </label>
            <input
              type="number"
              inputMode="decimal"
              name="checklist-sample-qty"
              autoComplete="off"
              data-lpignore="true"
              data-form-type="other"
              min={0}
              step="any"
              value={checklistSampleQty}
              onChange={(e) => setChecklistSampleQty(e.target.value)}
              className="w-full rounded-[11px] border border-[#D9EFE4] bg-[#FBFEFC] px-3 py-2 text-[#0F2E22] placeholder:text-[#8AA79B] shadow-[0_1px_2px_rgba(6,78,59,0.04)] focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/15"
              placeholder="กรอกจำนวนที่สุ่มไปตรวจ"
              data-testid="checklist-sample-qty"
            />
            <p className="text-xs text-gray-500 mt-1">
              ระบบจะหักจำนวนนี้เข้าคลังตัวอย่าง QC — ส่วนที่เหลือฝ่ายคลังจะนับและรับเข้าคลังภายหลัง
            </p>
            {(() => {
              const activeLine = (data?.lines ?? []).find((l) => l.id === activeLineId);
              const plan = sqrtSamplePlan(activeLine?.expectedQuantity);
              if (plan <= 0) return null;
              return (
                <p className="text-xs text-amber-700 mt-1">
                  ตั้งต้นตามแผนสุ่ม √n+1 (เภสัชกรรม): จาก {Number(activeLine?.expectedQuantity).toLocaleString()}{' '}
                  {activeLine?.unit} → แนะนำ <strong>{plan}</strong>{' '}
                  <button
                    type="button"
                    className="underline hover:text-amber-900"
                    onClick={() => setChecklistSampleQty(String(plan))}
                  >
                    ใช้ค่านี้
                  </button>
                </p>
              );
            })()}
          </div>
          {(currentTemplate?.items ?? []).map((item) => (
            <div key={item.id} className="border rounded p-3 space-y-2">
              <div className="flex items-center gap-2">
                <CheckBox
                  value={checklistAnswers[item.id]?.isPass ?? false}
                  onValueChanged={(e) =>
                    setChecklistAnswers((prev) => ({
                      ...prev,
                      [item.id]: { ...prev[item.id], isPass: Boolean(e.value) },
                    }))
                  }
                />
                <span className="font-medium">{item.label}</span>
                {item.isMandatory && (
                  <span className="text-xs text-rose-600">* {t('checklist.mandatory')}</span>
                )}
              </div>
              <TextArea
                value={checklistAnswers[item.id]?.remarks ?? ''}
                height={50}
                placeholder={t('checklist.remarks')}
                onValueChanged={(e) =>
                  setChecklistAnswers((prev) => ({
                    ...prev,
                    [item.id]: { ...prev[item.id], remarks: String(e.value ?? '') },
                  }))
                }
                inputAttr={{ autoComplete: 'off', name: `grn-checklist-remarks-${item.id}`, 'data-lpignore': 'true', 'data-form-type': 'other' }}
              />
            </div>
          ))}
          </div>

          {/* Sticky footer — password + sign action stay visible without scrolling */}
          <div className="border-t bg-white p-4 space-y-3 flex-shrink-0">
            <div>
              <label className="block text-sm font-medium mb-1">รหัสผ่าน</label>
              <input
                type="password"
                name="esign-password"
                autoComplete="new-password"
                data-lpignore="true"
                data-form-type="other"
                value={sigPassword}
                onChange={(e) => setSigPassword(e.target.value)}
                className="w-full rounded-[11px] border border-[#D9EFE4] bg-[#FBFEFC] px-3 py-2 text-[#0F2E22] placeholder:text-[#8AA79B] shadow-[0_1px_2px_rgba(6,78,59,0.04)] focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/15"
                placeholder="ลงนามด้วยรหัสผ่านปัจจุบัน"
              />
            </div>

            {signChecklistMut.error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-900 rounded p-3 text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {String((signChecklistMut.error as Error).message)}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button text={t('actions.cancel')} stylingMode="text" onClick={() => setChecklistOpen(false)} />
              <Button
                type="success"
                stylingMode="contained"
                text={t('actions.signChecklist')}
                disabled={
                  signChecklistMut.isPending ||
                  !(Number(checklistSampleQty) > 0)
                }
                onClick={() => signChecklistMut.mutate()}
              />
            </div>
          </div>
        </div>
      </Popup>

      {/* QA action popup */}
      <Popup
        visible={!!qaActionOpen}
        onHiding={() => setQaActionOpen(null)}
        showCloseButton
        title={qaActionOpen?.action === 'release' ? t('actions.release') : t('actions.reject')}
        width={520}
        height="auto"
      >
        <div className="p-4 space-y-3">
          {qaActionOpen?.action === 'release' ? (
            <>
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded p-3 text-emerald-900 text-sm">
                <CheckCircle2 className="w-5 h-5" />
                <span>กดยืนยันเพื่อปล่อยล็อตเข้าสต็อก (Triple Independence enforced)</span>
              </div>
              {(() => {
                const rl = lines.find((l) => l.id === qaActionOpen.lineId);
                const sample = Number(rl?.sampleQuantity ?? 0);
                const total = Number(releaseActualQty);
                const remainder =
                  releaseActualQty.trim() && Number.isFinite(total) ? total - sample : null;
                const tooLow = remainder !== null && remainder < 0;
                return (
                  <div className="border rounded p-3 bg-amber-50 border-amber-200 space-y-2">
                    <label className="block text-sm font-medium">
                      จำนวนรวมที่นับได้จริง <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      name="release-actual-qty"
                      autoComplete="off"
                      data-lpignore="true"
                      data-form-type="other"
                      min={0}
                      step="any"
                      value={releaseActualQty}
                      onChange={(e) => setReleaseActualQty(e.target.value)}
                      className="w-full rounded-[11px] border border-[#D9EFE4] bg-[#FBFEFC] px-3 py-2 text-[#0F2E22] placeholder:text-[#8AA79B] shadow-[0_1px_2px_rgba(6,78,59,0.04)] focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/15"
                      placeholder="กรอกจำนวนรวมที่รับจริง"
                      data-testid="release-actual-qty"
                    />
                    <div className="text-xs text-gray-600 space-y-0.5">
                      <div>QC สุ่มไปแล้ว (เข้าคลัง QC): <b>{sample}</b></div>
                      <div>
                        เข้าคลัง {grn.sourceType === 'wo' ? 'สินค้าสำเร็จรูป' : 'วัตถุดิบ'}:{' '}
                        <b className={tooLow ? 'text-rose-600' : ''}>
                          {remainder === null ? '—' : remainder}
                        </b>
                      </div>
                      {tooLow && (
                        <div className="text-rose-600">
                          จำนวนรวมต้องไม่น้อยกว่าจำนวนที่ QC สุ่มไป ({sample})
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded p-3 text-rose-900 text-sm">
                <XCircle className="w-5 h-5" />
                <span>การปฏิเสธจะสร้าง Deviation อัตโนมัติ</span>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('form.rejectionReason.label')} *
                </label>
                <TextArea
                  value={rejectionReason}
                  height={80}
                  onValueChanged={(e) => setRejectionReason(String(e.value ?? ''))}
                  placeholder="ระบุเหตุผลการปฏิเสธ (อย่างน้อย 10 ตัวอักษร)"
                  inputAttr={{ autoComplete: 'off', name: 'grn-rejection-reason', 'data-lpignore': 'true', 'data-form-type': 'other' }}
                />
              </div>
            </>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">รหัสผ่าน</label>
            <input
              type="password"
              name="esign-password"
              autoComplete="new-password"
              data-lpignore="true"
              value={sigPassword}
              onChange={(e) => setSigPassword(e.target.value)}
              className="w-full rounded-[11px] border border-[#D9EFE4] bg-[#FBFEFC] px-3 py-2 text-[#0F2E22] placeholder:text-[#8AA79B] shadow-[0_1px_2px_rgba(6,78,59,0.04)] focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/15"
              placeholder="ลงนามด้วยรหัสผ่านปัจจุบัน"
            />
          </div>

          {qaActionMut.error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-900 rounded p-3 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {String((qaActionMut.error as Error).message)}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button text={t('actions.cancel')} stylingMode="text" onClick={() => setQaActionOpen(null)} />
            <Button
              type={qaActionOpen?.action === 'release' ? 'success' : 'danger'}
              stylingMode="contained"
              text={qaActionOpen?.action === 'release' ? t('actions.release') : t('actions.reject')}
              disabled={
                qaActionMut.isPending ||
                (qaActionOpen?.action === 'reject' && rejectionReason.length < 10) ||
                (qaActionOpen?.action === 'release' &&
                  (() => {
                    const rl = lines.find((l) => l.id === qaActionOpen.lineId);
                    const sample = Number(rl?.sampleQuantity ?? 0);
                    const total = Number(releaseActualQty);
                    return !releaseActualQty.trim() || !(total > 0) || total < sample;
                  })())
              }
              onClick={() => qaActionMut.mutate()}
            />
          </div>
        </div>
      </Popup>

      {/* Cancel (void) GRN — only when nothing has entered stock */}
      <Popup
        visible={cancelOpen}
        onHiding={() => setCancelOpen(false)}
        dragEnabled={false}
        hideOnOutsideClick
        showTitle
        title={t('actions.cancelGrn')}
        width={460}
        height="auto"
        data-testid="cancel-grn-popup"
      >
        <div className="p-4 space-y-3">
          <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 rounded p-3 text-rose-900 text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{t('cancel.warning')}</span>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              {t('cancel.reasonLabel')} <span className="text-rose-600">*</span>
            </label>
            <TextArea
              value={cancelReason}
              height={80}
              onValueChanged={(e) => setCancelReason(String(e.value ?? ''))}
              placeholder={t('cancel.reasonPlaceholder')}
              inputAttr={{ autoComplete: 'off', name: 'grn-cancel-reason', 'data-lpignore': 'true', 'data-form-type': 'other' }}
            />
          </div>
          {cancelGrnMut.error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-900 rounded p-3 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {(cancelGrnMut.error as Error).message}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button text={t('actions.cancel')} stylingMode="text" onClick={() => setCancelOpen(false)} />
            <Button
              text={t('actions.cancelGrn')}
              type="danger"
              data-testid="confirm-cancel-grn"
              disabled={cancelReason.trim().length < 10 || cancelGrnMut.isPending}
              onClick={() => cancelGrnMut.mutate()}
            />
          </div>
        </div>
      </Popup>
    </div>
  );
}
