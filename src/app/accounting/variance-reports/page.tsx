/**
 * Variance Reports Dashboard Page (T149)
 * Display manufacturing variance analysis reports
 * Part of 011-accounting-spec-gap - User Story 6
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { toLocalDateStr } from '@/lib/utils/date-format';
import DataGrid, {
  Column,
  Paging,
  Summary,
  TotalItem,
} from 'devextreme-react/data-grid';
import { Button } from 'devextreme-react/button';
import { DateBox } from 'devextreme-react/date-box';
import { SelectBox } from 'devextreme-react/select-box';
import { LoadIndicator } from 'devextreme-react/load-indicator';
import { VarianceChart } from '@/components/accounting/VarianceChart';
import type { VarianceSummaryReport, MaterialVarianceReport, LaborVarianceReport } from '@/types/variance';

type ReportTab = 'summary' | 'material' | 'labor';

export default function VarianceReportsPage() {
  const t = useTranslations('accounting');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ReportTab>('summary');
  const [dateFrom, setDateFrom] = useState<Date | null>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d;
  });
  const [dateTo, setDateTo] = useState<Date | null>(new Date());
  const [groupBy, setGroupBy] = useState<string>('variance_type');

  // Report data
  const [summaryReport, setSummaryReport] = useState<VarianceSummaryReport | null>(null);
  const [materialReport, setMaterialReport] = useState<MaterialVarianceReport | null>(null);
  const [laborReport, setLaborReport] = useState<LaborVarianceReport | null>(null);

  const formatDate = (date: Date | null): string => {
    if (!date) return '';
    return toLocalDateStr(date);
  };

  const fetchSummaryReport = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.append('date_from', formatDate(dateFrom));
      if (dateTo) params.append('date_to', formatDate(dateTo));
      params.append('group_by', groupBy);

      const response = await fetch(`/api/accounting/reports/variance-summary?${params}`);
      const result = await response.json();
      if (result.success) {
        setSummaryReport(result.data);
      }
    } catch (error) {
      console.error('Error fetching summary report:', error);
    }
  }, [dateFrom, dateTo, groupBy]);

  const fetchMaterialReport = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.append('date_from', formatDate(dateFrom));
      if (dateTo) params.append('date_to', formatDate(dateTo));

      const response = await fetch(`/api/accounting/reports/material-variance?${params}`);
      const result = await response.json();
      if (result.success) {
        setMaterialReport(result.data);
      }
    } catch (error) {
      console.error('Error fetching material report:', error);
    }
  }, [dateFrom, dateTo]);

  const fetchLaborReport = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.append('date_from', formatDate(dateFrom));
      if (dateTo) params.append('date_to', formatDate(dateTo));

      const response = await fetch(`/api/accounting/reports/labor-variance?${params}`);
      const result = await response.json();
      if (result.success) {
        setLaborReport(result.data);
      }
    } catch (error) {
      console.error('Error fetching labor report:', error);
    }
  }, [dateFrom, dateTo]);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      fetchSummaryReport(),
      fetchMaterialReport(),
      fetchLaborReport(),
    ]);
    setLoading(false);
  }, [fetchSummaryReport, fetchMaterialReport, fetchLaborReport]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleRefresh = () => {
    fetchReports();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const renderVarianceBadge = (value: number, isFavorable?: boolean) => {
    const favorable = isFavorable !== undefined ? isFavorable : value <= 0;
    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${
          favorable
            ? 'bg-green-100 text-green-800'
            : 'bg-red-100 text-red-800'
        }`}
      >
        {formatCurrency(value)}
      </span>
    );
  };

  if (loading && !summaryReport) {
    return (
        <div className="flex items-center justify-center h-64">
          <LoadIndicator />
        </div>
    );
  }

  return (
      <div className="p-4">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-800" data-testid="page-title">
            {t('varianceReports.title')}
          </h1>
          <p className="text-gray-600">
            {t('varianceReports.subtitle')}
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('varianceReports.filters.dateFrom')}
              </label>
              <DateBox
                value={dateFrom}
                onValueChanged={(e) => setDateFrom(e.value)}
                displayFormat="yyyy-MM-dd"
                width={150}
                data-testid="date-from"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('varianceReports.filters.dateTo')}
              </label>
              <DateBox
                value={dateTo}
                onValueChanged={(e) => setDateTo(e.value)}
                displayFormat="yyyy-MM-dd"
                width={150}
                data-testid="date-to"
              />
            </div>
            {activeTab === 'summary' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('varianceReports.filters.groupBy')}
                </label>
                <SelectBox
                  value={groupBy}
                  onValueChanged={(e) => setGroupBy(e.value)}
                  items={[
                    { value: 'variance_type', label: t('varianceReports.filters.groupOptions.varianceType') },
                    { value: 'item', label: t('varianceReports.filters.groupOptions.item') },
                    { value: 'work_order', label: t('varianceReports.filters.groupOptions.workOrder') },
                    { value: 'month', label: t('varianceReports.filters.groupOptions.month') },
                  ]}
                  displayExpr="label"
                  valueExpr="value"
                  width={150}
                  data-testid="group-by"
                />
              </div>
            )}
            <Button
              icon="refresh"
              text={t('varianceReports.filters.refresh')}
              onClick={handleRefresh}
              elementAttr={{ 'data-testid': 'refresh-btn' }}
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow mb-4">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px" data-testid="report-tabs">
              {[
                { id: 'summary', label: t('varianceReports.tabs.summary') },
                { id: 'material', label: t('varianceReports.tabs.material') },
                { id: 'labor', label: t('varianceReports.tabs.labor') },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as ReportTab)}
                  className={`px-6 py-3 text-sm font-medium border-b-2 ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                  data-testid={`tab-${tab.id}`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Summary Tab */}
        {activeTab === 'summary' && summaryReport && (
          <div className="space-y-4">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="text-sm font-medium text-gray-500">{t('varianceReports.stats.totalVariances')}</h3>
                <p className="text-2xl font-bold text-gray-900" data-testid="total-variances">
                  {formatCurrency(summaryReport.totalVariances)}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="text-sm font-medium text-gray-500">{t('varianceReports.stats.favorable')}</h3>
                <p className="text-2xl font-bold text-green-600" data-testid="favorable-variances">
                  {formatCurrency(summaryReport.favorableVariances)}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="text-sm font-medium text-gray-500">{t('varianceReports.stats.unfavorable')}</h3>
                <p className="text-2xl font-bold text-red-600" data-testid="unfavorable-variances">
                  {formatCurrency(summaryReport.unfavorableVariances)}
                </p>
              </div>
            </div>

            {/* Variance Chart */}
            <VarianceChart
              data={summaryReport.byType}
              title={t('varianceReports.chart.byType')}
              height={350}
            />

            {/* Details Grid */}
            <div className="bg-white rounded-lg shadow">
              <DataGrid
                dataSource={summaryReport.details}
                keyExpr="groupKey"
                showBorders={true}
                rowAlternationEnabled={true}
                data-testid="summary-grid"
              >
                <Paging defaultPageSize={10} />
                {/* groupName arrives from the API as an English constant
                    (VARIANCE_LABELS), so the column read "Material Price
                    Variance" even in Thai while the chart above it was
                    translated. When grouping by variance type the groupKey IS
                    the type, so translate it here; for item / work order /
                    month the name is real data and must pass through as-is. */}
                <Column
                  dataField="groupName"
                  caption={t('varianceReports.columns.group')}
                  cellRender={(c: { data: { groupKey: string; groupName: string } }) =>
                    groupBy === 'variance_type'
                      ? t(`varianceReports.chart.types.${c.data.groupKey}`)
                      : c.data.groupName
                  }
                />
                <Column dataField="mpv" caption={t('varianceReports.columns.mpv')} dataType="number" format="#,##0.00" />
                <Column dataField="muv" caption={t('varianceReports.columns.muv')} dataType="number" format="#,##0.00" />
                <Column dataField="lrv" caption={t('varianceReports.columns.lrv')} dataType="number" format="#,##0.00" />
                <Column dataField="lev" caption={t('varianceReports.columns.lev')} dataType="number" format="#,##0.00" />
                <Column dataField="vohVar" caption={t('varianceReports.columns.voh')} dataType="number" format="#,##0.00" />
                <Column dataField="fohVol" caption={t('varianceReports.columns.foh')} dataType="number" format="#,##0.00" />
                <Column
                  dataField="total"
                  caption={t('varianceReports.columns.total')}
                  dataType="number"
                  format="#,##0.00"
                  cellRender={(cell: any) => renderVarianceBadge(cell.value, cell.data.isFavorable)}
                />
                <Summary>
                  <TotalItem column="mpv" summaryType="sum" valueFormat="#,##0.00" />
                  <TotalItem column="muv" summaryType="sum" valueFormat="#,##0.00" />
                  <TotalItem column="lrv" summaryType="sum" valueFormat="#,##0.00" />
                  <TotalItem column="lev" summaryType="sum" valueFormat="#,##0.00" />
                  <TotalItem column="vohVar" summaryType="sum" valueFormat="#,##0.00" />
                  <TotalItem column="fohVol" summaryType="sum" valueFormat="#,##0.00" />
                  <TotalItem column="total" summaryType="sum" valueFormat="#,##0.00" />
                </Summary>
              </DataGrid>
            </div>
          </div>
        )}

        {/* Material Variance Tab */}
        {activeTab === 'material' && materialReport && (
          <div className="space-y-4">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="text-sm font-medium text-gray-500">{t('varianceReports.stats.totalMaterialVariance')}</h3>
                <p className="text-2xl font-bold text-gray-900" data-testid="total-material-variance">
                  {formatCurrency(materialReport.summary.totalMaterialVariance)}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="text-sm font-medium text-gray-500">{t('varianceReports.stats.mpv')}</h3>
                <p
                  className={`text-2xl font-bold ${
                    materialReport.summary.totalMpv <= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                  data-testid="mpv-total"
                >
                  {formatCurrency(materialReport.summary.totalMpv)}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="text-sm font-medium text-gray-500">{t('varianceReports.stats.muv')}</h3>
                <p
                  className={`text-2xl font-bold ${
                    materialReport.summary.totalMuv <= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                  data-testid="muv-total"
                >
                  {formatCurrency(materialReport.summary.totalMuv)}
                </p>
              </div>
            </div>

            {/* Details Grid */}
            <div className="bg-white rounded-lg shadow">
              <DataGrid
                dataSource={materialReport.items}
                keyExpr="itemId"
                showBorders={true}
                rowAlternationEnabled={true}
                data-testid="material-grid"
              >
                <Paging defaultPageSize={10} />
                <Column dataField="itemCode" caption={t('varianceReports.columns.itemCode')} width={100} />
                <Column dataField="itemName" caption={t('varianceReports.columns.itemName')} />
                <Column dataField="standardPrice" caption={t('varianceReports.columns.standardPrice')} dataType="number" format="#,##0.00" width={100} />
                <Column dataField="actualPrice" caption={t('varianceReports.columns.actualPrice')} dataType="number" format="#,##0.00" width={100} />
                <Column
                  dataField="priceVariance"
                  caption={t('varianceReports.columns.priceVariance')}
                  dataType="number"
                  width={120}
                  cellRender={(cell: any) => renderVarianceBadge(cell.value)}
                />
                <Column dataField="standardQty" caption={t('varianceReports.columns.standardQty')} dataType="number" format="#,##0.00" width={100} />
                <Column dataField="actualQty" caption={t('varianceReports.columns.actualQty')} dataType="number" format="#,##0.00" width={100} />
                <Column
                  dataField="usageVariance"
                  caption={t('varianceReports.columns.usageVariance')}
                  dataType="number"
                  width={120}
                  cellRender={(cell: any) => renderVarianceBadge(cell.value)}
                />
                <Column
                  dataField="totalVariance"
                  caption={t('varianceReports.columns.total')}
                  dataType="number"
                  width={120}
                  cellRender={(cell: any) => renderVarianceBadge(cell.value)}
                />
                <Summary>
                  <TotalItem column="priceVariance" summaryType="sum" valueFormat="#,##0.00" />
                  <TotalItem column="usageVariance" summaryType="sum" valueFormat="#,##0.00" />
                  <TotalItem column="totalVariance" summaryType="sum" valueFormat="#,##0.00" />
                </Summary>
              </DataGrid>
            </div>
          </div>
        )}

        {/* Labor Variance Tab */}
        {activeTab === 'labor' && laborReport && (
          <div className="space-y-4">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="text-sm font-medium text-gray-500">{t('varianceReports.stats.totalLaborVariance')}</h3>
                <p className="text-2xl font-bold text-gray-900" data-testid="total-labor-variance">
                  {formatCurrency(laborReport.summary.totalLaborVariance)}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="text-sm font-medium text-gray-500">{t('varianceReports.stats.lrv')}</h3>
                <p
                  className={`text-2xl font-bold ${
                    laborReport.summary.totalLrv <= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                  data-testid="lrv-total"
                >
                  {formatCurrency(laborReport.summary.totalLrv)}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="text-sm font-medium text-gray-500">{t('varianceReports.stats.lev')}</h3>
                <p
                  className={`text-2xl font-bold ${
                    laborReport.summary.totalLev <= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                  data-testid="lev-total"
                >
                  {formatCurrency(laborReport.summary.totalLev)}
                </p>
              </div>
            </div>

            {/* Details Grid */}
            <div className="bg-white rounded-lg shadow">
              <DataGrid
                dataSource={laborReport.details}
                keyExpr="workOrderId"
                showBorders={true}
                rowAlternationEnabled={true}
                data-testid="labor-grid"
              >
                <Paging defaultPageSize={10} />
                <Column dataField="workOrderNumber" caption={t('varianceReports.columns.workOrderNumber')} width={120} />
                <Column dataField="itemCode" caption={t('varianceReports.columns.item')} width={100} />
                <Column dataField="standardHours" caption={t('varianceReports.columns.standardHours')} dataType="number" format="#,##0.00" width={100} />
                <Column dataField="actualHours" caption={t('varianceReports.columns.actualHours')} dataType="number" format="#,##0.00" width={100} />
                <Column dataField="standardRate" caption={t('varianceReports.columns.standardRate')} dataType="number" format="#,##0.00" width={100} />
                <Column dataField="actualRate" caption={t('varianceReports.columns.actualRate')} dataType="number" format="#,##0.00" width={100} />
                <Column
                  dataField="rateVariance"
                  caption={t('varianceReports.columns.rateVariance')}
                  dataType="number"
                  width={120}
                  cellRender={(cell: any) => renderVarianceBadge(cell.value)}
                />
                <Column
                  dataField="efficiencyVariance"
                  caption={t('varianceReports.columns.efficiencyVariance')}
                  dataType="number"
                  width={120}
                  cellRender={(cell: any) => renderVarianceBadge(cell.value)}
                />
                <Summary>
                  <TotalItem column="rateVariance" summaryType="sum" valueFormat="#,##0.00" />
                  <TotalItem column="efficiencyVariance" summaryType="sum" valueFormat="#,##0.00" />
                </Summary>
              </DataGrid>
            </div>
          </div>
        )}
      </div>
  );
}
