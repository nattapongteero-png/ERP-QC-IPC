'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import {
  ShoppingCart,
  Package,
  Truck,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  BarChart3,
  LayoutGrid,
  List,
  DollarSign,
  TrendingUp,
  Users,
  Calendar,
  ArrowRight,
  AlertTriangle,
  Building2,
  RefreshCw,
  Plus,
  User,
} from 'lucide-react';
import PieChart, { Series, Legend, Tooltip, Label } from 'devextreme-react/pie-chart';
import type { DataGridTypes } from 'devextreme-react/data-grid';

// ============================================================================
// Types
// ============================================================================

interface SalesOrder {
  id: number;
  soNumber: string;
  customerName: string;
  customerContact: string;
  customerAddress: string;
  orderDate: string;
  requiredDate: string;
  status: string;
  totalAmount: number;
  currency: string;
  paymentTerms: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

type ViewMode = 'grid' | 'cards' | 'analytics';
type StatusFilter = '' | 'draft' | 'confirmed' | 'processing' | 'ready' | 'shipped' | 'delivered' | 'cancelled';

// ============================================================================
// Configuration Constants
// ============================================================================

const STATUS_CONFIG: Record<string, {
  label: string;
  labelTh: string;
  color: string;
  bgClass: string;
  textClass: string;
  hoverBg: string;
  icon: React.ElementType;
  badgeVariant: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'secondary';
}> = {
  draft: {
    label: 'Draft',
    labelTh: 'ร่าง',
    color: '#94a3b8',
    bgClass: 'bg-slate-100',
    textClass: 'text-slate-700',
    hoverBg: 'hover:bg-slate-200',
    icon: FileText,
    badgeVariant: 'default',
  },
  confirmed: {
    label: 'Confirmed',
    labelTh: 'ยืนยันแล้ว',
    color: '#3b82f6',
    bgClass: 'bg-blue-100',
    textClass: 'text-blue-700',
    hoverBg: 'hover:bg-blue-200',
    icon: CheckCircle2,
    badgeVariant: 'info',
  },
  processing: {
    label: 'Processing',
    labelTh: 'กำลังดำเนินการ',
    color: '#f59e0b',
    bgClass: 'bg-amber-100',
    textClass: 'text-amber-700',
    hoverBg: 'hover:bg-amber-200',
    icon: Clock,
    badgeVariant: 'warning',
  },
  ready: {
    label: 'Ready',
    labelTh: 'พร้อมส่ง',
    color: '#8b5cf6',
    bgClass: 'bg-violet-100',
    textClass: 'text-violet-700',
    hoverBg: 'hover:bg-violet-200',
    icon: Package,
    badgeVariant: 'info',
  },
  shipped: {
    label: 'Shipped',
    labelTh: 'จัดส่งแล้ว',
    color: '#06b6d4',
    bgClass: 'bg-cyan-100',
    textClass: 'text-cyan-700',
    hoverBg: 'hover:bg-cyan-200',
    icon: Truck,
    badgeVariant: 'info',
  },
  delivered: {
    label: 'Delivered',
    labelTh: 'ส่งมอบแล้ว',
    color: '#22c55e',
    bgClass: 'bg-green-100',
    textClass: 'text-green-700',
    hoverBg: 'hover:bg-green-200',
    icon: CheckCircle2,
    badgeVariant: 'success',
  },
  cancelled: {
    label: 'Cancelled',
    labelTh: 'ยกเลิก',
    color: '#ef4444',
    bgClass: 'bg-red-100',
    textClass: 'text-red-700',
    hoverBg: 'hover:bg-red-200',
    icon: XCircle,
    badgeVariant: 'danger',
  },
};

const STATUS_ORDER: StatusFilter[] = ['', 'draft', 'confirmed', 'processing', 'ready', 'shipped', 'delivered', 'cancelled'];

// ============================================================================
// Helper Functions
// ============================================================================

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const formatDateShort = (dateStr: string) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
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

const formatCurrencyShort = (amount: number | null | undefined) => {
  const safeAmount = Number(amount) || 0;
  if (safeAmount >= 1000000) {
    return `฿${(safeAmount / 1000000).toFixed(1)}M`;
  }
  if (safeAmount >= 1000) {
    return `฿${(safeAmount / 1000).toFixed(0)}K`;
  }
  return `฿${safeAmount.toFixed(0)}`;
};

const isOverdue = (requiredDate: string, status: string) => {
  if (!requiredDate) return false;
  if (['delivered', 'cancelled', 'shipped'].includes(status)) return false;
  return new Date(requiredDate) < new Date();
};

const getDaysUntilRequired = (requiredDate: string, status: string) => {
  if (!requiredDate) return null;
  if (['delivered', 'cancelled'].includes(status)) return null;
  const days = Math.ceil((new Date(requiredDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
  return days;
};

// ============================================================================
// API Functions
// ============================================================================

async function fetchOrders() {
  const params = new URLSearchParams();
  params.set('limit', '1000');

  const res = await fetch(`/api/sales/orders?${params}`);
  const data = await res.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch orders');
  }

  return data.data?.items || [];
}

// ============================================================================
// Main Component
// ============================================================================

export default function SalesOrdersPage() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');

  // Data fetching with React Query
  const { data: orders = [], isLoading, refetch } = useQuery<SalesOrder[]>({
    queryKey: ['sales-orders'],
    queryFn: fetchOrders,
    staleTime: 30 * 1000,
  });

  // Filter orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesSearch = !search ||
        order.soNumber?.toLowerCase().includes(search.toLowerCase()) ||
        order.customerName?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = !statusFilter || order.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [orders, search, statusFilter]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = orders.length;
    const draft = orders.filter(o => o.status === 'draft').length;
    const confirmed = orders.filter(o => o.status === 'confirmed').length;
    const processing = orders.filter(o => o.status === 'processing').length;
    const ready = orders.filter(o => o.status === 'ready').length;
    const shipped = orders.filter(o => o.status === 'shipped').length;
    const delivered = orders.filter(o => o.status === 'delivered').length;
    const cancelled = orders.filter(o => o.status === 'cancelled').length;
    const overdue = orders.filter(o => isOverdue(o.requiredDate, o.status)).length;

    const activeOrders = orders.filter(o => !['delivered', 'cancelled'].includes(o.status));
    const pendingValue = activeOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const totalValue = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const deliveredValue = orders.filter(o => o.status === 'delivered').reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    const uniqueCustomers = new Set(orders.map(o => o.customerName)).size;
    const fulfillmentRate = total > 0 ? Math.round((delivered / total) * 100) : 0;

    return {
      total,
      draft,
      confirmed,
      processing,
      ready,
      shipped,
      delivered,
      cancelled,
      overdue,
      pendingValue,
      totalValue,
      deliveredValue,
      uniqueCustomers,
      fulfillmentRate,
      activeCount: draft + confirmed + processing + ready + shipped,
    };
  }, [orders]);

