'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { DxCheckBox } from '@/components/ui/dx-check-box';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { ItemSearchDialog, Item } from '@/components/ui/item-search-dialog';
import {
  Package,
  ChevronRight,
  BoxSelect,
} from 'lucide-react';

interface BOMLine {
  id: number;
  itemId: number;
  itemCode: string;
  itemName: string;
  quantity: number;
  unit: string;
  isOptional: boolean;
  notes: string;
}

export default function NewBOMPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  // Form state
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Item | null>(null);
  const [version, setVersion] = useState('1.0');
  const [batchSize, setBatchSize] = useState('');
  const [batchUnit, setBatchUnit] = useState('');
  const [yieldTarget, setYieldTarget] = useState('95');
  const [lossAllowance, setLossAllowance] = useState('5');
  const [theoreticalYield, setTheoreticalYield] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [lines, setLines] = useState<BOMLine[]>([]);

  // Dialog state
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [materialDialogOpen, setMaterialDialogOpen] = useState(false);

  // Line counter for temporary IDs
  const [lineCounter, setLineCounter] = useState(1);

  // Handle product selection from ItemSearchDialog
  const handleSelectProduct = (item: Item) => {
    setSelectedProduct(item);
    setBatchUnit(item.primaryUnit);
    // Auto-generate BOM code based on product code
    if (!code) {
      setCode(`BOM-${item.code}`);
    }
    if (!name) {
      setName(`BOM for ${item.nameTh}`);
    }
    setProductDialogOpen(false);
  };

  // Handle material/ingredient selection from ItemSearchDialog
  const handleAddMaterial = (item: Item) => {
    // Check if item already exists in lines
    if (lines.some(line => line.itemId === item.id)) {
      alert('This item is already in the BOM');
      return;
    }

    const newLine: BOMLine = {
      id: lineCounter,
      itemId: item.id,
      itemCode: item.code,
      itemName: item.nameTh,
      quantity: 0,
      unit: item.primaryUnit,
      isOptional: false,
      notes: '',
    };

    setLines([...lines, newLine]);
    setLineCounter(lineCounter + 1);
    setMaterialDialogOpen(false);
  };

  const handleUpdateLine = (id: number, field: keyof BOMLine, value: string | number | boolean) => {
    setLines(lines.map(line =>
      line.id === id ? { ...line, [field]: value } : line
    ));
  };

  const handleRemoveLine = (id: number) => {
    setLines(lines.filter(line => line.id !== id));
  };

  const handleSubmit = async () => {
    if (!code || !name || !selectedProduct || !batchSize || !batchUnit) {
      alert('Please fill in all required fields');
      return;
    }

    if (lines.length === 0) {
      alert('Please add at least one material to the BOM');
      return;
    }

    // Validate all lines have quantities
    const invalidLines = lines.filter(line => !line.quantity || line.quantity <= 0);
    if (invalidLines.length > 0) {
      alert('Please enter valid quantities for all materials');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/bom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          name,
          productId: selectedProduct.id,
          version,
          batchSize: parseFloat(batchSize),
          batchUnit,
          yieldTarget: yieldTarget ? parseFloat(yieldTarget) : null,
          lossAllowance: lossAllowance ? parseFloat(lossAllowance) : null,
          theoreticalYield: theoreticalYield ? parseFloat(theoreticalYield) : null,
          effectiveDate: effectiveDate || null,
          lines: lines.map((line, index) => ({
            itemId: line.itemId,
            quantity: line.quantity,
            unit: line.unit,
            sequence: index + 1,
            isOptional: line.isOptional,
            notes: line.notes,
          })),
        }),
      });

      const result = await response.json();
      if (result.success) {
        router.push(`/production/bom/${result.data.id}`);
      }
      // Error is handled by global error handler - no need for alert
    } catch (error) {
      console.error('Failed to create BOM:', error);
      // Network error is handled by global error handler
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
        <PageHeader
          title="Create New BOM"
          description="Define a new Bill of Materials / Recipe"
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Product Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Product <span className="text-red-500">*</span>
                  </label>
                  {selectedProduct ? (
                    <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                          <Package className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-emerald-800">{selectedProduct.code}</p>
                          <p className="text-sm text-emerald-600">{selectedProduct.nameTh}</p>
                        </div>
                      </div>
                      <DxButton
                        text="Change"
                        type="normal"
                        stylingMode="outlined"
                        onClick={() => setProductDialogOpen(true)}
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setProductDialogOpen(true)}
                      className="w-full flex items-center justify-between p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-emerald-400 hover:bg-emerald-50 transition-colors group"
                    >
                      <div className="flex items-center gap-3 text-gray-500 group-hover:text-emerald-600">
                        <BoxSelect className="h-5 w-5" />
                        <span>Click to select a product...</span>
                      </div>
                      <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-emerald-500" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      BOM Code <span className="text-red-500">*</span>
                    </label>
                    <DxTextBox
                      value={code}
                      onValueChange={setCode}
                      placeholder="e.g., BOM-PROD001"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Version
                    </label>
                    <DxTextBox
                      value={version}
                      onValueChange={setVersion}
                      placeholder="1.0"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    BOM Name <span className="text-red-500">*</span>
                  </label>
                  <DxTextBox
                    value={name}
                    onValueChange={setName}
                    placeholder="e.g., BOM for Product ABC"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Batch Size <span className="text-red-500">*</span>
                    </label>
                    <DxTextBox
                      value={batchSize}
                      onValueChange={setBatchSize}
                      placeholder="e.g., 1000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Batch Unit <span className="text-red-500">*</span>
                    </label>
                    <DxTextBox
                      value={batchUnit}
                      onValueChange={setBatchUnit}
                      placeholder="e.g., kg, L, pcs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Theoretical Yield ({selectedProduct?.primaryUnit || batchUnit || 'unit'})
                  </label>
                  <DxTextBox
                    value={theoreticalYield}
                    onValueChange={setTheoreticalYield}
                    placeholder={`Expected output quantity in ${selectedProduct?.primaryUnit || batchUnit || 'unit'}`}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Expected quantity of finished product from this batch
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Yield Target (%)
                    </label>
                    <DxTextBox
                      value={yieldTarget}
                      onValueChange={setYieldTarget}
                      placeholder="95"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Loss Allowance (%)
                    </label>
                    <DxTextBox
                      value={lossAllowance}
                      onValueChange={setLossAllowance}
                      placeholder="5"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Effective Date
                  </label>
                  <DxDateBox
                    value={effectiveDate}
                    onValueChange={(value) => setEffectiveDate(value || '')}
                    placeholder="เลือกวันที่มีผลบังคับใช้"
                  />
                </div>
              </CardContent>
            </Card>

            {/* BOM Lines */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Materials / Ingredients</CardTitle>
                  <DxButton
                    text="Add Material"
                    icon="plus"
                    type="normal"
                    stylingMode="outlined"
                    onClick={() => setMaterialDialogOpen(true)}
                  />
                </div>
              </CardHeader>
              <CardContent>

                {/* Lines Table */}
                {lines.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">#</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Item</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Quantity</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Unit</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Optional</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Notes</th>
                          <th className="px-4 py-2 text-center text-sm font-medium text-gray-600">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map((line, index) => (
                          <tr key={line.id} className="border-b hover:bg-gray-50">
                            <td className="px-4 py-2 text-center">{index + 1}</td>
                            <td className="px-4 py-2">
                              <p className="font-medium">{line.itemCode}</p>
                              <p className="text-sm text-gray-500">{line.itemName}</p>
                            </td>
                            <td className="px-4 py-2">
                              <DxTextBox
                                value={line.quantity?.toString() || ''}
                                onValueChange={(value) => handleUpdateLine(line.id, 'quantity', parseFloat(value) || 0)}
                                width={100}
                              />
                            </td>
                            <td className="px-4 py-2">
                              <DxTextBox
                                value={line.unit}
                                onValueChange={(value) => handleUpdateLine(line.id, 'unit', value)}
                                width={80}
                              />
                            </td>
                            <td className="px-4 py-2">
                              <DxCheckBox
                                value={line.isOptional}
                                onValueChange={(value) => handleUpdateLine(line.id, 'isOptional', value)}
                              />
                            </td>
                            <td className="px-4 py-2">
                              <DxTextBox
                                value={line.notes}
                                onValueChange={(value) => handleUpdateLine(line.id, 'notes', value)}
                                placeholder="Notes..."
                                width={130}
                              />
                            </td>
                            <td className="px-4 py-2 text-center">
                              <DxButton
                                icon="trash"
                                type="danger"
                                stylingMode="text"
                                onClick={() => handleRemoveLine(line.id)}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No materials added yet</p>
                    <p className="text-sm">Click &quot;Add Material&quot; to add ingredients to this BOM</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-gray-500">Product</p>
                  <p className="font-medium">{selectedProduct?.nameTh || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Batch Size</p>
                  <p className="font-medium">{batchSize ? `${batchSize} ${batchUnit}` : '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Materials</p>
                  <p className="font-medium">{lines.length} items</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <Badge variant="secondary">Draft</Badge>
                </div>

                <div className="pt-4 border-t space-y-2">
                  <DxButton
                    text={saving ? 'Creating...' : 'Create BOM'}
                    icon="save"
                    type="success"
                    width="100%"
                    onClick={handleSubmit}
                    disabled={saving || !code || !name || !selectedProduct || !batchSize || lines.length === 0}
                  />
                  <DxButton
                    text="Cancel"
                    type="normal"
                    stylingMode="outlined"
                    width="100%"
                    onClick={() => router.push('/production/bom')}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

      {/* Product Selection Dialog */}
      <ItemSearchDialog
        open={productDialogOpen}
        onOpenChange={setProductDialogOpen}
        onSelect={handleSelectProduct}
        title="Select Product"
        filterType="finished_goods"
      />

      {/* Material Selection Dialog */}
      <ItemSearchDialog
        open={materialDialogOpen}
        onOpenChange={setMaterialDialogOpen}
        onSelect={handleAddMaterial}
        title="Select Material"
        excludeType="finished_goods"
        excludeIds={lines.map(l => l.itemId)}
      />
    </div>
  );
}
