'use client';

/**
 * VMI Webhook Delivery History Grid Component
 *
 * Displays webhook delivery history in a DataGrid with filtering and status indicators.
 *
 * Feature: 012-vmi-webhook
 * Task: T045
 */

import * as React from 'react';
import { DxDataGrid, type DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { cn } from '@/lib/utils/cn';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { VmiWebhookDeliveryStatus, VmiWebhookEventType } from '@/types/vmi';

// ============================================
// Types
// ============================================

interface WebhookDelivery {
  id: number;
  deliveryId: string;
  eventType: VmiWebhookEventType;
  eventId: string;
  signatureValid: boolean;
  status: VmiWebhookDeliveryStatus;
  responseCode: number | null;
  errorMessage: string | null;
  processingDurationMs: number | null;
  receivedAt: string;
  processedAt: string | null;
}

interface WebhookDeliveryGridProps {
  portalId: number;
  webhookId: number;
  className?: string;
}

interface DeliveryFilter {
  status?: VmiWebhookDeliveryStatus;
  eventType?: VmiWebhookEventType;
  dateFrom?: string;
  dateTo?: string;
}

// ============================================
// API Functions
// ============================================

async function fetchDeliveries(
  portalId: number,
  webhookId: number,
  filters: DeliveryFilter,
  page: number,
  pageSize: number
): Promise<{
  deliveries: WebhookDelivery[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}> {
  const searchParams = new URLSearchParams();
  searchParams.set('page', String(page));
  searchParams.set('pageSize', String(pageSize));

  if (filters.status) searchParams.set('status', filters.status);
  if (filters.eventType) searchParams.set('eventType', filters.eventType);
  if (filters.dateFrom) searchParams.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) searchParams.set('dateTo', filters.dateTo);

  const response = await fetch(
    `/api/sales/vmi-orders/portals/${portalId}/webhooks/${webhookId}/deliveries?${searchParams}`
  );
  const result = await response.json();

  if (!result.success) {
    throw new Error(result.message || 'Failed to fetch deliveries');
  }

  return result;
}

// ============================================
// Helper Functions
// ============================================

function getStatusBadge(status: VmiWebhookDeliveryStatus) {
  switch (status) {
    case 'processed':
      return (
        <Badge variant="success" dot>
          สำเร็จ
        </Badge>
      );
    case 'failed':
      return (
        <Badge variant="danger" dot>
          ล้มเหลว
        </Badge>
      );
    case 'pending':
      return (
        <Badge variant="warning" dot>
          รอดำเนินการ
        </Badge>
      );
    default:
      return <Badge variant="info">{status}</Badge>;
  }
}

function getEventTypeBadge(eventType: VmiWebhookEventType) {
  const config: Record<VmiWebhookEventType, { label: string; variant: 'info' | 'warning' | 'success' | 'danger' }> = {
    'order.created': { label: 'สร้างคำสั่งซื้อ', variant: 'info' },
    'order.cancelled': { label: 'ยกเลิก', variant: 'danger' },
    'receipt.created': { label: 'รับสินค้า', variant: 'warning' },
    'receipt.completed': { label: 'รับครบ', variant: 'success' },
  };

  const { label, variant } = config[eventType] || { label: eventType, variant: 'info' as const };
  return <Badge variant={variant}>{label}</Badge>;
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '-';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// ============================================
// Component
// ============================================

export function WebhookDeliveryGrid({
  portalId,
  webhookId,
  className,
}: WebhookDeliveryGridProps) {
  const [page, setPage] = React.useState(1);
  const [pageSize] = React.useState(20);
  const [filters, setFilters] = React.useState<DeliveryFilter>({});

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['webhook-deliveries', portalId, webhookId, filters, page, pageSize],
    queryFn: () => fetchDeliveries(portalId, webhookId, filters, page, pageSize),
  });

  const columns: DxDataGridColumn[] = [
    {
      dataField: 'receivedAt',
      caption: 'เวลาที่รับ',
      dataType: 'datetime',
      width: 180,
      cellRender: ({ data }: { data?: WebhookDelivery }) => {
        if (!data) return null;
        return <span className="text-sm">{formatDate(data.receivedAt)}</span>;
      },
    },
    {
      dataField: 'eventType',
      caption: 'ประเภท Event',
      width: 150,
      cellRender: ({ data }: { data?: WebhookDelivery }) => {
        if (!data) return null;
        return getEventTypeBadge(data.eventType);
      },
    },
    {
      dataField: 'status',
      caption: 'สถานะ',
      width: 120,
      cellRender: ({ data }: { data?: WebhookDelivery }) => {
        if (!data) return null;
        return getStatusBadge(data.status);
      },
    },
    {
      dataField: 'signatureValid',
      caption: 'Signature',
      width: 100,
      alignment: 'center',
      cellRender: ({ data }: { data?: WebhookDelivery }) => {
        if (!data) return null;
        return data.signatureValid ? (
          <CheckCircle className="h-4 w-4 text-green-500 mx-auto" />
        ) : (
          <XCircle className="h-4 w-4 text-red-500 mx-auto" />
        );
      },
    },
    {
      dataField: 'responseCode',
      caption: 'Response',
      width: 100,
      alignment: 'center',
      cellRender: ({ data }: { data?: WebhookDelivery }) => {
        if (!data) return null;
        if (data.responseCode === null) return '-';
        const isSuccess = data.responseCode >= 200 && data.responseCode < 300;
        return (
          <span
            className={cn(
              'font-mono text-sm',
              isSuccess ? 'text-green-600' : 'text-red-600'
            )}
          >
            {data.responseCode}
          </span>
        );
      },
    },
    {
      dataField: 'processingDurationMs',
      caption: 'เวลาประมวลผล',
      width: 120,
      alignment: 'right',
      cellRender: ({ data }: { data?: WebhookDelivery }) => {
        if (!data) return null;
        return <span className="font-mono text-sm">{formatDuration(data.processingDurationMs)}</span>;
      },
    },
    {
      dataField: 'deliveryId',
      caption: 'Delivery ID',
      width: 150,
      cellRender: ({ data }: { data?: WebhookDelivery }) => {
        if (!data) return null;
        return (
          <span className="font-mono text-xs text-gray-500 truncate" title={data.deliveryId}>
            {data.deliveryId.slice(0, 20)}...
          </span>
        );
      },
    },
    {
      dataField: 'errorMessage',
      caption: 'ข้อผิดพลาด',
      minWidth: 200,
      cellRender: ({ data }: { data?: WebhookDelivery }) => {
        if (!data) return null;
        return data.errorMessage ? (
          <span className="text-sm text-red-600 truncate" title={data.errorMessage}>
            {data.errorMessage}
          </span>
        ) : (
          <span className="text-gray-400">-</span>
        );
      },
    },
  ];

  if (error) {
    return (
      <div className={cn('rounded-lg border border-red-200 bg-red-50 p-4', className)}>
        <p className="text-red-600">Failed to load delivery history: {(error as Error).message}</p>
        <button
          onClick={() => refetch()}
          className="mt-2 text-sm text-red-700 underline hover:no-underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Filters */}
      <div className="flex flex-wrap gap-4 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">สถานะ:</label>
          <select
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
            value={filters.status || ''}
            onChange={(e) => {
              setFilters({ ...filters, status: e.target.value as VmiWebhookDeliveryStatus || undefined });
              setPage(1);
            }}
          >
            <option value="">ทั้งหมด</option>
            <option value="processed">สำเร็จ</option>
            <option value="failed">ล้มเหลว</option>
            <option value="pending">รอดำเนินการ</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">ประเภท:</label>
          <select
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
            value={filters.eventType || ''}
            onChange={(e) => {
              setFilters({ ...filters, eventType: e.target.value as VmiWebhookEventType || undefined });
              setPage(1);
            }}
          >
            <option value="">ทั้งหมด</option>
            <option value="order.created">สร้างคำสั่งซื้อ</option>
            <option value="order.cancelled">ยกเลิกคำสั่งซื้อ</option>
            <option value="receipt.created">สร้างใบรับ</option>
            <option value="receipt.completed">รับครบ</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">จาก:</label>
          <input
            type="date"
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
            value={filters.dateFrom || ''}
            onChange={(e) => {
              setFilters({ ...filters, dateFrom: e.target.value || undefined });
              setPage(1);
            }}
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">ถึง:</label>
          <input
            type="date"
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
            value={filters.dateTo || ''}
            onChange={(e) => {
              setFilters({ ...filters, dateTo: e.target.value || undefined });
              setPage(1);
            }}
          />
        </div>

        <button
          onClick={() => refetch()}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" />
          รีเฟรช
        </button>
      </div>

      {/* Grid */}
      <DxDataGrid
        dataSource={data?.deliveries || []}
        columns={columns}
        showBorders
        columnAutoWidth={false}
        allowColumnResizing
        rowAlternationEnabled
        paging={false}
        noDataText={isLoading ? "กำลังโหลด..." : "ไม่มีข้อมูลการส่ง Webhook"}
      />

      {/* Pagination */}
      {data?.pagination && (
        <div className="flex items-center justify-between px-2">
          <div className="text-sm text-gray-600">
            แสดง {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, data.pagination.totalItems)} จาก {data.pagination.totalItems} รายการ
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
              ก่อนหน้า
            </button>

            <span className="text-sm text-gray-600">
              หน้า {page} จาก {data.pagination.totalPages}
            </span>

            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= data.pagination.totalPages}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ถัดไป
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default WebhookDeliveryGrid;
