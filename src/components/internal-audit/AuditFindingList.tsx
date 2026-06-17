'use client';

/**
 * Audit Finding List Component
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 10)
 *
 * DataGrid for displaying and managing audit findings.
 */

import { useMemo } from 'react';
import { DxDataGrid, type DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { WorkflowStatusBadge } from '@/components/shared/WorkflowStatusBadge';
import type { AuditFinding, AuditFindingCategory, AuditFindingStatus } from '@/types/audits';

interface AuditFindingListProps {
  findings: AuditFinding[];
  onEdit?: (finding: AuditFinding) => void;
  onAssignCapa?: (findingId: number, findingNumber?: string) => void;
  onClose?: (findingId: number) => void;
  canEdit?: boolean;
  loading?: boolean;
}

const categoryColors: Record<AuditFindingCategory, string> = {
  observation: 'text-blue-600 bg-blue-100',
  minor: 'text-yellow-600 bg-yellow-100',
  major: 'text-orange-600 bg-orange-100',
  critical: 'text-red-600 bg-red-100',
};

const categoryLabels: Record<AuditFindingCategory, string> = {
  observation: 'ข้อสังเกต',
  minor: 'เล็กน้อย',
  major: 'สำคัญ',
  critical: 'วิกฤต',
};

export function AuditFindingList({
  findings,
  onEdit,
  onAssignCapa,
  onClose,
  canEdit = false,
  loading = false,
}: AuditFindingListProps) {
  const columns = useMemo(
    () => [
      {
        dataField: 'findingNumber',
        caption: 'เลขที่ข้อค้นพบ',
        width: 90,
      },
      {
        dataField: 'auditNumber',
        caption: 'เลขที่การตรวจประเมิน',
        width: 120,
      },
      {
        dataField: 'category',
        caption: 'ประเภท',
        width: 100,
        cellRender: (data: { value: AuditFindingCategory }) => {
          const colors = categoryColors[data.value] || '';
          return (
            <span className={`px-2 py-1 rounded text-xs font-medium ${colors}`}>
              {categoryLabels[data.value] || data.value}
            </span>
          );
        },
      },
      {
        dataField: 'gmpChapter',
        caption: 'หมวด GMP',
        width: 100,
        cellRender: (data: { value: number }) => `หมวด ${data.value}`,
      },
      {
        dataField: 'description',
        caption: 'รายละเอียด',
        width: 250,
      },
      {
        dataField: 'areaOwnerName',
        caption: 'ผู้รับผิดชอบ',
        width: 120,
        cellRender: (data: { value: string | undefined }) => {
          return data.value || <span className="text-muted-foreground text-xs">—</span>;
        },
      },
      {
        dataField: 'capaNumber',
        caption: 'CAPA',
        width: 120,
        cellRender: (data: { value: string | undefined; data: AuditFinding }) => {
          if (data.value) return data.value;
          if (data.data.capaRequired) {
            return <span className="text-orange-600 text-xs">จำเป็น</span>;
          }
          return <span className="text-muted-foreground text-xs">—</span>;
        },
      },
      {
        dataField: 'status',
        caption: 'สถานะ',
        width: 110,
        cellRender: (data: { value: AuditFindingStatus }) => (
          <WorkflowStatusBadge status={data.value} />
        ),
      },
    ],
    []
  );

  const actionsCellRender = (data: { data: AuditFinding }) => {
    const needsCapa = data.data.capaRequired && !data.data.capaId && data.data.status === 'open';
    const canCloseFinding =
      data.data.status !== 'closed' &&
      (!data.data.capaRequired || data.data.capaId);

    return (
      <div className="flex gap-1">
        {canEdit && onEdit && data.data.status === 'open' && (
          <DxButton
            icon="edit"
            hint="แก้ไข"
            onClick={() => onEdit(data.data)}
            stylingMode="text"
          />
        )}
        {canEdit && needsCapa && onAssignCapa && (
          <DxButton
            icon="link"
            hint="กำหนด CAPA"
            onClick={() => onAssignCapa(data.data.id, data.data.findingNumber)}
            stylingMode="text"
            type="default"
          />
        )}
        {canEdit && canCloseFinding && onClose && (
          <DxButton
            icon="check"
            hint="ปิด"
            onClick={() => onClose(data.data.id)}
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
      dataSource={findings as unknown as Record<string, unknown>[]}
      columns={allColumns as DxDataGridColumn[]}
      showBorders
      columnAutoWidth
      rowAlternationEnabled
      loading={loading}
    />
  );
}
