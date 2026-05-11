'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { DxCheckBox } from '@/components/ui/dx-check-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxPopup } from '@/components/ui/dx-popup';
import { DxDataGrid } from '@/components/ui/dx-data-grid';
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
  unitOptions: string[]; // Available units for this item (primary + secondary)
  isOptional: boolean;
  notes: string;
}

export default function NewBOMPage() {
  const router = useRouter();
  const t = useTranslations('production');

  // Use translation for page title
  const pageTitle = t('newBOM.title');
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
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const [materialItems, setMaterialItems] = useState<Item[]>([]);
  const [materialItemsLoading, setMaterialItemsLoading] = useState(false);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<number[]>([]);
  // materialGridRef removed - tracking selection via onSelectionChanged state

  // Line counter for temporary IDs
  const [lineCounter, setLineCounter] = useState(1);

  // Fetch all inventory items (exclude finished_goods) for material picker
  const loadMaterialItems = useCallback(async () => {
    setMaterialItemsLoading(true);
    try {
      const res = await fetch('/api/items?limit=500&activeOnly=true');
      const data = await res.json();
      if (data.success) {
        const allItems: Item[] = (data.data?.items || data.data || []);
        // Filter: exclude finished_goods and already-added items
        const existingIds = new Set(lines.map(l => l.itemId));
        const filtered = allItems.filter(
          (item: Item) => item.type !== 'finished_goods' && !existingIds.has(item.id)
        );
        setMaterialItems(filtered);
      }
    } catch (err) {
      console.error('Failed to load items:', err);
    } finally {
      setMaterialItemsLoading(false);
    }
  }, [lines]);

  // Handle product selection from ItemSearchDialog
  const handleSelectProduct = async (item: Item) => {
    setSelectedProduct(item);
    setBatchUnit(item.primaryUnit);
    if (!code) {
      // Generate unique BOM code by checking existing codes
      const baseCode = `BOM-${item.code}`;
      try {
        const res = await fetch(`/api/bom?search=${encodeURIComponent(baseCode)}&limit=100`);
        const data = await res.json();
        const existingCodes = new Set(
          (data.data?.items || []).map((b: { code: string }) => b.code)
        );
        if (!existingCodes.has(baseCode)) {
          setCode(baseCode);
        } else {
          // Find next available version number
          let ver = 2;
          while (existingCodes.has(`${baseCode}-V${ver}`)) {
            ver++;
          }
          setCode(`${baseCode}-V${ver}`);
        }
      } catch {
        // Fallback: append timestamp to guarantee uniqueness
        setCode(`${baseCode}-${Date.now().toString(36).slice(-4).toUpperCase()}`);
      }
    }
    if (!name) {
      setName(`BOM for ${item.nameTh}`);
    }
    setProductDialogOpen(false);
  };

  // Handle open material picker
  const handleOpenMaterialPicker = () => {
    setSelectedMaterialIds([]);
    loadMaterialItems();
    setMaterialPickerOpen(true);
  };

  // Handle confirm add selected materials
  const handleConfirmAddMaterials = () => {
    const selectedItems = materialItems.filter(item => selectedMaterialIds.includes(item.id));
    if (selectedItems.length === 0) return;

    let counter = lineCounter;
    const newLines: BOMLine[] = selectedItems.map(item => {
      const unitOpts = [item.primaryUnit];
      if (item.secondaryUnit && item.secondaryUnit !== item.primaryUnit) unitOpts.push(item.secondaryUnit);
      if (item.weightUnit && !unitOpts.includes(item.weightUnit)) unitOpts.push(item.weightUnit);
      const line: BOMLine = {
        id: counter++,
        itemId: item.id,
        itemCode: item.code,
        itemName: item.nameTh,
        quantity: 0,
        unit: item.primaryUnit,
        unitOptions: unitOpts,
        isOptional: false,
        notes: '',
      };
      return line;
    });

    setLines(prev => [...prev, ...newLines]);
    setLineCounter(counter);
    setMaterialPickerOpen(false);
    setSelectedMaterialIds([]);
  };

  const handleUpdateLine = (id: number, field: keyof BOMLine, value: string | number | boolean) => {
    setLines(lines.map(line =>
      line.id === id ? { ...line, [field]: value } : line
    ));
  };

  const handleRemoveLine = (id: number) => {
    setLines(lines.filter(line => line.id !== id));
  };

  // Validation errors state
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [invalidLineIds, setInvalidLineIds] = useState<Set<number>>(new Set());

  const handleSubmit = async () => {
    const errors: string[] = [];
    const badLineIds = new Set<number>();

    if (!selectedProduct) errors.push('กรุณาเลือกสินค้า (Product)');
    if (!code) errors.push('กรุณาระบุรหัส BOM (BOM Code)');
    if (!batchSize) errors.push('กรุณาระบุขนาดชุดผลิต (Batch Size)');
    if (!batchUnit) errors.push('กรุณาระบุหน่วยชุดผลิต (Batch Unit)');
    if (!name) errors.push('กรุณาระบุชื่อ BOM (BOM Name)');

    if (lines.length === 0) {
      errors.push('กรุณาเพิ่มวัตถุดิบอย่างน้อย 1 รายการ');
    } else {
      lines.forEach(line => {
        if (!line.quantity || line.quantity <= 0) {
          badLineIds.add(line.id);
        }
      });
      if (badLineIds.size > 0) {
        errors.push(`กรุณาระบุจำนวน (Quantity) ให้ครบทุกรายการวัตถุดิบ (${badLineIds.size} รายการยังไม่ระบุ)`);
      }
    }

    setValidationErrors(errors);
    setInvalidLineIds(badLineIds);

    if (errors.length > 0) return;

    setSaving(true);
    try {
      const response = await fetch('/api/bom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          name,
          productId: selectedProduct!.id,
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
                    onClick={handleOpenMaterialPicker}
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
                          <tr key={line.id} className={`border-b hover:bg-gray-50 ${invalidLineIds.has(line.id) ? 'bg-red-50 border-red-200' : ''}`}>
                            <td className="px-4 py-2 text-center">{index + 1}</td>
                            <td className="px-4 py-2">
                              <p className="font-medium">{line.itemCode}</p>
                              <p className="text-sm text-gray-500">{line.itemName}</p>
                            </td>
                            <td className="px-4 py-2">
                              <DxNumberBox
                                value={line.quantity || 0}
                                onValueChange={(value) => {
                                  handleUpdateLine(line.id, 'quantity', value || 0);
                                  // Clear error for this line when user enters a value
                                  if (value && value > 0) {
                                    setInvalidLineIds(prev => {
                                      const next = new Set(prev);
                                      next.delete(line.id);
                                      return next;
                                    });
                                  }
                                }}
                                format="#,##0.####"
                                min={0}
                                step={0.1}
                                width={120}
                              />
                              {invalidLineIds.has(line.id) && (
                                <p className="text-xs text-red-500 mt-0.5">กรุณาระบุจำนวน</p>
                              )}
                            </td>
                            <td className="px-4 py-2">
                              <DxSelectBox
                                value={line.unit}
                                onValueChange={(value) => handleUpdateLine(line.id, 'unit', value)}
                                items={line.unitOptions.map(u => ({ value: u, label: u }))}
                                width={100}
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

                {validationErrors.length > 0 && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm font-semibold text-red-700 mb-1">กรุณาแก้ไขข้อมูลก่อนบันทึก:</p>
                    <ul className="text-sm text-red-600 space-y-0.5">
                      {validationErrors.map((err, i) => (
                        <li key={i}>• {err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="pt-4 border-t space-y-2">
                  <DxButton
                    text={saving ? 'Creating...' : 'Create BOM'}
                    icon="save"
                    type="success"
                    width="100%"
                    onClick={handleSubmit}
                    disabled={saving}
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
        allowCreate
      />

      {/* Multi-Select Material Picker Dialog */}
      <DxPopup
        visible={materialPickerOpen}
        onHiding={() => setMaterialPickerOpen(false)}
        title="เลือกวัตถุดิบ — Select Materials"
        width={900}
        height={600}
        showCloseButton
      >
        <div className="flex flex-col h-full p-4 gap-3">
          <p className="text-sm text-gray-500">
            เลือกวัตถุดิบที่ต้องการเพิ่มใน BOM (เลือกได้หลายรายการ) แล้วกด &quot;เพิ่มรายการที่เลือก&quot;
          </p>

          {materialItemsLoading ? (
            <div className="flex items-center justify-center flex-1">
              <div className="text-center text-gray-400">
                <div className="animate-spin h-8 w-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full mx-auto mb-2" />
                <p>กำลังโหลดรายการ...</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 min-h-0">
              <DxDataGrid
                dataSource={materialItems}
                keyExpr="id"
                showBorders
                columnAutoWidth
                height="100%"
                paging={false}
                virtualScrolling
                selection="multiple"
                selectedRowKeys={selectedMaterialIds}
                onSelectionChanged={(e) => {
                  const keys = e.selectedRowKeys as number[];
                  setSelectedMaterialIds(keys);
                }}
                searchPanel
                filterRow
                columns={[
                  { dataField: 'code', caption: 'Item Code', width: 140 },
                  { dataField: 'nameTh', caption: 'ชื่อวัตถุดิบ' },
                  { dataField: 'type', caption: 'ประเภท', width: 120,
                    cellRender: (cellData) => {
                      const typeLabels: Record<string, string> = {
                        raw_material: 'วัตถุดิบ',
                        packaging: 'บรรจุภัณฑ์',
                        wip: 'งานระหว่างทำ',
                        extract: 'สารสกัด',
                        consumable: 'วัสดุสิ้นเปลือง',
                      };
                      return <span>{typeLabels[cellData.value as string] || cellData.value}</span>;
                    },
                  },
                  { dataField: 'primaryUnit', caption: 'หน่วย', width: 80 },
                  { dataField: 'onHand', caption: 'คงเหลือ', width: 100, dataType: 'number', format: '#,##0.##',
                    cellRender: (cellData) => {
                      const qty = Number(cellData.value) || 0;
                      const color = qty <= 0 ? 'text-red-600' : qty <= (Number(cellData.data?.reorderPoint) || 0) ? 'text-amber-600' : 'text-green-600';
                      return <span className={`font-medium ${color}`}>{qty.toLocaleString()}</span>;
                    },
                  },
                ]}
              />
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t">
            <span className="text-sm text-gray-500">
              เลือกแล้ว {selectedMaterialIds.length} รายการ
            </span>
            <div className="flex gap-2">
              <DxButton
                text="ยกเลิก"
                type="normal"
                stylingMode="outlined"
                onClick={() => setMaterialPickerOpen(false)}
              />
              <DxButton
                text={`เพิ่มรายการที่เลือก (${selectedMaterialIds.length})`}
                icon="plus"
                type="success"
                onClick={handleConfirmAddMaterials}
                disabled={selectedMaterialIds.length === 0}
              />
            </div>
          </div>
        </div>
      </DxPopup>
    </div>
  );
}
