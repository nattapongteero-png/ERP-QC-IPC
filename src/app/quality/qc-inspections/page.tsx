'use client';
/**
 * QC Inspection — Audit Q5
 * QA-side inspection form independent of production BOM. Each row may
 * link to a Work Order to expose its eBMR (read-only).
 *
 * Single-page UX (Audit Q2) — no router.push to /new. Add/edit happens
 * in inline DxPopup dialogs.
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { DxButton } from '@/components/ui/dx-button';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { Badge } from '@/components/ui/badge';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { AttachmentPanel } from '@/components/shared/AttachmentPanel';
import { useToast } from '@/hooks/use-toast';
import { useErrorTranslator } from '@/lib/i18n/use-error-translator';
import { ClipboardList, CheckCircle2, XCircle, Clock, ExternalLink } from 'lucide-react';
import {
  type WorkOrderLite,
  isWoLinkEnabled,
  filterWorkOrders,
  woOptionLabel,
} from '@/lib/quality/qc-wo-filter';

interface InspectionRow {
  id: number;
  inspectionNumber: string;
  workOrderId: number | null;
  workOrderNumber: string | null;
  batchNumber: string | null;
  inspectionType: 'incoming' | 'in_process' | 'finished' | 'ad_hoc';
  subject: string;
  findings: string | null;
  overallResult: 'pending' | 'pass' | 'fail';
  inspectorId: number;
  inspectorName: string | null;
  inspectedAt: string;
  notes: string | null;
}

type TFunc = (key: string) => string;

const typeLabel = (t: TFunc, type: string) =>
  ({
    incoming: t('qcInspections.types.incoming'),
    in_process: t('qcInspections.types.inProcess'),
    finished: t('qcInspections.types.finished'),
    ad_hoc: t('qcInspections.types.adHoc'),
  })[type] || type;

const resultBadge = (t: TFunc, r: string) => {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: t('qcInspections.results.pending'), cls: 'bg-amber-100 text-amber-700' },
    pass: { label: `✓ ${t('qcInspections.results.pass')}`, cls: 'bg-emerald-100 text-emerald-700' },
    fail: { label: `✗ ${t('qcInspections.results.fail')}`, cls: 'bg-red-100 text-red-700' },
  };
  const m = map[r] || map.pending;
  return <Badge className={m.cls}>{m.label}</Badge>;
};

export default function QcInspectionsPage() {
  const toast = useToast();
  const translateError = useErrorTranslator();
  const t = useTranslations('quality');
  const [rows, setRows] = useState<InspectionRow[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrderLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string | null>(null);

  // Add dialog
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    inspectionType: 'incoming' as 'incoming' | 'in_process' | 'finished' | 'ad_hoc',
    workOrderId: null as number | null,
    batchNumber: '',
    subject: '',
    findings: '',
    overallResult: 'pending' as 'pending' | 'pass' | 'fail',
    notes: '',
  });

  // Detail dialog
  const [detail, setDetail] = useState<InspectionRow | null>(null);

  const loadRows = async () => {
    setLoading(true);
    try {
      const qs = filterType ? `?inspectionType=${filterType}` : '';
      const [res, woRes] = await Promise.all([
        fetch(`/api/quality/qc-inspections${qs}`),
        fetch('/api/production/work-orders?limit=200'),
      ]);
      const json = await res.json();
      const woJson = await woRes.json();
      setRows(json?.data || []);
      const woRaw = woJson?.data?.items || woJson?.data || woJson?.items || woJson || [];
      setWorkOrders(
        Array.isArray(woRaw)
          ? woRaw.map((w: any) => ({
              id: w.id,
              woNumber: w.woNumber || w.wo_number || '',
              status: w.status || '',
              productName: w.productName ?? w.product_name ?? null,
              productCode: w.productCode ?? w.product_code ?? null,
              batchNumber: w.batchNumber ?? w.batch_number ?? null,
            }))
          : [],
      );
    } catch (e) {
      toast.error(t('qcInspections.toast.loadFailed'), (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType]);

  // WO options filtered to statuses relevant to the chosen inspection type.
  const woEnabled = isWoLinkEnabled(form.inspectionType);
  const filteredWorkOrders = useMemo(
    () => filterWorkOrders(workOrders, form.inspectionType),
    [workOrders, form.inspectionType],
  );

  const stats = useMemo(
    () => ({
      total: rows.length,
      pending: rows.filter((r) => r.overallResult === 'pending').length,
      pass: rows.filter((r) => r.overallResult === 'pass').length,
      fail: rows.filter((r) => r.overallResult === 'fail').length,
    }),
    [rows],
  );

  // QC inspections are a feed → newest first (top row = #1).
  const numberedRows = useMemo(
    () =>
      [...rows]
        .sort((a, b) => Number(b.id) - Number(a.id))
        .map((item, index) => ({ ...item, _rowNumber: index + 1 })),
    [rows],
  );

  const submit = async () => {
    if (!form.subject.trim()) {
      toast.error(t('qcInspections.toast.subjectRequired'));
      return;
    }
    const res = await fetch('/api/quality/qc-inspections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(t('qcInspections.toast.saveFailed'), translateError(json?.error));
      return;
    }
    toast.success(t('qcInspections.toast.created', { inspectionNumber: json.data.inspectionNumber }));
    setShowAdd(false);
    setForm({
      inspectionType: 'incoming',
      workOrderId: null,
      batchNumber: '',
      subject: '',
      findings: '',
      overallResult: 'pending',
      notes: '',
    });
    void loadRows();
  };

  const updateDetail = async (overallResult: 'pending' | 'pass' | 'fail') => {
    if (!detail) return;
    const res = await fetch(`/api/quality/qc-inspections/${detail.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        overallResult,
        findings: detail.findings,
        notes: detail.notes,
      }),
    });
    if (!res.ok) {
      const j = await res.json();
      toast.error(t('qcInspections.toast.updateFailed'), translateError(j?.error));
      return;
    }
    toast.success(t('qcInspections.toast.updated'));
    // Close the dialog so the user lands back on the (refreshed) list and can
    // see the updated result in the table — leaving it open looked like nothing
    // happened / the row "disappeared".
    setDetail(null);
    void loadRows();
  };

  const columns: DxDataGridColumn[] = [
    { dataField: '_rowNumber', caption: '#', width: 56, alignment: 'center', allowSorting: false, allowFiltering: false },
    { dataField: 'inspectionNumber', caption: t('qcInspections.columns.number'), width: 140 },
    { dataField: 'inspectedAt', caption: t('qcInspections.columns.date'), dataType: 'datetime', width: 150 },
    {
      dataField: 'inspectionType',
      caption: t('qcInspections.columns.type'),
      width: 120,
      cellRender: (c: any) => typeLabel(t, c.value),
    },
    { dataField: 'subject', caption: t('qcInspections.columns.subject') },
    {
      dataField: 'workOrderNumber',
      caption: 'WO / eBMR',
      width: 160,
      cellRender: (c: any) =>
        c.data.workOrderId ? (
          <Link
            href={`/production/work-orders/${c.data.workOrderId}`}
            target="_blank"
            className="text-blue-700 underline flex items-center gap-1 text-xs"
            data-testid={`view-ebmr-${c.data.id}`}
          >
            {c.value || `WO#${c.data.workOrderId}`}
            <ExternalLink className="w-3 h-3" />
          </Link>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        ),
    },
    {
      dataField: 'overallResult',
      caption: t('qcInspections.columns.result'),
      width: 110,
      cellRender: (c: any) => resultBadge(t, c.value),
    },
    { dataField: 'inspectorName', caption: t('qcInspections.columns.inspector'), width: 130 },
    {
      caption: t('qcInspections.columns.action'),
      width: 170,
      alignment: 'center',
      cellRender: (c: any) => (
        <button
          className="px-3 py-1 text-xs font-medium rounded border border-emerald-600 text-emerald-700 hover:bg-emerald-50 whitespace-nowrap"
          onClick={() => setDetail(c.data as InspectionRow)}
          data-testid={`open-detail-${c.data.id}`}
        >
          {t('qcInspections.detailButton')}
        </button>
      ),
    },
  ];

  return (
      <div className="space-y-4 p-4">
        <ResponsivePageHeader
          title={t('qcInspections.title')}
          subtitle={t('qcInspections.subtitle')}
          actions={
            <DxButton
              text={t('qcInspections.addInspection')}
              type="default"
              onClick={() => setShowAdd(true)}
              data-testid="qc-inspection-add"
            />
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label={t('qcInspections.stats.total')} value={stats.total} icon={ClipboardList} />
          <StatCard label={t('qcInspections.stats.pending')} value={stats.pending} icon={Clock} iconColor="text-amber-500" />
          <StatCard label={t('qcInspections.stats.pass')} value={stats.pass} icon={CheckCircle2} iconColor="text-emerald-500" />
          <StatCard label={t('qcInspections.stats.fail')} value={stats.fail} icon={XCircle} iconColor="text-red-500" />
        </div>

        <div className="flex items-center gap-3 bg-white border rounded-lg p-3">
          <DxSelectBox
            placeholder={t('qcInspections.typePlaceholder')}
            dataSource={[
              { id: null, name: t('qcInspections.types.all') },
              { id: 'incoming', name: t('qcInspections.types.incoming') },
              { id: 'in_process', name: t('qcInspections.types.inProcess') },
              { id: 'finished', name: t('qcInspections.types.finished') },
              { id: 'ad_hoc', name: t('qcInspections.types.adHoc') },
            ]}
            valueExpr="id"
            displayExpr="name"
            value={filterType}
            onValueChanged={(e) => setFilterType(e.value)}
            width={200}
          />
        </div>

        <div className="bg-white rounded-lg border overflow-hidden">
          <DxDataGrid
            dataSource={numberedRows}
            keyExpr="id"
            columns={columns}
            data-testid="qc-inspections-grid"
          />
        </div>

        {/* Add dialog */}
        <DxPopup
          visible={showAdd}
          onHiding={() => setShowAdd(false)}
          title={t('qcInspections.addDialog.title')}
          width={600}
          height="auto"
          showCloseButton
        >
          <div className="space-y-3 p-2">
            <DxSelectBox
              placeholder={t('qcInspections.addDialog.typePlaceholder')}
              dataSource={[
                { id: 'incoming', name: t('qcInspections.types.incoming') },
                { id: 'in_process', name: t('qcInspections.types.inProcess') },
                { id: 'finished', name: t('qcInspections.types.finished') },
                { id: 'ad_hoc', name: t('qcInspections.types.adHoc') },
              ]}
              valueExpr="id"
              displayExpr="name"
              value={form.inspectionType}
              onValueChanged={(e) =>
                // Reset WO link when type changes — an old WO may not be valid
                // for the new type's status filter.
                setForm({ ...form, inspectionType: e.value, workOrderId: null })
              }
              data-testid="qc-inspection-type"
            />
            {woEnabled ? (
              <DxSelectBox
                placeholder={
                  form.inspectionType === 'finished'
                    ? t('qcInspections.addDialog.woPlaceholderFinished')
                    : form.inspectionType === 'in_process'
                      ? t('qcInspections.addDialog.woPlaceholderInProcess')
                      : t('qcInspections.addDialog.woPlaceholderDefault')
                }
                dataSource={[
                  { id: null as number | null, name: t('qcInspections.addDialog.woNone') },
                  ...filteredWorkOrders.map((w) => ({
                    id: w.id as number | null,
                    name: woOptionLabel(w),
                  })),
                ]}
                valueExpr="id"
                displayExpr="name"
                value={form.workOrderId}
                onValueChanged={(e) => setForm({ ...form, workOrderId: e.value })}
                data-testid="qc-inspection-wo"
                searchEnabled
                noDataText={
                  form.inspectionType === 'finished'
                    ? t('qcInspections.addDialog.woNoDataFinished')
                    : t('qcInspections.addDialog.woNoDataInProcess')
                }
              />
            ) : (
              <div className="text-xs text-gray-500 bg-gray-50 border rounded px-3 py-2">
                {t('qcInspections.addDialog.incomingNote')}
              </div>
            )}
            <DxTextBox
              placeholder={
                form.inspectionType === 'incoming'
                  ? t('qcInspections.addDialog.batchPlaceholderIncoming')
                  : t('qcInspections.addDialog.batchPlaceholderDefault')
              }
              value={form.batchNumber}
              onValueChanged={(e) => setForm({ ...form, batchNumber: e.value || '' })}
              data-testid="qc-inspection-batch"
            />
            <DxTextBox
              placeholder={t('qcInspections.addDialog.subjectPlaceholder')}
              value={form.subject}
              onValueChanged={(e) => setForm({ ...form, subject: e.value || '' })}
              data-testid="qc-inspection-subject"
            />
            <DxTextArea
              placeholder={t('qcInspections.addDialog.findingsPlaceholder')}
              value={form.findings}
              onValueChanged={(e) => setForm({ ...form, findings: e.value || '' })}
              height={100}
            />
            <DxSelectBox
              placeholder={t('qcInspections.addDialog.overallResultPlaceholder')}
              dataSource={[
                { id: 'pending', name: t('qcInspections.results.pending') },
                { id: 'pass', name: `✓ ${t('qcInspections.results.pass')}` },
                { id: 'fail', name: `✗ ${t('qcInspections.results.fail')}` },
              ]}
              valueExpr="id"
              displayExpr="name"
              value={form.overallResult}
              onValueChanged={(e) => setForm({ ...form, overallResult: e.value })}
            />
            <DxTextArea
              placeholder={t('qcInspections.addDialog.notesPlaceholder')}
              value={form.notes}
              onValueChanged={(e) => setForm({ ...form, notes: e.value || '' })}
              height={60}
            />
            <div className="flex justify-end gap-2 pt-2">
              <DxButton text={t('qcInspections.actions.cancel')} onClick={() => setShowAdd(false)} />
              <DxButton
                text={t('qcInspections.actions.save')}
                type="success"
                onClick={submit}
                data-testid="qc-inspection-submit"
              />
            </div>
          </div>
        </DxPopup>

        {/* Detail dialog — use contentRender so DevExtreme portals the body
            into the popup content area. Passing dynamic children directly (with
            deferRendering=false) rendered an empty popup with the form leaking
            onto the page (DevExpress T1064246). */}
        <DxPopup
          visible={!!detail}
          onHiding={() => setDetail(null)}
          title={detail ? detail.inspectionNumber : ''}
          width={760}
          height="80vh"
          showCloseButton
          contentRender={() =>
            detail ? (
            <div className="space-y-3 p-2 h-full overflow-y-auto">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">{t('qcInspections.detail.type')}:</span> {typeLabel(t, detail.inspectionType)}
                </div>
                <div>
                  <span className="text-gray-500">{t('qcInspections.detail.inspector')}:</span> {detail.inspectorName || '—'}
                </div>
                <div>
                  <span className="text-gray-500">{t('qcInspections.detail.date')}:</span>{' '}
                  {new Date(detail.inspectedAt).toLocaleString('th-TH')}
                </div>
                <div>
                  <span className="text-gray-500">{t('qcInspections.detail.result')}:</span> {resultBadge(t, detail.overallResult)}
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500">{t('qcInspections.detail.subject')}:</span> {detail.subject}
                </div>
                {!detail.workOrderId && detail.batchNumber && (
                  <div className="col-span-2">
                    <span className="text-gray-500">{t('qcInspections.detail.batch')}:</span> {detail.batchNumber}
                  </div>
                )}
                {detail.workOrderId && (
                  <div className="col-span-2 bg-blue-50 border border-blue-200 rounded p-2 flex items-center justify-between">
                    <span>
                      {t('qcInspections.detail.linkedWith')} {detail.workOrderNumber || `WO#${detail.workOrderId}`}
                    </span>
                    <Link
                      href={`/production/work-orders/${detail.workOrderId}`}
                      target="_blank"
                      className="text-blue-700 hover:underline text-sm flex items-center gap-1"
                      data-testid="detail-open-ebmr"
                    >
                      {t('qcInspections.detail.openEbmr')} <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">{t('qcInspections.detail.findingsLabel')}</label>
                <DxTextArea
                  value={detail.findings || ''}
                  onValueChanged={(e) => setDetail({ ...detail, findings: e.value || '' })}
                  height={120}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">{t('qcInspections.detail.notesLabel')}</label>
                <DxTextArea
                  value={detail.notes || ''}
                  onValueChanged={(e) => setDetail({ ...detail, notes: e.value || '' })}
                  height={60}
                />
              </div>

              <AttachmentPanel
                moduleName="qc_inspection"
                entityId={detail.id}
                title={t('qcInspections.detail.attachmentsTitle')}
                testIdBase="qc-inspection-attachments"
              />

              <div className="flex justify-end gap-2 pt-2 border-t">
                <DxButton text={t('qcInspections.actions.close')} onClick={() => setDetail(null)} />
                <DxButton
                  text={t('qcInspections.detail.saveFail')}
                  type="danger"
                  onClick={() => updateDetail('fail')}
                  data-testid="qc-inspection-fail"
                />
                <DxButton
                  text={t('qcInspections.detail.savePass')}
                  type="success"
                  onClick={() => updateDetail('pass')}
                  data-testid="qc-inspection-pass"
                />
              </div>
            </div>
            ) : null
          }
        />

        {loading && <div className="text-center text-gray-500 py-4">{t('qcInspections.loading')}</div>}
      </div>
  );
}
