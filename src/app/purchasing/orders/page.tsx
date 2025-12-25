'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { cn } from '@/lib/utils/cn';
import {
  FileText,
  Clock,
  CheckCircle,
  Send,
  PackageCheck,
  Package,
  XCircle,
  ShoppingCart,
  TrendingUp,
  AlertCircle,
  Truck,
} from 'lucide-react';
import type { DataGridTypes } from 'devextreme-react/data-grid';

interface PurchaseOrder {
  id: number;
  poNumber: string;
  vendorName: string;
  orderDate: string;
  expectedDate: string;
  status: string;
  totalAmount: number;
  currency: string;
  itemCount?: number;
}

// Status filter type
type POStatusFilter = '' | 'draft' | 'pending_approval' | 'approved' | 'sent' | 'partial' | 'received' | 'cancelled';

// Status configuration for tabs and styling
const STATUS_CONFIG: Record<POStatusFilter, {
  label: string;
  labelTh: string;
  bgColor: string;
  textColor: string;
  hoverBg: string;
  icon: React.ReactNode;
  badgeVariant: 'success' | 'warning' | 'danger' | 'info' | 'default' | 'primary' | 'secondary';
}> = {
  '': {
    label: 'All',
    labelTh: 'ทั้งหมด',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-700',
    hoverBg: 'hover:bg-gray-200',
    icon: <ShoppingCart className="h-4 w-4" />,
    badgeVariant: 'default',
  },
  draft: {
    label: 'Draft',
    labelTh: 'ร่าง',
    bgColor: 'bg-slate-100',
    textColor: 'text-slate-700',
    hoverBg: 'hover:bg-slate-200',
    icon: <FileText className="h-4 w-4" />,
    badgeVariant: 'default',
  },
  pending_approval: {
    label: 'Pending',
    labelTh: 'รออนุมัติ',
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-700',
    hoverBg: 'hover:bg-yellow-200',
    icon: <Clock className="h-4 w-4" />,
    badgeVariant: 'warning',
  },
  approved: {
    label: 'Approved',
    labelTh: 'อนุมัติแล้ว',
    bgColor: 'bg-green-100',
    textColor: 'text-green-700',
    hoverBg: 'hover:bg-green-200',
    icon: <CheckCircle className="h-4 w-4" />,
    badgeVariant: 'success',
  },
  sent: {
    label: 'Sent',
    labelTh: 'ส่งให้ผู้ขาย',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-700',
    hoverBg: 'hover:bg-blue-200',
    icon: <Send className="h-4 w-4" />,
    badgeVariant: 'info',
  },
  partial: {
    label: 'Partial',
    labelTh: 'รับบางส่วน',
    bgColor: 'bg-purple-100',
    textColor: 'text-purple-700',
    hoverBg: 'hover:bg-purple-200',
    icon: <Package className="h-4 w-4" />,
    badgeVariant: 'primary',
  },
  received: {
    label: 'Received',
    labelTh: 'รับครบแล้ว',
    bgColor: 'bg-emerald-100',
    textColor: 'text-emerald-700',
    hoverBg: 'hover:bg-emerald-200',
    icon: <PackageCheck className="h-4 w-4" />,
    badgeVariant: 'success',
  },
  cancelled: {
    label: 'Cancelled',
    labelTh: 'ยกเลิก',
    bgColor: 'bg-red-100',
    textColor: 'text-red-700',
    hoverBg: 'hover:bg-red-200',
    icon: <XCircle className="h-4 w-4" />,
    badgeVariant: 'danger',
  },
};

const STATUS_ORDER: POStatusFilter[] = ['', 'draft', 'pending_approval', 'approved', 'sent', 'partial', 'received', 'cancelled'];

// Helper function to normalize status for comparison
const normalizeStatus = (status: string) => status?.toLowerCase() || '';

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('th-TH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatCurrency = (amount: number, currency: string = 'THB') => {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
};

