'use client';

/**
 * Water Quality — Test Records Registry (ทะเบียนบันทึกผลตรวจน้ำ)
 *
 * The daily-use page: list every recorded water test, record a new one,
 * and view / correct / delete an existing record (edit + delete are
 * audit-logged by the service layer).
 *
 * Master data (systems / sample points / specs) is managed on the separate
 * configuration page: /premises/environmental/water-quality/settings
 */
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { DataGrid, Column, Paging, Pager } from 'devextreme-react/data-grid';
import { Button } from 'devextreme-react/button';
import { Popup } from 'devextreme-react/popup';
import { SelectBox } from 'devextreme-react/select-box';
import { NumberBox } from 'devextreme-react/number-box';
import { TextArea } from 'devextreme-react/text-area';
import { Droplets, Plus, AlertTriangle, Settings, Eye, Pencil, Trash2 } from 'lucide-react';
import { Breadcrumbs, ConfirmationDialog } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import type {
  WaterSamplePoint,
  WaterSystem,
  WaterQualitySpec,
} from '@/types/environmental-monitoring';

interface TestRow {
  id: number;
  performedAt: string;
  samplePointId: number;
  samplePointName: string | null;
  waterSystemId: number;
  systemName: string | null;
  operatorName: string | null;
  overallResult: string;
  notes: string | null;
  deviationId: number | null;
}

interface TestResultRow {
  id: number;
  specId: number | null;
  parameter: string;
  unit: string;
  numericValue: number | null;
  specMinSnapshot: number | null;
  specMaxSnapshot: number | null;
  result: 'in_spec' | 'out_of_spec' | 'na';
}

interface TestDetail extends TestRow {
  results: TestResultRow[];
}

const resultBadge = (r: string) =>
  r === 'in_spec' ? (
    <Badge className="bg-emerald-100 text-emerald-900 whitespace-nowrap">ผ่าน (ในเกณฑ์)</Badge>
  ) : r === 'out_of_spec' ? (
    <Badge className="bg-rose-100 text-rose-900 whitespace-nowrap">ไม่ผ่าน (เกินเกณฑ์)</Badge>
  ) : (
    <Badge className="bg-gray-200 text-gray-700 whitespace-nowrap">ไม่ระบุ</Badge>
  );

