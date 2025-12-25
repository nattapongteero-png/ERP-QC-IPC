'use client';

// Fixed Assets List Page
// Feature: 010-accounting-module-integration
// User Story 7: Manage Fixed Assets and Depreciation

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from 'devextreme-react/button';
import { SelectBox } from 'devextreme-react/select-box';
import DataGrid, { Column, Export, Summary, TotalItem, Paging, FilterRow, SearchPanel } from 'devextreme-react/data-grid';
import notify from 'devextreme/ui/notify';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { Package, Building2, TrendingDown, Calculator } from 'lucide-react';
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

  return (
    <div className="flex flex-col gap-6">
      <ResponsivePageHeader
        title="Fixed Assets"
        subtitle="Thai Revenue Code compliant fixed asset management"
        icon={Package}
        iconColor="text-blue-600"
      />

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Assets"
          value={summary?.totalAssets?.toString() || '-'}
          icon={Package}
          iconColor="text-blue-500"
          accentColor="border-blue-500"
        />
        <StatCard
          label="Active Assets"
          value={summary?.activeAssets?.toString() || '-'}
          icon={Building2}
          iconColor="text-green-500"
          accentColor="border-green-500"
        />
        <StatCard
          label="Total Cost"
          value={summary ? formatCurrency(summary.totalAcquisitionCost) : '-'}
          icon={Calculator}
          iconColor="text-purple-500"
          accentColor="border-purple-500"
        />
        <StatCard
          label="Net Book Value"
          value={summary ? formatCurrency(summary.totalNetBookValue) : '-'}
          icon={TrendingDown}
          iconColor="text-orange-500"
          accentColor="border-orange-500"
        />
      </div>

      {/* Filters and Actions */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Status</label>
            <SelectBox
              items={statusOptions}
              value={statusFilter}
              onValueChanged={(e) => setStatusFilter(e.value)}
              valueExpr="value"
              displayExpr="text"
              width={200}
            />
          </div>
          <Button
            text="Add Asset"
            type="default"
            stylingMode="contained"
            icon="plus"
            onClick={() => notify('Add Asset dialog - coming soon', 'info', 3000)}
          />
          <Button
            text="Run Depreciation"
            type="normal"
            stylingMode="outlined"
            onClick={() => notify('Run Depreciation dialog - coming soon', 'info', 3000)}
          />
          {assets.length > 0 && (
            <Button
              text="Export JSON"
              type="normal"
              stylingMode="outlined"
              onClick={handleExportJSON}
            />
          )}
        </div>
      </div>

      {/* Assets Grid */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Fixed Assets Register
        </h3>
        {isLoading ? (
          <div className="text-center py-8">
            <p className="text-gray-500">Loading fixed assets...</p>
          </div>
        ) : (
          <DataGrid
            dataSource={assets}
            showBorders
            columnAutoWidth
            allowColumnResizing
            rowAlternationEnabled
            hoverStateEnabled
          >
            <FilterRow visible />
            <SearchPanel visible width={250} />
            <Paging defaultPageSize={20} />
            <Column dataField="assetCode" caption="Asset Code" width={150} />
            <Column dataField="nameTh" caption="Name (TH)" />
            <Column dataField="nameEn" caption="Name (EN)" />
            <Column
              dataField="categoryId"
              caption="Category"
              calculateCellValue={(rowData: FixedAsset) => getCategoryName(rowData.categoryId)}
            />
            <Column dataField="acquisitionDate" caption="Acq. Date" dataType="date" width={120} />
            <Column
              dataField="acquisitionCost"
              caption="Cost"
              dataType="number"
              format="#,##0.00"
              width={130}
            />
            <Column
              dataField="accumulatedDepreciation"
              caption="Acc. Dep."
              dataType="number"
              format="#,##0.00"
              width={130}
            />
            <Column
              dataField="netBookValue"
              caption="Net Book Value"
              dataType="number"
              format="#,##0.00"
              width={130}
            />
            <Column dataField="status" caption="Status" width={120} />
            <Column dataField="location" caption="Location" />
            <Export enabled allowExportSelectedData />
            <Summary>
              <TotalItem column="acquisitionCost" summaryType="sum" valueFormat="#,##0.00" />
              <TotalItem column="accumulatedDepreciation" summaryType="sum" valueFormat="#,##0.00" />
              <TotalItem column="netBookValue" summaryType="sum" valueFormat="#,##0.00" />
            </Summary>
          </DataGrid>
        )}
      </div>
    </div>
  );
}
