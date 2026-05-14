'use client';

import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ResponsivePageHeader } from '@/components/shared';
import { DxDataGrid, DxColumn, DxPaging, DxSearchPanel } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { useToast } from '@/hooks/use-toast';
import { FlaskConical, Edit, Trash2, AlertCircle } from 'lucide-react';

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

// Render criteria type + spec in a human-readable way. The `specification`
// field holds raw text for numeric ("200 ± 10 mg") OR serialized JSON for
// pass_fail / visual / text criteria. We unwrap to show what the operator
// actually needs to test.
function renderSpecCell(d: IPCCriteria) {
  const type = d.criteriaType || 'numeric';

  if (type === 'numeric') {
    // For numeric, show min-max range when present
    if (d.minValue != null || d.maxValue != null) {
      return (
        <div className="text-sm">
          <div className="font-mono">
            {d.minValue ?? '?'} – {d.maxValue ?? '?'}
            {d.unit && <span className="text-gray-500 ml-1">{d.unit}</span>}
          </div>
          {d.specification && !d.specification.startsWith('{') && (
            <div className="text-xs text-gray-500 truncate">{d.specification}</div>
          )}
        </div>
      );
    }
    return <span className="text-gray-400 text-sm">—</span>;
  }

  // Non-numeric: try to parse JSON spec
  let parsed: { passDefinition?: string; failDefinition?: string; description?: string; format?: string; example?: string } | null = null;
  if (d.specification) {
    try {
      const obj = JSON.parse(d.specification);
      if (obj && typeof obj === 'object') parsed = obj;
    } catch {
      // not JSON — show as plain text
    }
  }

  if (type === 'pass_fail') {
    return (
      <div className="text-sm">
        <span className="inline-flex text-[10px] font-semibold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">PASS / FAIL</span>
        {parsed?.passDefinition && (
          <div className="text-xs text-gray-600 mt-0.5 truncate" title={parsed.passDefinition}>
            ✓ {parsed.passDefinition}
          </div>
        )}
      </div>
    );
  }

  if (type === 'visual') {
    return (
      <div className="text-sm">
        <span className="inline-flex text-[10px] font-semibold bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded">VISUAL</span>
        {parsed?.description && (
          <div className="text-xs text-gray-600 mt-0.5 truncate" title={parsed.description}>
            👁 {parsed.description}
          </div>
        )}
      </div>
    );
  }

  if (type === 'text') {
    return (
      <div className="text-sm">
        <span className="inline-flex text-[10px] font-semibold bg-slate-50 text-slate-700 px-1.5 py-0.5 rounded">TEXT</span>
        {(parsed?.format || parsed?.example) && (
          <div className="text-xs text-gray-600 mt-0.5 truncate" title={parsed?.format || parsed?.example}>
            {parsed?.format || parsed?.example}
          </div>
        )}
      </div>
    );
  }

  // Fallback: show specification text if not JSON
  if (d.specification && !d.specification.startsWith('{')) {
    return <span className="text-sm">{d.specification}</span>;
  }
  return <span className="text-gray-400 text-sm">—</span>;
}

