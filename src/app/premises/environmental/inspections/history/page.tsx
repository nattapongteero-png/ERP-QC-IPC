'use client';

/**
 * Environmental Inspection History — list past recorded inspections,
 * view their per-item results, and (with audit log) correct or delete a record.
 *
 * Editing/deleting a signed GMP record is written to the audit trail by the
 * service layer (action UPDATE / DELETE on inspectionRecords).
 */
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DataGrid, Column, Paging, Pager } from 'devextreme-react/data-grid';
import { Popup } from 'devextreme-react/popup';
import { Button } from 'devextreme-react/button';
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

export default function InspectionHistoryPage() {
  const t = useTranslations('premises');
  const searchParams = useSearchParams();
  const targetLabel = (v: string) =>
    (['room', 'storage_area', 'quarantine', 'water_point'] as const).includes(v as any)
      ? t('environmental.common.targetType.' + v)
      : v;
  const resultBadge = (r: string) =>
    r === 'in_spec' ? (
      <Badge className="bg-emerald-100 text-emerald-900">{t('environmental.common.result.inSpec')}</Badge>
    ) : r === 'out_of_spec' ? (
      <Badge className="bg-rose-100 text-rose-900">{t('environmental.common.result.outOfSpec')}</Badge>
    ) : (
      <Badge className="bg-gray-200 text-gray-700">{t('environmental.common.result.na')}</Badge>
    );
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
  // When opened from a specific row's "view/edit" button, the URL carries
  // ?targetId=&templateId= — filter the history to just that target so the user
  // sees only that room's records (not every room mixed together).
  const filterTargetId = searchParams.get('targetId');
  const filterTemplateId = searchParams.get('templateId');
  const allRecords = data?.items ?? [];
  const records = allRecords.filter((r) => {
    if (filterTargetId && String(r.targetId) !== filterTargetId) return false;
    return true;
  });
  const filteredTargetName =
    filterTargetId ? allRecords.find((r) => String(r.targetId) === filterTargetId)?.targetName : null;

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
      toast.success(t('environmental.inspectionsHistory.editedToast'));
      qc.invalidateQueries({ queryKey: ['env-inspection-records'] });
      if (editedId != null) qc.invalidateQueries({ queryKey: ['env-inspection-record', editedId] });
    },
    onError: (e: Error) => toast.error(t('environmental.inspectionsHistory.saveFailedToast'), e.message),
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
      toast.success(t('environmental.inspectionsHistory.deletedToast'));
      qc.invalidateQueries({ queryKey: ['env-inspection-records'] });
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(t('environmental.inspectionsHistory.deleteFailedToast'), e.message),
  });

  const closeView = () => {
    setViewId(null);
    setEditMode(false);
  };

  return (
    <div className="p-6 space-y-4">
      <Breadcrumbs
        items={[
          { label: t('environmental.common.breadcrumb.premises'), href: '/premises' },
          { label: t('environmental.common.breadcrumb.environmental'), href: '/premises/environmental/inspections' },
          { label: t('environmental.inspectionsHistory.breadcrumb') },
        ]}
      />
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('environmental.inspectionsHistory.title')}</h1>
          <p className="text-gray-600 text-sm mt-1">
            {t('environmental.inspectionsHistory.subtitle')}
          </p>
        </div>
        <Button icon="refresh" text={t('environmental.common.refresh')} onClick={() => refetch()} />
      </div>

      {/* Active room filter (came from a row's view/edit) — show what's filtered
          and let the user clear it to see all rooms again. */}
      {filterTargetId && (
        <div className="flex items-center justify-between gap-2 bg-sky-50 border border-sky-200 rounded-lg px-3 py-2 text-sm text-sky-900">
          <span>
            {t('environmental.inspectionsHistory.filteredBy')}:{' '}
            <span className="font-semibold">{filteredTargetName || `#${filterTargetId}`}</span>
          </span>
          <a href="/premises/environmental/inspections/history" className="text-sky-700 underline font-medium">
            {t('environmental.inspectionsHistory.clearFilter')}
          </a>
        </div>
      )}

      <DataGrid
        dataSource={records}
        keyExpr="id"
        showBorders
        showRowLines
        rowAlternationEnabled
        columnAutoWidth
        noDataText={isLoading ? t('environmental.common.loading') : t('environmental.inspectionsHistory.noData')}
        data-testid="env-history-grid"
      >
        <Paging pageSize={20} />
        <Pager visible showPageSizeSelector allowedPageSizes={[20, 50, 100]} />
        <Column dataField="id" caption="#" width={60} />
        <Column dataField="performedAt" caption={t('environmental.inspectionsHistory.performedAtColumn')} dataType="datetime" width={170} />
        <Column
          dataField="targetType"
          caption={t('environmental.inspectionsHistory.typeColumn')}
          width={120}
          cellRender={(c) => targetLabel(c.value)}
        />
        <Column dataField="targetName" caption={t('environmental.common.targetWithLocationColumn')} />
        <Column dataField="templateName" caption={t('environmental.common.templateColumn')} />
        <Column dataField="operatorName" caption={t('environmental.inspectionsHistory.operatorColumn')} width={150} />
        <Column
          dataField="overallResult"
          caption={t('environmental.inspectionsHistory.overallResultColumn')}
          width={140}
          cellRender={(c) => resultBadge(c.value)}
        />
        <Column
          caption={t('environmental.common.actionsColumn')}
          width={210}
          cellRender={(c) => {
            const row = c.data as RecordRow;
            return (
              <div className="flex gap-1">
                <Button stylingMode="outlined" onClick={() => { setViewId(row.id); setEditMode(false); }} data-testid={`view-${row.id}`}>
                  <span className="inline-flex items-center gap-1 text-xs"><Eye className="w-3 h-3" /> {t('environmental.inspectionsHistory.viewAction')}</span>
                </Button>
                <Button stylingMode="outlined" onClick={() => { setViewId(row.id); setEditMode(false); }} data-testid={`edit-${row.id}`}>
                  <span className="inline-flex items-center gap-1 text-xs"><Pencil className="w-3 h-3" /> {t('environmental.common.edit')}</span>
                </Button>
                <Button stylingMode="text" type="danger" onClick={() => setDeleteTarget(row)} data-testid={`delete-${row.id}`}>
                  <span className="inline-flex items-center gap-1 text-xs"><Trash2 className="w-3 h-3" /> {t('environmental.inspectionsHistory.deleteAction')}</span>
                </Button>
              </div>
            );
          }}
        />
      </DataGrid>

      {/* View / edit popup.
          The body is ALWAYS mounted (never swapped on the editMode toggle). Each
          editable cell renders both the read-only <span> and the edit <input> at
          once, toggling visibility with CSS `hidden` rather than mounting /
          unmounting nodes. Adding or removing a DOM node inside the DevExtreme
          popup overlay (managed outside React's tree) is what threw
          insertBefore/removeChild (NotFoundError) → global error page. Keeping the
          node set constant means React only flips classNames, so the overlay's
          DOM never shifts under it. (Verified fix; matches water-quality.) */}
      <Popup
        visible={viewId != null}
        onHiding={closeView}
        showCloseButton
        title={detail ? t('environmental.inspectionsHistory.popupTitle', { id: detail.id, target: detail.targetName ?? targetLabel(detail.targetType) }) : t('environmental.inspectionsHistory.popupTitleFallback')}
        width={680}
        height="auto"
      >
        <div className="p-4 space-y-3 max-h-[75vh] overflow-y-auto">
          {!detail ? (
            <div className="text-gray-500 text-sm">{t('environmental.common.loading')}</div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-gray-500">{t('environmental.inspectionsHistory.labelDateTime')}</span> {new Date(detail.performedAt).toLocaleString('th-TH')}</div>
                <div><span className="text-gray-500">{t('environmental.inspectionsHistory.labelOperator')}</span> {detail.operatorName ?? '—'}</div>
                <div><span className="text-gray-500">{t('environmental.inspectionsHistory.labelTemplate')}</span> {detail.templateName ?? '—'}</div>
                <div><span className="text-gray-500">{t('environmental.inspectionsHistory.labelOverallResult')}</span> {resultBadge(detail.overallResult)}</div>
              </div>

              <div className="border rounded">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-left p-2">{t('environmental.inspectionsHistory.tableItem')}</th>
                      <th className="text-left p-2 w-28">{t('environmental.inspectionsHistory.tableMeasured')}</th>
                      <th className="text-left p-2 w-28">{t('environmental.inspectionsHistory.tableSpec')}</th>
                      <th className="text-left p-2 w-24">{t('environmental.inspectionsHistory.tableResult')}</th>
                      <th className="text-left p-2">{t('environmental.inspectionsHistory.tableRemarks')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.results.map((r) => (
                      <tr key={r.id} className="border-t">
                        <td className="p-2">
                          {r.label} {r.unit ? <span className="text-gray-400">({r.unit})</span> : null}
                        </td>
                        <td className="p-2">
                          {/* Both nodes always mounted; only the `hidden` class
                              flips on editMode. Mounting/unmounting a node inside
                              the DevExtreme popup overlay is what threw the
                              insertBefore DOM error → error page. */}
                          <span className={editMode ? 'hidden' : ''}>{r.numericValue ?? '—'}</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            className={`w-24 border rounded px-2 py-1 text-sm ${editMode ? '' : 'hidden'}`}
                            value={draft.results[r.id]?.numericValue ?? ''}
                            onChange={(e) =>
                              setDraft((prev) => ({
                                ...prev,
                                results: {
                                  ...prev.results,
                                  [r.id]: {
                                    numericValue: e.target.value === '' ? null : Number(e.target.value),
                                    remarks: prev.results[r.id]?.remarks ?? '',
                                  },
                                },
                              }))
                            }
                          />
                        </td>
                        <td className="p-2 text-gray-500">
                          {r.specMinSnapshot ?? '-'} – {r.specMaxSnapshot ?? '-'}
                        </td>
                        <td className="p-2">{resultBadge(r.result)}</td>
                        <td className="p-2">
                          <span className={`text-gray-600 ${editMode ? 'hidden' : ''}`}>{r.remarks ?? '—'}</span>
                          <input
                            className={`w-full border rounded px-2 py-1 text-sm ${editMode ? '' : 'hidden'}`}
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
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">{t('environmental.inspectionsHistory.notesLabel')}</label>
                {/* Both nodes always mounted; CSS toggle only. Plain <textarea>
                    (not DevExtreme TextArea) for overlay-DOM stability. */}
                <div className={`text-sm text-gray-700 ${editMode ? 'hidden' : ''}`}>{detail.notes ?? '—'}</div>
                <textarea
                  className={`w-full border rounded px-2 py-1 text-sm ${editMode ? '' : 'hidden'}`}
                  rows={2}
                  value={draft.notes}
                  onChange={(e) => setDraft((prev) => ({ ...prev, notes: e.target.value }))}
                />
              </div>

              <div className={`bg-amber-50 border border-amber-200 text-amber-900 rounded p-2 text-xs ${editMode ? '' : 'hidden'}`}>
                {t('environmental.inspectionsHistory.editWarning')}
              </div>

              {/* All four buttons always mounted; the inactive pair is hidden via
                  CSS so the overlay's DOM never changes shape on editMode. */}
              <div className="flex justify-end gap-2 pt-2">
                <div className={`flex gap-2 ${editMode ? 'hidden' : ''}`}>
                  <Button text={t('environmental.inspectionsHistory.closeButton')} stylingMode="text" onClick={closeView} />
                  <Button type="default" stylingMode="contained" onClick={() => startEdit(detail)}>
                    <span className="inline-flex items-center gap-1"><Pencil className="w-4 h-4" /> {t('environmental.common.edit')}</span>
                  </Button>
                </div>
                <div className={`flex gap-2 ${editMode ? '' : 'hidden'}`}>
                  <Button text={t('environmental.common.cancel')} stylingMode="text" onClick={() => setEditMode(false)} disabled={saveMut.isPending} />
                  <Button
                    type="success"
                    stylingMode="contained"
                    text={t('environmental.common.saveEdit')}
                    disabled={saveMut.isPending}
                    onClick={() => saveMut.mutate()}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </Popup>

      <ConfirmationDialog
        visible={!!deleteTarget}
        title={t('environmental.inspectionsHistory.deleteDialogTitle')}
        message={
          deleteTarget
            ? t('environmental.inspectionsHistory.deleteDialogMessage', {
                id: deleteTarget.id,
                name: deleteTarget.targetName ?? '',
                datetime: new Date(deleteTarget.performedAt).toLocaleString('th-TH'),
              })
            : ''
        }
        confirmText={t('environmental.inspectionsHistory.deleteConfirmText')}
        cancelText={t('environmental.common.cancel')}
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
