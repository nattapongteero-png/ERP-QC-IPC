/**
 * Variance Reports Dashboard Page (T149)
 * Display manufacturing variance analysis reports
 * Part of 011-accounting-spec-gap - User Story 6
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { MainLayout } from '@/components/layout/main-layout';
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
    return date.toISOString().split('T')[0];
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
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <LoadIndicator />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-4">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-800" data-testid="page-title">
            {t('page.title')}
          </h1>
          <p className="text-gray-600">
            Manufacturing variance analysis and cost control reports
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date From
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
                Date To
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
                  Group By
                </label>
                <SelectBox
                  value={groupBy}
                  onValueChanged={(e) => setGroupBy(e.value)}
                  items={[
                    { value: 'variance_type', label: 'Variance Type' },
                    { value: 'item', label: 'Item' },
                    { value: 'work_order', label: 'Work Order' },
                    { value: 'month', label: 'Month' },
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
              text="Refresh"
              onClick={handleRefresh}
              data-testid="refresh-btn"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow mb-4">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px" data-testid="report-tabs">
              {[
                { id: 'summary', label: 'Summary' },
                { id: 'material', label: 'Material Variance' },
                { id: 'labor', label: 'Labor Variance' },
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
                <h3 className="text-sm font-medium text-gray-500">Total Variances</h3>
                <p className="text-2xl font-bold text-gray-900" data-testid="total-variances">
                  {formatCurrency(summaryReport.totalVariances)}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="text-sm font-medium text-gray-500">Favorable</h3>
                <p className="text-2xl font-bold text-green-600" data-testid="favorable-variances">
                  {formatCurrency(summaryReport.favorableVariances)}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="text-sm font-medium text-gray-500">Unfavorable</h3>
                <p className="text-2xl font-bold text-red-600" data-testid="unfavorable-variances">
                  {formatCurrency(summaryReport.unfavorableVariances)}
                </p>
              </div>
            </div>

            {/* Variance Chart */}
            <VarianceChart
              data={summaryReport.byType}
              title="Variance by Type"
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
                <Column dataField="groupName" caption="Group" />
                <Column dataField="mpv" caption="MPV" dataType="number" format="#,##0.00" />
                <Column dataField="muv" caption="MUV" dataType="number" format="#,##0.00" />
                <Column dataField="lrv" caption="LRV" dataType="number" format="#,##0.00" />
                <Column dataField="lev" caption="LEV" dataType="number" format="#,##0.00" />
                <Column dataField="vohVar" caption="VOH" dataType="number" format="#,##0.00" />
                <Column dataField="fohVol" caption="FOH" dataType="number" format="#,##0.00" />
                <Column
                  dataField="total"
                  caption="Total"
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
                <h3 className="text-sm font-medium text-gray-500">Total Material Variance</h3>
                <p className="text-2xl font-bold text-gray-900" data-testid="total-material-variance">
                  {formatCurrency(materialReport.summary.totalMaterialVariance)}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="text-sm font-medium text-gray-500">Price Variance (MPV)</h3>
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
                <h3 className="text-sm font-medium text-gray-500">Usage Variance (MUV)</h3>
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
                <Column dataField="itemCode" caption="Item Code" width={100} />
                <Column dataField="itemName" caption="Item Name" />
                <Column dataField="standardPrice" caption="Std Price" dataType="number" format="#,##0.00" width={100} />
                <Column dataField="actualPrice" caption="Act Price" dataType="number" format="#,##0.00" width={100} />
                <Column
                  dataField="priceVariance"
                  caption="Price Var"
                  dataType="number"
                  width={120}
                  cellRender={(cell: any) => renderVarianceBadge(cell.value)}
                />
                <Column dataField="standardQty" caption="Std Qty" dataType="number" format="#,##0.00" width={100} />
                <Column dataField="actualQty" caption="Act Qty" dataType="number" format="#,##0.00" width={100} />
                <Column
                  dataField="usageVariance"
                  caption="Usage Var"
                  dataType="number"
                  width={120}
                  cellRender={(cell: any) => renderVarianceBadge(cell.value)}
                />
                <Column
                  dataField="totalVariance"
                  caption="Total"
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
                <h3 className="text-sm font-medium text-gray-500">Total Labor Variance</h3>
                <p className="text-2xl font-bold text-gray-900" data-testid="total-labor-variance">
                  {formatCurrency(laborReport.summary.totalLaborVariance)}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="text-sm font-medium text-gray-500">Rate Variance (LRV)</h3>
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
                <h3 className="text-sm font-medium text-gray-500">Efficiency Variance (LEV)</h3>
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
                <Column dataField="workOrderNumber" caption="Work Order" width={120} />
                <Column dataField="itemCode" caption="Item" width={100} />
                <Column dataField="standardHours" caption="Std Hours" dataType="number" format="#,##0.00" width={100} />
                <Column dataField="actualHours" caption="Act Hours" dataType="number" format="#,##0.00" width={100} />
                <Column dataField="standardRate" caption="Std Rate" dataType="number" format="#,##0.00" width={100} />
                <Column dataField="actualRate" caption="Act Rate" dataType="number" format="#,##0.00" width={100} />
                <Column
                  dataField="rateVariance"
                  caption="Rate Var"
                  dataType="number"
                  width={120}
                  cellRender={(cell: any) => renderVarianceBadge(cell.value)}
                />
                <Column
                  dataField="efficiencyVariance"
                  caption="Efficiency Var"
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
    </MainLayout>
  );
}
