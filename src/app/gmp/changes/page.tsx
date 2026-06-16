'use client';

/**
 * Change Control List Page
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 8)
 *
 * Responsive dashboard for managing GMP change requests.
 * - ResponsivePageHeader + 4 KPI StatCards
 * - Tabs filter by status (scroll-snap on mobile)
 * - Search input + result count
 * - DataGrid on desktop, mobile card list on <md screens
 * - Empty / No-results / Loading states
 */

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import DataGrid, {
  Column,
  Paging,
  Pager,
  SearchPanel,
  Sorting,
  LoadPanel,
  StateStoring,
} from 'devextreme-react/data-grid';
import { DxButton } from '@/components/ui/dx-button';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { useMobile } from '@/hooks/use-mobile';
import { WorkflowStatusBadge } from '@/components/shared/WorkflowStatusBadge';
import { cn } from '@/lib/utils/cn';
import {
  FileEdit,
  Clock,
  CheckCircle,
  Eye,
  Search,
  RefreshCw,
  GitBranch,
  ClipboardList,
  AlertTriangle,
  Calendar,
  User,
  Boxes,
  SearchX,
  ChevronRight,
  Archive,
  Zap,
} from 'lucide-react';
import type {
  ChangeRequest,
  ChangeStatus,
  ChangeType,
  ChangePriority,
} from '@/types/change-control';

// ============================================
// Types
// ============================================

interface ChangeDashboard {
  total: number;
  byStatus: Record<ChangeStatus, number>;
  byPriority: Record<ChangePriority, number>;
  byType: Record<ChangeType, number>;
}

// next-intl translator superset type
type TranslateFn = (key: string, values?: Record<string, string | number | Date>) => string;

// ============================================
// API Functions
// ============================================

async function fetchChangeRequests(): Promise<{ changes: ChangeRequest[]; total: number }> {
  const response = await fetch('/api/changes?limit=1000');
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch change requests');
  }
  return result.data;
}

// ============================================
// Constants
// ============================================

type StatusFilter = '' | ChangeStatus;

const STATUS_TABS: Array<{ key: StatusFilter; translationKey: string }> = [
  { key: '', translationKey: 'all' },
  { key: 'draft', translationKey: 'draft' },
  { key: 'pending_review', translationKey: 'pending_review' },
  { key: 'approved', translationKey: 'approved' },
  { key: 'implemented', translationKey: 'implemented' },
  { key: 'closed', translationKey: 'closed' },
  { key: 'rejected', translationKey: 'rejected' },
];

const PRIORITY_COLORS: Record<ChangePriority, string> = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-800',
};

const TYPE_LABEL_KEYS: Record<ChangeType, string> = {
  process: 'process',
  equipment: 'equipment',
  document: 'document',
  supplier: 'supplier',
  formula: 'formula',
  other: 'other',
};

// ============================================
// Helpers
// ============================================

function calculateDashboard(changes: ChangeRequest[]): ChangeDashboard {
  const byStatus: Record<string, number> = {};
  const byPriority: Record<string, number> = {};
  const byType: Record<string, number> = {};

  changes.forEach((change) => {
    byStatus[change.status] = (byStatus[change.status] || 0) + 1;
    byPriority[change.priority] = (byPriority[change.priority] || 0) + 1;
    byType[change.changeType] = (byType[change.changeType] || 0) + 1;
  });

  return {
    total: changes.length,
    byStatus: byStatus as Record<ChangeStatus, number>,
    byPriority: byPriority as Record<ChangePriority, number>,
    byType: byType as Record<ChangeType, number>,
  };
}

function formatDateShort(value: string | null | undefined): string {
  if (!value) return '-';
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '-';
  }
}

function isOverdue(value: string | null | undefined, status: ChangeStatus): boolean {
  if (!value) return false;
  if (status === 'implemented' || status === 'closed' || status === 'rejected') return false;
  try {
    const d = new Date(value);
    return !isNaN(d.getTime()) && d < new Date();
  } catch {
    return false;
  }
}

// ============================================
// Main Component
// ============================================

