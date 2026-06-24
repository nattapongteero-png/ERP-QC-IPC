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
import { useState } from 'react';
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

const resultBadge = (r: string, tp: (key: string) => string) =>
  r === 'in_spec' ? (
    <Badge className="bg-emerald-100 text-emerald-900 whitespace-nowrap">{tp('waterQuality.common.result.inSpec')}</Badge>
  ) : r === 'out_of_spec' ? (
    <Badge className="bg-rose-100 text-rose-900 whitespace-nowrap">{tp('waterQuality.common.result.outOfSpec')}</Badge>
  ) : (
    <Badge className="bg-gray-200 text-gray-700 whitespace-nowrap">{tp('waterQuality.common.result.na')}</Badge>
  );

export default function WaterQualityRecordsPage() {
  const t = useTranslations('environmentalMonitoring');
  const tp = useTranslations('premises');
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
      toast.success(tp('waterQuality.index.toast.recordSuccess'));
      qc.invalidateQueries({ queryKey: ['water-tests'] });
      setTestOpen(false);
      setSamplePointId(null);
      setResults({});
      setNotes('');
      setPassword('');
    },
    onError: (e: Error) => toast.error(tp('waterQuality.index.toast.recordError'), e.message),
  });

  const startEdit = (d: TestDetail) => {
    const map: Record<number, number | null> = {};
    d.results.forEach((r) => { map[r.id] = r.numericValue; });
    setDraft({ notes: d.notes ?? '', results: map });
    setEditMode(true);
  };

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
      toast.success(tp('waterQuality.index.toast.editSuccess'));
      qc.invalidateQueries({ queryKey: ['water-tests'] });
      if (editedId != null) qc.invalidateQueries({ queryKey: ['water-test', editedId] });
    },
    onError: (e: Error) => toast.error(tp('waterQuality.index.toast.editError'), e.message),
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
      toast.success(tp('waterQuality.index.toast.deleteSuccess'));
      qc.invalidateQueries({ queryKey: ['water-tests'] });
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(tp('waterQuality.index.toast.deleteError'), e.message),
  });

  const closeView = () => { setViewId(null); setEditMode(false); };

  return (
    <div className="p-6 space-y-4">
      <Breadcrumbs
        items={[
          { label: tp('waterQuality.common.breadcrumb.premises'), href: '/premises' },
          { label: tp('waterQuality.common.breadcrumb.waterQuality') },
        ]}
      />
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Droplets className="w-6 h-6" /> {t('page.waterQuality')} — {tp('waterQuality.index.title')}
          </h1>
          <p className="text-gray-600 text-sm mt-1">
            {tp('waterQuality.index.subtitle')}
          </p>
        </div>
        {/* Header actions — unified as native pill buttons (same height, padding,
            border, icon size) so the settings link and record button line up. */}
        <div className="flex gap-2 flex-wrap items-center">
          <Link
            href="/premises/environmental/water-quality/settings"
            className="inline-flex items-center gap-1.5 h-9 px-3 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50 text-gray-700 transition-colors"
          >
            <Settings className="w-4 h-4" /> {tp('waterQuality.index.settingsLink')}
          </Link>
          <button
            type="button"
            onClick={() => setTestOpen(true)}
            data-testid="wq-record-btn"
            className="inline-flex items-center gap-1.5 h-9 px-3 text-sm border border-emerald-200 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> {tp('waterQuality.index.recordButton')}
          </button>
        </div>
      </header>

      <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 text-sm text-sky-900">
        {tp('waterQuality.index.moveNotice.before')}{' '}
        <Link href="/premises/environmental/water-quality/settings" className="underline font-medium">{tp('waterQuality.index.settingsLink')}</Link>{' '}
        {tp('waterQuality.index.moveNotice.after')}
      </div>

      <DataGrid
        dataSource={records}
        keyExpr="id"
        showBorders
        showRowLines
        rowAlternationEnabled
        columnAutoWidth
        noDataText={isLoading ? tp('waterQuality.index.grid.loading') : tp('waterQuality.index.grid.empty')}
        data-testid="wq-records-grid"
      >
        <Paging pageSize={20} />
        <Pager visible showPageSizeSelector allowedPageSizes={[20, 50, 100]} />
        <Column dataField="id" caption="#" width={60} />
        <Column dataField="performedAt" caption={tp('waterQuality.index.grid.performedAt')} dataType="datetime" width={170} />
        <Column dataField="samplePointName" caption={tp('waterQuality.index.grid.samplePoint')} />
        <Column dataField="systemName" caption={tp('waterQuality.index.grid.system')} />
        <Column dataField="operatorName" caption={tp('waterQuality.index.grid.operator')} width={150} />
        <Column dataField="overallResult" caption={tp('waterQuality.index.grid.overallResult')} width={170} cellRender={(c) => resultBadge(c.value, tp)} />
        <Column
          caption={tp('waterQuality.index.grid.actions')}
          width={210}
          cellRender={(c) => {
            const row = c.data as TestRow;
            return (
              <div className="flex gap-1">
                {/* Both ดู and แก้ไข open the popup in VIEW mode. The user then
                    clicks the in-popup "แก้ไข" to enter edit mode AFTER the
                    DevExtreme overlay has settled — toggling edit mode while the
                    overlay is still mounting crashed the page (insertBefore DOM
                    error). This matches the stable inspection-history flow. */}
                <Button stylingMode="outlined" onClick={() => { setEditMode(false); setViewId(row.id); }} data-testid={`wq-view-${row.id}`}>
                  <span className="inline-flex items-center gap-1 text-xs"><Eye className="w-3 h-3" /> {tp('waterQuality.index.view')}</span>
                </Button>
                <Button stylingMode="outlined" onClick={() => { setEditMode(false); setViewId(row.id); }} data-testid={`wq-edit-${row.id}`}>
                  <span className="inline-flex items-center gap-1 text-xs"><Pencil className="w-3 h-3" /> {tp('waterQuality.common.actions.edit')}</span>
                </Button>
                <Button stylingMode="text" type="danger" onClick={() => setDeleteTarget(row)} data-testid={`wq-delete-${row.id}`}>
                  <span className="inline-flex items-center gap-1 text-xs"><Trash2 className="w-3 h-3" /> {tp('waterQuality.common.actions.delete')}</span>
                </Button>
              </div>
            );
          }}
        />
      </DataGrid>

      {/* ===== Record new ===== */}
      <Popup visible={testOpen} onHiding={() => setTestOpen(false)} showCloseButton title={tp('waterQuality.index.popup.recordTitle')} width={580} height="auto">
        <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
          {/* Decoy fields absorb browser credential autofill so it doesn't land
              on the reading / password inputs. */}
          <input type="text" name="fake-username" autoComplete="username" tabIndex={-1} aria-hidden="true"
            style={{ position: 'absolute', opacity: 0, height: 0, width: 0, pointerEvents: 'none' }} readOnly />
          <input type="password" name="fake-password" autoComplete="new-password" tabIndex={-1} aria-hidden="true"
            style={{ position: 'absolute', opacity: 0, height: 0, width: 0, pointerEvents: 'none' }} readOnly />
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
              inputAttr={{ autoComplete: 'off', name: 'wq-sample-point', 'data-lpignore': 'true', 'data-form-type': 'other' }}
            />
          </div>
          {selectedPoint && (specs ?? []).map((s) => (
            <div key={s.id} className="border rounded p-3 space-y-1">
              <div className="font-medium">
                {s.parameter} ({s.unit})
                {s.specMin != null || s.specMax != null ? (
                  <span className="text-xs text-gray-500 ml-2">{tp('waterQuality.index.popup.specRange', { min: s.specMin ?? '-', max: s.specMax ?? '-' })}</span>
                ) : null}
              </div>
              <NumberBox
                value={results[s.id] ?? undefined}
                onValueChanged={(e) => setResults((prev) => ({ ...prev, [s.id]: Number(e.value ?? 0) }))}
                step={0.001}
                format="#0.000"
                placeholder={t('form.value')}
                inputAttr={{ autoComplete: 'off', name: `wq-result-${s.id}`, 'data-lpignore': 'true', 'data-form-type': 'other' }}
              />
            </div>
          ))}
          {selectedPoint && (specs ?? []).length === 0 && (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded p-3 text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                {tp('waterQuality.index.popup.noSpecBefore')}{' '}
                <Link href="/premises/environmental/water-quality/settings" className="underline">{tp('waterQuality.index.popup.noSpecLink')}</Link> {tp('waterQuality.index.popup.noSpecAfter')}
              </span>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">{t('form.notes')}</label>
            <TextArea value={notes} height={60} onValueChanged={(e) => setNotes(String(e.value ?? ''))} inputAttr={{ autoComplete: 'off', name: 'wq-notes', 'data-lpignore': 'true', 'data-form-type': 'other' }} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{tp('waterQuality.index.popup.password')}</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border rounded px-3 py-2" autoComplete="new-password" data-lpignore="true" data-form-type="other" />
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

      {/* ===== View / edit =====
          The body is ALWAYS mounted (never swapped on the editMode toggle). Each
          measured value renders both the read-only <span> and the edit <input>
          at once, toggling visibility with CSS `hidden` rather than mounting /
          unmounting nodes. Adding or removing a DOM node inside the DevExtreme
          popup overlay (which DevExtreme manages outside React's tree) is what
          threw insertBefore/removeChild (NotFoundError) → global error page.
          Keeping the node set constant means React only flips classNames, so the
          overlay's DOM never shifts under it. */}
      <Popup
        visible={viewId != null}
        onHiding={closeView}
        showCloseButton
        title={detail ? tp('waterQuality.index.detail.title', { id: detail.id, point: detail.samplePointName ?? '' }) : tp('waterQuality.index.detail.titleFallback')}
        width={680}
        height="auto"
      >
        <div className="p-4 space-y-3 max-h-[75vh] overflow-y-auto">
          {!detail ? (
            <div className="text-gray-500 text-sm">{tp('waterQuality.index.detail.loading')}</div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-gray-500">{tp('waterQuality.index.detail.dateTime')}</span> {new Date(detail.performedAt).toLocaleString('th-TH')}</div>
                <div><span className="text-gray-500">{tp('waterQuality.index.detail.operator')}</span> {detail.operatorName ?? '—'}</div>
                <div><span className="text-gray-500">{tp('waterQuality.index.detail.system')}</span> {detail.systemName ?? '—'}</div>
                <div><span className="text-gray-500">{tp('waterQuality.index.detail.overallResult')}</span> {resultBadge(detail.overallResult, tp)}</div>
              </div>

              <div className="border rounded">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-left p-2">{tp('waterQuality.index.detail.parameter')}</th>
                      <th className="text-left p-2 w-32">{tp('waterQuality.index.detail.measuredValue')}</th>
                      <th className="text-left p-2 w-28">{tp('waterQuality.index.detail.spec')}</th>
                      <th className="text-left p-2 w-24">{tp('waterQuality.index.detail.result')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.results.map((r) => (
                      <tr key={r.id} className="border-t">
                        <td className="p-2">{r.parameter} {r.unit ? <span className="text-gray-400">({r.unit})</span> : null}</td>
                        <td className="p-2">
                          {/* Both the read-only span and the edit input are
                              ALWAYS mounted; only their `hidden` class flips on
                              editMode. Mounting/unmounting a node inside the
                              DevExtreme popup overlay is what threw the
                              insertBefore DOM error → error page. */}
                          <span className={editMode ? 'hidden' : ''}>{r.numericValue ?? '—'}</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.001"
                            className={`w-28 border rounded px-2 py-1 text-sm ${editMode ? '' : 'hidden'}`}
                            value={draft.results[r.id] ?? ''}
                            onChange={(e) =>
                              setDraft((prev) => ({
                                ...prev,
                                results: {
                                  ...prev.results,
                                  [r.id]: e.target.value === '' ? null : Number(e.target.value),
                                },
                              }))
                            }
                          />
                        </td>
                        <td className="p-2 text-gray-500">{r.specMinSnapshot ?? '-'} – {r.specMaxSnapshot ?? '-'}</td>
                        <td className="p-2">{resultBadge(r.result, tp)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">{tp('waterQuality.index.detail.notes')}</label>
                {/* Both nodes always mounted; CSS toggle only (see value cell). */}
                <div className={`text-sm text-gray-700 ${editMode ? 'hidden' : ''}`}>{detail.notes ?? '—'}</div>
                <textarea
                  className={`w-full border rounded px-2 py-1 text-sm ${editMode ? '' : 'hidden'}`}
                  rows={2}
                  value={draft.notes}
                  onChange={(e) => setDraft((prev) => ({ ...prev, notes: e.target.value }))}
                />
              </div>

              <div className={`bg-amber-50 border border-amber-200 text-amber-900 rounded p-2 text-xs ${editMode ? '' : 'hidden'}`}>
                {tp('waterQuality.index.detail.editWarning')}
              </div>

              {/* All four buttons always mounted; the inactive pair is hidden via
                  CSS so the overlay's DOM never changes shape on editMode. */}
              <div className="flex justify-end gap-2 pt-2">
                <div className={`flex gap-2 ${editMode ? 'hidden' : ''}`}>
                  <Button text={tp('waterQuality.index.detail.close')} stylingMode="text" onClick={closeView} />
                  <Button type="default" stylingMode="contained" onClick={() => startEdit(detail)}>
                    <span className="inline-flex items-center gap-1"><Pencil className="w-4 h-4" /> {tp('waterQuality.common.actions.edit')}</span>
                  </Button>
                </div>
                <div className={`flex gap-2 ${editMode ? '' : 'hidden'}`}>
                  <Button text={tp('waterQuality.common.actions.cancel')} stylingMode="text" onClick={() => setEditMode(false)} disabled={saveMut.isPending} />
                  <Button type="success" stylingMode="contained" text={tp('waterQuality.index.detail.saveEdit')} disabled={saveMut.isPending} onClick={() => saveMut.mutate()} />
                </div>
              </div>
            </>
          )}
        </div>
      </Popup>

      <ConfirmationDialog
        visible={!!deleteTarget}
        title={tp('waterQuality.index.delete.title')}
        message={
          deleteTarget
            ? tp('waterQuality.index.delete.message', {
                id: deleteTarget.id,
                point: deleteTarget.samplePointName ?? '',
                dateTime: new Date(deleteTarget.performedAt).toLocaleString('th-TH'),
              })
            : ''
        }
        confirmText={tp('waterQuality.index.delete.confirm')}
        cancelText={tp('waterQuality.common.actions.cancel')}
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
