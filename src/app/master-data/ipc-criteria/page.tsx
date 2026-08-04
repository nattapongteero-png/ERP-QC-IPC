'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ResponsivePageHeader } from '@/components/shared';
import { DxDataGrid, DxColumn, DxPaging, DxSearchPanel } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { useToast } from '@/hooks/use-toast';
import { FlaskConical, Edit, Trash2, AlertCircle } from 'lucide-react';
import { formatSpecSummary, getCriteriaTypeLabel } from '@/lib/master-data/ipc-spec-payload';

interface IPCCriteria {
  id: number;
  code: string;
  name: string;
  nameTh: string | null;
  specification: string | null;
  minValue: number | null;
  maxValue: number | null;
  unit: string | null;
  sampleSize: number;
  criteriaType: string | null;
  isCritical: boolean;
  isActive: boolean;
}

// Render criteria type badge + parsed spec summary. Handles all 9 criteria
// types via the shared formatSpecSummary helper — multi_point / tare /
// calibration / calculated / custom_multi_field used to fall through and
// show '—'; now they get their own structured rendering.
function renderSpecCell(d: IPCCriteria) {
  const type = d.criteriaType || 'numeric';
  const lines = formatSpecSummary({
    criteriaType: type,
    specification: d.specification,
    minValue: d.minValue,
    maxValue: d.maxValue,
    unit: d.unit,
  });
  // Drop the lone fallback line that just repeats the type label — the badge
  // already conveys it.
  const visibleLines = lines.length === 1 && lines[0].tone === 'meta' && lines[0].text === getCriteriaTypeLabel(type)
    ? []
    : lines;
  return (
    <div className="text-sm space-y-1">
      <span className="inline-flex text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded">
        {getCriteriaTypeLabel(type)}
      </span>
      {visibleLines.map((ln: { icon: string; text: string; tone?: string }, i: number) => (
        <div
          key={i}
          className={`text-sm flex items-start gap-1.5 ${
            ln.tone === 'pass' ? 'text-emerald-700'
            : ln.tone === 'fail' ? 'text-rose-700'
            : 'text-gray-700'
          }`}
        >
          <span className="flex-none w-4 text-center">{ln.icon}</span>
          <span className="break-words">{ln.text}</span>
        </div>
      ))}
    </div>
  );
}

