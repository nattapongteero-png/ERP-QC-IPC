'use client';

/**
 * VMI Orders Page - Professional Dashboard
 *
 * Page for managing orders received from VMI Portals.
 * Displays order list with KPI stats, charts, and multiple view modes.
 *
 * Feature: 008-vmi-vendor-sync
 */

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { VmiOrderDetail } from '@/components/vmi';
import { cn } from '@/lib/utils/cn';
import {
  ShoppingCart,
  Package,
  Truck,
  CheckCircle2,
  Clock,
  XCircle,
  BarChart3,
  LayoutGrid,
  List,
  DollarSign,
  TrendingUp,
  Calendar,
  ArrowRight,
  AlertTriangle,
  RefreshCw,
  Link2,
  CheckSquare,
  AlertCircle,
  Zap,
  Search,
  Filter,
  Download,
  ExternalLink,
  Activity,
  ArrowLeft,
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
    label: string;
    labelTh: string;
    color: string;
    bgColor: string;
    borderColor: string;
    icon: typeof Clock;
    badgeVariant: 'warning' | 'info' | 'success' | 'danger';
  }
> = {
  pending: {
    label: 'Pending',
    labelTh: 'รอดำเนินการ',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-500',
    icon: Clock,
    badgeVariant: 'warning',
  },
  confirmed: {
    label: 'Confirmed',
    labelTh: 'ยืนยันแล้ว',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-500',
    icon: CheckCircle2,
    badgeVariant: 'info',
  },
  processing: {
    label: 'Processing',
    labelTh: 'กำลังจัดเตรียม',
    color: 'text-violet-600',
    bgColor: 'bg-violet-50',
    borderColor: 'border-violet-500',
    icon: Package,
    badgeVariant: 'info',
  },
  shipped: {
    label: 'Shipped',
    labelTh: 'จัดส่งแล้ว',
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50',
    borderColor: 'border-cyan-500',
    icon: Truck,
    badgeVariant: 'info',
  },
  delivered: {
    label: 'Delivered',
    labelTh: 'ส่งมอบแล้ว',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-500',
    icon: CheckCircle2,
    badgeVariant: 'success',
  },
  cancelled: {
    label: 'Cancelled',
    labelTh: 'ยกเลิก',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-500',
    icon: XCircle,
    badgeVariant: 'danger',
  },
};

const PRIORITY_CONFIG: Record<
  string,
  { label: string; labelTh: string; color: string; bgColor: string }
