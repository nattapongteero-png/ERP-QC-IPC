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
import { ClipboardList, CheckCircle2, XCircle, Clock, ExternalLink } from 'lucide-react';

interface WorkOrderLite {
  id: number;
  woNumber: string;
}

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

const typeLabel = (t: string) =>
  ({ incoming: 'Incoming', in_process: 'In-process', finished: 'Finished', ad_hoc: 'Ad-hoc' })[t] ||
  t;

const resultBadge = (r: string) => {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: 'รอผล', cls: 'bg-amber-100 text-amber-700' },
    pass: { label: '✓ Pass', cls: 'bg-emerald-100 text-emerald-700' },
    fail: { label: '✗ Fail', cls: 'bg-red-100 text-red-700' },
  };
  const m = map[r] || map.pending;
  return <Badge className={m.cls}>{m.label}</Badge>;
};

export default function QcInspectionsPage() {
  const toast = useToast();
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
          ? woRaw.map((w: any) => ({ id: w.id, woNumber: w.woNumber || w.wo_number || '' }))
          : [],
      );
    } catch (e) {
      toast.error('โหลดข้อมูลไม่สำเร็จ', (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType]);

  const stats = useMemo(
    () => ({
      total: rows.length,
      pending: rows.filter((r) => r.overallResult === 'pending').length,
      pass: rows.filter((r) => r.overallResult === 'pass').length,
      fail: rows.filter((r) => r.overallResult === 'fail').length,
    }),
    [rows],
  );

  const submit = async () => {
    if (!form.subject.trim()) {
      toast.error('กรุณากรอกเรื่องที่ตรวจ');
      return;
    }
    const res = await fetch('/api/quality/qc-inspections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error('บันทึกไม่สำเร็จ', json?.error);
      return;
    }
    toast.success(`สร้างใบตรวจ ${json.data.inspectionNumber}`);
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
      toast.error('อัปเดตไม่สำเร็จ', j?.error);
      return;
    }
    toast.success('อัปเดตผลการตรวจแล้ว');
    setDetail({ ...detail, overallResult });
    void loadRows();
  };

  const columns: DxDataGridColumn[] = [
    { dataField: 'inspectionNumber', caption: 'เลขที่', width: 140 },
    { dataField: 'inspectedAt', caption: 'วันที่', dataType: 'datetime', width: 150 },
    {
      dataField: 'inspectionType',
      caption: 'ประเภท',
      width: 120,
      cellRender: (c: any) => typeLabel(c.value),
    },
    { dataField: 'subject', caption: 'เรื่อง' },
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
      caption: 'ผล',
      width: 110,
      cellRender: (c: any) => resultBadge(c.value),
    },
    { dataField: 'inspectorName', caption: 'ผู้ตรวจ', width: 130 },
    {
      caption: '',
      width: 80,
      cellRender: (c: any) => (
        <button
          className="text-xs text-blue-700 hover:underline"
          onClick={() => setDetail(c.data as InspectionRow)}
          data-testid={`open-detail-${c.data.id}`}
        >
          เปิด
        </button>
      ),
    },
  ];

  return (
      <div className="space-y-4 p-4">
        <ResponsivePageHeader
          title="QC Inspection (อิสระจาก BOM)"
          subtitle="แบบบันทึกการตรวจคุณภาพของฝ่าย QC — สามารถดู eBMR ของฝ่ายผลิตได้"
          actions={
            <DxButton
              text="+ ใบตรวจใหม่"
              type="default"
              onClick={() => setShowAdd(true)}
              data-testid="qc-inspection-add"
            />
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="ทั้งหมด" value={stats.total} icon={ClipboardList} />
          <StatCard label="รอผล" value={stats.pending} icon={Clock} iconColor="text-amber-500" />
          <StatCard label="Pass" value={stats.pass} icon={CheckCircle2} iconColor="text-emerald-500" />
          <StatCard label="Fail" value={stats.fail} icon={XCircle} iconColor="text-red-500" />
        </div>

        <div className="flex items-center gap-3 bg-white border rounded-lg p-3">
          <DxSelectBox
            placeholder="ประเภท..."
            dataSource={[
              { id: null, name: 'ทุกประเภท' },
              { id: 'incoming', name: 'Incoming' },
              { id: 'in_process', name: 'In-process' },
              { id: 'finished', name: 'Finished' },
              { id: 'ad_hoc', name: 'Ad-hoc' },
            ]}
            valueExpr="id"
            displayExpr="name"
            value={filterType}
            onValueChanged={(e) => setFilterType(e.value)}
            width={200}
          />
        </div>

        <div className="bg-white rounded-lg border">
          <DxDataGrid
            dataSource={rows}
            keyExpr="id"
            columns={columns}
            data-testid="qc-inspections-grid"
          />
        </div>

        {/* Add dialog */}
        <DxPopup
          visible={showAdd}
          onHiding={() => setShowAdd(false)}
          title="ใบตรวจใหม่"
          width={600}
          height="auto"
          showCloseButton
        >
          <div className="space-y-3 p-2">
            <DxSelectBox
              placeholder="ประเภทการตรวจ *"
              dataSource={[
                { id: 'incoming', name: 'Incoming (ตรวจรับ)' },
                { id: 'in_process', name: 'In-process (ระหว่างผลิต)' },
                { id: 'finished', name: 'Finished (สำเร็จรูป)' },
                { id: 'ad_hoc', name: 'Ad-hoc (ทั่วไป)' },
              ]}
              valueExpr="id"
              displayExpr="name"
              value={form.inspectionType}
              onValueChanged={(e) => setForm({ ...form, inspectionType: e.value })}
              data-testid="qc-inspection-type"
            />
            <DxSelectBox
              placeholder="Work Order (เลือกถ้ามี — จะสามารถเปิด eBMR ได้)"
              dataSource={[
                { id: null as number | null, name: '— ไม่ระบุ WO —' },
                ...workOrders.map((w) => ({ id: w.id as number | null, name: w.woNumber })),
              ]}
              valueExpr="id"
              displayExpr="name"
              value={form.workOrderId}
              onValueChanged={(e) => setForm({ ...form, workOrderId: e.value })}
              data-testid="qc-inspection-wo"
              searchEnabled
            />
            <DxTextBox
              placeholder="Batch number (กรอกได้ถ้าไม่มี WO)"
              value={form.batchNumber}
              onValueChanged={(e) => setForm({ ...form, batchNumber: e.value || '' })}
            />
            <DxTextBox
              placeholder="เรื่องที่ตรวจ *"
              value={form.subject}
              onValueChanged={(e) => setForm({ ...form, subject: e.value || '' })}
              data-testid="qc-inspection-subject"
            />
            <DxTextArea
              placeholder="Findings / ผลที่พบ"
              value={form.findings}
              onValueChanged={(e) => setForm({ ...form, findings: e.value || '' })}
              height={100}
            />
            <DxSelectBox
              placeholder="ผลโดยรวม"
              dataSource={[
                { id: 'pending', name: 'รอผล' },
                { id: 'pass', name: '✓ Pass' },
                { id: 'fail', name: '✗ Fail' },
              ]}
              valueExpr="id"
              displayExpr="name"
              value={form.overallResult}
              onValueChanged={(e) => setForm({ ...form, overallResult: e.value })}
            />
            <DxTextArea
              placeholder="หมายเหตุ"
              value={form.notes}
              onValueChanged={(e) => setForm({ ...form, notes: e.value || '' })}
              height={60}
            />
            <div className="flex justify-end gap-2 pt-2">
              <DxButton text="ยกเลิก" onClick={() => setShowAdd(false)} />
              <DxButton
                text="บันทึก"
                type="success"
                onClick={submit}
                data-testid="qc-inspection-submit"
              />
            </div>
          </div>
        </DxPopup>

        {/* Detail dialog */}
        <DxPopup
          visible={!!detail}
          onHiding={() => setDetail(null)}
          title={detail ? detail.inspectionNumber : ''}
          width={760}
          height="auto"
          showCloseButton
        >
          {detail && (
            <div className="space-y-3 p-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">ประเภท:</span> {typeLabel(detail.inspectionType)}
                </div>
                <div>
                  <span className="text-gray-500">ผู้ตรวจ:</span> {detail.inspectorName || '—'}
                </div>
                <div>
                  <span className="text-gray-500">วันที่:</span>{' '}
                  {new Date(detail.inspectedAt).toLocaleString('th-TH')}
                </div>
                <div>
                  <span className="text-gray-500">ผล:</span> {resultBadge(detail.overallResult)}
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500">เรื่อง:</span> {detail.subject}
                </div>
                {detail.workOrderId && (
                  <div className="col-span-2 bg-blue-50 border border-blue-200 rounded p-2 flex items-center justify-between">
                    <span>
                      ผูกกับ {detail.workOrderNumber || `WO#${detail.workOrderId}`}
                    </span>
                    <Link
                      href={`/production/work-orders/${detail.workOrderId}`}
                      target="_blank"
                      className="text-blue-700 hover:underline text-sm flex items-center gap-1"
                      data-testid="detail-open-ebmr"
                    >
                      เปิด eBMR ของฝ่ายผลิต <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Findings</label>
                <DxTextArea
                  value={detail.findings || ''}
                  onValueChanged={(e) => setDetail({ ...detail, findings: e.value || '' })}
                  height={120}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">หมายเหตุ</label>
                <DxTextArea
                  value={detail.notes || ''}
                  onValueChanged={(e) => setDetail({ ...detail, notes: e.value || '' })}
                  height={60}
                />
              </div>

              <AttachmentPanel
                moduleName="qc_inspection"
                entityId={detail.id}
                title="เอกสาร / รูปภาพประกอบการตรวจ"
                testIdBase="qc-inspection-attachments"
              />

              <div className="flex justify-end gap-2 pt-2 border-t">
                <DxButton text="ปิด" onClick={() => setDetail(null)} />
                <DxButton
                  text="บันทึกผล Fail"
                  type="danger"
                  onClick={() => updateDetail('fail')}
                  data-testid="qc-inspection-fail"
                />
                <DxButton
                  text="บันทึกผล Pass"
                  type="success"
                  onClick={() => updateDetail('pass')}
                  data-testid="qc-inspection-pass"
                />
              </div>
            </div>
          )}
        </DxPopup>

        {loading && <div className="text-center text-gray-500 py-4">กำลังโหลด...</div>}
      </div>
  );
}
