'use client';

/**
 * Equipment Inspection Registry (ทะเบียนตรวจสอบอุปกรณ์) — replaces the scale-only
 * verification menu. Lists every active production equipment (in-line + off-line)
 * with its inspection due status, and records a checklist-based pass/fail
 * inspection. Scales additionally link to the standard-weight (ลูกตุ้ม) verify flow.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ResponsivePageHeader } from '@/components/shared';
import { DxDataGrid, DxColumn, DxPaging, DxSearchPanel } from '@/components/ui/dx-data-grid';
import { useToast } from '@/hooks/use-toast';
import { ClipboardCheck, Scale, X, Check } from 'lucide-react';

interface InspectionRow {
  id: number;
  code: string;
  name: string;
  nameTh: string;
  equipmentType: string;
  lineCategory: string | null;
  inspectionIntervalDays: number | null;
  inspectionChecklist: string | null;
  requirePreUseInspection: boolean;
  inspectedToday: boolean;
  preUseDueToday: boolean;
  lastResult: string | null;
  lastPerformedAt: string | null;
  nextDueDate: string | null;
  dueStatus: 'never' | 'ok' | 'due_soon' | 'overdue' | 'no_schedule';
}

const STATUS_STYLE: Record<string, string> = {
  never: 'bg-gray-100 text-gray-600',
  ok: 'bg-emerald-100 text-emerald-800',
  due_soon: 'bg-amber-100 text-amber-800',
  overdue: 'bg-red-100 text-red-800',
  no_schedule: 'bg-gray-100 text-gray-500',
};

export default function EquipmentInspectionPage() {
  const t = useTranslations('premises');
  const toast = useToast();
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState<'all' | 'in_line' | 'off_line'>('all');
  const [target, setTarget] = useState<InspectionRow | null>(null);
  const [checkState, setCheckState] = useState<Record<number, boolean>>({});
  const [notes, setNotes] = useState('');

  const { data: rows, isLoading } = useQuery<InspectionRow[]>({
    queryKey: ['equipment-inspections'],
    queryFn: async () => {
      const res = await fetch('/api/quality/equipment-inspections');
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
  });

  const filtered = useMemo(() => {
    const all = rows || [];
    if (filter === 'all') return all;
    if (filter === 'off_line') return all.filter((r) => r.lineCategory === 'off_line');
    return all.filter((r) => r.lineCategory !== 'off_line'); // in-line (null legacy => in-line)
  }, [rows, filter]);

  const checklistItems = useMemo<string[]>(() => {
    if (!target?.inspectionChecklist) return [];
    try {
      const parsed = JSON.parse(target.inspectionChecklist);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }, [target]);

  const openInspect = (row: InspectionRow) => {
    setTarget(row);
    setNotes('');
    setCheckState({});
  };

  const saveMutation = useMutation({
    mutationFn: async (result: 'pass' | 'fail') => {
      const checklistResults = checklistItems.map((item, i) => ({ item, ok: checkState[i] !== false }));
      const res = await fetch('/api/quality/equipment-inspections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipmentId: target!.id,
          inspectionType: 'routine',
          result,
          checklistResults,
          notes,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment-inspections'] });
      toast.success(t('equipmentInspection.saveSuccess'));
      setTarget(null);
    },
    onError: (e: Error) => toast.error(t('equipmentInspection.saveError'), e.message),
  });

  // Overall result = fail if any checklist item is explicitly failed.
  const anyFailed = checklistItems.some((_, i) => checkState[i] === false);

  const filterTabs: { key: typeof filter; label: string }[] = [
    { key: 'all', label: t('equipmentInspection.filterAll') },
    { key: 'in_line', label: t('equipmentInspection.filterInLine') },
    { key: 'off_line', label: t('equipmentInspection.filterOffLine') },
  ];

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 w-full max-w-full overflow-hidden box-border">
      <ResponsivePageHeader
        title={t('equipmentInspection.title')}
        subtitle={t('equipmentInspection.subtitle')}
        icon={ClipboardCheck}
        iconBgColor="bg-cyan-100"
        iconColor="text-cyan-600"
        breadcrumbs={[{ label: t('hub.title'), href: '/premises' }, { label: t('equipmentInspection.title') }]}
      />

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              filter === tab.key
                ? 'bg-cyan-600 text-white border-cyan-600'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
            data-testid={`eqinsp-filter-${tab.key}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-[18px] shadow-[0_6px_20px_rgba(6,78,59,0.07)] border border-emerald-100 p-4">
        <DxDataGrid
          dataSource={filtered}
          keyExpr="id"
          showBorders={false}
          rowAlternationEnabled
          loading={isLoading}
          height="auto"
          width="100%"
          columnAutoWidth
        >
          <DxSearchPanel visible placeholder="..." width={200} />
          <DxPaging defaultPageSize={20} />

          <DxColumn dataField="code" caption={t('equipmentInspection.colCode')} width={140} cellRender={(cell) => (
            <span className="font-mono font-medium text-cyan-700 whitespace-nowrap">{cell.value}</span>
          )} />
          <DxColumn dataField="nameTh" caption={t('equipmentInspection.colName')} minWidth={160} />
          <DxColumn dataField="equipmentType" caption={t('equipmentInspection.colType')} width={110} />
          <DxColumn dataField="lineCategory" caption={t('equipmentInspection.colUsage')} width={130} cellRender={(cell) => {
            const off = cell.value === 'off_line';
            return (
              <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${off ? 'bg-orange-100 text-orange-800' : 'bg-emerald-100 text-emerald-800'}`}>
                {off ? t('equipmentInspection.usageOffLine') : t('equipmentInspection.usageInLine')}
              </span>
            );
          }} />
          <DxColumn dataField="inspectionIntervalDays" caption={t('equipmentInspection.colInterval')} width={150} cellRender={(cell) => {
            const row = cell.data as InspectionRow;
            return (
              <div className="flex flex-col gap-0.5">
                <span className="whitespace-nowrap text-sm">
                  {cell.value ? t('equipmentInspection.intervalDays', { days: cell.value }) : t('equipmentInspection.intervalNone')}
                </span>
                {/* Pre-use rule: required per production run, but one pass covers
                    the whole day — so once it is inspected today it reads "done". */}
                {row.requirePreUseInspection && (
                  <span className={`inline-flex w-fit px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${
                    row.inspectedToday ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {row.inspectedToday
                      ? t('equipmentInspection.preUseDoneToday')
                      : t('equipmentInspection.preUseDueToday')}
                  </span>
                )}
              </div>
            );
          }} />
          <DxColumn dataField="lastPerformedAt" caption={t('equipmentInspection.colLast')} width={140} cellRender={(cell) => (
            <span className="whitespace-nowrap text-sm text-gray-600">
              {cell.value ? String(cell.value).slice(0, 10) : t('equipmentInspection.never')}
            </span>
          )} />
          <DxColumn dataField="dueStatus" caption={t('equipmentInspection.colStatus')} width={130} cellRender={(cell) => {
            const key = `status${cell.value.replace(/(^|_)([a-z])/g, (_: string, __: string, c: string) => c.toUpperCase())}`;
            return (
              <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLE[cell.value] || 'bg-gray-100 text-gray-600'}`}>
                {t(`equipmentInspection.${key}`)}
              </span>
            );
          }} />
          <DxColumn caption={t('equipmentInspection.colAction')} width={200} cellRender={(cell) => {
            const row = cell.data as InspectionRow;
            const isScale = row.equipmentType === 'scale' || row.equipmentType === 'balance';
            return (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => openInspect(row)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-white bg-cyan-600 hover:bg-cyan-700 transition-colors"
                  data-testid={`eqinsp-inspect-${row.id}`}
                >
                  <ClipboardCheck className="h-3.5 w-3.5" />
                  {t('equipmentInspection.inspect')}
                </button>
                {isScale && (
                  <Link
                    href="/premises/scale-verification"
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-cyan-700 border border-cyan-200 hover:bg-cyan-50 transition-colors"
                    title={t('equipmentInspection.scaleHint')}
                  >
                    <Scale className="h-3.5 w-3.5" />
                    {t('equipmentInspection.scaleVerifyLink')}
                  </Link>
                )}
              </div>
            );
          }} />
        </DxDataGrid>
      </div>

      {/* Inspect modal */}
      {target && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{t('equipmentInspection.modalTitle')}</h2>
                <p className="text-sm text-gray-500">{target.code} · {target.nameTh}</p>
              </div>
              <button onClick={() => setTarget(null)} className="p-1 hover:bg-gray-100 rounded-lg" data-testid="eqinsp-modal-close">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('equipmentInspection.checklistLabel')}</label>
                {checklistItems.length === 0 ? (
                  <p className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3 border">{t('equipmentInspection.noChecklist')}</p>
                ) : (
                  <div className="space-y-2">
                    {checklistItems.map((item, i) => {
                      const failed = checkState[i] === false;
                      return (
                        <div key={i} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-gray-100">
                          <span className="text-sm text-gray-800 flex-1">{item}</span>
                          <div className="flex gap-1">
                            <button
                              onClick={() => setCheckState((s) => ({ ...s, [i]: true }))}
                              className={`px-2.5 py-1 rounded text-xs font-medium ${!failed ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                            >
                              {t('equipmentInspection.itemPass')}
                            </button>
                            <button
                              onClick={() => setCheckState((s) => ({ ...s, [i]: false }))}
                              className={`px-2.5 py-1 rounded text-xs font-medium ${failed ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                            >
                              {t('equipmentInspection.itemFail')}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('equipmentInspection.notesLabel')}</label>
                <textarea
                  className="w-full min-h-[70px] rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t shrink-0">
              <button onClick={() => setTarget(null)} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50">
                {t('equipmentInspection.cancel')}
              </button>
              <button
                onClick={() => saveMutation.mutate(anyFailed ? 'fail' : 'pass')}
                disabled={saveMutation.isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50"
                data-testid="eqinsp-save"
              >
                <Check className="h-4 w-4" />
                {t('equipmentInspection.save')} ({anyFailed ? t('equipmentInspection.resultFail') : t('equipmentInspection.resultPass')})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
