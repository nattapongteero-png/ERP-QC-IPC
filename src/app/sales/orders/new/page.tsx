'use client';

// Sales Order Create Page
// Following template design pattern with DevExtreme components

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { MainLayout } from '@/components/layout/main-layout';
import { calcLineVat } from '@/lib/utils/vat';
import { normalizePaymentTerms } from '@/lib/constants/payment-terms';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from 'devextreme-react/button';
import TextArea from 'devextreme-react/text-area';
import TextBox from 'devextreme-react/text-box';
import DateBox from 'devextreme-react/date-box';
import NumberBox from 'devextreme-react/number-box';
import SelectBox from 'devextreme-react/select-box';
import DataGrid, {
  Column,
  Paging,
  Summary,
  TotalItem,
} from 'devextreme-react/data-grid';
import notify from 'devextreme/ui/notify';
import { ItemSearchDialog, Item } from '@/components/ui/item-search-dialog';
import { CustomerSearchDialog, Customer } from '@/components/ui/customer-search-dialog';
import {
  ShoppingCart,
  Search,
  Building2,
  Phone,
  Mail,
  MapPin,
  Trash2,
  Package,
  FileText,
  Calendar,
  CreditCard,
  Truck,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface SOLine {
  id: number;
  itemId: number;
  itemCode: string;
  itemName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  notes: string;
}

interface FormData {
  customerName: string;
  customerContact: string;
  customerAddress: string;
  requiredDate: Date | null;
  paymentTerms: string;
  notes: string;
  status: string;
  shippingCost: number;
  carrier: string;
  trackingNumber: string;
}

// ============================================================================
// Constants - Translation keys for options
// ============================================================================

const STATUS_KEYS = ['draft', 'confirmed'] as const;

// Payment-term dropdown. The VALUE stored on an SO — and on the customer master
// (sales/customers/new saves PAYMENT_TERM_VALUES[key]) — is the canonical string
// 'Net 30' / 'Cash' / 'COD', NOT the i18n key. The dropdown MUST offer those
// exact values, and ALL of them a customer can hold, or a customer-prefilled or
// previously-saved term renders blank (the bug that kept coming back). Keys drive
// the translated label only.
const PAYMENT_TERM_KEYS = ['cash', 'net7', 'net15', 'net30', 'net45', 'net60', 'net90', 'cod'] as const;
const PAYMENT_TERM_VALUE: Record<(typeof PAYMENT_TERM_KEYS)[number], string> = {
  cash: 'Cash',
  net7: 'Net 7',
  net15: 'Net 15',
  net30: 'Net 30',
  net45: 'Net 45',
  net60: 'Net 60',
  net90: 'Net 90',
  cod: 'COD',
};
const PAYMENT_TERM_VALUE_SET = new Set<string>(Object.values(PAYMENT_TERM_VALUE));

/**
 * Map a stored / customer-prefilled payment-terms value to one the dropdown can
 * display. Canonical values ('Net 30', 'Cash', 'COD'...) pass straight through;
 * legacy free-text ('เครดิต 30 วัน', 'net30') is normalized to canonical so it
 * still shows instead of silently blanking. Unmappable → '' (forces a real pick).
 */
const toDisplayTerm = (value: string | null | undefined): string => {
  if (value && PAYMENT_TERM_VALUE_SET.has(value)) return value;
  return normalizePaymentTerms(value) || '';
};

// ============================================================================
// Helper Functions
// ============================================================================

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
  }).format(amount);
};

