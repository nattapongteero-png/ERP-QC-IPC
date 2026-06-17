'use client';

/**
 * Audit List Component
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 10)
 *
 * DataGrid for displaying and managing audits.
 */

import { useMemo } from 'react';
import { DxDataGrid, type DxDataGridColumn } from '@/components/ui/dx-data-grid';
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
  internal: 'ภายใน',
  external: 'ภายนอก',
  regulatory: 'หน่วยงานกำกับ',
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
        caption: 'เลขที่การตรวจประเมิน',
        width: 130,
      },
      {
        dataField: 'auditType',
        caption: 'ประเภท',
        width: 100,
        cellRender: (data: { value: AuditType }) => auditTypeLabels[data.value] || data.value,
      },
      {
        dataField: 'scope',
        caption: 'ขอบเขต',
        width: 200,
      },
      {
        dataField: 'gmpChapters',
        caption: 'หมวด GMP',
        width: 150,
        cellRender: (data: { value: number[] }) => {
          const chapters = data.value || [];
          return chapters.map((c) => `หมวด ${c}`).join(', ');
        },
      },
      {
        dataField: 'scheduledDate',
        caption: 'วันที่นัดหมาย',
        dataType: 'date',
        width: 110,
      },
      {
        dataField: 'leadAuditorName',
        caption: 'หัวหน้าผู้ตรวจประเมิน',
        width: 130,
      },
      {
        dataField: 'status',
        caption: 'สถานะ',
        width: 110,
        cellRender: (data: { value: AuditStatus }) => (
          <WorkflowStatusBadge status={data.value} />
        ),
      },
      {
        dataField: 'findingsCount',
        caption: 'ข้อค้นพบ',
        width: 80,
      },
      {
        dataField: 'openFindingsCount',
        caption: 'ค้างอยู่',
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
            hint="ดูรายละเอียด"
            onClick={() => onView(data.data)}
            stylingMode="text"
          />
        )}
        {canStart && onStart && (
          <DxButton
            icon="runner"
            hint="เริ่มการตรวจประเมิน"
            onClick={() => onStart(data.data.id)}
            stylingMode="text"
            type="default"
          />
        )}
        {canCompleteAudit && onComplete && (
          <DxButton
            icon="check"
            hint="เสร็จสิ้น"
            onClick={() => onComplete(data.data.id)}
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
      caption: 'การดำเนินการ',
      width: 120,
      cellRender: actionsCellRender,
    },
  ];

  return (
    <DxDataGrid
      dataSource={audits as unknown as Record<string, unknown>[]}
      columns={allColumns as DxDataGridColumn[]}
      showBorders
      columnAutoWidth
      rowAlternationEnabled
      loading={loading}
    />
  );
}
