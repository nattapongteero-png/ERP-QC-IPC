'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { Table } from '@/components/ui/table';
import { ArrowLeft, Package, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';

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
      // Only filter by active status if not loading a specific BOM and not searching
      if (!includeAllStatuses) {
        params.set('status', 'active');
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

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Create Work Order"
          description="สร้างใบสั่งผลิตใหม่"
          backButton={
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/production/work-orders')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
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
                    <Input
                      placeholder="Search BOM by code or name..."
                      value={bomSearch}
                      onChange={(e) => setBomSearch(e.target.value)}
                      onSearch={() => fetchBoms(bomSearch, !!bomIdParam)}
                      variant="search"
                    />
                  </div>
                  <Button variant="secondary" onClick={() => fetchBoms(bomSearch, !!bomIdParam)}>
                    Search
                  </Button>
                </div>

                {errors.bom && <p className="text-sm text-red-600">{errors.bom}</p>}

                <Select
                  label="Select BOM"
                  value={selectedBom?.id?.toString() || ''}
                  onChange={(e) => handleBomSelect(e.target.value)}
                  error={errors.bom}
                >
                  <option value="">-- Select a BOM --</option>
                  {boms.map((bom) => (
                    <option key={bom.id} value={bom.id}>
                      {bom.code} - {bom.name} ({bom.productCode})
                    </option>
                  ))}
                </Select>

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
                        <Input
                          label="Batch Number"
                          value={formData.batchNumber}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, batchNumber: e.target.value }))
                          }
                          error={errors.batchNumber}
                          placeholder="e.g., PRD-240101-001"
                        />
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={generateBatchNumber}
                        disabled={!selectedBom}
                        className="mb-0.5"
                      >
                        Generate
                      </Button>
                    </div>
                  </div>

                  <Input
                    label="Planned Quantity"
                    type="number"
                    value={formData.plannedQuantity}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, plannedQuantity: e.target.value }))
                    }
                    error={errors.plannedQuantity}
                    placeholder="Enter quantity"
                    rightIcon={
                      <span className="text-gray-400 text-sm">
                        {selectedBom?.productUnit || selectedBom?.batchUnit || 'unit'}
                      </span>
                    }
                  />

                  <Select
                    label="Priority"
                    value={formData.priority}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, priority: e.target.value }))
                    }
                    options={priorityOptions}
                  />

                  <div></div>

                  <DatePicker
                    label="Planned Start Date"
                    value={formData.plannedStartDate}
                    onChange={(value) =>
                      setFormData((prev) => ({ ...prev, plannedStartDate: value }))
                    }
                    max={formData.plannedEndDate || undefined}
                    showQuickActions={false}
                    size="sm"
                  />

                  <DatePicker
                    label="Planned End Date"
                    value={formData.plannedEndDate}
                    onChange={(value) =>
                      setFormData((prev) => ({ ...prev, plannedEndDate: value }))
                    }
                    min={formData.plannedStartDate || undefined}
                    showQuickActions={false}
                    size="sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
                  <textarea
                    className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-base focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all"
                    rows={3}
                    value={formData.notes}
                    onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
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
                      <Table
                        columns={[
                          { key: 'itemCode', header: 'Item Code' },
                          { key: 'itemName', header: 'Item Name' },
                          {
                            key: 'required',
                            header: 'Required',
                            render: (m: Material) => `${m.requiredQuantity.toLocaleString()} ${m.unit}`,
                          },
                          {
                            key: 'available',
                            header: 'Available',
                            render: (m: Material) => `${m.availableStock.toLocaleString()} ${m.unit}`,
                          },
                          {
                            key: 'shortage',
                            header: 'Shortage',
                            render: (m: Material) =>
                              m.shortage > 0 ? (
                                <span className="text-red-600 font-medium">
                                  -{m.shortage.toLocaleString()} {m.unit}
                                </span>
                              ) : (
                                <span className="text-green-600">OK</span>
                              ),
                          },
                        ]}
                        data={bomExplosion.materials}
                        keyField="itemId"
                        compact
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
                <Button
                  onClick={handleSubmit}
                  disabled={!selectedBom || !formData.batchNumber || !formData.plannedQuantity || isSubmitting}
                  loading={isSubmitting}
                  fullWidth
                >
                  Create Work Order
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => router.push('/production/work-orders')}
                  fullWidth
                >
                  Cancel
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

export default function NewWorkOrderPage() {
  return (
    <Suspense fallback={
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        </div>
      </MainLayout>
    }>
      <NewWorkOrderContent />
    </Suspense>
  );
}
