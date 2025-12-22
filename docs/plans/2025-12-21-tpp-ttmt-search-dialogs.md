# TPP/TTMT Code Search Dialogs Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create reusable TPP and TTMT code search dialogs that fetch from VMI Portal API and add search buttons to the item edit form, storing both code and name in the items table.

**Architecture:**
- Create two reusable search dialog components (`TppSearchDialog` and `TtmtSearchDialog`) following the existing `ItemSearchDialog` pattern
- Add internal API proxy routes to call VMI Portal external API (avoid CORS issues)
- Modify items table schema to add `tppName` and `ttmtName` columns
- Update ItemEditForm to include search buttons next to TPP/TTMT code fields

**Tech Stack:** Next.js 15, React 19, DevExtreme React, Drizzle ORM, TypeScript

---

## Task 1: Add tppName and ttmtName Columns to Items Schema

**Files:**
- Modify: `src/lib/db/schema.ts:83-85` (SQLite items table)
- Modify: `src/lib/db/schema.ts:931-956` (MySQL items table)

**Step 1: Add columns to SQLite items table**

In `src/lib/db/schema.ts`, find the sqliteItems table definition (around line 63-88) and add the name fields after the code fields:

```typescript
// VMI Standard Codes - items need EITHER tppCode OR ttmtCode for VMI sync
tppCode: text('tpp_code'), // Thai Pharmaceutical Product code (13 digits)
tppName: text('tpp_name'), // TPP product name from VMI Portal
ttmtCode: text('ttmt_code'), // Thai Traditional Medicine Terminology (A + 8 digits)
ttmtName: text('ttmt_name'), // TTMT product name (FSN) from VMI Portal
```

**Step 2: Add columns to MySQL items table**

Find the mysqlItems table definition (around line 931-956) and add the same fields:

```typescript
// VMI Standard Codes
tppCode: varchar('tpp_code', { length: 13 }),
tppName: varchar('tpp_name', { length: 255 }),
ttmtCode: varchar('ttmt_code', { length: 10 }),
ttmtName: varchar('ttmt_name', { length: 255 }),
```

**Step 3: Run database migration**

```bash
npm run db:push
```

Expected: Schema updated successfully

**Step 4: Commit**

```bash
git add src/lib/db/schema.ts
git commit -m "feat(db): add tppName and ttmtName columns to items table"
```

---

## Task 2: Create TPP Lookup API Proxy Route

**Files:**
- Create: `src/app/api/vmi/lookup/tpp/route.ts`

**Step 1: Create the TPP lookup API route**

Create file `src/app/api/vmi/lookup/tpp/route.ts`:

```typescript
import { NextRequest } from 'next/server';
import { successResponse, errorResponse, serverErrorResponse } from '@/lib/api-utils';

const VMI_PORTAL_BASE_URL = 'https://vmi-portal.bmscloud.in.th';
const VMI_API_KEY = process.env.VMI_PORTAL_API_KEY || '';

export interface TppItem {
  tppCode: string;
  tppName: string;
}

export interface TppLookupResponse {
  success: boolean;
  data: TppItem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const limit = searchParams.get('limit') || '50';
    const offset = searchParams.get('offset') || '0';

    if (!VMI_API_KEY) {
      return errorResponse('VMI Portal API key not configured');
    }

    const params = new URLSearchParams({
      limit,
      offset,
    });
    if (search) {
      params.set('search', search);
    }

    const response = await fetch(
      `${VMI_PORTAL_BASE_URL}/api/external/vendor/lookup/tpp?${params}`,
      {
        method: 'GET',
        headers: {
          'X-API-Key': VMI_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('VMI Portal TPP lookup failed:', response.status, errorText);
      return errorResponse(`VMI Portal error: ${response.status}`);
    }

    const data: TppLookupResponse = await response.json();

    return successResponse({
      items: data.data || [],
      pagination: data.pagination || { total: 0, limit: 50, offset: 0, hasMore: false },
    });
  } catch (error) {
    console.error('TPP lookup error:', error);
    return serverErrorResponse(error);
  }
}
```

**Step 2: Test the API route**

```bash
curl http://localhost:3000/api/vmi/lookup/tpp?search=para&limit=10
```

Expected: JSON response with TPP items or error if API key not set

**Step 3: Commit**