export default function ChangeControlListPage() {
  const router = useRouter();
  const t = useTranslations('gmp');
  const tCommon = useTranslations('common');
  const { isMobile } = useMobile();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [searchText, setSearchText] = useState('');

  // Fetch all change requests
  const { data: changesData, isLoading, refetch } = useQuery({
    queryKey: ['changes-all'],
    queryFn: fetchChangeRequests,
  });

  // Calculate dashboard stats
  const dashboard = useMemo(() => {
    if (!changesData?.changes) return null;
    return calculateDashboard(changesData.changes);
  }, [changesData?.changes]);

  // Filter changes based on tab + search
  const filteredChanges = useMemo(() => {
    const all = changesData?.changes || [];
    let result = all;
    if (statusFilter) {
      result = result.filter((c) => c.status === statusFilter);
    }
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      result = result.filter((c) =>
        (c.changeNumber || '').toLowerCase().includes(q) ||
        (c.title || '').toLowerCase().includes(q) ||
        (c.ownerName || '').toLowerCase().includes(q) ||
        (c.requesterName || '').toLowerCase().includes(q)
      );
    }
    return result.map((item, index) => ({ ...item, _rowNumber: index + 1 }));
  }, [changesData?.changes, statusFilter, searchText]);

  const totalCount = changesData?.changes?.length || 0;

  // Counts per tab status
  const tabCounts = useMemo<Record<StatusFilter, number>>(() => {
    const base = {
      '': totalCount,
      draft: 0,
      pending_review: 0,
      approved: 0,
      implemented: 0,
      closed: 0,
      rejected: 0,
    } as Record<StatusFilter, number>;
    changesData?.changes?.forEach((c) => {
      if (c.status in base) {
        base[c.status as StatusFilter] = (base[c.status as StatusFilter] || 0) + 1;
      }
    });
    return base;
  }, [changesData?.changes, totalCount]);

  // Handlers
  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleRowClick = useCallback((e: { data: ChangeRequest }) => {
    router.push(`/gmp/changes/${e.data.id}`);
  }, [router]);

  const handleNewChange = useCallback(() => {
    router.push('/gmp/changes/new');
  }, [router]);

  const handleView = useCallback((id: number) => {
    router.push(`/gmp/changes/${id}`);
  }, [router]);

  const handleClearFilters = useCallback(() => {
    setSearchText('');
    setStatusFilter('');
  }, []);

  // Cell renderers
  const renderStatus = useCallback((cellData: { value: ChangeStatus }) => {
    return <WorkflowStatusBadge status={cellData.value} />;
  }, []);

  const renderChangeNumber = useCallback((cellData: { data: ChangeRequest }) => {
    return (
      <div className="flex items-center gap-2">
        <FileEdit className="w-4 h-4 text-sky-600" />
        <span className="font-mono text-sm font-medium">{cellData.data.changeNumber}</span>
      </div>
    );
  }, []);

  const renderPriority = useCallback((cellData: { value: ChangePriority }) => {
    const v = cellData.value;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium uppercase ${PRIORITY_COLORS[v] || ''}`}>
        {t(`changes.priority.${v}`)}
      </span>
    );
  }, [t]);

  const renderChangeType = useCallback((cellData: { value: ChangeType }) => {
    const key = TYPE_LABEL_KEYS[cellData.value] || 'other';
    return <span className="capitalize">{t(`changes.type.${key}`)}</span>;
  }, [t]);

  const renderTargetDate = useCallback((cellData: { value: string | null; data: ChangeRequest }) => {
    if (!cellData.value) return <span className="text-gray-400">-</span>;
    const overdue = isOverdue(cellData.value, cellData.data.status);
    return (
      <span className={overdue ? 'text-red-600 font-medium' : ''}>
        {formatDateShort(cellData.value)}
      </span>
    );
  }, []);

  const renderActions = useCallback((cellData: { data: ChangeRequest }) => {
    return (
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleView(cellData.data.id);
          }}
          className="p-1.5 hover:bg-indigo-50 hover:text-indigo-600 text-gray-500 rounded-md transition-colors"
          title={t('changes.actions.viewChange')}
          aria-label={t('changes.actions.viewChange')}
        >
          <Eye className="w-4 h-4" />
        </button>
      </div>
    );
  }, [handleView, t]);

  // State flags
  const showEmptyState = !isLoading && totalCount === 0;
  const showNoResultsState = !isLoading && totalCount > 0 && filteredChanges.length === 0;

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 max-w-full">
      {/* Responsive Page Header */}
      <ResponsivePageHeader
        title={t('changes.pageTitle')}
        subtitle={t('changes.subtitle')}
        icon={GitBranch}
        iconBgColor="bg-sky-100"
        iconColor="text-sky-600"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <DxButton
              icon="refresh"
              text={t('changes.actions.refresh')}
              stylingMode="outlined"
              onClick={handleRefresh}
              className="hidden sm:inline-flex"
            />
            <DxButton
              icon="chart"
              text={t('changes.actions.analytics')}
              stylingMode="outlined"
              onClick={handleRefresh}
              className="hidden md:inline-flex"
            />
            <DxButton
              icon="plus"
              text={t('changes.actions.newChange')}
              type="success"
              onClick={handleNewChange}
            />
          </div>
        }
      />

      {/* KPI Stat Cards - 4 cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          label={t('changes.stats.totalChanges')}
          value={dashboard?.total ?? 0}
          icon={ClipboardList}
          iconColor="text-sky-500"
          accentColor="border-sky-500"
          isLoading={isLoading}
        />
        <StatCard
          label={t('changes.stats.pendingReview')}
          value={dashboard?.byStatus?.pending_review ?? 0}
          icon={Clock}
          iconColor="text-amber-500"
          accentColor="border-amber-500"
          isLoading={isLoading}
          onClick={() => setStatusFilter('pending_review')}
        />
        <StatCard
          label={t('changes.stats.approved')}
          value={dashboard?.byStatus?.approved ?? 0}
          icon={CheckCircle}
          iconColor="text-emerald-500"
          accentColor="border-emerald-500"
          isLoading={isLoading}
          onClick={() => setStatusFilter('approved')}
        />
        <StatCard
          label={t('changes.stats.urgentCount')}
          value={dashboard?.byPriority?.urgent ?? 0}
          icon={Zap}
          iconColor="text-red-500"
          accentColor="border-red-500"
          isLoading={isLoading}
        />
      </div>

      {/* DataGrid Card */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {/* Tabs */}
        <div className="px-3 py-3 sm:px-4 border-b border-gray-100 bg-gradient-to-r from-gray-50/50 to-white">
          <div className="flex items-center gap-1 p-1 bg-white border border-gray-200 rounded-lg overflow-x-auto scrollbar-thin snap-x">
            {STATUS_TABS.map((tab) => {
              const isActive = statusFilter === tab.key;
              const count = tabCounts[tab.key] ?? 0;
              return (
                <button
                  key={tab.key || 'all'}
                  type="button"
                  onClick={() => setStatusFilter(tab.key)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 snap-start min-h-[36px]',
                    isActive
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100'
                  )}
                >
                  <span>{t(`changes.tabs.${tab.translationKey}`)}</span>
                  <span
                    className={cn(
                      'ml-1 px-1.5 py-0.5 text-xs rounded-full font-semibold',
                      isActive ? 'bg-white/25 text-white' : 'bg-gray-200 text-gray-700'
                    )}
                  >
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
              placeholder={t('changes.search.placeholder')}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500"
            />
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 whitespace-nowrap">
            <Boxes className="h-4 w-4 text-gray-400" />
            <span>
              {t('changes.resultCount', {
                count: filteredChanges.length,
                total: totalCount,
              })}
            </span>
          </div>
        </div>

        {/* Content area */}
        {isLoading ? (
          isMobile ? (
            <ChangeCardSkeletonList count={4} />
          ) : (
            <DataGridLoadingSkeleton />
          )
        ) : showEmptyState ? (
          <EmptyState onCreate={handleNewChange} t={t} />
        ) : showNoResultsState ? (
          <NoResultsState onClear={handleClearFilters} t={t} tCommon={tCommon} />
        ) : isMobile ? (
          <ChangeCardList
            changes={filteredChanges}
            onView={handleView}
            t={t}
          />
        ) : (
          <div className="px-2 pb-2">
            <DataGrid
              dataSource={filteredChanges}
              keyExpr="id"
              showBorders={false}
              showRowLines={true}
              showColumnLines={false}
              rowAlternationEnabled={true}
              hoverStateEnabled={true}
              onRowClick={handleRowClick}
              wordWrapEnabled={false}
              columnAutoWidth={true}
              height="calc(100vh - 420px)"
              className="dx-card-grid"
            >
              <LoadPanel enabled={true} />
              <StateStoring enabled={true} type="localStorage" storageKey="changeControlGridState" />
              <SearchPanel visible={false} />
              <Sorting mode="multiple" />
              <Paging defaultPageSize={20} />
              <Pager
                showPageSizeSelector={true}
                allowedPageSizes={[10, 20, 50, 100]}
                showInfo={true}
                showNavigationButtons={true}
              />

              <Column
                dataField="_rowNumber"
                caption={t('items.grid.columns.rowNum')}
                width={60}
                alignment="center"
                allowFiltering={false}
                allowSorting={false}
                allowGrouping={false}
                cellRender={(cellInfo) => (
                  <span className="text-gray-500 text-sm font-medium">
                    {cellInfo.data._rowNumber}
                  </span>
                )}
              />
              <Column
                dataField="changeNumber"
                caption={t('changes.table.columns.changeNumber')}
                minWidth={150}
                fixed={true}
                cellRender={renderChangeNumber}
              />
              <Column
                dataField="title"
                caption={t('changes.table.columns.title')}
                minWidth={250}
              />
              <Column
                dataField="changeType"
                caption={t('changes.table.columns.type')}
                minWidth={120}
                cellRender={renderChangeType}
              />
              <Column
                dataField="priority"
                caption={t('changes.table.columns.priority')}
                minWidth={110}
                alignment="center"
                cellRender={renderPriority}
              />
              <Column
                dataField="status"
                caption={t('changes.table.columns.status')}
                minWidth={140}
                cellRender={renderStatus}
              />
              <Column
                dataField="ownerName"
                caption={t('changes.table.columns.owner')}
                minWidth={150}
              />
              <Column
                dataField="targetDate"
                caption={t('changes.table.columns.targetDate')}
                minWidth={140}
                dataType="date"
                cellRender={renderTargetDate}
              />
              <Column
                dataField="createdAt"
                caption={t('changes.table.columns.created')}
                minWidth={130}
                dataType="date"
                format="dd MMM yyyy"
                sortOrder="desc"
              />
              <Column
                caption={t('changes.table.columns.actions')}
                width={80}
                cellRender={renderActions}
                allowFiltering={false}
                allowSorting={false}
              />
            </DataGrid>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Helper Sub-Components
// ============================================

/** Mobile Card List — replaces DataGrid on mobile viewports. */
function ChangeCardList({
  changes,
  onView,
  t,
}: {
  changes: ChangeRequest[];
  onView: (id: number) => void;
  t: TranslateFn;
}) {
  return (
    <div className="p-3 sm:p-4 space-y-3 bg-gray-50/30">
      {changes.map((c) => {
        const overdue = isOverdue(c.targetDate, c.status);
        const priorityClass = PRIORITY_COLORS[c.priority] || 'bg-gray-100 text-gray-800';
        return (
          <div
            key={c.id}
            className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md active:bg-gray-50 transition-all"
          >
            {/* Card body: tap anywhere to view */}
            <button
              type="button"
              onClick={() => onView(c.id)}
              className="w-full text-left p-4 flex items-start gap-3"
            >
              <div className="h-11 w-11 rounded-xl bg-sky-100 flex items-center justify-center flex-shrink-0">
                <GitBranch className="h-5 w-5 text-sky-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-gray-500">{c.changeNumber}</p>
                    <p className="font-semibold text-gray-900 text-base truncate mt-0.5" title={c.title}>
                      {c.title}
                    </p>
                  </div>
                  <WorkflowStatusBadge status={c.status} />
                </div>

                {/* Owner */}
                {c.ownerName && (
                  <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                    <User className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                    <span className="truncate">{c.ownerName}</span>
                  </p>
                )}

                {/* Tags row */}
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded font-medium uppercase ${priorityClass}`}>
                    {t(`changes.priority.${c.priority}`)}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded capitalize">
                    {t(`changes.type.${TYPE_LABEL_KEYS[c.changeType] || 'other'}`)}
                  </span>
                  {c.targetDate && (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded',
                        overdue ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'
                      )}
                    >
                      {overdue ? <AlertTriangle className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
                      {formatDateShort(c.targetDate)}
                      {overdue && <span className="ml-1">· {t('changes.overdue')}</span>}
                    </span>
                  )}
                </div>
              </div>
            </button>

            {/* Card footer: single CTA — touch-friendly 44px */}
            <button
              type="button"
              onClick={() => onView(c.id)}
              className="w-full flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-gray-700 border-t border-gray-100 hover:bg-sky-50 hover:text-sky-700 active:bg-sky-100 transition-colors min-h-[44px]"
            >
              <Eye className="h-4 w-4" />
              <span>{t('changes.actions.viewChange')}</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** Loading skeleton for mobile card list */
function ChangeCardSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="p-3 sm:p-4 space-y-3 bg-gray-50/30" aria-busy="true" aria-live="polite">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 animate-pulse">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-xl bg-gray-200 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/4 bg-gray-200 rounded" />
              <div className="h-4 w-2/3 bg-gray-200 rounded" />
              <div className="h-3 w-1/3 bg-gray-200 rounded" />
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

/** Empty State — shown when there are zero change requests at all */
function EmptyState({ onCreate, t }: { onCreate: () => void; t: TranslateFn }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="h-20 w-20 rounded-2xl bg-sky-100 flex items-center justify-center mb-5">
        <Archive className="h-10 w-10 text-sky-600" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        {t('changes.empty.title')}
      </h3>
      <p className="text-sm text-gray-500 max-w-sm mb-6">
        {t('changes.empty.description')}
      </p>
      <DxButton
        text={t('changes.actions.newChange')}
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
        {t('changes.noResults.title')}
      </h3>
      <p className="text-sm text-gray-500 max-w-sm mb-4">
        {t('changes.noResults.description')}
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
