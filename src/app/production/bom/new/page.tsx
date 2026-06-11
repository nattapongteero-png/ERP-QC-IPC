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
import { ItemEditDialog, type ItemFormData } from '@/components/ui/item-edit-dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Package,
  ChevronRight,
  BoxSelect,
  Leaf,
  Search,
  CheckCircle2,
} from 'lucide-react';

// Item-type → colored badge config for the material picker grid.
const materialTypeBadge: Record<string, { label: string; cls: string }> = {
  raw_material: { label: 'วัตถุดิบ', cls: 'bg-emerald-100 text-emerald-700' },
  packaging: { label: 'บรรจุภัณฑ์', cls: 'bg-blue-100 text-blue-700' },
  wip: { label: 'งานระหว่างทำ', cls: 'bg-orange-100 text-orange-700' },
  extract: { label: 'สารสกัด', cls: 'bg-indigo-100 text-indigo-700' },
  consumable: { label: 'วัสดุสิ้นเปลือง', cls: 'bg-slate-100 text-slate-600' },
};

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
  const toast = useToast();

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
  // Fill weight per sub-unit (mg of powder per capsule/tablet). Used by the WO
  // bulk-yield step: bulk weight ÷ fillWeightMg = capsule count.
  const [fillWeightMg, setFillWeightMg] = useState('');
  const [theoreticalYield, setTheoreticalYield] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [lines, setLines] = useState<BOMLine[]>([]);

  // Dialog state
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const [materialItems, setMaterialItems] = useState<Item[]>([]);
  const [materialItemsLoading, setMaterialItemsLoading] = useState(false);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<number[]>([]);
  // Create-new-item dialog opened from inside the material picker, for materials
  // that don't exist in the Item master yet.
  const [createItemOpen, setCreateItemOpen] = useState(false);
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

  // Count of materials currently in stock — shown in the picker header stats.
  const materialInStockCount = materialItems.filter(
    (item) => (Number(item.onHand) || 0) > 0
  ).length;

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

  // Create a brand-new Item (raw material / packaging) from inside the picker,
  // then reload the list so it can be selected right away. Mirrors the
  // allowCreate flow in ItemSearchDialog (DRY).
  const handleSaveNewItem = async (data: ItemFormData) => {
    const res = await fetch('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.error || 'Failed to create item');

    toast.success('สร้างรายการสำเร็จ', `${data.code} - ${data.nameTh}`);
    setCreateItemOpen(false);
    // Reload picker list so the new item appears and can be selected immediately.
    await loadMaterialItems();
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
          fillWeightMg: fillWeightMg ? parseFloat(fillWeightMg) : null,
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

                {/* Fill weight per capsule/tablet — drives the WO bulk-yield
                    calc (bulk weight ÷ fillWeightMg = capsule count) and, with
                    the empty-capsule line, the final per-unit weight. Shows the
                    selected product's strength for reference. */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    น้ำหนักผงต่อหน่วย (Fill weight, mg/แคปซูล)
                  </label>
                  <DxTextBox
                    value={fillWeightMg}
                    onValueChange={setFillWeightMg}
                    placeholder="เช่น 500"
                  />
                  {selectedProduct?.strengthValue != null && (
                    <p className="mt-1 text-xs text-emerald-700">
                      ความแรงของสินค้า: {selectedProduct.strengthValue} {selectedProduct.strengthUnit || ''}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    น้ำหนักผงยาที่บรรจุต่อ 1 แคปซูล/เม็ด — ใช้คำนวณจำนวนแคปซูลจากน้ำหนัก bulk ในขั้นตอนผลิต
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
        filterType={['finished_goods', 'wip']}
        allowCreate
      />

      {/* Multi-Select Material Picker Dialog */}
      <DxPopup
        visible={materialPickerOpen}
        onHiding={() => setMaterialPickerOpen(false)}
        title=""
        showTitle={false}
        width="92%"
        maxWidth={1080}
        height="88%"
        maxHeight={820}
        showCloseButton
      >
        <div className="flex flex-col h-full bg-slate-50 -m-4">
          {/* ── Gradient header with live stats ── */}
          <div className="flex-none bg-gradient-to-r from-emerald-600 via-emerald-600 to-teal-600 px-6 py-5 text-white">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
                  <Leaf className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold leading-tight">เลือกวัตถุดิบ</h2>
                  <p className="text-sm text-emerald-50/90">
                    Select Materials · เลือกได้หลายรายการพร้อมกัน
                  </p>
                </div>
              </div>
              {/* live stats */}
              <div className="flex items-center gap-2.5">
                <div className="rounded-xl bg-white/10 px-4 py-2 text-center ring-1 ring-white/15">
                  <p className="text-2xl font-bold leading-none">{materialItems.length}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-wide text-emerald-50/80">รายการ</p>
                </div>
                <div className="rounded-xl bg-white/10 px-4 py-2 text-center ring-1 ring-white/15">
                  <p className="text-2xl font-bold leading-none text-emerald-100">{materialInStockCount}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-wide text-emerald-50/80">มีสต็อก</p>
                </div>
                <div className="rounded-xl bg-white px-4 py-2 text-center text-emerald-700 shadow-sm">
                  <p className="text-2xl font-bold leading-none">{selectedMaterialIds.length}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-wide text-emerald-600/80">เลือกแล้ว</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Toolbar: helper text + add-new ── */}
          <div className="flex-none border-b border-slate-200 bg-white px-6 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-sm text-slate-500">
                <Search className="h-4 w-4 text-slate-400" />
                ใช้ช่องค้นหาในตารางเพื่อกรองตามรหัส/ชื่อ แล้วติ๊กเลือกรายการที่ต้องการ
              </p>
              {/* Add a material that doesn't exist in the Item master yet */}
              <DxButton
                text="+ เพิ่ม Item ใหม่"
                type="success"
                stylingMode="outlined"
                onClick={() => setCreateItemOpen(true)}
                elementAttr={{ 'data-testid': 'bom-material-create-btn' }}
              />
            </div>
          </div>

          {/* ── Grid body ── */}
          <div className="min-h-0 flex-1 overflow-hidden px-6 py-4">
            {materialItemsLoading ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center text-slate-400">
                  <div className="mx-auto mb-3 h-9 w-9 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-600" />
                  <p className="text-sm">กำลังโหลดรายการวัตถุดิบ...</p>
                </div>
              </div>
            ) : materialItems.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="mb-4 rounded-full bg-slate-100 p-6">
                  <Package className="h-12 w-12 text-slate-300" />
                </div>
                <p className="mb-1 text-lg font-medium text-slate-700">ยังไม่มีวัตถุดิบในระบบ</p>
                <p className="mb-4 text-sm text-slate-400">
                  วัตถุดิบที่ยังไม่มีในรายการ สามารถกดเพิ่มใหม่ได้จากปุ่มด้านล่าง
                </p>
                <DxButton
                  text="+ เพิ่ม Item ใหม่"
                  type="success"
                  stylingMode="contained"
                  onClick={() => setCreateItemOpen(true)}
                />
              </div>
            ) : (
              <div className="h-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <DxDataGrid
                  dataSource={materialItems}
                  keyExpr="id"
                  showBorders={false}
                  showRowLines
                  rowAlternationEnabled
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
                    {
                      dataField: 'code',
                      caption: 'รหัส',
                      width: 150,
                      cellRender: (cellData) => (
                        <span className="font-semibold text-emerald-700">{cellData.value as string}</span>
                      ),
                    },
                    {
                      dataField: 'nameTh',
                      caption: 'ชื่อวัตถุดิบ',
                      minWidth: 200,
                      cellRender: (cellData) => (
                        <div>
                          <p className="font-medium text-slate-800">{cellData.value as string}</p>
                          {cellData.data?.nameEn && (
                            <p className="text-xs text-slate-400">{cellData.data.nameEn as string}</p>
                          )}
                        </div>
                      ),
                    },
                    {
                      dataField: 'type',
                      caption: 'ประเภท',
                      width: 130,
                      cellRender: (cellData) => {
                        const cfg = materialTypeBadge[cellData.value as string] || {
                          label: (cellData.value as string) || '-',
                          cls: 'bg-slate-100 text-slate-600',
                        };
                        return (
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.cls}`}>
                            {cfg.label}
                          </span>
                        );
                      },
                    },
                    { dataField: 'primaryUnit', caption: 'หน่วย', width: 80, alignment: 'center' },
                    {
                      dataField: 'onHand',
                      caption: 'คงเหลือ',
                      width: 130,
                      dataType: 'number',
                      format: '#,##0.##',
                      alignment: 'right',
                      cellRender: (cellData) => {
                        const qty = Number(cellData.value) || 0;
                        const reorder = Number(cellData.data?.reorderPoint) || 0;
                        const tone =
                          qty <= 0
                            ? 'text-red-600'
                            : qty <= reorder
                              ? 'text-amber-600'
                              : 'text-emerald-600';
                        const dot =
                          qty <= 0 ? 'bg-red-500' : qty <= reorder ? 'bg-amber-500' : 'bg-emerald-500';
                        return (
                          <span className={`inline-flex items-center justify-end gap-1.5 font-semibold ${tone}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                            {qty.toLocaleString()}
                          </span>
                        );
                      },
                    },
                  ]}
                />
              </div>
            )}
          </div>

          {/* ── Sticky footer: selection summary + actions ── */}
          <div className="flex-none border-t border-slate-200 bg-white px-6 py-3.5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm">
                {selectedMaterialIds.length > 0 ? (
                  <span className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5 font-medium text-emerald-700 ring-1 ring-emerald-200">
                    <CheckCircle2 className="h-4 w-4" />
                    เลือกแล้ว {selectedMaterialIds.length} รายการ
                  </span>
                ) : (
                  <span className="text-slate-400">ยังไม่ได้เลือกรายการ</span>
                )}
              </div>
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
                  elementAttr={{ 'data-testid': 'bom-material-confirm-btn' }}
                />
              </div>
            </div>
          </div>
        </div>
      </DxPopup>

      {/* Create New Item dialog — for materials not yet in the Item master.
          Opened from the material picker; on save it reloads the picker list. */}
      <ItemEditDialog
        open={createItemOpen}
        onOpenChange={setCreateItemOpen}
        onSave={handleSaveNewItem}
      />
    </div>
  );
}
