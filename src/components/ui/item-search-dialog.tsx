'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxButton } from '@/components/ui/dx-button';
import { DxLoadIndicator } from '@/components/ui/dx-load-indicator';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  Package,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Keyboard,
  ArrowUp,
  ArrowDown,
  CornerDownLeft,
  Box,
  Tag,
  TrendingUp
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
  type?: string; // Database field name
  itemType?: string; // Alias for backward compatibility
  isActive?: boolean;
  onHand?: number;
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
  excludeIds?: number[];
  showStock?: boolean;
}

// Item type color mapping
const itemTypeColors: Record<string, { bg: string; text: string; label: string }> = {
  raw_material: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Raw Material' },
  extract: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Extract' },
  solvent: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Solvent' },
  excipient: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Excipient' },
  packaging: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Packaging' },
  finished_product: { bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'Finished Product' },
  finished_goods: { bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'Finished Goods' },
};

// Stock status helper
function getStockStatus(item: Item): { status: 'in_stock' | 'low_stock' | 'out_of_stock'; color: string } {
  const onHand = Number(item.onHand) || 0;
  const minStock = Number(item.minStock) || 0;
  const reorderPoint = Number(item.reorderPoint) || minStock;

  if (onHand <= 0) {
    return { status: 'out_of_stock', color: 'text-red-600' };
  }
  if (onHand <= reorderPoint) {
    return { status: 'low_stock', color: 'text-amber-600' };
  }
  return { status: 'in_stock', color: 'text-green-600' };
}

