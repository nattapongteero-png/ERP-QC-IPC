'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxPopup } from '@/components/ui/dx-popup';
import { PageHeader } from '@/components/ui/page-header';
import { ItemSearchDialog, Item } from '@/components/ui/item-search-dialog';
import { Package, Building2 } from 'lucide-react';

interface Vendor {
  id: number;
  code: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
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

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(true);

  const [formData, setFormData] = useState({
    vendorId: '',
    expectedDate: '',
    notes: '',
  });

  const [lines, setLines] = useState<POLine[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Item selection flow
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [isQuantityDialogOpen, setIsQuantityDialogOpen] = useState(false);
  const [itemQuantity, setItemQuantity] = useState('');
  const [itemUnitPrice, setItemUnitPrice] = useState('');

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
    setItemQuantity('1');
    setItemUnitPrice(item.costPrice?.toString() || '');
    setIsQuantityDialogOpen(true);
  };

  const handleAddItemToOrder = () => {
    if (!selectedItem || !itemQuantity || !itemUnitPrice) return;

    const quantity = parseFloat(itemQuantity);
    const unitPrice = parseFloat(itemUnitPrice);

    if (quantity <= 0 || unitPrice < 0) return;

    const line: POLine = {
      itemId: selectedItem.id,
      itemCode: selectedItem.code,
      itemName: selectedItem.nameTh || selectedItem.nameEn,
      itemUnit: selectedItem.primaryUnit || 'unit',
      quantity,
      unitPrice,
      lineTotal: quantity * unitPrice,
    };

    setLines([...lines, line]);
    setSelectedItem(null);
    setItemQuantity('');
    setItemUnitPrice('');
    setIsQuantityDialogOpen(false);
    setErrors({});
  };

  const handleRemoveLine = (itemId: number) => {
    setLines(lines.filter((l) => l.itemId !== itemId));
  };

