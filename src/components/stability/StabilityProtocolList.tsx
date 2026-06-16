'use client';

/**
 * Stability Protocol List Component
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 7.4)
 *
 * DataGrid showing stability protocols with status and actions.
 */

import { useRouter } from 'next/navigation';
import { DxDataGrid, DxColumn, DxPaging, DxSearchPanel } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { FileText, CheckCircle, Clock, Archive } from 'lucide-react';
import type { StabilityProtocol, StabilityProtocolStatus } from '@/types/stability';

interface StabilityProtocolListProps {
  protocols: StabilityProtocol[];
  loading?: boolean;
  onApprove?: (protocolId: number) => void;
}

const statusConfig: Record<
  StabilityProtocolStatus,
  { label: string; color: string; icon: React.ReactNode }
> = {
  draft: {
    label: 'ฉบับร่าง',
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    icon: <Clock className="h-3 w-3" />,
  },
  approved: {
    label: 'อนุมัติแล้ว',
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    icon: <CheckCircle className="h-3 w-3" />,
  },
  obsolete: {
    label: 'ยกเลิกใช้งาน',
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
    icon: <Archive className="h-3 w-3" />,
  },
};

const studyTypeLabels: Record<string, string> = {
  long_term: 'ระยะยาว',
  accelerated: 'เร่งสภาวะ',
  intermediate: 'ระยะกลาง',
};

export function StabilityProtocolList({
  protocols,
  loading = false,
  onApprove,
}: StabilityProtocolListProps) {
  const router = useRouter();

  const renderStatusCell = (cellData: { value: StabilityProtocolStatus }) => {
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

  const renderStudyTypeCell = (cellData: { value: string }) => {
    return <span>{studyTypeLabels[cellData.value] || cellData.value}</span>;
  };

  const renderTimepointsCell = (cellData: { value: number[] }) => {
    if (!cellData.value || cellData.value.length === 0) return '-';
    return (
      <span className="text-sm">
        {cellData.value.slice(0, 5).join(', ')}
        {cellData.value.length > 5 && `... (+${cellData.value.length - 5})`}
      </span>
    );
  };

  const renderActionsCell = (cellData: { data: StabilityProtocol }) => {
    const protocol = cellData.data;
    return (
      <div className="flex items-center gap-1">
        <DxButton
          text="ดูรายละเอียด"
          stylingMode="text"
          onClick={() => router.push(`/gmp/stability/protocols/${protocol.id}`)}
        />
        {protocol.status === 'draft' && onApprove && (
          <DxButton
            text="อนุมัติ"
            stylingMode="text"
            type="success"
            onClick={() => onApprove(protocol.id)}
          />
        )}
      </div>
    );
  };

  return (
    <DxDataGrid
      dataSource={protocols}
      showBorders
      rowAlternationEnabled
      loading={loading}
      onRowClick={(e) => {
        if (e.data) {
          router.push(`/gmp/stability/protocols/${e.data.id}`);
        }
      }}
    >
      <DxSearchPanel visible placeholder="ค้นหาโปรโตคอล..." />
      <DxPaging defaultPageSize={15} />

      <DxColumn dataField="protocolNumber" caption="เลขที่โปรโตคอล" width={150} />
      <DxColumn dataField="name" caption="ชื่อ" minWidth={200} />
      <DxColumn dataField="productName" caption="ผลิตภัณฑ์" minWidth={150} />
      <DxColumn
        dataField="studyType"
        caption="ประเภทการศึกษา"
        width={120}
        cellRender={renderStudyTypeCell}
      />
      <DxColumn dataField="storageCondition" caption="สภาวะจัดเก็บ" width={130} />
      <DxColumn
        dataField="timepoints"
        caption="จุดเวลาตรวจ (เดือน)"
        width={180}
        cellRender={renderTimepointsCell}
        allowSorting={false}
      />
      <DxColumn
        dataField="status"
        caption="สถานะ"
        width={110}
        cellRender={renderStatusCell}
      />
      <DxColumn
        caption="การดำเนินการ"
        width={130}
        cellRender={renderActionsCell}
        allowFiltering={false}
        allowSorting={false}
      />
    </DxDataGrid>
  );
}
