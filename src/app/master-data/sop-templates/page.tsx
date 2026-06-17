'use client';

/**
 * SOP Templates Master Data Page
 * Manages SOP step templates for production processes.
 */

import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ResponsivePageHeader } from '@/components/shared';
import { DxDataGrid, DxColumn, DxPaging, DxSearchPanel } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { useToast } from '@/hooks/use-toast';
import { FileText, ClipboardList, Eye, Edit, Trash2 } from 'lucide-react';

interface SOPTemplate {
  id: number;
  code: string;
  name: string;
  nameTh: string;
  category: string;
  instructions?: string;
  instructionsTh?: string;
  defaultParameters?: string;
  isActive: boolean;
}

const categories = [
  { value: 'line_clearance', label: 'การเคลียร์ไลน์ผลิต' },
  { value: 'dispensing', label: 'การจ่ายวัตถุดิบ' },
  { value: 'preparation', label: 'การเตรียม' },
  { value: 'milling', label: 'การบด / โม่' },
  { value: 'sieving', label: 'การร่อน' },
  { value: 'drying', label: 'การอบแห้ง' },
  { value: 'blending', label: 'การผสมรวม' },
  { value: 'mixing', label: 'การผสม' },
  { value: 'heating', label: 'การให้ความร้อน' },
  { value: 'cooling', label: 'การทำให้เย็น' },
  { value: 'filling', label: 'การบรรจุ' },
  { value: 'packaging', label: 'การบรรจุภัณฑ์' },
  { value: 'ipc', label: 'การควบคุมระหว่างผลิต' },
  { value: 'weighing', label: 'การชั่ง' },
  { value: 'cleaning', label: 'การทำความสะอาด' },
  { value: 'inspection', label: 'การตรวจสอบ' },
  { value: 'other', label: 'อื่นๆ' },
];

const categoryColors: Record<string, { bg: string; text: string }> = {
  line_clearance: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  dispensing: { bg: 'bg-emerald-100', text: 'text-emerald-800' },
  preparation: { bg: 'bg-amber-100', text: 'text-amber-800' },
  milling: { bg: 'bg-stone-100', text: 'text-stone-800' },
  sieving: { bg: 'bg-lime-100', text: 'text-lime-800' },
  drying: { bg: 'bg-orange-100', text: 'text-orange-800' },
  blending: { bg: 'bg-violet-100', text: 'text-violet-800' },
  mixing: { bg: 'bg-purple-100', text: 'text-purple-800' },
  heating: { bg: 'bg-red-100', text: 'text-red-800' },
  cooling: { bg: 'bg-cyan-100', text: 'text-cyan-800' },
  filling: { bg: 'bg-emerald-100', text: 'text-emerald-800' },
  packaging: { bg: 'bg-green-100', text: 'text-green-800' },
  ipc: { bg: 'bg-rose-100', text: 'text-rose-800' },
  weighing: { bg: 'bg-sky-100', text: 'text-sky-800' },
  cleaning: { bg: 'bg-teal-100', text: 'text-teal-800' },
  inspection: { bg: 'bg-emerald-100', text: 'text-emerald-800' },
  other: { bg: 'bg-gray-100', text: 'text-gray-800' },
};

export default function SOPTemplatesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();

  // Fetch templates
  const { data: templates, isLoading } = useQuery<SOPTemplate[]>({
    queryKey: ['sop-templates'],
    queryFn: async () => {
      const res = await fetch('/api/master-data/sop-templates');
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/master-data/sop-templates?id=${id}`, {
        method: 'DELETE',
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sop-templates'] });
      toast.success('ปิดใช้งานแม่แบบแล้ว', 'ปิดใช้งานแม่แบบ SOP เรียบร้อยแล้ว');
    },
    onError: (error: Error) => {
      toast.error('ผิดพลาด', error.message);
    },
  });

  const handleCreate = () => {
    router.push('/master-data/sop-templates/new');
  };

  const handleEdit = (id: number) => {
    router.push(`/master-data/sop-templates/${id}`);
  };

  const renderCategoryBadge = (category: string) => {
    const colors = categoryColors[category] || categoryColors.other;
    const label = categories.find((c) => c.value === category)?.label || category;
    return (
      <span className={`dx-cell-tag inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
        <ClipboardList className="h-3 w-3 flex-shrink-0" />
        {label}
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 w-full max-w-full overflow-hidden box-border">
      {/* Header */}
      <ResponsivePageHeader
        title="แม่แบบ SOP"
        subtitle="จัดการแม่แบบขั้นตอน SOP สำหรับกระบวนการผลิต"
        icon={FileText}
        iconBgColor="bg-amber-100"
        iconColor="text-amber-600"
        onBack={() => router.push('/master-data')}
        breadcrumbs={[
          { label: 'ข้อมูลหลัก', href: '/master-data' },
          { label: 'แม่แบบ SOP' },
        ]}
        actions={
          <DxButton
            text="เพิ่มแม่แบบ"
            icon="plus"
            type="success"
            onClick={handleCreate}
          />
        }
      />

      {/* Data Grid */}
      <div className="bg-white rounded-[18px] shadow-[0_6px_20px_rgba(6,78,59,0.07)] border border-emerald-100 p-4">
        <DxDataGrid
          dataSource={(templates || []).map((t, i) => ({ ...t, _rowNumber: i + 1 }))}
          keyExpr="id"
          showBorders={false}
          rowAlternationEnabled
          loading={isLoading}
          height="auto"
          width="100%"
          columnAutoWidth
        >
          <DxSearchPanel visible placeholder="ค้นหาแม่แบบ..." width={200} />
          <DxPaging defaultPageSize={20} />

          <DxColumn dataField="_rowNumber" caption="#" width={60} alignment="center" allowFiltering={false} allowSorting={false} cellRender={(cell) => (
            <span className="text-gray-500 text-sm font-medium">{cell.value}</span>
          )} />
          <DxColumn dataField="code" caption="รหัส" minWidth={140} cellRender={(cell) => (
            <span className="font-mono font-medium text-amber-700">{cell.value}</span>
          )} />
          <DxColumn dataField="name" caption="ชื่อ (EN)" minWidth={200} />
          <DxColumn dataField="nameTh" caption="ชื่อ (TH)" minWidth={200} />
          <DxColumn dataField="category" caption="หมวดหมู่" minWidth={160} cellRender={(cell) => renderCategoryBadge(cell.value)} />
          <DxColumn dataField="isActive" caption="สถานะ" width={100} cellRender={(cell) => (
            <span className={`dx-cell-tag inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cell.value ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
              {cell.value ? 'ใช้งาน' : 'ไม่ใช้งาน'}
            </span>
          )} />
          <DxColumn caption="การดำเนินการ" width={120} cellRender={(cell) => (
            <div className="flex gap-1">
              <button
                onClick={() => handleEdit((cell.data as SOPTemplate).id)}
                className="p-1.5 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors"
                title="ดู"
              >
                <Eye className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleEdit((cell.data as SOPTemplate).id)}
                className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                title="แก้ไข"
              >
                <Edit className="h-4 w-4" />
              </button>
              <button
                onClick={() => { if (confirm(`ต้องการลบ ${(cell.data as SOPTemplate).nameTh || (cell.data as SOPTemplate).name} หรือไม่?`)) deleteMutation.mutate((cell.data as SOPTemplate).id); }}
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
