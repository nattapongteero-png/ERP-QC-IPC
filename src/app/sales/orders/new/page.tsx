'use client';

// Sales Order Create Page
// Following template design pattern with DevExtreme components

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from 'devextreme-react/button';
import TextArea from 'devextreme-react/text-area';
import DateBox from 'devextreme-react/date-box';
import NumberBox from 'devextreme-react/number-box';
import SelectBox from 'devextreme-react/select-box';
import DataGrid, {
  Column,
  Paging,
  Editing,
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
}

// ============================================================================
// Constants
// ============================================================================

const STATUS_OPTIONS = [
  { value: 'draft', label: 'ร่าง (Draft)' },
  { value: 'confirmed', label: 'ยืนยันแล้ว (Confirmed)' },
];

const PAYMENT_TERMS_OPTIONS = [
  { value: 'cash', label: 'เงินสด (Cash)' },
  { value: 'net15', label: 'Net 15 วัน' },
  { value: 'net30', label: 'Net 30 วัน' },
  { value: 'net45', label: 'Net 45 วัน' },
  { value: 'net60', label: 'Net 60 วัน' },
];

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
  const [isSaving, setIsSaving] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false);
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [lineIdCounter, setLineIdCounter] = useState(1);
  const [selectedLineId, setSelectedLineId] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [form, setForm] = useState<FormData>({
    customerName: '',
    customerContact: '',
    customerAddress: '',
    requiredDate: null,
    paymentTerms: '',
    notes: '',
    status: 'draft',
  });

  const [lines, setLines] = useState<SOLine[]>([]);

  // ============================================================================
  // Computed Values
  // ============================================================================

  const totalAmount = useMemo(() => {
    return lines.reduce((sum, line) => sum + line.lineTotal, 0);
  }, [lines]);

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
      paymentTerms: customer.paymentTerms || '',
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
    setSelectedLineId(lineId);
    setShowDeleteConfirm(true);
  }, []);

  const confirmDeleteLine = useCallback(() => {
    if (selectedLineId !== null) {
      setLines(prev => prev.filter(line => line.id !== selectedLineId));
      setShowDeleteConfirm(false);
      setSelectedLineId(null);
      notify('ลบรายการสำเร็จ', 'success', 2000);
    }
  }, [selectedLineId]);

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
      notify('กรุณาเลือกลูกค้า', 'warning', 3000);
      return;
    }
    if (lines.length === 0) {
      notify('กรุณาเพิ่มอย่างน้อย 1 รายการสินค้า', 'warning', 3000);
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/sales/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: form.customerName,
          customerContact: form.customerContact,
          customerAddress: form.customerAddress,
          requiredDate: formatDateForApi(form.requiredDate),
          paymentTerms: form.paymentTerms,
          notes: form.notes,
          status: form.status,
          lines: lines.map(line => ({
            itemId: line.itemId,
            quantity: line.quantity,
            unit: line.unit,
            unitPrice: line.unitPrice,
            notes: line.notes,
          })),
        }),
      });

      const result = await res.json();

      if (result.success) {
        notify('สร้างใบสั่งขายสำเร็จ', 'success', 3000);
        router.push(`/sales/orders/${result.data.id}`);
      } else {
        notify(result.error || 'ไม่สามารถสร้างใบสั่งขายได้', 'error', 5000);
      }
    } catch (error) {
      console.error('Failed to create sales order:', error);
      notify('เกิดข้อผิดพลาดในการสร้างใบสั่งขาย', 'error', 5000);
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

  const renderQuantityCell = useCallback((cellInfo: { data: SOLine }) => (
    <NumberBox
      value={cellInfo.data.quantity}
      onValueChanged={(e) => handleLineQuantityChange(cellInfo.data.id, e.value || 0)}
      min={0.01}
      step={1}
      format="#,##0.####"
      width="100%"
      stylingMode="outlined"
    />
  ), [handleLineQuantityChange]);

  const renderUnitPriceCell = useCallback((cellInfo: { data: SOLine }) => (
    <NumberBox
      value={cellInfo.data.unitPrice}
      onValueChanged={(e) => handleLineUnitPriceChange(cellInfo.data.id, e.value || 0)}
      min={0}
      step={0.01}
      format="#,##0.00"
      width="100%"
      stylingMode="outlined"
    />
  ), [handleLineUnitPriceChange]);

  const renderLineTotalCell = useCallback((cellInfo: { data: SOLine }) => (
    <span className="font-semibold text-green-600">
      {formatCurrency(cellInfo.data.lineTotal)}
    </span>
  ), []);

  const renderActionsCell = useCallback((cellInfo: { data: SOLine }) => (
    <button
      type="button"
      onClick={() => handleDeleteLine(cellInfo.data.id)}
      className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
      title="ลบรายการ"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  ), [handleDeleteLine]);

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
              text="กลับ"
              icon="back"
              stylingMode="text"
              onClick={handleCancel}
            />
            <div className="h-6 w-px bg-gray-200" />
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                <ShoppingCart className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">สร้างใบสั่งขายใหม่</h1>
                <p className="text-sm text-gray-500">กรอกข้อมูลลูกค้าและรายการสินค้า</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              text="ยกเลิก"
              icon="close"
              stylingMode="outlined"
              onClick={handleCancel}
              disabled={isSaving}
            />
            <Button
              text={isSaving ? 'กำลังบันทึก...' : 'บันทึก'}
              icon={isSaving ? 'spindown' : 'save'}
              type="success"
              onClick={handleSave}
              disabled={isSaving}
            />
          </div>
        </div>

        {/* Delete Line Confirmation */}
        {showDeleteConfirm && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-red-800">ยืนยันการลบ</p>
                  <p className="text-sm text-red-600">
                    คุณต้องการลบรายการสินค้านี้หรือไม่?
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    text="ยกเลิก"
                    stylingMode="outlined"
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setSelectedLineId(null);
                    }}
                  />
                  <Button
                    text="ลบ"
                    icon="trash"
                    type="danger"
                    onClick={confirmDeleteLine}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content - 2 Column + Sidebar Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Customer Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="h-5 w-5 text-purple-500" />
                  ข้อมูลลูกค้า
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Customer Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ลูกค้า <span className="text-red-500">*</span>
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
                            text="เปลี่ยน"
                            type="normal"
                            stylingMode="outlined"
                            onClick={() => setIsCustomerDialogOpen(true)}
                          />
                          <Button
                            icon="close"
                            type="danger"
                            stylingMode="text"
                            onClick={handleClearCustomer}
                            hint="ล้างข้อมูลลูกค้า"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsCustomerDialogOpen(true)}
                      className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-emerald-400 hover:bg-emerald-50 transition-colors text-gray-500 hover:text-emerald-600"
                    >
                      <Search className="h-5 w-5" />
                      <span>คลิกเพื่อค้นหาและเลือกลูกค้า...</span>
                    </button>
                  )}
                </div>

                {/* Shipping Address */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <MapPin className="h-4 w-4 inline mr-1" />
                    ที่อยู่จัดส่ง
                  </label>
                  <TextArea
                    value={form.customerAddress}
                    onValueChanged={(e) => setForm(prev => ({ ...prev, customerAddress: e.value || '' }))}
                    placeholder="ระบุที่อยู่สำหรับจัดส่ง..."
                    height={80}
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
                    รายการสินค้า
                    {lineCount > 0 && (
                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full">
                        {lineCount} รายการ
                      </span>
                    )}
                  </CardTitle>
                  <Button
                    text="เพิ่มสินค้า"
                    icon="plus"
                    type="default"
                    onClick={() => setIsItemDialogOpen(true)}
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
                    >
                      <Paging enabled={false} />
                      <Editing mode="cell" allowUpdating={false} />

                      <Column
                        dataField="itemCode"
                        caption="สินค้า"
                        minWidth={220}
                        cellRender={renderItemCell}
                        allowSorting={false}
                      />
                      <Column
                        dataField="unit"
                        caption="หน่วย"
                        width={80}
                        alignment="center"
                      />
                      <Column
                        dataField="quantity"
                        caption="จำนวน"
                        width={120}
                        cellRender={renderQuantityCell}
                        allowSorting={false}
                      />
                      <Column
                        dataField="unitPrice"
                        caption="ราคา/หน่วย"
                        width={140}
                        cellRender={renderUnitPriceCell}
                        allowSorting={false}
                      />
                      <Column
                        dataField="lineTotal"
                        caption="รวม"
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
                          customizeText={(data) => `รวม: ${formatCurrency(data.value as number)}`}
                        />
                      </Summary>
                    </DataGrid>

                    {/* Total Summary */}
                    <div className="p-4 border-t bg-gray-50">
                      <div className="flex justify-end">
                        <div className="text-right">
                          <p className="text-sm text-gray-500">ยอดรวมทั้งหมด</p>
                          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalAmount)}</p>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12 px-4">
                    <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Package className="h-8 w-8 text-gray-400" />
                    </div>
                    <p className="text-gray-500 font-medium">ยังไม่มีรายการสินค้า</p>
                    <p className="text-sm text-gray-400 mt-1">คลิกปุ่ม &quot;เพิ่มสินค้า&quot; เพื่อเริ่มต้น</p>
                    <Button
                      text="เพิ่มสินค้ารายการแรก"
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

            {/* Notes */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-5 w-5 text-gray-500" />
                  หมายเหตุ
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TextArea
                  value={form.notes}
                  onValueChanged={(e) => setForm(prev => ({ ...prev, notes: e.value || '' }))}
                  placeholder="หมายเหตุหรือคำแนะนำเพิ่มเติม..."
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
                <CardTitle className="text-base">สถานะใบสั่งขาย</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">สถานะ</label>
                  <SelectBox
                    dataSource={STATUS_OPTIONS}
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
                  รายละเอียดคำสั่งซื้อ
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    วันที่ต้องการส่ง
                  </label>
                  <DateBox
                    value={form.requiredDate}
                    onValueChanged={(e) => setForm(prev => ({ ...prev, requiredDate: e.value }))}
                    type="date"
                    displayFormat="d MMMM yyyy"
                    placeholder="เลือกวันที่..."
                    showClearButton
                    useMaskBehavior
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <CreditCard className="h-4 w-4 inline mr-1" />
                    เงื่อนไขการชำระเงิน
                  </label>
                  <SelectBox
                    dataSource={PAYMENT_TERMS_OPTIONS}
                    displayExpr="label"
                    valueExpr="value"
                    value={form.paymentTerms}
                    onValueChanged={(e) => setForm(prev => ({ ...prev, paymentTerms: e.value }))}
                    placeholder="เลือกเงื่อนไข..."
                    showClearButton
                    searchEnabled
                  />
                </div>
              </CardContent>
            </Card>

            {/* Order Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">สรุปคำสั่งซื้อ</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">จำนวนรายการ</span>
                  <span className="font-medium text-gray-900">{lineCount} รายการ</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">ลูกค้า</span>
                  <span className="font-medium text-gray-900 truncate max-w-[150px]">
                    {form.customerName || '-'}
                  </span>
                </div>
                <div className="pt-3 border-t">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700 font-medium">ยอดรวม</span>
                    <span className="text-xl font-bold text-green-600">{formatCurrency(totalAmount)}</span>
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
        title="ค้นหาลูกค้า"
      />

      {/* Item Search Dialog */}
      <ItemSearchDialog
        open={isItemDialogOpen}
        onOpenChange={setIsItemDialogOpen}
        onSelect={handleSelectItem}
        title="ค้นหาสินค้า"
        showPrice="selling"
        excludeIds={lines.map(line => line.itemId)}
      />
    </MainLayout>
  );
}
