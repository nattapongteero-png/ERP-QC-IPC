'use client';

/**
 * Vendors Dashboard Page
 * Feature: Purchasing Management
 *
 * Professional, responsive vendor management page with DevExtreme UI.
 * Mirrors /inventory/warehouses gold-standard pattern:
 *  - ResponsivePageHeader + KPI StatCards
 *  - Scrollable status tabs (snap on mobile)
 *  - Mobile card list (touch-friendly 44px targets)
 *  - Empty / No-Results / Skeleton states
 *  - DevExtreme DataGrid on desktop with horizontal scroll (minWidth)
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { Badge } from '@/components/ui/badge';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { useMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils/cn';
import {
  Building2,
  CheckCircle,
  Clock,
  Truck,
  Link2,
  UserCheck,
  Mail,
  Phone,
  XCircle,
  Users,
  Eye,
  SearchX,
} from 'lucide-react';
import type { DataGridTypes } from 'devextreme-react/data-grid';

interface Vendor {
  id: number;
  code: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  isApproved: boolean;
  isVMI: boolean;
  isActive: boolean;
  leadTimeDays: number | null;
  paymentTerms: string | null;
}

// Status filter type
type VendorStatusFilter = '' | 'approved' | 'pending' | 'vmi' | 'inactive';

// Status configuration for tabs and styling
const STATUS_CONFIG: Record<VendorStatusFilter, {
  translationKey: string;
  bgColor: string;
  textColor: string;
  hoverBg: string;
  icon: React.ReactNode;
  badgeVariant: 'success' | 'warning' | 'danger' | 'info' | 'default' | 'primary' | 'secondary';
}> = {
  '': {
    translationKey: 'all',
    bgColor: 'bg-gray-900',
    textColor: 'text-white',
    hoverBg: 'hover:bg-gray-800',
    icon: <Building2 className="h-4 w-4" />,
    badgeVariant: 'default',
  },
  approved: {
    translationKey: 'approved',
    bgColor: 'bg-emerald-600',
    textColor: 'text-white',
    hoverBg: 'hover:bg-emerald-700',
    icon: <CheckCircle className="h-4 w-4" />,
    badgeVariant: 'success',
  },
  pending: {
    translationKey: 'pending',
    bgColor: 'bg-amber-500',
    textColor: 'text-white',
    hoverBg: 'hover:bg-amber-600',
    icon: <Clock className="h-4 w-4" />,
    badgeVariant: 'warning',
  },
  vmi: {
    translationKey: 'vmi',
    bgColor: 'bg-blue-600',
    textColor: 'text-white',
    hoverBg: 'hover:bg-blue-700',
    icon: <Link2 className="h-4 w-4" />,
    badgeVariant: 'info',
  },
  inactive: {
    translationKey: 'inactive',
    bgColor: 'bg-red-600',
    textColor: 'text-white',
    hoverBg: 'hover:bg-red-700',
    icon: <XCircle className="h-4 w-4" />,
    badgeVariant: 'danger',
  },
};

const STATUS_ORDER: VendorStatusFilter[] = ['', 'approved', 'pending', 'vmi', 'inactive'];

// next-intl's Translator expects specific value types; accept a superset-compatible shape.
type TranslateFn = (key: string, values?: Record<string, string | number | Date>) => string;

export default function VendorsPage() {
  const router = useRouter();
  const t = useTranslations('purchasing');
  const tCommon = useTranslations('common');
  const { isMobile } = useMobile();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<VendorStatusFilter>('');

  const fetchVendors = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/vendors?limit=1000');
      const data = await res.json();

      if (data.success) {
        setVendors(data.data?.items || []);
      } else {
        setVendors([]);
      }
    } catch (error) {
      console.error('Failed to fetch vendors:', error);
      setVendors([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  // Client-side filtering
  const filteredVendors = useMemo(() => {
    const filtered = vendors.filter((vendor) => {
      // Status filter
      let matchesStatus = true;
      switch (statusFilter) {
        case 'approved':
          matchesStatus = vendor.isApproved === true && vendor.isActive !== false;
          break;
        case 'pending':
          matchesStatus = vendor.isApproved === false && vendor.isActive !== false;
          break;
        case 'vmi':
          matchesStatus = vendor.isVMI === true;
          break;
        case 'inactive':
          matchesStatus = vendor.isActive === false;
          break;
      }

      // Search filter
      const matchesSearch =
        !search ||
        vendor.code?.toLowerCase().includes(search.toLowerCase()) ||
        vendor.name?.toLowerCase().includes(search.toLowerCase()) ||
        vendor.contactPerson?.toLowerCase().includes(search.toLowerCase());

      return matchesStatus && matchesSearch;
    });
    // Newest first (id is auto-increment, so highest id = most recent).
    filtered.sort((a, b) => Number(b.id) - Number(a.id));
    return filtered.map((item, index) => ({ ...item, _rowNumber: index + 1 }));
  }, [vendors, statusFilter, search]);

  // Calculate counts for each status
  const statusCounts: Record<VendorStatusFilter, number> = useMemo(() => ({
    '': vendors.length,
    approved: vendors.filter((v) => v.isApproved === true && v.isActive !== false).length,
    pending: vendors.filter((v) => v.isApproved === false && v.isActive !== false).length,
    vmi: vendors.filter((v) => v.isVMI === true).length,
    inactive: vendors.filter((v) => v.isActive === false).length,
  }), [vendors]);

  // KPI stats
  const totalVendors = vendors.length;
  const activeVendors = vendors.filter((v) => v.isActive !== false).length;
  const approvedVendors = statusCounts.approved;
  const inactiveVendors = statusCounts.inactive;

  const handleRowClick = (e: DataGridTypes.RowClickEvent) => {
    if (e.data?.id) {
      router.push(`/purchasing/vendors/${e.data.id}`);
    }
  };

  const handleView = useCallback((vendor: Vendor) => {
    router.push(`/purchasing/vendors/${vendor.id}`);
  }, [router]);

  const handleClearFilters = () => {
    setSearch('');
    setStatusFilter('');
  };

  const handleCreate = () => {
    router.push('/purchasing/vendors/new');
  };

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
      dataField: 'code',
      caption: t('vendors.grid.columns.code'),
      width: 140,
      cellRender: (cellInfo) => {
        const isApproved = cellInfo.data.isApproved;
        const isVMI = cellInfo.data.isVMI;
        const isActive = cellInfo.data.isActive !== false;

        let bgColor = 'bg-gray-100';
        let textColor = 'text-gray-600';
        let icon = <Building2 className="h-4 w-4" />;

        if (!isActive) {
          bgColor = 'bg-red-100';
          textColor = 'text-red-600';
          icon = <XCircle className="h-4 w-4" />;
        } else if (isVMI) {
          bgColor = 'bg-blue-100';
          textColor = 'text-blue-600';
          icon = <Link2 className="h-4 w-4" />;
        } else if (isApproved) {
          bgColor = 'bg-emerald-100';
          textColor = 'text-emerald-600';
          icon = <CheckCircle className="h-4 w-4" />;
        } else {
          bgColor = 'bg-amber-100';
          textColor = 'text-amber-600';
          icon = <Clock className="h-4 w-4" />;
        }

        return (
          <div className="flex items-center gap-2">
            <div className={cn('p-1.5 rounded-lg', bgColor)}>
              <span className={textColor}>{icon}</span>
            </div>
            <span className="font-mono font-semibold text-gray-900">{cellInfo.data.code}</span>
          </div>
        );
      },
    },
    {
      dataField: 'name',
      caption: t('vendors.grid.columns.name'),
      minWidth: 220,
      cellRender: (cellInfo) => (
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white font-medium text-xs flex-shrink-0">
            {cellInfo.data.name?.charAt(0)?.toUpperCase() || 'V'}
          </div>
          <div className="min-w-0">
            <span className="font-medium text-gray-800 truncate block">{cellInfo.data.name || '-'}</span>
            {cellInfo.data.contactPerson && (
              <span className="text-xs text-gray-500 truncate block">{cellInfo.data.contactPerson}</span>
            )}
          </div>
        </div>
      ),
    },
    {
      dataField: 'phone',
      caption: t('vendors.grid.columns.phone'),
      width: 150,
      cellRender: (cellInfo) => {
        if (!cellInfo.data.phone) return <span className="text-gray-400">-</span>;
        return (
          <div className="flex items-center gap-1.5 text-gray-600">
            <Phone className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-sm">{cellInfo.data.phone}</span>
          </div>
        );
      },
    },
    {
      dataField: 'email',
      caption: t('vendors.grid.columns.email'),
      width: 220,
      hideOnMobile: true,
      hideOnTablet: true,
      cellRender: (cellInfo) => {
        if (!cellInfo.data.email) return <span className="text-gray-400">-</span>;
        return (
          <div className="flex items-center gap-1.5 text-gray-600">
            <Mail className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-sm truncate">{cellInfo.data.email}</span>
          </div>
        );
      },
    },
    {
      dataField: 'leadTimeDays',
      caption: t('vendors.grid.columns.leadTime'),
      width: 120,
      dataType: 'number',
      hideOnMobile: true,
      cellRender: (cellInfo) => {
        const days = cellInfo.data.leadTimeDays;
        if (!days) return <span className="text-gray-400">-</span>;
        return (
          <div className="flex items-center gap-1.5">
            <Truck className="h-3.5 w-3.5 text-gray-400" />
            <span className={cn(
              'text-sm font-medium',
              days <= 7 ? 'text-emerald-600' : days <= 14 ? 'text-amber-600' : 'text-red-600'
            )}>
              {t('vendors.grid.days', { days })}
            </span>
          </div>
        );
      },
    },
    {
      dataField: 'paymentTerms',
      caption: t('vendors.grid.columns.paymentTerms'),
      width: 130,
      hideOnMobile: true,
      hideOnTablet: true,
      cellRender: (cellInfo) => {
        if (!cellInfo.data.paymentTerms) return <span className="text-gray-400">-</span>;
        return <span className="text-sm text-gray-600">{cellInfo.data.paymentTerms}</span>;
      },
    },
    {
      dataField: 'status',
      caption: t('vendors.grid.columns.status'),
      width: 190,
      cellRender: (cellInfo) => {
        const isApproved = cellInfo.data.isApproved;
        const isVMI = cellInfo.data.isVMI;
        const isActive = cellInfo.data.isActive !== false;

        return (
          <div className="flex gap-1 flex-wrap">
            {!isActive ? (
              <Badge variant="danger" dot>{t('vendors.status.inactive')}</Badge>
            ) : (
              <>
                <Badge variant={isApproved ? 'success' : 'warning'} dot>
                  {isApproved ? t('vendors.status.approved') : t('vendors.status.pending')}
                </Badge>
                {isVMI && <Badge variant="info">{t('vendors.status.vmi')}</Badge>}
              </>
            )}
          </div>
        );
      },
    },
  ], [t]);

  const showEmptyState = !isLoading && vendors.length === 0;
  const showNoResultsState = !isLoading && vendors.length > 0 && filteredVendors.length === 0;

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 max-w-full">
      {/* Responsive Page Header */}
      <ResponsivePageHeader
        title={t('vendors.pageTitle')}
        subtitle={t('vendors.description')}
        icon={Building2}
        iconBgColor="bg-purple-100"
        iconColor="text-purple-600"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <DxButton
              icon="refresh"
              text={tCommon('actions.refresh')}
              stylingMode="outlined"
              onClick={fetchVendors}
              className="hidden sm:inline-flex"
            />
            <DxButton
              text={t('vendors.actions.addVendor')}
              icon="plus"
              type="success"
              onClick={handleCreate}
            />
          </div>
        }
      />

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          label={t('vendors.stats.total')}
          value={totalVendors}
          icon={Users}
          iconColor="text-purple-500"
          accentColor="border-purple-500"
          isLoading={isLoading}
        />
        <StatCard
          label={t('vendors.stats.active')}
          value={activeVendors}
          icon={UserCheck}
          iconColor="text-blue-500"
          accentColor="border-blue-500"
          isLoading={isLoading}
        />
        <StatCard
          label={t('vendors.stats.approved')}
          value={approvedVendors}
          icon={CheckCircle}
          iconColor="text-emerald-500"
          accentColor="border-emerald-500"
          isLoading={isLoading}
        />
        <StatCard
          label={t('vendors.stats.inactive')}
          value={inactiveVendors}
          icon={XCircle}
          iconColor="text-gray-400"
          accentColor="border-gray-400"
          isLoading={isLoading}
        />
      </div>

      {/* DataGrid Card */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {/* Filter Header: Status Tabs (scrollable w/ snap on mobile) */}
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
                      ? `${config.bgColor} ${config.textColor} shadow-sm`
                      : 'text-gray-600 hover:bg-gray-100'
                  )}
                >
                  {config.icon}
                  <span>{t(`vendors.status.${config.translationKey}`)}</span>
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

        {/* Search + Result Count Row */}
        <div className="px-3 py-3 sm:px-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="w-full sm:max-w-md">
            <DxTextBox
              placeholder={t('vendors.searchPlaceholder')}
              value={search}
              onValueChange={setSearch}
              showClearButton
              mode="search"
            />
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 whitespace-nowrap">
            <Users className="h-4 w-4 text-gray-400" />
            <span>{t('vendors.vendorsShown', { count: filteredVendors.length })}</span>
          </div>
        </div>

        {/* Content: Loading / Empty / No-Results / Mobile Cards / Desktop Grid */}
        {isLoading ? (
          isMobile ? (
            <VendorCardSkeletonList count={4} />
          ) : (
            <DataGridLoadingSkeleton />
          )
        ) : showEmptyState ? (
          <EmptyState onCreate={handleCreate} t={t} />
        ) : showNoResultsState ? (
          <NoResultsState onClear={handleClearFilters} t={t} />
        ) : isMobile ? (
          <VendorCardList
            vendors={filteredVendors}
            onView={handleView}
            t={t}
          />
        ) : (
          <div className="overflow-x-auto">
            <div style={{ minWidth: '900px' }}>
              <DxDataGrid
                dataSource={filteredVendors}
                keyExpr="id"
                columns={columns}
                sorting
                responsiveColumns
                virtualScrolling={filteredVendors.length > 100}
                /* No fixed height: grow to fit the page's rows so a full page
                   shows without an inner scrollbar. Only virtual scrolling
                   (>100 rows) needs a bounded height. */
                height={filteredVendors.length > 100 ? 600 : undefined}
                onRowClick={handleRowClick}
                noDataText={t('vendors.grid.noData')}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Helper Components
// ============================================

/**
 * Mobile Card List — replaces DataGrid on mobile viewports.
 * Each card prioritizes: Code → Name → Contact → Status + tap-to-view (44px target).
 */
function VendorCardList({
  vendors,
  onView,
  t,
}: {
  vendors: Vendor[];
  onView: (v: Vendor) => void;
  t: TranslateFn;
}) {
  return (
    <div className="p-3 sm:p-4 space-y-3 bg-gray-50/30">
      {vendors.map((v) => {
        const isActive = v.isActive !== false;
        const isApproved = v.isApproved;
        const isVMI = v.isVMI;

        // Icon color based on status priority (inactive > vmi > approved > pending)
        let iconBg = 'bg-amber-100';
        let iconColor = 'text-amber-600';
        let StatusIcon: typeof Building2 = Clock;
        if (!isActive) {
          iconBg = 'bg-red-100';
          iconColor = 'text-red-600';
          StatusIcon = XCircle;
        } else if (isVMI) {
          iconBg = 'bg-blue-100';
          iconColor = 'text-blue-600';
          StatusIcon = Link2;
        } else if (isApproved) {
          iconBg = 'bg-emerald-100';
          iconColor = 'text-emerald-600';
          StatusIcon = CheckCircle;
        }

        return (
          <div
            key={v.id}
            className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md active:bg-gray-50 transition-all"
          >
            {/* Card header: icon + name + code + status badge */}
            <button
              type="button"
              onClick={() => onView(v)}
              className="w-full text-left p-4 flex items-start gap-3"
            >
              <div className={cn('h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0', iconBg)}>
                <StatusIcon className={cn('h-5 w-5', iconColor)} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-base truncate">{v.name || '-'}</p>
                    <p className="font-mono text-xs text-gray-500">{v.code}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {!isActive ? (
                      <Badge variant="danger" dot>{t('vendors.status.inactive')}</Badge>
                    ) : (
                      <Badge variant={isApproved ? 'success' : 'warning'} dot>
                        {isApproved ? t('vendors.status.approved') : t('vendors.status.pending')}
                      </Badge>
                    )}
                    {isActive && isVMI && (
                      <Badge variant="info">{t('vendors.status.vmi')}</Badge>
                    )}
                  </div>
                </div>

                {/* Contact info */}
                {v.contactPerson && (
                  <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                    <UserCheck className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                    <span className="truncate">{v.contactPerson}</span>
                  </p>
                )}
                {v.phone && (
                  <p className="text-sm text-gray-600 flex items-center gap-1 mt-0.5">
                    <Phone className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                    <span className="truncate">{v.phone}</span>
                  </p>
                )}
                {v.email && (
                  <p className="text-sm text-gray-600 flex items-center gap-1 mt-0.5">
                    <Mail className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                    <span className="truncate">{v.email}</span>
                  </p>
                )}

                {/* Meta chips */}
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {v.leadTimeDays ? (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded',
                        v.leadTimeDays <= 7
                          ? 'bg-emerald-50 text-emerald-700'
                          : v.leadTimeDays <= 14
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-red-50 text-red-700'
                      )}
                    >
                      <Truck className="h-3 w-3" />
                      {t('vendors.grid.days', { days: v.leadTimeDays })}
                    </span>
                  ) : null}
                  {v.paymentTerms ? (
                    <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                      {v.paymentTerms}
                    </span>
                  ) : null}
                </div>
              </div>
            </button>

            {/* Card footer: view button (touch-friendly 44px min-height) */}
            <div className="border-t border-gray-100">
              <button
                type="button"
                onClick={() => onView(v)}
                className="w-full flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-gray-700 hover:bg-purple-50 hover:text-purple-700 active:bg-purple-100 transition-colors min-h-[44px]"
              >
                <Eye className="h-4 w-4" />
                <span>{t('vendors.viewDetails')}</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Loading skeleton for mobile card list */
function VendorCardSkeletonList({ count = 3 }: { count?: number }) {
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

/** Empty State — shown when user has zero vendors at all */
function EmptyState({ onCreate, t }: { onCreate: () => void; t: TranslateFn }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="h-20 w-20 rounded-2xl bg-purple-100 flex items-center justify-center mb-5">
        <Building2 className="h-10 w-10 text-purple-600" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        {t('vendors.emptyTitle')}
      </h3>
      <p className="text-sm text-gray-500 max-w-sm mb-6">
        {t('vendors.emptyDescription')}
      </p>
      <DxButton
        text={t('vendors.actions.addVendor')}
        icon="plus"
        type="success"
        onClick={onCreate}
      />
    </div>
  );
}

/** No Results State — shown when filter/search yields zero results but vendors exist */
function NoResultsState({ onClear, t }: { onClear: () => void; t: TranslateFn }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
      <div className="h-16 w-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <SearchX className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">
        {t('vendors.noResultsTitle')}
      </h3>
      <p className="text-sm text-gray-500 max-w-sm mb-4">
        {t('vendors.noResultsDescription')}
      </p>
      <DxButton
        text={t('vendors.clearFilters')}
        icon="clear"
        stylingMode="outlined"
        onClick={onClear}
      />
    </div>
  );
}
