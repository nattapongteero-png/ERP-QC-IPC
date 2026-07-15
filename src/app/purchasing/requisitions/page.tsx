'use client';

/**
 * Purchase Requisitions List Page (T046)
 * Part of 011-accounting-spec-gap
 * Redesigned to match responsive + informative + user-friendly pattern.
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { Badge } from '@/components/ui/badge';
import { ResponsivePageHeader, StatCard, DateRangeFilter } from '@/components/shared';
import { formatNumber } from '@/lib/utils/number-format';
import { useMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils/cn';
import {
  FileText,
  Clock,
  CheckCircle,
  Send,
  XCircle,
  ClipboardList,
  AlertTriangle,
  ArrowRightCircle,
  Zap,
  ShoppingCart,
  User,
  Calendar,
  SearchX,
  Inbox,
  Pencil,
  Trash2,
  ChevronRight,
} from 'lucide-react';
import type { DataGridTypes } from 'devextreme-react/data-grid';
import { Popup } from 'devextreme-react/popup';
import type { PurchaseRequisition, PRStatus, PRPriority } from '@/types/purchase-requisition';

// Status filter type
type PRStatusFilter = '' | PRStatus;

// Status configuration for tabs and styling
const STATUS_CONFIG: Record<PRStatusFilter, {
  translationKey: string;
  bgColor: string;
  textColor: string;
  hoverBg: string;
  activeBg: string;
  activeText: string;
  icon: React.ReactNode;
  badgeVariant: 'success' | 'warning' | 'danger' | 'info' | 'default' | 'primary' | 'secondary';
}> = {
  '': {
    translationKey: 'all',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-700',
    hoverBg: 'hover:bg-gray-200',
    activeBg: 'bg-gray-900',
    activeText: 'text-white',
    icon: <ClipboardList className="h-4 w-4" />,
    badgeVariant: 'default',
  },
  draft: {
    translationKey: 'draft',
    bgColor: 'bg-slate-100',
    textColor: 'text-slate-700',
    hoverBg: 'hover:bg-slate-200',
    activeBg: 'bg-slate-600',
    activeText: 'text-white',
    icon: <FileText className="h-4 w-4" />,
    badgeVariant: 'default',
  },
  submitted: {
    translationKey: 'submitted',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-700',
    hoverBg: 'hover:bg-blue-200',
    activeBg: 'bg-blue-600',
    activeText: 'text-white',
    icon: <Send className="h-4 w-4" />,
    badgeVariant: 'info',
  },
  pending_approval: {
    translationKey: 'pendingApproval',
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-700',
    hoverBg: 'hover:bg-yellow-200',
    activeBg: 'bg-yellow-500',
    activeText: 'text-white',
    icon: <Clock className="h-4 w-4" />,
    badgeVariant: 'warning',
  },
  approved: {
    translationKey: 'approved',
    bgColor: 'bg-green-100',
    textColor: 'text-green-700',
    hoverBg: 'hover:bg-green-200',
    activeBg: 'bg-emerald-600',
    activeText: 'text-white',
    icon: <CheckCircle className="h-4 w-4" />,
    badgeVariant: 'success',
  },
  rejected: {
    translationKey: 'rejected',
    bgColor: 'bg-red-100',
    textColor: 'text-red-700',
    hoverBg: 'hover:bg-red-200',
    activeBg: 'bg-red-600',
    activeText: 'text-white',
    icon: <XCircle className="h-4 w-4" />,
    badgeVariant: 'danger',
  },
  cancelled: {
    translationKey: 'cancelled',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-500',
    hoverBg: 'hover:bg-gray-200',
    activeBg: 'bg-gray-500',
    activeText: 'text-white',
    icon: <XCircle className="h-4 w-4" />,
    badgeVariant: 'secondary',
  },
  converted: {
    translationKey: 'converted',
    bgColor: 'bg-purple-100',
    textColor: 'text-purple-700',
    hoverBg: 'hover:bg-purple-200',
    activeBg: 'bg-purple-600',
    activeText: 'text-white',
    icon: <ArrowRightCircle className="h-4 w-4" />,
    badgeVariant: 'primary',
  },
};

// Priority configuration
const PRIORITY_CONFIG: Record<PRPriority, {
  translationKey: string;
  color: string;
  bgColor: string;
  icon?: React.ReactNode;
}> = {
  low: {
    translationKey: 'low',
    color: 'text-gray-500',
    bgColor: 'bg-gray-100',
  },
  normal: {
    translationKey: 'normal',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  high: {
    translationKey: 'high',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    icon: <AlertTriangle className="h-3 w-3" />,
  },
  urgent: {
    translationKey: 'urgent',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    icon: <Zap className="h-3 w-3" />,
  },
};

const STATUS_ORDER: PRStatusFilter[] = ['', 'draft', 'submitted', 'pending_approval', 'approved', 'rejected', 'cancelled', 'converted'];

// Helper function to normalize status for comparison
const normalizeStatus = (status: string): string => status?.toLowerCase() || '';

/**
 * How soon a requisition is needed, derived from its required date.
 *
 *   <= 7 days   เร่งด่วน  (urgent)
 *   8 - 30 days ปกติ      (normal)
 *   > 30 days   ต่ำ        (low)
 *
 * Thresholds come from the buyers: <=7 urgent, 15-30 normal, >30 low. That
 * leaves 8-14 unstated, so it is folded into "normal" — the nearest band — and
 * an already-overdue PR counts as urgent, which is what the 7-day rule means
 * once the date has passed.
 *
 * Returns null when there is no required date: a draft without one is not
 * evidence of low urgency, and guessing would be worse than not counting it.
 */
