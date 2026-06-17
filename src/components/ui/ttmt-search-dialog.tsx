'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxLoadIndicator } from '@/components/ui/dx-load-indicator';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  Keyboard,
  ArrowUp,
  ArrowDown,
  CornerDownLeft,
  Leaf,
  Building2,
  Beaker,
} from 'lucide-react';

export interface TtmtItem {
  ttmtCode: string;
  activeIngredient: string;
  strength: string;
  dosageForm: string;
  dispensingUnit: string;
  tradeName: string;
  manufacturer: string;
  fsn: string;
  tmtType: string;
}

interface TtmtSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (item: TtmtItem) => void;
  title?: string;
}

export function TtmtSearchDialog({
  open,
  onOpenChange,
  onSelect,
  title = 'Search TTMT Code',
}: TtmtSearchDialogProps) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<TtmtItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleSelect = useCallback((item: TtmtItem) => {
    onSelect(item);
    onOpenChange(false);
  }, [onSelect, onOpenChange]);

  const searchTtmt = useCallback(async (query: string) => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsSearching(true);
    setHasSearched(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (query && query.trim()) {
        params.set('search', query.trim());
      }

      const res = await fetch(`/api/vmi/lookup/ttmt?${params}`, {
        signal: abortControllerRef.current.signal,
      });
      const data = await res.json();

      if (data.success) {
        setResults(data.data?.items || []);
        setTotalCount(data.data?.pagination?.total || 0);
        setHighlightedIndex(0);
      } else {
        setResults([]);
        setTotalCount(0);
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Failed to search TTMT:', error);
        setResults([]);
        setTotalCount(0);
      }
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSearch('');
      setResults([]);
      setHasSearched(false);
      setTotalCount(0);
    }
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [open]);

  // Debounced search when typing (minimum 3 characters, 500ms delay)
  useEffect(() => {
    if (!open) return;

    // Only search if text has more than 3 characters
    if (search.trim().length < 3) {
      // Clear results if search is too short
      if (search.trim().length > 0) {
        setResults([]);
        setTotalCount(0);
        setHasSearched(false);
      }
      return;
    }

    const timer = setTimeout(() => {
      searchTtmt(search);
    }, 500);
    return () => clearTimeout(timer);
  }, [search, open, searchTtmt]);

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
        case 'Escape':
          e.preventDefault();
          onOpenChange(false);
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

  return (
    <DxPopup
      visible={open}
      onHiding={() => onOpenChange(false)}
      title=""
      width={900}
      height={650}
      showCloseButton
      showTitle={false}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex-none p-4 border-b border-gray-200 bg-gradient-to-r from-green-50 to-emerald-50">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Leaf className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
              <p className="text-sm text-gray-500">รหัสศัพท์บัญญัติยาแผนไทย (TTMT) จาก VMI Portal</p>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
            <DxTextBox
              value={search}
              onValueChange={setSearch}
              placeholder="พิมพ์อย่างน้อย 3 ตัวอักษรเพื่อค้นหา..."
              className="pl-10"
              mode="search"
              showClearButton
            />
          </div>
        </div>

        {/* Results */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-2">
          {isSearching ? (
            <div className="flex items-center justify-center h-32">
              <DxLoadIndicator />
              <span className="ml-2 text-gray-500">กำลังค้นหาใน VMI Portal...</span>
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500">
              {hasSearched ? (
                <>
                  <Search className="h-8 w-8 mb-2 text-gray-300" />
                  <p>ไม่พบรหัส TTMT</p>
                  <p className="text-sm">ลองใช้คำค้นหาอื่น</p>
                </>
              ) : (
                <>
                  <Leaf className="h-8 w-8 mb-2 text-gray-300" />
                  <p>พิมพ์อย่างน้อย 3 ตัวอักษรเพื่อค้นหารหัส TTMT</p>
                  <p className="text-sm text-gray-400">ค้นหาด้วยรหัส TTMT ตัวยา หรือชื่อทางการค้า</p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {results.map((item, index) => (
                <div
                  key={item.ttmtCode}
                  data-index={index}
                  onClick={() => handleSelect(item)}
                  className={`p-3 rounded-lg cursor-pointer transition-all ${
                    index === highlightedIndex
                      ? 'bg-green-50 ring-2 ring-green-500'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="success" className="font-mono text-xs">
                          {item.ttmtCode}
                        </Badge>
                        {item.dosageForm && (
                          <Badge variant="secondary" className="text-xs">
                            {item.dosageForm}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {item.fsn}
                      </p>
                      <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                        {item.activeIngredient && (
                          <div className="flex items-center gap-1">
                            <Beaker className="h-3 w-3" />
                            <span>{item.activeIngredient} {item.strength}</span>
                          </div>
                        )}
                        {item.manufacturer && (
                          <div className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            <span>{item.manufacturer}</span>
                          </div>
                        )}
                      </div>
                      {item.tradeName && (
                        <p className="text-xs text-gray-400 mt-1">
                          ชื่อการค้า: {item.tradeName}
                        </p>
                      )}
                    </div>
                    {item.dispensingUnit && (
                      <div className="text-xs text-gray-400">
                        {item.dispensingUnit}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-none p-3 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <Keyboard className="h-3 w-3" />
                <span>คีย์บอร์ด:</span>
              </div>
              <div className="flex items-center gap-1">
                <ArrowUp className="h-3 w-3" />
                <ArrowDown className="h-3 w-3" />
                <span>เลื่อน</span>
              </div>
              <div className="flex items-center gap-1">
                <CornerDownLeft className="h-3 w-3" />
                <span>เลือก</span>
              </div>
              <span>ESC ปิด</span>
            </div>
            <div>
              {hasSearched && (
                <span>
                  {results.length} จาก {totalCount} ผลลัพธ์
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </DxPopup>
  );
}
