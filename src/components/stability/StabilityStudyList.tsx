'use client';

/**
 * Stability Study List Component
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 7.4)
 *
 * DataGrid showing stability studies with status, progress, and alerts.
 */

import { useRouter } from 'next/navigation';
import { DxDataGrid, DxColumn, DxPaging, DxSearchPanel } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { Play, CheckCircle, XCircle, Pause, AlertTriangle } from 'lucide-react';
import type { StabilityStudy, StabilityStudyStatus } from '@/types/stability';

interface StabilityStudyListProps {
  studies: StabilityStudy[];
  loading?: boolean;
}

const statusConfig: Record<
  StabilityStudyStatus,
  { label: string; color: string; icon: React.ReactNode }
> = {
  active: {
    label: 'Active',
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    icon: <Play className="h-3 w-3" />,
  },
  completed: {
    label: 'Completed',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    icon: <CheckCircle className="h-3 w-3" />,
  },
  cancelled: {
    label: 'Cancelled',
    color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    icon: <XCircle className="h-3 w-3" />,
  },
  on_hold: {
    label: 'On Hold',
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    icon: <Pause className="h-3 w-3" />,
  },
};

export function StabilityStudyList({ studies, loading = false }: StabilityStudyListProps) {
  const router = useRouter();

  const renderStatusCell = (cellData: { value: StabilityStudyStatus }) => {
    const config = statusConfig[cellData.value];
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}
      >
        {config.icon}
        {config.label}
      </span>
    );
  };

  const renderNextDueCell = (cellData: { data: StabilityStudy }) => {
    const study = cellData.data;
    if (!study.nextDueDate || study.status !== 'active') return '-';

    const dueDate = new Date(study.nextDueDate);
    const today = new Date();
    const daysUntilDue = Math.floor(
      (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilDue < 0) {
      return (
        <div className="flex items-center gap-1 text-red-600">
          <AlertTriangle className="h-4 w-4" />
          <span>Overdue ({Math.abs(daysUntilDue)}d)</span>
        </div>
      );
    } else if (daysUntilDue <= 7) {
      return (
        <div className="flex items-center gap-1 text-yellow-600">
          <AlertTriangle className="h-4 w-4" />
          <span>{study.nextDueDate} ({daysUntilDue}d)</span>
        </div>
      );
    }
    return study.nextDueDate;
  };

  const renderOOSCell = (cellData: { value: number }) => {
    const count = cellData.value || 0;
    if (count === 0) return <span className="text-muted-foreground">0</span>;
    return <span className="text-red-600 font-medium">{count}</span>;
  };

  const renderActionsCell = (cellData: { data: StabilityStudy }) => {
    const study = cellData.data;
    return (
      <DxButton
        text="View"
        stylingMode="text"
        onClick={() => router.push(`/gmp/stability/studies/${study.id}`)}
      />
    );
  };

  return (
    <DxDataGrid
      dataSource={studies}
      showBorders
      rowAlternationEnabled
      loading={loading}
      onRowClick={(e) => {
        if (e.data) {
          router.push(`/gmp/stability/studies/${e.data.id}`);
        }
      }}
    >
      <DxSearchPanel visible placeholder="Search studies..." />
      <DxPaging defaultPageSize={15} />

      <DxColumn dataField="studyNumber" caption="Study #" width={150} />
      <DxColumn dataField="productName" caption="Product" minWidth={150} />
      <DxColumn dataField="lotNumber" caption="Lot #" width={120} />
      <DxColumn dataField="protocolNumber" caption="Protocol" width={140} />
      <DxColumn dataField="startDate" caption="Start Date" dataType="date" width={110} />
      <DxColumn
        dataField="currentTimepoint"
        caption="Current TP"
        width={100}
        cellRender={(cellData: { value: number | null }) =>
          cellData.value !== null ? `${cellData.value}M` : '-'
        }
      />
      <DxColumn
        caption="Next Due"
        width={140}
        cellRender={renderNextDueCell}
        allowFiltering={false}
        allowSorting={false}
      />
      <DxColumn
        dataField="oosCount"
        caption="OOS"
        width={70}
        cellRender={renderOOSCell}
      />
      <DxColumn
        dataField="status"
        caption="Status"
        width={110}
        cellRender={renderStatusCell}
      />
      <DxColumn
        caption="Actions"
        width={80}
        cellRender={renderActionsCell}
        allowFiltering={false}
        allowSorting={false}
      />
    </DxDataGrid>
  );
}
