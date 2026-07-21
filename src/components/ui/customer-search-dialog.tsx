'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxButton } from '@/components/ui/dx-button';
import { DxLoadIndicator } from '@/components/ui/dx-load-indicator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
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
  FileText,
  UserPlus,
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
  taxId: string | null;
  isActive: boolean;
}

interface CustomerSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (customer: Customer) => void;
  title?: string;
  excludeIds?: number[];
  /**
   * Opt-in inline "add new customer" affordance. When true, a
   * "+ เพิ่มลูกค้าใหม่" button appears next to the search box and opens a small
   * create form; on success the new customer is selected straight into the
   * caller (onSelect) and the dialog closes. Mirrors ItemSearchDialog's
   * allowCreate so callers that don't pass it keep the pure-search behaviour.
   */
  allowCreate?: boolean;
}

// Customer types offered in the inline create form. Values match the keys in
// customerTypeColors above so the badge/label stay consistent everywhere.
const customerTypeOptions = [
  { value: 'hospital', label: 'Hospital' },
  { value: 'clinic', label: 'Clinic' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'distributor', label: 'Distributor' },
  { value: 'traditional_medicine', label: 'Traditional Medicine' },
  { value: 'spa_wellness', label: 'Spa & Wellness' },
  { value: 'government', label: 'Government' },
  { value: 'other', label: 'Other' },
];

interface NewCustomerForm {
  code: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  taxId: string;
  customerType: string;
  paymentTerms: string;
  creditTermDays: number | null;
}

