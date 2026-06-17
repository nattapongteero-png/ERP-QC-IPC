'use client';

/**
 * Maintenance Plan Templates — List page (split-page pattern)
 */

import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ResponsivePageHeader } from '@/components/shared';
import { DxDataGrid, DxColumn, DxPaging, DxSearchPanel } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { OrganicGridTheme } from '@/components/ui/organic-grid-theme';
import { useToast } from '@/hooks/use-toast';
import { Wrench, Edit, Trash2 } from 'lucide-react';
import type { MaintenancePlanTemplate } from '@/types/equipment-notifications';

const MAINTENANCE_TYPE_LABELS: Record<string, string> = {
  preventive: 'เชิงป้องกัน',
  calibration: 'การสอบเทียบ',
  inspection: 'การตรวจสอบ',
  corrective: 'แก้ไข',
};

const MAINTENANCE_TYPE_BADGES: Record<string, string> = {
  preventive: 'bg-emerald-100 text-emerald-800',
  calibration: 'bg-blue-100 text-blue-800',
  inspection: 'bg-amber-100 text-amber-800',
  corrective: 'bg-rose-100 text-rose-800',
};

const INTERVAL_TYPE_LABELS: Record<string, string> = {
  days: 'วัน',
  weeks: 'สัปดาห์',
  months: 'เดือน',
  hours: 'ชั่วโมง',
  units: 'หน่วย',
};

export default function MaintenancePlanTemplatesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const t = useTranslations('equipmentNotifications');

  const { data, isLoading } = useQuery<MaintenancePlanTemplate[]>({
    queryKey: ['mp-templates'],
    queryFn: async () => {
      const res = await fetch('/api/master-data/maintenance-plan-templates?includeInactive=true');
      if (!res.ok) return [];
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/master-data/maintenance-plan-templates/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error((body as { error?: string } | null)?.error ?? 'Failed to delete');
      }
      return res.json() as Promise<{ mode: 'deleted' | 'disabled' }>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['mp-templates'] });
      if (result?.mode === 'disabled') {
        toast.info('ปิดการใช้งานแทนการลบ', 'รายการนี้ถูกใช้งานอยู่ — ปิดการใช้งานแทนการลบ');
      } else {
        toast.success('ลบสำเร็จ', 'ลบแม่แบบเรียบร้อย');
      }
    },
    onError: (error: Error) => {
      toast.error('ผิดพลาด', error.message);
    },
  });

  const handleDelete = (row: MaintenancePlanTemplate) => {
    if (!confirm(`ต้องการลบ "${row.name}" หรือไม่?`)) return;
    deleteMutation.mutate(row.id);
  };

  const renderTypeBadge = (value: string) => {
    const label = MAINTENANCE_TYPE_LABELS[value] ?? value;
    const badge = MAINTENANCE_TYPE_BADGES[value] ?? 'bg-gray-100 text-gray-700';
    return (
      <span
        className={`dx-cell-tag inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${badge}`}
      >
        <Wrench className="h-3 w-3 flex-shrink-0" />
        {label}
      </span>
    );
  };

  return (
    <div className="organic-grid flex flex-col gap-5 p-4 md:p-6 w-full max-w-full overflow-hidden box-border">
      <OrganicGridTheme />

      <ResponsivePageHeader
        title={t('page.templates')}
        subtitle="จัดการแม่แบบแผนบำรุงรักษาเครื่องจักรและอุปกรณ์"
        icon={Wrench}
        iconBgColor="bg-amber-100"
        iconColor="text-amber-600"
        onBack={() => router.push('/master-data')}
        breadcrumbs={[
          { label: 'ข้อมูลหลัก', href: '/master-data' },
          { label: 'แม่แบบแผนบำรุงรักษา' },
        ]}
        actions={
          <DxButton
            text="เพิ่มแม่แบบ"
            icon="plus"
            type="success"
            onClick={() => router.push('/master-data/maintenance-plan-templates/new')}
            elementAttr={{ 'data-testid': 'mpt-add-btn' }}
          />
        }
      />

      <div className="bg-white rounded-[18px] shadow-[0_6px_20px_rgba(6,78,59,0.07)] border border-emerald-100 p-4">
        <DxDataGrid
          dataSource={(data ?? []).map((r, i) => ({ ...r, _rowNumber: i + 1 }))}
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

          <DxColumn
            dataField="_rowNumber"
            caption="#"
            width={60}
            alignment="center"
            allowFiltering={false}
            allowSorting={false}
            cellRender={(cell) => (
              <span className="text-gray-500 text-sm font-medium">{cell.value}</span>
            )}
          />

          <DxColumn
            dataField="name"
            caption="ชื่อแม่แบบ"
            minWidth={200}
            cellRender={(cell) => (
              <span className="font-medium text-gray-800 whitespace-nowrap">{cell.value}</span>
            )}
          />

          <DxColumn dataField="description" caption="รายละเอียด" minWidth={200} />

          <DxColumn
            dataField="maintenanceType"
            caption="ประเภท"
            minWidth={160}
            cellRender={(cell) => renderTypeBadge(cell.value as string)}
          />

          <DxColumn
            caption="รอบการบำรุงรักษา"
            minWidth={160}
            allowFiltering={false}
            allowSorting={false}
            cellRender={(cell) => {
              const r = cell.data as MaintenancePlanTemplate;
              const unit = INTERVAL_TYPE_LABELS[r.intervalType] ?? r.intervalType;
              return (
                <span className="whitespace-nowrap text-gray-700">
                  {r.intervalValue} {unit}
                </span>
              );
            }}
          />

          <DxColumn
            dataField="alertDaysBefore"
            caption="แจ้งเตือนล่วงหน้า (วัน)"
            width={170}
            alignment="center"
            cellRender={(cell) => (
              <span className="text-gray-700 whitespace-nowrap">{cell.value} วัน</span>
            )}
          />

          <DxColumn
            dataField="isActive"
            caption="สถานะ"
            width={100}
            cellRender={(cell) => (
              <span
                className={`dx-cell-tag inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                  cell.value ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {cell.value ? 'ใช้งาน' : 'ไม่ใช้งาน'}
              </span>
            )}
          />

          <DxColumn
            caption="การดำเนินการ"
            width={110}
            allowSorting={false}
            allowFiltering={false}
            cellRender={(cell) => {
              const row = cell.data as MaintenancePlanTemplate;
              return (
                <div className="flex gap-1" data-testid={`mpt-actions-${row.id}`}>
                  <button
                    type="button"
                    data-testid={`mpt-edit-${row.id}`}
                    onClick={() =>
                      router.push(`/master-data/maintenance-plan-templates/${row.id}`)
                    }
                    className="p-1.5 text-gray-500 hover:text-amber-700 hover:bg-amber-50 rounded transition-colors"
                    title="แก้ไข"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    data-testid={`mpt-delete-${row.id}`}
                    onClick={() => handleDelete(row)}
                    disabled={deleteMutation.isPending}
                    className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                    title="ลบ"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            }}
          />
        </DxDataGrid>
      </div>
    </div>
  );
}
