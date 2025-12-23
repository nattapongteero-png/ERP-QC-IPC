'use client';

/**
 * VMI Orders Page - Redesigned Dashboard
 *
 * Page for managing orders received from VMI Portals.
 * Displays order list with KPI stats, charts, and multiple view modes.
 *
 * Feature: 008-vmi-vendor-sync
 */

import { useState, useMemo, useCallback } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { StatCard, ResponsivePageHeader } from '@/components/shared';
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

const STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    labelTh: 'รอดำเนินการ',
    color: '#f59e0b',
    bgClass: 'bg-amber-50 border-amber-200',
    textClass: 'text-amber-700',
    icon: Clock,
    badgeVariant: 'warning' as const,
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
    labelTh: 'กำลังจัดเตรียม',
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

const PRIORITY_CONFIG = {
  low: { label: 'Low', labelTh: 'ต่ำ', color: 'text-gray-500', bgClass: 'bg-gray-100' },
  normal: { label: 'Normal', labelTh: 'ปกติ', color: 'text-blue-600', bgClass: 'bg-blue-100' },
  high: { label: 'High', labelTh: 'สูง', color: 'text-orange-600', bgClass: 'bg-orange-100' },
  urgent: { label: 'Urgent', labelTh: 'เร่งด่วน', color: 'text-red-600 font-bold', bgClass: 'bg-red-100' },
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
  const days = Math.ceil((new Date(requestedDeliveryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
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
  return result.data?.items || [];
}

async function pollOrders(portalId?: number): Promise<{ summary: { totalNewOrders: number; portalsPolled: number } }> {
  const response = await fetch('/api/sales/vmi-orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ portalId }),
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
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  // Data fetching with React Query
  const { data: orders = [], isLoading, refetch } = useQuery<VmiOrder[]>({
    queryKey: ['vmi-orders'],
    queryFn: fetchVmiOrders,
    staleTime: 30 * 1000,
    refetchInterval: 60000,
  });

  // Poll mutation
  const pollMutation = useMutation({
    mutationFn: () => pollOrders(),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['vmi-orders'] });
      if (result.summary.totalNewOrders > 0) {
        console.log(`Received ${result.summary.totalNewOrders} new orders from ${result.summary.portalsPolled} portals`);
      }
    },
  });

  // Filter orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesSearch = !search ||
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
    const pending = orders.filter(o => o.status === 'pending').length;
    const confirmed = orders.filter(o => o.status === 'confirmed').length;
    const processing = orders.filter(o => o.status === 'processing').length;
    const shipped = orders.filter(o => o.status === 'shipped').length;
    const delivered = orders.filter(o => o.status === 'delivered').length;
    const cancelled = orders.filter(o => o.status === 'cancelled').length;
    const overdue = orders.filter(o => isOverdue(o.requestedDeliveryDate || '', o.status)).length;

    const activeOrders = orders.filter(o => !['delivered', 'cancelled'].includes(o.status));
    const pendingValue = activeOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const totalValue = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const deliveredValue = orders.filter(o => o.status === 'delivered').reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    const totalItems = orders.reduce((sum, o) => sum + (o.totalItems || 0), 0);
    const matchedItems = orders.reduce((sum, o) => sum + (o.matchedItems || 0), 0);
    const unmatchedItems = orders.reduce((sum, o) => sum + (o.unmatchedItems || 0), 0);
    const matchRate = totalItems > 0 ? Math.round((matchedItems / totalItems) * 100) : 0;

    const urgentOrders = orders.filter(o => o.priority === 'urgent' && !['delivered', 'cancelled'].includes(o.status)).length;
    const highPriorityOrders = orders.filter(o => o.priority === 'high' && !['delivered', 'cancelled'].includes(o.status)).length;

    const uniquePortals = new Set(orders.map(o => o.portalName)).size;
    const uniqueCustomers = new Set(orders.map(o => o.customerName)).size;
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
      highPriorityOrders,
      uniquePortals,
      uniqueCustomers,
      fulfillmentRate,
      activeCount: pending + confirmed + processing + shipped,
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

  // Chart data for priority distribution
  const priorityChartData = useMemo(() => {
    return Object.entries(PRIORITY_CONFIG)
      .map(([key, config]) => ({
        priority: config.labelTh,
        count: orders.filter(o => o.priority === key).length,
        color: key === 'urgent' ? '#ef4444' : key === 'high' ? '#f97316' : key === 'normal' ? '#3b82f6' : '#6b7280',
      }))
      .filter(item => item.count > 0);
  }, [orders]);

  // Portal statistics
  const portalStats = useMemo(() => {
    const portalMap = new Map<string, { count: number; value: number; pending: number }>();
    orders.forEach(o => {
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

  // Recent orders
  const recentOrders = useMemo(() => {
    return [...orders]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [orders]);

  // Urgent orders
  const urgentOrders = useMemo(() => {
    return orders
      .filter(o => {
        if (['delivered', 'cancelled'].includes(o.status)) return false;
        const days = getDaysUntilRequired(o.requestedDeliveryDate || '', o.status);
        return (days !== null && days <= 3) || o.priority === 'urgent' || o.priority === 'high';
      })
      .sort((a, b) => {
        // Sort by priority first, then by days remaining
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
      .filter(o => o.unmatchedItems > 0 && !['delivered', 'cancelled'].includes(o.status))
      .sort((a, b) => b.unmatchedItems - a.unmatchedItems)
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
  const renderOrderIdCell = useCallback((data: { data: VmiOrder }) => {
    const order = data.data;
    const overdue = isOverdue(order.requestedDeliveryDate || '', order.status);
    return (
      <div>
        <p className="font-mono font-semibold text-blue-600">{order.portalOrderId}</p>
        {overdue && (
          <Badge variant="danger" size="sm" className="mt-1">
            <AlertTriangle className="h-3 w-3 mr-1" />
            เกินกำหนด
          </Badge>
        )}
      </div>
    );
  }, []);

  const renderPortalCell = useCallback((data: { data: VmiOrder }) => {
    return (
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded bg-indigo-100 flex items-center justify-center">
          <Link2 className="h-3.5 w-3.5 text-indigo-600" />
        </div>
        <span className="truncate">{data.data.portalName || '-'}</span>
      </div>
    );
  }, []);

  const renderCustomerCell = useCallback((data: { data: VmiOrder }) => {
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

  const renderMatchStatusCell = useCallback((data: { data: VmiOrder }) => {
    const order = data.data;
    const allMatched = order.matchedItems === order.totalItems;
    return (
      <div className="flex items-center gap-2">
        <div className={cn(
          'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium',
          allMatched ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'
        )}>
          {allMatched ? (
            <CheckSquare className="h-3.5 w-3.5" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5" />
          )}
          <span>{order.matchedItems}/{order.totalItems}</span>
        </div>
      </div>
    );
  }, []);

  const renderPriorityCell = useCallback((data: { data: VmiOrder }) => {
    const config = PRIORITY_CONFIG[data.data.priority];
    return (
      <span className={cn('px-2 py-1 rounded text-xs font-medium', config.bgClass, config.color)}>
        {config.labelTh}
      </span>
    );
  }, []);

  const renderDateCell = useCallback((data: { data: VmiOrder }) => {
    return <span>{formatDate(data.data.orderDate)}</span>;
  }, []);

  const renderDeliveryDateCell = useCallback((data: { data: VmiOrder }) => {
    const order = data.data;
    const overdue = isOverdue(order.requestedDeliveryDate || '', order.status);
    const daysUntil = getDaysUntilRequired(order.requestedDeliveryDate || '', order.status);

    if (!order.requestedDeliveryDate) return <span className="text-gray-400">-</span>;

    return (
      <div>
        <span className={overdue ? 'text-red-600 font-medium' : ''}>
          {formatDate(order.requestedDeliveryDate)}
        </span>
        {daysUntil !== null && (
          <p className={`text-xs ${daysUntil < 0 ? 'text-red-500' : daysUntil <= 3 ? 'text-amber-500' : 'text-gray-500'}`}>
            {daysUntil < 0 ? `เกิน ${Math.abs(daysUntil)} วัน` : daysUntil === 0 ? 'วันนี้' : `อีก ${daysUntil} วัน`}
          </p>
        )}
      </div>
    );
  }, []);

  const renderAmountCell = useCallback((data: { data: VmiOrder }) => {
    return (
      <span className="font-semibold text-green-600">
        {formatCurrency(data.data.totalAmount)}
      </span>
    );
  }, []);

  const renderStatusCell = useCallback((data: { data: VmiOrder }) => {
    const config = STATUS_CONFIG[data.data.status as keyof typeof STATUS_CONFIG];
    if (!config) return <Badge>-</Badge>;
    return (
      <Badge variant={config.badgeVariant} dot>
        {config.labelTh}
      </Badge>
    );
  }, []);

  const renderActionsCell = useCallback((data: { data: VmiOrder }) => {
    const order = data.data;
    return (
      <div className="flex gap-1">
        <DxButton
          text="ดู"
          type="normal"
          stylingMode="text"
          onClick={(e) => {
            e.event?.stopPropagation();
            setSelectedOrderId(order.id);
          }}
        />
      </div>
    );
  }, []);

  // DataGrid columns
  const columns: DxDataGridColumn[] = useMemo(() => [
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
      width: 110,
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
      width: 100,
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
      width: 120,
      cellRender: renderStatusCell,
    },
    {
      caption: '',
      width: 80,
      cellRender: renderActionsCell,
    },
  ], [renderOrderIdCell, renderPortalCell, renderCustomerCell, renderDateCell, renderDeliveryDateCell, renderMatchStatusCell, renderPriorityCell, renderAmountCell, renderStatusCell, renderActionsCell]);

  // ============================================================================
  // Render Functions
  // ============================================================================

  const renderStatCards = () => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      <StatCard
        label="คำสั่งซื้อทั้งหมด"
        value={stats.total}
        icon={ShoppingCart}
        iconColor="text-indigo-500"
        accentColor="border-indigo-500"
        isLoading={isLoading}
      />
      <StatCard
        label="รอดำเนินการ"
        value={stats.pending}
        icon={Clock}
        iconColor="text-amber-500"
        accentColor="border-amber-500"
        trend={stats.pending > 0 ? { value: stats.pending, direction: 'neutral' } : undefined}
        isLoading={isLoading}
      />
      <StatCard
        label="รอจับคู่สินค้า"
        value={stats.unmatchedItems}
        icon={AlertCircle}
        iconColor="text-orange-500"
        accentColor="border-orange-500"
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

  const renderAlertBanners = () => {
    const alerts = [];

    if (stats.overdue > 0) {
      alerts.push(
        <Card key="overdue" className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-red-800">
                  {stats.overdue} คำสั่งซื้อเกินกำหนดส่ง
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
    }

    if (stats.unmatchedItems > 0) {
      alerts.push(
        <Card key="unmatched" className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <AlertCircle className="h-6 w-6 text-orange-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-orange-800">
                  {unmatchedOrders.length} คำสั่งซื้อมีสินค้ารอจับคู่
                </p>
                <p className="text-sm text-orange-600">
                  กรุณาจับคู่สินค้าก่อนยืนยันคำสั่งซื้อ
                </p>
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
              <div className="p-2 bg-purple-100 rounded-lg">
                <Zap className="h-6 w-6 text-purple-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-purple-800">
                  {stats.urgentOrders} คำสั่งซื้อเร่งด่วน
                </p>
                <p className="text-sm text-purple-600">
                  ต้องดำเนินการโดยเร็ว
                </p>
              </div>
              <DxButton
                text="ดูรายการ"
                type="normal"
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
      <CardContent className="py-3">
        <div className="flex flex-col md:flex-row gap-3 items-end">
          <div className="flex-1">
            <DxTextBox
              placeholder="ค้นหาด้วยรหัสคำสั่งซื้อ, โรงพยาบาล, หรือ Portal..."
              value={search}
              onValueChange={setSearch}
              showClearButton
              mode="search"
            />
          </div>
          <div className="w-full md:w-40">
            <DxSelectBox
              items={statusOptions}
              value={statusFilter}
              onValueChange={setStatusFilter}
              placeholder="สถานะ"
              showClearButton
            />
          </div>
          <div className="w-full md:w-40">
            <DxSelectBox
              items={priorityOptions}
              value={priorityFilter}
              onValueChange={setPriorityFilter}
              placeholder="ความสำคัญ"
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
              id="vmi-status-pie"
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

      {/* Priority Distribution */}
      <Card elevation="raised">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">
            การกระจายตามความสำคัญ
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {priorityChartData.length > 0 ? (
            <PieChart
              id="vmi-priority-pie"
              dataSource={priorityChartData}
              type="doughnut"
              palette={priorityChartData.map(d => d.color)}
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
    </div>
  );

  const renderOrderCard = (order: VmiOrder) => {
    const statusConfig = STATUS_CONFIG[order.status as keyof typeof STATUS_CONFIG];
    const priorityConfig = PRIORITY_CONFIG[order.priority];
    const overdue = isOverdue(order.requestedDeliveryDate || '', order.status);
    const daysUntil = getDaysUntilRequired(order.requestedDeliveryDate || '', order.status);
    const allMatched = order.matchedItems === order.totalItems;

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
              <div className="flex items-center gap-2">
                <p className="font-mono font-semibold text-blue-600">{order.portalOrderId}</p>
                {order.priority === 'urgent' && (
                  <Badge variant="danger" size="sm">เร่งด่วน</Badge>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-1">{order.portalName}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-green-600">
                {formatCurrency(order.totalAmount)}
              </p>
              {statusConfig && (
                <Badge variant={statusConfig.badgeVariant} size="sm" dot className="mt-1">
                  {statusConfig.labelTh}
                </Badge>
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
            <div className={cn(
              'flex items-center gap-1 px-2 py-1 rounded',
              allMatched ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'
            )}>
              {allMatched ? (
                <CheckSquare className="h-3.5 w-3.5" />
              ) : (
                <AlertCircle className="h-3.5 w-3.5" />
              )}
              <span>จับคู่ {order.matchedItems}/{order.totalItems}</span>
            </div>
            <span className={cn('px-2 py-1 rounded', priorityConfig.bgClass, priorityConfig.color)}>
              {priorityConfig.labelTh}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t">
            <div className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              <span>{formatDateShort(order.orderDate)}</span>
            </div>
            {order.requestedDeliveryDate && (
              <div className={`flex items-center gap-1 ${overdue ? 'text-red-600 font-medium' : ''}`}>
                <ArrowRight className="h-3.5 w-3.5" />
                <span>{formatDateShort(order.requestedDeliveryDate)}</span>
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
            exportFileName="vmi-orders"
            columnChooser
            virtualScrolling={filteredOrders.length > 100}
            fillHeight
            onRowClick={handleRowClick}
            noDataText="ไม่พบคำสั่งซื้อ VMI"
          />
        ) : (
          <EmptyState
            icon={<ShoppingCart className="h-8 w-8" />}
            title="ไม่พบคำสั่งซื้อ VMI"
            description="ลองดึงคำสั่งซื้อใหม่จาก VMI Portals"
            action={{
              label: 'Poll for Orders',
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

        {urgentOrders.length > 0 && (
          <Card elevation="raised">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-500" />
                ต้องดำเนินการเร่งด่วน
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {urgentOrders.map(renderOrderCard)}
              </div>
            </CardContent>
          </Card>
        )}

        {unmatchedOrders.length > 0 && (
          <Card elevation="raised">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-500" />
                รอจับคู่สินค้า
              </CardTitle>
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
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-blue-500" />
              คำสั่งซื้อทั้งหมด ({filteredOrders.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {filteredOrders.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredOrders.slice(0, 10).map(renderOrderCard)}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                ไม่พบคำสั่งซื้อที่ตรงกับเงื่อนไข
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
        {/* Portal Stats */}
        <Card elevation="raised">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              VMI Portals
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {portalStats.map((portal) => (
                <div
                  key={portal.name}
                  className="p-2 rounded-lg bg-gray-50"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate">{portal.name}</span>
                    <span className="text-xs text-gray-500">{portal.count} รายการ</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-green-600 font-semibold">{formatCurrencyShort(portal.value)}</p>
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
                      <p className="font-mono text-xs text-blue-600">{order.portalOrderId}</p>
                      <p className="text-xs font-semibold text-green-600">{formatCurrencyShort(order.totalAmount)}</p>
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
        <Card elevation="raised" className="bg-blue-50 border-blue-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-blue-900">วิธีการทำงาน</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-blue-800 space-y-2">
            <div className="flex gap-2">
              <span className="font-bold">1.</span>
              <span>Poll ดึงคำสั่งซื้อจาก Portals</span>
            </div>
            <div className="flex gap-2">
              <span className="font-bold">2.</span>
              <span>จับคู่สินค้า (Match)</span>
            </div>
            <div className="flex gap-2">
              <span className="font-bold">3.</span>
              <span>ยืนยันคำสั่งซื้อ (Confirm)</span>
            </div>
            <div className="flex gap-2">
              <span className="font-bold">4.</span>
              <span>จัดส่ง (Ship)</span>
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

      {/* Portal Analysis */}
      <Card elevation="raised">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-purple-500" />
            สถิติตาม Portal
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {portalStats.map((portal, idx) => (
              <Card key={portal.name} className="border">
                <CardContent className="p-4">
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
                      <p className="font-semibold text-green-600">{formatCurrencyShort(portal.value)}</p>
                    </div>
                  </div>
                  {portal.pending > 0 && (
                    <div className="mt-2 p-2 bg-amber-50 rounded text-xs text-amber-700">
                      {portal.pending} รอดำเนินการ
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {portalStats.length === 0 && (
              <div className="col-span-4 text-center py-8 text-gray-400">
                ไม่มีข้อมูล Portal
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Match Rate Analysis */}
      <Card elevation="raised">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-blue-500" />
            อัตราการจับคู่สินค้า
          </CardTitle>
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
          <ResponsivePageHeader
            title="รายละเอียดคำสั่งซื้อ VMI"
            subtitle="ดูและจัดการคำสั่งซื้อจาก VMI Portal"
            actions={
              <DxButton
                icon="arrowleft"
                text="กลับ"
                type="normal"
                onClick={() => setSelectedOrderId(null)}
              />
            }
          />
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
        <ResponsivePageHeader
          title="คำสั่งซื้อ VMI"
          subtitle="จัดการคำสั่งซื้อจาก VMI Portals"
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
              />
              <DxButton
                text={pollMutation.isPending ? 'กำลังดึง...' : 'Poll Orders'}
                icon={pollMutation.isPending ? undefined : 'download'}
                type="success"
                onClick={() => pollMutation.mutate()}
                disabled={pollMutation.isPending}
              >
                {pollMutation.isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
              </DxButton>
            </div>
          }
        />

        {/* KPI Stats */}
        {renderStatCards()}

        {/* Alert Banners */}
        {renderAlertBanners()}

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