  // Status counts for tabs
  const statusCounts: Record<StatusFilter, number> = useMemo(() => ({
    '': orders.length,
    draft: stats.draft,
    confirmed: stats.confirmed,
    processing: stats.processing,
    ready: stats.ready,
    shipped: stats.shipped,
    delivered: stats.delivered,
    cancelled: stats.cancelled,
  }), [orders.length, stats]);

  // Chart data for status distribution
  const statusChartData = useMemo(() => {
    return Object.entries(STATUS_CONFIG)
      .map(([key, config]) => ({
        status: config.labelTh,
        count: orders.filter(o => o.status === key).length,
        color: config.color,
      }))
      .filter(item => item.count > 0);
  }, [orders]);

  // Chart data for value by status
  const valueChartData = useMemo(() => {
    return Object.entries(STATUS_CONFIG)
      .map(([key, config]) => ({
        status: config.labelTh,
        value: orders.filter(o => o.status === key).reduce((sum, o) => sum + (o.totalAmount || 0), 0),
        color: config.color,
      }))
      .filter(item => item.value > 0);
  }, [orders]);

  // Recent orders
  const recentOrders = useMemo(() => {
    return [...orders]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [orders]);

  // Urgent orders (overdue or near due date)
  const urgentOrders = useMemo(() => {
    return orders
      .filter(o => {
        if (['delivered', 'cancelled'].includes(o.status)) return false;
        const days = getDaysUntilRequired(o.requiredDate, o.status);
        return days !== null && days <= 3;
      })
      .sort((a, b) => {
        const daysA = getDaysUntilRequired(a.requiredDate, a.status) ?? 999;
        const daysB = getDaysUntilRequired(b.requiredDate, b.status) ?? 999;
        return daysA - daysB;
      })
      .slice(0, 5);
  }, [orders]);

  // Top customers by order count
  const topCustomers = useMemo(() => {
    const customerMap = new Map<string, { count: number; value: number }>();
    orders.forEach(o => {
      const existing = customerMap.get(o.customerName) || { count: 0, value: 0 };
      customerMap.set(o.customerName, {
        count: existing.count + 1,
        value: existing.value + (o.totalAmount || 0),
      });
    });
    return Array.from(customerMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [orders]);

  // Navigation handler
  const handleRowClick = useCallback((e: DataGridTypes.RowClickEvent) => {
    if (e.data?.id) {
      router.push(`/sales/orders/${e.data.id}`);
    }
  }, [router]);

  const handleOrderClick = useCallback((id: number) => {
    router.push(`/sales/orders/${id}`);
  }, [router]);

  // DataGrid columns
  const columns: DxDataGridColumn[] = useMemo(() => [
    {
      dataField: 'soNumber',
      caption: 'เลขที่ SO',
      width: 150,
      cellRender: (data: { data: SalesOrder }) => {
        const order = data.data;
        const overdue = isOverdue(order.requiredDate, order.status);
        return (
          <div className="flex items-center gap-2">
            <div className={cn(
              'h-8 w-8 rounded-lg flex items-center justify-center',
              overdue ? 'bg-red-100' : 'bg-blue-100'
            )}>
              <FileText className={cn('h-4 w-4', overdue ? 'text-red-600' : 'text-blue-600')} />
            </div>
            <div>
              <span className="font-mono font-semibold text-blue-600">{order.soNumber}</span>
              {overdue && (
                <div className="flex items-center gap-1 text-red-600 text-xs">
                  <AlertTriangle className="h-3 w-3" />
                  <span>เกินกำหนด</span>
                </div>
              )}
            </div>
          </div>
        );
      },
    },
    {
      dataField: 'customerName',
      caption: 'ลูกค้า',
      minWidth: 200,
      cellRender: (data: { data: SalesOrder }) => {
        const order = data.data;
        return (
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white font-medium text-xs">
              {order.customerName?.charAt(0)?.toUpperCase() || 'C'}
            </div>
            <div className="min-w-0">
              <span className="font-medium text-gray-800 truncate block">{order.customerName}</span>
              {order.customerContact && (
                <span className="text-xs text-gray-500 truncate block">{order.customerContact}</span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      dataField: 'orderDate',
      caption: 'วันที่สั่ง',
      width: 130,
      dataType: 'date',
      hideOnMobile: true,
      cellRender: (data: { data: SalesOrder }) => (
        <div className="flex items-center gap-2 text-gray-600">
          <Calendar className="h-3.5 w-3.5 text-gray-400" />
          <span className="text-sm">{formatDate(data.data.orderDate)}</span>
        </div>
      ),
    },
    {
      dataField: 'requiredDate',
      caption: 'กำหนดส่ง',
      width: 150,
      dataType: 'date',
      hideOnMobile: true,
      cellRender: (data: { data: SalesOrder }) => {
        const order = data.data;
        const overdue = isOverdue(order.requiredDate, order.status);
        const daysUntil = getDaysUntilRequired(order.requiredDate, order.status);

        if (!order.requiredDate) return <span className="text-gray-400">-</span>;

        return (
          <div>
            <div className="flex items-center gap-2">
              <Truck className={cn('h-3.5 w-3.5', overdue ? 'text-red-500' : 'text-gray-400')} />
              <span className={cn('text-sm', overdue ? 'text-red-600 font-medium' : 'text-gray-600')}>
                {formatDate(order.requiredDate)}
              </span>
            </div>
            {daysUntil !== null && (
              <span className={cn(
                'text-xs ml-6',
                daysUntil < 0 ? 'text-red-500' : daysUntil <= 3 ? 'text-amber-500' : 'text-gray-500'
              )}>
                {daysUntil < 0 ? `เกิน ${Math.abs(daysUntil)} วัน` : daysUntil === 0 ? 'วันนี้' : `อีก ${daysUntil} วัน`}
              </span>
            )}
          </div>
        );
      },
    },
    {
      dataField: 'totalAmount',
      caption: 'ยอดรวม',
      width: 140,
      dataType: 'number',
      cellRender: (data: { data: SalesOrder }) => (
        <span className="font-semibold text-green-600">
          {formatCurrency(data.data.totalAmount, data.data.currency)}
        </span>
      ),
    },
    {
      dataField: 'status',
      caption: 'สถานะ',
      width: 140,
      cellRender: (data: { data: SalesOrder }) => {
        const config = STATUS_CONFIG[data.data.status];
        if (!config) return <Badge>-</Badge>;
        return (
          <span className={cn('px-2.5 py-1 rounded-full text-xs font-medium', config.bgClass, config.textClass)}>
            {config.labelTh}
          </span>
        );
      },
    },
  ], []);

  // ============================================================================
  // Render Functions
  // ============================================================================

  const renderOrderCard = (order: SalesOrder) => {
    const statusConfig = STATUS_CONFIG[order.status];
    const overdue = isOverdue(order.requiredDate, order.status);
    const daysUntil = getDaysUntilRequired(order.requiredDate, order.status);

    return (
      <Card
        key={order.id}
        elevation="raised"
        className="cursor-pointer transition-all hover:shadow-lg overflow-hidden"
        onClick={() => handleOrderClick(order.id)}
      >
        <CardContent className="p-0">
          <div className="flex items-stretch">
            <div className="w-1" style={{ backgroundColor: statusConfig?.color || '#ccc' }} />
            <div className="flex-1 p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-mono font-semibold text-blue-600">{order.soNumber}</p>
                  <p className="font-medium mt-1">{order.customerName}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-green-600">
                    {formatCurrency(order.totalAmount, order.currency)}
                  </p>
                  {statusConfig && (
                    <span className={cn('px-2.5 py-1 rounded-full text-xs font-medium mt-1 inline-block', statusConfig.bgClass, statusConfig.textClass)}>
                      {statusConfig.labelTh}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{formatDateShort(order.orderDate)}</span>
                </div>
                {order.requiredDate && (
                  <div className={cn('flex items-center gap-1', overdue ? 'text-red-600 font-medium' : '')}>
                    <ArrowRight className="h-3.5 w-3.5" />
                    <span>{formatDateShort(order.requiredDate)}</span>
                    {daysUntil !== null && (
                      <span className={cn(daysUntil < 0 ? 'text-red-500' : daysUntil <= 3 ? 'text-amber-500' : '')}>
                        ({daysUntil < 0 ? `เกิน ${Math.abs(daysUntil)}d` : daysUntil === 0 ? 'วันนี้' : `${daysUntil}d`})
                      </span>
                    )}
                  </div>
                )}
              </div>

              {overdue && (
                <div className="mt-2 p-2 bg-red-50 rounded-md flex items-center gap-2 text-red-600 text-xs">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>เกินกำหนดส่งแล้ว</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderCharts = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Status Distribution */}
      <Card elevation="raised">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            การกระจายตามสถานะ
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {statusChartData.length > 0 ? (
            <PieChart
              id="status-pie"
              dataSource={statusChartData}
              type="doughnut"
              palette={statusChartData.map(d => d.color)}
              innerRadius={0.6}
              size={{ height: 220 }}
            >
              <Series argumentField="status" valueField="count">
                <Label visible={false} />
              </Series>
              <Legend
                orientation="horizontal"
                horizontalAlignment="center"
                verticalAlignment="bottom"
              />
              <Tooltip enabled={true} customizeTooltip={(arg) => ({
                text: `${arg.argumentText}: ${arg.valueText} รายการ`
              })} />
            </PieChart>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-gray-400">
              ไม่มีข้อมูล
            </div>
          )}
        </CardContent>
      </Card>

      {/* Value Distribution */}
      <Card elevation="raised">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            มูลค่าตามสถานะ
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {valueChartData.length > 0 ? (
            <PieChart
              id="value-pie"
              dataSource={valueChartData}
              type="doughnut"
              palette={valueChartData.map(d => d.color)}
              innerRadius={0.6}
              size={{ height: 220 }}
            >
              <Series argumentField="status" valueField="value">
                <Label visible={false} />
              </Series>
              <Legend
                orientation="horizontal"
                horizontalAlignment="center"
                verticalAlignment="bottom"
              />
              <Tooltip enabled={true} customizeTooltip={(arg) => ({
                text: `${arg.argumentText}: ${formatCurrency(arg.value as number)}`
              })} />
            </PieChart>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-gray-400">
              ไม่มีข้อมูล
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderGridView = () => (
    <Card elevation="raised" className="flex-1 min-h-0 flex flex-col">
      <CardContent className="flex-1 min-h-0 flex flex-col p-0">
        <DxDataGrid
          dataSource={filteredOrders}
          keyExpr="id"
          columns={columns}
          loading={isLoading}
          sorting
          filterRow
          headerFilter
          export
          exportFileName="sales-orders"
          columnChooser
          virtualScrolling={filteredOrders.length > 100}
          fillHeight
          onRowClick={handleRowClick}
          noDataText="ไม่พบใบสั่งขาย"
          rowAlternationEnabled
        />
      </CardContent>
    </Card>
  );

  const renderCardsView = () => (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 flex-1">
      {/* Main Content */}
      <div className="lg:col-span-3 space-y-4">
        {renderCharts()}

        {urgentOrders.length > 0 && (
          <Card elevation="raised">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                ต้องส่งเร็วๆ นี้
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {urgentOrders.map(renderOrderCard)}
              </div>
            </CardContent>
          </Card>
        )}

        <Card elevation="raised">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-blue-500" />
              ใบสั่งขายที่กรองแล้ว ({filteredOrders.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {filteredOrders.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredOrders.slice(0, 10).map(renderOrderCard)}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                ไม่พบใบสั่งขายที่ตรงกับเงื่อนไข
              </div>
            )}
            {filteredOrders.length > 10 && (
              <div className="mt-4 text-center">
                <DxButton
                  text={`ดูเพิ่มเติมอีก ${filteredOrders.length - 10} รายการ`}
                  type="normal"
                  onClick={() => setViewMode('grid')}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sidebar */}
      <div className="space-y-4">
        {/* Quick Stats */}
        <Card elevation="raised">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              สรุปรวม
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm text-gray-500">มูลค่ารวม</span>
              <span className="font-semibold text-green-600">{formatCurrencyShort(stats.totalValue)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm text-gray-500">ส่งมอบแล้ว</span>
              <span className="font-semibold text-green-600">{formatCurrencyShort(stats.deliveredValue)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm text-gray-500">ลูกค้า</span>
              <span className="font-semibold">{stats.uniqueCustomers}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-gray-500">อัตราส่งมอบ</span>
              <span className="font-semibold text-blue-600">{stats.fulfillmentRate}%</span>
            </div>
          </CardContent>
        </Card>

        {/* Top Customers */}
        <Card elevation="raised">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-purple-500" />
              ลูกค้าหลัก
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {topCustomers.map((customer) => (
                <div key={customer.name} className="p-2 rounded-lg bg-gray-50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate">{customer.name}</span>
                    <span className="text-xs text-gray-500">{customer.count} รายการ</span>
                  </div>
                  <p className="text-xs text-green-600 font-semibold">{formatCurrencyShort(customer.value)}</p>
                </div>
              ))}
              {topCustomers.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">ไม่มีข้อมูล</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card elevation="raised">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-500" />
              ล่าสุด
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {recentOrders.map((order) => {
                const statusConfig = STATUS_CONFIG[order.status];
                return (
                  <div
                    key={order.id}
                    className="p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors border-l-2"
                    style={{ borderLeftColor: statusConfig?.color || '#ccc' }}
                    onClick={() => handleOrderClick(order.id)}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-mono text-xs text-blue-600">{order.soNumber}</p>
                      <p className="text-xs font-semibold text-green-600">{formatCurrencyShort(order.totalAmount)}</p>
                    </div>
                    <p className="text-sm truncate">{order.customerName}</p>
                    <p className="text-xs text-gray-400">{formatDate(order.createdAt)}</p>
                  </div>
                );
              })}
              {recentOrders.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">ไม่มีข้อมูล</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderAnalyticsView = () => (
    <div className="space-y-4 flex-1">
      {/* Full-width Charts */}
      {renderCharts()}

      {/* Analytics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Status Breakdown */}
        <Card elevation="raised">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-indigo-500" />
              สรุปตามสถานะ
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {Object.entries(STATUS_CONFIG).map(([key, config]) => {
                const count = orders.filter(o => o.status === key).length;
                const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0;
                const Icon = config.icon;
                return (
                  <div key={key} className="flex items-center gap-3">
                    <div className={cn('p-2 rounded-lg', config.bgClass)}>
                      <Icon className={cn('h-4 w-4', config.textClass)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium">{config.labelTh}</span>
                        <span className="text-sm text-gray-500">{count} ({percentage.toFixed(0)}%)</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${percentage}%`, backgroundColor: config.color }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Value Summary */}
        <Card elevation="raised">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              สรุปมูลค่า
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-4">
              <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                <p className="text-sm text-gray-600">มูลค่ารวมทั้งหมด</p>
                <p className="text-3xl font-bold text-green-600">{formatCurrency(stats.totalValue)}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-xs text-gray-500">รอดำเนินการ</p>
                  <p className="text-lg font-bold text-blue-600">{formatCurrencyShort(stats.pendingValue)}</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-xs text-gray-500">ส่งมอบแล้ว</p>
                  <p className="text-lg font-bold text-green-600">{formatCurrencyShort(stats.deliveredValue)}</p>
                </div>
              </div>
              <div className="pt-3 border-t">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">อัตราส่งมอบ</span>
                  <span className="text-sm font-semibold">{stats.fulfillmentRate}%</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-green-500 transition-all"
                    style={{ width: `${stats.fulfillmentRate}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Customers Analysis */}
      <Card elevation="raised">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-purple-500" />
            ลูกค้าหลัก
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {topCustomers.map((customer, idx) => (
              <Card key={customer.name} className="border overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex items-stretch">
                    <div className="w-1 bg-purple-500" />
                    <div className="flex-1 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold">
                          {idx + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{customer.name}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2 bg-gray-50 rounded">
                          <span className="text-gray-500">จำนวน</span>
                          <p className="font-semibold">{customer.count} รายการ</p>
                        </div>
                        <div className="p-2 bg-gray-50 rounded">
                          <span className="text-gray-500">มูลค่า</span>
                          <p className="font-semibold text-green-600">{formatCurrencyShort(customer.value)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {topCustomers.length === 0 && (
              <div className="col-span-5 text-center py-8 text-gray-400">
                ไม่มีข้อมูลลูกค้า
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ============================================================================
  // Main Render
  // ============================================================================

  return (
    <MainLayout>
      <div className="flex flex-col h-full gap-4">
        {/* Hero Header */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600">
          <div className="absolute inset-0 bg-black/10" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-24 -translate-x-24" />

          <div className="relative z-10 p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <ShoppingCart className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">ใบสั่งขาย</h1>
                  <p className="text-white/80 text-sm">จัดการใบสั่งขายและติดตามสถานะการส่งมอบ</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* View Mode Toggle */}
                <div className="hidden md:flex items-center bg-white/20 backdrop-blur-sm rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={cn(
                      'p-2 rounded-lg transition-colors',
                      viewMode === 'grid' ? 'bg-white/30 text-white' : 'text-white/70 hover:text-white'
                    )}
                    title="Grid View"
                  >
                    <List className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('cards')}
                    className={cn(
                      'p-2 rounded-lg transition-colors',
                      viewMode === 'cards' ? 'bg-white/30 text-white' : 'text-white/70 hover:text-white'
                    )}
                    title="Cards View"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('analytics')}
                    className={cn(
                      'p-2 rounded-lg transition-colors',
                      viewMode === 'analytics' ? 'bg-white/30 text-white' : 'text-white/70 hover:text-white'
                    )}
                    title="Analytics View"
                  >
                    <BarChart3 className="h-4 w-4" />
                  </button>
                </div>

                <button
                  onClick={() => refetch()}
                  className="h-10 w-10 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg flex items-center justify-center text-white transition-colors"
                >
                  <RefreshCw className="h-5 w-5" />
                </button>
                <DxButton
                  text="สร้างใบสั่งขาย"
                  icon="plus"
                  type="success"
                  onClick={() => router.push('/sales/orders/new')}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          <Card elevation="raised" className="overflow-hidden">
            <CardContent className="p-0">
              <div className="flex items-stretch">
                <div className="w-1 bg-indigo-500" />
                <div className="flex-1 p-3">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 bg-indigo-100 rounded-lg flex items-center justify-center">
                      <ShoppingCart className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">ทั้งหมด</p>
                      <p className="text-lg font-bold text-gray-900">{stats.total}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card elevation="raised" className="overflow-hidden">
            <CardContent className="p-0">
              <div className="flex items-stretch">
                <div className="w-1 bg-amber-500" />
                <div className="flex-1 p-3">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 bg-amber-100 rounded-lg flex items-center justify-center">
                      <Clock className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">กำลังดำเนินการ</p>
                      <p className="text-lg font-bold text-gray-900">{stats.activeCount}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card elevation="raised" className="overflow-hidden">
            <CardContent className="p-0">
              <div className="flex items-stretch">
                <div className="w-1 bg-violet-500" />
                <div className="flex-1 p-3">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 bg-violet-100 rounded-lg flex items-center justify-center">
                      <Package className="h-5 w-5 text-violet-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">พร้อมส่ง</p>
                      <p className="text-lg font-bold text-gray-900">{stats.ready}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card elevation="raised" className="overflow-hidden">
            <CardContent className="p-0">
              <div className="flex items-stretch">
                <div className="w-1 bg-green-500" />
                <div className="flex-1 p-3">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 bg-green-100 rounded-lg flex items-center justify-center">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">ส่งมอบแล้ว</p>
                      <p className="text-lg font-bold text-gray-900">{stats.delivered}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card elevation="raised" className="overflow-hidden">
            <CardContent className="p-0">
              <div className="flex items-stretch">
                <div className="w-1 bg-red-500" />
                <div className="flex-1 p-3">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 bg-red-100 rounded-lg flex items-center justify-center">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">เกินกำหนด</p>
                      <p className={cn('text-lg font-bold', stats.overdue > 0 ? 'text-red-600' : 'text-gray-900')}>
                        {stats.overdue}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card elevation="raised" className="overflow-hidden">
            <CardContent className="p-0">
              <div className="flex items-stretch">
                <div className="w-1 bg-emerald-500" />
                <div className="flex-1 p-3">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 bg-emerald-100 rounded-lg flex items-center justify-center">
                      <DollarSign className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">รอดำเนินการ</p>
                      <p className="text-lg font-bold text-gray-900">{formatCurrencyShort(stats.pendingValue)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Overdue Alert */}
        {stats.overdue > 0 && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-red-800">
                    {stats.overdue} ใบสั่งขายเกินกำหนดส่ง
                  </p>
                  <p className="text-sm text-red-600">
                    กรุณาตรวจสอบและดำเนินการโดยเร็ว
                  </p>
                </div>
                <DxButton
                  text="ดูรายการ"
                  type="danger"
                  onClick={() => {
                    setStatusFilter('');
                    setSearch('');
                  }}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content Card with Tabs and Search */}
        <Card elevation="raised" className="flex-1 min-h-0 flex flex-col">
          <CardHeader className="border-b pb-0 space-y-3">
            {/* Status Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-0 scrollbar-thin">
              {STATUS_ORDER.map((status) => {
                const config = status === ''
                  ? { labelTh: 'ทั้งหมด', bgClass: 'bg-gray-100', textClass: 'text-gray-700', hoverBg: 'hover:bg-gray-200', icon: Building2 }
                  : STATUS_CONFIG[status];
                const count = statusCounts[status];
                const isActive = statusFilter === status;
                const Icon = config.icon;

                return (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap border-b-2',
                      isActive
                        ? `${config.bgClass} ${config.textClass} border-current`
                        : `text-gray-500 border-transparent ${config.hoverBg}`
                    )}
                  >
                    <Icon className="h-4 w-4" />
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

            {/* Search */}
            <div className="flex items-center gap-3 pb-3">
              <div className="flex-1 max-w-md">
                <DxTextBox
                  placeholder="ค้นหาด้วยเลขที่ SO หรือชื่อลูกค้า..."
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

          <CardContent className="flex-1 min-h-0 flex flex-col pt-4">
            {/* Content based on view mode */}
            {viewMode === 'grid' && renderGridView()}
            {viewMode === 'cards' && renderCardsView()}
            {viewMode === 'analytics' && renderAnalyticsView()}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
