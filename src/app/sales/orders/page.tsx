'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { StatCard, ResponsivePageHeader } from '@/components/shared';
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

// ============================================================================
// Configuration Constants
// ============================================================================

const STATUS_CONFIG = {
  draft: {
    label: 'Draft',
    labelTh: 'ร่าง',
    color: '#94a3b8',
    bgClass: 'bg-slate-50 border-slate-200',
    textClass: 'text-slate-700',
    icon: FileText,
    badgeVariant: 'default' as const,
  },
  confirmed: {
    label: 'Confirmed',
    labelTh: 'ยืนยันแล้ว',
    color: '#3b82f6',
    bgClass: 'bg-blue-50 border-blue-200',
    textClass: 'text-blue-700',
    icon: CheckCircle2,
    badgeVariant: 'info' as const,
  },
  processing: {
    label: 'Processing',
    labelTh: 'กำลังดำเนินการ',
    color: '#f59e0b',
    bgClass: 'bg-amber-50 border-amber-200',
    textClass: 'text-amber-700',
    icon: Clock,
    badgeVariant: 'warning' as const,
  },
  ready: {
    label: 'Ready',
    labelTh: 'พร้อมส่ง',
    color: '#8b5cf6',
    bgClass: 'bg-violet-50 border-violet-200',
    textClass: 'text-violet-700',
    icon: Package,
    badgeVariant: 'info' as const,
  },
  shipped: {
    label: 'Shipped',
    labelTh: 'จัดส่งแล้ว',
    color: '#06b6d4',
    bgClass: 'bg-cyan-50 border-cyan-200',
    textClass: 'text-cyan-700',
    icon: Truck,
    badgeVariant: 'info' as const,
  },
  delivered: {
    label: 'Delivered',
    labelTh: 'ส่งมอบแล้ว',
    color: '#22c55e',
    bgClass: 'bg-green-50 border-green-200',
    textClass: 'text-green-700',
    icon: CheckCircle2,
    badgeVariant: 'success' as const,
  },
  cancelled: {
    label: 'Cancelled',
    labelTh: 'ยกเลิก',
    color: '#ef4444',
    bgClass: 'bg-red-50 border-red-200',
    textClass: 'text-red-700',
    icon: XCircle,
    badgeVariant: 'danger' as const,
  },
};

const statusOptions = [
  { value: '', label: 'ทุกสถานะ' },
  { value: 'draft', label: 'ร่าง' },
  { value: 'confirmed', label: 'ยืนยันแล้ว' },
  { value: 'processing', label: 'กำลังดำเนินการ' },
  { value: 'ready', label: 'พร้อมส่ง' },
  { value: 'shipped', label: 'จัดส่งแล้ว' },
  { value: 'delivered', label: 'ส่งมอบแล้ว' },
  { value: 'cancelled', label: 'ยกเลิก' },
];

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

