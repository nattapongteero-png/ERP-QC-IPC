'use client';

/**
 * Sales Orders Dashboard Page
 * Feature: Sales Management
 *
 * Professional dashboard for managing sales orders with DevExtreme UI.
 * Responsive: ResponsivePageHeader, StatCard KPI row, mobile card view,
 * empty state, no-results state, loading skeletons.
 */

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { Badge } from '@/components/ui/badge';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { useMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils/cn';
import {
  ShoppingBag,
  ShoppingCart,
  Package,
  Truck,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  BarChart3,
  DollarSign,
  TrendingUp,
  Users,
  Calendar,
  AlertTriangle,
  Building2,
  Eye,
  SearchX,
  Boxes,
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

type StatusFilter = '' | 'draft' | 'confirmed' | 'processing' | 'ready' | 'shipped' | 'delivered' | 'cancelled';

// ============================================================================
// Configuration Constants
// ============================================================================

const STATUS_CONFIG: Record<string, {
  translationKey: string;
  color: string;
  bgClass: string;
  textClass: string;
  hoverBg: string;
  borderClass: string;
  icon: React.ElementType;
  badgeVariant: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'secondary';
}> = {
  draft: {
    translationKey: 'draft',
    color: '#94a3b8',
    bgClass: 'bg-slate-100',
    textClass: 'text-slate-700',
    hoverBg: 'hover:bg-slate-200',
    borderClass: 'border-slate-400',
    icon: FileText,
    badgeVariant: 'default',
  },
  confirmed: {
    translationKey: 'confirmed',
    color: '#3b82f6',
    bgClass: 'bg-blue-100',
    textClass: 'text-blue-700',
    hoverBg: 'hover:bg-blue-200',
    borderClass: 'border-blue-400',
    icon: CheckCircle2,
    badgeVariant: 'info',
  },
  processing: {
    translationKey: 'processing',
    color: '#f59e0b',
    bgClass: 'bg-amber-100',
    textClass: 'text-amber-700',
    hoverBg: 'hover:bg-amber-200',
    borderClass: 'border-amber-400',
    icon: Clock,
    badgeVariant: 'warning',
  },
  ready: {
    translationKey: 'ready',
    color: '#8b5cf6',
    bgClass: 'bg-violet-100',
    textClass: 'text-violet-700',
    hoverBg: 'hover:bg-violet-200',
    borderClass: 'border-violet-400',
    icon: Package,
    badgeVariant: 'info',
  },
  shipped: {
    translationKey: 'shipped',
    color: '#06b6d4',
    bgClass: 'bg-cyan-100',
    textClass: 'text-cyan-700',
    hoverBg: 'hover:bg-cyan-200',
    borderClass: 'border-cyan-400',
    icon: Truck,
    badgeVariant: 'info',
  },
  delivered: {
    translationKey: 'delivered',
    color: '#22c55e',
    bgClass: 'bg-green-100',
    textClass: 'text-green-700',
    hoverBg: 'hover:bg-green-200',
    borderClass: 'border-green-400',
    icon: CheckCircle2,
    badgeVariant: 'success',
  },
  cancelled: {
    translationKey: 'cancelled',
    color: '#ef4444',
    bgClass: 'bg-red-100',
    textClass: 'text-red-700',
    hoverBg: 'hover:bg-red-200',
    borderClass: 'border-red-400',
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
  const t = useTranslations('sales');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const { isMobile } = useMobile();
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
    }).map((item, index) => ({ ...item, _rowNumber: index + 1 }));
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
    const openCount = draft + confirmed + processing + ready + shipped;

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
      openCount,
      activeCount: openCount,
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
        status: t(`orders.status.${config.translationKey}`),
        count: orders.filter(o => o.status === key).length,
        color: config.color,
      }))
      .filter(item => item.count > 0);
  }, [orders, t]);

  // Chart data for value by status
  const valueChartData = useMemo(() => {
    return Object.entries(STATUS_CONFIG)
      .map(([key, config]) => ({
        status: t(`orders.status.${config.translationKey}`),
        value: orders.filter(o => o.status === key).reduce((sum, o) => sum + (o.totalAmount || 0), 0),
        color: config.color,
      }))
      .filter(item => item.value > 0);
  }, [orders, t]);

  // Top customers by order value
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

  // Navigation handlers
  const handleRowClick = useCallback((e: DataGridTypes.RowClickEvent) => {
    if (e.data?.id) {
      router.push(`/sales/orders/${e.data.id}`);
    }
  }, [router]);

  const handleCreate = useCallback(() => {
    router.push('/sales/orders/new');
  }, [router]);

  const handleView = useCallback((order: SalesOrder) => {
    router.push(`/sales/orders/${order.id}`);
  }, [router]);

  const handleClearFilters = useCallback(() => {
    setSearch('');
    setStatusFilter('');
  }, []);

  // DataGrid columns (min widths ensure usability; hide on mobile via prop)
  const columns: DxDataGridColumn[] = useMemo(() => [
    {
      dataField: '_rowNumber',
      caption: t('items.grid.columns.rowNum'),
      width: 60,
      alignment: 'center',
      allowFiltering: false,
      allowHeaderFiltering: false,
      allowSorting: false,
      cellRender: (cellInfo: { data?: SalesOrder & { _rowNumber?: number } }) => (
        <span className="text-gray-500 text-sm font-medium">
          {cellInfo.data?._rowNumber}
        </span>
      ),
    },
    {
      dataField: 'soNumber',
      caption: t('orders.grid.columns.soNumber'),
      minWidth: 160,
      width: 170,
      cellRender: (data: { data?: SalesOrder }) => {
        if (!data.data) return null;
        const order = data.data;
        const overdue = isOverdue(order.requiredDate, order.status);
        return (
          <div className="flex items-center gap-2">
            <div className={cn(
              'h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0',
              overdue ? 'bg-red-100' : 'bg-indigo-100'
            )}>
              <FileText className={cn('h-4 w-4', overdue ? 'text-red-600' : 'text-indigo-600')} />
            </div>
            <div className="min-w-0">
              <span className="font-mono font-semibold text-indigo-600">{order.soNumber}</span>
              {overdue && (
                <div className="flex items-center gap-1 text-red-600 text-xs">
                  <AlertTriangle className="h-3 w-3" />
                  <span>{t('orders.grid.overdue')}</span>
                </div>
              )}
            </div>
          </div>
        );
      },
    },
    {
      dataField: 'customerName',
      caption: t('orders.grid.columns.customer'),
      minWidth: 200,
      cellRender: (data: { data?: SalesOrder }) => {
        if (!data.data) return null;
        const order = data.data;
        return (
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white font-medium text-xs flex-shrink-0">
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
      caption: t('orders.grid.columns.orderDate'),
      width: 130,
      dataType: 'date',
      hideOnMobile: true,
      hideOnTablet: true,
      cellRender: (data: { data?: SalesOrder }) => {
        if (!data.data) return null;
        return (
          <div className="flex items-center gap-2 text-gray-600">
            <Calendar className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-sm">{formatDate(data.data.orderDate)}</span>
          </div>
        );
      },
    },
    {
      dataField: 'requiredDate',
      caption: t('orders.grid.columns.requiredDate'),
      width: 160,
      dataType: 'date',
      hideOnMobile: true,
      cellRender: (data: { data?: SalesOrder }) => {
        if (!data.data) return null;
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
                {daysUntil < 0 ? t('orders.dates.overdue', { days: Math.abs(daysUntil) }) : daysUntil === 0 ? t('orders.dates.today') : t('orders.dates.daysRemaining', { days: daysUntil })}
              </span>
            )}
          </div>
        );
      },
    },
    {
      dataField: 'totalAmount',
      caption: t('orders.grid.columns.totalAmount'),
      width: 140,
      dataType: 'number',
      alignment: 'right',
      cellRender: (data: { data?: SalesOrder }) => {
        if (!data.data) return null;
        return (
          <span className="font-semibold text-emerald-600 tabular-nums">
            {formatCurrency(data.data.totalAmount, data.data.currency)}
          </span>
        );
      },
    },
    {
      dataField: 'status',
      caption: t('orders.grid.columns.status'),
      width: 140,
      cellRender: (data: { data?: SalesOrder }) => {
        if (!data.data) return null;
        const config = STATUS_CONFIG[data.data.status];
        if (!config) return <Badge>-</Badge>;
        return (
          <span className={cn('px-2.5 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1', config.bgClass, config.textClass)}>
            <config.icon className="h-3 w-3" />
            {t(`orders.status.${config.translationKey}`)}
          </span>
        );
      },
    },
    {
      dataField: 'actions',
      caption: '',
      width: 80,
      allowSorting: false,
      allowFiltering: false,
      cellRender: (cellInfo: { data?: SalesOrder }) => (
        <div className="flex items-center gap-1">
          <button
            type="button"
            title={t('orders.actions.viewOrder')}
            aria-label={t('orders.actions.viewOrder')}
            onClick={(e) => {
              e.stopPropagation();
              if (cellInfo.data) handleView(cellInfo.data);
            }}
            className="p-2 rounded-md text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
          >
            <Eye className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ], [t, handleView]);

  // Empty / no-results detection
  const showEmptyState = !isLoading && orders.length === 0;
  const showNoResultsState = !isLoading && orders.length > 0 && filteredOrders.length === 0;

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <MainLayout>
      <div className="flex flex-col gap-5 p-4 md:p-6 max-w-full">
        {/* Responsive Page Header */}
        <ResponsivePageHeader
          title={t('orders.pageTitle')}
          subtitle={t('orders.description')}
          icon={ShoppingBag}
          iconBgColor="bg-indigo-100"
          iconColor="text-indigo-600"
          actions={
            <div className="flex items-center gap-2 flex-wrap">
              <DxButton
                icon="refresh"
                text={tCommon('actions.refresh')}
                stylingMode="outlined"
                onClick={() => refetch()}
                className="hidden sm:inline-flex"
                elementAttr={{ 'data-testid': 'so-refresh-btn' }}
              />
              <DxButton
                text={t('orders.actions.createOrder')}
                icon="plus"
                type="success"
                onClick={handleCreate}
                elementAttr={{ 'data-testid': 'so-add-btn' }}
              />
            </div>
          }
        />

        {/* KPI Stat Cards (4) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <StatCard
            label={t('orders.stats.total')}
            value={stats.total}
            icon={ShoppingCart}
            iconColor="text-indigo-500"
            accentColor="border-indigo-500"
            isLoading={isLoading}
          />
          <StatCard
            label={t('orders.stats.active')}
            value={stats.openCount}
            icon={Clock}
            iconColor="text-amber-500"
            accentColor="border-amber-500"
            isLoading={isLoading}
          />
          <StatCard
            label={t('orders.stats.delivered')}
            value={stats.delivered}
            icon={CheckCircle2}
            iconColor="text-emerald-500"
            accentColor="border-emerald-500"
            isLoading={isLoading}
          />
          <StatCard
            label={t('orders.cards.totalValue')}
            value={formatCurrencyShort(stats.totalValue)}
            icon={DollarSign}
            iconColor="text-green-500"
            accentColor="border-green-500"
            isLoading={isLoading}
          />
        </div>

        {/* Charts Section - hidden on mobile to prioritize the list */}
        <div className="hidden lg:grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Status Distribution */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 min-w-0">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="p-2 bg-indigo-50 rounded-lg">
                <BarChart3 className="h-5 w-5 text-indigo-600" />
              </div>
              <h3 className="font-semibold text-gray-900 text-base">{t('orders.charts.statusDistribution')}</h3>
            </div>
            {statusChartData.length > 0 ? (
              <PieChart
                key={`status-${locale}`}
                dataSource={statusChartData}
                palette={statusChartData.map(d => d.color)}
                type="doughnut"
                innerRadius={0.65}
                size={{ height: 200 }}
              >
                <Series argumentField="status" valueField="count">
                  <Label visible={false} />
                </Series>
                <Legend horizontalAlignment="center" verticalAlignment="bottom" itemTextPosition="right" />
                <Tooltip enabled customizeTooltip={(arg) => ({
                  text: `${arg.argumentText}: ${arg.valueText}`,
                })} />
              </PieChart>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-gray-400">
                <div className="text-center">
                  <ShoppingCart className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">{t('orders.charts.noData')}</p>
                </div>
              </div>
            )}
          </div>

          {/* Value by Status */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 min-w-0">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="p-2 bg-emerald-50 rounded-lg">
                <DollarSign className="h-5 w-5 text-emerald-600" />
              </div>
              <h3 className="font-semibold text-gray-900 text-base">{t('orders.charts.valueByStatus')}</h3>
            </div>
            {valueChartData.length > 0 ? (
              <PieChart
                key={`value-${locale}`}
                dataSource={valueChartData}
                palette={valueChartData.map(d => d.color)}
                type="doughnut"
                innerRadius={0.65}
                size={{ height: 200 }}
              >
                <Series argumentField="status" valueField="value">
                  <Label visible={false} />
                </Series>
                <Legend horizontalAlignment="center" verticalAlignment="bottom" itemTextPosition="right" />
                <Tooltip enabled customizeTooltip={(arg) => ({
                  text: `${arg.argumentText}: ${formatCurrency(arg.value as number)}`,
                })} />
              </PieChart>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-gray-400">
                <div className="text-center">
                  <DollarSign className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">{t('orders.charts.noData')}</p>
                </div>
              </div>
            )}
          </div>

          {/* Top Customers */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 min-w-0 overflow-hidden">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="p-2 bg-purple-50 rounded-lg">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900 text-base">{t('orders.cards.topCustomers')}</h3>
            </div>
            <div className="space-y-2.5">
              {topCustomers.length > 0 ? (
                topCustomers.map((customer, index) => (
                  <div key={customer.name} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-7 h-7 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-sm font-medium shrink-0">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 text-sm truncate" title={customer.name}>{customer.name}</p>
                      <p className="text-xs text-gray-500">{t('orders.cards.orders', { count: customer.count })}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-emerald-600 text-sm tabular-nums">{formatCurrencyShort(customer.value)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-gray-400">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">{t('orders.analytics.noCustomers')}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Overdue Alert */}
        {stats.overdue > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-start sm:items-center gap-3 flex-col sm:flex-row">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="p-2 bg-red-100 rounded-lg shrink-0">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="font-semibold text-red-800 text-sm block">
                    {t('orders.dates.overdueAlert', { count: stats.overdue })}
                  </span>
                  <span className="text-sm text-red-700">
                    {t('orders.dates.urgentAction')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Data Card: Tabs + Search + List/Grid */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          {/* Status Tabs — scrollable on mobile */}
          <div className="px-3 py-3 sm:px-4 border-b border-gray-100 bg-gradient-to-r from-gray-50/50 to-white">
            <div className="flex items-center gap-1 p-1 bg-white border border-gray-200 rounded-lg overflow-x-auto scrollbar-thin snap-x">
              {STATUS_ORDER.map((status) => {
                const config = status === ''
                  ? {
                      translationKey: 'all',
                      bgClass: 'bg-gray-900',
                      textClass: 'text-white',
                      hoverBg: 'hover:bg-gray-100',
                      icon: Building2,
                    }
                  : STATUS_CONFIG[status];
                const count = statusCounts[status];
                const isActive = statusFilter === status;
                const Icon = config.icon;

                return (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    data-testid={`so-status-tab-${status || 'all'}`}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 snap-start min-h-[36px]',
                      isActive
                        ? status === ''
                          ? 'bg-gray-900 text-white shadow-sm'
                          : `${config.bgClass} ${config.textClass} shadow-sm`
                        : 'text-gray-600 hover:bg-gray-100'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{t(`orders.status.${config.translationKey}`)}</span>
                    <span
                      className={cn(
                        'ml-1 px-1.5 py-0.5 text-xs rounded-full font-semibold',
                        isActive ? 'bg-white/25 text-inherit' : 'bg-gray-200 text-gray-700'
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search + Result count */}
          <div className="px-3 py-3 sm:px-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="w-full sm:max-w-md" data-testid="so-search-container">
              <DxTextBox
                placeholder={t('orders.searchPlaceholder')}
                value={search}
                onValueChange={setSearch}
                showClearButton
                mode="search"
                elementAttr={{ 'data-testid': 'so-search-input' }}
              />
            </div>
            <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 whitespace-nowrap">
              <Boxes className="h-4 w-4 text-gray-400" />
              <span>{t('orders.grid.showing', { count: filteredOrders.length })}</span>
            </div>
          </div>

          {/* Content: Loading / Empty / No-results / Mobile Cards / Desktop Grid */}
          {isLoading ? (
            isMobile ? (
              <OrderCardSkeletonList count={4} />
            ) : (
              <DataGridLoadingSkeleton />
            )
          ) : showEmptyState ? (
            <EmptyState onCreate={handleCreate} t={t} />
          ) : showNoResultsState ? (
            <NoResultsState onClear={handleClearFilters} t={t} tCommon={tCommon} />
          ) : isMobile ? (
            <OrderCardList
              orders={filteredOrders}
              onView={handleView}
              t={t}
            />
          ) : (
            <DxDataGrid
              key={locale}
              dataSource={filteredOrders}
              keyExpr="id"
              columns={columns}
              sorting
              filterRow
              headerFilter
              export
              exportFileName="sales-orders"
              columnChooser
              responsiveColumns
              virtualScrolling={filteredOrders.length > 100}
              height={600}
              mobileHeight={520}
              tabletHeight={560}
              noDataText={t('orders.grid.noData')}
              onRowClick={handleRowClick}
              rowAlternationEnabled
              elementAttr={{ 'data-testid': 'so-data-grid' }}
            />
          )}
        </div>
      </div>
    </MainLayout>
  );
}

// ============================================
// Helper Components
// ============================================

// next-intl's translator type; accept a compatible superset.
type TranslateFn = (key: string, values?: Record<string, string | number | Date>) => string;

/** Mobile Card List — replaces DataGrid on mobile viewports. */
function OrderCardList({
  orders,
  onView,
  t,
}: {
  orders: SalesOrder[];
  onView: (order: SalesOrder) => void;
  t: TranslateFn;
}) {
  return (
    <div className="p-3 sm:p-4 space-y-3 bg-gray-50/30">
      {orders.map((order) => {
        const config = STATUS_CONFIG[order.status];
        const overdue = isOverdue(order.requiredDate, order.status);
        const daysUntil = getDaysUntilRequired(order.requiredDate, order.status);
        const StatusIcon = config?.icon || FileText;

        return (
          <div
            key={order.id}
            className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md active:bg-gray-50 transition-all overflow-hidden"
          >
            {/* Left color strip + tap-to-view body */}
            <button
              type="button"
              onClick={() => onView(order)}
              className="w-full text-left p-4 flex items-start gap-3"
            >
              <div
                className={cn(
                  'h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0',
                  overdue ? 'bg-red-100' : 'bg-indigo-100'
                )}
              >
                <FileText className={cn('h-5 w-5', overdue ? 'text-red-600' : 'text-indigo-600')} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="min-w-0">
                    <p className="font-mono font-semibold text-indigo-600 text-base truncate">{order.soNumber}</p>
                    <p className="text-sm text-gray-700 truncate mt-0.5" title={order.customerName}>
                      {order.customerName}
                    </p>
                  </div>
                  {config && (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold tracking-wide shrink-0',
                        config.bgClass,
                        config.textClass,
                      )}
                    >
                      <StatusIcon className="h-3 w-3" />
                      {t(`orders.status.${config.translationKey}`)}
                    </span>
                  )}
                </div>

                {/* Price + delivery date */}
                <div className="flex items-center justify-between gap-2 mt-2">
                  <span className="text-lg font-bold text-emerald-600 tabular-nums">
                    {formatCurrency(order.totalAmount, order.currency)}
                  </span>
                  {order.requiredDate && (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded',
                        overdue ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-700',
                      )}
                    >
                      <Truck className="h-3 w-3" />
                      {formatDateShort(order.requiredDate)}
                      {daysUntil !== null && (
                        <span className="ml-1">
                          {daysUntil < 0
                            ? `(${t('orders.dates.overdueShort', { days: Math.abs(daysUntil) })})`
                            : daysUntil === 0
                              ? `(${t('orders.dates.today')})`
                              : `(${t('orders.dates.daysShort', { days: daysUntil })})`}
                        </span>
                      )}
                    </span>
                  )}
                </div>

                {overdue && (
                  <div className="mt-2 p-1.5 bg-red-50 rounded-md flex items-center gap-1.5 text-red-600 text-xs">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>{t('orders.grid.overdue')}</span>
                  </div>
                )}
              </div>
            </button>

            {/* Card footer: View Details button (touch-friendly) */}
            <div className="flex items-center border-t border-gray-100">
              <button
                type="button"
                onClick={() => onView(order)}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 active:bg-indigo-100 transition-colors min-h-[44px]"
              >
                <Eye className="h-4 w-4" />
                <span>{t('orders.actions.viewOrder')}</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Loading skeleton for mobile card list */
function OrderCardSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="p-3 sm:p-4 space-y-3 bg-gray-50/30" aria-busy="true" aria-live="polite">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 animate-pulse">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-xl bg-gray-200 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/2 bg-gray-200 rounded" />
              <div className="h-3 w-1/3 bg-gray-200 rounded" />
              <div className="h-3 w-2/3 bg-gray-200 rounded" />
              <div className="flex gap-2 pt-1">
                <div className="h-5 w-16 bg-gray-200 rounded-full" />
                <div className="h-5 w-20 bg-gray-200 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Loading skeleton for desktop DataGrid area */
function DataGridLoadingSkeleton() {
  return (
    <div className="p-4 space-y-2" aria-busy="true" aria-live="polite">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-3 bg-white border border-gray-100 rounded-lg animate-pulse">
          <div className="h-8 w-8 rounded-lg bg-gray-200" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/4 bg-gray-200 rounded" />
            <div className="h-2 w-1/6 bg-gray-200 rounded" />
          </div>
          <div className="h-6 w-20 bg-gray-200 rounded-full" />
          <div className="h-6 w-16 bg-gray-200 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Empty State — shown when there are zero orders at all */
function EmptyState({ onCreate, t }: { onCreate: () => void; t: TranslateFn }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="h-20 w-20 rounded-2xl bg-indigo-100 flex items-center justify-center mb-5">
        <ShoppingBag className="h-10 w-10 text-indigo-600" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        {t('orders.grid.noData')}
      </h3>
      <p className="text-sm text-gray-500 max-w-sm mb-6">
        {t('orders.description')}
      </p>
      <DxButton
        text={t('orders.actions.createOrder')}
        icon="plus"
        type="success"
        onClick={onCreate}
      />
    </div>
  );
}

/** No Results State — shown when filter/search yields zero results */
function NoResultsState({
  onClear,
  t,
  tCommon,
}: {
  onClear: () => void;
  t: TranslateFn;
  tCommon: TranslateFn;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
      <div className="h-16 w-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <SearchX className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">
        {t('orders.cards.noMatchingOrders')}
      </h3>
      <p className="text-sm text-gray-500 max-w-sm mb-4">
        {t('orders.grid.noData')}
      </p>
      <DxButton
        text={tCommon('actions.clear')}
        icon="clear"
        stylingMode="outlined"
        onClick={onClear}
      />
    </div>
  );
}
