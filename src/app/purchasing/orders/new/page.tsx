'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { PageHeader } from '@/components/ui/page-header';
import { Table } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ItemSearchDialog, Item } from '@/components/ui/item-search-dialog';
import { ArrowLeft, Plus, Trash2, Package, Building2 } from 'lucide-react';

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

  const lineColumns = [
    {
      key: 'item',
      header: 'Item',
      render: (line: POLine) => (
        <div>
          <p className="font-medium">{line.itemCode}</p>
          <p className="text-sm text-gray-500">{line.itemName}</p>
        </div>
      ),
    },
    {
      key: 'quantity',
      header: 'Quantity',
      render: (line: POLine) => `${line.quantity.toLocaleString()} ${line.itemUnit}`,
    },
    {
      key: 'unitPrice',
      header: 'Unit Price',
      render: (line: POLine) => formatCurrency(line.unitPrice),
    },
    {
      key: 'lineTotal',
      header: 'Line Total',
      render: (line: POLine) => formatCurrency(line.lineTotal),
    },
    {
      key: 'actions',
      header: '',
      render: (line: POLine) => (
        <Button
          variant="danger"
          size="sm"
          onClick={() => handleRemoveLine(line.itemId)}
          leftIcon={<Trash2 className="h-4 w-4" />}
        >
          Remove
        </Button>
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
            <Button variant="secondary" onClick={() => router.push('/purchasing/orders')} leftIcon={<ArrowLeft className="h-4 w-4" />}>
              Back
            </Button>
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
                <Select
                  label="Vendor"
                  value={formData.vendorId}
                  onChange={(e) => setFormData({ ...formData, vendorId: e.target.value })}
                  error={errors.vendorId}
                  disabled={loadingVendors}
                  options={[
                    { value: '', label: '-- Select a vendor --' },
                    ...vendors.map((v) => ({ value: v.id.toString(), label: `${v.code} - ${v.name}` })),
                  ]}
                />

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
                  <DatePicker
                    label="Expected Delivery Date"
                    value={formData.expectedDate}
                    onChange={(value) => setFormData({ ...formData, expectedDate: value })}
                    min={new Date().toISOString().split('T')[0]}
                    showQuickActions={false}
                    size="sm"
                    error={errors.expectedDate}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
                  <textarea
                    className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-base focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                    rows={3}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
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
                  <Button onClick={() => setIsItemDialogOpen(true)} leftIcon={<Plus className="h-4 w-4" />}>
                    Add Item
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {errors.lines && <p className="text-sm text-red-600">{errors.lines}</p>}
                {lines.length > 0 ? (
                  <Table columns={lineColumns} data={lines} keyField="itemId" emptyMessage="No items added" />
                ) : (
                  <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
                    <Package className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    <p>No items added yet</p>
                    <p className="text-sm">Click &quot;Add Item&quot; to search and add items</p>
                  </div>
                )}

                {lines.length > 0 && (
                  <div className="flex justify-end pt-4 border-t">
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Total Amount</p>
                      <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalAmount)}</p>
                    </div>
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
                <Button
                  onClick={handleSubmit}
                  disabled={!formData.vendorId || lines.length === 0 || isSubmitting}
                  loading={isSubmitting}
                  fullWidth
                >
                  Create Purchase Order
                </Button>
                <Button variant="secondary" onClick={() => router.push('/purchasing/orders')} fullWidth>
                  Cancel
                </Button>
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
      <Dialog open={isQuantityDialogOpen} onOpenChange={setIsQuantityDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter Quantity & Price</DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="font-medium text-blue-900">{selectedItem.code}</p>
                <p className="text-sm text-blue-700">{selectedItem.nameTh || selectedItem.nameEn}</p>
                <p className="text-xs text-blue-600 mt-1">Unit: {selectedItem.primaryUnit || 'unit'}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label={`Quantity (${selectedItem.primaryUnit || 'unit'})`}
                  type="number"
                  value={itemQuantity}
                  onChange={(e) => setItemQuantity(e.target.value)}
                  min={1}
                  required
                  autoFocus
                />
                <Input
                  label="Unit Price (THB)"
                  type="number"
                  value={itemUnitPrice}
                  onChange={(e) => setItemUnitPrice(e.target.value)}
                  min={0}
                  step="0.01"
                  required
                />
              </div>

              {itemQuantity && itemUnitPrice && (
                <div className="text-right p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">Line Total: </span>
                  <span className="font-bold text-blue-600">
                    {formatCurrency(parseFloat(itemQuantity) * parseFloat(itemUnitPrice))}
                  </span>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setIsQuantityDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddItemToOrder}
              disabled={!itemQuantity || !itemUnitPrice || parseFloat(itemQuantity) <= 0}
            >
              Add to Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
