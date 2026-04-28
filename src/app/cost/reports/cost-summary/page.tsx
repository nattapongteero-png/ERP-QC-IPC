'use client';

/**
 * Cost Summary Report Page
 * Feature: 014-unit-cost (US7 - Cost Reports Dashboard)
 *
 * Responsive patterns:
 * - ResponsivePageHeader with FileText icon (violet tone)
 * - KPI row (Total Items / Total Value / Avg WAC / Out of Stock)
 * - Filter bar with active-filter chips
 * - MobileListView replaces DataGrid on <md
 * - Excel export, skeleton loading, empty + error states
 */

import { useState, useMemo, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations, useLocale } from 'next-intl';
import DataGrid, {
  Column,
  Paging,
  Pager,
  FilterRow,
  Sorting,
  Summary,
  TotalItem,
  Export,
} from 'devextreme-react/data-grid';
import type { DataGridRef } from 'devextreme-react/data-grid';
import { SelectBox } from 'devextreme-react/select-box';
import { TextBox } from 'devextreme-react/text-box';
import { Button } from 'devextreme-react/button';
import { exportDataGrid } from 'devextreme/excel_exporter';
import { Workbook } from 'exceljs';
import { saveAs } from 'file-saver';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsivePageHeader, StatCard, MobileListView } from '@/components/shared';
import { useMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils/cn';
import {
  FileText,
  Package,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Inbox,
  AlertCircle,
  Search as SearchIcon,
  X,
} from 'lucide-react';
import type { ItemCostSummaryRow } from '@/types/unit-cost';

interface ReportResult {
  data: ItemCostSummaryRow[];
  total: number;
}

async function fetchCostSummary(params: {
  itemType?: string;
  search?: string;
  page: number;
  pageSize: number;
}): Promise<ReportResult> {
  const searchParams = new URLSearchParams();
  if (params.itemType) searchParams.append('itemType', params.itemType);
  if (params.search) searchParams.append('search', params.search);
  searchParams.append('page', params.page.toString());
  searchParams.append('pageSize', params.pageSize.toString());

  const res = await fetch(`/api/cost/reports/cost-summary?${searchParams}`);
  if (!res.ok) throw new Error('Failed to fetch cost summary');
  const json = await res.json();
  return json.data;
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

function formatCurrencyShort(value: number | null | undefined): string {
  const n = Number(value) || 0;
  if (n >= 1_000_000) return `฿${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `฿${(n / 1_000).toFixed(0)}K`;
  return `฿${n.toFixed(0)}`;
}

const itemTypeColors: Record<string, string> = {
  raw_material: 'bg-amber-100 text-amber-800 border-amber-200',
  finished_goods: 'bg-green-100 text-green-800 border-green-200',
  packaging: 'bg-blue-100 text-blue-800 border-blue-200',
  consumable: 'bg-purple-100 text-purple-800 border-purple-200',
  wip: 'bg-indigo-100 text-indigo-800 border-indigo-200',
};

export default function CostSummaryReportPage() {
  const t = useTranslations('cost');
  const locale = useLocale();
  const { isMobile } = useMobile();
  const gridRef = useRef<DataGridRef>(null);
  const [itemType, setItemType] = useState<string>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const itemTypes = useMemo(
    () => [
      { value: '', label: t('reports.costSummary.filters.allTypes') },
      { value: 'raw_material', label: t('reports.costSummary.filters.rawMaterial') },
      { value: 'finished_goods', label: t('reports.costSummary.filters.finishedGoods') },
      { value: 'packaging', label: t('reports.costSummary.filters.packaging') },
      { value: 'consumable', label: t('reports.costSummary.filters.consumable') },
    ],
    [t],
  );

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['cost-summary-report', itemType, search, page, pageSize],
    queryFn: () => fetchCostSummary({ itemType, search, page, pageSize }),
    staleTime: 30000,
  });

  const items = data?.data || [];
  const total = data?.total || 0;

  // Add row sequence numbers for grid display
  const itemsWithRowNum = useMemo(
    () => items.map((item, index) => ({ ...item, _rowNumber: index + 1 })),
    [items],
  );

  const translateItemType = useCallback(
    (type: string): string => {
      const key = `reports.costSummary.itemTypes.${type}`;
      const translated = t(key);
      // If translation returns the raw key (missing), fall back to raw type
      return translated === key ? type : translated;
    },
    [t],
  );

  // Compute KPIs from current page data
  const stats = useMemo(() => {
    const totalValue = items.reduce((sum, it) => sum + (Number(it.onHandValue) || 0), 0);
    const wacValues = items
      .map((it) => it.currentWAC)
      .filter((v): v is number => v !== null && v !== undefined);
    const avgWac = wacValues.length > 0
      ? wacValues.reduce((s, v) => s + v, 0) / wacValues.length
      : 0;
    const outOfStock = items.filter((it) => (Number(it.onHand) || 0) <= 0).length;
    return { totalValue, avgWac, outOfStock };
  }, [items]);

  const handleClearFilters = () => {
    setItemType('');
    setSearch('');
    setPage(1);
  };

  const hasActiveFilters = itemType !== '' || search !== '';

  const handleExportExcel = useCallback(async () => {
    if (!gridRef.current) return;
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet(t('reports.costSummary.grid.worksheetName'));
    await exportDataGrid({
      component: gridRef.current.instance(),
      worksheet,
      autoFilterEnabled: true,
    });
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(
      new Blob([buffer], { type: 'application/octet-stream' }),
      `cost-summary-${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  }, [t]);

  const renderMobileCard = (item: ItemCostSummaryRow) => (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:border-violet-300 transition-all">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Package className="h-4 w-4 text-violet-500 flex-shrink-0" />
            <p className="font-semibold text-gray-900 truncate">{item.itemCode}</p>
          </div>
          <p className="text-sm text-gray-700 truncate">{item.itemName}</p>
        </div>
        <span
          className={cn(
            'px-2 py-0.5 rounded-full text-xs font-medium border flex-shrink-0',
            itemTypeColors[item.itemType] || 'bg-gray-100 text-gray-800 border-gray-200',
          )}
        >
          {translateItemType(item.itemType)}
        </span>
      </div>
      <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-3 gap-2">
        <div>
          <p className="text-[10px] text-gray-500 uppercase">{t('reports.costSummary.grid.columns.onHand')}</p>
          <p className="text-sm font-bold text-gray-900">
            {(Number(item.onHand) || 0).toLocaleString()} {item.uom}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-gray-500 uppercase">{t('reports.costSummary.grid.columns.wac')}</p>
          <p className="text-xs font-mono text-gray-700">{formatCurrency(item.currentWAC)}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-500 uppercase">{t('reports.costSummary.grid.columns.value')}</p>
          <p className="text-xs font-mono font-bold text-violet-600">
            {formatCurrency(item.onHandValue)}
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6" data-testid="cost-summary-report-page">
      <ResponsivePageHeader
        title={t('reports.costSummary.title')}
        icon={FileText}
        iconBgColor="bg-violet-100"
        iconColor="text-violet-600"
        subtitle={t('reports.costSummary.description')}
        onBack={() => window.history.back()}
        actions={
          <>
            <Button
              icon="refresh"
              stylingMode="outlined"
              onClick={() => refetch()}
              disabled={isFetching}
              hint={t('landedCosts.retry')}
              data-testid="refresh-btn"
            />
            <Button
              text={t('reports.costSummary.actions.exportExcel')}
              icon="exportxlsx"
              type="default"
              onClick={handleExportExcel}
              disabled={items.length === 0}
              data-testid="export-excel-btn"
            />
          </>
        }
      />

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label={t('reports.costSummary.stats.totalItems')}
          value={total}
          icon={Package}
          iconColor="text-violet-500"
          accentColor="border-violet-500"
          isLoading={isLoading}
        />
        <StatCard
          label={t('reports.costSummary.stats.totalValue')}
          value={formatCurrencyShort(stats.totalValue)}
          icon={DollarSign}
          iconColor="text-emerald-500"
          accentColor="border-emerald-500"
          isLoading={isLoading}
        />
        <StatCard
          label={t('reports.costSummary.stats.avgWac')}
          value={formatCurrencyShort(stats.avgWac)}
          icon={TrendingUp}
          iconColor="text-blue-500"
          accentColor="border-blue-500"
          isLoading={isLoading}
        />
        <StatCard
          label={t('reports.costSummary.stats.outOfStock')}
          value={stats.outOfStock}
          icon={AlertTriangle}
          iconColor="text-amber-500"
          accentColor="border-amber-500"
          isLoading={isLoading}
        />
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-base">
              <SearchIcon className="h-5 w-5 text-violet-500" />
              {t('reports.costSummary.filters.title')}
            </span>
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="text-xs text-gray-500 hover:text-violet-600 flex items-center gap-1"
                data-testid="clear-filters-btn"
              >
                <X className="h-3.5 w-3.5" />
                {t('reports.costSummary.actions.clearFilters')}
              </button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('reports.costSummary.filters.itemType')}
              </label>
              <SelectBox
                dataSource={itemTypes}
                displayExpr="label"
                valueExpr="value"
                value={itemType}
                onValueChanged={(e) => {
                  setItemType(e.value);
                  setPage(1);
                }}
                data-testid="item-type-filter"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('reports.costSummary.filters.search')}
              </label>
              <TextBox
                value={search}
                onValueChanged={(e) => {
                  setSearch(e.value || '');
                  setPage(1);
                }}
                placeholder={t('reports.costSummary.filters.searchPlaceholder')}
                mode="search"
                showClearButton
                data-testid="search-filter"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-violet-500" />
            {t('reports.costSummary.grid.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center" data-testid="error">
              <div className="h-14 w-14 rounded-full bg-red-100 flex items-center justify-center mb-3">
                <AlertCircle className="h-7 w-7 text-red-600" />
              </div>
              <p className="text-red-600 font-medium mb-1">{t('reports.costSummary.error')}</p>
              <p className="text-sm text-gray-500 mb-4">{(error as Error).message}</p>
              <Button
                text={t('landedCosts.retry')}
                icon="refresh"
                type="default"
                onClick={() => refetch()}
              />
            </div>
          ) : isLoading ? (
            <div className="space-y-3" data-testid="loading">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-14 rounded-lg bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center" data-testid="empty-state">
              <div className="h-16 w-16 rounded-full bg-violet-100 flex items-center justify-center mb-3">
                <Inbox className="h-8 w-8 text-violet-600" />
              </div>
              <p className="text-lg font-semibold text-gray-900 mb-1">
                {t('reports.costSummary.empty.title')}
              </p>
              <p className="text-sm text-gray-500 max-w-sm mb-4">
                {t('reports.costSummary.empty.description')}
              </p>
              {hasActiveFilters && (
                <Button
                  text={t('reports.costSummary.actions.clearFilters')}
                  icon="close"
                  stylingMode="outlined"
                  onClick={handleClearFilters}
                />
              )}
            </div>
          ) : isMobile ? (
            <MobileListView
              items={items}
              keyExpr="itemId"
              renderCard={renderMobileCard}
              emptyMessage={t('reports.costSummary.empty.title')}
              gap="md"
            />
          ) : (
            <DataGrid
              key={locale}
              ref={gridRef}
              dataSource={itemsWithRowNum}
              showBorders
              columnAutoWidth
              rowAlternationEnabled
              onOptionChanged={(e) => {
                if (e.name === 'paging' && e.fullName === 'paging.pageIndex') {
                  setPage((e.value as number) + 1);
                }
                if (e.name === 'paging' && e.fullName === 'paging.pageSize') {
                  setPageSize(e.value as number);
                  setPage(1);
                }
              }}
              data-testid="cost-summary-grid"
            >
              <Export enabled={false} />
              <FilterRow visible />
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
              <Column dataField="itemCode" caption={t('reports.costSummary.grid.columns.code')} width={120} />
              <Column dataField="itemName" caption={t('reports.costSummary.grid.columns.name')} minWidth={200} />
              <Column
                dataField="itemType"
                caption={t('reports.costSummary.grid.columns.type')}
                width={130}
                cellRender={({ data }) => (
                  <span
                    className={cn(
                      'px-2 py-1 rounded-full text-xs font-medium border',
                      itemTypeColors[data.itemType] || 'bg-gray-100 text-gray-800 border-gray-200',
                    )}
                  >
                    {translateItemType(data.itemType)}
                  </span>
                )}
              />
              <Column dataField="uom" caption={t('reports.costSummary.grid.columns.uom')} width={80} />
              <Column
                dataField="onHand"
                caption={t('reports.costSummary.grid.columns.onHand')}
                dataType="number"
                width={100}
                format="#,##0"
                cellRender={({ data }) => (
                  <span
                    className={cn(
                      'font-mono',
                      (Number(data.onHand) || 0) <= 0 && 'text-red-500 font-semibold',
                    )}
                  >
                    {(Number(data.onHand) || 0).toLocaleString()}
                  </span>
                )}
              />
              <Column
                dataField="currentWAC"
                caption={t('reports.costSummary.grid.columns.wac')}
                dataType="number"
                width={120}
                cellRender={({ data }) => (
                  <span className="font-mono">{formatCurrency(data.currentWAC)}</span>
                )}
              />
              <Column
                dataField="onHandValue"
                caption={t('reports.costSummary.grid.columns.value')}
                dataType="number"
                width={130}
                cellRender={({ data }) => (
                  <span className="font-mono font-bold">{formatCurrency(data.onHandValue)}</span>
                )}
              />
              <Column
                dataField="standardCost"
                caption={t('reports.costSummary.grid.columns.stdCost')}
                dataType="number"
                width={110}
                cellRender={({ data }) => (
                  <span className="font-mono text-gray-500">
                    {formatCurrency(data.standardCost)}
                  </span>
                )}
              />
              <Column
                dataField="lastPurchaseCost"
                caption={t('reports.costSummary.grid.columns.lastPOCost')}
                dataType="number"
                width={120}
                cellRender={({ data }) => (
                  <span className="font-mono">{formatCurrency(data.lastPurchaseCost)}</span>
                )}
              />
              <Column
                dataField="fullCost"
                caption={t('reports.costSummary.grid.columns.fullCost')}
                dataType="number"
                width={120}
                cellRender={({ data }) => (
                  <span className="font-mono text-violet-600">{formatCurrency(data.fullCost)}</span>
                )}
              />

              <Summary>
                <TotalItem
                  column="onHandValue"
                  summaryType="sum"
                  valueFormat="#,##0.00"
                  displayFormat={t('reports.costSummary.grid.total') + ': {0}'}
                />
              </Summary>

              <Paging enabled pageSize={pageSize} pageIndex={page - 1} />
              <Pager
                visible
                showPageSizeSelector
                allowedPageSizes={[20, 50, 100]}
                showInfo
                infoText={t('reports.costSummary.grid.pagerInfo', { from: '{0}', to: '{1}', total })}
              />
            </DataGrid>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
