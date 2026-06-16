'use client';

/**
 * Production Rooms Master Data Page
 * Manages production rooms/areas for GMP compliance.
 */

import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ResponsivePageHeader } from '@/components/shared';
import { DxDataGrid, DxColumn, DxPaging, DxSearchPanel } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { useToast } from '@/hooks/use-toast';
import { Building2, Eye, Edit, Trash2 } from 'lucide-react';

interface ProductionRoom {
  id: number;
  code: string;
  name: string;
  nameTh: string;
  roomType: string;
  description?: string;
  isActive: boolean;
}

const roomTypes = [
  { value: 'weighing', label: 'Weighing Room' },
  { value: 'mixing', label: 'Mixing Room' },
  { value: 'packaging', label: 'Packaging Room' },
  { value: 'storage', label: 'Storage Area' },
  { value: 'preparation', label: 'Preparation Room' },
  { value: 'production', label: 'Production Room' },
];

export default function ProductionRoomsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data: rooms, isLoading } = useQuery<ProductionRoom[]>({
    queryKey: ['production-rooms'],
    queryFn: async () => {
      const res = await fetch('/api/master-data/production-rooms');
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/master-data/production-rooms?id=${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-rooms'] });
      toast.success('ลบสำเร็จ', 'ลบห้องผลิตเรียบร้อย');
    },
    onError: (error: Error) => {
      toast.error('Error', error.message);
    },
  });

  const renderRoomTypeBadge = (roomType: string) => {
    const type = roomTypes.find((t) => t.value === roomType);
    return (
      <span className="dx-cell-tag inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
        <Building2 className="h-3 w-3 flex-shrink-0" />
        {type?.label || roomType}
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 w-full max-w-full overflow-hidden box-border">
      <ResponsivePageHeader
        title="Production Rooms"
        subtitle="Manage production rooms and areas for GMP compliance"
        icon={Building2}
        iconBgColor="bg-emerald-100"
        iconColor="text-emerald-600"
        onBack={() => router.push('/master-data')}
        breadcrumbs={[
          { label: 'Master Data', href: '/master-data' },
          { label: 'Production Rooms' },
        ]}
        actions={
          <DxButton
            text="Add Room"
            icon="plus"
            type="success"
            onClick={() => router.push('/master-data/production-rooms/new')}
          />
        }
      />

      <div className="bg-white rounded-[18px] shadow-[0_6px_20px_rgba(6,78,59,0.07)] border border-emerald-100 p-4">
        <DxDataGrid
          dataSource={(rooms || []).map((r, i) => ({ ...r, _rowNumber: i + 1 }))}
          keyExpr="id"
          showBorders={false}
          rowAlternationEnabled
          loading={isLoading}
          height="auto"
          width="100%"
          columnAutoWidth
        >
          <DxSearchPanel visible placeholder="Search rooms..." width={200} />
          <DxPaging defaultPageSize={20} />

          <DxColumn dataField="_rowNumber" caption="#" width={60} alignment="center" allowFiltering={false} allowSorting={false} cellRender={(cell) => (
            <span className="text-gray-500 text-sm font-medium">{cell.value}</span>
          )} />
          <DxColumn dataField="code" caption="Code" width={120} cellRender={(cell) => (
            <span className="font-mono font-medium text-emerald-700">{cell.value}</span>
          )} />
          <DxColumn dataField="name" caption="Name (EN)" minWidth={150} />
          <DxColumn dataField="nameTh" caption="Name (TH)" minWidth={150} />
          <DxColumn dataField="roomType" caption="Type" minWidth={170} cellRender={(cell) => renderRoomTypeBadge(cell.value)} />
          <DxColumn dataField="description" caption="Description" minWidth={200} />
          <DxColumn dataField="isActive" caption="Status" width={100} cellRender={(cell) => (
            <span className={`dx-cell-tag inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cell.value ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
              {cell.value ? 'Active' : 'Inactive'}
            </span>
          )} />
          <DxColumn caption="Actions" width={120} cellRender={(cell) => (
            <div className="flex gap-1">
              <button
                onClick={() => router.push(`/master-data/production-rooms/${(cell.data as ProductionRoom).id}`)}
                className="p-1.5 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors"
                title="View"
              >
                <Eye className="h-4 w-4" />
              </button>
              <button
                onClick={() => router.push(`/master-data/production-rooms/${(cell.data as ProductionRoom).id}`)}
                className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                title="Edit"
              >
                <Edit className="h-4 w-4" />
              </button>
              <button
                onClick={() => { if (confirm(`ต้องการลบ ${(cell.data as ProductionRoom).name} หรือไม่?`)) deleteMutation.mutate((cell.data as ProductionRoom).id); }}
                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                title="Delete"
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
