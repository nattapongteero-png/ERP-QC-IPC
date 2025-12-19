'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { ItemSearchDialog, Item } from '@/components/ui/item-search-dialog';
import { CustomerSearchDialog, Customer } from '@/components/ui/customer-search-dialog';
import { ArrowLeft, Save, Plus, Trash2, Search, Building2, Phone, Mail, MapPin, X } from 'lucide-react';

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

  const lineColumns = [
    { key: 'itemCode', header: 'Item Code' },
    { key: 'itemName', header: 'Item Name' },
    { key: 'unit', header: 'Unit' },
    {
      key: 'quantity',
      header: 'Quantity',
      render: (line: SOLine, index: number) => (
        <Input
          type="number"
          value={line.quantity}
          onChange={(e) => handleLineChange(index, 'quantity', parseFloat(e.target.value) || 0)}
          className="w-24"
          min={0}
        />
      ),
    },
    {
      key: 'unitPrice',
      header: 'Unit Price',
      render: (line: SOLine, index: number) => (
        <Input
          type="number"
          value={line.unitPrice}
          onChange={(e) => handleLineChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
          className="w-28"
          min={0}
        />
      ),
    },
    {
      key: 'lineTotal',
      header: 'Line Total',
      render: (line: SOLine) => formatCurrency(line.quantity * line.unitPrice),
    },
    {
      key: 'actions',
      header: '',
      render: (_: SOLine, index: number) => (
        <Button
          variant="danger"
          size="sm"
          onClick={() => handleRemoveLine(index)}
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
          title="New Sales Order"
          description="สร้างใบสั่งขายใหม่"
          actions={
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => router.push('/sales/orders')} leftIcon={<ArrowLeft className="h-4 w-4" />}>
                Back
              </Button>
              <Button onClick={handleSave} disabled={isSaving} leftIcon={<Save className="h-4 w-4" />}>
                {isSaving ? 'Saving...' : 'Save Order'}
              </Button>
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
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setIsCustomerDialogOpen(true)}
                      >
                        Change
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={handleClearCustomer}
                        title="Clear customer"
                      >
                        <X className="h-4 w-4" />
                      </Button>
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
              <Input
                label="Required Date"
                type="date"
                value={form.requiredDate}
                onChange={(e) => setForm({ ...form, requiredDate: e.target.value })}
              />
              <Input
                label="Payment Terms"
                value={form.paymentTerms}
                onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}
                placeholder="e.g., Net 30"
              />
              <div className="md:col-span-2">
                <Input
                  label="Shipping Address"
                  value={form.customerAddress}
                  onChange={(e) => setForm({ ...form, customerAddress: e.target.value })}
                  placeholder="e.g., 123 Main Street, Bangkok"
                />
              </div>
              <div className="md:col-span-2">
                <Input
                  label="Notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
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
              <Button onClick={() => setIsItemDialogOpen(true)} leftIcon={<Plus className="h-4 w-4" />}>
                Add Item
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {lines.length > 0 ? (
              <>
                <Table
                  columns={lineColumns}
                  data={lines}
                  keyField="itemId"
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
                <Button className="mt-2" variant="secondary" onClick={() => setIsItemDialogOpen(true)}>
                  Add First Item
                </Button>
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
