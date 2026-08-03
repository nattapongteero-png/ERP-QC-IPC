'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxTextArea } from '@/components/ui/dx-text-area';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxPopup } from '@/components/ui/dx-popup';
import { PageHeader } from '@/components/ui/page-header';
import { Badge } from '@/components/ui/badge';
import { ItemSearchDialog, Item } from '@/components/ui/item-search-dialog';
import { cn } from '@/lib/utils/cn';
import { toLocalDateStr } from '@/lib/utils/date-format';
import { computeDocVat } from '@/lib/utils/vat';
import { PAYMENT_TERMS_OPTIONS } from '@/lib/constants/payment-terms';
import {
  Package,
  Building2,
  Calendar,
  ShoppingCart,
  Check,
  ArrowRight,
  User,
  Phone,
  Mail,
  FileText,
  Trash2,
  Pencil,
  Plus,
  AlertCircle,
  Receipt,
  Truck,
} from 'lucide-react';

interface Vendor {
  id: number;
  code: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address?: string;
  leadTimeDays?: number;
  paymentTerms?: string;
}

interface POLine {
  itemId: number;
  itemCode: string;
  itemName: string;
  itemUnit: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

// Step configuration — labels come from i18n at render time (key per step).
const STEPS = [
  { id: 1, key: 'stepVendor', icon: Building2 },
  { id: 2, key: 'stepDetails', icon: Calendar },
  { id: 3, key: 'stepItems', icon: Package },
  { id: 4, key: 'stepConfirm', icon: Check },
];

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(amount);
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('th-TH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const t = useTranslations('purchasing');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);

  const [formData, setFormData] = useState({
    vendorId: '',
    expectedDate: '',
    paymentTerms: '',
    shippingAddress: '',
    notes: '',
  });

  const [lines, setLines] = useState<POLine[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Extra charges added on top of the goods subtotal (shipping + other), shown
  // when the user opens the "เพิ่มค่าใช้จ่ายอื่นๆ" panel.
  const [showCharges, setShowCharges] = useState(false);
  const [shippingCost, setShippingCost] = useState<number | null>(null);
  const [otherCharges, setOtherCharges] = useState<number | null>(null);
  // false = prices are BEFORE VAT (add 7%); true = prices already INCLUDE VAT
  // (extract 7/107). Default false = the common B2B "ก่อน VAT" case.
  const [vatInclusive, setVatInclusive] = useState(false);
  const PO_VAT_RATE = 0.07; // Thailand 7% — matches the PO detail page

  // Item selection flow
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [isQuantityDialogOpen, setIsQuantityDialogOpen] = useState(false);
  // Start empty (null) so the dialog shows no stuck "1" / "0.00" — the user
  // must type a real quantity and price.
  const [itemQuantity, setItemQuantity] = useState<number | null>(null);
  const [itemUnitPrice, setItemUnitPrice] = useState<number | null>(null);
  // Unit chosen for the line — defaults to the item's primary unit, but the
  // operator can switch to the item's secondary unit in the add-item dialog.
  const [itemUnit, setItemUnit] = useState<string | null>(null);
  // When set, the quantity dialog is editing an existing line (by itemId)
  // instead of adding a new one — same form, "save" replaces in place.
  const [editingItemId, setEditingItemId] = useState<number | null>(null);

  // Fetch vendors
  useEffect(() => {
    const fetchVendors = async () => {
      try {
        const res = await fetch('/api/vendors?limit=100&isActive=true');
        const data = await res.json();
        if (data.success) {
          setVendors(data.data?.items || data.data || []);
        }
      } catch (error) {
        console.error('Failed to fetch vendors:', error);
      } finally {
        setLoadingVendors(false);
      }
    };
    fetchVendors();
  }, []);

  // Pre-fill the shipping address with OUR company address (from Settings →
  // General), since goods are delivered to us, not to the vendor. Only fills an
  // empty field so it never clobbers something the operator already typed.
  useEffect(() => {
    const fetchCompanyAddress = async () => {
      try {
        const res = await fetch('/api/settings/company');
        const data = await res.json();
        const addr = (data?.data?.address ?? '').trim();
        if (addr) {
          setFormData((prev) => (prev.shippingAddress ? prev : { ...prev, shippingAddress: addr }));
        }
      } catch (error) {
        console.error('Failed to fetch company address:', error);
      }
    };
    fetchCompanyAddress();
  }, []);

  const handleSelectItem = (item: Item) => {
    setSelectedItem(item);
    // Leave quantity empty; pre-fill price from the item's cost only if it has
    // one (otherwise leave empty rather than showing a stuck 0.00).
    setItemQuantity(null);
    setItemUnitPrice(item.costPrice && item.costPrice > 0 ? item.costPrice : null);
    setItemUnit(item.primaryUnit || null);
    setIsQuantityDialogOpen(true);
  };

  // Adding an item is now an EXPLICIT action — only the "เพิ่มรายการ" button
  // commits the line. Closing the dialog (× / outside click / ยกเลิก) just
  // discards the in-progress entry, which is what users expect from a close
  // button. (Previously closing auto-added the item, which was confusing.)
  const handleAddItemToOrder = () => {
    if (!selectedItem || !itemQuantity || itemQuantity <= 0 || itemUnitPrice == null || itemUnitPrice < 0) return;
    const line: POLine = {
      itemId: selectedItem.id,
      itemCode: selectedItem.code,
      itemName: selectedItem.nameTh || selectedItem.nameEn,
      itemUnit: itemUnit || selectedItem.primaryUnit || 'unit',
      quantity: itemQuantity,
      unitPrice: itemUnitPrice,
      lineTotal: itemQuantity * itemUnitPrice,
    };
    setLines((prev) =>
      editingItemId != null
        ? // Editing an existing line — replace it in place, keep its position.
          prev.map((l) => (l.itemId === editingItemId ? line : l))
        : [...prev, line],
    );
    setErrors((prev) => ({ ...prev, lines: '' }));
    closeQuantityDialog();
  };

  const handleCancelAddItem = () => {
    closeQuantityDialog();
  };

  // Single reset point — used by both the explicit add and any close path.
  const closeQuantityDialog = () => {
    setSelectedItem(null);
    setItemQuantity(null);
    setItemUnitPrice(null);
    setItemUnit(null);
    setEditingItemId(null);
    setIsQuantityDialogOpen(false);
  };

  const handleQuantityDialogHiding = () => {
    // Close (× / outside click) discards the entry — no auto-add.
    closeQuantityDialog();
  };

  // Open the quantity/price dialog for an existing line, pre-filled so the user
  // can change qty/price. We synthesize an `Item` from the stored line fields.
  const handleEditLine = (line: POLine) => {
    setSelectedItem({
      id: line.itemId,
      code: line.itemCode,
      nameTh: line.itemName,
      nameEn: line.itemName,
      primaryUnit: line.itemUnit,
      costPrice: line.unitPrice,
    } as Item);
    setItemQuantity(line.quantity);
    setItemUnitPrice(line.unitPrice);
    setItemUnit(line.itemUnit || null);
    setEditingItemId(line.itemId);
    setIsQuantityDialogOpen(true);
  };

  const handleRemoveLine = (itemId: number) => {
    setLines(lines.filter((l) => l.itemId !== itemId));
  };

  const selectedVendor = vendors.find((v) => v.id === parseInt(formData.vendorId));
  const chargesAmount = (shippingCost ?? 0) + (otherCharges ?? 0);
  // Line-level VAT honouring the pricing mode (inclusive = extract 7/107,
  // exclusive = add 7%). Shipping/other charges are non-taxable (added on top).
  const poVat = computeDocVat(lines.map((l) => l.lineTotal), vatInclusive, { extraCharges: chargesAmount });
  const subtotalAmount = poVat.subtotal;
  const vatAmount = poVat.vatAmount;
  const totalAmount = poVat.total;
  const totalItems = lines.reduce((sum, line) => sum + line.quantity, 0);

  // Step validation
  const isStepComplete = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!formData.vendorId;
      case 2:
        return !!formData.expectedDate;
      case 3:
        return lines.length > 0;
      case 4:
        return isStepComplete(1) && isStepComplete(2) && isStepComplete(3);
      default:
        return false;
    }
  };

