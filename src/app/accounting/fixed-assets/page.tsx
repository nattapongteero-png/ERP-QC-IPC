'use client';

// Fixed Assets List Page
// Feature: 010-accounting-module-integration
// User Story 7: Manage Fixed Assets and Depreciation

import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from 'devextreme-react/button';
import { SelectBox } from 'devextreme-react/select-box';
import DataGrid, { Column, Export, Summary, TotalItem, Paging, FilterRow, SearchPanel, Sorting, HeaderFilter, ColumnChooser, Toolbar, Item as ToolbarItem } from 'devextreme-react/data-grid';
import notify from 'devextreme/ui/notify';
import {
  AccountingPageHeader,
  AccountingKPICard,
  AccountingFilterPanel,
  AccountingStatusBadge,
} from '@/components/accounting';
import type { FixedAsset, AssetCategory } from '@/lib/db/schema';

const statusOptions = [
  { value: '', text: 'All Statuses' },
  { value: 'active', text: 'Active' },
  { value: 'disposed', text: 'Disposed' },
  { value: 'fully_depreciated', text: 'Fully Depreciated' },
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
  }).format(value);
}

async function fetchAssets(status?: string): Promise<FixedAsset[]> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);

  const res = await fetch(`/api/accounting/fixed-assets?${params.toString()}`);
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to fetch fixed assets');
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
  if (!res.ok) {
    return [];
  }
  const data = await res.json();
  return data.data;
}

