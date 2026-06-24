'use client';

/**
 * Pest Control Log List Component
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 4)
 *
 * DataGrid for displaying pest control service logs.
 */

import { useMemo } from 'react';
import { DxDataGrid } from '@/components/ui/dx-data-grid';
import { DxColumn, type DxColumnProps } from '@/components/ui/dx-column';
import { DxButton } from '@/components/ui/dx-button';
import type { PestControlLog, PestControlServiceType } from '@/types/sanitation';

// Distinct colour + label per service type so the column is scannable at a glance.
// emergency = urgent (rose), follow_up = pending (amber), routine = neutral (sky).
const SERVICE_TYPE_BADGE: Record<PestControlServiceType, { label: string; cls: string }> = {
  routine: { label: 'ตามรอบ', cls: 'bg-sky-100 text-sky-800' },
  emergency: { label: 'ฉุกเฉิน', cls: 'bg-rose-100 text-rose-800' },
  follow_up: { label: 'ติดตามผล', cls: 'bg-amber-100 text-amber-800' },
};

interface PestControlLogListProps {
  logs: PestControlLog[];
  onVerify?: (logId: number) => void;
  onEdit?: (log: PestControlLog) => void;
  canVerify?: boolean;
  loading?: boolean;
}

// Service type labels for future use in cell rendering
// const serviceTypeLabels: Record<PestControlServiceType, string> = {
//   routine: 'Routine',
//   emergency: 'Emergency',
//   follow_up: 'Follow-up',
// };

export function PestControlLogList({
  logs,
  onVerify,
  onEdit,
  canVerify = false,
  loading = false,
}: PestControlLogListProps) {
  const columns = useMemo(
    () => [
      {
        dataField: 'serviceDate',
        caption: 'วันที่ให้บริการ',
        dataType: 'date',
        width: 110,
      },
      {
        dataField: 'serviceType',
        caption: 'ประเภท',
        width: 100,
        cellRender: (data: { value: PestControlServiceType }) => {
          const cfg = SERVICE_TYPE_BADGE[data.value] ?? {
            label: data.value,
            cls: 'bg-gray-100 text-gray-700',
          };
          return (
            <span
              className={`inline-flex items-center font-medium rounded-full text-xs px-2 py-0.5 ${cfg.cls}`}
            >
              {cfg.label}
            </span>
          );
        },
      },
      {
        dataField: 'contractorName',
        caption: 'ผู้รับเหมา',
        width: 150,
      },
      {
        dataField: 'technicianName',
        caption: 'ช่างเทคนิค',
        width: 130,
      },
      {
        dataField: 'areasServiced',
        caption: 'พื้นที่',
        width: 180,
        cellRender: (data: { value: string[] }) => (data.value || []).join(', '),
      },
      {
        dataField: 'findingsCount',
        caption: 'ข้อค้นพบ',
        width: 80,
        cellRender: (data: { value: number }) => {
          const count = data.value || 0;
          const color = count === 0 ? 'text-green-600' : count < 3 ? 'text-yellow-600' : 'text-red-600';
          return <span className={`font-medium ${color}`}>{count}</span>;
        },
      },
      {
        dataField: 'followUpRequired',
        caption: 'การติดตาม',
        width: 90,
        cellRender: (data: { value: boolean; data: PestControlLog }) => {
          if (!data.value) return <span className="text-muted-foreground">ไม่</span>;
          return (
            <span className="text-orange-600 font-medium">
              {data.data.followUpDate || 'ต้องติดตาม'}
            </span>
          );
        },
      },
      {
        dataField: 'verifiedByName',
        caption: 'ตรวจสอบโดย',
        width: 120,
        cellRender: (data: { value: string | undefined }) => {
          if (data.value) return data.value;
          return <span className="text-muted-foreground text-xs">รอตรวจสอบ</span>;
        },
      },
    ],
    []
  );

  const actionsCellRender = (data: { data?: PestControlLog }) => {
    if (!data.data) return null;
    const needsVerification = !data.data.verifiedBy;

    return (
      <div className="flex gap-1">
        {canVerify && needsVerification && onVerify && (
          <DxButton
            icon="check"
            hint="ตรวจสอบ"
            onClick={() => onVerify(data.data!.id)}
            stylingMode="text"
            type="success"
          />
        )}
        {onEdit && !data.data.verifiedBy && (
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
      dataSource={logs as unknown as Record<string, unknown>[]}
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
        width={100}
        cellRender={actionsCellRender}
        allowSorting={false}
        allowFiltering={false}
      />
    </DxDataGrid>
  );
}
