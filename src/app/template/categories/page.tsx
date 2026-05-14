'use client';

// Template Categories List Page
// Professional data grid with filtering, search, and CRUD operations

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  FolderOpen,
  Eye,
  Edit,
  Trash2,
  Filter,
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
import type { TemplateCategory } from '@/types/template';

async function fetchCategories(params?: { isActive?: boolean }): Promise<TemplateCategory[]> {
  const searchParams = new URLSearchParams();
  if (params?.isActive !== undefined) {
    searchParams.set('isActive', String(params.isActive));
  }

  const res = await fetch(`/api/template/categories?${searchParams.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch categories');
  const data = await res.json();
  return data.data || [];
}

async function deleteCategory(id: number): Promise<void> {
  const res = await fetch(`/api/template/categories/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || 'Failed to delete category');
  }
}

export default function TemplateCategoriesPage() {
  const t = useTranslations('template.categories');
  const tActions = useTranslations('template.actions');
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();

  const statusOptions = React.useMemo(() => [
    { value: '', label: t('statusOptions.all') },
    { value: 'true', label: t('statusOptions.active') },
    { value: 'false', label: t('statusOptions.inactive') },
  ], [t]);

  const [searchText, setSearchText] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const [selectedCategory, setSelectedCategory] = React.useState<TemplateCategory | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  const { data: categoriesData = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['template-categories-list', statusFilter],
    queryFn: () => fetchCategories({
      isActive: statusFilter === '' ? undefined : statusFilter === 'true',
    }),
  });

  // Filter categories based on search text (client-side filtering)
  const categories = React.useMemo(() => {
    if (!searchText.trim()) return categoriesData;

    const searchLower = searchText.toLowerCase().trim();
    return categoriesData.filter((cat) =>
      cat.code?.toLowerCase().includes(searchLower) ||
      cat.nameTh?.toLowerCase().includes(searchLower) ||
      cat.nameEn?.toLowerCase().includes(searchLower) ||
      cat.description?.toLowerCase().includes(searchLower)
    );
  }, [categoriesData, searchText]);

  const deleteMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template-categories-list'] });
      queryClient.invalidateQueries({ queryKey: ['template-categories'] });
      queryClient.invalidateQueries({ queryKey: ['template-dashboard'] });
      notify(t('toast.deleteSuccess'), 'success', 3000);
      setShowDeleteConfirm(false);
      setSelectedCategory(null);
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  const handleRowClick = (e: { data: TemplateCategory }) => {
    router.push(`/template/categories/${e.data.id}`);
  };

  const handleDelete = (category: TemplateCategory) => {
    setSelectedCategory(category);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (selectedCategory) {
      deleteMutation.mutate(selectedCategory.id);
    }
  };

  const renderColorCell = (cellData: { value: string }) => {
    return (
      <div className="flex items-center gap-2">
        <div
          className="w-6 h-6 rounded-full border border-gray-200"
          style={{ backgroundColor: cellData.value }}
        />
        <span className="font-mono text-xs text-gray-500">{cellData.value}</span>
      </div>
    );
  };

  const renderStatusCell = (cellData: { value: boolean }) => {
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
        cellData.value
          ? 'bg-green-100 text-green-800'
          : 'bg-gray-100 text-gray-800'
      }`}>
        {cellData.value ? t('statusOptions.active') : t('statusOptions.inactive')}
      </span>
    );
  };

  const renderActionsCell = (cellData: { data: TemplateCategory }) => {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/template/categories/${cellData.data.id}`);
          }}
          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
          title={tActions('view')}
        >
          <Eye className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/template/categories/${cellData.data.id}`);
          }}
          className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
          title={tActions('edit')}
        >
          <Edit className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDelete(cellData.data);
          }}
          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
          title={tActions('delete')}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    );
  };

  const renderNameCell = (cellData: { data: TemplateCategory }) => {
    return (
      <div className="flex items-center gap-2">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: cellData.data.color }}
        />
        <span>{cellData.data.nameTh}</span>
      </div>
    );
  };

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <TemplatePageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        icon={FolderOpen}
        iconClassName="from-emerald-500 to-teal-600"
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
        actions={
          <Button
            text={t('newCategory')}
            icon="add"
            type="success"
            onClick={() => router.push('/template/categories/new')}
          />
        }
      />

      {/* Delete Confirmation */}
      {showDeleteConfirm && selectedCategory && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-red-800">{t('deleteConfirm.title')}</p>
                <p className="text-sm text-red-600">
                  {t('deleteConfirm.message', { name: selectedCategory.nameTh })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  text={tActions('cancel')}
                  stylingMode="outlined"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setSelectedCategory(null);
                  }}
                />
                <Button
                  text={deleteMutation.isPending ? tActions('deleting') : tActions('delete')}
                  icon={deleteMutation.isPending ? 'spindown' : 'trash'}
                  type="danger"
                  onClick={confirmDelete}
                  disabled={deleteMutation.isPending}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters & Statistics */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">{t('filters')}</span>
              </div>
              <div className="w-56">
                <TextBox
                  value={searchText}
                  onValueChanged={(e) => setSearchText(e.value || '')}
                  valueChangeEvent="keyup"
                  placeholder={t('searchPlaceholder')}
                  showClearButton
                  mode="search"
                />
              </div>
              <div className="w-40">
                <SelectBox
                  dataSource={statusOptions}
                  displayExpr="label"
                  valueExpr="value"
                  value={statusFilter}
                  onValueChanged={(e) => setStatusFilter(e.value)}
                  placeholder={t('statusPlaceholder')}
                />
              </div>
              {(searchText || statusFilter) && (
                <Button
                  text={tActions('clear')}
                  stylingMode="text"
                  onClick={() => {
                    setSearchText('');
                    setStatusFilter('');
                  }}
                />
              )}
            </div>

            {/* Compact Statistics */}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-md">
                <span className="text-gray-500">{t('stats.total')}</span>
                <span className="font-semibold text-gray-900">{categoriesData.length}</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 rounded-md">
                <span className="text-green-600">{t('stats.active')}</span>
                <span className="font-semibold text-green-700">{categories.filter((c) => c.isActive).length}</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded-md">
                <span className="text-gray-500">{t('stats.inactive')}</span>
                <span className="font-semibold text-gray-700">{categories.filter((c) => !c.isActive).length}</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 rounded-md">
                <div className="flex -space-x-1">
                  {categories.slice(0, 4).map((cat) => (
                    <div
                      key={cat.id}
                      className="w-4 h-4 rounded-full border border-white"
                      style={{ backgroundColor: cat.color }}
                      title={cat.nameTh}
                    />
                  ))}
                </div>
                {categories.length > 4 && (
                  <span className="text-purple-600 text-xs">+{categories.length - 4}</span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Grid */}
      <Card>
        <CardContent className="p-0">
          <DataGrid
            key={locale}
            dataSource={categories}
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
            <Selection mode="none" />
            <Paging defaultPageSize={20} />
            <Pager
              showPageSizeSelector
              allowedPageSizes={[10, 20, 50, 100]}
              showInfo
              showNavigationButtons
            />

            <Column dataField="code" caption={t('columns.code')} width={120} />
            <Column
              dataField="nameTh"
              caption={t('columns.nameTh')}
              minWidth={200}
              cellRender={renderNameCell}
            />
            <Column dataField="nameEn" caption={t('columns.nameEn')} minWidth={180} />
            <Column
              dataField="color"
              caption={t('columns.color')}
              width={150}
              cellRender={renderColorCell}
              alignment="center"
            />
            <Column
              dataField="sortOrder"
              caption={t('columns.sortOrder')}
              width={100}
              dataType="number"
              alignment="center"
            />
            <Column
              dataField="isActive"
              caption={t('columns.status')}
              width={120}
              cellRender={renderStatusCell}
              alignment="center"
            />
            <Column
              caption={t('columns.actions')}
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