export default function FixedAssetsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['fixed-assets', statusFilter],
    queryFn: () => fetchAssets(statusFilter),
  });

  const { data: summary } = useQuery({
    queryKey: ['fixed-assets-summary'],
    queryFn: fetchAssetSummary,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['asset-categories'],
    queryFn: fetchCategories,
  });

  const handleExportJSON = useCallback(() => {
    if (!assets || assets.length === 0) return;
    const blob = new Blob([JSON.stringify(assets, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fixed-assets-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify('Fixed assets exported successfully', 'success', 3000);
  }, [assets]);

  const getCategoryName = (categoryId: number): string => {
    const category = categories.find(c => c.id === categoryId);
    return category?.nameEn || 'Unknown';
  };

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['fixed-assets'] });
    queryClient.invalidateQueries({ queryKey: ['fixed-assets-summary'] });
  }, [queryClient]);

  // Status badge render
  const statusCellRender = useCallback((cellData: { value: string }) => {
    const statusMap: Record<string, 'active' | 'inactive'> = {
      active: 'active',
      disposed: 'inactive',
      fully_depreciated: 'inactive',
    };
    const status = statusMap[cellData.value] || 'active';
    return <AccountingStatusBadge status={status} />;
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <AccountingPageHeader
        title="ทรัพย์สินถาวร"
        subtitle="Fixed Assets"
        icon="building"
        onRefresh={handleRefresh}
        actions={
          <>
            <Button
              text="เพิ่มทรัพย์สิน"
              icon="plus"
              type="success"
              onClick={() => notify('Add Asset dialog - coming soon', 'info', 3000)}
            />
            <Button
              text="คำนวณค่าเสื่อม"
              icon="calculator"
              type="default"
              stylingMode="outlined"
              onClick={() => notify('Run Depreciation dialog - coming soon', 'info', 3000)}
            />
          </>
        }
      />

      <div className="p-4 md:p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <AccountingKPICard
            label="ทรัพย์สินทั้งหมด"
            value={summary?.totalAssets || 0}
            subtitle="Total Assets"
            icon="package"
            variant="info"
          />
          <AccountingKPICard
            label="ใช้งาน"
            value={summary?.activeAssets || 0}
            subtitle="Active"
            icon="check-circle"
            variant="success"
          />
          <AccountingKPICard
            label="ราคาทุน"
            value={summary ? formatCurrency(summary.totalAcquisitionCost) : '-'}
            subtitle="Total Cost"
            icon="wallet"
            variant="default"
          />
          <AccountingKPICard
            label="มูลค่าสุทธิ"
            value={summary ? formatCurrency(summary.totalNetBookValue) : '-'}
            subtitle="Net Book Value"
            icon="trending-up"
            variant="warning"
          />
        </div>

        {/* Filter Panel */}
        <AccountingFilterPanel>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              สถานะ
            </label>
            <SelectBox
              items={statusOptions}
              value={statusFilter}
              onValueChanged={(e) => setStatusFilter(e.value)}
              valueExpr="value"
              displayExpr="text"
              width={200}
              placeholder="กรองสถานะ"
            />
          </div>
          <div className="flex gap-2">
            {assets.length > 0 && (
              <Button
                text="Export JSON"
                icon="export"
                type="normal"
                stylingMode="outlined"
                onClick={handleExportJSON}
              />
            )}
          </div>
        </AccountingFilterPanel>

        {/* Assets Grid */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200">
          {isLoading ? (
            <div className="text-center py-12">
              <p className="text-gray-500">กำลังโหลดข้อมูลทรัพย์สิน...</p>
            </div>
          ) : (
            <DataGrid
              dataSource={assets}
              keyExpr="id"
              showBorders={false}
              showRowLines={true}
              showColumnLines={false}
              rowAlternationEnabled={true}
              allowColumnReordering={true}
              allowColumnResizing={true}
              columnAutoWidth={true}
              hoverStateEnabled={true}
            >
              <Paging defaultPageSize={20} />
              <FilterRow visible={true} />
              <HeaderFilter visible={true} />
              <SearchPanel visible={true} placeholder="ค้นหา..." />
              <Sorting mode="multiple" />
              <ColumnChooser enabled={true} />
              <Export enabled={true} allowExportSelectedData={true} />

              <Toolbar>
                <ToolbarItem name="searchPanel" location="before" />
                <ToolbarItem name="exportButton" location="after" />
                <ToolbarItem name="columnChooserButton" location="after" />
              </Toolbar>

              <Column dataField="assetCode" caption="รหัสทรัพย์สิน" width={150} />
              <Column dataField="nameTh" caption="ชื่อ (TH)" minWidth={200} />
              <Column dataField="nameEn" caption="ชื่อ (EN)" minWidth={200} />
              <Column
                dataField="categoryId"
                caption="หมวดหมู่"
                calculateCellValue={(rowData: FixedAsset) => getCategoryName(rowData.categoryId)}
                width={150}
              />
              <Column dataField="acquisitionDate" caption="วันที่ได้มา" dataType="date" width={120} />
              <Column
                dataField="acquisitionCost"
                caption="ราคาทุน"
                dataType="number"
                format="#,##0.00"
                width={130}
                alignment="right"
              />
              <Column
                dataField="accumulatedDepreciation"
                caption="ค่าเสื่อมสะสม"
                dataType="number"
                format="#,##0.00"
                width={130}
                alignment="right"
              />
              <Column
                dataField="netBookValue"
                caption="มูลค่าสุทธิ"
                dataType="number"
                format="#,##0.00"
                width={130}
                alignment="right"
              />
              <Column
                dataField="status"
                caption="สถานะ"
                width={100}
                cellRender={statusCellRender}
              />
              <Column dataField="location" caption="สถานที่" width={150} />

              <Summary>
                <TotalItem column="acquisitionCost" summaryType="sum" valueFormat="#,##0.00" displayFormat="รวม: {0}" />
                <TotalItem column="accumulatedDepreciation" summaryType="sum" valueFormat="#,##0.00" displayFormat="รวม: {0}" />
                <TotalItem column="netBookValue" summaryType="sum" valueFormat="#,##0.00" displayFormat="รวม: {0}" />
              </Summary>
            </DataGrid>
          )}
        </div>
      </div>
    </div>
  );
}
