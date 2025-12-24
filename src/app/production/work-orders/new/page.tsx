'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { Package, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';

interface BOM {
  id: number;
  code: string;
  name: string;
  productId: number;
  productCode: string;
  productName: string;
  productUnit: string;
  version: string;
  status: string;
  standardBatchSize: number;
  batchUnit: string;
}

interface Material {
  itemId: number;
  itemCode: string;
  itemName: string;
  requiredQuantity: number;
  unit: string;
  availableStock: number;
  shortage: number;
}

interface BOMExplosion {
  materials: Material[];
  summary: {
    totalMaterials: number;
    totalRequired: number;
    totalShortage: number;
    hasShortage: boolean;
    canProduce: boolean;
  };
}

const priorityOptions = [
  { value: '1', label: 'Critical (1)' },
  { value: '3', label: 'High (3)' },
  { value: '5', label: 'Medium (5)' },
  { value: '7', label: 'Low (7)' },
  { value: '10', label: 'Very Low (10)' },
];

function NewWorkOrderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bomIdParam = searchParams.get('bomId');
  const [isLoading, setIsLoading] = useState(false);
  const [initialBomLoaded, setInitialBomLoaded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [boms, setBoms] = useState<BOM[]>([]);
  const [bomSearch, setBomSearch] = useState('');
  const [selectedBom, setSelectedBom] = useState<BOM | null>(null);
  const [bomExplosion, setBomExplosion] = useState<BOMExplosion | null>(null);
  const [loadingExplosion, setLoadingExplosion] = useState(false);

  // Form fields
  const [formData, setFormData] = useState({
    batchNumber: '',
    plannedQuantity: '',
    priority: '5',
    plannedStartDate: '',
    plannedEndDate: '',
    notes: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch BOMs
  const fetchBoms = async (search = '', includeAllStatuses = false) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      // Only filter by approved status if not loading a specific BOM and not searching
      if (!includeAllStatuses) {
        params.set('status', 'approved');
      }
      if (search) params.set('search', search);

      const res = await fetch(`/api/bom?${params}`);
      const data = await res.json();

      if (data.success) {
        setBoms(data.data?.items || []);
      }
    } catch (error) {
      console.error('Failed to fetch BOMs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch BOM explosion when BOM and quantity are selected
  const fetchBomExplosion = async (bomId: number, quantity: number) => {
    if (!bomId || !quantity || quantity <= 0) {
      setBomExplosion(null);
      return;
    }

    setLoadingExplosion(true);
    try {
      const res = await fetch(`/api/production/bom-explosion?bomId=${bomId}&quantity=${quantity}`);
      const data = await res.json();

      if (data.success) {
        setBomExplosion(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch BOM explosion:', error);
    } finally {
      setLoadingExplosion(false);
    }
  };

  useEffect(() => {
    // Include all statuses when a specific bomId is passed via URL
    fetchBoms('', !!bomIdParam);
  }, [bomIdParam]);

  // Load BOM from query parameter
  useEffect(() => {
    if (bomIdParam && boms.length > 0 && !initialBomLoaded) {
      const bom = boms.find((b) => b.id === parseInt(bomIdParam));
      if (bom) {
        setSelectedBom(bom);
        if (bom.standardBatchSize) {
          setFormData((prev) => ({
            ...prev,
            plannedQuantity: bom.standardBatchSize.toString(),
          }));
        }
        setInitialBomLoaded(true);
      }
    }
  }, [bomIdParam, boms, initialBomLoaded]);

  useEffect(() => {
    if (selectedBom && formData.plannedQuantity) {
      const quantity = parseFloat(formData.plannedQuantity);
      if (quantity > 0) {
        const debounce = setTimeout(() => {
          fetchBomExplosion(selectedBom.id, quantity);
        }, 500);
        return () => clearTimeout(debounce);
      }
    } else {
      setBomExplosion(null);
    }
  }, [selectedBom, formData.plannedQuantity]);

  const handleBomSelect = (bomId: string) => {
    const bom = boms.find((b) => b.id === parseInt(bomId));
    setSelectedBom(bom || null);
    if (bom?.standardBatchSize) {
      setFormData((prev) => ({
        ...prev,
        plannedQuantity: bom.standardBatchSize.toString(),
      }));
    }
  };

  const generateBatchNumber = () => {
    if (!selectedBom) return;
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const batchNumber = `${selectedBom.productCode}-${year}${month}${day}-${random}`;
    setFormData((prev) => ({ ...prev, batchNumber }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!selectedBom) {
      newErrors.bom = 'Please select a BOM';
    }
    if (!formData.batchNumber.trim()) {
      newErrors.batchNumber = 'Batch number is required';
    }
    if (!formData.plannedQuantity || parseFloat(formData.plannedQuantity) <= 0) {
      newErrors.plannedQuantity = 'Valid planned quantity is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm() || !selectedBom) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/production/work-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bomId: selectedBom.id,
          productId: selectedBom.productId,
          batchNumber: formData.batchNumber,
          plannedQuantity: parseFloat(formData.plannedQuantity),
          unit: selectedBom.productUnit || selectedBom.batchUnit || 'unit',
          priority: parseInt(formData.priority),
          plannedStartDate: formData.plannedStartDate || null,
          plannedEndDate: formData.plannedEndDate || null,
          notes: formData.notes || null,
        }),
      });

      const result = await response.json();

      if (result.success) {
        router.push(`/production/work-orders/${result.data.id}`);
      } else {
        setErrors({ submit: result.error || 'Failed to create work order' });
      }
    } catch (error) {
      console.error('Failed to create work order:', error);
      setErrors({ submit: 'Failed to create work order. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const bomOptions = [
    { value: '', label: '-- เลือก BOM --' },
    ...boms.map((bom) => ({
      value: bom.id.toString(),
      label: `${bom.code} - ${bom.name} (${bom.productCode})`,
    })),
  ];

  const materialColumns: DxDataGridColumn[] = [
    { dataField: 'itemCode', caption: 'รหัสสินค้า', width: 120 },
    { dataField: 'itemName', caption: 'ชื่อสินค้า' },
    {
      dataField: 'requiredQuantity',
      caption: 'ต้องการ',
      width: 120,
      cellRender: (cellInfo) => `${cellInfo.data.requiredQuantity.toLocaleString()} ${cellInfo.data.unit}`,
    },
    {
      dataField: 'availableStock',
      caption: 'คงคลัง',
      width: 120,
      cellRender: (cellInfo) => `${cellInfo.data.availableStock.toLocaleString()} ${cellInfo.data.unit}`,
    },
    {
      dataField: 'shortage',
      caption: 'ขาด',
      width: 120,
      cellRender: (cellInfo) =>
        cellInfo.data.shortage > 0 ? (
          <span className="text-red-600 font-medium">
            -{cellInfo.data.shortage.toLocaleString()} {cellInfo.data.unit}
          </span>
        ) : (
          <span className="text-green-600">OK</span>
        ),
    },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        title="Create Work Order"
        description="สร้างใบสั่งผลิตใหม่"
        backButton={
          <DxButton
            icon="back"
            type="normal"
            stylingMode="text"
            onClick={() => router.push('/production/work-orders')}
          />
        }
      />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* BOM Selection */}
            <Card>
              <CardHeader>
                <CardTitle>1. Select Recipe (BOM)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <DxTextBox
                      placeholder="Search BOM by code or name..."
                      value={bomSearch}
                      onValueChange={setBomSearch}
                      mode="search"
                      showClearButton
                      onEnterKey={() => fetchBoms(bomSearch, !!bomIdParam)}
                    />
                  </div>
                  <DxButton
                    text="Search"
                    type="normal"
                    stylingMode="outlined"
                    onClick={() => fetchBoms(bomSearch, !!bomIdParam)}
                  />
                </div>

                {errors.bom && <p className="text-sm text-red-600">{errors.bom}</p>}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Select BOM</label>
                  <DxSelectBox
                    items={bomOptions}
                    value={selectedBom?.id?.toString() || ''}
                    onValueChange={handleBomSelect}
                    disabled={isLoading}
                    placeholder="-- เลือก BOM --"
                  />
                </div>

                {selectedBom && (
                  <div className="mt-4 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                    <div className="flex items-start gap-3">
                      <Package className="h-5 w-5 text-emerald-600 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-semibold text-emerald-800">Selected Product</h4>
                        <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Product Code:</span>{' '}
                            <span className="font-medium">{selectedBom.productCode}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Product Name:</span>{' '}
                            <span className="font-medium">{selectedBom.productName}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Unit:</span>{' '}
                            <span className="font-medium">{selectedBom.productUnit || selectedBom.batchUnit}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Standard Batch:</span>{' '}
                            <span className="font-medium">
                              {selectedBom.standardBatchSize?.toLocaleString() || '-'} {selectedBom.batchUnit}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Work Order Details */}
            <Card>
              <CardHeader>
                <CardTitle>2. Work Order Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Batch Number <span className="text-red-500">*</span>
                        </label>
                        <DxTextBox
                          value={formData.batchNumber}
                          onValueChange={(value) =>
                            setFormData((prev) => ({ ...prev, batchNumber: value }))
                          }
                          placeholder="e.g., PRD-240101-001"
                        />
                      </div>
                      <DxButton
                        text="Generate"
                        type="normal"
                        stylingMode="outlined"
                        onClick={generateBatchNumber}
                        disabled={!selectedBom}
                      />
                    </div>
                    {errors.batchNumber && (
                      <p className="text-sm text-red-600 mt-1">{errors.batchNumber}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Planned Quantity <span className="text-red-500">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <DxTextBox
                          value={formData.plannedQuantity}
                          onValueChange={(value) =>
                            setFormData((prev) => ({ ...prev, plannedQuantity: value }))
                          }
                          placeholder="Enter quantity"
                        />
                      </div>
                      <span className="text-gray-400 text-sm">
                        {selectedBom?.productUnit || selectedBom?.batchUnit || 'unit'}
                      </span>
                    </div>
                    {errors.plannedQuantity && (
                      <p className="text-sm text-red-600 mt-1">{errors.plannedQuantity}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                    <DxSelectBox
                      items={priorityOptions}
                      value={formData.priority}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, priority: value }))
                      }
                    />
                  </div>

                  <div></div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Planned Start Date
                    </label>
                    <DxDateBox
                      value={formData.plannedStartDate}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, plannedStartDate: value || '' }))
                      }
                      max={formData.plannedEndDate || undefined}
                      placeholder="เลือกวันเริ่มต้น"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Planned End Date
                    </label>
                    <DxDateBox
                      value={formData.plannedEndDate}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, plannedEndDate: value || '' }))
                      }
                      min={formData.plannedStartDate || undefined}
                      placeholder="เลือกวันสิ้นสุด"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <DxTextBox
                    value={formData.notes}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, notes: value }))}
                    placeholder="Any additional notes..."
                  />
                </div>
              </CardContent>
            </Card>

            {/* Material Requirements Preview */}
            {selectedBom && formData.plannedQuantity && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>3. Material Requirements Preview</CardTitle>
                    {loadingExplosion && (
                      <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {bomExplosion ? (
                    <>
                      {/* Summary */}
                      <div className="mb-4 p-4 rounded-lg border">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                          <div>
                            <p className="text-sm text-gray-500">Total Materials</p>
                            <p className="text-xl font-bold">{bomExplosion.summary.totalMaterials}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Total Required</p>
                            <p className="text-xl font-bold">
                              {bomExplosion.summary.totalRequired.toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Shortage</p>
                            <p
                              className={`text-xl font-bold ${
                                bomExplosion.summary.hasShortage ? 'text-red-600' : 'text-green-600'
                              }`}
                            >
                              {bomExplosion.summary.totalShortage.toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Status</p>
                            {bomExplosion.summary.canProduce ? (
                              <Badge variant="success" dot>
                                Can Produce
                              </Badge>
                            ) : (
                              <Badge variant="danger" dot>
                                Material Shortage
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Materials Table */}
                      <DxDataGrid
                        dataSource={bomExplosion.materials}
                        keyExpr="itemId"
                        columns={materialColumns}
                        height={300}
                        noDataText="ไม่พบวัตถุดิบ"
                      />

                      {bomExplosion.summary.hasShortage && (
                        <div className="mt-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                          <div className="flex gap-3">
                            <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
                            <div>
                              <p className="text-sm text-yellow-800 font-medium">
                                Warning: Material Shortage Detected
                              </p>
                              <p className="text-sm text-yellow-700 mt-1">
                                Some materials are not available in sufficient quantity. You can still
                                create the work order, but production may be delayed until materials
                                are available.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  ) : loadingExplosion ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                    </div>
                  ) : (
                    <p className="text-center text-gray-500 py-8">
                      Enter a valid quantity to see material requirements
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
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
                    <span className="text-gray-600">BOM:</span>
                    <span className="font-medium">{selectedBom?.code || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Product:</span>
                    <span className="font-medium">{selectedBom?.productCode || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Batch:</span>
                    <span className="font-medium">{formData.batchNumber || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Quantity:</span>
                    <span className="font-medium">
                      {formData.plannedQuantity
                        ? `${parseFloat(formData.plannedQuantity).toLocaleString()} ${
                            selectedBom?.productUnit || selectedBom?.batchUnit || 'unit'
                          }`
                        : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Priority:</span>
                    <span className="font-medium">
                      {priorityOptions.find((p) => p.value === formData.priority)?.label || '-'}
                    </span>
                  </div>
                </div>

                {bomExplosion && (
                  <div className="pt-4 border-t">
                    <div className="flex items-center gap-2 mb-2">
                      {bomExplosion.summary.canProduce ? (
                        <>
                          <CheckCircle className="h-5 w-5 text-green-600" />
                          <span className="text-green-700 font-medium">Ready to Produce</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="h-5 w-5 text-yellow-600" />
                          <span className="text-yellow-700 font-medium">Material Shortage</span>
                        </>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      {bomExplosion.summary.totalMaterials} materials required
                    </p>
                  </div>
                )}

                {errors.submit && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600">{errors.submit}</p>
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex flex-col gap-3">
                <DxButton
                  text="Create Work Order"
                  type="success"
                  width="100%"
                  onClick={handleSubmit}
                  disabled={!selectedBom || !formData.batchNumber || !formData.plannedQuantity || isSubmitting}
                />
                <DxButton
                  text="Cancel"
                  type="normal"
                  stylingMode="outlined"
                  width="100%"
                  onClick={() => router.push('/production/work-orders')}
                />
              </CardFooter>
            </Card>
          </div>
        </div>
    </div>
  );
}

export default function NewWorkOrderPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    }>
      <NewWorkOrderContent />
    </Suspense>
  );
}