> = {
  low: { label: 'Low', labelTh: 'ต่ำ', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  normal: { label: 'Normal', labelTh: 'ปกติ', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  high: { label: 'High', labelTh: 'สูง', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  urgent: { label: 'Urgent', labelTh: 'เร่งด่วน', color: 'text-red-600', bgColor: 'bg-red-100' },
};

const statusOptions = [
  { value: '', label: 'ทุกสถานะ' },
  { value: 'pending', label: 'รอดำเนินการ' },
  { value: 'confirmed', label: 'ยืนยันแล้ว' },
  { value: 'processing', label: 'กำลังจัดเตรียม' },
  { value: 'shipped', label: 'จัดส่งแล้ว' },
  { value: 'delivered', label: 'ส่งมอบแล้ว' },
  { value: 'cancelled', label: 'ยกเลิก' },
];

const priorityOptions = [
  { value: '', label: 'ทุกความสำคัญ' },
  { value: 'low', label: 'ต่ำ' },
  { value: 'normal', label: 'ปกติ' },
  { value: 'high', label: 'สูง' },
  { value: 'urgent', label: 'เร่งด่วน' },
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
    });
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

  // Chart data
  const statusChartData = useMemo(() => {
    return Object.entries(STATUS_CONFIG)
      .map(([key, config]) => ({
        status: config.labelTh,
        count: orders.filter((o) => o.status === key).length,
        color:
          key === 'pending'
            ? '#f59e0b'
            : key === 'confirmed'
              ? '#3b82f6'
              : key === 'processing'
                ? '#8b5cf6'
                : key === 'shipped'
                  ? '#06b6d4'
                  : key === 'delivered'
                    ? '#22c55e'
                    : '#ef4444',
      }))
      .filter((item) => item.count > 0);
  }, [orders]);

  const priorityChartData = useMemo(() => {
    return Object.entries(PRIORITY_CONFIG)
      .map(([key, config]) => ({
        priority: config.labelTh,
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
  }, [orders]);

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

  // Navigation handler
  const handleRowClick = useCallback((e: DataGridTypes.RowClickEvent) => {
    if (e.data?.id) {
      setSelectedOrderId(e.data.id);
    }
  }, []);

  const handleOrderClick = useCallback((id: number) => {
    setSelectedOrderId(id);
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
            เกินกำหนด
          </div>
        )}
      </div>
    );
  }, []);

  const renderPortalCell = useCallback((data: { data?: VmiOrder }) => {
    if (!data.data) return null;
    return (
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded bg-indigo-100 flex items-center justify-center">
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
        {config.labelTh}
      </span>
    );
  }, []);

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
              ? `เกิน ${Math.abs(daysUntil)} วัน`
              : daysUntil === 0
                ? 'วันนี้'
                : `อีก ${daysUntil} วัน`}
          </p>
        )}
      </div>
    );
  }, []);

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
        {config.labelTh}
      </div>
    );
  }, []);

  const renderActionsCell = useCallback((data: { data?: VmiOrder }) => {
    if (!data.data) return null;
    return (
      <DxButton
        icon="chevronnext"
        type="normal"
        stylingMode="text"
        hint="ดูรายละเอียด"
        onClick={(e) => {
          e.event?.stopPropagation();
          setSelectedOrderId(data.data!.id);
        }}
      />
    );
  }, []);

  // DataGrid columns
  const columns: DxDataGridColumn[] = useMemo(
    () => [
      {
        dataField: 'portalOrderId',
        caption: 'รหัสคำสั่งซื้อ',
        width: 150,
        cellRender: renderOrderIdCell,
      },
      {
        dataField: 'portalName',
        caption: 'Portal',
        width: 140,
        cellRender: renderPortalCell,
      },
      {
        dataField: 'customerName',
        caption: 'โรงพยาบาล/ลูกค้า',
        minWidth: 160,
        cellRender: renderCustomerCell,
      },
      {
        dataField: 'orderDate',
        caption: 'วันที่สั่ง',
        width: 120,
        dataType: 'date',
        cellRender: renderDateCell,
      },
      {
        dataField: 'requestedDeliveryDate',
        caption: 'กำหนดส่ง',
        width: 130,
        cellRender: renderDeliveryDateCell,
      },
      {
        dataField: 'matchedItems',
        caption: 'จับคู่สินค้า',
        width: 120,
        cellRender: renderMatchStatusCell,
      },
      {
        dataField: 'priority',
        caption: 'ความสำคัญ',
        width: 100,
        cellRender: renderPriorityCell,
      },
      {
        dataField: 'totalAmount',
        caption: 'มูลค่า',
        width: 120,
        dataType: 'number',
        cellRender: renderAmountCell,
      },
      {
        dataField: 'status',
        caption: 'สถานะ',
        width: 140,
        cellRender: renderStatusCell,
      },
      {
        caption: '',
        width: 60,
        cellRender: renderActionsCell,
      },
    ],
    [
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

  // Render order card
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
              style={{
                backgroundColor:
                  order.status === 'pending'
                    ? '#f59e0b'
                    : order.status === 'confirmed'
                      ? '#3b82f6'
                      : order.status === 'processing'
                        ? '#8b5cf6'
                        : order.status === 'shipped'
                          ? '#06b6d4'
                          : order.status === 'delivered'
                            ? '#22c55e'
                            : '#ef4444',
              }}
            />
            <div className="flex-1 p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-mono font-semibold text-blue-600">{order.portalOrderId}</p>
                    {order.priority === 'urgent' && (
                      <span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded font-medium">
                        เร่งด่วน
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{order.portalName}</p>
                </div>
                <div className="text-right">
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
                      {statusConfig.labelTh}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-2 bg-gray-50 rounded-lg mb-3">
                <p className="font-medium text-sm">{order.customerName || '-'}</p>
                {order.hospitalCode && (
                  <p className="text-xs text-gray-500">{order.hospitalCode}</p>
                )}
              </div>

              <div className="flex items-center justify-between text-xs mb-2">
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
                    จับคู่ {order.matchedItems}/{order.totalItems}
                  </span>
                </div>
                <span className={cn('px-2 py-1 rounded', priorityConfig.bgColor, priorityConfig.color)}>
                  {priorityConfig.labelTh}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t">
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

  // ============================================================================
  // Render Functions
  // ============================================================================

  const renderHeader = () => (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 p-6 text-white">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
        <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-white/10" />
        <div className="absolute right-1/4 top-1/2 h-24 w-24 rounded-full bg-white/5" />
      </div>

      <div className="relative">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-teal-100 mb-4">
          <Link href="/sales" className="hover:text-white transition-colors">
            การขาย
          </Link>
          <span>/</span>
          <span className="text-white">คำสั่งซื้อ VMI</span>
        </nav>

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold mb-1">คำสั่งซื้อ VMI</h1>
            <p className="text-teal-100">จัดการคำสั่งซื้อจาก VMI Portals</p>
          </div>

          {/* Quick Stats in Header */}
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-teal-200">ทั้งหมด</div>
            </div>
            <div className="w-px h-10 bg-white/20" />
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-300">{stats.pending}</div>
              <div className="text-xs text-teal-200">รอดำเนินการ</div>
            </div>
            <div className="w-px h-10 bg-white/20" />
            <div className="text-center">
              <div className="text-2xl font-bold text-green-300">{stats.delivered}</div>
              <div className="text-xs text-teal-200">ส่งมอบแล้ว</div>
            </div>
            <div className="w-px h-10 bg-white/20" />
            <div className="text-center">
              <div className="text-2xl font-bold">{formatCurrencyShort(stats.pendingValue)}</div>
              <div className="text-xs text-teal-200">มูลค่ารอดำเนินการ</div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 mt-4">
          {/* View Mode Toggle */}
          <div className="hidden md:flex items-center bg-white/10 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'p-2 rounded transition-colors',
                viewMode === 'grid' ? 'bg-white/20' : 'hover:bg-white/10'
              )}
              title="Grid View"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={cn(
                'p-2 rounded transition-colors',
                viewMode === 'cards' ? 'bg-white/20' : 'hover:bg-white/10'
              )}
              title="Cards View"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('analytics')}
              className={cn(
                'p-2 rounded transition-colors',
                viewMode === 'analytics' ? 'bg-white/20' : 'hover:bg-white/10'
              )}
              title="Analytics View"
            >
              <BarChart3 className="h-4 w-4" />
            </button>
          </div>

          <DxButton
            icon="refresh"
            text="รีเฟรช"
            type="normal"
            stylingMode="text"
            onClick={() => refetch()}
            className="!text-white hover:!bg-white/10"
          />
          <DxButton
            text={pollMutation.isPending ? 'กำลังดึง...' : 'Poll Orders'}
            icon={pollMutation.isPending ? undefined : 'download'}
            type="default"
            stylingMode="contained"
            onClick={() => pollMutation.mutate()}
            disabled={pollMutation.isPending}
            className="!bg-white/20 hover:!bg-white/30 !border-white/30"
          >
            {pollMutation.isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
          </DxButton>
        </div>
      </div>
    </div>
  );

  const renderStatusCards = () => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {[
        { key: 'total', label: 'ทั้งหมด', value: stats.total, color: 'indigo', icon: ShoppingCart },
        { key: 'pending', label: 'รอดำเนินการ', value: stats.pending, color: 'amber', icon: Clock },
        { key: 'unmatched', label: 'รอจับคู่', value: stats.unmatchedItems, color: 'orange', icon: AlertCircle },
        { key: 'delivered', label: 'ส่งมอบแล้ว', value: stats.delivered, color: 'green', icon: CheckCircle2 },
        { key: 'overdue', label: 'เกินกำหนด', value: stats.overdue, color: 'red', icon: AlertTriangle },
        { key: 'value', label: 'มูลค่ารอดำเนินการ', value: formatCurrencyShort(stats.pendingValue), color: 'emerald', icon: DollarSign },
      ].map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.key} elevation="raised" className="overflow-hidden">
            <CardContent className="p-0">
              <div className="flex items-stretch">
                <div className={`w-1 bg-${item.color}-500`} />
                <div className="flex-1 p-3">
                  <div className="flex items-center gap-2">
                    <div className={`h-9 w-9 bg-${item.color}-100 rounded-lg flex items-center justify-center`}>
                      <Icon className={`h-5 w-5 text-${item.color}-600`} />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">{item.label}</p>
                      <p className="text-lg font-bold text-gray-900">{item.value}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  const renderAlerts = () => {
    const alerts = [];

    if (stats.overdue > 0) {
      alerts.push(
        <Card key="overdue" className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-red-800">{stats.overdue} คำสั่งซื้อเกินกำหนดส่ง</p>
                <p className="text-sm text-red-600">กรุณาตรวจสอบและดำเนินการโดยเร็ว</p>
              </div>
              <DxButton
                text="ดูรายการ"
                type="danger"
                stylingMode="outlined"
                onClick={() => {
                  setStatusFilter('');
                  setSearch('');
                }}
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
              <div className="p-2.5 rounded-xl bg-orange-100">
                <AlertCircle className="h-5 w-5 text-orange-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-orange-800">
                  {unmatchedOrders.length} คำสั่งซื้อมีสินค้ารอจับคู่
                </p>
                <p className="text-sm text-orange-600">กรุณาจับคู่สินค้าก่อนยืนยันคำสั่งซื้อ</p>
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
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-100">
                <Zap className="h-5 w-5 text-purple-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-purple-800">{stats.urgentOrders} คำสั่งซื้อเร่งด่วน</p>
                <p className="text-sm text-purple-600">ต้องดำเนินการโดยเร็ว</p>
              </div>
              <DxButton
                text="ดูรายการ"
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

    return alerts.length > 0 ? <div className="space-y-3">{alerts}</div> : null;
  };

  const renderFilters = () => (
    <Card elevation="raised">
      <CardContent className="p-4">
        <div className="flex flex-col md:flex-row gap-3 items-end">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <Search className="h-4 w-4 text-gray-400" />
              <label className="text-sm font-medium text-gray-700">ค้นหา</label>
            </div>
            <DxTextBox
              placeholder="ค้นหาด้วยรหัสคำสั่งซื้อ, โรงพยาบาล, หรือ Portal..."
              value={search}
              onValueChange={setSearch}
              showClearButton
              mode="search"
            />
          </div>
          <div className="w-full md:w-44">
            <div className="flex items-center gap-2 mb-1.5">
              <Filter className="h-4 w-4 text-gray-400" />
              <label className="text-sm font-medium text-gray-700">สถานะ</label>
            </div>
            <DxSelectBox
              items={statusOptions}
              value={statusFilter}
              onValueChange={setStatusFilter}
              placeholder="ทุกสถานะ"
              showClearButton
            />
          </div>
          <div className="w-full md:w-44">
            <div className="flex items-center gap-2 mb-1.5">
              <Zap className="h-4 w-4 text-gray-400" />
              <label className="text-sm font-medium text-gray-700">ความสำคัญ</label>
            </div>
            <DxSelectBox
              items={priorityOptions}
              value={priorityFilter}
              onValueChange={setPriorityFilter}
              placeholder="ทุกความสำคัญ"
              showClearButton
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderCharts = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card elevation="raised">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-indigo-100">
              <BarChart3 className="h-4 w-4 text-indigo-600" />
            </div>
            <CardTitle className="text-sm font-medium">การกระจายตามสถานะ</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {statusChartData.length > 0 ? (
            <PieChart
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
                  text: `${arg.argumentText}: ${arg.valueText} รายการ`,
                })}
              />
            </PieChart>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-gray-400">
              ไม่มีข้อมูล
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
            <CardTitle className="text-sm font-medium">การกระจายตามความสำคัญ</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {priorityChartData.length > 0 ? (
            <PieChart
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
                  text: `${arg.argumentText}: ${arg.valueText} รายการ`,
                })}
              />
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
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-teal-100">
              <ShoppingCart className="h-5 w-5 text-teal-600" />
            </div>
            <div>
              <CardTitle>รายการคำสั่งซื้อ</CardTitle>
              <p className="text-sm text-gray-500">
                แสดง {filteredOrders.length} จาก {orders.length} รายการ
              </p>
            </div>
          </div>
        </div>
      </CardHeader>
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
            exportFileName="vmi-orders"
            columnChooser
            virtualScrolling={filteredOrders.length > 100}
            fillHeight
            onRowClick={handleRowClick}
            noDataText={t('vmiOrders.noData')}
          />
        ) : (
          <EmptyState
            icon={<ShoppingCart className="h-8 w-8" />}
            title={t('vmiOrders.noData')}
            description={t('vmiOrders.pollDescription')}
            action={{
              label: t('vmiOrders.pollOrders'),
              onClick: () => pollMutation.mutate(),
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

        {urgentOrdersList.length > 0 && (
          <Card elevation="raised">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-amber-100">
                  <Zap className="h-5 w-5 text-amber-600" />
                </div>
                <CardTitle>ต้องดำเนินการเร่งด่วน</CardTitle>
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
                <CardTitle>รอจับคู่สินค้า</CardTitle>
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
              <div className="p-2 rounded-lg bg-teal-100">
                <ShoppingCart className="h-5 w-5 text-teal-600" />
              </div>
              <CardTitle>คำสั่งซื้อทั้งหมด ({filteredOrders.length})</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {filteredOrders.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredOrders.slice(0, 10).map(renderOrderCard)}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">ไม่พบคำสั่งซื้อที่ตรงกับเงื่อนไข</div>
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
        {/* Portal Stats */}
        <Card elevation="raised">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded bg-indigo-100">
                <Link2 className="h-4 w-4 text-indigo-600" />
              </div>
              <CardTitle className="text-sm">VMI Portals</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {portalStats.map((portal) => (
                <div key={portal.name} className="p-2 rounded-lg bg-gray-50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate">{portal.name}</span>
                    <span className="text-xs text-gray-500">{portal.count} รายการ</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-green-600 font-semibold">
                      {formatCurrencyShort(portal.value)}
                    </p>
                    {portal.pending > 0 && (
                      <span className="text-xs text-amber-600">{portal.pending} รอดำเนินการ</span>
                    )}
                  </div>
                </div>
              ))}
              {portalStats.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">ไม่มีข้อมูล</p>
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
              <CardTitle className="text-sm">สรุปรวม</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm text-gray-500">มูลค่ารวม</span>
              <span className="font-semibold text-green-600">
                {formatCurrencyShort(stats.totalValue)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm text-gray-500">ส่งมอบแล้ว</span>
              <span className="font-semibold text-green-600">
                {formatCurrencyShort(stats.deliveredValue)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm text-gray-500">อัตราจับคู่</span>
              <span className="font-semibold text-blue-600">{stats.matchRate}%</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-gray-500">อัตราส่งมอบ</span>
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
              <CardTitle className="text-sm">ล่าสุด</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {recentOrders.map((order) => {
                const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                return (
                  <div
                    key={order.id}
                    className="p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors border-l-2"
                    style={{
                      borderLeftColor:
                        order.status === 'pending'
                          ? '#f59e0b'
                          : order.status === 'confirmed'
                            ? '#3b82f6'
                            : order.status === 'delivered'
                              ? '#22c55e'
                              : '#9ca3af',
                    }}
                    onClick={() => handleOrderClick(order.id)}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-mono text-xs text-blue-600">{order.portalOrderId}</p>
                      <p className="text-xs font-semibold text-green-600">
                        {formatCurrencyShort(order.totalAmount)}
                      </p>
                    </div>
                    <p className="text-sm truncate">{order.customerName || order.portalName}</p>
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

        {/* Workflow Help */}
        <Card className="border-teal-100 bg-gradient-to-br from-teal-50 to-cyan-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-teal-900">วิธีการทำงาน</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-teal-800 space-y-2">
            <div className="flex gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-teal-200 flex items-center justify-center font-bold text-teal-700">
                1
              </span>
              <span>Poll ดึงคำสั่งซื้อจาก Portals</span>
            </div>
            <div className="flex gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-teal-200 flex items-center justify-center font-bold text-teal-700">
                2
              </span>
              <span>จับคู่สินค้า (Match)</span>
            </div>
            <div className="flex gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-teal-200 flex items-center justify-center font-bold text-teal-700">
                3
              </span>
              <span>ยืนยันคำสั่งซื้อ (Confirm)</span>
            </div>
            <div className="flex gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-teal-200 flex items-center justify-center font-bold text-teal-700">
                4
              </span>
              <span>จัดส่ง (Ship)</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderAnalyticsView = () => (
    <div className="space-y-4 flex-1">
      {renderCharts()}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Status Breakdown */}
        <Card elevation="raised">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-indigo-100">
                <BarChart3 className="h-5 w-5 text-indigo-600" />
              </div>
              <CardTitle>สรุปตามสถานะ</CardTitle>
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
                        <span className="text-sm font-medium">{config.labelTh}</span>
                        <span className="text-sm text-gray-500">
                          {count} ({percentage.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor:
                              key === 'pending'
                                ? '#f59e0b'
                                : key === 'confirmed'
                                  ? '#3b82f6'
                                  : key === 'processing'
                                    ? '#8b5cf6'
                                    : key === 'shipped'
                                      ? '#06b6d4'
                                      : key === 'delivered'
                                        ? '#22c55e'
                                        : '#ef4444',
                          }}
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
              <CardTitle>สรุปมูลค่า</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-4">
              <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                <p className="text-sm text-gray-600">มูลค่ารวมทั้งหมด</p>
                <p className="text-3xl font-bold text-green-600">
                  {formatCurrency(stats.totalValue)}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-xs text-gray-500">รอดำเนินการ</p>
                  <p className="text-lg font-bold text-blue-600">
                    {formatCurrencyShort(stats.pendingValue)}
                  </p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-xs text-gray-500">ส่งมอบแล้ว</p>
                  <p className="text-lg font-bold text-green-600">
                    {formatCurrencyShort(stats.deliveredValue)}
                  </p>
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

      {/* Portal Analysis */}
      <Card elevation="raised">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-purple-100">
              <Link2 className="h-5 w-5 text-purple-600" />
            </div>
            <CardTitle>สถิติตาม Portal</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {portalStats.map((portal, idx) => (
              <Card key={portal.name} className="border overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex items-stretch">
                    <div className="w-1 bg-indigo-500" />
                    <div className="flex-1 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                          {idx + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{portal.name}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2 bg-gray-50 rounded">
                          <span className="text-gray-500">คำสั่งซื้อ</span>
                          <p className="font-semibold">{portal.count} รายการ</p>
                        </div>
                        <div className="p-2 bg-gray-50 rounded">
                          <span className="text-gray-500">มูลค่า</span>
                          <p className="font-semibold text-green-600">
                            {formatCurrencyShort(portal.value)}
                          </p>
                        </div>
                      </div>
                      {portal.pending > 0 && (
                        <div className="mt-2 p-2 bg-amber-50 rounded text-xs text-amber-700">
                          {portal.pending} รอดำเนินการ
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {portalStats.length === 0 && (
              <div className="col-span-4 text-center py-8 text-gray-400">ไม่มีข้อมูล Portal</div>
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
            <CardTitle>อัตราการจับคู่สินค้า</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 text-center">
              <p className="text-4xl font-bold text-blue-600">{stats.matchRate}%</p>
              <p className="text-sm text-gray-600 mt-1">อัตราการจับคู่</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg border border-green-200 text-center">
              <p className="text-4xl font-bold text-green-600">{stats.matchedItems}</p>
              <p className="text-sm text-gray-600 mt-1">สินค้าจับคู่แล้ว</p>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg border border-orange-200 text-center">
              <p className="text-4xl font-bold text-orange-600">{stats.unmatchedItems}</p>
              <p className="text-sm text-gray-600 mt-1">รอจับคู่</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ============================================================================
  // Main Render
  // ============================================================================

  // Show detail view if order is selected
  if (selectedOrderId) {
    return (
      <MainLayout>
        <div className="space-y-6">
          {/* Back Header */}
          <div className="flex items-center gap-4">
            <DxButton
              icon="arrowleft"
              type="normal"
              stylingMode="outlined"
              onClick={() => setSelectedOrderId(null)}
            />
            <div>
              <h1 className="text-xl font-bold text-gray-900">รายละเอียดคำสั่งซื้อ VMI</h1>
              <p className="text-sm text-gray-500">ดูและจัดการคำสั่งซื้อจาก VMI Portal</p>
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
      <div className="flex flex-col h-full gap-4 max-w-[1800px] mx-auto w-full">
        {renderHeader()}
        {renderStatusCards()}
        {renderAlerts()}
        {renderFilters()}

        {/* Content based on view mode */}
        {viewMode === 'grid' && renderGridView()}
        {viewMode === 'cards' && renderCardsView()}
        {viewMode === 'analytics' && renderAnalyticsView()}
      </div>
    </MainLayout>
  );
}
