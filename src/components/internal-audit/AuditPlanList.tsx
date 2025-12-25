'use client';

/**
 * Audit Plan List Component
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 10)
 *
 * DataGrid for displaying and managing audit plans.
 */

import { useMemo } from 'react';
import { DxDataGrid, type DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { WorkflowStatusBadge } from '@/components/shared/WorkflowStatusBadge';
import type { AuditPlan, AuditPlanStatus } from '@/types/audits';

interface AuditPlanListProps {
  plans: AuditPlan[];
  onView?: (plan: AuditPlan) => void;
  onApprove?: (planId: number) => void;
  canApprove?: boolean;
  loading?: boolean;
}

export function AuditPlanList({
  plans,
  onView,
  onApprove,
  canApprove = false,
  loading = false,
}: AuditPlanListProps) {
  const columns = useMemo(
    () => [
      {
        dataField: 'planYear',
        caption: 'Year',
        width: 80,
      },
      {
        dataField: 'name',
        caption: 'Plan Name',
        width: 200,
      },
      {
        dataField: 'status',
        caption: 'Status',
        width: 120,
        cellRender: (data: { value: AuditPlanStatus }) => (
          <WorkflowStatusBadge status={data.value} />
        ),
      },
      {
        dataField: 'totalAudits',
        caption: 'Planned',
        width: 80,
      },
      {
        dataField: 'completedAudits',
        caption: 'Completed',
        width: 90,
      },
      {
        dataField: 'progress',
        caption: 'Progress',
        width: 120,
        calculateCellValue: (row: AuditPlan) => {
          if (row.totalAudits === 0) return 0;
          return (row.completedAudits / row.totalAudits) * 100;
        },
        cellRender: (data: { value: number }) => {
          const progress = data.value || 0;
          return (
            <div className="flex items-center gap-2">
              <div className="w-16 bg-muted rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <span className="text-sm">{progress.toFixed(0)}%</span>
            </div>
          );
        },
      },
      {
        dataField: 'approvedByName',
        caption: 'Approved By',
        width: 120,
        cellRender: (data: { value: string | undefined }) => {
          return data.value || <span className="text-muted-foreground text-xs">—</span>;
        },
      },
      {
        dataField: 'createdByName',
        caption: 'Created By',
        width: 120,
      },
    ],
    []
  );

  const actionsCellRender = (data: { data: AuditPlan }) => {
    const canApprovePlan = canApprove && data.data.status === 'draft';

    return (
      <div className="flex gap-1">
        {onView && (
          <DxButton
            icon="find"
            hint="View Details"
            onClick={() => onView(data.data)}
            stylingMode="text"
          />
        )}
        {canApprovePlan && onApprove && (
          <DxButton
            icon="check"
            hint="Approve"
            onClick={() => onApprove(data.data.id)}
            stylingMode="text"
            type="success"
          />
        )}
      </div>
    );
  };

  // Add actions column
  const allColumns = [
    ...columns,
    {
      caption: 'Actions',
      width: 100,
      cellRender: actionsCellRender,
    },
  ];

  return (
    <DxDataGrid
      dataSource={plans as unknown as Record<string, unknown>[]}
      columns={allColumns as DxDataGridColumn[]}
      showBorders
      columnAutoWidth
      rowAlternationEnabled
      loading={loading}
    />
  );
}
