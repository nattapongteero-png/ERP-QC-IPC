'use client';

/**
 * Environmental Inspection History — list past recorded inspections,
 * view their per-item results, and (with audit log) correct or delete a record.
 *
 * Editing/deleting a signed GMP record is written to the audit trail by the
 * service layer (action UPDATE / DELETE on inspectionRecords).
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DataGrid, Column, Paging, Pager } from 'devextreme-react/data-grid';
import { Popup } from 'devextreme-react/popup';
import { Button } from 'devextreme-react/button';
import { NumberBox } from 'devextreme-react/number-box';
import { TextArea } from 'devextreme-react/text-area';
import { Badge } from '@/components/ui/badge';
import { Breadcrumbs, ConfirmationDialog } from '@/components/shared';
import { useToast } from '@/hooks/use-toast';
import { Eye, Pencil, Trash2 } from 'lucide-react';

interface RecordRow {
  id: number;
  performedAt: string;
  targetType: string;
  targetId: number;
  targetName: string | null;
  templateName: string | null;
  operatorName: string | null;
  overallResult: string;
  status: string;
  notes: string | null;
  deviationId: number | null;
}

interface ResultRow {
  id: number;
  templateItemId: number;
  label: string;
  parameter: string;
  unit: string | null;
  numericValue: number | null;
  textValue: string | null;
  specMinSnapshot: number | null;
  specMaxSnapshot: number | null;
  result: 'in_spec' | 'out_of_spec' | 'na';
  remarks: string | null;
}

interface RecordDetail extends RecordRow {
  scheduleId: number | null;
  results: ResultRow[];
}

const targetLabel = (t: string) =>
  ({ room: 'ห้องผลิต', storage_area: 'พื้นที่จัดเก็บ', quarantine: 'พื้นที่กักกัน', water_point: 'จุดน้ำ' })[t] ?? t;

const resultBadge = (r: string) =>
  r === 'in_spec' ? (
    <Badge className="bg-emerald-100 text-emerald-900">ผ่าน (ในเกณฑ์)</Badge>
  ) : r === 'out_of_spec' ? (
    <Badge className="bg-rose-100 text-rose-900">ไม่ผ่าน (เกินเกณฑ์)</Badge>
  ) : (
    <Badge className="bg-gray-200 text-gray-700">ไม่ระบุ</Badge>
  );

export default function InspectionHistoryPage() {
  const qc = useQueryClient();
  const toast = useToast();

  const [viewId, setViewId] = useState<number | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<{ notes: string; results: Record<number, { numericValue: number | null; remarks: string }> }>({
    notes: '',
    results: {},
  });
  const [deleteTarget, setDeleteTarget] = useState<RecordRow | null>(null);

  const { data, isLoading, refetch } = useQuery<{ items: RecordRow[] }>({
    queryKey: ['env-inspection-records'],
    queryFn: async () => {
      const res = await fetch('/api/environmental/inspections/records');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });
  const records = data?.items ?? [];

  const { data: detail } = useQuery<RecordDetail>({
    queryKey: ['env-inspection-record', viewId],
    queryFn: async () => {
      const res = await fetch(`/api/environmental/inspections/records/${viewId}`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    enabled: viewId != null,
  });

  const startEdit = (d: RecordDetail) => {
    const map: Record<number, { numericValue: number | null; remarks: string }> = {};
    d.results.forEach((r) => {
      map[r.id] = { numericValue: r.numericValue, remarks: r.remarks ?? '' };
    });
    setDraft({ notes: d.notes ?? '', results: map });
    setEditMode(true);
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/environmental/inspections/records/${viewId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: draft.notes,
          results: Object.entries(draft.results).map(([id, v]) => ({
            id: Number(id),
            numericValue: v.numericValue,
            remarks: v.remarks,
          })),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? 'Save failed');
      return body;
    },
    onSuccess: () => {
      // Close the popup BEFORE invalidating — invalidating the list while the
      // DevExtreme Popup is still mounted re-renders the DataGrid under the open
      // overlay and DevExtreme throws an insertBefore/removeChild error that
      // escapes to the global error page. (Same fix as the water-quality page.)
      const editedId = viewId;
      setEditMode(false);
      setViewId(null);
      toast.success('แก้ไขผลตรวจแล้ว (บันทึกใน audit log)');
      qc.invalidateQueries({ queryKey: ['env-inspection-records'] });
      if (editedId != null) qc.invalidateQueries({ queryKey: ['env-inspection-record', editedId] });
    },
    onError: (e: Error) => toast.error('บันทึกไม่สำเร็จ', e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/environmental/inspections/records/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? 'Delete failed');
      }
    },
    onSuccess: () => {
      toast.success('ลบผลตรวจแล้ว (บันทึกใน audit log)');
      qc.invalidateQueries({ queryKey: ['env-inspection-records'] });
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error('ลบไม่สำเร็จ', e.message),
  });

  const closeView = () => {
    setViewId(null);
    setEditMode(false);
  };

  return (
    <div className="p-6 space-y-4">
      <Breadcrumbs
        items={[
          { label: 'อาคารและสถานที่', href: '/premises' },
          { label: 'ตรวจสภาพแวดล้อม', href: '/premises/environmental/inspections' },
          { label: 'ประวัติผลตรวจ' },
        ]}
      />
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">ประวัติผลตรวจสภาพแวดล้อม</h1>
          <p className="text-gray-600 text-sm mt-1">
            ผลการตรวจที่บันทึกไปแล้ว — ดูรายละเอียด แก้ไข (กรณีบันทึกผิด) หรือลบได้ ทุกการแก้ไข/ลบจะถูกบันทึกใน audit log
          </p>
        </div>
        <Button icon="refresh" text="รีเฟรช" onClick={() => refetch()} />
      </div>

      <DataGrid
        dataSource={records}
        keyExpr="id"
        showBorders
        showRowLines
        rowAlternationEnabled
        columnAutoWidth
        noDataText={isLoading ? 'กำลังโหลด…' : 'ยังไม่มีผลตรวจที่บันทึก'}
        data-testid="env-history-grid"
      >
        <Paging pageSize={20} />
        <Pager visible showPageSizeSelector allowedPageSizes={[20, 50, 100]} />
        <Column dataField="id" caption="#" width={60} />
        <Column dataField="performedAt" caption="วันเวลาที่ตรวจ" dataType="datetime" width={170} />
        <Column
          dataField="targetType"
          caption="ประเภท"
          width={120}
          cellRender={(c) => targetLabel(c.value)}
        />
        <Column dataField="targetName" caption="เป้าหมาย (สถานที่)" />
        <Column dataField="templateName" caption="แบบฟอร์ม" />
        <Column dataField="operatorName" caption="ผู้ตรวจ" width={150} />
        <Column
          dataField="overallResult"
          caption="ผลรวม"
          width={140}
          cellRender={(c) => resultBadge(c.value)}
        />
        <Column
          caption="การกระทำ"
          width={210}
          cellRender={(c) => {
            const row = c.data as RecordRow;
            return (
              <div className="flex gap-1">
                <Button stylingMode="outlined" onClick={() => { setViewId(row.id); setEditMode(false); }} data-testid={`view-${row.id}`}>
                  <span className="inline-flex items-center gap-1 text-xs"><Eye className="w-3 h-3" /> ดู</span>
                </Button>
                <Button stylingMode="outlined" onClick={() => { setViewId(row.id); setEditMode(false); }} data-testid={`edit-${row.id}`}>
                  <span className="inline-flex items-center gap-1 text-xs"><Pencil className="w-3 h-3" /> แก้ไข</span>
                </Button>
                <Button stylingMode="text" type="danger" onClick={() => setDeleteTarget(row)} data-testid={`delete-${row.id}`}>
                  <span className="inline-flex items-center gap-1 text-xs"><Trash2 className="w-3 h-3" /> ลบ</span>
                </Button>
              </div>
            );
          }}
        />
      </DataGrid>

      {/* View / edit popup */}
      <Popup
        visible={viewId != null}
        onHiding={closeView}
        showCloseButton
        title={detail ? `ผลตรวจ #${detail.id} — ${detail.targetName ?? targetLabel(detail.targetType)}` : 'ผลตรวจ'}
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
                <div><span className="text-gray-500">แบบฟอร์ม:</span> {detail.templateName ?? '—'}</div>
                <div><span className="text-gray-500">ผลรวม:</span> {resultBadge(detail.overallResult)}</div>
              </div>

              <div className="border rounded">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-left p-2">รายการ</th>
                      <th className="text-left p-2 w-28">ค่าที่วัด</th>
                      <th className="text-left p-2 w-28">เกณฑ์</th>
                      <th className="text-left p-2 w-24">ผล</th>
                      <th className="text-left p-2">หมายเหตุ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.results.map((r) => (
                      // key includes editMode so the row (and its DevExtreme
                      // NumberBox) fully remounts when toggling view↔edit instead
                      // of swapping a <span> for a widget in the same <td> — that
                      // in-place swap made DevExtreme throw a DOM error that
                      // escaped to the global error page.
                      <tr key={`${r.id}-${editMode ? 'edit' : 'view'}`} className="border-t">
                        <td className="p-2">
                          {r.label} {r.unit ? <span className="text-gray-400">({r.unit})</span> : null}
                        </td>
                        <td className="p-2">
                          {editMode ? (
                            <NumberBox
                              value={draft.results[r.id]?.numericValue ?? undefined}
                              step={0.01}
                              format="#0.00"
                              onValueChanged={(e) =>
                                setDraft((prev) => ({
                                  ...prev,
                                  results: {
                                    ...prev.results,
                                    [r.id]: {
                                      numericValue: e.value == null ? null : Number(e.value),
                                      remarks: prev.results[r.id]?.remarks ?? '',
                                    },
                                  },
                                }))
                              }
                            />
                          ) : (
                            <span>{r.numericValue ?? '—'}</span>
                          )}
                        </td>
                        <td className="p-2 text-gray-500">
                          {r.specMinSnapshot ?? '-'} – {r.specMaxSnapshot ?? '-'}
                        </td>
                        <td className="p-2">{resultBadge(r.result)}</td>
                        <td className="p-2">
                          {editMode ? (
                            <input
                              className="w-full border rounded px-2 py-1 text-sm"
                              value={draft.results[r.id]?.remarks ?? ''}
                              onChange={(e) =>
                                setDraft((prev) => ({
                                  ...prev,
                                  results: {
                                    ...prev.results,
                                    [r.id]: {
                                      numericValue: prev.results[r.id]?.numericValue ?? r.numericValue,
                                      remarks: e.target.value,
                                    },
                                  },
                                }))
                              }
                            />
                          ) : (
                            <span className="text-gray-600">{r.remarks ?? '—'}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">หมายเหตุการตรวจ</label>
                {editMode ? (
                  <TextArea
                    value={draft.notes}
                    height={60}
                    onValueChanged={(e) => setDraft((prev) => ({ ...prev, notes: String(e.value ?? '') }))}
                  />
                ) : (
                  <div className="text-sm text-gray-700">{detail.notes ?? '—'}</div>
                )}
              </div>

              {editMode && (
                <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded p-2 text-xs">
                  ⚠️ การแก้ไขผลตรวจที่เซ็นชื่อแล้วจะถูกบันทึกใน audit log (ใคร/แก้อะไร/เมื่อไหร่) — ผล "ผ่าน/ไม่ผ่าน" จะคำนวณใหม่ตามเกณฑ์เดิม
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
                    <Button
                      type="success"
                      stylingMode="contained"
                      text="บันทึกการแก้ไข"
                      disabled={saveMut.isPending}
                      onClick={() => saveMut.mutate()}
                    />
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
            ? `ยืนยันการลบผลตรวจ #${deleteTarget.id} (${deleteTarget.targetName ?? ''} — ${new Date(deleteTarget.performedAt).toLocaleString('th-TH')}) ? การลบจะถูกบันทึกใน audit log และย้อนกลับไม่ได้`
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
