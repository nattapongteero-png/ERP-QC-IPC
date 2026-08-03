'use client';

/**
 * Landed Cost Form Component
 * Creates/edits landed cost documents
 * Feature: 014-unit-cost
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import notify from 'devextreme/ui/notify';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsivePageHeader } from '@/components/shared';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { DxNumberBox } from '@/components/ui/dx-number-box';
import { DxSelectBox } from '@/components/ui/dx-select-box';
import { DxDataGrid, DxDataGridColumn } from '@/components/ui/dx-data-grid';
import { DxDateBox } from '@/components/ui/dx-date-box';
import { Receipt, Truck, Calculator, FileCheck } from 'lucide-react';
import { toLocalDateStr } from '@/lib/utils/date-format';
import type {
  LandedCostHeader,
  LandedCostHeaderCreate,
  LandedCostHeaderUpdate,
  LandedCostLineCreate,
  LandedCostType,
  AllocationBasis,
} from '@/types/unit-cost';

export interface LandedCostFormProps {
  mode: 'create' | 'edit';
  landedCostId?: number;
}

interface Vendor {
  id: number;
  code: string;
  name: string;
}

interface PurchaseOrder {
  id: number;
  poNumber: string;
  vendorId: number;
  vendorName: string;
  totalAmount: number;
  status: string;
}

interface FormData {
  referenceType: 'po' | 'shipment';
  referenceId: number | null;
  vendorId: number | null;
  invoiceNumber: string;
  invoiceDate: string | null;
  currency: string;
  exchangeRate: number;
  lines: LandedCostLineCreate[];
}

async function fetchLandedCost(id: number): Promise<LandedCostHeader> {
  const res = await fetch(`/api/cost/landed-costs/${id}`);
  if (!res.ok) throw new Error('Failed to fetch landed cost');
  const data = await res.json();
  return data.data;
}

async function fetchVendors(): Promise<Vendor[]> {
  // The list APIs paginate on `limit` (default 20) — `pageSize` is ignored, which
  // silently truncated the dropdowns. Use `limit` so ALL rows load.
  const res = await fetch('/api/vendors?limit=1000');
  if (!res.ok) return [];
  const data = await res.json();
  return data.data?.items || [];
}

async function fetchPurchaseOrders(): Promise<PurchaseOrder[]> {
  // Only received POs (their goods have arrived, so landed cost can capitalise
  // into inventory) — and `limit`, not `pageSize`, so none are dropped.
  const res = await fetch('/api/purchasing/orders?status=received&limit=1000');
  if (!res.ok) return [];
  const data = await res.json();
  return data.data?.items || [];
}

async function createLandedCost(data: LandedCostHeaderCreate): Promise<{ id: number; documentNumber: string }> {
  const res = await fetch('/api/cost/landed-costs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to create landed cost');
  }
  const result = await res.json();
  return result.data;
}

async function updateLandedCostApi(id: number, data: LandedCostHeaderUpdate): Promise<void> {
  const res = await fetch(`/api/cost/landed-costs/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to update landed cost');
  }
}

async function deleteLandedCostApi(id: number): Promise<void> {
  const res = await fetch(`/api/cost/landed-costs/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to delete landed cost');
  }
}

async function allocateLandedCostApi(id: number): Promise<{ allocations: unknown[] }> {
  const res = await fetch(`/api/cost/landed-costs/${id}/allocate`, {
    method: 'POST',
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to allocate landed cost');
  }
  const result = await res.json();
  return result.data;
}

async function postLandedCostApi(id: number): Promise<void> {
  const res = await fetch(`/api/cost/landed-costs/${id}/post`, {
    method: 'POST',
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to post landed cost');
  }
}

const COST_TYPE_VALUES: LandedCostType[] = ['freight', 'duty', 'insurance', 'handling', 'inspection', 'other'];
const ALLOCATION_BASIS_VALUES: AllocationBasis[] = ['value', 'quantity', 'weight', 'volume'];

const currencies = ['THB', 'USD', 'EUR', 'JPY', 'CNY'];

const defaultLine: LandedCostLineCreate = {
  costType: 'freight',
  description: '',
  amount: 0,
  allocationBasis: 'value',
};

export function LandedCostForm({ mode, landedCostId }: LandedCostFormProps) {
  const router = useRouter();
  const t = useTranslations('cost');
  const queryClient = useQueryClient();
  const costTypes = COST_TYPE_VALUES.map((value) => ({ value, label: t(`landedCosts.form.costTypes.${value}`) }));
  const allocationBases = ALLOCATION_BASIS_VALUES.map((value) => ({ value, label: t(`landedCosts.form.allocationBases.${value}`) }));
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    referenceType: 'po',
    referenceId: null,
    vendorId: null,
    invoiceNumber: '',
    invoiceDate: null,
    currency: 'THB',
    exchangeRate: 1,
    lines: [{ ...defaultLine }],
  });

  // Fetch existing landed cost for edit mode
  const { data: landedCost, isLoading: isLoadingLandedCost } = useQuery({
    queryKey: ['landed-cost', landedCostId],
    queryFn: () => fetchLandedCost(landedCostId!),
    enabled: mode === 'edit' && !!landedCostId,
  });

  // Fetch vendors for dropdown
  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors-list'],
    queryFn: fetchVendors,
  });

  // Fetch POs for dropdown
  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ['po-list-for-landed-cost'],
    queryFn: fetchPurchaseOrders,
  });

  // Update form when landed cost data loads
  useEffect(() => {
    if (landedCost) {
      setFormData({
        referenceType: landedCost.referenceType,
        referenceId: landedCost.referenceId,
        vendorId: landedCost.vendorId,
        invoiceNumber: landedCost.invoiceNumber || '',
        invoiceDate: landedCost.invoiceDate,
        currency: landedCost.currency,
        exchangeRate: landedCost.exchangeRate,
        lines: landedCost.lines?.map((l) => ({
          costType: l.costType,
          description: l.description,
          amount: l.amount,
          allocationBasis: l.allocationBasis,
        })) || [{ ...defaultLine }],
      });
    }
  }, [landedCost]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: createLandedCost,
    onSuccess: (result) => {
      notify(`Landed cost ${result.documentNumber} created successfully`, 'success', 3000);
      queryClient.invalidateQueries({ queryKey: ['landed-costs'] });
      router.push(`/cost/landed-costs/${result.id}`);
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: LandedCostHeaderUpdate) => updateLandedCostApi(landedCostId!, data),
    onSuccess: () => {
      notify('Landed cost updated successfully', 'success', 3000);
      queryClient.invalidateQueries({ queryKey: ['landed-costs'] });
      queryClient.invalidateQueries({ queryKey: ['landed-cost', landedCostId] });
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteLandedCostApi(landedCostId!),
    onSuccess: () => {
      notify('Landed cost deleted successfully', 'success', 3000);
      queryClient.invalidateQueries({ queryKey: ['landed-costs'] });
      router.push('/cost/landed-costs');
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  const allocateMutation = useMutation({
    mutationFn: () => allocateLandedCostApi(landedCostId!),
    onSuccess: (result) => {
      notify(`Allocated to ${result.allocations.length} items`, 'success', 3000);
      queryClient.invalidateQueries({ queryKey: ['landed-cost', landedCostId] });
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  const postMutation = useMutation({
    mutationFn: () => postLandedCostApi(landedCostId!),
    onSuccess: () => {
      notify('Landed cost posted successfully', 'success', 3000);
      queryClient.invalidateQueries({ queryKey: ['landed-costs'] });
      queryClient.invalidateQueries({ queryKey: ['landed-cost', landedCostId] });
    },
    onError: (error: Error) => {
      notify(error.message, 'error', 5000);
    },
  });

  const handleSubmit = () => {
    if (!formData.referenceId) {
      notify('Please select a Purchase Order', 'error', 3000);
      return;
    }
    if (formData.lines.length === 0 || formData.lines.every((l) => l.amount <= 0)) {
      notify('Please add at least one cost line with amount > 0', 'error', 3000);
      return;
    }

    const payload = {
      referenceType: formData.referenceType,
      referenceId: formData.referenceId,
      vendorId: formData.vendorId,
      invoiceNumber: formData.invoiceNumber || null,
      invoiceDate: formData.invoiceDate
        ? (formData.invoiceDate.includes('T') ? formData.invoiceDate.split('T')[0] : formData.invoiceDate)
        : null,
      currency: formData.currency,
      exchangeRate: formData.exchangeRate,
      lines: formData.lines.filter((l) => l.amount > 0),
    };

    if (mode === 'create') {
      createMutation.mutate(payload);
    } else {
      updateMutation.mutate(payload);
    }
  };

  const addLine = () => {
    setFormData((prev) => ({
      ...prev,
      lines: [...prev.lines, { ...defaultLine }],
    }));
  };

  const removeLine = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== index),
    }));
  };

  const updateLine = (index: number, field: keyof LandedCostLineCreate, value: unknown) => {
    setFormData((prev) => ({
      ...prev,
      lines: prev.lines.map((line, i) =>
        i === index ? { ...line, [field]: value } : line
      ),
    }));
  };

  const totalAmount = formData.lines.reduce((sum, line) => sum + (line.amount || 0), 0);
  const isEditable = mode === 'create' || landedCost?.status === 'draft';
  const canAllocate = mode === 'edit' && landedCost?.status === 'draft';
  const canPost = mode === 'edit' && landedCost?.status === 'allocated';

  if (mode === 'edit' && isLoadingLandedCost) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="landed-cost-form">
      <ResponsivePageHeader
        title={mode === 'create' ? t('landedCosts.form.createTitle') : t('landedCosts.form.editTitle', { number: landedCost?.documentNumber ?? '' })}
        icon={Truck}
        subtitle={mode === 'create' ? t('landedCosts.form.createSubtitle') : undefined}
        actions={
          <div className="flex gap-2">
            {canAllocate && (
              <DxButton
                text={t('landedCosts.form.allocate')}
                icon="chart"
                type="default"
                stylingMode="outlined"
                onClick={() => allocateMutation.mutate()}
                disabled={allocateMutation.isPending}
              />
            )}
            {canPost && (
              <DxButton
                text={t('landedCosts.form.post')}
                icon="check"
                type="success"
                onClick={() => postMutation.mutate()}
                disabled={postMutation.isPending}
              />
            )}
            {isEditable && (
              <>
                <DxButton
                  text={t('landedCosts.form.cancel')}
                  type="normal"
                  stylingMode="outlined"
                  onClick={() => router.push('/cost/landed-costs')}
                />
                <DxButton
                  text={mode === 'create' ? t('landedCosts.form.create') : t('landedCosts.form.save')}
                  type="default"
                  icon="save"
                  onClick={handleSubmit}
                  disabled={createMutation.isPending || updateMutation.isPending}
                />
              </>
            )}
            {mode === 'edit' && landedCost?.status === 'draft' && (
              <DxButton
                text={t('landedCosts.form.delete')}
                type="danger"
                stylingMode="outlined"
                icon="trash"
                onClick={() => setShowDeleteConfirm(true)}
              />
            )}
          </div>
        }
      />

      {/* Status Badge */}
      {mode === 'edit' && landedCost && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">{t('landedCosts.form.status')}</span>
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              landedCost.status === 'draft'
                ? 'bg-yellow-100 text-yellow-800'
                : landedCost.status === 'allocated'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-green-100 text-green-800'
            }`}
          >
            {landedCost.status.charAt(0).toUpperCase() + landedCost.status.slice(1)}
          </span>
        </div>
      )}

      {/* Header Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            {t('landedCosts.form.headerInfo')}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('landedCosts.form.purchaseOrder')} *
            </label>
            <DxSelectBox
              items={purchaseOrders as any[]}
              // Show PO number + vendor + amount so the buyer can identify the
              // right PO without memorising numbers (was PO number only).
              displayExpr={(po: any) =>
                po
                  ? [
                      po.poNumber,
                      po.vendorName,
                      po.totalAmount != null
                        ? `฿${Number(po.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join('  ·  ')
                  : ''
              }
              valueExpr="id"
              value={formData.referenceId}
              onValueChange={(val: any) => {
                const po = purchaseOrders.find((p) => p.id === val);
                setFormData((prev) => ({
                  ...prev,
                  referenceId: val,
                  vendorId: po?.vendorId || null,
                }));
              }}
              disabled={!isEditable}
              searchEnabled
              placeholder={t('landedCosts.form.selectPo')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('landedCosts.form.vendor')}
            </label>
            <DxSelectBox
              items={vendors as any[]}
              displayExpr="name"
              valueExpr="id"
              value={formData.vendorId}
              onValueChange={(val: any) => setFormData((prev) => ({ ...prev, vendorId: val }))}
              disabled={!isEditable}
              searchEnabled
              placeholder={t('landedCosts.form.selectVendor')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('landedCosts.form.invoiceNumber')}
            </label>
            <DxTextBox
              value={formData.invoiceNumber}
              onValueChange={(val) => setFormData((prev) => ({ ...prev, invoiceNumber: val }))}
              disabled={!isEditable}
              placeholder={t('landedCosts.form.invoiceNumberPlaceholder')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('landedCosts.form.invoiceDate')}
            </label>
            <DxDateBox
              value={formData.invoiceDate || undefined}
              onValueChange={(val: any) => {
                let formatted: string | null = null;
                if (val && typeof val === 'object' && 'toISOString' in val) {
                  formatted = toLocalDateStr(val as Date);
                } else if (typeof val === 'string' && val) {
                  formatted = val.includes('T') ? val.split('T')[0] : val;
                }
                setFormData((prev) => ({ ...prev, invoiceDate: formatted }));
              }}
              disabled={!isEditable}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('landedCosts.form.currency')}
            </label>
            <DxSelectBox
              items={currencies.map(c => ({ value: c, label: c }))}
              value={formData.currency}
              valueExpr="value"
              displayExpr="label"
              onValueChange={(val) => setFormData((prev) => ({ ...prev, currency: val }))}
              disabled={!isEditable}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('landedCosts.form.exchangeRate')}
            </label>
            <DxNumberBox
              value={formData.exchangeRate}
              onValueChange={(val) => setFormData((prev) => ({ ...prev, exchangeRate: val ?? 1 }))}
              disabled={!isEditable}
              min={0.0001}
              format="#,##0.####"
            />
          </div>
        </CardContent>
      </Card>

      {/* Cost Lines */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            {t('landedCosts.form.costLines')}
          </CardTitle>
          {isEditable && (
            <DxButton
              text={t('landedCosts.form.addLine')}
              icon="plus"
              type="default"
              stylingMode="outlined"
              onClick={addLine}
            />
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {formData.lines.map((line, index) => (
              <div
                key={index}
                className="grid grid-cols-1 md:grid-cols-12 gap-3 p-3 bg-gray-50 rounded-lg"
                data-testid={`cost-line-${index}`}
              >
                <div className="md:col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">{t('landedCosts.form.costType')}</label>
                  <DxSelectBox
                    items={costTypes}
                    displayExpr="label"
                    valueExpr="value"
                    value={line.costType}
                    onValueChange={(val) => updateLine(index, 'costType', val)}
                    disabled={!isEditable}
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-xs text-gray-500 mb-1">{t('landedCosts.form.description')}</label>
                  <DxTextBox
                    value={line.description || ''}
                    onValueChange={(val) => updateLine(index, 'description', val)}
                    disabled={!isEditable}
                    placeholder={t('landedCosts.form.descriptionPlaceholder')}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">{t('landedCosts.form.amount')}</label>
                  <DxNumberBox
                    value={line.amount}
                    onValueChange={(val) => updateLine(index, 'amount', val)}
                    disabled={!isEditable}
                    min={0}
                    format="#,##0.00"
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-xs text-gray-500 mb-1">{t('landedCosts.form.allocationBasis')}</label>
                  <DxSelectBox
                    items={allocationBases}
                    displayExpr="label"
                    valueExpr="value"
                    value={line.allocationBasis}
                    onValueChange={(val) => updateLine(index, 'allocationBasis', val)}
                    disabled={!isEditable}
                  />
                </div>
                <div className="md:col-span-2 flex items-end">
                  {isEditable && formData.lines.length > 1 && (
                    <DxButton
                      icon="trash"
                      type="danger"
                      stylingMode="text"
                      onClick={() => removeLine(index)}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="mt-4 flex justify-end">
            <div className="bg-blue-50 px-6 py-3 rounded-lg">
              <span className="text-sm text-gray-600">{t('landedCosts.form.totalAmount')}</span>
              <span className="text-xl font-bold text-blue-600">
                {new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2 }).format(totalAmount)}
              </span>
              <span className="ml-1 text-sm text-gray-600">{formData.currency}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Allocations (for edit mode) */}
      {mode === 'edit' && landedCost?.allocations && landedCost.allocations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5" />
              {t('landedCosts.form.allocationTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DxDataGrid
              dataSource={landedCost.allocations}
              showBorders
              rowAlternationEnabled
              columns={[
                { dataField: 'itemCode', caption: t('landedCosts.form.columns.itemCode'), width: 120 },
                { dataField: 'itemName', caption: t('landedCosts.form.columns.itemName') },
                { dataField: 'basisValue', caption: t('landedCosts.form.columns.basisValue'), format: '#,##0.00', width: 120 },
                { dataField: 'allocatedAmount', caption: t('landedCosts.form.columns.allocatedAmount'), format: '#,##0.0000', width: 140 },
              ] as DxDataGridColumn[]}
            />
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">{t('landedCosts.form.deleteConfirm.title')}</h3>
            <p className="text-gray-600 mb-6">
              {t('landedCosts.form.deleteConfirm.message')}
            </p>
            <div className="flex justify-end gap-3">
              <DxButton
                text={t('landedCosts.form.deleteConfirm.cancel')}
                type="normal"
                stylingMode="outlined"
                onClick={() => setShowDeleteConfirm(false)}
              />
              <DxButton
                text={t('landedCosts.form.deleteConfirm.confirm')}
                type="danger"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  deleteMutation.mutate();
                }}
                disabled={deleteMutation.isPending}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LandedCostForm;
