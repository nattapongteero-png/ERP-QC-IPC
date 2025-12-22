'use client';

/**
 * Audit List Component
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 10)
 *
 * DataGrid for displaying and managing audits.
 */

import { useMemo } from 'react';
import { DxDataGrid } from '@/components/ui/dx-data-grid';
import { DxColumn } from '@/components/ui/dx-column';
import { DxButton } from '@/components/ui/dx-button';
import { WorkflowStatusBadge } from '@/components/shared/WorkflowStatusBadge';
import type { Audit, AuditStatus, AuditType } from '@/types/audits';

interface AuditListProps {
  audits: Audit[];
  onView?: (audit: Audit) => void;
  onStart?: (auditId: number) => void;
  onComplete?: (auditId: number) => void;
  canEdit?: boolean;
  loading?: boolean;
}

const auditTypeLabels: Record<AuditType, string> = {
  internal: 'Internal',
  external: 'External',
  regulatory: 'Regulatory',
};

export function AuditList({
  audits,
  onView,
  onStart,
  onComplete,
  canEdit = false,
  loading = false,
}: AuditListProps) {
  const columns = useMemo(
    () => [
      {
        dataField: 'auditNumber',
        caption: 'Audit #',
        width: 130,
      },
      {
        dataField: 'auditType',
        caption: 'Type',
        width: 100,
        cellRender: (data: { value: AuditType }) => auditTypeLabels[data.value] || data.value,
      },
      {
        dataField: 'scope',
        caption: 'Scope',
        width: 200,
      },
      {
        dataField: 'gmpChapters',
        caption: 'GMP Chapters',
        width: 150,
        cellRender: (data: { value: number[] }) => {
          const chapters = data.value || [];
          return chapters.map((c) => `หมวด ${c}`).join(', ');
        },
      },
      {
        dataField: 'scheduledDate',
        caption: 'Scheduled',
        dataType: 'date',
        width: 110,
      },
      {
        dataField: 'leadAuditorName',
        caption: 'Lead Auditor',
        width: 130,
      },
      {
        dataField: 'status',
        caption: 'Status',
        width: 110,
        cellRender: (data: { value: AuditStatus }) => (
          <WorkflowStatusBadge status={data.value} />
        ),
      },
      {
        dataField: 'findingsCount',
        caption: 'Findings',
        width: 80,
      },
      {
        dataField: 'openFindingsCount',
        caption: 'Open',
        width: 70,
        cellRender: (data: { value: number }) => {
          const count = data.value || 0;
          const color = count === 0 ? 'text-green-600' : 'text-red-600';
          return <span className={`font-medium ${color}`}>{count}</span>;
        },
      },
    ],
    []
  );

  const actionsCellRender = (data: { data: Audit }) => {
    const canStart = canEdit && data.data.status === 'scheduled';
    const canCompleteAudit = canEdit && data.data.status === 'in_progress';

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
        {canStart && onStart && (
          <DxButton
            icon="runner"
            hint="Start Audit"
            onClick={() => onStart(data.data.id)}
            stylingMode="text"
            type="default"
          />
        )}
        {canCompleteAudit && onComplete && (
          <DxButton
            icon="check"
            hint="Complete"
            onClick={() => onComplete(data.data.id)}
            stylingMode="text"
            type="success"
          />
        )}
      </div>
    );
  };

  return (
    <DxDataGrid
      dataSource={audits}
      showBorders
      columnAutoWidth
      rowAlternationEnabled
      hoverStateEnabled
      loadPanel={{ enabled: loading }}
    >
      {columns.map((col) => (
        <DxColumn key={col.dataField} {...col} />
      ))}
      <DxColumn
        caption="Actions"
        width={120}
        cellRender={actionsCellRender}
        allowSorting={false}
        allowFiltering={false}
      />
    </DxDataGrid>
  );
}
