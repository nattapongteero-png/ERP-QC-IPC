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
import { WorkflowStatusBadge } from '@/components/shared/WorkflowStatusBadge';
import type { PestControlLog, PestControlServiceType } from '@/types/sanitation';

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
        caption: 'Service Date',
        dataType: 'date',
        width: 110,
      },
      {
        dataField: 'serviceType',
        caption: 'Type',
        width: 100,
        cellRender: (data: { value: PestControlServiceType }) => (
          <WorkflowStatusBadge status={data.value} />
        ),
      },
      {
        dataField: 'contractorName',
        caption: 'Contractor',
        width: 150,
      },
      {
        dataField: 'technicianName',
        caption: 'Technician',
        width: 130,
      },
      {
        dataField: 'areasServiced',
        caption: 'Areas',
        width: 180,
        cellRender: (data: { value: string[] }) => (data.value || []).join(', '),
      },
      {
        dataField: 'findingsCount',
        caption: 'Findings',
        width: 80,
        cellRender: (data: { value: number }) => {
          const count = data.value || 0;
          const color = count === 0 ? 'text-green-600' : count < 3 ? 'text-yellow-600' : 'text-red-600';
          return <span className={`font-medium ${color}`}>{count}</span>;
        },
      },
      {
        dataField: 'followUpRequired',
        caption: 'Follow-up',
        width: 90,
        cellRender: (data: { value: boolean; data: PestControlLog }) => {
          if (!data.value) return <span className="text-muted-foreground">No</span>;
          return (
            <span className="text-orange-600 font-medium">
              {data.data.followUpDate || 'Required'}
            </span>
          );
        },
      },
      {
        dataField: 'verifiedByName',
        caption: 'Verified By',
        width: 120,
        cellRender: (data: { value: string | undefined }) => {
          if (data.value) return data.value;
          return <span className="text-muted-foreground text-xs">Pending</span>;
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
            hint="Verify"
            onClick={() => onVerify(data.data!.id)}
            stylingMode="text"
            type="success"
          />
        )}
        {onEdit && !data.data.verifiedBy && (
          <DxButton
            icon="edit"
            hint="Edit"
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
        caption="Actions"
        width={100}
        cellRender={actionsCellRender}
        allowSorting={false}
        allowFiltering={false}
      />
    </DxDataGrid>
  );
}