  const canProceedToStep = (step: number): boolean => {
    for (let i = 1; i < step; i++) {
      if (!isStepComplete(i)) return false;
    }
    return true;
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.vendorId) newErrors.vendorId = 'กรุณาเลือกผู้ขาย';
    if (!formData.expectedDate) newErrors.expectedDate = 'กรุณาระบุวันที่คาดว่าจะได้รับ';
    if (lines.length === 0) newErrors.lines = 'กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/purchasing/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId: parseInt(formData.vendorId),
          expectedDate: formData.expectedDate,
          paymentTerms: formData.paymentTerms || null,
          shippingAddress: formData.shippingAddress || null,
          notes: formData.notes || null,
          subtotalAmount,
          shippingCost: shippingCost ?? 0,
          otherCharges: otherCharges ?? 0,
          vatAmount,
          totalAmount,
          vatInclusive,
          lines: lines.map((l) => ({
            itemId: l.itemId,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            unit: l.itemUnit,
          })),
        }),
      });

      const result = await response.json();

      if (result.success) {
        router.push(`/purchasing/orders/${result.data.id}`);
      } else {
        setErrors({ submit: result.error || 'ไม่สามารถสร้างใบสั่งซื้อได้' });
      }
    } catch (error) {
      console.error('Failed to create PO:', error);
      setErrors({ submit: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const vendorOptions = vendors.map((v) => ({
    value: v.id.toString(),
    label: `${v.code} - ${v.name}`,
  }));

  const lineColumns: DxDataGridColumn[] = [
    {
      dataField: 'itemCode',
      caption: 'รายการสินค้า',
      minWidth: 200,
      cellRender: (cellInfo) => (
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">{cellInfo.data.itemCode}</p>
            <p className="text-sm text-gray-500 truncate max-w-[200px]">{cellInfo.data.itemName}</p>
          </div>
        </div>
      ),
    },
    {
      dataField: 'quantity',
      caption: 'จำนวน',
      width: 120,
      alignment: 'center',
      cellRender: (cellInfo) => (
        <div className="text-center">
          <span className="font-semibold text-gray-900">{cellInfo.data.quantity.toLocaleString()}</span>
          <span className="text-gray-500 ml-1">{cellInfo.data.itemUnit}</span>
        </div>
      ),
    },
    {
      dataField: 'unitPrice',
      caption: 'ราคา/หน่วย',
      width: 140,
      alignment: 'right',
      cellRender: (cellInfo) => (
        <span className="text-gray-700">{formatCurrency(cellInfo.data.unitPrice)}</span>
      ),
    },
    {
      dataField: 'lineTotal',
      caption: 'รวม',
      width: 150,
      alignment: 'right',
      cellRender: (cellInfo) => (
        <span className="font-semibold text-blue-600">{formatCurrency(cellInfo.data.lineTotal)}</span>
      ),
    },
    {
      dataField: 'actions',
      caption: '',
      width: 120,
      alignment: 'center',
      cellRender: (cellInfo) => (
        <div className="flex items-center justify-center gap-1">
          <button
            type="button"
            onClick={() => handleEditLine(cellInfo.data)}
            aria-label={t('orders.form.wizard.editItem')}
            title={t('orders.form.wizard.editItem')}
            className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handleRemoveLine(cellInfo.data.itemId)}
            aria-label={t('orders.form.wizard.deleteItem')}
            title={t('orders.form.wizard.deleteItem')}
            className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="flex flex-col h-full gap-4">
        <PageHeader
          title={t('orders.newTitle')}
          description={t('orders.newDescription')}
          actions={
            <DxButton
              text={t('orders.form.wizard.cancel')}
              icon="close"
              type="normal"
              stylingMode="outlined"
              onClick={() => router.push('/purchasing/orders')}
            />
          }
        />

        {/* Step Indicator */}
        <Card className="shadow-sm">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              {STEPS.map((step, index) => {
                const StepIcon = step.icon;
                const isComplete = isStepComplete(step.id);
                const isCurrent = currentStep === step.id;
                const isAccessible = canProceedToStep(step.id);

                return (
                  <div key={step.id} className="flex items-center flex-1">
                    <button
                      onClick={() => isAccessible && setCurrentStep(step.id)}
                      disabled={!isAccessible}
                      className={cn(
                        'flex items-center gap-3 px-4 py-2 rounded-xl transition-all',
                        isCurrent && 'bg-blue-50 ring-2 ring-blue-500',
                        isComplete && !isCurrent && 'bg-green-50',
                        !isAccessible && 'opacity-50 cursor-not-allowed',
                        isAccessible && !isCurrent && 'hover:bg-gray-50 cursor-pointer'
                      )}
                    >
                      <div
                        className={cn(
                          'h-10 w-10 rounded-full flex items-center justify-center transition-colors',
                          isCurrent && 'bg-blue-500 text-white',
                          isComplete && !isCurrent && 'bg-green-500 text-white',
                          !isComplete && !isCurrent && 'bg-gray-200 text-gray-500'
                        )}
                      >
                        {isComplete && !isCurrent ? (
                          <Check className="h-5 w-5" />
                        ) : (
                          <StepIcon className="h-5 w-5" />
                        )}
                      </div>
                      <div className="text-left hidden md:block">
                        <p
                          className={cn(
                            'font-medium text-sm',
                            isCurrent && 'text-blue-700',
                            isComplete && !isCurrent && 'text-green-700',
                            !isComplete && !isCurrent && 'text-gray-500'
                          )}
                        >
                          {t(`orders.form.wizard.${step.key}`)}
                        </p>
                      </div>
                    </button>
                    {index < STEPS.length - 1 && (
                      <div className="flex-1 mx-2">
                        <div
                          className={cn(
                            'h-1 rounded-full transition-colors',
                            isComplete ? 'bg-green-500' : 'bg-gray-200'
                          )}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
          {/* Main Content */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            {/* Step 1: Vendor Selection */}
            {currentStep === 1 && (
              <Card className="flex-1">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="h-12 w-12 rounded-xl bg-purple-100 flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{t('orders.form.wizard.selectVendorTitle')}</h3>
                      <p className="text-sm text-gray-500">{t('orders.form.wizard.selectVendorSubtitle')}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('orders.form.wizard.vendor')} <span className="text-red-500">*</span>
                      </label>
                      <DxSelectBox
                        items={vendorOptions}
                        value={formData.vendorId}
                        // Auto-fill payment terms from the chosen vendor's default
                        // (only when the user hasn't already typed one), so the
                        // operator doesn't re-key terms already set on the vendor.
                        onValueChange={(value) => {
                          const v = vendors.find((vd) => String(vd.id) === String(value));
                          setFormData((prev) => ({
                            ...prev,
                            vendorId: value,
                            paymentTerms:
                              !prev.paymentTerms && v?.paymentTerms
                                ? v.paymentTerms
                                : prev.paymentTerms,
                          }));
                        }}
                        disabled={loadingVendors}
                        placeholder={t('orders.form.wizard.selectVendorPlaceholder')}
                        searchEnabled
                        showClearButton
                      />
                      {errors.vendorId && (
                        <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                          <AlertCircle className="h-4 w-4" />
                          {errors.vendorId}
                        </p>
                      )}
                    </div>

                    {selectedVendor && (
                      <div className="p-5 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                        <div className="flex items-start gap-4">
                          <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xl font-bold">
                            {selectedVendor.name.charAt(0)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="info">{selectedVendor.code}</Badge>
                              <h4 className="font-semibold text-gray-900">{selectedVendor.name}</h4>
                            </div>
                            <div className="grid grid-cols-2 gap-3 mt-3">
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <User className="h-4 w-4 text-gray-400" />
                                <span>{selectedVendor.contactPerson || '-'}</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Phone className="h-4 w-4 text-gray-400" />
                                <span>{selectedVendor.phone || '-'}</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Mail className="h-4 w-4 text-gray-400" />
                                <span>{selectedVendor.email || '-'}</span>
                              </div>
                              {selectedVendor.leadTimeDays && (
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                  <Truck className="h-4 w-4 text-gray-400" />
                                  <span>Lead time: {selectedVendor.leadTimeDays} วัน</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end mt-6">
                    <DxButton
                      text={t('orders.form.wizard.next')}
                      icon="arrowright"
                      type="default"
                      onClick={() => setCurrentStep(2)}
                      disabled={!formData.vendorId}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 2: Order Details */}
            {currentStep === 2 && (
              <Card className="flex-1">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="h-12 w-12 rounded-xl bg-orange-100 flex items-center justify-center">
                      <Calendar className="h-6 w-6 text-orange-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{t('orders.form.wizard.orderDetailsTitle')}</h3>
                      <p className="text-sm text-gray-500">{t('orders.form.wizard.orderDetailsSubtitle')}</p>
                    </div>
                  </div>

                  <div className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {t('orders.form.wizard.expectedDate')} <span className="text-red-500">*</span>
                        </label>
                        <DxDateBox
                          value={formData.expectedDate}
                          onValueChange={(value) => setFormData({ ...formData, expectedDate: value || '' })}
                          min={toLocalDateStr(new Date())}
                          placeholder={t('orders.form.wizard.selectDate')}
                        />
                        {errors.expectedDate && (
                          <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                            <AlertCircle className="h-4 w-4" />
                            {errors.expectedDate}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {t('orders.form.wizard.paymentTerms')}
                        </label>
                        <DxSelectBox
                          items={PAYMENT_TERMS_OPTIONS}
                          value={formData.paymentTerms}
                          onValueChange={(value) => setFormData({ ...formData, paymentTerms: value })}
                          placeholder={t('orders.form.wizard.selectPaymentTerms')}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('orders.form.wizard.shippingAddress')}
                      </label>
                      {/* Defaults to our company address (Settings → General);
                          goods ship to us, not the vendor. Still editable. */}
                      <DxTextArea
                        value={formData.shippingAddress}
                        onValueChange={(value) => setFormData({ ...formData, shippingAddress: value })}
                        placeholder={t('orders.form.wizard.shippingAddressPlaceholder')}
                        height={80}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        หมายเหตุ
                      </label>
                      <DxTextArea
                        value={formData.notes}
                        onValueChange={(value) => setFormData({ ...formData, notes: value })}
                        placeholder={t('orders.form.wizard.notesPlaceholder')}
                        height={80}
                      />
                    </div>
                  </div>

                  <div className="flex justify-between mt-6">
                    <DxButton
                      text={t('orders.form.wizard.back')}
                      icon="arrowleft"
                      type="normal"
                      stylingMode="outlined"
                      onClick={() => setCurrentStep(1)}
                    />
                    <DxButton
                      text={t('orders.form.wizard.next')}
                      icon="arrowright"
                      type="default"
                      onClick={() => setCurrentStep(3)}
                      disabled={!formData.expectedDate}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 3: Order Items */}
            {currentStep === 3 && (
              <Card className="flex-1 flex flex-col">
                <CardContent className="p-6 flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-xl bg-green-100 flex items-center justify-center">
                        <Package className="h-6 w-6 text-green-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">รายการสินค้า</h3>
                        <p className="text-sm text-gray-500">{t('orders.form.wizard.itemsSubtitle')}</p>
                      </div>
                    </div>
                    <DxButton
                      text={t('orders.form.wizard.addItem')}
                      icon="plus"
                      type="success"
                      onClick={() => setIsItemDialogOpen(true)}
                    />
                  </div>

                  {errors.lines && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                      <AlertCircle className="h-5 w-5" />
                      <span className="text-sm">{errors.lines}</span>
                    </div>
                  )}

                  {lines.length > 0 ? (
                    <div className="flex-1 flex flex-col">
                      <DxDataGrid
                        dataSource={lines}
                        keyExpr="itemId"
                        columns={lineColumns}
                        height={300}
                        noDataText={t('orders.form.wizard.noItems')}
                      />
                      <div className="flex justify-between items-center pt-4 mt-4 border-t">
                        <div className="text-sm text-gray-500">
                          {t('orders.form.wizard.itemsCount', { count: lines.length, units: totalItems.toLocaleString() })}
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-500">ยอดรวมทั้งหมด</p>
                          <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalAmount)}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Empty state is a plain placeholder (not a button) — the single
                    // "เพิ่มสินค้า" action lives in the section header, so a clickable
                    // empty state here would be a duplicate.
                    <div className="flex-1 w-full flex items-center justify-center rounded-xl border-2 border-dashed border-gray-200">
                      <div className="text-center py-12 px-4">
                        <div className="h-20 w-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                          <ShoppingCart className="h-10 w-10 text-gray-400" />
                        </div>
                        <p className="text-gray-600 font-medium">{t('orders.form.wizard.noItemsTitle')}</p>
                        <p className="text-sm text-gray-400 mt-1">
                          กดปุ่ม &quot;เพิ่มสินค้า&quot; ด้านบน เพื่อค้นหาและเพิ่มสินค้า
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between mt-6">
                    <DxButton
                      text={t('orders.form.wizard.back')}
                      icon="arrowleft"
                      type="normal"
                      stylingMode="outlined"
                      onClick={() => setCurrentStep(2)}
                    />
                    <DxButton
                      text={t('orders.form.wizard.next')}
                      icon="arrowright"
                      type="default"
                      onClick={() => setCurrentStep(4)}
                      disabled={lines.length === 0}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 4: Confirm */}
            {currentStep === 4 && (
              <Card className="flex-1">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center">
                      <Check className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{t('orders.form.wizard.confirmTitle')}</h3>
                      <p className="text-sm text-gray-500">{t('orders.form.wizard.confirmSubtitle')}</p>
                    </div>
                  </div>

                  {errors.submit && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                      <AlertCircle className="h-5 w-5" />
                      <span>{errors.submit}</span>
                    </div>
                  )}

                  <div className="space-y-6">
                    {/* Vendor Info */}
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        {t('orders.form.wizard.vendorInfo')}
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-500">{t('orders.form.wizard.vendorCode')}</p>
                          <p className="font-medium">{selectedVendor?.code}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">{t('orders.form.wizard.vendorName')}</p>
                          <p className="font-medium">{selectedVendor?.name}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">{t('orders.form.wizard.contactPerson')}</p>
                          <p className="font-medium">{selectedVendor?.contactPerson || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">{t('orders.form.wizard.phone')}</p>
                          <p className="font-medium">{selectedVendor?.phone || '-'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Order Details */}
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        รายละเอียดการสั่งซื้อ
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-500">วันที่คาดว่าจะได้รับ</p>
                          <p className="font-medium">{formatDate(formData.expectedDate)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">เงื่อนไขการชำระเงิน</p>
                          <p className="font-medium">{formData.paymentTerms || '-'}</p>
                        </div>
                        {formData.shippingAddress && (
                          <div className="col-span-2">
                            <p className="text-xs text-gray-500">{t('orders.form.wizard.shippingAddress')}</p>
                            <p className="font-medium">{formData.shippingAddress}</p>
                          </div>
                        )}
                        {formData.notes && (
                          <div className="col-span-2">
                            <p className="text-xs text-gray-500">หมายเหตุ</p>
                            <p className="font-medium">{formData.notes}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Items Summary */}
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        รายการสินค้า ({lines.length} รายการ)
                      </h4>
                      <div className="space-y-2">
                        {lines.map((line) => (
                          <div key={line.itemId} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-0">
                            <div>
                              <p className="font-medium text-sm">{line.itemCode}</p>
                              <p className="text-xs text-gray-500">{line.itemName}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm">
                                {line.quantity.toLocaleString()} {line.itemUnit} × {formatCurrency(line.unitPrice)}
                              </p>
                              <p className="font-semibold text-blue-600">{formatCurrency(line.lineTotal)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* The single "สร้างใบสั่งซื้อ" submit lives in the summary
                      sidebar (persistent, and works when stacked on tablet).
                      Here we only offer "ย้อนกลับ" to avoid a duplicate button. */}
                  <div className="flex justify-start mt-6">
                    <DxButton
                      text={t('orders.form.wizard.back')}
                      icon="arrowleft"
                      type="normal"
                      stylingMode="outlined"
                      onClick={() => setCurrentStep(3)}
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Summary Sidebar */}
          <div>
            <Card className="sticky top-4 shadow-lg">
              <CardContent className="p-0">
                {/* Header */}
                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-5 text-white rounded-t-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
                      <Receipt className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{t('orders.form.wizard.summaryTitle')}</h3>
                      <p className="text-sm text-blue-100">{t('orders.form.wizard.summaryTitle')}</p>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-5 space-y-4">
                  {/* Vendor */}
                  <div className="flex items-center gap-3 pb-4 border-b">
                    <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500">ผู้ขาย</p>
                      <p className="font-medium text-gray-900 truncate">
                        {selectedVendor?.name || '-'}
                      </p>
                    </div>
                    {selectedVendor && <Check className="h-5 w-5 text-green-500" />}
                  </div>

                  {/* Expected Date */}
                  <div className="flex items-center gap-3 pb-4 border-b">
                    <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-orange-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500">วันที่คาดว่าจะได้รับ</p>
                      <p className="font-medium text-gray-900">
                        {formData.expectedDate ? formatDate(formData.expectedDate) : '-'}
                      </p>
                    </div>
                    {formData.expectedDate && <Check className="h-5 w-5 text-green-500" />}
                  </div>

                  {/* Items Count */}
                  <div className="flex items-center gap-3 pb-4 border-b">
                    <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                      <Package className="h-5 w-5 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500">รายการสินค้า</p>
                      <p className="font-medium text-gray-900">
                        {lines.length > 0 ? `${lines.length} รายการ (${totalItems.toLocaleString()} หน่วย)` : '-'}
                      </p>
                    </div>
                    {lines.length > 0 && <Check className="h-5 w-5 text-green-500" />}
                  </div>

                  {/* Total Amount — goods subtotal, extra charges, VAT, grand total */}
                  <div className="pt-2">
                    {/* Pricing basis — does the entered price already include VAT? */}
                    <div className="flex justify-between items-center gap-2 mb-2">
                      <span className="text-gray-600 text-sm">{t('orders.form.wizard.priceBasis')}</span>
                      <div className="inline-flex rounded-md overflow-hidden border border-gray-300 bg-white" data-testid="po-vat-basis-toggle">
                        <button
                          type="button"
                          onClick={() => setVatInclusive(false)}
                          className={`px-2.5 py-1 text-[11px] ${!vatInclusive ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                          data-testid="po-vat-basis-exclusive"
                        >
                          {t('orders.form.wizard.priceExclusive')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setVatInclusive(true)}
                          className={`px-2.5 py-1 text-[11px] border-l border-gray-300 ${vatInclusive ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                          data-testid="po-vat-basis-inclusive"
                        >
                          {t('orders.form.wizard.priceInclusive')}
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-600">{t('orders.form.wizard.subtotal')}</span>
                      <span className="font-medium">{formatCurrency(subtotalAmount)}</span>
                    </div>

                    {/* Add other charges (shipping / misc) */}
                    {!showCharges ? (
                      <button
                        type="button"
                        onClick={() => setShowCharges(true)}
                        className="text-xs text-blue-600 hover:underline mb-2"
                      >
                        {t('orders.form.wizard.addCharges')}
                      </button>
                    ) : (
                      <div className="space-y-2 mb-2">
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-gray-600 text-sm">ค่าขนส่ง</span>
                          <DxNumberBox
                            value={shippingCost ?? undefined}
                            onValueChange={(v) => setShippingCost(v == null ? null : v)}
                            min={0}
                            format="#,##0.00"
                            placeholder="0.00"
                            width={130}
                          />
                        </div>
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-gray-600 text-sm">{t('orders.form.wizard.otherCharges')}</span>
                          <DxNumberBox
                            value={otherCharges ?? undefined}
                            onValueChange={(v) => setOtherCharges(v == null ? null : v)}
                            min={0}
                            format="#,##0.00"
                            placeholder="0.00"
                            width={130}
                          />
                        </div>
                      </div>
                    )}

                    {chargesAmount > 0 && (
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-600">{t('orders.form.wizard.totalCharges')}</span>
                        <span className="font-medium">{formatCurrency(chargesAmount)}</span>
                      </div>
                    )}

                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-600">{t('orders.form.wizard.vat')}</span>
                      <span className="font-medium">{formatCurrency(vatAmount)}</span>
                    </div>

                    <div className="flex justify-between items-center pt-3 border-t border-dashed">
                      <span className="font-semibold text-gray-900">{t('orders.form.wizard.grandTotal')}</span>
                      <span className="text-2xl font-bold text-blue-600">{formatCurrency(totalAmount)}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="p-5 bg-gray-50 rounded-b-lg space-y-3">
                  <DxButton
                    text={isSubmitting ? t('orders.form.wizard.creating') : t('orders.form.wizard.createPO')}
                    type="success"
                    width="100%"
                    onClick={handleSubmit}
                    disabled={!formData.vendorId || !formData.expectedDate || lines.length === 0 || isSubmitting}
                  />
                  <DxButton
                    text={t('orders.form.wizard.cancel')}
                    type="normal"
                    stylingMode="text"
                    width="100%"
                    onClick={() => router.push('/purchasing/orders')}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Item Search Dialog */}
      <ItemSearchDialog
        open={isItemDialogOpen}
        onOpenChange={setIsItemDialogOpen}
        onSelect={handleSelectItem}
        title={t('orders.form.wizard.searchItem')}
        showPrice="cost"
        excludeIds={lines.map((l) => l.itemId)}
      />

      {/* Quantity & Price Dialog.
          Uses contentRender (not children) so DevExtreme portals the body INTO
          the popup's content area — passing plain children made the fields leak
          out below the dialog (DevExpress T1064246). */}
      <DxPopup
        visible={isQuantityDialogOpen}
        onHiding={handleQuantityDialogHiding}
        title={editingItemId != null ? t('orders.form.wizard.editItemTitle') : t('orders.form.wizard.addItemTitle')}
        width={500}
        height="auto"
        showCloseButton
        contentRender={() =>
          selectedItem ? (
            <div className="space-y-5 p-5">
              {/* Item Info */}
              <div className="flex items-center gap-4 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white">
                  <Package className="h-7 w-7" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="info">{selectedItem.code}</Badge>
                  </div>
                  <p className="font-medium text-gray-900 mt-1">{selectedItem.nameTh || selectedItem.nameEn}</p>
                </div>
              </div>

              {/* Form Fields — quantity, unit (the item's own units), unit price */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('orders.form.wizard.quantity')} <span className="text-red-500">*</span>
                  </label>
                  <DxNumberBox
                    value={itemQuantity ?? undefined}
                    onValueChange={(v) => setItemQuantity(v == null ? null : v)}
                    min={1}
                    showSpinButtons
                    format="#,##0"
                    placeholder={t('orders.form.wizard.quantityPlaceholder')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('orders.form.wizard.unit')} <span className="text-red-500">*</span>
                  </label>
                  <DxSelectBox
                    value={itemUnit ?? undefined}
                    onValueChange={(v) => setItemUnit((v as string) ?? null)}
                    dataSource={Array.from(
                      new Set(
                        [selectedItem.primaryUnit, selectedItem.secondaryUnit].filter(
                          (u): u is string => !!u,
                        ),
                      ),
                    )}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('orders.form.wizard.unitPrice')} <span className="text-red-500">*</span>
                  </label>
                  <DxNumberBox
                    value={itemUnitPrice ?? undefined}
                    onValueChange={(v) => setItemUnitPrice(v == null ? null : v)}
                    min={0}
                    showSpinButtons
                    format="#,##0.00"
                    placeholder={t('orders.form.wizard.unitPricePlaceholder')}
                  />
                </div>
              </div>

              {/* Line Total Preview */}
              {!!itemQuantity && itemQuantity > 0 && itemUnitPrice != null && itemUnitPrice >= 0 && (
                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl">
                  <span className="text-gray-600">{t('orders.form.wizard.lineTotal')}</span>
                  <span className="text-xl font-bold text-blue-600">
                    {formatCurrency(itemQuantity * itemUnitPrice)}
                  </span>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <DxButton
                  text={t('orders.form.wizard.cancel')}
                  type="normal"
                  stylingMode="outlined"
                  onClick={handleCancelAddItem}
                />
                <DxButton
                  text={editingItemId != null ? t('orders.form.wizard.save') : t('orders.form.wizard.addToOrder')}
                  icon={editingItemId != null ? 'save' : 'plus'}
                  type="success"
                  onClick={handleAddItemToOrder}
                  disabled={!itemQuantity || itemQuantity <= 0 || itemUnitPrice == null || itemUnitPrice < 0}
                />
              </div>
            </div>
          ) : null
        }
      />
    </>
  );
}
