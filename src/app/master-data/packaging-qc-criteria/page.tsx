'use client';

/**
 * Packaging QC Criteria Master Data Page
 * Manages packaging quality control criteria for GMP compliance.
 */

import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ResponsivePageHeader } from '@/components/shared';
import { DxDataGrid, DxColumn, DxPaging, DxSearchPanel } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { useToast } from '@/hooks/use-toast';
import { Scale, Package, Eye, Edit, Trash2 } from 'lucide-react';

interface PackagingQCCriteria {
  id: number;
  code: string;
  name: string;
  weightMin: number;
  weightMax: number;
  sampleSize: number;
  maxFailures: number;
  checkIntervalMinutes: number;
  unitsPerPack: number;
  isActive: boolean;
}

export default function PackagingQCCriteriaPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();

  // Fetch criteria
  const { data: criteria, isLoading } = useQuery<PackagingQCCriteria[]>({
    queryKey: ['packaging-qc-criteria'],
    queryFn: async () => {
      const res = await fetch('/api/master-data/packaging-qc-criteria');
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/master-data/packaging-qc-criteria?id=${id}`, {
        method: 'DELETE',
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packaging-qc-criteria'] });
      toast.success('Criteria Deactivated', 'The packaging QC criteria has been deactivated.');
    },
    onError: (error: Error) => {
      toast.error('Error', error.message);
    },
  });

  const handleCreate = () => {
    router.push('/master-data/packaging-qc-criteria/new');
  };

  const handleEdit = (id: number) => {
    router.push(`/master-data/packaging-qc-criteria/${id}`);
  };

  const renderWeightRange = (data: PackagingQCCriteria) => {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
        <Scale className="h-3 w-3" />
        {data.weightMin}-{data.weightMax}g
      </span>
    );
  };

  const renderSampleCriteria = (data: PackagingQCCriteria) => {
    return (
      <span className="text-gray-600">
        {data.maxFailures}/{data.sampleSize} fail
      </span>
    );
  };

  const renderPackInfo = (data: PackagingQCCriteria) => {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <Package className="h-3 w-3" />
        {data.unitsPerPack}/pack
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 w-full max-w-full overflow-hidden box-border">
      {/* Header */}
      <ResponsivePageHeader
        title="Packaging QC Criteria"
        subtitle="Manage packaging quality control criteria for weight and integrity checks"
        icon={Scale}
        iconBgColor="bg-indigo-100"
        iconColor="text-indigo-600"
        onBack={() => router.push('/master-data')}
        breadcrumbs={[
          { label: 'Master Data', href: '/master-data' },
          { label: 'Packaging QC Criteria' },
        ]}
        actions={
          <DxButton
            text="Add Criteria"
            icon="plus"
            type="success"
            onClick={handleCreate}
          />
        }
      />

      {/* Data Grid */}
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
          <DxSearchPanel visible placeholder="Search criteria..." width={200} />
          <DxPaging defaultPageSize={20} />

          <DxColumn dataField="code" caption="Code" width={120} cellRender={(cell) => (
            <span className="font-mono font-medium text-indigo-700">{cell.value}</span>
          )} />
          <DxColumn dataField="name" caption="Criteria Name" minWidth={200} />
          <DxColumn caption="Weight Range" width={140} cellRender={(cell) => renderWeightRange(cell.data)} />
          <DxColumn caption="Sample Criteria" width={140} cellRender={(cell) => renderSampleCriteria(cell.data)} />
          <DxColumn dataField="checkIntervalMinutes" caption="Check Interval" width={130} cellRender={(cell) => (
            <span className="text-gray-600">Every {cell.value} min</span>
          )} />
          <DxColumn caption="Units/Pack" width={120} cellRender={(cell) => renderPackInfo(cell.data)} />
          <DxColumn dataField="isActive" caption="Status" width={100} cellRender={(cell) => (
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cell.value ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
              {cell.value ? 'Active' : 'Inactive'}
            </span>
          )} />
          <DxColumn caption="Actions" width={120} cellRender={(cell) => (
            <div className="flex gap-1">
              <button
                onClick={() => handleEdit((cell.data as PackagingQCCriteria).id)}
                className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                title="View"
              >
                <Eye className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleEdit((cell.data as PackagingQCCriteria).id)}
                className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                title="Edit"
              >
                <Edit className="h-4 w-4" />
              </button>
              <button
                onClick={() => { if (confirm(`ต้องการลบ ${(cell.data as PackagingQCCriteria).name} หรือไม่?`)) deleteMutation.mutate((cell.data as PackagingQCCriteria).id); }}
                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                title="Deactivate"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )} />
        </DxDataGrid>
      </div>
    </div>
  );
}
