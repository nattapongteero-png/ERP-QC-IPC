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
  ArrowUp,
  ArrowDown,
  CornerDownLeft,
  Keyboard,
  Calendar,
  Warehouse,
  X,
} from 'lucide-react';

export interface Lot {
  id: number;
  lotNumber: string;
  batchNumber?: string;
  itemId: number;
  itemCode: string;
  itemName: string;
  quantity: number;
  reservedQuantity?: number;
  unit: string;
  status: string;
  expiryDate?: string;
  manufacturingDate?: string;
  warehouseId?: number;
  warehouseName?: string;
}

interface LotSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (lot: Lot) => void;
  title?: string;
  filterStatus?: string;
  filterItemId?: number;
  excludeIds?: number[];
}

const statusColors: Record<string, { bg: string; text: string; label: string }> = {
  quarantine: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Quarantine' },
  released: { bg: 'bg-green-100', text: 'text-green-700', label: 'Released' },
  rejected: { bg: 'bg-red-100', text: 'text-red-700', label: 'Rejected' },
  expired: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Expired' },
};

export function LotSearchDialog({
  open,
  onOpenChange,
  onSelect,
  title = 'Search Lots',
  filterStatus,
  filterItemId,
  excludeIds = [],
}: LotSearchDialogProps) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Lot[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Use ref to avoid infinite loop from excludeIds array reference changes
  const excludeIdsRef = useRef(excludeIds);
  excludeIdsRef.current = excludeIds;

  const handleSelect = useCallback((lot: Lot) => {
    onSelect(lot);
    onOpenChange(false);
  }, [onSelect, onOpenChange]);

  const searchLots = useCallback(async (query: string) => {
    setIsSearching(true);
    setHasSearched(true);
    try {
      const params = new URLSearchParams({
        limit: '50',
      });
      if (query && query.trim()) {
        params.set('search', query.trim());
      }
      if (filterStatus) {
        params.set('status', filterStatus);
      }
      if (filterItemId) {
        params.set('itemId', filterItemId.toString());
      }

      const res = await fetch(`/api/inventory/lots?${params}`);
      const data = await res.json();

      if (data.success) {
        // Use same fallback pattern as lots page
        let lots = data.data?.items || data.data || [];
        // Use ref to get current excludeIds without adding to dependencies
        const currentExcludeIds = excludeIdsRef.current;
        if (currentExcludeIds.length > 0) {
          lots = lots.filter((lot: Lot) => !currentExcludeIds.includes(lot.id));
        }
        setResults(lots);
        setHighlightedIndex(0);
      } else {
        console.error('API returned error:', data.error);
        setResults([]);
      }
    } catch (error) {
      console.error('Failed to search lots:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [filterStatus, filterItemId]);

  // Initial load when dialog opens
  useEffect(() => {
    if (open) {
      searchLots('');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Debounced search when typing
  useEffect(() => {
    if (!open) return;

    const timer = setTimeout(() => {
      searchLots(search);
    }, 300);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, open]);

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
      if (!open) return;

      // ESC always closes the dialog, even when the result list is empty.
      if (e.key === 'Escape') {
        e.preventDefault();
        onOpenChange(false);
        return;
      }

      if (results.length === 0) return;

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
  }, [open, results, highlightedIndex, handleSelect, onOpenChange]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (listRef.current && results.length > 0) {
      const highlightedElement = listRef.current.querySelector(`[data-index="${highlightedIndex}"]`);
      highlightedElement?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [highlightedIndex, results.length]);

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('th-TH');
  };

  const formatNumber = (num: number | undefined) => {
    if (num === undefined || num === null) return '0';
    return new Intl.NumberFormat('th-TH').format(num);
  };

  const getStatusStyle = (status: string | undefined) => {
    if (!status) return { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Unknown' };
    return statusColors[status] || { bg: 'bg-gray-100', text: 'text-gray-600', label: status };
  };

  const getAvailableQty = (lot: Lot) => {
    const qty = Number(lot.quantity) || 0;
    const reserved = Number(lot.reservedQuantity) || 0;
    return qty - reserved;
  };

  const renderDialogContent = () => (
    <div className="flex flex-col h-full">
      {/* Header with explicit close (X) button.
          DevExtreme's built-in close button lives inside the title bar, and
          we render with showTitle={false}, so the native one is hidden. An
          explicit button here guarantees users always have a visible way
          to dismiss the dialog alongside ESC and outside-click. */}
      <div className="pb-4 border-b bg-gradient-to-r from-emerald-50 to-teal-50 -mx-4 -mt-4 px-4 pt-4 rounded-t-lg relative">
        <button
          type="button"
          aria-label="Close"
          onClick={() => onOpenChange(false)}
          className="absolute top-3 right-3 h-8 w-8 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-white/70 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400"
          data-testid="lot-search-close-btn"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2 text-xl font-semibold text-gray-900 pr-10">
          <Package className="h-5 w-5 text-emerald-600" />
          {title}
        </div>
        <p className="text-sm text-gray-500 mt-1">
          ค้นหาด้วยเลขล็อต เลขแบทช์ รหัสสินค้า หรือชื่อสินค้า
        </p>
      </div>

      {/* Search Input */}
      <div className="py-4 border-b -mx-4 px-4 bg-white">
        <DxTextBox
          placeholder="ค้นหาด้วยเลขล็อต / เลขแบทช์ รหัสสินค้า หรือชื่อสินค้า..."
          value={search}
          onValueChange={setSearch}
          mode="search"
          showClearButton
        />

        {filterStatus && (
          <div className="flex items-center gap-2 mt-3">
            <span className="text-xs text-gray-500">กรอง:</span>
            <Badge className={`${getStatusStyle(filterStatus).bg} ${getStatusStyle(filterStatus).text}`}>
              {getStatusStyle(filterStatus).label}
            </Badge>
          </div>
        )}
      </div>

      {/* Results Area */}
      <div ref={listRef} className="flex-1 overflow-y-auto -mx-4 px-4 py-4 min-h-[300px]">
        {isSearching ? (
          <div className="flex flex-col items-center justify-center py-12">
            <DxLoadIndicator />
            <p className="text-gray-500 mt-4">กำลังค้นหาล็อต...</p>
          </div>
        ) : results.length > 0 ? (
          <div className="space-y-2">
            {results.map((lot, index) => {
              const statusStyle = getStatusStyle(lot.status);
              const isHighlighted = index === highlightedIndex;
              const availableQty = getAvailableQty(lot);

              return (
                <div
                  key={lot.id}
                  data-index={index}
                  onClick={() => handleSelect(lot)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all duration-150 ${
                    isHighlighted
                      ? 'ring-2 ring-emerald-500 bg-emerald-50 border-emerald-200 shadow-md'
                      : 'bg-white hover:bg-gray-50 border-gray-200 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: Lot Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-bold text-emerald-600 text-lg">{lot.lotNumber}</span>
                        <Badge className={`${statusStyle.bg} ${statusStyle.text} text-xs`}>
                          {statusStyle.label}
                        </Badge>
                      </div>

                      <div className="mb-2">
                        <p className="font-medium text-gray-900">
                          {lot.itemCode} - {lot.itemName}
                        </p>
                        {lot.batchNumber && (
                          <p className="text-sm text-gray-500">แบทช์: {lot.batchNumber}</p>
                        )}
                      </div>

                      {/* Lot details row */}
                      <div className="flex items-center gap-4 text-sm text-gray-600 flex-wrap">
                        <div className="flex items-center gap-1">
                          <Package className="h-3.5 w-3.5" />
                          <span className="text-gray-900">{formatNumber(availableQty)} {lot.unit}</span>
                          {lot.reservedQuantity && Number(lot.reservedQuantity) > 0 && (
                            <span className="text-gray-400">
                              (จองแล้ว: {formatNumber(lot.reservedQuantity)})
                            </span>
                          )}
                        </div>

                        {lot.warehouseName && (
                          <div className="flex items-center gap-1">
                            <Warehouse className="h-3.5 w-3.5" />
                            <span>{lot.warehouseName}</span>
                          </div>
                        )}

                        {lot.expiryDate && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>หมดอายุ: {formatDate(lot.expiryDate)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Action */}
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <DxButton
                        text="เลือก"
                        type="default"
                        onClick={(e) => { e?.event?.stopPropagation(); handleSelect(lot); }}
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
            <p className="text-lg font-medium mb-2 text-gray-900">ไม่พบล็อต</p>
            {search ? (
              <p className="text-sm text-gray-400 mb-4">
                ไม่พบผลลัพธ์สำหรับ &quot;{search}&quot;
              </p>
            ) : (
              <p className="text-sm text-gray-400 mb-4">
                ไม่มีล็อตในระบบ
              </p>
            )}
            {search && (
              <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-4 max-w-md">
                <p className="font-medium mb-2 text-gray-700">คำแนะนำการค้นหา:</p>
                <ul className="list-disc list-inside space-y-1 text-gray-500">
                  <li>ลองค้นหาด้วยเลขล็อต (เช่น &quot;LOT001&quot;)</li>
                  <li>ค้นหาด้วยเลขแบทช์</li>
                  <li>ตรวจสอบการสะกดคำในคำค้นหาของคุณ</li>
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <Search className="h-16 w-16 text-gray-300 mb-4" />
            <p className="text-lg font-medium mb-2 text-gray-900">กำลังโหลดล็อต...</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="pt-3 border-t -mx-4 px-4 pb-2 bg-gray-50 flex items-center justify-between rounded-b-lg">
        {results.length > 0 ? (
          <>
            <div className="text-sm text-gray-500">
              พบ <span className="font-medium text-gray-700">{results.length}</span> ล็อต
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-400">
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600">
                  <ArrowUp className="h-3 w-3 inline" />
                </kbd>
                <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600">
                  <ArrowDown className="h-3 w-3 inline" />
                </kbd>
                <span className="ml-1">เลื่อน</span>
              </div>
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600">
                  <CornerDownLeft className="h-3 w-3 inline" />
                </kbd>
                <span className="ml-1">เลือก</span>
              </div>
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600">Esc</kbd>
                <span className="ml-1">ปิด</span>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 text-xs text-gray-400 w-full justify-center">
            <Keyboard className="h-4 w-4" />
            <span>ใช้แป้นพิมพ์ลัดเพื่อการนำทางที่รวดเร็วขึ้น</span>
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
      // `showCloseButton` has no effect here because we render without the
      // title bar — the explicit X button in the custom header handles it.
      showCloseButton={false}
      showTitle={false}
      // Allow clicking the backdrop to close; also matches the ESC handler
      // hint shown in the footer.
      closeOnOutsideClick
    >
      {renderDialogContent()}
    </DxPopup>
  );
}
