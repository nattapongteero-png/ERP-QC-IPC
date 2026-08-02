'use client';

/**
 * Production Equipment Master Data Page
 * Manages production equipment for GMP compliance.
 */

import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ResponsivePageHeader } from '@/components/shared';
import { DxDataGrid, DxColumn, DxPaging, DxSearchPanel } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { useToast } from '@/hooks/use-toast';
import { Wrench, Eye, Edit, Trash2 } from 'lucide-react';

interface ProductionEquipment {
  id: number;
  code: string;
  name: string;
  nameTh: string;
  equipmentType: string;
  lineCategory?: string; // 'in_line' | 'off_line' (null legacy => in_line)
  capacity?: string;
  roomId?: number;
  roomName?: string;
  room?: { name: string };
  description?: string;
  isActive: boolean;
}

// Distinct colour per equipment type so the Type column isn't a wall of
// identical purple badges. Includes mill/sieve/balance (seen in data, were
// previously missing → fell back to the raw value + default purple).
const equipmentTypes = [
  { value: 'scale', label: 'เครื่องชั่ง', badge: 'bg-emerald-100 text-emerald-800' },
  { value: 'balance', label: 'ตาชั่ง', badge: 'bg-teal-100 text-teal-800' },
  { value: 'mixer', label: 'เครื่องผสม', badge: 'bg-blue-100 text-blue-800' },
  { value: 'hotplate', label: 'แผ่นทำความร้อน', badge: 'bg-red-100 text-red-800' },
  { value: 'container', label: 'ภาชนะ', badge: 'bg-amber-100 text-amber-800' },
  { value: 'tool', label: 'เครื่องมือ', badge: 'bg-purple-100 text-purple-800' },
  { value: 'filler', label: 'เครื่องบรรจุ', badge: 'bg-cyan-100 text-cyan-800' },
  { value: 'mill', label: 'เครื่องบด', badge: 'bg-orange-100 text-orange-800' },
  { value: 'sieve', label: 'ตะแกรงร่อน', badge: 'bg-lime-100 text-lime-800' },
  { value: 'tank', label: 'ถัง', badge: 'bg-indigo-100 text-indigo-800' },
  { value: 'pump', label: 'ปั๊ม', badge: 'bg-pink-100 text-pink-800' },
  { value: 'other', label: 'อื่นๆ', badge: 'bg-gray-100 text-gray-700' },
];

