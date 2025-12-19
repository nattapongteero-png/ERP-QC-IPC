'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { ItemSearchDialog, Item } from '@/components/ui/item-search-dialog';
import { CustomerSearchDialog, Customer } from '@/components/ui/customer-search-dialog';
import { Save, Plus, Trash2, Search, Building2, Phone, Mail, MapPin, X } from 'lucide-react';

interface SOLine {
  itemId: number;
  itemCode: string;
  itemName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  notes: string;
}

export default function NewSalesOrderPage() {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false);
  const [form, setForm] = useState({
    customerName: '',
    customerContact: '',
    customerAddress: '',
    requiredDate: '',
    paymentTerms: '',
    notes: '',
  });
  const [lines, setLines] = useState<SOLine[]>([]);
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setForm({
      ...form,
      customerName: customer.name,
      customerContact: customer.contactPerson || '',
      customerAddress: customer.address || '',
      paymentTerms: customer.paymentTerms || '',
    });
  };

  const handleClearCustomer = () => {
    setSelectedCustomer(null);
    setForm({
      ...form,
      customerName: '',
      customerContact: '',
      customerAddress: '',
      paymentTerms: '',
    });
  };

  const handleSelectItem = (item: Item) => {
    setLines([...lines, {
      itemId: item.id,
      itemCode: item.code,
      itemName: item.nameTh || item.nameEn,
      unit: item.primaryUnit || 'unit',
      quantity: 1,
      unitPrice: item.sellingPrice || 0,
      notes: '',
    }]);
  };

  const handleRemoveLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  const handleLineChange = (index: number, field: keyof SOLine, value: string | number) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    setLines(newLines);
  };

  const calculateTotal = () => {
    return lines.reduce((sum, line) => sum + (line.quantity * line.unitPrice), 0);
  };

  const handleSave = async () => {
    if (!selectedCustomer && !form.customerName) {
      alert('Please select a customer');
      return;
    }
    if (lines.length === 0) {
      alert('At least one item is required');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/sales/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
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
        router.push(`/sales/orders/${result.data.id}`);
      } else {
        alert(result.error || 'Failed to create sales order');
      }
    } catch (error) {
      console.error('Failed to create sales order:', error);
      alert('Failed to create sales order');
    } finally {
      setIsSaving(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
    }).format(amount);
  };

  // Define columns for DevExtreme DataGrid
  const lineColumns: DxDataGridColumn[] = [
    {
      dataField: 'itemCode',
      caption: 'Item Code',
      width: 120,
    },
    {
      dataField: 'itemName',
      caption: 'Item Name',
    },
    {
      dataField: 'unit',
      caption: 'Unit',
      width: 80,
    },
    {
      dataField: 'quantity',
      caption: 'Quantity',
      width: 100,
      cellRender: (cellInfo) => (
        <DxTextBox
          value={cellInfo.data.quantity?.toString() || '0'}
          onValueChange={(value) => {
            const index = lines.findIndex(l => l.itemId === cellInfo.data.itemId);
            if (index !== -1) {
              handleLineChange(index, 'quantity', parseFloat(value) || 0);
            }
          }}
          width={80}
        />
      ),
    },
    {
      dataField: 'unitPrice',
      caption: 'Unit Price',
      width: 120,
      cellRender: (cellInfo) => (
        <DxTextBox
          value={cellInfo.data.unitPrice?.toString() || '0'}
          onValueChange={(value) => {
            const index = lines.findIndex(l => l.itemId === cellInfo.data.itemId);
            if (index !== -1) {
              handleLineChange(index, 'unitPrice', parseFloat(value) || 0);
            }
          }}
          width={100}
        />
      ),
    },
    {
      dataField: 'lineTotal',
      caption: 'Line Total',
      width: 120,
      cellRender: (cellInfo) => formatCurrency(cellInfo.data.quantity * cellInfo.data.unitPrice),
    },
    {
      dataField: 'actions',
      caption: '',
      width: 80,
      cellRender: (cellInfo) => (
        <DxButton
          icon="trash"
          type="danger"
          stylingMode="text"
          onClick={() => {
            const index = lines.findIndex(l => l.itemId === cellInfo.data.itemId);
            if (index !== -1) {
              handleRemoveLine(index);
            }
          }}
        />
      ),
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="New Sales Order"
          description="สร้างใบสั่งขายใหม่"
          actions={
            <div className="flex gap-2">
              <DxButton
                text="Back"
                icon="back"
                type="normal"
                stylingMode="outlined"
                onClick={() => router.push('/sales/orders')}
              />
              <DxButton
                text={isSaving ? 'Saving...' : 'Save Order'}
                icon="save"
                type="success"
                onClick={handleSave}
                disabled={isSaving}
              />
            </div>
          }
        />

        {/* Customer Information */}
        <Card>
          <CardHeader>
            <CardTitle>Customer Information</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Customer Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Customer <span className="text-red-500">*</span>
              </label>
              {selectedCustomer ? (
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-emerald-700 text-lg">{selectedCustomer.code}</span>
                        <Badge className="bg-emerald-100 text-emerald-700 text-xs">
                          {selectedCustomer.customerType.replace('_', ' ')}
                        </Badge>
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
                      <DxButton
                        text="Change"
                        type="normal"
                        stylingMode="outlined"
                        onClick={() => setIsCustomerDialogOpen(true)}
                      />
                      <DxButton
                        icon="close"
                        type="danger"
                        stylingMode="text"
                        onClick={handleClearCustomer}
                        hint="Clear customer"
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
                  <span>Click to search and select a customer...</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Required Date
                </label>
                <DxDateBox
                  value={form.requiredDate}
                  onValueChange={(value) => setForm({ ...form, requiredDate: value || '' })}
                  placeholder="เลือกวันที่ต้องการ"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Terms
                </label>
                <DxTextBox
                  value={form.paymentTerms}
                  onValueChange={(value) => setForm({ ...form, paymentTerms: value })}
                  placeholder="e.g., Net 30"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Shipping Address
                </label>
                <DxTextBox
                  value={form.customerAddress}
                  onValueChange={(value) => setForm({ ...form, customerAddress: value })}
                  placeholder="e.g., 123 Main Street, Bangkok"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <DxTextBox
                  value={form.notes}
                  onValueChange={(value) => setForm({ ...form, notes: value })}
                  placeholder="Additional notes..."
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Order Lines */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Order Lines</CardTitle>
              <DxButton
                text="Add Item"
                icon="plus"
                type="default"
                onClick={() => setIsItemDialogOpen(true)}
              />
            </div>
          </CardHeader>
          <CardContent>
            {lines.length > 0 ? (
              <>
                <DxDataGrid
                  dataSource={lines}
                  keyExpr="itemId"
                  columns={lineColumns}
                  showBorders
                  height={300}
                  noDataText="ไม่มีรายการสินค้า"
                />
                <div className="flex justify-end mt-4 pt-4 border-t">
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Total Amount</p>
                    <p className="text-2xl font-bold text-blue-600">{formatCurrency(calculateTotal())}</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No items added yet</p>
                <DxButton
                  text="Add First Item"
                  type="normal"
                  stylingMode="outlined"
                  onClick={() => setIsItemDialogOpen(true)}
                  className="mt-2"
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Customer Search Dialog */}
      <CustomerSearchDialog
        open={isCustomerDialogOpen}
        onOpenChange={setIsCustomerDialogOpen}
        onSelect={handleSelectCustomer}
        title="Search Customers"
      />

      {/* Item Search Dialog */}
      <ItemSearchDialog
        open={isItemDialogOpen}
        onOpenChange={setIsItemDialogOpen}
        onSelect={handleSelectItem}
        title="Search Items"
        showPrice="selling"
        excludeIds={lines.map(line => line.itemId)}
      />
    </MainLayout>
  );
}
