'use client';

/**
 * Create Quotation (สร้างใบเสนอราคา).
 *
 * The first document in the sales flow: a priced offer to a customer. Lines can
 * come from the inventory item picker (which carries the selling price across)
 * or be typed free-hand for services / one-off items. Every amount is shown via
 * formatNumber so thousands separators are always present.
 */

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from 'devextreme-react/button';
import TextArea from 'devextreme-react/text-area';
import TextBox from 'devextreme-react/text-box';
import DateBox from 'devextreme-react/date-box';
import NumberBox from 'devextreme-react/number-box';
import DataGrid, { Column, Paging } from 'devextreme-react/data-grid';
import { ItemSearchDialog, type Item } from '@/components/ui/item-search-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatNumber } from '@/lib/utils/number-format';
import {
  FileText,
  Building2,
  Package,
  Trash2,
  Calendar,
  CreditCard,
} from 'lucide-react';
import type { QuotationLineInput } from '@/types/quotation';

// A quotation line as held in the form. `key` is the local grid key; the API
// only receives the QuotationLineInput fields.
interface QuotationFormLine extends QuotationLineInput {
  key: number;
}

interface FormData {
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

export default function NewQuotationPage() {
  const router = useRouter();
  const toast = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [keyCounter, setKeyCounter] = useState(1);

  const [form, setForm] = useState<FormData>({
    customerName: '',
    customerContact: '',
    customerAddress: '',
    quotationDate: '',
    validUntil: '',
    paymentTerms: '',
    notes: '',
  });

  const [lines, setLines] = useState<QuotationFormLine[]>([]);

  const totalAmount = useMemo(
    () => lines.reduce((s, l) => s + (l.quantity || 0) * (l.unitPrice || 0), 0),
    [lines],
  );

  // Grid data carries a computed amount column so the DataGrid can render it
  // without an in-grid formula (amount is display-only, never edited).
  const gridData = useMemo(
    () => lines.map((l) => ({ ...l, amount: (l.quantity || 0) * (l.unitPrice || 0) })),
    [lines],
  );

  const handleSelectItem = useCallback((item: Item) => {
    setLines((prev) => [
      ...prev,
      {
        key: keyCounter,
        itemId: item.id,
        itemCode: item.code,
        description: item.nameTh || item.nameEn || item.code,
        quantity: 1,
        unit: item.primaryUnit || 'หน่วย',
        unitPrice: item.sellingPrice || 0,
        notes: '',
      },
    ]);
    setKeyCounter((n) => n + 1);
  }, [keyCounter]);

  const handleAddBlankLine = useCallback(() => {
    setLines((prev) => [
      ...prev,
      {
        key: keyCounter,
        description: '',
        quantity: 1,
        unit: 'หน่วย',
        unitPrice: 0,
        notes: '',
      },
    ]);
    setKeyCounter((n) => n + 1);
  }, [keyCounter]);

  const updateLine = useCallback((key: number, patch: Partial<QuotationFormLine>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }, []);

  const removeLine = useCallback((key: number) => {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }, []);

  const handleSave = async () => {
    if (!form.customerName.trim()) {
      toast.error('กรุณากรอกชื่อลูกค้า');
      return;
    }
    if (lines.length === 0) {
      toast.error('กรุณาเพิ่มรายการอย่างน้อยหนึ่งรายการ');
      return;
    }
    if (lines.some((l) => !l.description.trim())) {
      toast.error('กรุณากรอกรายละเอียดให้ครบทุกรายการ');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/sales/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: form.customerName.trim(),
          customerContact: form.customerContact || null,
          customerAddress: form.customerAddress || null,
          quotationDate: form.quotationDate || null,
          validUntil: form.validUntil || null,
          paymentTerms: form.paymentTerms || null,
          notes: form.notes || null,
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
      });
      const json = await res.json();
      if (json.success) {
        toast.success('สร้างใบเสนอราคาสำเร็จ', json.data?.quotationNumber);
        router.push(`/sales/quotations/${json.data.id}`);
      } else {
        toast.error(json.error || 'ไม่สามารถสร้างใบเสนอราคาได้');
      }
    } catch (e) {
      console.error('Failed to create quotation:', e);
      toast.error('ไม่สามารถสร้างใบเสนอราคาได้');
    } finally {
      setIsSaving(false);
    }
  };

  // ---- Cell renderers -------------------------------------------------------

  const renderDescriptionCell = useCallback((cell: { data: QuotationFormLine }) => (
    <div className="py-1">
      {cell.data.itemCode && (
        <p className="font-mono text-xs text-emerald-600">{cell.data.itemCode}</p>
      )}
      <TextBox
        value={cell.data.description}
        onValueChanged={(e) => updateLine(cell.data.key, { description: e.value || '' })}
        placeholder="รายละเอียด"
        stylingMode="outlined"
      />
    </div>
  ), [updateLine]);

  const renderQuantityCell = useCallback((cell: { data: QuotationFormLine }) => (
    <NumberBox
      value={cell.data.quantity}
      onValueChanged={(e) => updateLine(cell.data.key, { quantity: e.value || 0 })}
      min={0}
      format="#,##0.####"
      width="100%"
      stylingMode="outlined"
    />
  ), [updateLine]);

  const renderUnitCell = useCallback((cell: { data: QuotationFormLine }) => (
    <TextBox
      value={cell.data.unit}
      onValueChanged={(e) => updateLine(cell.data.key, { unit: e.value || '' })}
      stylingMode="outlined"
    />
  ), [updateLine]);

  const renderUnitPriceCell = useCallback((cell: { data: QuotationFormLine }) => (
    <NumberBox
      value={cell.data.unitPrice}
      onValueChanged={(e) => updateLine(cell.data.key, { unitPrice: e.value || 0 })}
      min={0}
      format="#,##0.00"
      width="100%"
      stylingMode="outlined"
    />
  ), [updateLine]);

  const renderAmountCell = useCallback((cell: { data: { amount: number } }) => (
    <span className="font-semibold text-green-600 tabular-nums">
      {formatNumber(cell.data.amount)}
    </span>
  ), []);

  const renderNotesCell = useCallback((cell: { data: QuotationFormLine }) => (
    <TextBox
      value={cell.data.notes || ''}
      onValueChanged={(e) => updateLine(cell.data.key, { notes: e.value || '' })}
      placeholder="หมายเหตุ"
      stylingMode="outlined"
    />
  ), [updateLine]);

  const renderActionsCell = useCallback((cell: { data: QuotationFormLine }) => (
    <button
      type="button"
      onClick={() => removeLine(cell.data.key)}
      className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
      title="ลบรายการ"
      data-testid={`btn-remove-line-${cell.data.key}`}
    >
      <Trash2 className="h-4 w-4" />
    </button>
  ), [removeLine]);

  return (
    <MainLayout>
      <div className="space-y-6 p-1">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button
              text="กลับ"
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
                <h1 className="text-xl font-semibold text-gray-900" data-testid="qt-form-title">
                  สร้างใบเสนอราคา
                </h1>
                <p className="text-sm text-gray-500">เสนอราคาสินค้า/บริการให้ลูกค้า</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              text="ยกเลิก"
              icon="close"
              stylingMode="outlined"
              onClick={() => router.back()}
              disabled={isSaving}
              elementAttr={{ 'data-testid': 'qt-cancel-btn' }}
            />
            <Button
              text={isSaving ? 'กำลังบันทึก...' : 'บันทึก'}
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
                  ข้อมูลลูกค้า
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ชื่อลูกค้า <span className="text-red-500">*</span>
                  </label>
                  <TextBox
                    value={form.customerName}
                    onValueChanged={(e) => setForm((p) => ({ ...p, customerName: e.value || '' }))}
                    placeholder="ชื่อลูกค้า / บริษัท"
                    elementAttr={{ 'data-testid': 'qt-customer-name-input' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ผู้ติดต่อ</label>
                  <TextBox
                    value={form.customerContact}
                    onValueChanged={(e) => setForm((p) => ({ ...p, customerContact: e.value || '' }))}
                    placeholder="ชื่อผู้ติดต่อ / เบอร์โทร"
                    elementAttr={{ 'data-testid': 'qt-customer-contact-input' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ที่อยู่</label>
                  <TextArea
                    value={form.customerAddress}
                    onValueChanged={(e) => setForm((p) => ({ ...p, customerAddress: e.value || '' }))}
                    placeholder="ที่อยู่ลูกค้า"
                    height={70}
                    elementAttr={{ 'data-testid': 'qt-customer-address-input' }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Package className="h-5 w-5 text-indigo-500" />
                    รายการสินค้า/บริการ
                    {lines.length > 0 && (
                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full">
                        {lines.length} รายการ
                      </span>
                    )}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      text="เพิ่มรายการอิสระ"
                      icon="plus"
                      stylingMode="outlined"
                      onClick={handleAddBlankLine}
                      elementAttr={{ 'data-testid': 'qt-add-blank-line-btn' }}
                    />
                    <Button
                      text="เลือกจากคลัง"
                      icon="search"
                      type="default"
                      onClick={() => setIsItemDialogOpen(true)}
                      elementAttr={{ 'data-testid': 'qt-add-item-btn' }}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {lines.length > 0 ? (
                  <>
                    <DataGrid
                      dataSource={gridData}
                      keyExpr="key"
                      showBorders={false}
                      showRowLines
                      columnAutoWidth
                      className="min-h-[200px]"
                      elementAttr={{ 'data-testid': 'qt-lines-grid' }}
                    >
                      <Paging enabled={false} />
                      <Column
                        dataField="description"
                        caption="รายละเอียด"
                        minWidth={240}
                        cellRender={renderDescriptionCell}
                        allowSorting={false}
                      />
                      <Column
                        dataField="quantity"
                        caption="จำนวน"
                        width={110}
                        cellRender={renderQuantityCell}
                        allowSorting={false}
                      />
                      <Column
                        dataField="unit"
                        caption="หน่วย"
                        width={90}
                        cellRender={renderUnitCell}
                        allowSorting={false}
                      />
                      <Column
                        dataField="unitPrice"
                        caption="ราคา/หน่วย"
                        width={130}
                        cellRender={renderUnitPriceCell}
                        allowSorting={false}
                      />
                      <Column
                        dataField="amount"
                        caption="จำนวนเงิน"
                        width={130}
                        alignment="right"
                        cellRender={renderAmountCell}
                        allowSorting={false}
                      />
                      <Column
                        dataField="notes"
                        caption="หมายเหตุ"
                        width={150}
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
                        <div className="w-full max-w-xs flex justify-between items-center">
                          <span className="text-sm text-gray-500">ยอดรวมทั้งสิ้น</span>
                          <span
                            className="text-2xl font-bold text-green-600 tabular-nums"
                            data-testid="qt-total-amount"
                          >
                            {formatNumber(totalAmount)} บาท
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12 px-4">
                    <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Package className="h-8 w-8 text-gray-400" />
                    </div>
                    <p className="text-gray-500 font-medium">ยังไม่มีรายการ</p>
                    <p className="text-sm text-gray-400 mt-1">
                      เลือกสินค้าจากคลังหรือเพิ่มรายการอิสระ
                    </p>
                    <div className="flex items-center justify-center gap-2 mt-4">
                      <Button
                        text="เพิ่มรายการอิสระ"
                        icon="plus"
                        stylingMode="outlined"
                        onClick={handleAddBlankLine}
                      />
                      <Button
                        text="เลือกจากคลัง"
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
                  หมายเหตุ
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TextArea
                  value={form.notes}
                  onValueChanged={(e) => setForm((p) => ({ ...p, notes: e.value || '' }))}
                  placeholder="หมายเหตุเพิ่มเติม"
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
                  รายละเอียดใบเสนอราคา
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">วันที่</label>
                  <DateBox
                    value={form.quotationDate || undefined}
                    onValueChanged={(e) =>
                      setForm((p) => ({ ...p, quotationDate: formatDateForApi(e.value) || '' }))
                    }
                    type="date"
                    displayFormat="d MMMM yyyy"
                    placeholder="เลือกวันที่"
                    showClearButton
                    useMaskBehavior
                    elementAttr={{ 'data-testid': 'qt-date-input' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ใช้ได้ถึง</label>
                  <DateBox
                    value={form.validUntil || undefined}
                    onValueChanged={(e) =>
                      setForm((p) => ({ ...p, validUntil: formatDateForApi(e.value) || '' }))
                    }
                    type="date"
                    displayFormat="d MMMM yyyy"
                    placeholder="เลือกวันที่"
                    showClearButton
                    useMaskBehavior
                    elementAttr={{ 'data-testid': 'qt-valid-until-input' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <CreditCard className="h-4 w-4 inline mr-1" />
                    เงื่อนไขการชำระเงิน
                  </label>
                  <TextBox
                    value={form.paymentTerms}
                    onValueChanged={(e) => setForm((p) => ({ ...p, paymentTerms: e.value || '' }))}
                    placeholder="เช่น ชำระภายใน 30 วัน"
                    elementAttr={{ 'data-testid': 'qt-payment-terms-input' }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">สรุป</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">จำนวนรายการ</span>
                  <span className="font-medium text-gray-900">{formatNumber(lines.length)} รายการ</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">ลูกค้า</span>
                  <span className="font-medium text-gray-900 truncate max-w-[150px]">
                    {form.customerName || '-'}
                  </span>
                </div>
                <div className="pt-3 border-t flex justify-between items-center">
                  <span className="text-gray-700 font-medium">ยอดรวม</span>
                  <span className="text-xl font-bold text-green-600 tabular-nums">
                    {formatNumber(totalAmount)} บาท
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
        title="เลือกสินค้า"
        showPrice="selling"
        allowCreate
        excludeIds={lines.map((l) => l.itemId).filter((id): id is number => !!id)}
      />
    </MainLayout>
  );
}