export default function IPCCriteriaPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const tRoot = useTranslations('masterData');
  const t = (k: string, values?: Record<string, string | number>) =>
    tRoot(`ipcCriteria.${k}`, values as never);

  const { data: criteria, isLoading } = useQuery<IPCCriteria[]>({
    queryKey: ['ipc-criteria'],
    queryFn: async () => {
      const res = await fetch('/api/master-data/ipc-criteria');
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/master-data/ipc-criteria?id=${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: (result: { data?: { mode?: 'deleted' | 'disabled' } }) => {
      queryClient.invalidateQueries({ queryKey: ['ipc-criteria'] });
      if (result?.data?.mode === 'disabled') {
        toast.success(t('disabledTitle'), t('disabledBody'));
      } else {
        toast.success(t('deletedTitle'), t('deletedBody'));
      }
    },
    onError: (error: Error) => toast.error(t('errorTitle'), error.message),
  });

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 w-full max-w-full overflow-hidden box-border">
      <ResponsivePageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        icon={FlaskConical}
        iconBgColor="bg-emerald-100"
        iconColor="text-emerald-600"
        onBack={() => router.push('/master-data')}
        breadcrumbs={[
          { label: t('breadcrumbMasterData'), href: '/master-data' },
          { label: t('title') },
        ]}
        actions={
          <DxButton text={t('addCriteria')} icon="plus" type="success" onClick={() => router.push('/master-data/ipc-criteria/new')} />
        }
      />

      {/* Desktop / Tablet — DataGrid */}
      <div className="hidden md:block bg-white rounded-[18px] shadow-[0_6px_20px_rgba(6,78,59,0.07)] border border-emerald-100 p-4">
        <DxDataGrid
          dataSource={(criteria || []).map((c: IPCCriteria, i: number) => ({ ...c, _rowNumber: i + 1 }))}
          keyExpr="id"
          showBorders={false}
          rowAlternationEnabled
          loading={isLoading}
          height="auto"
          width="100%"
          columnAutoWidth={false}
        >
          <DxSearchPanel visible placeholder={t('searchPlaceholder')} width={200} />
          <DxPaging defaultPageSize={20} />

          <DxColumn dataField="_rowNumber" caption="#" width={50} alignment="center" allowFiltering={false} allowSorting={false} cellRender={(cell) => (
            <span className="text-gray-500 text-sm font-medium">{cell.value}</span>
          )} />
          <DxColumn caption={t('colCodeName')} minWidth={220} cellRender={(cell) => {
            const d = cell.data as IPCCriteria;
            return (
              <div className="flex flex-col">
                <span className="font-mono text-sm font-semibold text-emerald-700">{d.code}</span>
                <span className="text-sm font-medium text-gray-900 truncate" title={d.nameTh || d.name}>{d.nameTh || d.name}</span>
                {d.nameTh && d.name !== d.nameTh && (
                  <span className="text-xs text-gray-500 truncate" title={d.name}>{d.name}</span>
                )}
              </div>
            );
          }} />
          <DxColumn caption={t('colSpec')} minWidth={180} cellRender={(cell) => renderSpecCell(cell.data as IPCCriteria)} />
          {/* width must fit the caption itself — at 80px the Thai caption overflowed
              the header cell and printed on top of the next column's caption. */}
          <DxColumn dataField="sampleSize" caption={t('colSampleSize')} width={125} alignment="center" cellRender={(cell) => (
            <span className="font-mono text-sm">{cell.value}</span>
          )} />
          <DxColumn caption={t('colStatus')} width={170} cellRender={(cell) => {
            const d = cell.data as IPCCriteria;
            return (
              <div className="flex flex-nowrap items-center gap-1">
                {d.isCritical && (
                  <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded whitespace-nowrap">
                    <AlertCircle className="h-3 w-3" />{t('critical')}
                  </span>
                )}
                <span className={`inline-flex text-xs font-semibold px-2 py-0.5 rounded border whitespace-nowrap ${
                  d.isActive
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-gray-50 text-gray-500 border-gray-200'
                }`}>
                  {d.isActive ? t('active') : t('inactive')}
                </span>
              </div>
            );
          }} />
          <DxColumn caption={t('colActions')} width={100} alignment="center" cellRender={(cell) => (
            <div className="flex gap-1 justify-center">
              <button onClick={() => router.push(`/master-data/ipc-criteria/${(cell.data as IPCCriteria).id}`)} className="p-1.5 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors" title={t('edit')} aria-label={t('edit')}>
                <Edit className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  if (confirm(t('confirmDelete', { name: (cell.data as IPCCriteria).name }))) {
                    deleteMutation.mutate((cell.data as IPCCriteria).id);
                  }
                }}
                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                title={t('delete')}
                aria-label={t('delete')}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )} />
        </DxDataGrid>
      </div>

      {/* Mobile — Card list */}
      <div className="md:hidden space-y-2">
        {isLoading ? (
          <div className="text-center py-8 text-gray-400">{t('loading')}</div>
        ) : (criteria || []).length === 0 ? (
          <div className="text-center py-8 text-gray-400">{t('empty')}</div>
        ) : (
          (criteria || []).map((d: IPCCriteria, i: number) => (
            <div key={d.id} className="bg-white border border-emerald-100 rounded-[18px] p-3 shadow-[0_6px_20px_rgba(6,78,59,0.07)]">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-bold text-gray-400 w-6">#{i + 1}</span>
                    <span className="font-mono text-xs font-semibold text-emerald-700">{d.code}</span>
                  </div>
                  <div className="text-sm font-medium text-gray-900">{d.nameTh || d.name}</div>
                  {d.nameTh && d.name !== d.nameTh && (
                    <div className="text-xs text-gray-500">{d.name}</div>
                  )}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => router.push(`/master-data/ipc-criteria/${d.id}`)} className="p-2 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors" title={t('edit')} aria-label={t('edit')}>
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(t('confirmDelete', { name: d.name }))) {
                        deleteMutation.mutate(d.id);
                      }
                    }}
                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title={t('delete')}
                    aria-label={t('delete')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="text-xs space-y-1">
                <div>
                  <span className="text-gray-500">{t('specLabel')}: </span>
                  {renderSpecCell(d)}
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-gray-500">{t('sampleSizeLabel')}: <span className="font-mono font-semibold text-gray-700">{d.sampleSize}</span></span>
                  {d.isCritical && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">
                      <AlertCircle className="h-2.5 w-2.5" />{t('critical')}
                    </span>
                  )}
                  <span className={`inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                    d.isActive
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-gray-50 text-gray-500 border-gray-200'
                  }`}>
                    {d.isActive ? t('active') : t('inactive')}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
