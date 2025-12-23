'use client';

/**
 * Inventory Items Dashboard Page
 *
 * Professional dashboard for viewing and managing inventory items.
 * Redesigned with DevExtreme UI components.
 */

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import DataGrid, {
  Column,
  Paging,
  Pager,
  FilterRow,
  SearchPanel,
  HeaderFilter,
  ColumnChooser,
  Export,
  Grouping,
  GroupPanel,
  Summary,
  TotalItem,
  Toolbar,
  Item as ToolbarItem,
  Scrolling,
  Selection,
} from 'devextreme-react/data-grid';
import { Workbook } from 'exceljs';
import { saveAs } from 'file-saver';
import { exportDataGrid } from 'devextreme/excel_exporter';
import type { ExportingEvent } from 'devextreme/ui/data_grid';
import {
  Leaf,
  FlaskConical,
  Box,
  Pill,
  Package,
  RefreshCw,
  Plus,
  Eye,
  Edit,
  Trash2,
  Boxes,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  Barcode,
  Warehouse,
  DollarSign,
  Activity,
} from 'lucide-react';
import { ItemEditDialog, Item, ItemFormData } from '@/components/ui/item-edit-dialog';
import { DxConfirmDialog } from '@/components/ui/dx-popup';
import { cn } from '@/lib/utils/cn';

// ============================================
// Constants
// ============================================

type ItemType = 'raw_material' | 'packaging' | 'wip' | 'finished_goods' | 'consumable';

const ITEM_TYPE_CONFIG: Record<ItemType, {
  label: string;
  labelTh: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  chartColor: string;
  icon: React.ReactNode;
}> = {
  raw_material: {
    label: 'Raw Material',
    labelTh: 'วัตถุดิบ',
    bgColor: 'bg-green-50',
    textColor: 'text-green-700',
    borderColor: 'border-green-200',
    chartColor: '#22c55e',
    icon: <Leaf className="h-4 w-4" />,
  },
  packaging: {
    label: 'Packaging',
    labelTh: 'บรรจุภัณฑ์',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200',
    chartColor: '#3b82f6',
    icon: <Box className="h-4 w-4" />,
  },
  wip: {
    label: 'Work in Progress',
    labelTh: 'งานระหว่างทำ',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-700',
    borderColor: 'border-orange-200',
    chartColor: '#f97316',
    icon: <FlaskConical className="h-4 w-4" />,
  },
  finished_goods: {
    label: 'Finished Goods',
    labelTh: 'สินค้าสำเร็จรูป',
    bgColor: 'bg-purple-50',
    textColor: 'text-purple-700',
    borderColor: 'border-purple-200',
    chartColor: '#a855f7',
    icon: <Pill className="h-4 w-4" />,
  },
  consumable: {
    label: 'Consumable',
    labelTh: 'วัสดุสิ้นเปลือง',
    bgColor: 'bg-gray-50',
    textColor: 'text-gray-700',
    borderColor: 'border-gray-200',
    chartColor: '#6b7280',
    icon: <Package className="h-4 w-4" />,
  },
};

// ============================================
// Helper Components
// ============================================


function TypeCard({
  count,
  total,
  config,
  isActive,
  onClick,
}: {
  count: number;
  total: number;
  config: {
    label: string;
    labelTh: string;
    bgColor: string;
    textColor: string;
    borderColor: string;
    icon: React.ReactNode;
  };
  isActive: boolean;
  onClick: () => void;
}) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full border rounded-xl p-4 transition-all text-left',
        isActive
          ? `${config.bgColor} ${config.borderColor} border-2 shadow-md`
          : 'bg-white border-gray-200 hover:shadow-md hover:border-gray-300'
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn('p-2 rounded-lg', config.bgColor, config.textColor)}>
            {config.icon}
          </div>
          <div>
            <p className={cn('text-sm font-medium', isActive ? config.textColor : 'text-gray-700')}>
              {config.labelTh}
            </p>
            <p className="text-xs text-gray-500">{percentage}% of total</p>
          </div>
        </div>
        <p className={cn('text-2xl font-bold', isActive ? config.textColor : 'text-gray-900')}>{count}</p>
      </div>
    </button>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  subValue,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subValue?: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
      <div className={cn('p-2 rounded-lg', color)}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-lg font-bold text-gray-900">{value}</p>
        {subValue && <p className="text-xs text-gray-500">{subValue}</p>}
      </div>
    </div>
  );
}

