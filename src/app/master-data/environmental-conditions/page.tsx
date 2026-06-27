'use client';

/**
 * Environmental Conditions Master Data Page
 * Manages environmental condition profiles for GMP compliance.
 */

import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ResponsivePageHeader } from '@/components/shared';
import { DxDataGrid, DxColumn, DxPaging, DxSearchPanel } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { useToast } from '@/hooks/use-toast';
import { Thermometer, Eye, Edit, Trash2 } from 'lucide-react';

interface EnvironmentalCondition {
  id: number;
  code: string;
  name: string;
  temperatureMin: number;
  temperatureMax: number;
  humidityMax: number;
  monitoringIntervalMinutes: number;
  notes?: string;
  isActive: boolean;
}

export default function EnvironmentalConditionsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();

  // Fetch conditions
  const { data: conditions, isLoading } = useQuery<EnvironmentalCondition[]>({
    queryKey: ['environmental-conditions'],
    queryFn: async () => {
      const res = await fetch('/api/master-data/environmental-conditions');
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/master-data/environmental-conditions?id=${id}`, {
        method: 'DELETE',
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (data: { mode?: 'deleted' | 'disabled' } | null) => {
      queryClient.invalidateQueries({ queryKey: ['environmental-conditions'] });
      if (data?.mode === 'disabled') {
        toast.success('ปิดการใช้งาน', 'เงื่อนไขนี้ถูกใช้งานแล้ว — ปิดการใช้งานแทนการลบ');
      } else {
        toast.success('ลบสำเร็จ', 'ลบโปรไฟล์เงื่อนไขเรียบร้อยแล้ว');
      }
    },
    onError: (error: Error) => {
      toast.error('ผิดพลาด', error.message);
    },
  });

  const handleCreate = () => {
    router.push('/master-data/environmental-conditions/new');
  };

  const handleEdit = (id: number) => {
    router.push(`/master-data/environmental-conditions/${id}`);
  };

  const renderTempRange = (data: EnvironmentalCondition) => {
    return (
      <span className="dx-cell-tag inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
        <Thermometer className="h-3 w-3 flex-shrink-0" />
        {data.temperatureMin}-{data.temperatureMax}°C
      </span>
    );
  };

  const renderHumidity = (value: number) => {
    return (
      <span className="dx-cell-tag inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-teal-100 text-teal-800">
        {value}% RH
      </span>
    );
  };

  const renderInterval = (value: number) => {
    return (
      <span className="text-gray-600 whitespace-nowrap">
        ทุก {value} นาที
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 w-full max-w-full overflow-hidden box-border">
      {/* Header */}
      <ResponsivePageHeader
        title="เงื่อนไขสภาพแวดล้อม"
        subtitle="จัดการโปรไฟล์เงื่อนไขสภาพแวดล้อมสำหรับการตรวจสอบการผลิต"
        icon={Thermometer}
        iconBgColor="bg-teal-100"
        iconColor="text-teal-600"
        onBack={() => router.push('/master-data')}
        breadcrumbs={[
          { label: 'ข้อมูลหลัก', href: '/master-data' },
          { label: 'เงื่อนไขสภาพแวดล้อม' },
        ]}
        actions={
          <DxButton
            text="เพิ่มเงื่อนไข"
            icon="plus"
            type="success"
            onClick={handleCreate}
          />
        }
      />

      {/* Data Grid */}
      <div className="bg-white rounded-[18px] shadow-[0_6px_20px_rgba(6,78,59,0.07)] border border-emerald-100 p-4">
        <DxDataGrid
          dataSource={(conditions || []).map((c, i) => ({ ...c, _rowNumber: i + 1 }))}
          keyExpr="id"
          showBorders={false}
          rowAlternationEnabled
          loading={isLoading}
          height="auto"
          width="100%"
        >
          <DxSearchPanel visible placeholder="ค้นหาเงื่อนไข..." width={200} />
          <DxPaging defaultPageSize={20} />

          <DxColumn dataField="_rowNumber" caption="#" width={60} alignment="center" allowFiltering={false} allowSorting={false} cellRender={(cell) => (
            <span className="text-gray-500 text-sm font-medium">{cell.value}</span>
          )} />
          <DxColumn dataField="code" caption="รหัส" width={160} cellRender={(cell) => (
            <span className="font-mono font-medium text-teal-700 whitespace-nowrap">{cell.value}</span>
          )} />
          <DxColumn dataField="name" caption="ชื่อโปรไฟล์" minWidth={200} />
          <DxColumn caption="ช่วงอุณหภูมิ" minWidth={170} cellRender={(cell) => renderTempRange(cell.data)} />
          <DxColumn dataField="humidityMax" caption="ความชื้นสูงสุด" minWidth={130} cellRender={(cell) => renderHumidity(cell.value)} />
          <DxColumn dataField="monitoringIntervalMinutes" caption="รอบการตรวจสอบ" minWidth={170} cellRender={(cell) => renderInterval(cell.value)} />
          <DxColumn dataField="notes" caption="หมายเหตุ" minWidth={200} />
          <DxColumn dataField="isActive" caption="สถานะ" width={100} cellRender={(cell) => (
            <span className={`dx-cell-tag inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cell.value ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
              {cell.value ? 'ใช้งาน' : 'ไม่ใช้งาน'}
            </span>
          )} />
          <DxColumn caption="การดำเนินการ" width={120} cellRender={(cell) => (
            <div className="flex gap-1">
              <button
                onClick={() => handleEdit((cell.data as EnvironmentalCondition).id)}
                className="p-1.5 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors"
                title="ดู"
              >
                <Eye className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleEdit((cell.data as EnvironmentalCondition).id)}
                className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                title="แก้ไข"
              >
                <Edit className="h-4 w-4" />
              </button>
              <button
                onClick={() => { if (confirm(`ต้องการลบ ${(cell.data as EnvironmentalCondition).name} หรือไม่?`)) deleteMutation.mutate((cell.data as EnvironmentalCondition).id); }}
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
