'use client';

// Fixed Assets List Page
// Feature: 010-accounting-module-integration
// Pattern: Aligned with Template module

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from 'devextreme-react/button';
import { SelectBox } from 'devextreme-react/select-box';
import DataGrid, {
  Column,
  Paging,
  Pager,
  FilterRow,
  HeaderFilter,
  Sorting,
  LoadPanel,
} from 'devextreme-react/data-grid';
import notify from 'devextreme/ui/notify';
import { Card, CardContent } from '@/components/ui/card';
import { ResponsivePageHeader, StatCard } from '@/components/shared';
import { Building, Eye, Edit, Trash2, Package, CheckCircle, DollarSign, TrendingUp } from 'lucide-react';
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

async function deleteAsset(id: number): Promise<void> {
  const res = await fetch(`/api/accounting/fixed-assets/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to delete asset');
  }
}

export default function FixedAssetsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedAsset, setSelectedAsset] = useState<FixedAsset | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

  const deleteMutation = useMutation({
    mutationFn: deleteAsset,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed-assets'] });
      queryClient.invalidateQueries({ queryKey: ['fixed-assets-summary'] });
      notify('Asset deleted successfully', 'success', 3000);
      setShowDeleteConfirm(false);
      setSelectedAsset(null);
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  const getCategoryName = (categoryId: number): string => {
    const category = categories.find(c => c.id === categoryId);
    return category?.nameEn || 'Unknown';
  };

  const handleRowClick = (e: { data: FixedAsset }) => {
    router.push(`/accounting/fixed-assets/${e.data.id}`);
  };

  const handleDelete = (asset: FixedAsset) => {
    setSelectedAsset(asset);
    setShowDeleteConfirm(true);
  };

  const renderActionsCell = (cellData: { data: FixedAsset }) => {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/accounting/fixed-assets/${cellData.data.id}`);
          }}
          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
          title="View"
        >
          <Eye className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/accounting/fixed-assets/${cellData.data.id}`);
          }}
          className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
          title="Edit"
        >
          <Edit className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDelete(cellData.data);
          }}
          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
          title="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-6 p-1" data-testid="fixed-assets-page">
      {/* Header */}
      <ResponsivePageHeader
        title="Fixed Assets"
        subtitle="Manage fixed assets and depreciation"
        icon={Building}
        iconBgColor="bg-blue-100"
        iconColor="text-blue-600"
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Accounting', href: '/accounting' },
          { label: 'Fixed Assets' },
        ]}
        actions={
          <Button
            text="Add Asset"
            icon="plus"
            type="success"
            onClick={() => router.push('/accounting/fixed-assets/new')}
            data-testid="fa-add-btn"
          />
        }
      />

      {/* Delete Confirmation */}
      {showDeleteConfirm && selectedAsset && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-red-800">Confirm Delete</p>
                <p className="text-sm text-red-600">
                  Are you sure you want to delete &quot;{selectedAsset.nameTh}&quot;?
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  text="Cancel"
                  stylingMode="outlined"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setSelectedAsset(null);
                  }}
                />
                <Button
                  text={deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                  icon="trash"
                  type="danger"
                  onClick={() => deleteMutation.mutate(selectedAsset.id)}
                  disabled={deleteMutation.isPending}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4" data-testid="fa-stats">
        <StatCard
          label="Total Assets"
          value={summary?.totalAssets || 0}
          icon={Package}
          iconColor="text-blue-500"
          accentColor="border-blue-500"
        />
        <StatCard
          label="Active"
          value={summary?.activeAssets || 0}
          icon={CheckCircle}
          iconColor="text-green-500"
          accentColor="border-green-500"
        />
        <StatCard
          label="Total Cost"
          value={summary ? formatCurrency(summary.totalAcquisitionCost) : '-'}
          icon={DollarSign}
          iconColor="text-purple-500"
          accentColor="border-purple-500"
        />
        <StatCard
          label="Net Book Value"
          value={summary ? formatCurrency(summary.totalNetBookValue) : '-'}
          icon={TrendingUp}
          iconColor="text-orange-500"
          accentColor="border-orange-500"
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <SelectBox
                items={statusOptions}
                value={statusFilter}
                onValueChanged={(e) => setStatusFilter(e.value)}
                valueExpr="value"
                displayExpr="text"
                width={200}
              />
            </div>
            {statusFilter && (
              <Button
                text="Clear"
                stylingMode="text"
                onClick={() => setStatusFilter('')}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Data Grid */}
      <Card data-testid="fa-grid">
        <CardContent className="p-0">
          <DataGrid
            dataSource={assets}
            keyExpr="id"
            showBorders={false}
            showRowLines
            rowAlternationEnabled
            hoverStateEnabled
            columnAutoWidth
            onRowClick={handleRowClick}
            className="min-h-[400px]"
          >
            <LoadPanel enabled={isLoading} />
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

            <Column dataField="assetCode" caption="Asset Code" width={150} />
            <Column dataField="nameTh" caption="Name (TH)" minWidth={200} />
            <Column dataField="nameEn" caption="Name (EN)" minWidth={180} />
            <Column
              dataField="categoryId"
              caption="Category"
              calculateCellValue={(rowData: FixedAsset) => getCategoryName(rowData.categoryId)}
              width={150}
            />
            <Column dataField="acquisitionDate" caption="Acquisition Date" dataType="date" width={130} />
            <Column
              dataField="acquisitionCost"
              caption="Cost"
              dataType="number"
              format="#,##0.00"
              width={130}
              alignment="right"
            />
            <Column
              dataField="netBookValue"
              caption="Net Value"
              dataType="number"
              format="#,##0.00"
              width={130}
              alignment="right"
            />
            <Column dataField="status" caption="Status" width={100} />
            <Column
              caption="Actions"
              width={120}
              cellRender={renderActionsCell}
              allowFiltering={false}
              allowSorting={false}
              alignment="center"
            />
          </DataGrid>
        </CardContent>
      </Card>
    </div>
  );
}
