'use client';

/**
 * Fixed Assets List Page
 * Feature: 010-accounting-module-integration
 *
 * Responsive dashboard for managing fixed assets with DevExtreme DataGrid on desktop
 * and a tap-friendly card list on mobile. Includes KPI row, scroll-snap status tabs,
 * search, empty / no-results / loading states, and a modal delete confirmation.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import notify from 'devextreme/ui/notify';
import DataGrid, {
  Column,
  Paging,
  Pager,
  FilterRow,
  HeaderFilter,
  Sorting,
} from 'devextreme-react/data-grid';
import {
  Building,
  Eye,
  Pencil,
  Trash2,
  Package,
  CheckCircle,
  DollarSign,
  TrendingUp,
  XCircle,
  Calendar,
  Layers,
  Search,
  SearchX,
  Boxes,
} from 'lucide-react';

import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { DxButton } from '@/components/ui/dx-button';
import { DxConfirmDialog } from '@/components/ui/dx-popup';
import { useMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils/cn';
import type { FixedAsset, AssetCategory } from '@/lib/db/schema';

// -------------------------------------------------------------------
// Status tab configuration (scroll-snap on mobile)
// -------------------------------------------------------------------
type StatusFilter = '' | 'active' | 'disposed' | 'fully_depreciated';

type TranslateFn = (key: string, values?: Record<string, string | number | Date>) => string;

const STATUS_CONFIG: Record<StatusFilter, {
  translationKey: string;
  bgColor: string;
  textColor: string;
  badgeBg: string;
  badgeText: string;
  icon: React.ReactNode;
}> = {
  '': {
    translationKey: 'status.all',
    bgColor: 'bg-gray-900',
    textColor: 'text-white',
    badgeBg: 'bg-gray-100',
    badgeText: 'text-gray-700',
    icon: <Boxes className="h-4 w-4" />,
  },
  active: {
    translationKey: 'status.active',
    bgColor: 'bg-emerald-600',
    textColor: 'text-white',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-700',
    icon: <CheckCircle className="h-4 w-4" />,
  },
  fully_depreciated: {
    translationKey: 'status.fullyDepreciated',
    bgColor: 'bg-amber-500',
    textColor: 'text-white',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-700',
    icon: <TrendingUp className="h-4 w-4" />,
  },
  disposed: {
    translationKey: 'status.disposed',
    bgColor: 'bg-slate-600',
    textColor: 'text-white',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-700',
    icon: <XCircle className="h-4 w-4" />,
  },
};

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------
function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '-';
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '-';
  try {
    const d = typeof value === 'string' ? new Date(value) : value;
    if (isNaN(d.getTime())) return '-';
    return d.toISOString().slice(0, 10);
  } catch {
    return '-';
  }
}

// -------------------------------------------------------------------
// API
// -------------------------------------------------------------------
async function fetchAssets(status?: string): Promise<FixedAsset[]> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  const res = await fetch(`/api/accounting/fixed-assets?${params.toString()}`);
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error?.error || 'Failed to fetch fixed assets');
  }
  const data = await res.json();
  return data.data;
}

async function fetchAssetSummary(): Promise<{
  totalAssets: number;
  activeAssets: number;
  totalAcquisitionCost: number;
  totalNetBookValue: number;
}> {
  const res = await fetch('/api/accounting/fixed-assets?summary=true');
  if (!res.ok) {
    return { totalAssets: 0, activeAssets: 0, totalAcquisitionCost: 0, totalNetBookValue: 0 };
  }
  const data = await res.json();
  return data.data;
}

async function fetchCategories(): Promise<AssetCategory[]> {
  const res = await fetch('/api/accounting/asset-categories');
  if (!res.ok) return [];
  const data = await res.json();
  return data.data;
}

async function deleteAsset(id: number): Promise<void> {
  const res = await fetch(`/api/accounting/fixed-assets/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error?.error || 'Failed to delete asset');
  }
}

// -------------------------------------------------------------------
// Main Component
// -------------------------------------------------------------------
export default function FixedAssetsPage() {
  const t = useTranslations('accounting');
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isMobile } = useMobile();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [searchText, setSearchText] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; asset: FixedAsset | null }>({
    open: false,
    asset: null,
  });

  // Always fetch all assets — filter client-side so counts stay accurate per tab
  const { data: allAssets = [], isLoading } = useQuery({
    queryKey: ['fixed-assets'],
    queryFn: () => fetchAssets(),
  });

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['fixed-assets-summary'],
    queryFn: fetchAssetSummary,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['asset-categories'],
    queryFn: fetchCategories,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAsset,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed-assets'] });
      queryClient.invalidateQueries({ queryKey: ['fixed-assets-summary'] });
      notify(t('fixedAssets.toast.deleteSuccess'), 'success', 3000);
      setDeleteConfirm({ open: false, asset: null });
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  const getCategoryName = (categoryId: number): string => {
    const category = categories.find((c) => c.id === categoryId);
    return category?.nameEn || category?.nameTh || '-';
  };

  // Derived: per-status counts
  const statusCounts: Record<StatusFilter, number> = useMemo(() => ({
    '': allAssets.length,
    active: allAssets.filter((a) => a.status === 'active').length,
    fully_depreciated: allAssets.filter((a) => a.status === 'fully_depreciated').length,
    disposed: allAssets.filter((a) => a.status === 'disposed').length,
  }), [allAssets]);

  // Filtered list for display
  const filteredAssets = useMemo(() => {
    let result = allAssets;
    if (statusFilter) {
      result = result.filter((a) => a.status === statusFilter);
    }
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      result = result.filter((a) =>
        (a.assetCode || '').toLowerCase().includes(q) ||
        (a.nameTh || '').toLowerCase().includes(q) ||
        (a.nameEn || '').toLowerCase().includes(q),
      );
    }
    return result;
  }, [allAssets, statusFilter, searchText]);

  // Handlers
  const handleCreate = () => router.push('/accounting/fixed-assets/new');
  const handleView = (asset: FixedAsset) => router.push(`/accounting/fixed-assets/${asset.id}`);
  const handleEdit = (asset: FixedAsset) => router.push(`/accounting/fixed-assets/${asset.id}`);
  const handleDeleteClick = (asset: FixedAsset) => setDeleteConfirm({ open: true, asset });
  const handleClearFilters = () => {
    setSearchText('');
    setStatusFilter('');
  };

  // States
  const showEmptyState = !isLoading && allAssets.length === 0;
  const showNoResultsState = !isLoading && allAssets.length > 0 && filteredAssets.length === 0;

  // ---------------------------------------------------------------
  // Actions cell (desktop DataGrid)
  // ---------------------------------------------------------------
  const renderActionsCell = (cellData: { data: FixedAsset }) => {
    const asset = cellData.data;
    return (
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleView(asset);
          }}
          className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
          title={t('fixedAssets.rowActions.view')}
          aria-label={t('fixedAssets.rowActions.view')}
        >
          <Eye className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleEdit(asset);
          }}
          className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
          title={t('fixedAssets.rowActions.edit')}
          aria-label={t('fixedAssets.rowActions.edit')}
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleDeleteClick(asset);
          }}
          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
          title={t('fixedAssets.rowActions.delete')}
          aria-label={t('fixedAssets.rowActions.delete')}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    );
  };

  const renderStatusCell = (cellData: { data: FixedAsset }) => {
    const status = cellData.data.status as StatusFilter;
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG[''];
    return (
      <span className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold',
        cfg.badgeBg,
        cfg.badgeText,
      )}>
        {cfg.icon}
        <span>{t(`fixedAssets.${cfg.translationKey}`)}</span>
      </span>
    );
  };

  const disposedCount = statusCounts.disposed;

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 max-w-full" data-testid="fixed-assets-page">
      {/* Page Header */}
      <ResponsivePageHeader
        title={t('fixedAssets.title')}
        subtitle={t('fixedAssets.description')}
        icon={Building}
        iconBgColor="bg-slate-100"
        iconColor="text-slate-600"
        breadcrumbs={[
          { label: t('fixedAssets.breadcrumbHome'), href: '/' },
          { label: t('page.title'), href: '/accounting' },
          { label: t('fixedAssets.title') },
        ]}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <DxButton
              icon="refresh"
              text={t('fixedAssets.refresh')}
              stylingMode="outlined"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ['fixed-assets'] });
                queryClient.invalidateQueries({ queryKey: ['fixed-assets-summary'] });
              }}
              className="hidden sm:inline-flex"
            />
            <DxButton
              text={t('fixedAssets.actions.addAsset')}
              icon="plus"
              type="success"
              onClick={handleCreate}
              elementAttr={{ 'data-testid': 'fa-add-btn' }}
            />
          </div>
        }
      />

      {/* KPI Stat Cards (4) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4" data-testid="fa-stats">
        <StatCard
          label={t('fixedAssets.stats.totalAssets')}
          value={summary?.totalAssets ?? allAssets.length}
          icon={Package}
          iconColor="text-slate-500"
          accentColor="border-slate-500"
          isLoading={summaryLoading}
        />
        <StatCard
          label={t('fixedAssets.stats.totalValue')}
          value={formatCurrency(summary?.totalAcquisitionCost)}
          icon={DollarSign}
          iconColor="text-indigo-500"
          accentColor="border-indigo-500"
          isLoading={summaryLoading}
        />
        <StatCard
          label={t('fixedAssets.stats.netBookValue')}
          value={formatCurrency(summary?.totalNetBookValue)}
          icon={TrendingUp}
          iconColor="text-emerald-500"
          accentColor="border-emerald-500"
          isLoading={summaryLoading}
        />
        <StatCard
          label={t('fixedAssets.stats.disposed')}
          value={disposedCount}
          icon={XCircle}
          iconColor="text-gray-400"
          accentColor="border-gray-400"
          isLoading={isLoading}
        />
      </div>

      {/* Asset List Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 min-w-0 overflow-hidden">
        {/* Filter row: status tabs (scroll-snap on mobile) */}
        <div className="px-3 py-3 sm:px-4 border-b border-gray-100 bg-gradient-to-r from-gray-50/50 to-white">
          <div className="flex items-center gap-1 p-1 bg-white border border-gray-200 rounded-lg overflow-x-auto scrollbar-thin snap-x">
            {(Object.keys(STATUS_CONFIG) as StatusFilter[]).map((key) => {
              const cfg = STATUS_CONFIG[key];
              const count = statusCounts[key];
              const active = statusFilter === key;
              return (
                <button
                  key={key || 'all'}
                  type="button"
                  onClick={() => setStatusFilter(key)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 snap-start min-h-[36px]',
                    active
                      ? `${cfg.bgColor} ${cfg.textColor} shadow-sm`
                      : 'text-gray-600 hover:bg-gray-100',
                  )}
                >
                  {cfg.icon}
                  <span>{t(`fixedAssets.${cfg.translationKey}`)}</span>
                  <span className={cn(
                    'ml-1 px-1.5 py-0.5 text-xs rounded-full font-semibold',
                    active ? 'bg-white/25 text-inherit' : 'bg-gray-200 text-gray-700',
                  )}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Search + result count */}
        <div className="px-3 py-3 sm:px-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder={t('fixedAssets.search.placeholder')}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-500 focus:border-slate-500"
            />
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 whitespace-nowrap">
            <Boxes className="h-4 w-4 text-gray-400" />
            <span>
              {filteredAssets.length} / {allAssets.length}
            </span>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          isMobile ? <AssetCardSkeletonList count={4} /> : <DataGridLoadingSkeleton />
        ) : showEmptyState ? (
          <EmptyState onCreate={handleCreate} t={t} />
        ) : showNoResultsState ? (
          <NoResultsState onClear={handleClearFilters} t={t} />
        ) : isMobile ? (
          <AssetCardList
            assets={filteredAssets}
            getCategoryName={getCategoryName}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={handleDeleteClick}
            t={t}
          />
        ) : (
          <div className="fa-compact-grid px-2 pb-1" data-testid="fa-grid">
            <style>{`
              .fa-compact-grid .dx-datagrid-rowsview .dx-row > td {
                padding: 6px 10px !important;
                line-height: 1.4 !important;
              }
              .fa-compact-grid .dx-datagrid-headers .dx-header-row > td {
                padding: 8px 10px !important;
                font-size: 0.72rem;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.04em;
                color: #6b7280;
              }
              .fa-compact-grid .dx-data-row:hover > td {
                background-color: #f1f5f9 !important;
                transition: background-color 0.15s ease;
              }
              .fa-compact-grid .dx-data-row.dx-row-alt > td {
                background-color: #f8fafc;
              }
              .fa-compact-grid .dx-datagrid {
                border: none;
              }
            `}</style>
            <DataGrid
              key={locale}
              dataSource={filteredAssets}
              keyExpr="id"
              showBorders={false}
              showRowLines
              rowAlternationEnabled
              hoverStateEnabled
              columnAutoWidth
              height="auto"
              width="100%"
              onRowClick={(e) => {
                if (e.data?.id) router.push(`/accounting/fixed-assets/${e.data.id}`);
              }}
              className="min-h-[400px]"
            >
              <FilterRow visible />
              <HeaderFilter visible />
              <Sorting mode="multiple" />
              <Paging defaultPageSize={20} />
              <Pager
                showPageSizeSelector
                allowedPageSizes={[10, 20, 50]}
                showInfo
                showNavigationButtons
              />

              <Column
                dataField="assetCode"
                caption={t('fixedAssets.table.columns.assetCode')}
                minWidth={130}
                cellRender={(cell) => (
                  <span className="font-mono font-medium text-slate-700 text-sm">{cell.value}</span>
                )}
              />
              <Column
                dataField="nameTh"
                caption={t('fixedAssets.table.columns.nameTh')}
                minWidth={180}
              />
              <Column
                dataField="nameEn"
                caption={t('fixedAssets.table.columns.nameEn')}
                minWidth={160}
              />
              <Column
                dataField="categoryId"
                caption={t('fixedAssets.table.columns.category')}
                minWidth={130}
                calculateCellValue={(rowData: FixedAsset) => getCategoryName(rowData.categoryId)}
              />
              <Column
                dataField="acquisitionDate"
                caption={t('fixedAssets.table.columns.acquisitionDate')}
                dataType="date"
                format="yyyy-MM-dd"
                width={130}
              />
              <Column
                dataField="acquisitionCost"
                caption={t('fixedAssets.table.columns.acquisitionCost')}
                dataType="number"
                format="#,##0.00"
                width={130}
                alignment="right"
              />
              <Column
                dataField="netBookValue"
                caption={t('fixedAssets.table.columns.currentValue')}
                dataType="number"
                format="#,##0.00"
                width={130}
                alignment="right"
              />
              <Column
                dataField="status"
                caption={t('fixedAssets.table.columns.status')}
                width={150}
                cellRender={renderStatusCell}
              />
              <Column
                caption=""
                width={120}
                cellRender={renderActionsCell}
                allowFiltering={false}
                allowSorting={false}
                alignment="center"
              />
            </DataGrid>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal (fullScreenOnMobile behavior via DxConfirmDialog) */}
      <DxConfirmDialog
        visible={deleteConfirm.open}
        onConfirm={() => deleteConfirm.asset && deleteMutation.mutate(deleteConfirm.asset.id)}
        onCancel={() => setDeleteConfirm({ open: false, asset: null })}
        title={t('fixedAssets.deleteDialog.title')}
        message={
          deleteConfirm.asset
            ? t('fixedAssets.deleteDialog.message', {
                name:
                  deleteConfirm.asset.nameTh ||
                  deleteConfirm.asset.nameEn ||
                  deleteConfirm.asset.assetCode,
              })
            : ''
        }
        confirmText={deleteMutation.isPending ? t('fixedAssets.deleteDialog.deleting') : t('fixedAssets.deleteDialog.confirm')}
        cancelText={t('fixedAssets.deleteDialog.cancel')}
        confirmType="danger"
      />
    </div>
  );
}

