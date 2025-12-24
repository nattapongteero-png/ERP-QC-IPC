'use client';

/**
 * Inventory Items Page
 *
 * Clean, professional data-focused page for managing inventory items.
 * Redesigned with DevExtreme UI components.
 */

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { PageHeader } from '@/components/ui/page-header';
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
  AlertTriangle,
  CheckCircle,
  XCircle,
  Warehouse,
  Clock,
} from 'lucide-react';
import { ItemEditDialog, Item, ItemFormData } from '@/components/ui/item-edit-dialog';
import { DxConfirmDialog } from '@/components/ui/dx-popup';
import { cn } from '@/lib/utils/cn';

// ============================================
// Helper Functions
// ============================================

/**
 * Format number to compact human-readable format
 * e.g., 1500 -> "1.5K", 1500000 -> "1.5M", 1500000000 -> "1.5B"
 */
function formatCompactNumber(value: number): string {
  if (value === 0) return '0';

  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (absValue >= 1_000_000_000) {
    const formatted = (absValue / 1_000_000_000).toFixed(1);
    return sign + (formatted.endsWith('.0') ? formatted.slice(0, -2) : formatted) + 'B';
  }
  if (absValue >= 1_000_000) {
    const formatted = (absValue / 1_000_000).toFixed(1);
    return sign + (formatted.endsWith('.0') ? formatted.slice(0, -2) : formatted) + 'M';
  }
  if (absValue >= 1_000) {
    const formatted = (absValue / 1_000).toFixed(1);
    return sign + (formatted.endsWith('.0') ? formatted.slice(0, -2) : formatted) + 'K';
  }

  return sign + absValue.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

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
  icon: React.ReactNode;
}> = {
  raw_material: {
    label: 'Raw Material',
    labelTh: 'วัตถุดิบ',
    bgColor: 'bg-green-50',
    textColor: 'text-green-700',
    borderColor: 'border-green-200',
    icon: <Leaf className="h-4 w-4" />,
  },
  packaging: {
    label: 'Packaging',
    labelTh: 'บรรจุภัณฑ์',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200',
    icon: <Box className="h-4 w-4" />,
  },
  wip: {
    label: 'Work in Progress',
    labelTh: 'งานระหว่างทำ',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-700',
    borderColor: 'border-orange-200',
    icon: <FlaskConical className="h-4 w-4" />,
  },
  finished_goods: {
    label: 'Finished Goods',
    labelTh: 'สินค้าสำเร็จรูป',
    bgColor: 'bg-purple-50',
    textColor: 'text-purple-700',
    borderColor: 'border-purple-200',
    icon: <Pill className="h-4 w-4" />,
  },
  consumable: {
    label: 'Consumable',
    labelTh: 'วัสดุสิ้นเปลือง',
    bgColor: 'bg-gray-50',
    textColor: 'text-gray-700',
    borderColor: 'border-gray-200',
    icon: <Package className="h-4 w-4" />,
  },
};

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
    const totalQuarantine = items.reduce((sum, item) => sum + (Number(item.quarantineQty) || 0), 0);
    const itemsInQuarantine = items.filter((item) => (item.quarantineQty ?? 0) > 0).length;
    const lowStockItems = items.filter(
      (item) => item.minStock && item.onHand !== undefined && item.onHand < item.minStock
    ).length;
    const activeItems = items.filter((item) => item.isActive).length;
    const inactiveItems = items.filter((item) => !item.isActive).length;
    const vmiReadyItems = items.filter((item) => item.tppCode || item.ttmtCode).length;

    return {
      totalValue,
      totalQuantity,
      totalQuarantine,
      itemsInQuarantine,
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
    const onHandCost = data.data.onHandCost ?? 0;
    const minStock = data.data.minStock ?? 0;
    const isLow = minStock > 0 && onHand < minStock;

    return (
      <div>
        <div className={cn('font-medium', isLow ? 'text-red-600' : 'text-gray-900')}>
          {formatCompactNumber(onHand)} {data.data.primaryUnit}
          {isLow && (
            <span className="ml-1 text-xs px-1 py-0.5 bg-red-100 text-red-700 rounded">Low</span>
          )}
        </div>
        {onHandCost > 0 && (
          <div className="text-xs text-gray-500" title={`฿${onHandCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}>
            ฿{formatCompactNumber(onHandCost)}
          </div>
        )}
      </div>
    );
  }, []);

  const renderQuarantineCell = useCallback((data: { data: Item }) => {
    const quarantineQty = data.data.quarantineQty ?? 0;

    if (quarantineQty === 0) {
      return (
        <div className="text-gray-400 text-center">-</div>
      );
    }

    return (
      <div className="flex items-center gap-1.5" title={`${quarantineQty.toLocaleString()} ${data.data.primaryUnit}`}>
        <Clock className="h-4 w-4 text-amber-500" />
        <span className="font-medium text-amber-700">
          {formatCompactNumber(quarantineQty)}
        </span>
        <span className="text-xs text-gray-500">{data.data.primaryUnit}</span>
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
      <div className="space-y-4">
        {/* Page Header */}
        <PageHeader
          title="Inventory Items"
          description="รายการสินค้าและวัตถุดิบ"
          actions={
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
                onClick={() => router.push('/inventory/items/new')}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                <Plus className="h-4 w-4" />
                Add Item
              </button>
            </div>
          }
        />

        {/* Items DataGrid Card */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          {/* Tabs + Stats Header */}
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              {/* Type Tabs */}
              <div className="flex items-center gap-1 bg-white rounded-lg p-1 border border-gray-200 overflow-x-auto">
                <button
                  onClick={() => setActiveTab('all')}
                  className={cn(
                    'px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap',
                    activeTab === 'all'
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  )}
                >
                  All
                  <span className={cn(
                    'ml-1.5 text-xs px-1.5 py-0.5 rounded-full',
                    activeTab === 'all' ? 'bg-gray-700' : 'bg-gray-200'
                  )}>{totalItems}</span>
                </button>
                {(Object.keys(ITEM_TYPE_CONFIG) as ItemType[]).map((type) => {
                  const config = ITEM_TYPE_CONFIG[type];
                  return (
                    <button
                      key={type}
                      onClick={() => setActiveTab(type)}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap',
                        activeTab === type
                          ? `${config.bgColor} ${config.textColor}`
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                      )}
                    >
                      {config.icon}
                      {config.label}
                      <span className={cn(
                        'text-xs px-1.5 py-0.5 rounded-full',
                        activeTab === type ? 'bg-white/50' : 'bg-gray-200'
                      )}>
                        {typeCounts[type]}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Compact Stats */}
              <div className="flex items-center gap-4 text-sm">
                {statistics.lowStockItems > 0 && (
                  <div className="flex items-center gap-1.5 text-red-600">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium">{statistics.lowStockItems} Low Stock</span>
                  </div>
                )}
                {statistics.itemsInQuarantine > 0 && (
                  <div className="flex items-center gap-1.5 text-amber-600">
                    <Clock className="h-4 w-4" />
                    <span className="font-medium">{statistics.itemsInQuarantine} In Quarantine</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-gray-500">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>{statistics.activeItems} Active</span>
                </div>
                <div className="text-gray-400">|</div>
                <span className="text-gray-500">{filteredItems.length} items shown</span>
              </div>
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
              caption="On Hand"
              width={150}
              cellRender={renderStockCell}
            />
            <Column
              dataField="quarantineQty"
              caption="Quarantine"
              width={120}
              cellRender={renderQuarantineCell}
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
