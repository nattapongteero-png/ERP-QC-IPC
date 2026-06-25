'use client';

/**
 * Recall List Component
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * DevExtreme DataGrid for displaying recalls with filtering.
 */

import { useRouter } from 'next/navigation';
import { DxDataGrid, DxColumn, DxPaging, DxFilterRow, DxSorting } from '@/components/ui/dx-data-grid';
import { WorkflowStatusBadge } from '@/components/shared/WorkflowStatusBadge';
import type { Recall, RecallClass, RecallStatus } from '@/types/recalls';

interface RecallListProps {
  recalls: Recall[];
  loading?: boolean;
}

const classLabels: Record<RecallClass, { label: string; color: string }> = {
  class_i: { label: 'Class I', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
  class_ii: { label: 'Class II', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
  class_iii: { label: 'Class III', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
};

export function RecallList({ recalls, loading }: RecallListProps) {
  const router = useRouter();

  const handleRowClick = (e: { data: Recall }) => {
    router.push(`/gmp/recalls/${e.data.id}`);
  };

  const renderClassCell = (cellData: { value: RecallClass }) => {
    const classInfo = classLabels[cellData.value];
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${classInfo.color}`}>
        {classInfo.label}
      </span>
    );
  };

  const renderStatusCell = (cellData: { value: RecallStatus }) => {
    return <WorkflowStatusBadge status={cellData.value} />;
  };

  const renderEffectivenessCell = (cellData: { value: number }) => {
    // MySQL returns decimal columns as strings — coerce before .toFixed.
    const value = Number(cellData.value) || 0;
    const color =
      value >= 90
        ? 'text-green-600'
        : value >= 70
          ? 'text-yellow-600'
          : 'text-red-600';
    return <span className={`font-medium ${color}`}>{value.toFixed(1)}%</span>;
  };

  return (
    <DxDataGrid
      dataSource={recalls as unknown as Record<string, unknown>[]}
      showBorders
      rowAlternationEnabled
      onRowClick={handleRowClick}
      className="cursor-pointer"
      loading={loading}
    >
      <DxFilterRow visible />
      <DxSorting mode="multiple" />
      <DxPaging defaultPageSize={20} />

      <DxColumn
        dataField="recallNumber"
        caption="เลขที่การเรียกคืน"
        width={140}
        cellRender={(cellData: { value: string }) => (
          <span className="font-mono text-primary">{cellData.value}</span>
        )}
      />
      <DxColumn dataField="initiatedDate" caption="วันที่เริ่ม" dataType="date" width={110} />
      <DxColumn
        dataField="recallClass"
        caption="ระดับ"
        width={100}
        cellRender={renderClassCell}
      />
      <DxColumn dataField="productName" caption="ผลิตภัณฑ์" minWidth={150} />
      <DxColumn dataField="reason" caption="เหตุผล" minWidth={200} />
      <DxColumn
        dataField="status"
        caption="สถานะ"
        width={130}
        cellRender={renderStatusCell}
      />
      <DxColumn
        dataField="distributedQuantity"
        caption="กระจายแล้ว"
        width={100}
        dataType="number"
        format="#,##0"
      />
      <DxColumn
        dataField="effectivenessRate"
        caption="ประสิทธิผล"
        width={110}
        cellRender={renderEffectivenessCell}
      />
      <DxColumn dataField="coordinatorName" caption="ผู้ประสานงาน" width={130} />
    </DxDataGrid>
  );
}
