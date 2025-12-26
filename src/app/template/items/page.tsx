'use client';

// Template Items List Page
// Professional data grid with filtering, search, and CRUD operations

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  Package,
  Plus,
  Search,
  Filter,
  Eye,
  Edit,
  Trash2,
  MoreHorizontal,
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
import { TemplatePageHeader, TemplateStatusBadge, TemplatePriorityBadge } from '@/components/template';
import type { TemplateItem, TemplateCategory } from '@/types/template';

interface ListResponse {
  items: TemplateItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

async function fetchItems(params?: { status?: string; categoryId?: number }): Promise<ListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.categoryId) searchParams.set('categoryId', String(params.categoryId));
  searchParams.set('limit', '100');

  const res = await fetch(`/api/template/items?${searchParams.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch items');
  const data = await res.json();
  return data.data;
}

async function fetchCategories(): Promise<TemplateCategory[]> {
  const res = await fetch('/api/template/categories?isActive=true');
  if (!res.ok) throw new Error('Failed to fetch categories');
  const data = await res.json();
  return data.data || [];
}

async function deleteItem(id: number): Promise<void> {
  const res = await fetch(`/api/template/items/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || 'Failed to delete item');
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

const statusOptions = [
  { value: '', label: 'All Status' },
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
];

export default function TemplateItemsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchText, setSearchText] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const [categoryFilter, setCategoryFilter] = React.useState<number | null>(null);
  const [selectedItem, setSelectedItem] = React.useState<TemplateItem | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  const { data: itemsData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['template-items', statusFilter, categoryFilter],
    queryFn: () => fetchItems({
      status: statusFilter || undefined,
      categoryId: categoryFilter || undefined,
    }),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['template-categories'],
    queryFn: fetchCategories,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template-items'] });
      queryClient.invalidateQueries({ queryKey: ['template-dashboard'] });
      notify('Item deleted successfully', 'success', 3000);
      setShowDeleteConfirm(false);
      setSelectedItem(null);
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  // Filter items based on search text (client-side filtering)
  const items = React.useMemo(() => {
    const allItems = itemsData?.items || [];
    if (!searchText.trim()) return allItems;

    const searchLower = searchText.toLowerCase().trim();
    return allItems.filter((item) =>
      item.code?.toLowerCase().includes(searchLower) ||
      item.nameTh?.toLowerCase().includes(searchLower) ||
      item.nameEn?.toLowerCase().includes(searchLower) ||
      item.description?.toLowerCase().includes(searchLower)
    );
  }, [itemsData?.items, searchText]);

  const handleRowClick = (e: { data: TemplateItem }) => {
    router.push(`/template/items/${e.data.id}`);
  };

  const handleDelete = (item: TemplateItem) => {
    setSelectedItem(item);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (selectedItem) {
      deleteMutation.mutate(selectedItem.id);
    }
  };

  const renderStatusCell = (cellData: { value: string }) => {
    return <TemplateStatusBadge status={cellData.value as 'draft' | 'active' | 'archived'} size="sm" />;
  };

  const renderPriorityCell = (cellData: { value: string }) => {
    return <TemplatePriorityBadge priority={cellData.value as 'low' | 'medium' | 'high' | 'urgent'} size="sm" />;
  };

  const renderValueCell = (cellData: { value: number }) => {
    return <span className="font-mono">{formatCurrency(cellData.value)}</span>;
  };

  const renderCategoryCell = (cellData: { data: TemplateItem }) => {
    return cellData.data.category?.nameTh || <span className="text-gray-400">-</span>;
  };

  const renderActionsCell = (cellData: { data: TemplateItem }) => {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/template/items/${cellData.data.id}`);
          }}
          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
          title="View"
        >
          <Eye className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/template/items/${cellData.data.id}`);
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

  const categoryOptions = [
    { id: null, nameTh: 'All Categories' },
    ...categories,
  ];

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <TemplatePageHeader
        title="Template Items"
        subtitle="Manage all items in the system"
        icon={Package}
        iconClassName="from-indigo-500 to-purple-600"
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
        actions={
          <Button
            text="New Item"
            icon="add"
            type="success"
            onClick={() => router.push('/template/items/new')}
          />
        }
      />

      {/* Delete Confirmation */}
      {showDeleteConfirm && selectedItem && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-red-800">Confirm Delete</p>
                <p className="text-sm text-red-600">
                  Are you sure you want to delete &quot;{selectedItem.nameTh}&quot;? This action cannot be undone.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  text="Cancel"
                  stylingMode="outlined"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setSelectedItem(null);
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

      {/* Filters & Statistics */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Filters:</span>
              </div>
              <div className="w-56">
                <TextBox
                  value={searchText}
                  onValueChanged={(e) => setSearchText(e.value || '')}
                  placeholder="Search items..."
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
                  placeholder="Status"
                />
              </div>
              <div className="w-44">
                <SelectBox
                  dataSource={categoryOptions}
                  displayExpr="nameTh"
                  valueExpr="id"
                  value={categoryFilter}
                  onValueChanged={(e) => setCategoryFilter(e.value)}
                  placeholder="Category"
                />
              </div>
              {(searchText || statusFilter || categoryFilter) && (
                <Button
                  text="Clear"
                  stylingMode="text"
                  onClick={() => {
                    setSearchText('');
                    setStatusFilter('');
                    setCategoryFilter(null);
                  }}
                />
              )}
            </div>

            {/* Compact Statistics */}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-md">
                <span className="text-gray-500">Total:</span>
                <span className="font-semibold text-gray-900">{itemsData?.total || 0}</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 rounded-md">
                <span className="text-blue-600">Active:</span>
                <span className="font-semibold text-blue-700">{items.filter((i) => i.status === 'active').length}</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded-md">
                <span className="text-gray-500">Draft:</span>
                <span className="font-semibold text-gray-700">{items.filter((i) => i.status === 'draft').length}</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 rounded-md">
                <span className="text-emerald-600">Value:</span>
                <span className="font-semibold text-emerald-700">{formatCurrency(items.reduce((sum, i) => sum + (i.totalValue || 0), 0))}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Grid */}
      <Card>
        <CardContent className="p-0">
          <DataGrid
            dataSource={items}
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

            <Column dataField="code" caption="Code" width={120} />
            <Column dataField="nameTh" caption="Name (Thai)" minWidth={200} />
            <Column dataField="nameEn" caption="Name (English)" minWidth={180} />
            <Column
              dataField="category"
              caption="Category"
              width={150}
              cellRender={renderCategoryCell}
              allowFiltering={false}
            />
            <Column
              dataField="status"
              caption="Status"
              width={120}
              cellRender={renderStatusCell}
              alignment="center"
            />
            <Column
              dataField="priority"
              caption="Priority"
              width={120}
              cellRender={renderPriorityCell}
              alignment="center"
            />
            <Column
              dataField="quantity"
              caption="Qty"
              width={100}
              dataType="number"
              format="#,##0.##"
              alignment="right"
            />
            <Column
              dataField="unitPrice"
              caption="Unit Price"
              width={130}
              cellRender={renderValueCell}
              alignment="right"
            />
            <Column
              dataField="totalValue"
              caption="Total Value"
              width={140}
              cellRender={renderValueCell}
              alignment="right"
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

    </div>
  );
}
