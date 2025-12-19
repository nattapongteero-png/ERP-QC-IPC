'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxButton } from '@/components/ui/dx-button';
import { DxLoadIndicator } from '@/components/ui/dx-load-indicator';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  Users,
  Phone,
  Mail,
  MapPin,
  Building2,
  Keyboard,
  ArrowUp,
  ArrowDown,
  CornerDownLeft,
  CreditCard,
} from 'lucide-react';

export interface Customer {
  id: number;
  code: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  customerType: string;
  creditLimit: number | null;
  creditTermDays: number | null;
  paymentTerms: string | null;
  isActive: boolean;
}

interface CustomerSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (customer: Customer) => void;
  title?: string;
  excludeIds?: number[];
}

// Customer type color mapping
const customerTypeColors: Record<string, { bg: string; text: string; label: string }> = {
  hospital: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Hospital' },
  clinic: { bg: 'bg-teal-100', text: 'text-teal-700', label: 'Clinic' },
  pharmacy: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Pharmacy' },
  distributor: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Distributor' },
  traditional_medicine: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Traditional Medicine' },
  spa_wellness: { bg: 'bg-pink-100', text: 'text-pink-700', label: 'Spa & Wellness' },
  government: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Government' },
  export: { bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'Export' },
  other: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Other' },
};