// ============================================
// API Functions
// ============================================

async function fetchItems(): Promise<Item[]> {
  const response = await fetch('/api/items?limit=1000');
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data?.items || [];
}

// ============================================
// Main Component
// ============================================

export default function ItemsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'all' | ItemType>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; item: Item | null }>({ open: false, item: null });

  // Fetch data
  const { data: items = [], isLoading, refetch } = useQuery({
    queryKey: ['items-list'],
    queryFn: fetchItems,
  });

  // Handle refresh
  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // Calculate type counts
  const typeCounts = useMemo(() => {
    const counts: Record<ItemType, number> = {
      raw_material: 0,
      packaging: 0,
      wip: 0,
      finished_goods: 0,
      consumable: 0,
    };
    items.forEach((item) => {
      const type = item.type as ItemType;
      if (counts[type] !== undefined) {
        counts[type]++;
      }
    });
    return counts;
  }, [items]);

  // Calculate statistics
  const statistics = useMemo(() => {
    const totalValue = items.reduce((sum, item) => sum + (Number(item.onHandCost) || 0), 0);
    const totalQuantity = items.reduce((sum, item) => sum + (Number(item.onHand) || 0), 0);
    const lowStockItems = items.filter(
      (item) => item.minStock && item.onHand !== undefined && item.onHand < item.minStock
    ).length;
    const activeItems = items.filter((item) => item.isActive).length;
    const inactiveItems = items.filter((item) => !item.isActive).length;
    const vmiReadyItems = items.filter((item) => item.tppCode || item.ttmtCode).length;

    return {
      totalValue,
      totalQuantity,
      lowStockItems,
      activeItems,
      inactiveItems,
      vmiReadyItems,
    };
  }, [items]);

  // Filter items by tab
  const filteredItems = useMemo(() => {
    if (activeTab === 'all') return items;
    return items.filter((item) => item.type === activeTab);
  }, [items, activeTab]);

  // Handlers
  const handleSave = async (formData: ItemFormData) => {
    const url = editingItem ? `/api/items/${editingItem.id}` : '/api/items';
    const method = editingItem ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });

    const data = await res.json();
    if (data.success) {
      setDialogOpen(false);
      setEditingItem(null);
      refetch();
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm.item) return;

    try {
      const res = await fetch(`/api/items/${deleteConfirm.item.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        refetch();
      }
    } finally {
      setDeleteConfirm({ open: false, item: null });
    }
  };

  const handleEdit = (item: Item) => {
    setEditingItem(item);
    setDialogOpen(true);
  };

  const handleOpenCreate = () => {
    setEditingItem(null);
    setDialogOpen(true);
  };

  // Excel export handler
  const onExporting = useCallback((e: ExportingEvent) => {
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Items');

    exportDataGrid({
      component: e.component,
      worksheet,
      autoFilterEnabled: true,
      customizeCell: ({ gridCell, excelCell }) => {
        if (gridCell?.rowType === 'data') {
          if (gridCell.column?.dataField === 'type') {
            const type = gridCell.value as ItemType;
            excelCell.value = ITEM_TYPE_CONFIG[type]?.labelTh || type;
          }
          if (gridCell.column?.dataField === 'isActive') {
            excelCell.value = gridCell.value ? 'Active' : 'Inactive';
          }
        }
      },
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer) => {
        saveAs(new Blob([buffer], { type: 'application/octet-stream' }), 'inventory-items.xlsx');
      });
    });
  }, []);

  // Custom cell renderers
  const renderCodeCell = useCallback((data: { data: Item }) => {
    const config = ITEM_TYPE_CONFIG[data.data.type as ItemType];
    return (
      <div className="flex items-center gap-2">
        <span className={cn('p-1 rounded', config?.bgColor, config?.textColor)}>
          {config?.icon}
        </span>
        <button
          onClick={() => router.push(`/inventory/items/${data.data.id}`)}
          className="font-mono text-amber-600 hover:text-amber-800 hover:underline"
        >
          {data.data.code}
        </button>
      </div>
    );
  }, [router]);

  const renderNameCell = useCallback((data: { data: Item }) => {
    return (
      <div>
        <p className="font-medium text-gray-900">{data.data.nameTh}</p>
        {data.data.nameEn && (
          <p className="text-xs text-gray-500">{data.data.nameEn}</p>
        )}
      </div>
    );
  }, []);

  const renderTypeCell = useCallback((data: { value: ItemType }) => {
    const config = ITEM_TYPE_CONFIG[data.value];
    if (!config) return data.value;
    return (
      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', config.bgColor, config.textColor)}>
        {config.icon}
        {config.labelTh}
      </span>
    );
  }, []);

  const renderStockCell = useCallback((data: { data: Item }) => {
    const onHand = data.data.onHand ?? 0;
    const minStock = data.data.minStock ?? 0;
    const isLow = minStock > 0 && onHand < minStock;

    return (
      <div>
        <div className={cn('font-medium', isLow ? 'text-red-600' : 'text-gray-900')}>
          {onHand.toLocaleString()} {data.data.primaryUnit}
          {isLow && (
            <span className="ml-1 text-xs px-1 py-0.5 bg-red-100 text-red-700 rounded">Low</span>
          )}
        </div>
        {data.data.onHandCost !== undefined && data.data.onHandCost > 0 && (
          <div className="text-xs text-gray-500">
            ฿{data.data.onHandCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        )}
      </div>
    );
  }, []);

  const renderStatusCell = useCallback((data: { value: boolean }) => {
    return data.value ? (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
        <CheckCircle className="h-3 w-3" />
        Active
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
        <XCircle className="h-3 w-3" />
        Inactive
      </span>
    );
  }, []);

  const renderVmiCell = useCallback((data: { data: Item }) => {
    const hasVmi = data.data.tppCode || data.data.ttmtCode;
    return hasVmi ? (
      <div className="flex items-center gap-1 text-emerald-600" title={`TPP: ${data.data.tppCode || '-'}, TTMT: ${data.data.ttmtCode || '-'}`}>
        <CheckCircle className="h-4 w-4" />
        <span className="text-xs font-medium">Ready</span>
      </div>
    ) : (
      <div className="flex items-center gap-1 text-gray-400">
        <XCircle className="h-4 w-4" />
        <span className="text-xs">-</span>
      </div>
    );
  }, []);

  const renderActionsCell = useCallback((data: { data: Item }) => {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/inventory/items/${data.data.id}`);
          }}
          className="p-1 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded"
          title="View Details"
        >
          <Eye className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleEdit(data.data);
          }}
          className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
          title="Edit"
        >
          <Edit className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setDeleteConfirm({ open: true, item: data.data });
          }}
          className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
          title="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    );
  }, [router]);

  const totalItems = items.length;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Inventory Items</h1>
            <p className="text-sm text-gray-500 mt-1">รายการสินค้าและวัตถุดิบ</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
              Refresh
            </button>
            <button
              onClick={() => router.push('/inventory/lots')}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Warehouse className="h-4 w-4" />
              View Lots
            </button>
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Plus className="h-4 w-4" />
              Add Item
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <p className="text-xs text-gray-500">Total Items</p>
            <p className="text-xl font-semibold text-gray-900">{isLoading ? '...' : totalItems}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <p className="text-xs text-gray-500">Active</p>
            <p className="text-xl font-semibold text-green-600">{isLoading ? '...' : statistics.activeItems}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <p className="text-xs text-gray-500">Low Stock</p>
            <p className="text-xl font-semibold text-amber-600">{isLoading ? '...' : statistics.lowStockItems}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <p className="text-xs text-gray-500">Raw Materials</p>
            <p className="text-xl font-semibold text-gray-900">{isLoading ? '...' : typeCounts.raw_material}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <p className="text-xs text-gray-500">Packaging</p>
            <p className="text-xl font-semibold text-gray-900">{isLoading ? '...' : typeCounts.packaging}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <p className="text-xs text-gray-500">Finished Goods</p>
            <p className="text-xl font-semibold text-gray-900">{isLoading ? '...' : typeCounts.finished_goods}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <p className="text-xs text-gray-500">VMI Ready</p>
            <p className="text-xl font-semibold text-blue-600">{isLoading ? '...' : statistics.vmiReadyItems}</p>
          </div>
        </div>

        {/* Main Content */}
        <div>
          {/* Dashboard Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
            {/* Left Column - Main Content */}
            <div className="xl:col-span-3 space-y-6">
              {/* Item Type Cards */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Package className="h-5 w-5 text-gray-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Items by Type</h3>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                  {(Object.entries(ITEM_TYPE_CONFIG) as [ItemType, typeof ITEM_TYPE_CONFIG[ItemType]][]).map(
                    ([type, config]) => (
                      <TypeCard
                        key={type}
                        count={typeCounts[type]}
                        total={totalItems}
                        config={config}
                        isActive={activeTab === type}
                        onClick={() => setActiveTab(activeTab === type ? 'all' : type)}
                      />
                    )
                  )}
                </div>
              </div>

            </div>

            {/* Right Column - Sidebars */}
            <div className="space-y-6">
              {/* Inventory Summary */}
              <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="h-5 w-5 text-gray-500" />
                  <h3 className="font-semibold text-gray-900">Inventory Summary</h3>
                </div>
                <div className="space-y-3">
                  <SummaryCard
                    icon={<DollarSign className="h-4 w-4 text-emerald-600" />}
                    label="Total Value"
                    value={`฿${statistics.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                    color="bg-emerald-100"
                  />
                  <SummaryCard
                    icon={<Boxes className="h-4 w-4 text-blue-600" />}
                    label="Total Quantity"
                    value={statistics.totalQuantity.toLocaleString()}
                    subValue="units across all items"
                    color="bg-blue-100"
                  />
                  <SummaryCard
                    icon={<Barcode className="h-4 w-4 text-purple-600" />}
                    label="VMI Ready"
                    value={statistics.vmiReadyItems}
                    subValue={`${totalItems > 0 ? Math.round((statistics.vmiReadyItems / totalItems) * 100) : 0}% of items`}
                    color="bg-purple-100"
                  />
                </div>
              </div>

              {/* Status Overview */}
              <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="h-5 w-5 text-gray-500" />
                  <h3 className="font-semibold text-gray-900">Status Overview</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                      <span className="text-sm font-medium text-emerald-700">Active Items</span>
                    </div>
                    <span className="text-lg font-bold text-emerald-700">{statistics.activeItems}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-600" />
                      <span className="text-sm font-medium text-red-700">Inactive Items</span>
                    </div>
                    <span className="text-lg font-bold text-red-700">{statistics.inactiveItems}</span>
                  </div>
                </div>
              </div>

              {/* Low Stock Alert */}
              {statistics.lowStockItems > 0 && (
                <div className="bg-gradient-to-br from-red-50 to-orange-50 border border-red-200 rounded-xl p-5">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-red-900">Low Stock Alert</h3>
                      <p className="text-sm text-red-700 mt-1">
                        {statistics.lowStockItems} item(s) below minimum stock level
                      </p>
                      <button
                        onClick={() => {
                          // Could filter to show only low stock items
                        }}
                        className="mt-3 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                      >
                        View Low Stock Items
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Items DataGrid */}
          <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
            {/* Tabs Header */}
            <div className="px-5 pt-5 pb-3 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 overflow-x-auto">
                <button
                  onClick={() => setActiveTab('all')}
                  className={cn(
                    'px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap',
                    activeTab === 'all'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  )}
                >
                  All Items
                  <span className="ml-1.5 text-xs bg-gray-200 px-1.5 py-0.5 rounded-full">{totalItems}</span>
                </button>
                {(Object.keys(ITEM_TYPE_CONFIG) as ItemType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => setActiveTab(type)}
                    className={cn(
                      'px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap',
                      activeTab === type
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    )}
                  >
                    {ITEM_TYPE_CONFIG[type].labelTh}
                    <span className="ml-1.5 text-xs bg-gray-200 px-1.5 py-0.5 rounded-full">
                      {typeCounts[type]}
                    </span>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Boxes className="h-4 w-4" />
                <span>{filteredItems.length} items</span>
              </div>
            </div>

            {/* DataGrid */}
            <DataGrid
              dataSource={filteredItems}
              keyExpr="id"
              showBorders={false}
              showRowLines={true}
              showColumnLines={false}
              rowAlternationEnabled={true}
              allowColumnReordering={true}
              allowColumnResizing={true}
              columnAutoWidth={true}
              wordWrapEnabled={true}
              onExporting={onExporting}
              onRowClick={(e) => {
                if (e.data?.id) {
                  router.push(`/inventory/items/${e.data.id}`);
                }
              }}
              className="items-professional-grid"
            >
              <Scrolling mode="virtual" />
              <Selection mode="multiple" showCheckBoxesMode="onClick" />
              <SearchPanel visible={true} placeholder="Search items..." width={250} />
              <FilterRow visible={true} />
              <HeaderFilter visible={true} />
              <GroupPanel visible={true} />
              <Grouping autoExpandAll={false} />
              <ColumnChooser enabled={true} mode="select" />
              <Export enabled={true} allowExportSelectedData={true} />

              <Column
                dataField="code"
                caption="Code"
                width={150}
                cellRender={renderCodeCell}
              />
              <Column
                dataField="nameTh"
                caption="Name"
                minWidth={200}
                cellRender={renderNameCell}
              />
              <Column
                dataField="type"
                caption="Type"
                width={150}
                cellRender={renderTypeCell}
              />
              <Column
                dataField="category"
                caption="Category"
                width={120}
              />
              <Column
                dataField="onHand"
                caption="Stock"
                width={150}
                cellRender={renderStockCell}
              />
              <Column
                dataField="primaryUnit"
                caption="Unit"
                width={80}
              />
              <Column
                dataField="shelfLifeDays"
                caption="Shelf Life"
                width={100}
                cellRender={(data) => data.value ? `${data.value} days` : '-'}
              />
              <Column
                dataField="isActive"
                caption="Status"
                width={100}
                cellRender={renderStatusCell}
              />
              <Column
                caption="VMI"
                width={90}
                cellRender={renderVmiCell}
                allowFiltering={false}
              />
              <Column
                caption="Actions"
                width={110}
                cellRender={renderActionsCell}
                allowFiltering={false}
                allowSorting={false}
              />

              <Summary>
                <TotalItem column="code" summaryType="count" displayFormat="Total: {0}" />
              </Summary>

              <Paging defaultPageSize={20} />
              <Pager
                visible={true}
                showPageSizeSelector={true}
                allowedPageSizes={[10, 20, 50, 100]}
                showInfo={true}
                showNavigationButtons={true}
              />

              <Toolbar>
                <ToolbarItem name="groupPanel" />
                <ToolbarItem name="columnChooserButton" />
                <ToolbarItem name="exportButton" />
                <ToolbarItem name="searchPanel" />
              </Toolbar>
            </DataGrid>
          </div>
        </div>
      </div>

      {/* Item Edit Dialog */}
      <ItemEditDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingItem(null);
        }}
        item={editingItem}
        onSave={handleSave}
      />

      {/* Delete Confirmation Dialog */}
      <DxConfirmDialog
        visible={deleteConfirm.open}
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm({ open: false, item: null })}
        title="Confirm Delete"
        message={`Are you sure you want to delete "${deleteConfirm.item?.nameTh}"?`}
        confirmText="Delete"
        confirmType="danger"
      />

      {/* Custom styles */}
      <style jsx global>{`
        .items-professional-grid {
          font-family: inherit;
        }
        .items-professional-grid .dx-datagrid-headers {
          background: linear-gradient(to bottom, #f8fafc, #f1f5f9);
          border-bottom: 2px solid #e2e8f0;
        }
        .items-professional-grid .dx-datagrid-headers .dx-header-row td {
          font-weight: 600;
          color: #334155;
          padding: 12px 8px;
        }
        .items-professional-grid .dx-data-row td {
          padding: 10px 8px;
          vertical-align: middle;
        }
        .items-professional-grid .dx-data-row:hover {
          background-color: #fffbeb !important;
        }
        .items-professional-grid .dx-data-row {
          cursor: pointer;
        }
        .items-professional-grid .dx-row-alt > td {
          background-color: #fafafa;
        }
        .items-professional-grid .dx-datagrid-search-panel {
          margin-left: 0;
        }
        .items-professional-grid .dx-toolbar {
          padding: 8px 16px;
          background: transparent;
        }
        .items-professional-grid .dx-datagrid-group-panel {
          padding: 8px 16px;
        }
        .items-professional-grid .dx-pager {
          padding: 12px 16px;
          border-top: 1px solid #e2e8f0;
        }
      `}</style>
    </MainLayout>
  );
}