export type UrgencyLevel = 'urgent' | 'normal' | 'low';

const urgencyOf = (requiredDate: string | Date | null | undefined): UrgencyLevel | null => {
  if (!requiredDate) return null;
  const due = new Date(requiredDate);
  if (isNaN(due.getTime())) return null;

  // Compare whole days, so "due today" is not urgent-or-not depending on the
  // clock time the row happens to carry.
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round(
    (startOfDay(due).getTime() - startOfDay(new Date()).getTime()) / 86_400_000,
  );

  if (days <= 7) return 'urgent';
  if (days <= 30) return 'normal';
  return 'low';
};

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

const formatDate = (dateStr: string | Date | null | undefined) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('th-TH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
};

// next-intl translator type
type TranslateFn = (key: string, values?: Record<string, string | number | Date>) => string;

export default function PurchaseRequisitionsPage() {
  const router = useRouter();
  const t = useTranslations('purchasing');
  const tCommon = useTranslations('common');
  const { isMobile } = useMobile();
  const [requisitions, setRequisitions] = useState<PurchaseRequisition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PRStatusFilter>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<PurchaseRequisition | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchRequisitions = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/purchasing/requisitions?limit=1000');
      const result = await response.json();
      if (result.success) {
        setRequisitions(result.data || []);
      } else {
        setRequisitions([]);
      }
    } catch (error) {
      console.error('Error fetching PRs:', error);
      setRequisitions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequisitions();
  }, [fetchRequisitions]);

  // Client-side filtering
  const filteredRequisitions = useMemo(() => {
    const filtered = requisitions.filter((pr) => {
      const matchesStatus = !statusFilter || normalizeStatus(pr.status) === statusFilter;
      const matchesSearch =
        !search ||
        pr.prNumber?.toLowerCase().includes(search.toLowerCase()) ||
        pr.description?.toLowerCase().includes(search.toLowerCase()) ||
        pr.requesterName?.toLowerCase().includes(search.toLowerCase());
      const createdKey = toDateKey(pr.createdAt);
      const matchesDate =
        (!dateFrom || (!!createdKey && createdKey >= dateFrom)) &&
        (!dateTo || (!!createdKey && createdKey <= dateTo));
      return matchesStatus && matchesSearch && matchesDate;
    });
    // Newest first (id is auto-increment, so highest id = most recent).
    filtered.sort((a, b) => Number(b.id) - Number(a.id));
    return filtered.map((item, index) => ({ ...item, _rowNumber: index + 1 }));
  }, [requisitions, statusFilter, search, dateFrom, dateTo]);

  // Calculate counts for each status
  const statusCounts = STATUS_ORDER.reduce((acc, status) => {
    if (status === '') {
      acc[status] = requisitions.length;
    } else {
      acc[status] = requisitions.filter((r) => normalizeStatus(r.status) === status).length;
    }
    return acc;
  }, {} as Record<PRStatusFilter, number>);

  // Calculate KPI stats
  const totalCount = requisitions.length;
  const pendingApprovalCount = requisitions.filter((r) =>
    normalizeStatus(r.status) === 'pending_approval'
  ).length;
  const approvedCount = statusCounts.approved;
  const closedCount = requisitions.filter((r) =>
    ['converted', 'cancelled', 'rejected'].includes(normalizeStatus(r.status))
  ).length;

  // Urgency is DERIVED from how soon the goods are needed, not from the
  // priority someone typed on the form: a PR marked "normal" that is due in
  // three days is urgent whatever the form says.
  //
  // Only live requisitions count — a converted or cancelled PR is not waiting
  // on anyone, so counting it as "urgent" would send buyers chasing closed work.
  const openRequisitions = requisitions.filter(
    (r) => !['converted', 'cancelled', 'rejected'].includes(normalizeStatus(r.status)),
  );
  const urgencyCounts = openRequisitions.reduce(
    (acc, r) => {
      const level = urgencyOf(r.requiredDate as string | Date | null | undefined);
      if (level) acc[level] += 1;
      return acc;
    },
    { urgent: 0, normal: 0, low: 0 } as Record<UrgencyLevel, number>,
  );

  const handleRowClick = (e: DataGridTypes.RowClickEvent) => {
    if (e.data?.id) {
      router.push(`/purchasing/requisitions/${e.data.id}`);
    }
  };

  const handleView = useCallback((pr: PurchaseRequisition) => {
    router.push(`/purchasing/requisitions/${pr.id}`);
  }, [router]);

  const handleEdit = useCallback((pr: PurchaseRequisition) => {
    router.push(`/purchasing/requisitions/${pr.id}`);
  }, [router]);

  const handleDeleteClick = useCallback((pr: PurchaseRequisition) => {
    setDeleteTarget(pr);
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearch('');
    setStatusFilter('');
    setDateFrom('');
    setDateTo('');
  }, []);

  const handleDeletePR = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      const response = await fetch(`/api/purchasing/requisitions/${deleteTarget.id}`, { method: 'DELETE' });
      const result = await response.json();
      if (result.success) {
        setDeleteTarget(null);
        fetchRequisitions();
      } else {
        alert(result.error || 'Failed to delete PR');
      }
    } catch (err) {
      console.error('Error deleting PR:', err);
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, fetchRequisitions]);

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
      dataField: 'prNumber',
      caption: t('requisitions.grid.columns.prNumber'),
      width: 170,
      cellRender: (cellInfo) => {
        const status = normalizeStatus(cellInfo.data.status) as PRStatusFilter;
        const config = STATUS_CONFIG[status] || STATUS_CONFIG[''];
        return (
          <div className="flex items-center gap-2">
            <div className={cn('p-1.5 rounded', config.bgColor)}>
              <span className={config.textColor}>{config.icon}</span>
            </div>
            <div>
              <span className="font-mono font-semibold text-gray-900">{cellInfo.data.prNumber}</span>
            </div>
          </div>
        );
      },
    },
    {
      dataField: 'description',
      caption: t('requisitions.grid.columns.description'),
      minWidth: 200,
      cellRender: (cellInfo) => (
        <span className="text-gray-800 truncate">{cellInfo.data.description || '-'}</span>
      ),
    },
    {
      dataField: 'priority',
      caption: t('requisitions.grid.columns.priority'),
      width: 110,
      cellRender: (cellInfo) => {
        const priority = (cellInfo.data.priority as PRPriority) || 'normal';
        const config = PRIORITY_CONFIG[priority];
        return (
          <div className={cn('flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium w-fit', config.bgColor, config.color)}>
            {config.icon}
            <span>{t(`requisitions.priority.${config.translationKey}`)}</span>
          </div>
        );
      },
    },
    {
      dataField: 'totalAmount',
      caption: t('requisitions.grid.columns.totalAmount'),
      width: 140,
      dataType: 'number',
      cellRender: (cellInfo) => (
        <div className="text-right">
          <span className="font-semibold text-gray-900">
            {formatCurrency(Number(cellInfo.data.totalAmount || 0))}
          </span>
        </div>
      ),
    },
    {
      dataField: 'requiredDate',
      caption: t('requisitions.grid.columns.requiredDate'),
      minWidth: 130,
      dataType: 'date',
      hideOnMobile: true,
      cellRender: (cellInfo) => {
        const requiredDate = cellInfo.data.requiredDate;
        const status = normalizeStatus(cellInfo.data.status);
        if (!requiredDate) return <span className="text-gray-400">-</span>;

        const isOverdue = new Date(requiredDate) < new Date() && !['converted', 'cancelled', 'rejected'].includes(status);
        return (
          <div className="flex items-center gap-1">
            {isOverdue && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
            <span className={cn('text-sm', isOverdue ? 'text-red-600 font-medium' : 'text-gray-600')}>
              {formatDate(requiredDate)}
            </span>
          </div>
        );
      },
    },
    {
      dataField: 'createdAt',
      caption: t('requisitions.grid.columns.createdAt'),
      minWidth: 120,
      dataType: 'date',
      hideOnMobile: true,
      hideOnTablet: true,
      cellRender: (cellInfo) => (
        <span className="text-gray-600 text-sm">{formatDate(cellInfo.data.createdAt)}</span>
      ),
    },
    {
      dataField: 'status',
      caption: t('requisitions.grid.columns.status'),
      width: 140,
      cellRender: (cellInfo) => {
        const status = normalizeStatus(cellInfo.data.status) as PRStatusFilter;
        const config = STATUS_CONFIG[status] || STATUS_CONFIG[''];
        return (
          <Badge variant={config.badgeVariant} dot>
            {t(`requisitions.status.${config.translationKey}`)}
          </Badge>
        );
      },
    },
    {
      caption: '',
      width: 120,
      allowSorting: false,
      allowFiltering: false,
      cellRender: (cellInfo) => {
        const status = normalizeStatus(cellInfo.data.status);
        if (status !== 'draft') return null;
        return (
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="p-2 rounded-md text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/purchasing/requisitions/${cellInfo.data.id}`);
              }}
              data-testid={`edit-pr-${cellInfo.data.id}`}
              aria-label="Edit"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="p-2 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteTarget(cellInfo.data);
              }}
              data-testid={`delete-pr-${cellInfo.data.id}`}
              aria-label="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        );
      },
    },
  ], [t, router]);

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 max-w-full">
      {/* Responsive Page Header */}
      <ResponsivePageHeader
        title={t('requisitions.pageTitle')}
        subtitle={t('requisitions.description')}
        icon={ShoppingCart}
        iconBgColor="bg-emerald-100"
        iconColor="text-emerald-600"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <DxButton
              icon="refresh"
              text={t('requisitions.actions.refresh')}
              stylingMode="outlined"
              onClick={() => fetchRequisitions()}
              className="hidden sm:inline-flex"
              data-testid="refresh-btn"
            />
            <DxButton
              text={t('requisitions.actions.createPR')}
              icon="plus"
              type="success"
              onClick={() => router.push('/purchasing/requisitions/new')}
              data-testid="new-pr-btn"
            />
          </div>
        }
      />

      {/* Urgency — how soon the goods are actually needed. Counts cover open
          requisitions only; a converted or cancelled PR waits on no one. */}
      <div className="grid grid-cols-3 gap-3 md:gap-4" data-testid="urgency-cards">
        <StatCard
          label={t('requisitions.urgency.urgent')}
          value={formatNumber(urgencyCounts.urgent)}
          icon={Zap}
          iconColor="text-red-500"
          accentColor="border-red-500"
          data-testid="urgency-urgent"
        />
        <StatCard
          label={t('requisitions.urgency.normal')}
          value={formatNumber(urgencyCounts.normal)}
          icon={Clock}
          iconColor="text-blue-500"
          accentColor="border-blue-500"
          data-testid="urgency-normal"
        />
        <StatCard
          label={t('requisitions.urgency.low')}
          value={formatNumber(urgencyCounts.low)}
          icon={CheckCircle}
          iconColor="text-gray-400"
          accentColor="border-gray-400"
          data-testid="urgency-low"
        />
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          label={t('requisitions.status.all')}
          value={formatNumber(totalCount)}
          icon={ClipboardList}
          iconColor="text-indigo-500"
          accentColor="border-indigo-500"
        />
        <StatCard
          label={t('requisitions.status.pendingApproval')}
          value={formatNumber(pendingApprovalCount)}
          icon={Clock}
          iconColor="text-yellow-500"
          accentColor="border-yellow-500"
        />
        <StatCard
          label={t('requisitions.status.approved')}
          value={formatNumber(approvedCount)}
          icon={CheckCircle}
          iconColor="text-emerald-500"
          accentColor="border-emerald-500"
        />
        <StatCard
          label={t('requisitions.status.converted')}
          value={formatNumber(closedCount)}
          icon={ArrowRightCircle}
          iconColor="text-purple-500"
          accentColor="border-purple-500"
        />
      </div>

      {/* DataGrid Card */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {/* Filter Header: Status Tabs (scroll-snap) */}
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
                      ? `${config.activeBg} ${config.activeText} shadow-sm`
                      : `text-gray-600 hover:bg-gray-100`
                  )}
                  data-testid={`status-tab-${status || 'all'}`}
                >
                  {config.icon}
                  <span>{t(`requisitions.status.${config.translationKey}`)}</span>
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

        {/* Search + Date Filter + Result Count Row */}
        <div className="px-3 py-3 sm:px-4 border-b border-gray-100 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1 min-w-0">
            <div className="w-full sm:max-w-xs">
              <DxTextBox
                placeholder={t('requisitions.searchPlaceholder')}
                value={search}
                onValueChange={setSearch}
                showClearButton
                mode="search"
                data-testid="search-input"
              />
            </div>
            <DateRangeFilter
              from={dateFrom}
              to={dateTo}
              onFromChange={setDateFrom}
              onToChange={setDateTo}
              data-testid="pr-date-filter"
            />
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 whitespace-nowrap">
            <ClipboardList className="h-4 w-4 text-gray-400" />
            <span>{t('requisitions.grid.showing', { count: filteredRequisitions.length })}</span>
          </div>
        </div>

        {/* Content: Loading / Empty / No Results / Mobile Cards / Desktop Grid */}
        {isLoading ? (
          isMobile ? (
            <RequisitionCardSkeletonList count={4} />
          ) : (
            <DataGridLoadingSkeleton />
          )
        ) : requisitions.length === 0 ? (
          <EmptyState onCreate={() => router.push('/purchasing/requisitions/new')} t={t} />
        ) : filteredRequisitions.length === 0 ? (
          <NoResultsState onClear={handleClearFilters} t={t} tCommon={tCommon} />
        ) : isMobile ? (
          <RequisitionCardList
            requisitions={filteredRequisitions}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={handleDeleteClick}
            t={t}
          />
        ) : (
          <DxDataGrid
            dataSource={filteredRequisitions}
            keyExpr="id"
            columns={columns}
            sorting
            responsiveColumns
            virtualScrolling={filteredRequisitions.length > 100}
            /* No fixed height: let the grid grow to fit the page's rows so a
               full page (e.g. 20 rows) shows without an inner scrollbar. Only
               virtual scrolling (>100 rows) needs a bounded height. */
            height={filteredRequisitions.length > 100 ? 600 : undefined}
            onRowClick={handleRowClick}
            noDataText={t('requisitions.grid.noData')}
            data-testid="pr-grid"
          />
        )}
      </div>

      {/* Delete Confirmation Popup */}
      <Popup
        visible={!!deleteTarget}
        onHiding={() => setDeleteTarget(null)}
        title="ลบใบขอซื้อ (Delete PR)"
        width={isMobile ? '95vw' : 400}
        height={220}
        fullScreen={false}
        showCloseButton={true}
      >
        <div className="p-4">
          <p className="text-sm text-gray-600 mb-4">
            คุณต้องการลบใบขอซื้อ <strong>{deleteTarget?.prNumber}</strong> ใช่หรือไม่? การลบจะไม่สามารถย้อนกลับได้
          </p>
          <div className="flex gap-2 justify-end mt-6">
            <DxButton
              text="ปิด"
              type="normal"
              onClick={() => setDeleteTarget(null)}
            />
            <DxButton
              text={deleting ? 'กำลังลบ...' : 'ยืนยันลบ'}
              type="danger"
              onClick={handleDeletePR}
              disabled={deleting}
              data-testid="confirm-delete-pr-btn"
            />
          </div>
        </div>
      </Popup>
    </div>
  );
}

