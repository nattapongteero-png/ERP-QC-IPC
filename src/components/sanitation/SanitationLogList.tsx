'use client';

/**
 * Sanitation Log List Component
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 4)
 *
 * DataGrid for displaying sanitation logs with verification workflow.
 */

import { useMemo } from 'react';
import { DxDataGrid } from '@/components/ui/dx-data-grid';
import { DxColumn, type DxColumnProps } from '@/components/ui/dx-column';
import { DxButton } from '@/components/ui/dx-button';
import { WorkflowStatusBadge } from '@/components/shared/WorkflowStatusBadge';
import type { SanitationLog, SanitationLogStatus } from '@/types/sanitation';

interface SanitationLogListProps {
  logs: SanitationLog[];
  onVerify?: (logId: number) => void;
  onEdit?: (log: SanitationLog) => void;
  canVerify?: boolean;
  loading?: boolean;
}

// Status labels for future use in cell rendering
// const statusLabels: Record<SanitationLogStatus, string> = {
//   completed: 'Completed',
//   partial: 'Partial',
//   missed: 'Missed',
// };

export function SanitationLogList({
  logs,
  onVerify,
  onEdit,
  canVerify = false,
  loading = false,
}: SanitationLogListProps) {
  const columns = useMemo(
    () => [
      {
        dataField: 'scheduleName',
        caption: 'Schedule',
        width: 180,
      },
      {
        dataField: 'areaType',
        caption: 'Area',
        width: 100,
      },
      {
        dataField: 'performedDate',
        caption: 'Performed',
        dataType: 'date',
        width: 110,
      },
      {
        dataField: 'performedByName',
        caption: 'Performed By',
        width: 130,
      },
      {
        dataField: 'status',
        caption: 'Status',
        width: 100,
        cellRender: (data: { value: SanitationLogStatus }) => (
          <WorkflowStatusBadge status={data.value} />
        ),
      },
      {
        dataField: 'method',
        caption: 'Method',
        width: 150,
      },
      {
        dataField: 'chemicalsUsed',
        caption: 'Chemicals',
        width: 120,
      },
      {
        dataField: 'verifiedByName',
        caption: 'Verified By',
        width: 120,
        cellRender: (data: { value: string | undefined; data: SanitationLog }) => {
          if (data.value) return data.value;
          return <span className="text-muted-foreground text-xs">Pending</span>;
        },
      },
    ],
    []
  );

  const actionsCellRender = (data: { data?: SanitationLog }) => {
    if (!data.data) return null;
    const needsVerification = !data.data.verifiedBy && data.data.status === 'completed';

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
