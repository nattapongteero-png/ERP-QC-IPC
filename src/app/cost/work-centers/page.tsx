'use client';

/**
 * Work Centers List Page
 * Feature: 014-unit-cost (US6 - Work Center Configuration)
 *
 * Responsive patterns:
 * - ResponsivePageHeader with Factory icon (emerald tone)
 * - StatCard row (Total / Active / Inactive / Avg Rate)
 * - Status filter chips + search bar
 * - MobileListView replaces DataGrid on <md
 * - Skeleton loading, empty + error states with retry
 */

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations, useLocale } from 'next-intl';
import DataGrid, {
  Column,
  Paging,
  Pager,
  Sorting,
} from 'devextreme-react/data-grid';
import { Button } from 'devextreme-react/button';
import { TextBox } from 'devextreme-react/text-box';
import notify from 'devextreme/ui/notify';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsivePageHeader, StatCard, MobileListView } from '@/components/shared';
import { useMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils/cn';
import {
  Factory,
  CheckCircle,
  XCircle,
  DollarSign,
  Inbox,
  AlertCircle,
  Layers,
} from 'lucide-react';
import type { WorkCenter } from '@/types/unit-cost';

interface ListResult {
  data: WorkCenter[];
  total: number;
  page: number;
  pageSize: number;
}

async function fetchWorkCenters(
  page: number,
  pageSize: number,
  isActive?: boolean,
  search?: string,
): Promise<ListResult> {
  const params = new URLSearchParams();
  params.append('page', page.toString());
  params.append('pageSize', pageSize.toString());
  if (isActive !== undefined) params.append('isActive', isActive.toString());
  if (search) params.append('search', search);

  const res = await fetch(`/api/cost/work-centers?${params}`);
  if (!res.ok) throw new Error('Failed to fetch work centers');
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

type ActiveFilter = 'all' | 'active' | 'inactive';

export default function WorkCentersPage() {
  const router = useRouter();
  const t = useTranslations('cost');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const { isMobile } = useMobile();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');
  const [search, setSearch] = useState('');

  const isActive = activeFilter === 'all' ? undefined : activeFilter === 'active';

  const { data, error, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['work-centers', page, pageSize, isActive, search],
    queryFn: () => fetchWorkCenters(page, pageSize, isActive, search || undefined),
    staleTime: 30000,
  });

  const workCenters = data?.data || [];
  const total = data?.total || 0;

  // Add row sequence numbers for grid display
  const workCentersWithRowNum = useMemo(
    () => workCenters.map((item, index) => ({ ...item, _rowNumber: index + 1 })),
    [workCenters],
  );

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/cost/work-centers/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Failed to delete work center');
      }
      return res.json();
    },
    onSuccess: () => {
      notify(t('workCenters.toast.deleteSuccess'), 'success', 3000);
      queryClient.invalidateQueries({ queryKey: ['work-centers'] });
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  const handleRowClick = (e: { data: WorkCenter }) => {
    router.push(`/cost/work-centers/${e.data.id}`);
  };

  const handleDelete = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (window.confirm(t('workCenters.actions.deleteConfirm'))) {
      deleteMutation.mutate(id);
    }
  };

  // Stats
  const stats = useMemo(() => {
    const active = workCenters.filter((wc) => wc.isActive).length;
    const inactive = workCenters.filter((wc) => !wc.isActive).length;
    const avgTotalRate =
      workCenters.length > 0
        ? workCenters.reduce(
            (sum, wc) =>
              sum + wc.laborRatePerHour + wc.overheadRatePerHour + wc.machineRatePerHour,
            0,
          ) / workCenters.length
        : 0;
    return { active, inactive, avgTotalRate };
  }, [workCenters]);

  const filterChips: Array<{ key: ActiveFilter; translationKey: string; count: number; activeBg: string }> = useMemo(() => [
    { key: 'all', translationKey: 'workCenters.filter.all', count: total, activeBg: 'bg-gray-800' },
    { key: 'active', translationKey: 'workCenters.filter.active', count: stats.active, activeBg: 'bg-emerald-500' },
    { key: 'inactive', translationKey: 'workCenters.filter.inactive', count: stats.inactive, activeBg: 'bg-gray-500' },
  ], [total, stats.active, stats.inactive]);

  const renderMobileCard = (item: WorkCenter) => {
    const totalRate =
      item.laborRatePerHour + item.overheadRatePerHour + item.machineRatePerHour;
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 hover:border-emerald-300 active:scale-[0.99] transition-all">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Factory className="h-4 w-4 text-emerald-500 flex-shrink-0" />
              <p className="font-semibold text-gray-900 truncate">{item.code}</p>
            </div>
            <p className="text-sm text-gray-700 truncate">{item.name}</p>
            {item.nameTh && (
              <p className="text-xs text-gray-500 truncate">{item.nameTh}</p>
            )}
            {item.orgUnitName && (
              <p className="text-xs text-gray-500 mt-1">{item.orgUnitName}</p>
            )}
          </div>
          <span
            className={cn(
              'px-2 py-0.5 rounded-full text-xs font-medium border flex-shrink-0',
              item.isActive
                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                : 'bg-gray-100 text-gray-800 border-gray-200',
            )}
          >
            {item.isActive ? t('workCenters.status.active') : t('workCenters.status.inactive')}
          </span>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-3 gap-2">
          <div>
            <p className="text-[10px] text-gray-500 uppercase">{t('workCenters.grid.columns.laborRate')}</p>
            <p className="text-xs font-mono font-medium text-gray-700">
              {formatCurrency(item.laborRatePerHour)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase">{t('workCenters.grid.columns.overheadRate')}</p>
            <p className="text-xs font-mono font-medium text-gray-700">
              {formatCurrency(item.overheadRatePerHour)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase">{t('workCenters.grid.columns.totalRate')}</p>
            <p className="text-xs font-mono font-bold text-emerald-600">
              {formatCurrency(totalRate)}
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6" data-testid="work-centers-page">
      <ResponsivePageHeader
        title={t('workCenters.page.title')}
        icon={Factory}
        subtitle={t('workCenters.page.description')}
        actions={
          <>
            <Button
              icon="refresh"
              stylingMode="outlined"
              onClick={() => refetch()}
              disabled={isFetching}
              hint={t('workCenters.errors.retry')}
              data-testid="refresh-btn"
            />
            <Button
              text={t('workCenters.actions.new')}
              icon="plus"
              type="default"
              onClick={() => router.push('/cost/work-centers/new')}
              data-testid="new-work-center-btn"
            />
          </>
        }
      />

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label={t('workCenters.stats.total')}
          value={total}
          icon={Layers}
          iconColor="text-gray-500"
          accentColor="border-gray-500"
          isLoading={isLoading}
        />
        <StatCard
          label={t('workCenters.stats.active')}
          value={stats.active}
          icon={CheckCircle}
          iconColor="text-emerald-500"
          accentColor="border-emerald-500"
          isLoading={isLoading}
          onClick={() => setActiveFilter(activeFilter === 'active' ? 'all' : 'active')}
        />
        <StatCard
          label={t('workCenters.stats.inactive')}
          value={stats.inactive}
          icon={XCircle}
          iconColor="text-gray-400"
          accentColor="border-gray-300"
          isLoading={isLoading}
          onClick={() => setActiveFilter(activeFilter === 'inactive' ? 'all' : 'inactive')}
        />
        <StatCard
          label={t('workCenters.stats.avgTotalRate')}
          value={`${formatCurrency(stats.avgTotalRate)} THB`}
          icon={DollarSign}
          iconColor="text-blue-500"
          accentColor="border-blue-500"
          isLoading={isLoading}
        />
      </div>

      {/* Search + Filter chips */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <TextBox
            value={search}
            onValueChanged={(e) => {
              setSearch(e.value || '');
              setPage(1);
            }}
            placeholder={t('workCenters.search.placeholder')}
            mode="search"
            showClearButton
            data-testid="search-input"
          />
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {filterChips.map((chip) => {
              const active = activeFilter === chip.key;
              return (
                <button
                  key={chip.key}
                  onClick={() => {
                    setActiveFilter(chip.key);
                    setPage(1);
                  }}
                  className={cn(
                    'flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors flex items-center gap-2',
                    active
                      ? `${chip.activeBg} text-white border-transparent`
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50',
                  )}
                  data-testid={`filter-chip-${chip.key}`}
                >
                  <span>{t(chip.translationKey)}</span>
                  <span
                    className={cn(
                      'px-1.5 py-0.5 rounded text-xs font-semibold',
                      active ? 'bg-white/25' : 'bg-gray-100',
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
            <Factory className="h-5 w-5 text-emerald-500" />
            {t('workCenters.grid.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center" data-testid="error-message">
              <div className="h-14 w-14 rounded-full bg-red-100 flex items-center justify-center mb-3">
                <AlertCircle className="h-7 w-7 text-red-600" />
              </div>
              <p className="text-red-600 font-medium mb-1">{t('workCenters.errors.loadFailed')}</p>
              <p className="text-sm text-gray-500 mb-4">{(error as Error).message}</p>
              <Button
                text={t('workCenters.errors.retry')}
                icon="refresh"
                type="default"
                onClick={() => refetch()}
              />
            </div>
          ) : isLoading ? (
            <div className="space-y-3" data-testid="loading-message">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 rounded-lg bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : workCenters.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center" data-testid="empty-state">
              <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
                <Inbox className="h-8 w-8 text-emerald-600" />
              </div>
              <p className="text-lg font-semibold text-gray-900 mb-1">
                {t('workCenters.empty.title')}
              </p>
              <p className="text-sm text-gray-500 max-w-sm mb-4">
                {t('workCenters.empty.description')}
              </p>
              <Button
                text={t('workCenters.actions.new')}
                icon="plus"
                type="default"
                onClick={() => router.push('/cost/work-centers/new')}
              />
            </div>
          ) : isMobile ? (
            <MobileListView
              items={workCenters}
              keyExpr="id"
              renderCard={renderMobileCard}
              onItemClick={(item) => router.push(`/cost/work-centers/${item.id}`)}
              emptyMessage={t('workCenters.empty.title')}
              gap="md"
            />
          ) : (
            <DataGrid
              key={locale}
              dataSource={workCentersWithRowNum}
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
              data-testid="work-centers-grid"
            >
              <Sorting mode="single" />

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
                dataField="code"
                caption={t('workCenters.grid.columns.code')}
                width={120}
              />
              <Column
                dataField="name"
                caption={t('workCenters.grid.columns.nameEn')}
                minWidth={180}
              />
              <Column
                dataField="nameTh"
                caption={t('workCenters.grid.columns.nameTh')}
                minWidth={180}
              />
              <Column
                dataField="orgUnitName"
                caption={t('workCenters.grid.columns.orgUnit')}
                width={150}
              />
              <Column
                dataField="laborRatePerHour"
                caption={t('workCenters.grid.columns.laborRate')}
                dataType="number"
                width={120}
                cellRender={({ data }) => (
                  <span className="font-mono">{formatCurrency(data.laborRatePerHour)}</span>
                )}
              />
              <Column
                dataField="overheadRatePerHour"
                caption={t('workCenters.grid.columns.overheadRate')}
                dataType="number"
                width={130}
                cellRender={({ data }) => (
                  <span className="font-mono">{formatCurrency(data.overheadRatePerHour)}</span>
                )}
              />
              <Column
                dataField="machineRatePerHour"
                caption={t('workCenters.grid.columns.machineRate')}
                dataType="number"
                width={130}
                cellRender={({ data }) => (
                  <span className="font-mono">{formatCurrency(data.machineRatePerHour)}</span>
                )}
              />
              <Column
                caption={t('workCenters.grid.columns.totalRate')}
                width={130}
                calculateCellValue={(data: WorkCenter) =>
                  data.laborRatePerHour + data.overheadRatePerHour + data.machineRatePerHour
                }
                cellRender={({ data }) => (
                  <span className="font-mono font-bold text-emerald-600">
                    {formatCurrency(
                      data.laborRatePerHour +
                        data.overheadRatePerHour +
                        data.machineRatePerHour,
                    )}
                  </span>
                )}
              />
              <Column
                dataField="capacityHoursPerDay"
                caption={t('workCenters.grid.columns.capacity')}
                dataType="number"
                width={140}
                cellRender={({ data }) => (
                  <span>
                    {data.capacityHoursPerDay !== null ? data.capacityHoursPerDay : '-'}
                  </span>
                )}
              />
              <Column
                dataField="isActive"
                caption={t('workCenters.grid.columns.status')}
                width={100}
                cellRender={({ data }) => (
                  <span
                    className={cn(
                      'px-2 py-1 rounded-full text-xs font-medium border',
                      data.isActive
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                        : 'bg-gray-100 text-gray-800 border-gray-200',
                    )}
                  >
                    {data.isActive
                      ? t('workCenters.status.active')
                      : t('workCenters.status.inactive')}
                  </span>
                )}
              />
              <Column
                caption={t('workCenters.grid.columns.actions')}
                width={120}
                cellRender={({ data }) => (
                  <div className="flex gap-1">
                    <Button
                      icon="edit"
                      stylingMode="text"
                      hint={t('workCenters.actions.edit')}
                      onClick={(e) => {
                        e.event?.stopPropagation();
                        router.push(`/cost/work-centers/${data.id}`);
                      }}
                      data-testid={`edit-btn-${data.id}`}
                    />
                    <Button
                      icon="trash"
                      stylingMode="text"
                      type="danger"
                      hint={t('workCenters.actions.delete')}
                      onClick={(e) =>
                        handleDelete(e.event as unknown as React.MouseEvent, data.id)
                      }
                      data-testid={`delete-btn-${data.id}`}
                    />
                  </div>
                )}
              />

              <Paging enabled pageSize={pageSize} pageIndex={page - 1} />
              <Pager
                visible
                showPageSizeSelector
                allowedPageSizes={[10, 20, 50]}
                showInfo
                infoText={t('workCenters.grid.pagerInfo', { from: '{0}', to: '{1}', total })}
              />
            </DataGrid>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
