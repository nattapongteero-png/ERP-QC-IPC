'use client';

/**
 * VMI Orders Page - Professional Dashboard (Responsive Refactor)
 *
 * Page for managing orders received from VMI Portals.
 * Displays order list with KPI stats, charts, and multiple view modes.
 *
 * Responsive patterns:
 *  - ResponsivePageHeader with PackageOpen icon (cyan tone)
 *  - 4 StatCards (Total / Pending / Delivered / Overdue)
 *  - Mobile card view replaces DataGrid at <md
 *  - Charts hidden below lg
 *  - Scroll-snap status tab filter, responsive filters, skeletons, empty/no-results states
 *
 * Feature: 008-vmi-vendor-sync (refactored)
 */

import { useState, useMemo, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { Badge } from '@/components/ui/badge';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { useMobile } from '@/hooks/use-mobile';
import { VmiOrderDetail } from '@/components/vmi';
import { cn } from '@/lib/utils/cn';
import {
  ShoppingCart,
  Package,
  PackageOpen,
  Truck,
  CheckCircle2,
  Clock,
  XCircle,
  BarChart3,
  LayoutGrid,
  List,
  TrendingUp,
  Calendar,
  ArrowRight,
  AlertTriangle,
  RefreshCw,
  Link2,
  CheckSquare,
  AlertCircle,
  Zap,
  Filter,
  Activity,
  ArrowLeft,
  SearchX,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PieChart, { Series, Legend, Tooltip, Label } from 'devextreme-react/pie-chart';
import type { DataGridTypes } from 'devextreme-react/data-grid';
import type { VmiSalesOrderStatus } from '@/types/vmi';

// ============================================================================
// Types
// ============================================================================

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

type ViewMode = 'grid' | 'cards' | 'analytics';

// ============================================================================
// Configuration Constants
// ============================================================================

const STATUS_CONFIG: Record<
  string,
  {
    translationKey: string;
    color: string;
    bgColor: string;
    borderColor: string;
    hex: string;
    icon: typeof Clock;
    badgeVariant: 'warning' | 'info' | 'success' | 'danger';
  }
> = {
  pending: {
    translationKey: 'pending',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-500',
    hex: '#f59e0b',
    icon: Clock,
    badgeVariant: 'warning',
  },
  confirmed: {
    translationKey: 'confirmed',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-500',
    hex: '#3b82f6',
    icon: CheckCircle2,
    badgeVariant: 'info',
  },
  processing: {
    translationKey: 'processing',
    color: 'text-violet-600',
    bgColor: 'bg-violet-50',
    borderColor: 'border-violet-500',
    hex: '#8b5cf6',
    icon: Package,
    badgeVariant: 'info',
  },
  shipped: {
    translationKey: 'shipped',
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50',
    borderColor: 'border-cyan-500',
    hex: '#06b6d4',
    icon: Truck,
    badgeVariant: 'info',
  },
  delivered: {
    translationKey: 'delivered',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-500',
    hex: '#22c55e',
    icon: CheckCircle2,
    badgeVariant: 'success',
  },
  cancelled: {
    translationKey: 'cancelled',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-500',
    hex: '#ef4444',
    icon: XCircle,
    badgeVariant: 'danger',
  },
};

const PRIORITY_CONFIG: Record<
  string,
  { translationKey: string; color: string; bgColor: string }
> = {
  low: { translationKey: 'low', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  normal: { translationKey: 'normal', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  high: { translationKey: 'high', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  urgent: { translationKey: 'urgent', color: 'text-red-600', bgColor: 'bg-red-100' },
};

// Status tab filter order (used for scroll-snap filter row)
const STATUS_TAB_KEYS: Array<{ key: string; translationKey: string; icon: typeof Clock; bgActive: string }> = [
  { key: '', translationKey: 'all', icon: ShoppingCart, bgActive: 'bg-cyan-600' },
  { key: 'pending', translationKey: 'pending', icon: Clock, bgActive: 'bg-amber-500' },
  { key: 'confirmed', translationKey: 'confirmed', icon: CheckCircle2, bgActive: 'bg-blue-600' },
  { key: 'processing', translationKey: 'processing', icon: Package, bgActive: 'bg-violet-600' },
  { key: 'shipped', translationKey: 'shipped', icon: Truck, bgActive: 'bg-cyan-600' },
  { key: 'delivered', translationKey: 'delivered', icon: CheckCircle2, bgActive: 'bg-green-600' },
  { key: 'cancelled', translationKey: 'cancelled', icon: XCircle, bgActive: 'bg-red-600' },
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

const formatCurrency = (amount: number | null | undefined) => {
  const safeAmount = Number(amount) || 0;
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(safeAmount);
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

const isOverdue = (requestedDeliveryDate: string, status: string) => {
  if (!requestedDeliveryDate) return false;
  if (['delivered', 'cancelled', 'shipped'].includes(status)) return false;
  return new Date(requestedDeliveryDate) < new Date();
};

const getDaysUntilRequired = (requestedDeliveryDate: string, status: string) => {
  if (!requestedDeliveryDate) return null;
  if (['delivered', 'cancelled'].includes(status)) return null;
  const days = Math.ceil(
    (new Date(requestedDeliveryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );
  return days;
};

// ============================================================================
// API Functions
// ============================================================================

async function fetchVmiOrders(): Promise<VmiOrder[]> {
  const params = new URLSearchParams();
  params.set('limit', '100');

  const response = await fetch(`/api/sales/vmi-orders?${params}`);
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch VMI orders');
  }
  // Map API VmiSalesOrderSummary fields to frontend VmiOrder fields
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (result.data?.items || []).map((item: any) => ({
    id: item.id,
    portalId: item.portalId,
    portalName: item.portalName,
    portalOrderId: item.vmiOrderId,
    orderDate: item.orderDate,
    customerId: item.customerId,
    customerName: item.vmiCustomerName || 'Unknown',
    hospitalCode: item.vmiCustomerId,
    status: item.localStatus || 'pending',
    priority: 'normal', // Not stored in DB yet - default to normal
    totalItems: item.lineCount || 0,
    totalAmount: item.totalAmount,
    matchedItems: (item.lineCount || 0) - (item.unmatchedLineCount || 0),
    unmatchedItems: item.unmatchedLineCount || 0,
    requestedDeliveryDate: item.requiredDate,
    confirmedAt: item.confirmedAt,
    shippedAt: item.shippedAt,
    createdAt: item.polledAt || item.orderDate,
  }));
}

async function pollOrders(): Promise<{
  summary: { totalNewOrders: number; portalsPolled: number };
}> {
  const response = await fetch('/api/sales/vmi-orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to poll orders');
  }
  return result.data;
}

// ============================================================================
// Main Component
// ============================================================================

export default function VmiOrdersPage() {
  const queryClient = useQueryClient();
  const t = useTranslations('sales');
  const locale = useLocale();
  const { isMobile } = useMobile();

  // Derive status/priority select options from translations
  const statusOptions = useMemo(() => [
    { value: '', label: t('vmiOrders.placeholders.allStatus') },
    { value: 'pending', label: t('vmiOrders.status.pending') },
    { value: 'confirmed', label: t('vmiOrders.status.confirmed') },
    { value: 'processing', label: t('vmiOrders.status.processing') },
    { value: 'shipped', label: t('vmiOrders.status.shipped') },
    { value: 'delivered', label: t('vmiOrders.status.delivered') },
    { value: 'cancelled', label: t('vmiOrders.status.cancelled') },
  ], [t]);

  const priorityOptions = useMemo(() => [
    { value: '', label: t('vmiOrders.priority.all') },
    { value: 'low', label: t('vmiOrders.priority.low') },
    { value: 'normal', label: t('vmiOrders.priority.normal') },
    { value: 'high', label: t('vmiOrders.priority.high') },
    { value: 'urgent', label: t('vmiOrders.priority.urgent') },
  ], [t]);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  // Data fetching with React Query
  const {
    data: orders = [],
    isLoading,
    refetch,
  } = useQuery<VmiOrder[]>({
    queryKey: ['vmi-orders'],
    queryFn: fetchVmiOrders,
    staleTime: 30 * 1000,
    refetchInterval: 60000,
  });

  // Poll mutation
  const pollMutation = useMutation({
    mutationFn: () => pollOrders(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vmi-orders'] });
    },
  });

  // Filter orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesSearch =
        !search ||
        order.portalOrderId?.toLowerCase().includes(search.toLowerCase()) ||
        order.customerName?.toLowerCase().includes(search.toLowerCase()) ||
        order.portalName?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = !statusFilter || order.status === statusFilter;
      const matchesPriority = !priorityFilter || order.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    }).map((item, index) => ({ ...item, _rowNumber: index + 1 }));
  }, [orders, search, statusFilter, priorityFilter]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = orders.length;
    const pending = orders.filter((o) => o.status === 'pending').length;
    const confirmed = orders.filter((o) => o.status === 'confirmed').length;
    const processing = orders.filter((o) => o.status === 'processing').length;
    const shipped = orders.filter((o) => o.status === 'shipped').length;
    const delivered = orders.filter((o) => o.status === 'delivered').length;
    const cancelled = orders.filter((o) => o.status === 'cancelled').length;
    const overdue = orders.filter((o) =>
      isOverdue(o.requestedDeliveryDate || '', o.status)
    ).length;

    const activeOrders = orders.filter(
      (o) => !['delivered', 'cancelled'].includes(o.status)
    );
    const pendingValue = activeOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const totalValue = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const deliveredValue = orders
      .filter((o) => o.status === 'delivered')
      .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    const totalItems = orders.reduce((sum, o) => sum + (o.totalItems || 0), 0);
    const matchedItems = orders.reduce((sum, o) => sum + (o.matchedItems || 0), 0);
    const unmatchedItems = orders.reduce((sum, o) => sum + (o.unmatchedItems || 0), 0);
    const matchRate = totalItems > 0 ? Math.round((matchedItems / totalItems) * 100) : 0;

    const urgentOrders = orders.filter(
      (o) => o.priority === 'urgent' && !['delivered', 'cancelled'].includes(o.status)
    ).length;

    const uniquePortals = new Set(orders.map((o) => o.portalName)).size;
    const fulfillmentRate = total > 0 ? Math.round((delivered / total) * 100) : 0;

    return {
      total,
      pending,
      confirmed,
      processing,
      shipped,
      delivered,
      cancelled,
      overdue,
      pendingValue,
      totalValue,
      deliveredValue,
      totalItems,
      matchedItems,
      unmatchedItems,
      matchRate,
      urgentOrders,
      uniquePortals,
      fulfillmentRate,
      activeCount: pending + confirmed + processing + shipped,
    };
  }, [orders]);

  // Count per status for scroll-snap tabs
  const statusTabCounts = useMemo(() => {
    const counts: Record<string, number> = { '': orders.length };
    Object.keys(STATUS_CONFIG).forEach((key) => {
      counts[key] = orders.filter((o) => o.status === key).length;
    });
    return counts;
  }, [orders]);

  // Chart data
  const statusChartData = useMemo(() => {
    return Object.entries(STATUS_CONFIG)
      .map(([key, config]) => ({
        status: t(`vmiOrders.status.${config.translationKey}`),
        count: orders.filter((o) => o.status === key).length,
        color: config.hex,
      }))
      .filter((item) => item.count > 0);
  }, [orders, t]);

  const priorityChartData = useMemo(() => {
    return Object.entries(PRIORITY_CONFIG)
      .map(([key, config]) => ({
        priority: t(`vmiOrders.priority.${config.translationKey}`),
        count: orders.filter((o) => o.priority === key).length,
        color:
          key === 'urgent'
            ? '#ef4444'
            : key === 'high'
              ? '#f97316'
              : key === 'normal'
                ? '#3b82f6'
                : '#6b7280',
      }))
      .filter((item) => item.count > 0);
  }, [orders, t]);

  // Portal statistics
  const portalStats = useMemo(() => {
    const portalMap = new Map<string, { count: number; value: number; pending: number }>();
    orders.forEach((o) => {
      const portalName = o.portalName || 'Unknown';
      const existing = portalMap.get(portalName) || { count: 0, value: 0, pending: 0 };
      portalMap.set(portalName, {
        count: existing.count + 1,
        value: existing.value + (o.totalAmount || 0),
        pending: existing.pending + (o.status === 'pending' ? 1 : 0),
      });
    });
    return Array.from(portalMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.value - a.value);
  }, [orders]);

  // Urgent orders
  const urgentOrdersList = useMemo(() => {
    return orders
      .filter((o) => {
        if (['delivered', 'cancelled'].includes(o.status)) return false;
        const days = getDaysUntilRequired(o.requestedDeliveryDate || '', o.status);
        return (days !== null && days <= 3) || o.priority === 'urgent' || o.priority === 'high';
      })
      .sort((a, b) => {
        const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        const daysA = getDaysUntilRequired(a.requestedDeliveryDate || '', a.status) ?? 999;
        const daysB = getDaysUntilRequired(b.requestedDeliveryDate || '', b.status) ?? 999;
        return daysA - daysB;
      })
      .slice(0, 6);
  }, [orders]);

  // Unmatched orders
  const unmatchedOrders = useMemo(() => {
    return orders
      .filter((o) => o.unmatchedItems > 0 && !['delivered', 'cancelled'].includes(o.status))
      .sort((a, b) => b.unmatchedItems - a.unmatchedItems)
      .slice(0, 5);
  }, [orders]);

  // Recent orders
  const recentOrders = useMemo(() => {
    return [...orders]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [orders]);

  // Navigation handlers
  const handleRowClick = useCallback((e: DataGridTypes.RowClickEvent) => {
    if (e.data?.id) {
      setSelectedOrderId(e.data.id);
    }
  }, []);

  const handleOrderClick = useCallback((id: number) => {
    setSelectedOrderId(id);
  }, []);

  const clearFilters = useCallback(() => {
    setSearch('');
    setStatusFilter('');
    setPriorityFilter('');
  }, []);

  // Cell renderers
  const renderOrderIdCell = useCallback((data: { data?: VmiOrder }) => {
    if (!data.data) return null;
    const order = data.data;
    const overdue = isOverdue(order.requestedDeliveryDate || '', order.status);
    return (
      <div>
        <p className="font-mono font-semibold text-blue-600">{order.portalOrderId}</p>
        {overdue && (
          <div className="inline-flex items-center gap-1 mt-1 text-xs text-red-600">
            <AlertTriangle className="h-3 w-3" />
            {t('vmiOrders.dates.overdueLabel')}
          </div>
        )}
      </div>
    );
  }, [t]);

  const renderPortalCell = useCallback((data: { data?: VmiOrder }) => {
    if (!data.data) return null;
    return (
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded bg-indigo-100 flex items-center justify-center flex-shrink-0">
          <Link2 className="h-3.5 w-3.5 text-indigo-600" />
        </div>
        <span className="truncate">{data.data.portalName || '-'}</span>
      </div>
    );
  }, []);

  const renderCustomerCell = useCallback((data: { data?: VmiOrder }) => {
    if (!data.data) return null;
    const order = data.data;
    return (
      <div className="min-w-0">
        <p className="font-medium truncate">{order.customerName || '-'}</p>
        {order.hospitalCode && (
          <p className="text-xs text-gray-500 truncate">{order.hospitalCode}</p>
        )}
      </div>
    );
  }, []);

  const renderMatchStatusCell = useCallback((data: { data?: VmiOrder }) => {
    if (!data.data) return null;
    const order = data.data;
    const allMatched = order.matchedItems === order.totalItems;
    const percentage =
      order.totalItems > 0 ? Math.round((order.matchedItems / order.totalItems) * 100) : 0;
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span
            className={cn(
              'flex items-center gap-1',
              allMatched ? 'text-green-600' : 'text-orange-600'
            )}
          >
            {allMatched ? (
              <CheckSquare className="h-3.5 w-3.5" />
            ) : (
              <AlertCircle className="h-3.5 w-3.5" />
            )}
            {order.matchedItems}/{order.totalItems}
          </span>
          <span className="font-medium">{percentage}%</span>
        </div>
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              allMatched ? 'bg-green-500' : 'bg-orange-500'
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  }, []);

  const renderPriorityCell = useCallback((data: { data?: VmiOrder }) => {
    if (!data.data) return null;
    const config = PRIORITY_CONFIG[data.data.priority] || PRIORITY_CONFIG.normal;
    return (
      <span className={cn('px-2 py-1 rounded text-xs font-medium', config.bgColor, config.color)}>
        {t(`vmiOrders.priority.${config.translationKey}`)}
      </span>
    );
  }, [t]);

  const renderDateCell = useCallback((data: { data?: VmiOrder }) => {
    if (!data.data) return null;
    return <span className="text-sm">{formatDate(data.data.orderDate)}</span>;
  }, []);

  const renderDeliveryDateCell = useCallback((data: { data?: VmiOrder }) => {
    if (!data.data) return null;
    const order = data.data;
    const overdue = isOverdue(order.requestedDeliveryDate || '', order.status);
    const daysUntil = getDaysUntilRequired(order.requestedDeliveryDate || '', order.status);

    if (!order.requestedDeliveryDate) return <span className="text-gray-400">-</span>;

    return (
      <div>
        <span className={cn('text-sm', overdue && 'text-red-600 font-medium')}>
          {formatDate(order.requestedDeliveryDate)}
        </span>
        {daysUntil !== null && (
          <p
            className={cn(
              'text-xs',
              daysUntil < 0
                ? 'text-red-500'
                : daysUntil <= 3
                  ? 'text-amber-500'
                  : 'text-gray-500'
            )}
          >
            {daysUntil < 0
              ? t('vmiOrders.dates.overdueDays', { days: Math.abs(daysUntil) })
              : daysUntil === 0
                ? t('vmiOrders.dates.today')
                : t('vmiOrders.dates.daysRemaining', { days: daysUntil })}
          </p>
        )}
      </div>
    );
  }, [t]);

  const renderAmountCell = useCallback((data: { data?: VmiOrder }) => {
    if (!data.data) return null;
    return (
      <span className="font-semibold text-green-600">{formatCurrency(data.data.totalAmount)}</span>
    );
  }, []);

  const renderStatusCell = useCallback((data: { data?: VmiOrder }) => {
    if (!data.data) return null;
    const config = STATUS_CONFIG[data.data.status];
    if (!config) return <Badge>-</Badge>;
    const Icon = config.icon;
    return (
      <div
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
          config.bgColor,
          config.color
        )}
      >
        <Icon className="h-3.5 w-3.5" />
        {t(`vmiOrders.status.${config.translationKey}`)}
      </div>
    );
  }, [t]);

  const renderActionsCell = useCallback((data: { data?: VmiOrder }) => {
    if (!data.data) return null;
    return (
      <DxButton
        icon="chevronnext"
        type="normal"
        stylingMode="text"
        hint={t('vmiOrders.list.viewDetails')}
        onClick={(e) => {
          e.event?.stopPropagation();
          setSelectedOrderId(data.data!.id);
        }}
      />
    );
  }, [t]);

  // DataGrid columns with responsive hiding
  const columns: DxDataGridColumn[] = useMemo(
    () => [
      {
        dataField: '_rowNumber',
        caption: t('items.grid.columns.rowNum'),
        width: 60,
        alignment: 'center',
        allowFiltering: false,
        allowHeaderFiltering: false,
        allowSorting: false,
        cellRender: (cellInfo: { data?: VmiOrder & { _rowNumber?: number } }) => (
          <span className="text-gray-500 text-sm font-medium">
            {cellInfo.data?._rowNumber}
          </span>
        ),
      },
      {
        dataField: 'portalOrderId',
        caption: t('vmiOrders.columns.orderId'),
        minWidth: 150,
        cellRender: renderOrderIdCell,
      },
      {
        dataField: 'portalName',
        caption: t('vmiOrders.columns.portal'),
        minWidth: 140,
        hideOnMobile: true,
        cellRender: renderPortalCell,
      },
      {
        dataField: 'customerName',
        caption: t('vmiOrders.columns.customer'),
        minWidth: 180,
        cellRender: renderCustomerCell,
      },
      {
        dataField: 'orderDate',
        caption: t('vmiOrders.columns.orderDate'),
        minWidth: 120,
        dataType: 'date',
        hideOnMobile: true,
        hideOnTablet: true,
        cellRender: renderDateCell,
      },
      {
        dataField: 'requestedDeliveryDate',
        caption: t('vmiOrders.columns.deliveryDate'),
        minWidth: 140,
        hideOnMobile: true,
        cellRender: renderDeliveryDateCell,
      },
      {
        dataField: 'matchedItems',
        caption: t('vmiOrders.columns.matchItems'),
        minWidth: 130,
        hideOnMobile: true,
        hideOnTablet: true,
        cellRender: renderMatchStatusCell,
      },
      {
        dataField: 'priority',
        caption: t('vmiOrders.columns.priority'),
        minWidth: 110,
        hideOnMobile: true,
        hideOnTablet: true,
        cellRender: renderPriorityCell,
      },
      {
        dataField: 'totalAmount',
        caption: t('vmiOrders.columns.totalAmount'),
        minWidth: 120,
        dataType: 'number',
        hideOnMobile: true,
        cellRender: renderAmountCell,
      },
      {
        dataField: 'status',
        caption: t('vmiOrders.columns.status'),
        minWidth: 140,
        cellRender: renderStatusCell,
      },
      {
        caption: '',
        width: 60,
        allowSorting: false,
        allowFiltering: false,
        cellRender: renderActionsCell,
      },
    ],
    [
      t,
      renderOrderIdCell,
      renderPortalCell,
      renderCustomerCell,
      renderDateCell,
      renderDeliveryDateCell,
      renderMatchStatusCell,
      renderPriorityCell,
      renderAmountCell,
      renderStatusCell,
      renderActionsCell,
    ]
  );

  // Render order card (used in cards / analytics view)
  const renderOrderCard = (order: VmiOrder) => {
    const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
    const priorityConfig = PRIORITY_CONFIG[order.priority] || PRIORITY_CONFIG.normal;
    const overdue = isOverdue(order.requestedDeliveryDate || '', order.status);
    const daysUntil = getDaysUntilRequired(order.requestedDeliveryDate || '', order.status);
    const allMatched = order.matchedItems === order.totalItems;

    return (
      <Card
        key={order.id}
        elevation="raised"
        className="cursor-pointer transition-all hover:shadow-lg overflow-hidden"
        onClick={() => handleOrderClick(order.id)}
      >
        <CardContent className="p-0">
          <div className="flex items-stretch">
            <div
              className="w-1.5"
              style={{ backgroundColor: statusConfig.hex }}
            />
            <div className="flex-1 p-4">
              <div className="flex items-start justify-between mb-3 gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-mono font-semibold text-blue-600 truncate">{order.portalOrderId}</p>
                    {order.priority === 'urgent' && (
                      <span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded font-medium">
                        {t('vmiOrders.card.urgent')}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1 truncate">{order.portalName}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-lg font-bold text-green-600">
                    {formatCurrency(order.totalAmount)}
                  </p>
                  {statusConfig && (
                    <div
                      className={cn(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mt-1',
                        statusConfig.bgColor,
                        statusConfig.color
                      )}
                    >
                      {t(`vmiOrders.status.${statusConfig.translationKey}`)}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-2 bg-gray-50 rounded-lg mb-3">
                <p className="font-medium text-sm truncate">{order.customerName || '-'}</p>
                {order.hospitalCode && (
                  <p className="text-xs text-gray-500 truncate">{order.hospitalCode}</p>
                )}
              </div>

              <div className="flex items-center justify-between text-xs mb-2 flex-wrap gap-2">
                <div
                  className={cn(
                    'flex items-center gap-1 px-2 py-1 rounded',
                    allMatched ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'
                  )}
                >
                  {allMatched ? (
                    <CheckSquare className="h-3.5 w-3.5" />
                  ) : (
                    <AlertCircle className="h-3.5 w-3.5" />
                  )}
                  <span>
                    {t('vmiOrders.card.matched', { matched: order.matchedItems, total: order.totalItems })}
                  </span>
                </div>
                <span className={cn('px-2 py-1 rounded', priorityConfig.bgColor, priorityConfig.color)}>
                  {t(`vmiOrders.priority.${priorityConfig.translationKey}`)}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t flex-wrap gap-2">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{formatDateShort(order.orderDate)}</span>
                </div>
                {order.requestedDeliveryDate && (
                  <div
                    className={`flex items-center gap-1 ${overdue ? 'text-red-600 font-medium' : ''}`}
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                    <span>{formatDateShort(order.requestedDeliveryDate)}</span>
                    {daysUntil !== null && (
                      <span
                        className={cn(
                          daysUntil < 0
                            ? 'text-red-500'
                            : daysUntil <= 3
                              ? 'text-amber-500'
                              : ''
                        )}
                      >
                        ({daysUntil < 0
                          ? t('vmiOrders.dates.overdueShort', { days: Math.abs(daysUntil) })
                          : daysUntil === 0
                            ? t('vmiOrders.dates.today')
                            : t('vmiOrders.dates.daysShort', { days: daysUntil })})
                      </span>
                    )}
                  </div>
                )}
              </div>

              {overdue && (
                <div className="mt-2 p-2 bg-red-50 rounded-md flex items-center gap-2 text-red-600 text-xs">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>{t('vmiOrders.card.overdueMessage')}</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // ============================================================================
  // Section Renderers
  // ============================================================================

  const renderAlerts = () => {
    const alerts = [];

    if (stats.overdue > 0) {
      alerts.push(
        <Card key="overdue" className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-start sm:items-center gap-3 flex-col sm:flex-row">
              <div className="flex items-center gap-3 flex-1">
                <div className="p-2.5 rounded-xl bg-red-100 flex-shrink-0">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-red-800">{t('vmiOrders.alerts.overdueTitle', { count: stats.overdue })}</p>
                  <p className="text-sm text-red-600">{t('vmiOrders.alerts.overdueMessage')}</p>
                </div>
              </div>
              <DxButton
                text={t('vmiOrders.alerts.viewList')}
                type="danger"
                stylingMode="outlined"
                onClick={clearFilters}
              />
            </div>
          </CardContent>
        </Card>
      );
    }

    if (unmatchedOrders.length > 0) {
      alerts.push(
        <Card key="unmatched" className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-orange-100 flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-orange-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-orange-800">
                  {t('vmiOrders.alerts.unmatchedTitle', { count: unmatchedOrders.length })}
                </p>
                <p className="text-sm text-orange-600">{t('vmiOrders.alerts.unmatchedMessage')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    if (stats.urgentOrders > 0) {
      alerts.push(
        <Card key="urgent" className="border-purple-200 bg-purple-50">
          <CardContent className="p-4">
            <div className="flex items-start sm:items-center gap-3 flex-col sm:flex-row">
              <div className="flex items-center gap-3 flex-1">
                <div className="p-2.5 rounded-xl bg-purple-100 flex-shrink-0">
                  <Zap className="h-5 w-5 text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-purple-800">{t('vmiOrders.alerts.urgentTitle', { count: stats.urgentOrders })}</p>
                  <p className="text-sm text-purple-600">{t('vmiOrders.alerts.urgentMessage')}</p>
                </div>
              </div>
              <DxButton
                text={t('vmiOrders.alerts.viewList')}
                type="normal"
                stylingMode="outlined"
                onClick={() => {
                  setPriorityFilter('urgent');
                  setStatusFilter('');
                }}
              />
            </div>
          </CardContent>
        </Card>
      );
    }

    return alerts.length > 0 ? <div className="grid grid-cols-1 gap-3">{alerts}</div> : null;
  };

  const renderFilters = () => (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-3 sm:p-4">
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 min-w-0">
          <DxTextBox
            placeholder={t('vmiOrders.placeholders.search')}
            value={search}
            onValueChange={setSearch}
            showClearButton
            mode="search"
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="w-full sm:w-48">
            <DxSelectBox
              items={statusOptions}
              value={statusFilter}
              onValueChange={setStatusFilter}
              placeholder={t('vmiOrders.placeholders.allStatus')}
              showClearButton
            />
          </div>
          <div className="w-full sm:w-48">
            <DxSelectBox
              items={priorityOptions}
              value={priorityFilter}
              onValueChange={setPriorityFilter}
              placeholder={t('vmiOrders.placeholders.allPriority')}
              showClearButton
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderCharts = () => (
    // Hidden below lg to free up mobile vertical space
    <div className="hidden lg:grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card elevation="raised">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-indigo-100">
              <BarChart3 className="h-4 w-4 text-indigo-600" />
            </div>
            <CardTitle className="text-sm font-medium">{t('vmiOrders.charts.statusDistribution')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {statusChartData.length > 0 ? (
            <PieChart
              key={`status-${locale}`}
              id="vmi-status-pie"
              dataSource={statusChartData}
              type="doughnut"
              palette={statusChartData.map((d) => d.color)}
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
              <Tooltip
                enabled={true}
                customizeTooltip={(arg) => ({
                  text: `${arg.argumentText}: ${arg.valueText} ${t('vmiOrders.charts.itemsSuffix')}`,
                })}
              />
            </PieChart>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-gray-400">
              {t('vmiOrders.charts.noData')}
            </div>
          )}
        </CardContent>
      </Card>

      <Card elevation="raised">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-purple-100">
              <Zap className="h-4 w-4 text-purple-600" />
            </div>
            <CardTitle className="text-sm font-medium">{t('vmiOrders.charts.priorityDistribution')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {priorityChartData.length > 0 ? (
            <PieChart
              key={`priority-${locale}`}
              id="vmi-priority-pie"
              dataSource={priorityChartData}
              type="doughnut"
              palette={priorityChartData.map((d) => d.color)}
              innerRadius={0.6}
              size={{ height: 220 }}
            >
              <Series argumentField="priority" valueField="count">
                <Label visible={false} />
              </Series>
              <Legend
                orientation="horizontal"
                horizontalAlignment="center"
                verticalAlignment="bottom"
              />
              <Tooltip
                enabled={true}
                customizeTooltip={(arg) => ({
                  text: `${arg.argumentText}: ${arg.valueText} ${t('vmiOrders.charts.itemsSuffix')}`,
                })}
              />
            </PieChart>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-gray-400">
              {t('vmiOrders.charts.noData')}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // Main grid view - desktop DataGrid or mobile card list
  const renderGridView = () => (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      {/* Scroll-snap status tab row */}
      <div className="px-3 py-3 sm:px-4 border-b border-gray-100 bg-gradient-to-r from-gray-50/50 to-white">
        <div className="flex items-center gap-1 p-1 bg-white border border-gray-200 rounded-lg overflow-x-auto scrollbar-thin snap-x">
          {STATUS_TAB_KEYS.map((tab) => {
            const count = statusTabCounts[tab.key] || 0;
            const isActive = statusFilter === tab.key;
            const Icon = tab.icon;
            return (
              <button
                key={tab.key || 'all'}
                onClick={() => setStatusFilter(tab.key)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 snap-start min-h-[36px]',
                  isActive
                    ? `${tab.bgActive} text-white shadow-sm`
                    : `text-gray-600 hover:bg-gray-100`
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{t(`vmiOrders.status.${tab.translationKey}`)}</span>
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

      {/* List header: title + result count */}
      <div className="px-3 py-3 sm:px-4 border-b border-gray-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-2 rounded-lg bg-cyan-100 flex-shrink-0">
            <ShoppingCart className="h-4 w-4 text-cyan-600" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-gray-900 text-sm sm:text-base truncate">{t('vmiOrders.list.title')}</p>
            <p className="text-xs text-gray-500">
              {t('vmiOrders.list.showingOf', { shown: filteredOrders.length, total: orders.length })}
            </p>
          </div>
        </div>
      </div>

      {/* Content: Loading / Empty / Mobile Cards / Desktop Grid */}
      {isLoading ? (
        isMobile ? (
          <VmiOrderCardSkeletonList count={4} />
        ) : (
          <DataGridLoadingSkeleton />
        )
      ) : orders.length === 0 ? (
        <VmiEmptyState onPoll={() => pollMutation.mutate()} loading={pollMutation.isPending} t={t} />
      ) : filteredOrders.length === 0 ? (
        <VmiNoResultsState onClear={clearFilters} t={t} />
      ) : isMobile ? (
        <VmiOrderCardList
          orders={filteredOrders}
          onOpen={handleOrderClick}
          t={t}
        />
      ) : (
        <DxDataGrid
          key={locale}
          dataSource={filteredOrders}
          keyExpr="id"
          columns={columns}
          loading={isLoading}
          sorting
          filterRow
          headerFilter
          export
          exportFileName="vmi-orders"
          columnChooser
          responsiveColumns
          virtualScrolling={filteredOrders.length > 100}
          height={600}
          mobileHeight={520}
          tabletHeight={560}
          onRowClick={handleRowClick}
          noDataText={t('vmiOrders.noData')}
        />
      )}
    </div>
  );

  const renderCardsView = () => (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {/* Main Content */}
      <div className="lg:col-span-3 space-y-4">
        {renderCharts()}

        {urgentOrdersList.length > 0 && (
          <Card elevation="raised">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-amber-100">
                  <Zap className="h-5 w-5 text-amber-600" />
                </div>
                <CardTitle>{t('vmiOrders.sections.urgentAction')}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {urgentOrdersList.map(renderOrderCard)}
              </div>
            </CardContent>
          </Card>
        )}

        {unmatchedOrders.length > 0 && (
          <Card elevation="raised">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-orange-100">
                  <AlertCircle className="h-5 w-5 text-orange-600" />
                </div>
                <CardTitle>{t('vmiOrders.sections.unmatchedItems')}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {unmatchedOrders.map(renderOrderCard)}
              </div>
            </CardContent>
          </Card>
        )}

        <Card elevation="raised">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-cyan-100">
                <ShoppingCart className="h-5 w-5 text-cyan-600" />
              </div>
              <CardTitle>{t('vmiOrders.sections.allOrders', { count: filteredOrders.length })}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {filteredOrders.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredOrders.slice(0, 10).map(renderOrderCard)}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">{t('vmiOrders.sections.noMatchingSearch')}</div>
            )}
            {filteredOrders.length > 10 && (
              <div className="mt-4 text-center">
                <DxButton
                  text={t('vmiOrders.sections.viewMore', { count: filteredOrders.length - 10 })}
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
        {/* Portal Stats */}
        <Card elevation="raised">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded bg-indigo-100">
                <Link2 className="h-4 w-4 text-indigo-600" />
              </div>
              <CardTitle className="text-sm">{t('vmiOrders.sections.portalStats')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {portalStats.map((portal) => (
                <div key={portal.name} className="p-2 rounded-lg bg-gray-50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate">{portal.name}</span>
                    <span className="text-xs text-gray-500">{t('vmiOrders.analytics.portalOrdersCount', { count: portal.count })}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-green-600 font-semibold">
                      {formatCurrencyShort(portal.value)}
                    </p>
                    {portal.pending > 0 && (
                      <span className="text-xs text-amber-600">{t('vmiOrders.analytics.portalPending', { count: portal.pending })}</span>
                    )}
                  </div>
                </div>
              ))}
              {portalStats.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">{t('vmiOrders.sections.noData')}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card elevation="raised">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded bg-green-100">
                <TrendingUp className="h-4 w-4 text-green-600" />
              </div>
              <CardTitle className="text-sm">{t('vmiOrders.sections.summary')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm text-gray-500">{t('vmiOrders.sections.totalValue')}</span>
              <span className="font-semibold text-green-600">
                {formatCurrencyShort(stats.totalValue)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm text-gray-500">{t('vmiOrders.sections.deliveredValue')}</span>
              <span className="font-semibold text-green-600">
                {formatCurrencyShort(stats.deliveredValue)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm text-gray-500">{t('vmiOrders.sections.matchRate')}</span>
              <span className="font-semibold text-blue-600">{stats.matchRate}%</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-gray-500">{t('vmiOrders.sections.fulfillmentRate')}</span>
              <span className="font-semibold text-blue-600">{stats.fulfillmentRate}%</span>
            </div>
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card elevation="raised">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded bg-blue-100">
                <Clock className="h-4 w-4 text-blue-600" />
              </div>
              <CardTitle className="text-sm">{t('vmiOrders.sections.recent')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {recentOrders.map((order) => {
                const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                return (
                  <button
                    key={order.id}
                    type="button"
                    className="w-full text-left p-2 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors border-l-2 min-h-[44px]"
                    style={{ borderLeftColor: statusConfig.hex }}
                    onClick={() => handleOrderClick(order.id)}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-mono text-xs text-blue-600 truncate">{order.portalOrderId}</p>
                      <p className="text-xs font-semibold text-green-600 flex-shrink-0">
                        {formatCurrencyShort(order.totalAmount)}
                      </p>
                    </div>
                    <p className="text-sm truncate">{order.customerName || order.portalName}</p>
                    <p className="text-xs text-gray-400">{formatDate(order.createdAt)}</p>
                  </button>
                );
              })}
              {recentOrders.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">{t('vmiOrders.sections.noData')}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Workflow Help */}
        <Card className="border-cyan-100 bg-gradient-to-br from-cyan-50 to-teal-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-cyan-900">{t('vmiOrders.sections.workflowTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-cyan-800 space-y-2">
            <div className="flex gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-cyan-200 flex items-center justify-center font-bold text-cyan-700">
                1
              </span>
              <span>{t('vmiOrders.sections.workflow1')}</span>
            </div>
            <div className="flex gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-cyan-200 flex items-center justify-center font-bold text-cyan-700">
                2
              </span>
              <span>{t('vmiOrders.sections.workflow2')}</span>
            </div>
            <div className="flex gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-cyan-200 flex items-center justify-center font-bold text-cyan-700">
                3
              </span>
              <span>{t('vmiOrders.sections.workflow3')}</span>
            </div>
            <div className="flex gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-cyan-200 flex items-center justify-center font-bold text-cyan-700">
                4
              </span>
              <span>{t('vmiOrders.sections.workflow4')}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderAnalyticsView = () => (
    <div className="space-y-4">
      {renderCharts()}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Status Breakdown */}
        <Card elevation="raised">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-indigo-100">
                <BarChart3 className="h-5 w-5 text-indigo-600" />
              </div>
              <CardTitle>{t('vmiOrders.analytics.statusBreakdown')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {Object.entries(STATUS_CONFIG).map(([key, config]) => {
                const count = orders.filter((o) => o.status === key).length;
                const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0;
                const Icon = config.icon;
                return (
                  <div key={key} className="flex items-center gap-3">
                    <div className={cn('p-2 rounded-lg', config.bgColor)}>
                      <Icon className={cn('h-4 w-4', config.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium">{t(`vmiOrders.status.${config.translationKey}`)}</span>
                        <span className="text-sm text-gray-500">
                          {count} ({percentage.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${percentage}%`, backgroundColor: config.hex }}
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
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-green-100">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <CardTitle>{t('vmiOrders.analytics.valueSummary')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-4">
              <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                <p className="text-sm text-gray-600">{t('vmiOrders.analytics.totalValue')}</p>
                <p className="text-2xl sm:text-3xl font-bold text-green-600 break-all">
                  {formatCurrency(stats.totalValue)}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-xs text-gray-500">{t('vmiOrders.analytics.pending')}</p>
                  <p className="text-lg font-bold text-blue-600">
                    {formatCurrencyShort(stats.pendingValue)}
                  </p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-xs text-gray-500">{t('vmiOrders.analytics.delivered')}</p>
                  <p className="text-lg font-bold text-green-600">
                    {formatCurrencyShort(stats.deliveredValue)}
                  </p>
                </div>
              </div>
              <div className="pt-3 border-t">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">{t('vmiOrders.analytics.fulfillmentRate')}</span>
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

      {/* Portal Analysis */}
      <Card elevation="raised">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-purple-100">
              <Link2 className="h-5 w-5 text-purple-600" />
            </div>
            <CardTitle>{t('vmiOrders.analytics.portalStats')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {portalStats.map((portal, idx) => (
              <Card key={portal.name} className="border overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex items-stretch">
                    <div className="w-1 bg-indigo-500" />
                    <div className="flex-1 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold flex-shrink-0">
                          {idx + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{portal.name}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2 bg-gray-50 rounded">
                          <span className="text-gray-500">{t('vmiOrders.analytics.portalOrders')}</span>
                          <p className="font-semibold">{t('vmiOrders.analytics.portalOrdersCount', { count: portal.count })}</p>
                        </div>
                        <div className="p-2 bg-gray-50 rounded">
                          <span className="text-gray-500">{t('vmiOrders.analytics.portalValue')}</span>
                          <p className="font-semibold text-green-600">
                            {formatCurrencyShort(portal.value)}
                          </p>
                        </div>
                      </div>
                      {portal.pending > 0 && (
                        <div className="mt-2 p-2 bg-amber-50 rounded text-xs text-amber-700">
                          {t('vmiOrders.analytics.portalPending', { count: portal.pending })}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {portalStats.length === 0 && (
              <div className="col-span-full text-center py-8 text-gray-400">{t('vmiOrders.analytics.noPortalData')}</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Match Rate Analysis */}
      <Card elevation="raised">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-100">
              <CheckSquare className="h-5 w-5 text-blue-600" />
            </div>
            <CardTitle>{t('vmiOrders.analytics.matchRateAnalysis')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 text-center">
              <p className="text-3xl sm:text-4xl font-bold text-blue-600">{stats.matchRate}%</p>
              <p className="text-sm text-gray-600 mt-1">{t('vmiOrders.analytics.matchRate')}</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg border border-green-200 text-center">
              <p className="text-3xl sm:text-4xl font-bold text-green-600">{stats.matchedItems}</p>
              <p className="text-sm text-gray-600 mt-1">{t('vmiOrders.analytics.matchedItems')}</p>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg border border-orange-200 text-center">
              <p className="text-3xl sm:text-4xl font-bold text-orange-600">{stats.unmatchedItems}</p>
              <p className="text-sm text-gray-600 mt-1">{t('vmiOrders.analytics.unmatchedItems')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ============================================================================
  // Main Render
  // ============================================================================

  // Detail view (selected order)
  if (selectedOrderId) {
    return (
      <MainLayout>
        <div className="flex flex-col gap-5 p-4 md:p-6 max-w-full">
          {/* Back Header */}
          <div className="flex items-center gap-3 sm:gap-4">
            <DxButton
              icon="arrowleft"
              type="normal"
              stylingMode="outlined"
              onClick={() => setSelectedOrderId(null)}
            />
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">
                {t('vmiOrders.detailTitle')}
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 truncate">
                {t('vmiOrders.detailSubtitle')}
              </p>
            </div>
          </div>
          <VmiOrderDetail
            orderId={selectedOrderId}
            onClose={() => setSelectedOrderId(null)}
            onConfirm={() => {
              refetch();
            }}
            onShip={() => {
              refetch();
            }}
          />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="flex flex-col gap-5 p-4 md:p-6 max-w-full">
        {/* Responsive Page Header */}
        <ResponsivePageHeader
          title={t('vmiOrders.pageTitle')}
          subtitle={t('vmiOrders.pageSubtitle')}
          icon={PackageOpen}
          iconBgColor="bg-cyan-100"
          iconColor="text-cyan-600"
          breadcrumbs={[
            { label: t('vmiOrders.breadcrumbSales'), href: '/sales' },
            { label: t('vmiOrders.breadcrumbVmiOrders') },
          ]}
          actions={
            <div className="flex items-center gap-2 flex-wrap">
              {/* View Mode Toggle: hidden on mobile */}
              <div className="hidden md:flex items-center bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    'p-2 rounded transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center',
                    viewMode === 'grid' ? 'bg-white shadow-sm text-cyan-600' : 'text-gray-500 hover:text-gray-700'
                  )}
                  title={t('vmiOrders.views.grid')}
                  aria-label={t('vmiOrders.views.grid')}
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('cards')}
                  className={cn(
                    'p-2 rounded transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center',
                    viewMode === 'cards' ? 'bg-white shadow-sm text-cyan-600' : 'text-gray-500 hover:text-gray-700'
                  )}
                  title={t('vmiOrders.views.cards')}
                  aria-label={t('vmiOrders.views.cards')}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('analytics')}
                  className={cn(
                    'p-2 rounded transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center',
                    viewMode === 'analytics' ? 'bg-white shadow-sm text-cyan-600' : 'text-gray-500 hover:text-gray-700'
                  )}
                  title={t('vmiOrders.views.analytics')}
                  aria-label={t('vmiOrders.views.analytics')}
                >
                  <BarChart3 className="h-4 w-4" />
                </button>
              </div>

              <DxButton
                icon="refresh"
                text={t('vmiOrders.refresh')}
                stylingMode="outlined"
                onClick={() => refetch()}
                className="hidden sm:inline-flex"
              />
              <DxButton
                text={pollMutation.isPending ? t('vmiOrders.polling') : t('vmiOrders.pollOrders')}
                icon={pollMutation.isPending ? undefined : 'download'}
                type="success"
                onClick={() => pollMutation.mutate()}
                disabled={pollMutation.isPending}
              />
            </div>
          }
        />

        {/* KPI Stat Cards — 4 key metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <StatCard
            label={t('vmiOrders.stats.totalOrders')}
            value={stats.total}
            icon={ShoppingCart}
            iconColor="text-cyan-500"
            accentColor="border-cyan-500"
          />
          <StatCard
            label={t('vmiOrders.stats.pending')}
            value={stats.pending}
            icon={Clock}
            iconColor="text-amber-500"
            accentColor="border-amber-500"
          />
          <StatCard
            label={t('vmiOrders.stats.delivered')}
            value={stats.delivered}
            icon={CheckCircle2}
            iconColor="text-emerald-500"
            accentColor="border-emerald-500"
          />
          <StatCard
            label={t('vmiOrders.stats.overdue')}
            value={stats.overdue}
            icon={AlertTriangle}
            iconColor="text-red-500"
            accentColor="border-red-500"
          />
        </div>

        {/* Alerts (overdue / unmatched / urgent) */}
        {renderAlerts()}

        {/* Filters (search + status + priority) */}
        {renderFilters()}

        {/* Content */}
        {viewMode === 'grid' && renderGridView()}
        {viewMode === 'cards' && renderCardsView()}
        {viewMode === 'analytics' && renderAnalyticsView()}
      </div>
    </MainLayout>
  );
}

// ============================================================================
// Helper Components (Mobile / Loading / Empty / No-Results)
// ============================================================================

/**
 * Mobile Card List — replaces DataGrid on mobile viewports.
 * Prioritizes: Order ID, hospital/customer, status, match rate, date. 44px tap footer.
 */
function VmiOrderCardList({
  orders,
  onOpen,
  t,
}: {
  orders: VmiOrder[];
  onOpen: (id: number) => void;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
}) {
  return (
    <div className="p-3 sm:p-4 space-y-3 bg-gray-50/30">
      {orders.map((order) => {
        const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
        const overdue = isOverdue(order.requestedDeliveryDate || '', order.status);
        const daysUntil = getDaysUntilRequired(order.requestedDeliveryDate || '', order.status);
        const allMatched = order.matchedItems === order.totalItems;
        const StatusIcon = statusConfig.icon;

        return (
          <div
            key={order.id}
            className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md active:bg-gray-50 transition-all overflow-hidden"
          >
            <button
              type="button"
              onClick={() => onOpen(order.id)}
              className="w-full text-left flex items-stretch"
            >
              <div className="w-1.5 flex-shrink-0" style={{ backgroundColor: statusConfig.hex }} />
              <div className="flex-1 p-4 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono font-semibold text-blue-600 text-sm truncate">
                      {order.portalOrderId}
                    </p>
                    {order.portalName && (
                      <p className="text-xs text-gray-500 truncate flex items-center gap-1 mt-0.5">
                        <Link2 className="h-3 w-3 flex-shrink-0" />
                        {order.portalName}
                      </p>
                    )}
                  </div>
                  <div
                    className={cn(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0',
                      statusConfig.bgColor,
                      statusConfig.color
                    )}
                  >
                    <StatusIcon className="h-3 w-3" />
                    {t(`vmiOrders.status.${statusConfig.translationKey}`)}
                  </div>
                </div>

                <div className="p-2 bg-gray-50 rounded-lg mb-2">
                  <p className="font-medium text-sm truncate">{order.customerName || '-'}</p>
                  {order.hospitalCode && (
                    <p className="text-xs text-gray-500 truncate">{order.hospitalCode}</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded',
                      allMatched ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'
                    )}
                  >
                    {allMatched ? (
                      <CheckSquare className="h-3 w-3" />
                    ) : (
                      <AlertCircle className="h-3 w-3" />
                    )}
                    {t('vmiOrders.card.matched', { matched: order.matchedItems, total: order.totalItems })}
                  </span>
                  {order.totalAmount != null && (
                    <span className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-semibold">
                      {formatCurrency(order.totalAmount)}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t flex-wrap gap-2">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{formatDateShort(order.orderDate)}</span>
                  </div>
                  {order.requestedDeliveryDate && (
                    <div className={cn('flex items-center gap-1', overdue && 'text-red-600 font-medium')}>
                      <ArrowRight className="h-3.5 w-3.5" />
                      <span>{formatDateShort(order.requestedDeliveryDate)}</span>
                      {daysUntil !== null && (
                        <span
                          className={cn(
                            daysUntil < 0
                              ? 'text-red-500'
                              : daysUntil <= 3
                                ? 'text-amber-500'
                                : ''
                          )}
                        >
                          ({daysUntil < 0
                            ? t('vmiOrders.dates.overdueShort', { days: Math.abs(daysUntil) })
                            : daysUntil === 0
                              ? t('vmiOrders.dates.today')
                              : t('vmiOrders.dates.daysShort', { days: daysUntil })})
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {overdue && (
                  <div className="mt-2 p-2 bg-red-50 rounded-md flex items-center gap-2 text-red-600 text-xs">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>{t('vmiOrders.card.overdueMessage')}</span>
                  </div>
                )}
              </div>
            </button>

            {/* Card footer: primary tap target (44px) */}
            <div className="flex items-center border-t border-gray-100">
              <button
                type="button"
                onClick={() => onOpen(order.id)}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-gray-700 hover:bg-cyan-50 hover:text-cyan-700 active:bg-cyan-100 transition-colors min-h-[44px]"
              >
                <Activity className="h-4 w-4" />
                <span>{t('vmiOrders.list.viewDetails')}</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Loading skeleton for mobile card list */
function VmiOrderCardSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="p-3 sm:p-4 space-y-3 bg-gray-50/30" aria-busy="true" aria-live="polite">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 animate-pulse">
          <div className="flex items-start gap-3">
            <div className="w-1.5 h-20 bg-gray-200 rounded" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/2 bg-gray-200 rounded" />
              <div className="h-3 w-1/3 bg-gray-200 rounded" />
              <div className="h-8 w-full bg-gray-100 rounded" />
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
        <div
          key={i}
          className="flex items-center gap-4 p-3 bg-white border border-gray-100 rounded-lg animate-pulse"
        >
          <div className="h-8 w-24 rounded bg-gray-200" />
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

/** Empty State — shown when zero VMI orders exist */
function VmiEmptyState({
  onPoll,
  loading,
  t,
}: {
  onPoll: () => void;
  loading: boolean;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="h-20 w-20 rounded-2xl bg-cyan-100 flex items-center justify-center mb-5">
        <PackageOpen className="h-10 w-10 text-cyan-600" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('vmiOrders.empty.title')}</h3>
      <p className="text-sm text-gray-500 max-w-sm mb-6">
        {t('vmiOrders.empty.description')}
      </p>
      <DxButton
        text={loading ? t('vmiOrders.polling') : t('vmiOrders.pollOrders')}
        icon={loading ? undefined : 'download'}
        type="success"
        disabled={loading}
        onClick={onPoll}
      >
        {loading && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
      </DxButton>
    </div>
  );
}

/** No Results State — shown when filter/search yields zero results */
function VmiNoResultsState({
  onClear,
  t,
}: {
  onClear: () => void;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
      <div className="h-16 w-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <SearchX className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">
        {t('vmiOrders.noResults.title')}
      </h3>
      <p className="text-sm text-gray-500 max-w-sm mb-4">
        {t('vmiOrders.noResults.description')}
      </p>
      <DxButton text={t('vmiOrders.noResults.clearFilters')} icon="clear" stylingMode="outlined" onClick={onClear} />
    </div>
  );
}