const formatDateForApi = (date: Date | null): string | null => {
  if (!date) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// ============================================================================
// Main Component
// ============================================================================

export default function NewSalesOrderPage() {
  const router = useRouter();
  const t = useTranslations('sales');
  const [isSaving, setIsSaving] = useState(false);
  // Edit mode: when the page is opened as /sales/orders/new?edit=<id> it loads
  // that DRAFT order and saving PUTs to it instead of creating a new one.
  const [editId, setEditId] = useState<number | null>(null);
  const [isLoadingEdit, setIsLoadingEdit] = useState(false);

  // Memoized options with translations
  const statusOptions = useMemo(() => STATUS_KEYS.map(key => ({
    value: key,
    label: t(`orders.new.statusOptions.${key}` as const),
  })), [t]);

  const paymentTermsOptions = useMemo(() => PAYMENT_TERM_KEYS.map(key => ({
    value: PAYMENT_TERM_VALUE[key],
    label: t(`orders.new.paymentOptions.${key}` as const),
  })), [t]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false);
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [lineIdCounter, setLineIdCounter] = useState(1);

  const [form, setForm] = useState<FormData>({
    customerName: '',
    customerContact: '',
    customerAddress: '',
    requiredDate: null,
    paymentTerms: '',
    notes: '',
    status: 'draft',
    shippingCost: 0,
    carrier: '',
    trackingNumber: '',
  });

  const [lines, setLines] = useState<SOLine[]>([]);
  // false = line prices are BEFORE VAT (add 7%); true = prices already INCLUDE
  // VAT (extract 7/107).
  const [vatInclusive, setVatInclusive] = useState(false);

  // ============================================================================
  // Edit mode — load an existing DRAFT order into the form
  // ============================================================================
  // Read the id from window.location rather than useSearchParams so this client
  // page doesn't need a Suspense boundary just to check one query param.
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('edit');
    const id = raw ? Number(raw) : NaN;
    if (!Number.isInteger(id) || id <= 0) return;
    setEditId(id);
    setIsLoadingEdit(true);
    (async () => {
      try {
        const res = await fetch(`/api/sales/orders/${id}/detail`);
        const json = await res.json();
        if (!json.success || !json.data?.salesOrder) {
          notify(t('orders.new.toast.loadError'), 'error', 5000);
          return;
        }
        const so = json.data.salesOrder;
        const loaded = (json.data.lines || []) as Array<{
          itemId: number; itemCode: string; itemName: string;
          itemUnit: string; quantity: number; unitPrice: number;
        }>;
        // A non-draft order cannot be rewritten (stock/GL already moved). Warn
        // and let the server's PUT reject it rather than pretend it's editable.
        if (so.status !== 'draft') {
          notify(t('orders.new.toast.editableDraftOnly'), 'warning', 6000);
        }
        setForm({
          customerName: so.customerName || '',
          customerContact: so.customerContact || '',
          customerAddress: so.customerAddress || '',
          requiredDate: so.requiredDate ? new Date(so.requiredDate) : null,
          // A saved SO holds a canonical term ('Net 30' / 'Cash' / 'COD'...) that
          // the dropdown now offers directly, so keep it. Legacy free-text
          // ("เครดิต 30 วัน") is normalized to canonical so it still shows; only a
          // truly unmappable value blanks — which then blocks save until a real
          // term is picked. This is the round-trip fix: prefill → save → reload
          // all speak the same value, so the field no longer renders blank.
          paymentTerms: toDisplayTerm(so.paymentTerms),
          notes: so.notes || '',
          status: so.status || 'draft',
          shippingCost: so.shippingCost != null ? Number(so.shippingCost) : 0,
          carrier: so.carrier || '',
          trackingNumber: so.trackingNumber || '',
        });
        setVatInclusive(so.vatInclusive === true);
        setLines(
          loaded.map((l, i) => ({
            id: i + 1,
            itemId: l.itemId,
            itemCode: l.itemCode,
            itemName: l.itemName,
            unit: l.itemUnit || 'unit',
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            lineTotal: l.quantity * l.unitPrice,
            notes: '',
          })),
        );
        setLineIdCounter(loaded.length + 1);
        // Pull the full customer so the customer card shows code/type, not blanks.
        if (so.customerId) {
          try {
            const cRes = await fetch(`/api/customers/${so.customerId}`);
            const cJson = await cRes.json();
            if (cJson.success && cJson.data?.customer) {
              setSelectedCustomer(cJson.data.customer as Customer);
            }
          } catch {
            /* card still shows name/address from the form even without this */
          }
        }
      } catch {
        notify(t('orders.new.toast.loadError'), 'error', 5000);
      } finally {
        setIsLoadingEdit(false);
      }
    })();
    // Run once on mount; the id is read straight from the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================================================
  // Computed Values
  // ============================================================================

  const totalAmount = useMemo(() => {
    return lines.reduce((sum, line) => sum + line.lineTotal, 0);
  }, [lines]);

  // VAT on the goods per the pricing mode (inclusive = extract 7/107, exclusive
  // = add 7%). Shown so the SO screen agrees with the printed tax invoice.
  const soVat = useMemo(() => calcLineVat(totalAmount, vatInclusive), [totalAmount, vatInclusive]);
  // What the customer actually pays: goods incl VAT + freight.
  const grandTotal = useMemo(
    () => soVat.total + (form.shippingCost || 0),
    [soVat.total, form.shippingCost],
  );

  const lineCount = lines.length;

  // ============================================================================
  // Customer Handlers
  // ============================================================================

  const handleSelectCustomer = useCallback((customer: Customer) => {
    setSelectedCustomer(customer);
    setForm(prev => ({
      ...prev,
      customerName: customer.name,
      customerContact: customer.contactPerson || '',
      customerAddress: customer.address || '',
      // Customer master stores the canonical term; map it so the dropdown shows
      // it instead of blanking on a value it doesn't recognise.
      paymentTerms: toDisplayTerm(customer.paymentTerms),
    }));
  }, []);

  const handleClearCustomer = useCallback(() => {
    setSelectedCustomer(null);
    setForm(prev => ({
      ...prev,
      customerName: '',
      customerContact: '',
      customerAddress: '',
      paymentTerms: '',
    }));
  }, []);

  // ============================================================================
  // Line Item Handlers
  // ============================================================================

  const handleSelectItem = useCallback((item: Item) => {
    const newLine: SOLine = {
      id: lineIdCounter,
      itemId: item.id,
      itemCode: item.code,
      itemName: item.nameTh || item.nameEn,
      unit: item.primaryUnit || 'unit',
      quantity: 1,
      unitPrice: item.sellingPrice || 0,
      lineTotal: item.sellingPrice || 0,
      notes: '',
    };
    setLines(prev => [...prev, newLine]);
    setLineIdCounter(prev => prev + 1);
  }, [lineIdCounter]);

  const handleDeleteLine = useCallback((lineId: number) => {
    // Delete right away. The old flow opened a confirm card rendered at the TOP
    // of the page — far above the line grid — so on a scrolled-down form the
    // trash click looked dead ("กดถังขยะแล้วลบรายการไม่ได้"). The line isn't
    // saved yet and can be re-added, so one click removes it and a toast confirms.
    setLines(prev => prev.filter(line => line.id !== lineId));
    notify(t('orders.new.toast.deleteSuccess'), 'success', 2000);
  }, [t]);

  const handleLineQuantityChange = useCallback((lineId: number, value: number) => {
    setLines(prev => prev.map(line => {
      if (line.id === lineId) {
        const newQuantity = value || 0;
        return {
          ...line,
          quantity: newQuantity,
          lineTotal: newQuantity * line.unitPrice,
        };
      }
      return line;
    }));
  }, []);

  const handleLineUnitPriceChange = useCallback((lineId: number, value: number) => {
    setLines(prev => prev.map(line => {
      if (line.id === lineId) {
        const newUnitPrice = value || 0;
        return {
          ...line,
          unitPrice: newUnitPrice,
          lineTotal: line.quantity * newUnitPrice,
        };
      }
      return line;
    }));
  }, []);

  // ============================================================================
  // Form Handlers
  // ============================================================================

  const handleSave = async () => {
    // Validation
    if (!selectedCustomer && !form.customerName) {
      notify(t('orders.new.validation.selectCustomer'), 'warning', 3000);
      return;
    }
    if (lines.length === 0) {
      notify(t('orders.new.validation.addItem'), 'warning', 3000);
      return;
    }
    if (!form.requiredDate) {
      notify(t('orders.new.validation.selectRequiredDate'), 'warning', 3000);
      return;
    }
    if (!form.paymentTerms) {
      notify(t('orders.new.validation.selectPaymentTerms'), 'warning', 3000);
      return;
    }

    setIsSaving(true);
    try {
      // Same payload either way; only the verb and target differ. PUT rewrites
      // the existing draft; POST creates a new order.
      const res = await fetch(
        editId ? `/api/sales/orders/${editId}` : '/api/sales/orders',
        {
          method: editId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            // Send the master-data link, not just the name. Without it the AR
            // invoice cannot identify the buyer and its tax invoice ends up with
            // no ผู้ซื้อ / เลขประจำตัวผู้เสียภาษี.
            customerId: selectedCustomer?.id,
            customerName: form.customerName,
            customerContact: form.customerContact,
            customerAddress: form.customerAddress,
            requiredDate: formatDateForApi(form.requiredDate),
            paymentTerms: form.paymentTerms,
            notes: form.notes,
            status: form.status,
            shippingCost: form.shippingCost,
            carrier: form.carrier,
            trackingNumber: form.trackingNumber,
            vatInclusive,
            lines: lines.map(line => ({
              itemId: line.itemId,
              quantity: line.quantity,
              unit: line.unit,
              unitPrice: line.unitPrice,
              notes: line.notes,
            })),
          }),
        },
      );

      const result = await res.json();

      if (result.success) {
        notify(
          t(editId ? 'orders.new.toast.updateSuccess' : 'orders.new.toast.createSuccess'),
          'success',
          3000,
        );
        router.push(`/sales/orders/${editId ?? result.data.id}`);
      } else {
        notify(
          result.error || t(editId ? 'orders.new.toast.updateError' : 'orders.new.toast.createError'),
          'error',
          5000,
        );
      }
    } catch (error) {
      console.error('Failed to save sales order:', error);
      notify(t(editId ? 'orders.new.toast.updateError' : 'orders.new.toast.createError'), 'error', 5000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  // ============================================================================
  // DataGrid Cell Renderers
  // ============================================================================

  const renderItemCell = useCallback((cellInfo: { data: SOLine }) => (
    <div className="flex items-center gap-3 py-1">
      <div className="h-9 w-9 bg-indigo-100 rounded-lg flex items-center justify-center">
        <Package className="h-4 w-4 text-indigo-600" />
      </div>
      <div className="min-w-0">
        <p className="font-mono font-semibold text-indigo-600 text-sm">{cellInfo.data.itemCode}</p>
        <p className="text-sm text-gray-600 truncate">{cellInfo.data.itemName}</p>
      </div>
    </div>
  ), []);

  // Commit on blur/change, NOT on every keystroke. Writing to `lines` state on
  // each input re-renders the whole grid and re-seeds this controlled NumberBox
  // mid-type, which on Chrome swallowed the keystroke and snapped the value back
  // to its old number — the tester couldn't type a quantity/price at all.
  // `valueChangeEvent="change"` (blur/Enter) lets the browser own the text while
  // typing and reconciles once the user leaves the field. `min={0}` (not 0.01)
  // so a partially-typed / cleared value isn't force-clamped while editing.
  const renderQuantityCell = useCallback((cellInfo: { data: SOLine }) => (
    <NumberBox
      defaultValue={cellInfo.data.quantity}
      onValueChanged={(e) => handleLineQuantityChange(cellInfo.data.id, e.value || 0)}
      valueChangeEvent="change blur"
      min={0}
      step={1}
      format="#,##0.####"
      width="100%"
      stylingMode="outlined"
      inputAttr={{ 'data-testid': `so-quantity-${cellInfo.data.id}` }}
    />
  ), [handleLineQuantityChange]);

  // Unit price is editable on EVERY line. When the picked item carries no
  // selling price (unitPrice === 0) the finished product needs a price keyed in
  // here, so we highlight the empty field and show a hint to make that obvious.
  const priceHint = t('orders.new.enterPriceHint');
  const renderUnitPriceCell = useCallback((cellInfo: { data: SOLine }) => {
    const needsPrice = !cellInfo.data.unitPrice || cellInfo.data.unitPrice <= 0;
    return (
      <div className="w-full">
        <NumberBox
          defaultValue={cellInfo.data.unitPrice}
          onValueChanged={(e) => handleLineUnitPriceChange(cellInfo.data.id, e.value || 0)}
          valueChangeEvent="change blur"
          min={0}
          step={0.01}
          format="#,##0.00"
          width="100%"
          stylingMode="outlined"
          placeholder={priceHint}
          elementAttr={needsPrice ? { class: 'so-price-missing' } : undefined}
          inputAttr={{ 'data-testid': `so-unit-price-${cellInfo.data.id}` }}
        />
        {needsPrice && (
          <p className="mt-1 text-[11px] text-amber-600 leading-tight" data-testid={`so-price-hint-${cellInfo.data.id}`}>
            {priceHint}
          </p>
        )}
      </div>
    );
  }, [handleLineUnitPriceChange, priceHint]);

  const renderLineTotalCell = useCallback((cellInfo: { data: SOLine }) => (
    <span className="font-semibold text-green-600">
      {formatCurrency(cellInfo.data.lineTotal)}
    </span>
  ), []);

  const deleteButtonTitle = t('orders.new.deleteConfirm.delete');
  const renderActionsCell = useCallback((cellInfo: { data: SOLine }) => (
    <button
      type="button"
      onClick={() => handleDeleteLine(cellInfo.data.id)}
      className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
      title={deleteButtonTitle}
    >
      <Trash2 className="h-4 w-4" />
    </button>
  ), [handleDeleteLine, deleteButtonTitle]);

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <MainLayout>
      <div className="space-y-6 p-1">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              text={t('orders.new.actions.back')}
              icon="back"
              stylingMode="text"
              onClick={handleCancel}
              elementAttr={{ 'data-testid': 'so-back-btn' }}
            />
            <div className="h-6 w-px bg-gray-200" />
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                <ShoppingCart className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900" data-testid="so-form-title">{editId ? t('orders.actions.editOrder') : t('orders.new.title')}</h1>
                <p className="text-sm text-gray-500">{isLoadingEdit ? t('orders.new.loadingEdit') : t('orders.new.description')}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              text={t('orders.new.actions.cancel')}
              icon="close"
              stylingMode="outlined"
              onClick={handleCancel}
              disabled={isSaving}
              elementAttr={{ 'data-testid': 'so-cancel-btn' }}
            />
            <Button
              text={isSaving ? t('orders.new.actions.saving') : t('orders.new.actions.save')}
              icon={isSaving ? 'spindown' : 'save'}
              type="success"
              onClick={handleSave}
              disabled={isSaving}
              elementAttr={{ 'data-testid': 'so-save-btn' }}
            />
          </div>
        </div>

        {/* Delete Line Confirmation */}
        {/* Main Content - 2 Column + Sidebar Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Customer Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="h-5 w-5 text-purple-500" />
                  {t('orders.new.customerSection')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Customer Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('orders.new.customerRequired')} <span className="text-red-500">*</span>
                  </label>
                  {selectedCustomer ? (
                    <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-emerald-700 text-lg">{selectedCustomer.code}</span>
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full">
                              {selectedCustomer.customerType?.replace('_', ' ')}
                            </span>
                          </div>
                          <p className="font-semibold text-gray-900 text-lg">{selectedCustomer.name}</p>
                          <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-600">
                            {selectedCustomer.contactPerson && (
                              <span className="flex items-center gap-1">
                                <Building2 className="h-3.5 w-3.5" />
                                {selectedCustomer.contactPerson}
                              </span>
                            )}
                            {selectedCustomer.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3.5 w-3.5" />
                                {selectedCustomer.phone}
                              </span>
                            )}
                            {selectedCustomer.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="h-3.5 w-3.5" />
                                {selectedCustomer.email}
                              </span>
                            )}
                          </div>
                          {selectedCustomer.address && (
                            <p className="mt-2 text-sm text-gray-500 flex items-start gap-1">
                              <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                              <span>{selectedCustomer.address}</span>
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            text={t('orders.new.actions.change')}
                            type="normal"
                            stylingMode="outlined"
                            onClick={() => setIsCustomerDialogOpen(true)}
                          />
                          <Button
                            icon="close"
                            type="danger"
                            stylingMode="text"
                            onClick={handleClearCustomer}
                            hint={t('orders.new.actions.clear')}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsCustomerDialogOpen(true)}
                      data-testid="so-select-customer-btn"
                      className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-emerald-400 hover:bg-emerald-50 transition-colors text-gray-500 hover:text-emerald-600"
                    >
                      <Search className="h-5 w-5" />
                      <span>{t('orders.new.selectCustomerPlaceholder')}</span>
                    </button>
                  )}
                </div>

                {/* Shipping Address */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <MapPin className="h-4 w-4 inline mr-1" />
                    {t('orders.new.shippingAddress')}
                  </label>
                  <TextArea
                    value={form.customerAddress}
                    onValueChanged={(e) => setForm(prev => ({ ...prev, customerAddress: e.value || '' }))}
                    placeholder={t('orders.new.shippingAddressPlaceholder')}
                    height={80}
                    elementAttr={{ 'data-testid': 'so-address-input' }}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Order Lines */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Package className="h-5 w-5 text-indigo-500" />
                    {t('orders.new.itemsSection')}
                    {lineCount > 0 && (
                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full">
                        {lineCount} {t('orders.new.items')}
                      </span>
                    )}
                  </CardTitle>
                  <Button
                    text={t('orders.new.addItem')}
                    icon="plus"
                    type="default"
                    onClick={() => setIsItemDialogOpen(true)}
                    elementAttr={{ 'data-testid': 'so-add-item-btn' }}
                  />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {lines.length > 0 ? (
                  <>
                    <DataGrid
                      dataSource={lines}
                      keyExpr="id"
                      showBorders={false}
                      showRowLines
                      rowAlternationEnabled
                      columnAutoWidth
                      className="min-h-[200px]"
                      elementAttr={{ 'data-testid': 'so-lines-grid' }}
                    >
                      <Paging enabled={false} />
                      {/* No <Editing>: the quantity/price cells render their own
                          NumberBox and write straight to `lines` state. Declaring
                          Editing mode="cell" allowUpdating={false} put the grid's
                          own (disabled) cell editor in front of those inputs, so
                          typing was swallowed and the value snapped back to 1. */}

                      <Column
                        dataField="itemCode"
                        caption={t('orders.new.columns.item')}
                        minWidth={220}
                        cellRender={renderItemCell}
                        allowSorting={false}
                      />
                      <Column
                        dataField="unit"
                        caption={t('orders.new.columns.unit')}
                        width={80}
                        alignment="center"
                      />
                      <Column
                        dataField="quantity"
                        caption={t('orders.new.columns.quantity')}
                        width={120}
                        alignment="center"
                        cellRender={renderQuantityCell}
                        allowSorting={false}
                      />
                      <Column
                        dataField="unitPrice"
                        caption={t('orders.new.columns.unitPrice')}
                        width={140}
                        alignment="center"
                        cellRender={renderUnitPriceCell}
                        allowSorting={false}
                      />
                      <Column
                        dataField="lineTotal"
                        caption={t('orders.new.columns.total')}
                        width={130}
                        cellRender={renderLineTotalCell}
                        alignment="right"
                      />
                      <Column
                        caption=""
                        width={50}
                        cellRender={renderActionsCell}
                        allowSorting={false}
                        alignment="center"
                      />

                      <Summary>
                        <TotalItem
                          column="lineTotal"
                          summaryType="sum"
                          customizeText={(data) => `${t('orders.new.columns.total')}: ${formatCurrency(data.value as number)}`}
                        />
                      </Summary>
                    </DataGrid>

                    {/* Total Summary — goods and freight stay on separate
                        lines: they post to different GL accounts, and the
                        customer asks about them separately too. */}
                    <div className="p-4 border-t bg-gray-50">
                      <div className="flex justify-end">
                        <div className="w-full max-w-xs space-y-1">
                          {/* Pricing basis — is the entered price before or incl VAT? */}
                          <div className="flex justify-between items-center text-sm mb-1">
                            <span className="text-gray-500">{t('orders.new.priceBasis')}</span>
                            <div className="inline-flex rounded-md overflow-hidden border border-gray-300 bg-white" data-testid="so-vat-basis-toggle">
                              <button type="button" onClick={() => setVatInclusive(false)}
                                className={`px-2 py-0.5 text-[11px] ${!vatInclusive ? 'bg-green-600 text-white' : 'text-gray-600'}`}
                                data-testid="so-vat-basis-exclusive">{t('orders.new.priceExclusive')}</button>
                              <button type="button" onClick={() => setVatInclusive(true)}
                                className={`px-2 py-0.5 text-[11px] border-l border-gray-300 ${vatInclusive ? 'bg-green-600 text-white' : 'text-gray-600'}`}
                                data-testid="so-vat-basis-inclusive">{t('orders.new.priceInclusive')}</button>
                            </div>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">{t('orders.new.beforeVat')}</span>
                            <span className="font-medium text-gray-900" data-testid="so-before-vat">
                              {formatCurrency(soVat.base)}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">VAT 7%</span>
                            <span className="font-medium text-gray-900" data-testid="so-vat">
                              {formatCurrency(soVat.vat)}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">{t('orders.new.shippingCost')}</span>
                            <span className="font-medium text-gray-900" data-testid="so-shipping-amount">
                              {formatCurrency(form.shippingCost)}
                            </span>
                          </div>
                          <div className="flex justify-between pt-2 border-t">
                            <span className="text-sm text-gray-500">{t('orders.new.grandTotal')}</span>
                            <span className="text-2xl font-bold text-green-600" data-testid="so-grand-total">
                              {formatCurrency(grandTotal)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12 px-4">
                    <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Package className="h-8 w-8 text-gray-400" />
                    </div>
                    <p className="text-gray-500 font-medium">{t('orders.new.noItems')}</p>
                    <p className="text-sm text-gray-400 mt-1">{t('orders.new.noItemsDesc')}</p>
                    <Button
                      text={t('orders.new.addFirstItem')}
                      icon="plus"
                      type="default"
                      stylingMode="outlined"
                      onClick={() => setIsItemDialogOpen(true)}
                      className="mt-4"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Shipping — freight is agreed with the order; the tracking
                number usually is not known until the goods leave, so it can be
                left blank here and filled in from the order page later. */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Truck className="h-5 w-5 text-gray-500" />
                  {t('orders.new.shippingSection')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('orders.new.shippingCost')}
                    </label>
                    <NumberBox
                      value={form.shippingCost}
                      onValueChanged={(e) => setForm(prev => ({ ...prev, shippingCost: e.value ?? 0 }))}
                      min={0}
                      format="#,##0.00"
                      showClearButton
                      data-testid="so-shipping-cost-input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('orders.new.carrier')}
                    </label>
                    <TextBox
                      value={form.carrier}
                      onValueChanged={(e) => setForm(prev => ({ ...prev, carrier: e.value || '' }))}
                      placeholder={t('orders.new.carrierPlaceholder')}
                      data-testid="so-carrier-input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('orders.new.trackingNumber')}
                    </label>
                    <TextBox
                      value={form.trackingNumber}
                      onValueChanged={(e) => setForm(prev => ({ ...prev, trackingNumber: e.value || '' }))}
                      placeholder={t('orders.new.trackingNumberPlaceholder')}
                      data-testid="so-tracking-input"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-5 w-5 text-gray-500" />
                  {t('orders.new.notesSection')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TextArea
                  value={form.notes}
                  onValueChanged={(e) => setForm(prev => ({ ...prev, notes: e.value || '' }))}
                  placeholder={t('orders.new.notesPlaceholder')}
                  height={100}
                />
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Order Status */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('orders.new.statusSection')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('orders.new.status')}</label>
                  <SelectBox
                    dataSource={statusOptions}
                    displayExpr="label"
                    valueExpr="value"
                    value={form.status}
                    onValueChanged={(e) => setForm(prev => ({ ...prev, status: e.value }))}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Order Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calendar className="h-5 w-5 text-blue-500" />
                  {t('orders.new.orderDetails')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('orders.new.requiredDate')} <span className="text-red-500">*</span>
                  </label>
                  <DateBox
                    value={form.requiredDate}
                    onValueChanged={(e) => setForm(prev => ({ ...prev, requiredDate: e.value }))}
                    type="date"
                    displayFormat="d MMMM yyyy"
                    placeholder={t('orders.new.selectDate')}
                    showClearButton
                    useMaskBehavior
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <CreditCard className="h-4 w-4 inline mr-1" />
                    {t('orders.new.paymentTerms')} <span className="text-red-500">*</span>
                  </label>
                  <SelectBox
                    dataSource={paymentTermsOptions}
                    displayExpr="label"
                    valueExpr="value"
                    value={form.paymentTerms}
                    onValueChanged={(e) => setForm(prev => ({ ...prev, paymentTerms: e.value }))}
                    placeholder={t('orders.new.selectPaymentTerms')}
                    showClearButton
                    searchEnabled
                  />
                </div>
              </CardContent>
            </Card>

            {/* Order Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('orders.new.orderSummary')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('orders.new.lineCount')}</span>
                  <span className="font-medium text-gray-900">{lineCount} {t('orders.new.items')}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-gray-500 shrink-0">{t('orders.new.customer')}</span>
                  <span className="font-medium text-gray-900 text-right break-words" title={form.customerName || undefined}>
                    {form.customerName || '-'}
                  </span>
                </div>
                {/* Goods and freight itemised so the net total below can be
                    trusted to include shipping — the same breakdown shown in the
                    lines card, kept in sync so nothing "disappears" on confirm. */}
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('orders.new.goodsAmount')}</span>
                  <span className="font-medium text-gray-900">{formatCurrency(totalAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('orders.new.shippingCost')}</span>
                  <span className="font-medium text-gray-900">{formatCurrency(form.shippingCost || 0)}</span>
                </div>
                <div className="pt-3 border-t">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700 font-medium">{t('orders.new.grandTotal')}</span>
                    <span className="text-xl font-bold text-green-600" data-testid="so-summary-grand-total">{formatCurrency(grandTotal)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Customer Search Dialog */}
      <CustomerSearchDialog
        open={isCustomerDialogOpen}
        onOpenChange={setIsCustomerDialogOpen}
        onSelect={handleSelectCustomer}
        title={t('orders.new.dialog.searchCustomer')}
        allowCreate
      />

      {/* Item Search Dialog */}
      <ItemSearchDialog
        open={isItemDialogOpen}
        onOpenChange={setIsItemDialogOpen}
        onSelect={handleSelectItem}
        title={t('orders.new.dialog.searchItem')}
        showPrice="selling"
        excludeIds={lines.map(line => line.itemId)}
      />
    </MainLayout>
  );
}
