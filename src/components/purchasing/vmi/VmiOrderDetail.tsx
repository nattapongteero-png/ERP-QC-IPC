'use client';

/**
 * VMI Order Detail Component
 *
 * Displays order details and allows confirm/ship actions
 */

import * as React from 'react';
import { DxButton } from '@/components/ui/dx-button';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import {
  ShoppingCart,
  Building2,
  Truck,
  Package,
  CheckCircle,
  PackageCheck,
  XCircle,
  Clock,
  DollarSign,
  FileText,
  ExternalLink,
} from 'lucide-react';
import type { VmiOrderStatus } from '@/types/vmi';

// ============================================================================
// Types
// ============================================================================

export interface VmiOrderLine {
  id: number;
  tppCode: string | null;
  ttmtCode: string | null;
  itemName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
}

export interface VmiOrderDetail {
  id: number;
  vendorId: number;
  vendorName: string;
  vendorCode: string;
  vmiOrderId: number;
  hospitalCode: string;
  hospitalName: string;
  poNumber: string;
  warehouseName: string | null;
  status: VmiOrderStatus;
  orderDate: string;
  expectedDeliveryDate: string | null;
  totalValue: number;
  localPoId: number | null;
  confirmedAt: string | null;
  shippedAt: string | null;
  receivedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  lines: VmiOrderLine[];
}

export interface VmiOrderDetailProps {
  order: VmiOrderDetail;
  onConfirm: () => Promise<void>;
  onShip: (expectedDeliveryDate: string) => Promise<void>;
  onCheckReceipt: () => Promise<void>;
  onBack: () => void;
  onViewLocalPo?: (poId: number) => void;
  isConfirming?: boolean;
  isShipping?: boolean;
  isCheckingReceipt?: boolean;
  className?: string;
}

// ============================================================================
// Status Config
// ============================================================================

const statusConfig: Record<VmiOrderStatus, {
  label: string;
  labelTh: string;
  color: string;
  bgColor: string;
  icon: React.ElementType;
  variant: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'secondary';
}> = {
  submitted: {
    label: 'Submitted',
    labelTh: 'รอดำเนินการ',
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
    icon: Clock,
    variant: 'warning',
  },
  confirmed: {
    label: 'Confirmed',
    labelTh: 'ยืนยันแล้ว',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    icon: CheckCircle,
    variant: 'info',
  },
  shipped: {
    label: 'Shipped',
    labelTh: 'จัดส่งแล้ว',
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    icon: Truck,
    variant: 'primary',
  },
  received: {
    label: 'Received',
    labelTh: 'รับแล้ว',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-100',
    icon: PackageCheck,
    variant: 'success',
  },
  cancelled: {
    label: 'Cancelled',
    labelTh: 'ยกเลิก',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    icon: XCircle,
    variant: 'danger',
  },
};

// ============================================================================
// Section Card Component
// ============================================================================

interface SectionCardProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  className?: string;
}

function SectionCard({ icon, title, children, className }: SectionCardProps) {
  return (
    <div className={cn('rounded-xl border border-gray-200 bg-white overflow-hidden', className)}>
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  );
}

// ============================================================================
// Info Row Component
// ============================================================================

