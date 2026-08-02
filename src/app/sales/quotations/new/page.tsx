'use client';

/**
 * Create Quotation (สร้างใบเสนอราคา).
 *
 * The first document in the sales flow: a priced offer to a customer. Lines can
 * come from the inventory item picker (which carries the selling price across)
 * or be typed free-hand for services / one-off items. Every amount is shown via
 * formatNumber so thousands separators are always present.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { MainLayout } from '@/components/layout/main-layout';
import { calcLineVat } from '@/lib/utils/vat';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from 'devextreme-react/button';
import TextArea from 'devextreme-react/text-area';
import TextBox from 'devextreme-react/text-box';
import DateBox from 'devextreme-react/date-box';
import NumberBox from 'devextreme-react/number-box';
import SelectBox from 'devextreme-react/select-box';
import DataGrid, { Column, Paging, Scrolling } from 'devextreme-react/data-grid';
import { ItemSearchDialog, type Item } from '@/components/ui/item-search-dialog';
import { CustomerSearchDialog, type Customer } from '@/components/ui/customer-search-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatNumber } from '@/lib/utils/number-format';
import {
  FileText,
  Building2,
  Package,
  Trash2,
  Calendar,
  CreditCard,
  Search,
  Phone,
  Mail,
  MapPin,
} from 'lucide-react';
import type { QuotationLineInput } from '@/types/quotation';

// A quotation line as held in the form. `key` is the local grid key; the API
// only receives the QuotationLineInput fields.
interface QuotationFormLine extends QuotationLineInput {
  key: number;
}

interface FormData {
  // customerId is set when an existing customer is picked from the search
  // dialog; null for a free-text-only quotation. The quotation API accepts it.
  customerId: number | null;
  customerName: string;
  customerContact: string;
  customerAddress: string;
  quotationDate: string;
  validUntil: string;
  paymentTerms: string;
  notes: string;
}

const formatDateForApi = (value: unknown): string | null => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  if (isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Fixed payment-term choices (pick from list only — no free text). The stored
// value is the readable Thai label because the quotation detail page renders
// paymentTerms verbatim; mirrors the sales-order paymentOptions.
const PAYMENT_TERMS_OPTIONS = [
  'quotationNew.terms.cash',
  'quotationNew.terms.cod',
  'quotationNew.terms.net7',
  'quotationNew.terms.net15',
  'quotationNew.terms.net30',
  'quotationNew.terms.net45',
  'quotationNew.terms.net60',
  'quotationNew.terms.net90',
] as const;

// The Thai label is the CANONICAL STORED value: the quotation detail page prints
// paymentTerms verbatim and existing rows already contain these exact strings,
// so switching the stored value to a key would break every saved quotation.
// Only the dropdown DISPLAY is translated.
const TH_PAYMENT_TERM_VALUES: Record<(typeof PAYMENT_TERMS_OPTIONS)[number], string> = {
  'quotationNew.terms.cash': 'เงินสด (Cash)',
  'quotationNew.terms.cod': 'ชำระเมื่อส่งมอบ (COD)',
  'quotationNew.terms.net7': 'ชำระภายใน 7 วัน',
  'quotationNew.terms.net15': 'ชำระภายใน 15 วัน',
  'quotationNew.terms.net30': 'ชำระภายใน 30 วัน',
  'quotationNew.terms.net45': 'ชำระภายใน 45 วัน',
  'quotationNew.terms.net60': 'ชำระภายใน 60 วัน',
  'quotationNew.terms.net90': 'ชำระภายใน 90 วัน',
};
const thPaymentTerms = (k: (typeof PAYMENT_TERMS_OPTIONS)[number]) => TH_PAYMENT_TERM_VALUES[k];

export default function NewQuotationPage() {
  const router = useRouter();
  const toast = useToast();
  const t = useTranslations('sales');
  const tCommon = useTranslations('common');
  // The STORED value stays the Thai label, because the quotation detail page
  // renders paymentTerms verbatim and existing rows already hold Thai text.
  // Only the displayed text follows the language.
  const paymentTermOptions = useMemo(
    () =>
      PAYMENT_TERMS_OPTIONS.map((key) => ({
        value: thPaymentTerms(key),
        label: t(key),
      })),
    [t],
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [keyCounter, setKeyCounter] = useState(1);
  // Edit mode: /sales/quotations/new?edit=<id> loads that DRAFT quotation and
  // saving PUTs to it instead of creating a new one.
  const [editId, setEditId] = useState<number | null>(null);
  const [isLoadingEdit, setIsLoadingEdit] = useState(false);

  const [form, setForm] = useState<FormData>({
    customerId: null,
    customerName: '',
    customerContact: '',
    customerAddress: '',
    quotationDate: '',
    validUntil: '',
    paymentTerms: '',
    notes: '',
  });

  const [lines, setLines] = useState<QuotationFormLine[]>([]);
  const [vatInclusive, setVatInclusive] = useState(false);

  // Edit mode — load an existing DRAFT quotation into this form. Read the id
  // from window.location so the client page needs no Suspense boundary.
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('edit');
    const id = raw ? Number(raw) : NaN;
    if (!Number.isInteger(id) || id <= 0) return;
    setEditId(id);
    setIsLoadingEdit(true);
    (async () => {
      try {
        const res = await fetch(`/api/sales/quotations/${id}`);
        const json = await res.json();
        if (!json.success || !json.data) {
          toast.error(t(`quotationNew.loadError`));
          return;
        }
        const q = json.data;
        if (q.status !== 'draft') {
          toast.error(t(`quotationNew.editDraftOnly`));
        }
        setForm({
          customerId: q.customerId ?? null,
          customerName: q.customerName || '',
          customerContact: q.customerContact || '',
          customerAddress: q.customerAddress || '',
          quotationDate: (q.quotationDate || '').slice(0, 10),
          validUntil: (q.validUntil || '').slice(0, 10),
          paymentTerms: q.paymentTerms || '',
          notes: q.notes || '',
        });
        const loaded = (q.lines || []) as Array<{
          itemId?: number | null; itemCode?: string | null; description: string;
          quantity: number; unit: string; unitPrice: number; notes?: string | null;
        }>;
        setLines(
          loaded.map((l, i) => ({
            key: i + 1,
            itemId: l.itemId ?? undefined,
            itemCode: l.itemCode ?? undefined,
            description: l.description,
            quantity: l.quantity,
            unit: l.unit,
            unitPrice: l.unitPrice,
            notes: l.notes ?? undefined,
          })),
        );
        setKeyCounter(loaded.length + 1);
        // Pull the full customer so its card shows code/type, not blanks.
        if (q.customerId) {
          try {
            const cRes = await fetch(`/api/customers/${q.customerId}`);
            const cJson = await cRes.json();
            if (cJson.success && cJson.data?.customer) {
              setSelectedCustomer(cJson.data.customer as Customer);
            }
          } catch {
            /* card still shows name/address from the form */
          }
        }
      } catch {
        toast.error(t(`quotationNew.loadError`));
      } finally {
        setIsLoadingEdit(false);
      }
    })();
    // Run once on mount; the id comes straight from the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalAmount = useMemo(
    () => lines.reduce((s, l) => s + (l.quantity || 0) * (l.unitPrice || 0), 0),
    [lines],
  );
  // VAT on the goods per the pricing mode (inclusive = extract 7/107).
  const qtVat = useMemo(() => calcLineVat(totalAmount, vatInclusive), [totalAmount, vatInclusive]);

  // Grid data carries a computed amount column so the DataGrid can render it
  // without an in-grid formula (amount is display-only, never edited).
  const gridData = useMemo(
    () => lines.map((l) => ({ ...l, amount: (l.quantity || 0) * (l.unitPrice || 0) })),
    [lines],
  );

  // Pick an existing customer (mirrors the sales-order form). Fills the
  // name/contact/address/paymentTerms fields and stores customerId so the
  // quotation is linked to the customer record — while leaving the fields
  // editable and keeping free-text entry as a fallback.
  const handleSelectCustomer = useCallback((customer: Customer) => {
    setSelectedCustomer(customer);
    setForm((p) => ({
      ...p,
      customerId: customer.id,
      customerName: customer.name,
      customerContact: customer.contactPerson || customer.phone || '',
      customerAddress: customer.address || '',
      paymentTerms: customer.paymentTerms || p.paymentTerms,
    }));
  }, []);

  const handleClearCustomer = useCallback(() => {
    setSelectedCustomer(null);
    setForm((p) => ({
      ...p,
      customerId: null,
      customerName: '',
      customerContact: '',
      customerAddress: '',
    }));
  }, []);

  const handleSelectItem = useCallback((item: Item) => {
    setLines((prev) => [
      ...prev,
      {
        key: keyCounter,
        itemId: item.id,
        itemCode: item.code,
        description: item.nameTh || item.nameEn || item.code,
        quantity: 1,
        unit: item.primaryUnit || t(`quotationNew.unit`),
        unitPrice: item.sellingPrice || 0,
        notes: '',
      },
    ]);
    setKeyCounter((n) => n + 1);
  }, [keyCounter, t]);

  const handleAddBlankLine = useCallback(() => {
    setLines((prev) => [
      ...prev,
      {
        key: keyCounter,
        description: '',
        quantity: 1,
      unit: t(`quotationNew.unit`),
        unitPrice: 0,
        notes: '',
      },
    ]);
    setKeyCounter((n) => n + 1);
  }, [keyCounter, t]);

  const updateLine = useCallback((key: number, patch: Partial<QuotationFormLine>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }, []);

  const removeLine = useCallback((key: number) => {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }, []);

  const handleSave = async () => {
    if (!form.customerName.trim()) {
      toast.error(t(`quotationNew.errNoCustomer`));
      return;
    }
    if (lines.length === 0) {
      toast.error(t(`quotationNew.errNoLines`));
      return;
    }
    if (lines.some((l) => !l.description.trim())) {
      toast.error(t(`quotationNew.errIncomplete`));
      return;
    }

    setIsSaving(true);
    try {
      // Same payload either way; PUT rewrites the draft, POST creates a new one.
      const res = await fetch(
        editId ? `/api/sales/quotations/${editId}` : '/api/sales/quotations',
        {
          method: editId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerId: form.customerId ?? undefined,
            customerName: form.customerName.trim(),
            customerContact: form.customerContact || null,
            customerAddress: form.customerAddress || null,
            quotationDate: form.quotationDate || null,
            validUntil: form.validUntil || null,
            paymentTerms: form.paymentTerms || null,
            notes: form.notes || null,
            vatInclusive,
            lines: lines.map((l) => ({
              itemId: l.itemId,
              itemCode: l.itemCode,
              description: l.description.trim(),
              quantity: l.quantity,
              unit: l.unit,
              unitPrice: l.unitPrice,
              notes: l.notes || undefined,
            })),
          }),
        },
      );
      const json = await res.json();
      if (json.success) {
        toast.success(
          t(editId ? `quotationNew.updateOk` : `quotationNew.createOk`),
          json.data?.quotationNumber,
        );
        router.push(`/sales/quotations/${editId ?? json.data.id}`);
      } else {
        toast.error(json.error || t(editId ? `quotationNew.updateFail` : `quotationNew.createFail`));
      }
    } catch (e) {
      console.error('Failed to create quotation:', e);
      toast.error(t(`quotationNew.createFail`));
    } finally {
      setIsSaving(false);
    }
  };

  // ---- Cell renderers -------------------------------------------------------

  // Item code sits INLINE to the left of the description input (not stacked
  // above it) so this cell keeps the same height as จำนวน/หน่วย/ราคา and every
  // input in the row shares one baseline (list item 1).
  const renderDescriptionCell = useCallback((cell: { data: QuotationFormLine }) => (
    <div className="flex items-center gap-2 py-1">
      {cell.data.itemCode && (
        <span className="font-mono text-xs text-emerald-600 whitespace-nowrap flex-shrink-0">
          {cell.data.itemCode}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <TextBox
          // defaultValue + commit-on-blur (not controlled value): writing to
          // state on every keystroke remounts this cell and steals focus, so
          // typing was lost — same fix as จำนวน/ราคา (list item 3).
          defaultValue={cell.data.description}
          onValueChanged={(e) => updateLine(cell.data.key, { description: e.value || '' })}
          valueChangeEvent="change blur"
                        placeholder={t(`quotationNew.detailPlaceholder`)}
          stylingMode="outlined"
        />
      </div>
    </div>
  ), [updateLine, t]);

  const renderQuantityCell = useCallback((cell: { data: QuotationFormLine }) => (
    <NumberBox
      // Commit on change/blur ONLY — never on keyup. With defaultValue the box is
      // uncontrolled, so every commit re-renders the grid cell and remounts it;
      // firing on keyup therefore stole focus after each character ("1" became
      // "10" only if you re-clicked). change+blur lets the browser own the text
      // until the field is left or Enter is pressed (list item 17).
      defaultValue={cell.data.quantity}
      onValueChanged={(e) => updateLine(cell.data.key, { quantity: e.value || 0 })}
      valueChangeEvent="change blur"
      min={0}
      format="#,##0.####"
      width="100%"
      stylingMode="outlined"
      inputAttr={{ 'data-testid': `qt-qty-${cell.data.key}` }}
    />
  ), [updateLine]);

  const renderUnitCell = useCallback((cell: { data: QuotationFormLine }) => (
    <TextBox
      defaultValue={cell.data.unit}
      onValueChanged={(e) => updateLine(cell.data.key, { unit: e.value || '' })}
      valueChangeEvent="change blur"
      stylingMode="outlined"
    />
  ), [updateLine]);

  const renderUnitPriceCell = useCallback((cell: { data: QuotationFormLine }) => (
    <NumberBox
      // Same as quantity: commit on change/blur only, never keyup (list item 17).
      defaultValue={cell.data.unitPrice}
      onValueChanged={(e) => updateLine(cell.data.key, { unitPrice: e.value || 0 })}
      valueChangeEvent="change blur"
      min={0}
      format="#,##0.00"
      width="100%"
      stylingMode="outlined"
      inputAttr={{ 'data-testid': `qt-price-${cell.data.key}` }}
    />
  ), [updateLine]);

  const renderAmountCell = useCallback((cell: { data: { amount: number } }) => (
    <span className="font-semibold text-green-600 tabular-nums">
      {formatNumber(cell.data.amount)}
    </span>
  ), []);

  // Notes are now typeable: the controlled `value` remounted the box on every
  // keystroke (each keystroke → updateLine → gridData re-derived → cell
  // re-rendered) which swallowed input. defaultValue + commit-on-blur fixes it
  // (list item 3).
  const renderNotesCell = useCallback((cell: { data: QuotationFormLine }) => (
    <TextBox
      defaultValue={cell.data.notes || ''}
      onValueChanged={(e) => updateLine(cell.data.key, { notes: e.value || '' })}
      valueChangeEvent="change blur"
                        placeholder={t(`quotationNew.notePlaceholder`)}
      stylingMode="outlined"
    />
  ), [updateLine, t]);

  const renderActionsCell = useCallback((cell: { data: QuotationFormLine }) => (
    <button
      type="button"
      onClick={() => removeLine(cell.data.key)}
      className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                    title={t(`quotationNew.deleteLine`)}
      data-testid={`btn-remove-line-${cell.data.key}`}
    >
      <Trash2 className="h-4 w-4" />
    </button>
  ), [removeLine, t]);

  return (
    <MainLayout>
      <div className="space-y-6 p-1">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button
            text={t(`quotationNew.back`)}
              icon="back"
              stylingMode="text"
              onClick={() => router.back()}
              elementAttr={{ 'data-testid': 'qt-back-btn' }}
            />
            <div className="h-6 w-px bg-gray-200" />
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900" data-testid="qt-form-title" data-build="qt-form-fix-20260727">
                {editId ? t(`quotationNew.editTitle`) : t(`quotationNew.title`)}
                </h1>
                <p className="text-sm text-gray-500">{isLoadingEdit ? t(`quotationNew.loadingEdit`) : t(`quotationNew.subtitle`)}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              text={tCommon(`actions.cancel`)}
              icon="close"
              stylingMode="outlined"
              onClick={() => router.back()}
              disabled={isSaving}
              elementAttr={{ 'data-testid': 'qt-cancel-btn' }}
            />
            <Button
              text={isSaving ? tCommon(`actions.saving`) : tCommon(`actions.save`)}
              icon="save"
              type="success"
              onClick={handleSave}
              disabled={isSaving}
              elementAttr={{ 'data-testid': 'qt-save-btn' }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column — customer + lines */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="h-5 w-5 text-purple-500" />
                  {t(`quotationNew.customerInfo`)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Pick an existing customer (like the sales-order form) — fills
                    the fields below and links customerId. Free-text entry stays
                    available as a fallback for one-off / not-yet-registered
                    customers. */}
                {selectedCustomer ? (
                  <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
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
                      <div className="flex gap-2 flex-shrink-0">
                        <Button
                        text={t(`quotationNew.change`)}
                          type="normal"
                          stylingMode="outlined"
                          onClick={() => setIsCustomerDialogOpen(true)}
                          elementAttr={{ 'data-testid': 'qt-change-customer-btn' }}
                        />
                        <Button
                          icon="close"
                          type="danger"
                          stylingMode="text"
                          onClick={handleClearCustomer}
                        hint={t(`quotationNew.clearCustomer`)}
                          elementAttr={{ 'data-testid': 'qt-clear-customer-btn' }}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsCustomerDialogOpen(true)}
                    data-testid="qt-select-customer-btn"
                    className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-300 rounded-xl hover:border-emerald-400 hover:bg-emerald-50 transition-colors text-gray-500 hover:text-emerald-600"
                  >
                    <Search className="h-5 w-5" />
                      <span>{t(`quotationNew.pickFromList`)}</span>
                  </button>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t(`quotationNew.customerName`)} <span className="text-red-500">*</span>
                  </label>
                  <TextBox
                    value={form.customerName}
                    onValueChanged={(e) => setForm((p) => ({ ...p, customerName: e.value || '' }))}
                      placeholder={t(`quotationNew.customerNamePlaceholder`)}
                    elementAttr={{ 'data-testid': 'qt-customer-name-input' }}
                  />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t(`quotationNew.contact`)}</label>
                  <TextBox
                    value={form.customerContact}
                    onValueChanged={(e) => setForm((p) => ({ ...p, customerContact: e.value || '' }))}
                      placeholder={t(`quotationNew.contactPlaceholder`)}
                    elementAttr={{ 'data-testid': 'qt-customer-contact-input' }}
                  />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t(`quotationNew.address`)}</label>
                  <TextArea
                    value={form.customerAddress}
                    onValueChanged={(e) => setForm((p) => ({ ...p, customerAddress: e.value || '' }))}
                      placeholder={t(`quotationNew.addressPlaceholder`)}
                    height={70}
                    elementAttr={{ 'data-testid': 'qt-customer-address-input' }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              {/* py-3 (not the default p-6 pb-0): the tall header padding pushed
                  the "เลือกจากคลัง" button far above the grid so it looked
                  detached. A tighter header sits the button just above the rows. */}
              <CardHeader className="py-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Package className="h-5 w-5 text-indigo-500" />
                  {t(`quotationNew.lines`)}
                    {lines.length > 0 && (
                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full">
                    {t(`quotationNew.lineCount`, { count: lines.length })}
                      </span>
                    )}
                  </CardTitle>
                  {/* Header keeps only "เลือกจากคลัง" — the free-line button
                      was removed because every line still has to be searched
                      from the item catalogue anyway (list item 5). The blank
                      line stays available from the empty state below. */}
                  <Button
                    text={t(`quotationNew.pickFromStock`)}
                    icon="search"
                    type="default"
                    onClick={() => setIsItemDialogOpen(true)}
                    elementAttr={{ 'data-testid': 'qt-add-item-btn' }}
                  />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {lines.length > 0 ? (
                  <div className="qt-lines-grid-wrap" data-fix="qt-fitcols-4b7c900">
                    {/* ROOT CAUSE (measured live in the browser, not guessed):
                        DevExtreme mounts the grid before the card has settled its
                        width, measures a wider viewport, and pins the inner table
                        to ~900px via inline width. The card is only ~625px, so the
                        table overflows → a horizontal scrollbar AND the ".." mark
                        the user kept seeing at the row's right edge. Trimming the
                        column widths (below) removes most of it, but DevExtreme's
                        stale inline width can still push a few px over. This CSS is
                        the guarantee: force the simulated-scroll content + inner
                        tables to exactly fill the wrapper (100%, fixed layout), so
                        the table can never be wider than the card and nothing
                        overflows — no scrollbar, no "..". Verified the ".." is NOT
                        a text node / ::after / adaptive command cell (checked the
                        served DOM), so hiding a class was never going to work; the
                        only real fix is preventing the overflow itself. */}
                    <style>{`
                      .qt-lines-grid-wrap .dx-scrollable-content { width: 100% !important; }
                      .qt-lines-grid-wrap .dx-datagrid-content { overflow-x: hidden !important; }
                      .qt-lines-grid-wrap .dx-datagrid-table {
                        width: 100% !important;
                        min-width: 0 !important;
                        table-layout: fixed !important;
                      }
                      /* The key line: DevExtreme pins each column via a <col> in
                         the table's <colgroup> summing to its stale 900px measure.
                         table-layout:fixed obeys the colgroup, so the columns must
                         be released to auto for width:100% to actually take hold.
                         Verified live: with this, table width == card width (625)
                         and the ".." / scrollbar are gone. */
                      .qt-lines-grid-wrap .dx-datagrid-table > colgroup > col { width: auto !important; }
                      /* Give "รายละเอียด" (item name) the lion's share and pin the
                         trash column narrow; the rest split the remainder evenly.
                         Percentages so it still adds up to 100% of the card. */
                      .qt-lines-grid-wrap .dx-datagrid-table > colgroup > col:first-child { width: 34% !important; }
                      .qt-lines-grid-wrap .dx-datagrid-table > colgroup > col:last-child { width: 44px !important; }
                      .qt-lines-grid-wrap .dx-scrollable-scrollbar.dx-scrollbar-horizontal { display: none !important; }
                    `}</style>
                    <DataGrid
                      dataSource={gridData}
                      keyExpr="key"
                      showBorders={false}
                      showRowLines
                      columnAutoWidth={false}
                      columnHidingEnabled={false}
                      className="min-h-[200px]"
                      elementAttr={{ 'data-testid': 'qt-lines-grid' }}
                    >
                      <Paging enabled={false} />
                      <Scrolling columnRenderingMode="standard" showScrollbar="onHover" />
                      {/* No width → this column flexes to absorb the leftover
                          width, so the table's total always equals the card. */}
                      <Column
                        dataField="description"
                    caption={t(`quotationNew.columns.detail`)}
                        minWidth={150}
                        cellRender={renderDescriptionCell}
                        allowSorting={false}
                      />
                      <Column
                        dataField="quantity"
                    caption={t(`quotationNew.columns.quantity`)}
                        width={70}
                        cellRender={renderQuantityCell}
                        allowSorting={false}
                      />
                      <Column
                        dataField="unit"
                    caption={t(`quotationNew.columns.unit`)}
                        width={70}
                        cellRender={renderUnitCell}
                        allowSorting={false}
                      />
                      <Column
                        dataField="unitPrice"
                    caption={t(`quotationNew.columns.unitPrice`)}
                        width={95}
                        cellRender={renderUnitPriceCell}
                        allowSorting={false}
                      />
                      <Column
                        dataField="amount"
                    caption={t(`quotationNew.columns.amount`)}
                        width={90}
                        alignment="right"
                        cellRender={renderAmountCell}
                        allowSorting={false}
                      />
                      <Column
                        dataField="notes"
                    caption={t(`quotationNew.columns.note`)}
                        width={100}
                        cellRender={renderNotesCell}
                        allowSorting={false}
                      />
                      <Column
                        caption=""
                        width={50}
                        cellRender={renderActionsCell}
                        allowSorting={false}
                        alignment="center"
                      />
                    </DataGrid>
                    <div className="p-4 border-t bg-gray-50">
                      <div className="flex justify-end">
                        <div className="w-full max-w-xs space-y-1">
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-500">{t(`quotationNew.priceBasis`)}</span>
                            <div className="inline-flex rounded-md overflow-hidden border border-gray-300 bg-white" data-testid="qt-vat-basis-toggle">
                              <button type="button" onClick={() => setVatInclusive(false)}
                                className={`px-2 py-0.5 text-[11px] ${!vatInclusive ? 'bg-green-600 text-white' : 'text-gray-600'}`}
                                data-testid="qt-vat-basis-exclusive">{t(`quotationNew.priceExclusive`)}</button>
                              <button type="button" onClick={() => setVatInclusive(true)}
                                className={`px-2 py-0.5 text-[11px] border-l border-gray-300 ${vatInclusive ? 'bg-green-600 text-white' : 'text-gray-600'}`}
                                data-testid="qt-vat-basis-inclusive">{t(`quotationNew.priceInclusive`)}</button>
                            </div>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">{t(`quotationNew.beforeVat`)}</span>
                            <span className="font-medium tabular-nums">{formatNumber(qtVat.base)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">VAT 7%</span>
                            <span className="font-medium tabular-nums">{formatNumber(qtVat.vat)}</span>
                          </div>
                          <div className="flex justify-between items-center pt-1 border-t">
                            <span className="text-sm text-gray-500">{t(`quotationNew.grandTotal`)}</span>
                            <span className="text-2xl font-bold text-green-600 tabular-nums" data-testid="qt-total-amount">
                              {t(`quotationNew.amountBaht`, { amount: formatNumber(qtVat.total) })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 px-4">
                    <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Package className="h-8 w-8 text-gray-400" />
                    </div>
                  <p className="text-gray-500 font-medium">{t(`quotationNew.noLines`)}</p>
                    <p className="text-sm text-gray-400 mt-1">
                    {t(`quotationNew.noLinesHint`)}
                    </p>
                    <div className="flex items-center justify-center gap-2 mt-4">
                      <Button
                      text={t(`quotationNew.addFreeLine`)}
                        icon="plus"
                        stylingMode="outlined"
                        onClick={handleAddBlankLine}
                      />
                      <Button
                      text={t(`quotationNew.pickFromStock`)}
                        icon="search"
                        type="default"
                        stylingMode="outlined"
                        onClick={() => setIsItemDialogOpen(true)}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-5 w-5 text-gray-500" />
                  {t(`quotationNew.notes`)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TextArea
                  value={form.notes}
                  onValueChanged={(e) => setForm((p) => ({ ...p, notes: e.value || '' }))}
                  placeholder={t(`quotationNew.notesPlaceholder`)}
                  height={90}
                  elementAttr={{ 'data-testid': 'qt-notes-input' }}
                />
              </CardContent>
            </Card>
          </div>

          {/* Right column — details + summary */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calendar className="h-5 w-5 text-blue-500" />
                  {t(`quotationNew.details`)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t(`quotationNew.date`)}</label>
                  <DateBox
                    value={form.quotationDate || undefined}
                    onValueChanged={(e) =>
                      setForm((p) => ({ ...p, quotationDate: formatDateForApi(e.value) || '' }))
                    }
                    type="date"
                    displayFormat="d MMMM yyyy"
                    placeholder={t(`quotationNew.pickDate`)}
                    showClearButton
                    useMaskBehavior
                    elementAttr={{ 'data-testid': 'qt-date-input' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t(`quotationNew.validUntil`)}</label>
                  <DateBox
                    value={form.validUntil || undefined}
                    onValueChanged={(e) =>
                      setForm((p) => ({ ...p, validUntil: formatDateForApi(e.value) || '' }))
                    }
                    type="date"
                    displayFormat="d MMMM yyyy"
                    placeholder={t(`quotationNew.pickDate`)}
                    showClearButton
                    useMaskBehavior
                    elementAttr={{ 'data-testid': 'qt-valid-until-input' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <CreditCard className="h-4 w-4 inline mr-1" />
                    {t(`quotationNew.paymentTerms`)}
                  </label>
                  {/* Dropdown, pick-from-list only (no acceptCustomValue) — the
                      free-text box became a fixed choice list (list item 6). */}
                  <SelectBox
                    dataSource={paymentTermOptions}
                    valueExpr="value"
                    displayExpr="label"
                    value={form.paymentTerms || null}
                    onValueChanged={(e) => setForm((p) => ({ ...p, paymentTerms: e.value || '' }))}
                    placeholder={t(`quotationNew.paymentTermsPlaceholder`)}
                    showClearButton
                    searchEnabled
                    elementAttr={{ 'data-testid': 'qt-payment-terms-input' }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t(`quotationNew.summary`)}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">{t(`quotationNew.itemCount`)}</span>
                  <span className="font-medium text-gray-900">{t(`quotationNew.lineCount`, { count: formatNumber(lines.length) })}</span>
                </div>
                {/* `truncate max-w-[150px]` forced the name onto one 150px line,
                    so "บริษัท ออมสินร่ำรวยเงินทอง จำกัด" was cut to
                    "บริษัท ออมสินร่ำรวยเงิน..." with empty space still below it.
                    Let it wrap and right-align instead of clipping. */}
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500 shrink-0">{t(`quotationNew.customer`)}</span>
                  <span className="font-medium text-gray-900 text-right break-words min-w-0">
                    {form.customerName || '-'}
                  </span>
                </div>
                <div className="pt-3 border-t flex justify-between items-center">
                  <span className="text-gray-700 font-medium">{t(`quotationNew.total`)}</span>
                  <span className="text-xl font-bold text-green-600 tabular-nums">
                    {t(`quotationNew.amountBaht`, { amount: formatNumber(totalAmount) })}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <ItemSearchDialog
        open={isItemDialogOpen}
        onOpenChange={setIsItemDialogOpen}
        onSelect={handleSelectItem}
        title={t(`quotationNew.pickItemTitle`)}
        showPrice="selling"
        allowCreate
        excludeIds={lines.map((l) => l.itemId).filter((id): id is number => !!id)}
      />

      <CustomerSearchDialog
        open={isCustomerDialogOpen}
        onOpenChange={setIsCustomerDialogOpen}
        onSelect={handleSelectCustomer}
        title={t(`quotationNew.pickCustomerTitle`)}
        allowCreate
      />
    </MainLayout>
  );
}
