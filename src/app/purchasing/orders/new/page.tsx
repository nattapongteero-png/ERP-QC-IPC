'use client';

import { useState, useEffect, useRef } from 'react';
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

// Step configuration
const STEPS = [
  { id: 1, label: 'เลือกผู้ขาย', labelEn: 'Select Vendor', icon: Building2 },
  { id: 2, label: 'รายละเอียด', labelEn: 'Details', icon: Calendar },
  { id: 3, label: 'รายการสินค้า', labelEn: 'Items', icon: Package },
  { id: 4, label: 'ยืนยัน', labelEn: 'Confirm', icon: Check },
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

  // Item selection flow
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [isQuantityDialogOpen, setIsQuantityDialogOpen] = useState(false);
  const [itemQuantity, setItemQuantity] = useState<number>(1);
  const [itemUnitPrice, setItemUnitPrice] = useState<number>(0);
  // Ref to distinguish explicit Cancel vs closing the dialog via X button
  const cancelAddRef = useRef(false);

  // Fetch vendors
  useEffect(() => {
    const fetchVendors = async () => {
      try {
        const res = await fetch('/api/vendors?limit=100&status=active');
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

  const handleSelectItem = (item: Item) => {
    setSelectedItem(item);
    setItemQuantity(1);
    setItemUnitPrice(item.costPrice || 0);
    setIsQuantityDialogOpen(true);
  };

  const handleAddItemToOrder = () => {
    if (!selectedItem || itemQuantity <= 0 || itemUnitPrice < 0) return;
    // Close dialog — onHiding will handle the actual item addition
    setIsQuantityDialogOpen(false);
  };

  const handleCancelAddItem = () => {
    // Mark as explicitly cancelled so onHiding won't auto-add
    cancelAddRef.current = true;
    setIsQuantityDialogOpen(false);
  };

  const handleQuantityDialogHiding = () => {
    // Auto-add item unless user explicitly clicked "ยกเลิก" (Cancel)
    if (!cancelAddRef.current && selectedItem && itemQuantity > 0 && itemUnitPrice >= 0) {
      const line: POLine = {
        itemId: selectedItem.id,
        itemCode: selectedItem.code,
        itemName: selectedItem.nameTh || selectedItem.nameEn,
        itemUnit: selectedItem.primaryUnit || 'unit',
        quantity: itemQuantity,
        unitPrice: itemUnitPrice,
        lineTotal: itemQuantity * itemUnitPrice,
      };
      setLines((prev) => [...prev, line]);
      setErrors((prev) => ({ ...prev, lines: '' }));
    }
    // Reset state
    cancelAddRef.current = false;
    setSelectedItem(null);
    setItemQuantity(1);
    setItemUnitPrice(0);
    setIsQuantityDialogOpen(false);
  };

  const handleRemoveLine = (itemId: number) => {
    setLines(lines.filter((l) => l.itemId !== itemId));
  };

  const selectedVendor = vendors.find((v) => v.id === parseInt(formData.vendorId));
  const totalAmount = lines.reduce((sum, line) => sum + line.lineTotal, 0);
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
      width: 80,
      alignment: 'center',
      cellRender: (cellInfo) => (
        <button
          onClick={() => handleRemoveLine(cellInfo.data.itemId)}
          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
        >
          <Trash2 className="h-4 w-4" />
        </button>
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
              text="ยกเลิก"
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
                          {step.label}
                        </p>
                        <p className="text-xs text-gray-400">{step.labelEn}</p>
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
                      <h3 className="text-lg font-semibold text-gray-900">เลือกผู้ขาย</h3>
                      <p className="text-sm text-gray-500">Select a vendor for this purchase order</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        ผู้ขาย <span className="text-red-500">*</span>
                      </label>
                      <DxSelectBox
                        items={vendorOptions}
                        value={formData.vendorId}
                        onValueChange={(value) => setFormData({ ...formData, vendorId: value })}
                        disabled={loadingVendors}
                        placeholder="-- เลือกผู้ขาย --"
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
                      text="ถัดไป"
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
                      <h3 className="text-lg font-semibold text-gray-900">รายละเอียดการสั่งซื้อ</h3>
                      <p className="text-sm text-gray-500">Enter order details and delivery information</p>
                    </div>
                  </div>

                  <div className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          วันที่คาดว่าจะได้รับ <span className="text-red-500">*</span>
                        </label>
                        <DxDateBox
                          value={formData.expectedDate}
                          onValueChange={(value) => setFormData({ ...formData, expectedDate: value || '' })}
                          min={toLocalDateStr(new Date())}
                          placeholder="เลือกวันที่"
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
                          เงื่อนไขการชำระเงิน
                        </label>
                        <DxSelectBox
                          items={[
                            { value: '', label: '-- เลือก --' },
                            { value: 'COD', label: 'COD - ชำระเงินเมื่อรับสินค้า' },
                            { value: 'Net 7', label: 'Net 7 - ชำระภายใน 7 วัน' },
                            { value: 'Net 15', label: 'Net 15 - ชำระภายใน 15 วัน' },
                            { value: 'Net 30', label: 'Net 30 - ชำระภายใน 30 วัน' },
                            { value: 'Net 45', label: 'Net 45 - ชำระภายใน 45 วัน' },
                            { value: 'Net 60', label: 'Net 60 - ชำระภายใน 60 วัน' },
                          ]}
                          value={formData.paymentTerms}
                          onValueChange={(value) => setFormData({ ...formData, paymentTerms: value })}
                          placeholder="เลือกเงื่อนไข"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        ที่อยู่จัดส่ง
                      </label>
                      <DxTextArea
                        value={formData.shippingAddress}
                        onValueChange={(value) => setFormData({ ...formData, shippingAddress: value })}
                        placeholder="ระบุที่อยู่สำหรับจัดส่งสินค้า..."
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
                        placeholder="หมายเหตุเพิ่มเติม..."
                        height={80}
                      />
                    </div>
                  </div>

                  <div className="flex justify-between mt-6">
                    <DxButton
                      text="ย้อนกลับ"
                      icon="arrowleft"
                      type="normal"
                      stylingMode="outlined"
                      onClick={() => setCurrentStep(1)}
                    />
                    <DxButton
                      text="ถัดไป"
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
                        <p className="text-sm text-gray-500">Add items to your purchase order</p>
                      </div>
                    </div>
                    <DxButton
                      text="เพิ่มสินค้า"
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
                        noDataText="ไม่มีรายการสินค้า"
                      />
                      <div className="flex justify-between items-center pt-4 mt-4 border-t">
                        <div className="text-sm text-gray-500">
                          {lines.length} รายการ ({totalItems.toLocaleString()} หน่วย)
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-500">ยอดรวมทั้งหมด</p>
                          <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalAmount)}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center">
                      <div className="text-center py-12">
                        <div className="h-20 w-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                          <ShoppingCart className="h-10 w-10 text-gray-400" />
                        </div>
                        <p className="text-gray-600 font-medium">ยังไม่มีรายการสินค้า</p>
                        <p className="text-sm text-gray-400 mt-1">คลิก &quot;เพิ่มสินค้า&quot; เพื่อค้นหาและเพิ่มสินค้า</p>
                        <DxButton
                          text="เพิ่มสินค้า"
                          icon="plus"
                          type="default"
                          stylingMode="outlined"
                          className="mt-4"
                          onClick={() => setIsItemDialogOpen(true)}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between mt-6">
                    <DxButton
                      text="ย้อนกลับ"
                      icon="arrowleft"
                      type="normal"
                      stylingMode="outlined"
                      onClick={() => setCurrentStep(2)}
                    />
                    <DxButton
                      text="ถัดไป"
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
                      <h3 className="text-lg font-semibold text-gray-900">ยืนยันการสร้างใบสั่งซื้อ</h3>
                      <p className="text-sm text-gray-500">Review and confirm your purchase order</p>
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
                        ข้อมูลผู้ขาย
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-500">รหัสผู้ขาย</p>
                          <p className="font-medium">{selectedVendor?.code}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">ชื่อผู้ขาย</p>
                          <p className="font-medium">{selectedVendor?.name}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">ผู้ติดต่อ</p>
                          <p className="font-medium">{selectedVendor?.contactPerson || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">โทรศัพท์</p>
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
                            <p className="text-xs text-gray-500">ที่อยู่จัดส่ง</p>
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

                  <div className="flex justify-between mt-6">
                    <DxButton
                      text="ย้อนกลับ"
                      icon="arrowleft"
                      type="normal"
                      stylingMode="outlined"
                      onClick={() => setCurrentStep(3)}
                    />
                    <DxButton
                      text={isSubmitting ? 'กำลังสร้าง...' : 'สร้างใบสั่งซื้อ'}
                      icon="check"
                      type="success"
                      onClick={handleSubmit}
                      disabled={isSubmitting}
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
                      <h3 className="font-semibold">สรุปใบสั่งซื้อ</h3>
                      <p className="text-sm text-blue-100">Purchase Order Summary</p>
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

                  {/* Total Amount */}
                  <div className="pt-2">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-600">ยอดรวมสินค้า</span>
                      <span className="font-medium">{formatCurrency(totalAmount)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-3 border-t border-dashed">
                      <span className="font-semibold text-gray-900">ยอดรวมทั้งหมด</span>
                      <span className="text-2xl font-bold text-blue-600">{formatCurrency(totalAmount)}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="p-5 bg-gray-50 rounded-b-lg space-y-3">
                  <DxButton
                    text={isSubmitting ? 'กำลังสร้าง...' : 'สร้างใบสั่งซื้อ'}
                    type="success"
                    width="100%"
                    onClick={handleSubmit}
                    disabled={!formData.vendorId || !formData.expectedDate || lines.length === 0 || isSubmitting}
                  />
                  <DxButton
                    text="ยกเลิก"
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
        title="ค้นหาสินค้า"
        showPrice="cost"
        excludeIds={lines.map((l) => l.itemId)}
      />

      {/* Quantity & Price Dialog */}
      <DxPopup
        visible={isQuantityDialogOpen}
        onHiding={handleQuantityDialogHiding}
        title="เพิ่มรายการสินค้า"
        width={500}
        height="auto"
        showCloseButton
        shading={false}
      >
        {selectedItem && (
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
                <p className="text-sm text-gray-500">หน่วย: {selectedItem.primaryUnit || 'unit'}</p>
              </div>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  จำนวน <span className="text-red-500">*</span>
                </label>
                <DxNumberBox
                  value={itemQuantity}
                  onValueChange={(v) => setItemQuantity(v || 0)}
                  min={1}
                  showSpinButtons
                  format="#,##0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ราคาต่อหน่วย (บาท) <span className="text-red-500">*</span>
                </label>
                <DxNumberBox
                  value={itemUnitPrice}
                  onValueChange={(v) => setItemUnitPrice(v || 0)}
                  min={0}
                  showSpinButtons
                  format="#,##0.00"
                />
              </div>
            </div>

            {/* Line Total Preview */}
            {itemQuantity > 0 && itemUnitPrice >= 0 && (
              <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl">
                <span className="text-gray-600">ยอดรวมรายการนี้</span>
                <span className="text-xl font-bold text-blue-600">
                  {formatCurrency(itemQuantity * itemUnitPrice)}
                </span>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <DxButton
                text="ยกเลิก"
                type="normal"
                stylingMode="outlined"
                onClick={handleCancelAddItem}
              />
              <DxButton
                text="เพิ่มรายการ"
                icon="plus"
                type="success"
                onClick={handleAddItemToOrder}
                disabled={itemQuantity <= 0 || itemUnitPrice < 0}
              />
            </div>
          </div>
        )}
      </DxPopup>
    </>
  );
}