export function CustomerSearchDialog({
  open,
  onOpenChange,
  onSelect,
  title = 'Search Customers',
  excludeIds = [],
}: CustomerSearchDialogProps) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Customer[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Store excludeIds in a ref to avoid infinite loops (array reference changes on every render)
  const excludeIdsRef = useRef(excludeIds);
  excludeIdsRef.current = excludeIds;

  const handleSelect = useCallback((customer: Customer) => {
    onSelect(customer);
    onOpenChange(false);
  }, [onSelect, onOpenChange]);

  // Track if we should skip fetching (used during reset)
  const skipFetchRef = useRef(false);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      skipFetchRef.current = true;
      setSearch('');
      setResults([]);
      setHighlightedIndex(0);
      setHasSearched(false);
      setIsSearching(false);
    } else {
      skipFetchRef.current = false;
    }
  }, [open]);

  // Search effect with debounce and abort controller
  useEffect(() => {
    // Don't fetch if dialog is closed or we're in reset mode
    if (!open || skipFetchRef.current) {
      return;
    }

    const abortController = new AbortController();

    const fetchCustomers = async () => {
      setIsSearching(true);
      setHasSearched(true);
      try {
        const params = new URLSearchParams({
          limit: '20',
          isActive: 'true',
        });
        if (search && search.trim()) {
          params.set('search', search.trim());
        }

        const res = await fetch(`/api/customers?${params}`, {
          signal: abortController.signal,
        });
        const data = await res.json();

        if (data.success) {
          let customers = data.data?.items || [];
          const currentExcludeIds = excludeIdsRef.current;
          if (currentExcludeIds.length > 0) {
            customers = customers.filter((c: Customer) => !currentExcludeIds.includes(c.id));
          }
          setResults(customers);
          setHighlightedIndex(0);
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        console.error('Failed to search customers:', error);
        setResults([]);
      } finally {
        if (!abortController.signal.aborted) {
          setIsSearching(false);
        }
      }
    };

    // Debounce: immediate for initial load, 300ms for subsequent searches
    const debounceTime = search === '' ? 0 : 300;
    const timer = setTimeout(fetchCustomers, debounceTime);

    return () => {
      clearTimeout(timer);
      abortController.abort();
    };
  }, [open, search]); // Removed excludeIds - using ref instead

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

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return '-';
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
    }).format(amount);
  };

  const getTypeStyle = (type: string) => {
    return customerTypeColors[type] || { bg: 'bg-gray-100', text: 'text-gray-600', label: type };
  };

  const renderDialogContent = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="pb-4 border-b bg-gradient-to-r from-emerald-50 to-teal-50 -mx-4 -mt-4 px-4 pt-4 rounded-t-lg">
        <div className="flex items-center gap-2 text-xl font-semibold">
          <Users className="h-5 w-5 text-emerald-600" />
          {title}
        </div>
        <p className="text-sm text-gray-500 mt-1">
          Search by customer code, name, email, or phone
        </p>
      </div>

      {/* Search Input */}
      <div className="py-4 border-b -mx-4 px-4 bg-white">
        <DxTextBox
          placeholder="Search customers..."
          value={search}
          onValueChange={setSearch}
          mode="search"
          showClearButton
        />
      </div>

      {/* Results Area */}
      <div ref={listRef} className="flex-1 overflow-y-auto -mx-4 px-4 py-4 min-h-[300px]">
        {isSearching ? (
          <div className="flex flex-col items-center justify-center py-12">
            <DxLoadIndicator />
            <p className="text-gray-500 mt-4">Searching customers...</p>
          </div>
        ) : results.length > 0 ? (
          <div className="space-y-2">
            {results.map((customer, index) => {
              const typeStyle = getTypeStyle(customer.customerType);
              const isHighlighted = index === highlightedIndex;

              return (
                <div
                  key={customer.id}
                  data-index={index}
                  onClick={() => handleSelect(customer)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all duration-150 ${
                    isHighlighted
                      ? 'ring-2 ring-emerald-500 bg-emerald-50 border-emerald-200 shadow-md'
                      : 'bg-white hover:bg-gray-50 border-gray-200 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: Customer Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-bold text-emerald-600 text-lg">{customer.code}</span>
                        <Badge className={`${typeStyle.bg} ${typeStyle.text} text-xs`}>
                          {typeStyle.label}
                        </Badge>
                        {!customer.isActive && (
                          <Badge variant="danger" className="text-xs">
                            Inactive
                          </Badge>
                        )}
                      </div>

                      <div className="mb-2">
                        <p className="font-medium text-gray-900 text-lg">
                          {customer.name}
                        </p>
                        {customer.contactPerson && (
                          <p className="text-sm text-gray-500 flex items-center gap-1">
                            <Building2 className="h-3.5 w-3.5" />
                            {customer.contactPerson}
                          </p>
                        )}
                      </div>

                      {/* Contact details row */}
                      <div className="flex items-center gap-4 text-sm text-gray-600 flex-wrap">
                        {customer.phone && (
                          <div className="flex items-center gap-1">
                            <Phone className="h-3.5 w-3.5" />
                            <span>{customer.phone}</span>
                          </div>
                        )}
                        {customer.email && (
                          <div className="flex items-center gap-1">
                            <Mail className="h-3.5 w-3.5" />
                            <span>{customer.email}</span>
                          </div>
                        )}
                        {customer.address && (
                          <div className="flex items-center gap-1 max-w-xs truncate">
                            <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                            <span className="truncate">{customer.address}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Credit Info & Action */}
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      {customer.creditLimit && (
                        <div className="text-right">
                          <div className="flex items-center gap-1 text-gray-600">
                            <CreditCard className="h-3.5 w-3.5" />
                            <span className="text-sm">Credit Limit</span>
                          </div>
                          <p className="font-semibold text-emerald-600">
                            {formatCurrency(customer.creditLimit)}
                          </p>
                          {customer.creditTermDays && (
                            <p className="text-xs text-gray-500">
                              {customer.creditTermDays} days term
                            </p>
                          )}
                        </div>
                      )}

                      <DxButton
                        text="Select"
                        type="default"
                        onClick={(e) => { e?.event?.stopPropagation(); handleSelect(customer); }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : hasSearched ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <Users className="h-16 w-16 text-gray-300 mb-4" />
            <p className="text-lg font-medium mb-2">No customers found</p>
            {search ? (
              <p className="text-sm text-gray-400 mb-4">
                No results for &quot;{search}&quot;
              </p>
            ) : (
              <p className="text-sm text-gray-400 mb-4">
                No customers available in the system
              </p>
            )}
            {search && (
              <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-4 max-w-md">
                <p className="font-medium mb-2">Search tips:</p>
                <ul className="list-disc list-inside space-y-1 text-gray-400">
                  <li>Try searching by customer code (e.g., &quot;CUS001&quot;)</li>
                  <li>Search by company name or contact person</li>
                  <li>Try phone number or email</li>
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <Search className="h-16 w-16 text-gray-300 mb-4" />
            <p className="text-lg font-medium mb-2">Loading customers...</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="pt-3 border-t -mx-4 px-4 pb-2 bg-gray-50 flex items-center justify-between rounded-b-lg">
        {results.length > 0 ? (
          <>
            <div className="text-sm text-gray-500">
              <span className="font-medium text-gray-700">{results.length}</span> customer{results.length !== 1 ? 's' : ''} found
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
