'use client';

/**
 * VMI Order Detail Component
 *
 * Displays order details and allows confirm/ship actions
 */

import * as React from 'react';
import { DxButton } from '@/components/ui/dx-button';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import { toLocalDateStr } from '@/lib/utils/date-format';
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
  rejectionReason?: string | null;
  rejectedAt?: string | null;
}

export interface VmiOrderDetailProps {
  order: VmiOrderDetail;
  onConfirm: () => Promise<void>;
  onShip: (expectedDeliveryDate: string) => Promise<void>;
  onReject: (reason: string) => Promise<void>;
  onCheckReceipt: () => Promise<void>;
  onBack: () => void;
  onViewLocalPo?: (poId: number) => void;
  isConfirming?: boolean;
  isShipping?: boolean;
  isRejecting?: boolean;
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
  onReject,
  onCheckReceipt,
  onBack,
  onViewLocalPo,
  isConfirming = false,
  isShipping = false,
  isRejecting = false,
  isCheckingReceipt = false,
  className,
}: VmiOrderDetailProps) {
  const [shipDate, setShipDate] = React.useState<string>(
    order.expectedDeliveryDate
      ? order.expectedDeliveryDate
      : toLocalDateStr(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
  );
  const [showRejectDialog, setShowRejectDialog] = React.useState(false);
  const [rejectReason, setRejectReason] = React.useState('');

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

  const handleReject = async () => {
    const reason = rejectReason.trim();
    if (!reason) return;
    await onReject(reason);
    setShowRejectDialog(false);
    setRejectReason('');
  };

  const lineColumns: DxDataGridColumn[] = [
    {
      dataField: 'itemName',
      caption: 'รายการ',
      minWidth: 200,
    },
    {
      dataField: 'tppCode',
      caption: 'รหัส TPP',
      width: 130,
      cellRender: (cellInfo) => cellInfo.data.tppCode || <span className="text-gray-400">-</span>,
    },
    {
      dataField: 'ttmtCode',
      caption: 'รหัส TTMT',
      width: 130,
      cellRender: (cellInfo) => cellInfo.data.ttmtCode || <span className="text-gray-400">-</span>,
    },
    {
      dataField: 'quantity',
      caption: 'จำนวน',
      width: 100,
      alignment: 'right',
      cellRender: (cellInfo) => `${cellInfo.data.quantity} ${cellInfo.data.unit}`,
    },
    {
      dataField: 'unitPrice',
      caption: 'ราคาต่อหน่วย',
      width: 120,
      alignment: 'right',
      cellRender: (cellInfo) => formatCurrency(cellInfo.data.unitPrice),
    },
    {
      dataField: 'totalPrice',
      caption: 'รวม',
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
                {statusInfo.labelTh}
              </Badge>
            </div>
            <p className="text-gray-500 mt-1">
              คำสั่งซื้อ VMI #{order.vmiOrderId} จาก {order.hospitalName}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {order.status === 'submitted' && (
            <>
              <DxButton
                text={isConfirming ? 'กำลังยืนยัน...' : 'ยืนยันคำสั่งซื้อ'}
                icon="check"
                type="success"
                onClick={onConfirm}
                disabled={isConfirming}
              />
              <DxButton
                text={isRejecting ? 'กำลังปฏิเสธ...' : 'ปฏิเสธคำสั่งซื้อ'}
                icon="close"
                type="danger"
                elementAttr={{ 'data-testid': 'vmi-reject-btn' }}
                onClick={() => setShowRejectDialog(true)}
                disabled={isRejecting}
              />
            </>
          )}

          {order.status === 'confirmed' && (
            <div className="flex items-center gap-2">
              <DxDateBox
                value={shipDate}
                onValueChange={setShipDate}
                width={140}
              />
              <DxButton
                text={isShipping ? 'กำลังจัดส่ง...' : 'จัดส่งคำสั่งซื้อ'}
                icon="export"
                type="default"
                onClick={handleShip}
                disabled={isShipping || !shipDate}
              />
            </div>
          )}

          {order.status === 'shipped' && (
            <DxButton
              text={isCheckingReceipt ? 'กำลังตรวจสอบ...' : 'ตรวจสอบการรับ'}
              icon="refresh"
              type="default"
              onClick={onCheckReceipt}
              disabled={isCheckingReceipt}
            />
          )}

          {order.localPoId && onViewLocalPo && (
            <DxButton
              text={`ดูใบสั่งซื้อ #${order.localPoId}`}
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
            title={`รายการสั่งซื้อ (${order.lines.length})`}
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

          {/* Rejection reason (list item 11) */}
          {order.status === 'cancelled' && order.rejectionReason && (
            <div
              className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3"
              data-testid="vmi-rejection-reason"
            >
              <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-red-800">
                  เหตุผลที่ปฏิเสธ: {order.rejectionReason}
                </div>
                {order.rejectedAt && (
                  <div className="text-xs text-red-600 mt-1">
                    ปฏิเสธเมื่อ {formatDateTime(order.rejectedAt)}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {order.notes && (
            <SectionCard
              icon={<FileText className="h-4 w-4 text-gray-600" />}
              title="หมายเหตุ"
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
            title="โรงพยาบาล"
          >
            <div className="space-y-1">
              <InfoRow label="ชื่อ" value={order.hospitalName} />
              <InfoRow label="รหัส" value={order.hospitalCode} />
              {order.warehouseName && (
                <InfoRow label="คลังสินค้า" value={order.warehouseName} />
              )}
            </div>
          </SectionCard>

          {/* Order Info */}
          <SectionCard
            icon={<ShoppingCart className="h-4 w-4 text-gray-600" />}
            title="รายละเอียดคำสั่งซื้อ"
          >
            <div className="space-y-1">
              <InfoRow label="วันที่สั่งซื้อ" value={formatDate(order.orderDate)} />
              <InfoRow label="วันที่คาดว่าจะได้รับ" value={formatDate(order.expectedDeliveryDate)} />
              <InfoRow label="ผู้ขาย" value={`${order.vendorName} (${order.vendorCode})`} />
              {order.localPoId && (
                <InfoRow
                  label="ใบสั่งซื้อภายใน"
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
            title="จำนวนเงิน"
          >
            <div className="text-center py-4">
              <div className="text-3xl font-bold text-gray-900">
                {formatCurrency(order.totalValue)}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                {order.lines.length} รายการ
              </div>
            </div>
          </SectionCard>

          {/* Timeline */}
          <SectionCard
            icon={<Clock className="h-4 w-4 text-gray-600" />}
            title="ลำดับเวลา"
          >
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className={cn('p-1.5 rounded-full', 'bg-gray-100')}>
                  <Clock className="h-3 w-3 text-gray-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900">สร้างเมื่อ</div>
                  <div className="text-xs text-gray-500">{formatDateTime(order.createdAt)}</div>
                </div>
              </div>

              {order.confirmedAt && (
                <div className="flex items-start gap-3">
                  <div className={cn('p-1.5 rounded-full', 'bg-blue-100')}>
                    <CheckCircle className="h-3 w-3 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900">ยืนยันแล้ว</div>
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
                    <div className="text-sm font-medium text-gray-900">จัดส่งแล้ว</div>
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
                    <div className="text-sm font-medium text-gray-900">รับแล้ว</div>
                    <div className="text-xs text-gray-500">{formatDateTime(order.receivedAt)}</div>
                  </div>
                </div>
              )}
            </div>
          </SectionCard>
        </div>
      </div>

      {/* Reject Reason Dialog (list item 11) */}
      <DxPopup
        visible={showRejectDialog}
        onHiding={() => setShowRejectDialog(false)}
        title="ปฏิเสธคำสั่งซื้อ"
        width={440}
        height="auto"
        deferRendering={false}
      >
        <div className="p-4 space-y-4">
          <p className="text-sm text-gray-600">
            กรุณาระบุเหตุผลในการปฏิเสธคำสั่งซื้อนี้ ระบบจะแจ้งเหตุผลกลับไปยังพอร์ทัล
          </p>
          <DxTextArea
            value={rejectReason}
            onValueChange={setRejectReason}
            label="เหตุผลที่ปฏิเสธ"
            placeholder="เช่น ไม่สามารถผลิตได้ทันกำหนด, สินค้าหมดสต็อก"
            height={110}
            inputAttr={{ 'data-testid': 'vmi-reject-reason' }}
          />
          <div className="flex justify-end gap-2 pt-2">
            <DxButton
              text="ยกเลิก"
              type="normal"
              stylingMode="outlined"
              onClick={() => setShowRejectDialog(false)}
              disabled={isRejecting}
            />
            <DxButton
              text={isRejecting ? 'กำลังปฏิเสธ...' : 'ยืนยันการปฏิเสธ'}
              type="danger"
              elementAttr={{ 'data-testid': 'vmi-reject-confirm' }}
              onClick={handleReject}
              disabled={isRejecting || !rejectReason.trim()}
            />
          </div>
        </div>
      </DxPopup>
    </div>
  );
}

export default VmiOrderDetail;