// ===================================================================
// Helper Components
// ===================================================================

/** Mobile-first card list — replaces DataGrid on narrow viewports */
function AssetCardList({
  assets,
  getCategoryName,
  onView,
  onEdit,
  onDelete,
  t,
}: {
  assets: FixedAsset[];
  getCategoryName: (categoryId: number) => string;
  onView: (a: FixedAsset) => void;
  onEdit: (a: FixedAsset) => void;
  onDelete: (a: FixedAsset) => void;
  t: TranslateFn;
}) {
  return (
    <div className="p-3 sm:p-4 space-y-3 bg-gray-50/30">
      {assets.map((asset) => {
        const status = asset.status as StatusFilter;
        const cfg = STATUS_CONFIG[status] || STATUS_CONFIG[''];
        return (
          <div
            key={asset.id}
            className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md active:bg-gray-50 transition-all"
          >
            {/* Tap-to-view body */}
            <button
              type="button"
              onClick={() => onView(asset)}
              className="w-full text-left p-4 flex items-start gap-3"
            >
              <div className="h-11 w-11 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                <Building className="h-5 w-5 text-slate-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="min-w-0">
                    <p className="font-mono font-semibold text-gray-900 text-base truncate">
                      {asset.assetCode}
                    </p>
                    <p className="text-sm text-gray-700 truncate mt-0.5" title={asset.nameTh || asset.nameEn || ''}>
                      {asset.nameTh || asset.nameEn || '-'}
                    </p>
                  </div>
                  <span className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold shrink-0',
                    cfg.badgeBg,
                    cfg.badgeText,
                  )}>
                    {cfg.icon}
                    <span>{t(`fixedAssets.${cfg.translationKey}`)}</span>
                  </span>
                </div>

                <p className="text-xs text-gray-600 flex items-center gap-1 mt-1.5">
                  <Layers className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                  <span className="truncate">{getCategoryName(asset.categoryId)}</span>
                </p>

                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {asset.acquisitionDate && (
                    <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                      <Calendar className="h-3 w-3" />
                      {formatDate(asset.acquisitionDate)}
                    </span>
                  )}
                  {asset.acquisitionCost != null && (
                    <span className="inline-flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
                      <DollarSign className="h-3 w-3" />
                      {formatCurrency(Number(asset.acquisitionCost))}
                    </span>
                  )}
                  {asset.netBookValue != null && (
                    <span className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded">
                      <TrendingUp className="h-3 w-3" />
                      {formatCurrency(Number(asset.netBookValue))}
                    </span>
                  )}
                </div>
              </div>
            </button>

            {/* Action footer — 44px touch targets */}
            <div className="flex items-center border-t border-gray-100 divide-x divide-gray-100">
              <button
                type="button"
                onClick={() => onView(asset)}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 active:bg-indigo-100 transition-colors min-h-[44px]"
              >
                <Eye className="h-4 w-4" />
                <span>{t('fixedAssets.cardActions.view')}</span>
              </button>
              <button
                type="button"
                onClick={() => onEdit(asset)}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 active:bg-emerald-100 transition-colors min-h-[44px]"
              >
                <Pencil className="h-4 w-4" />
                <span>{t('fixedAssets.cardActions.edit')}</span>
              </button>
              <button
                type="button"
                onClick={() => onDelete(asset)}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-gray-700 hover:bg-red-50 hover:text-red-700 active:bg-red-100 transition-colors min-h-[44px]"
              >
                <Trash2 className="h-4 w-4" />
                <span>{t('fixedAssets.cardActions.delete')}</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Loading skeleton for mobile card list */
function AssetCardSkeletonList({ count = 3 }: { count?: number }) {
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

/** Empty State — zero assets at all */
function EmptyState({ onCreate, t }: { onCreate: () => void; t: TranslateFn }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="h-20 w-20 rounded-2xl bg-slate-100 flex items-center justify-center mb-5">
        <Building className="h-10 w-10 text-slate-600" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('fixedAssets.empty.title')}</h3>
      <p className="text-sm text-gray-500 max-w-sm mb-6">
        {t('fixedAssets.empty.description')}
      </p>
      <DxButton text={t('fixedAssets.actions.addAsset')} icon="plus" type="success" onClick={onCreate} />
    </div>
  );
}

/** No Results State — filters/search yielded nothing */
function NoResultsState({ onClear, t }: { onClear: () => void; t: TranslateFn }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
      <div className="h-16 w-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <SearchX className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">{t('fixedAssets.noResults.title')}</h3>
      <p className="text-sm text-gray-500 max-w-sm mb-4">
        {t('fixedAssets.noResults.description')}
      </p>
      <DxButton text={t('fixedAssets.actions.clearFilters')} icon="clear" stylingMode="outlined" onClick={onClear} />
    </div>
  );
}
