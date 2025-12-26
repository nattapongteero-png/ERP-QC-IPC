'use client';

// Template Categories List Page
// Professional data grid with filtering, search, and CRUD operations

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  SearchPanel,
  Sorting,
  Selection,
  HeaderFilter,
  LoadPanel,
} from 'devextreme-react/data-grid';
import { Button } from 'devextreme-react/button';
import SelectBox from 'devextreme-react/select-box';
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

const statusOptions = [
  { value: '', label: 'All Status' },
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
];

export default function TemplateCategoriesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = React.useState('');
  const [selectedCategory, setSelectedCategory] = React.useState<TemplateCategory | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  const { data: categories = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['template-categories-list', statusFilter],
    queryFn: () => fetchCategories({
      isActive: statusFilter === '' ? undefined : statusFilter === 'true',
    }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template-categories-list'] });
      queryClient.invalidateQueries({ queryKey: ['template-categories'] });
      queryClient.invalidateQueries({ queryKey: ['template-dashboard'] });
      notify('Category deleted successfully', 'success', 3000);
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
        {cellData.value ? 'Active' : 'Inactive'}
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
          title="View"
        >
          <Eye className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/template/categories/${cellData.data.id}`);
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
        title="Template Categories"
        subtitle="Manage categories for organizing items"
        icon={FolderOpen}
        iconClassName="from-emerald-500 to-teal-600"
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
        actions={
          <Button
            text="New Category"
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
                <p className="font-medium text-red-800">Confirm Delete</p>
                <p className="text-sm text-red-600">
                  Are you sure you want to delete &quot;{selectedCategory.nameTh}&quot;?
                  Categories with items cannot be deleted.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  text="Cancel"
                  stylingMode="outlined"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setSelectedCategory(null);
                  }}
                />
                <Button
                  text={deleteMutation.isPending ? 'Deleting...' : 'Delete'}
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

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Filters:</span>
            </div>
            <div className="w-48">
              <SelectBox
                dataSource={statusOptions}
                displayExpr="label"
                valueExpr="value"
                value={statusFilter}
                onValueChanged={(e) => setStatusFilter(e.value)}
                placeholder="Status"
              />
            </div>
            {statusFilter && (
              <Button
                text="Clear Filters"
                stylingMode="text"
                onClick={() => setStatusFilter('')}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Data Grid */}
      <Card>
        <CardContent className="p-0">
          <DataGrid
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
            <SearchPanel visible placeholder="Search categories..." width={250} />
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

            <Column dataField="code" caption="Code" width={120} />
            <Column
              dataField="nameTh"
              caption="Name (Thai)"
              minWidth={200}
              cellRender={renderNameCell}
            />
            <Column dataField="nameEn" caption="Name (English)" minWidth={180} />
            <Column
              dataField="color"
              caption="Color"
              width={150}
              cellRender={renderColorCell}
              alignment="center"
            />
            <Column
              dataField="sortOrder"
              caption="Order"
              width={100}
              dataType="number"
              alignment="center"
            />
            <Column
              dataField="isActive"
              caption="Status"
              width={120}
              cellRender={renderStatusCell}
              alignment="center"
            />
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

      {/* Summary Footer */}
      <Card>
        <CardContent className="py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{categories.length}</p>
              <p className="text-sm text-gray-500">Total Categories</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                {categories.filter((c) => c.isActive).length}
              </p>
              <p className="text-sm text-gray-500">Active</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-600">
                {categories.filter((c) => !c.isActive).length}
              </p>
              <p className="text-sm text-gray-500">Inactive</p>
            </div>
            <div className="text-center">
              <div className="flex justify-center gap-1">
                {categories.slice(0, 6).map((cat) => (
                  <div
                    key={cat.id}
                    className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
                    style={{ backgroundColor: cat.color }}
                    title={cat.nameTh}
                  />
                ))}
                {categories.length > 6 && (
                  <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                    +{categories.length - 6}
                  </div>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-1">Colors</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
