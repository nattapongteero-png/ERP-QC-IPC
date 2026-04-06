'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ResponsivePageHeader } from '@/components/shared';
import { DxDataGrid, DxColumn, DxPaging, DxSearchPanel } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { FlaskConical, Edit } from 'lucide-react';

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
  isCritical: boolean;
  isActive: boolean;
}

export default function IPCCriteriaPage() {
  const router = useRouter();

  const { data: criteria, isLoading } = useQuery<IPCCriteria[]>({
    queryKey: ['ipc-criteria'],
    queryFn: async () => {
      const res = await fetch('/api/master-data/ipc-criteria');
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
  });

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 w-full max-w-full overflow-hidden box-border">
      <ResponsivePageHeader
        title="IPC Criteria"
        subtitle="In-Process Control test criteria for production quality"
        icon={FlaskConical}
        iconBgColor="bg-emerald-100"
        iconColor="text-emerald-600"
        onBack={() => router.push('/master-data')}
        breadcrumbs={[
          { label: 'Master Data', href: '/master-data' },
          { label: 'IPC Criteria' },
        ]}
        actions={
          <DxButton text="Add Criteria" icon="plus" type="success" onClick={() => router.push('/master-data/ipc-criteria/new')} />
        }
      />

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <DxDataGrid
          dataSource={criteria || []}
          keyExpr="id"
          showBorders={false}
          rowAlternationEnabled
          loading={isLoading}
          height="auto"
          width="100%"
          columnAutoWidth
        >
          <DxSearchPanel visible placeholder="Search..." width={200} />
          <DxPaging defaultPageSize={20} />

          <DxColumn dataField="code" caption="Code" minWidth={120} cellRender={(cell) => (
            <span className="font-mono font-medium text-emerald-700">{cell.value}</span>
          )} />
          <DxColumn dataField="name" caption="Name (EN)" minWidth={150} />
          <DxColumn dataField="nameTh" caption="ชื่อ (TH)" minWidth={150} />
          <DxColumn dataField="specification" caption="Specification" minWidth={130} />
          <DxColumn caption="Range" minWidth={120} cellRender={(cell) => {
            const d = cell.data as IPCCriteria;
            if (d.minValue == null && d.maxValue == null) return <span className="text-gray-400">-</span>;
            return <span className="text-sm">{d.minValue ?? '?'} - {d.maxValue ?? '?'} {d.unit || ''}</span>;
          }} />
          <DxColumn dataField="sampleSize" caption="Samples" width={80} alignment="center" />
          <DxColumn dataField="isCritical" caption="Critical" width={80} cellRender={(cell) => (
            cell.value ? <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Critical</span> : <span className="text-gray-400">-</span>
          )} />
          <DxColumn dataField="isActive" caption="Status" width={90} cellRender={(cell) => (
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cell.value ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
              {cell.value ? 'Active' : 'Inactive'}
            </span>
          )} />
          <DxColumn caption="Actions" width={90} cellRender={(cell) => (
            <div className="flex gap-1">
              <button onClick={() => router.push(`/master-data/ipc-criteria/${(cell.data as IPCCriteria).id}`)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit">
                <Edit className="h-4 w-4" />
              </button>
            </div>
          )} />
        </DxDataGrid>
      </div>
    </div>
  );
}
