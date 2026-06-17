'use client';

/**
 * Complaint List Component
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * Displays list of complaints with filtering and status indicators.
 */

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DxDataGrid, type DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { WorkflowStatusBadge } from '@/components/shared/WorkflowStatusBadge';
import { MessageSquareWarning, AlertTriangle } from 'lucide-react';
import type {
  Complaint,
  ComplaintListParams,
  ComplaintStatus,
  ComplaintCategory,
  ComplaintSeverity,
} from '@/types/complaints';

// ============================================
// Types
// ============================================

interface ComplaintListProps {
  status?: ComplaintStatus;
  category?: ComplaintCategory;
  severity?: ComplaintSeverity;
  onComplaintSelect?: (complaint: Complaint) => void;
  onNewComplaint?: () => void;
}

// ============================================
// API Functions
// ============================================

async function fetchComplaints(params: ComplaintListParams): Promise<{
  complaints: Complaint[];
  total: number;
}> {
  const searchParams = new URLSearchParams();
  if (params.status) searchParams.set('status', params.status);
  if (params.category) searchParams.set('category', params.category);
  if (params.severity) searchParams.set('severity', params.severity);
  if (params.productId) searchParams.set('productId', params.productId.toString());
  if (params.fromDate) searchParams.set('fromDate', params.fromDate);
  if (params.toDate) searchParams.set('toDate', params.toDate);
  if (params.page) searchParams.set('page', params.page.toString());
  if (params.limit) searchParams.set('limit', params.limit.toString());

  const response = await fetch(`/api/complaints?${searchParams.toString()}`);
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch complaints');
  }
  return result.data;
}

// ============================================
// Component
// ============================================

export function ComplaintList({
  status,
  category,
  severity,
  onComplaintSelect,
  onNewComplaint,
}: ComplaintListProps) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['complaints', { status, category, severity, page, limit: pageSize }],
    queryFn: () => fetchComplaints({ status, category, severity, page, limit: pageSize }),
  });

  // Handle row click
  const handleRowClick = useCallback((e: { data: Complaint }) => {
    onComplaintSelect?.(e.data);
  }, [onComplaintSelect]);

  // Severity badge render
  const renderSeverity = (cellData: { value: ComplaintSeverity }) => {
    const severityColors: Record<ComplaintSeverity, string> = {
      minor: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      major: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${severityColors[cellData.value]}`}>
        {cellData.value.toUpperCase()}
      </span>
    );
  };

  // Status render
  const renderStatus = (cellData: { value: ComplaintStatus }) => {
    return <WorkflowStatusBadge status={cellData.value} />;
  };

  // Source render
  const renderSource = (cellData: { value: string }) => {
    const labels: Record<string, string> = {
      customer: 'ลูกค้า',
      distributor: 'ผู้จัดจำหน่าย',
      regulatory: 'หน่วยงานกำกับ',
      internal: 'ภายใน',
    };
    return labels[cellData.value] || cellData.value;
  };

  // Category render
  const renderCategory = (cellData: { value: string }) => {
    const labels: Record<string, string> = {
      quality: 'คุณภาพ',
      efficacy: 'ประสิทธิภาพ',
      safety: 'ความปลอดภัย',
      packaging: 'บรรจุภัณฑ์',
      labeling: 'ฉลาก',
      other: 'อื่น ๆ',
    };
    return labels[cellData.value] || cellData.value;
  };

  // Regulatory flag
  const renderRegulatoryFlag = (cellData: { data: Complaint }) => {
    if (cellData.data.regulatoryReportRequired) {
      return (
        <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-xs">หน่วยงานกำกับ</span>
        </span>
      );
    }
    return null;
  };

  // Error state
  if (error) {
    return (
      <div className="bg-card border rounded-lg shadow-sm p-6">
        <div className="text-center py-8">
          <p className="text-destructive mb-4">ไม่สามารถโหลดข้อร้องเรียนได้</p>
          <DxButton
            text="ลองใหม่"
            onClick={() => refetch()}
            stylingMode="outlined"
          />
        </div>
      </div>
    );
  }

  const columns = [
    {
      dataField: 'complaintNumber',
      caption: 'เลขที่ข้อร้องเรียน',
      width: 150,
      fixed: true,
    },
    {
      dataField: 'receivedDate',
      caption: 'รับเมื่อ',
      width: 110,
      dataType: 'date',
    },
    {
      dataField: 'source',
      caption: 'แหล่งที่มา',
      width: 110,
      cellRender: renderSource,
    },
    {
      dataField: 'customerName',
      caption: 'ลูกค้า',
      width: 150,
    },
    {
      dataField: 'productName',
      caption: 'ผลิตภัณฑ์',
      minWidth: 150,
    },
    {
      dataField: 'category',
      caption: 'หมวดหมู่',
      width: 100,
      cellRender: renderCategory,
    },
    {
      dataField: 'severity',
      caption: 'ความรุนแรง',
      width: 100,
      cellRender: renderSeverity,
    },
    {
      dataField: 'status',
      caption: 'สถานะ',
      width: 150,
      cellRender: renderStatus,
    },
    {
      dataField: 'regulatoryReportRequired',
      caption: '',
      width: 100,
      cellRender: renderRegulatoryFlag,
    },
    {
      dataField: 'capaNumber',
      caption: 'CAPA',
      width: 140,
      cellRender: (cellData: { value: string | undefined }) => {
        if (cellData.value) {
          return (
            <span className="text-primary font-mono text-xs">{cellData.value}</span>
          );
        }
        return <span className="text-muted-foreground text-xs">-</span>;
      },
    },
  ];

  return (
    <div className="bg-card border rounded-lg shadow-sm">
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquareWarning className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">ข้อร้องเรียน</h3>
        </div>
        <div className="flex items-center gap-2">
          <DxButton
            text="รีเฟรช"
            icon="refresh"
            onClick={() => refetch()}
            stylingMode="outlined"
          />
          {onNewComplaint && (
            <DxButton
              text="เพิ่มข้อร้องเรียน"
              icon="add"
              onClick={onNewComplaint}
              type="success"
            />
          )}
        </div>
      </div>

      <DxDataGrid
        dataSource={data?.complaints || []}
        columns={columns as DxDataGridColumn[]}
        showBorders={false}
        rowAlternationEnabled
        onRowClick={handleRowClick}
        paging
        pageSize={pageSize}
        allowedPageSizes={[10, 20, 50]}
        loading={isLoading}
        noDataText="ไม่พบข้อร้องเรียน"
        height="auto"
      />
    </div>
  );
}
