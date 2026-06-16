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
import { Package, AlertTriangle, CheckCircle, Loader2, Users, Trash2 } from 'lucide-react';
import { formatNumber } from '@/lib/utils/number-format';

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

const ROLE_OPTIONS = [
  { value: 'operator', label: 'Operator (ผู้ปฏิบัติงาน)' },
  { value: 'supervisor', label: 'Supervisor (หัวหน้าคุม)' },
  { value: 'qa_verifier', label: 'QA Verifier (ตรวจสอบ QA)' },
  { value: 'ipc_checker', label: 'IPC Checker (ตรวจ IPC)' },
  { value: 'pharmacist', label: 'Pharmacist (เภสัชกรผู้ควบคุม)' },
];

interface EmployeeOption {
  id: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
  positionId: number | null;
  positionTitle: string | null;
}

interface Assignee {
  employeeId: number | null;
  role: string;
  positionId: number | null;
  notes: string;
}

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
    deliveryDate: '',
    notes: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Assignees state — team members assigned to this batch.
  // Snapshot of positionId is kept per row so it doesn't drift if the employee
  // changes positions later. UI auto-fills positionId when an employee is picked.
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  useEffect(() => {
    (async () => {
      setLoadingEmployees(true);
      try {
        const res = await fetch('/api/hr/employees?limit=500&isActive=true');
        const data = await res.json();
        if (data.success) {
          // API returns shape may be data.items or data.data — be defensive
          const raw = data.data?.items || data.data || [];
          setEmployees(
            raw.map((e: { id: number; employeeCode: string; firstName: string; lastName: string; positionId?: number | null; positionTitle?: string | null }) => ({
              id: e.id,
              employeeCode: e.employeeCode,
              firstName: e.firstName,
              lastName: e.lastName,
              positionId: e.positionId ?? null,
              positionTitle: e.positionTitle ?? null,
            }))
          );
        }
      } catch (err) {
        console.error('Failed to load employees:', err);
      } finally {
        setLoadingEmployees(false);
      }
    })();
  }, []);

  const addAssignee = () => {
    setAssignees((prev) => [...prev, { employeeId: null, role: 'operator', positionId: null, notes: '' }]);
  };

  const removeAssignee = (index: number) => {
    setAssignees((prev) => prev.filter((_, i) => i !== index));
  };

  const updateAssignee = (index: number, patch: Partial<Assignee>) => {
    setAssignees((prev) => prev.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  };

  // When user picks an employee, auto-fill their primary position
  const handleEmployeeChange = (index: number, employeeId: number | null) => {
    const emp = employees.find((e) => e.id === employeeId);
    updateAssignee(index, { employeeId, positionId: emp?.positionId ?? null });
  };

  // Fetch BOMs - Only approved BOMs can be used for work orders
  const fetchBoms = async (search = '', includeAllStatuses = false) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      // Only approved BOMs can be used for production work orders
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
          deliveryDate: formData.deliveryDate || null,
          notes: formData.notes || null,
          // Only send valid rows (employeeId picked + role set)
          assignees: assignees
            .filter((a) => a.employeeId && a.role)
            .map((a) => ({
              employeeId: a.employeeId,
              role: a.role,
              positionId: a.positionId,
              notes: a.notes || undefined,
            })),
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

  // Number formatter — comma thousands + up to 4 fraction digits. Small WIP
  // recipes produce values like 1.1084 kg; default toLocaleString trims
  // those and the operator loses precision.
  const fmtQty = (n: number) => formatNumber(n);

  const materialColumns: DxDataGridColumn[] = [
    { dataField: 'itemCode', caption: 'รหัสสินค้า', width: 130 },
    { dataField: 'itemName', caption: 'ชื่อสินค้า' },
    {
      dataField: 'requiredQuantity',
      caption: 'ต้องการ',
      width: 170,
      alignment: 'right',
      cellRender: (cellInfo) => (
        <span className="font-mono">
          {fmtQty(cellInfo.data.requiredQuantity)}
          <span className="text-gray-500 ml-1">{cellInfo.data.unit}</span>
        </span>
      ),
    },
    {
      dataField: 'availableStock',
      caption: 'คงคลัง',
      width: 170,
      alignment: 'right',
      cellRender: (cellInfo) => (
        <span className="font-mono">
          {fmtQty(cellInfo.data.availableStock)}
          <span className="text-gray-500 ml-1">{cellInfo.data.unit}</span>
        </span>
      ),
    },
    {
      dataField: 'shortage',
      caption: 'ขาด',
      width: 170,
      alignment: 'right',
      cellRender: (cellInfo) =>
        cellInfo.data.shortage > 0 ? (
          <span className="text-red-600 font-mono font-medium">
            -{fmtQty(cellInfo.data.shortage)}
            <span className="text-red-500 ml-1">{cellInfo.data.unit}</span>
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
                              {formatNumber(selectedBom.standardBatchSize) || '-'} {selectedBom.batchUnit}
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Delivery Date (วันที่ส่งมอบ)
                    </label>
                    <DxDateBox
                      value={formData.deliveryDate}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, deliveryDate: value || '' }))
                      }
                      min={formData.plannedEndDate || undefined}
                      disabled={!formData.plannedStartDate || !formData.plannedEndDate}
                      placeholder={
                        !formData.plannedStartDate || !formData.plannedEndDate
                          ? 'กรุณาระบุวันเริ่มต้นและวันสิ้นสุดก่อน'
                          : 'เลือกวันส่งมอบ'
                      }
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

            {/* Assigned Team */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-emerald-600" />
                    3. Assigned Team (เจ้าหน้าที่ผู้ปฏิบัติงาน)
                  </CardTitle>
                  <DxButton
                    icon="plus"
                    text="เพิ่มเจ้าหน้าที่"
                    type="default"
                    stylingMode="outlined"
                    onClick={addAssignee}
                    disabled={loadingEmployees}
                  />
                </div>
              </CardHeader>
              <CardContent>
                {assignees.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="h-10 w-10 mx-auto text-gray-300 mb-2" />
                    <p className="text-sm">ยังไม่มีเจ้าหน้าที่ — กดปุ่ม &ldquo;เพิ่มเจ้าหน้าที่&rdquo; เพื่อมอบหมายทีมงาน</p>
                    <p className="text-xs text-gray-400 mt-1">
                      ไม่บังคับ (optional) — แต่แนะนำตามมาตรฐาน GMP ให้ระบุ Operator + Verifier (dual-control)
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {assignees.map((a, idx) => {
                      const emp = employees.find((e) => e.id === a.employeeId);
                      return (
                        <div
                          key={idx}
                          className="grid grid-cols-12 gap-2 items-start p-3 bg-gray-50 rounded-lg border border-gray-200"
                        >
                          <div className="col-span-12 md:col-span-5">
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              เจ้าหน้าที่ <span className="text-red-500">*</span>
                            </label>
                            <DxSelectBox
                              items={employees.map((e) => ({
                                value: e.id.toString(),
                                label: `${e.employeeCode} — ${e.firstName} ${e.lastName}`,
                              }))}
                              value={a.employeeId?.toString() || ''}
                              onValueChange={(v) => handleEmployeeChange(idx, v ? parseInt(v) : null)}
                              placeholder={loadingEmployees ? 'กำลังโหลด...' : '-- เลือกเจ้าหน้าที่ --'}
                              disabled={loadingEmployees}
                            />
                          </div>
                          <div className="col-span-12 md:col-span-3">
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              บทบาท <span className="text-red-500">*</span>
                            </label>
                            <DxSelectBox
                              items={ROLE_OPTIONS}
                              value={a.role}
                              onValueChange={(v) => updateAssignee(idx, { role: v })}
                              placeholder="-- เลือกบทบาท --"
                            />
                          </div>
                          <div className="col-span-10 md:col-span-3">
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              ตำแหน่ง (auto)
                            </label>
                            <div className="px-3 py-2 bg-white border border-gray-200 rounded text-sm text-gray-700 truncate min-h-[34px] flex items-center">
                              {emp?.positionTitle || <span className="text-gray-400 italic">—</span>}
                            </div>
                          </div>
                          <div className="col-span-2 md:col-span-1 flex items-end justify-end h-full">
                            <button
                              type="button"
                              onClick={() => removeAssignee(idx)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-md transition"
                              title="ลบ"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    <p className="text-xs text-gray-500 pt-2">
                      💡 ตำแหน่งดึงจากข้อมูล HR (ตำแหน่งหลักของพนักงาน) — สามารถเพิ่มเจ้าหน้าที่ได้หลายคน คนเดียวกันมีหลาย role ได้
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Material Requirements Preview */}
            {selectedBom && formData.plannedQuantity && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>4. Material Requirements Preview</CardTitle>
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
                              {formatNumber(bomExplosion.summary.totalRequired)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Shortage</p>
                            <p
                              className={`text-xl font-bold ${
                                bomExplosion.summary.hasShortage ? 'text-red-600' : 'text-green-600'
                              }`}
                            >
                              {formatNumber(bomExplosion.summary.totalShortage)}
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
                        ? `${formatNumber(parseFloat(formData.plannedQuantity))} ${
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