// ============================================
// Helper Components
// ============================================

/**
 * Mobile Card List — replaces DataGrid on mobile viewports.
 * Each card prioritizes: PR Number → Requester → Status → Date → Total.
 * Footer tap-to-view is 44px min-height touch target.
 */
function RequisitionCardList({
  requisitions,
  onView,
  onEdit,
  onDelete,
  t,
}: {
  requisitions: PurchaseRequisition[];
  onView: (pr: PurchaseRequisition) => void;
  onEdit: (pr: PurchaseRequisition) => void;
  onDelete: (pr: PurchaseRequisition) => void;
  t: TranslateFn;
}) {
  return (
    <div className="p-3 sm:p-4 space-y-3 bg-gray-50/30">
      {requisitions.map((pr) => {
        const status = normalizeStatus(pr.status) as PRStatusFilter;
        const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG[''];
        const priority = (pr.priority || 'normal') as PRPriority;
        const priorityConfig = PRIORITY_CONFIG[priority];
        const isDraft = status === 'draft';
        const isOverdue =
          pr.requiredDate &&
          new Date(pr.requiredDate) < new Date() &&
          !['converted', 'cancelled', 'rejected'].includes(status);

        return (
          <div
            key={pr.id}
            className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md active:bg-gray-50 transition-all"
          >
            {/* Card body (tap to view) */}
            <button
              type="button"
              onClick={() => onView(pr)}
              className="w-full text-left p-4 flex items-start gap-3"
            >
              <div className={cn('h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0', statusConfig.bgColor)}>
                <span className={statusConfig.textColor}>{statusConfig.icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="min-w-0">
                    <p className="font-mono font-semibold text-gray-900 text-base truncate">{pr.prNumber}</p>
                    {pr.description && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{pr.description}</p>
                    )}
                  </div>
                  <Badge variant={statusConfig.badgeVariant} dot>
                    {t(`requisitions.status.${statusConfig.translationKey}`)}
                  </Badge>
                </div>

                {pr.requesterName && (
                  <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                    <User className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                    <span className="truncate">{pr.requesterName}</span>
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {/* Priority */}
                  <span className={cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium', priorityConfig.bgColor, priorityConfig.color)}>
                    {priorityConfig.icon}
                    {t(`requisitions.priority.${priorityConfig.translationKey}`)}
                  </span>

                  {/* Required Date */}
                  {pr.requiredDate && (
                    <span className={cn(
                      'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded',
                      isOverdue ? 'bg-red-50 text-red-700 font-medium' : 'bg-gray-100 text-gray-700'
                    )}>
                      {isOverdue && <AlertTriangle className="h-3 w-3" />}
                      <Calendar className="h-3 w-3" />
                      {formatDate(pr.requiredDate)}
                    </span>
                  )}

                  {/* Total amount */}
                  {Number(pr.totalAmount || 0) > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded">
                      {formatCurrency(Number(pr.totalAmount || 0))}
                    </span>
                  )}
                </div>
              </div>
            </button>

            {/* Card footer: tap-to-view + (draft-only) edit/delete */}
            <div className="flex items-center border-t border-gray-100 divide-x divide-gray-100">
              <button
                type="button"
                onClick={() => onView(pr)}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 active:bg-emerald-100 transition-colors min-h-[44px]"
              >
                <span>{t('requisitions.actions.viewDetails')}</span>
                <ChevronRight className="h-4 w-4" />
              </button>
              {isDraft && (
                <>
                  <button
                    type="button"
                    onClick={() => onEdit(pr)}
                    className="flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 active:bg-blue-100 transition-colors min-h-[44px] min-w-[56px]"
                    aria-label="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(pr)}
                    className="flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-red-50 hover:text-red-700 active:bg-red-100 transition-colors min-h-[44px] min-w-[56px]"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
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
function RequisitionCardSkeletonList({ count = 3 }: { count?: number }) {
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

/** Empty State — shown when user has zero requisitions at all */
function EmptyState({ onCreate, t }: { onCreate: () => void; t: TranslateFn }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="h-20 w-20 rounded-2xl bg-emerald-100 flex items-center justify-center mb-5">
        <Inbox className="h-10 w-10 text-emerald-600" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        {t('requisitions.emptyTitle') || 'ยังไม่มีใบขอซื้อ'}
      </h3>
      <p className="text-sm text-gray-500 max-w-sm mb-6">
        {t('requisitions.emptyDescription') || 'เริ่มต้นโดยการสร้างใบขอซื้อแรกของคุณ'}
      </p>
      <DxButton
        text={t('requisitions.actions.createPR')}
        icon="plus"
        type="success"
        onClick={onCreate}
      />
    </div>
  );
}

/** No Results State — shown when filter/search yields zero results but requisitions exist */
function NoResultsState({ onClear, t, tCommon }: { onClear: () => void; t: TranslateFn; tCommon: TranslateFn }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
      <div className="h-16 w-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <SearchX className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">
        {t('requisitions.noResultsTitle') || 'ไม่พบใบขอซื้อที่ตรงกับเงื่อนไข'}
      </h3>
      <p className="text-sm text-gray-500 max-w-sm mb-4">
        {t('requisitions.noResultsDescription') || 'ลองเปลี่ยนคำค้นหาหรือเลือกตัวกรองอื่น'}
      </p>
      <DxButton
        text={tCommon('actions.clearFilters') || 'ล้างตัวกรอง'}
        icon="clear"
        stylingMode="outlined"
        onClick={onClear}
      />
    </div>
  );
}