```bash
git add src/app/api/vmi/lookup/tpp/route.ts
git commit -m "feat(api): add TPP code lookup proxy route for VMI Portal"
```

---

## Task 3: Create TTMT Lookup API Proxy Route

**Files:**
- Create: `src/app/api/vmi/lookup/ttmt/route.ts`

**Step 1: Create the TTMT lookup API route**

Create file `src/app/api/vmi/lookup/ttmt/route.ts`:

```typescript
import { NextRequest } from 'next/server';
import { successResponse, errorResponse, serverErrorResponse } from '@/lib/api-utils';

const VMI_PORTAL_BASE_URL = 'https://vmi-portal.bmscloud.in.th';
const VMI_API_KEY = process.env.VMI_PORTAL_API_KEY || '';

export interface TtmtItem {
  ttmtCode: string;
  activeIngredient: string;
  strength: string;
  dosageForm: string;
  dispensingUnit: string;
  tradeName: string;
  manufacturer: string;
  fsn: string; // Full Specified Name - this will be used as ttmtName
  tmtType: string;
}

export interface TtmtLookupResponse {
  success: boolean;
  data: TtmtItem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const limit = searchParams.get('limit') || '50';
    const offset = searchParams.get('offset') || '0';

    if (!VMI_API_KEY) {
      return errorResponse('VMI Portal API key not configured');
    }

    const params = new URLSearchParams({
      limit,
      offset,
    });
    if (search) {
      params.set('search', search);
    }

    const response = await fetch(
      `${VMI_PORTAL_BASE_URL}/api/external/vendor/lookup/ttmt?${params}`,
      {
        method: 'GET',
        headers: {
          'X-API-Key': VMI_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('VMI Portal TTMT lookup failed:', response.status, errorText);
      return errorResponse(`VMI Portal error: ${response.status}`);
    }

    const data: TtmtLookupResponse = await response.json();

    return successResponse({
      items: data.data || [],
      pagination: data.pagination || { total: 0, limit: 50, offset: 0, hasMore: false },
    });
  } catch (error) {
    console.error('TTMT lookup error:', error);
    return serverErrorResponse(error);
  }
}
```

**Step 2: Test the API route**

```bash
curl http://localhost:3000/api/vmi/lookup/ttmt?search=ginger&limit=10
```

Expected: JSON response with TTMT items or error if API key not set

**Step 3: Commit**

```bash
git add src/app/api/vmi/lookup/ttmt/route.ts
git commit -m "feat(api): add TTMT code lookup proxy route for VMI Portal"
```

---

## Task 4: Create TppSearchDialog Component

**Files:**
- Create: `src/components/ui/tpp-search-dialog.tsx`

**Step 1: Create the TPP search dialog component**

Create file `src/components/ui/tpp-search-dialog.tsx`:

