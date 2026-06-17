'use client';

/**
 * VMI Orders Grid Component
 *
 * Displays VMI orders in a DataGrid with filtering and actions.
 *
 * Feature: 008-vmi-vendor-sync
 */

import { DxDataGrid, type DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { cn } from '@/lib/utils/cn';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import type { DataGridTypes } from 'devextreme-react/data-grid';
import type { VmiSalesOrderStatus } from '@/types/vmi';

// ============================================
// Types
// ============================================

interface VmiOrder {
  id: number;
  portalId: number;
  portalName?: string;
  portalOrderId: string;
  orderDate: string;
  customerId?: number;
  customerName?: string;
  hospitalCode?: string;
  status: VmiSalesOrderStatus;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  totalItems: number;
  totalAmount?: number;
  matchedItems: number;
  unmatchedItems: number;
  requestedDeliveryDate?: string;
  confirmedAt?: string;
  shippedAt?: string;
  createdAt: string;
}

interface VmiOrdersGridProps {
  onOrderSelect?: (order: VmiOrder) => void;
  onOrderConfirm?: (orderId: number) => void;
  onOrderShip?: (orderId: number) => void;
  portalId?: number;
  status?: VmiSalesOrderStatus;
}

// ============================================
// API Functions
// ============================================

async function fetchVmiOrders(params: {
  page?: number;
  limit?: number;
  portalId?: number;
  status?: VmiSalesOrderStatus;
}): Promise<{ items: VmiOrder[]; total: number; page: number; limit: number }> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.portalId) searchParams.set('portalId', String(params.portalId));
  if (params.status) searchParams.set('status', params.status);

  const response = await fetch(`/api/sales/vmi-orders?${searchParams}`);
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch VMI orders');
  }
  // Map API VmiSalesOrderSummary fields to frontend VmiOrder fields
  const data = result.data;
  return {
    ...data,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items: (data.items || []).map((item: any) => ({
      id: item.id,
      portalId: item.portalId,
      portalName: item.portalName,
      portalOrderId: item.vmiOrderId,
      orderDate: item.orderDate,
      customerId: item.customerId,
      customerName: item.vmiCustomerName || 'Unknown',
      hospitalCode: item.vmiCustomerId,
      status: item.localStatus || 'pending',
      priority: 'normal',
      totalItems: item.lineCount || 0,
      totalAmount: item.totalAmount,
      matchedItems: (item.lineCount || 0) - (item.unmatchedLineCount || 0),
      unmatchedItems: item.unmatchedLineCount || 0,
      requestedDeliveryDate: item.requiredDate,
      confirmedAt: item.confirmedAt,
      shippedAt: item.shippedAt,
      createdAt: item.polledAt || item.orderDate,
    })),
  };
}

async function pollOrders(portalId?: number): Promise<{ summary: { totalNewOrders: number } }> {
  const response = await fetch('/api/sales/vmi-orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ portalId }),
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to poll orders');
  }
  return result.data;
}

// ============================================
// Component
// ============================================