const formatCompactCurrency = (amount: number) => {
  if (amount >= 1000000) {
    return `฿${(amount / 1000000).toFixed(1)}M`;
  } else if (amount >= 1000) {
    return `฿${(amount / 1000).toFixed(0)}K`;
  }
  return `฿${amount.toFixed(0)}`;
};

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<POStatusFilter>('');

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/purchasing/orders?limit=1000');
      const data = await res.json();

      if (data.success) {
        setOrders(data.data?.items || []);
      } else {
        setOrders([]);
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Client-side filtering
  const filteredOrders = orders.filter((order) => {
    const matchesStatus = !statusFilter || normalizeStatus(order.status) === statusFilter;
    const matchesSearch =
      !search ||
      order.poNumber?.toLowerCase().includes(search.toLowerCase()) ||
      order.vendorName?.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Calculate counts for each status
  const statusCounts = STATUS_ORDER.reduce((acc, status) => {
    if (status === '') {
      acc[status] = orders.length;
    } else {
      acc[status] = orders.filter((o) => normalizeStatus(o.status) === status).length;
    }
    return acc;
  }, {} as Record<POStatusFilter, number>);

  // Calculate stats
  const totalAmount = orders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
  const pendingCount = orders.filter((o) =>
    ['draft', 'pending_approval', 'approved', 'sent'].includes(normalizeStatus(o.status))
  ).length;
  const awaitingDelivery = orders.filter((o) =>
    ['approved', 'sent', 'partial'].includes(normalizeStatus(o.status))
  ).length;

  const handleRowClick = (e: DataGridTypes.RowClickEvent) => {
    if (e.data?.id) {
      router.push(`/purchasing/orders/${e.data.id}`);
    }
  };

  // Define columns for DevExtreme DataGrid
  const columns: DxDataGridColumn[] = [
    {
      dataField: 'poNumber',
      caption: 'เลขที่ PO',
      width: 150,
      cellRender: (cellInfo) => {
        const status = normalizeStatus(cellInfo.data.status) as POStatusFilter;
        const config = STATUS_CONFIG[status] || STATUS_CONFIG[''];
        return (
          <div className="flex items-center gap-2">
            <div className={cn('p-1.5 rounded', config.bgColor)}>
              <span className={config.textColor}>{config.icon}</span>
            </div>
            <div>
              <span className="font-mono font-semibold text-gray-900">{cellInfo.data.poNumber}</span>
            </div>
          </div>
        );
      },
    },
    {
      dataField: 'vendorName',
      caption: 'ผู้ขาย',
      minWidth: 180,
      cellRender: (cellInfo) => (
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-medium text-xs">
            {cellInfo.data.vendorName?.charAt(0)?.toUpperCase() || 'V'}
          </div>
          <span className="font-medium text-gray-800 truncate">{cellInfo.data.vendorName || '-'}</span>
        </div>
      ),
    },
    {
      dataField: 'orderDate',
      caption: 'วันที่สั่ง',
      width: 120,
      dataType: 'date',
      hideOnMobile: true,
      cellRender: (cellInfo) => (
        <span className="text-gray-600 text-sm">{formatDate(cellInfo.data.orderDate)}</span>
      ),
    },
    {
      dataField: 'expectedDate',
      caption: 'คาดว่าจะได้รับ',
      width: 130,
      dataType: 'date',
      hideOnMobile: true,
      cellRender: (cellInfo) => {
        const expectedDate = cellInfo.data.expectedDate;
        const status = normalizeStatus(cellInfo.data.status);
        if (!expectedDate) return <span className="text-gray-400">-</span>;

        const isOverdue = new Date(expectedDate) < new Date() && !['received', 'cancelled'].includes(status);
        return (
          <div className="flex items-center gap-1">
            {isOverdue && <AlertCircle className="h-3.5 w-3.5 text-red-500" />}
            <span className={cn('text-sm', isOverdue ? 'text-red-600 font-medium' : 'text-gray-600')}>
              {formatDate(expectedDate)}
            </span>
          </div>
        );
      },
    },
    {
      dataField: 'totalAmount',
      caption: 'ยอดรวม',
      width: 140,
      dataType: 'number',
      cellRender: (cellInfo) => (
        <div className="text-right">
          <span className="font-semibold text-gray-900">
            {formatCurrency(Number(cellInfo.data.totalAmount || 0), cellInfo.data.currency)}
          </span>
        </div>
      ),
    },
    {
      dataField: 'status',
      caption: 'สถานะ',
      width: 140,
      cellRender: (cellInfo) => {
        const status = normalizeStatus(cellInfo.data.status) as POStatusFilter;
        const config = STATUS_CONFIG[status] || STATUS_CONFIG[''];
        return (
          <Badge variant={config.badgeVariant} dot>
            {config.labelTh}
          </Badge>
        );
      },
    },
  ];

  return (
    <MainLayout>
      <div className="flex flex-col h-full gap-3 md:gap-2 lg:gap-4">
        <PageHeader
          title="ใบสั่งซื้อ"
          description="จัดการใบสั่งซื้อวัตถุดิบและวัสดุ"
          actions={
            <div className="flex items-center gap-2">
              <DxButton
                icon="refresh"
                type="normal"
                stylingMode="outlined"
                hint="รีเฟรช"
                onClick={() => fetchOrders()}
              />
              <DxButton
                text="สร้าง PO"
                icon="plus"
                type="success"
                onClick={() => router.push('/purchasing/orders/new')}
              />
            </div>
          }
        />

        {/* Main Content Card */}
        <Card elevation="raised" className="flex-1 min-h-0 flex flex-col md:overflow-hidden">
          <CardHeader className="pb-0 space-y-3">
            {/* Status Tabs */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-thin">
                {STATUS_ORDER.map((status) => {
                  const config = STATUS_CONFIG[status];
                  const count = statusCounts[status];
                  const isActive = statusFilter === status;

                  return (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
                        isActive
                          ? `${config.bgColor} ${config.textColor} shadow-sm`
                          : `text-gray-500 ${config.hoverBg}`
                      )}
                    >
                      {config.icon}
                      <span>{config.labelTh}</span>
                      <span
                        className={cn(
                          'ml-1 px-1.5 py-0.5 rounded text-xs font-semibold',
                          isActive ? 'bg-white/50' : 'bg-gray-200/70'
                        )}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Compact Stats */}
              <div className="hidden lg:flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5 text-blue-600">
                  <TrendingUp className="h-4 w-4" />
                  <span className="font-semibold">{formatCompactCurrency(totalAmount)}</span>
                  <span className="text-gray-400">total</span>
                </div>
                <div className="flex items-center gap-1.5 text-yellow-600">
                  <Clock className="h-4 w-4" />
                  <span className="font-semibold">{pendingCount}</span>
                  <span className="text-gray-400">pending</span>
                </div>
                <div className="flex items-center gap-1.5 text-purple-600">
                  <Truck className="h-4 w-4" />
                  <span className="font-semibold">{awaitingDelivery}</span>
                  <span className="text-gray-400">awaiting</span>
                </div>
              </div>
            </div>

            {/* Search Row */}
            <div className="flex items-center gap-3">
              <div className="flex-1 max-w-md">
                <DxTextBox
                  placeholder="ค้นหาด้วยเลขที่ PO หรือชื่อผู้ขาย..."
                  value={search}
                  onValueChange={setSearch}
                  showClearButton
                  mode="search"
                />
              </div>
              <div className="text-sm text-gray-500">
                แสดง <span className="font-semibold text-gray-700">{filteredOrders.length}</span> รายการ
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex-1 min-h-0 flex flex-col pt-3">
            <DxDataGrid
              dataSource={filteredOrders}
              keyExpr="id"
              columns={columns}
              loading={isLoading}
              sorting
              filterRow
              headerFilter
              export
              exportFileName="purchase-orders"
              columnChooser
              virtualScrolling={filteredOrders.length > 100}
              fillHeight
              onRowClick={handleRowClick}
              noDataText="ไม่พบใบสั่งซื้อ"
            />
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