  const selectedVendor = vendors.find((v) => v.id === parseInt(formData.vendorId));
  const totalAmount = lines.reduce((sum, line) => sum + line.lineTotal, 0);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.vendorId) newErrors.vendorId = 'Please select a vendor';
    if (!formData.expectedDate) newErrors.expectedDate = 'Expected date is required';
    if (lines.length === 0) newErrors.lines = 'Please add at least one item';
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
        setErrors({ submit: result.error || 'Failed to create purchase order' });
      }
    } catch (error) {
      console.error('Failed to create PO:', error);
      setErrors({ submit: 'Failed to create purchase order. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(amount);
  };

  const vendorOptions = [
    { value: '', label: '-- เลือกผู้ขาย --' },
    ...vendors.map((v) => ({ value: v.id.toString(), label: `${v.code} - ${v.name}` })),
  ];

  const lineColumns: DxDataGridColumn[] = [
    {
      dataField: 'itemCode',
      caption: 'สินค้า',
      cellRender: (cellInfo) => (
        <div>
          <p className="font-medium">{cellInfo.data.itemCode}</p>
          <p className="text-sm text-gray-500">{cellInfo.data.itemName}</p>
        </div>
      ),
    },
    {
      dataField: 'quantity',
      caption: 'จำนวน',
      width: 120,
      cellRender: (cellInfo) => `${cellInfo.data.quantity.toLocaleString()} ${cellInfo.data.itemUnit}`,
    },
    {
      dataField: 'unitPrice',
      caption: 'ราคาต่อหน่วย',
      width: 150,
      cellRender: (cellInfo) => formatCurrency(cellInfo.data.unitPrice),
    },
    {
      dataField: 'lineTotal',
      caption: 'รวม',
      width: 150,
      cellRender: (cellInfo) => formatCurrency(cellInfo.data.lineTotal),
    },
    {
      dataField: 'actions',
      caption: '',
      width: 100,
      cellRender: (cellInfo) => (
        <DxButton
          text="ลบ"
          icon="trash"
          type="danger"
          stylingMode="text"
          onClick={() => handleRemoveLine(cellInfo.data.itemId)}
        />
      ),
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Create Purchase Order"
          description="สร้างใบสั่งซื้อใหม่"
          actions={
            <DxButton
              text="Back"
              icon="back"
              type="normal"
              stylingMode="outlined"
              onClick={() => router.push('/purchasing/orders')}
            />
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Vendor Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-gray-400" />
                  1. Select Vendor
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Vendor <span className="text-red-500">*</span>
                  </label>
                  <DxSelectBox
                    items={vendorOptions}
                    value={formData.vendorId}
                    onValueChange={(value) => setFormData({ ...formData, vendorId: value })}
                    disabled={loadingVendors}
                    placeholder="-- เลือกผู้ขาย --"
                  />
                  {errors.vendorId && (
                    <p className="text-sm text-red-600 mt-1">{errors.vendorId}</p>
                  )}
                </div>

                {selectedVendor && (
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Contact:</span>{' '}
                        <span className="font-medium">{selectedVendor.contactPerson || '-'}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Phone:</span>{' '}
                        <span className="font-medium">{selectedVendor.phone || '-'}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-600">Email:</span>{' '}
                        <span className="font-medium">{selectedVendor.email || '-'}</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Order Details */}
            <Card>
              <CardHeader>
                <CardTitle>2. Order Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Expected Delivery Date <span className="text-red-500">*</span>
                    </label>
                    <DxDateBox
                      value={formData.expectedDate}
                      onValueChange={(value) => setFormData({ ...formData, expectedDate: value || '' })}
                      min={new Date().toISOString().split('T')[0]}
                      placeholder="เลือกวันที่คาดว่าจะได้รับ"
                    />
                    {errors.expectedDate && (
                      <p className="text-sm text-red-600 mt-1">{errors.expectedDate}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <DxTextBox
                    value={formData.notes}
                    onValueChange={(value) => setFormData({ ...formData, notes: value })}
                    placeholder="Any additional notes..."
                  />
                </div>
              </CardContent>
            </Card>

            {/* Order Lines */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-gray-400" />
                    3. Order Items
                  </CardTitle>
                  <DxButton
                    text="Add Item"
                    icon="plus"
                    type="default"
                    onClick={() => setIsItemDialogOpen(true)}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {errors.lines && <p className="text-sm text-red-600">{errors.lines}</p>}
                {lines.length > 0 ? (
                  <>
                    <DxDataGrid
                      dataSource={lines}
                      keyExpr="itemId"
                      columns={lineColumns}
                      height={300}
                      noDataText="ไม่มีรายการสินค้า"
                    />
                    <div className="flex justify-end pt-4 border-t">
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Total Amount</p>
                        <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalAmount)}</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
                    <Package className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    <p>No items added yet</p>
                    <p className="text-sm">Click &quot;Add Item&quot; to search and add items</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Summary Sidebar */}
          <div className="space-y-6">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Vendor:</span>
                    <span className="font-medium">{selectedVendor?.name || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Expected Date:</span>
                    <span className="font-medium">
                      {formData.expectedDate ? new Date(formData.expectedDate).toLocaleDateString('th-TH') : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Items:</span>
                    <span className="font-medium">{lines.length}</span>
                  </div>
                  <div className="flex justify-between pt-3 border-t">
                    <span className="text-gray-600">Total Amount:</span>
                    <span className="font-bold text-lg text-blue-600">{formatCurrency(totalAmount)}</span>
                  </div>
                </div>

                {errors.submit && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600">{errors.submit}</p>
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex flex-col gap-3">
                <DxButton
                  text="Create Purchase Order"
                  type="success"
                  width="100%"
                  onClick={handleSubmit}
                  disabled={!formData.vendorId || lines.length === 0 || isSubmitting}
                />
                <DxButton
                  text="Cancel"
                  type="normal"
                  stylingMode="outlined"
                  width="100%"
                  onClick={() => router.push('/purchasing/orders')}
                />
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>

      {/* Item Search Dialog */}
      <ItemSearchDialog
        open={isItemDialogOpen}
        onOpenChange={setIsItemDialogOpen}
        onSelect={handleSelectItem}
        title="Search Items"
        showPrice="cost"
        excludeIds={lines.map((l) => l.itemId)}
      />

      {/* Quantity & Price Dialog */}
      <DxPopup
        visible={isQuantityDialogOpen}
        onHiding={() => setIsQuantityDialogOpen(false)}
        title="Enter Quantity & Price"
        width={500}
        height="auto"
        showCloseButton
      >
        {selectedItem && (
          <div className="space-y-4 p-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="font-medium text-blue-900">{selectedItem.code}</p>
              <p className="text-sm text-blue-700">{selectedItem.nameTh || selectedItem.nameEn}</p>
              <p className="text-xs text-blue-600 mt-1">Unit: {selectedItem.primaryUnit || 'unit'}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity ({selectedItem.primaryUnit || 'unit'})
                </label>
                <DxTextBox
                  value={itemQuantity}
                  onValueChange={setItemQuantity}
                  placeholder="Enter quantity"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Unit Price (THB)
                </label>
                <DxTextBox
                  value={itemUnitPrice}
                  onValueChange={setItemUnitPrice}
                  placeholder="Enter price"
                />
              </div>
            </div>

            {itemQuantity && itemUnitPrice && (
              <div className="text-right p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">Line Total: </span>
                <span className="font-bold text-blue-600">
                  {formatCurrency(parseFloat(itemQuantity) * parseFloat(itemUnitPrice))}
                </span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t">
              <DxButton
                text="Cancel"
                type="normal"
                stylingMode="outlined"
                onClick={() => setIsQuantityDialogOpen(false)}
              />
              <DxButton
                text="Add to Order"
                type="success"
                onClick={handleAddItemToOrder}
                disabled={!itemQuantity || !itemUnitPrice || parseFloat(itemQuantity) <= 0}
              />
            </div>
          </div>
        )}
      </DxPopup>
    </MainLayout>
  );
}
