'use client';

/**
 * Matching Tolerances List Page (T117)
 * Professional data grid with filtering, search, and CRUD operations
 * Following template module pattern
 */

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  Settings,
  Filter,
  Eye,
  Edit,
  Trash2,
} from 'lucide-react';
import DataGrid, {
  Column,
  Paging,
  Pager,
  FilterRow,
  Sorting,
  Selection,
  HeaderFilter,
  LoadPanel,
} from 'devextreme-react/data-grid';
import { Button } from 'devextreme-react/button';
import SelectBox from 'devextreme-react/select-box';
import TextBox from 'devextreme-react/text-box';
import notify from 'devextreme/ui/notify';
import { Card, CardContent } from '@/components/ui/card';
import { TemplatePageHeader } from '@/components/template';
import type { MatchingTolerance, ToleranceType } from '@/types/matching';
import { TOLERANCE_TYPE_OPTIONS } from '@/types/matching';

interface ListResponse {
  data: MatchingTolerance[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

async function fetchTolerances(params?: {
  toleranceType?: string;
  isActive?: boolean;
  search?: string;
}): Promise<ListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.toleranceType) searchParams.set('toleranceType', params.toleranceType);
  if (params?.isActive !== undefined) searchParams.set('isActive', String(params.isActive));
  if (params?.search) searchParams.set('search', params.search);
  searchParams.set('limit', '100');

  const res = await fetch(`/api/settings/matching-tolerances?${searchParams.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch tolerances');
  const data = await res.json();
  return data;
}

async function deleteTolerance(id: number): Promise<void> {
  const res = await fetch(`/api/settings/matching-tolerances/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to delete tolerance');
  }
}