const formatCurrencyShort = (amount: number) => {
  if (amount >= 1000000) {
    return `฿${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `฿${(amount / 1000).toFixed(0)}K`;
  }
  return `฿${amount.toFixed(0)}`;
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
  const [statusFilter, setStatusFilter] = useState('');

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

  // Cell renderers
  const renderSoNumberCell = useCallback((data: { data: SalesOrder }) => {
    const order = data.data;
    const overdue = isOverdue(order.requiredDate, order.status);
    return (
      <div>
        <p className="font-mono font-semibold text-blue-600">{order.soNumber}</p>
        {overdue && (
          <Badge variant="danger" size="sm" className="mt-1">
            <AlertTriangle className="h-3 w-3 mr-1" />
            เกินกำหนด
          </Badge>
        )}
      </div>
    );
  }, []);

  const renderCustomerCell = useCallback((data: { data: SalesOrder }) => {
    const order = data.data;
    return (
      <div className="min-w-0">
        <p className="font-medium truncate">{order.customerName}</p>
        {order.customerContact && (
          <p className="text-xs text-gray-500 truncate">{order.customerContact}</p>
        )}
      </div>
    );
  }, []);

  const renderDateCell = useCallback((data: { data: SalesOrder }) => {
    return <span>{formatDate(data.data.orderDate)}</span>;
  }, []);

  const renderRequiredDateCell = useCallback((data: { data: SalesOrder }) => {
    const order = data.data;
    const overdue = isOverdue(order.requiredDate, order.status);
    const daysUntil = getDaysUntilRequired(order.requiredDate, order.status);

    if (!order.requiredDate) return <span className="text-gray-400">-</span>;

    return (
      <div>
        <span className={overdue ? 'text-red-600 font-medium' : ''}>
          {formatDate(order.requiredDate)}
        </span>
        {daysUntil !== null && (
          <p className={`text-xs ${daysUntil < 0 ? 'text-red-500' : daysUntil <= 3 ? 'text-amber-500' : 'text-gray-500'}`}>
            {daysUntil < 0 ? `เกิน ${Math.abs(daysUntil)} วัน` : daysUntil === 0 ? 'วันนี้' : `อีก ${daysUntil} วัน`}
          </p>
        )}
      </div>
    );
  }, []);

  const renderAmountCell = useCallback((data: { data: SalesOrder }) => {
    return (
      <span className="font-semibold text-green-600">
        {formatCurrency(data.data.totalAmount, data.data.currency)}
      </span>
    );
  }, []);

  const renderStatusCell = useCallback((data: { data: SalesOrder }) => {
    const config = STATUS_CONFIG[data.data.status as keyof typeof STATUS_CONFIG];
    if (!config) return <Badge>-</Badge>;
    return (
      <Badge variant={config.badgeVariant} dot>
        {config.labelTh}
      </Badge>
    );
  }, []);

  // DataGrid columns
  const columns: DxDataGridColumn[] = useMemo(() => [
    {
      dataField: 'soNumber',
      caption: 'เลขที่ SO',
      width: 150,
      cellRender: renderSoNumberCell,
    },
    {
      dataField: 'customerName',
      caption: 'ลูกค้า',
      minWidth: 180,
      cellRender: renderCustomerCell,
    },
    {
      dataField: 'orderDate',
      caption: 'วันที่สั่ง',
      width: 120,
      dataType: 'date',
      hideOnMobile: true,
      cellRender: renderDateCell,
    },
    {
      dataField: 'requiredDate',
      caption: 'กำหนดส่ง',
      width: 140,
      dataType: 'date',
      hideOnMobile: true,
      cellRender: renderRequiredDateCell,
    },
    {
      dataField: 'totalAmount',
      caption: 'ยอดรวม',
      width: 140,
      dataType: 'number',
      cellRender: renderAmountCell,
    },
    {
      dataField: 'status',
      caption: 'สถานะ',
      width: 130,
      cellRender: renderStatusCell,
    },
  ], [renderSoNumberCell, renderCustomerCell, renderDateCell, renderRequiredDateCell, renderAmountCell, renderStatusCell]);

  // ============================================================================
  // Render Functions
  // ============================================================================

  const renderStatCards = () => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      <StatCard
        label="ใบสั่งขายทั้งหมด"
        value={stats.total}
        icon={ShoppingCart}
        iconColor="text-indigo-500"
        accentColor="border-indigo-500"
        isLoading={isLoading}
      />
      <StatCard
        label="กำลังดำเนินการ"
        value={stats.activeCount}
        icon={Clock}
        iconColor="text-amber-500"
        accentColor="border-amber-500"
        trend={stats.activeCount > 0 ? { value: stats.activeCount, direction: 'neutral' } : undefined}
        isLoading={isLoading}
      />
      <StatCard
        label="พร้อมส่ง"
        value={stats.ready}
        icon={Package}
        iconColor="text-violet-500"
        accentColor="border-violet-500"
        isLoading={isLoading}
      />
      <StatCard
        label="ส่งมอบแล้ว"
        value={stats.delivered}
        icon={CheckCircle2}
        iconColor="text-green-500"
        accentColor="border-green-500"
        trend={stats.fulfillmentRate >= 80 ? { value: stats.fulfillmentRate, direction: 'up' } : undefined}
        isLoading={isLoading}
      />
      <StatCard
        label="เกินกำหนด"
        value={stats.overdue}
        icon={AlertTriangle}
        iconColor="text-red-500"
        accentColor="border-red-500"
        trend={stats.overdue > 0 ? { value: stats.overdue, direction: 'down' } : undefined}
        isLoading={isLoading}
      />
      <StatCard
        label="มูลค่ารอดำเนินการ"
        value={formatCurrencyShort(stats.pendingValue)}
        icon={DollarSign}
        iconColor="text-emerald-500"
        accentColor="border-emerald-500"
        isLoading={isLoading}
      />
    </div>
  );

  const renderOverdueAlert = () => {
    if (stats.overdue === 0) return null;

    return (
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
    );
  };

  const renderFilters = () => (
    <Card elevation="raised">
      <CardContent className="py-3">
        <div className="flex flex-col md:flex-row gap-3 items-end">
          <div className="flex-1">
            <DxTextBox
              placeholder="ค้นหาด้วยเลขที่ SO หรือชื่อลูกค้า..."
              value={search}
              onValueChange={setSearch}
              showClearButton
              mode="search"
            />
          </div>
          <div className="w-full md:w-48">
            <DxSelectBox
              items={statusOptions}
              value={statusFilter}
              onValueChange={setStatusFilter}
              placeholder="สถานะ"
              showClearButton
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderCharts = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Status Distribution */}
      <Card elevation="raised">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">
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
          <CardTitle className="text-sm font-medium text-gray-600">
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

  const renderOrderCard = (order: SalesOrder) => {
    const statusConfig = STATUS_CONFIG[order.status as keyof typeof STATUS_CONFIG];
    const overdue = isOverdue(order.requiredDate, order.status);
    const daysUntil = getDaysUntilRequired(order.requiredDate, order.status);

    return (
      <Card
        key={order.id}
        elevation="raised"
        className={`cursor-pointer transition-all hover:shadow-lg border-l-4`}
        style={{ borderLeftColor: statusConfig?.color || '#ccc' }}
        onClick={() => handleOrderClick(order.id)}
      >
        <CardContent className="p-4">
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
                <Badge variant={statusConfig.badgeVariant} size="sm" dot className="mt-1">
                  {statusConfig.labelTh}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t">
            <div className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              <span>{formatDateShort(order.orderDate)}</span>
            </div>
            {order.requiredDate && (
              <div className={`flex items-center gap-1 ${overdue ? 'text-red-600 font-medium' : ''}`}>
                <ArrowRight className="h-3.5 w-3.5" />
                <span>{formatDateShort(order.requiredDate)}</span>
                {daysUntil !== null && (
                  <span className={`${daysUntil < 0 ? 'text-red-500' : daysUntil <= 3 ? 'text-amber-500' : ''}`}>
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
        </CardContent>
      </Card>
    );
  };

  const renderGridView = () => (
    <Card elevation="raised" className="flex-1 min-h-0 flex flex-col">
      <CardContent className="flex-1 min-h-0 flex flex-col p-0">
        {filteredOrders.length > 0 || isLoading ? (
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
          />
        ) : (
          <EmptyState
            icon={<ShoppingCart className="h-8 w-8" />}
            title="ไม่พบใบสั่งขาย"
            description="เริ่มต้นด้วยการสร้างใบสั่งขายใหม่"
            action={{
              label: 'สร้างใบสั่งขาย',
              onClick: () => router.push('/sales/orders/new'),
            }}
          />
        )}
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
            <CardTitle className="text-sm">สรุปรวม</CardTitle>
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
              <Users className="h-4 w-4" />
              ลูกค้าหลัก
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {topCustomers.map((customer) => (
                <div
                  key={customer.name}
                  className="p-2 rounded-lg bg-gray-50"
                >
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
            <CardTitle className="text-sm">ล่าสุด</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {recentOrders.map((order) => {
                const statusConfig = STATUS_CONFIG[order.status as keyof typeof STATUS_CONFIG];
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
                    <div className={`p-2 rounded-lg ${config.bgClass}`}>
                      <Icon className={`h-4 w-4 ${config.textClass}`} />
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
              <Card key={customer.name} className="border">
                <CardContent className="p-4">
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
      <div className="flex flex-col h-full gap-4 max-w-[1800px] mx-auto w-full">
        <ResponsivePageHeader
          title="ใบสั่งขาย"
          subtitle="จัดการใบสั่งขายและติดตามสถานะการส่งมอบ"
          actions={
            <div className="flex items-center gap-2">
              {/* View Mode Toggle */}
              <div className="hidden md:flex items-center bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
                  title="Grid View"
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('cards')}
                  className={`p-1.5 rounded ${viewMode === 'cards' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
                  title="Cards View"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('analytics')}
                  className={`p-1.5 rounded ${viewMode === 'analytics' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
                  title="Analytics View"
                >
                  <BarChart3 className="h-4 w-4" />
                </button>
              </div>

              <DxButton
                icon="refresh"
                hint="รีเฟรช"
                onClick={() => refetch()}
                data-testid="dx-button-refresh"
              />
              <DxButton
                text="สร้างใบสั่งขาย"
                icon="plus"
                type="success"
                onClick={() => router.push('/sales/orders/new')}
              />
            </div>
          }
        />

        {/* KPI Stats */}
        {renderStatCards()}

        {/* Overdue Alert */}
        {renderOverdueAlert()}

        {/* Filters */}
        {renderFilters()}

        {/* Content based on view mode */}
        {viewMode === 'grid' && renderGridView()}
        {viewMode === 'cards' && renderCardsView()}
        {viewMode === 'analytics' && renderAnalyticsView()}
      </div>
    </MainLayout>
  );
}
