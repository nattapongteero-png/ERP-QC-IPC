'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxButton } from '@/components/ui/dx-button';
import { DxLoadIndicator } from '@/components/ui/dx-load-indicator';
import {
  DxDataGrid,
  DxColumn,
  DxScrolling,
  DxSelection,
  DxPaging,
} from '@/components/ui/dx-data-grid';
import type { DataGridTypes } from 'devextreme-react/data-grid';
import { DxTabs } from '@/components/ui/dx-tabs';
import {
  Package,
  Leaf,
  Box,
  Beaker,
  PackageCheck,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  BarChart3,
  Layers,
  Search,
  Clock,
} from 'lucide-react';

export interface Item {
  id: number;
  code: string;
  nameTh: string;
  nameEn: string;
  primaryUnit: string;
  sellingPrice?: number;
  costPrice?: number;
  category?: string;
  type?: string;
  itemType?: string;
  isActive?: boolean;
  onHand?: number;
  quarantineQty?: number;
  minStock?: number;
  reorderPoint?: number;
}

interface ItemSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (item: Item) => void;
  title?: string;
  showPrice?: 'selling' | 'cost' | 'both' | 'none';
  filterType?: string;
  excludeType?: string;
  excludeIds?: number[];
  showStock?: boolean;
}

// Item type configuration with icons and colors
const itemTypeConfig: Record<string, { icon: typeof Package; color: string; bgColor: string; label: string }> = {
  raw_material: { icon: Leaf, color: 'text-emerald-600', bgColor: 'bg-emerald-50', label: 'Raw Material' },
  packaging: { icon: Box, color: 'text-blue-600', bgColor: 'bg-blue-50', label: 'Packaging' },
  wip: { icon: Wrench, color: 'text-orange-600', bgColor: 'bg-orange-50', label: 'Work in Progress' },
  finished_goods: { icon: PackageCheck, color: 'text-purple-600', bgColor: 'bg-purple-50', label: 'Finished Goods' },
  consumable: { icon: Package, color: 'text-gray-600', bgColor: 'bg-gray-50', label: 'Consumable' },
  extract: { icon: Beaker, color: 'text-indigo-600', bgColor: 'bg-indigo-50', label: 'Extract' },
};

// Stock status helper
function getStockStatus(item: Item): { status: 'in_stock' | 'low_stock' | 'out_of_stock'; color: string; icon: typeof CheckCircle2 } {
  const onHand = Number(item.onHand) || 0;
  const minStock = Number(item.minStock) || 0;
  const reorderPoint = Number(item.reorderPoint) || minStock;

  if (onHand <= 0) {
    return { status: 'out_of_stock', color: 'text-red-600', icon: XCircle };
  }
  if (onHand <= reorderPoint) {
    return { status: 'low_stock', color: 'text-amber-600', icon: AlertTriangle };
  }
  return { status: 'in_stock', color: 'text-green-600', icon: CheckCircle2 };
}