```typescript
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
  Pill,
} from 'lucide-react';

export interface TppItem {
  tppCode: string;
  tppName: string;
}

interface TppSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (item: TppItem) => void;
  title?: string;
}

export function TppSearchDialog({
  open,
  onOpenChange,
  onSelect,
  title = 'Search TPP Code',
}: TppSearchDialogProps) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<TppItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleSelect = useCallback((item: TppItem) => {
    onSelect(item);
    onOpenChange(false);
  }, [onSelect, onOpenChange]);

  const searchTpp = useCallback(async (query: string) => {
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

      const res = await fetch(`/api/vmi/lookup/tpp?${params}`, {
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
        console.error('Failed to search TPP:', error);
        setResults([]);
        setTotalCount(0);
      }
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Initial load when dialog opens
  useEffect(() => {
    if (open) {
      setSearch('');
      setResults([]);
      setHasSearched(false);
      searchTpp('');
    }
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [open, searchTpp]);

  // Debounced search when typing
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      searchTpp(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, open, searchTpp]);

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
      width={800}
      height={600}
      showCloseButton
      showTitle={false}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex-none p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Pill className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
              <p className="text-sm text-gray-500">Thai Pharmaceutical Product codes from VMI Portal</p>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <DxTextBox
              value={search}
              onValueChange={setSearch}
              placeholder="Search by TPP code or product name..."
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
              <span className="ml-2 text-gray-500">Searching VMI Portal...</span>
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500">
              {hasSearched ? (
                <>
                  <Search className="h-8 w-8 mb-2 text-gray-300" />
                  <p>No TPP codes found</p>
                  <p className="text-sm">Try a different search term</p>
                </>
              ) : (
                <>
                  <Pill className="h-8 w-8 mb-2 text-gray-300" />
                  <p>Enter a search term to find TPP codes</p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {results.map((item, index) => (
                <div
                  key={item.tppCode}
                  data-index={index}
                  onClick={() => handleSelect(item)}
                  className={`p-3 rounded-lg cursor-pointer transition-all ${
                    index === highlightedIndex
                      ? 'bg-blue-50 ring-2 ring-blue-500'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant="info" className="font-mono text-xs">
                        {item.tppCode}
                      </Badge>
                      <span className="text-sm font-medium text-gray-900">
                        {item.tppName}
                      </span>
                    </div>
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
                <span>Keyboard:</span>
              </div>
              <div className="flex items-center gap-1">
                <ArrowUp className="h-3 w-3" />
                <ArrowDown className="h-3 w-3" />
                <span>Navigate</span>
              </div>
              <div className="flex items-center gap-1">
                <CornerDownLeft className="h-3 w-3" />
                <span>Select</span>
              </div>
              <span>ESC Close</span>
            </div>
            <div>
              {hasSearched && (
                <span>
                  {results.length} of {totalCount} results
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </DxPopup>
  );
}
```

**Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit src/components/ui/tpp-search-dialog.tsx
```

Expected: No errors

**Step 3: Commit**

```bash
git add src/components/ui/tpp-search-dialog.tsx
git commit -m "feat(ui): add TppSearchDialog component for VMI Portal lookup"
```

---

## Task 5: Create TtmtSearchDialog Component

**Files:**
- Create: `src/components/ui/ttmt-search-dialog.tsx`

**Step 1: Create the TTMT search dialog component**

Create file `src/components/ui/ttmt-search-dialog.tsx`:

```typescript
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

  // Initial load when dialog opens
  useEffect(() => {
    if (open) {
      setSearch('');
      setResults([]);
      setHasSearched(false);
      searchTtmt('');
    }
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [open, searchTtmt]);

  // Debounced search when typing
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      searchTtmt(search);
    }, 300);
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
              <p className="text-sm text-gray-500">Thai Traditional Medicine Terminology codes from VMI Portal</p>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <DxTextBox
              value={search}
              onValueChange={setSearch}
              placeholder="Search by TTMT code, ingredient, or trade name..."
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
              <span className="ml-2 text-gray-500">Searching VMI Portal...</span>
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500">
              {hasSearched ? (
                <>
                  <Search className="h-8 w-8 mb-2 text-gray-300" />
                  <p>No TTMT codes found</p>
                  <p className="text-sm">Try a different search term</p>
                </>
              ) : (
                <>
                  <Leaf className="h-8 w-8 mb-2 text-gray-300" />
                  <p>Enter a search term to find TTMT codes</p>
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
                        <Badge variant="secondary" className="text-xs">
                          {item.dosageForm}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {item.fsn}
                      </p>
                      <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <Beaker className="h-3 w-3" />
                          <span>{item.activeIngredient} {item.strength}</span>
                        </div>
                        {item.manufacturer && (
                          <div className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            <span>{item.manufacturer}</span>
                          </div>
                        )}
                      </div>
                      {item.tradeName && (
                        <p className="text-xs text-gray-400 mt-1">
                          Trade: {item.tradeName}
                        </p>
                      )}
                    </div>
                    <div className="text-xs text-gray-400">
                      {item.dispensingUnit}
                    </div>
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
                <span>Keyboard:</span>
              </div>
              <div className="flex items-center gap-1">
                <ArrowUp className="h-3 w-3" />
                <ArrowDown className="h-3 w-3" />
                <span>Navigate</span>
              </div>
              <div className="flex items-center gap-1">
                <CornerDownLeft className="h-3 w-3" />
                <span>Select</span>
              </div>
              <span>ESC Close</span>
            </div>
            <div>
              {hasSearched && (
                <span>
                  {results.length} of {totalCount} results
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </DxPopup>
  );
}
```

**Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit src/components/ui/ttmt-search-dialog.tsx
```

Expected: No errors

**Step 3: Commit**

```bash
git add src/components/ui/ttmt-search-dialog.tsx
git commit -m "feat(ui): add TtmtSearchDialog component for VMI Portal lookup"
```

---

## Task 6: Update ItemEditForm to Add Search Buttons

**Files:**
- Modify: `src/components/ui/item-edit-form.tsx`

**Step 1: Add imports for the search dialogs**

At the top of `src/components/ui/item-edit-form.tsx`, add:

```typescript
import { TppSearchDialog, TppItem } from '@/components/ui/tpp-search-dialog';
import { TtmtSearchDialog, TtmtItem } from '@/components/ui/ttmt-search-dialog';
```

**Step 2: Update the Item and ItemFormData interfaces**

Find the interfaces and add tppName and ttmtName:

```typescript
export interface Item {
  // ... existing fields ...
  tppCode: string | null;
  tppName: string | null;  // Add this
  ttmtCode: string | null;
  ttmtName: string | null;  // Add this
}

export interface ItemFormData {
  // ... existing fields ...
  tppCode: string;
  tppName: string;  // Add this
  ttmtCode: string;
  ttmtName: string;  // Add this
}
```

**Step 3: Add state for dialog visibility**

In the component function, add state variables:

```typescript
const [showTppSearch, setShowTppSearch] = useState(false);
const [showTtmtSearch, setShowTtmtSearch] = useState(false);
```

**Step 4: Add handlers for dialog selection**

```typescript
const handleTppSelect = useCallback((item: TppItem) => {
  updateFormData('tppCode', item.tppCode);
  updateFormData('tppName', item.tppName);
}, [updateFormData]);

const handleTtmtSelect = useCallback((item: TtmtItem) => {
  updateFormData('ttmtCode', item.ttmtCode);
  updateFormData('ttmtName', item.fsn); // Use FSN as the name
}, [updateFormData]);
```

**Step 5: Update the VMI Standard Codes section (around line 526-564)**

Replace the existing VMI section with:

```typescript
{/* VMI Standard Codes */}
<SectionCard
  icon={<Barcode className="h-5 w-5 text-gray-600" />}
  title="VMI Standard Codes"
  description="Thai pharmaceutical and traditional medicine codes for VMI Portal integration"
>
  <div className="grid grid-cols-2 gap-5">
    {/* TPP Code */}
    <div className="col-span-1">
      <label className="block text-sm font-medium text-gray-700 mb-1">TPP Code</label>
      <div className="flex gap-2">
        <div className="flex-1">
          <DxTextBox
            value={formData.tppCode}
            onValueChange={(value) => {
              updateFormData('tppCode', value);
              if (!value) updateFormData('tppName', '');
            }}
            placeholder="13-digit code"
            maxLength={13}
          />
        </div>
        <DxButton
          icon="search"
          hint="Search TPP codes from VMI Portal"
          type="default"
          stylingMode="outlined"
          onClick={() => setShowTppSearch(true)}
        />
      </div>
      {formData.tppName && (
        <p className="text-xs text-blue-600 mt-1 truncate" title={formData.tppName}>
          {formData.tppName}
        </p>
      )}
      <p className="text-xs text-gray-500 mt-1">Thai Pharmaceutical Product code (13 digits)</p>
    </div>

    {/* TTMT Code */}
    <div className="col-span-1">
      <label className="block text-sm font-medium text-gray-700 mb-1">TTMT Code</label>
      <div className="flex gap-2">
        <div className="flex-1">
          <DxTextBox
            value={formData.ttmtCode}
            onValueChange={(value) => {
              updateFormData('ttmtCode', value);
              if (!value) updateFormData('ttmtName', '');
            }}
            placeholder="A + 8 digits"
            maxLength={10}
          />
        </div>
        <DxButton
          icon="search"
          hint="Search TTMT codes from VMI Portal"
          type="default"
          stylingMode="outlined"
          onClick={() => setShowTtmtSearch(true)}
        />
      </div>
      {formData.ttmtName && (
        <p className="text-xs text-green-600 mt-1 truncate" title={formData.ttmtName}>
          {formData.ttmtName}
        </p>
      )}
      <p className="text-xs text-gray-500 mt-1">Thai Traditional Medicine Terminology code</p>
    </div>
  </div>
  {(formData.tppCode || formData.ttmtCode) && (
    <div className="mt-4 bg-emerald-50 rounded-xl p-4 flex items-center gap-3 border border-emerald-100">
      <div className="p-2 bg-emerald-100 rounded-lg">
        <CheckCircle className="h-4 w-4 text-emerald-600" />
      </div>
      <div className="text-sm text-emerald-700">
        <span className="font-semibold">VMI Ready:</span> This item can be synced to VMI Portal
      </div>
    </div>
  )}
</SectionCard>

{/* Search Dialogs */}
<TppSearchDialog
  open={showTppSearch}
  onOpenChange={setShowTppSearch}
  onSelect={handleTppSelect}
/>
<TtmtSearchDialog
  open={showTtmtSearch}
  onOpenChange={setShowTtmtSearch}
  onSelect={handleTtmtSelect}
/>
```

**Step 6: Verify no TypeScript errors**

```bash
npm run lint
npx tsc --noEmit
```

Expected: No errors

**Step 7: Commit**

```bash
git add src/components/ui/item-edit-form.tsx
git commit -m "feat(ui): add TPP/TTMT search buttons to ItemEditForm"
```

---

## Task 7: Update Items API to Handle tppName and ttmtName

**Files:**
- Modify: `src/app/api/items/route.ts`
- Modify: `src/app/api/items/[id]/route.ts`

**Step 1: Update POST handler in route.ts to include tppName and ttmtName**

In `src/app/api/items/route.ts`, find the POST handler and add the new fields:

```typescript
// In the insert statement, add:
tppName: body.tppName || null,
ttmtName: body.ttmtName || null,
```

**Step 2: Update PUT handler in [id]/route.ts to include tppName and ttmtName**

In `src/app/api/items/[id]/route.ts`, find the PUT handler and add:

```typescript
// In the update statement, add:
tppName: body.tppName !== undefined ? body.tppName || null : undefined,
ttmtName: body.ttmtName !== undefined ? body.ttmtName || null : undefined,
```

**Step 3: Verify API works**

```bash
npm run dev
# Test in browser or with curl
```

**Step 4: Commit**

```bash
git add src/app/api/items/route.ts src/app/api/items/[id]/route.ts
git commit -m "feat(api): add tppName and ttmtName to items API"
```

---

## Task 8: Export Components from Index

**Files:**
- Create or modify: `src/components/ui/index.ts`

**Step 1: Add exports for the new components**

Add to exports:

```typescript
export { TppSearchDialog } from './tpp-search-dialog';
export type { TppItem } from './tpp-search-dialog';
export { TtmtSearchDialog } from './ttmt-search-dialog';
export type { TtmtItem } from './ttmt-search-dialog';
```

**Step 2: Commit**

```bash
git add src/components/ui/index.ts
git commit -m "feat(ui): export TPP and TTMT search dialog components"
```

---

## Task 9: Run Full Test and Verify

**Step 1: Run linter**

```bash
npm run lint
```

Expected: No errors

**Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors

**Step 3: Start development server**

```bash
npm run dev
```

**Step 4: Manual test**

1. Navigate to `/inventory/items/new` or edit an existing item
2. Scroll to VMI Standard Codes section
3. Click the search button next to TPP Code field
4. Verify dialog opens with search functionality
5. Search for a term and verify results appear
6. Select an item and verify both code and name are populated
7. Repeat for TTMT Code field
8. Save the item and verify data persists

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat(vmi): complete TPP/TTMT search dialog implementation"
```

---

## Summary of Changes

| File | Action | Description |
|------|--------|-------------|
| `src/lib/db/schema.ts` | Modify | Add tppName, ttmtName columns |
| `src/app/api/vmi/lookup/tpp/route.ts` | Create | TPP lookup API proxy |
| `src/app/api/vmi/lookup/ttmt/route.ts` | Create | TTMT lookup API proxy |
| `src/components/ui/tpp-search-dialog.tsx` | Create | TPP search dialog component |
| `src/components/ui/ttmt-search-dialog.tsx` | Create | TTMT search dialog component |
| `src/components/ui/item-edit-form.tsx` | Modify | Add search buttons |
| `src/app/api/items/route.ts` | Modify | Handle tppName, ttmtName in POST |
| `src/app/api/items/[id]/route.ts` | Modify | Handle tppName, ttmtName in PUT |
| `src/components/ui/index.ts` | Modify | Export new components |

---

Plan complete and saved to `docs/plans/2025-12-21-tpp-ttmt-search-dialogs.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
