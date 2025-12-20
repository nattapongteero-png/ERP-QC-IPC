'use client';

/**
 * VMI Orders Grid Component
 *
 * Displays a list of VMI orders with filtering and actions
 */

import * as React from 'react';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import {
  RefreshCw,
  Filter,
  ShoppingCart,
  Building2,
  Package,
  CheckCircle,
  Truck,
  PackageCheck,
  XCircle,
  Clock,
} from 'lucide-react';
import type { VmiOrderStatus } from '@/types/vmi';

// ============================================================================
// Types
// ============================================================================

export interface VmiOrder {
  id: number;
  vendorId: number;
  vendorName: string;
  vmiOrderId: number;
  hospitalCode: string;
  hospitalName: string;
  poNumber: string;
  warehouseName: string | null;
  status: VmiOrderStatus;
  orderDate: string;
  expectedDate: string | null;
  totalAmount: number;
  currency: string;
  localPoId: number | null;
  confirmedAt: string | null;
  shippedAt: string | null;
  receivedAt: string | null;
  createdAt: string;
}

export interface VmiOrdersGridProps {
  orders: VmiOrder[];
  isLoading?: boolean;
  onRowClick?: (order: VmiOrder) => void;
  onRefresh?: () => void;
  onPollOrders?: (vendorId?: number) => Promise<void>;
  isPollLoading?: boolean;
  vendors?: Array<{ id: number; name: string }>;
  onFilterChange?: (filters: OrderFilters) => void;
  className?: string;
}

export interface OrderFilters {
  vendorId?: number;
  status?: VmiOrderStatus;
  dateFrom?: string;
  dateTo?: string;
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

const statusOptions = [
  { value: '', label: 'All Statuses' },
  { value: 'submitted', label: 'Submitted (รอดำเนินการ)' },
  { value: 'confirmed', label: 'Confirmed (ยืนยันแล้ว)' },
  { value: 'shipped', label: 'Shipped (จัดส่งแล้ว)' },
  { value: 'received', label: 'Received (รับแล้ว)' },
  { value: 'cancelled', label: 'Cancelled (ยกเลิก)' },
];

// ============================================================================
// Status Badge Component
// ============================================================================

function StatusBadge({ status }: { status: VmiOrderStatus }) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="gap-1">
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function VmiOrdersGrid({
  orders,
  isLoading = false,
  onRowClick,
  onRefresh,
  onPollOrders,
  isPollLoading = false,
  vendors = [],
  onFilterChange,
  className,
}: VmiOrdersGridProps) {
  const [filters, setFilters] = React.useState<OrderFilters>({});
  const [showFilters, setShowFilters] = React.useState(false);

  const handleFilterChange = <K extends keyof OrderFilters>(key: K, value: OrderFilters[K]) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange?.(newFilters);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number, currency: string = 'THB') => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  const columns: DxDataGridColumn[] = [
    {
      dataField: 'poNumber',
      caption: 'PO Number',
      width: 140,
      cellRender: (cellInfo) => (
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-gray-400" />
          <span className="font-medium">{cellInfo.data.poNumber}</span>
        </div>
      ),
    },
    {
      dataField: 'hospitalName',
      caption: 'Hospital',
      minWidth: 180,
      cellRender: (cellInfo) => (
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-gray-400" />
            <span className="font-medium">{cellInfo.data.hospitalName}</span>
          </div>
          <div className="text-xs text-gray-500 ml-6">{cellInfo.data.hospitalCode}</div>
        </div>
      ),
    },
    {
      dataField: 'vendorName',
      caption: 'Vendor',
      width: 150,
      cellRender: (cellInfo) => (
        <span className="text-gray-600">{cellInfo.data.vendorName}</span>
      ),
    },
    {
      dataField: 'orderDate',
      caption: 'Order Date',
      width: 110,
      cellRender: (cellInfo) => formatDate(cellInfo.data.orderDate),
    },
    {
      dataField: 'expectedDate',
      caption: 'Expected',
      width: 110,
      cellRender: (cellInfo) => formatDate(cellInfo.data.expectedDate),
    },
    {
      dataField: 'totalAmount',
      caption: 'Amount',
      width: 120,
      alignment: 'right',
      cellRender: (cellInfo) => (
        <span className="font-medium">
          {formatCurrency(cellInfo.data.totalAmount, cellInfo.data.currency)}
        </span>
      ),
    },
    {
      dataField: 'status',
      caption: 'Status',
      width: 130,
      cellRender: (cellInfo) => <StatusBadge status={cellInfo.data.status} />,
    },
    {
      dataField: 'localPoId',
      caption: 'Local PO',
      width: 100,
      cellRender: (cellInfo) =>
        cellInfo.data.localPoId ? (
          <Badge variant="default">#{cellInfo.data.localPoId}</Badge>
        ) : (
          <span className="text-gray-400">-</span>
        ),
    },
  ];

  const vendorOptions = [
    { value: '', label: 'All Vendors' },
    ...vendors.map(v => ({ value: v.id.toString(), label: v.name })),
  ];

  return (
    <div className={cn('space-y-4', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <DxButton
            text="Poll Orders"
            icon="refresh"
            type="default"
            stylingMode="contained"
            onClick={() => onPollOrders?.()}
            disabled={isPollLoading}
          />
          <DxButton
            icon="filter"
            type="normal"
            stylingMode={showFilters ? 'contained' : 'outlined'}
            onClick={() => setShowFilters(!showFilters)}
            hint="Toggle Filters"
          />
          {onRefresh && (
            <DxButton
              icon="refresh"
              type="normal"
              stylingMode="text"
              onClick={onRefresh}
              hint="Refresh"
            />
          )}
        </div>

        <div className="text-sm text-gray-500">
          {orders.length} order(s)
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Filter className="h-4 w-4" />
            Filters
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Vendor</label>
              <DxSelectBox
                items={vendorOptions}
                value={filters.vendorId?.toString() || ''}
                onValueChange={(value) => handleFilterChange('vendorId', value ? parseInt(value) : undefined)}
                valueExpr="value"
                displayExpr="label"
                placeholder="All Vendors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
              <DxSelectBox
                items={statusOptions}
                value={filters.status || ''}
                onValueChange={(value) => handleFilterChange('status', value as VmiOrderStatus || undefined)}
                valueExpr="value"
                displayExpr="label"
                placeholder="All Statuses"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Date From</label>
              <DxDateBox
                value={filters.dateFrom ? new Date(filters.dateFrom) : null}
                onValueChange={(value) => handleFilterChange('dateFrom', value?.toISOString().split('T')[0])}
                displayFormat="dd/MM/yyyy"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Date To</label>
              <DxDateBox
                value={filters.dateTo ? new Date(filters.dateTo) : null}
                onValueChange={(value) => handleFilterChange('dateTo', value?.toISOString().split('T')[0])}
                displayFormat="dd/MM/yyyy"
              />
            </div>
          </div>
        </div>
      )}

      {/* Grid */}
      <DxDataGrid
        dataSource={orders}
        keyExpr="id"
        columns={columns}
        showBorders
        height={500}
        onRowClick={(e) => {
          if (e.data && onRowClick) {
            onRowClick(e.data);
          }
        }}
        rowAlternationEnabled
        hoverStateEnabled
        columnAutoWidth
      />

      {/* Empty State */}
      {!isLoading && orders.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
          <Package className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No VMI Orders</h3>
          <p className="text-gray-500 mt-1">
            Click "Poll Orders" to fetch new orders from VMI Portal
          </p>
        </div>
      )}
    </div>
  );
}

export default VmiOrdersGrid;