export default function MatchingTolerancesPage() {
  const t = useTranslations('settings');
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchText, setSearchText] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState('');
  const [selectedTolerance, setSelectedTolerance] = React.useState<MatchingTolerance | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  const statusOptions = React.useMemo(() => [
    { value: '', label: t('matchingTolerances.allStatus') },
    { value: 'true', label: t('matchingTolerances.active') },
    { value: 'false', label: t('matchingTolerances.inactive') },
  ], [t]);

  const typeFilterOptions = React.useMemo(() => [
    { value: '', label: t('matchingTolerances.allTypes') },
    ...TOLERANCE_TYPE_OPTIONS,
  ], [t]);

  const { data: tolerancesData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['matching-tolerances', statusFilter, typeFilter],
    queryFn: () => fetchTolerances({
      toleranceType: typeFilter || undefined,
      isActive: statusFilter ? statusFilter === 'true' : undefined,
    }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTolerance,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matching-tolerances'] });
      notify(t('matchingTolerances.deleteSuccess'), 'success', 3000);
      setShowDeleteConfirm(false);
      setSelectedTolerance(null);
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  // Filter tolerances based on search text (client-side filtering)
  const tolerances = React.useMemo(() => {
    const allTolerances = tolerancesData?.data || [];
    if (!searchText.trim()) return allTolerances;

    const searchLower = searchText.toLowerCase().trim();
    return allTolerances.filter((item) =>
      item.name?.toLowerCase().includes(searchLower) ||
      item.description?.toLowerCase().includes(searchLower) ||
      item.toleranceType?.toLowerCase().includes(searchLower)
    );
  }, [tolerancesData?.data, searchText]);

  const handleRowClick = (e: { data: MatchingTolerance }) => {
    router.push(`/settings/matching-tolerances/${e.data.id}`);
  };

  const handleDelete = (tolerance: MatchingTolerance) => {
    setSelectedTolerance(tolerance);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (selectedTolerance) {
      deleteMutation.mutate(selectedTolerance.id);
    }
  };

  const renderStatusCell = (cellData: { value: boolean }) => {
    const isActive = cellData.value;
    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${
          isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
        }`}
      >
        {isActive ? t('matchingTolerances.active') : t('matchingTolerances.inactive')}
      </span>
    );
  };

  const renderTypeCell = (cellData: { value: ToleranceType }) => {
    const typeLabels: Record<ToleranceType, { label: string; className: string }> = {
      quantity: { label: t('matchingTolerances.types.quantity'), className: 'bg-blue-100 text-blue-800' },
      price: { label: t('matchingTolerances.types.price'), className: 'bg-purple-100 text-purple-800' },
      amount: { label: t('matchingTolerances.types.amount'), className: 'bg-orange-100 text-orange-800' },
    };
    const config = typeLabels[cellData.value] || { label: cellData.value, className: 'bg-gray-100 text-gray-800' };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.className}`}>
        {config.label}
      </span>
    );
  };

  const renderMethodCell = (cellData: { value: string }) => {
    return (
      <span className="capitalize">{cellData.value}</span>
    );
  };

  const renderValueCell = (cellData: { data: MatchingTolerance }) => {
    const item = cellData.data;
    const suffix = item.toleranceMethod === 'percentage' ? '%' : '';
    return (
      <span className="font-mono">
        {item.toleranceValue.toFixed(2)}{suffix}
      </span>
    );
  };

  const renderActionsCell = (cellData: { data: MatchingTolerance }) => {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/settings/matching-tolerances/${cellData.data.id}`);
          }}
          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
          title={t('matchingTolerances.view')}
        >
          <Eye className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/settings/matching-tolerances/${cellData.data.id}`);
          }}
          className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
          title={t('matchingTolerances.edit')}
        >
          <Edit className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDelete(cellData.data);
          }}
          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
          title={t('matchingTolerances.delete')}
          data-testid={`delete-tolerance-${cellData.data.id}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <TemplatePageHeader
        title={t('matchingTolerances.title')}
        subtitle={t('matchingTolerances.description')}
        icon={Settings}
        iconClassName="from-indigo-500 to-purple-600"
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
        actions={
          <Button
            text={t('matchingTolerances.newTolerance')}
            icon="add"
            type="success"
            onClick={() => router.push('/settings/matching-tolerances/new')}
            data-testid="new-tolerance-btn"
          />
        }
      />

      {/* Delete Confirmation */}
      {showDeleteConfirm && selectedTolerance && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-red-800">{t('matchingTolerances.confirmDelete')}</p>
                <p className="text-sm text-red-600">
                  {t('matchingTolerances.confirmDeleteMessage', { name: selectedTolerance.name })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  text={t('vmiPortalEdit.cancel')}
                  stylingMode="outlined"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setSelectedTolerance(null);
                  }}
                />
                <Button
                  text={deleteMutation.isPending ? t('matchingTolerances.deleting') : t('matchingTolerances.delete')}
                  icon={deleteMutation.isPending ? 'spindown' : 'trash'}
                  type="danger"
                  onClick={confirmDelete}
                  disabled={deleteMutation.isPending}
                  data-testid="confirm-delete-btn"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Box */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="py-4">
          <h3 className="text-blue-800 font-medium mb-2">{t('matchingTolerances.aboutTitle')}</h3>
          <p className="text-blue-700 text-sm">
            {t('matchingTolerances.aboutDescription')}
          </p>
        </CardContent>
      </Card>

      {/* Filters & Statistics */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">{t('matchingTolerances.filters')}</span>
              </div>
              <div className="w-56">
                <TextBox
                  value={searchText}
                  onValueChanged={(e) => setSearchText(e.value || '')}
                  valueChangeEvent="keyup"
                  placeholder={t('matchingTolerances.searchPlaceholder')}
                  showClearButton
                  mode="search"
                  data-testid="search-input"
                />
              </div>
              <div className="w-40">
                <SelectBox
                  dataSource={typeFilterOptions}
                  displayExpr="label"
                  valueExpr="value"
                  value={typeFilter}
                  onValueChanged={(e) => setTypeFilter(e.value)}
                  placeholder={t('matchingTolerances.grid.type')}
                  data-testid="type-filter"
                />
              </div>
              <div className="w-36">
                <SelectBox
                  dataSource={statusOptions}
                  displayExpr="label"
                  valueExpr="value"
                  value={statusFilter}
                  onValueChanged={(e) => setStatusFilter(e.value)}
                  placeholder={t('matchingTolerances.grid.status')}
                  data-testid="status-filter"
                />
              </div>
              {(searchText || statusFilter || typeFilter) && (
                <Button
                  text={t('matchingTolerances.clear')}
                  stylingMode="text"
                  onClick={() => {
                    setSearchText('');
                    setStatusFilter('');
                    setTypeFilter('');
                  }}
                />
              )}
            </div>

            {/* Compact Statistics */}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-md">
                <span className="text-gray-500">{t('matchingTolerances.total')}:</span>
                <span className="font-semibold text-gray-900">{tolerancesData?.total || 0}</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 rounded-md">
                <span className="text-green-600">{t('matchingTolerances.active')}:</span>
                <span className="font-semibold text-green-700">
                  {tolerances.filter((tol) => tol.isActive).length}
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 rounded-md">
                <span className="text-blue-600">{t('matchingTolerances.types.quantity')}:</span>
                <span className="font-semibold text-blue-700">
                  {tolerances.filter((tol) => tol.toleranceType === 'quantity').length}
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 rounded-md">
                <span className="text-purple-600">{t('matchingTolerances.types.price')}:</span>
                <span className="font-semibold text-purple-700">
                  {tolerances.filter((tol) => tol.toleranceType === 'price').length}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Grid */}
      <Card>
        <CardContent className="p-0">
          <DataGrid
            dataSource={tolerances}
            keyExpr="id"
            showBorders={false}
            showRowLines
            rowAlternationEnabled
            hoverStateEnabled
            columnAutoWidth
            onRowClick={handleRowClick}
            className="min-h-[400px]"
            data-testid="tolerances-grid"
          >
            <LoadPanel enabled={isLoading} />
            <FilterRow visible />
            <HeaderFilter visible />
            <Sorting mode="multiple" />
            <Selection mode="none" />
            <Paging defaultPageSize={20} />
            <Pager
              showPageSizeSelector
              allowedPageSizes={[10, 20, 50, 100]}
              showInfo
              showNavigationButtons
            />

            <Column dataField="name" caption={t('matchingTolerances.grid.name')} minWidth={200} />
            <Column
              dataField="toleranceType"
              caption={t('matchingTolerances.grid.type')}
              width={120}
              cellRender={renderTypeCell}
              alignment="center"
            />
            <Column
              dataField="toleranceMethod"
              caption={t('matchingTolerances.grid.method')}
              width={120}
              cellRender={renderMethodCell}
            />
            <Column
              caption={t('matchingTolerances.grid.value')}
              width={120}
              cellRender={renderValueCell}
              alignment="right"
            />
            <Column
              dataField="priority"
              caption={t('matchingTolerances.grid.priority')}
              width={100}
              alignment="center"
            />
            <Column
              dataField="isActive"
              caption={t('matchingTolerances.grid.status')}
              width={100}
              cellRender={renderStatusCell}
              alignment="center"
            />
            <Column
              caption={t('matchingTolerances.grid.actions')}
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