export function ItemSearchDialog({
  open,
  onOpenChange,
  onSelect,
  title = 'Search Items',
  showPrice = 'selling',
  filterType,
  excludeType,
  excludeIds = [],
  showStock = true,
}: ItemSearchDialogProps) {
  const [search, setSearch] = useState('');
  const [allResults, setAllResults] = useState<Item[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedTypeTab, setSelectedTypeTab] = useState(0);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  // Use ref to avoid infinite loop from excludeIds array reference changes
  const excludeIdsRef = useRef(excludeIds);
  excludeIdsRef.current = excludeIds;

  // Type tabs configuration - dynamically built from results
  const typeTabs = useMemo(() => {
    const types = new Map<string, number>();
    allResults.forEach(item => {
      const type = item.type || 'unknown';
      types.set(type, (types.get(type) || 0) + 1);
    });

    const tabs = [{ text: `All (${allResults.length})`, value: '' }];

    // Add type tabs in specific order
    const orderedTypes = ['raw_material', 'packaging', 'wip', 'finished_goods', 'extract', 'consumable'];
    orderedTypes.forEach(type => {
      const count = types.get(type);
      if (count) {
        const config = itemTypeConfig[type] || { label: type };
        tabs.push({ text: `${config.label} (${count})`, value: type });
      }
    });

    // Add any remaining types
    types.forEach((count, type) => {
      if (!orderedTypes.includes(type) && type !== 'unknown') {
        tabs.push({ text: `${type} (${count})`, value: type });
      }
    });

    return tabs;
  }, [allResults]);

  // Filtered results based on selected tab
  const filteredResults = useMemo(() => {
    const selectedType = typeTabs[selectedTypeTab]?.value || '';
    if (!selectedType) return allResults;
    return allResults.filter(item => item.type === selectedType);
  }, [allResults, selectedTypeTab, typeTabs]);

  // Statistics
  const stats = useMemo(() => {
    const inStock = allResults.filter(item => (Number(item.onHand) || 0) > 0).length;
    const lowStock = allResults.filter(item => {
      const onHand = Number(item.onHand) || 0;
      const minStock = Number(item.minStock) || 0;
      return onHand > 0 && onHand <= minStock;
    }).length;
    const outOfStock = allResults.filter(item => (Number(item.onHand) || 0) <= 0).length;
    const totalValue = allResults.reduce((sum, item) => sum + (Number(item.onHand) || 0) * (Number(item.costPrice) || 0), 0);

    return { inStock, lowStock, outOfStock, totalValue, total: allResults.length };
  }, [allResults]);

  const handleSelect = useCallback((item: Item) => {
    onSelect(item);
    onOpenChange(false);
  }, [onSelect, onOpenChange]);

  const searchItems = useCallback(async (query: string) => {
    setIsSearching(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (query && query.trim()) {
        params.set('search', query.trim());
      }
      if (filterType) {
        params.set('type', filterType);
      }

      const res = await fetch(`/api/items?${params}`);
      const data = await res.json();

      if (data.success) {
        let items = data.data?.items || [];
        const currentExcludeIds = excludeIdsRef.current;
        if (currentExcludeIds.length > 0) {
          items = items.filter((item: Item) => !currentExcludeIds.includes(item.id));
        }
        if (excludeType) {
          items = items.filter((item: Item) => item.type !== excludeType);
        }
        setAllResults(items);
        setSelectedTypeTab(0);
      }
    } catch (error) {
      console.error('Failed to search items:', error);
      setAllResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [filterType, excludeType]);

  // Initial load when dialog opens
  useEffect(() => {
    if (open) {
      searchItems('');
    }
  }, [open, searchItems]);

  // Debounced search when typing
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      searchItems(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, open, searchItems]);

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setSearch('');
      setAllResults([]);
      setSelectedTypeTab(0);
      setSelectedItem(null);
    }
  }, [open]);

  const formatCurrency = (amount: number | undefined) => {
    if (amount === undefined || amount === null) return '-';
    return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(amount);
  };

  const formatNumber = (num: number | undefined) => {
    if (num === undefined || num === null) return '0';
    return new Intl.NumberFormat('th-TH').format(num);
  };

  // Grid row double-click handler
  const onRowDblClick = useCallback((e: DataGridTypes.RowDblClickEvent) => {
    if (e.data) {
      handleSelect(e.data as Item);
    }
  }, [handleSelect]);

  // Grid selection changed handler
  const onSelectionChanged = useCallback((e: DataGridTypes.SelectionChangedEvent) => {
    const selected = e.selectedRowsData?.[0];
    setSelectedItem((selected as Item) || null);
  }, []);

  // Cell render type
  interface CellRenderInfo {
    data: Item;
    value: unknown;
  }

  // Cell renderers
  const renderItemCode = (cellInfo: CellRenderInfo) => {
    const item = cellInfo.data;
    const typeConfig = itemTypeConfig[item.type || ''] || { icon: Package, color: 'text-gray-600', bgColor: 'bg-gray-50' };
    const TypeIcon = typeConfig.icon;

    return (
      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded-lg ${typeConfig.bgColor}`}>
          <TypeIcon className={`h-4 w-4 ${typeConfig.color}`} />
        </div>
        <span className="font-bold text-blue-600">{item.code}</span>
      </div>
    );
  };

  const renderItemName = (cellInfo: CellRenderInfo) => {
    const item = cellInfo.data;
    return (
      <div>
        <p className="font-medium text-gray-900">{item.nameTh}</p>
        {item.nameEn && <p className="text-xs text-gray-500">{item.nameEn}</p>}
      </div>
    );
  };

  const renderItemType = (cellInfo: CellRenderInfo) => {
    const item = cellInfo.data;
    const typeConfig = itemTypeConfig[item.type || ''] || { label: item.type || '-', color: 'text-gray-600', bgColor: 'bg-gray-100' };

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${typeConfig.bgColor} ${typeConfig.color}`}>
        {typeConfig.label}
      </span>
    );
  };

  const renderStock = (cellInfo: CellRenderInfo) => {
    const item = cellInfo.data;
    const stockStatus = getStockStatus(item);
    const StatusIcon = stockStatus.icon;
    const onHand = Number(item.onHand) || 0;

    return (
      <div className={`flex items-center gap-1.5 ${stockStatus.color}`}>
        <StatusIcon className="h-4 w-4" />
        <span className="font-medium">{formatNumber(onHand)}</span>
        <span className="text-gray-500 text-xs">{item.primaryUnit}</span>
      </div>
    );
  };

  const renderQuarantineStock = (cellInfo: CellRenderInfo) => {
    const item = cellInfo.data;
    const quarantineQty = Number(item.quarantineQty) || 0;

    if (quarantineQty === 0) {
      return <span className="text-gray-400">-</span>;
    }

    return (
      <div className="flex items-center gap-1.5 text-amber-600">
        <Clock className="h-4 w-4" />
        <span className="font-medium">{formatNumber(quarantineQty)}</span>
        <span className="text-gray-500 text-xs">{item.primaryUnit}</span>
      </div>
    );
  };

  const renderPrice = (cellInfo: CellRenderInfo) => {
    const item = cellInfo.data;

    if (showPrice === 'none') return null;

    if (showPrice === 'both') {
      return (
        <div className="text-right">
          <p className="font-medium text-green-600">{formatCurrency(item.sellingPrice)}</p>
          <p className="text-xs text-gray-500">Cost: {formatCurrency(item.costPrice)}</p>
        </div>
      );
    }

    const price = showPrice === 'cost' ? item.costPrice : item.sellingPrice;
    return (
      <span className={`font-medium ${showPrice === 'cost' ? 'text-gray-700' : 'text-green-600'}`}>
        {formatCurrency(price)}
      </span>
    );
  };

  const renderActions = (cellInfo: CellRenderInfo) => {
    const item = cellInfo.data;
    return (
      <DxButton
        text="Select"
        type="default"
        stylingMode="contained"
        onClick={() => handleSelect(item)}
        elementAttr={{ 'data-testid': `item-select-btn-${item.id}` }}
      />
    );
  };

  const renderDialogContent = () => (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header with Title and Stats */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Package className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{title}</h2>
              <p className="text-blue-100 text-sm">Double-click or select and confirm to choose an item</p>
            </div>
          </div>

          {/* Quick Stats */}
          {stats.total > 0 && (
            <div className="flex items-center gap-4">
              <div className="text-center px-3 py-1 bg-white/10 rounded-lg">
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-blue-100">Total Items</p>
              </div>
              <div className="text-center px-3 py-1 bg-white/10 rounded-lg">
                <p className="text-2xl font-bold text-green-300">{stats.inStock}</p>
                <p className="text-xs text-blue-100">In Stock</p>
              </div>
              {stats.lowStock > 0 && (
                <div className="text-center px-3 py-1 bg-white/10 rounded-lg">
                  <p className="text-2xl font-bold text-amber-300">{stats.lowStock}</p>
                  <p className="text-xs text-blue-100">Low Stock</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white border-b px-6 py-4 space-y-3" data-testid="item-search-container">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <DxTextBox
              placeholder="Search by item code, Thai name, or English name..."
              value={search}
              onValueChange={setSearch}
              mode="search"
              showClearButton
              height={42}
              elementAttr={{ 'data-testid': 'item-search-input' }}
            />
          </div>
          {selectedItem && (
            <DxButton
              text="Confirm Selection"
              type="success"
              icon="check"
              onClick={() => handleSelect(selectedItem)}
              elementAttr={{ 'data-testid': 'item-confirm-btn' }}
            />
          )}
        </div>

        {/* Type Filter Tabs */}
        {typeTabs.length > 1 && !filterType && (
          <DxTabs
            items={typeTabs.map(tab => ({ text: tab.text }))}
            selectedIndex={selectedTypeTab}
            onItemClick={(e) => setSelectedTypeTab(e.itemIndex || 0)}
          />
        )}

        {/* Filter indicator */}
        {filterType && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Filtering by:</span>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${itemTypeConfig[filterType]?.bgColor || 'bg-gray-100'} ${itemTypeConfig[filterType]?.color || 'text-gray-700'}`}>
              {itemTypeConfig[filterType]?.label || filterType}
            </span>
          </div>
        )}
      </div>

      {/* Data Grid */}
      <div className="flex-1 px-6 py-4 overflow-hidden">
        {isSearching ? (
          <div className="flex flex-col items-center justify-center h-full">
            <DxLoadIndicator />
            <p className="text-gray-500 mt-4">Searching items...</p>
          </div>
        ) : filteredResults.length > 0 ? (
          <DxDataGrid
            dataSource={filteredResults}
            keyExpr="id"
            showBorders
            showRowLines
            rowAlternationEnabled
            onRowDblClick={onRowDblClick}
            onSelectionChanged={onSelectionChanged}
            height="100%"
            columnAutoWidth
            wordWrapEnabled
          >
            <DxSelection mode="single" />
            <DxScrolling mode="virtual" />
            <DxPaging enabled={false} />

            <DxColumn
              dataField="code"
              caption="Item Code"
              width={180}
              cellRender={renderItemCode}
              allowSorting
            />
            <DxColumn
              dataField="nameTh"
              caption="Item Name"
              minWidth={200}
              cellRender={renderItemName}
              allowSorting
            />
            <DxColumn
              dataField="type"
              caption="Type"
              width={140}
              cellRender={renderItemType}
              allowSorting
            />
            {showStock && (
              <DxColumn
                dataField="onHand"
                caption="Stock"
                width={140}
                cellRender={renderStock}
                allowSorting
                alignment="right"
              />
            )}
            {showStock && (
              <DxColumn
                dataField="quarantineQty"
                caption="Quarantine"
                width={140}
                cellRender={renderQuarantineStock}
                allowSorting
                alignment="right"
              />
            )}
            {showPrice !== 'none' && (
              <DxColumn
                dataField={showPrice === 'cost' ? 'costPrice' : 'sellingPrice'}
                caption="Price"
                width={130}
                cellRender={renderPrice}
                allowSorting
                alignment="right"
              />
            )}
            <DxColumn
              caption="Action"
              width={100}
              cellRender={renderActions}
              allowSorting={false}
              alignment="center"
            />
          </DxDataGrid>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <div className="p-6 bg-gray-100 rounded-full mb-4">
              <Search className="h-12 w-12 text-gray-400" />
            </div>
            <p className="text-xl font-medium text-gray-700 mb-2">No items found</p>
            {search ? (
              <p className="text-gray-500 mb-4">No results for &quot;{search}&quot;</p>
            ) : (
              <p className="text-gray-500 mb-4">No items available in the system</p>
            )}
            {search && (
              <div className="bg-white rounded-xl p-4 border max-w-md text-left">
                <p className="font-medium text-gray-700 mb-2">Search tips:</p>
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-500">
                  <li>Try searching by item code (e.g., &quot;RM001&quot;)</li>
                  <li>Search by partial name in Thai or English</li>
                  <li>Check for typos in your search</li>
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer with Summary */}
      <div className="bg-white border-t px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6 text-sm">
            {filteredResults.length > 0 && (
              <>
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600">
                    <span className="font-semibold text-gray-800">{filteredResults.length}</span> items shown
                  </span>
                </div>
                {excludeIds.length > 0 && (
                  <div className="flex items-center gap-2 text-gray-500">
                    <Layers className="h-4 w-4" />
                    <span>{excludeIds.length} already selected</span>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {selectedItem && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg border border-blue-200 mr-2">
                <CheckCircle2 className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-700">
                  Selected: {selectedItem.code}
                </span>
              </div>
            )}
            <DxButton
              text="Cancel"
              type="normal"
              stylingMode="outlined"
              onClick={() => onOpenChange(false)}
            />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <DxPopup
      visible={open}
      onHiding={() => onOpenChange(false)}
      title=""
      width="95%"
      maxWidth={1200}
      height="90%"
      maxHeight={900}
      showCloseButton
      showTitle={false}
    >
      {renderDialogContent()}
    </DxPopup>
  );
}