export default function IPCCriteriaPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ipc-criteria'] });
      toast.success('ลบสำเร็จ', 'QC & IPC Criteria ถูกลบเรียบร้อย');
    },
    onError: (error: Error) => toast.error('Error', error.message),
  });

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 w-full max-w-full overflow-hidden box-border">
      <ResponsivePageHeader
        title="QC & IPC Criteria"
        subtitle="In-Process Control test criteria for production quality"
        icon={FlaskConical}
        iconBgColor="bg-emerald-100"
        iconColor="text-emerald-600"
        onBack={() => router.push('/master-data')}
        breadcrumbs={[
          { label: 'Master Data', href: '/master-data' },
          { label: 'QC & IPC Criteria' },
        ]}
        actions={
          <DxButton text="Add Criteria" icon="plus" type="success" onClick={() => router.push('/master-data/ipc-criteria/new')} />
        }
      />

      {/* Desktop / Tablet — DataGrid */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <DxDataGrid
          dataSource={(criteria || []).map((c: any, i: number) => ({ ...c, _rowNumber: i + 1 }))}
          keyExpr="id"
          showBorders={false}
          rowAlternationEnabled
          loading={isLoading}
          height="auto"
          width="100%"
          columnAutoWidth={false}
        >
          <DxSearchPanel visible placeholder="Search..." width={200} />
          <DxPaging defaultPageSize={20} />

          <DxColumn dataField="_rowNumber" caption="#" width={50} alignment="center" allowFiltering={false} allowSorting={false} cellRender={(cell) => (
            <span className="text-gray-500 text-sm font-medium">{cell.value}</span>
          )} />
          <DxColumn caption="Code / Name" minWidth={220} cellRender={(cell) => {
            const d = cell.data as IPCCriteria;
            return (
              <div className="flex flex-col">
                <span className="font-mono text-xs font-semibold text-emerald-700">{d.code}</span>
                <span className="text-sm font-medium text-gray-900 truncate" title={d.nameTh || d.name}>{d.nameTh || d.name}</span>
                {d.nameTh && d.name !== d.nameTh && (
                  <span className="text-xs text-gray-500 truncate" title={d.name}>{d.name}</span>
                )}
              </div>
            );
          }} />
          <DxColumn caption="Spec / เกณฑ์" minWidth={180} cellRender={(cell) => renderSpecCell(cell.data as IPCCriteria)} />
          <DxColumn dataField="sampleSize" caption="Samples" width={80} alignment="center" cellRender={(cell) => (
            <span className="font-mono text-sm">{cell.value}</span>
          )} />
          <DxColumn caption="Flags" width={140} cellRender={(cell) => {
            const d = cell.data as IPCCriteria;
            return (
              <div className="flex flex-wrap gap-1">
                {d.isCritical && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">
                    <AlertCircle className="h-2.5 w-2.5" />Critical
                  </span>
                )}
                <span className={`inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                  d.isActive
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-gray-50 text-gray-500 border-gray-200'
                }`}>
                  {d.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            );
          }} />
          <DxColumn caption="Actions" width={100} alignment="center" fixed={true} fixedPosition="right" cellRender={(cell) => (
            <div className="flex gap-1 justify-center">
              <button onClick={() => router.push(`/master-data/ipc-criteria/${(cell.data as IPCCriteria).id}`)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit">
                <Edit className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  if (confirm(`ต้องการลบ ${(cell.data as IPCCriteria).name} หรือไม่?`)) {
                    deleteMutation.mutate((cell.data as IPCCriteria).id);
                  }
                }}
                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                title="Delete"
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
          <div className="text-center py-8 text-gray-400">กำลังโหลด...</div>
        ) : (criteria || []).length === 0 ? (
          <div className="text-center py-8 text-gray-400">ยังไม่มีข้อมูล QC & IPC Criteria</div>
        ) : (
          (criteria || []).map((d: IPCCriteria, i: number) => (
            <div key={d.id} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
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
                  <button onClick={() => router.push(`/master-data/ipc-criteria/${d.id}`)} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit">
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`ต้องการลบ ${d.name} หรือไม่?`)) {
                        deleteMutation.mutate(d.id);
                      }
                    }}
                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="text-xs space-y-1">
                <div>
                  <span className="text-gray-500">เกณฑ์: </span>
                  {renderSpecCell(d)}
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-gray-500">Samples: <span className="font-mono font-semibold text-gray-700">{d.sampleSize}</span></span>
                  {d.isCritical && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">
                      <AlertCircle className="h-2.5 w-2.5" />Critical
                    </span>
                  )}
                  <span className={`inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                    d.isActive
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-gray-50 text-gray-500 border-gray-200'
                  }`}>
                    {d.isActive ? 'Active' : 'Inactive'}
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
