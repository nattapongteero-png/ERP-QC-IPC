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
  Editing,
  Paging,
} from 'devextreme-react/data-grid';
import { Button } from 'devextreme-react/button';
import { Popup } from 'devextreme-react/popup';
import { TextArea } from 'devextreme-react/text-area';
import { CheckBox } from 'devextreme-react/check-box';
import {
  ClipboardCheck,
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import type {
  GoodsReceipt,
  GoodsReceiptLine,
  ChecklistTemplate,
} from '@/types/goods-receipt';

export default function GrnDetailPage() {
  const params = useParams<{ id: string }>();
  const grnId = Number(params.id);
  const router = useRouter();
  const qc = useQueryClient();
  const t = useTranslations('goodsReceipt');

  const [activeLineId, setActiveLineId] = useState<number | null>(null);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [qaActionOpen, setQaActionOpen] = useState<{ lineId: number; action: 'release' | 'reject' } | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [sigPassword, setSigPassword] = useState('');

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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['grn-detail', grnId] }),
  });

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

  if (!data) {
    return <div className="p-6 text-gray-500">Loading…</div>;
  }

  const { grn, lines } = data;

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
        <div>
          <span className="inline-flex px-3 py-1 rounded text-xs font-medium bg-gray-100">
            {t(`status.header.${grn.status}`)}
          </span>
        </div>
      </header>

      <DataGrid
        dataSource={lines}
        keyExpr="id"
        showBorders
        showRowLines
        rowAlternationEnabled
        columnAutoWidth
        data-testid="grn-lines-grid"
        onRowUpdating={async (e) => {
          // Only allow when status=created
          const old = e.oldData as GoodsReceiptLine;
          if (old.status !== 'created') {
            e.cancel = true;
            return;
          }
          const patch: Partial<GoodsReceiptLine> = e.newData as Partial<GoodsReceiptLine>;
          await updateLineMut.mutateAsync({ lineId: old.id, patch });
        }}
      >
        <Editing mode="row" allowUpdating useIcons />
        <Paging pageSize={20} />
        <Column dataField="lineNumber" caption="#" width={60} allowEditing={false} />
        <Column dataField="itemId" caption={t('table.columns.item')} allowEditing={false} />
        <Column
          dataField="expectedQuantity"
          caption={t('table.columns.expectedQty')}
          dataType="number"
          allowEditing={false}
          width={120}
        />
        <Column
          dataField="actualQuantity"
          caption={t('table.columns.actualQty')}
          dataType="number"
          width={120}
        />
        <Column dataField="unit" caption="Unit" allowEditing={false} width={80} />
        <Column dataField="vendorLotNumber" caption={t('form.vendorLotNumber.label')} />
        <Column dataField="batchNumber" caption={t('form.batchNumber.label')} />
        <Column dataField="manufacturingDate" caption={t('form.manufacturingDate.label')} dataType="date" />
        <Column dataField="expiryDate" caption={t('form.expiryDate.label')} dataType="date" />
        <Column
          dataField="variancePercent"
          caption={t('table.columns.variance')}
          allowEditing={false}
          width={120}
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
        <Column dataField="varianceReason" caption={t('form.varianceReason.label')} />
        <Column
          dataField="status"
          caption={t('table.columns.status')}
          allowEditing={false}
          width={140}
          cellRender={(c) => (
            <span className="inline-flex px-2 py-1 rounded text-xs bg-gray-100">
              {t(`status.line.${c.value as string}`)}
            </span>
          )}
        />
        <Column
          caption="Actions"
          allowEditing={false}
          width={220}
          cellRender={(c) => {
            const line = c.data as GoodsReceiptLine;
            return (
              <div className="flex gap-1 items-center">
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
                      // QC enters the sample qty fresh each time — no pre-fill.
                      setChecklistSampleQty('');
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
                    onClick={() => setQaActionOpen({ lineId: line.id, action: 'release' })}
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

      {/* Checklist Popup */}
      <Popup
        visible={checklistOpen}
        onHiding={() => setChecklistOpen(false)}
        showCloseButton
        title={t('checklist.title')}
        width={640}
        height="auto"
      >
        <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
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
              className="w-full border rounded px-3 py-2"
              placeholder="กรอกจำนวนที่สุ่มไปตรวจ"
              data-testid="checklist-sample-qty"
            />
            <p className="text-xs text-gray-500 mt-1">
              ระบบจะหักจำนวนนี้เข้าคลังตัวอย่าง QC — ส่วนที่เหลือฝ่ายคลังจะนับและรับเข้าคลังภายหลัง
            </p>
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
              />
            </div>
          ))}

          <div className="border-t pt-3 mt-3">
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              name="esign-password"
              autoComplete="new-password"
              data-lpignore="true"
              value={sigPassword}
              onChange={(e) => setSigPassword(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="Sign with current password"
            />
          </div>

          {signChecklistMut.error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-900 rounded p-3 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {String((signChecklistMut.error as Error).message)}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
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
                      className="w-full border rounded px-3 py-2"
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
                />
              </div>
            </>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              name="esign-password"
              autoComplete="new-password"
              data-lpignore="true"
              value={sigPassword}
              onChange={(e) => setSigPassword(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="Sign with current password"
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
    </div>
  );
}
