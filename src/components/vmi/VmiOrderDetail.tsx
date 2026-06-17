'use client';

/**
 * VMI Order Detail Component
 *
 * Displays detailed information about a VMI order including lines.
 *
 * Feature: 008-vmi-vendor-sync
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DxDataGrid, type DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { DxPopup } from '@/components/ui/dx-popup';
import { ItemSearchDialog } from '@/components/ui/item-search-dialog';
import { cn } from '@/lib/utils/cn';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Package,
  Calendar,
  Building2,
  AlertTriangle,
  CheckCircle,
  Truck,
  Clock,
} from 'lucide-react';
import type { DataGridTypes } from 'devextreme-react/data-grid';
import type { VmiSalesOrderStatus } from '@/types/vmi';

// ============================================
// Types
// ============================================

interface VmiOrderLine {
  id: number;
  lineNumber: number;
  portalItemCode: string;
  portalItemName?: string;
  tppCode?: string;
  ttmtCode?: string;
  matchedItemId?: number;
  matchedItemCode?: string;
  matchedItemName?: string;
  matchMethod?: 'tpp' | 'ttmt' | 'code' | 'manual' | null;
  quantity: number;
  unit?: string;
  unitPrice?: number;
  lineTotal?: number;
}

interface VmiOrderDetail {
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
  notes?: string;
  confirmedAt?: string;
  confirmedByName?: string;
  salesOrderId?: number;
  salesOrderNumber?: string;
  shippedAt?: string;
  shippedByName?: string;
  trackingNumber?: string;
  carrier?: string;
  createdAt: string;
  updatedAt: string;
  lines?: VmiOrderLine[];
}

interface VmiOrderDetailProps {
  orderId: number;
  onClose?: () => void;
  onConfirm?: () => void;
  onShip?: () => void;
}

// ============================================
// API Functions
// ============================================

async function fetchOrderDetail(orderId: number): Promise<VmiOrderDetail> {
  const response = await fetch(`/api/sales/vmi-orders/${orderId}`);
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch order');
  }
  // Map API VmiSalesOrderDetail fields to component VmiOrderDetail fields
  const data = result.data;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lines: VmiOrderLine[] = (data.lines || []).map((line: any, idx: number) => ({
    id: line.id,
    lineNumber: idx + 1,
    portalItemCode: line.localCode || line.vmiLineId || '',
    portalItemName: line.itemName,
    tppCode: line.tppCode,
    ttmtCode: line.ttmtCode,
    matchedItemId: line.matchedItem?.id || line.itemId || null,
    matchedItemCode: line.matchedItem?.code || null,
    matchedItemName: line.matchedItem?.nameTh || line.matchedItem?.nameEn || null,
    matchMethod: line.matchStatus === 'manual_mapped' ? 'manual'
      : line.matchStatus === 'matched' ? 'code'
      : null,
    quantity: line.quantity,
    unit: line.unit,
    unitPrice: line.unitPrice,
    lineTotal: line.lineTotal,
  }));
  const matchedCount = lines.filter(l => l.matchedItemId).length;
  return {
    id: data.id,
    portalId: data.portalId,
    portalName: data.portalName,
    portalOrderId: data.vmiOrderId,
    orderDate: data.orderDate,
    customerId: data.customerId,
    customerName: data.vmiCustomerName || data.customer?.name || 'Unknown',
    hospitalCode: data.vmiCustomerId,
    status: data.localStatus || 'pending',
    priority: 'normal',
    totalItems: data.lineCount || lines.length,
    totalAmount: data.totalAmount,
    matchedItems: matchedCount,
    unmatchedItems: (data.lineCount || lines.length) - matchedCount,
    requestedDeliveryDate: data.requiredDate,
    notes: data.notes,
    confirmedAt: data.confirmedAt,
    salesOrderId: data.salesOrderId,
    shippedAt: data.shippedAt,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    lines,
  };
}

async function matchLine(
  orderId: number,
  lineId: number,
  itemId: number,
  userId: number
): Promise<void> {
  const response = await fetch(`/api/sales/vmi-orders/${orderId}/lines/${lineId}/match`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemId, userId }),
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to match line');
  }
}

async function confirmOrder(orderId: number, userId: number): Promise<void> {
  const response = await fetch(`/api/sales/vmi-orders/${orderId}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to confirm order');
  }
}

async function shipOrder(
  orderId: number,
  userId: number,
  shipmentData: { trackingNumber?: string; carrier?: string }
): Promise<void> {
  const response = await fetch(`/api/sales/vmi-orders/${orderId}/ship`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, ...shipmentData }),
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to ship order');
  }
}

// ============================================
// Component
// ============================================

export function VmiOrderDetail({ orderId, onClose, onConfirm, onShip }: VmiOrderDetailProps) {
  const queryClient = useQueryClient();
  const [matchingLine, setMatchingLine] = useState<VmiOrderLine | null>(null);
  const [showShipDialog, setShowShipDialog] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [carrier, setCarrier] = useState('');

  // TODO: Get actual user ID from session
  const userId = 1;

  const { data: order, isLoading, error, refetch } = useQuery({
    queryKey: ['vmi-order', orderId],
    queryFn: () => fetchOrderDetail(orderId),
  });

  const matchMutation = useMutation({
    mutationFn: ({ lineId, itemId }: { lineId: number; itemId: number }) =>
      matchLine(orderId, lineId, itemId, userId),
    onSuccess: () => {
      setMatchingLine(null);
      refetch();
      queryClient.invalidateQueries({ queryKey: ['vmi-orders'] });
    },
  });

  const confirmMutation = useMutation({
    mutationFn: () => confirmOrder(orderId, userId),
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ['vmi-orders'] });
      onConfirm?.();
    },
  });

  const shipMutation = useMutation({
    mutationFn: () => shipOrder(orderId, userId, { trackingNumber, carrier }),
    onSuccess: () => {
      setShowShipDialog(false);
      refetch();
      queryClient.invalidateQueries({ queryKey: ['vmi-orders'] });
      onShip?.();
    },
  });

  const getStatusColor = (status: VmiSalesOrderStatus) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-blue-100 text-blue-800',
      processing: 'bg-purple-100 text-purple-800',
      shipped: 'bg-green-100 text-green-800',
      delivered: 'bg-green-200 text-green-900',
      cancelled: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const lineColumns: DxDataGridColumn[] = [
    { dataField: 'lineNumber', caption: '#', width: 50, alignment: 'center' },
    { dataField: 'portalItemCode', caption: 'รหัสพอร์ทัล', width: 120 },
    { dataField: 'portalItemName', caption: 'ชื่อรายการพอร์ทัล', width: 200 },
    { dataField: 'tppCode', caption: 'รหัส TPP', width: 100 },
    { dataField: 'ttmtCode', caption: 'รหัส TTMT', width: 100 },
    {
      dataField: 'matchedItemCode',
      caption: 'รายการที่จับคู่',
      width: 180,
      cellRender: (cellInfo: DataGridTypes.ColumnCellTemplateData) => {
        const line = cellInfo.data as VmiOrderLine;
        if (!line.matchedItemId) {
          return (
            <span className="flex items-center gap-1 text-orange-600">
              <AlertTriangle className="h-4 w-4" />
              ยังไม่จับคู่
            </span>
          );
        }
        return (
          <span className="flex items-center gap-1 text-green-600">
            <CheckCircle className="h-4 w-4" />
            {line.matchedItemCode}
          </span>
        );
      },
    },
    {
      dataField: 'matchMethod',
      caption: 'วิธีจับคู่',
      width: 90,
      cellRender: (cellInfo: DataGridTypes.ColumnCellTemplateData) => {
        if (!cellInfo.value) return '-';
        const methodLabels: Record<string, string> = {
          tpp: 'TPP',
          ttmt: 'TTMT',
          code: 'รหัส',
          manual: 'ด้วยตนเอง',
        };
        return methodLabels[cellInfo.value as string] || cellInfo.value;
      },
    },
    { dataField: 'quantity', caption: 'จำนวน', width: 70, alignment: 'right' },
    { dataField: 'unit', caption: 'หน่วย', width: 60 },
    {
      dataField: 'unitPrice',
      caption: 'ราคา',
      width: 80,
      alignment: 'right',
      cellRender: (cellInfo: DataGridTypes.ColumnCellTemplateData) => {
        if (cellInfo.value == null) return '-';
        return Number(cellInfo.value).toLocaleString(undefined, { minimumFractionDigits: 2 });
      },
    },
    {
      dataField: 'lineTotal',
      caption: 'รวม',
      width: 100,
      alignment: 'right',
      cellRender: (cellInfo: DataGridTypes.ColumnCellTemplateData) => {
        if (cellInfo.value == null) return '-';
        return Number(cellInfo.value).toLocaleString(undefined, { minimumFractionDigits: 2 });
      },
    },
    {
      caption: 'การดำเนินการ',
      width: 100,
      cellRender: (cellInfo: DataGridTypes.ColumnCellTemplateData) => {
        const line = cellInfo.data as VmiOrderLine;
        if (order?.status !== 'pending') return null;
        if (!line.matchedItemId) {
          return (
            <DxButton
              text="จับคู่"
              type="default"
              stylingMode="text"
              onClick={() => setMatchingLine(line)}
            />
          );
        }
        return (
          <DxButton
            text="จับคู่ใหม่"
            type="normal"
            stylingMode="text"
            onClick={() => setMatchingLine(line)}
          />
        );
      },
    },
  ];

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-gray-500">
          กำลังโหลดรายละเอียดคำสั่งซื้อ...
        </CardContent>
      </Card>
    );
  }

  if (error || !order) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-red-600">
          {error instanceof Error ? error.message : 'โหลดคำสั่งซื้อไม่สำเร็จ'}
        </CardContent>
      </Card>
    );
  }

  const canConfirm = order.status === 'pending' && order.matchedItems === order.totalItems;
  const canShip = order.status === 'confirmed' || order.status === 'processing';

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card elevation="raised">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-xl">คำสั่งซื้อ {order.portalOrderId}</CardTitle>
              <p className="text-sm text-gray-500 mt-1">
                จาก {order.portalName} - {new Date(order.orderDate).toLocaleDateString()}
              </p>
            </div>
            <div className="flex gap-2 items-center">
              <span className={cn('px-3 py-1 rounded-full text-sm font-medium', getStatusColor(order.status))}>
                {order.status}
              </span>
              {onClose && (
                <DxButton
                  icon="close"
                  type="normal"
                  onClick={onClose}
                />
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">ลูกค้า</p>
                <p className="font-medium">{order.customerName || 'ไม่ทราบ'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">รายการ</p>
                <p className="font-medium">
                  จับคู่แล้ว {order.matchedItems}/{order.totalItems}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">วันที่ขอจัดส่ง</p>
                <p className="font-medium">
                  {order.requestedDeliveryDate
                    ? new Date(order.requestedDeliveryDate).toLocaleDateString()
                    : 'ไม่ระบุ'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">ความสำคัญ</p>
                <p className={cn('font-medium', {
                  'text-red-600': order.priority === 'urgent',
                  'text-orange-600': order.priority === 'high',
                })}>
                  {order.priority}
                </p>
              </div>
            </div>
          </div>

          {/* Status info */}
          {order.confirmedAt && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm">
              <p>
                <strong>ยืนยันเมื่อ:</strong> {new Date(order.confirmedAt).toLocaleString()}
                {order.confirmedByName && ` โดย ${order.confirmedByName}`}
              </p>
              {order.salesOrderNumber && (
                <p><strong>ใบสั่งขาย:</strong> {order.salesOrderNumber}</p>
              )}
            </div>
          )}

          {order.shippedAt && (
            <div className="mt-4 p-3 bg-green-50 rounded-lg text-sm">
              <p>
                <strong>จัดส่งเมื่อ:</strong> {new Date(order.shippedAt).toLocaleString()}
                {order.shippedByName && ` โดย ${order.shippedByName}`}
              </p>
              {order.trackingNumber && (
                <p><strong>เลขติดตามพัสดุ:</strong> {order.trackingNumber}</p>
              )}
              {order.carrier && (
                <p><strong>ผู้จัดส่ง:</strong> {order.carrier}</p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="mt-4 flex gap-2">
            {canConfirm && (
              <DxButton
                text={confirmMutation.isPending ? 'กำลังยืนยัน...' : 'ยืนยันคำสั่งซื้อ'}
                type="success"
                icon="check"
                onClick={() => confirmMutation.mutate()}
                disabled={confirmMutation.isPending}
              />
            )}
            {canShip && (
              <DxButton
                text="จัดส่งคำสั่งซื้อ"
                type="default"
                onClick={() => setShowShipDialog(true)}
              >
                <Truck className="h-4 w-4 mr-2" />
              </DxButton>
            )}
          </div>

          {/* Warnings */}
          {order.status === 'pending' && order.unmatchedItems > 0 && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <strong>มี {order.unmatchedItems} รายการที่ยังไม่จับคู่</strong>
                <p>กรุณาจับคู่ทุกรายการก่อนยืนยันคำสั่งซื้อ</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Lines */}
      <Card elevation="raised">
        <CardHeader>
          <CardTitle>รายการในคำสั่งซื้อ</CardTitle>
        </CardHeader>
        <CardContent>
          <DxDataGrid
            dataSource={order.lines || []}
            columns={lineColumns}
            keyExpr="id"
            height={300}
            sorting
            noDataText="ไม่มีรายการในคำสั่งซื้อ"
          />
        </CardContent>
      </Card>

      {/* Item Match Dialog */}
      <ItemSearchDialog
        open={matchingLine !== null}
        onOpenChange={(open) => !open && setMatchingLine(null)}
        onSelect={(item) => {
          if (matchingLine) {
            matchMutation.mutate({ lineId: matchingLine.id, itemId: item.id });
          }
        }}
        title={matchingLine ? `จับคู่รายการ: ${matchingLine.portalItemName || matchingLine.portalItemCode}` : 'เลือกรายการ'}
      />

      {/* Ship Dialog */}
      <DxPopup
        visible={showShipDialog}
        onHiding={() => setShowShipDialog(false)}
        title="จัดส่งคำสั่งซื้อ"
        width={400}
        height={250}
      >
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              เลขติดตามพัสดุ
            </label>
            <input
              type="text"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
              placeholder="กรอกเลขติดตามพัสดุ"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ผู้จัดส่ง
            </label>
            <input
              type="text"
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
              placeholder="เช่น Kerry Express, Flash"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <DxButton
              text="ยกเลิก"
              type="normal"
              onClick={() => setShowShipDialog(false)}
            />
            <DxButton
              text={shipMutation.isPending ? 'กำลังจัดส่ง...' : 'ยืนยันการจัดส่ง'}
              type="success"
              onClick={() => shipMutation.mutate()}
              disabled={shipMutation.isPending}
            />
          </div>
        </div>
      </DxPopup>
    </div>
  );
}

export default VmiOrderDetail;