export default function ProductionEquipmentPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();

  // Fetch equipment
  const { data: equipment, isLoading } = useQuery<ProductionEquipment[]>({
    queryKey: ['production-equipment'],
    queryFn: async () => {
      const res = await fetch('/api/master-data/production-equipment');
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/master-data/production-equipment?id=${id}`, {
        method: 'DELETE',
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (data: { mode?: 'deleted' | 'disabled' } | null) => {
      queryClient.invalidateQueries({ queryKey: ['production-equipment'] });
      if (data?.mode === 'disabled') {
        toast.success('ปิดการใช้งาน', 'อุปกรณ์นี้ถูกใช้งานแล้ว — ปิดการใช้งานแทนการลบ');
      } else {
        toast.success('ลบสำเร็จ', 'ลบอุปกรณ์เรียบร้อยแล้ว');
      }
    },
    onError: (error: Error) => {
      toast.error('ผิดพลาด', error.message);
    },
  });

  const handleCreate = () => {
    router.push('/master-data/production-equipment/new');
  };

  const handleEdit = (id: number) => {
    router.push(`/master-data/production-equipment/${id}`);
  };

  const renderTypeBadge = (type: string) => {
    const typeInfo = equipmentTypes.find((t) => t.value === type);
    return (
      <span className={`dx-cell-tag inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${typeInfo?.badge || 'bg-gray-100 text-gray-700'}`}>
        <Wrench className="h-3 w-3 flex-shrink-0" />
        {typeInfo?.label || type}
      </span>
    );
  };

  // In-line vs off-line badge. Legacy rows have null → treated as in-line.
  const renderLineCategoryBadge = (value?: string) => {
    const offLine = value === 'off_line';
    return (
      <span className={`dx-cell-tag inline-flex px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${offLine ? 'bg-orange-100 text-orange-800' : 'bg-emerald-100 text-emerald-800'}`}>
        {offLine ? 'นอกไลน์ผลิต' : 'ในไลน์ผลิต'}
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 w-full max-w-full overflow-hidden box-border">
      {/* Header */}
      <ResponsivePageHeader
        title="อุปกรณ์การผลิต"
        subtitle="จัดการอุปกรณ์การผลิตเพื่อให้สอดคล้องกับ GMP"
        icon={Wrench}
        iconBgColor="bg-purple-100"
        iconColor="text-purple-600"
        onBack={() => router.push('/master-data')}
        breadcrumbs={[
          { label: 'ข้อมูลหลัก', href: '/master-data' },
          { label: 'อุปกรณ์การผลิต' },
        ]}
        actions={
          <DxButton
            text="เพิ่มอุปกรณ์"
            icon="plus"
            type="success"
            onClick={handleCreate}
          />
        }
      />

      {/* Data Grid */}
      <div className="bg-white rounded-[18px] shadow-[0_6px_20px_rgba(6,78,59,0.07)] border border-emerald-100 p-4">
        <DxDataGrid
          dataSource={(equipment || []).map((e, i) => ({ ...e, _rowNumber: i + 1 }))}
          keyExpr="id"
          showBorders={false}
          rowAlternationEnabled
          loading={isLoading}
          height="auto"
          width="100%"
          columnAutoWidth
        >
          <DxSearchPanel visible placeholder="ค้นหาอุปกรณ์..." width={200} />
          <DxPaging defaultPageSize={20} />

          <DxColumn dataField="_rowNumber" caption="#" width={60} alignment="center" allowFiltering={false} allowSorting={false} cellRender={(cell) => (
            <span className="text-gray-500 text-sm font-medium">{cell.value}</span>
          )} />
          <DxColumn dataField="code" caption="รหัส" width={160} cellRender={(cell) => (
            <span className="font-mono font-medium text-purple-700 whitespace-nowrap">{cell.value}</span>
          )} />
          <DxColumn dataField="name" caption="ชื่อ (EN)" minWidth={150} />
          <DxColumn dataField="nameTh" caption="ชื่อ (TH)" minWidth={150} />
          <DxColumn dataField="equipmentType" caption="ประเภท" minWidth={160} cellRender={(cell) => renderTypeBadge(cell.value)} />
          <DxColumn dataField="lineCategory" caption="การใช้งาน" minWidth={140} cellRender={(cell) => renderLineCategoryBadge(cell.value)} />
          <DxColumn dataField="capacity" caption="ความจุ" minWidth={140} cellRender={(cell) => (
            <span className="whitespace-nowrap">{cell.value || '-'}</span>
          )} />
          <DxColumn caption="ห้องเริ่มต้น" minWidth={150} cellRender={(cell) => {
            const data = cell.data as ProductionEquipment;
            return data.room?.name || data.roomName || '-';
          }} />
          <DxColumn dataField="isActive" caption="สถานะ" width={100} cellRender={(cell) => (
            <span className={`dx-cell-tag inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cell.value ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
              {cell.value ? 'ใช้งาน' : 'ไม่ใช้งาน'}
            </span>
          )} />
          <DxColumn caption="การดำเนินการ" width={120} cellRender={(cell) => (
            <div className="flex gap-1">
              <button
                onClick={() => handleEdit((cell.data as ProductionEquipment).id)}
                className="p-1.5 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors"
                title="ดู"
              >
                <Eye className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleEdit((cell.data as ProductionEquipment).id)}
                className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                title="แก้ไข"
              >
                <Edit className="h-4 w-4" />
              </button>
              <button
                onClick={() => { if (confirm(`ต้องการลบ ${(cell.data as ProductionEquipment).name} หรือไม่?`)) deleteMutation.mutate((cell.data as ProductionEquipment).id); }}
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
