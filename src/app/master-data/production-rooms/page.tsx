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

// Each room type gets a DISTINCT colour so the Type column isn't a wall of
// identical green badges. Hues kept within a warm/cool spread for legibility.
const roomTypes = [
  { value: 'weighing', label: 'ห้องชั่ง', badge: 'bg-emerald-100 text-emerald-800' },
  { value: 'mixing', label: 'ห้องผสม', badge: 'bg-blue-100 text-blue-800' },
  { value: 'packaging', label: 'ห้องบรรจุ', badge: 'bg-purple-100 text-purple-800' },
  { value: 'storage', label: 'พื้นที่จัดเก็บ', badge: 'bg-amber-100 text-amber-800' },
  { value: 'preparation', label: 'ห้องเตรียม', badge: 'bg-cyan-100 text-cyan-800' },
  { value: 'production', label: 'ห้องผลิต', badge: 'bg-rose-100 text-rose-800' },
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
    onSuccess: (data: { mode?: 'deleted' | 'disabled' } | null) => {
      queryClient.invalidateQueries({ queryKey: ['production-rooms'] });
      if (data?.mode === 'disabled') {
        toast.success('ปิดการใช้งาน', 'ห้องนี้ถูกใช้งานแล้ว — ปิดการใช้งานแทนการลบ');
      } else {
        toast.success('ลบสำเร็จ', 'ลบห้องผลิตเรียบร้อย');
      }
    },
    onError: (error: Error) => {
      toast.error('ผิดพลาด', error.message);
    },
  });

  const renderRoomTypeBadge = (roomType: string) => {
    const type = roomTypes.find((t) => t.value === roomType);
    return (
      <span className={`dx-cell-tag inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${type?.badge || 'bg-gray-100 text-gray-700'}`}>
        <Building2 className="h-3 w-3 flex-shrink-0" />
        {type?.label || roomType}
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 w-full max-w-full overflow-hidden box-border">
      <ResponsivePageHeader
        title="ห้องผลิต"
        subtitle="จัดการห้องและพื้นที่การผลิตเพื่อให้สอดคล้องกับ GMP"
        icon={Building2}
        iconBgColor="bg-emerald-100"
        iconColor="text-emerald-600"
        onBack={() => router.push('/master-data')}
        breadcrumbs={[
          { label: 'ข้อมูลหลัก', href: '/master-data' },
          { label: 'ห้องผลิต' },
        ]}
        actions={
          <DxButton
            text="เพิ่มห้อง"
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
          <DxSearchPanel visible placeholder="ค้นหาห้อง..." width={200} />
          <DxPaging defaultPageSize={20} />

          <DxColumn dataField="_rowNumber" caption="#" width={60} alignment="center" allowFiltering={false} allowSorting={false} cellRender={(cell) => (
            <span className="text-gray-500 text-sm font-medium">{cell.value}</span>
          )} />
          <DxColumn dataField="code" caption="รหัส" width={160} cellRender={(cell) => (
            <span className="font-mono font-medium text-emerald-700 whitespace-nowrap">{cell.value}</span>
          )} />
          <DxColumn dataField="name" caption="ชื่อ (EN)" minWidth={150} />
          <DxColumn dataField="nameTh" caption="ชื่อ (TH)" minWidth={150} />
          <DxColumn dataField="roomType" caption="ประเภท" minWidth={170} cellRender={(cell) => renderRoomTypeBadge(cell.value)} />
          <DxColumn dataField="description" caption="รายละเอียด" minWidth={200} />
          <DxColumn dataField="isActive" caption="สถานะ" width={100} cellRender={(cell) => (
            <span className={`dx-cell-tag inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cell.value ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
              {cell.value ? 'ใช้งาน' : 'ไม่ใช้งาน'}
            </span>
          )} />
          <DxColumn caption="การดำเนินการ" width={120} cellRender={(cell) => (
            <div className="flex gap-1">
              <button
                onClick={() => router.push(`/master-data/production-rooms/${(cell.data as ProductionRoom).id}`)}
                className="p-1.5 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors"
                title="ดู"
              >
                <Eye className="h-4 w-4" />
              </button>
              <button
                onClick={() => router.push(`/master-data/production-rooms/${(cell.data as ProductionRoom).id}`)}
                className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                title="แก้ไข"
              >
                <Edit className="h-4 w-4" />
              </button>
              <button
                onClick={() => { if (confirm(`ต้องการลบ ${(cell.data as ProductionRoom).name} หรือไม่?`)) deleteMutation.mutate((cell.data as ProductionRoom).id); }}
                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                title="ลบ"
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
