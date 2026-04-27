'use client';

/**
 * Landed Costs List Page
 * Feature: 014-unit-cost
 *
 * Responsive patterns:
 * - ResponsivePageHeader with Truck icon (cyan tone)
 * - StatCard row (Total / Draft / Allocated / Posted / Total Value)
 * - Status filter chips + search bar
 * - MobileListView replaces DataGrid on <md
 * - Skeleton loading, empty + error states with retry
 */

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslations, useLocale } from 'next-intl';
import DataGrid, {
  Column,
  Paging,
  Pager,
  FilterRow,
  Sorting,
  SearchPanel,
} from 'devextreme-react/data-grid';
import { Button } from 'devextreme-react/button';
import { TextBox } from 'devextreme-react/text-box';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsivePageHeader, StatCard, MobileListView } from '@/components/shared';
import { useMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils/cn';
import {
  Truck,
  Eye,
  FileCheck,
  AlertCircle,
  DollarSign,
  Inbox,
  FileText,
} from 'lucide-react';
import type { LandedCostHeader, LandedCostListFilters } from '@/types/unit-cost';

interface ListResult {
  data: LandedCostHeader[];
  total: number;
  page: number;
  pageSize: number;
}

async function fetchLandedCosts(filters: LandedCostListFilters): Promise<ListResult> {
  const params = new URLSearchParams();
  if (filters.status) params.append('status', filters.status);
  if (filters.search) params.append('search', filters.search);
  if (filters.page) params.append('page', filters.page.toString());
  if (filters.pageSize) params.append('pageSize', filters.pageSize.toString());

  const res = await fetch(`/api/cost/landed-costs?${params}`);
  if (!res.ok) throw new Error('Failed to fetch landed costs');
  const json = await res.json();
  return json.data;
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatCurrencyShort(value: number | null | undefined): string {
  const n = Number(value) || 0;
  if (n >= 1_000_000) return `฿${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `฿${(n / 1_000).toFixed(0)}K`;
  return `฿${n.toFixed(0)}`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const statusColors: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  allocated: 'bg-blue-100 text-blue-800 border-blue-200',
  posted: 'bg-green-100 text-green-800 border-green-200',
};

type StatusFilter = '' | 'draft' | 'allocated' | 'posted';

export default function LandedCostsPage() {
  const router = useRouter();
  const t = useTranslations('cost');
  const locale = useLocale();
  const { isMobile } = useMobile();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [search, setSearch] = useState('');

  const { data, error, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['landed-costs', page, pageSize, statusFilter, search],
    queryFn: () =>
      fetchLandedCosts({
        page,
        pageSize,
        status: statusFilter || undefined,
        search: search || undefined,
      }),
    staleTime: 30000,
  });

  const landedCosts = data?.data || [];
  const total = data?.total || 0;

  // Compute stats from full data set (within current filtered view)
  const stats = useMemo(() => {
    const draft = landedCosts.filter((lc) => lc.status === 'draft').length;
    const allocated = landedCosts.filter((lc) => lc.status === 'allocated').length;
    const posted = landedCosts.filter((lc) => lc.status === 'posted').length;
    const totalValue = landedCosts.reduce((sum, lc) => sum + (Number(lc.totalAmount) || 0), 0);
    return { draft, allocated, posted, totalValue };
  }, [landedCosts]);

  const handleRowClick = (e: { data: LandedCostHeader }) => {
    router.push(`/cost/landed-costs/${e.data.id}`);
  };

  const filterChips: Array<{ key: StatusFilter; translationKey: string; count: number; activeBg: string }> = useMemo(() => [
    { key: '', translationKey: 'landedCosts.filter.all', count: total, activeBg: 'bg-gray-800' },
    { key: 'draft', translationKey: 'landedCosts.filter.draft', count: stats.draft, activeBg: 'bg-yellow-500' },
    { key: 'allocated', translationKey: 'landedCosts.filter.allocated', count: stats.allocated, activeBg: 'bg-blue-500' },
    { key: 'posted', translationKey: 'landedCosts.filter.posted', count: stats.posted, activeBg: 'bg-green-500' },
  ], [total, stats.draft, stats.allocated, stats.posted]);

  // Mobile card renderer
  const renderMobileCard = (item: LandedCostHeader) => (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:border-cyan-300 active:scale-[0.99] transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-4 w-4 text-cyan-500 flex-shrink-0" />
            <p className="font-semibold text-gray-900 truncate">{item.documentNumber}</p>
          </div>
          {item.referenceNumber && (
            <p className="text-xs text-gray-500 truncate">{t('landedCosts.grid.mobile.poPrefix')}: {item.referenceNumber}</p>
          )}
          {item.invoiceNumber && (
            <p className="text-xs text-gray-500 truncate">{t('landedCosts.grid.mobile.invoicePrefix')}: {item.invoiceNumber}</p>
          )}
        </div>
        <span
          className={cn(
            'px-2 py-0.5 rounded-full text-xs font-medium border flex-shrink-0',
            statusColors[item.status] || 'bg-gray-100 text-gray-800 border-gray-200'
          )}
        >
          {t(`landedCosts.status.${item.status}`)}
        </span>
      </div>
      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500">{t('landedCosts.grid.columns.totalAmount')}</p>
          <p className="text-base font-bold text-gray-900">
            {formatCurrency(item.totalAmount)} {item.currency}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">{t('landedCosts.grid.columns.created')}</p>
          <p className="text-sm text-gray-700">{formatDate(item.createdAt)}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6" data-testid="landed-costs-page">
      <ResponsivePageHeader
        title={t('landedCosts.page.title')}
        icon={Truck}
        iconBgColor="bg-cyan-100"
        iconColor="text-cyan-600"
        subtitle={t('landedCosts.page.description')}
        actions={
          <>
            <Button
              text={isFetching ? t('landedCosts.loading') : ''}
              icon="refresh"
              stylingMode="outlined"
              onClick={() => refetch()}
              disabled={isFetching}
              hint={t('landedCosts.retry')}
              data-testid="refresh-btn"
            />
            <Button
              text={t('landedCosts.actions.new')}
              icon="plus"
              type="default"
              onClick={() => router.push('/cost/landed-costs/new')}
              data-testid="new-landed-cost-btn"
            />
          </>
        }
      />

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard
          label={t('landedCosts.stats.total')}
          value={total}
          icon={FileText}
          iconColor="text-gray-500"
          accentColor="border-gray-500"
          isLoading={isLoading}
        />
        <StatCard
          label={t('landedCosts.stats.draft')}
          value={stats.draft}
          icon={AlertCircle}
          iconColor="text-yellow-500"
          accentColor="border-yellow-500"
          isLoading={isLoading}
          onClick={() => setStatusFilter(statusFilter === 'draft' ? '' : 'draft')}
        />
        <StatCard
          label={t('landedCosts.stats.allocated')}
          value={stats.allocated}
          icon={Eye}
          iconColor="text-blue-500"
          accentColor="border-blue-500"
          isLoading={isLoading}
          onClick={() => setStatusFilter(statusFilter === 'allocated' ? '' : 'allocated')}
        />
        <StatCard
          label={t('landedCosts.stats.posted')}
          value={stats.posted}
          icon={FileCheck}
          iconColor="text-green-500"
          accentColor="border-green-500"
          isLoading={isLoading}
          onClick={() => setStatusFilter(statusFilter === 'posted' ? '' : 'posted')}
        />
        <StatCard
          label={t('landedCosts.stats.totalValue')}
          value={formatCurrencyShort(stats.totalValue)}
          icon={DollarSign}
          iconColor="text-cyan-500"
          accentColor="border-cyan-500"
          isLoading={isLoading}
          className="col-span-2 lg:col-span-1"
        />
      </div>

      {/* Search + Filter chips */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 min-w-0">
              <TextBox
                value={search}
                onValueChanged={(e) => {
                  setSearch(e.value || '');
                  setPage(1);
                }}
                placeholder={t('landedCosts.search.placeholder')}
                mode="search"
                showClearButton
                data-testid="search-input"
              />
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scroll-snap-x">
            {filterChips.map((chip) => {
              const active = statusFilter === chip.key;
              return (
                <button
                  key={chip.key}
                  onClick={() => {
                    setStatusFilter(chip.key);
                    setPage(1);
                  }}
                  className={cn(
                    'flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors flex items-center gap-2 scroll-snap-align-start',
                    active
                      ? `${chip.activeBg} text-white border-transparent`
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  )}
                  data-testid={`filter-chip-${chip.key || 'all'}`}
                >
                  <span>{t(chip.translationKey)}</span>
                  <span
                    className={cn(
                      'px-1.5 py-0.5 rounded text-xs font-semibold',
                      active ? 'bg-white/25' : 'bg-gray-100'
                    )}
                  >
                    {chip.count}
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Data Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-cyan-500" />
            {t('landedCosts.grid.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center" data-testid="error-state">
              <div className="h-14 w-14 rounded-full bg-red-100 flex items-center justify-center mb-3">
                <AlertCircle className="h-7 w-7 text-red-600" />
              </div>
              <p className="text-red-600 font-medium mb-1">{t('landedCosts.errors.loadFailed')}</p>
              <p className="text-sm text-gray-500 mb-4">{(error as Error).message}</p>
              <Button
                text={t('landedCosts.retry')}
                icon="refresh"
                type="default"
                onClick={() => refetch()}
              />
            </div>
          ) : isLoading ? (
            <div className="space-y-3" data-testid="loading-skeleton">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 rounded-lg bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : landedCosts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center" data-testid="empty-state">
              <div className="h-16 w-16 rounded-full bg-cyan-100 flex items-center justify-center mb-3">
                <Inbox className="h-8 w-8 text-cyan-600" />
              </div>
              <p className="text-lg font-semibold text-gray-900 mb-1">
                {search || statusFilter
                  ? t('landedCosts.empty.title')
                  : t('landedCosts.empty.title')}
              </p>
              <p className="text-sm text-gray-500 max-w-sm mb-4">
                {t('landedCosts.empty.description')}
              </p>
              <Button
                text={t('landedCosts.actions.new')}
                icon="plus"
                type="default"
                onClick={() => router.push('/cost/landed-costs/new')}
              />
            </div>
          ) : isMobile ? (
            <MobileListView
              items={landedCosts}
              keyExpr="id"
              renderCard={renderMobileCard}
              onItemClick={(item) => router.push(`/cost/landed-costs/${item.id}`)}
              emptyMessage={t('landedCosts.empty.title')}
              gap="md"
            />
          ) : (
            <DataGrid
              key={locale}
              dataSource={landedCosts}
              showBorders
              columnAutoWidth
              rowAlternationEnabled
              onRowClick={handleRowClick}
              hoverStateEnabled
              onOptionChanged={(e) => {
                if (e.name === 'paging' && e.fullName === 'paging.pageIndex') {
                  setPage((e.value as number) + 1);
                }
                if (e.name === 'paging' && e.fullName === 'paging.pageSize') {
                  setPageSize(e.value as number);
                  setPage(1);
                }
              }}
              data-testid="landed-costs-grid"
            >
              <FilterRow visible />
              <SearchPanel visible={false} />
              <Sorting mode="single" />

              <Column
                dataField="documentNumber"
                caption={t('landedCosts.grid.columns.documentNumber')}
                width={150}
              />
              <Column
                dataField="referenceNumber"
                caption={t('landedCosts.grid.columns.referenceNumber')}
                width={130}
              />
              <Column
                dataField="invoiceNumber"
                caption={t('landedCosts.grid.columns.invoiceNumber')}
                width={130}
              />
              <Column
                dataField="status"
                caption={t('landedCosts.grid.columns.status')}
                width={120}
                cellRender={({ data }) => (
                  <span
                    className={cn(
                      'px-2 py-1 rounded-full text-xs font-medium border',
                      statusColors[data.status] || 'bg-gray-100 text-gray-800 border-gray-200'
                    )}
                  >
                    {t(`landedCosts.status.${data.status}`)}
                  </span>
                )}
              />
              <Column
                dataField="totalAmount"
                caption={t('landedCosts.grid.columns.totalAmount')}
                dataType="number"
                width={140}
                cellRender={({ data }) => (
                  <span className="font-mono font-medium">
                    {formatCurrency(data.totalAmount)} {data.currency}
                  </span>
                )}
              />
              <Column
                dataField="createdAt"
                caption={t('landedCosts.grid.columns.created')}
                width={120}
                cellRender={({ data }) => formatDate(data.createdAt)}
              />
              <Column
                dataField="postedAt"
                caption={t('landedCosts.grid.columns.posted')}
                width={120}
                cellRender={({ data }) => formatDate(data.postedAt)}
              />

              <Paging enabled pageSize={pageSize} pageIndex={page - 1} />
              <Pager
                visible
                showPageSizeSelector
                allowedPageSizes={[10, 20, 50]}
                showInfo
                infoText={t('landedCosts.grid.pagerInfo', { from: '{0}', to: '{1}', total })}
              />
            </DataGrid>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
