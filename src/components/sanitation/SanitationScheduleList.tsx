'use client';

/**
 * Sanitation Schedule List Component
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 4)
 *
 * DataGrid for displaying and managing sanitation schedules.
 */

import { useMemo } from 'react';
import { DxDataGrid } from '@/components/ui/dx-data-grid';
import { DxColumn, type DxColumnProps } from '@/components/ui/dx-column';
import { DxButton } from '@/components/ui/dx-button';
import { WorkflowStatusBadge } from '@/components/shared/WorkflowStatusBadge';
import type { SanitationSchedule, AreaType, SanitationFrequency } from '@/types/sanitation';

interface SanitationScheduleListProps {
  schedules: SanitationSchedule[];
  onEdit?: (schedule: SanitationSchedule) => void;
  onViewLogs?: (scheduleId: number) => void;
  onRecordLog?: (scheduleId: number) => void;
  loading?: boolean;
}

const areaTypeLabels: Record<AreaType, string> = {
  production: 'Production',
  warehouse: 'Warehouse',
  lab: 'Laboratory',
  office: 'Office',
};

const frequencyLabels: Record<SanitationFrequency, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
};

export function SanitationScheduleList({
  schedules,
  onEdit,
  onViewLogs,
  onRecordLog,
  loading = false,
}: SanitationScheduleListProps) {
  const columns = useMemo(
    () => [
      {
        dataField: 'name',
        caption: 'ชื่อกำหนดการ',
        width: 200,
      },
      {
        dataField: 'areaType',
        caption: 'ประเภทพื้นที่',
        width: 120,
        cellRender: (data: { value: AreaType }) => areaTypeLabels[data.value] || data.value,
      },
      {
        dataField: 'frequency',
        caption: 'ความถี่',
        width: 100,
        cellRender: (data: { value: SanitationFrequency }) =>
          frequencyLabels[data.value] || data.value,
      },
      {
        dataField: 'method',
        caption: 'วิธีการ',
        width: 200,
      },
      {
        dataField: 'nextDue',
        caption: 'ครบกำหนดถัดไป',
        dataType: 'date',
        width: 110,
      },
      {
        dataField: 'complianceRate',
        caption: 'การปฏิบัติตาม',
        width: 100,
        cellRender: (data: { value: number }) => {
          const rate = data.value || 0;
          const color = rate >= 90 ? 'text-green-600' : rate >= 70 ? 'text-yellow-600' : 'text-red-600';
          return <span className={`font-medium ${color}`}>{rate.toFixed(0)}%</span>;
        },
      },
      {
        dataField: 'isActive',
        caption: 'สถานะ',
        width: 100,
        cellRender: (data: { value: boolean }) => (
          <WorkflowStatusBadge status={data.value ? 'active' : 'inactive'} />
        ),
      },
    ],
    []
  );

  const actionsCellRender = (data: { data?: SanitationSchedule }) => {
    if (!data.data) return null;
    return (
      <div className="flex gap-1">
        {onRecordLog && data.data.isActive && (
          <DxButton
            icon="plus"
            hint="บันทึกผล"
            onClick={() => onRecordLog(data.data!.id)}
            stylingMode="text"
          />
        )}
        {onViewLogs && (
          <DxButton
            icon="find"
            hint="ดูบันทึก"
            onClick={() => onViewLogs(data.data!.id)}
            stylingMode="text"
          />
        )}
        {onEdit && (
          <DxButton
            icon="edit"
            hint="แก้ไข"
            onClick={() => onEdit(data.data!)}
            stylingMode="text"
          />
        )}
      </div>
    );
  };

  return (
    <DxDataGrid
      dataSource={schedules as unknown as Record<string, unknown>[]}
      showBorders
      columnAutoWidth
      rowAlternationEnabled
      loading={loading}
    >
      {columns.map((col) => (
        <DxColumn key={col.dataField} {...col as DxColumnProps} />
      ))}
      <DxColumn
        caption="การดำเนินการ"
        width={120}
        cellRender={actionsCellRender}
        allowSorting={false}
        allowFiltering={false}
      />
    </DxDataGrid>
  );
}