interface InfoRowProps {
  label: string;
  value: React.ReactNode;
}

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div className="flex justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function VmiOrderDetail({
  order,
  onConfirm,
  onShip,
  onCheckReceipt,
  onBack,
  onViewLocalPo,
  isConfirming = false,
  isShipping = false,
  isCheckingReceipt = false,
  className,
}: VmiOrderDetailProps) {
  const [shipDate, setShipDate] = React.useState<string>(
    order.expectedDeliveryDate
      ? order.expectedDeliveryDate
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );

  const statusInfo = statusConfig[order.status];
  const StatusIcon = statusInfo.icon;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
    }).format(amount);
  };

  const handleShip = async () => {
    if (!shipDate) return;
    await onShip(shipDate);
  };

  const lineColumns: DxDataGridColumn[] = [
    {
      dataField: 'itemName',
      caption: 'Item',
      minWidth: 200,
    },
    {
      dataField: 'tppCode',
      caption: 'TPP Code',
      width: 130,
      cellRender: (cellInfo) => cellInfo.data.tppCode || <span className="text-gray-400">-</span>,
    },
    {
      dataField: 'ttmtCode',
      caption: 'TTMT Code',
      width: 130,
      cellRender: (cellInfo) => cellInfo.data.ttmtCode || <span className="text-gray-400">-</span>,
    },
    {
      dataField: 'quantity',
      caption: 'Quantity',
      width: 100,
      alignment: 'right',
      cellRender: (cellInfo) => `${cellInfo.data.quantity} ${cellInfo.data.unit}`,
    },
    {
      dataField: 'unitPrice',
      caption: 'Unit Price',
      width: 120,
      alignment: 'right',
      cellRender: (cellInfo) => formatCurrency(cellInfo.data.unitPrice),
    },
    {
      dataField: 'totalPrice',
      caption: 'Total',
      width: 120,
      alignment: 'right',
      cellRender: (cellInfo) => (
        <span className="font-medium">
          {formatCurrency(cellInfo.data.totalPrice)}
        </span>
      ),
    },
  ];

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <DxButton
            icon="back"
            type="normal"
            stylingMode="text"
            onClick={onBack}
          />
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{order.poNumber}</h1>
              <Badge variant={statusInfo.variant} className="gap-1">
                <StatusIcon className="h-3 w-3" />
                {statusInfo.label}
              </Badge>
            </div>
            <p className="text-gray-500 mt-1">
              VMI Order #{order.vmiOrderId} from {order.hospitalName}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {order.status === 'submitted' && (
            <DxButton
              text={isConfirming ? 'Confirming...' : 'Confirm Order'}
              icon="check"
              type="success"
              onClick={onConfirm}
              disabled={isConfirming}
            />
          )}

          {order.status === 'confirmed' && (
            <div className="flex items-center gap-2">
              <DxDateBox
                value={shipDate}
                onValueChange={setShipDate}
                displayFormat="dd/MM/yyyy"
                width={140}
              />
              <DxButton
                text={isShipping ? 'Shipping...' : 'Ship Order'}
                icon="export"
                type="default"
                onClick={handleShip}
                disabled={isShipping || !shipDate}
              />
            </div>
          )}

          {order.status === 'shipped' && (
            <DxButton
              text={isCheckingReceipt ? 'Checking...' : 'Check Receipt'}
              icon="refresh"
              type="default"
              onClick={onCheckReceipt}
              disabled={isCheckingReceipt}
            />
          )}

          {order.localPoId && onViewLocalPo && (
            <DxButton
              text={`View PO #${order.localPoId}`}
              icon="link"
              type="normal"
              stylingMode="outlined"
              onClick={() => onViewLocalPo(order.localPoId!)}
            />
          )}
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left Column - Details */}
        <div className="col-span-8 space-y-6">
          {/* Order Lines */}
          <SectionCard
            icon={<Package className="h-4 w-4 text-gray-600" />}
            title={`Order Lines (${order.lines.length})`}
          >
            <DxDataGrid
              dataSource={order.lines}
              keyExpr="id"
              columns={lineColumns}
              showBorders
              height={300}
              columnAutoWidth
            />
          </SectionCard>

          {/* Notes */}
          {order.notes && (
            <SectionCard
              icon={<FileText className="h-4 w-4 text-gray-600" />}
              title="Notes"
            >
              <p className="text-gray-700">{order.notes}</p>
            </SectionCard>
          )}
        </div>

        {/* Right Column - Summary */}
        <div className="col-span-4 space-y-6">
          {/* Hospital Info */}
          <SectionCard
            icon={<Building2 className="h-4 w-4 text-gray-600" />}
            title="Hospital"
          >
            <div className="space-y-1">
              <InfoRow label="Name" value={order.hospitalName} />
              <InfoRow label="Code" value={order.hospitalCode} />
              {order.warehouseName && (
                <InfoRow label="Warehouse" value={order.warehouseName} />
              )}
            </div>
          </SectionCard>

          {/* Order Info */}
          <SectionCard
            icon={<ShoppingCart className="h-4 w-4 text-gray-600" />}
            title="Order Details"
          >
            <div className="space-y-1">
              <InfoRow label="Order Date" value={formatDate(order.orderDate)} />
              <InfoRow label="Expected Date" value={formatDate(order.expectedDeliveryDate)} />
              <InfoRow label="Vendor" value={`${order.vendorName} (${order.vendorCode})`} />
              {order.localPoId && (
                <InfoRow
                  label="Local PO"
                  value={
                    <button
                      onClick={() => onViewLocalPo?.(order.localPoId!)}
                      className="text-blue-600 hover:underline flex items-center gap-1"
                    >
                      #{order.localPoId}
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  }
                />
              )}
            </div>
          </SectionCard>

          {/* Amount */}
          <SectionCard
            icon={<DollarSign className="h-4 w-4 text-gray-600" />}
            title="Amount"
          >
            <div className="text-center py-4">
              <div className="text-3xl font-bold text-gray-900">
                {formatCurrency(order.totalValue)}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                {order.lines.length} line(s)
              </div>
            </div>
          </SectionCard>

          {/* Timeline */}
          <SectionCard
            icon={<Clock className="h-4 w-4 text-gray-600" />}
            title="Timeline"
          >
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className={cn('p-1.5 rounded-full', 'bg-gray-100')}>
                  <Clock className="h-3 w-3 text-gray-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900">Created</div>
                  <div className="text-xs text-gray-500">{formatDateTime(order.createdAt)}</div>
                </div>
              </div>

              {order.confirmedAt && (
                <div className="flex items-start gap-3">
                  <div className={cn('p-1.5 rounded-full', 'bg-blue-100')}>
                    <CheckCircle className="h-3 w-3 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900">Confirmed</div>
                    <div className="text-xs text-gray-500">{formatDateTime(order.confirmedAt)}</div>
                  </div>
                </div>
              )}

              {order.shippedAt && (
                <div className="flex items-start gap-3">
                  <div className={cn('p-1.5 rounded-full', 'bg-purple-100')}>
                    <Truck className="h-3 w-3 text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900">Shipped</div>
                    <div className="text-xs text-gray-500">{formatDateTime(order.shippedAt)}</div>
                  </div>
                </div>
              )}

              {order.receivedAt && (
                <div className="flex items-start gap-3">
                  <div className={cn('p-1.5 rounded-full', 'bg-emerald-100')}>
                    <PackageCheck className="h-3 w-3 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900">Received</div>
                    <div className="text-xs text-gray-500">{formatDateTime(order.receivedAt)}</div>
                  </div>
                </div>
              )}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

export default VmiOrderDetail;
