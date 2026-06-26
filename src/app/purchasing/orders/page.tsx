'use client';

/**
 * Purchase Orders List Page
 *
 * Responsive purchase order management dashboard.
 * Follows gold-standard patterns: ResponsivePageHeader, StatCard KPI row,
 * mobile card view, empty/no-results states, loading skeletons,
 * scroll-snap status tabs, fullScreenOnMobile modal.
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { formatBaht } from '@/lib/utils/number-format';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxPopup } from '@/components/ui/dx-popup';
import { Badge } from '@/components/ui/badge';
import { ResponsivePageHeader, StatCard, DateRangeFilter } from '@/components/shared';
import { useMobile } from '@/hooks/use-mobile';
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
  AlertCircle,
  Truck,
  Calendar,
  Pencil,
  Trash2,
  Eye,
  SearchX,
  Building2,
  Banknote,
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
  translationKey: string;
  bgColor: string;
  textColor: string;
  activeBg: string;
  icon: React.ReactNode;
  badgeVariant: 'success' | 'warning' | 'danger' | 'info' | 'default' | 'primary' | 'secondary';
}> = {
  '': {
    translationKey: 'all',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-700',
    activeBg: 'bg-gray-900 text-white',
    icon: <ShoppingCart className="h-4 w-4" />,
    badgeVariant: 'default',
  },
  draft: {
    translationKey: 'draft',
    bgColor: 'bg-slate-100',
    textColor: 'text-slate-700',
    activeBg: 'bg-slate-600 text-white',
    icon: <FileText className="h-4 w-4" />,
    badgeVariant: 'default',
  },
  pending_approval: {
    translationKey: 'pendingApproval',
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-700',
    activeBg: 'bg-yellow-500 text-white',
    icon: <Clock className="h-4 w-4" />,
    badgeVariant: 'warning',
  },
  approved: {
    translationKey: 'approved',
    bgColor: 'bg-green-100',
    textColor: 'text-green-700',
    activeBg: 'bg-green-600 text-white',
    icon: <CheckCircle className="h-4 w-4" />,
    badgeVariant: 'success',
  },
  sent: {
    translationKey: 'sent',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-700',
    activeBg: 'bg-blue-600 text-white',
    icon: <Send className="h-4 w-4" />,
    badgeVariant: 'info',
  },
  partial: {
    translationKey: 'partial',
    bgColor: 'bg-purple-100',
    textColor: 'text-purple-700',
    activeBg: 'bg-purple-600 text-white',
    icon: <Package className="h-4 w-4" />,
    badgeVariant: 'primary',
  },
  received: {
    translationKey: 'received',
    bgColor: 'bg-emerald-100',
    textColor: 'text-emerald-700',
    activeBg: 'bg-emerald-600 text-white',
    icon: <PackageCheck className="h-4 w-4" />,
    badgeVariant: 'success',
  },
  cancelled: {
    translationKey: 'cancelled',
    bgColor: 'bg-red-100',
    textColor: 'text-red-700',
    activeBg: 'bg-red-600 text-white',
    icon: <XCircle className="h-4 w-4" />,
    badgeVariant: 'danger',
  },
};

const STATUS_ORDER: POStatusFilter[] = ['', 'draft', 'pending_approval', 'approved', 'sent', 'partial', 'received', 'cancelled'];

// Helper function to normalize status for comparison
const normalizeStatus = (status: string) => status?.toLowerCase() || '';

// Normalize a DB date value to a YYYY-MM-DD string (local) for range comparison.
const toDateKey = (dateStr: string | Date | null | undefined): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('th-TH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatCurrency = (amount: number, currency: string = 'THB') => {
  if (currency && currency !== 'THB') {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  }
  return formatBaht(amount);
};

// next-intl translator type (compatible superset for helper components)
type TranslateFn = (key: string, values?: Record<string, string | number | Date>) => string;

// Valid status values that can pre-filter the grid via ?status= in the URL
// (e.g. dashboard "Pending POs" → /purchasing/orders?status=draft).
const PO_STATUS_VALUES: POStatusFilter[] = ['', 'draft', 'pending_approval', 'approved', 'sent', 'partial', 'received', 'cancelled'];

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('purchasing');
  const tCommon = useTranslations('common');
  const { isMobile } = useMobile();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  // Seed the status tab from the URL so deep-links (dashboard cards) land on
  // the matching filtered view instead of the unfiltered "all" list.
  const initialStatus = (() => {
    const s = (searchParams.get('status') || '').toLowerCase() as POStatusFilter;
    return PO_STATUS_VALUES.includes(s) ? s : '';
  })();
  const [statusFilter, setStatusFilter] = useState<POStatusFilter>(initialStatus);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<PurchaseOrder | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  const handleDeletePO = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/purchasing/orders/${deleteTarget.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setDeleteTarget(null);
        fetchOrders();
      } else {
        alert(data.error || 'Failed to delete PO');
      }
    } catch {
      alert('Failed to delete PO');
    } finally {
      setDeleting(false);
    }
  };

  const handleClearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setDateFrom('');
    setDateTo('');
  };

  // Client-side filtering
  const filteredOrders = useMemo(() => {
    const filtered = orders.filter((order) => {
      const matchesStatus = !statusFilter || normalizeStatus(order.status) === statusFilter;
      const matchesSearch =
        !search ||
        order.poNumber?.toLowerCase().includes(search.toLowerCase()) ||
        order.vendorName?.toLowerCase().includes(search.toLowerCase());
      const orderKey = toDateKey(order.orderDate);
      const matchesDate =
        (!dateFrom || (!!orderKey && orderKey >= dateFrom)) &&
        (!dateTo || (!!orderKey && orderKey <= dateTo));
      return matchesStatus && matchesSearch && matchesDate;
    });
    return filtered.map((item, index) => ({ ...item, _rowNumber: index + 1 }));
  }, [orders, statusFilter, search, dateFrom, dateTo]);

  // Calculate counts for each status
  const statusCounts = useMemo(() => STATUS_ORDER.reduce((acc, status) => {
    if (status === '') {
      acc[status] = orders.length;
    } else {
      acc[status] = orders.filter((o) => normalizeStatus(o.status) === status).length;
    }
    return acc;
  }, {} as Record<POStatusFilter, number>), [orders]);

  // Calculate KPI stats: Total / Open / Received / Closed
  const stats = useMemo(() => {
    const total = orders.length;
    // "Open" = actively in-flight (draft, pending approval, approved, sent, partial)
    const open = orders.filter((o) =>
      ['draft', 'pending_approval', 'approved', 'sent', 'partial'].includes(normalizeStatus(o.status))
    ).length;
    const received = orders.filter((o) => normalizeStatus(o.status) === 'received').length;
    const closed = orders.filter((o) =>
      ['received', 'cancelled'].includes(normalizeStatus(o.status))
    ).length;
    return { total, open, received, closed };
  }, [orders]);

  const handleRowClick = (e: DataGridTypes.RowClickEvent) => {
    if (e.data?.id) {
      router.push(`/purchasing/orders/${e.data.id}`);
    }
  };

  const handleView = useCallback((order: PurchaseOrder) => {
    router.push(`/purchasing/orders/${order.id}`);
  }, [router]);

  const handleEdit = useCallback((order: PurchaseOrder) => {
    router.push(`/purchasing/orders/${order.id}`);
  }, [router]);

  const handleDeleteClick = useCallback((order: PurchaseOrder) => {
    setDeleteTarget(order);
  }, []);

  // Define columns for DevExtreme DataGrid
  const columns: DxDataGridColumn[] = useMemo(() => [
    {
      dataField: '_rowNumber',
      caption: t('items.grid.columns.rowNum'),
      width: 60,
      alignment: 'center',
      allowFiltering: false,
      allowSorting: false,
      cellRender: (cellInfo) => (
        <span className="text-gray-500 text-sm font-medium">
          {(cellInfo.data as { _rowNumber?: number })._rowNumber}
        </span>
      ),
    },
    {
      dataField: 'poNumber',
      caption: t('orders.grid.columns.poNumber'),
      width: 160,
      cellRender: (cellInfo) => {
        const status = normalizeStatus(cellInfo.data.status) as POStatusFilter;
        const config = STATUS_CONFIG[status] || STATUS_CONFIG[''];
        return (
          <div className="flex items-center gap-2">
            <div className={cn('p-1.5 rounded', config.bgColor)}>
              <span className={config.textColor}>{config.icon}</span>
            </div>
            <span className="font-mono font-semibold text-gray-900">{cellInfo.data.poNumber}</span>
          </div>
        );
      },
    },
    {
      dataField: 'vendorName',
      caption: t('orders.grid.columns.vendor'),
      minWidth: 200,
      cellRender: (cellInfo) => (
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-medium text-xs flex-shrink-0">
            {cellInfo.data.vendorName?.charAt(0)?.toUpperCase() || 'V'}
          </div>
          <span className="font-medium text-gray-800 truncate">{cellInfo.data.vendorName || '-'}</span>
        </div>
      ),
    },
    {
      dataField: 'orderDate',
      caption: t('orders.grid.columns.orderDate'),
      width: 130,
      dataType: 'date',
      hideOnMobile: true,
      hideOnTablet: true,
      cellRender: (cellInfo) => (
        <span className="text-gray-600 text-sm">{formatDate(cellInfo.data.orderDate)}</span>
      ),
    },
    {
      dataField: 'expectedDate',
      caption: t('orders.grid.columns.expectedDate'),
      width: 140,
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
      caption: t('orders.grid.columns.totalAmount'),
      width: 150,
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
      caption: t('orders.grid.columns.status'),
      width: 140,
      cellRender: (cellInfo) => {
        const status = normalizeStatus(cellInfo.data.status) as POStatusFilter;
        const config = STATUS_CONFIG[status] || STATUS_CONFIG[''];
        return (
          <Badge variant={config.badgeVariant} dot>
            {t(`orders.status.${config.translationKey}`)}
          </Badge>
        );
      },
    },
    {
      caption: '',
      width: 140,
      allowSorting: false,
      allowFiltering: false,
      cellRender: (cellInfo) => {
        const status = normalizeStatus(cellInfo.data.status);
        const isDraft = status === 'draft';
        return (
          <div className="flex items-center gap-1">
            <button
              type="button"
              title={tCommon('actions.view')}
              aria-label={tCommon('actions.view')}
              onClick={(e) => {
                e.stopPropagation();
                handleView(cellInfo.data as PurchaseOrder);
              }}
              className="p-2 rounded-md text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
              data-testid={`view-po-${cellInfo.data.id}`}
            >
              <Eye className="h-4 w-4" />
            </button>
            {isDraft && (
              <>
                <button
                  type="button"
                  title={tCommon('actions.edit')}
                  aria-label={tCommon('actions.edit')}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEdit(cellInfo.data as PurchaseOrder);
                  }}
                  className="p-2 rounded-md text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                  data-testid={`edit-po-${cellInfo.data.id}`}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  title={tCommon('actions.delete')}
                  aria-label={tCommon('actions.delete')}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteClick(cellInfo.data as PurchaseOrder);
                  }}
                  className="p-2 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                  data-testid={`delete-po-${cellInfo.data.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        );
      },
    },
  ], [t, tCommon, handleView, handleEdit, handleDeleteClick]);

  const showEmptyState = !isLoading && orders.length === 0;
  const showNoResultsState = !isLoading && orders.length > 0 && filteredOrders.length === 0;

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 max-w-full">
      {/* Responsive Page Header */}
      <ResponsivePageHeader
        title={t('orders.pageTitle')}
        subtitle={t('orders.description')}
        icon={Truck}
        iconBgColor="bg-blue-100"
        iconColor="text-blue-600"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <DxButton
              icon="refresh"
              text={tCommon('actions.refresh')}
              stylingMode="outlined"
              onClick={() => fetchOrders()}
              className="hidden sm:inline-flex"
            />
            <DxButton
              text={t('orders.actions.createPO')}
              icon="plus"
              type="success"
              onClick={() => router.push('/purchasing/orders/new')}
            />
          </div>
        }
      />

      {/* KPI Stat Cards - Total / Open / Received / Closed */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          label={t('orders.kpi.total')}
          value={stats.total}
          icon={ShoppingCart}
          iconColor="text-blue-500"
          accentColor="border-blue-500"
          isLoading={isLoading}
        />
        <StatCard
          label={t('orders.kpi.open')}
          value={stats.open}
          icon={Clock}
          iconColor="text-amber-500"
          accentColor="border-amber-500"
          isLoading={isLoading}
        />
        <StatCard
          label={t('orders.kpi.received')}
          value={stats.received}
          icon={PackageCheck}
          iconColor="text-emerald-500"
          accentColor="border-emerald-500"
          isLoading={isLoading}
        />
        <StatCard
          label={t('orders.kpi.closed')}
          value={stats.closed}
          icon={CheckCircle}
          iconColor="text-gray-400"
          accentColor="border-gray-400"
          isLoading={isLoading}
        />
      </div>

      {/* Main Content Card */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {/* Filter Header: Status Tabs - scroll-snap */}
        <div className="px-3 py-3 sm:px-4 border-b border-gray-100 bg-gradient-to-r from-gray-50/50 to-white">
          <div className="flex items-center gap-1 p-1 bg-white border border-gray-200 rounded-lg overflow-x-auto scrollbar-thin snap-x">
            {STATUS_ORDER.map((status) => {
              const config = STATUS_CONFIG[status];
              const count = statusCounts[status];
              const isActive = statusFilter === status;

              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 snap-start min-h-[36px]',
                    isActive
                      ? `${config.activeBg} shadow-sm`
                      : 'text-gray-600 hover:bg-gray-100'
                  )}
                  data-testid={`status-tab-${status || 'all'}`}
                >
                  {config.icon}
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

        {/* Search + Date Filter + Result Count */}
        <div className="px-3 py-3 sm:px-4 border-b border-gray-100 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1 min-w-0">
            <div className="w-full sm:max-w-xs">
              <DxTextBox
                placeholder={t('orders.searchPlaceholder')}
                value={search}
                onValueChange={setSearch}
                showClearButton
                mode="search"
              />
            </div>
            <DateRangeFilter
              from={dateFrom}
              to={dateTo}
              onFromChange={setDateFrom}
              onToChange={setDateTo}
              data-testid="po-date-filter"
            />
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 whitespace-nowrap">
            <ShoppingCart className="h-4 w-4 text-gray-400" />
            <span>{t('orders.grid.showing', { count: filteredOrders.length })}</span>
          </div>
        </div>

        {/* Content: Loading / Empty / No Results / Mobile Cards / Desktop Grid */}
        {isLoading ? (
          isMobile ? (
            <PurchaseOrderCardSkeletonList count={4} />
          ) : (
            <DataGridLoadingSkeleton />
          )
        ) : showEmptyState ? (
          <EmptyState onCreate={() => router.push('/purchasing/orders/new')} t={t} />
        ) : showNoResultsState ? (
          <NoResultsState onClear={handleClearFilters} tCommon={tCommon} />
        ) : isMobile ? (
          <PurchaseOrderCardList
            orders={filteredOrders}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={handleDeleteClick}
            t={t}
            tCommon={tCommon}
          />
        ) : (
          <div style={{ minWidth: 900 }} className="overflow-x-auto">
            <DxDataGrid
              dataSource={filteredOrders}
              keyExpr="id"
              columns={columns}
              sorting
              responsiveColumns
              virtualScrolling={filteredOrders.length > 100}
              height={600}
              mobileHeight={520}
              tabletHeight={560}
              onRowClick={handleRowClick}
              noDataText={t('orders.grid.noData')}
            />
          </div>
        )}
      </div>

      {/* Delete PO Confirmation Modal */}
      <DxPopup
        visible={!!deleteTarget}
        onHiding={() => setDeleteTarget(null)}
        title={t('orders.delete.title')}
        width={420}
        height="auto"
        showCloseButton
        fullScreenOnMobile
      >
        <div className="p-4">
          <p className="text-sm text-gray-600 mb-4">
            {t('orders.delete.message', { poNumber: deleteTarget?.poNumber || '' })}
          </p>
          <p className="text-xs text-gray-500 mb-6">
            {tCommon('actions.cannotUndo')}
          </p>
          <div className="flex gap-2 justify-end">
            <DxButton
              text={tCommon('actions.close')}
              type="normal"
              stylingMode="outlined"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            />
            <DxButton
              text={deleting ? t('orders.delete.deleting') : t('orders.delete.confirm')}
              type="danger"
              stylingMode="contained"
              icon="trash"
              onClick={handleDeletePO}
              disabled={deleting}
              data-testid="confirm-delete-po-btn"
            />
          </div>
        </div>
      </DxPopup>
    </div>
  );
}

// ============================================
// Helper Components
// ============================================

/**
 * Mobile Card List — replaces DataGrid on mobile viewports.
 * Each card shows: PO number + vendor + status + total + expected delivery.
 * Tap card or View button to navigate. Action buttons are 44px touch targets.
 */
function PurchaseOrderCardList({
  orders,
  onView,
  onEdit,
  onDelete,
  t,
  tCommon,
}: {
  orders: PurchaseOrder[];
  onView: (o: PurchaseOrder) => void;
  onEdit: (o: PurchaseOrder) => void;
  onDelete: (o: PurchaseOrder) => void;
  t: TranslateFn;
  tCommon: TranslateFn;
}) {
  return (
    <div className="p-3 sm:p-4 space-y-3 bg-gray-50/30">
      {orders.map((order) => {
        const status = normalizeStatus(order.status) as POStatusFilter;
        const config = STATUS_CONFIG[status] || STATUS_CONFIG[''];
        const isDraft = status === 'draft';
        const isOverdue =
          order.expectedDate &&
          new Date(order.expectedDate) < new Date() &&
          !['received', 'cancelled'].includes(status);

        return (
          <div
            key={order.id}
            className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md active:bg-gray-50 transition-all"
          >
            {/* Card body: tap to view (44px+ touch target) */}
            <button
              type="button"
              onClick={() => onView(order)}
              className="w-full text-left p-4 min-h-[44px]"
              data-testid={`po-card-${order.id}`}
            >
              <div className="flex items-start gap-3">
                <div className={cn('h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0', config.bgColor)}>
                  <span className={config.textColor}>{config.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="min-w-0">
                      <p className="font-mono font-semibold text-gray-900 text-base truncate">
                        {order.poNumber}
                      </p>
                    </div>
                    <Badge variant={config.badgeVariant} dot>
                      {t(`orders.status.${config.translationKey}`)}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-700 flex items-center gap-1 mt-1">
                    <Building2 className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                    <span className="truncate">{order.vendorName || '-'}</span>
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">
                      <Banknote className="h-3 w-3" />
                      {formatCurrency(Number(order.totalAmount || 0), order.currency)}
                    </span>
                    {order.expectedDate && (
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded',
                          isOverdue
                            ? 'bg-red-50 text-red-700 font-medium'
                            : 'bg-gray-100 text-gray-700'
                        )}
                      >
                        {isOverdue ? <AlertCircle className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
                        {formatDate(order.expectedDate)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>

            {/* Card footer: action buttons (44px+ touch targets) */}
            <div className="flex items-center border-t border-gray-100 divide-x divide-gray-100">
              <button
                type="button"
                onClick={() => onView(order)}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 active:bg-indigo-100 transition-colors min-h-[44px]"
              >
                <Eye className="h-4 w-4" />
                <span>{tCommon('actions.view')}</span>
              </button>
              {isDraft && (
                <>
                  <button
                    type="button"
                    onClick={() => onEdit(order)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 active:bg-emerald-100 transition-colors min-h-[44px]"
                  >
                    <Pencil className="h-4 w-4" />
                    <span>{tCommon('actions.edit')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(order)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-gray-700 hover:bg-red-50 hover:text-red-700 active:bg-red-100 transition-colors min-h-[44px]"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>{tCommon('actions.delete')}</span>
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Loading skeleton for mobile card list */
function PurchaseOrderCardSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="p-3 sm:p-4 space-y-3 bg-gray-50/30" aria-busy="true" aria-live="polite">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 animate-pulse">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-xl bg-gray-200 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/2 bg-gray-200 rounded" />
              <div className="h-3 w-1/3 bg-gray-200 rounded" />
              <div className="flex gap-2 pt-1">
                <div className="h-5 w-20 bg-gray-200 rounded-full" />
                <div className="h-5 w-24 bg-gray-200 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Loading skeleton for desktop DataGrid */
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

/** Empty State — shown when there are zero purchase orders at all */
function EmptyState({ onCreate, t }: { onCreate: () => void; t: TranslateFn }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="h-20 w-20 rounded-2xl bg-blue-100 flex items-center justify-center mb-5">
        <Truck className="h-10 w-10 text-blue-600" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        {t('orders.emptyTitle')}
      </h3>
      <p className="text-sm text-gray-500 max-w-sm mb-6">
        {t('orders.emptyDescription')}
      </p>
      <DxButton
        text={t('orders.actions.createPO')}
        icon="plus"
        type="success"
        onClick={onCreate}
      />
    </div>
  );
}

/** No Results State — shown when filters/search yield zero but data exists */
function NoResultsState({ onClear, tCommon }: { onClear: () => void; tCommon: TranslateFn }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
      <div className="h-16 w-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <SearchX className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">
        {tCommon('messages.noResultsTitle')}
      </h3>
      <p className="text-sm text-gray-500 max-w-sm mb-4">
        {tCommon('messages.noResultsDescription')}
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