const emptyNewCustomer: NewCustomerForm = {
  code: '',
  name: '',
  contactPerson: '',
  phone: '',
  email: '',
  address: '',
  taxId: '',
  customerType: 'hospital',
  paymentTerms: '',
  creditTermDays: null,
};

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
  allowCreate = false,
}: CustomerSearchDialogProps) {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Customer[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Inline-create state
  const [showCreate, setShowCreate] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newCustomer, setNewCustomer] = useState<NewCustomerForm>(emptyNewCustomer);

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
      setShowCreate(false);
      setNewCustomer(emptyNewCustomer);
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

  // Open the inline create form; auto-fill the next customer code so the user
  // only fills in the human details. If the code fetch fails we still open the
  // form with a blank code — the server assigns one on POST anyway.
  const openCreateForm = useCallback(async () => {
    setNewCustomer({ ...emptyNewCustomer });
    setShowCreate(true);
    try {
      const res = await fetch('/api/customers/next-code');
      const data = await res.json();
      const code = data?.data?.code;
      if (data?.success && code) {
        setNewCustomer((prev) => ({ ...prev, code }));
      }
    } catch (error) {
      console.error('Failed to fetch next customer code:', error);
    }
  }, []);

  const handleCreateCustomer = useCallback(async () => {
    if (!newCustomer.name.trim()) {
      toast.error('กรุณากรอกชื่อลูกค้า');
      return;
    }
    setIsCreating(true);
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: newCustomer.code || undefined,
          name: newCustomer.name.trim(),
          contactPerson: newCustomer.contactPerson || null,
          phone: newCustomer.phone || null,
          email: newCustomer.email || null,
          address: newCustomer.address || null,
          taxId: newCustomer.taxId || null,
          customerType: newCustomer.customerType || 'hospital',
          creditTermDays: newCustomer.creditTermDays ?? null,
          paymentTerms: newCustomer.paymentTerms || null,
        }),
      });
      const data = await res.json();
      if (!data?.success) {
        throw new Error(data?.error || 'Failed to create customer');
      }

      const created: Customer = {
        id: Number(data.data?.id),
        code: newCustomer.code,
        name: newCustomer.name.trim(),
        contactPerson: newCustomer.contactPerson || null,
        phone: newCustomer.phone || null,
        email: newCustomer.email || null,
        address: newCustomer.address || null,
        customerType: newCustomer.customerType || 'hospital',
        creditLimit: null,
        creditTermDays: newCustomer.creditTermDays ?? null,
        paymentTerms: newCustomer.paymentTerms || null,
        taxId: newCustomer.taxId || null,
        isActive: true,
      };

      toast.success('เพิ่มลูกค้าใหม่สำเร็จ', `${created.code} - ${created.name}`);
      setShowCreate(false);
      setNewCustomer(emptyNewCustomer);
      // Select the new customer straight into the caller and close the picker.
      handleSelect(created);
    } catch (error) {
      console.error('Failed to create customer:', error);
      toast.error('เพิ่มลูกค้าไม่สำเร็จ', error instanceof Error ? error.message : undefined);
    } finally {
      setIsCreating(false);
    }
  }, [newCustomer, toast, handleSelect]);

  const renderDialogContent = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="pb-4 border-b bg-gradient-to-r from-emerald-50 to-teal-50 -mx-4 -mt-4 px-4 pt-4 rounded-t-lg">
        <div className="flex items-center gap-2 text-xl font-semibold">
          <Users className="h-5 w-5 text-emerald-600" />
          {title}
        </div>
        <p className="text-sm text-gray-500 mt-1">
          ค้นหาด้วยรหัสลูกค้า ชื่อ อีเมล หรือเบอร์โทร
        </p>
      </div>

      {/* Search Input */}
      <div className="py-4 border-b -mx-4 px-4 bg-white" data-testid="customer-search-container">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <DxTextBox
              placeholder="ค้นหาลูกค้า..."
              value={search}
              onValueChange={setSearch}
              mode="search"
              showClearButton
              elementAttr={{ 'data-testid': 'customer-search-input' }}
            />
          </div>
          {allowCreate && (
            <DxButton
              text="+ เพิ่มลูกค้าใหม่"
              type="normal"
              stylingMode="outlined"
              onClick={openCreateForm}
              elementAttr={{ 'data-testid': 'customer-create-btn' }}
            />
          )}
        </div>
      </div>

      {/* Results Area */}
      <div ref={listRef} className="flex-1 overflow-y-auto -mx-4 px-4 py-4 min-h-[300px]">
        {isSearching ? (
          <div className="flex flex-col items-center justify-center py-12">
            <DxLoadIndicator />
            <p className="text-gray-500 mt-4">กำลังค้นหาลูกค้า...</p>
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
                  data-testid={`customer-result-${customer.code}`}
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
                            ไม่ใช้งาน
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
                        {customer.taxId && (
                          <div className="flex items-center gap-1">
                            <FileText className="h-3.5 w-3.5" />
                            <span>เลขประจำตัวผู้เสียภาษี: {customer.taxId}</span>
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
                            <span className="text-sm">วงเงินเครดิต</span>
                          </div>
                          <p className="font-semibold text-emerald-600">
                            {formatCurrency(customer.creditLimit)}
                          </p>
                          {customer.creditTermDays && (
                            <p className="text-xs text-gray-500">
                              เครดิต {customer.creditTermDays} วัน
                            </p>
                          )}
                        </div>
                      )}

                      <DxButton
                        text="เลือก"
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
            <p className="text-lg font-medium mb-2">ไม่พบลูกค้า</p>
            {search ? (
              <p className="text-sm text-gray-400 mb-4">
                ไม่พบผลลัพธ์สำหรับ &quot;{search}&quot;
              </p>
            ) : (
              <p className="text-sm text-gray-400 mb-4">
                ไม่มีลูกค้าในระบบ
              </p>
            )}
            {search && (
              <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-4 max-w-md">
                <p className="font-medium mb-2">คำแนะนำการค้นหา:</p>
                <ul className="list-disc list-inside space-y-1 text-gray-400">
                  <li>ลองค้นหาด้วยรหัสลูกค้า (เช่น &quot;CUS001&quot;)</li>
                  <li>ค้นหาด้วยชื่อบริษัทหรือผู้ติดต่อ</li>
                  <li>ลองใช้เบอร์โทรหรืออีเมล</li>
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <Search className="h-16 w-16 text-gray-300 mb-4" />
            <p className="text-lg font-medium mb-2">กำลังโหลดลูกค้า...</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="pt-3 border-t -mx-4 px-4 pb-2 bg-gray-50 flex items-center justify-between rounded-b-lg">
        <div className="flex items-center gap-4">
          {results.length > 0 ? (
            <div className="text-sm text-gray-500">
              พบ <span className="font-medium text-gray-700">{results.length}</span> ลูกค้า
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Keyboard className="h-4 w-4" />
              <span>ใช้แป้นพิมพ์ลัดเพื่อการนำทางที่รวดเร็วขึ้น</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Keyboard shortcuts */}
          <div className="flex items-center gap-3 text-xs text-gray-400">
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
          </div>

          {/* Close Button */}
          <DxButton
            text="ปิด"
            icon="close"
            type="normal"
            stylingMode="outlined"
            onClick={() => onOpenChange(false)}
            elementAttr={{ 'data-testid': 'customer-search-close-btn' }}
          />
        </div>
      </div>
    </div>
  );

  const renderCreateForm = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="pb-4 border-b bg-gradient-to-r from-emerald-50 to-teal-50 -mx-4 -mt-4 px-4 pt-4 rounded-t-lg">
        <div className="flex items-center gap-2 text-xl font-semibold">
          <UserPlus className="h-5 w-5 text-emerald-600" />
          เพิ่มลูกค้าใหม่
        </div>
        <p className="text-sm text-gray-500 mt-1">
          กรอกข้อมูลลูกค้าใหม่ ระบบจะเลือกลูกค้านี้ให้อัตโนมัติหลังบันทึก
        </p>
      </div>

      {/* Form body */}
      <div className="flex-1 overflow-y-auto -mx-4 px-4 py-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">รหัสลูกค้า</label>
            <DxTextBox
              value={newCustomer.code}
              onValueChange={(v) => setNewCustomer((p) => ({ ...p, code: v }))}
              placeholder="ระบบสร้างให้อัตโนมัติ"
              labelMode="hidden"
              elementAttr={{ 'data-testid': 'customer-create-code' }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ชื่อลูกค้า <span className="text-red-500">*</span>
            </label>
            <DxTextBox
              value={newCustomer.name}
              onValueChange={(v) => setNewCustomer((p) => ({ ...p, name: v }))}
              placeholder="ชื่อบริษัท / หน่วยงาน"
              labelMode="hidden"
              elementAttr={{ 'data-testid': 'customer-create-name' }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ผู้ติดต่อ</label>
            <DxTextBox
              value={newCustomer.contactPerson}
              onValueChange={(v) => setNewCustomer((p) => ({ ...p, contactPerson: v }))}
              labelMode="hidden"
              elementAttr={{ 'data-testid': 'customer-create-contact' }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ประเภทลูกค้า</label>
            <DxSelectBox
              value={newCustomer.customerType}
              onValueChange={(v) => setNewCustomer((p) => ({ ...p, customerType: v }))}
              items={customerTypeOptions}
              labelMode="hidden"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">เบอร์โทร</label>
            <DxTextBox
              value={newCustomer.phone}
              onValueChange={(v) => setNewCustomer((p) => ({ ...p, phone: v }))}
              mode="tel"
              labelMode="hidden"
              elementAttr={{ 'data-testid': 'customer-create-phone' }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">อีเมล</label>
            <DxTextBox
              value={newCustomer.email}
              onValueChange={(v) => setNewCustomer((p) => ({ ...p, email: v }))}
              mode="email"
              labelMode="hidden"
              elementAttr={{ 'data-testid': 'customer-create-email' }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">เลขประจำตัวผู้เสียภาษี</label>
            <DxTextBox
              value={newCustomer.taxId}
              onValueChange={(v) => setNewCustomer((p) => ({ ...p, taxId: v }))}
              labelMode="hidden"
              elementAttr={{ 'data-testid': 'customer-create-taxid' }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">เงื่อนไขการชำระเงิน</label>
            <DxTextBox
              value={newCustomer.paymentTerms}
              onValueChange={(v) => setNewCustomer((p) => ({ ...p, paymentTerms: v }))}
              placeholder="เช่น Net 30"
              labelMode="hidden"
              elementAttr={{ 'data-testid': 'customer-create-payment-terms' }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ระยะเวลาเครดิต (วัน)</label>
            <DxNumberBox
              value={newCustomer.creditTermDays}
              onValueChange={(v) => setNewCustomer((p) => ({ ...p, creditTermDays: v }))}
              min={0}
              format="#,##0"
              labelMode="hidden"
              inputAttr={{ 'data-testid': 'customer-create-credit-term' }}
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">ที่อยู่</label>
            <DxTextArea
              value={newCustomer.address}
              onValueChange={(v) => setNewCustomer((p) => ({ ...p, address: v }))}
              height={70}
              labelMode="hidden"
              inputAttr={{ 'data-testid': 'customer-create-address' }}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="pt-3 border-t -mx-4 px-4 pb-2 bg-gray-50 flex items-center justify-end gap-2 rounded-b-lg">
        <DxButton
          text="ยกเลิก"
          type="normal"
          stylingMode="outlined"
          disabled={isCreating}
          onClick={() => setShowCreate(false)}
          elementAttr={{ 'data-testid': 'customer-create-cancel-btn' }}
        />
        <DxButton
          text={isCreating ? 'กำลังบันทึก...' : 'บันทึกและเลือก'}
          type="success"
          icon="save"
          disabled={isCreating}
          onClick={handleCreateCustomer}
          elementAttr={{ 'data-testid': 'customer-create-submit-btn' }}
        />
      </div>
    </div>
  );

  return (
    <>
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

      {/* Inline create-customer sub-dialog */}
      {allowCreate && (
        <DxPopup
          visible={showCreate}
          onHiding={() => setShowCreate(false)}
          title=""
          width={720}
          height={640}
          showCloseButton
          showTitle={false}
        >
          {renderCreateForm()}
        </DxPopup>
      )}
    </>
  );
}