export function ItemSearchDialog({
  open,
  onOpenChange,
  onSelect,
  title = 'Search Items',
  showPrice = 'selling',
  filterType,
  excludeIds = [],
  showStock = true,
}: ItemSearchDialogProps) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Item[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const handleSelect = useCallback((item: Item) => {
    onSelect(item);
    onOpenChange(false);
  }, [onSelect, onOpenChange]);

  const searchItems = useCallback(async (query: string) => {
    setIsSearching(true);
    setHasSearched(true);
    try {
      const params = new URLSearchParams({
        limit: '20',
      });
      // Only add search param if there's a query
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
        if (excludeIds.length > 0) {
          items = items.filter((item: Item) => !excludeIds.includes(item.id));
        }
        setResults(items);
        setHighlightedIndex(0);
      }
    } catch (error) {
      console.error('Failed to search items:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [filterType, excludeIds]);

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
  }, [search, searchItems, open]);

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setSearch('');
      setResults([]);
      setHighlightedIndex(0);
      setHasSearched(false);
    }
  }, [open]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open || results.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) => (prev + 1) % results.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) => (prev - 1 + results.length) % results.length);
          break;
        case 'Enter':
          e.preventDefault();
          if (results[highlightedIndex]) {
            handleSelect(results[highlightedIndex]);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, results, highlightedIndex, handleSelect]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (listRef.current && results.length > 0) {
      const highlightedElement = listRef.current.querySelector(`[data-index="${highlightedIndex}"]`);
      highlightedElement?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [highlightedIndex, results.length]);

  const formatCurrency = (amount: number | undefined) => {
    if (amount === undefined || amount === null) return '-';
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
    }).format(amount);
  };

  const formatNumber = (num: number | undefined) => {
    if (num === undefined || num === null) return '0';
    return new Intl.NumberFormat('th-TH').format(num);
  };

  const getItemType = (item: Item) => {
    return item.type || item.itemType || '';
  };

  const getItemTypeStyle = (type: string | undefined) => {
    if (!type) return { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Unknown' };
    return itemTypeColors[type] || { bg: 'bg-gray-100', text: 'text-gray-600', label: type.replace(/_/g, ' ') };
  };

  const StockIndicator = ({ item }: { item: Item }) => {
    const stockStatus = getStockStatus(item);
    const onHand = Number(item.onHand) || 0;

    return (
      <div className={`flex items-center gap-1.5 text-sm ${stockStatus.color}`}>
        {stockStatus.status === 'in_stock' && <CheckCircle2 className="h-4 w-4" />}
        {stockStatus.status === 'low_stock' && <AlertTriangle className="h-4 w-4" />}
        {stockStatus.status === 'out_of_stock' && <XCircle className="h-4 w-4" />}
        <span className="font-medium">{formatNumber(onHand)} {item.primaryUnit}</span>
      </div>
    );
  };

  const renderDialogContent = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="pb-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50 -mx-4 -mt-4 px-4 pt-4 rounded-t-lg">
        <div className="flex items-center gap-2 text-xl font-semibold">
          <Package className="h-5 w-5 text-blue-600" />
          {title}
        </div>
        <p className="text-sm text-gray-500 mt-1">
          Search by item code, Thai name, or English name
        </p>
      </div>

      {/* Search Input */}
      <div className="py-4 border-b -mx-4 px-4 bg-white">
        <DxTextBox
          placeholder="Search items by code or name..."
          value={search}
          onValueChange={setSearch}
          mode="search"
          showClearButton
        />

        {filterType && (
          <div className="flex items-center gap-2 mt-3">
            <span className="text-xs text-gray-500">Filtering:</span>
            <Badge variant="default" className={`${getItemTypeStyle(filterType).bg} ${getItemTypeStyle(filterType).text}`}>
              {getItemTypeStyle(filterType).label}
            </Badge>
          </div>
        )}
      </div>

      {/* Results Area */}
      <div ref={listRef} className="flex-1 overflow-y-auto -mx-4 px-4 py-4 min-h-[300px]">
        {isSearching ? (
          <div className="flex flex-col items-center justify-center py-12">
            <DxLoadIndicator />
            <p className="text-gray-500 mt-4">Searching items...</p>
          </div>
        ) : results.length > 0 ? (
          <div className="space-y-2">
            {results.map((item, index) => {
              const itemType = getItemType(item);
              const typeStyle = getItemTypeStyle(itemType);
              const isHighlighted = index === highlightedIndex;

              return (
                <div
                  key={item.id}
                  data-index={index}
                  onClick={() => handleSelect(item)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all duration-150 ${
                    isHighlighted
                      ? 'ring-2 ring-blue-500 bg-blue-50 border-blue-200 shadow-md'
                      : 'bg-white hover:bg-gray-50 border-gray-200 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: Item Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-bold text-blue-600 text-lg">{item.code}</span>
                        {itemType && (
                          <Badge className={`${typeStyle.bg} ${typeStyle.text} text-xs`}>
                            {typeStyle.label}
                          </Badge>
                        )}
                        {item.category && (
                          <Badge variant="outline" className="text-xs text-gray-500">
                            <Tag className="h-3 w-3 mr-1" />
                            {item.category}
                          </Badge>
                        )}
                      </div>

                      <div className="mb-2">
                        <p className="font-medium text-gray-900">
                          {item.nameTh || '-'}
                        </p>
                        {item.nameEn && (
                          <p className="text-sm text-gray-500">{item.nameEn}</p>
                        )}
                      </div>

                      {/* Item details row */}
                      <div className="flex items-center gap-4 text-sm text-gray-600 flex-wrap">
                        <div className="flex items-center gap-1">
                          <Box className="h-3.5 w-3.5" />
                          <span>{item.primaryUnit || 'unit'}</span>
                        </div>

                        {showStock && (
                          <StockIndicator item={item} />
                        )}
                      </div>
                    </div>

                    {/* Right: Price & Action */}
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      {showPrice !== 'none' && (
                        <div className="text-right">
                          {showPrice === 'both' ? (
                            <>
                              <div className="flex items-center gap-1 text-green-600">
                                <TrendingUp className="h-3.5 w-3.5" />
                                <span className="font-semibold">{formatCurrency(item.sellingPrice)}</span>
                              </div>
                              <p className="text-xs text-gray-500">
                                Cost: {formatCurrency(item.costPrice)}
                              </p>
                            </>
                          ) : showPrice === 'cost' ? (
                            <div className="font-semibold text-gray-700">
                              {formatCurrency(item.costPrice)}
                            </div>
                          ) : (
                            <div className="font-semibold text-green-600">
                              {formatCurrency(item.sellingPrice)}
                            </div>
                          )}
                        </div>
                      )}

                      <DxButton
                        text="Select"
                        type="default"
                        onClick={(e) => { e?.stopPropagation(); handleSelect(item); }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : hasSearched ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <Package className="h-16 w-16 text-gray-300 mb-4" />
            <p className="text-lg font-medium mb-2">No items found</p>
            {search ? (
              <p className="text-sm text-gray-400 mb-4">
                No results for &quot;{search}&quot;
              </p>
            ) : (
              <p className="text-sm text-gray-400 mb-4">
                No items available in the system
              </p>
            )}
            {search && (
              <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-4 max-w-md">
                <p className="font-medium mb-2">Search tips:</p>
                <ul className="list-disc list-inside space-y-1 text-gray-400">
                  <li>Try searching by item code (e.g., &quot;RM001&quot;)</li>
                  <li>Search by partial name in Thai or English</li>
                  <li>Check for typos in your search</li>
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <Search className="h-16 w-16 text-gray-300 mb-4" />
            <p className="text-lg font-medium mb-2">Loading items...</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="pt-3 border-t -mx-4 px-4 pb-2 bg-gray-50 flex items-center justify-between rounded-b-lg">
        {results.length > 0 ? (
          <>
            <div className="text-sm text-gray-500">
              <span className="font-medium text-gray-700">{results.length}</span> item{results.length !== 1 ? 's' : ''} found
              {excludeIds.length > 0 && (
                <span className="text-gray-400"> • {excludeIds.length} already selected</span>
              )}
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-400">
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600">
                  <ArrowUp className="h-3 w-3 inline" />
                </kbd>
                <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600">
                  <ArrowDown className="h-3 w-3 inline" />
                </kbd>
                <span className="ml-1">Navigate</span>
              </div>
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600">
                  <CornerDownLeft className="h-3 w-3 inline" />
                </kbd>
                <span className="ml-1">Select</span>
              </div>
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600">Esc</kbd>
                <span className="ml-1">Close</span>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 text-xs text-gray-400 w-full justify-center">
            <Keyboard className="h-4 w-4" />
            <span>Use keyboard shortcuts for faster navigation</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <DxPopup
      visible={open}
      onHiding={() => onOpenChange(false)}
      title=""
      width={900}
      height={700}
      showCloseButton
      showTitle={false}
    >
      {renderDialogContent()}
    </DxPopup>
  );
}