export default function WaterQualityRecordsPage() {
  const t = useTranslations('environmentalMonitoring');
  const qc = useQueryClient();
  const toast = useToast();

  // ---- record-new popup ----
  const [testOpen, setTestOpen] = useState(false);
  const [samplePointId, setSamplePointId] = useState<number | null>(null);
  const [results, setResults] = useState<Record<number, number>>({});
  const [notes, setNotes] = useState('');
  const [password, setPassword] = useState('');

  // ---- view / edit / delete ----
  const [viewId, setViewId] = useState<number | null>(null);
  const [editMode, setEditMode] = useState(false);
  // When the user clicks "แก้ไข" in the table we open the same popup but want it
  // to enter edit mode as soon as the record detail finishes loading.
  const [wantEditOnLoad, setWantEditOnLoad] = useState(false);
  const [draft, setDraft] = useState<{ notes: string; results: Record<number, number | null> }>({ notes: '', results: {} });
  const [deleteTarget, setDeleteTarget] = useState<TestRow | null>(null);

  const { data: records = [], isLoading, refetch } = useQuery<TestRow[]>({
    queryKey: ['water-tests'],
    queryFn: async () => {
      const res = await fetch('/api/environmental/water-tests');
      if (!res.ok) return [];
      const body = await res.json();
      return body.items ?? [];
    },
  });

  const { data: systems } = useQuery<WaterSystem[]>({
    queryKey: ['water-systems'],
    queryFn: async () => {
      const res = await fetch('/api/environmental/water-systems');
      return res.ok ? res.json() : [];
    },
  });

  const { data: points } = useQuery<WaterSamplePoint[]>({
    queryKey: ['sample-points'],
    queryFn: async () => {
      const res = await fetch('/api/environmental/sample-points');
      return res.ok ? res.json() : [];
    },
  });

  const selectedPoint = points?.find((p) => p.id === samplePointId);

  const { data: specs } = useQuery<WaterQualitySpec[]>({
    queryKey: ['water-specs', selectedPoint?.waterSystemId],
    queryFn: async () => {
      if (!selectedPoint) return [];
      const res = await fetch(`/api/environmental/water-specs?waterSystemId=${selectedPoint.waterSystemId}`);
      return res.ok ? res.json() : [];
    },
    enabled: !!selectedPoint,
  });

  const { data: detail } = useQuery<TestDetail>({
    queryKey: ['water-test', viewId],
    queryFn: async () => {
      const res = await fetch(`/api/environmental/water-tests/${viewId}`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    enabled: viewId != null,
  });

  const recordMut = useMutation({
    mutationFn: async () => {
      if (!selectedPoint) throw new Error('No sample point');
      const payload = (specs ?? []).map((s) => ({
        specId: s.id,
        parameter: s.parameter,
        numericValue: results[s.id] ?? null,
        unit: s.unit,
      }));
      const res = await fetch('/api/environmental/water-tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          samplePointId: selectedPoint.id,
          waterSystemId: selectedPoint.waterSystemId,
          results: payload,
          notes: notes || null,
          signature: { password: password || 'verify' },
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? 'Failed');
      return body;
    },
    onSuccess: () => {
      toast.success('บันทึกผลตรวจน้ำแล้ว');
      qc.invalidateQueries({ queryKey: ['water-tests'] });
      setTestOpen(false);
      setSamplePointId(null);
      setResults({});
      setNotes('');
      setPassword('');
    },
    onError: (e: Error) => toast.error('บันทึกไม่สำเร็จ', e.message),
  });

  const startEdit = (d: TestDetail) => {
    const map: Record<number, number | null> = {};
    d.results.forEach((r) => { map[r.id] = r.numericValue; });
    setDraft({ notes: d.notes ?? '', results: map });
    setEditMode(true);
  };

  // When opened via the "แก้ไข" action, jump straight into edit mode once the
  // record's detail (incl. its results) has loaded for this viewId.
  useEffect(() => {
    if (wantEditOnLoad && detail && detail.id === viewId) {
      startEdit(detail);
      setWantEditOnLoad(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantEditOnLoad, detail, viewId]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/environmental/water-tests/${viewId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: draft.notes,
          results: Object.entries(draft.results).map(([id, numericValue]) => ({ id: Number(id), numericValue })),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? 'Save failed');
      return body;
    },
    onSuccess: () => {
      // Close the popup BEFORE invalidating. Invalidating ['water-tests'] while
      // the DevExtreme Popup is still mounted re-renders the underlying DataGrid
      // under the open overlay; DevExtreme then hits a DOM node it no longer owns
      // and throws an insertBefore/removeChild error that escapes to the global
      // error boundary (the "เกิดข้อผิดพลาด" page). Unmounting the popup first
      // lets React settle the overlay before the grid refreshes.
      const editedId = viewId;
      setEditMode(false);
      setViewId(null);
      toast.success('แก้ไขผลตรวจแล้ว (บันทึกใน audit log)');
      qc.invalidateQueries({ queryKey: ['water-tests'] });
      if (editedId != null) qc.invalidateQueries({ queryKey: ['water-test', editedId] });
    },
    onError: (e: Error) => toast.error('บันทึกไม่สำเร็จ', e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/environmental/water-tests/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.error ?? 'Delete failed');
      }
    },
    onSuccess: () => {
      toast.success('ลบผลตรวจแล้ว (บันทึกใน audit log)');
      qc.invalidateQueries({ queryKey: ['water-tests'] });
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error('ลบไม่สำเร็จ', e.message),
  });

  const closeView = () => { setViewId(null); setEditMode(false); setWantEditOnLoad(false); };

  return (
    <div className="p-6 space-y-4">
      <Breadcrumbs
        items={[
          { label: 'อาคารและสถานที่', href: '/premises' },
          { label: 'ระบบน้ำ (Water Quality)' },
        ]}
      />
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Droplets className="w-6 h-6" /> {t('page.waterQuality')} — บันทึกผลตรวจ
          </h1>
          <p className="text-gray-600 text-sm mt-1">
            ทะเบียนผลตรวจน้ำที่บันทึกไว้ — บันทึกใหม่ / ดู / แก้ไข / ลบ ได้ที่นี่
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link
            href="/premises/environmental/water-quality/settings"
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border rounded hover:bg-gray-50 text-gray-700"
          >
            <Settings className="w-4 h-4" /> ตั้งค่าระบบน้ำ
          </Link>
          <Button type="default" stylingMode="contained" onClick={() => setTestOpen(true)} data-testid="wq-record-btn">
            <span className="inline-flex items-center gap-1"><Plus className="w-4 h-4" /> บันทึกผลตรวจน้ำ</span>
          </Button>
        </div>
      </header>

      <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 text-sm text-sky-900">
        การตั้งค่า (ระบบน้ำ / จุดสุ่ม / เกณฑ์) ย้ายไปหน้า{' '}
        <Link href="/premises/environmental/water-quality/settings" className="underline font-medium">ตั้งค่าระบบน้ำ</Link>{' '}
        — หน้านี้คือ "ทะเบียนบันทึกผลตรวจ" ที่ข้อมูลจากการกด "บันทึกผลตรวจน้ำ" จะมาแสดง
      </div>

      <DataGrid
        dataSource={records}
        keyExpr="id"
        showBorders
        showRowLines
        rowAlternationEnabled
        columnAutoWidth
        noDataText={isLoading ? 'กำลังโหลด…' : 'ยังไม่มีผลตรวจที่บันทึก'}
        data-testid="wq-records-grid"
      >
        <Paging pageSize={20} />
        <Pager visible showPageSizeSelector allowedPageSizes={[20, 50, 100]} />
        <Column dataField="id" caption="#" width={60} />
        <Column dataField="performedAt" caption="วันเวลาที่ตรวจ" dataType="datetime" width={170} />
        <Column dataField="samplePointName" caption="จุดสุ่มตัวอย่าง" />
        <Column dataField="systemName" caption="ระบบน้ำ" />
        <Column dataField="operatorName" caption="ผู้ตรวจ" width={150} />
        <Column dataField="overallResult" caption="ผลรวม" width={170} cellRender={(c) => resultBadge(c.value)} />
        <Column
          caption="การกระทำ"
          width={210}
          cellRender={(c) => {
            const row = c.data as TestRow;
            return (
              <div className="flex gap-1">
                <Button stylingMode="outlined" onClick={() => { setWantEditOnLoad(false); setEditMode(false); setViewId(row.id); }} data-testid={`wq-view-${row.id}`}>
                  <span className="inline-flex items-center gap-1 text-xs"><Eye className="w-3 h-3" /> ดู</span>
                </Button>
                <Button stylingMode="outlined" onClick={() => { setWantEditOnLoad(true); setEditMode(false); setViewId(row.id); }} data-testid={`wq-edit-${row.id}`}>
                  <span className="inline-flex items-center gap-1 text-xs"><Pencil className="w-3 h-3" /> แก้ไข</span>
                </Button>
                <Button stylingMode="text" type="danger" onClick={() => setDeleteTarget(row)} data-testid={`wq-delete-${row.id}`}>
                  <span className="inline-flex items-center gap-1 text-xs"><Trash2 className="w-3 h-3" /> ลบ</span>
                </Button>
              </div>
            );
          }}
        />
      </DataGrid>

      {/* ===== Record new ===== */}
      <Popup visible={testOpen} onHiding={() => setTestOpen(false)} showCloseButton title="บันทึกผลตรวจน้ำ" width={580} height="auto">
        <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-sm font-medium mb-1">{t('form.samplePoint')} *</label>
            <SelectBox
              dataSource={points ?? []}
              displayExpr={(p: WaterSamplePoint) =>
                p ? `${p.code} — ${p.name} (${systems?.find((s) => s.id === p.waterSystemId)?.code ?? ''})` : ''
              }
              valueExpr="id"
              value={samplePointId}
              onValueChanged={(e) => setSamplePointId(e.value as number | null)}
            />
          </div>
          {selectedPoint && (specs ?? []).map((s) => (
            <div key={s.id} className="border rounded p-3 space-y-1">
              <div className="font-medium">
                {s.parameter} ({s.unit})
                {s.specMin != null || s.specMax != null ? (
                  <span className="text-xs text-gray-500 ml-2">เกณฑ์ {s.specMin ?? '-'} – {s.specMax ?? '-'}</span>
                ) : null}
              </div>
              <NumberBox
                value={results[s.id] ?? undefined}
                onValueChanged={(e) => setResults((prev) => ({ ...prev, [s.id]: Number(e.value ?? 0) }))}
                step={0.001}
                format="#0.000"
                placeholder={t('form.value')}
              />
            </div>
          ))}
          {selectedPoint && (specs ?? []).length === 0 && (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded p-3 text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                ระบบน้ำของจุดเก็บนี้ยังไม่มีการตั้งเกณฑ์ (Spec) — ไปเพิ่มเกณฑ์ที่หน้า{' '}
                <Link href="/premises/environmental/water-quality/settings" className="underline">ตั้งค่าระบบน้ำ</Link> ก่อน
              </span>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">{t('form.notes')}</label>
            <TextArea value={notes} height={60} onValueChanged={(e) => setNotes(String(e.value ?? ''))} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">รหัสผ่าน</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border rounded px-3 py-2" />
          </div>
          {recordMut.error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-900 rounded p-3 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> {String((recordMut.error as Error).message)}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button text={t('actions.cancel')} stylingMode="text" onClick={() => setTestOpen(false)} />
            <Button
              type="success"
              stylingMode="contained"
              text={t('actions.save')}
              disabled={!samplePointId || (!!selectedPoint && (specs ?? []).length === 0) || recordMut.isPending}
              onClick={() => recordMut.mutate()}
            />
          </div>
        </div>
      </Popup>

      {/* ===== View / edit ===== */}
      <Popup
        visible={viewId != null}
        onHiding={closeView}
        showCloseButton
        title={detail ? `ผลตรวจ #${detail.id} — ${detail.samplePointName ?? ''}` : 'ผลตรวจ'}
        width={680}
        height="auto"
      >
        <div className="p-4 space-y-3 max-h-[75vh] overflow-y-auto">
          {!detail ? (
            <div className="text-gray-500 text-sm">กำลังโหลด…</div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-gray-500">วันเวลา:</span> {new Date(detail.performedAt).toLocaleString('th-TH')}</div>
                <div><span className="text-gray-500">ผู้ตรวจ:</span> {detail.operatorName ?? '—'}</div>
                <div><span className="text-gray-500">ระบบน้ำ:</span> {detail.systemName ?? '—'}</div>
                <div><span className="text-gray-500">ผลรวม:</span> {resultBadge(detail.overallResult)}</div>
              </div>

              <div className="border rounded">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-left p-2">พารามิเตอร์</th>
                      <th className="text-left p-2 w-32">ค่าที่วัด</th>
                      <th className="text-left p-2 w-28">เกณฑ์</th>
                      <th className="text-left p-2 w-24">ผล</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.results.map((r) => (
                      // key includes editMode so the row + its DevExtreme NumberBox
                      // remount on view↔edit toggle instead of swapping a span for
                      // a widget in place (which threw a DOM error → error page).
                      <tr key={`${r.id}-${editMode ? 'edit' : 'view'}`} className="border-t">
                        <td className="p-2">{r.parameter} {r.unit ? <span className="text-gray-400">({r.unit})</span> : null}</td>
                        <td className="p-2">
                          {editMode ? (
                            <NumberBox
                              value={draft.results[r.id] ?? undefined}
                              step={0.001}
                              format="#0.000"
                              onValueChanged={(e) =>
                                setDraft((prev) => ({
                                  ...prev,
                                  results: { ...prev.results, [r.id]: e.value == null ? null : Number(e.value) },
                                }))
                              }
                            />
                          ) : (
                            <span>{r.numericValue ?? '—'}</span>
                          )}
                        </td>
                        <td className="p-2 text-gray-500">{r.specMinSnapshot ?? '-'} – {r.specMaxSnapshot ?? '-'}</td>
                        <td className="p-2">{resultBadge(r.result)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">หมายเหตุ</label>
                {editMode ? (
                  <TextArea value={draft.notes} height={60} onValueChanged={(e) => setDraft((prev) => ({ ...prev, notes: String(e.value ?? '') }))} />
                ) : (
                  <div className="text-sm text-gray-700">{detail.notes ?? '—'}</div>
                )}
              </div>

              {editMode && (
                <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded p-2 text-xs">
                  ⚠️ การแก้ไขผลตรวจที่เซ็นชื่อแล้วจะถูกบันทึกใน audit log — ผล "ผ่าน/ไม่ผ่าน" จะคำนวณใหม่ตามเกณฑ์เดิม
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                {!editMode ? (
                  <>
                    <Button text="ปิด" stylingMode="text" onClick={closeView} />
                    <Button type="default" stylingMode="contained" onClick={() => startEdit(detail)}>
                      <span className="inline-flex items-center gap-1"><Pencil className="w-4 h-4" /> แก้ไข</span>
                    </Button>
                  </>
                ) : (
                  <>
                    <Button text="ยกเลิก" stylingMode="text" onClick={() => setEditMode(false)} disabled={saveMut.isPending} />
                    <Button type="success" stylingMode="contained" text="บันทึกการแก้ไข" disabled={saveMut.isPending} onClick={() => saveMut.mutate()} />
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </Popup>

      <ConfirmationDialog
        visible={!!deleteTarget}
        title="ลบผลตรวจ"
        message={
          deleteTarget
            ? `ยืนยันการลบผลตรวจ #${deleteTarget.id} (${deleteTarget.samplePointName ?? ''} — ${new Date(deleteTarget.performedAt).toLocaleString('th-TH')}) ? การลบจะถูกบันทึกใน audit log และย้อนกลับไม่ได้`
            : ''
        }
        confirmText="ลบ"
        cancelText="ยกเลิก"
        confirmType="danger"
        isLoading={deleteMut.isPending}
        onConfirm={() => {
          if (deleteTarget) deleteMut.mutate(deleteTarget.id);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