export function VmiOrdersGrid({
  onOrderSelect,
  onOrderConfirm,
  onOrderShip,
  portalId,
  status,
}: VmiOrdersGridProps) {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['vmi-orders', portalId, status],
    queryFn: () => fetchVmiOrders({ portalId, status, limit: 50 }),
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const pollMutation = useMutation({
    mutationFn: () => pollOrders(portalId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['vmi-orders'] });
      if (result.summary.totalNewOrders > 0) {
        // Could show a toast notification here
        console.log(`Received ${result.summary.totalNewOrders} new orders`);
      }
    },
  });

  const columns: DxDataGridColumn[] = [
    {
      dataField: 'portalOrderId',
      caption: 'รหัสคำสั่งซื้อพอร์ทัล',
      width: 140,
    },
    {
      dataField: 'portalName',
      caption: 'พอร์ทัล',
      width: 120,
    },
    {
      dataField: 'orderDate',
      caption: 'วันที่สั่งซื้อ',
      dataType: 'date',
      width: 110,
      cellRender: (cellInfo: DataGridTypes.ColumnCellTemplateData) => {
        if (!cellInfo.value) return '-';
        return new Date(cellInfo.value as string).toLocaleDateString();
      },
    },
    {
      dataField: 'customerName',
      caption: 'ลูกค้า',
      width: 180,
    },
    {
      dataField: 'status',
      caption: 'สถานะ',
      width: 100,
      cellRender: (cellInfo: DataGridTypes.ColumnCellTemplateData) => {
        const statusColors: Record<string, string> = {
          pending: 'bg-yellow-50 text-yellow-700',
          confirmed: 'bg-blue-50 text-blue-700',
          processing: 'bg-purple-50 text-purple-700',
          shipped: 'bg-green-50 text-green-700',
          delivered: 'bg-green-100 text-green-800',
          cancelled: 'bg-red-50 text-red-700',
        };
        const statusLabels: Record<string, string> = {
          pending: 'รอดำเนินการ',
          confirmed: 'ยืนยันแล้ว',
          processing: 'กำลังดำเนินการ',
          shipped: 'จัดส่งแล้ว',
          delivered: 'ส่งถึงแล้ว',
          cancelled: 'ยกเลิก',
        };
        const st = cellInfo.value as string;
        return (
          <span className={cn('px-2 py-1 rounded text-xs font-medium', statusColors[st])}>
            {statusLabels[st] || st}
          </span>
        );
      },
    },
    {
      dataField: 'priority',
      caption: 'ความสำคัญ',
      width: 90,
      cellRender: (cellInfo: DataGridTypes.ColumnCellTemplateData) => {
        const priorityColors: Record<string, string> = {
          low: 'text-gray-500',
          normal: 'text-blue-600',
          high: 'text-orange-600',
          urgent: 'text-red-600 font-bold',
        };
        const p = cellInfo.value as string;
        return <span className={priorityColors[p]}>{p}</span>;
      },
    },
    {
      dataField: 'totalItems',
      caption: 'รายการ',
      width: 70,
      alignment: 'center',
    },
    {
      dataField: 'matchedItems',
      caption: 'สถานะการจับคู่',
      width: 100,
      cellRender: (cellInfo: DataGridTypes.ColumnCellTemplateData) => {
        const rowData = cellInfo.data as VmiOrder;
        const matched = rowData.matchedItems || 0;
        const total = rowData.totalItems || 0;
        const allMatched = matched === total;
        return (
          <span className={allMatched ? 'text-green-600' : 'text-orange-600'}>
            {matched}/{total}
          </span>
        );
      },
    },
    {
      dataField: 'totalAmount',
      caption: 'จำนวนเงิน',
      width: 100,
      dataType: 'number',
      format: { type: 'fixedPoint', precision: 2 },
      cellRender: (cellInfo: DataGridTypes.ColumnCellTemplateData) => {
        if (cellInfo.value == null) return '-';
        return `${Number(cellInfo.value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
      },
    },
    {
      dataField: 'requestedDeliveryDate',
      caption: 'วันที่ขอจัดส่ง',
      width: 130,
      cellRender: (cellInfo: DataGridTypes.ColumnCellTemplateData) => {
        if (!cellInfo.value) return '-';
        return new Date(cellInfo.value as string).toLocaleDateString();
      },
    },
    {
      caption: 'การดำเนินการ',
      width: 150,
      cellRender: (cellInfo: DataGridTypes.ColumnCellTemplateData) => {
        const order = cellInfo.data as VmiOrder;
        return (
          <div className="flex gap-1">
            <DxButton
              text="ดู"
              type="normal"
              stylingMode="text"
              onClick={() => onOrderSelect?.(order)}
            />
            {order.status === 'pending' && order.matchedItems === order.totalItems && (
              <DxButton
                text="ยืนยัน"
                type="success"
                stylingMode="text"
                onClick={() => onOrderConfirm?.(order.id)}
              />
            )}
            {(order.status === 'confirmed' || order.status === 'processing') && (
              <DxButton
                text="จัดส่ง"
                type="default"
                stylingMode="text"
                onClick={() => onOrderShip?.(order.id)}
              />
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <DxButton
            text={pollMutation.isPending ? 'กำลังดึงข้อมูล...' : 'ดึงคำสั่งซื้อ'}
            icon={pollMutation.isPending ? undefined : 'refresh'}
            type="default"
            onClick={() => pollMutation.mutate()}
            disabled={pollMutation.isPending}
          >
            {pollMutation.isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
          </DxButton>
        </div>
        <DxButton
          icon="refresh"
          type="normal"
          onClick={() => refetch()}
          hint="รีเฟรช"
        />
      </div>

      {/* Error display */}
      {error && (
        <div className="p-4 rounded-lg bg-red-50 text-red-800 border border-red-200">
          {error instanceof Error ? error.message : 'โหลดคำสั่งซื้อไม่สำเร็จ'}
        </div>
      )}

      {/* Data Grid */}
      <DxDataGrid
        dataSource={data?.items || []}
        columns={columns}
        keyExpr="id"
        loading={isLoading}
        height={500}
        paging
        pageSize={20}
        sorting
        filterRow
        columnChooser
        noDataText="ไม่พบคำสั่งซื้อ VMI"
        onRowClick={(e) => {
          if (e.data && onOrderSelect) {
            onOrderSelect(e.data as VmiOrder);
          }
        }}
      />
    </div>
  );
}

export default VmiOrdersGrid;
