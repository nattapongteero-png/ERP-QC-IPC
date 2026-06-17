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
      toast.success('ปิดใช้งานเกณฑ์แล้ว', 'ปิดใช้งานเกณฑ์ QC บรรจุภัณฑ์เรียบร้อยแล้ว');
    },
    onError: (error: Error) => {
      toast.error('ผิดพลาด', error.message);
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
      <span className="dx-cell-tag inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
        <Scale className="h-3 w-3 flex-shrink-0" />
        {data.weightMin}-{data.weightMax}g
      </span>
    );
  };

  const renderSampleCriteria = (data: PackagingQCCriteria) => {
    return (
      <span className="text-gray-600 whitespace-nowrap">
        {data.maxFailures}/{data.sampleSize} ไม่ผ่าน
      </span>
    );
  };

  const renderPackInfo = (data: PackagingQCCriteria) => {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <Package className="h-3 w-3" />
        {data.unitsPerPack}/แพ็ก
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 w-full max-w-full overflow-hidden box-border">
      {/* Header */}
      <ResponsivePageHeader
        title="เกณฑ์ QC บรรจุภัณฑ์"
        subtitle="จัดการเกณฑ์ควบคุมคุณภาพบรรจุภัณฑ์สำหรับการตรวจน้ำหนักและความสมบูรณ์"
        icon={Scale}
        iconBgColor="bg-emerald-100"
        iconColor="text-emerald-600"
        onBack={() => router.push('/master-data')}
        breadcrumbs={[
          { label: 'ข้อมูลหลัก', href: '/master-data' },
          { label: 'เกณฑ์ QC บรรจุภัณฑ์' },
        ]}
        actions={
          <DxButton
            text="เพิ่มเกณฑ์"
            icon="plus"
            type="success"
            onClick={handleCreate}
          />
        }
      />

      {/* Data Grid */}
      <div className="bg-white rounded-[18px] shadow-[0_6px_20px_rgba(6,78,59,0.07)] border border-emerald-100 p-4">
        <DxDataGrid
          dataSource={(criteria || []).map((c, i) => ({ ...c, _rowNumber: i + 1 }))}
          keyExpr="id"
          showBorders={false}
          rowAlternationEnabled
          loading={isLoading}
          height="auto"
          width="100%"
          columnAutoWidth
        >
          <DxSearchPanel visible placeholder="ค้นหาเกณฑ์..." width={200} />
          <DxPaging defaultPageSize={20} />

          <DxColumn dataField="_rowNumber" caption="#" width={60} alignment="center" allowFiltering={false} allowSorting={false} cellRender={(cell) => (
            <span className="text-gray-500 text-sm font-medium">{cell.value}</span>
          )} />
          <DxColumn dataField="code" caption="รหัส" width={170} cellRender={(cell) => (
            <span className="font-mono font-medium text-emerald-700 whitespace-nowrap">{cell.value}</span>
          )} />
          <DxColumn dataField="name" caption="ชื่อเกณฑ์" minWidth={200} />
          <DxColumn caption="ช่วงน้ำหนัก" minWidth={160} cellRender={(cell) => renderWeightRange(cell.data)} />
          <DxColumn caption="เกณฑ์ตัวอย่าง" width={140} cellRender={(cell) => renderSampleCriteria(cell.data)} />
          <DxColumn dataField="checkIntervalMinutes" caption="รอบการตรวจ" width={130} cellRender={(cell) => (
            <span className="text-gray-600">ทุก {cell.value} นาที</span>
          )} />
          <DxColumn caption="หน่วย/แพ็ก" width={120} cellRender={(cell) => renderPackInfo(cell.data)} />
          <DxColumn dataField="isActive" caption="สถานะ" width={100} cellRender={(cell) => (
            <span className={`dx-cell-tag inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cell.value ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
              {cell.value ? 'ใช้งาน' : 'ไม่ใช้งาน'}
            </span>
          )} />
          <DxColumn caption="การดำเนินการ" width={120} cellRender={(cell) => (
            <div className="flex gap-1">
              <button
                onClick={() => handleEdit((cell.data as PackagingQCCriteria).id)}
                className="p-1.5 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors"
                title="ดู"
              >
                <Eye className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleEdit((cell.data as PackagingQCCriteria).id)}
                className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                title="แก้ไข"
              >
                <Edit className="h-4 w-4" />
              </button>
              <button
                onClick={() => { if (confirm(`ต้องการลบ ${(cell.data as PackagingQCCriteria).name} หรือไม่?`)) deleteMutation.mutate((cell.data as PackagingQCCriteria).id); }}
                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                title="ปิดใช้งาน"
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
