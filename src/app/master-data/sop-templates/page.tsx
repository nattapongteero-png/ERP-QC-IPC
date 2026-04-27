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
  { value: 'line_clearance', label: 'Line Clearance' },
  { value: 'dispensing', label: 'Dispensing' },
  { value: 'preparation', label: 'Preparation' },
  { value: 'milling', label: 'Milling / Grinding' },
  { value: 'sieving', label: 'Sieving' },
  { value: 'drying', label: 'Drying' },
  { value: 'blending', label: 'Blending / Mixing' },
  { value: 'mixing', label: 'Mixing' },
  { value: 'heating', label: 'Heating' },
  { value: 'cooling', label: 'Cooling' },
  { value: 'filling', label: 'Filling' },
  { value: 'packaging', label: 'Packaging' },
  { value: 'ipc', label: 'In-Process Control' },
  { value: 'weighing', label: 'Weighing' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'other', label: 'Other' },
];

const categoryColors: Record<string, { bg: string; text: string }> = {
  line_clearance: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  dispensing: { bg: 'bg-blue-100', text: 'text-blue-800' },
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
  inspection: { bg: 'bg-indigo-100', text: 'text-indigo-800' },
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
      toast.success('Template Deactivated', 'The SOP template has been deactivated.');
    },
    onError: (error: Error) => {
      toast.error('Error', error.message);
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
        title="SOP Templates"
        subtitle="Manage SOP step templates for production processes"
        icon={FileText}
        iconBgColor="bg-amber-100"
        iconColor="text-amber-600"
        onBack={() => router.push('/master-data')}
        breadcrumbs={[
          { label: 'Master Data', href: '/master-data' },
          { label: 'SOP Templates' },
        ]}
        actions={
          <DxButton
            text="Add Template"
            icon="plus"
            type="success"
            onClick={handleCreate}
          />
        }
      />

      {/* Data Grid */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <DxDataGrid
          dataSource={templates || []}
          keyExpr="id"
          showBorders={false}
          rowAlternationEnabled
          loading={isLoading}
          height="auto"
          width="100%"
          columnAutoWidth
        >
          <DxSearchPanel visible placeholder="Search templates..." width={200} />
          <DxPaging defaultPageSize={20} />

          <DxColumn dataField="code" caption="Code" minWidth={140} cellRender={(cell) => (
            <span className="font-mono font-medium text-amber-700">{cell.value}</span>
          )} />
          <DxColumn dataField="name" caption="Name (EN)" minWidth={200} />
          <DxColumn dataField="nameTh" caption="Name (TH)" minWidth={200} />
          <DxColumn dataField="category" caption="Category" minWidth={160} cellRender={(cell) => renderCategoryBadge(cell.value)} />
          <DxColumn dataField="isActive" caption="Status" width={100} cellRender={(cell) => (
            <span className={`dx-cell-tag inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cell.value ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
              {cell.value ? 'Active' : 'Inactive'}
            </span>
          )} />
          <DxColumn caption="Actions" width={120} cellRender={(cell) => (
            <div className="flex gap-1">
              <button
                onClick={() => handleEdit((cell.data as SOPTemplate).id)}
                className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                title="View"
              >
                <Eye className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleEdit((cell.data as SOPTemplate).id)}
                className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                title="Edit"
              >
                <Edit className="h-4 w-4" />
              </button>
              <button
                onClick={() => { if (confirm(`ต้องการลบ ${(cell.data as SOPTemplate).nameTh || (cell.data as SOPTemplate).name} หรือไม่?`)) deleteMutation.mutate((cell.data as SOPTemplate).id); }}
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
